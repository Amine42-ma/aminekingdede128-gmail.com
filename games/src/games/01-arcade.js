/* ============ 1) آركيد وأكشن ============ */

G({id:'snake-mutant', t:'أفعى الطفرات', c:'arcade', e:'🐍', tags:['كلاسيكي','سرعة'],
d:'أفعى كلاسيكية لكن كل طعام يغيّر قواعد اللعبة: يسرّعك، يعكس أزرارك، أو يقصّرك.',
how:'الأسهم أو اسحب على الشاشة',
make:function(E){
  var CS=40, CW=20, CH=15, s, dir, nd, food, t, step, rev, msg, mt;
  function reset(){ s=[{x:9,y:7},{x:8,y:7},{x:7,y:7}]; dir={x:1,y:0}; nd={x:1,y:0};
    t=0; step=.16; rev=0; msg=''; mt=0; spawn(); }
  function spawn(){ var k=['grow','fast','slow','rev','short']; 
    do{ food={x:E.ri(0,CW-1), y:E.ri(0,CH-1), k:E.pick(k)}; }while(s.some(function(c){return c.x===food.x&&c.y===food.y;})); }
  reset();
  var FC={grow:'#9dff3d',fast:'#ff3d7f',slow:'#00d4ff',rev:'#c93dff',short:'#ffc93d'};
  var FE={grow:'🍎',fast:'🌶️',slow:'🧊',rev:'🌀',short:'✂️'};
  function setd(x,y){ if(rev>0){x=-x;y=-y;} if(dir.x!==-x||dir.y!==-y) nd={x:x,y:y}; }
  return {
  key:function(k){ if(k==='ArrowLeft')setd(-1,0); if(k==='ArrowRight')setd(1,0); if(k==='ArrowUp')setd(0,-1); if(k==='ArrowDown')setd(0,1); },
  down:function(x,y){ this._sx=x; this._sy=y; },
  up:function(x,y){ var dx=x-this._sx, dy=y-this._sy; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy)) setd(dx>0?1:-1,0); else setd(0,dy>0?1:-1); },
  update:function(dt){
    t+=dt; if(rev>0)rev-=dt; if(mt>0)mt-=dt;
    if(t<step)return; t=0; dir=nd;
    var h={x:s[0].x+dir.x, y:s[0].y+dir.y};
    if(h.x<0||h.y<0||h.x>=CW||h.y>=CH) return E.over('ارتطمت بالجدار','الأفعى لا تعرف الحيطان');
    if(s.some(function(c){return c.x===h.x&&c.y===h.y;})) return E.over('أكلت نفسك','هذا مؤلم بصراحة');
    s.unshift(h);
    if(h.x===food.x&&h.y===food.y){
      E.add(10); E.s('coin'); E.burst(h.x*CS+20,h.y*CS+20,[FC[food.k],'#fff'],14);
      if(food.k==='grow'){ s.push({x:s[s.length-1].x,y:s[s.length-1].y}); msg='+طول'; }
      if(food.k==='fast'){ step=Math.max(.05,step-.02); msg='أسرع! 🌶️'; }
      if(food.k==='slow'){ step=Math.min(.24,step+.03); msg='أبطأ 🧊'; }
      if(food.k==='rev'){ rev=6; msg='الأزرار معكوسة! 🌀'; E.s('buzz'); }
      if(food.k==='short'){ s.splice(Math.max(3,s.length-3)); msg='قُصصت ✂️'; }
      mt=1.6; spawn();
    } else s.pop();
  },
  draw:function(c){
    E.bg('#0c1018'); E.grid(CS,'rgba(255,255,255,.04)');
    E.spr(FE[food.k], food.x*CS+20, food.y*CS+20, 30);
    for(var i=s.length-1;i>=0;i--){
      var p=s[i], f=i/s.length;
      E.rr(p.x*CS+3,p.y*CS+3,CS-6,CS-6,9, i===0?'#eaffd0':'hsl('+(100-f*60)+',70%,'+(55-f*18)+'%)');
    }
    var hd=s[0];
    E.o(hd.x*CS+20+dir.x*7-(dir.y?6:0), hd.y*CS+20+dir.y*7-(dir.x?6:0),3,'#111');
    E.o(hd.x*CS+20+dir.x*7+(dir.y?6:0), hd.y*CS+20+dir.y*7+(dir.x?6:0),3,'#111');
    E.hud('النتيجة '+E.score); E.hudL('الطول '+s.length,'#9dff3d');
    if(mt>0) E.tx(msg,400,60,26,rev>0?'#c93dff':'#ffc93d');
  }};
}});

