/* ============================================================
   NEXUS · the whole interface in English and हिन्दी — not only what
   translations.js holds. A text of the interface (written in Arabic in
   index.html) that the dictionary lacks is translated ONCE by NEXUS AI —
   the site's own keys and key pool (ai.js) — and kept for every visitor
   (Firestore i18n_cache, read and written only here):
   • Hindi in Devanagari — technical words too (गेम, प्रोजेक्ट, कोड);
     only AI, NEXUS, brands and code stay in Latin letters;
   • English, short and natural.
   Only the interface: a text whose words are not the interface's own (a
   game's title, a post, a name, a chat) is never sent to any model — it
   stays as its author wrote it. Numbers arrive as {0}, {1}… placeholders.
   GET  /api/i18n/dict?lang=hi|en              → { ok, lang, t: { source: translation } }
   POST /api/i18n/translate { lang, strings }  → { ok, t: { source: translation } }
   Limits (per day): I18N_PER_IP (600 strings) · I18N_DAILY (30000).
   ============================================================ */
import { aiRoute, aiCall } from './ai.js';
import { ready as fsReady, getDoc, commit, put } from './points.js';

const env = k => { try { return (globalThis.Netlify && Netlify.env.get(k)) || ''; } catch { return ''; } };
const num = (k, d) => { const v = +env(k); return Number.isFinite(v) && v > 0 ? v : d; };
const LANGS = { en: 'English', hi: 'Hindi' };
const SHARDS = 16;
const json = (status, obj, extra = {}) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra) });
const fail = (status, code, message) => json(status, { ok: false, error: { code, message } });
/* one spelling of a word, whatever its marks */
const norm = t => String(t).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const words = t => norm(t).match(/[ء-ي]{2,}/g) || [];
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

/* the interface's own words: every Arabic word of the deployed page (read once per instance) */
let VOCAB = null, vocabAt = 0;
async function vocab(req) {
  if (VOCAB && Date.now() - vocabAt < 3600e3) return VOCAB;
  const u = new URL(req.url);
  const page = u.origin + u.pathname.replace(/api\/i18n\/.*$/, '') + 'index.html';
  try {
    const html = await (await fetch(page)).text();
    VOCAB = new Set(words(html)); vocabAt = Date.now();
  } catch { VOCAB = VOCAB || new Set(); }
  return VOCAB;
}
const isUI = (s, V) => { const w = words(s); return w.length > 0 && w.length <= 30 && w.filter(x => V.has(x)).length / w.length >= 0.85; };

/* what is already translated, for everyone (16 documents per language) — kept a few minutes in this instance */
const memo = {};
async function dict(lang) {
  const m = memo[lang];
  if (m && Date.now() - m.at < 300e3) return m.t;
  const t = {};
  const docs = await Promise.all([...Array(SHARDS).keys()].map(i => getDoc('i18n_cache/' + lang + '_' + i).catch(() => ({ exists: false }))));
  docs.forEach(d => { if (d.exists) Object.values(d.data).forEach(v => { if (v && typeof v.s === 'string' && typeof v.t === 'string') t[v.s] = v.t; }); });
  memo[lang] = { at: Date.now(), t };
  return t;
}

const SYSTEM = lang => 'You translate the user interface of NEXUS, a web app where people make and play games, from Arabic to ' + LANGS[lang] + '. '
  + (lang === 'hi'
    ? 'Write natural, standard Hindi in Devanagari script. Write technical words in Devanagari too (गेम, प्रोजेक्ट, कोड, सेटिंग्स, फ़ाइल, बटन). Keep in Latin letters ONLY: AI, NEXUS, NEXUS AI, NEXUS Pro, brand and product names, code, file names and key names. '
    : 'Write short, natural interface English. ')
  + 'Keep every placeholder such as {0} exactly, and keep emoji, punctuation, numbers, Latin words and code unchanged. Button labels stay short. '
  + 'Answer with ONE JSON object only: {"t":["…","…"]} — exactly one translation per input string, in the same order.';

async function translate(req, lang, list) {
  const route = await aiRoute(['auto']);
  if (!route || !route.length) return {};
  const out = {};
  for (let i = 0; i < list.length; i += 40) {
    const batch = list.slice(i, i + 40);
    const r = await aiCall(req, route, { system: SYSTEM(lang), user: JSON.stringify({ strings: batch }), maxTokens: 4000, temperature: 0.1 });
    if (!r || !r.ok) break;
    let j = null;
    try { const s = String(r.text); j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch { }
    if (!j || !Array.isArray(j.t) || j.t.length !== batch.length) continue;
    batch.forEach((src, k) => {
      const t = String(j.t[k] || '').trim();
      const holes = src.match(/\{\d+\}/g) || [];
      /* a usable translation: not empty, not Arabic any more, every placeholder kept */
      if (t && t.length <= 600 && !/[ء-ي]/.test(t) && holes.every(h => t.includes(h))) out[src] = t;
    });
  }
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/i18n/, '') || '/';
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'origin', 'not allowed');
  if (!fsReady()) return fail(503, 'off', 'needs FIREBASE_SERVICE_ACCOUNT');
  try {
    if (req.method === 'GET' && path === '/dict') {
      const lang = url.searchParams.get('lang');
      if (!LANGS[lang]) return fail(400, 'lang', 'en or hi');
      return json(200, { ok: true, lang, t: await dict(lang) }, { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' });
    }
    if (req.method === 'POST' && path === '/translate') {
      const body = await req.json().catch(() => ({}));
      const lang = body.lang;
      if (!LANGS[lang]) return fail(400, 'lang', 'en or hi');
      const V = await vocab(req), have = await dict(lang);
      const asked = Array.from(new Set((Array.isArray(body.strings) ? body.strings : []).slice(0, 60).map(s => String(s || '').trim())))
        .filter(s => s.length >= 2 && s.length <= 200 && /[ء-ي]/.test(s) && isUI(s, V));
      const t = {}, missing = [];
      asked.forEach(s => { if (have[s]) t[s] = have[s]; else missing.push(s); });
      if (!missing.length) return json(200, { ok: true, t });
      /* a day's budget: per visitor, and for the whole site */
      const day = new Date().toISOString().slice(0, 10);
      const ip = fnv(req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local');
      const u = await getDoc('i18n_usage/' + day).catch(() => ({ exists: false }));
      const used = u.exists ? u.data : {};
      if ((used['ip_' + ip] || 0) + missing.length > num('I18N_PER_IP', 600) || (used.all || 0) + missing.length > num('I18N_DAILY', 30000))
        return json(200, { ok: true, t, limited: true });
      await commit([put('i18n_usage/' + day, { at: Date.now() }, { incr: { ['ip_' + ip]: missing.length, all: missing.length } })]).catch(() => {});
      const done = await translate(req, lang, missing);
      /* kept for everyone: one field per text, in one of 16 documents */
      const shards = {};
      Object.entries(done).forEach(([s, tr]) => { const h = fnv(s); (shards[parseInt(h.slice(0, 2), 16) % SHARDS] ||= {})['h' + h] = { s, t: tr }; t[s] = tr; have[s] = tr; });
      await Promise.all(Object.entries(shards).map(([i, fields]) => commit([put('i18n_cache/' + lang + '_' + i, fields)]).catch(() => {})));
      return json(200, { ok: true, t });
    }
    return fail(404, 'not_found', 'not found');
  } catch (e) {
    console.error('[i18n]', e);
    return fail(500, 'error', 'server error');
  }
};

export const config = { path: '/api/i18n/*' };
