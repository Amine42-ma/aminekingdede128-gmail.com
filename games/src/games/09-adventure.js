/* ============ 9) مغامرة ومنصات وقتال ============ */

G({id:'platform-world', t:'عالم المنصّات', c:'action', e:'🎮', tags:['منصات','مغامرة'],
d:'منصات كلاسيكية بمستويات مولّدة: اجمع العملات، تفادَ الأعداء، صِل للراية.',
how:'← → للحركة · ↑ أو مسافة للقفز',
make:function(E){
  var p,plats,coins,foes,flag,lvl,cam;
  function gen(){ plats=[{x:0,y:540,w:260,h:60}]; coins=[]; foes=[];
    var x=260,y=540;
    for(var i=0;i<14;i++){ x+=E.rnd(90,190); y=E.cl(y+E.rnd(-110,90),260,540);
      var w=E.rnd(90,190); plats.push({x:x,y:y,w:w,h:24});
      if(Math.random()<.75) coins.push({x:x+w/2,y:y-40,got:false});
      if(Math.random()<.45&&i>1) foes.push({x:x+20,y:y-22,w:w-40,ox:x+20,dir:1,sp:E.rnd(40,90)});
      x+=w; }
    flag={x:x+60,y:y-60}; plats.push({x:x+20,y:y,w:160,h:24});
    p={x:60,y:480,vx:0,vy:0,g:false}; cam=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  key:function(k,d){ if(d&&(k===' '||k==='ArrowUp')&&p.g){ p.vy=-620; p.g=false; E.s('jump'); } },
  down:function(x,y){ if(p.g){ p.vy=-620; p.g=false; E.s('jump'); } },
  update:function(dt){
    var kx=E.kx();
    if(E.m.down&&Math.abs(E.m.x-400)>60) kx=E.m.x>400?1:-1;
    p.vx=E.lerp(p.vx,kx*280,dt*12);
    p.vy+=1500*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.g=false;
    plats.forEach(function(pl){
      if(p.x+16>pl.x&&p.x-16<pl.x+pl.w&&p.y+20>pl.y&&p.y+20<pl.y+pl.h+24&&p.vy>=0){
        p.y=pl.y-20; p.vy=0; p.g=true; } });
    if(p.y>700) return E.over('سقطت في الهاوية','المستوى '+lvl);
    coins.forEach(function(c2){ if(!c2.got&&E.dist(p.x,p.y,c2.x,c2.y)<28){ c2.got=true; E.add(50); E.s('coin'); } });
    foes.forEach(function(f){ f.x+=f.dir*f.sp*dt;
      if(f.x<f.ox||f.x>f.ox+f.w)f.dir*=-1;
      if(Math.abs(f.x-p.x)<24&&Math.abs(f.y-p.y)<30){
        if(p.vy>140){ f.dead=true; p.vy=-420; E.add(120); E.s('pop'); }
        else if(!f.dead){ E.shake(18); E.over('لمسك العدو','المستوى '+lvl); } } });
    for(var i=foes.length-1;i>=0;i--) if(foes[i].dead)foes.splice(i,1);
    if(E.dist(p.x,p.y,flag.x,flag.y)<40){ E.add(300); E.s('win'); lvl++;
      if(lvl>6) return E.won('أنهيت العالم! 🎮','ستة مستويات'); gen(); }
    cam=E.lerp(cam,Math.max(0,p.x-300),dt*6); },
  draw:function(c){
    E.sky('#2a4a7a','#0d1730');
    c.save(); c.translate(-cam,0);
    plats.forEach(function(pl){ E.rr(pl.x,pl.y,pl.w,pl.h,6,'#3d6b2a'); E.r(pl.x,pl.y,pl.w,6,'#5fa63d'); });
    coins.forEach(function(c2){ if(!c2.got) E.spr('🪙',c2.x,c2.y+Math.sin(E.time*4)*4,26); });
    foes.forEach(function(f){ E.spr('👹',f.x,f.y,32); });
    E.spr('🚩',flag.x,flag.y,44);
    E.rr(p.x-15,p.y-20,30,40,7,'#00d4ff'); E.o(p.x,p.y-26,11,'#ffd9a0');
    c.restore();
    E.hudL('مستوى '+lvl); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'ninja-rope', t:'حبل النينجا', c:'action', e:'🥷', tags:['تأرجح','مهارة'],
d:'أطلق حبلك على نقاط التعليق وتأرجح عبر المدينة دون أن تلمس الأرض.',
how:'اضغط لإطلاق الحبل · أفلت للانطلاق', noPad:true,
make:function(E){
  var p,anchors,rope,scroll,best;
  function reset(){ p={x:200,y:200,vx:220,vy:0}; rope=null; scroll=0; best=0;
    anchors=[]; for(var i=0;i<12;i++) anchors.push({x:300+i*E.rnd(190,300),y:E.rnd(60,220)}); }
  reset();
  return {
  down:function(x,y){
    var best2=null,bd=1e9;
    anchors.forEach(function(a){ var ax=a.x-scroll; if(ax<p.x-40)return;
      var d=E.dist(p.x,p.y,ax,a.y); if(d<420&&d<bd){bd=d;best2=a;} });
    if(best2){ rope={a:best2,L:bd}; E.s('swish'); } },
  up:function(){ if(rope){ rope=null; E.s('pop'); } },
  key:function(k,d){ if(k===' '){ if(d)this.down(400,300); else this.up(); } },
  update:function(dt){
    p.vy+=1150*dt;
    if(rope){ var ax=rope.a.x-scroll, ay=rope.a.y;
      var dx=p.x-ax, dy=p.y-ay, d=Math.sqrt(dx*dx+dy*dy)||1;
      if(d>rope.L){ var nx=dx/d, ny=dy/d;
        p.x=ax+nx*rope.L; p.y=ay+ny*rope.L;
        var dot=p.vx*nx+p.vy*ny; p.vx-=dot*nx; p.vy-=dot*ny; p.vx*=1.001; } }
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.x>320){ var d2=p.x-320; p.x=320; scroll+=d2; }
    E.setScore(Math.floor(scroll/10));
    if(p.y>560) return E.over('سقطت على الأرض','قطعت '+E.score+' متراً');
    if(p.y<-100) p.y=-100;
    while(anchors.length&&anchors[0].x-scroll<-120){ anchors.shift();
      var last=anchors[anchors.length-1];
      anchors.push({x:last.x+E.rnd(200,330),y:E.rnd(50,240)}); } },
  draw:function(c){
    E.sky('#101a3a','#050810');
    for(var i=0;i<10;i++){ var bx=((i*220)-scroll*.3)%1000-100;
      E.r(bx,340+((i*97)%120),120,300,'#1a2340'); }
    anchors.forEach(function(a){ var ax=a.x-scroll; if(ax<-40||ax>840)return;
      E.o(ax,a.y,9,'#ffc93d'); E.ring(ax,a.y,16,'rgba(255,201,61,.3)',2); });
    if(rope) E.ln(p.x,p.y,rope.a.x-scroll,rope.a.y,'#e8ecff',2);
    E.r(0,568,800,32,'#2a1a20');
    E.spr('🥷',p.x,p.y,36,Math.atan2(p.vy,p.vx)*.3);
    E.hud(E.score+' م');
  }};
}});

G({id:'wall-climb', t:'القفز بين الجدران', c:'action', e:'🧗', tags:['صعود','مهارة'],
d:'اقفز من جدار لجدار صعوداً، والحمم ترتفع خلفك بلا توقّف.',
how:'انقر أو مسافة للقفز نحو الجدار الآخر',
make:function(E){
  var p,side,lava,h,obs;
  function reset(){ p={y:480,vy:0}; side=-1; lava=640; h=0;
    obs=[]; for(var i=0;i<10;i++) obs.push({y:-i*260-200,s:E.pick([-1,1])}); }
  reset();
  function jump(){ side*=-1; p.vy=-360; E.s('jump'); }
  return {
  down:jump, key:function(k,d){ if(d&&(k===' '||k==='ArrowUp'))jump(); },
  update:function(dt){
    p.vy+=900*dt; p.y+=p.vy*dt;
    if(p.y<300){ var d=300-p.y; p.y=300; h+=d; lava+=d; obs.forEach(function(o){ o.y+=d; }); }
    lava-=(40+h*.02)*dt;
    E.setScore(Math.floor(h/10));
    if(p.y>lava-20) return E.over('ابتلعتك الحمم','ارتفعت '+E.score+' متراً');
    obs.forEach(function(o){ if(o.y>-80&&o.y<640){
      var ox=o.s<0?110:690;
      if(Math.abs(o.y-p.y)<28&&((o.s<0&&side<0)||(o.s>0&&side>0))){
        E.shake(16); E.over('اصطدمت بالشوكة','ارتفعت '+E.score+' متراً'); } }
      if(o.y>700){ o.y-=10*260; o.s=E.pick([-1,1]); } });
    if(h/10>=500) E.won('وصلت للقمة! 🧗','٥٠٠ متر'); },
  draw:function(c){
    E.sky('#2a1220','#0a0508');
    E.r(0,0,90,600,'#3a3550'); E.r(710,0,90,600,'#3a3550');
    obs.forEach(function(o){ if(o.y<-60||o.y>640)return;
      var ox=o.s<0?90:670; E.poly([[ox,o.y-16],[ox,o.y+16],[ox+(o.s<0?40:-40),o.y]],'#ff3d7f'); });
    E.r(0,lava,800,700,'#ff5c2e'); E.r(0,lava,800,8,'#ffc93d');
    var px=side<0?110:690;
    E.spr('🧗',px,p.y,38);
    E.hud(E.score+' م'); E.hudL('الحمم على بعد '+Math.max(0,Math.round((lava-p.y)/10))+' م','#ff9f3d');
  }};
}});

G({id:'dungeon', t:'زنزانة الخطوات', c:'brain', e:'🗡️', tags:['مغامرة','تكتيك'],
d:'روغلايت بالأدوار: كل خطوة يتحرك الوحوش أيضاً. اقتل، اجمع، وانزل أعمق.',
how:'الأسهم للتحرك والهجوم',
make:function(E){
  var W=15,H=11,m,p,mobs,items,depth,msg,mt;
  function gen(){ m=[]; for(var y=0;y<H;y++){ m.push([]); for(var x=0;x<W;x++)
      m[y].push((x===0||y===0||x===W-1||y===H-1||(Math.random()<.16&&x>1&&y>1))?1:0); }
    p={x:1,y:1,hp:20+depth*2,atk:3+Math.floor(depth/2)};
    if(window._pHP) p.hp=window._pHP;
    m[1][1]=0; m[H-2][W-2]=2;
    mobs=[]; for(var i=0;i<3+depth;i++){ var x2=E.ri(3,W-2),y2=E.ri(2,H-2);
      if(m[y2][x2]===0) mobs.push({x:x2,y:y2,hp:3+depth,atk:1+Math.floor(depth/2),e:E.pick(['👺','🕷️','🦇','👻'])}); }
    items=[]; for(var j=0;j<2;j++){ var x3=E.ri(2,W-2),y3=E.ri(1,H-2);
      if(m[y3][x3]===0) items.push({x:x3,y:y3,t:Math.random()<.5?'hp':'atk'}); }
    msg=''; mt=0; }
  function reset(){ depth=1; window._pHP=null; gen(); }
  reset();
  function step(dx,dy){
    var nx=p.x+dx, ny=p.y+dy;
    if(m[ny]&&m[ny][nx]===1)return;
    var mob=mobs.filter(function(o){return o.x===nx&&o.y===ny;})[0];
    if(mob){ mob.hp-=p.atk; E.s('hit'); E.burst(nx*52+26,ny*52+40,['#ff3d7f'],8);
      if(mob.hp<=0){ mobs.splice(mobs.indexOf(mob),1); E.add(50*depth); msg='قتلت وحشاً!'; mt=1.4; } }
    else { p.x=nx; p.y=ny; E.s('tick'); }
    items.forEach(function(it,i){ if(it.x===p.x&&it.y===p.y){
      if(it.t==='hp'){ p.hp+=8; msg='+٨ صحة'; } else { p.atk+=1; msg='+١ قوة'; }
      mt=1.4; E.s('power'); items.splice(i,1); } });
    if(m[p.y][p.x]===2){ depth++; E.add(200); E.s('win'); window._pHP=p.hp+5;
      if(depth>7) return E.won('خرجت من الزنزانة! 🗡️','سبعة طوابق'); gen(); return; }
    mobs.forEach(function(o){
      var d=Math.abs(o.x-p.x)+Math.abs(o.y-p.y);
      if(d===1){ p.hp-=o.atk; E.s('buzz'); E.shake(6);
        if(p.hp<=0){ E.over('متّ في الطابق '+depth,'النتيجة '+E.score); } return; }
      if(d<7){ var ox=Math.sign(p.x-o.x), oy=Math.sign(p.y-o.y);
        var tx=o.x+(Math.abs(p.x-o.x)>Math.abs(p.y-o.y)?ox:0), ty=o.y+(Math.abs(p.x-o.x)>Math.abs(p.y-o.y)?0:oy);
        if(m[ty]&&m[ty][tx]!==1&&!mobs.some(function(q){return q!==o&&q.x===tx&&q.y===ty;})&&!(tx===p.x&&ty===p.y)){ o.x=tx; o.y=ty; } } }); }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')step(-1,0); if(k==='ArrowRight')step(1,0);
    if(k==='ArrowUp')step(0,-1); if(k==='ArrowDown')step(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))step(dx>0?1:-1,0); else step(0,dy>0?1:-1); },
  update:function(dt){ if(mt>0)mt-=dt; },
  draw:function(c){
    E.bg('#0a0910');
    var S=52,OY=40;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){
      E.rr(x*S+11,OY+y*S+2,S-4,S-4,5, m[y][x]===1?'#33304a':m[y][x]===2?'#2f7a4d':'#16141f');
      if(m[y][x]===2) E.spr('🪜',x*S+11+S/2,OY+y*S+S/2,26); }
    items.forEach(function(it){ E.spr(it.t==='hp'?'❤️':'⚔️',it.x*S+11+S/2,OY+it.y*S+S/2,26); });
    mobs.forEach(function(o){ E.spr(o.e,o.x*S+11+S/2,OY+o.y*S+S/2,32);
      E.tx(o.hp,o.x*S+11+S/2,OY+o.y*S+S-6,12,'#ff9f3d'); });
    E.spr('🧝',p.x*S+11+S/2,OY+p.y*S+S/2,32);
    E.hudL('❤️ '+p.hp+'  ⚔️ '+p.atk+'  🕳️ طابق '+depth); E.hud('النتيجة '+E.score);
    if(mt>0) E.tx(msg,400,585,20,'#ffc93d');
  }};
}});

