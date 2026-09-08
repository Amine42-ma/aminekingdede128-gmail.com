/* ============ 6) ألعاب تُغضبك ============ */

G({id:'rage-gap', t:'الفجوة المستحيلة', c:'rage', e:'😤', tags:['صعب','أعصاب'],
d:'فجوة بحجم شخصيتك تقريباً. لا تسامح، لا رحمة، ولا نقاط مجانية.',
how:'انقر أو مسافة للقفز',
make:function(E){
  var b,walls,best,tries;
  function reset(){ b={y:300,v:0}; walls=[]; tries=(tries||0)+1;
    for(var i=0;i<4;i++) walls.push({x:600+i*230,g:E.rnd(120,470),passed:false}); }
  reset();
  function flap(){ b.v=-300; E.s('jump'); }
  return {
  down:flap, key:function(k,d){ if(d&&(k===' '||k==='ArrowUp'))flap(); },
  update:function(dt){
    b.v+=1400*dt; b.y+=b.v*dt;
    if(b.y<8||b.y>592){ E.shake(20); return E.over('اصطدمت','النتيجة '+E.score+' · محاولة رقم '+tries); }
    walls.forEach(function(w){ w.x-=250*dt+E.score*3*dt;
      if(w.x<-70){ w.x+=4*230; w.g=E.rnd(110,480); w.passed=false; }
      if(!w.passed&&w.x<176){ w.passed=true; E.add(1); E.s('coin'); }
      if(200>w.x&&176<w.x+64 && (b.y<w.g-30||b.y>w.g+30)){ E.shake(24); E.burst(190,b.y,['#ff3d7f'],20);
        E.over('لمست الجدار','النتيجة '+E.score+' · محاولة رقم '+tries); } }); },
  draw:function(c){
    E.bg('#1a0a12');
    walls.forEach(function(w){ E.r(w.x,0,64,w.g-30,'#ff3d7f'); E.r(w.x,w.g+30,64,600,'#ff3d7f'); });
    E.o(190,b.y,11,'#fff');
    E.hud('النتيجة '+E.score); E.hudL('محاولة '+tries);
    E.tx('الفجوة ٦٠ بكسل. حظاً موفقاً.',400,575,15,'#6d7590');
  }};
}});

G({id:'pixel-jump', t:'قفزة البكسل', c:'rage', e:'⬛', tags:['دقّة','صعب'],
d:'منصات بعرض ٢٤ بكسل وقفزة واحدة فقط. لا توجد منتصف طريق.',
how:'اضغط مطوّلاً لشحن القفزة',
make:function(E){
  var p,plats,charge,charging,scroll,lvl;
  function reset(){ p={x:120,y:400,vx:0,vy:0,ground:true}; scroll=0; charge=0; charging=false; lvl=0;
    plats=[{x:80,y:440,w:110}];
    for(var i=1;i<9;i++) plats.push({x:80+i*E.rnd(130,200),y:E.rnd(230,500),w:24}); }
  reset();
  return {
  down:function(){ if(p.ground){ charging=true; charge=0; } },
  up:function(){ if(!charging)return; charging=false;
    p.vy=-260-charge*430; p.vx=140+charge*190; p.ground=false; E.s('jump'); },
  key:function(k,d){ if(k!==' ')return; if(d)this.down(); else this.up(); },
  update:function(dt){
    if(charging){ charge=Math.min(1,charge+dt*1.1); return; }
    p.vy+=1500*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    var landed=false;
    plats.forEach(function(pl,i){
      if(p.vy>0 && p.x>pl.x-8 && p.x<pl.x+pl.w+8 && p.y>pl.y-14 && p.y<pl.y+16){
        p.y=pl.y-10; p.vy=0; p.vx=0; p.ground=true; landed=true;
        if(i>lvl){ lvl=i; E.add(100); E.s('coin'); E.burst(p.x,p.y,['#9dff3d'],10);
          if(i>=plats.length-1) E.won('وصلت للنهاية! ⬛','قفزات مثالية'); } } });
    if(p.x>420){ var d=p.x-420; p.x=420; scroll+=d; plats.forEach(function(pl){ pl.x-=d; }); }
    if(p.y>620||p.x<-20){ E.shake(16); E.over('سقطت','وصلت للمنصة '+lvl); } },
  draw:function(c){
    E.bg('#0b0d14');
    plats.forEach(function(pl){ E.rr(pl.x,pl.y,pl.w,12,3, pl.w>40?'#3a4270':'#9dff3d'); });
    E.r(p.x-8,p.y-16,16,16,'#00d4ff');
    if(charging){ E.rr(p.x-30,p.y-44,60,10,5,'#1e2540'); E.rr(p.x-28,p.y-42,56*charge,6,3,'#ffc93d'); }
    E.hud('النتيجة '+E.score); E.hudL('المنصة '+lvl+'/'+(plats.length-1));
  }};
}});

