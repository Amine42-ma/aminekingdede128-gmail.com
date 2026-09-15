/**
 * Concept extraction (spec 2, 8, 9).
 *
 * Turns raw per-file analysis into *abstract concepts* with evidence. This is
 * the step that makes the lab a learner rather than a code copier: nothing here
 * stores source code, only "this project demonstrates concept X, here is where,
 * and here are the parameters it used".
 */

export const CATEGORIES = [
  'architecture', 'programming', 'game-development', 'web-development', 'javascript',
  'html', 'css', 'canvas', 'webgl', '3d', 'physics', 'ai', 'ui-ux', 'optimization',
  'mobile', 'audio', 'assets', 'data', 'debugging', 'networking',
];

/**
 * Detector table. Each detector inspects the project bundle and returns
 * evidence rows. Keeping them declarative makes the catalogue easy to grow -
 * new detectors immediately feed the knowledge base and the generator.
 */
const DETECTORS = [
  // ---------- game loop / timing ----------
  {
    id: 'game-loop.raf-delta', category: 'game-development', title: 'Delta-time game loop on requestAnimationFrame',
    summary: 'Frame callback measures elapsed time and scales movement by it, so behaviour is frame-rate independent.',
    detect: (b) => b.js.filter((j) => j.loopStyle === 'raf-delta').map((j) => ({ file: j.file, detail: 'raf + delta' })),
  },
  {
    id: 'game-loop.fixed-step', category: 'game-development', title: 'Fixed-timestep accumulator loop',
    summary: 'Simulation advances in constant steps while rendering interpolates, which keeps physics deterministic under frame spikes.',
    detect: (b) => b.js.filter((j) => j.loopStyle === 'fixed-timestep-accumulator').map((j) => ({ file: j.file, detail: 'accumulator loop' })),
  },
  {
    id: 'game-loop.naive', category: 'debugging', title: 'Frame-rate dependent loop (anti-pattern)',
    summary: 'Movement is applied per frame without delta time; the game runs at different speeds on different displays.',
    detect: (b) => b.js.filter((j) => j.loopStyle === 'raf-naive' || j.loopStyle === 'setInterval').map((j) => ({ file: j.file, detail: j.loopStyle })),
    negative: true,
  },
  {
    id: 'lifecycle.pause-on-blur', category: 'game-development', title: 'Pause when the tab loses focus',
    summary: 'Listening to visibilitychange/blur prevents a huge delta spike when the player returns.',
    detect: (b) => pattern(b, 'pause-on-blur'),
  },

  // ---------- rendering ----------
  {
    id: 'render.canvas2d', category: 'canvas', title: 'Canvas 2D rendering',
    summary: 'Immediate-mode 2D drawing via a canvas context.',
    detect: (b) => b.js.filter((j) => j.apis['canvas-context']).map((j) => ({ file: j.file, detail: `${j.apis['canvas-context']} context call(s)` })),
  },
  { id: 'render.webgl', category: 'webgl', title: 'Raw WebGL rendering', summary: 'Direct WebGL context usage with shaders and buffers.', detect: (b) => b.js.filter((j) => j.apis.webgl || j.apis.webgl2).map((j) => ({ file: j.file, detail: 'webgl context' })) },
  { id: 'render.shaders', category: 'webgl', title: 'Custom shader authoring', summary: 'Project writes GLSL shader programs instead of relying only on built-in materials.', detect: (b) => pattern(b, 'custom-shaders') },
  { id: 'render.instancing', category: 'optimization', title: 'GPU instancing', summary: 'Many similar objects drawn in one call.', detect: (b) => pattern(b, 'gpu-instancing') },
  { id: 'render.dpr', category: 'ui-ux', title: 'Device-pixel-ratio aware canvas sizing', summary: 'Backing store is scaled by devicePixelRatio so rendering is crisp on high-density screens.', detect: (b) => pattern(b, 'dpr-scaling') },

  // ---------- 3D ----------
  { id: '3d.threejs', category: '3d', title: 'Three.js scene graph', summary: 'Scene / camera / renderer architecture from three.js.', detect: (b) => b.js.filter((j) => j.libraries['three.js']).map((j) => ({ file: j.file, detail: `${j.libraries['three.js']} references` })) },
  { id: '3d.gltf-loading', category: 'assets', title: 'glTF/GLB model loading', summary: 'Runtime loading of GLB/glTF assets into the scene.', detect: (b) => pattern(b, 'gltf-loading') },
  { id: '3d.skinned-animation', category: '3d', title: 'Skeletal animation clips', summary: 'Rigged models with named animation clips driven by an animation mixer.', detect: (b) => b.glb.filter((g) => g.skinned && g.hasAnimation).map((g) => ({ file: g.file, detail: `${g.animationClips.length} clip(s)` })) },

  // ---------- input ----------
  {
    id: 'input.keyboard-map', category: 'game-development', title: 'Keyboard state map',
    summary: 'Key down/up events maintain a state object that the update loop samples, instead of acting inside the event.',
    detect: (b) => b.js.filter((j) => j.events.some((e) => e.startsWith('key'))).map((j) => ({ file: j.file, detail: j.events.filter((e) => e.startsWith('key')).join(',') })),
  },
  { id: 'input.pointer', category: 'game-development', title: 'Pointer / mouse input', summary: 'Pointer or mouse events drive aiming, dragging or clicking.', detect: (b) => b.js.filter((j) => j.events.some((e) => /pointer|mouse|click/.test(e))).map((j) => ({ file: j.file, detail: 'pointer events' })) },
  { id: 'input.touch-mobile', category: 'mobile', title: 'Touch controls', summary: 'Touch events or on-screen sticks provide a mobile control scheme.', detect: (b) => [...b.js.filter((j) => j.events.some((e) => /touch/.test(e))).map((j) => ({ file: j.file, detail: 'touch events' })), ...pattern(b, 'mobile-controls')] },
  { id: 'input.gamepad', category: 'game-development', title: 'Gamepad support', summary: 'Gamepad API polled for analog input.', detect: (b) => b.js.filter((j) => j.apis.gamepad).map((j) => ({ file: j.file, detail: 'gamepad api' })) },
  { id: 'input.pointer-lock', category: '3d', title: 'Pointer lock for mouse-look', summary: 'Pointer lock enables FPS-style camera control.', detect: (b) => b.js.filter((j) => j.apis['pointer-lock']).map((j) => ({ file: j.file, detail: 'pointer lock' })) },

  // ---------- simulation ----------
  { id: 'physics.collision', category: 'physics', title: 'Collision detection', summary: 'Explicit overlap tests between entities (AABB/circle) drive gameplay response.', detect: (b) => pattern(b, 'collision-detection') },
  { id: 'physics.engine', category: 'physics', title: 'Third-party physics engine', summary: 'Rigid-body simulation delegated to a physics library.', detect: (b) => b.js.filter((j) => j.libraries['matter.js'] || j.libraries['cannon.js'] || j.libraries['planck.js'] || j.libraries['ammo.js']).map((j) => ({ file: j.file, detail: Object.keys(j.libraries).join(',') })) },
  { id: 'physics.tuning', category: 'physics', title: 'Hand-tuned motion constants', summary: 'Gravity/friction/speed constants tuned by hand; the lab records their ranges as priors for new games.', detect: (b) => b.js.filter((j) => Object.keys(j.tuning).length >= 2).map((j) => ({ file: j.file, detail: Object.keys(j.tuning).join(',') })) },
  { id: 'sim.interpolation', category: 'programming', title: 'Interpolation and easing', summary: 'lerp/damp/easing smooths motion, camera and UI transitions.', detect: (b) => pattern(b, 'interpolation-easing') },

  // ---------- architecture ----------
  { id: 'arch.entity-list', category: 'architecture', title: 'Entity list update/draw architecture', summary: 'A flat array of entities, each with update() and draw(), iterated every frame.', detect: (b) => pattern(b, 'entity-list') },
  { id: 'arch.ecs', category: 'architecture', title: 'Entity-component composition', summary: 'Behaviour composed from components rather than deep inheritance.', detect: (b) => pattern(b, 'entity-component') },
  { id: 'arch.inheritance', category: 'architecture', title: 'Class inheritance hierarchy', summary: 'Shared behaviour factored into base classes.', detect: (b) => b.js.filter((j) => j.classes.some((c) => c.extends)).map((j) => ({ file: j.file, detail: j.classes.filter((c) => c.extends).map((c) => `${c.name}<${c.extends}`).join(',') })) },
  { id: 'arch.state-machine', category: 'architecture', title: 'Explicit state machine for game screens', summary: 'menu/playing/paused/gameover handled as states rather than scattered booleans.', detect: (b) => [...pattern(b, 'state-machine-switch'), ...pattern(b, 'state-table')] },
  { id: 'arch.modules-esm', category: 'javascript', title: 'ES modules', summary: 'Code split across modules with import/export.', detect: (b) => b.js.filter((j) => j.moduleStyle === 'esm').map((j) => ({ file: j.file, detail: `${j.imports.length} import(s)` })) },
  { id: 'arch.iife-namespace', category: 'javascript', title: 'IIFE / namespace isolation', summary: 'Code wrapped in an immediately-invoked function to avoid polluting the global scope.', detect: (b) => b.js.filter((j) => j.moduleStyle === 'iife').map((j) => ({ file: j.file, detail: 'iife' })) },
  { id: 'arch.single-file', category: 'web-development', title: 'Single-file application', summary: 'Whole project ships as one HTML file with inline script and style.', detect: (b) => b.html.filter((h) => h.singleFile && h.scripts.inlineBytes > 4000).map((h) => ({ file: h.file, detail: `${h.scripts.inlineBytes}B inline js` })) },

  // ---------- data / persistence ----------
  { id: 'data.save-localstorage', category: 'data', title: 'Save/load via localStorage', summary: 'Serialized game state persisted between sessions.', detect: (b) => pattern(b, 'save-load') },
  { id: 'data.json-config', category: 'data', title: 'JSON configuration / level data', summary: 'Levels, tuning or content described as data instead of code.', detect: (b) => b.json.map((j) => ({ file: j.file, detail: `${j.keys} top-level key(s)` })) },
  { id: 'data.typed-arrays', category: 'optimization', title: 'Typed arrays for hot data', summary: 'Float32Array/Int32Array used for particle or grid data.', detect: (b) => b.js.filter((j) => j.dataStructures.Float32Array || j.dataStructures.Int32Array || j.dataStructures.Uint8Array).map((j) => ({ file: j.file, detail: 'typed arrays' })) },

  // ---------- ai / procgen ----------
  { id: 'ai.pathfinding', category: 'ai', title: 'Pathfinding', summary: 'A*/BFS/Dijkstra route agents around obstacles.', detect: (b) => pattern(b, 'pathfinding') },
  { id: 'ai.steering', category: 'ai', title: 'Chase / steering behaviour', summary: 'Agents steer toward or away from a target each frame.', detect: (b) => b.js.filter((j) => /chase|seek|flee|steer|pursue|wander/i.test(j.file) || j.functions.some((f) => /chase|seek|flee|steer|pursue|wander/i.test(f.name))).map((j) => ({ file: j.file, detail: 'steering functions' })) },
  { id: 'procgen.noise', category: 'ai', title: 'Noise-based procedural generation', summary: 'Perlin/simplex noise generates terrain, maps or textures.', detect: (b) => pattern(b, 'noise-procgen') },
  { id: 'procgen.seeded', category: 'programming', title: 'Seeded deterministic random', summary: 'A seeded PRNG makes generated content reproducible.', detect: (b) => pattern(b, 'seeded-random') },

  // ---------- optimization ----------
  { id: 'opt.pooling', category: 'optimization', title: 'Object pooling', summary: 'Objects are recycled instead of allocated per frame, reducing GC pauses.', detect: (b) => pattern(b, 'object-pooling') },
  { id: 'opt.spatial', category: 'optimization', title: 'Spatial partitioning', summary: 'Grid/quadtree narrows collision checks from O(n^2).', detect: (b) => pattern(b, 'spatial-partitioning') },
  { id: 'opt.worker', category: 'optimization', title: 'Web Worker offloading', summary: 'Heavy work moved off the main thread.', detect: (b) => pattern(b, 'worker-offload') },

  // ---------- audio ----------
  { id: 'audio.webaudio', category: 'audio', title: 'Web Audio API synthesis/playback', summary: 'AudioContext graph used for sound, allowing procedural sound effects with no asset files.', detect: (b) => b.js.filter((j) => j.apis.webaudio).map((j) => ({ file: j.file, detail: 'AudioContext' })) },
  { id: 'audio.elements', category: 'audio', title: 'HTML audio elements', summary: 'Sound played through <audio> or the Audio constructor.', detect: (b) => [...b.js.filter((j) => j.apis['audio-element']).map((j) => ({ file: j.file, detail: 'Audio()' })), ...b.html.filter((h) => h.tagCounts.audio).map((h) => ({ file: h.file, detail: '<audio>' }))] },

  // ---------- ui / css ----------
  { id: 'ui.flex-grid', category: 'css', title: 'Flexbox / Grid layout', summary: 'Modern layout systems instead of absolute positioning everywhere.', detect: (b) => b.css.filter((c) => c.layout.flex || c.layout.grid).map((c) => ({ file: c.file, detail: [c.layout.flex && 'flex', c.layout.grid && 'grid'].filter(Boolean).join('+') })) },
  { id: 'ui.design-tokens', category: 'ui-ux', title: 'CSS custom properties as design tokens', summary: 'Colors and spacing centralised in variables, enabling theming.', detect: (b) => b.css.filter((c) => c.themeTokens >= 4).map((c) => ({ file: c.file, detail: `${c.themeTokens} tokens` })) },
  { id: 'ui.responsive', category: 'mobile', title: 'Responsive layout', summary: 'Media queries / relative units adapt the UI to phone and desktop.', detect: (b) => [...b.css.filter((c) => c.mediaQueries.length).map((c) => ({ file: c.file, detail: `${c.mediaQueries.length} media queries` })), ...b.html.filter((h) => h.responsiveViewport).map((h) => ({ file: h.file, detail: 'viewport meta' }))] },
  { id: 'ui.animation-css', category: 'css', title: 'CSS keyframe animation', summary: 'Declarative animation for UI feedback, cheaper than JS tweening.', detect: (b) => b.css.filter((c) => c.keyframes.length).map((c) => ({ file: c.file, detail: c.keyframes.slice(0, 5).join(',') })) },
  { id: 'ui.hud-overlay', category: 'ui-ux', title: 'HUD overlay above the play field', summary: 'Score/health drawn as DOM overlay rather than inside the canvas, keeping text crisp.', detect: (b) => b.html.filter((h) => h.canvasCount && (h.tagCounts.div || 0) > 3).map((h) => ({ file: h.file, detail: 'canvas + dom overlay' })) },

  // ---------- networking ----------
  { id: 'net.fetch', category: 'networking', title: 'Remote data fetching', summary: 'fetch/XHR pulls data at runtime.', detect: (b) => b.js.filter((j) => j.apis.fetch || j.apis.xhr).map((j) => ({ file: j.file, detail: 'fetch/xhr' })) },
  { id: 'net.realtime', category: 'networking', title: 'Realtime connection', summary: 'WebSocket used for live/multiplayer communication.', detect: (b) => b.js.filter((j) => j.apis.websocket).map((j) => ({ file: j.file, detail: 'websocket' })) },
];

function pattern(bundle, name) {
  return bundle.js.filter((j) => j.patterns.includes(name)).map((j) => ({ file: j.file, detail: name }));
}

/**
 * @param {object} bundle { js:[], css:[], html:[], glb:[], json:[], images:[] }
 * @returns {Array} concept observations for one project
 */
export function extractConcepts(bundle) {
  const b = {
    js: bundle.js || [], css: bundle.css || [], html: bundle.html || [],
    glb: bundle.glb || [], json: bundle.json || [], images: bundle.images || [],
  };
  const out = [];
  for (const d of DETECTORS) {
    let evidence = [];
    try { evidence = d.detect(b) || []; } catch { evidence = []; }
    if (!evidence.length) continue;
    out.push({
      key: d.id,
      category: d.category,
      title: d.title,
      summary: d.summary,
      negative: !!d.negative,
      evidence: evidence.slice(0, 12),
      occurrences: evidence.length,
    });
  }
  return out;
}

export function detectorCount() { return DETECTORS.length; }
export function allDetectors() { return DETECTORS.map(({ id, category, title, summary, negative }) => ({ id, category, title, summary, negative: !!negative })); }