G({id:'tower-def', t:'دفاع البرج', c:'action', e:'🏹', tags:['تكتيك','دفاع'],
d:'ابنِ أبراجاً على المسار وأوقف موجات الأعداء قبل وصولها لقلعتك.',
how:'انقر مكاناً لبناء برج (٥٠ ذهباً)', noPad:true,
make:function(E){
  var path,towers,foes,gold,hp,wave,t,spawned;
  function reset(){ path=[{x:0,y:300}];
    var x=0,y=300;
    while(x<800){ x+=E.rnd(90,160); y=E.cl(y+E.rnd(-140,140),70,530); path.push({x:x,y:y}); }
    towers=[]; foes=[]; gold=120; hp=20; wave=1; t=0; spawned=0; }
  reset();
  function onPath(x,y){ for(var i=0;i<path.length-1;i++){
      var a=path[i],b=path[i+1], dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1;
      var tt=E.cl(((x-a.x)*dx+(y-a.y)*dy)/L,0,1);
      if(E.dist(x,y,a.x+dx*tt,a.y+dy*tt)<42)return true; }
    return false; }
  return {
  down:function(x,y){
    if(gold<50||onPath(x,y))
      { E.s('buzz'); return; }
    if(towers.some(function(tw){return E.dist(x,y,tw.x,tw.y)<44;})){ E.s('buzz'); return; }
    towers.push({x:x,y:y,cd:0,r:120,dmg:2+Math.floor(wave/3)}); gold-=50; E.s('power'); },
  update:function(dt){
    t+=dt;
    if(spawned<4+wave*2&&t>.8){ t=0; spawned++;
      foes.push({i:0,p:0,hp:6+wave*4,mx:6+wave*4,sp:38+wave*3,e:E.pick(['👾','👹','🐗','🦂'])}); }
    foes.forEach(function(f){
      var a=path[f.i], b=path[f.i+1];
      if(!b){ hp--; f.dead=true; E.s('buzz'); E.shake(10); return; }
      var d=E.dist(a.x,a.y,b.x,b.y);
      f.p+=f.sp*dt/d;
      if(f.p>=1){ f.p=0; f.i++; }
      f.x=E.lerp(a.x,b.x,f.p); f.y=E.lerp(a.y,b.y,f.p); });
    towers.forEach(function(tw){ tw.cd-=dt;
      if(tw.cd>0)return;
      for(var i=0;i<foes.length;i++){ var f=foes[i];
        if(f.dead||f.x==null)continue;
        if(E.dist(tw.x,tw.y,f.x,f.y)<tw.r){ f.hp-=tw.dmg; tw.cd=.5; tw.shot={x:f.x,y:f.y,t:.12};
          E.s('laser');
          if(f.hp<=0){ f.dead=true; gold+=12+wave; E.add(30); E.burst(f.x,f.y,['#ffc93d'],10); }
          break; } } });
    for(var i=foes.length-1;i>=0;i--) if(foes[i].dead)foes.splice(i,1);
    if(hp<=0) return E.over('سقطت القلعة','صمدت '+wave+' موجات');
    if(!foes.length&&spawned>=4+wave*2){ wave++; spawned=0; gold+=60; E.add(150); E.s('win');
      if(wave>10) return E.won('صددت كل الموجات! 🏹','عشر موجات'); } },
  draw:function(c){
    E.bg('#122a18');
    c.strokeStyle='#5a4a2a'; c.lineWidth=44; c.lineJoin='round'; c.beginPath();
    path.forEach(function(p,i){ i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y); }); c.stroke();
    towers.forEach(function(tw){ E.alpha(.08,function(){ E.o(tw.x,tw.y,tw.r,'#00d4ff'); });
      E.spr('🏹',tw.x,tw.y,34);
      if(tw.shot&&tw.shot.t>0){ E.ln(tw.x,tw.y,tw.shot.x,tw.shot.y,'#9dff3d',2); tw.shot.t-=.02; } });
    foes.forEach(function(f){ if(f.x==null)return; E.spr(f.e,f.x,f.y,30);
      E.r(f.x-16,f.y-24,32,5,'#3a2030'); E.r(f.x-16,f.y-24,32*(f.hp/f.mx),5,'#9dff3d'); });
    E.spr('🏰',770,path[path.length-1].y,42);
    E.hudL('💰 '+gold+'  ❤️ '+hp+'  موجة '+wave); E.hud('النتيجة '+E.score);
    E.tx('برج = ٥٠ ذهباً · لا تبنِ على المسار',400,580,15,'#98a0b8');
  }};
}});