G({id:'trap-floor', t:'الأرض الغادرة', c:'rage', e:'🕳️', tags:['فخاخ','ذاكرة'],
d:'بعض البلاطات وهمية — لا تعرف أيها إلا بالسقوط. احفظ الطريق ثم اعبر.',
how:'الأسهم للمشي بلاطة بلاطة',
make:function(E){
  var W=9,H=7,safe,px,py,seen,deaths,lvl;
  function gen(){ safe=[]; for(var y=0;y<H;y++){ safe.push([]); for(var x=0;x<W;x++) safe[y].push(false); }
    var x2=E.ri(1,W-2);
    for(var y2=H-1;y2>=0;y2--){ safe[y2][x2]=true;
      if(Math.random()<.55){ var nx=E.cl(x2+E.pick([-1,1]),0,W-1); safe[y2][nx]=true; x2=nx; } }
    px=E.ri(0,W-1); while(!safe[H-1][px]) px=E.ri(0,W-1);
    px=(function(){ for(var i=0;i<W;i++) if(safe[H-1][i])return i; return 0; })();
    py=H-1; seen={}; }
  function reset(){ lvl=1; deaths=0; gen(); }
  reset();
  function step(dx,dy){
    var nx=px+dx, ny=py+dy;
    if(nx<0||ny<0||nx>=W||ny>=H)return;
    seen[nx+','+ny]=safe[ny][nx]?1:2;
    if(!safe[ny][nx]){ deaths++; E.s('lose'); E.shake(18); E.add(-40);
      px=(function(){ for(var i=0;i<W;i++) if(safe[H-1][i])return i; return 0; })(); py=H-1;
      if(deaths>=10) E.over('سقطت عشر مرات','المرحلة '+lvl); return; }
    px=nx; py=ny; E.s('tick'); E.add(10);
    if(py===0){ E.add(300); E.s('win'); lvl++;
      if(lvl>4) return E.won('عبرت كل الأرضيات! 🕳️','أربع مراحل'); gen(); } }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')step(-1,0); if(k==='ArrowRight')step(1,0);
    if(k==='ArrowUp')step(0,-1); if(k==='ArrowDown')step(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))step(dx>0?1:-1,0); else step(0,dy>0?1:-1); },
  draw:function(c){
    E.bg('#0a0c14');
    var S=70,OX=(800-W*S)/2,OY=(600-H*S)/2;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){ var k=seen[x+','+y];
      E.rr(OX+x*S+3,OY+y*S+3,S-6,S-6,8, k===1?'#2f7a4d':k===2?'#1a0d14':'#39406b');
      if(k===2) E.spr('🕳️',OX+x*S+S/2,OY+y*S+S/2,30); }
    E.r(OX,OY-8,W*S,5,'#9dff3d');
    E.spr('🧗',OX+px*S+S/2,OY+py*S+S/2,36);
    E.hudL('مرحلة '+lvl+' · سقطات '+deaths+'/10'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'no-red', t:'لا تلمس الأحمر', c:'rage', e:'🟥', tags:['تفادي','أعصاب'],
d:'المربعات الحمراء تتكاثر وتلاحقك. ابقَ حيّاً ٦٠ ثانية — لا أحد نجح بعد.',
how:'حرّك الفأرة أو الأسهم', noPad:false,
make:function(E){
  var p,en,t,spawn;
  function reset(){ p={x:400,y:300}; en=[]; t=60; spawn=0; }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.won('نجوت ٦٠ ثانية! 🏆','أنت الاستثناء');
    E.setScore(Math.round((60-t)*20));
    if(E.kx()||E.ky()){ p.x=E.cl(p.x+E.kx()*340*dt,14,786); p.y=E.cl(p.y+E.ky()*340*dt,14,586); }
    else { p.x+=(E.m.x-p.x)*Math.min(1,dt*11); p.y+=(E.m.y-p.y)*Math.min(1,dt*11); }
    spawn-=dt;
    if(spawn<=0){ spawn=Math.max(.35,1.6-(60-t)*.025);
      var side=E.ri(0,3);
      en.push({x:side===0?-30:side===1?830:E.rnd(0,800), y:side===2?-30:side===3?630:E.rnd(0,600),
        s:E.rnd(20,46), v:E.rnd(60,130)+(60-t)*1.6, hom:Math.random()<.4}); E.s('tick'); }
    en.forEach(function(e){
      var a=Math.atan2(p.y-e.y,p.x-e.x);
      if(e.hom){ e.vx=(e.vx||0)+Math.cos(a)*90*dt; e.vy=(e.vy||0)+Math.sin(a)*90*dt;
        e.vx=E.cl(e.vx,-e.v,e.v); e.vy=E.cl(e.vy,-e.v,e.v); }
      else if(e.vx==null){ e.vx=Math.cos(a)*e.v; e.vy=Math.sin(a)*e.v; }
      e.x+=e.vx*dt; e.y+=e.vy*dt;
      if(Math.abs(e.x-p.x)<e.s/2+9&&Math.abs(e.y-p.y)<e.s/2+9){
        E.shake(24); E.burst(p.x,p.y,['#ff3d7f','#fff'],26);
        E.over('لمست الأحمر','صمدت '+(60-t).toFixed(1)+' ثانية'); } });
    for(var i=en.length-1;i>=0;i--) if(en[i].x<-120||en[i].x>920||en[i].y<-120||en[i].y>720) en.splice(i,1); },
  draw:function(c){
    E.bg('#0a0a10');
    en.forEach(function(e){ E.rr(e.x-e.s/2,e.y-e.s/2,e.s,e.s,4, e.hom?'#ff1f5f':'#c92040'); });
    E.o(p.x,p.y,10,'#00d4ff'); E.ring(p.x,p.y,15,'rgba(0,212,255,.4)',2);
    E.hud('النتيجة '+E.score); E.hudL('⏱ '+Math.max(0,t).toFixed(1),'#9dff3d');
  }};
}});

