/* ================= واجهة التطبيق ================= */
var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };

var ST = {
  fav: load('mg_fav', []), recent: load('mg_recent', []),
  best: load('mg_best', {}), plays: load('mg_plays', {}),
  cat: 'all', q: '', cur: null
};
function load(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
MUTED = load('mg_mute', false);

function hash(s){ var h = 0; for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
var PALS = [
  ['#7c5cff','#3d1e9e'], ['#ff3d7f','#7a0f3d'], ['#00d4ff','#0a4f7a'], ['#9dff3d','#2d6b00'],
  ['#ffc93d','#8a5a00'], ['#ff6b3d','#8a2600'], ['#3dffb0','#046b52'], ['#c93dff','#5a0a8a'],
  ['#ff3d3d','#7a0f0f'], ['#3d7cff','#0f2f7a'], ['#ffd9a0','#8a5f2d'], ['#6bffea','#046b6b']
];
function pal(id){ return PALS[hash(id) % PALS.length]; }

function toast(msg){
  var t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}

/* ---------- البطاقات ---------- */
function cardHTML(g){
  var p = pal(g.id), isFav = ST.fav.indexOf(g.id) >= 0;
  var cat = CATMAP[g.c] || ['', '', '🎮'];
  var badge = g.n >= GAMES.length - 24 ? '<span class="badge new">جديد</span>'
            : (ST.plays[g.id] > 2 ? '<span class="badge hot">تلعبها كثيراً</span>' : '');
  return '<button class="card" data-id="' + g.id + '">' + badge +
    '<span class="fav-b' + (isFav ? ' on' : '') + '" data-fav="' + g.id + '">' + (isFav ? '❤️' : '🤍') + '</span>' +
    '<div class="thumb" style="background:linear-gradient(140deg,' + p[0] + ',' + p[1] + ')"><span>' + g.e + '</span></div>' +
    '<div class="meta"><h3>' + g.t + '</h3><small>' + cat[2] + ' ' + cat[1] + '</small></div></button>';
}
function gridHTML(list){
  if(!list.length) return '<div class="empty"><div>🕳️</div>لا توجد ألعاب هنا… جرّب بحثاً آخر.</div>';
  return '<div class="grid">' + list.map(cardHTML).join('') + '</div>';
}
function rowHTML(title, list, icon){
  if(!list.length) return '';
  return '<div class="row-h"><h2>' + (icon ? icon + ' ' : '') + title + '</h2><span class="n">' + list.length + '</span></div>' +
    '<div class="rail">' + list.map(cardHTML).join('') + '</div>';
}

/* ---------- البحث والتصفية ---------- */
function matches(g, q){
  if(!q) return true;
  q = q.trim().toLowerCase();
  var cat = CATMAP[g.c] || ['', '', ''];
  var hay = (g.t + ' ' + (g.d || '') + ' ' + (g.tags || []).join(' ') + ' ' + cat[1] + ' ' + g.id).toLowerCase();
  return q.split(/\s+/).every(function(w){ return hay.indexOf(w) >= 0; });
}
function byId(id){ for(var i = 0; i < GAMES.length; i++) if(GAMES[i].id === id) return GAMES[i]; return null; }
function filtered(){
  var list = GAMES.filter(function(g){ return matches(g, ST.q); });
  if(ST.cat === '__fav') list = list.filter(function(g){ return ST.fav.indexOf(g.id) >= 0; });
  else if(ST.cat === '__recent'){
    list = ST.recent.map(byId).filter(function(g){ return g && matches(g, ST.q); });
  }
  else if(ST.cat !== 'all') list = list.filter(function(g){ return g.c === ST.cat || (g.tags || []).indexOf(ST.cat) >= 0; });
  return list;
}

/* ---------- عرض الصفحة ---------- */
function render(){
  var c = $('#content'), list = filtered();
  if(ST.q || ST.cat !== 'all'){
    var name = ST.cat === '__fav' ? 'المفضلة' : ST.cat === '__recent' ? 'لعبت مؤخراً'
             : ST.cat === 'all' ? 'نتائج البحث' : (CATMAP[ST.cat] ? CATMAP[ST.cat][1] : '');
    c.innerHTML = '<div class="row-h"><h2>' + name + '</h2><span class="n">' + list.length + '</span></div>' + gridHTML(list);
  } else {
    var pop = GAMES.slice().sort(function(a, b){ return (ST.plays[b.id] || 0) - (ST.plays[a.id] || 0); });
    var played = pop.filter(function(g){ return ST.plays[g.id]; }).slice(0, 14);
    var rec = ST.recent.map(byId).filter(Boolean).slice(0, 14);
    var pick = function(cat, n){ return GAMES.filter(function(g){ return g.c === cat; }).slice(0, n || 14); };
    var newest = GAMES.slice(-16).reverse();
    var h = '';
    h += rowHTML('أكمل اللعب', rec, '🕒');
    h += rowHTML('الأكثر لعباً عندك', played, '🔥');
    h += rowHTML('أفكار لم ترها من قبل', pick('weird', 16), '🛸');
    h += rowHTML('ألعاب مضحكة', pick('funny', 16), '😂');
    h += rowHTML('ألعاب مزعجة عمداً', pick('annoy', 16), '😤');
    h += rowHTML('ألعاب تُغضبك', pick('rage', 16), '🤬');
    h += rowHTML('وصلت حديثاً', newest, '✨');
    h += '<div class="row-h"><h2>🎮 كل الألعاب</h2><span class="n">' + GAMES.length + '</span></div>' + gridHTML(GAMES);
    c.innerHTML = h;
  }
  $('#cFav').textContent = ST.fav.length;
  $('#cRec').textContent = ST.recent.length;
}
function buildSidebar(){
  var counts = {};
  GAMES.forEach(function(g){ counts[g.c] = (counts[g.c] || 0) + 1; });
  $('#catList').innerHTML = CATS.filter(function(c){ return counts[c[0]]; }).map(function(c){
    return '<button class="cat" data-cat="' + c[0] + '"><i>' + c[2] + '</i>' + c[1] + '<b>' + counts[c[0]] + '</b></button>';
  }).join('');
  $('#chips').innerHTML = '<button class="chip on" data-cat="all">الكل</button>' +
    CATS.filter(function(c){ return counts[c[0]]; }).map(function(c){
      return '<button class="chip" data-cat="' + c[0] + '">' + c[2] + ' ' + c[1] + '</button>'; }).join('');
  $('#cAll').textContent = GAMES.length;
  $('#gCount').textContent = GAMES.length;
}
function setCat(cat){
  ST.cat = cat;
  $$('.cat').forEach(function(b){ b.classList.toggle('on', b.dataset.cat === cat); });
  $$('.chip').forEach(function(b){ b.classList.toggle('on', b.dataset.cat === cat); });
  render();
  $('#main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  closeSide();
}
function toggleFav(id){
  var i = ST.fav.indexOf(id);
  if(i >= 0){ ST.fav.splice(i, 1); toast('أُزيلت من المفضلة'); }
  else { ST.fav.push(id); toast('أُضيفت للمفضلة ❤️'); }
  save('mg_fav', ST.fav);
  $$('[data-fav="' + id + '"]').forEach(function(el){
    el.classList.toggle('on', ST.fav.indexOf(id) >= 0);
    el.textContent = ST.fav.indexOf(id) >= 0 ? '❤️' : '🤍';
  });
  if(ST.cur === id) $('#pFav').textContent = ST.fav.indexOf(id) >= 0 ? '❤️' : '🤍';
  if(ST.cat === '__fav') render();
  $('#cFav').textContent = ST.fav.length;
}

/* ---------- المحرّك والحلقة ---------- */
var cv = $('#cv'), ENG = new Engine(cv), lastT = 0, raf = 0;
function loop(t){
  raf = requestAnimationFrame(loop);
  var dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
  if(ENG.running) ENG.step(dt);
}
requestAnimationFrame(function(t){ lastT = t; loop(t); });

var UI = {
  gameOver: function(title, sub, win){
    $('#ovTitle').textContent = title;
    $('#ovTitle').style.color = win ? 'var(--lime)' : 'var(--hot)';
    $('#ovSub').textContent = sub || '';
    var g = byId(ST.cur), sc = Math.round(ENG.score);
    var b = ST.best[ST.cur] || 0, rec = sc > b;
    if(rec && sc > 0){ ST.best[ST.cur] = sc; save('mg_best', ST.best); }
    $('#ovScore').innerHTML = (g && g.noScore) ? '' :
      'النتيجة <b>' + sc + '</b>' + (rec && sc > 0 ? ' <span style="color:var(--lime)">رقم قياسي جديد! 🏆</span>' :
        (b ? ' · الأفضل ' + Math.max(b, sc) : ''));
    $('#sBest').textContent = ST.best[ST.cur] || '—';
    $('#ov').classList.add('show');
  }
};

function openGame(id, push){
  var g = byId(id); if(!g) return;
  ST.cur = id;
  ST.plays[id] = (ST.plays[id] || 0) + 1; save('mg_plays', ST.plays);
  ST.recent = [id].concat(ST.recent.filter(function(x){ return x !== id; })).slice(0, 30); save('mg_recent', ST.recent);
  var cat = CATMAP[g.c] || ['', '', ''];
  $('#pTitle').textContent = g.t;
  $('#pTag').textContent = cat[2] + ' ' + cat[1];
  $('#sTitle').textContent = g.t;
  $('#sDesc').textContent = g.d || '';
  $('#sHow').textContent = g.how || 'اللمس / الفأرة';
  $('#sBest').textContent = ST.best[id] || '—';
  $('#sPlays').textContent = ST.plays[id];
  $('#sTags').innerHTML = '<span class="pill">' + cat[1] + '</span>' +
    (g.tags || []).map(function(t){ return '<span class="pill">' + (CATMAP[t] ? CATMAP[t][1] : t) + '</span>'; }).join('');
  $('#pFav').textContent = ST.fav.indexOf(id) >= 0 ? '❤️' : '🤍';
  var sim = GAMES.filter(function(x){ return x.c === g.c && x.id !== id; }).sort(function(){ return Math.random() - .5; }).slice(0, 4);
  $('#sMore').innerHTML = sim.map(cardHTML).join('');
  $('#hint').textContent = g.how || '';
  $('#hint').classList.remove('gone');
  setTimeout(function(){ $('#hint').classList.add('gone'); }, 4200);
  $('#ov').classList.remove('show');
  $('#pad').classList.toggle('show', !g.noPad);
  $('#play').classList.add('open');
  document.body.classList.add('playing');
  ac();
  ENG.load(g, ST.best[id] || 0);
  if(push !== false) location.hash = '#/g/' + id;
  render();
}
function closeGame(){
  ENG.stop(); ST.cur = null;
  $('#play').classList.remove('open');
  document.body.classList.remove('playing');
  if(location.hash.indexOf('#/g/') === 0) location.hash = '#/';
}
function restart(){ if(ST.cur){ $('#ov').classList.remove('show'); ENG.load(byId(ST.cur), ST.best[ST.cur] || 0); } }
function randomGame(){ openGame(GAMES[(Math.random() * GAMES.length) | 0].id); }

/* ---------- الأحداث ---------- */
document.addEventListener('click', function(e){
  var fav = e.target.closest('[data-fav]');
  if(fav){ e.stopPropagation(); e.preventDefault(); toggleFav(fav.dataset.fav); return; }
  var card = e.target.closest('.card');
  if(card){ openGame(card.dataset.id); return; }
  var cat = e.target.closest('[data-cat]');
  if(cat){ setCat(cat.dataset.cat); return; }
});
$('#q').addEventListener('input', function(e){
  ST.q = e.target.value;
  if(ST.q && ST.cat !== 'all' && ST.cat.indexOf('__') !== 0) setCat('all'); else render();
});
$('#randBtn').onclick = randomGame;
$('#heroRand').onclick = randomGame;
$('#heroPlay').onclick = function(){ var r = ST.recent[0]; openGame(r && byId(r) ? r : GAMES[0].id); };
$('#favBtn').onclick = function(){ setCat('__fav'); };
$('#backBtn').onclick = closeGame;
$('#restartBtn').onclick = restart;
$('#ovBtn').onclick = restart;
$('#ovNext').onclick = randomGame;
$('#pFav').onclick = function(){ toggleFav(ST.cur); };
$('#soundBtn').onclick = function(){
  MUTED = !MUTED; save('mg_mute', MUTED);
  $('#soundBtn').textContent = MUTED ? '🔇' : '🔊';
  if(!MUTED){ ac(); SFX.blip(); }
};
$('#soundBtn').textContent = MUTED ? '🔇' : '🔊';
$('#fsBtn').onclick = function(){
  var el = $('#play');
  if(!document.fullscreenElement){ (el.requestFullscreen || el.webkitRequestFullscreen || function(){}).call(el); }
  else document.exitFullscreen();
};
function openSide(){ $('#side').classList.add('open'); $('#mask').classList.add('show'); }
function closeSide(){ $('#side').classList.remove('open'); $('#mask').classList.remove('show'); }
$('#menuBtn').onclick = function(){ $('#side').classList.contains('open') ? closeSide() : openSide(); };
$('#mask').onclick = closeSide;

/* لوحة المفاتيح */
window.addEventListener('keydown', function(e){
  if(e.target.tagName === 'INPUT') return;
  if(!$('#play').classList.contains('open')){
    if(e.key === '/' ){ e.preventDefault(); $('#q').focus(); }
    return;
  }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter'].indexOf(e.key) >= 0) e.preventDefault();
  if(e.key === 'Escape'){ closeGame(); return; }
  if(e.key === 'r' || e.key === 'R'){ restart(); return; }
  if(!ENG.keys[e.key]) ENG.hitKeys[e.key] = true;
  ENG.keys[e.key] = true;
  if(ENG.g && ENG.g.key && !ENG.ended) ENG.g.key(e.key, true);
  ac();
});
window.addEventListener('keyup', function(e){
  ENG.keys[e.key] = false;
  if(ENG.g && ENG.g.key) ENG.g.key(e.key, false);
});
/* لوحة اللمس */
$$('#pad button').forEach(function(b){
  var k = b.dataset.k;
  var on = function(e){ e.preventDefault(); ac(); if(!ENG.keys[k]) ENG.hitKeys[k] = true; ENG.keys[k] = true;
    if(ENG.g && ENG.g.key && !ENG.ended) ENG.g.key(k, true); };
  var off = function(e){ e.preventDefault(); ENG.keys[k] = false; if(ENG.g && ENG.g.key) ENG.g.key(k, false); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
/* المؤشّر على اللوحة */
function pos(e){
  var r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * 800, y: (e.clientY - r.top) / r.height * 600 };
}
cv.addEventListener('pointerdown', function(e){
  e.preventDefault(); cv.setPointerCapture(e.pointerId); ac();
  var p = pos(e); ENG.m.x = p.x; ENG.m.y = p.y; ENG.m.px = p.x; ENG.m.py = p.y; ENG.m.down = true;
  if(ENG.g && ENG.g.down && !ENG.ended) ENG.g.down(p.x, p.y);
});
cv.addEventListener('pointermove', function(e){
  var p = pos(e);
  ENG.m.dx = p.x - ENG.m.x; ENG.m.dy = p.y - ENG.m.y;
  ENG.m.x = p.x; ENG.m.y = p.y;
  if(ENG.g && ENG.g.move && !ENG.ended) ENG.g.move(p.x, p.y);
});
window.addEventListener('pointerup', function(e){
  if(!ENG.m.down) return;
  var p = pos(e); ENG.m.down = false;
  if(ENG.g && ENG.g.up && !ENG.ended) ENG.g.up(p.x, p.y);
});
cv.addEventListener('contextmenu', function(e){ e.preventDefault(); });

/* التوجيه */
function route(){
  var h = location.hash;
  if(h.indexOf('#/g/') === 0){
    var id = h.slice(4);
    if(id !== ST.cur && byId(id)) openGame(id, false);
  } else if(ST.cur) closeGame();
}
window.addEventListener('hashchange', route);

/* الإقلاع */
buildSidebar();
render();
route();
console.log('%c🎮 مجنون ألعاب — ' + GAMES.length + ' لعبة محمّلة', 'color:#9dff3d;font-weight:bold');