G({id:'bullet-hell', t:'جحيم الرصاص', c:'shoot', e:'💠', tags:['تفادي','صعب'],
d:'أنماط رصاص هندسية تملأ الشاشة. سفينتك صغيرة… ونقطة إصابتك أصغر.',
how:'الأسهم أو الفأرة للحركة',
make:function(E){
  var p,bs,t,pat,pt,boss;
  function reset(){ p={x:400,y:480}; bs=[]; t=0; pat=0; pt=0; boss={x:400,y:120,hp:600,mx:600}; }
  reset();
  function shoot(){
    var n,a0;
    if(pat===0){ for(var i=0;i<18;i++){ var a=i/18*6.283+t*.6;
        bs.push({x:boss.x,y:boss.y,vx:Math.cos(a)*130,vy:Math.sin(a)*130,c:'#ff3d7f'}); } }
    else if(pat===1){ for(var j=0;j<7;j++){ var a2=Math.atan2(p.y-boss.y,p.x-boss.x)+(j-3)*.16;
        bs.push({x:boss.x,y:boss.y,vx:Math.cos(a2)*230,vy:Math.sin(a2)*230,c:'#00d4ff'}); } }
    else if(pat===2){ for(var k=0;k<10;k++){ var a3=t*2+k*.628;
        bs.push({x:boss.x,y:boss.y,vx:Math.cos(a3)*170,vy:Math.sin(a3)*170,c:'#ffc93d'}); } }
    else { for(var q=0;q<14;q++){ var x=q*57+20;
        bs.push({x:x,y:-10,vx:0,vy:180+Math.sin(q+t)*60,c:'#c93dff'}); } }
    E.s('laser'); }
  return {
  update:function(dt){
    t+=dt; pt+=dt;
    if(pt>6){ pt=0; pat=(pat+1)%4; E.s('alarm'); }
    if(Math.random()<dt*3.4) shoot();
    boss.x=400+Math.sin(t*.8)*220;
    if(E.kx()||E.ky()){ p.x=E.cl(p.x+E.kx()*260*dt,10,790); p.y=E.cl(p.y+E.ky()*260*dt,10,590); }
    else { p.x+=(E.m.x-p.x)*Math.min(1,dt*10); p.y+=(E.m.y-p.y)*Math.min(1,dt*10); }
    boss.hp-=dt*22; E.add(Math.round(18*dt));
    if(boss.hp<=0) return E.won('هزمت الزعيم! 💠','نجوت من الجحيم');
    for(var i=bs.length-1;i>=0;i--){ var b=bs[i]; b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.x<-30||b.x>830||b.y<-30||b.y>630){ bs.splice(i,1); continue; }
      if(E.dist(b.x,b.y,p.x,p.y)<9){ E.shake(24); E.burst(p.x,p.y,['#fff','#ff3d7f'],26);
        return E.over('أصابك الرصاص','صمدت '+t.toFixed(1)+' ثانية'); } } },
  draw:function(c){
    E.bg('#07060f');
    bs.forEach(function(b){ E.o(b.x,b.y,6,b.c); E.o(b.x,b.y,2.5,'#fff'); });
    E.spr('👁️',boss.x,boss.y,64);
    E.r(200,30,400,10,'#3a2030'); E.r(200,30,400*(boss.hp/boss.mx),10,'#ff3d7f');
    E.rr(p.x-13,p.y-13,26,26,6,'rgba(0,212,255,.35)');
    E.o(p.x,p.y,4,'#fff');
    E.hud('النتيجة '+E.score); E.hudL('نمط '+(pat+1)+'/4');
  }};
}});

