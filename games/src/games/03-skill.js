/* ============ 3) مهارة وسرعة وفيزياء ============ */

G({id:'reflex', t:'قياس ردّ الفعل', c:'speed', e:'⚡', tags:['سرعة','تركيز'],
d:'انتظر اللون الأخضر ثم انقر بأقصى سرعة. النقر المبكر يُعاقب.',
how:'انقر عندما تصير الشاشة خضراء', noPad:true,
make:function(E){
  var st,wait,t,times,last;
  function reset(){ st='wait'; wait=E.rnd(1.2,4); t=0; times=[]; last=0; }
  reset();
  return {
  down:function(){
    if(st==='wait'){ st='early'; t=0; E.s('buzz'); E.add(-100); }
    else if(st==='go'){ last=Math.round(t*1000); times.push(last);
      E.add(Math.max(10,600-last)); E.s('coin'); st='done'; t=0;
      if(times.length>=5){ var avg=times.reduce(function(a,b){return a+b;},0)/times.length;
        E.won('متوسطك '+avg.toFixed(0)+' ملّي ثانية', avg<250?'ردّ فعل نمر 🐆':avg<400?'بشري عادي 🙂':'هل كنت نائماً؟ 😴'); } }
    else if(st==='done'||st==='early'){ st='wait'; wait=E.rnd(1.2,4); t=0; } },
  update:function(dt){ t+=dt;
    if(st==='wait'&&t>wait){ st='go'; t=0; E.s('blip'); }
    if(st==='go'&&t>2.5){ st='wait'; wait=E.rnd(1,3); t=0; E.add(-50); } },
  draw:function(c){
    E.bg(st==='go'?'#0f9b4a':st==='early'?'#a01f3c':'#16203a');
    var msg = st==='wait'?'انتظر… لا تنقر':st==='go'?'انقر الآن!':st==='early'?'مبكر جداً! انقر للإعادة':'ممتاز! انقر للمحاولة التالية';
    E.tx(msg,400,270,38,'#fff');
    if(last) E.tx(last+' ملّي ثانية',400,330,30,'#ffc93d');
    E.tx('محاولة '+Math.min(5,times.length+1)+' من 5',400,400,20,'rgba(255,255,255,.7)');
    if(times.length) E.tx(times.join(' · ')+' ms',400,450,16,'rgba(255,255,255,.55)');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'aim-lab', t:'مختبر التصويب', c:'speed', e:'🎯', tags:['دقّة','سرعة'],
d:'أهداف تظهر وتتقلّص. اضربها قبل أن تختفي، ولا تضرب الحمراء.',
how:'انقر على الأهداف', noPad:true,
make:function(E){
  var tg,t,left,hits,miss;
  function reset(){ tg=[]; t=0; left=30; hits=0; miss=0; }
  reset();
  function spawn(){ tg.push({x:E.rnd(60,740),y:E.rnd(80,540),r:E.rnd(22,44),l:E.rnd(1.1,2),m:0,bad:Math.random()<.22}); 
    tg[tg.length-1].m=tg[tg.length-1].l; }
  return {
  down:function(x,y){
    for(var i=tg.length-1;i>=0;i--){ var g=tg[i];
      if(E.dist(x,y,g.x,g.y)<g.r*(g.l/g.m)){
        if(g.bad){ E.add(-60); E.s('buzz'); E.shake(10); miss++; }
        else { E.add(Math.round(120-g.r)); hits++; E.s('pop'); E.burst(g.x,g.y,['#9dff3d','#fff'],10); }
        tg.splice(i,1); return; } }
    E.add(-15); miss++; E.s('tick'); },
  update:function(dt){
    t-=dt; left-=dt;
    if(left<=0){ var acc=hits+miss?Math.round(hits/(hits+miss)*100):0;
      return E.won('انتهى الوقت','إصابات '+hits+' · دقّة '+acc+'%'); }
    if(t<=0){ t=E.rnd(.25,.6); spawn(); }
    for(var i=tg.length-1;i>=0;i--){ tg[i].l-=dt; if(tg[i].l<=0){ if(!tg[i].bad){miss++;E.add(-10);} tg.splice(i,1); } }
  },
  draw:function(c){
    E.bg('#0a0d16'); E.grid(50,'rgba(255,255,255,.03)');
    tg.forEach(function(g){ var r=g.r*(g.l/g.m);
      E.o(g.x,g.y,r,g.bad?'#ff3d7f':'#00d4ff');
      E.o(g.x,g.y,r*.62,'#0a0d16'); E.o(g.x,g.y,r*.3,g.bad?'#ff3d7f':'#9dff3d'); });
    E.o(E.m.x,E.m.y,10,'rgba(255,255,255,.15)'); E.ring(E.m.x,E.m.y,12,'#fff',1.5);
    E.hudL('⏱ '+left.toFixed(1)); E.hud('النتيجة '+E.score);
    E.tx('إصابات '+hits+' · أخطاء '+miss,400,575,17,'#98a0b8');
  }};
}});

G({id:'stack-it', t:'برج التكديس', c:'skill', e:'🏗️', tags:['توقيت','ارتفاع'],
d:'أوقف كل طابق فوق الذي قبله. ما يتجاوز الحافة يُقصّ إلى الأبد.',
how:'انقر أو مسافة لإسقاط الطابق',
make:function(E){
  var stack,cur,dir,sp,h,over;
  function reset(){ stack=[{x:300,w:200}]; h=0; sp=200; over=false; newB(); }
  function newB(){ var top=stack[stack.length-1]; cur={x:Math.random()<.5?0:800-top.w,w:top.w};
    dir=cur.x===0?1:-1; sp=200+stack.length*11; }
  reset();
  function place(){
    var top=stack[stack.length-1];
    var l=Math.max(cur.x,top.x), r=Math.min(cur.x+cur.w,top.x+top.w);
    if(r-l<=2){ E.s('lose'); E.shake(16); return E.over('سقط الطابق','ارتفاعك '+stack.length+' طوابق'); }
    var cut=cur.w-(r-l);
    stack.push({x:l,w:r-l});
    if(cut<3){ E.add(50); E.s('power'); E.burst(l+(r-l)/2,420-h,['#9dff3d'],14); }
    else { E.add(10); E.s('thud'); E.burst(cur.x<top.x?l:r,420-h,['#ff9f3d'],7); }
    h+=26; newB();
    if(stack.length>=25) E.won('برج أسطوري! 🏗️','٢٥ طابقاً'); }
  return {
  down:place, key:function(k,d){ if(d&&k===' ')place(); },
  update:function(dt){
    cur.x+=dir*sp*dt;
    if(cur.x<0){cur.x=0;dir=1;} if(cur.x+cur.w>800){cur.x=800-cur.w;dir=-1;} },
  draw:function(c){
    E.sky('#241b4d','#0a0a16');
    var base=Math.min(h,300);
    stack.forEach(function(b,i){ var y=440-(i*26)+base;
      if(y>-30&&y<620) E.rr(b.x,y,b.w,24,4,'hsl('+((i*14)%360)+',68%,58%)'); });
    E.rr(cur.x,440-(stack.length*26)+base,cur.w,24,4,'#fff');
    E.tx('الطوابق: '+stack.length,400,50,26,'#ffc93d');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'knife-hit', t:'اغرس السكين', c:'skill', e:'🔪', tags:['توقيت','دقّة'],
d:'اغرس السكاكين في الجذع الدوّار دون أن تصطدم بسكين سابق.',
how:'انقر أو مسافة لرمي سكين',
make:function(E){
  var kn,fly,a,sp,left,lvl,apples;
  function reset(){ lvl=1; setup(); }
  function setup(){ kn=[]; fly=null; a=0; sp=1.6+lvl*.28; left=6+lvl;
    apples=[]; for(var i=0;i<3;i++) apples.push(E.rnd(0,6.28));
    if(lvl>2) for(var j=0;j<lvl-2;j++) kn.push(E.rnd(0,6.28)); }
  reset();
  function toss(){ if(fly)return; fly={y:520}; E.s('swish'); }
  return {
  down:toss, key:function(k,d){ if(d&&k===' ')toss(); },
  update:function(dt){
    a+=sp*dt*(lvl%3===0?Math.sin(E.time*1.2)*1.4:1);
    if(fly){ fly.y-=900*dt;
      if(fly.y<=330){
        var na=(-a)%6.283; if(na<0)na+=6.283;
        var clash=kn.some(function(k2){ var d=Math.abs(((k2-na+9.42)%6.283)-3.14159); return d>2.95; });
        if(clash){ E.shake(18); E.s('boom'); return E.over('اصطدمت بسكين','المرحلة '+lvl); }
        for(var i=apples.length-1;i>=0;i--){ var d2=Math.abs(((apples[i]-na+9.42)%6.283)-3.14159);
          if(d2>2.9){ apples.splice(i,1); E.add(50); E.s('coin'); E.burst(400,330,['#ff3d7f'],12); } }
        kn.push(na); fly=null; left--; E.add(20); E.s('hit');
        if(left<=0){ lvl++; E.add(150); E.s('win'); if(lvl>8) return E.won('سيّد السكاكين! 🔪','ثماني مراحل'); setup(); } } }
  },
  draw:function(c){
    E.bg('#160f14');
    E.o(400,330,100,'#6b4a2a'); E.ring(400,330,100,'#3d2a18',6); E.o(400,330,62,'#7d5a34');
    for(var i=0;i<8;i++){ var an=a+i*.785; E.ln(400,330,400+Math.cos(an)*55,330+Math.sin(an)*55,'#5c4026',3); }
    kn.forEach(function(k2){ var an=k2+a;
      var x=400+Math.cos(an)*100, y=330+Math.sin(an)*100;
      c.save(); c.translate(x,y); c.rotate(an+1.5708);
      E.r(-3,0,6,44,'#c8cfe0'); E.rr(-5,42,10,22,3,'#2b3350'); c.restore(); });
    apples.forEach(function(k2){ var an=k2+a; E.spr('🍎',400+Math.cos(an)*100,330+Math.sin(an)*100,24); });
    if(fly){ E.r(397,fly.y,6,44,'#c8cfe0'); E.rr(395,fly.y+42,10,22,3,'#2b3350'); }
    else { E.r(397,520,6,44,'#c8cfe0'); E.rr(395,562,10,22,3,'#2b3350'); }
    E.hudL('مرحلة '+lvl+' · متبقٍ '+left); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'stop-bar', t:'أوقفه في المنتصف', c:'skill', e:'📊', tags:['توقيت','أعصاب'],
d:'مؤشّر يتأرجح بسرعة متزايدة، والمنطقة الخضراء تضيق كل جولة.',
how:'انقر أو مسافة لإيقاف المؤشر',
make:function(E){
  var p,dir,sp,zone,round,res,rt;
  function reset(){ round=1; res=''; rt=0; setup(); }
  function setup(){ p=0; dir=1; sp=.9+round*.16; zone=Math.max(.035,.20-round*.014); }
  reset();
  function stop(){
    if(rt>0)return;
    var d=Math.abs(p-.5);
    if(d<zone){ var pts=Math.round((1-d/zone)*100)+50; E.add(pts); res='ممتاز! +'+pts; E.s('coin');
      round++; if(round>12) return E.won('يد ثابتة! 📊','اثنتا عشرة جولة'); }
    else { E.add(-40); res='أخطأت 😖'; E.s('buzz'); E.shake(10);
      if(E.score<0) return E.over('نتيجة سالبة','التوقيت ليس صديقك'); }
    rt=.8; }
  return {
  down:stop, key:function(k,d){ if(d&&k===' ')stop(); },
  update:function(dt){
    if(rt>0){ rt-=dt; if(rt<=0)setup(); return; }
    p+=dir*sp*dt; if(p>1){p=1;dir=-1;} if(p<0){p=0;dir=1;} },
  draw:function(c){
    E.bg('#0c101c');
    var X=100,W=600,Y=300;
    E.rr(X,Y-26,W,52,10,'#1e2540');
    E.rr(X+W*(.5-zone),Y-26,W*zone*2,52,10,'#1f7a4a');
    E.rr(X+W*(.5-zone*.3),Y-26,W*zone*.6,52,10,'#2fbd6f');
    E.r(X+W*p-3,Y-40,6,80,'#fff');
    E.tx('الجولة '+round,400,180,30,'#dfe6ff');
    if(res) E.tx(res,400,400,32, res[0]==='م'?'#9dff3d':'#ff3d7f');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'click-storm', t:'عاصفة النقر', c:'speed', e:'👆', tags:['سرعة','أصابع'],
d:'انقر بأقصى ما تستطيع في ١٠ ثوانٍ — لكن أزراراً وهمية تظهر لتخدعك.',
how:'انقر الزر الأخضر فقط', noPad:true,
make:function(E){
  var t,n,btn,fakes,started;
  function reset(){ t=10; n=0; started=false; place(); }
  function place(){ btn={x:E.rnd(120,680),y:E.rnd(140,480),r:E.rnd(38,62)};
    fakes=[]; var nf=Math.min(4,Math.floor(n/12));
    for(var i=0;i<nf;i++) fakes.push({x:E.rnd(90,710),y:E.rnd(120,500),r:E.rnd(30,55)}); }
  reset();
  return {
  down:function(x,y){
    if(!started){ started=true; }
    if(E.dist(x,y,btn.x,btn.y)<btn.r){ n++; E.add(10); E.s('pop'); E.burst(btn.x,btn.y,['#9dff3d'],7,140); place(); return; }
    for(var i=0;i<fakes.length;i++) if(E.dist(x,y,fakes[i].x,fakes[i].y)<fakes[i].r){
      n=Math.max(0,n-3); E.add(-30); E.s('buzz'); E.shake(9); place(); return; } },
  update:function(dt){ if(!started)return; t-=dt;
    if(t<=0) E.won('نقراتك: '+n, n>45?'أصابع صاروخية 🚀':n>28?'جيد جداً':'تحتاج تمريناً'); },
  draw:function(c){
    E.bg('#0b0f1c');
    fakes.forEach(function(f){ E.o(f.x,f.y,f.r,'#3a4270'); E.tx('انقر',f.x,f.y,17,'#8a93b5'); });
    E.o(btn.x,btn.y,btn.r,'#2fbd6f'); E.ring(btn.x,btn.y,btn.r,'#9dff3d',3); E.tx('انقر!',btn.x,btn.y,20,'#062012');
    E.tx(started?'⏱ '+Math.max(0,t).toFixed(1):'انقر لتبدأ',400,55,30, t<3?'#ff3d7f':'#fff');
    E.tx('نقرات: '+n,400,570,24,'#ffc93d');
  }};
}});

G({id:'helix-fall', t:'السقوط الحلزوني', c:'skill', e:'🌀', tags:['توقيت','سقوط'],
d:'كرة تسقط عبر حلقات دوّارة — مرّرها من الفجوات، والأحمر يقتل.',
how:'← → لتدوير البرج',
make:function(E){
  var rings,y,vy,rot,lvl;
  function reset(){ rings=[]; for(var i=0;i<14;i++) rings.push(mk(i));
    y=0; vy=0; rot=0; lvl=1; }
  function mk(i){ var seg=[]; var n=8;
    for(var k=0;k<n;k++) seg.push(Math.random()<.62 ? (Math.random()<.22?2:1) : 0);
    seg[E.ri(0,n-1)]=0; return {y:120+i*110,seg:seg,sp:E.rnd(-.6,.6)}; }
  reset();
  return {
  update:function(dt){
    rot+=E.kx()*2.4*dt;
    if(E.m.down) rot+=(E.m.dx)*.01;
    vy+=900*dt; y+=vy*dt;
    rings.forEach(function(r){ r.rot=(r.rot||0)+r.sp*dt; });
    var by=300;
    for(var i=0;i<rings.length;i++){ var r=rings[i]; var sy=r.y-y;
      if(sy>by-14&&sy<by+14&&vy>0){
        var a=((-rot-(r.rot||0))%6.283+6.283)%6.283;
        var k=Math.floor(a/6.283*8)%8, cell=r.seg[k];
        if(cell===2) return E.over('لمست الجزء الأحمر','مررت '+E.score+' حلقة');
        if(cell===1){ vy=-420; E.s('pop'); }
        else { E.add(10); E.s('tick'); E.burst(400,300,['#9dff3d'],6,120); } } }
    if(y>rings[rings.length-1].y-200){ for(var j=0;j<6;j++){ var last=rings[rings.length-1];
      var nr=mk(0); nr.y=last.y+110; rings.push(nr); } rings.splice(0,6); }
  },
  draw:function(c){
    E.sky('#1a1240','#07060f');
    E.r(390,0,20,600,'#39406b');
    rings.forEach(function(r){ var sy=r.y-y; if(sy<-80||sy>660)return;
      for(var k=0;k<8;k++){ if(!r.seg[k])continue;
        var a0=k/8*6.283+rot+(r.rot||0), a1=a0+.785;
        c.beginPath(); c.moveTo(400,sy);
        for(var t=a0;t<=a1;t+=.08) c.lineTo(400+Math.cos(t)*130,sy+Math.sin(t)*34);
        c.lineTo(400,sy); c.closePath();
        c.fillStyle=r.seg[k]===2?'#ff3d7f':'#5b6bd4'; c.fill(); } });
    E.o(400,300,15,'#ffc93d'); E.o(396,296,5,'#fff');
    E.hud('النتيجة '+E.score); E.hudL('العمق '+Math.floor(y/10)+' م');
  }};
}});

G({id:'swing-rope', t:'تارزان الحبال', c:'physics', e:'🪢', tags:['مهارة','توقيت'],
d:'تشبّث بحبل، تأرجح، ثم أفلت في اللحظة الصحيحة لتصل للحبل التالي.',
how:'اضغط للتشبّث · أفلت للطيران',
make:function(E){
  var p,ropes,att,scroll,ang,av;
  function reset(){ p={x:150,y:250,vx:120,vy:0}; ropes=[]; scroll=0; att=null;
    for(var i=0;i<8;i++) ropes.push({x:220+i*E.rnd(180,240),y:E.rnd(60,130),len:E.rnd(110,190)}); }
  reset();
  return {
  down:function(){ if(att)return;
    var best=null,bd=1e9;
    ropes.forEach(function(r){ var d=E.dist(p.x,p.y,r.x-scroll,r.y);
      if(d<r.len+30&&d<bd){bd=d;best=r;} });
    if(best){ att=best; var dx=p.x-(best.x-scroll), dy=p.y-best.y;
      ang=Math.atan2(dy,dx); att.L=Math.max(60,Math.sqrt(dx*dx+dy*dy));
      av=(-p.vx*Math.sin(ang)+p.vy*Math.cos(ang))/att.L; E.s('pop'); } },
  up:function(){ if(att){ att=null; E.s('swish'); } },
  key:function(k,d){ if(k===' '){ if(d)this.down(); else this.up(); } },
  update:function(dt){
    if(att){ av+= -9.8*Math.cos(ang)/att.L*dt*3.2; av*=.999;
      ang+=av*dt*3.2;
      var cx=att.x-scroll, cy=att.y;
      var nx=cx+Math.cos(ang)*att.L, ny=cy+Math.sin(ang)*att.L;
      p.vx=(nx-p.x)/dt; p.vy=(ny-p.y)/dt; p.x=nx; p.y=ny; }
    else { p.vy+=1050*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
    if(p.x>380){ var d=p.x-380; p.x=380; scroll+=d; E.setScore(Math.floor(scroll/10)); }
    if(p.y>560) return E.over('سقطت','قطعت '+E.score+' متراً');
    while(ropes.length&&ropes[0].x-scroll<-100){ ropes.shift();
      var last=ropes[ropes.length-1]; ropes.push({x:last.x+E.rnd(180,250),y:E.rnd(50,140),len:E.rnd(110,190)}); }
  },
  draw:function(c){
    E.sky('#0f2a4a','#071018');
    E.r(0,570,800,30,'#0a1a10');
    ropes.forEach(function(r){ var x=r.x-scroll; if(x<-60||x>860)return;
      E.o(x,r.y,8,'#8a6a3a');
      E.alpha(att===r?1:.3,function(){ E.ln(x,r.y,x,r.y+(att===r?att.L:r.len),att===r?'#d9b06a':'#5a4a30',att===r?4:2); }); });
    if(att) E.ln(att.x-scroll,att.y,p.x,p.y,'#d9b06a',4);
    E.spr('🐒',p.x,p.y,34);
    E.hud(E.score+' م');
  }};
}});

G({id:'hoops', t:'رميات السلة', c:'sport', e:'🏀', tags:['فيزياء','تصويب'],
d:'اسحب للتصويب. السلة تتحرك أسرع كلما سجّلت، والرياح تتلاعب بالكرة.',
how:'اسحب من الكرة وأفلت', noPad:true,
make:function(E){
  var b,hoop,aim,made,t,wind,shots;
  function reset(){ b={x:150,y:480,vx:0,vy:0,live:false}; hoop={x:600,y:220,dir:1,sp:0}; 
    aim=null; made=0; t=25; wind=0; shots=0; }
  reset();
  return {
  down:function(x,y){ if(b.live)return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(x,y){ if(!aim||b.live)return;
    b.vx=(b.x-aim.x)*3.2; b.vy=(b.y-aim.y)*3.2; b.live=true; aim=null; shots++; E.s('swish');
    wind=E.rnd(-60,60); },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت','سجّلت '+made+' من '+shots);
    hoop.sp=90+made*22;
    hoop.x+=hoop.dir*hoop.sp*dt; if(hoop.x>720||hoop.x<420)hoop.dir*=-1;
    if(made>4) hoop.y=220+Math.sin(E.time*1.6)*70;
    if(b.live){ b.vy+=900*dt; b.vx+=wind*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.x>hoop.x-42&&b.x<hoop.x+42&&b.y>hoop.y-8&&b.y<hoop.y+18&&b.vy>0){
        made++; E.add(100+Math.round(Math.abs(b.vx)/3)); E.s('coin'); E.burst(hoop.x,hoop.y,['#ff9f3d','#fff'],18); 
        b.live=false; b.x=150;b.y=480;b.vx=b.vy=0; t+=3; }
      if(b.y>560||b.x<-40||b.x>840){ b.live=false; b.x=150;b.y=480;b.vx=b.vy=0; E.s('thud'); } } },
  draw:function(c){
    E.sky('#3a2416','#120b08');
    E.r(0,545,800,55,'#7a4a24');
    E.r(hoop.x+46,hoop.y-70,10,90,'#c8cfe0'); E.r(hoop.x+30,hoop.y-70,26,60,'#e8ecff');
    E.r(hoop.x-42,hoop.y,84,6,'#ff5c2e');
    for(var i=0;i<7;i++) E.ln(hoop.x-40+i*13,hoop.y+6,hoop.x-30+i*10,hoop.y+34,'#dfe6ff',1.5);
    E.spr('🏀',b.x,b.y,36);
    if(aim){ E.ln(b.x,b.y,aim.x,aim.y,'#9dff3d',3);
      var vx=(b.x-aim.x)*3.2, vy=(b.y-aim.y)*3.2, px=b.x,py=b.y;
      for(var k=0;k<26;k++){ vy+=900*.033; px+=vx*.033; py+=vy*.033; E.o(px,py,2.5,'rgba(255,255,255,.35)'); } }
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+'  ·  🌬 '+(wind>0?'→':'←')+Math.abs(wind).toFixed(0));
    E.hud('سلات '+made+'  ·  '+E.score);
  }};
}});

G({id:'mini-golf', t:'جولف الجيب', c:'sport', e:'⛳', tags:['فيزياء','دقّة'],
d:'تسعة ملاعب مولّدة بعوائق ورمال. أقل عدد ضربات يعني نتيجة أعلى.',
how:'اسحب من الكرة لتحديد القوة', noPad:true,
make:function(E){
  var b,hole,walls,sand,aim,strokes,hn,total;
  function build(){ walls=[]; sand=[];
    var n=2+Math.min(5,hn);
    for(var i=0;i<n;i++) walls.push({x:E.rnd(180,620),y:E.rnd(120,480),w:E.rnd(20,140),h:E.rnd(20,140)});
    for(var j=0;j<hn%3+1;j++) sand.push({x:E.rnd(200,600),y:E.rnd(150,450),r:E.rnd(40,70)});
    b={x:90,y:300,vx:0,vy:0}; hole={x:E.rnd(600,740),y:E.rnd(100,500)}; strokes=0; }
  function reset(){ hn=1; total=0; build(); aim=null; }
  reset();
  return {
  down:function(x,y){ if(Math.abs(b.vx)+Math.abs(b.vy)>8)return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim)return;
    b.vx=E.cl((b.x-aim.x)*3.4,-900,900); b.vy=E.cl((b.y-aim.y)*3.4,-900,900); aim=null; strokes++; E.s('hit'); },
  update:function(dt){
    var inSand=sand.some(function(s){ return E.dist(b.x,b.y,s.x,s.y)<s.r; });
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    var fr=inSand?.90:.988; b.vx*=fr; b.vy*=fr;
    if(Math.abs(b.vx)<5&&Math.abs(b.vy)<5){b.vx=0;b.vy=0;}
    if(b.x<12){b.x=12;b.vx*=-.8;E.s('tick');} if(b.x>788){b.x=788;b.vx*=-.8;E.s('tick');}
    if(b.y<12){b.y=12;b.vy*=-.8;} if(b.y>588){b.y=588;b.vy*=-.8;}
    walls.forEach(function(w){
      if(b.x>w.x-10&&b.x<w.x+w.w+10&&b.y>w.y-10&&b.y<w.y+w.h+10){
        var ox=Math.min(b.x-(w.x-10),(w.x+w.w+10)-b.x), oy=Math.min(b.y-(w.y-10),(w.y+w.h+10)-b.y);
        if(ox<oy){ b.vx*=-.75; b.x+= b.x<w.x+w.w/2?-ox:ox; } else { b.vy*=-.75; b.y+= b.y<w.y+w.h/2?-oy:oy; }
        E.s('tick'); } });
    if(E.dist(b.x,b.y,hole.x,hole.y)<16&&Math.abs(b.vx)+Math.abs(b.vy)<400){
      var par=3, pts=Math.max(20,300-(strokes-par)*60); E.add(pts); total+=strokes; E.s('win');
      E.burst(hole.x,hole.y,['#9dff3d','#fff'],20);
      hn++; if(hn>9) return E.won('أنهيت ٩ حفر! ⛳','مجموع الضربات '+total); build(); }
  },
  draw:function(c){
    E.bg('#14682f');
    sand.forEach(function(s){ E.o(s.x,s.y,s.r,'#d9c07a'); });
    walls.forEach(function(w){ E.rr(w.x,w.y,w.w,w.h,5,'#3a2a18'); });
    E.o(hole.x,hole.y,15,'#0a1408'); E.spr('⛳',hole.x+8,hole.y-18,26);
    E.o(b.x,b.y,9,'#fff');
    if(aim){ E.ln(b.x,b.y,aim.x,aim.y,'#ffc93d',3);
      E.o(aim.x,aim.y,5,'#ffc93d'); }
    E.hudL('حفرة '+hn+'/9 · ضربات '+strokes); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'castle-siege', t:'حصار القلعة', c:'physics', e:'🏰', tags:['قذف','فيزياء'],
d:'اضبط الزاوية والقوة لتهدم أبراج العدو — والبنية تنهار بالفيزياء.',
how:'اسحب لضبط الرمية', noPad:true,
make:function(E){
  var ball,aim,blocks,shots,lvl;
  function build(){ blocks=[]; var bx=520+lvl*10;
    for(var i=0;i<3+Math.min(4,lvl);i++){ for(var j=0;j<4;j++){
      blocks.push({x:bx+i*46,y:500-j*46,w:42,h:42,vx:0,vy:0,dead:false,e:j===3?'🐷':null}); } }
    ball=null; shots=6; }
  function reset(){ lvl=1; build(); aim=null; }
  reset();
  return {
  down:function(x,y){ if(ball)return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim||ball)return;
    ball={x:110,y:470,vx:(110-aim.x)*2.6,vy:(470-aim.y)*2.6,r:14};
    aim=null; shots--; E.s('boom'); },
  update:function(dt){
    if(ball){ ball.vy+=900*dt; ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
      blocks.forEach(function(b){ if(b.dead)return;
        if(ball.x>b.x-14&&ball.x<b.x+b.w+14&&ball.y>b.y-14&&ball.y<b.y+b.h+14){
          b.vx+=ball.vx*.35; b.vy+=ball.vy*.35-120; ball.vx*=.5; ball.vy*=.4; E.s('thud'); E.shake(6); } });
      if(ball.y>560||ball.x>840){ ball=null;
        if(shots<=0&&blocks.some(function(b){return !b.dead&&b.e;}))
          return E.over('نفدت القذائف','المرحلة '+lvl); } }
    blocks.forEach(function(b){ if(b.dead)return;
      if(Math.abs(b.vx)>1||Math.abs(b.vy)>1){ b.vy+=900*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vx*=.99;
        if(b.y>500){ b.y=500; b.vy*=-.3; b.vx*=.7; if(Math.abs(b.vy)<40)b.vy=0; }
        if(b.y>=498&&Math.abs(b.vx)<8)b.vx=0;
        if(b.x<-60||b.x>860||b.y>620){ b.dead=true; E.add(b.e?200:30); }
        if(b.e&&(Math.abs(b.vx)>260||Math.abs(b.vy)>320)){ b.dead=true; E.add(200); E.s('coin');
          E.burst(b.x+20,b.y+20,['#9dff3d'],16); } } });
    if(!blocks.some(function(b){return !b.dead&&b.e;})){ lvl++; E.add(300+shots*80); E.s('win');
      if(lvl>6) return E.won('سقطت كل القلاع! 🏰','ست مراحل'); build(); }
  },
  draw:function(c){
    E.sky('#4a6ea8','#1a2440');
    E.r(0,542,800,58,'#3d6b2a');
    blocks.forEach(function(b){ if(b.dead)return;
      if(b.e){ E.spr(b.e,b.x+21,b.y+21,38); } else E.rr(b.x,b.y,b.w,b.h,5,'#a06a3a'); });
    E.spr('🏹',110,486,40);
    if(ball) E.o(ball.x,ball.y,ball.r,'#2b3350');
    if(aim){ E.ln(110,470,aim.x,aim.y,'#ff3d7f',3);
      var vx=(110-aim.x)*2.6, vy=(470-aim.y)*2.6, px=110,py=470;
      for(var k=0;k<28;k++){ vy+=900*.035; px+=vx*.035; py+=vy*.035; E.o(px,py,2.5,'rgba(255,255,255,.4)'); } }
    E.hudL('قذائف: '+shots+' · مرحلة '+lvl); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'plinko', t:'بلينكو الحظّ', c:'luck', e:'🎰', tags:['حظّ','فيزياء'],
d:'أسقط الكرة بين المسامير — كل خانة تضاعف رهانك أو تبتلعه.',
how:'انقر في الأعلى لإسقاط كرة', noPad:true,
make:function(E){
  var pegs,balls,cash,slots,drops;
  function reset(){ pegs=[]; for(var r=0;r<10;r++) for(var i=0;i<=r+3;i++)
      pegs.push({x:400-(r+3)*30+i*60, y:120+r*40});
    slots=[10,3,1.5,.5,.2,0,.2,.5,1.5,3,10,5,2];
    slots=[8,3,1.2,.4,0,.4,1.2,3,8]; balls=[]; cash=100; drops=0; E.setScore(100); }
  reset();
  return {
  down:function(x,y){
    if(cash<10){ E.s('buzz'); return; }
    cash-=10; drops++; E.setScore(Math.round(cash));
    balls.push({x:E.cl(x,60,740),y:60,vx:E.rnd(-20,20),vy:0}); E.s('pop'); },
  update:function(dt){
    for(var i=balls.length-1;i>=0;i--){ var b=balls[i];
      b.vy+=950*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vx*=.995;
      pegs.forEach(function(p){ var d=E.dist(b.x,b.y,p.x,p.y);
        if(d<12){ var nx=(b.x-p.x)/d, ny=(b.y-p.y)/d;
          b.x=p.x+nx*12; b.y=p.y+ny*12;
          var dot=b.vx*nx+b.vy*ny; b.vx=(b.vx-2*dot*nx)*.55+E.rnd(-30,30); b.vy=(b.vy-2*dot*ny)*.55;
          if(Math.random()<.4)E.s('tick'); } });
      if(b.x<12){b.x=12;b.vx*=-.6;} if(b.x>788){b.x=788;b.vx*=-.6;}
      if(b.y>540){ var si=E.cl(Math.floor(b.x/(800/slots.length)),0,slots.length-1);
        var win=10*slots[si]; cash+=win; E.setScore(Math.round(cash));
        if(win>10){ E.s('coin'); E.burst(b.x,540,['#ffc93d','#9dff3d'],18); } else E.s('thud');
        balls.splice(i,1);
        if(cash<10&&!balls.length) E.over('أفلست','بعد '+drops+' إسقاطة'); 
        if(cash>=1000) E.won('ربحت الجائزة الكبرى! 🎰','بعد '+drops+' إسقاطة'); } }
  },
  draw:function(c){
    E.bg('#0d0a1a');
    pegs.forEach(function(p){ E.o(p.x,p.y,5,'#7c8ac0'); });
    var sw=800/slots.length;
    slots.forEach(function(m,i){ var col= m>=8?'#ffc93d':m>=3?'#9dff3d':m>=1?'#00d4ff':m>0?'#5b6488':'#ff3d7f';
      E.rr(i*sw+2,545,sw-4,50,7,col); E.tx('×'+m,i*sw+sw/2,570,18,'#0b0d14'); });
    balls.forEach(function(b){ E.o(b.x,b.y,8,'#fff'); });
    E.tx('رصيدك: '+Math.round(cash)+' 🪙',400,40,28, cash<30?'#ff3d7f':'#ffc93d');
    E.tx('كل إسقاطة = ١٠',400,520,15,'#98a0b8');
  }};
}});

G({id:'pool-8', t:'بلياردو الجيب', c:'sport', e:'🎱', tags:['فيزياء','دقّة'],
d:'أدخل كل الكرات في الجيوب. ضربة واحدة قوية قد تنهي كل شيء… أو تُضيّعه.',
how:'اسحب من الكرة البيضاء', noPad:true,
make:function(E){
  var balls,aim,shots,pot;
  var POCK=[[30,30],[400,24],[770,30],[30,570],[400,576],[770,570]];
  function reset(){ balls=[{x:200,y:300,vx:0,vy:0,c:'#fff',w:true}];
    var C=['#ffc93d','#00d4ff','#ff3d7f','#9dff3d','#c93dff','#ff9f3d','#3d7cff','#12161f','#3dffb0'];
    for(var r=0;r<4;r++)for(var i=0;i<=r;i++)
      balls.push({x:540+r*26,y:300-r*13+i*26,vx:0,vy:0,c:C[(r*4+i)%C.length]});
    aim=null; shots=0; pot=0; }
  reset();
  function moving(){ return balls.some(function(b){ return Math.abs(b.vx)+Math.abs(b.vy)>6; }); }
  return {
  down:function(x,y){ if(moving())return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim)return; var w=balls[0];
    w.vx=E.cl((w.x-aim.x)*4,-1100,1100); w.vy=E.cl((w.y-aim.y)*4,-1100,1100); aim=null; shots++; E.s('hit'); },
  update:function(dt){
    balls.forEach(function(b){ b.x+=b.vx*dt; b.y+=b.vy*dt; b.vx*=.985; b.vy*=.985;
      if(Math.abs(b.vx)<6&&Math.abs(b.vy)<6){b.vx=0;b.vy=0;}
      if(b.x<26){b.x=26;b.vx*=-.85;} if(b.x>774){b.x=774;b.vx*=-.85;}
      if(b.y<26){b.y=26;b.vy*=-.85;} if(b.y>574){b.y=574;b.vy*=-.85;} });
    for(var i=0;i<balls.length;i++)for(var j=i+1;j<balls.length;j++){
      var a=balls[i],b2=balls[j], d=E.dist(a.x,a.y,b2.x,b2.y);
      if(d<26&&d>0){ var nx=(b2.x-a.x)/d, ny=(b2.y-a.y)/d, ov=(26-d)/2;
        a.x-=nx*ov; a.y-=ny*ov; b2.x+=nx*ov; b2.y+=ny*ov;
        var p=(a.vx-b2.vx)*nx+(a.vy-b2.vy)*ny;
        if(p>0){ a.vx-=p*nx; a.vy-=p*ny; b2.vx+=p*nx; b2.vy+=p*ny; E.s('tick'); } } }
    for(var k=balls.length-1;k>=0;k--){ var b3=balls[k];
      for(var m=0;m<POCK.length;m++) if(E.dist(b3.x,b3.y,POCK[m][0],POCK[m][1])<26){
        if(b3.w){ b3.x=200;b3.y=300;b3.vx=b3.vy=0; E.add(-50); E.s('buzz'); }
        else { balls.splice(k,1); pot++; E.add(150); E.s('coin'); E.burst(b3.x,b3.y,[b3.c],14); }
        break; } }
    if(balls.length===1) E.won('نظّفت الطاولة! 🎱','بـ'+shots+' ضربة');
  },
  draw:function(c){
    E.bg('#0a3d24');
    E.sr(24,22,752,556,'#5a3a1a',10);
    POCK.forEach(function(p){ E.o(p[0],p[1],20,'#08160e'); });
    balls.forEach(function(b){ E.o(b.x,b.y,13,b.c); E.o(b.x-4,b.y-4,4,'rgba(255,255,255,.4)'); });
    if(aim){ var w=balls[0]; E.ln(w.x,w.y,w.x+(w.x-aim.x)*1.6,w.y+(w.y-aim.y)*1.6,'rgba(255,255,255,.5)',2);
      E.ln(w.x,w.y,aim.x,aim.y,'#ffc93d',3); }
    E.hudL('ضربات '+shots+' · مُدخل '+pot); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'tilt-ball', t:'الكرة في الصينية', c:'physics', e:'⚪', tags:['توازن','متاهة'],
d:'أمِل اللوح لتوصل الكرة للهدف دون أن تسقط في الثقوب.',
how:'حرّك الفأرة لإمالة اللوح · أو الأسهم',
make:function(E){
  var b,holes,goal,lvl,t;
  function build(){ holes=[]; for(var i=0;i<4+lvl*2;i++) holes.push({x:E.rnd(120,680),y:E.rnd(100,500),r:24});
    goal={x:E.rnd(600,740),y:E.rnd(80,520),r:26}; b={x:70,y:300,vx:0,vy:0}; t=20+lvl*2; }
  function reset(){ lvl=1; build(); }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.over('نفد الوقت','المرحلة '+lvl);
    var ax=E.kx()*400, ay=E.ky()*400;
    if(E.m.down||E.m.x!==400){ ax+=(E.m.x-400)*1.6; ay+=(E.m.y-300)*1.6; }
    b.vx+=ax*dt; b.vy+=ay*dt; b.vx*=.985; b.vy*=.985;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(b.x<12){b.x=12;b.vx*=-.6;} if(b.x>788){b.x=788;b.vx*=-.6;}
    if(b.y<12){b.y=12;b.vy*=-.6;} if(b.y>588){b.y=588;b.vy*=-.6;}
    for(var i=0;i<holes.length;i++) if(E.dist(b.x,b.y,holes[i].x,holes[i].y)<holes[i].r-4){
      E.s('lose'); E.shake(14); return E.over('سقطت في الحفرة','المرحلة '+lvl); }
    if(E.dist(b.x,b.y,goal.x,goal.y)<goal.r){ E.add(200+Math.floor(t)*10); E.s('win'); lvl++;
      if(lvl>7) return E.won('توازن مثالي! ⚪','سبع مراحل'); build(); }
  },
  draw:function(c){
    E.bg('#1b1408');
    var tx=(E.m.x-400)*.02, ty=(E.m.y-300)*.02;
    c.save(); c.translate(tx,ty);
    E.rr(10,10,780,580,16,'#3a2a14');
    holes.forEach(function(h){ E.o(h.x,h.y,h.r,'#0a0705'); E.ring(h.x,h.y,h.r,'#241a0c',3); });
    E.ring(goal.x,goal.y,goal.r,'#9dff3d',4); E.spr('🎯',goal.x,goal.y,28);
    E.o(b.x,b.y,12,'#e8ecff'); E.o(b.x-4,b.y-4,4,'#fff');
    c.restore();
    E.hudL('مرحلة '+lvl); E.hud('⏱ '+Math.max(0,t).toFixed(0), t<6?'#ff3d7f':'#fff');
  }};
}});

G({id:'wall-gap', t:'اعبر من الفجوة', c:'skill', e:'🧱', tags:['شكل','توقيت'],
d:'جدران تندفع نحوك بفجوات بأشكال مختلفة — غيّر شكلك لتمرّ.',
how:'← → لتغيير الشكل',
make:function(E){
  var shape,walls,sp,t;
  var SH=['⬜','🔺','⚫','⭐'];
  function reset(){ shape=0; walls=[]; sp=180; t=0;
    for(var i=0;i<4;i++) walls.push({x:900+i*260,g:E.ri(0,3)}); }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowRight'){ shape=(shape+1)%4; E.s('blip'); }
    if(k==='ArrowLeft'){ shape=(shape+3)%4; E.s('blip'); } },
  down:function(x){ shape=(shape+(x>400?1:3))%4; E.s('blip'); },
  update:function(dt){
    t+=dt; sp=180+E.score*4;
    walls.forEach(function(w){ w.x-=sp*dt;
      if(w.x<-80){ w.x+=4*260; w.g=E.ri(0,3); }
      if(w.x<210&&w.x>190){ 
        if(w.g===shape){ E.add(10); E.s('coin'); E.burst(200,300,['#9dff3d'],10); w.x=189.9; }
        else { E.shake(20); E.s('boom'); E.over('شكل خاطئ','عبرت '+E.score/10+' جداراً'); } } });
  },
  draw:function(c){
    E.sky('#171235','#07060e');
    walls.forEach(function(w){ if(w.x<-90||w.x>860)return;
      E.rr(w.x,0,60,600,6,'#4a3d80');
      E.r(w.x-4,220,68,160,'#0d0a1c');
      E.spr(SH[w.g],w.x+30,300,52); });
    E.spr(SH[shape],200,300,54);
    E.ring(200,300,42,'#9dff3d',3);
    E.hud('النتيجة '+E.score);
    E.tx('← → لتبديل الشكل',400,570,17,'#98a0b8');
  }};
}});
