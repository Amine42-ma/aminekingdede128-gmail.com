/* ================= محرّك الألعاب ================= */
var GAMES = [];
function G(def){ def.n = GAMES.length; GAMES.push(def); }

var CATS = [
  ['action','أكشن','⚔️'], ['arcade','آركيد','👾'], ['puzzle','ألغاز','🧩'],
  ['brain','تفكير','🧠'], ['skill','مهارة ودقّة','🎯'], ['speed','سرعة','⚡'],
  ['memory','ذاكرة','🃏'], ['physics','فيزياء','🍎'], ['race','سباق','🏎️'],
  ['shoot','إطلاق نار','🔫'], ['sport','رياضة','⚽'], ['board','ألواح','♟️'],
  ['luck','حظّ وبطاقات','🎴'], ['words','كلمات','🔤'], ['math','أرقام','🔢'],
  ['music','موسيقى','🎵'], ['funny','مضحكة','😂'], ['annoy','مزعجة','😤'],
  ['rage','عصبية','🤬'], ['weird','أفكار غير موجودة','🛸'], ['two','لاعبان','👥'],
  ['kids','عائلية','🧸']
];
var CATMAP = {}; CATS.forEach(function(c){ CATMAP[c[0]] = c; });

/* ---- الصوت ---- */
var AC = null, MUTED = false;
function ac(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } 
  if(AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type, vol, slide){
  if(MUTED) return; var a = ac(); if(!a) return;
  var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime((vol == null ? .18 : vol), t + .008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
}
function noise(d, vol, hp, sweep){
  if(MUTED) return; var a = ac(); if(!a) return;
  var n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
  for(var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  var src = a.createBufferSource(); src.buffer = b;
  var f = a.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass';
  f.frequency.setValueAtTime(hp || 1200, a.currentTime);
  if(sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), a.currentTime + d);
  var g = a.createGain(); g.gain.setValueAtTime(vol == null ? .2 : vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d);
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}
var SFX = {
  blip:  function(){ tone(660, .07, 'square', .13); },
  tick:  function(){ tone(1400, .03, 'square', .07); },
  coin:  function(){ tone(988, .07, 'square', .14); setTimeout(function(){ tone(1319, .12, 'square', .12); }, 60); },
  jump:  function(){ tone(320, .15, 'square', .14, 720); },
  hit:   function(){ tone(180, .12, 'sawtooth', .16, 70); },
  boom:  function(){ noise(.45, .3, 0, 60); tone(90, .35, 'sawtooth', .16, 35); },
  laser: function(){ tone(1200, .12, 'sawtooth', .1, 200); },
  pop:   function(){ tone(520, .06, 'sine', .17, 900); },
  power: function(){ [523, 659, 784, 1047].forEach(function(f, i){ setTimeout(function(){ tone(f, .1, 'square', .12); }, i * 55); }); },
  win:   function(){ [523, 659, 784, 1047, 1319].forEach(function(f, i){ setTimeout(function(){ tone(f, .16, 'triangle', .15); }, i * 90); }); },
  lose:  function(){ [392, 330, 262, 196].forEach(function(f, i){ setTimeout(function(){ tone(f, .2, 'sawtooth', .14); }, i * 110); }); },
  buzz:  function(){ tone(110, .3, 'sawtooth', .13); },
  alarm: function(){ tone(880, .1, 'square', .12); setTimeout(function(){ tone(660, .12, 'square', .12); }, 110); },
  swish: function(){ noise(.16, .12, 900, 3000); },
  thud:  function(){ noise(.14, .25, 0, 90); },
  fart:  function(){ var a = ac(); if(!a || MUTED) return; var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
           o.type = 'sawtooth'; o.frequency.setValueAtTime(160, t);
           o.frequency.linearRampToValueAtTime(60, t + .32);
           var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 26; lg.gain.value = 45;
           lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + .35);
           g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.0001, t + .34);
           o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .35); },
  burp:  function(){ var a = ac(); if(!a || MUTED) return; var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
           o.type = 'square'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(150, t + .4);
           var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 14; lg.gain.value = 60;
           lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + .42);
           g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.0001, t + .42);
           o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .43); },
  sneeze:function(){ noise(.12, .1, 2000); setTimeout(function(){ noise(.3, .34, 300, 4000); }, 220); },
  note:  function(f){ tone(f || 440, .22, 'triangle', .15); }
};