G({id:'tightrope', t:'الحبل المشدود', c:'rage', e:'🎪', tags:['توازن','أعصاب'],
d:'وازن نفسك على الحبل بضغطات دقيقة. الرياح تكرهك.',
how:'← → لتصحيح التوازن',
make:function(E){
  var ang,av,x,wind,wt,t;
  function reset(){ ang=0; av=0; x=0; wind=0; wt=1.5; t=0; }
  reset();
  return {
  update:function(dt){
    t+=dt;
    wt-=dt; if(wt<=0){ wind=E.rnd(-1,1)*(.7+t*.03); wt=E.rnd(.8,2); }
    av += (Math.sin(ang)*3.2 + wind*.7 - E.kx()*2.6) * dt;
    av*=.985; ang+=av*dt;
    if(Math.abs(ang)>.72){ E.shake(20); return E.over('سقطت من الحبل','قطعت '+Math.round(x)+' متراً'); }
    x+=dt*(1-Math.abs(ang))*9;
    E.setScore(Math.round(x*10));
    if(x>=100) E.won('عبرت الحبل! 🎪','١٠٠ متر من الرعب'); },
  draw:function(c){
    E.sky('#241a3e','#0a0714');
    E.ln(0,430,800,430,'#c8a86a',4);
    E.tx('🎪',60,300,0);
    c.save(); c.translate(400,430); c.rotate(ang);
    E.r(-5,-90,10,90,'#3a4270'); E.o(0,-104,17,'#ffd9a0');
    E.ln(-56,-70,56,-70,'#8a6a3a',5);
    c.restore();
    E.rr(250,520,300,20,8,'#1e2540');
    E.rr(252,522,296*(x/100),16,7,'#9dff3d');
    E.tx(Math.round(x)+' / 100 م',400,560,20,'#dfe6ff');
    var wd = wind>.15?'🌬 ←':wind<-.15?'🌬 →':'هدوء';
    E.hudL(wd, Math.abs(wind)>.4?'#ff3d7f':'#98a0b8');
    E.hud('الميل '+(ang*100).toFixed(0), Math.abs(ang)>.5?'#ff3d7f':'#fff');
  }};
}});

