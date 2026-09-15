/**
 * RESEARCH ENGINE (spec 19, 20, 52).
 *
 * Rules the lab follows:
 *   - network access is off until the user turns it on
 *   - only the allowlisted official documentation hosts are fetched
 *   - one source is never a fact: a finding needs agreement from `minSources`
 *   - everything fetched is cached, so offline mode still has something to work
 *     with, and the lab says plainly when an answer needs the network
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { hashHex, nowIso, round } from '../core/util.js';

const DOC_INDEX = {
  'game loop': [
    'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame',
    'https://web.dev/articles/optimize-javascript-execution',
  ],
  'canvas': [
    'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial',
    'https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D',
  ],
  'webgl': [
    'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial',
    'https://registry.khronos.org/webgl/specs/latest/1.0/',
  ],
  'gltf': [
    'https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html',
    'https://threejs.org/docs/#examples/en/loaders/GLTFLoader',
  ],
  'pointer events': [
    'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events',
    'https://www.w3.org/TR/pointerevents3/',
  ],
  'web audio': [
    'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API',
    'https://www.w3.org/TR/webaudio/',
  ],
  'storage': [
    'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage',
    'https://html.spec.whatwg.org/multipage/webstorage.html',
  ],
  'performance': [
    'https://developer.mozilla.org/en-US/docs/Web/API/Performance/now',
    'https://web.dev/articles/rendering-performance',
  ],
};

export class ResearchEngine {
  constructor({ config, store, bus }) {
    this.config = config;
    this.store = store;
    this.bus = bus;
    this.cacheDir = path.join(config.dirs.cache, 'research');
  }

  get allowlist() { return this.config.research.allowlist; }

  allowed(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false;
      return this.allowlist.includes(u.hostname);
    } catch { return false; }
  }

  async online() {
    if (!this.config.permissions.network) return false;
    try {
      const res = await fetch('https://developer.mozilla.org/robots.txt', { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      return res.ok || res.status === 405;
    } catch { return false; }
  }

  async #cachePath(url) {
    await fs.mkdir(this.cacheDir, { recursive: true });
    return path.join(this.cacheDir, `${hashHex(url)}.json`);
  }

  async cached(url) {
    try { return JSON.parse(await fs.readFile(await this.#cachePath(url), 'utf8')); } catch { return null; }
  }

  async fetchDoc(url, { maxBytes = 400_000 } = {}) {
    if (!this.allowed(url)) {
      return { url, ok: false, reason: 'host is not in the official-documentation allowlist', fromCache: false };
    }
    const cached = await this.cached(url);
    if (!this.config.permissions.network) {
      return cached
        ? { ...cached, fromCache: true, note: 'served from cache; network access is disabled' }
        : { url, ok: false, reason: 'network access is disabled and this page is not cached', fromCache: false };
    }
    try {
      const res = await fetch(url, { headers: { accept: 'text/html,text/plain' }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.text()).slice(0, maxBytes);
      const doc = {
        url,
        ok: true,
        host: new URL(url).hostname,
        title: (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || url,
        text: stripHtml(raw).slice(0, 20000),
        fetchedAt: nowIso(),
      };
      await fs.writeFile(await this.#cachePath(url), JSON.stringify(doc));
      return { ...doc, fromCache: false };
    } catch (err) {
      if (cached) return { ...cached, fromCache: true, note: `live fetch failed (${err.message}); using cache` };
      return { url, ok: false, reason: err.message, fromCache: false };
    }
  }

  /**
   * Answer a technical question from official docs.
   * A claim is only reported as "corroborated" when at least `minSources`
   * allowlisted documents contain the supporting terms.
   */
  async investigate(question, { extraUrls = [] } = {}) {
    const topic = matchTopic(question);
    const urls = [...new Set([...(DOC_INDEX[topic] || []), ...extraUrls.filter((u) => this.allowed(u))])];
    const online = await this.online();

    if (!urls.length) {
      return this.#record({
        question, topic, online, sources: [], corroboration: 0,
        answer: 'No official documentation source is mapped to this question yet.',
        confidence: 0,
        needsInternet: !online,
      });
    }

    const docs = [];
    for (const url of urls) docs.push(await this.fetchDoc(url));
    const usable = docs.filter((d) => d.ok);
    const terms = keyTerms(question);
    const hits = usable.map((d) => ({
      url: d.url,
      host: d.host,
      title: d.title,
      fromCache: !!d.fromCache,
      matched: terms.filter((t) => d.text?.toLowerCase().includes(t)),
      excerpt: excerptAround(d.text || '', terms[0]) || (d.text || '').slice(0, 280),
    }));
    const corroborating = hits.filter((h) => h.matched.length >= Math.max(1, Math.ceil(terms.length / 2)));
    const minSources = this.config.research.minSources;

    return this.#record({
      question,
      topic,
      online,
      sources: hits,
      corroboration: corroborating.length,
      answer: corroborating.length
        ? `${corroborating.length} official source(s) discuss this. ${corroborating[0].excerpt}`
        : usable.length
          ? 'The mapped official sources were reachable but did not clearly address the question.'
          : 'No source could be read (offline and nothing cached).',
      confidence: round(Math.min(0.9, corroborating.length / Math.max(1, minSources) * 0.7), 2),
      corroborated: corroborating.length >= minSources,
      needsInternet: !online && usable.length === 0,
      note: corroborating.length < minSources
        ? `Fewer than ${minSources} corroborating sources: treat this as a lead, not a fact.`
        : null,
    });
  }

  async #record(result) {
    const doc = await this.store.research.put({ ...result, at: nowIso() });
    this.bus?.info('research.done', { question: result.question, corroboration: result.corroboration, online: result.online });
    return doc;
  }

  async history(n = 30) {
    const all = await this.store.research.all();
    return all.sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, n);
  }

  /** What the lab can still do with the network switched off (spec 20). */
  async offlineCapabilities() {
    let cachedCount = 0;
    try { cachedCount = (await fs.readdir(this.cacheDir)).length; } catch { /* no cache yet */ }
    const knowledge = await this.store.knowledge.count();
    const projects = await this.store.projects.count();
    return {
      available: [
        'import and analyse projects',
        'extract concepts and build the knowledge graph',
        'design, generate, run and test games',
        'run experiments, benchmarks and version promotion',
      ],
      unavailable: ['fetching new documentation', 'remote model providers', 'remote training backends'],
      cachedDocuments: cachedCount,
      knowledgeItems: knowledge,
      projects,
    };
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTopic(question) {
  const q = String(question).toLowerCase();
  let best = null, bestScore = 0;
  for (const topic of Object.keys(DOC_INDEX)) {
    const score = topic.split(' ').filter((w) => q.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = topic; }
  }
  if (best) return best;
  if (/\b(raf|frame|delta|fps)\b/.test(q)) return 'game loop';
  if (/\b(glb|gltf|model|mesh)\b/.test(q)) return 'gltf';
  if (/\b(sound|audio|oscillator)\b/.test(q)) return 'web audio';
  if (/\b(save|persist|localstorage)\b/.test(q)) return 'storage';
  return 'canvas';
}

function keyTerms(question) {
  const stop = new Set(['what', 'how', 'why', 'the', 'a', 'an', 'is', 'are', 'to', 'in', 'of', 'for', 'and', 'or', 'do', 'does', 'i', 'my', 'can', 'should']);
  return [...new Set(String(question).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || [])]
    .filter((w) => !stop.has(w))
    .slice(0, 6);
}

function excerptAround(text, term) {
  if (!term) return null;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return null;
  return text.slice(Math.max(0, i - 140), i + 220).trim();
}