G({id:'brick-storm', t:'عاصفة الطوب', c:'arcade', e:'🧱', tags:['كلاسيكي','مهارة'],
d:'كسر الطوب، لكن بعض الطوب يطلق النار عليك وبعضه يُسقط قدرات.',
how:'حرّك الفأرة أو الأسهم',
make:function(E){
  var pad,ball,br,pw,lives,drops,shots,lvl;
  function build(){ br=[]; for(var y=0;y<5;y++)for(var x=0;x<10;x++){
    var hp=(y<1?3:y<3?2:1); br.push({x:60+x*68,y:70+y*32,w:62,h:26,hp:hp,g:Math.random()<.14});} }
  function reset(){ pw=120; pad={x:340,y:540,w:pw,h:14}; lives=3; lvl=1; drops=[]; shots=[];
    ball={x:400,y:500,vx:E.pick([-1,1])*220,vy:-280,r:9}; build(); }
  reset();
  var COL=['#5a6280','#ff3d7f','#ffc93d','#9dff3d'];
  return {
  move:function(x){ pad.x=E.cl(x-pad.w/2,0,800-pad.w); },
  update:function(dt){
    if(E.kx()) pad.x=E.cl(pad.x+E.kx()*520*dt,0,800-pad.w);
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
    if(ball.x<ball.r){ball.x=ball.r;ball.vx*=-1;E.s('blip');}
    if(ball.x>800-ball.r){ball.x=800-ball.r;ball.vx*=-1;E.s('blip');}
    if(ball.y<ball.r){ball.y=ball.r;ball.vy*=-1;E.s('blip');}
    if(ball.y>620){ lives--; E.s('lose'); E.shake(14);
      if(lives<=0) return E.over('انتهت المحاولات','وصلت للمستوى '+lvl);
      ball={x:400,y:500,vx:E.pick([-1,1])*220,vy:-280,r:9}; }
    if(ball.vy>0 && ball.y>pad.y-ball.r && ball.y<pad.y+20 && ball.x>pad.x && ball.x<pad.x+pad.w){
      ball.vy=-Math.abs(ball.vy); var d=(ball.x-(pad.x+pad.w/2))/(pad.w/2);
      ball.vx=d*300; E.s('pop'); }
    for(var i=br.length-1;i>=0;i--){ var b=br[i];
      if(ball.x>b.x-ball.r&&ball.x<b.x+b.w+ball.r&&ball.y>b.y-ball.r&&ball.y<b.y+b.h+ball.r){
        b.hp--; E.s('hit'); E.burst(ball.x,ball.y,[COL[b.hp+1]||'#fff'],8,150);
        if(Math.abs(ball.x-(b.x+b.w/2))/b.w > Math.abs(ball.y-(b.y+b.h/2))/b.h) ball.vx*=-1; else ball.vy*=-1;
        if(b.hp<=0){ E.add(10*lvl); if(b.g) drops.push({x:b.x+b.w/2,y:b.y,t:E.pick(['big','small','multi'])}); br.splice(i,1); }
        break; } }
    if(!br.length){ lvl++; build(); ball.vx*=1.1; ball.vy=-Math.abs(ball.vy)*1.1; E.s('win'); E.add(100); }
    br.forEach(function(b){ if(b.hp===3&&Math.random()<.0012) shots.push({x:b.x+b.w/2,y:b.y+b.h,v:220}); });
    for(var j=shots.length-1;j>=0;j--){ var sh=shots[j]; sh.y+=sh.v*dt;
      if(sh.y>600) shots.splice(j,1);
      else if(sh.y>pad.y&&sh.x>pad.x&&sh.x<pad.x+pad.w){ shots.splice(j,1); pad.w=Math.max(50,pad.w-18); E.s('buzz'); E.shake(8); } }
    for(var k=drops.length-1;k>=0;k--){ var d2=drops[k]; d2.y+=150*dt;
      if(d2.y>600) drops.splice(k,1);
      else if(d2.y>pad.y-10&&d2.x>pad.x&&d2.x<pad.x+pad.w){
        if(d2.t==='big')pad.w=Math.min(240,pad.w+40); if(d2.t==='small')pad.w=Math.max(50,pad.w-30);
        if(d2.t==='multi'){ ball.vx*=1.15; ball.vy*=1.15; } E.s('power'); E.add(25); drops.splice(k,1); } }
  },
  draw:function(c){
    E.sky('#141a2e','#080a12');
    br.forEach(function(b){ E.rr(b.x,b.y,b.w,b.h,6,COL[b.hp]||'#888');
      if(b.g) E.tx('★',b.x+b.w/2,b.y+b.h/2,14,'#000'); });
    drops.forEach(function(d){ E.o(d.x,d.y,7,d.t==='small'?'#ff3d7f':'#9dff3d'); });
    shots.forEach(function(s){ E.r(s.x-2,s.y,4,12,'#ff5c5c'); });
    E.rr(pad.x,pad.y,pad.w,pad.h,7,'#00d4ff');
    E.o(ball.x,ball.y,ball.r,'#fff');
    E.hud('النتيجة '+E.score); E.hudL('❤️'.repeat(Math.max(0,lives))+'  مستوى '+lvl);
  }};
}});

G({id:'pong-mad', t:'بونغ المجنون', c:'sport', e:'🏓', tags:['كلاسيكي','two'],
d:'بونغ لكن المضرب يتقلّص كلما سجّلت، والكرة تنقسم أحياناً.',
how:'الفأرة أو ↑↓ · الخصم ذكي',
make:function(E){
  var p1,p2,balls,s1,s2,t;
  function reset(){ p1={y:250,h:110}; p2={y:250,h:110}; s1=0; s2=0; t=0; balls=[nb()]; }
  function nb(){ return {x:400,y:300,vx:E.pick([-1,1])*330,vy:E.rnd(-160,160),r:9}; }
  reset();
  return {
  move:function(x,y){ p1.y=E.cl(y-p1.h/2,0,600-p1.h); },
  update:function(dt){
    t+=dt;
    if(E.ky()) p1.y=E.cl(p1.y+E.ky()*520*dt,0,600-p1.h);
    var target=balls[0]; balls.forEach(function(b){ if(b.vx>0&&b.x>target.x)target=b; });
    var aim=target.y-p2.h/2 + Math.sin(t*3)*22;
    p2.y=E.cl(p2.y+E.cl(aim-p2.y,-1,1)*Math.min(340,Math.abs(aim-p2.y)*7)*dt,0,600-p2.h);
    for(var i=balls.length-1;i>=0;i--){ var b=balls[i];
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.y<b.r||b.y>600-b.r){ b.vy*=-1; b.y=E.cl(b.y,b.r,600-b.r); E.s('blip'); }
      if(b.vx<0&&b.x<40&&b.x>18&&b.y>p1.y&&b.y<p1.y+p1.h){ b.vx=Math.abs(b.vx)*1.05; b.vy+=(b.y-(p1.y+p1.h/2))*4; E.s('pop'); }
      if(b.vx>0&&b.x>760&&b.x<782&&b.y>p2.y&&b.y<p2.y+p2.h){ b.vx=-Math.abs(b.vx)*1.05; b.vy+=(b.y-(p2.y+p2.h/2))*4; E.s('pop'); }
      if(b.x<-20){ balls.splice(i,1); s2++; E.s('lose'); E.shake(10); p1.h=Math.min(150,p1.h+14); }
      else if(b.x>820){ balls.splice(i,1); s1++; E.add(10); E.s('coin'); p1.h=Math.max(46,p1.h-12); p2.h=Math.max(50,p2.h-6); }
    }
    if(!balls.length){ if(s2>=7) return E.over('خسرت '+s1+' — '+s2,'المضرب كان يكبر وما زلت تخسر');
      if(s1>=7) return E.won('فزت! '+s1+' — '+s2,'مضرب صغير وقلب كبير'); balls=[nb()]; }
    if(t>6 && balls.length===1 && Math.random()<dt*.3){ var b0=balls[0];
      balls.push({x:b0.x,y:b0.y,vx:b0.vx,vy:-b0.vy||120,r:9}); E.s('power'); }
  },
  draw:function(c){
    E.bg('#07090f');
    for(var y=10;y<600;y+=32) E.r(398,y,4,18,'rgba(255,255,255,.13)');
    E.rr(18,p1.y,14,p1.h,7,'#00d4ff'); E.rr(768,p2.y,14,p2.h,7,'#ff3d7f');
    balls.forEach(function(b){ E.o(b.x,b.y,b.r,'#fff'); });
    E.tx(s1,320,50,44,'#00d4ff'); E.tx(s2,480,50,44,'#ff3d7f');
  }};
}});