G({id:'hammer-climb', t:'التسلّق بالمطرقة', c:'rage', e:'🔨', tags:['فيزياء','صعب'],
d:'جسمك في قدر، وبيدك مطرقة. ادفع نفسك للأعلى — والسقوط يعيدك للبداية.',
how:'حرّك الفأرة لتحريك المطرقة', noPad:true,
make:function(E){
  var b,rocks,best;
  function reset(){ b={x:400,y:520,vx:0,vy:0}; best=0;
    rocks=[]; for(var i=0;i<40;i++) rocks.push({x:E.rnd(60,740),y:480-i*E.rnd(90,150),w:E.rnd(70,190),h:E.rnd(22,44)});
    rocks.unshift({x:0,y:540,w:800,h:60}); }
  reset();
  return {
  update:function(dt){
    var hx=E.m.x, hy=E.m.y;
    var dx=hx-b.x, dy=hy-b.y, d=Math.sqrt(dx*dx+dy*dy)||1;
    var L=Math.min(d,120), hx2=b.x+dx/d*L, hy2=b.y+dy/d*L;
    rocks.forEach(function(r){
      if(hx2>r.x&&hx2<r.x+r.w&&hy2>r.y&&hy2<r.y+r.h){
        var push=6.5;
        b.vx-=(hx2-b.x)*push*dt*3; b.vy-=(hy2-b.y)*push*dt*3;
        if(Math.random()<.15)E.s('tick'); } });
    b.vy+=780*dt; b.vx*=.99; b.vy*=.999;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    rocks.forEach(function(r){
      if(b.x>r.x-14&&b.x<r.x+r.w+14&&b.y>r.y-16&&b.y<r.y+r.h+16){
        var ox=Math.min(b.x-(r.x-14),(r.x+r.w+14)-b.x), oy=Math.min(b.y-(r.y-16),(r.y+r.h+16)-b.y);
        if(oy<ox){ if(b.y<r.y+r.h/2){ b.y=r.y-16; b.vy=Math.min(0,b.vy)*.2; } else { b.y=r.y+r.h+16; b.vy=Math.abs(b.vy)*.2; } b.vx*=.9; }
        else { b.x = b.x<r.x+r.w/2 ? r.x-14 : r.x+r.w+14; b.vx*=-.3; } } });
    if(b.x<14){b.x=14;b.vx*=-.4;} if(b.x>786){b.x=786;b.vx*=-.4;}
    var h=Math.max(0,Math.round((540-b.y)/10));
    if(h>best){ best=h; E.setScore(best); }
    if(b.y>620){ b.x=400;b.y=520;b.vx=b.vy=0; E.s('lose'); E.shake(14); }
    if(best>=430) E.won('وصلت القمة! 🔨','٤٣٠ متراً من الغضب'); },
  draw:function(c){
    var cam=E.cl(b.y-350,-4000,220);
    E.sky('#2a1a3e','#08060f');
    c.save(); c.translate(0,-cam);
    rocks.forEach(function(r){ if(r.y-cam<-80||r.y-cam>680)return;
      E.rr(r.x,r.y,r.w,r.h,6,'#4a4258'); E.r(r.x,r.y,r.w,4,'#6b6280'); });
    var hx=E.m.x, hy=E.m.y+cam;
    var dx=hx-b.x, dy=hy-b.y, d=Math.sqrt(dx*dx+dy*dy)||1, L=Math.min(d,120);
    E.ln(b.x,b.y,b.x+dx/d*L,b.y+dy/d*L,'#8a6a3a',7);
    E.spr('🔨',b.x+dx/d*L,b.y+dy/d*L,32,Math.atan2(dy,dx));
    E.o(b.x,b.y,15,'#e8ecff'); E.rr(b.x-16,b.y,32,26,8,'#7a4a24');
    c.restore();
    E.hud('الارتفاع '+E.score+' م'); E.hudL('الأفضل '+best+' م');
  }};
}});