G({id:'boss-duel', t:'نزال الزعيم', c:'action', e:'🐉', tags:['أنماط','قتال'],
d:'تنين بثلاث مراحل ولكل مرحلة نمط هجوم مختلف. احفظ الأنماط أو مُت.',
how:'← → للحركة · ↑ للقفز · مسافة للهجوم',
make:function(E){
  var p,boss,atks,phase,cd;
  function reset(){ p={x:400,y:500,vy:0,g:true,hp:5,inv:0};
    boss={hp:100,mx:100,x:400,t:0,state:'idle',st:0}; atks=[]; phase=1; cd=0; }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if((k===' ')&&p.g)attack();
    if((k==='ArrowUp')&&p.g){ p.vy=-620; p.g=false; E.s('jump'); } },
  down:function(x,y){ if(y<400&&p.g){ p.vy=-620; p.g=false; E.s('jump'); } else attack(); },
  update:function(dt){
    if(p.inv>0)p.inv-=dt;
    p.x=E.cl(p.x+E.kx()*300*dt,20,780);
    p.vy+=1500*dt; p.y+=p.vy*dt;
    if(p.y>500){p.y=500;p.vy=0;p.g=true;}
    boss.t+=dt; boss.st-=dt;
    phase = boss.hp>66?1:boss.hp>33?2:3;
    if(boss.st<=0){ boss.st=Math.max(.7,1.8-phase*.3);
      var r=E.ri(0,2+phase);
      if(r===0){ for(var i=0;i<3+phase;i++) atks.push({x:boss.x,y:150,vx:E.rnd(-180,180),vy:E.rnd(120,260),t:'fire'}); }
      else if(r===1){ atks.push({x:p.x,y:-20,vx:0,vy:340,t:'drop'}); }
      else if(r===2){ atks.push({x:boss.x,y:470,vx:(p.x>boss.x?1:-1)*300,vy:0,t:'wave'}); }
      else { for(var j=0;j<8;j++) atks.push({x:j*100+50,y:-20,vx:0,vy:220+phase*40,t:'rain'}); }
      E.s('boom'); }
    boss.x=400+Math.sin(boss.t*(.6+phase*.3))*260;
    for(var k=atks.length-1;k>=0;k--){ var a=atks[k];
      a.x+=a.vx*dt; a.y+=a.vy*dt;
      if(a.t==='fire')a.vy+=400*dt;
      if(a.y>620||a.x<-40||a.x>840){ atks.splice(k,1); continue; }
      if(p.inv<=0&&Math.abs(a.x-p.x)<22&&Math.abs(a.y-p.y)<32){
        p.hp--; p.inv=1.2; E.shake(16); E.s('hit'); atks.splice(k,1);
        if(p.hp<=0) return E.over('هزمك التنين 🐉','أضعفته إلى '+Math.round(boss.hp)+'٪'); } }
    if(cd>0)cd-=dt; },
  draw:function(c){
    E.sky(phase===3?'#3a1020':phase===2?'#2a1428':'#141a3a','#07060f');
    E.r(0,530,800,70,'#2b2030');
    atks.forEach(function(a){ E.spr(a.t==='fire'?'🔥':a.t==='drop'?'☄️':a.t==='wave'?'💨':'🪨',a.x,a.y,30); });
    E.spr('🐉',boss.x,140,84);
    E.r(180,40,440,14,'#3a2030'); E.r(180,40,440*(boss.hp/boss.mx),14,'#ff3d7f');
    E.tx('المرحلة '+phase,400,70,18,'#ffc93d');
    if(p.inv<=0||Math.sin(E.time*22)>0){ E.rr(p.x-14,p.y-34,28,36,7,'#00d4ff'); }
    if(cd>0){ E.ln(p.x,p.y-20,p.x+(E.kx()>=0?70:-70),p.y-20,'#ffc93d',6); }
    E.hudL('❤️'.repeat(Math.max(0,p.hp))); E.hud('النتيجة '+E.score);
  }};
  function attack(){ if(cd>0)return; cd=.35; E.s('swish');
    if(Math.abs(boss.x-p.x)<110&&p.y<400){ boss.hp-=4; E.add(60); E.s('hit'); E.burst(boss.x,160,['#ffc93d'],10);
      if(boss.hp<=0) E.won('قتلت التنين! 🐉','بطل حقيقي'); }
    else if(Math.abs(boss.x-p.x)<90){ boss.hp-=1.5; E.add(20); E.s('hit'); } }
}});