/* ---- الجسيمات ---- */
function Particles(){ this.a = []; }
Particles.prototype.burst = function(x, y, col, n, spd){
  n = n || 14; spd = spd || 200;
  for(var i = 0; i < n; i++){
    var an = Math.random() * 6.283, s = spd * (.3 + Math.random());
    this.a.push({ x: x, y: y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, l: .4 + Math.random() * .5, m: .4 + Math.random() * .5,
      c: (col && col.pop) ? col[(Math.random() * col.length) | 0] : (col || '#fff'), r: 2 + Math.random() * 3, g: 1 });
  }
};
Particles.prototype.rise = function(x, y, col, n){
  n = n || 8;
  for(var i = 0; i < n; i++) this.a.push({ x: x + (Math.random() - .5) * 20, y: y, vx: (Math.random() - .5) * 40,
    vy: -30 - Math.random() * 60, l: .7, m: .7, c: col || '#fff', r: 2 + Math.random() * 4, g: -.15 });
};
Particles.prototype.step = function(dt, c){
  for(var i = this.a.length - 1; i >= 0; i--){
    var p = this.a[i]; p.l -= dt; if(p.l <= 0){ this.a.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt * p.g; p.vx *= .99;
    c.globalAlpha = Math.max(0, p.l / p.m); c.fillStyle = p.c;
    c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill();
  }
  c.globalAlpha = 1;
};

/* ---- المحرّك ---- */
function Engine(canvas){
  var E = this;
  E.cv = canvas; E.c = canvas.getContext('2d');
  E.W = 800; E.H = 600;
  E.keys = {}; E.hitKeys = {};
  E.m = { x: 400, y: 300, down: false, px: 400, py: 300, dx: 0, dy: 0 };
  E.P = new Particles();
  E.score = 0; E.best = 0; E.time = 0; E.shakeAmt = 0; E.paused = false;
  E.g = null; E.def = null; E.running = false; E.ended = false;
}
Engine.prototype.load = function(def, best){
  var E = this;
  E.def = def; E.score = 0; E.best = best || 0; E.time = 0; E.ended = false;
  E.paused = false; E.shakeAmt = 0; E.P.a = []; E.keys = {}; E.hitKeys = {};
  E.c.setTransform(1, 0, 0, 1, 0, 0);
  E.g = def.make(E);
  E.running = true;
};
Engine.prototype.stop = function(){ this.running = false; this.g = null; };
Engine.prototype.step = function(dt){
  var E = this, c = E.c;
  if(!E.g) return;
  E.time += dt;
  c.setTransform(1, 0, 0, 1, 0, 0);
  if(!E.paused && !E.ended && E.g.update) E.g.update(dt);
  if(E.shakeAmt > 0){
    E.shakeAmt = Math.max(0, E.shakeAmt - dt * 40);
    c.translate((Math.random() - .5) * E.shakeAmt, (Math.random() - .5) * E.shakeAmt);
  }
  if(E.g.draw) E.g.draw(c);
  E.P.step(dt, c);
  E.hitKeys = {};
  E.m.dx = 0; E.m.dy = 0;
};
/* اختصارات الرسم */
var EP = Engine.prototype;
EP.bg   = function(col){ var c = this.c; c.fillStyle = col || '#0a0c14'; c.fillRect(-40, -40, this.W + 80, this.H + 80); };
EP.sky  = function(a, b){ var c = this.c, g = c.createLinearGradient(0, 0, 0, this.H); g.addColorStop(0, a); g.addColorStop(1, b);
                          c.fillStyle = g; c.fillRect(-40, -40, this.W + 80, this.H + 80); };
EP.r    = function(x, y, w, h, col){ var c = this.c; c.fillStyle = col; c.fillRect(x, y, w, h); };
EP.sr   = function(x, y, w, h, col, lw){ var c = this.c; c.strokeStyle = col; c.lineWidth = lw || 2; c.strokeRect(x, y, w, h); };
EP.rr   = function(x, y, w, h, rad, col){ var c = this.c; c.fillStyle = col; c.beginPath();
            if(c.roundRect) c.roundRect(x, y, w, h, rad); else c.rect(x, y, w, h); c.fill(); };
EP.o    = function(x, y, r, col){ var c = this.c; c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, 6.283); c.fill(); };
EP.ring = function(x, y, r, col, lw){ var c = this.c; c.strokeStyle = col; c.lineWidth = lw || 2; c.beginPath();
            c.arc(x, y, Math.max(0, r), 0, 6.283); c.stroke(); };