G({id:'spike-run', t:'عدّاء الأشواك', c:'rage', e:'🌵', tags:['ركض','موت فوري'],
d:'اركض واقفز فوق الأشواك. لمسة واحدة = البداية من الصفر. لا نقاط تفتيش.',
how:'مسافة أو نقرة للقفز · مطوّلاً لقفزة أعلى',
make:function(E){
  var p,obs,sp,scroll,tries;
  function reset(){ p={y:470,vy:0,g:true}; obs=[]; sp=330; scroll=0; tries=(tries||0)+1;
    for(var i=0;i<6;i++) obs.push({x:700+i*E.rnd(240,420), t:E.pick(['low','high','double'])}); }
  reset();
  return {
  down:function(){ if(p.g){ p.vy=-560; p.g=false; E.s('jump'); } this.h=true; },
  up:function(){ this.h=false; },
  key:function(k,d){ if(k!==' '&&k!=='ArrowUp')return; if(d)this.down(); else this.up(); },
  update:function(dt){
    sp=330+scroll*.02;
    scroll+=sp*dt; E.setScore(Math.floor(scroll/20));
    p.vy+= (p.vy<0&&(this.h||E.m.down) ? 1050 : 1750)*dt;
    p.y+=p.vy*dt;
    if(p.y>470){ p.y=470; p.vy=0; p.g=true; }
    obs.forEach(function(o){ o.x-=sp*dt;
      if(o.x<-90){ o.x+=6*330+E.rnd(0,240); o.t=E.pick(['low','high','double','low']); }
      var hitY = o.t==='high' ? (p.y>300&&p.y<470) : (p.y>420);
      var w = o.t==='double'?70:38;
      if(o.x<130&&o.x+w>90 && hitY){ E.shake(24); E.burst(110,p.y,['#ff3d7f'],22);
        E.over('اصطدمت بالشوكة','قطعت '+E.score+' متراً · محاولة '+tries); } }); },
  draw:function(c){
    E.sky('#3a1428','#0d0710');
    E.r(0,500,800,100,'#2a1a20');
    obs.forEach(function(o){ if(o.x<-90||o.x>860)return;
      if(o.t==='high'){ E.poly([[o.x,300],[o.x+38,300],[o.x+19,380]],'#ff3d7f'); E.r(o.x+16,180,6,120,'#5a2030'); }
      else if(o.t==='double'){ E.poly([[o.x,500],[o.x+34,500],[o.x+17,430]],'#ff3d7f');
        E.poly([[o.x+36,500],[o.x+70,500],[o.x+53,430]],'#ff3d7f'); }
      else E.poly([[o.x,500],[o.x+38,500],[o.x+19,430]],'#ff3d7f'); });
    E.rr(92,p.y-42,36,44,7,'#00d4ff');
    E.hud(E.score+' م'); E.hudL('محاولة '+tries);
  }};
}});

