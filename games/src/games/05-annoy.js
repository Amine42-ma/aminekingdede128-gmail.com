/* ============ 5) ألعاب مزعجة عمداً ============ */

G({id:'runaway-btn', t:'الزر الهارب', c:'annoy', e:'🏃', tags:['مزعج','مطاردة'],
d:'زر واحد فقط… يهرب منك كلما اقتربت. أمسكه عشر مرات إن استطعت.',
how:'حاول النقر على الزر', noPad:true,
make:function(E){
  var b,got,t,fear,taunt,tt;
  var TA=['قريب!','ليس اليوم','هل تعبت؟','بطيء جداً','حاول بيدك الأخرى','😜'];
  function reset(){ b={x:400,y:300,w:170,h:64}; got=0; t=30; fear=260; taunt=''; tt=0; }
  reset();
  return {
  down:function(x,y){
    if(x>b.x-b.w/2&&x<b.x+b.w/2&&y>b.y-b.h/2&&y<b.y+b.h/2){
      got++; E.add(120); E.s('coin'); E.burst(b.x,b.y,['#9dff3d'],18); fear+=40;
      b.x=E.rnd(120,680); b.y=E.rnd(100,500);
      if(got>=10) E.won('أمسكت الزر عشر مرات! 🏆','الزر يستسلم'); }
    else { E.add(-10); E.s('buzz'); taunt=E.pick(TA); tt=1.2; } },
  update:function(dt){
    t-=dt; if(t<=0) return E.over('انتهى الوقت','أمسكته '+got+' مرات فقط');
    if(tt>0)tt-=dt;
    var d=E.dist(E.m.x,E.m.y,b.x,b.y);
    if(d<fear){ var a=Math.atan2(b.y-E.m.y,b.x-E.m.x);
      var sp=(fear-d)*3.4;
      b.x+=Math.cos(a)*sp*dt; b.y+=Math.sin(a)*sp*dt; }
    b.x+=Math.sin(E.time*3)*22*dt; 
    if(b.x<b.w/2+8){b.x=b.w/2+8;} if(b.x>792-b.w/2){b.x=792-b.w/2;}
    if(b.y<50){b.y=50;} if(b.y>550){b.y=550;} },
  draw:function(c){
    E.bg('#141826');
    E.tx('امسك الزر: '+got+'/10',400,50,28,'#dfe6ff');
    E.rr(b.x-b.w/2,b.y-b.h/2,b.w,b.h,16,'#2fbd6f');
    E.tx('انقرني!',b.x,b.y,24,'#062012');
    E.o(E.m.x,E.m.y,6,'rgba(255,255,255,.4)');
    if(tt>0) E.tx(taunt,b.x,b.y-56,22,'#ffc93d');
    E.hud('النتيجة '+E.score); E.hudL('⏱ '+Math.max(0,t).toFixed(1));
  }};
}});