G({id:'invaders', t:'غزاة من كوكب مزعج', c:'shoot', e:'👾', tags:['كلاسيكي','أكشن'],
d:'غزاة ينزلون نحوك ويضحكون كلما أخطأت التصويب.',
how:'← → للحركة · مسافة للإطلاق',
make:function(E){
  var sh,al,bl,eb,dir,sp,wave,cd,shield;
  function build(){ al=[]; for(var y=0;y<4;y++)for(var x=0;x<9;x++)
    al.push({x:90+x*72,y:70+y*54,w:40,h:32,t:y}); dir=1; sp=28+wave*10; }
  function reset(){ sh={x:380,y:530,w:44}; bl=[]; eb=[]; wave=1; cd=0; shield=3; build(); }
  reset();
  var AE=['👾','👽','🛸','🤖'];
  return {
  update:function(dt){
    sh.x=E.cl(sh.x+E.kx()*380*dt,0,800-sh.w);
    cd-=dt;
    if((E.k(' ')||E.k('Enter')||E.m.down)&&cd<=0){ bl.push({x:sh.x+sh.w/2,y:sh.y}); cd=.28; E.s('laser'); }
    var lo=0,hit=false;
    al.forEach(function(a){ a.x+=dir*sp*dt; if(a.x<10||a.x>750)hit=true; lo=Math.max(lo,a.y); });
    if(hit){ dir*=-1; al.forEach(function(a){ a.y+=24; }); E.s('tick'); }
    if(lo>500) return E.over('وصلوا إليك','الموجة '+wave);
    al.forEach(function(a){ if(Math.random()<dt*.12) eb.push({x:a.x+20,y:a.y+30}); });
    for(var i=bl.length-1;i>=0;i--){ var b=bl[i]; b.y-=520*dt; if(b.y<0){bl.splice(i,1);continue;}
      for(var j=0;j<al.length;j++){ var a=al[j];
        if(b.x>a.x&&b.x<a.x+a.w&&b.y>a.y&&b.y<a.y+a.h){
          E.burst(a.x+20,a.y+16,['#9dff3d','#fff'],12); E.add((4-a.t)*10); E.s('boom');
          al.splice(j,1); bl.splice(i,1); break; } } }
    for(var k=eb.length-1;k>=0;k--){ var e2=eb[k]; e2.y+=260*dt;
      if(e2.y>600){eb.splice(k,1);continue;}
      if(e2.y>sh.y&&e2.x>sh.x&&e2.x<sh.x+sh.w){ eb.splice(k,1); shield--; E.shake(16); E.s('boom');
        if(shield<=0) return E.over('دُمّرت سفينتك','الموجة '+wave); } }
    if(!al.length){ wave++; E.add(150); E.s('win'); build(); }
  },
  draw:function(c){
    E.bg('#05070f');
    for(var i=0;i<40;i++){ var x=(i*97)%800, y=(i*211+E.time*14)%600; E.o(x,y,1,'rgba(255,255,255,.4)'); }
    al.forEach(function(a){ E.spr(AE[a.t],a.x+20,a.y+16,32, Math.sin(E.time*3+a.x*.02)*.15); });
    bl.forEach(function(b){ E.r(b.x-2,b.y-12,4,14,'#9dff3d'); });
    eb.forEach(function(b){ E.o(b.x,b.y,4,'#ff3d7f'); });
    E.spr('🚀',sh.x+22,sh.y+16,38,0);
    E.hud('النتيجة '+E.score); E.hudL('🛡️'.repeat(Math.max(0,shield))+'  موجة '+wave);
  }};
}});

G({id:'asteroid-drift', t:'انجراف الكويكبات', c:'action', e:'☄️', tags:['كلاسيكي','فضاء'],
d:'سفينة بقصور ذاتي حقيقي وسط صخور تنقسم كلما ضربتها.',
how:'← → للدوران · ↑ دفع · مسافة إطلاق',
make:function(E){
  var s,rocks,bs,inv;
  function mk(n,x,y,sz){ for(var i=0;i<n;i++) rocks.push({x:x==null?E.rnd(800):x, y:y==null?E.rnd(600):y,
    vx:E.rnd(-70,70), vy:E.rnd(-70,70), r:sz||46, a:E.rnd(6.28), va:E.rnd(-2,2)}); }
  function reset(){ s={x:400,y:300,vx:0,vy:0,a:-1.57,cd:0,lives:3}; rocks=[]; bs=[]; inv=2; mk(5); }
  reset();
  function wrap(o){ if(o.x<0)o.x+=800; if(o.x>800)o.x-=800; if(o.y<0)o.y+=600; if(o.y>600)o.y-=600; }
  return {
  update:function(dt){
    inv-=dt; s.cd-=dt;
    s.a+=E.kx()*3.4*dt;
    if(E.k('ArrowUp')||E.k('w')){ s.vx+=Math.cos(s.a)*260*dt; s.vy+=Math.sin(s.a)*260*dt;
      E.P.a.length<90&&E.burst(s.x-Math.cos(s.a)*16,s.y-Math.sin(s.a)*16,['#ffc93d','#ff6b3d'],1,60); }
    s.vx*=.995; s.vy*=.995; s.x+=s.vx*dt; s.y+=s.vy*dt; wrap(s);
    if((E.k(' ')||E.m.down)&&s.cd<=0){ bs.push({x:s.x,y:s.y,vx:Math.cos(s.a)*480+s.vx,vy:Math.sin(s.a)*480+s.vy,l:1.3}); s.cd=.22; E.s('laser'); }
    for(var i=bs.length-1;i>=0;i--){ var b=bs[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.l-=dt; wrap(b); if(b.l<=0)bs.splice(i,1); }
    for(var j=rocks.length-1;j>=0;j--){ var r=rocks[j]; r.x+=r.vx*dt; r.y+=r.vy*dt; r.a+=r.va*dt; wrap(r);
      for(var k=bs.length-1;k>=0;k--){ var b2=bs[k];
        if(E.dist(b2.x,b2.y,r.x,r.y)<r.r){ bs.splice(k,1); E.burst(r.x,r.y,['#cfd6ee','#8a93b5'],16,180); E.s('boom');
          E.add(Math.round(120/r.r*10));
          if(r.r>20) mk(2,r.x,r.y,r.r*.55); rocks.splice(j,1); break; } }
      if(inv<=0 && rocks[j]===r && E.dist(s.x,s.y,r.x,r.y)<r.r+12){
        s.lives--; E.shake(20); E.s('boom'); inv=2.2; s.x=400;s.y=300;s.vx=0;s.vy=0;
        if(s.lives<=0) return E.over('تحطمت السفينة','الفضاء لا يرحم'); } }
    if(!rocks.length){ E.add(200); E.s('win'); mk(6); }
  },
  draw:function(c){
    E.bg('#05060d');
    rocks.forEach(function(r){ c.save(); c.translate(r.x,r.y); c.rotate(r.a);
      c.beginPath(); for(var i=0;i<9;i++){ var a=i/9*6.283, rr=r.r*(.78+((i*37)%10)/28);
        c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); } c.closePath();
      c.fillStyle='#39405c'; c.fill(); c.strokeStyle='#79839f'; c.lineWidth=2; c.stroke(); c.restore(); });
    bs.forEach(function(b){ E.o(b.x,b.y,3,'#9dff3d'); });
    if(inv<=0||Math.sin(E.time*24)>0){ c.save(); c.translate(s.x,s.y); c.rotate(s.a);
      E.poly([[16,0],[-12,-11],[-6,0],[-12,11]],'#00d4ff'); c.restore(); }
    E.hud('النتيجة '+E.score); E.hudL('🚀'.repeat(Math.max(0,s.lives)));
  }};
}});