G({id:'stealth', t:'التسلل', c:'action', e:'🕵️', tags:['تخفٍّ','تخطيط'],
d:'حرّاس بمخاريط رؤية دوّارة. اسرق الحقيبة واخرج دون أن تُرى.',
how:'الأسهم للحركة البطيئة الآمنة',
make:function(E){
  var p,guards,bag,exit,lvl,seen;
  function gen(){ p={x:60,y:540}; bag={x:E.rnd(300,700),y:E.rnd(60,280),got:false};
    exit={x:740,y:540};
    guards=[]; for(var i=0;i<2+lvl;i++) guards.push({x:E.rnd(160,700),y:E.rnd(80,500),
      a:E.rnd(0,6.28), sp:E.rnd(.5,1.2)*(Math.random()<.5?1:-1), r:190, fov:.6});
    seen=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  update:function(dt){
    var kx=E.kx(), ky=E.ky();
    if(E.m.down){ kx=E.cl((E.m.x-p.x)/50,-1,1); ky=E.cl((E.m.y-p.y)/50,-1,1); }
    p.x=E.cl(p.x+kx*170*dt,14,786); p.y=E.cl(p.y+ky*170*dt,14,586);
    guards.forEach(function(g){ g.a+=g.sp*dt;
      var d=E.dist(p.x,p.y,g.x,g.y);
      if(d<g.r){ var ang=Math.atan2(p.y-g.y,p.x-g.x);
        var diff=Math.abs(((ang-g.a+9.42)%6.283)-3.14159);
        if(diff>3.14159-g.fov){ seen+=dt;
          if(seen>.55){ E.shake(18); E.s('alarm'); E.over('رآك الحارس! 🕵️','المرحلة '+lvl); } } } });
    seen=Math.max(0,seen-dt*.6);
    if(!bag.got&&E.dist(p.x,p.y,bag.x,bag.y)<28){ bag.got=true; E.add(200); E.s('coin'); }
    if(bag.got&&E.dist(p.x,p.y,exit.x,exit.y)<32){ E.add(300); E.s('win'); lvl++;
      if(lvl>6) return E.won('لصّ الظلال! 🕵️','ست عمليات'); gen(); } },
  draw:function(c){
    E.bg('#0a0d16');
    guards.forEach(function(g){
      c.save(); c.beginPath(); c.moveTo(g.x,g.y);
      c.arc(g.x,g.y,g.r,g.a-g.fov,g.a+g.fov); c.closePath();
      c.fillStyle='rgba(255,61,127,.15)'; c.fill(); c.restore();
      E.spr('💂',g.x,g.y,34); });
    if(!bag.got) E.spr('💼',bag.x,bag.y,32);
    E.rr(exit.x-24,exit.y-30,48,60,7, bag.got?'#9dff3d':'#39406b'); E.spr('🚪',exit.x,exit.y,30);
    E.o(p.x,p.y,12,'#00d4ff');
    if(seen>0){ E.rr(300,20,200,12,6,'#1c2338'); E.rr(302,22,196*(seen/.55),8,4,'#ff3d7f'); }
    E.hudL('مرحلة '+lvl+(bag.got?' · معك الحقيبة':'')); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'bomber', t:'رجل القنابل', c:'action', e:'💣', tags:['متاهة','انفجار'],
d:'ضع قنابل لتحطيم الصناديق وقتل الأعداء — ولا تنسَ أن تهرب من انفجارك.',
how:'الأسهم للحركة · مسافة لوضع قنبلة',
make:function(E){
  var W=13,H=9,g,p,bombs,fires,foes,lvl;
  function gen(){ g=[]; for(var y=0;y<H;y++){ g.push([]); for(var x=0;x<W;x++){
      var v=(x===0||y===0||x===W-1||y===H-1||(x%2===0&&y%2===0))?1:(Math.random()<.4?2:0);
      if(x<3&&y<3)v=0; g[y].push(v); } }
    p={x:1,y:1}; bombs=[]; fires=[]; foes=[];
    for(var i=0;i<2+lvl;i++){ var fx=E.ri(5,W-2),fy=E.ri(2,H-2);
      if(g[fy][fx]===0) foes.push({x:fx,y:fy,t:0,dir:E.pick([[1,0],[-1,0],[0,1],[0,-1]])}); } }
  function reset(){ lvl=1; gen(); }
  reset();
  function place(){ if(bombs.length>=2)return;
    if(bombs.some(function(b){return b.x===p.x&&b.y===p.y;}))return;
    bombs.push({x:p.x,y:p.y,t:2.2}); E.s('tick'); }
  function boom(b){
    var cells=[{x:b.x,y:b.y}];
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
      for(var i=1;i<=2+Math.floor(lvl/2);i++){ var x=b.x+d[0]*i, y=b.y+d[1]*i;
        if(g[y]===undefined||g[y][x]===1)break;
        cells.push({x:x,y:y});
        if(g[y][x]===2){ g[y][x]=0; E.add(20); break; } } });
    cells.forEach(function(c2){ fires.push({x:c2.x,y:c2.y,t:.45}); });
    E.s('boom'); E.shake(10); }
  return {
  key:function(k,d){ if(!d)return;
    if(k===' ')return place();
    var o={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
    if(!o)return; var nx=p.x+o[0], ny=p.y+o[1];
    if(g[ny]&&g[ny][nx]===0&&!bombs.some(function(b){return b.x===nx&&b.y===ny;})){ p.x=nx; p.y=ny; } },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y;
    if(Math.abs(dx)+Math.abs(dy)<20){ place(); return; }
    this.key(Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'),true); },
  update:function(dt){
    for(var i=bombs.length-1;i>=0;i--){ bombs[i].t-=dt;
      if(bombs[i].t<=0){ boom(bombs[i]); bombs.splice(i,1); } }
    for(var j=fires.length-1;j>=0;j--){ var f=fires[j]; f.t-=dt;
      if(f.x===p.x&&f.y===p.y) return E.over('انفجرت قنبلتك عليك 💥','المرحلة '+lvl);
      for(var k=foes.length-1;k>=0;k--) if(foes[k].x===f.x&&foes[k].y===f.y){
        foes.splice(k,1); E.add(120); E.s('coin'); }
      if(f.t<=0)fires.splice(j,1); }
    foes.forEach(function(o){ o.t+=dt;
      if(o.t>.55){ o.t=0;
        var nx=o.x+o.dir[0], ny=o.y+o.dir[1];
        if(g[ny]&&g[ny][nx]===0) { o.x=nx; o.y=ny; } else o.dir=E.pick([[1,0],[-1,0],[0,1],[0,-1]]);
        if(o.x===p.x&&o.y===p.y) E.over('لمسك عدو','المرحلة '+lvl); } });
    if(!foes.length){ E.add(300); E.s('win'); lvl++;
      if(lvl>6) return E.won('فجّرتهم جميعاً! 💣','ست مراحل'); gen(); } },
  draw:function(c){
    E.bg('#0d1018');
    var S=58,OX=(800-W*S)/2,OY=(600-H*S)/2;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){
      E.rr(OX+x*S+1,OY+y*S+1,S-2,S-2,5, g[y][x]===1?'#4a5480':g[y][x]===2?'#7a5a34':'#1a2036'); }
    bombs.forEach(function(b){ E.spr('💣',OX+b.x*S+S/2,OY+b.y*S+S/2,32+Math.sin(E.time*14)*4); });
    fires.forEach(function(f){ E.rr(OX+f.x*S+2,OY+f.y*S+2,S-4,S-4,5,'rgba(255,120,40,.75)'); });
    foes.forEach(function(o){ E.spr('👾',OX+o.x*S+S/2,OY+o.y*S+S/2,32); });
    E.spr('🧑‍🚀',OX+p.x*S+S/2,OY+p.y*S+S/2,32);
    E.hudL('مرحلة '+lvl+' · أعداء '+foes.length); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'digger', t:'الحفّار', c:'action', e:'⛏️', tags:['تنقيب','مخاطرة'],
d:'احفر عميقاً بحثاً عن الجواهر، لكن الصخور تسقط والأكسجين ينفد.',
how:'الأسهم للحفر في الاتجاهات',
make:function(E){
  var W=16,H=40,g,p,o2,depth,gems;
  function gen(){ g=[]; for(var y=0;y<H;y++){ g.push([]); for(var x=0;x<W;x++){
      var r=Math.random();
      g[y].push(y<3?0 : r<.06?3 : r<.14?2 : r<.9?1 : 0); } }
    p={x:8,y:1}; o2=100; depth=0; gems=0; }
  function reset(){ gen(); }
  reset();
  function dig(dx,dy){
    var nx=p.x+dx, ny=p.y+dy;
    if(nx<0||ny<0||nx>=W||ny>=H)return;
    var v=g[ny][nx];
    if(v===2){ E.s('thud'); return; }
    if(v===3){ gems++; E.add(200); E.s('coin'); E.burst(0,0,['#00d4ff'],1); }
    if(v===1){ E.add(5); E.s('tick'); }
    g[ny][nx]=0; p.x=nx; p.y=ny; depth=Math.max(depth,p.y);
    o2-=1.2;
    for(var y=ny-1;y>=0;y--) if(g[y][nx]===2&&g[y+1][nx]===0){
      g[y][nx]=0; g[y+1][nx]=2;
      if(y+1===p.y&&nx===p.x) return E.over('سحقتك صخرة','عمق '+depth); }
    if(o2<=0) E.over('نفد الأكسجين','عمق '+depth+' · جواهر '+gems);
    if(p.y>=H-1) E.won('وصلت للقاع! ⛏️','جواهر '+gems); }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')dig(-1,0); if(k==='ArrowRight')dig(1,0);
    if(k==='ArrowUp')dig(0,-1); if(k==='ArrowDown')dig(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))dig(dx>0?1:-1,0); else dig(0,dy>0?1:-1); },
  update:function(dt){ o2-=dt*1.6; if(o2<=0) E.over('نفد الأكسجين','عمق '+depth); },
  draw:function(c){
    E.bg('#1a1208');
    var S=44,OX=(800-W*S)/2, cam=E.cl(p.y*S-260,0,H*S-560);
    c.save(); c.translate(0,-cam);
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){ var sy=y*S-cam; if(sy<-60||sy>640)continue;
      var v=g[y][x];
      if(v===0){ E.rr(OX+x*S,y*S,S,S,2,'#0d0a06'); continue; }
      E.rr(OX+x*S+1,y*S+1,S-2,S-2,4, v===2?'#5a5560':'#6b4a24');
      if(v===3) E.spr('💎',OX+x*S+S/2,y*S+S/2,26); }
    E.spr('⛏️',OX+p.x*S+S/2,p.y*S+S/2,30);
    c.restore();
    E.rr(20,560,220,18,8,'#1c2338'); E.rr(22,562,216*(o2/100),14,6, o2<30?'#ff3d7f':'#00d4ff');
    E.tx('أكسجين',130,569,12,'#0b0d14');
    E.hudL('عمق '+depth+' · 💎'+gems); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'fishing', t:'صيّاد الأعماق', c:'sport', e:'🎣', tags:['هدوء','توقيت'],
d:'أنزل الصنّارة واصطد الأسماك… وتجنّب الأحذية القديمة وقنديل البحر.',
how:'انقر لإنزال الصنّارة ثم انقر عند العضّة', noPad:true,
make:function(E){
  var hook,fish,st,caught,t,bite;
  function reset(){ hook={y:120,v:0}; st='idle'; fish=[]; caught=0; t=60; bite=null;
    for(var i=0;i<12;i++) fish.push({x:E.rnd(60,740),y:E.rnd(280,560),v:E.rnd(-70,70),
      t:Math.random()<.2?'boot':Math.random()<.25?'jelly':'fish',e:''}); 
    fish.forEach(function(f){ f.e = f.t==='boot'?'👢':f.t==='jelly'?'🪼':E.pick(['🐟','🐠','🐡','🦐']); }); }
  reset();
  return {
  down:function(){
    if(st==='idle'){ st='down'; E.s('swish'); }
    else if(st==='wait'&&bite){ st='up';
      if(bite.t==='fish'){ caught++; E.add(150); E.s('coin'); }
      else if(bite.t==='boot'){ E.add(-30); E.s('buzz'); }
      else { E.add(-80); E.s('buzz'); E.shake(12); }
      fish.splice(fish.indexOf(bite),1); bite=null;
      fish.push({x:E.rnd(60,740),y:E.rnd(280,560),v:E.rnd(-70,70),
        t:Math.random()<.2?'boot':Math.random()<.25?'jelly':'fish',e:E.pick(['🐟','🐠','🐡','🦐'])}); }
    else if(st==='wait'){ st='up'; E.s('tick'); } },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى اليوم','اصطدت '+caught+' سمكة');
    fish.forEach(function(f){ f.x+=f.v*dt; if(f.x<40||f.x>760)f.v*=-1; });
    if(st==='down'){ hook.y+=230*dt; if(hook.y>520){ st='wait'; } }
    else if(st==='up'){ hook.y-=300*dt; if(hook.y<=120){ hook.y=120; st='idle'; } }
    else if(st==='wait'){
      if(!bite){ for(var i=0;i<fish.length;i++) if(E.dist(fish[i].x,fish[i].y,400,hook.y)<40){ bite=fish[i]; E.s('pop'); break; } }
      else { bite.x=E.lerp(bite.x,400,dt*4); bite.y=E.lerp(bite.y,hook.y,dt*4);
        if(Math.random()<dt*.7){ bite=null; } } } },
  draw:function(c){
    E.sky('#7cc4f0','#0a3050');
    E.r(0,230,800,370,'rgba(10,60,110,.55)');
    E.r(340,60,120,20,'#5a4a2a');
    fish.forEach(function(f){ E.spr(f.e,f.x,f.y,30); });
    E.ln(400,80,400,hook.y,'#e8ecff',1.5); E.spr('🪝',400,hook.y,22);
    E.tx(st==='wait'&&bite?'عضّة! انقر الآن':st==='idle'?'انقر لإنزال الصنّارة':'…',400,150,24, bite?'#9dff3d':'#dfe6ff');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · 🐟 '+caught); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'lumberjack', t:'الحطّاب', c:'speed', e:'🪓', tags:['توقيت','سرعة'],
d:'اقطع الجذع يميناً ويساراً وتفادَ الأغصان. الوقت يجري ضدك دائماً.',
how:'← → لاختيار جهة القطع',
make:function(E){
  var segs,side,t,chops;
  function reset(){ segs=[]; for(var i=0;i<9;i++) segs.push(i<2?0:E.pick([0,0,-1,1]));
    side=-1; t=1; chops=0; }
  reset();
  function chop(s){
    side=s;
    if(segs[0]===s){ E.shake(20); E.s('boom'); return E.over('سحقك الغصن 🪵','قطعت '+chops+' مرة'); }
    segs.shift(); segs.push(E.pick([0,0,0,-1,1]));
    if(segs[0]===s){ E.shake(20); E.s('boom'); return E.over('سحقك الغصن 🪵','قطعت '+chops+' مرة'); }
    chops++; E.add(20); E.s('hit'); t=Math.min(1,t+.14);
    E.burst(400+s*70,470,['#a06a3a'],10); }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')chop(-1); if(k==='ArrowRight')chop(1); },
  down:function(x,y){ chop(x<400?-1:1); },
  update:function(dt){ t-=dt*(.22+chops*.004);
    if(t<=0) E.over('نفد الوقت','قطعت '+chops+' مرة'); },
  draw:function(c){
    E.sky('#2a4a2a','#0d1a12');
    segs.forEach(function(s,i){ var y=470-i*62;
      E.rr(360,y,80,58,6,'#7a5a34'); E.o(400,y+29,16,'#a06a3a');
      if(s) E.rr(s<0?290:440,y+16,72,24,6,'#5a4020'); });
    E.spr('🧔',400+side*80,510,50);
    E.spr('🪓',400+side*44,500,32,side<0?.6:-.6);
    E.rr(250,40,300,22,10,'#1c2338'); E.rr(252,42,296*E.cl(t,0,1),18,8, t<.3?'#ff3d7f':'#9dff3d');
    E.hudL('قطعات '+chops); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'territory', t:'احتلال الأرض', c:'action', e:'🟦', tags:['مساحة','مخاطرة'],
d:'ارسم حلقة لتضم مساحة جديدة لأرضك — لكن إن لمس أحد ذيلك خسرت كل شيء.',
how:'الأسهم للحركة خارج أرضك ثم عُد',
make:function(E){
  var W=40,H=30,S=20,g,p,dir,trail,ai,pct;
  function reset(){ g=[]; for(var i=0;i<W*H;i++)g.push(0);
    p={x:5,y:15}; dir={x:1,y:0}; trail=[];
    for(var y=13;y<18;y++)for(var x=3;x<8;x++)g[y*W+x]=1;
    ai=[]; for(var k=0;k<3;k++) ai.push({x:E.ri(20,38),y:E.ri(2,27),vx:E.rnd(-4,4),vy:E.rnd(-4,4)});
    pct=0; }
  reset();
  var acc=0;
  return {
  key:function(k,d){ if(!d)return;
    var o={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
    if(o&&(dir.x!==-o[0]||dir.y!==-o[1])){ dir={x:o[0],y:o[1]}; } },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    this.key(Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'),true); },
  update:function(dt){
    acc+=dt;
    ai.forEach(function(a){ a.x+=a.vx*dt; a.y+=a.vy*dt;
      if(a.x<1||a.x>W-2)a.vx*=-1; if(a.y<1||a.y>H-2)a.vy*=-1;
      trail.forEach(function(t2){ if(Math.abs(a.x-t2.x)<.9&&Math.abs(a.y-t2.y)<.9){
        E.shake(20); E.s('boom'); E.over('قُطع خطّك','احتللت '+pct.toFixed(1)+'٪'); } }); });
    if(acc<.075)return; acc=0;
    p.x=E.cl(p.x+dir.x,0,W-1); p.y=E.cl(p.y+dir.y,0,H-1);
    if(g[p.y*W+p.x]===1){ if(trail.length){ fill(); } }
    else { if(trail.some(function(t2){return t2.x===p.x&&t2.y===p.y;})){
        E.s('boom'); return E.over('دُست على ذيلك','احتللت '+pct.toFixed(1)+'٪'); }
      trail.push({x:p.x,y:p.y}); } },
  draw:function(c){
    E.bg('#0c1018');
    for(var i=0;i<W*H;i++) if(g[i]) E.r((i%W)*S,((i/W)|0)*S,S,S,'#1e3a8a');
    trail.forEach(function(t2){ E.r(t2.x*S,t2.y*S,S,S,'#6b8cff'); });
    ai.forEach(function(a){ E.o(a.x*S+S/2,a.y*S+S/2,9,'#ff3d7f'); });
    E.r(p.x*S,p.y*S,S,S,'#9dff3d');
    E.hudL('الأرض '+pct.toFixed(1)+'٪'); E.hud('النتيجة '+E.score);
  }};
  function fill(){
    trail.forEach(function(t2){ g[t2.y*W+t2.x]=1; });
    var out=[]; for(var i=0;i<W*H;i++)out.push(false);
    var st=[];
    for(var x=0;x<W;x++){ if(!g[x]){st.push(x);out[x]=true;}
      var b=(H-1)*W+x; if(!g[b]){st.push(b);out[b]=true;} }
    for(var y=0;y<H;y++){ var l=y*W; if(!g[l]){st.push(l);out[l]=true;}
      var r=y*W+W-1; if(!g[r]){st.push(r);out[r]=true;} }
    while(st.length){ var i2=st.pop(), x2=i2%W, y2=(i2/W)|0;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ var nx=x2+d[0],ny=y2+d[1];
        if(nx<0||ny<0||nx>=W||ny>=H)return; var ni=ny*W+nx;
        if(out[ni]||g[ni])return; out[ni]=true; st.push(ni); }); }
    var gained=0;
    for(var k=0;k<W*H;k++) if(!out[k]&&!g[k]){ g[k]=1; gained++; }
    trail=[];
    var owned=g.filter(Boolean).length; pct=owned/(W*H)*100;
    E.setScore(Math.round(pct*100)); E.s('power');
    if(pct>=60) E.won('سيطرت على ٦٠٪! 🟦','ملك الأرض'); }
}});

G({id:'tank-duel', t:'نزال الدبابات', c:'two', e:'🚜', tags:['لاعبان','قذف'],
d:'دبابتان على تضاريس. اضبط الزاوية والقوة وأصب الخصم قبل أن يصيبك.',
how:'الأسهم للزاوية/القوة · مسافة لإطلاق النار',
make:function(E){
  var ter,t1,t2,turn,sh,ang,pw,wind,msg,mt,ai;
  function gen(){ ter=[]; var y=430;
    for(var x=0;x<=800;x+=20){ ter.push(E.cl(y,300,540)); y+=E.rnd(-26,26); }
    t1={x:90,hp:100}; t2={x:710,hp:100}; turn=1; sh=null; ang=45; pw=60;
    wind=E.rnd(-30,30); msg=''; mt=0; ai=true; }
  function reset(){ gen(); }
  reset();
  function gy(x){ var i=E.cl(Math.floor(x/20),0,ter.length-2);
    return E.lerp(ter[i],ter[i+1],(x%20)/20); }
  function fire(){
    if(sh)return;
    var t=turn===1?t1:t2, d=turn===1?1:-1;
    var a=ang*Math.PI/180;
    sh={x:t.x+d*26,y:gy(t.x)-30,vx:Math.cos(a)*pw*d*4.2,vy:-Math.sin(a)*pw*4.2};
    E.s('boom'); E.shake(6); }
  return {
  key:function(k,d){ if(!d)return; if(k===' ')fire();
    if(k==='ArrowUp')ang=Math.min(89,ang+3); if(k==='ArrowDown')ang=Math.max(5,ang-3);
    if(k==='ArrowRight')pw=Math.min(100,pw+4); if(k==='ArrowLeft')pw=Math.max(10,pw-4); },
  down:function(x,y){ if(y>500)fire(); else { ang=E.cl(90-(x/800*90),5,89); pw=E.cl(100-(y/500*100),10,100); } },
  update:function(dt){
    if(mt>0){ mt-=dt; if(mt<=0&&turn===2&&ai) setTimeout(aiTurn,300); return; }
    if(!sh)return;
    sh.vy+=340*dt; sh.vx+=wind*dt;
    sh.x+=sh.vx*dt; sh.y+=sh.vy*dt;
    if(sh.x<-40||sh.x>840){ sh=null; swap(); return; }
    if(sh.y>gy(sh.x)){
      E.burst(sh.x,sh.y,['#ffc93d','#ff6b3d'],22,220); E.s('boom'); E.shake(14);
      var d1=Math.abs(sh.x-t1.x), d2=Math.abs(sh.x-t2.x);
      if(d1<40){ t1.hp-=Math.round(40-d1/2); msg='إصابة في الأزرق!'; }
      else if(d2<40){ t2.hp-=Math.round(40-d2/2); msg='إصابة في الأحمر!'; E.add(120); }
      else msg='أخطأت';
      mt=1.2; sh=null;
      if(t1.hp<=0) return E.over('دُمّرت دبابتك 🚜','حاول ضبط الزاوية');
      if(t2.hp<=0) return E.won('دمّرت الخصم! 🚜','تصويب ممتاز');
      swap(); } },
  draw:function(c){
    E.sky('#4a6ea8','#1a2440');
    c.beginPath(); c.moveTo(0,600);
    ter.forEach(function(y,i){ c.lineTo(i*20,y); }); c.lineTo(800,600); c.closePath();
    c.fillStyle='#3d6b2a'; c.fill();
    E.spr('🚜',t1.x,gy(t1.x)-16,40); E.spr('🚛',t2.x,gy(t2.x)-16,40);
    E.r(t1.x-30,gy(t1.x)-52,60,7,'#3a2030'); E.r(t1.x-30,gy(t1.x)-52,60*(t1.hp/100),7,'#00d4ff');
    E.r(t2.x-30,gy(t2.x)-52,60,7,'#3a2030'); E.r(t2.x-30,gy(t2.x)-52,60*(t2.hp/100),7,'#ff3d7f');
    if(sh) E.o(sh.x,sh.y,5,'#12161f');
    if(turn===1){ var t=t1; E.ln(t.x,gy(t.x)-30,t.x+Math.cos(ang*Math.PI/180)*60,gy(t.x)-30-Math.sin(ang*Math.PI/180)*60,'#ffc93d',4); }
    E.hudL('زاوية '+ang.toFixed(0)+'°  قوة '+pw.toFixed(0)+'  🌬 '+(wind>0?'→':'←')+Math.abs(wind).toFixed(0));
    E.hud(turn===1?'دورك':'دور الخصم', turn===1?'#00d4ff':'#ff3d7f');
    if(mt>0) E.tx(msg,400,120,28,'#ffc93d');
  }};
  function swap(){ turn=turn===1?2:1; wind=E.rnd(-40,40);
    if(turn===2&&ai) setTimeout(aiTurn,500); }
  function aiTurn(){ if(turn!==2)return;
    ang=E.rnd(35,60); pw=E.rnd(48,72); fire(); }
}});
