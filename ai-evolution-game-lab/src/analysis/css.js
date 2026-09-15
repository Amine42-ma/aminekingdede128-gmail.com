/**
 * CSS analyzer: selectors, custom properties, layout systems, animations,
 * media queries and responsive strategy. Used to learn UI/visual idioms.
 */

export function analyzeCss(src, { file = 'style.css' } = {}) {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.startsWith('@')) continue;
    rules.push({ selector: sel, body: m[2] });
  }

  const props = {};
  const values = {};
  for (const r of rules) {
    for (const decl of r.body.split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1).trim();
      if (!prop) continue;
      props[prop] = (props[prop] || 0) + 1;
      if (['display', 'position', 'overflow', 'font-family'].includes(prop)) {
        const key = `${prop}:${val.split(',')[0].trim().toLowerCase().slice(0, 32)}`;
        values[key] = (values[key] || 0) + 1;
      }
    }
  }

  const atRule = (name) => (clean.match(new RegExp(`@${name}\\b`, 'gi')) || []).length;
  const mediaQueries = [...clean.matchAll(/@media([^{]+)\{/gi)].map((x) => x[1].trim().slice(0, 120));
  const keyframes = [...clean.matchAll(/@keyframes\s+([\w-]+)/gi)].map((x) => x[1]);
  const customProps = [...new Set([...clean.matchAll(/(--[\w-]+)\s*:/g)].map((x) => x[1]))];
  const colors = [...clean.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)].map((x) => x[0].toLowerCase());

  const colorCounts = {};
  for (const c of colors) colorCounts[c] = (colorCounts[c] || 0) + 1;

  return {
    file,
    bytes: Buffer.byteLength(src),
    ruleCount: rules.length,
    selectors: rules.slice(0, 500).map((r) => r.selector),
    properties: props,
    propertyVariety: Object.keys(props).length,
    values,
    layout: {
      flex: (props.display && /flex/.test(JSON.stringify(values))) || !!props['flex-direction'] || !!props.flex,
      grid: !!props['grid-template-columns'] || !!props['grid-template-areas'] || /display:grid/.test(JSON.stringify(values)),
      absolute: /position:absolute/.test(JSON.stringify(values)),
      transforms: !!props.transform,
      transitions: !!props.transition,
      animations: !!props.animation || keyframes.length > 0,
      backdropFilter: !!props['backdrop-filter'],
      containerQueries: atRule('container') > 0,
    },
    mediaQueries,
    responsive: mediaQueries.length > 0 || Object.keys(props).some((p) => p.startsWith('--')) === false && /clamp\(|min\(|max\(|vw|vh|dvh/.test(clean),
    usesRelativeUnits: /\b\d*\.?\d+(rem|em|vw|vh|dvh|svh|%)\b/.test(clean),
    keyframes,
    customProperties: customProps,
    themeTokens: customProps.length,
    palette: Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([c, n]) => ({ color: c, count: n })),
    imports: [...clean.matchAll(/@import\s+(?:url\()?["']?([^"')]+)/gi)].map((x) => x[1]),
    fontFaces: atRule('font-face'),
    supportsQueries: atRule('supports'),
  };
}