G({id:'grumpy-bird', t:'الطائر المتذمّر', c:'arcade', e:'🐦', tags:['سرعة','مهارة'],
d:'طائر يمرّ بين الأنابيب… ويعلّق بصوت عالٍ على كل فشل لك.',
how:'انقر أو مسافة للقفز',
make:function(E){
  var b,pipes,sp,t,say,st;
  var SAY=['هذا كل ما لديك؟','أنبوب واحد فقط؟','أختي تلعب أفضل','ركّز قليلاً!','واو… سيّئ','حاول بعينيك مفتوحتين'];
  function reset(){ b={y:300,v:0}; pipes=[]; sp=180; t=0; say=''; st=0;
    for(var i=0;i<3;i++) pipes.push({x:600+i*250, g:E.rnd(150,380), passed:false}); }
  reset();
  function flap(){ b.v=-330; E.s('jump'); }
  return {
  down:flap, key:function(k,d){ if(d&&(k===' '||k==='ArrowUp')) flap(); },
  update:function(dt){
    t+=dt; if(st>0)st-=dt;
    b.v+=1250*dt; b.y+=b.v*dt;
    if(b.y>580||b.y<0) return E.over('اصطدمت','عبرت '+E.score+' أنبوباً فقط');
    sp=180+E.score*3;
    pipes.forEach(function(p){ p.x-=sp*dt;
      if(p.x<-90){ p.x+=750; p.g=E.rnd(130,420); p.passed=false; }
      if(!p.passed&&p.x<180){ p.passed=true; E.add(1); E.s('coin');
        if(E.score%3===0){ say=E.pick(SAY); st=2; } }
      if(200>p.x&&160<p.x+80 && (b.y<p.g-70||b.y>p.g+70))
        E.over('اصطدمت بالأنبوب','عبرت '+E.score); });
  },
  draw:function(c){
    E.sky('#1b2a4a','#0a1020');
    pipes.forEach(function(p){
      E.rr(p.x,0,80,p.g-70,8,'#2ea94e'); E.rr(p.x-6,p.g-84,92,20,6,'#3fd166');
      E.rr(p.x,p.g+70,80,600,8,'#2ea94e'); E.rr(p.x-6,p.g+64,92,20,6,'#3fd166'); });
    E.r(0,585,800,15,'#1a2438');
    E.spr('🐦',180,b.y,36, E.cl(b.v/700,-.5,.9));
    E.hud('النتيجة '+E.score);
    if(st>0) E.tx('«'+say+'»',400,90,24,'#ffc93d');
  }};
}});

G({id:'sky-hopper', t:'قفّاز السماء', c:'arcade', e:'🦘', tags:['ارتفاع','مهارة'],
d:'اقفز من منصة لأخرى إلى الأعلى بلا نهاية — ومنها ما يختفي تحت قدميك.',
how:'← → أو إمالة الفأرة',
make:function(E){
  var p,plats,top,best;
  function reset(){ p={x:400,y:450,vx:0,vy:-400,w:44}; plats=[]; top=0; best=0;
    for(var i=0;i<12;i++) plats.push({x:E.rnd(0,700),y:560-i*52,w:90,t:i===0?0:(Math.random()<.2?1:(Math.random()<.15?2:0)),u:0}); }
  reset();
  return {
  move:function(x){ p.vx=(x-p.x)*4; },
  update:function(dt){
    var kx=E.kx(); if(kx) p.vx=kx*340;
    p.x+=p.vx*dt; p.vx*=.92;
    if(p.x<-20)p.x=810; if(p.x>810)p.x=-20;
    p.vy+=1150*dt; p.y+=p.vy*dt;
    if(p.vy>0) plats.forEach(function(pl){
      if(pl.u) return;
      if(p.x+18>pl.x&&p.x-18<pl.x+pl.w&&p.y>pl.y-12&&p.y<pl.y+14){
        p.vy=-520; E.s('jump'); if(pl.t===1){ pl.u=1; } if(pl.t===2){ p.vy=-760; E.s('power'); } } });
    if(p.y<260){ var d=260-p.y; p.y=260; top+=d;
      plats.forEach(function(pl){ pl.y+=d;
        if(pl.y>620){ pl.y-=624; pl.x=E.rnd(0,700); pl.u=0; pl.t=Math.random()<.22?1:(Math.random()<.12?2:0); } });
      E.setScore(Math.floor(top/10)); }
    if(p.y>620) return E.over('سقطت','ارتفعت '+E.score+' متراً');
  },
  draw:function(c){
    E.sky('#0d1b3a','#04070f');
    plats.forEach(function(pl){ if(pl.u)return;
      E.rr(pl.x,pl.y,pl.w,12,6, pl.t===1?'#ff9f3d':pl.t===2?'#9dff3d':'#4d7dff'); });
    E.spr('🦘',p.x,p.y-14,38);
    E.hud(E.score+' م');
  }};
}});

G({id:'tetro', t:'تتريس الغرفة الضيّقة', c:'puzzle', e:'🟦', tags:['كلاسيكي','تفكير'],
d:'تتريس بلوح أضيق مما تحب، وسرعة تزحف نحوك.',
how:'← → تحريك · ↑ تدوير · ↓ إسقاط',
make:function(E){
  var CW=10,CH=18,CS=32,OX=240,OY=20;
  var SH=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
  var CO=['#00d4ff','#ffc93d','#c93dff','#3d7cff','#ff9f3d','#9dff3d','#ff3d7f'];
  var b,cur,t,step,lines,nxt;
  function empty(){ var a=[]; for(var y=0;y<CH;y++){ a.push([]); for(var x=0;x<CW;x++) a[y].push(0);} return a; }
  function np(){ var i=E.ri(0,6); return {s:SH[i],c:i+1,x:3,y:0}; }
  function reset(){ b=empty(); cur=np(); nxt=np(); t=0; step=.6; lines=0; }
  reset();
  function ok(p,dx,dy,s){ s=s||p.s;
    for(var y=0;y<s.length;y++)for(var x=0;x<s[y].length;x++){ if(!s[y][x])continue;
      var nx=p.x+x+dx, ny=p.y+y+dy;
      if(nx<0||nx>=CW||ny>=CH) return false; if(ny>=0&&b[ny][nx]) return false; } return true; }
  function rot(s){ var r=[]; for(var x=0;x<s[0].length;x++){ r.push([]); for(var y=s.length-1;y>=0;y--) r[x].push(s[y][x]); } return r; }
  function lock(){
    cur.s.forEach(function(row,y){ row.forEach(function(v,x){ if(v&&cur.y+y>=0) b[cur.y+y][cur.x+x]=cur.c; }); });
    var cl=0;
    for(var y=CH-1;y>=0;y--) if(b[y].every(function(v){return v;})){ b.splice(y,1); b.unshift(new Array(CW).fill(0)); cl++; y++; }
    if(cl){ lines+=cl; E.add([0,100,300,500,800][cl]); E.s('power'); E.shake(cl*4);
      step=Math.max(.12,.6-lines*.012); } else E.s('thud');
    cur=nxt; nxt=np();
    if(!ok(cur,0,0)) E.over('امتلأ اللوح','أزلت '+lines+' صفاً');
  }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft'&&ok(cur,-1,0))cur.x--;
    if(k==='ArrowRight'&&ok(cur,1,0))cur.x++;
    if(k==='ArrowUp'){ var r=rot(cur.s); if(ok(cur,0,0,r)){cur.s=r;E.s('blip');} else if(ok(cur,1,0,r)){cur.x++;cur.s=r;} else if(ok(cur,-1,0,r)){cur.x--;cur.s=r;} }
    if(k===' '){ while(ok(cur,0,1))cur.y++; lock(); } },
  down:function(x,y){ if(x<OX) { if(ok(cur,-1,0))cur.x--; } else if(x>OX+CW*CS){ if(ok(cur,1,0))cur.x++; }
    else if(y>400){ while(ok(cur,0,1))cur.y++; lock(); } else { var r=rot(cur.s); if(ok(cur,0,0,r))cur.s=r; } },
  update:function(dt){
    t+=dt; var sp=E.k('ArrowDown')?.05:step;
    if(t>sp){ t=0; if(ok(cur,0,1)) cur.y++; else lock(); }
  },
  draw:function(c){
    E.bg('#0a0d16');
    E.r(OX-4,OY-4,CW*CS+8,CH*CS+8,'#171c2e');
    for(var y=0;y<CH;y++)for(var x=0;x<CW;x++){
      E.rr(OX+x*CS+1,OY+y*CS+1,CS-2,CS-2,4, b[y][x]?CO[b[y][x]-1]:'rgba(255,255,255,.035)'); }
    cur.s.forEach(function(row,y){ row.forEach(function(v,x){ if(v)
      E.rr(OX+(cur.x+x)*CS+1,OY+(cur.y+y)*CS+1,CS-2,CS-2,4,CO[cur.c-1]); }); });
    E.tx('التالي',120,60,18,'#98a0b8');
    nxt.s.forEach(function(row,y){ row.forEach(function(v,x){ if(v)
      E.rr(80+x*26,90+y*26,24,24,4,CO[nxt.c-1]); }); });
    E.tx('النتيجة',120,220,16,'#98a0b8'); E.tx(E.score,120,250,30,'#ffc93d');
    E.tx('الصفوف',120,300,16,'#98a0b8'); E.tx(lines,120,330,30,'#9dff3d');
  }};
}});

