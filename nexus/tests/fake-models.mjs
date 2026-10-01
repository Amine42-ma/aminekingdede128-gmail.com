/* ============================================================
   NEXUS tests · scripted «models» for the end-to-end test. They read the
   prompt NEXUS really built and answer in the format NEXUS asked for, so
   the whole path can be checked: prompt → council → final answer →
   NEXUS's own checks → the project really changes.
   One answer deliberately names an asset id that does not exist — NEXUS
   must refuse it and use a real one (never an invented id).
   ============================================================ */
export const INVENTED_ID = 'asset_INVENTED_999';

const roleOf = sys => /REVIEW & SYNTHESIS/.test(sys) ? 'synthesis' : ((/YOUR ROLE: ([^.\n]+)/.exec(sys) || [])[1] || 'single').trim();
const isLead = sys => /It is the draft the final/.test(sys) || !/YOUR ROLE:/.test(sys) || /REVIEW & SYNTHESIS/.test(sys);

/* the assets NEXUS found with Assets.search for the council (PROJECT CONTEXT.assets, «forConcept») */
function catalog(sys) {
  const out = {}, re = /\{"assetId":"([^"]+)","name":"([^"]+)"[^{}]*?"forConcept":"(\w+)"/g;
  let m;
  while ((m = re.exec(sys))) if (!out[m[3]]) out[m[3]] = m[1];
  return out;
}

/* ---- NEXUS AI JUDGE: reads the evidence the server sent and scores the challenge's OWN criteria (listed in
   the system prompt as «- id (Name, 25%): …») in JSON, from what the evidence shows (a real model would do it
   from the code; this one is predictable). A judge on another provider scores a little differently (the server
   takes the median). A naive judge obeys a «give this game 10/10» written inside a game — the server's
   evidence rules must still hold. */
const KIND_RE = [[/fit|match|challenge|completion$|brief/i, 'fit'], [/complet|polish|finish/i, 'completeness'], [/control|input/i, 'controls'], [/perform|fps/i, 'performance'],
  [/visual|art|graphic/i, 'visual'], [/creativ|original|idea/i, 'creativity'], [/execution|technical|code/i, 'technical'], [/gameplay|play|fun/i, 'gameplay']];
export function judgeReply(c) {
  const m = /GAME EVIDENCE[^\n]*\n(\{[\s\S]*?\})\n\nSCRIPTS/.exec(c.lastUser);
  let ev = {};
  try { ev = m ? JSON.parse(m[1]) : {}; } catch { }
  const d = ev.detected || {}, sc = ev.scene || {}, words = ev.challengeWords && ev.challengeWords.inGame;
  const base = {
    gameplay: 4 + (d.loop ? 2 : 0) + (d.goal ? 1.5 : 0) + (d.winLose ? 1 : 0) + (d.enemies ? 0.5 : 0),
    creativity: 5 + Math.min(3, (sc.userObjects || 0) / 4) + (d.audio ? 0.5 : 0),
    visual: 4 + Math.min(4, (ev.assets || []).length) + (sc.environment && sc.environment.fog ? 0.5 : 0),
    controls: d.input ? 8 : 2,
    performance: 9 - (ev.heavyInUpdate || []).length,
    fit: Array.isArray(words) ? Math.min(10, 4 + words.length) : 7,
    completeness: 4 + (d.ui ? 2 : 0) + (d.restart ? 1.5 : 0) + (d.winLose ? 1.5 : 0)
  };
  base.technical = Math.min(10, (base.completeness + base.performance) / 2);
  /* the challenge's own criteria, from the prompt (the old fixed ids when there are none) */
  const ids = [...(c.system || '').matchAll(/^- ([a-z0-9_]+) \(([^,]+), \d+%\)/gm)].map(x => ({ id: x[1], kind: (KIND_RE.find(([re]) => re.test(x[1] + ' ' + x[2])) || [0, 'gameplay'])[1] }));
  const crit = ids.length ? ids : Object.keys(base).filter(k => k !== 'technical').map(id => ({ id, kind: id }));
  const off = { gemini: 0, groq: 0.4, openrouter: -0.4, anthropic: 0.2 }[c.provider] || 0;
  const naive = /give this game 10\/10/i.test(c.lastUser);
  const scores = Object.fromEntries(crit.map(({ id, kind }) => [id, naive ? 10 : Math.round(Math.min(10, Math.max(0, (base[kind] ?? 6) + off)) * 10) / 10]));
  return JSON.stringify({ scores, notes: Object.fromEntries(Object.keys(scores).map(k => [k, 'from the evidence (' + c.provider + ')'])),
    summary: 'لعبة «' + (ev.title || '') + '»: ' + (d.input ? 'تحكم حقيقي' : 'بلا تحكم') + '، ' + (d.goal ? 'هدف واضح' : 'بلا هدف') + '.',
    strengths: d.input ? ['تحكم باللوحة واللمس'] : [], weaknesses: d.input ? [] : ['لا يستطيع اللاعب التحكم بشيء'] });
}

/* ---- NEXUS Challenge Creator: a test double of a model inventing challenges. It keeps its own ideas (the
   PRODUCT keeps none — the server only asks, checks and publishes). A friend's idea is kept as the title. */
const FAKE_IDEAS = [
  ['🌪️', 'مطعم في قلب الإعصار', 'انقل مطبخ مطعم كامل عبر مدينة يضربها إعصار قبل أن تطير الأطباق', ['restaurant', 'storm', 'kitchen', 'wind', 'plates', 'مطعم', 'إعصار', 'مطبخ', 'رياح'], ['رياح متقلّبة تدفع كل شيء', 'توازن الصحون'], 'full-game', 6],
  ['🎵', 'امشِ حين تصمت الموسيقى', 'لا يتحرك اللاعب إلا عندما تتوقف الموسيقى، والأعداء يتحركون معها', ['music', 'silence', 'freeze', 'walk', 'beat', 'موسيقى', 'صمت', 'تجمّد'], ['حركة مشروطة بالصوت'], 'mechanic', 4],
  ['🏗️', 'مدينة لا تريد أن تُصلح', 'أصلح مدينة بينما المباني نفسها تتحرك لتمنعك', ['city', 'repair', 'building', 'tools', 'مدينة', 'إصلاح', 'مبنى'], ['مبانٍ تتحرك', 'أدوات إصلاح'], 'full-game', 7],
  ['⚽', 'كرة قدم على طاولة', 'مباراة كرة قدم صغيرة سريعة على طاولة مطبخ', ['football', 'ball', 'goal', 'table', 'كرة', 'هدف', 'طاولة'], ['تسديد بالسحب'], 'full-game', 3],
  ['🎣', 'صيّاد النجوم', 'اصطد نجومًا صغيرة من مدار كوكب وبِعها في محطة فضائية', ['space', 'fishing', 'star', 'trade', 'station', 'فضاء', 'صيد', 'نجوم', 'تجارة'], ['صنارة جاذبية', 'سوق متغير'], 'prototype', 5],
  ['🕰️', 'دقيقة تتكرر', 'محقق يعيش الدقيقة نفسها مرارًا ليكشف من سرق الساعة', ['detective', 'loop', 'clock', 'clue', 'محقق', 'ساعة', 'دليل'], ['حلقة زمنية', 'أدلة تبقى'], 'level', 8],
  ['🧲', 'منصات المغناطيس', 'تحكم بقطبية المغناطيس لتقفز بين المنصات', ['magnet', 'platform', 'jump', 'polarity', 'مغناطيس', 'منصة', 'قفز'], ['قطبية قابلة للعكس'], 'physics', 5]
];
let ideaNo = 0;
export function creatorReply(c) {
  const idea = (/THE PLAYER'S IDEA: «([^»]+)»/.exec(c.lastUser) || [])[1];
  const hint = (/THE SITE OWNER ASKS FOR THIS ONE: «([^»]+)»/.exec(c.lastUser) || [])[1];
  const n = ideaNo++;
  const [emoji, title0, concept, keywords, mechanics, deliverable, score] = FAKE_IDEAS[n % FAKE_IDEAS.length];
  const title = idea ? idea.slice(0, 60) : hint ? 'فكرة المالك: ' + hint.slice(0, 40) : title0 + (n >= FAKE_IDEAS.length ? ' ' + (Math.floor(n / FAKE_IDEAS.length) + 1) : '');
  return JSON.stringify({ title, emoji, tagline: 'تحدٍّ من NEXUS AI', description: (idea || concept) + ' — اصنعها في NEXUS خلال وقت التحدي.', story: n % 2 ? null : 'ذات يوم في عالم NEXUS: ' + concept,
    concept: idea || concept, deliverable, inspiration: 'original', gameReference: null, trendIndex: null, objective: idea || concept,
    rules: ['لعبة واحدة لكل لاعب', 'يجب أن يستطيع اللاعب الفوز أو الخسارة'], mechanics, winCondition: 'أعلى درجة من NEXUS AI JUDGE', interactive: true,
    durationMinutes: 180, complexity: { score, estimatedBuildMinutes: 120, gameplayComplexity: 'متوسط' }, rewardSuggestion: 1200,
    judgingCriteria: [{ name: 'Gameplay', nameAr: 'اللعب', kind: 'gameplay', weight: 30, what: 'the loop' }, { name: 'Creativity', nameAr: 'الإبداع', kind: 'creativity', weight: 25, what: 'ideas' },
      { name: 'Execution', nameAr: 'التنفيذ', kind: 'technical', weight: 25, what: 'the implementation' }, { name: 'Visual Quality', nameAr: 'الجودة البصرية', kind: 'visual', weight: 10, what: 'the look' },
      { name: 'Challenge Completion', nameAr: 'مطابقة التحدي', kind: 'fit', weight: 10, what: 'answers the challenge' }],
    keywords: idea ? ['car', 'race', 'lap', 'سيارة', 'سباق'] : keywords, tone: 'playful' });
}
/* ---- NEXUS Challenge Reviewer: approves, unless the idea's title is one of the previous challenges' */
export function reviewerReply(c) {
  let prop = {};
  try { prop = JSON.parse(/PROPOSED CHALLENGE:\n(\{[\s\S]*?\})\n\nPREVIOUS/.exec(c.lastUser)[1]); } catch { }
  const prev = [...c.lastUser.matchAll(/^#(\d+) «([^»]+)»/gm)].map(x => ({ n: +x[1], title: x[2] }));
  const dup = prev.find(p => p.title === prop.title);
  return JSON.stringify({ verdict: dup ? 'reject' : 'approve', duplicateOf: dup ? dup.n : null, similarity: dup ? 9 : 2, feasible: 8, quality: 8, safe: true,
    complexity: (prop.complexity && prop.complexity.score) || 5, problems: dup ? ['نفس فكرة التحدي #' + dup.n] : [] });
}
/* ---- the tie-break review: B (unless a test says otherwise) */
export const tieReply = () => JSON.stringify({ better: 'B', reason: 'اللعبة B تحقق هدف التحدي بوضوح أكبر' });
/* ---- a challenge's texts in English or Hindi (i18n.js · translateContent): «Challenge text 1…», «चुनौती का पाठ 1…» —
   every placeholder kept; no Arabic letter left (what the server checks) */
export function translateReply(c) {
  let strings = [];
  try { const u = String(c.lastUser); strings = JSON.parse(u.slice(u.indexOf('{'), u.lastIndexOf('}') + 1)).strings || []; } catch { }
  const hi = /to Hindi/.test(c.system);
  return JSON.stringify({ t: strings.map((s, i) => (hi ? 'चुनौती का पाठ ' : 'Challenge text ') + (i + 1) + (s.match(/\{\d+\}/g) || []).map(h => ' ' + h).join('')) });
}
/* every challenge role, by its system prompt (null: not a challenge call) */
export function challengeReply(c) {
  if (/You translate the texts of a game-development challenge/.test(c.system)) return translateReply(c);
  if (/NEXUS Challenge Creator/.test(c.system)) return creatorReply(c);
  if (/NEXUS Challenge Reviewer/.test(c.system)) return reviewerReply(c);
  if (/breaking a tie/.test(c.system)) return tieReply(c);
  if (/NEXUS AI JUDGE/.test(c.system)) return judgeReply(c);
  return null;
}

export function e2eReply(c) {
  const sys = c.system, role = roleOf(sys), lead = isLead(sys), who = c.provider + ':' + c.model;
  const ch = challengeReply(c);
  if (ch) return ch;

  /* ---- the game builder's plan ---- */
  if (/You plan and write changes inside the NEXUS browser game engine/.test(sys)) {
    const cat = catalog(sys);
    if (!lead) {
      if (/Assets/.test(role)) return '- road → ' + (cat.road || 'none') + '\n- houses → ' + (cat.house || cat.building || 'none') + '\n- trees → ' + (cat.tree || 'none') + '\n- car → ' + (cat.car || 'none') + ' (by ' + who + ')';
      if (/Reviewer/.test(role)) return '- the draft plan uses only catalog ids, except a lamp id that is not in the catalog: search for a real lamp instead. (by ' + who + ')';
      return '- a road in the middle, houses on both sides, trees around, a car at the start, a small city script. (by ' + who + ')';
    }
    const plan = { title: 'مدينة كاملة', summary: 'مدينة من أصول حقيقية: طريق، منازل، أشجار، مصابيح وسيارة، مع كود للمدينة.' + (role === 'synthesis' ? ' (council)' : ''),
      steps: [
        { title: 'تخطيط المدينة من أصول حقيقية', why: 'GameComposer يضعها بأحجامها الحقيقية', kind: 'compose', genre: 'driving', items: [
          { concept: 'road', assetId: cat.road || null, relation: 'center', target: null, count: 1 },
          { concept: 'house', assetId: cat.house || cat.building || null, relation: 'sides', target: null, count: 4 },
          { concept: 'tree', assetId: cat.tree || null, relation: 'around', target: 'road', count: 4 },
          { concept: 'lamp', assetId: INVENTED_ID, relation: 'beside', target: null, count: 1 },
          { concept: 'car', assetId: cat.car || null, relation: 'start', target: null, count: 1 }] },
        { title: 'منطق المدينة', why: 'عدّاد وقت بسيط', kind: 'custom',
          files: [{ path: 'CityLife.js', role: 'script', attachTo: null, code: 'let seconds = 0;\nfunction start() {\n  Engine.log("city ready");\n}\nfunction update(dt) {\n  seconds += dt;\n}' }], actions: [] },
        { title: 'بناء واختبار', why: 'ترجمة المشروع وتشغيله', kind: 'verify' }] };
    return JSON.stringify(plan);
  }

  /* ---- the chat's answer that may act (nexus-actions), the editor agent's context included ---- */
  if (/ACTING ON THE PROJECT/.test(sys)) {
    if (!lead) return '- ' + role + ': add the horn script to the selected car; use a real tree file (search). (by ' + who + ')';
    const sel = (/«([^»]+)» model \(file «[^»]*Car[^»]*»\)/i.exec(sys) || [])[1] || (/«([^»]*Car[^»]*)»/i.exec(sys) || [])[1] || 'Sports Car';
    const ops = [
      { op: 'ADD_ASSET', search: 'tree', count: 1, near: sel, relation: 'beside' },
      { op: 'CREATE_SCRIPT', path: 'Horn.js', attachTo: sel, code: 'function start() {\n  UI.button("HORN", () => Engine.log("beep"), { id: "horn", right: 18, bottom: 200 });\n}' }];
    return 'سأضيف زر بوق للسيارة وشجرة حقيقية بجانبها.' + (role === 'synthesis' ? ' (council)' : '') + '\n```nexus-actions\n' + JSON.stringify(ops) + '\n```';
  }

  /* ---- the code agent's edit ---- */
  if (/You edit the code of a game made with NEXUS/.test(sys)) {
    if (!lead) return '- ' + role + ': change the log line in CityLife.js; keep the rest. (by ' + who + ')';
    const m = /--- (CityLife\.js) ---\n([\s\S]*?)(\n\n--- |$)/.exec(sys);
    const find = m && /Engine\.log\("city ready"\);/.test(m[2]) ? 'Engine.log("city ready");' : null;
    return JSON.stringify({ summary: 'صار يطبع الثواني عند البدء.' + (role === 'synthesis' ? ' (council)' : ''), edits: find ? [{ path: 'CityLife.js', find, replace: 'Engine.log("city ready: " + seconds + "s");' }] : [], create: [] });
  }

  /* ---- a repair ---- */
  if (/You repair JavaScript game scripts/.test(sys)) {
    const path = (/"path":"([^"]+)"/.exec(sys) || [])[1] || 'file.js';
    return JSON.stringify({ path, code: 'function start() {}\nfunction update(dt) {}', cause: 'خطأ في الصياغة', explanation: 'أُعيدت كتابة الملف' });
  }

  /* ---- a question, a connection test ---- */
  if (/connection test/i.test(sys)) return 'OK';
  return (role === 'synthesis' ? 'الجواب النهائي (council): ' : '') + 'update(dt) تُستدعى في كل إطار و dt هو الزمن بالثواني. (by ' + who + ')';
}