G({id:'patience', t:'اختبار الصبر', c:'rage', e:'⏳', tags:['صبر','نفسي'],
d:'لا تفعل شيئاً لمدة ٦٠ ثانية. لا شيء إطلاقاً. سترى كم أن هذا صعب.',
how:'لا تنقر · لا تضغط أي زر', noPad:true,
make:function(E){
  var t,temp,tt,failed;
  var T=['انقر هنا لجائزة مضمونة!','هل أنت متأكد أنك تستطيع؟','٥٠٠ نقطة مجانية… انقر فقط',
    'الوقت يمرّ ببطء، أليس كذلك؟','انقر لتسريع العداد ⏩','هناك زر أخضر… ألا تريد؟','ملل؟ انقر إذاً 🙂'];
  function reset(){ t=60; temp=''; tt=0; failed=false; }
  reset();
  return {
  down:function(){ fail(); },
  key:function(k,d){ if(d)fail(); },
  update:function(dt){
    if(failed)return;
    t-=dt; E.setScore(Math.round((60-t)*30));
    tt-=dt; if(tt<=0){ temp=E.pick(T); tt=E.rnd(3,6); if(Math.random()<.5)E.s('alarm'); }
    if(t<=0) E.won('صبرك أسطوري! ⏳','٦٠ ثانية من اللاشيء'); },
  draw:function(c){
    E.bg('#0d1018');
    E.tx(Math.max(0,t).toFixed(1),400,240,90,'#dfe6ff');
    E.tx('ثانية متبقّية من الصمت',400,320,22,'#98a0b8');
    E.o(400,240,Math.abs(Math.sin(E.time*.7))*8+150,'rgba(124,92,255,.04)');
    if(temp){ E.rr(200,420,400,70,16, Math.sin(E.time*6)>0?'#2fbd6f':'#25a35f');
      E.tx(temp,400,455,19,'#062012'); }
    E.hud('النتيجة '+E.score);
  }};
  function fail(){ if(failed)return; failed=true; E.shake(16);
    E.over('لم تصمد 😤','صبرت '+(60-t).toFixed(1)+' ثانية فقط'); }
}});

G({id:'one-bullet', t:'طلقة واحدة', c:'rage', e:'🎯', tags:['ضغط','دقّة'],
d:'طلقة واحدة، هدف واحد متحرك، ولا محاولة ثانية. عشر مراحل متتالية.',
how:'انقر لإطلاق الطلقة الوحيدة', noPad:true,
make:function(E){
  var tg,lvl,shot,t;
  function gen(){ tg={x:E.rnd(120,680),y:E.rnd(90,430),vx:E.rnd(-1,1)*(140+lvl*40),vy:E.rnd(-1,1)*(90+lvl*30),
    r:Math.max(14,42-lvl*3)}; shot=null; t=6; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(shot)return; shot={x:400,y:580,tx:x,ty:y,p:0}; E.s('laser'); },
  update:function(dt){
    t-=dt; if(t<=0&&!shot) return E.over('ترددت طويلاً','المرحلة '+lvl);
    tg.x+=tg.vx*dt; tg.y+=tg.vy*dt;
    if(tg.x<tg.r||tg.x>800-tg.r)tg.vx*=-1;
    if(tg.y<tg.r||tg.y>460)tg.vy*=-1;
    if(shot){ shot.p+=dt*2.6;
      var sx=E.lerp(400,shot.tx,shot.p), sy=E.lerp(580,shot.ty,shot.p);
      if(shot.p>=1){
        if(E.dist(shot.tx,shot.ty,tg.x,tg.y)<tg.r){ E.add(200*lvl); E.s('win'); E.burst(tg.x,tg.y,['#9dff3d','#fff'],22);
          lvl++; if(lvl>10) return E.won('عشر طلقات مثالية! 🎯','قنّاص'); gen(); }
        else { E.shake(18); E.s('lose'); E.over('أخطأت الطلقة','المرحلة '+lvl); } } } },
  draw:function(c){
    E.bg('#0a1014'); E.grid(50,'rgba(255,255,255,.02)');
    E.ring(tg.x,tg.y,tg.r,'#ff3d7f',3); E.o(tg.x,tg.y,tg.r*.4,'#ff3d7f');
    if(shot){ var sx=E.lerp(400,shot.tx,Math.min(1,shot.p)), sy=E.lerp(580,shot.ty,Math.min(1,shot.p));
      E.ln(400,580,sx,sy,'rgba(157,255,61,.4)',2); E.o(sx,sy,5,'#9dff3d'); }
    E.spr('🔫',400,570,42,-1.57);
    E.ln(E.m.x-16,E.m.y,E.m.x+16,E.m.y,'rgba(255,255,255,.35)',1);
    E.ln(E.m.x,E.m.y-16,E.m.x,E.m.y+16,'rgba(255,255,255,.35)',1);
    E.tx('المرحلة '+lvl+'/10',400,45,28,'#dfe6ff');
    E.hud('النتيجة '+E.score); E.hudL('⏱ '+Math.max(0,t).toFixed(1), t<2?'#ff3d7f':'#fff');
  }};
}});