G({id:'dot-maze', t:'متاهة النقاط', c:'arcade', e:'🟡', tags:['كلاسيكي','مطاردة'],
d:'التهم كل النقاط قبل أن تلتهمك الأشباح الأربعة، ولكل شبح شخصية.',
how:'الأسهم',
make:function(E){
  var CS=32, MW=25, MH=17, OX=0, OY=44;
  var map,pl,gh,dots,pw,lives;
  function gen(){ map=[]; for(var y=0;y<MH;y++){ map.push([]); for(var x=0;x<MW;x++){
      var w = (x===0||y===0||x===MW-1||y===MH-1) ? 1 : ((x%2===0&&y%2===0)?1:((x%4===2&&y>2&&y<MH-3)?1:0));
      map[y].push(w); } }
    map[8][12]=0; }
  function reset(){ gen(); dots=[]; for(var y=1;y<MH-1;y++)for(var x=1;x<MW-1;x++) if(!map[y][x]) dots.push({x:x,y:y,p:(x+y)%23===0});
    pl={x:12,y:14,dx:0,dy:0,nx:0,ny:0,f:0}; lives=3; pw=0;
    gh=[{x:12,y:8,c:'#ff3d7f',n:'أحمق'},{x:11,y:8,c:'#00d4ff',n:'خجول'},{x:13,y:8,c:'#ff9f3d',n:'عشوائي'},{x:12,y:7,c:'#c93dff',n:'ماكر'}];
    gh.forEach(function(g){ g.dx=E.pick([-1,1]); g.dy=0; g.f=0; }); }
  reset();
  function free(x,y){ return x>=0&&y>=0&&x<MW&&y<MH&&!map[y][x]; }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft'){pl.nx=-1;pl.ny=0;} if(k==='ArrowRight'){pl.nx=1;pl.ny=0;}
    if(k==='ArrowUp'){pl.nx=0;pl.ny=-1;} if(k==='ArrowDown'){pl.nx=0;pl.ny=1;} },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy)){pl.nx=dx>0?1:-1;pl.ny=0;}else{pl.nx=0;pl.ny=dy>0?1:-1;} },
  update:function(dt){
    if(pw>0)pw-=dt;
    pl.f+=dt*6;
    if(pl.f>=1){ pl.f=0;
      if(free(pl.x+pl.nx,pl.y+pl.ny)){ pl.dx=pl.nx; pl.dy=pl.ny; }
      if(free(pl.x+pl.dx,pl.y+pl.dy)){ pl.x+=pl.dx; pl.y+=pl.dy; }
      for(var i=0;i<dots.length;i++) if(dots[i].x===pl.x&&dots[i].y===pl.y){
        E.add(dots[i].p?50:10); if(dots[i].p){pw=6;E.s('power');}else E.s('tick');
        dots.splice(i,1); break; }
      if(!dots.length) return E.won('التهمت كل شيء!','لا شيء بقي لهم');
    }
    gh.forEach(function(g,i){ g.f+=dt*(pw>0?3.2:4.4+E.score/900);
      if(g.f>=1){ g.f=0;
        var opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(o){ return free(g.x+o[0],g.y+o[1]) && !(o[0]===-g.dx&&o[1]===-g.dy); });
        if(!opts.length) opts=[[-g.dx,-g.dy]];
        var tx=pl.x,ty=pl.y;
        if(i===1){ tx=pl.x+pl.dx*4; ty=pl.y+pl.dy*4; }
        if(i===2 || pw>0){ var o=E.pick(opts); g.dx=o[0]; g.dy=o[1]; }
        else { var bo=opts[0],bd=1e9;
          opts.forEach(function(o){ var d=E.dist(g.x+o[0],g.y+o[1],tx,ty)+(i===3?E.rnd(0,3):0); if(d<bd){bd=d;bo=o;} });
          g.dx=bo[0]; g.dy=bo[1]; }
        g.x+=g.dx; g.y+=g.dy; }
      if(g.x===pl.x&&g.y===pl.y){
        if(pw>0){ E.add(200); E.s('coin'); g.x=12;g.y=8; }
        else { lives--; E.shake(18); E.s('lose'); pl.x=12;pl.y=14;pl.dx=0;pl.dy=0;pl.nx=0;pl.ny=0;
          gh.forEach(function(q,j){ q.x=12; q.y=8-(j===3?1:0); });
          if(lives<=0) E.over('التهمتك الأشباح','بقيت '+dots.length+' نقطة'); } } });
  },
  draw:function(c){
    E.bg('#05070f');
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++) if(map[y][x]) E.rr(x*CS+2,OY+y*CS+2,CS-4,CS-4,5,'#1f2a52');
    dots.forEach(function(d){ E.o(d.x*CS+CS/2,OY+d.y*CS+CS/2, d.p?7:3, d.p?'#ffc93d':'#e8ecff'); });
    var m=Math.abs(Math.sin(E.time*9))*.5+.15;
    c.save(); c.translate(pl.x*CS+CS/2,OY+pl.y*CS+CS/2); c.rotate(Math.atan2(pl.dy,pl.dx));
    c.fillStyle='#ffe23d'; c.beginPath(); c.moveTo(0,0); c.arc(0,0,13,m,6.283-m); c.closePath(); c.fill(); c.restore();
    gh.forEach(function(g){ var col=pw>0?(Math.sin(E.time*12)>0?'#4d6fff':'#dfe6ff'):g.c;
      var gx=g.x*CS+CS/2, gy=OY+g.y*CS+CS/2;
      E.o(gx,gy-2,12,col); E.r(gx-12,gy-2,24,13,col);
      E.o(gx-4,gy-4,3.5,'#fff'); E.o(gx+4,gy-4,3.5,'#fff'); });
    E.hud('النتيجة '+E.score); E.hudL('❤️'.repeat(Math.max(0,lives))+(pw>0?'  ⚡'+pw.toFixed(1):''));
  }};
}});

