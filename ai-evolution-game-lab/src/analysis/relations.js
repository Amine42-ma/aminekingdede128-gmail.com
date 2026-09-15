/**
 * Relationship extraction (spec 8).
 *
 * Takes the per-file call graphs and declaration inventory and lifts them from
 * "function foo calls function bar" to "the input layer feeds the controller,
 * which feeds physics, which feeds collision, which feeds the camera".
 *
 * The role classifier is name + API based. It is a heuristic and labelled as
 * such: `confidence` on every node reflects how much signal backed the guess.
 */

const ROLE_RULES = [
  ['input', /(^|_|\b)(input|keys?|keyboard|mouse|pointer|touch|gamepad|control(s|ler)?bind|joystick|dpad)(\b|_|$)/i],
  ['controller', /(player|character|avatar|hero|controller|move(ment)?|walk|jump|steer|drive)/i],
  ['physics', /(physics|gravity|velocity|integrate|simulate|force|accel|friction|rigid|body)/i],
  ['collision', /(collide|collision|overlap|intersect|aabb|hit(test|box)?|contact|resolve)/i],
  ['animation', /(anim(ate|ation)?|tween|ease|frame|sprite|clip|mixer|pose)/i],
  ['camera', /(camera|viewport|follow|lookat|zoom|shake|cam\b)/i],
  ['render', /(render|draw|paint|blit|display|present|scene|material|mesh|shader)/i],
  ['ui', /(ui|hud|menu|button|dialog|overlay|screen|label|panel|score(board)?|toast)/i],
  ['audio', /(audio|sound|sfx|music|play(sound|tone)|beep|volume)/i],
  ['state', /(state|phase|mode|scene(manager)?|gameover|restart|pause|resume|init|setup|start|reset)/i],
  ['spawn', /(spawn|create|factory|make|emit(ter)?|generate(enemy|item)|populate)/i],
  ['ai', /(ai\b|enemy|npc|brain|think|chase|seek|flee|patrol|path|astar|behaviou?r)/i],
  ['procgen', /(procgen|generate(level|map|world|terrain|maze)|noise|perlin|random(level|map))/i],
  ['save', /(save|load|persist|storage|serialize|deserialize|checkpoint)/i],
  ['loop', /(loop|tick|update|step|frame|main)/i],
  ['assets', /(load(assets|texture|model|image|sound)|preload|asset|manifest|gltf|glb)/i],
  ['particles', /(particle|emitter|dust|spark|trail|debris)/i],
  ['network', /(net(work)?|socket|server|sync|multiplayer|room|lobby)/i],
];

export function roleOf(name = '') {
  for (const [role, re] of ROLE_RULES) if (re.test(name)) return role;
  return null;
}

/** Canonical pipeline order used when laying the graph out for the UI. */
export const PIPELINE_ORDER = [
  'loop', 'input', 'controller', 'physics', 'collision', 'ai', 'procgen', 'spawn',
  'animation', 'camera', 'particles', 'render', 'ui', 'audio', 'state', 'save', 'assets', 'network',
];

export function buildRelations(jsAnalyses) {
  const members = new Map();   // role -> Set(names)
  const edges = new Map();     // "a>b" -> {from,to,weight,examples[]}
  const unknown = new Set();

  const add = (role, name) => {
    if (!role) return;
    if (!members.has(role)) members.set(role, new Set());
    members.get(role).add(name);
  };

  for (const j of jsAnalyses) {
    for (const f of j.functions) {
      const r = roleOf(f.name);
      if (r) add(r, f.name); else unknown.add(f.name);
    }
    for (const c of j.classes) {
      const r = roleOf(c.name) || (c.methods.some((m) => /update|draw/.test(m)) ? 'controller' : null);
      if (r) add(r, c.name); else unknown.add(c.name);
      for (const m of c.methods) {
        const mr = roleOf(m);
        if (mr) add(mr, `${c.name}.${m}`);
      }
    }
    // API usage adds implicit members even when names are unhelpful
    if (j.apis['canvas-context'] || j.apis.webgl) add('render', `${j.file}:context`);
    if (j.apis.raf) add('loop', `${j.file}:raf`);
    if (j.events.some((e) => /key|pointer|mouse|touch/.test(e))) add('input', `${j.file}:events`);
    if (j.apis['local-storage']) add('save', `${j.file}:localStorage`);
    if (j.apis.webaudio || j.apis['audio-element']) add('audio', `${j.file}:audio`);

    for (const e of j.callGraph) {
      const from = roleOf(e.from);
      const to = roleOf(e.to);
      if (!from || !to || from === to) continue;
      const key = `${from}>${to}`;
      if (!edges.has(key)) edges.set(key, { from, to, weight: 0, examples: [] });
      const rec = edges.get(key);
      rec.weight++;
      if (rec.examples.length < 4) rec.examples.push(`${e.from}() -> ${e.to}()`);
    }
  }

  const nodes = [...members.entries()].map(([role, set]) => ({
    role,
    size: set.size,
    members: [...set].slice(0, 20),
    confidence: Math.min(1, 0.35 + set.size * 0.08),
  })).sort((a, b) => PIPELINE_ORDER.indexOf(a.role) - PIPELINE_ORDER.indexOf(b.role));

  const edgeList = [...edges.values()].sort((a, b) => b.weight - a.weight);

  return {
    nodes,
    edges: edgeList,
    unclassified: [...unknown].slice(0, 40),
    pipeline: derivePipeline(nodes, edgeList),
  };
}

/** Longest role chain found in the graph, presented as the project's data flow. */
function derivePipeline(nodes, edges) {
  const present = new Set(nodes.map((n) => n.role));
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from).add(e.to);
  }
  let best = [];
  const walk = (node, path, seen) => {
    if (path.length > best.length) best = [...path];
    if (path.length > 8) return;
    for (const nxt of adj.get(node) || []) {
      if (seen.has(nxt)) continue;
      seen.add(nxt);
      walk(nxt, [...path, nxt], seen);
      seen.delete(nxt);
    }
  };
  for (const start of present) walk(start, [start], new Set([start]));
  if (best.length > 3) return best;
  // fall back to the canonical order filtered by what exists
  return PIPELINE_ORDER.filter((r) => present.has(r));
}