G({id:'shrink-zone', t:'البقعة الآمنة', c:'rage', e:'⭕', tags:['بقاء','ضغط'],
d:'دائرة الأمان تتقلّص وتتنقّل، وخارجها موت بطيء. كم ستصمد؟',
how:'حرّك الفأرة أو الأسهم',
make:function(E){
  var p,z,hp,t,nz;
  function reset(){ p={x:400,y:300}; z={x:400,y:300,r:250}; nz=null; hp=100; t=0; }
  reset();
  return {
  update:function(dt){
    t+=dt; E.setScore(Math.round(t*25));
    if(E.kx()||E.ky()){ p.x=E.cl(p.x+E.kx()*300*dt,10,790); p.y=E.cl(p.y+E.ky()*300*dt,10,590); }
    else { p.x+=(E.m.x-p.x)*Math.min(1,dt*9); p.y+=(E.m.y-p.y)*Math.min(1,dt*9); }
    if(!nz&&Math.random()<dt*.35&&z.r>60){
      nz={x:E.rnd(z.x-z.r*.5,z.x+z.r*.5),y:E.rnd(z.y-z.r*.5,z.y+z.r*.5),r:z.r*.72,p:0}; E.s('alarm'); }
    if(nz){ nz.p+=dt*.35;
      z.x=E.lerp(z.x,nz.x,dt*1.2); z.y=E.lerp(z.y,nz.y,dt*1.2); z.r=E.lerp(z.r,nz.r,dt*.9);
      if(nz.p>=1){ z.r=nz.r; nz=null; } }
    z.r=Math.max(40,z.r-dt*3.2);
    var d=E.dist(p.x,p.y,z.x,z.y);
    if(d>z.r){ hp-=dt*(18+t*.5); E.shake(3);
      if(Math.random()<dt*3)E.s('buzz');
      if(hp<=0) return E.over('ابتلعتك العاصفة','صمدت '+t.toFixed(1)+' ثانية'); }
    else hp=Math.min(100,hp+dt*7);
    if(t>=90) E.won('نجوت ٩٠ ثانية! ⭕','أسطورة الدائرة'); },
  draw:function(c){
    E.bg('#2a0a18');
    c.save(); c.beginPath(); c.arc(z.x,z.y,z.r,0,6.283); c.clip();
    E.bg('#0a1420'); E.grid(40,'rgba(0,212,255,.06)'); c.restore();
    E.ring(z.x,z.y,z.r,'#00d4ff',4);
    if(nz) E.ring(nz.x,nz.y,nz.r,'rgba(255,255,255,.3)',2);
    E.o(p.x,p.y,10,'#9dff3d');
    E.rr(20,560,260,20,8,'#1c2338'); E.rr(22,562,256*(hp/100),16,7, hp<35?'#ff3d7f':'#9dff3d');
    E.tx('صحة',150,570,13,'#0b0d14');
    E.hud('النتيجة '+E.score); E.hudL('⏱ '+t.toFixed(1)+'ث / 90');
  }};
}});