G({id:'road-cross', t:'اعبر ولا تُسحق', c:'action', e:'🐸', tags:['كلاسيكي','مهارة'],
d:'اعبر ستة مسارات مزدحمة، ثم نهراً بجذوع تتحرك — وكل عبور يزيد الفوضى.',
how:'الأسهم للحركة',
make:function(E){
  var CS=50,p,rows,lvl,tmr;
  function build(){ rows=[]; for(var i=1;i<=10;i++){
    var t = i<=4?'car' : i===5?'safe' : i<=9?'log':'car';
    rows.push({ y:i, t:t, sp:E.rnd(60,130)*(i%2?1:-1)*(1+lvl*.13), items:[], w:t==='log'?90:64 });
    var r=rows[rows.length-1];
    if(t!=='safe') for(var j=0;j<3;j++) r.items.push({x:j*280+E.rnd(0,120)}); } }
  function reset(){ p={x:7,y:11}; lvl=1; tmr=22; build(); }
  reset();
  return {
  key:function(k,d){ if(!d)return; var o={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
    if(o){ p.x=E.cl(p.x+o[0],0,15); p.y=E.cl(p.y+o[1],0,11); E.s('jump'); if(o[1]<0)E.add(5); } },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; var k= Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
    if(Math.abs(dx)+Math.abs(dy)>18) this.key(k,true); },
  update:function(dt){
    tmr-=dt; if(tmr<=0) return E.over('نفد الوقت','وصلت للمستوى '+lvl);
    var onLog=false;
    rows.forEach(function(r){ r.items.forEach(function(it){ it.x+=r.sp*dt;
      if(it.x>860)it.x=-r.w-E.rnd(0,140); if(it.x<-r.w-140)it.x=860+E.rnd(0,80);
      if(p.y===r.y && p.x*CS+25>it.x && p.x*CS+25<it.x+r.w){
        if(r.t==='car'){ E.shake(20); E.s('boom'); E.burst(p.x*CS+25,p.y*CS+25,['#ff3d7f'],20); E.over('سُحقت','مستوى '+lvl); }
        else { onLog=true; p.x+=r.sp*dt/CS; } } }); });
    var row=rows[p.y-1];
    if(row&&row.t==='log'&&!onLog) return E.over('غرقت في النهر','الجذوع كانت أسرع منك');
    if(p.x<0||p.x>15.4) return E.over('جرفك التيار','خارج الشاشة');
    if(p.y===0){ lvl++; E.add(120); E.s('win'); tmr=Math.max(12,24-lvl); p={x:7,y:11}; build(); }
  },
  draw:function(c){
    E.bg('#0d1424');
    rows.forEach(function(r){ E.r(0,r.y*CS,800,CS, r.t==='safe'?'#1c3a24':r.t==='log'?'#12305a':'#242a3d'); });
    E.r(0,0,800,CS,'#1c3a24'); E.r(0,11*CS,800,CS,'#1c3a24');
    rows.forEach(function(r){ r.items.forEach(function(it){
      if(r.t==='car') E.spr(r.sp>0?'🚗':'🚚',it.x+32,r.y*CS+25,36);
      else if(r.t==='log'){ E.rr(it.x,r.y*CS+12,r.w,26,8,'#6b4a2a'); } }); });
    E.spr('🐸',p.x*CS+25,p.y*CS+25,34);
    E.hud('النتيجة '+E.score);
    E.hudL('⏱ '+Math.ceil(tmr)+'  ·  مستوى '+lvl, tmr<6?'#ff3d7f':'#fff');
  }};
}});

G({id:'missile-guard', t:'حارس المدينة', c:'shoot', e:'🚀', tags:['دفاع','مهارة'],
d:'صواريخ تسقط على مدنك — انقر لتفجّر مضاداً في المكان المناسب قبل الوصول.',
how:'انقر في أي مكان لإطلاق صاروخ مضاد',
make:function(E){
  var cities,ms,ex,mm,wave,cd;
  function reset(){ cities=[]; for(var i=0;i<6;i++) cities.push({x:80+i*128,alive:true});
    ms=[]; ex=[]; mm=15; wave=1; cd=0; }
  reset();
  function launch(x,y){ if(mm<=0){E.s('buzz');return;} mm--; E.s('laser');
    ms.push({x:400,y:560,tx:x,ty:y,sp:520,own:true}); }
  return {
  down:launch,
  update:function(dt){
    cd-=dt;
    if(cd<=0){ cd=Math.max(.35,1.6-wave*.09);
      var al=cities.filter(function(c){return c.alive;});
      if(al.length) ms.push({x:E.rnd(0,800),y:-10,tx:E.pick(al).x,ty:580,sp:38+wave*7,own:false}); }
    for(var i=ms.length-1;i>=0;i--){ var m=ms[i];
      var d=E.dist(m.x,m.y,m.tx,m.ty);
      if(d<8){ ex.push({x:m.x,y:m.y,r:0,mx:m.own?78:38}); ms.splice(i,1); E.s('boom'); E.shake(m.own?4:12);
        if(!m.own){ cities.forEach(function(cc){ if(cc.alive&&Math.abs(cc.x-m.x)<40){ cc.alive=false; E.shake(20); } }); }
        continue; }
      m.x+=(m.tx-m.x)/d*m.sp*dt; m.y+=(m.ty-m.y)/d*m.sp*dt; }
    for(var j=ex.length-1;j>=0;j--){ var e2=ex[j]; e2.r+=(e2.r<e2.mx?260:-190)*dt;
      if(e2.r<0){ ex.splice(j,1); continue; }
      if(e2.r>=e2.mx)e2.mx=-1;
      for(var k=ms.length-1;k>=0;k--){ var m2=ms[k];
        if(!m2.own && E.dist(m2.x,m2.y,e2.x,e2.y)<Math.abs(e2.r)){
          ms.splice(k,1); E.add(25*wave); E.burst(m2.x,m2.y,['#ffc93d','#ff6b3d'],10); } } }
    if(!cities.some(function(cc){return cc.alive;})) return E.over('دُمّرت المدينة','صمدت '+wave+' موجات');
    if(!ms.length && cd>.2 && Math.random()<dt){ }
    if(E.score>wave*300){ wave++; mm+=10; E.s('win'); }
  },
  draw:function(c){
    E.sky('#0a1030','#1a0f22');
    ms.forEach(function(m){ E.ln(m.own?400:m.x-(m.tx-m.x)*.05, m.own?560:m.y-(m.ty-m.y)*.05, m.x,m.y, m.own?'#9dff3d':'#ff3d7f',2);
      E.o(m.x,m.y,3,'#fff'); });
    ex.forEach(function(e2){ E.o(e2.x,e2.y,Math.abs(e2.r),'rgba(255,201,61,.45)'); E.ring(e2.x,e2.y,Math.abs(e2.r),'#fff',2); });
    E.r(0,575,800,25,'#2b3350');
    cities.forEach(function(cc){ if(cc.alive) E.spr('🏙️',cc.x,562,34); else E.spr('🔥',cc.x,566,26); });
    E.spr('🗼',400,556,34);
    E.hud('النتيجة '+E.score); E.hudL('صواريخ: '+mm+'  ·  موجة '+wave, mm<4?'#ff3d7f':'#fff');
  }};
}});