EP.arc  = function(x, y, r, a0, a1, col, lw){ var c = this.c; c.strokeStyle = col; c.lineWidth = lw || 2; c.beginPath();
            c.arc(x, y, Math.max(0, r), a0, a1); c.stroke(); };
EP.ln   = function(x1, y1, x2, y2, col, lw){ var c = this.c; c.strokeStyle = col; c.lineWidth = lw || 2; c.lineCap = 'round';
            c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
EP.poly = function(pts, col, stroke, lw){ var c = this.c; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
            for(var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath();
            if(stroke){ c.strokeStyle = col; c.lineWidth = lw || 2; c.stroke(); } else { c.fillStyle = col; c.fill(); } };
EP.tx   = function(s, x, y, size, col, align, weight){
            var c = this.c; c.fillStyle = col || '#fff';
            c.font = (weight || 700) + ' ' + (size || 20) + 'px "Noto Sans Arabic",Tahoma,system-ui,sans-serif';
            c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); };
EP.emo  = function(s, x, y, size){ var c = this.c; c.font = (size || 30) + 'px serif'; c.textAlign = 'center';
            c.textBaseline = 'middle'; c.fillText(s, x, y); };
EP.spr  = function(s, x, y, size, rot){ var c = this.c; c.save(); c.translate(x, y); if(rot) c.rotate(rot);
            c.font = (size || 30) + 'px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
EP.hud  = function(txt, col){ this.tx(txt, this.W - 16, 24, 20, col || '#fff', 'right', 800); };
EP.hudL = function(txt, col){ this.tx(txt, 16, 24, 20, col || '#fff', 'left', 800); };
EP.alpha= function(a, fn){ var c = this.c; var o = c.globalAlpha; c.globalAlpha = a; fn(); c.globalAlpha = o; };
EP.grid = function(step, col){ var c = this.c; c.strokeStyle = col; c.lineWidth = 1; c.beginPath();
            for(var x = 0; x <= this.W; x += step){ c.moveTo(x, 0); c.lineTo(x, this.H); }
            for(var y = 0; y <= this.H; y += step){ c.moveTo(0, y); c.lineTo(this.W, y); } c.stroke(); };
/* أدوات */
EP.rnd  = function(a, b){ if(b === undefined){ b = a; a = 0; } return a + Math.random() * (b - a); };
EP.ri   = function(a, b){ return Math.floor(this.rnd(a, b + 1)); };
EP.pick = function(arr){ return arr[(Math.random() * arr.length) | 0]; };
EP.cl   = function(v, a, b){ return v < a ? a : (v > b ? b : v); };
EP.lerp = function(a, b, t){ return a + (b - a) * t; };
EP.dist = function(x1, y1, x2, y2){ var a = x1 - x2, b = y1 - y2; return Math.sqrt(a * a + b * b); };
EP.hit  = function(a, b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
EP.hitc = function(a, b){ return this.dist(a.x, a.y, b.x, b.y) < (a.r + b.r); };
EP.k    = function(key){ return !!this.keys[key]; };
EP.kx   = function(){ return (this.keys.ArrowRight || this.keys.d || this.keys.D ? 1 : 0) - (this.keys.ArrowLeft || this.keys.a || this.keys.A ? 1 : 0); };
EP.ky   = function(){ return (this.keys.ArrowDown || this.keys.s || this.keys.S ? 1 : 0) - (this.keys.ArrowUp || this.keys.w || this.keys.W ? 1 : 0); };
EP.tap  = function(key){ return !!this.hitKeys[key]; };
EP.anyTap = function(){ for(var k in this.hitKeys) return true; return false; };
EP.s    = function(name, a){ var f = SFX[name]; if(f) f(a); };
EP.shake= function(n){ this.shakeAmt = Math.max(this.shakeAmt, n || 10); };
EP.burst= function(x, y, col, n, spd){ this.P.burst(x, y, col, n, spd); };
EP.rise = function(x, y, col, n){ this.P.rise(x, y, col, n); };
EP.add  = function(n){ this.score += n; };
EP.setScore = function(n){ this.score = n; };
EP.over = function(title, sub){ if(this.ended) return; this.ended = true; this.s('lose'); UI.gameOver(title || 'انتهت اللعبة', sub || '', false); };
EP.won  = function(title, sub){ if(this.ended) return; this.ended = true; this.s('win'); UI.gameOver(title || 'فزت! 🎉', sub || '', true); };
EP.note = function(f, d, type, v){ tone(f, d || .2, type || 'triangle', v == null ? .14 : v); };
EP.tone = tone; EP.noise = noise;