G({id:'rhythm-rage', t:'إيقاع بلا رحمة', c:'rage', e:'🥁', tags:['إيقاع','صعب'],
d:'نغمة واحدة فائتة تنهي كل شيء. لا تتابع، لا أخطاء، لا رحمة.',
how:'انقر أو مسافة عند وصول النغمة للدائرة',
make:function(E){
  var notes,t,bpm,hits;
  function reset(){ notes=[]; t=0; bpm=100; hits=0; }
  reset();
  return {
  down:function(){ judge(); },
  key:function(k,d){ if(d&&k===' ')judge(); },
  update:function(dt){
    t+=dt; bpm=100+hits*2.2;
    var beat=60/bpm;
    if(!notes.length||notes[notes.length-1].t< t+2.4)
      notes.push({t:(notes.length?notes[notes.length-1].t:t+2)+beat*E.pick([1,1,1,.5,2])});
    for(var i=notes.length-1;i>=0;i--) if(notes[i].t < t-.14){
      E.shake(18); return E.over('فاتتك نغمة 🥁','أصبت '+hits+' نغمة'); } },
  draw:function(c){
    E.bg('#12081a');
    E.ring(400,300,80,'#7c5cff',5);
    notes.forEach(function(n){ var d=n.t-t; if(d<0||d>2.4)return;
      var r=80+d*260; E.ring(400,300,r,'rgba(0,212,255,'+E.cl(1-d/2.4,.1,1)+')',3); });
    E.o(400,300,26,'#ffc93d');
    E.tx('نغمات: '+hits,400,90,32,'#dfe6ff');
    E.tx('السرعة '+bpm.toFixed(0)+' BPM',400,520,20,'#98a0b8');
    E.hud('النتيجة '+E.score);
  }};
  function judge(){
    if(!notes.length)return;
    var d=Math.abs(notes[0].t-t);
    if(d<.14){ notes.shift(); hits++; E.add(50+hits*3); E.s('pop'); E.note(440+hits*8,.1);
      E.burst(400,300,['#9dff3d'],10,150);
      if(hits>=50) E.won('خمسون نغمة مثالية! 🥁','أذن ذهبية'); }
    else { E.shake(16); E.over('نقرة في الوقت الخطأ','أصبت '+hits+' نغمة'); } }
}});

G({id:'mirror-twin', t:'التوأم المرآة', c:'rage', e:'🪞', tags:['تنسيق','دماغ'],
d:'تتحكم بشخصيتين معاً — الثانية تتحرك عكسك تماماً. أوصلهما للهدفين.',
how:'الأسهم تحرّك الاثنين',
make:function(E){
  var a,b,ga,gb,walls,lvl,t;
  function gen(){ walls=[];
    for(var i=0;i<4+lvl*2;i++) walls.push({x:E.rnd(120,660),y:E.rnd(80,500),w:E.rnd(30,150),h:E.rnd(20,120)});
    a={x:100,y:120}; b={x:700,y:480}; ga={x:700,y:120}; gb={x:100,y:480}; t=30+lvl*4; }
  function reset(){ lvl=1; gen(); }
  reset();
  function tryMove(o,dx,dy){
    var nx=E.cl(o.x+dx,14,786), ny=E.cl(o.y+dy,14,586);
    var bad=walls.some(function(w){ return nx>w.x-14&&nx<w.x+w.w+14&&ny>w.y-14&&ny<w.y+w.h+14; });
    if(!bad){ o.x=nx; o.y=ny; } }
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.over('نفد الوقت','المرحلة '+lvl);
    var dx=E.kx()*230*dt, dy=E.ky()*230*dt;
    if(E.m.down){ dx=E.cl((E.m.x-a.x)/40,-1,1)*230*dt; dy=E.cl((E.m.y-a.y)/40,-1,1)*230*dt; }
    if(dx||dy){ tryMove(a,dx,dy); tryMove(b,-dx,-dy); }
    if(E.dist(a.x,a.y,ga.x,ga.y)<24&&E.dist(b.x,b.y,gb.x,gb.y)<24){
      E.add(250+Math.floor(t)*10); E.s('win'); lvl++;
      if(lvl>6) return E.won('توأم متناغم! 🪞','ست مراحل'); gen(); } },
  draw:function(c){
    E.bg('#0c101c');
    walls.forEach(function(w){ E.rr(w.x,w.y,w.w,w.h,6,'#39406b'); });
    E.ring(ga.x,ga.y,22,'#00d4ff',3); E.ring(gb.x,gb.y,22,'#ff3d7f',3);
    E.o(a.x,a.y,13,'#00d4ff'); E.o(b.x,b.y,13,'#ff3d7f');
    E.hudL('مرحلة '+lvl); E.hud('⏱ '+Math.max(0,t).toFixed(0), t<8?'#ff3d7f':'#fff');
  }};
}});