G({id:'worm-hunt', t:'الدودة الألفية', c:'shoot', e:'🐛', tags:['كلاسيكي','أكشن'],
d:'دودة عملاقة تتعرّج نحوك، وكل طلقة تقسمها إلى دودتين أسرع.',
how:'← → للحركة · مسافة للإطلاق',
make:function(E){
  var sh,worms,bs,cd,lvl;
  function newWorm(len,x,y,d){ var seg=[]; for(var i=0;i<len;i++) seg.push({x:x-i*22*d,y:y});
    return {seg:seg,d:d,y:y,sp:110+lvl*18,step:0}; }
  function reset(){ sh={x:400}; worms=[newWorm(12,0,60,1)]; bs=[]; cd=0; lvl=1; }
  reset();
  return {
  update:function(dt){
    sh.x=E.cl(sh.x+E.kx()*400*dt,20,780);
    if(E.m.down) sh.x=E.cl(E.m.x,20,780);
    cd-=dt;
    if((E.k(' ')||E.k('ArrowUp')||E.m.down)&&cd<=0){ bs.push({x:sh.x,y:540}); cd=.2; E.s('laser'); }
    for(var i=bs.length-1;i>=0;i--){ bs[i].y-=620*dt; if(bs[i].y<0)bs.splice(i,1); }
    for(var w=worms.length-1;w>=0;w--){ var wo=worms[w];
      var h=wo.seg[0];
      h.x+=wo.d*wo.sp*dt;
      if(h.x>780||h.x<20){ wo.d*=-1; wo.y+=34; h.x=E.cl(h.x,20,780);
        wo.seg.forEach(function(s){ s.y=Math.min(s.y+34,wo.y); }); }
      for(var s2=wo.seg.length-1;s2>0;s2--){ var a=wo.seg[s2],b=wo.seg[s2-1];
        var dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1;
        if(d>22){ a.x+=dx/d*(d-22); a.y+=dy/d*(d-22); } }
      if(h.y>520) return E.over('وصلت إليك الدودة','مستوى '+lvl);
      for(var k=bs.length-1;k>=0;k--){ var bl=bs[k]; var hitI=-1;
        for(var q=0;q<wo.seg.length;q++) if(E.dist(bl.x,bl.y,wo.seg[q].x,wo.seg[q].y)<13){ hitI=q; break; }
        if(hitI>=0){ bs.splice(k,1); E.add(20); E.s('hit'); E.burst(wo.seg[hitI].x,wo.seg[hitI].y,['#9dff3d'],10);
          var tail=wo.seg.slice(hitI+1); wo.seg=wo.seg.slice(0,hitI);
          if(tail.length>1){ var nw=newWorm(1,0,0,-wo.d); nw.seg=tail; nw.y=wo.y; nw.sp=wo.sp*1.1; worms.push(nw); }
          if(wo.seg.length<1){ worms.splice(w,1); E.add(60); }
          break; } } }
    if(!worms.length){ lvl++; E.add(200); E.s('win'); worms=[newWorm(10+lvl*2,0,60,1)]; }
  },
  draw:function(c){
    E.bg('#0b0f1a'); E.grid(40,'rgba(255,255,255,.03)');
    worms.forEach(function(wo){ wo.seg.forEach(function(s,i){
      E.o(s.x,s.y,11, i===0?'#ff3d7f':'hsl('+(110-i*4)+',72%,52%)'); }); });
    bs.forEach(function(b){ E.r(b.x-2,b.y-10,4,12,'#00d4ff'); });
    E.spr('🔫',sh.x,556,36,-1.57);
    E.hud('النتيجة '+E.score); E.hudL('مستوى '+lvl);
  }};
}});

G({id:'moon-drop', t:'هبوط القمر', c:'skill', e:'🌙', tags:['فيزياء','دقّة'],
d:'أنزل المركبة على المنصة بسرعة أقل من 40، والوقود لا يرحم.',
how:'↑ دفع · ← → إمالة',
make:function(E){
  var s,pad,ter,land;
  function reset(){ s={x:E.rnd(150,650),y:60,vx:E.rnd(-40,40),vy:10,a:0,fuel:100};
    ter=[]; var y=520; for(var x=0;x<=800;x+=40){ ter.push({x:x,y:y}); y=E.cl(y+E.rnd(-38,38),420,570); }
    var pi=E.ri(2,17); pad={x:ter[pi].x,y:ter[pi].y,w:80}; ter[pi+1].y=ter[pi].y; land=0; }
  reset();
  function groundY(x){ var i=E.cl(Math.floor(x/40),0,19); var a=ter[i],b=ter[i+1]||a;
    return a.y+(b.y-a.y)*((x-a.x)/40); }
  return {
  update:function(dt){
    if(land) return;
    if((E.k('ArrowUp')||E.k('w')||E.m.down)&&s.fuel>0){ s.vy-=95*dt*Math.cos(s.a); s.vx+=95*dt*Math.sin(s.a);
      s.fuel-=22*dt; E.burst(s.x+Math.sin(s.a)*16,s.y+Math.cos(s.a)*16,['#ffc93d','#ff6b3d'],1,80); if(Math.random()<.3)E.s('tick'); }
    s.a+=E.kx()*1.9*dt; s.vy+=42*dt; s.x+=s.vx*dt; s.y+=s.vy*dt;
    if(s.x<0)s.x=800; if(s.x>800)s.x=0;
    var gy=groundY(s.x);
    if(s.y>gy-12){
      var onPad = s.x>pad.x-6 && s.x<pad.x+pad.w+6;
      var sp=Math.sqrt(s.vx*s.vx+s.vy*s.vy);
      if(onPad && sp<40 && Math.abs(s.a)<.35){ land=1; E.add(Math.round(500+s.fuel*6-sp*4));
        E.won('هبوط ناجح! 🌙','السرعة '+sp.toFixed(0)+' · الوقود '+s.fuel.toFixed(0)); }
      else { land=-1; E.burst(s.x,s.y,['#ff3d7f','#ffc93d'],30,260); E.shake(24);
        E.over(onPad?'هبوط عنيف':'ارتطمت بالسطح','السرعة '+sp.toFixed(0)+' (الحدّ 40)'); } }
  },
  draw:function(c){
    E.bg('#04060e');
    for(var i=0;i<50;i++) E.o((i*163)%800,(i*97)%400,1,'rgba(255,255,255,.45)');
    c.beginPath(); c.moveTo(0,600); ter.forEach(function(p){ c.lineTo(p.x,p.y); }); c.lineTo(800,600); c.closePath();
    c.fillStyle='#2a3050'; c.fill(); c.strokeStyle='#6f7ba5'; c.lineWidth=2; c.stroke();
    E.r(pad.x,pad.y-4,pad.w,7,'#9dff3d'); E.tx('H',pad.x+pad.w/2,pad.y-16,16,'#9dff3d');
    if(land!==-1){ c.save(); c.translate(s.x,s.y); c.rotate(s.a);
      E.poly([[0,-16],[11,8],[-11,8]],'#dfe6ff'); E.r(-12,8,5,8,'#8a93b5'); E.r(7,8,5,8,'#8a93b5'); c.restore(); }
    var sp=Math.sqrt(s.vx*s.vx+s.vy*s.vy);
    E.hudL('⛽ '+Math.max(0,s.fuel).toFixed(0)+'%', s.fuel<25?'#ff3d7f':'#9dff3d');
    E.hud('السرعة '+sp.toFixed(0), sp>40?'#ff3d7f':'#9dff3d');
  }};
}});

