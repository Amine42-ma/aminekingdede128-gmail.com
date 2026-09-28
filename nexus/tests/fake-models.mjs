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

export function e2eReply(c) {
  const sys = c.system, role = roleOf(sys), lead = isLead(sys), who = c.provider + ':' + c.model;

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
