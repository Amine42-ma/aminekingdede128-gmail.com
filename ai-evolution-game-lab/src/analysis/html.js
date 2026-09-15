/**
 * HTML structural analyzer: tag inventory, script/style extraction, external
 * dependencies, meta/viewport, canvas usage, and inline handlers.
 *
 * Small hand-written scanner rather than a DOM parser: we only need structure,
 * and it must never throw on the malformed HTML that real projects contain.
 */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export function parseTags(html) {
  const tags = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, closing, name, attrRaw, selfClose] = m;
    tags.push({
      name: name.toLowerCase(),
      closing: closing === '/',
      selfClosing: selfClose === '/' || VOID_TAGS.has(name.toLowerCase()),
      attrs: parseAttrs(attrRaw),
      index: m.index,
      end: re.lastIndex,
    });
  }
  return tags;
}

export function parseAttrs(raw) {
  const attrs = {};
  const re = /([a-zA-Z_:@.-][a-zA-Z0-9_:.-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(raw || ''))) {
    const key = m[1].toLowerCase();
    attrs[key] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return attrs;
}

/** Extract the body of every <script> / <style> block plus their attributes. */
function extractBlocks(html, tagName) {
  const out = [];
  const re = new RegExp(`<${tagName}((?:"[^"]*"|'[^']*'|[^>"'])*)>([\\s\\S]*?)</${tagName}\\s*>`, 'gi');
  let m;
  while ((m = re.exec(html))) out.push({ attrs: parseAttrs(m[1]), content: m[2], index: m.index });
  // self-closing / src-only tags have no body but still matter
  const solo = new RegExp(`<${tagName}((?:"[^"]*"|'[^']*'|[^>"'])*)/?>(?![\\s\\S]*?</${tagName}>)`, 'gi');
  while ((m = solo.exec(html))) {
    const attrs = parseAttrs(m[1]);
    if (attrs.src && !out.some((b) => b.attrs.src === attrs.src)) out.push({ attrs, content: '', index: m.index });
  }
  return out;
}

export function analyzeHtml(html, { file = 'index.html' } = {}) {
  const tags = parseTags(html);
  const tagCounts = {};
  for (const t of tags) if (!t.closing) tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;

  const scripts = extractBlocks(html, 'script');
  const styles = extractBlocks(html, 'style');
  const links = tags.filter((t) => t.name === 'link' && !t.closing).map((t) => t.attrs);
  const metas = tags.filter((t) => t.name === 'meta' && !t.closing).map((t) => t.attrs);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const externalScripts = scripts.filter((s) => s.attrs.src).map((s) => s.attrs.src);
  const inlineScripts = scripts.filter((s) => !s.attrs.src && s.content.trim());
  const importMaps = scripts.filter((s) => (s.attrs.type || '').includes('importmap')).map((s) => s.content);

  const inlineHandlers = [];
  for (const t of tags) {
    for (const [k, v] of Object.entries(t.attrs)) {
      if (k.startsWith('on') && v) inlineHandlers.push({ tag: t.name, event: k.slice(2), code: v.slice(0, 120) });
    }
  }

  const canvases = tags.filter((t) => t.name === 'canvas' && !t.closing).map((t) => t.attrs);
  const media = tags.filter((t) => ['img', 'audio', 'video', 'source'].includes(t.name) && !t.closing)
    .map((t) => ({ tag: t.name, src: t.attrs.src || t.attrs.srcset || '' })).filter((x) => x.src);

  const viewport = metas.find((m) => (m.name || '').toLowerCase() === 'viewport')?.content || null;
  const lang = (html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)/i) || [])[1] || null;
  const dir = (html.match(/<html[^>]*\bdir\s*=\s*["']([^"']+)/i) || [])[1] || null;

  return {
    file,
    title: titleMatch ? titleMatch[1].trim().slice(0, 160) : null,
    lang,
    dir,
    viewport,
    hasViewport: !!viewport,
    responsiveViewport: !!viewport && /width\s*=\s*device-width/.test(viewport),
    tagCounts,
    tagVariety: Object.keys(tagCounts).length,
    canvases,
    canvasCount: canvases.length,
    scripts: {
      external: externalScripts,
      inlineCount: inlineScripts.length,
      inlineBytes: inlineScripts.reduce((s, x) => s + x.content.length, 0),
      moduleCount: scripts.filter((s) => (s.attrs.type || '') === 'module').length,
      importMaps,
    },
    styles: {
      external: links.filter((l) => (l.rel || '').includes('stylesheet')).map((l) => l.href).filter(Boolean),
      inlineCount: styles.length,
      inlineBytes: styles.reduce((s, x) => s + x.content.length, 0),
    },
    links,
    metas,
    media,
    inlineHandlers,
    singleFile: externalScripts.length === 0 && inlineScripts.length > 0,
    inlineSources: { js: inlineScripts.map((s) => s.content), css: styles.map((s) => s.content) },
  };
}