G({id:'river-run', t:'غارة النهر', c:'action', e:'🛥️', tags:['طيران','وقود'],
d:'مرّ في نهر يضيق باستمرار، اجمع الوقود ولا تلمس الضفاف.',
how:'← → للحركة · ↑ تسريع',
make:function(E){
  var p,segs,scroll,fuel,sp;
  function reset(){ p={x:400}; segs=[]; scroll=0; fuel=100; sp=180;
    for(var i=0;i<26;i++) segs.push({c:400,w:260,items:[]}); }
  reset();
  function push(){ var last=segs[segs.length-1];
    var w=E.cl(last.w+E.rnd(-24,16),110,300), cn=E.cl(last.c+E.rnd(-40,40),w/2+30,770-w/2);
    var it=[]; if(Math.random()<.28) it.push({x:cn+E.rnd(-w/3,w/3),t:'fuel'});
    if(Math.random()<.3) it.push({x:cn+E.rnd(-w/3,w/3),t:'ship'});
    segs.push({c:cn,w:w,items:it}); }
  return {
  update:function(dt){
    var boost=E.k('ArrowUp')?1.7:1;
    sp=(180+E.score*.12)*boost;
    p.x=E.cl(p.x+E.kx()*300*dt,10,790);
    if(E.m.down) p.x=E.cl(E.m.x,10,790);
    fuel-=(boost>1?9:5)*dt;
    if(fuel<=0) return E.over('نفد الوقود','قطعت '+E.score+' متراً');
    scroll+=sp*dt; E.setScore(Math.floor(scroll/10));
    while(scroll>24){ scroll-=24; segs.shift(); push(); }
    var si=Math.floor(500/24), s=segs[segs.length-1-si]||segs[0];
    var seg=segs[20];
    if(p.x<seg.c-seg.w/2||p.x>seg.c+seg.w/2){ E.burst(p.x,500,['#ff3d7f'],24,240); E.shake(22);
      return E.over('ارتطمت بالضفة','قطعت '+E.score+' متراً'); }
    seg.items.forEach(function(it,i){ if(Math.abs(it.x-p.x)<22){
      if(it.t==='fuel'){ fuel=Math.min(100,fuel+28); E.s('power'); } else { E.add(80); E.s('boom'); E.burst(it.x,500,['#ffc93d'],14); }
      seg.items.splice(i,1); } });
  },
  draw:function(c){
    E.bg('#123a2a');
    segs.forEach(function(s,i){ var y=600-i*24+(scroll%24);
      E.r(0,y-24,s.c-s.w/2,26,'#1d5a3c'); E.r(s.c+s.w/2,y-24,800,26,'#1d5a3c');
      E.r(s.c-s.w/2,y-24,s.w,26,'#12406a');
      s.items.forEach(function(it){ E.spr(it.t==='fuel'?'⛽':'🚤',it.x,y-12,22); }); });
    E.spr('🛥️',p.x,500,38);
    E.r(20,560,fuel*2,14,fuel<30?'#ff3d7f':'#9dff3d'); E.sr(20,560,200,14,'#fff',2);
    E.tx('وقود',120,552,12,'#fff');
    E.hud(E.score+' م');
  }};
}});

G({id:'bomb-drop', t:'قاذفة القنابل', c:'action', e:'💣', tags:['كلاسيكي','دقّة'],
d:'طائرة تنخفض شيئاً فشيئاً — اهدم كل البنايات قبل أن تصطدم بها.',
how:'انقر أو مسافة لإسقاط قنبلة',
make:function(E){
  var pl,bl,city,lvl;
  function build(){ city=[]; for(var i=0;i<16;i++) city.push({x:i*50, h:E.ri(1,3+Math.min(6,lvl))*28}); }
  function reset(){ lvl=1; pl={x:-60,y:60,sp:130}; bl=[]; build(); }
  reset();
  return {
  down:function(){ if(bl.length<3){ bl.push({x:pl.x,y:pl.y+10,vy:0}); E.s('swish'); } },
  key:function(k,d){ if(d&&k===' ') this.down(); },
  update:function(dt){
    pl.x+=pl.sp*dt;
    if(pl.x>860){ pl.x=-60; pl.y+=34; pl.sp+=12; }
    for(var i=bl.length-1;i>=0;i--){ var b=bl[i]; b.vy+=520*dt; b.y+=b.vy*dt; b.x+=pl.sp*dt*.4;
      var ci=Math.floor(b.x/50);
      if(ci>=0&&ci<16 && b.y>600-city[ci].h){ city[ci].h=Math.max(0,city[ci].h-28); E.add(20);
        E.burst(b.x,600-city[ci].h,['#ff9f3d','#ffc93d'],14,200); E.s('boom'); E.shake(6); bl.splice(i,1); continue; }
      if(b.y>600) bl.splice(i,1); }
    var pi=Math.floor(pl.x/50);
    if(pi>=0&&pi<16 && pl.y+12>600-city[pi].h){ E.shake(26); E.burst(pl.x,pl.y,['#ff3d7f'],30,280);
      return E.over('اصطدمت بالبناية','المستوى '+lvl); }
    if(city.every(function(b2){return b2.h<=0;})){ lvl++; E.add(300); E.s('win'); pl={x:-60,y:60,sp:130+lvl*18}; build(); }
  },
  draw:function(c){
    E.sky('#2a1f4a','#0d0a18');
    city.forEach(function(b){ if(b.h>0){ E.rr(b.x+3,600-b.h,44,b.h,3,'#3b4a72');
      for(var y=600-b.h+8;y<595;y+=18) for(var x=b.x+9;x<b.x+42;x+=14) E.r(x,y,7,9,'#ffe9a8'); } });
    bl.forEach(function(b){ E.o(b.x,b.y,6,'#111'); E.o(b.x,b.y-6,2,'#ff9f3d'); });
    E.spr('✈️',pl.x,pl.y,38);
    E.hud('النتيجة '+E.score); E.hudL('مستوى '+lvl);
  }};
}});