G({id:'popup-hell', t:'جحيم النوافذ', c:'annoy', e:'🪟', tags:['مزعج','سرعة'],
d:'أغلق النوافذ المنبثقة… وكل نافذة تُغلق تفتح أخرى. اصمد ٤٥ ثانية.',
how:'انقر ✕ في كل نافذة', noPad:true,
make:function(E){
  var pops,t,closed,rate;
  var MSG=['تهانينا! ربحت جهازاً!','هل أنت متأكد؟','اشترك في نشرتنا','تحديث مطلوب الآن','فيروس محتمل!!','خصم ٩٩٪ اليوم فقط','مرحباً 👋','هل تريد المغادرة حقاً؟'];
  function reset(){ pops=[]; t=45; closed=0; rate=1.1; add(); add(); }
  function add(){ if(pops.length>13)return;
    pops.push({x:E.rnd(30,560),y:E.rnd(30,430),w:E.rnd(190,240),h:E.rnd(110,150),
      m:E.pick(MSG),dx:E.rnd(-26,26),dy:E.rnd(-26,26)}); E.s('alarm'); }
  reset();
  return {
  down:function(x,y){
    for(var i=pops.length-1;i>=0;i--){ var p=pops[i];
      if(x>p.x+p.w-34&&x<p.x+p.w-4&&y>p.y+4&&y<p.y+30){
        pops.splice(i,1); closed++; E.add(30); E.s('pop');
        add(); if(closed%4===0)add();
        return; }
      if(x>p.x&&x<p.x+p.w&&y>p.y&&y<p.y+p.h){ E.add(-15); E.s('buzz'); add(); return; } } },
  update:function(dt){
    t-=dt;
    if(t<=0) return E.won('نجوت من الإعلانات! 🪟','أغلقت '+closed+' نافذة');
    if(Math.random()<dt*rate)add(); rate+=dt*.035;
    pops.forEach(function(p){ p.x+=p.dx*dt; p.y+=p.dy*dt;
      if(p.x<0||p.x+p.w>800)p.dx*=-1; if(p.y<0||p.y+p.h>560)p.dy*=-1; });
    if(pops.length>13) E.over('غرقت في النوافذ 😵','أغلقت '+closed+' نافذة'); },
  draw:function(c){
    E.bg('#0e1220');
    E.tx('اصمد: '+Math.max(0,t).toFixed(1)+'ث',400,300,60,'rgba(255,255,255,.07)');
    pops.forEach(function(p){
      E.rr(p.x,p.y,p.w,p.h,8,'#e8ecff');
      E.rr(p.x,p.y,p.w,30,8,'#3a4270');
      E.rr(p.x+p.w-32,p.y+4,28,24,6,'#ff3d7f'); E.tx('✕',p.x+p.w-18,p.y+16,16,'#fff');
      E.tx(p.m,p.x+p.w/2,p.y+p.h/2+8,15,'#1a1f33');
      E.tx('إعلان',p.x+30,p.y+15,12,'#c8cfe0'); });
    E.hudL('نوافذ '+pops.length+'/14',pops.length>10?'#ff3d7f':'#fff'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'mosquito', t:'البعوضة', c:'annoy', e:'🦟', tags:['مزعج','دقّة'],
d:'صوت أزيز لا يتوقف. اضربها… إن استطعت. وهي تتعلّم منك.',
how:'انقر على البعوضة', noPad:true,
make:function(E){
  var m,t,kills,osc,bites;
  function reset(){ m={x:400,y:300,vx:E.rnd(-200,200),vy:E.rnd(-200,200),rest:0}; t=40; kills=0; bites=0; }
  reset();
  return {
  down:function(x,y){
    if(E.dist(x,y,m.x,m.y)<26){ kills++; E.add(300); E.s('pop'); E.burst(m.x,m.y,['#ff3d7f','#3a2a18'],20);
      if(kills>=3) return E.won('قتلت ٣ بعوضات! 🦟','نم بسلام');
      m.x=E.rnd(80,720); m.y=E.rnd(80,520); m.rest=0; }
    else { E.add(-20); E.s('swish'); E.shake(4); } },
  update:function(dt){
    t-=dt; if(t<=0) return E.over('استسلمت للأزيز 😵','قتلت '+kills+' فقط');
    if(!MUTED&&Math.random()<dt*10) E.tone(E.rnd(600,900),.05,'sawtooth',.03);
    m.rest-=dt;
    if(m.rest<=0){
      var d=E.dist(E.m.x,E.m.y,m.x,m.y);
      if(d<130){ var a=Math.atan2(m.y-E.m.y,m.x-E.m.x);
        m.vx=Math.cos(a)*E.rnd(320,460); m.vy=Math.sin(a)*E.rnd(320,460); }
      else if(Math.random()<dt*3){ m.vx=E.rnd(-260,260); m.vy=E.rnd(-260,260); }
      if(Math.random()<dt*.35){ m.rest=E.rnd(.4,1.1); m.vx=m.vy=0; } }
    m.x+=m.vx*dt+Math.sin(E.time*22)*1.6; m.y+=m.vy*dt+Math.cos(E.time*19)*1.6;
    if(m.x<20||m.x>780)m.vx*=-1; if(m.y<20||m.y>580)m.vy*=-1;
    m.x=E.cl(m.x,20,780); m.y=E.cl(m.y,20,580);
    if(m.rest>0&&Math.random()<dt*.7){ bites++; E.add(-30); E.s('buzz'); } },
  draw:function(c){
    E.bg('#1a1410');
    E.spr('😴',400,320,240);
    E.alpha(.5,function(){ E.o(m.x,m.y,26+Math.sin(E.time*20)*4,'rgba(255,61,127,.12)'); });
    E.spr('🦟',m.x,m.y,26,Math.sin(E.time*14)*.5);
    E.tx('اقتل ٣ بعوضات — قتلت '+kills,400,50,26,'#dfe6ff');
    E.hud('النتيجة '+E.score); E.hudL('⏱ '+Math.max(0,t).toFixed(1)+' · لدغات '+bites);
  }};
}});

G({id:'fake-loading', t:'شريط التحميل الكاذب', c:'annoy', e:'⏳', tags:['مزعج','صبر'],
d:'الشريط يصل ٩٩٪ ثم يعود. انقر «إلغاء» في اللحظة التي يكتمل فيها حقاً.',
how:'انقر «إلغاء» حين يصل ١٠٠٪ فعلاً', noPad:true,
make:function(E){
  var p,real,phase,t,tries,msg;
  var M=['جارٍ التحميل…','تحضير الملفات…','إنهاء…','لحظة واحدة…','تقريباً انتهينا…','إعادة المحاولة…','تحسين الأداء…'];
  function reset(){ p=0; real=false; phase=0; t=0; tries=0; msg=M[0]; }
  reset();
  return {
  down:function(x,y){
    if(y>440&&y<500&&x>320&&x<480){
      if(real){ E.add(500); E.won('أمسكت اللحظة! ⏳','صبر أسطوري'); }
      else { tries++; E.add(-60); E.s('buzz'); E.shake(10); p=Math.max(0,p-E.rnd(20,50));
        if(tries>=6) E.over('فقدت أعصابك','ست محاولات فاشلة'); } } },
  update:function(dt){
    t+=dt;
    if(real){ if(t>1.4){ E.over('فاتتك اللحظة!','عادت الدائرة من جديد'); } return; }
    p+=E.rnd(4,30)*dt*(p>90?.25:1);
    if(p>=99.4){ 
      if(Math.random()<.28){ real=true; p=100; t=0; msg='اكتمل!'; E.s('power'); }
      else { p=E.rnd(3,40); msg=E.pick(M); E.s('alarm'); } }
    if(Math.random()<dt*.6)msg=E.pick(M); },
  draw:function(c){
    E.bg('#0f1220');
    E.tx(msg,400,220,28,real?'#9dff3d':'#dfe6ff');
    E.rr(150,270,500,44,12,'#1c2338');
    E.rr(153,273,494*(p/100),38,10, real?'#9dff3d':'#00d4ff');
    E.tx(p.toFixed(1)+'%',400,292,20, p>50?'#0b0d14':'#dfe6ff');
    E.rr(320,440,160,58,14, real?'#2fbd6f':'#3a4270');
    E.tx('إلغاء',400,469,24,'#fff');
    E.tx('انقر «إلغاء» فقط حين يكتمل ١٠٠٪ حقاً',400,540,17,'#98a0b8');
    E.hudL('محاولات فاشلة '+tries+'/6'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'captcha-hell', t:'كابتشا مستحيلة', c:'annoy', e:'🤖', tags:['مزعج','ملاحظة'],
d:'«اختر كل المربعات التي فيها…» — والصور تتحرك والقواعد تتغيّر.',
how:'اختر المربعات الصحيحة ثم تحقّق', noPad:true,
make:function(E){
  var grid,want,sel,round,t,names;
  var SET=[['🚦','إشارات المرور'],['🚗','السيارات'],['🌳','الأشجار'],['🚲','الدرّاجات'],['🏠','البيوت'],['🐈','القطط']];
  function gen(){ var w=E.pick(SET); want=w;
    grid=[]; for(var i=0;i<9;i++){ var isW=Math.random()<.4;
      grid.push({e:isW?w[0]:E.pick(SET.filter(function(s){return s[0]!==w[0];}))[0],
        ok:isW, dx:E.rnd(-8,8), dy:E.rnd(-8,8)}); }
    if(!grid.some(function(g){return g.ok;})){ grid[E.ri(0,8)].ok=true; grid[E.ri(0,8)].e=w[0]; }
    grid.forEach(function(g){ if(g.e===w[0])g.ok=true; });
    sel=[]; t=Math.max(6,14-round); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    var S=120,OX=220,OY=140;
    if(y>500&&x>320&&x<480){ check(); return; }
    var gx=Math.floor((x-OX)/S), gy=Math.floor((y-OY)/S);
    if(gx<0||gy<0||gx>2||gy>2)return;
    var i=gy*3+gx, k=sel.indexOf(i);
    if(k>=0)sel.splice(k,1); else sel.push(i);
    E.s('tick'); },
  update:function(dt){
    t-=dt; if(t<=0){ E.add(-60); E.s('buzz');
      if(round>3&&E.score<0) return E.over('أثبتّ أنك روبوت 🤖','فشلت في الكابتشا'); gen(); }
    grid.forEach(function(g,i){ if(Math.random()<dt*.35){ g.e=E.pick(SET)[0]; g.ok=(g.e===want[0]); } }); },
  draw:function(c){
    E.bg('#12161f');
    E.rr(180,60,440,60,10,'#2b3350');
    E.tx('اختر كل المربعات التي فيها: '+want[1],400,90,22,'#fff');
    var S=120,OX=220,OY=140;
    for(var i=0;i<9;i++){ var x=OX+(i%3)*S, y=OY+((i/3)|0)*S;
      E.rr(x+3,y+3,S-6,S-6,8,'#39406b');
      E.spr(grid[i].e,x+S/2+grid[i].dx*Math.sin(E.time*2+i),y+S/2+grid[i].dy*Math.cos(E.time*2+i),50);
      if(sel.indexOf(i)>=0){ E.sr(x+3,y+3,S-6,S-6,'#00d4ff',4); E.o(x+S-18,y+18,12,'#00d4ff'); E.tx('✓',x+S-18,y+18,15,'#062012'); } }
    E.rr(320,500,160,52,12,'#2fbd6f'); E.tx('تحقّق',400,526,22,'#062012');
    E.hudL('⏱ '+Math.max(0,t).toFixed(1)+' · جولة '+round); E.hud('النتيجة '+E.score);
  }};
  function check(){
    var right=true;
    for(var i=0;i<9;i++){ var s=sel.indexOf(i)>=0; if(s!==grid[i].ok)right=false; }
    if(right){ E.add(200); E.s('win'); round++;
      if(round>5) return E.won('أثبتّ أنك إنسان! 🎉','خمس جولات'); gen(); }
    else { E.add(-80); E.s('buzz'); E.shake(12); gen(); } }
}});

G({id:'tangled', t:'الكابل المتشابك', c:'annoy', e:'🔌', tags:['مزعج','ترتيب'],
d:'اسحب النقاط حتى لا يتقاطع أي خطّين. أعصابك ستُختبر.',
how:'اسحب النقاط لفكّ التشابك', noPad:true,
make:function(E){
  var pts,edges,drag,lvl;
  function gen(){ var n=4+lvl;
    pts=[]; for(var i=0;i<n;i++) pts.push({x:400+Math.cos(i/n*6.283)*200, y:300+Math.sin(i/n*6.283)*200});
    edges=[]; for(var a=0;a<n;a++)for(var b=a+1;b<n;b++) if(Math.random()<.55||b===a+1) edges.push([a,b]);
    pts.forEach(function(p){ p.x=E.rnd(80,720); p.y=E.rnd(80,520); }); drag=null; }
  function reset(){ lvl=1; gen(); }
  reset();
  function cross(a,b,c2,d){
    function ccw(p,q,r){ return (r.y-p.y)*(q.x-p.x)>(q.y-p.y)*(r.x-p.x); }
    return ccw(a,c2,d)!==ccw(b,c2,d)&&ccw(a,b,c2)!==ccw(a,b,d); }
  function count(){ var n=0;
    for(var i=0;i<edges.length;i++)for(var j=i+1;j<edges.length;j++){
      var e1=edges[i],e2=edges[j];
      if(e1[0]===e2[0]||e1[0]===e2[1]||e1[1]===e2[0]||e1[1]===e2[1])continue;
      if(cross(pts[e1[0]],pts[e1[1]],pts[e2[0]],pts[e2[1]]))n++; }
    return n; }
  return {
  down:function(x,y){ for(var i=0;i<pts.length;i++) if(E.dist(x,y,pts[i].x,pts[i].y)<26){ drag=i; E.s('tick'); return; } },
  move:function(x,y){ if(drag!=null){ pts[drag].x=E.cl(x,20,780); pts[drag].y=E.cl(y,20,580); } },
  up:function(){ if(drag==null)return; drag=null;
    if(count()===0){ E.add(200+lvl*50); E.s('win'); lvl++;
      if(lvl>7) return E.won('فككت كل العقد! 🔌','سبع مراحل'); gen(); } },
  draw:function(c){
    E.bg('#0e1018');
    var n=count();
    edges.forEach(function(e){ E.ln(pts[e[0]].x,pts[e[0]].y,pts[e[1]].x,pts[e[1]].y, n?'#5b6488':'#9dff3d',3); });
    pts.forEach(function(p,i){ E.o(p.x,p.y,15, drag===i?'#ffc93d':'#00d4ff'); E.o(p.x,p.y,7,'#0e1018'); });
    E.tx('تقاطعات متبقية: '+n,400,40,26, n?'#ff9f3d':'#9dff3d');
    E.hudL('مرحلة '+lvl); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'tiny-target', t:'الهدف المتناهي الصغر', c:'annoy', e:'🔬', tags:['مزعج','دقّة'],
d:'الهدف يصغر مع كل إصابة حتى يصير بكسلاً واحداً تقريباً. حظاً موفقاً.',
how:'انقر على النقطة', noPad:true,
make:function(E){
  var t,r,x,y,hits,miss;
  function reset(){ r=46; place(); hits=0; miss=0; t=40; }
  function place(){ x=E.rnd(60,740); y=E.rnd(80,540); }
  reset();
  return {
  down:function(mx,my){
    if(E.dist(mx,my,x,y)<Math.max(3,r)){ hits++; E.add(Math.round(200/r*10)); E.s('coin');
      E.burst(x,y,['#9dff3d'],12); r=Math.max(2.2,r*.78); place();
      if(hits>=12) E.won('عين صقر! 🦅','١٢ إصابة متناهية الصغر'); }
    else { miss++; E.add(-15); E.s('buzz'); E.shake(5); } },
  update:function(dt){ t-=dt; if(t<=0) E.over('انتهى الوقت','إصابات '+hits+' · أخطاء '+miss); },
  draw:function(c){
    E.bg('#0b0e18'); E.grid(40,'rgba(255,255,255,.025)');
    E.ring(x,y,Math.max(3,r),'#ff3d7f',2); E.o(x,y,Math.max(2,r*.42),'#ff3d7f');
    if(r<8){ E.ring(x,y,34,'rgba(255,61,127,.25)',1); }
    E.ln(E.m.x-14,E.m.y,E.m.x+14,E.m.y,'rgba(255,255,255,.3)',1);
    E.ln(E.m.x,E.m.y-14,E.m.x,E.m.y+14,'rgba(255,255,255,.3)',1);
    E.tx('نصف القطر: '+r.toFixed(1)+' بكسل',400,40,22,'#98a0b8');
    E.hudL('⏱ '+Math.max(0,t).toFixed(1)+' · '+hits+'/12'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'reverse-ctrl', t:'التحكم المعكوس', c:'annoy', e:'🔄', tags:['مزعج','دماغ'],
d:'الأزرار معكوسة… ثم تنعكس مرة أخرى… ثم تدور. اجمع النجوم إن قدرت.',
how:'الأسهم — لكن لا تصدّقها',
make:function(E){
  var p,stars,mode,mt,t,got;
  function reset(){ p={x:400,y:300}; stars=[]; mode=0; mt=5; t=45; got=0;
    for(var i=0;i<5;i++) stars.push({x:E.rnd(60,740),y:E.rnd(60,540)}); }
  reset();
  var MODES=['طبيعي','معكوس أفقياً','معكوس رأسياً','معكوس تماماً','مدوّر ٩٠°'];
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت','جمعت '+got+' نجمة');
    mt-=dt; if(mt<=0){ mode=E.ri(0,4); mt=E.rnd(3.5,7); E.s('alarm'); }
    var kx=E.kx(), ky=E.ky();
    if(E.m.down){ kx=E.cl((E.m.x-p.x)/60,-1,1); ky=E.cl((E.m.y-p.y)/60,-1,1); }
    var dx=kx,dy=ky;
    if(mode===1)dx=-kx; if(mode===2)dy=-ky;
    if(mode===3){dx=-kx;dy=-ky;} if(mode===4){dx=ky;dy=-kx;}
    p.x=E.cl(p.x+dx*280*dt,16,784); p.y=E.cl(p.y+dy*280*dt,16,584);
    for(var i=stars.length-1;i>=0;i--) if(E.dist(p.x,p.y,stars[i].x,stars[i].y)<26){
      stars.splice(i,1); got++; E.add(100); E.s('coin'); E.burst(p.x,p.y,['#ffc93d'],14);
      stars.push({x:E.rnd(60,740),y:E.rnd(60,540)}); } },
  draw:function(c){
    E.bg('#151024');
    stars.forEach(function(s){ E.spr('⭐',s.x,s.y,32); });
    E.o(p.x,p.y,17,'#00d4ff'); E.o(p.x,p.y,8,'#fff');
    E.tx('التحكم: '+MODES[mode],400,45,28, mode?'#ff3d7f':'#9dff3d');
    E.tx('يتغيّر بعد '+mt.toFixed(1)+'ث',400,78,16,'#98a0b8');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · نجوم '+got); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'notif-spam', t:'إشعارات لا تنتهي', c:'annoy', e:'🔔', tags:['مزعج','سرعة'],
d:'إشعارات تنهال من الأعلى وتغطّي الشاشة. اسحبها بعيداً قبل أن تختنق.',
how:'اسحب كل إشعار خارج الشاشة', noPad:true,
make:function(E){
  var ns,t,cleared,rate,drag;
  var TXT=['رسالة جديدة','أحدهم أعجب بمنشورك','تحديث متوفّر','بطاريتك منخفضة','لديك ٤٧ إشعاراً','ذكرى من ٣ سنوات','تم تسجيل الدخول','عرض ينتهي قريباً'];
  function reset(){ ns=[]; t=45; cleared=0; rate=1.3; drag=null; }
  reset();
  return {
  down:function(x,y){ for(var i=ns.length-1;i>=0;i--){ var n=ns[i];
      if(x>n.x&&x<n.x+300&&y>n.y&&y<n.y+64){ drag={i:i,ox:x-n.x}; return; } } },
  move:function(x,y){ if(drag){ ns[drag.i].x=x-drag.ox; ns[drag.i].vy=0; } },
  up:function(x,y){ if(!drag)return;
    var n=ns[drag.i];
    if(n&&(n.x<-140||n.x>640)){ ns.splice(drag.i,1); cleared++; E.add(40); E.s('swish'); }
    drag=null; },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('نجوت من الإشعارات! 🔕','أزلت '+cleared);
    if(Math.random()<dt*rate&&ns.length<9){ ns.push({x:E.rnd(120,400),y:-70,vy:E.rnd(40,90),t:E.pick(TXT)});
      E.s('alarm'); }
    rate+=dt*.045;
    ns.forEach(function(n,i){ if(drag&&drag.i===i)return; n.y+=n.vy*dt; n.vy*=.99;
      if(n.y>530)n.y=530; });
    if(ns.length>=9) E.over('غرقت في الإشعارات 🔔','أزلت '+cleared+' فقط'); },
  draw:function(c){
    E.bg('#0d1018');
    E.tx('اسحب الإشعارات خارج الشاشة',400,300,26,'rgba(255,255,255,.09)');
    ns.forEach(function(n){ E.rr(n.x,n.y,300,64,14,'#e8ecff');
      E.spr('🔔',n.x+34,n.y+32,26);
      E.tx(n.t,n.x+170,n.y+26,16,'#1a1f33');
      E.tx('الآن',n.x+170,n.y+46,12,'#6d7590'); });
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · '+ns.length+'/9', ns.length>6?'#ff3d7f':'#fff');
    E.hud('أزلت '+cleared+' · '+E.score);
  }};
}});

G({id:'drunk-cursor', t:'المؤشر المخمور', c:'annoy', e:'🥴', tags:['مزعج','دقّة'],
d:'مؤشرك يتبعك… متأخراً ومتمايلاً. مرّره في المسار دون لمس الجدران.',
how:'حرّك الفأرة ببطء وحكمة', noPad:true,
make:function(E){
  var cx,cy,path,idx,t,fails;
  function gen(){ path=[]; var x=80,y=300;
    for(var i=0;i<9;i++){ path.push({x:x,y:y}); x+=E.rnd(60,110); y=E.cl(y+E.rnd(-140,140),90,510); }
    path.push({x:760,y:y}); idx=1; cx=80; cy=300; }
  function reset(){ gen(); t=50; fails=0; }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.over('نفد الوقت','لم تصل للنهاية');
    var tx=E.m.x+Math.sin(E.time*3.1)*26+Math.sin(E.time*7.7)*12;
    var ty=E.m.y+Math.cos(E.time*2.6)*26+Math.cos(E.time*6.3)*12;
    cx+=(tx-cx)*Math.min(1,dt*3.2); cy+=(ty-cy)*Math.min(1,dt*3.2);
    var target=path[idx];
    if(target&&E.dist(cx,cy,target.x,target.y)<34){ idx++; E.add(60); E.s('coin');
      if(idx>=path.length){ E.add(400); return E.won('وصلت رغم كل شيء! 🥴','مؤشر مخمور مروّض'); } }
    var d=distToPath(cx,cy);
    if(d>46){ fails++; E.add(-20); E.s('buzz'); E.shake(6);
      cx=path[Math.max(0,idx-1)].x; cy=path[Math.max(0,idx-1)].y;
      if(fails>=8) E.over('خرجت عن المسار كثيراً','٨ مرات'); } },
  draw:function(c){
    E.bg('#0e1220');
    c.lineJoin='round'; c.lineCap='round';
    c.strokeStyle='#1e2a44'; c.lineWidth=92; c.beginPath();
    path.forEach(function(p,i){ i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y); }); c.stroke();
    c.strokeStyle='#243350'; c.lineWidth=76; c.stroke();
    path.forEach(function(p,i){ if(i&&i<path.length) E.o(p.x,p.y,i<idx?7:11, i<idx?'#2fbd6f':(i===idx?'#ffc93d':'#4a5480')); });
    E.o(E.m.x,E.m.y,7,'rgba(255,255,255,.2)');
    E.spr('🥴',cx,cy,34);
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · خروج '+fails+'/8'); E.hud('النتيجة '+E.score);
  }};
  function distToPath(x,y){
    var best=1e9;
    for(var i=0;i<path.length-1;i++){ var a=path[i],b=path[i+1];
      var dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy||1;
      var tt=E.cl(((x-a.x)*dx+(y-a.y)*dy)/L,0,1);
      best=Math.min(best,E.dist(x,y,a.x+dx*tt,a.y+dy*tt)); }
    return best; }
}});

G({id:'cookie-consent', t:'موافقة الكوكيز', c:'annoy', e:'🍪', tags:['مزعج','سخرية'],
d:'ارفض كل ملفات تعريف الارتباط. زر «رفض» يتنقّل ويصغر ويختبئ. بالتوفيق.',
how:'اعثر على زر «رفض الكل» وانقره', noPad:true,
make:function(E){
  var lvl,rej,acc,t,shrink;
  function gen(){ shrink=Math.max(.35,1-lvl*.1);
    rej={x:E.rnd(60,540),y:E.rnd(330,480),w:180*shrink,h:52*shrink};
    acc={x:E.rnd(60,540),y:E.rnd(330,480),w:200,h:56};
    while(Math.abs(acc.x-rej.x)<190&&Math.abs(acc.y-rej.y)<60) acc.x=E.rnd(60,540); }
  function reset(){ lvl=1; t=40; gen(); }
  reset();
  return {
  down:function(x,y){
    if(x>rej.x&&x<rej.x+rej.w&&y>rej.y&&y<rej.y+rej.h){
      lvl++; E.add(200); E.s('coin');
      if(lvl>8) return E.won('رفضت كل الكوكيز! 🍪','بطل الخصوصية'); gen(); }
    else if(x>acc.x&&x<acc.x+acc.w&&y>acc.y&&y<acc.y+acc.h){
      E.add(-150); E.s('buzz'); E.shake(14);
      if(E.score<-200) return E.over('وافقت على كل شيء 😬','بياناتك في كل مكان'); gen(); } },
  update:function(dt){
    t-=dt; if(t<=0) return E.over('نفد صبرك','وصلت للنافذة '+lvl);
    if(lvl>3){ rej.x+=Math.sin(E.time*2.1+lvl)*40*dt*lvl; rej.x=E.cl(rej.x,20,780-rej.w); }
    if(lvl>5&&E.dist(E.m.x,E.m.y,rej.x+rej.w/2,rej.y+rej.h/2)<110){
      rej.x=E.cl(rej.x+(rej.x-E.m.x)*.06,20,780-rej.w);
      rej.y=E.cl(rej.y+(rej.y-E.m.y)*.06,300,520); } },
  draw:function(c){
    E.bg('#101420');
    E.rr(60,90,680,420,18,'#e8ecff');
    E.spr('🍪',400,150,50);
    E.tx('نحن نحترم خصوصيتك',400,215,26,'#1a1f33');
    E.tx('نستخدم '+ (140+lvl*310) +' شريكاً لتحسين تجربتك…',400,255,17,'#4a5480');
    E.tx('(النافذة رقم '+lvl+')',400,285,15,'#8a93b5');
    E.rr(acc.x,acc.y,acc.w,acc.h,12,'#2fbd6f'); E.tx('قبول الكل',acc.x+acc.w/2,acc.y+acc.h/2,20,'#062012');
    E.rr(rej.x,rej.y,rej.w,rej.h,10,'#c8cfe0');
    E.tx('رفض الكل',rej.x+rej.w/2,rej.y+rej.h/2,Math.max(9,18*shrink),'#4a5480');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'wifi-hold', t:'ابحث عن الشبكة', c:'annoy', e:'📶', tags:['مزعج','صبر'],
d:'الإشارة موجودة في بقعة واحدة… وهي تتحرك. ابقَ داخلها لتحميل الملف.',
how:'حرّك الهاتف بالفأرة أو الأسهم',
make:function(E){
  var p,spot,prog,t,drops;
  function reset(){ p={x:400,y:300}; spot={x:200,y:200,r:70,vx:90,vy:70}; prog=0; t=45; drops=0; }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.over('انقطع الاتصال نهائياً','التحميل '+prog.toFixed(0)+'%');
    if(E.kx()||E.ky()){ p.x=E.cl(p.x+E.kx()*320*dt,20,780); p.y=E.cl(p.y+E.ky()*320*dt,20,580); }
    else { p.x+=(E.m.x-p.x)*Math.min(1,dt*7); p.y+=(E.m.y-p.y)*Math.min(1,dt*7); }
    spot.x+=spot.vx*dt; spot.y+=spot.vy*dt;
    if(spot.x<spot.r||spot.x>800-spot.r)spot.vx*=-1;
    if(spot.y<spot.r||spot.y>600-spot.r)spot.vy*=-1;
    if(Math.random()<dt*.5){ spot.vx=E.rnd(-160,160); spot.vy=E.rnd(-160,160); }
    spot.r=60+Math.sin(E.time*1.4)*18;
    var d=E.dist(p.x,p.y,spot.x,spot.y);
    if(d<spot.r){ prog+=dt*17; E.add(Math.round(20*dt)); if(Math.random()<dt*3)E.s('tick');
      if(prog>=100) return E.won('اكتمل التحميل! 📶','رغم كل شيء'); }
    else { prog=Math.max(0,prog-dt*9); drops+=dt;
      if(Math.random()<dt*1.2)E.s('buzz'); } },
  draw:function(c){
    E.bg('#0b1018');
    var d=E.dist(p.x,p.y,spot.x,spot.y), on=d<spot.r;
    E.o(spot.x,spot.y,spot.r,'rgba(0,212,255,.10)');
    E.ring(spot.x,spot.y,spot.r,'rgba(0,212,255,.35)',2);
    for(var i=1;i<=3;i++) E.ring(spot.x,spot.y,spot.r*i*.42+ (E.time*30)%22,'rgba(0,212,255,.12)',1);
    E.spr('📱',p.x,p.y,48);
    E.spr(on?'📶':'📵',p.x+34,p.y-30,24);
    E.rr(200,540,400,26,8,'#1c2338');
    E.rr(202,542,396*(prog/100),22,7,on?'#9dff3d':'#ff9f3d');
    E.tx(prog.toFixed(0)+'%',400,553,15,'#0b0d14');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)); E.hud(on?'متصل ✅':'لا إشارة ❌', on?'#9dff3d':'#ff3d7f');
  }};
}});
