/* AI Evolution Game Lab - dashboard front-end.
   No framework, no build step, no network dependencies: the whole UI works
   offline, which is the point of an offline-first lab. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ i18n
  const I18N = {
    ar: {
      'nav.dashboard': 'اللوحة', 'nav.projects': 'المشاريع', 'nav.knowledge': 'المعرفة',
      'nav.graph': 'الرسم المعرفي', 'nav.games': 'الألعاب المولّدة', 'nav.versions': 'الإصدارات',
      'nav.experiments': 'التجارب', 'nav.lessons': 'الدروس', 'nav.queue': 'المهام',
      'nav.models': 'النماذج', 'nav.research': 'البحث', 'nav.training': 'التدريب', 'nav.settings': 'الأذونات',
      'action.generate': 'أنشئ لعبة جديدة', 'action.learn': 'ابدأ التعلّم', 'action.close': 'إغلاق',
      'action.confirm': 'تأكيد', 'log.title': 'سجل الأحداث',
      'sub.dashboard': 'حالة المختبر: ما تم تحليله، وما تم توليده، وكيف قِيس.',
      'sub.projects': 'مشاريعك المستوردة وما استُخرج منها.',
      'sub.knowledge': 'مفاهيم مجرّدة مع مصادرها ودرجة الثقة — لا نسخ للكود.',
      'sub.graph': 'علاقات المفاهيم والأدوار والمكتبات.',
      'sub.games': 'مشاريع مولّدة قابلة للتشغيل، مع نتائج اختبارها.',
      'sub.versions': 'إصدارات الوكيل: ترقية أو تراجع بناءً على قياس.',
      'sub.experiments': 'فرضيات جرى اختبارها فعلياً.',
      'sub.lessons': 'ما نجح وما فشل، مع الأدلة.',
      'sub.queue': 'قائمة المهام والوضع الذاتي.',
      'sub.models': 'مزوّدو النماذج وقدراتهم الحقيقية.',
      'sub.research': 'مصادر رسمية فقط، ومقارنة بين المصادر.',
      'sub.training': 'بناء مجموعات البيانات — والفرق بين تحسين الوكيل وتدريب النموذج.',
      'sub.settings': 'نطاق العمل والأذونات.',
    },
    en: {
      'nav.dashboard': 'Dashboard', 'nav.projects': 'Projects', 'nav.knowledge': 'Knowledge',
      'nav.graph': 'Knowledge graph', 'nav.games': 'Generated games', 'nav.versions': 'Versions',
      'nav.experiments': 'Experiments', 'nav.lessons': 'Lessons', 'nav.queue': 'Tasks',
      'nav.models': 'Models', 'nav.research': 'Research', 'nav.training': 'Training', 'nav.settings': 'Permissions',
      'action.generate': 'Generate a new game', 'action.learn': 'Start learning', 'action.close': 'Close',
      'action.confirm': 'Confirm', 'log.title': 'Event log',
      'sub.dashboard': 'Lab status: what was analysed, what was generated, and how it was measured.',
      'sub.projects': 'Your imported projects and what was extracted from them.',
      'sub.knowledge': 'Abstract concepts with sources and confidence - no code is copied.',
      'sub.graph': 'How concepts, roles and libraries relate.',
      'sub.games': 'Runnable generated projects with their test results.',
      'sub.versions': 'Agent versions: promoted or rolled back on measurement.',
      'sub.experiments': 'Hypotheses that were actually tested.',
      'sub.lessons': 'What worked, what failed, with evidence.',
      'sub.queue': 'Task queue and autonomous mode.',
      'sub.models': 'Model providers and what they can genuinely do.',
      'sub.training': 'Dataset building - and the line between agent improvement and model training.',
      'sub.research': 'Official sources only, compared against each other.',
      'sub.settings': 'Workspace scope and permissions.',
    },
  };
  let lang = localStorage.getItem('lab.lang') || 'ar';
  const t = (key) => I18N[lang][key] || I18N.en[key] || key;

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.getElementById('lang-toggle').textContent = lang === 'ar' ? 'EN' : 'ع';
    localStorage.setItem('lab.lang', lang);
  }

  // ------------------------------------------------------------------- api
  const api = {
    async get(path) {
      const res = await fetch(`/api/${path}`);
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return res.json();
    },
    async post(path, body) {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return res.json();
    },
  };

  // ----------------------------------------------------------------- utils
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  };
  const fmt = (n) => (typeof n === 'number' ? (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(3)) : n ?? '-');
  const pct = (n) => (typeof n === 'number' ? `${Math.round(n * 100)}%` : '-');
  const ago = (iso) => {
    if (!iso) return '-';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${Math.round(s / 3600)}h`;
    return `${Math.round(s / 86400)}d`;
  };
  const verdictTag = (v) => el('span', { class: `tag ${v === 'ship' ? 'ok' : v === 'broken' ? 'bad' : 'warn'}` }, v || '-');

  function card(title, value, sub, extra) {
    return el('div', { class: 'card' },
      el('h3', {}, title),
      el('div', { class: 'big' }, value),
      sub ? el('div', { class: 'sub' }, sub) : null,
      extra || null);
  }

  function empty(title, msg, action) {
    return el('div', { class: 'empty' }, el('h3', {}, title), el('p', { class: 'muted' }, msg), action || null);
  }

  // ---------------------------------------------------------------- router
  const views = {};
  let currentView = 'dashboard';
  const viewEl = document.getElementById('view');

  async function render(name) {
    currentView = name;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    document.getElementById('view-title').textContent = t(`nav.${name}`);
    document.getElementById('view-sub').textContent = t(`sub.${name}`);
    viewEl.replaceChildren(el('p', { class: 'muted' }, '...'));
    try {
      const node = await views[name]();
      viewEl.replaceChildren(node);
    } catch (err) {
      viewEl.replaceChildren(el('div', { class: 'notice' }, `Failed to load: ${err.message}`));
    }
  }

  // ------------------------------------------------------------ dashboard
  views.dashboard = async () => {
    const s = await api.get('status');
    const wrap = el('div', { class: 'stack' });

    wrap.append(el('div', { class: 'grid cards' },
      card(lang === 'ar' ? 'مشاريع محلَّلة' : 'Projects analysed', `${s.projects.analyzed}/${s.projects.imported}`, `${fmt(s.projects.files)} ${lang === 'ar' ? 'ملف' : 'files'}`),
      card(lang === 'ar' ? 'عناصر معرفية' : 'Knowledge items', fmt(s.knowledge.items), `${lang === 'ar' ? 'متوسط الثقة' : 'avg confidence'} ${fmt(s.knowledge.averageConfidence)}`),
      card(lang === 'ar' ? 'ألعاب مولّدة' : 'Generated games', fmt(s.generated.total), `${s.generated.shipped} ${lang === 'ar' ? 'اجتازت الاختبار' : 'shipped'}`),
      card(lang === 'ar' ? 'متوسط نتيجة الاختبار' : 'Average test score', s.generated.averageTestScore ?? '-', lang === 'ar' ? 'من فحوص وكيل الاختبار' : 'from the test agent'),
      card(lang === 'ar' ? 'إصدار الوكيل' : 'Agent version', s.agent?.version ?? '-', s.agent?.benchmarkScore != null ? `benchmark ${fmt(s.agent.benchmarkScore)} (${s.agent.shippedTasks})` : (lang === 'ar' ? 'لم يُقس بعد' : 'not measured yet')),
      card(lang === 'ar' ? 'دروس مسجّلة' : 'Lessons', fmt(s.lessons.total), `${pct(s.lessons.successRate)} ${lang === 'ar' ? 'نجاح' : 'success'}`),
      card(lang === 'ar' ? 'تجارب' : 'Experiments', fmt(s.experiments.total), `${s.experiments.supported} ${lang === 'ar' ? 'مؤيَّدة' : 'supported'} / ${s.experiments.contradicted} ${lang === 'ar' ? 'مرفوضة' : 'rejected'}`),
      card(lang === 'ar' ? 'فضاء التصاميم' : 'Design space', fmt(s.traitSpace), lang === 'ar' ? 'تركيبة ممكنة' : 'possible combinations'),
    ));

    wrap.append(el('div', { class: 'notice info' }, s.disclaimer));

    const quick = el('div', { class: 'card' },
      el('h3', {}, lang === 'ar' ? 'الدورة الكاملة' : 'The full cycle'),
      el('p', { class: 'mono muted' }, 'IMPORT → ANALYZE → EXTRACT → STORE → PLAN → GENERATE → RUN → TEST → FIX → EVALUATE → LEARN → NEXT'),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => promptImport() }, lang === 'ar' ? 'استيراد مجلد/ZIP' : 'Import folder / ZIP'),
        el('button', { class: 'btn', onclick: () => run('analyze', {}) }, lang === 'ar' ? 'تحليل الكل' : 'Analyse all'),
        el('button', { class: 'btn', onclick: () => run('benchmark', {}) }, lang === 'ar' ? 'قياس الأداء' : 'Run benchmark'),
        el('button', { class: 'btn', onclick: () => run('evolve', { cycles: 3 }) }, lang === 'ar' ? 'دورات تحسين ذاتي' : 'Autonomous cycles'),
      ));
    wrap.append(quick);

    const caps = el('div', { class: 'grid wide' },
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'أنواع التعلّم' : 'Learning kinds'),
        el('table', {}, el('tbody', {}, ...Object.entries(s.learning).map(([k, v]) => el('tr', {},
          el('td', {}, k),
          el('td', {}, el('span', { class: `tag ${v.implemented ? 'ok' : 'warn'}` }, v.implemented ? (lang === 'ar' ? 'مُنفَّذ' : 'implemented') : (lang === 'ar' ? 'واجهة فقط' : 'interface only'))),
          el('td', { class: 'muted' }, v.description),
        )))),
      ),
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'القدرات الحالية' : 'Current capabilities'),
        el('p', { class: 'muted' }, s.models.note),
        el('div', { class: 'row' },
          el('span', { class: `tag ${s.models.llm ? 'ok' : ''}` }, `LLM: ${s.models.llm}`),
          el('span', { class: `tag ${s.models.vision ? 'ok' : ''}` }, `Vision: ${s.models.vision}`),
          el('span', { class: `tag ${s.models.embedding ? 'ok' : ''}` }, `Embedding: ${s.models.embedding}`),
          el('span', { class: 'tag' }, `${lang === 'ar' ? 'الشبكة' : 'Network'}: ${s.permissions.network}`),
        ),
      ),
    );
    wrap.append(caps);
    return wrap;
  };

  // ------------------------------------------------------------- projects
  views.projects = async () => {
    const list = await api.get('projects');
    if (!list.length) {
      return empty(
        lang === 'ar' ? 'لا توجد مشاريع بعد' : 'No projects yet',
        lang === 'ar' ? 'استورد مجلداً يحتوي مشاريعك (HTML/JS/GLB...) وسيكتشف النظام كل مشروع تلقائياً.' : 'Import a folder of your projects; the lab detects each project automatically.',
        el('button', { class: 'btn primary', onclick: promptImport }, lang === 'ar' ? 'استيراد' : 'Import'));
    }
    const wrap = el('div', { class: 'stack' });
    wrap.append(el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: promptImport }, lang === 'ar' ? 'استيراد المزيد' : 'Import more'),
      el('button', { class: 'btn', onclick: () => run('analyze', {}) }, lang === 'ar' ? 'تحليل غير المحلَّل' : 'Analyse pending'),
      el('button', { class: 'btn ghost', onclick: () => run('analyze', { reanalyze: true }) }, lang === 'ar' ? 'إعادة تحليل الكل' : 'Re-analyse all')));

    for (const p of list) {
      const det = el('details', {},
        el('summary', {}, `${p.name} `,
          el('span', { class: 'tag' }, p.kind || 'unanalysed'),
          ' ',
          el('span', { class: 'tag' }, `${p.files} files`),
          ' ',
          p.license ? el('span', { class: `tag ${p.license.known ? 'ok' : 'warn'}` }, p.license.license) : null),
        el('p', { class: 'muted' }, p.summary || (lang === 'ar' ? 'لم يُحلَّل بعد.' : 'Not analysed yet.')),
        el('div', { class: 'row' },
          el('span', { class: 'tag accent' }, `${p.concepts} concepts`),
          p.problems ? el('span', { class: 'tag warn' }, `${p.problems} issues`) : null,
          el('button', { class: 'btn small ghost', onclick: () => showProject(p.id) }, lang === 'ar' ? 'التفاصيل' : 'Details'),
          el('button', { class: 'btn small ghost', onclick: () => run('export', { what: 'memory', id: p.id }, true) }, lang === 'ar' ? 'تصدير الذاكرة' : 'Export memory')));
      wrap.append(det);
    }
    return wrap;
  };

  async function showProject(id) {
    const p = await api.get(`projects/${id}`);
    const a = p.analysis;
    openModal(p.name, el('div', { class: 'stack' },
      el('p', {}, a?.summary || '-'),
      a ? el('div', { class: 'grid cards' },
        card('LOC', fmt(a.stats.jsLoc), `${a.stats.functions} fn / ${a.stats.classes} cls`),
        card('Concepts', a.concepts.length, a.architecture.rendering),
        card('Assets', a.assets.length, a.stats.bytesHuman),
      ) : null,
      a ? el('div', { class: 'card' }, el('h3', {}, 'Pipeline'), el('p', { class: 'mono' }, a.relations.pipeline.join(' → '))) : null,
      a ? el('div', { class: 'card' }, el('h3', {}, lang === 'ar' ? 'مشاكل محتملة' : 'Potential problems'),
        a.problems.length ? el('ul', {}, ...a.problems.map((x) => el('li', {}, el('b', {}, x.issue), ' — ', x.detail, el('div', { class: 'muted' }, `fix: ${x.fix}`)))) : el('p', { class: 'muted' }, '-')) : null,
      a ? el('div', { class: 'card' }, el('h3', {}, lang === 'ar' ? 'فرص التحسين' : 'Optimization opportunities'),
        a.optimizations.length ? el('ul', {}, ...a.optimizations.map((x) => el('li', {}, el('b', {}, x.opportunity), ' — ', x.why))) : el('p', { class: 'muted' }, '-')) : null,
      a ? el('details', {}, el('summary', {}, lang === 'ar' ? 'المفاهيم المستخرجة' : 'Extracted concepts'),
        el('table', {}, el('tbody', {}, ...a.concepts.map((c) => el('tr', {}, el('td', {}, c.key), el('td', {}, c.title), el('td', { class: 'muted' }, `${c.occurrences}x`)))))) : null,
      a?.tuningPriors ? el('details', {}, el('summary', {}, lang === 'ar' ? 'ثوابت مُتعلَّمة' : 'Learned constants'), el('pre', {}, JSON.stringify(a.tuningPriors, null, 2))) : null,
    ));
  }

  // ------------------------------------------------------------ knowledge
  views.knowledge = async () => {
    const { byCategory, stats } = await api.get('knowledge');
    const wrap = el('div', { class: 'stack' });
    wrap.append(el('div', { class: 'grid cards' },
      card(lang === 'ar' ? 'عناصر' : 'Items', stats.items, `${stats.categories} ${lang === 'ar' ? 'فئة' : 'categories'}`),
      card(lang === 'ar' ? 'ثقة عالية' : 'High confidence', stats.highConfidence, '≥ 0.7'),
      card(lang === 'ar' ? 'استُخدمت في التوليد' : 'Used in generation', stats.generatorUses, `${pct(stats.generatorSuccessRate)} ${lang === 'ar' ? 'نجاح' : 'success'}`),
      card(lang === 'ar' ? 'أنماط سيئة' : 'Anti-patterns', stats.antiPatterns, lang === 'ar' ? 'يتجنبها المولّد' : 'actively avoided'),
    ));
    wrap.append(el('div', { class: 'row' },
      el('button', { class: 'btn ghost small', onclick: () => run('export', { what: 'knowledge' }, true) }, lang === 'ar' ? 'تصدير المعرفة' : 'Export knowledge')));

    for (const [cat, items] of Object.entries(byCategory)) {
      if (!items.length) continue;
      wrap.append(el('details', { open: items.length <= 3 ? '' : null },
        el('summary', {}, `${cat} `, el('span', { class: 'tag' }, items.length)),
        el('table', {},
          el('thead', {}, el('tr', {}, el('th', {}, lang === 'ar' ? 'المفهوم' : 'Concept'), el('th', {}, lang === 'ar' ? 'الثقة' : 'Confidence'), el('th', {}, lang === 'ar' ? 'المصادر' : 'Sources'), el('th', {}, lang === 'ar' ? 'الاستخدام' : 'Uses'))),
          el('tbody', {}, ...items.map((k) => el('tr', {},
            el('td', {}, el('b', {}, k.concept), el('div', { class: 'muted' }, k.description)),
            el('td', {}, el('div', { class: 'bar' }, el('i', { style: `width:${k.confidence * 100}%` })), el('span', { class: 'mono' }, fmt(k.confidence))),
            el('td', { class: 'muted' }, k.sources.map((s) => s.projectName).join(', ')),
            el('td', {}, el('span', { class: 'tag ok' }, `${k.successfulUses.length}✓`), ' ', k.failedUses.length ? el('span', { class: 'tag bad' }, `${k.failedUses.length}✗`) : null),
          ))))));
    }
    return wrap;
  };

  // ---------------------------------------------------------------- graph
  views.graph = async () => {
    const g = await api.get('knowledge/graph');
    const wrap = el('div', { class: 'stack' });
    if (!g.nodes.length) return empty(lang === 'ar' ? 'الرسم فارغ' : 'Graph is empty', lang === 'ar' ? 'حلّل بعض المشاريع أولاً.' : 'Analyse some projects first.');
    wrap.append(el('div', { class: 'muted' }, `${g.nodes.length} nodes · ${g.edges.length} edges · ${g.docs} documents`));
    const canvas = el('canvas', { id: 'graph-canvas' });
    wrap.append(canvas);
    wrap.append(el('p', { class: 'muted' }, lang === 'ar'
      ? 'سُمك الحافة = قوة الارتباط (PMI). اسحب للتحريك.'
      : 'Edge weight = association strength (PMI). Drag to pan.'));
    setTimeout(() => drawGraph(canvas, g), 30);
    return wrap;
  };

  function drawGraph(canvas, g) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const top = g.nodes.slice(0, 70);
    const index = new Map(top.map((n, i) => [n.id, i]));
    const edges = g.edges.filter((e) => index.has(e.from) && index.has(e.to)).slice(0, 180);
    const colors = { concept: '#5ad1a8', category: '#7c8cff', role: '#ffbf5e', lib: '#ff6b7a', asset: '#8c96b0', kind: '#e8ecf8' };

    const nodes = top.map((n, i) => ({
      ...n,
      x: rect.width / 2 + Math.cos((i / top.length) * Math.PI * 2) * (rect.width / 3.2),
      y: rect.height / 2 + Math.sin((i / top.length) * Math.PI * 2) * (rect.height / 3.2),
      vx: 0, vy: 0,
      r: 4 + Math.min(10, Math.sqrt(n.count) * 2.2),
    }));

    // Small spring layout: repulsion + edge attraction, run for a fixed budget.
    for (let step = 0; step < 220; step++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy || 1;
          const f = 900 / d2;
          const d = Math.sqrt(d2);
          a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
          b.vx += (dx / d) * f; b.vy += (dy / d) * f;
        }
      }
      for (const e of edges) {
        const a = nodes[index.get(e.from)], b = nodes[index.get(e.to)];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - 110) * 0.014 * Math.min(2, Math.max(0.3, (e.pmi ?? 1)));
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of nodes) {
        // Weak pull toward the centre: without it, repulsion pushes everything
        // onto the clamp border and the layout reads as a ring of stragglers.
        n.vx += (rect.width / 2 - n.x) * 0.0022;
        n.vy += (rect.height / 2 - n.y) * 0.0022;
        n.x += (n.vx *= 0.82); n.y += (n.vy *= 0.82);
        n.x = Math.max(30, Math.min(rect.width - 30, n.x));
        n.y = Math.max(24, Math.min(rect.height - 24, n.y));
      }
    }

    let offX = 0, offY = 0, dragging = false, lastX = 0, lastY = 0;
    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#11151f';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.translate(offX, offY);
      for (const e of edges) {
        const a = nodes[index.get(e.from)], b = nodes[index.get(e.to)];
        ctx.strokeStyle = `rgba(140,150,176,${Math.min(0.5, 0.08 + (e.pmi ?? 0) * 0.08)})`;
        ctx.lineWidth = Math.min(3, 0.4 + Math.log(1 + e.weight));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const n of nodes) {
        ctx.fillStyle = colors[n.type] || '#8c96b0';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        if (n.r > 7) {
          ctx.fillStyle = '#e8ecf8';
          ctx.font = '11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(n.label.slice(0, 22), n.x, n.y - n.r - 4);
        }
      }
    };
    paint();
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointerleave', () => { dragging = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      offX += e.clientX - lastX; offY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      paint();
    });
  }

  // ---------------------------------------------------------------- games
  views.games = async () => {
    const list = await api.get('generated');
    if (!list.length) {
      return empty(lang === 'ar' ? 'لا ألعاب بعد' : 'No games yet',
        lang === 'ar' ? 'اضغط "أنشئ لعبة جديدة" — سيصمم النظام ثم يبني ثم يشغّل ويختبر ويصلّح.' : 'Press "Generate a new game": the lab designs, builds, runs, tests and fixes.',
        el('button', { class: 'btn primary', onclick: openGenerateDialog }, t('action.generate')));
    }
    const wrap = el('div', { class: 'grid wide' });
    for (const g of list) {
      wrap.append(el('div', { class: 'card stack' },
        el('div', { class: 'spread' },
          el('div', {}, el('b', {}, g.name), el('div', { class: 'muted mono' }, `${g.ruleset} · ${g.traits?.twist} · ${g.agentVersion}`)),
          g.test ? verdictTag(g.test.verdict) : el('span', { class: 'tag' }, '-')),
        el('div', { class: 'row' },
          el('span', { class: 'tag' }, `test ${fmt(g.test?.score)}`),
          el('span', { class: 'tag' }, `quality ${fmt(g.quality?.overall)}`),
          el('span', { class: 'tag accent' }, `novelty ${fmt(g.novelty?.novelty)}`),
          el('span', { class: 'tag' }, `overlap ${pct(g.codeOverlap?.maxOverlapWithImports || 0)}`),
          g.fixes ? el('span', { class: 'tag warn' }, `${g.fixes} auto-fix`) : null),
        el('div', { class: 'row' },
          el('a', { class: 'btn small primary', href: `/play/${g.id}/`, target: '_blank' }, lang === 'ar' ? 'تشغيل' : 'Play'),
          el('button', { class: 'btn small ghost', onclick: () => showGame(g.id) }, lang === 'ar' ? 'التقرير' : 'Report'),
          el('button', { class: 'btn small ghost', onclick: () => run('export', { what: 'project', id: g.id }, true) }, lang === 'ar' ? 'تصدير' : 'Export')),
        el('div', { class: 'muted mono' }, `${g.files} files · ${g.bytes} · ${ago(g.createdAt)}`)));
    }
    return wrap;
  };

  async function showGame(id) {
    const g = await api.get(`generated/${id}`);
    openModal(g.name, el('div', { class: 'stack' },
      el('p', {}, g.design?.pitch || ''),
      el('iframe', { class: 'preview', src: `/play/${g.id}/`, title: g.name }),
      el('div', { class: 'row' }, ...(g.design?.visual?.palette || []).map((c) => el('span', { class: 'swatch', style: `background:${c}` }))),
      el('div', { class: 'card' }, el('h3', {}, lang === 'ar' ? 'نتائج الاختبار' : 'Test checks'),
        el('table', {}, el('tbody', {}, ...(g.test?.checks || []).map((c) => el('tr', {},
          el('td', {}, el('span', { class: `tag ${c.pass ? 'ok' : c.severity === 'critical' ? 'bad' : 'warn'}` }, c.pass ? 'pass' : 'fail')),
          el('td', {}, c.id),
          el('td', { class: 'muted' }, c.detail)))))),
      g.fixes?.length ? el('div', { class: 'card' }, el('h3', {}, lang === 'ar' ? 'إصلاحات تلقائية' : 'Automatic fixes'),
        el('ul', {}, ...g.fixes.map((f) => el('li', {}, el('b', {}, f.check), ': ', f.why)))) : null,
      el('details', {}, el('summary', {}, lang === 'ar' ? 'المعرفة المستخدمة' : 'Knowledge used'),
        el('ul', {}, ...(g.design?.sourceKnowledge || []).map((k) => el('li', {}, `${k.key} (${k.confidence}) — ${k.sourceProjects.join(', ')}`)))),
      el('details', {}, el('summary', {}, lang === 'ar' ? 'وثيقة التصميم' : 'Design document'), el('pre', {}, JSON.stringify(g.design, null, 2).slice(0, 6000))),
    ));
  }

  // ------------------------------------------------------------- versions
  views.versions = async () => {
    const hist = await api.get('versions');
    const wrap = el('div', { class: 'stack' });
    wrap.append(el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => run('benchmark', {}) }, lang === 'ar' ? 'قياس الإصدار الحالي' : 'Benchmark active version'),
      el('button', { class: 'btn', onclick: () => run('evolve', { cycles: 3 }) }, lang === 'ar' ? 'تشغيل التحسين الذاتي' : 'Run autonomous improvement'),
      el('button', { class: 'btn ghost', onclick: () => run('export', { what: 'evaluation' }, true) }, lang === 'ar' ? 'تصدير التقييم' : 'Export evaluation')));

    wrap.append(el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'version'), el('th', {}, 'score'), el('th', {}, 'status'), el('th', {}, 'decision'), el('th', {}, ''))),
      el('tbody', {}, ...hist.map((v) => el('tr', {},
        el('td', {}, el('b', {}, v.version), v.parentVersion ? el('div', { class: 'muted mono' }, `← ${v.parentVersion}`) : null),
        el('td', {}, fmt(v.benchmark?.score), v.benchmark ? el('div', { class: 'muted mono' }, `${v.benchmark.shipped}/${v.benchmark.tasks.length}`) : null),
        el('td', {}, el('span', { class: `tag ${v.status === 'active' ? 'ok' : v.status === 'archived' ? 'bad' : ''}` }, v.status)),
        el('td', { class: 'muted' }, v.decision || v.rationale),
        el('td', {}, v.status !== 'active' ? el('button', { class: 'btn small ghost', onclick: () => run('versions/rollback', { version: v.version }, true) }, lang === 'ar' ? 'استعادة' : 'Restore') : null),
      )))));

    const measured = hist.filter((v) => v.benchmark);
    if (measured.length >= 2) {
      const a = measured[measured.length - 2].version;
      const b = measured[measured.length - 1].version;
      const cmp = await api.get(`versions/compare?a=${a}&b=${b}`);
      if (cmp) {
        wrap.append(el('div', { class: 'card' },
          el('h3', {}, `${lang === 'ar' ? 'مقارنة' : 'Compare'} ${a} ↔ ${b}`),
          el('p', {}, cmp.comparison.statement),
          cmp.comparison.caveat ? el('div', { class: 'notice' }, cmp.comparison.caveat) : null,
          el('table', {}, el('tbody', {}, ...cmp.comparison.perTask.map((tk) => el('tr', {},
            el('td', {}, tk.taskId), el('td', {}, fmt(tk.before)), el('td', {}, fmt(tk.after)),
            el('td', {}, el('span', { class: `tag ${tk.delta > 0 ? 'ok' : tk.delta < 0 ? 'bad' : ''}` }, `${tk.delta > 0 ? '+' : ''}${tk.delta}`)))))),
          el('details', {}, el('summary', {}, lang === 'ar' ? 'الفرق في السياسة' : 'Policy diff'), el('pre', {}, JSON.stringify(cmp.policyDiff, null, 2)))));
      }
    }
    return wrap;
  };

  // ---------------------------------------------------------- experiments
  views.experiments = async () => {
    const list = await api.get('experiments');
    if (!list.length) return empty(lang === 'ar' ? 'لا تجارب بعد' : 'No experiments yet', lang === 'ar' ? 'شغّل التحسين الذاتي لتوليد فرضيات واختبارها.' : 'Run autonomous improvement to generate and test hypotheses.');
    return el('div', { class: 'stack' }, ...list.map((e) => el('div', { class: 'card' },
      el('div', { class: 'spread' },
        el('b', {}, e.mutationId),
        el('span', { class: `tag ${e.conclusion === 'supported' ? 'ok' : e.conclusion === 'contradicted' ? 'bad' : 'warn'}` }, e.conclusion)),
      el('p', { class: 'muted' }, e.hypothesis),
      el('p', { class: 'mono' }, e.statement),
      el('div', { class: 'row' },
        el('span', { class: 'tag' }, `control ${fmt(e.control.score)}`),
        el('span', { class: 'tag' }, `variant ${fmt(e.treatment.score)}`),
        el('span', { class: 'tag' }, `tasks ${e.tasks.length}`),
        el('span', { class: 'tag' }, ago(e.at))),
      el('details', {}, el('summary', {}, lang === 'ar' ? 'التغيير' : 'Change'), el('pre', {}, JSON.stringify(e.change, null, 2))))));
  };

  // -------------------------------------------------------------- lessons
  views.lessons = async () => {
    const { recent, recurring, stats } = await api.get('lessons');
    const wrap = el('div', { class: 'stack' });
    wrap.append(el('div', { class: 'grid cards' },
      card(lang === 'ar' ? 'دروس' : 'Lessons', stats.total, `${pct(stats.successRate)} ${lang === 'ar' ? 'نجاح' : 'success'}`),
      card(lang === 'ar' ? 'متكررة' : 'Recurring', recurring.length, lang === 'ar' ? 'تظهر أكثر من مرة' : 'seen more than once')));
    if (recurring.length) {
      wrap.append(el('div', { class: 'card' }, el('h3', {}, lang === 'ar' ? 'دروس متكررة' : 'Recurring lessons'),
        el('ul', {}, ...recurring.map((r) => el('li', {}, el('b', {}, `${r.count}× `), r.lesson, ' ', el('span', { class: 'tag' }, pct(r.successRate)))))));
    }
    wrap.append(el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, lang === 'ar' ? 'المهمة' : 'Task'), el('th', {}, lang === 'ar' ? 'القرار' : 'Decision'), el('th', {}, lang === 'ar' ? 'النتيجة' : 'Result'), el('th', {}, lang === 'ar' ? 'الدرس' : 'Lesson'))),
      el('tbody', {}, ...recent.map((l) => el('tr', {},
        el('td', {}, l.task, el('div', { class: 'muted mono' }, ago(l.at))),
        el('td', { class: 'muted' }, l.decision),
        el('td', {}, el('span', { class: `tag ${l.success ? 'ok' : 'warn'}` }, l.success ? 'ok' : 'partial'), ' ', l.result),
        el('td', {}, l.lesson))))));
    return wrap;
  };

  // ---------------------------------------------------------------- queue
  views.queue = async () => {
    const [{ status, tasks }, auto] = await Promise.all([api.get('queue'), api.get('autopilot')]);
    const wrap = el('div', { class: 'stack' });
    wrap.append(el('div', { class: 'card' },
      el('h3', {}, lang === 'ar' ? 'الوضع الذاتي' : 'Autonomous mode'),
      el('div', { class: 'spread' },
        el('div', {}, el('b', {}, auto.state), el('div', { class: 'muted' }, `${lang === 'ar' ? 'دورة' : 'cycle'} ${auto.cycle}`)),
        el('div', { class: 'row' },
          el('button', { class: 'btn small', onclick: () => run('evolve', { cycles: 3 }) }, 'START'),
          el('button', { class: 'btn small ghost', onclick: () => post('autopilot/pause') }, 'PAUSE'),
          el('button', { class: 'btn small ghost', onclick: () => post('autopilot/resume') }, 'RESUME'),
          el('button', { class: 'btn small danger', onclick: () => post('autopilot/stop') }, 'STOP'))),
      auto.history.length ? el('ul', {}, ...auto.history.slice(-6).map((h) => el('li', { class: 'muted' }, `#${h.cycle} ${h.hypothesis || h.outcome}: ${h.decision || ''}`))) : null));

    wrap.append(el('div', { class: 'card' },
      el('h3', {}, lang === 'ar' ? 'قائمة المهام' : 'Task queue'),
      el('div', { class: 'row' },
        el('span', { class: 'tag' }, status.state),
        status.current ? el('span', { class: 'tag accent' }, status.current.label) : null,
        el('button', { class: 'btn small', onclick: () => post('queue/start') }, 'START'),
        el('button', { class: 'btn small ghost', onclick: () => post('queue/pause') }, 'PAUSE'),
        el('button', { class: 'btn small ghost', onclick: () => post('queue/resume') }, 'RESUME'),
        el('button', { class: 'btn small danger', onclick: () => post('queue/stop') }, 'STOP'),
        el('button', { class: 'btn small ghost', onclick: () => post('queue/clear') }, lang === 'ar' ? 'مسح المنتهية' : 'Clear finished')),
      el('div', { class: 'notice info' }, lang === 'ar'
        ? 'المهام الطويلة تعمل في الخادم وتستمر بعد إغلاق الصفحة. المتصفح وحده لا يواصل التنفيذ بعد الإغلاق.'
        : 'Long tasks run in the backend and continue after you close this page. A browser tab alone does not keep executing once closed.'),
      el('table', {}, el('tbody', {}, ...tasks.slice(-30).reverse().map((k) => el('tr', {},
        el('td', {}, el('span', { class: `tag ${k.state === 'done' ? 'ok' : k.state === 'failed' ? 'bad' : k.state === 'running' ? 'accent' : ''}` }, k.state)),
        el('td', {}, k.label, el('div', { class: 'muted mono' }, k.type)),
        el('td', { class: 'muted' }, k.error || (k.result ? JSON.stringify(k.result).slice(0, 120) : '')),
        el('td', { class: 'muted mono right' }, ago(k.finishedAt || k.startedAt || k.queuedAt))))))));
    return wrap;
  };

  // --------------------------------------------------------------- models
  views.models = async () => {
    const { providers, capabilities } = await api.get('models');
    return el('div', { class: 'stack' },
      el('div', { class: 'notice info' }, capabilities.note),
      el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, 'provider'), el('th', {}, 'LLM'), el('th', {}, 'vision'), el('th', {}, 'embedding'), el('th', {}, 'local'), el('th', {}, 'ready'))),
        el('tbody', {}, ...providers.map((p) => el('tr', {},
          el('td', {}, el('b', {}, p.id), el('div', { class: 'muted' }, p.label)),
          ...['llm', 'vision', 'embedding', 'local'].map((k) => el('td', {}, p.capabilities[k] ? '✓' : '—')),
          el('td', {}, el('span', { class: `tag ${p.ready ? 'ok' : 'warn'}` }, p.ready ? 'ready' : 'needs key')))))),
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'إضافة مزوّد' : 'Adding a provider'),
        el('p', { class: 'muted' }, lang === 'ar'
          ? 'أضف مزوّدك في lab.config.json داخل مساحة العمل. المفاتيح تأتي منك فقط — عبر الإعدادات أو متغير بيئة. النظام لا يبحث عن مفاتيح أحد.'
          : 'Add providers in lab.config.json inside the workspace. Keys come only from you - via settings or an environment variable. The lab never looks for anyone else\'s keys.'),
        el('pre', {}, `"models": {
  "default": "local-llm",
  "providers": {
    "local-llm": { "kind": "openai-compatible", "baseUrl": "http://localhost:11434/v1", "model": "qwen2.5-coder", "local": true },
    "cloud":     { "kind": "anthropic", "model": "claude-sonnet-4-5", "apiKeyEnv": "ANTHROPIC_API_KEY" }
  }
}`)));
  };

  // -------------------------------------------------------------- research
  views.research = async () => {
    const r = await api.get('research');
    const input = el('input', { placeholder: lang === 'ar' ? 'اسأل عن توثيق رسمي...' : 'Ask about official documentation...' });
    const out = el('div', { class: 'stack' });
    const wrap = el('div', { class: 'stack' },
      el('div', { class: 'notice' + (r.online ? ' info' : '') },
        r.online ? (lang === 'ar' ? 'متصل: يمكن جلب توثيق جديد من المصادر المسموح بها.' : 'Online: new documentation can be fetched from allowlisted sources.')
          : (lang === 'ar' ? 'غير متصل أو الشبكة مغلقة: يعمل النظام من الذاكرة المؤقتة والمعرفة المحلية.' : 'Offline or network disabled: the lab works from cache and local knowledge.')),
      el('div', { class: 'card' },
        el('div', { class: 'row' }, input,
          el('button', {
            class: 'btn primary',
            onclick: async () => {
              if (!input.value.trim()) return;
              out.replaceChildren(el('p', { class: 'muted' }, '...'));
              const res = await api.post('research', { question: input.value });
              out.replaceChildren(el('div', { class: 'card' },
                el('p', {}, res.answer),
                el('div', { class: 'row' },
                  el('span', { class: 'tag' }, `sources ${res.corroboration}`),
                  el('span', { class: `tag ${res.corroborated ? 'ok' : 'warn'}` }, res.corroborated ? 'corroborated' : 'single-source'),
                  el('span', { class: 'tag' }, `confidence ${fmt(res.confidence)}`)),
                res.note ? el('p', { class: 'muted' }, res.note) : null,
                el('ul', {}, ...(res.sources || []).map((s) => el('li', {}, el('a', { href: s.url, target: '_blank' }, s.title || s.url), s.fromCache ? ' (cache)' : '')))));
            },
          }, lang === 'ar' ? 'ابحث' : 'Research')),
        el('p', { class: 'muted mono' }, `allowlist: ${r.allowlist.join(', ')}`)),
      out,
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'ماذا يعمل بدون إنترنت' : 'What works offline'),
        el('ul', {}, ...r.offline.available.map((x) => el('li', {}, x))),
        el('p', { class: 'muted' }, `${lang === 'ar' ? 'يحتاج إنترنت' : 'Needs internet'}: ${r.offline.unavailable.join(', ')}`),
        el('p', { class: 'muted mono' }, `cached documents: ${r.offline.cachedDocuments} · knowledge: ${r.offline.knowledgeItems}`)));
    if (r.history.length) {
      wrap.append(el('details', {}, el('summary', {}, lang === 'ar' ? 'عمليات بحث سابقة' : 'Previous research'),
        el('ul', {}, ...r.history.map((h) => el('li', {}, el('b', {}, h.question), ` — ${h.corroboration} sources, confidence ${h.confidence}`)))));
    }
    return wrap;
  };

  // -------------------------------------------------------------- training
  views.training = async () => {
    const { datasets, engine, models } = await api.get('training');
    return el('div', { class: 'stack' },
      el('div', { class: 'notice' }, engine.reason || (lang === 'ar' ? 'خلفية تدريب متصلة.' : 'A training backend is attached.')),
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'تحسين الوكيل مقابل تدريب النموذج' : 'Agent improvement vs model training'),
        el('table', {}, el('tbody', {},
          el('tr', {}, el('td', {}, el('b', {}, lang === 'ar' ? 'تحسين الوكيل' : 'Agent improvement')), el('td', {}, lang === 'ar' ? 'أدوات، ذاكرة، سير عمل، معرفة، كود — مُنفَّذ ومقيس على benchmark.' : 'Tools, memory, workflow, knowledge, code - implemented and benchmarked.')),
          el('tr', {}, el('td', {}, el('b', {}, lang === 'ar' ? 'تدريب النموذج' : 'Model training')), el('td', {}, lang === 'ar' ? 'أوزان، بيانات، تدريب — يحتاج خلفية GPU. المختبر يجهّز البيانات فقط ولا يدّعي غير ذلك.' : 'Weights, dataset, training - needs a GPU backend. The lab prepares datasets only and claims nothing more.')))),
        el('button', { class: 'btn primary', onclick: () => post('training/dataset', {}, true) }, lang === 'ar' ? 'بناء مجموعة بيانات' : 'Build dataset')),
      datasets.length ? el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, 'dataset'), el('th', {}, 'stage'), el('th', {}, 'train/val'), el('th', {}, 'est. tokens'), el('th', {}, 'files'))),
        el('tbody', {}, ...datasets.map((d) => el('tr', {},
          el('td', {}, d.name), el('td', {}, d.stage),
          el('td', {}, d.split ? `${d.split.train}/${d.split.validation}` : '-'),
          el('td', {}, fmt(d.stats?.estimatedTokens)),
          el('td', { class: 'muted mono' }, (d.files || []).join(', ')))))) : el('p', { class: 'muted' }, lang === 'ar' ? 'لا مجموعات بيانات بعد.' : 'No datasets yet.'),
      models.length ? el('div', { class: 'card' }, el('h3', {}, 'Model versions'), el('pre', {}, JSON.stringify(models, null, 2))) : null);
  };

  // -------------------------------------------------------------- settings
  views.settings = async () => {
    const cfg = await api.get('config');
    const perms = { ...cfg.permissions };
    const rows = Object.entries(perms).map(([k, v]) => el('div', { class: 'spread' },
      el('div', {}, el('b', {}, k), el('div', { class: 'muted' }, permDesc(k))),
      el('input', {
        type: 'checkbox', style: 'width:auto', ...(v ? { checked: '' } : {}),
        ...(k === 'modifyImports' ? { disabled: '' } : {}),
        onchange: (e) => { perms[k] = e.target.checked; },
      })));
    const pathInput = el('input', { placeholder: '/path/to/MY_PROJECTS' });
    return el('div', { class: 'stack' },
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'مساحة العمل' : 'Workspace'),
        el('p', { class: 'mono' }, cfg.workspace),
        el('p', { class: 'muted' }, lang === 'ar'
          ? 'الوكيل لا يستطيع القراءة أو الكتابة خارج مساحة العمل والمجلدات التي تمنحها صراحةً. الملفات الأصلية تُنسخ ولا تُعدَّل أبداً.'
          : 'The agent cannot read or write outside the workspace and the folders you explicitly grant. Originals are copied, never modified.'),
        el('div', { class: 'row' }, pathInput,
          el('button', { class: 'btn', onclick: async () => { await api.post('workspace/grant', { path: pathInput.value }); render('settings'); } }, lang === 'ar' ? 'منح وصول' : 'Grant access')),
        cfg.importRoots.length ? el('ul', {}, ...cfg.importRoots.map((r) => el('li', { class: 'mono' }, r))) : null),
      el('div', { class: 'card stack' },
        el('h3', {}, lang === 'ar' ? 'الأذونات' : 'Permissions'),
        ...rows,
        el('button', { class: 'btn primary', onclick: async () => { await api.post('permissions', perms); toast(lang === 'ar' ? 'تم الحفظ' : 'Saved'); } }, lang === 'ar' ? 'حفظ' : 'Save')),
      el('div', { class: 'card' },
        el('h3', {}, lang === 'ar' ? 'تصدير' : 'Export'),
        el('div', { class: 'row' }, ...['knowledge', 'evaluation', 'datasets', 'logs'].map((w) =>
          el('button', { class: 'btn small', onclick: () => run('export', { what: w }, true) }, w)))));
  };

  function permDesc(key) {
    const ar = {
      readImports: 'قراءة المجلدات الممنوحة', writeWorkspace: 'الكتابة داخل مساحة العمل',
      network: 'الوصول للإنترنت (البحث والنماذج البعيدة)', runSandbox: 'تشغيل الكود المولّد في صندوق معزول',
      runBrowser: 'تشغيل متصفح حقيقي (يحتاج playwright)', shell: 'تنفيذ أوامر النظام', modifyImports: 'تعديل ملفاتك الأصلية (مقفل دائماً)',
    };
    const en = {
      readImports: 'read the folders you granted', writeWorkspace: 'write inside the workspace',
      network: 'internet access (research and remote models)', runSandbox: 'run generated code in the isolated sandbox',
      runBrowser: 'drive a real browser (needs playwright)', shell: 'run system commands', modifyImports: 'modify your original files (permanently off)',
    };
    return (lang === 'ar' ? ar : en)[key] || '';
  }

  // ---------------------------------------------------------------- actions
  async function run(route, body, immediate) {
    try {
      const res = await api.post(route, body);
      toast(immediate ? JSON.stringify(res).slice(0, 120) : (lang === 'ar' ? 'أُضيفت المهمة إلى القائمة' : 'Task queued'));
      if (!immediate) await api.post('queue/start');
      setTimeout(() => render(currentView), 700);
    } catch (err) { toast(`error: ${err.message}`); }
  }
  const post = (route, body, immediate) => run(route, body, immediate ?? true);

  function promptImport() {
    const input = el('input', { placeholder: '/path/to/MY_PROJECTS or archive.zip' });
    openModal(lang === 'ar' ? 'استيراد مشاريع' : 'Import projects',
      el('div', { class: 'stack' },
        el('p', { class: 'muted' }, lang === 'ar'
          ? 'أدخل مسار مجلد يحتوي مشاريعك أو ملف ZIP. يعمل النظام على نسخة، ولا يمس ملفاتك الأصلية.'
          : 'Enter a folder path containing your projects, or a ZIP file. The lab works on a copy and never touches your originals.'),
        input),
      async () => {
        if (!input.value.trim()) return;
        await api.post('import', { path: input.value.trim() });
        await api.post('queue/start');
        toast(lang === 'ar' ? 'جارٍ الاستيراد...' : 'Importing...');
        setTimeout(() => render('projects'), 1200);
      });
  }

  function openGenerateDialog() {
    const genre = el('select', {}, ...['', 'arena-survival', 'twin-stick-shooter', 'platformer', 'puzzle-logic', 'racing', 'tower-defense', 'endless-runner', 'stealth-infiltration', 'exploration-3d', 'survival-crafting', 'wave-defense-shooter', 'maze-escape', 'block-builder', 'obstacle-course']
      .map((g) => el('option', { value: g }, g || (lang === 'ar' ? 'اختيار تلقائي (الأكثر جِدّة)' : 'automatic (most novel)'))));
    const twist = el('select', {}, ...['', 'none', 'gravity-flip', 'time-dilation', 'shrinking-arena', 'resource-decay', 'one-hit-fragile', 'light-radius', 'combo-chain', 'terrain-mutation', 'echo-replay', 'charge-release', 'rhythm-window']
      .map((g) => el('option', { value: g }, g || (lang === 'ar' ? 'اختيار تلقائي' : 'automatic'))));
    const seed = el('input', { placeholder: lang === 'ar' ? 'بذرة (اختياري)' : 'seed (optional)' });
    openModal(t('action.generate'),
      el('div', { class: 'stack' },
        el('div', { class: 'field' }, el('label', {}, lang === 'ar' ? 'النوع' : 'Genre'), genre),
        el('div', { class: 'field' }, el('label', {}, lang === 'ar' ? 'المُعدِّل' : 'Modifier'), twist),
        el('div', { class: 'field' }, el('label', {}, 'seed'), seed),
        el('p', { class: 'muted' }, lang === 'ar'
          ? 'سيصمم النظام ثم يولّد الكود ثم يشغّله ويختبره ويصلّح ما يفشل، قبل الحفظ.'
          : 'The lab designs, generates code, runs it, tests it and fixes what fails before saving.')),
      async () => {
        const brief = {};
        if (genre.value) brief.genre = genre.value;
        if (twist.value) brief.twist = twist.value;
        await api.post('generate', { brief, seed: seed.value || undefined });
        await api.post('queue/start');
        toast(lang === 'ar' ? 'جارٍ التوليد...' : 'Generating...');
        setTimeout(() => render('games'), 2500);
      });
  }

  // ----------------------------------------------------------------- modal
  const modal = document.getElementById('modal');
  let modalOk = null;
  function openModal(title, body, onOk) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').replaceChildren(body);
    document.getElementById('modal-ok').style.display = onOk ? '' : 'none';
    modalOk = onOk;
    modal.showModal();
  }
  modal.addEventListener('close', () => { if (modal.returnValue === 'ok' && modalOk) modalOk(); modalOk = null; });

  function toast(msg) {
    const node = el('div', { class: 'notice info', style: 'position:fixed;inset-block-end:20px;inset-inline-start:50%;transform:translateX(-50%);z-index:50' }, msg);
    document.body.append(node);
    setTimeout(() => node.remove(), 3200);
  }

  // ------------------------------------------------------------------- log
  const logEl = document.getElementById('log');
  function addLog(evt) {
    const { seq, at, type, level, ...rest } = evt;
    const li = el('li', { class: level },
      el('b', {}, type), ' ',
      Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' '));
    logEl.append(li);
    while (logEl.children.length > 300) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }

  function connect() {
    const es = new EventSource('/events');
    const conn = document.getElementById('conn');
    es.onopen = () => { conn.className = 'pill online'; };
    es.onerror = () => { conn.className = 'pill offline'; };
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        addLog(evt);
        if (['game.created', 'analyze.done', 'version.promote', 'task.done', 'import.project'].includes(evt.type)) {
          clearTimeout(connect._t);
          connect._t = setTimeout(() => render(currentView), 900);
        }
      } catch { /* ignore malformed frame */ }
    };
  }

  // ------------------------------------------------------------------ boot
  document.getElementById('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (btn) render(btn.dataset.view);
  });
  document.getElementById('btn-refresh').addEventListener('click', () => render(currentView));
  document.getElementById('btn-generate').addEventListener('click', openGenerateDialog);
  document.getElementById('btn-learn').addEventListener('click', () => run('analyze', {}));
  document.getElementById('lang-toggle').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    applyLang();
    render(currentView);
  });
  document.getElementById('btn-log-toggle').addEventListener('click', (e) => {
    const bar = document.querySelector('.logbar');
    bar.classList.toggle('collapsed');
    e.target.textContent = bar.classList.contains('collapsed') ? '▴' : '▾';
  });

  applyLang();
  connect();
  render('dashboard');
})();
