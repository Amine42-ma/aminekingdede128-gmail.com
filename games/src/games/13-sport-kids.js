/* ============ 13) رياضة وألعاب عائلية ============ */

G({id:'penalty', t:'ضربات الجزاء', c:'sport', e:'⚽', tags:['تصويب','حارس'],
d:'خمس ركلات. الحارس يتعلّم منك — لا تكرر الزاوية نفسها.',
how:'اسحب من الكرة لتحديد الاتجاه والقوة', noPad:true,
make:function(E){
  var ball,aim,kicks,goals,gk,st,hist,msg,mt;
  function reset(){ ball={x:400,y:500,vx:0,vy:0,live:false}; aim=null; kicks=0; goals=0;
    gk={x:400,v:0,dive:0}; st='aim'; hist=[]; msg=''; mt=0; }
  reset();
  return {
  down:function(x,y){ if(st!=='aim')return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim||st!=='aim')return;
    ball.vx=(ball.x-aim.x)*2.6; ball.vy=(ball.y-aim.y)*2.6; ball.live=true; st='fly'; aim=null; kicks++;
    E.s('hit');
    var zone = ball.vx<-90?0 : ball.vx>90?2 : 1;
    var guess = hist.length&&Math.random()<.55 ? hist[hist.length-1] : E.ri(0,2);
    if(hist.length>2){ var counts=[0,0,0]; hist.forEach(function(z){counts[z]++;});
      var b=0; for(var i=1;i<3;i++) if(counts[i]>counts[b])b=i;
      if(Math.random()<.6) guess=b; }
    gk.dive=guess; hist.push(zone); },
  update:function(dt){
    if(mt>0){ mt-=dt; if(mt<=0){ st='aim'; ball={x:400,y:500,vx:0,vy:0,live:false};
      if(kicks>=5){ if(goals>=3) E.won('فزت! ⚽','سجّلت '+goals+' من ٥'); else E.over('خسرت','سجّلت '+goals+' من ٥'); } }
      return; }
    if(st!=='fly')return;
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt; ball.vy+=90*dt;
    var tx=[250,400,550][gk.dive];
    gk.x=E.lerp(gk.x,tx,dt*4.5);
    if(ball.y<200){
      var inGoal = ball.x>210&&ball.x<590&&ball.y>90;
      var saved = Math.abs(ball.x-gk.x)<62;
      if(inGoal&&!saved){ goals++; E.add(220); E.s('win'); msg='هدف! ⚽'; E.burst(ball.x,ball.y,['#9dff3d','#fff'],20); }
      else if(saved){ E.s('thud'); msg='تصدّى الحارس!'; E.add(-30); }
      else { E.s('buzz'); msg='خارج المرمى'; E.add(-40); }
      mt=1.6; st='res'; } },
  draw:function(c){
    E.bg('#1f7a3a');
    for(var i=0;i<10;i++) E.r(0,i*60,800,30,'rgba(255,255,255,.03)');
    E.r(210,90,380,120,'rgba(255,255,255,.06)');
    E.sr(210,90,380,120,'#fff',6);
    for(var x=215;x<590;x+=22) E.ln(x,92,x,208,'rgba(255,255,255,.25)',1);
    E.spr('🧤',gk.x,170,54);
    E.o(ball.x,ball.y,13,'#fff'); E.spr('⚽',ball.x,ball.y,26);
    if(aim){ E.ln(ball.x,ball.y,aim.x,aim.y,'#ffc93d',4); }
    E.tx('ركلة '+Math.min(5,kicks+ (st==='aim'?1:0))+'/5   أهداف: '+goals,400,560,26,'#fff');
    if(mt>0) E.tx(msg,400,300,40, msg[0]==='ه'?'#9dff3d':'#ff3d7f');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'archery', t:'الرماية', c:'sport', e:'🏹', tags:['دقّة','رياح'],
d:'عشرة أسهم، هدف يبتعد، ورياح تتغيّر. عشرة في المنتصف = كمال.',
how:'اسحب للخلف ثم أفلت', noPad:true,
make:function(E){
  var aim,arrow,shots,dist,wind,hits,msg,mt;
  function reset(){ aim=null; arrow=null; shots=0; dist=520; wind=E.rnd(-40,40); hits=[]; msg=''; mt=0; }
  reset();
  return {
  down:function(x,y){ if(arrow)return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim||arrow)return;
    arrow={x:90,y:300,vx:Math.max(60,Math.abs(90-aim.x)*1.9),vy:(300-aim.y)*1.9};
    aim=null; shots++; E.s('swish'); },
  update:function(dt){
    if(mt>0){ mt-=dt; if(mt<=0){ arrow=null; wind=E.rnd(-50,50); dist=Math.min(700,dist+18);
      if(shots>=10){ var tot=hits.reduce(function(a,b){return a+b;},0);
        if(tot>=60) E.won('رامٍ محترف! 🏹','مجموع '+tot); else E.over('انتهت السهام','مجموع '+tot); } }
      return; }
    if(!arrow)return;
    arrow.vy+=170*dt; arrow.vx+=wind*dt*.6;
    arrow.x+=arrow.vx*dt; arrow.y+=arrow.vy*dt;
    if(arrow.x>=dist){
      var d=Math.abs(arrow.y-300);
      var pts = d<12?10 : d<26?8 : d<44?5 : d<70?2 : 0;
      hits.push(pts); E.add(pts*30); E.s(pts>=8?'coin':pts?'tick':'buzz');
      msg = pts===10?'في المنتصف! ١٠':pts?('+'+pts):'أخطأت';
      mt=1.3; }
    else if(arrow.y>560){ hits.push(0); msg='سقط السهم'; mt=1.2; E.s('thud'); } },
  draw:function(c){
    E.sky('#8ac0e8','#2a4a30');
    E.r(0,540,800,60,'#3d6b2a');
    [70,44,26,12].forEach(function(r,i){ E.o(dist,300,r,['#fff','#12161f','#4d9fff','#ff3d5f'][i]); });
    E.o(dist,300,5,'#ffc93d');
    E.spr('🏹',80,300,44);
    if(aim){ E.ln(90,300,aim.x,aim.y,'#8a6a3a',3);
      var vx=Math.abs(90-aim.x)*1.9, vy=(300-aim.y)*1.9, px=90,py=300;
      for(var k=0;k<26;k++){ vy+=170*.035; vx+=wind*.035*.6; px+=vx*.035; py+=vy*.035; E.o(px,py,2,'rgba(255,255,255,.4)'); } }
    if(arrow){ E.ln(arrow.x-20,arrow.y-arrow.vy*.02,arrow.x,arrow.y,'#e8ecff',3); }
    E.hudL('سهم '+Math.min(10,shots+ (arrow?0:1))+'/10 · 🌬 '+(wind>0?'↓':'↑')+Math.abs(wind).toFixed(0));
    E.hud('النتيجة '+E.score);
    if(mt>0) E.tx(msg,400,120,32,'#ffc93d');
  }};
}});

G({id:'bowling', t:'البولينغ', c:'sport', e:'🎳', tags:['فيزياء','دقّة'],
d:'عشرة إطارات، عشرة أهداف. اضبط الموضع والدوران واحصد الضربات الكاملة.',
how:'انقر لتثبيت الموضع ثم الدوران', noPad:true,
make:function(E){
  var st,pos,spin,ball,pins,frame,rollInFrame,total,msg,mt;
  function setPins(){ pins=[]; var rows=[1,2,3,4];
    var y=140;
    for(var r=0;r<4;r++){ for(var i=0;i<=r;i++)
      pins.push({x:400+(i-r/2)*40,y:y-r*34,down:false}); } }
  function reset(){ st=0; pos=400; spin=0; ball=null; frame=1; rollInFrame=1; total=0; msg=''; mt=0; setPins(); }
  reset();
  return {
  down:function(){
    if(mt>0)return;
    if(st===0)st=1; else if(st===1)st=2;
    else if(st===2){ ball={x:pos,y:540,vy:-560,vx:spin*3}; st=3; E.s('swish'); } },
  update:function(dt){
    if(mt>0){ mt-=dt; if(mt<=0)nextRoll(); return; }
    if(st===0) pos=400+Math.sin(E.time*2.2)*160;
    if(st===1) spin=Math.sin(E.time*2.6)*60;
    if(st===3&&ball){ ball.x+=ball.vx*dt; ball.y+=ball.vy*dt; ball.vx+=spin*dt*.6;
      pins.forEach(function(p){ if(!p.down&&E.dist(ball.x,ball.y,p.x,p.y)<22){
        p.down=true; E.s('thud'); E.burst(p.x,p.y,['#fff'],8);
        pins.forEach(function(q){ if(!q.down&&E.dist(p.x,p.y,q.x,q.y)<52&&Math.random()<.75){ q.down=true; } }); } });
      if(ball.y<60||ball.x<20||ball.x>780){ var down=pins.filter(function(p){return p.down;}).length;
        E.add(down*30);
        msg = down===10?'ضربة كاملة! 🎳':down+' أوتاد'; mt=1.5; } } },
  draw:function(c){
    E.bg('#3a2a18');
    E.r(220,0,360,600,'#c8a86a');
    E.ln(240,0,240,600,'#8a6a3a',6); E.ln(560,0,560,600,'#8a6a3a',6);
    pins.forEach(function(p){ if(!p.down) E.spr('🎳',p.x,p.y,30); });
    if(ball) E.o(ball.x,ball.y,18,'#2b3350');
    else { E.o(pos,540,18,'#2b3350');
      if(st>=1) E.ln(pos,540,pos+spin*2,440,'#ffc93d',3); }
    E.tx(st===0?'انقر لتثبيت الموضع':st===1?'انقر لتثبيت الدوران':st===2?'انقر للرمي':'',400,580,20,'#fff');
    if(mt>0) E.tx(msg,400,300,36,'#ffc93d');
    E.hudL('إطار '+frame+'/10 · رمية '+rollInFrame); E.hud('النتيجة '+E.score);
  }};
  function nextRoll(){
    var down=pins.filter(function(p){return p.down;}).length;
    ball=null; st=0;
    if(down===10||rollInFrame===2){ frame++; rollInFrame=1; setPins(); }
    else rollInFrame=2;
    if(frame>10) E.won('انتهت المباراة 🎳','النتيجة '+E.score); }
}});

G({id:'darts', t:'السهام', c:'sport', e:'🎯', tags:['دقّة','أعصاب'],
d:'لوح سهام دوّار. اضرب الأرقام العالية وأنزل رصيدك من ٣٠١ إلى صفر بالضبط.',
how:'انقر على اللوح لرمي سهم', noPad:true,
make:function(E){
  var score,darts,rot,msg,mt;
  function reset(){ score=301; darts=0; rot=0; msg=''; mt=0; }
  reset();
  var VALS=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  return {
  down:function(x,y){
    if(mt>0)return;
    darts++;
    var d=E.dist(x,y,400,300);
    var pts=0,lbl='';
    if(d<12){ pts=50; lbl='المركز! ٥٠'; }
    else if(d<26){ pts=25; lbl='٢٥'; }
    else if(d<200){
      var a=(Math.atan2(y-300,x-400)-rot+9.42)%6.283;
      var idx=Math.floor(a/6.283*20)%20;
      pts=VALS[idx];
      if(d>170){ pts*=2; lbl='مزدوج '+pts; }
      else if(d>105&&d<125){ pts*=3; lbl='ثلاثي '+pts; }
      else lbl=''+pts; }
    else lbl='خارج اللوح';
    E.s(pts>=25?'coin':pts?'tick':'buzz');
    E.burst(x,y,['#ffc93d'],8);
    if(score-pts<0){ msg='تجاوزت! ('+lbl+')'; }
    else { score-=pts; msg=lbl; E.add(pts*10); }
    mt=1;
    if(score===0){ E.add(500); return E.won('صفر بالضبط! 🎯','بـ'+darts+' سهماً'); }
    if(darts>=30) E.over('نفدت السهام','بقي '+score); },
  update:function(dt){ rot+=dt*.55; if(mt>0)mt-=dt; },
  draw:function(c){
    E.bg('#0d1018');
    for(var i=0;i<20;i++){ var a0=i/20*6.283+rot, a1=a0+.314;
      c.beginPath(); c.moveTo(400,300); c.arc(400,300,200,a0,a1); c.closePath();
      c.fillStyle= i%2?'#1a1f33':'#e8e0cc'; c.fill();
      c.beginPath(); c.moveTo(400,300); c.arc(400,300,125,a0,a1); c.arc(400,300,105,a1,a0,true); c.closePath();
      c.fillStyle= i%2?'#2f7a4d':'#a02040'; c.fill();
      c.beginPath(); c.moveTo(400,300); c.arc(400,300,200,a0,a1); c.arc(400,300,170,a1,a0,true); c.closePath();
      c.fillStyle= i%2?'#2f7a4d':'#a02040'; c.fill();
      var mid=a0+.157;
      E.tx(VALS[i],400+Math.cos(mid)*220,300+Math.sin(mid)*220,17,'#dfe6ff'); }
    E.o(400,300,26,'#2f7a4d'); E.o(400,300,12,'#a02040');
    E.tx('المتبقّي: '+score,400,555,34,'#ffc93d');
    if(mt>0) E.tx(msg,400,60,28,'#9dff3d');
    E.hudL('سهام '+darts+'/30'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'beach-volley', t:'الكرة الطائرة الشاطئية', c:'sport', e:'🏐', tags:['فيزياء','خصم'],
d:'اضرب الكرة فوق الشبكة ولا تدعها تلمس أرضك. الخصم يتحسّن مع كل نقطة.',
how:'← → للحركة · ↑ للقفز',
make:function(E){
  var p,ai,ball,s1,s2,skill;
  function serve(d){ ball={x:d>0?600:200,y:200,vx:0,vy:0,r:16}; }
  function reset(){ p={x:200,y:520,vy:0,g:true}; ai={x:600,y:520,vy:0,g:true}; s1=0;s2=0; skill=.5; serve(-1); }
  reset();
  return {
  key:function(k,d){ if(d&&(k==='ArrowUp'||k===' ')&&p.g){ p.vy=-620; p.g=false; E.s('jump'); } },
  down:function(x,y){ if(y<400&&p.g){ p.vy=-620; p.g=false; } },
  update:function(dt){
    p.x=E.cl(p.x+E.kx()*330*dt,30,370);
    if(E.m.down&&E.m.y>400) p.x=E.cl(E.m.x,30,370);
    p.vy+=1500*dt; p.y+=p.vy*dt; if(p.y>520){p.y=520;p.vy=0;p.g=true;}
    var tx=E.cl(ball.x,430,770);
    ai.x=E.lerp(ai.x,tx,dt*(2.2+skill*3));
    if(ai.g&&ball.x>400&&ball.y<380&&Math.abs(ball.x-ai.x)<70&&Math.random()<skill*dt*10){ ai.vy=-600; ai.g=false; }
    ai.vy+=1500*dt; ai.y+=ai.vy*dt; if(ai.y>520){ai.y=520;ai.vy=0;ai.g=true;}
    ball.vy+=620*dt; ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
    if(ball.x<ball.r){ball.x=ball.r;ball.vx*=-1;} if(ball.x>800-ball.r){ball.x=800-ball.r;ball.vx*=-1;}
    if(ball.y<ball.r){ball.y=ball.r;ball.vy*=-1;}
    if(ball.x>386&&ball.x<414&&ball.y>380){ ball.vx*=-1; ball.x+= ball.vx>0?18:-18; E.s('tick'); }
    [{o:p,s:1},{o:ai,s:-1}].forEach(function(q){
      var d=E.dist(ball.x,ball.y,q.o.x,q.o.y-20);
      if(d<44){ var a=Math.atan2(ball.y-(q.o.y-20),ball.x-q.o.x);
        ball.vx=Math.cos(a)*380; ball.vy=Math.min(-260,Math.sin(a)*420); E.s('pop'); } });
    if(ball.y>560){
      if(ball.x<400){ s2++; E.s('lose'); skill=Math.min(1,skill+.05); serve(1); }
      else { s1++; E.add(200); E.s('coin'); skill=Math.min(1,skill+.07); serve(-1); }
      if(s1>=7) return E.won('فزت '+s1+'—'+s2,'بطل الشاطئ');
      if(s2>=7) return E.over('خسرت '+s1+'—'+s2,'حاول القفز أبكر'); } },
  draw:function(c){
    E.sky('#7cc4f0','#e8d0a0');
    E.r(0,545,800,55,'#e0c68a');
    E.r(394,380,12,170,'#8a6a3a');
    for(var y=384;y<540;y+=14) E.ln(388,y,412,y,'rgba(255,255,255,.6)',2);
    E.spr('🧍',p.x,p.y-24,54); E.spr('🧑',ai.x,ai.y-24,54);
    E.spr('🏐',ball.x,ball.y,34);
    E.tx(s1,300,60,40,'#12305a'); E.tx(s2,500,60,40,'#12305a');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'cup-toss', t:'رمية الكأس', c:'sport', e:'🥤', tags:['قذف','دقّة'],
d:'ارمِ الكرة في الكأس. الكؤوس تتحرك وتبتعد، والارتداد مسموح.',
how:'اسحب من الكرة وأفلت', noPad:true,
make:function(E){
  var ball,aim,cups,t,made;
  function gen(){ cups=[]; for(var i=0;i<3;i++) cups.push({x:E.rnd(420,740),y:E.rnd(180,460),
    v:E.rnd(-70,70)*(made>2?1:0)}); }
  function reset(){ ball={x:110,y:480,vx:0,vy:0,live:false}; aim=null; t=60; made=0; gen(); }
  reset();
  return {
  down:function(x,y){ if(ball.live)return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim)return; ball.vx=(ball.x-aim.x)*3; ball.vy=(ball.y-aim.y)*3;
    ball.live=true; aim=null; E.s('swish'); },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت','أدخلت '+made+' كرة');
    cups.forEach(function(cp){ cp.y+=cp.v*dt; if(cp.y<140||cp.y>500)cp.v*=-1; });
    if(!ball.live)return;
    ball.vy+=820*dt; ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
    if(ball.x>790){ball.x=790;ball.vx*=-.7;E.s('tick');}
    if(ball.y<10){ball.y=10;ball.vy*=-.7;}
    if(ball.y>570){ ball={x:110,y:480,vx:0,vy:0,live:false}; E.s('thud'); return; }
    for(var i=0;i<cups.length;i++){ var cp=cups[i];
      if(Math.abs(ball.x-cp.x)<24&&ball.y>cp.y-6&&ball.y<cp.y+26&&ball.vy>0){
        made++; E.add(200); E.s('coin'); E.burst(cp.x,cp.y,['#9dff3d','#fff'],16);
        cups.splice(i,1); if(!cups.length)gen();
        ball={x:110,y:480,vx:0,vy:0,live:false}; t+=4; break; } } },
  draw:function(c){
    E.bg('#1a2436');
    E.r(0,540,800,60,'#2b3350');
    cups.forEach(function(cp){ E.spr('🥤',cp.x,cp.y+10,46); E.ring(cp.x,cp.y,22,'rgba(157,255,61,.4)',2); });
    E.o(ball.x,ball.y,11,'#ff9f3d');
    if(aim){ E.ln(ball.x,ball.y,aim.x,aim.y,'#ffc93d',3);
      var vx=(ball.x-aim.x)*3, vy=(ball.y-aim.y)*3, px=ball.x,py=ball.y;
      for(var k=0;k<24;k++){ vy+=820*.033; px+=vx*.033; py+=vy*.033; E.o(px,py,2,'rgba(255,255,255,.35)'); } }
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · أدخلت '+made); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'weightlift', t:'رفع الأثقال', c:'sport', e:'🏋️', tags:['إيقاع','قوة'],
d:'ارفع الثقل بالتناوب بين الزرّين — بإيقاع منتظم لا سريع ولا بطيء.',
how:'بدّل بين ← و → بإيقاع ثابت',
make:function(E){
  var h,last,lastT,bal,weight,round,lifted;
  function reset(){ h=0; last=0; lastT=0; bal=0; weight=60; round=1; lifted=0; }
  reset();
  function push(side){
    if(side===last){ bal+= side? .18:-.18; E.s('buzz'); return; }
    var now=E.time, iv=now-lastT; lastT=now; last=side;
    var ideal=.28;
    var err=Math.abs(iv-ideal);
    if(err<.18){ h+=6+ (0.18-err)*40; E.add(10); E.s('tick'); bal*=.85; }
    else { bal+= (iv>ideal?.12:-.12); E.add(-5); E.s('thud'); }
    if(h>=100){ lifted++; E.add(300); E.s('win'); round++; weight+=25; h=0; bal=0;
      if(round>5) E.won('رفعت '+weight+' كجم! 🏋️','بطل أثقال'); } }
  return {
  key:function(k,d){ if(!d)return; if(k==='ArrowLeft')push(0); if(k==='ArrowRight')push(1); },
  down:function(x,y){ push(x<400?0:1); },
  update:function(dt){
    h=Math.max(0,h-dt*(9+weight*.14));
    bal*=.995;
    if(Math.abs(bal)>1){ E.shake(16); E.s('lose');
      E.over('اختلّ توازنك 🏋️','رفعت '+lifted+' مرة'); } },
  draw:function(c){
    E.bg('#141826');
    E.r(0,520,800,80,'#2b3350');
    var y=470-h*3.2;
    c.save(); c.translate(400,y); c.rotate(bal*.5);
    E.r(-150,-8,300,16,'#8a93b5');
    E.o(-150,0,32,'#2b3350'); E.o(150,0,32,'#2b3350');
    c.restore();
    E.spr('🏋️',400,500,64);
    E.rr(250,555,300,20,10,'#1c2338'); E.rr(252,557,296*(h/100),16,8,'#9dff3d');
    E.tx(weight+' كجم',400,60,30,'#ffc93d');
    E.rr(300,90,200,14,7,'#1c2338'); E.rr(392+bal*95,88,16,18,6, Math.abs(bal)>.6?'#ff3d7f':'#00d4ff');
    E.tx('التوازن',400,125,15,'#98a0b8');
    E.tx('بدّل ← → بإيقاع ثابت',400,585,15,'#6d7590');
    E.hudL('محاولة '+round+'/5'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'hurdles', t:'سباق الحواجز', c:'sport', e:'🏃', tags:['سرعة','قفز'],
d:'اضغط بالتناوب لتركض أسرع، واقفز فوق كل حاجز في اللحظة الصحيحة.',
how:'بدّل ← → للركض · مسافة/↑ للقفز',
make:function(E){
  var x,v,last,y,vy,g,hurdles,t,hit;
  function reset(){ x=0; v=0; last=-1; y=0; vy=0; g=true; t=0; hit=0;
    hurdles=[]; for(var i=1;i<=10;i++) hurdles.push(i*180); }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft'&&last!==0){ v+=42; last=0; }
    if(k==='ArrowRight'&&last!==1){ v+=42; last=1; }
    if((k===' '||k==='ArrowUp')&&g){ vy=-560; g=false; E.s('jump'); } },
  down:function(mx,my){ if(my<340){ if(g){ vy=-560; g=false; E.s('jump'); } }
    else { var s=mx<400?0:1; if(last!==s){ v+=42; last=s; } } },
  update:function(dt){
    t+=dt;
    v=Math.max(0,v-dt*90); v=Math.min(430,v);
    x+=v*dt;
    vy+=1600*dt; y+=vy*dt; if(y>0){y=0;vy=0;g=true;}
    hurdles.forEach(function(h,i){
      if(!h.done&&Math.abs(h-x)<16&&y>-46){ v*=.35; hit++; E.s('thud'); E.shake(10); hurdles[i]=h-1000; } });
    E.setScore(Math.max(0,Math.round(2000-t*100-hit*100)));
    if(x>=1900) E.won('أنهيت السباق! 🏃',t.toFixed(2)+' ثانية · أخطاء '+hit);
    if(t>60) E.over('تجاوزت الزمن','قطعت '+Math.round(x)+' متراً'); },
  draw:function(c){
    E.sky('#8ac0e8','#3d6b2a');
    E.r(0,470,800,130,'#a0522d');
    for(var i=0;i<20;i++) E.r(((i*100)-(x*2)%100),468,60,5,'rgba(255,255,255,.3)');
    hurdles.forEach(function(h){ var sx=200+(h-x)*2; if(sx<-40||sx>860)return;
      E.r(sx,410,6,60,'#e8ecff'); E.r(sx-20,410,46,8,'#ff3d7f'); });
    E.spr('🏃',200,450+y,54);
    E.rr(250,40,300,18,9,'#1c2338'); E.rr(252,42,296*(v/430),14,7,'#9dff3d');
    E.tx('السرعة',400,80,15,'#dfe6ff');
    E.hudL('⏱ '+t.toFixed(2)+' · '+Math.round(x)+'/1900 م'); E.hud('أخطاء '+hit);
  }};
}});

G({id:'jump-rope', t:'نطّ الحبل', c:'sport', e:'🪢', tags:['إيقاع','قفز'],
d:'اقفز فوق الحبل الذي يتسارع تدريجياً. مئة قفزة متتالية تحدٍّ حقيقي.',
how:'انقر أو مسافة للقفز',
make:function(E){
  var ph,sp,y,vy,g,jumps,fails;
  function reset(){ ph=0; sp=2.2; y=0; vy=0; g=true; jumps=0; fails=0; }
  reset();
  return {
  down:function(){ if(g){ vy=-470; g=false; E.s('jump'); } },
  key:function(k,d){ if(d&&(k===' '||k==='ArrowUp'))this.down(); },
  update:function(dt){
    ph+=sp*dt; sp=2.2+jumps*.02;
    vy+=1500*dt; y+=vy*dt; if(y>0){y=0;vy=0;g=true;}
    var low = Math.sin(ph)<-.86;
    if(low&&!this._c){ this._c=true;
      if(y>-30){ fails++; E.s('buzz'); E.shake(12); 
        if(fails>=3) return E.over('تعثّرت بالحبل','قفزت '+jumps+' مرة'); }
      else { jumps++; E.add(30+jumps); E.s('tick');
        if(jumps>=100) return E.won('١٠٠ قفزة! 🪢','لياقة أسطورية'); } }
    if(!low)this._c=false; },
  draw:function(c){
    E.sky('#3a5a8a','#141c2e');
    E.r(0,500,800,100,'#3d6b2a');
    var s=Math.sin(ph);
    c.strokeStyle='#d9b06a'; c.lineWidth=5; c.beginPath();
    c.moveTo(280,420);
    c.quadraticCurveTo(400,420+s*200,520,420); c.stroke();
    E.spr('🧍',400,480+y,64);
    E.tx('قفزات: '+jumps,400,80,34,'#ffc93d');
    E.hudL('أخطاء '+fails+'/3'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'curling', t:'الكيرلنغ', c:'sport', e:'🥌', tags:['دقّة','انزلاق'],
d:'ادفع الحجر ليتوقّف أقرب ما يمكن من المركز — واطرد أحجار الخصم.',
how:'اسحب لتحديد القوة والاتجاه', noPad:true,
make:function(E){
  var stones,aim,turn,round,cur;
  function reset(){ stones=[]; aim=null; turn=0; round=1; cur=null; }
  reset();
  return {
  down:function(x,y){ if(cur)return; aim={x:x,y:y}; },
  move:function(x,y){ if(aim)aim={x:x,y:y}; },
  up:function(){ if(!aim)return;
    cur={x:400,y:540,vx:(400-aim.x)*1.6,vy:(540-aim.y)*1.6,mine:turn===0};
    stones.push(cur); aim=null; E.s('swish'); },
  update:function(dt){
    var moving=false;
    stones.forEach(function(s){ s.x+=s.vx*dt; s.y+=s.vy*dt; s.vx*=.988; s.vy*=.988;
      if(Math.abs(s.vx)+Math.abs(s.vy)<8){s.vx=0;s.vy=0;} else moving=true;
      if(s.x<20||s.x>780)s.vx*=-.6; s.x=E.cl(s.x,20,780); });
    for(var i=0;i<stones.length;i++)for(var j=i+1;j<stones.length;j++){
      var a=stones[i],b=stones[j],d=E.dist(a.x,a.y,b.x,b.y);
      if(d<34&&d>0){ var nx=(b.x-a.x)/d, ny=(b.y-a.y)/d, ov=(34-d)/2;
        a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;
        var p=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        if(p>0){ a.vx-=p*nx;a.vy-=p*ny;b.vx+=p*nx;b.vy+=p*ny; E.s('thud'); } } }
    for(var k=stones.length-1;k>=0;k--) if(stones[k].y<-40||stones[k].y>620) stones.splice(k,1);
    if(cur&&!moving){ cur=null; turn=1-turn;
      if(turn===1) setTimeout(aiThrow,500);
      if(stones.length>=8) score(); } },
  draw:function(c){
    E.bg('#dfeaf5');
    [110,78,46,16].forEach(function(r,i){ E.o(400,180,r,['#c8d8e8','#a02040','#e8ecf4','#1a5a9a'][i]); });
    stones.forEach(function(s){ E.o(s.x,s.y,17,s.mine?'#c8cfe0':'#a02040');
      E.o(s.x,s.y,9,'#8a93b5'); E.spr('🥌',s.x,s.y,22); });
    if(aim){ E.ln(400,540,aim.x,aim.y,'#1a5a9a',4); }
    if(!cur&&turn===0) E.o(400,540,17,'rgba(200,207,224,.6)');
    E.tx(turn===0?'دورك':'دور الخصم…',400,570,22,'#12305a');
    E.tx('جولة '+round,80,30,22,'#12305a');
    E.tx('النتيجة '+E.score,700,30,22,'#12305a');
  }};
  function aiThrow(){ if(turn!==1)return;
    cur={x:400+E.rnd(-60,60),y:540,vx:E.rnd(-60,60),vy:-E.rnd(300,400),mine:false};
    stones.push(cur); E.s('swish'); }
  function score(){
    var mine=stones.filter(function(s){return s.mine;}).map(function(s){return E.dist(s.x,s.y,400,180);});
    var his=stones.filter(function(s){return !s.mine;}).map(function(s){return E.dist(s.x,s.y,400,180);});
    var bh=his.length?Math.min.apply(null,his):9999;
    var pts=mine.filter(function(d){return d<bh&&d<110;}).length;
    E.add(pts*150); E.s(pts?'win':'lose');
    round++; stones=[]; turn=0;
    if(round>4) E.won('انتهت المباراة 🥌','النتيجة '+E.score); }
}});

G({id:'kid-letters', t:'التقط الحرف', c:'kids', e:'🔠', tags:['أطفال','حروف'],
d:'حروف عربية تسقط من السماء. التقط الحرف المطلوب فقط — تعليمية ولطيفة.',
how:'حرّك السلّة يميناً ويساراً',
make:function(E){
  var AB='ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
  var basket,letters,target,t,got;
  function reset(){ basket={x:400}; letters=[]; target=E.pick(AB); t=60; got=0; }
  reset();
  return {
  move:function(x){ basket.x=E.cl(x,50,750); },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('أحسنت! 🔠','التقطت '+got+' حرفاً');
    if(E.kx()) basket.x=E.cl(basket.x+E.kx()*450*dt,50,750);
    if(Math.random()<dt*1.5) letters.push({x:E.rnd(50,750),y:-30,v:E.rnd(90,160),
      l:Math.random()<.35?target:E.pick(AB)});
    for(var i=letters.length-1;i>=0;i--){ var L=letters[i]; L.y+=L.v*dt;
      if(L.y>640){ letters.splice(i,1); continue; }
      if(L.y>500&&Math.abs(L.x-basket.x)<50){
        if(L.l===target){ got++; E.add(100); E.s('coin'); E.burst(L.x,520,['#9dff3d'],12);
          target=E.pick(AB); }
        else { E.add(-30); E.s('buzz'); }
        letters.splice(i,1); } } },
  draw:function(c){
    E.sky('#a8d8f8','#e8f4ff');
    letters.forEach(function(L){ E.rr(L.x-24,L.y-24,48,48,10, L.l===target?'#ffc93d':'#8ab4d8');
      E.tx(L.l,L.x,L.y,30,'#12305a'); });
    E.spr('🧺',basket.x,530,64);
    E.rr(280,20,240,64,16,'#fff');
    E.tx('التقط: '+target,400,52,30,'#12305a');
    E.tx('⏱ '+Math.max(0,t).toFixed(0)+'  ·  '+got,90,40,24,'#12305a');
  }};
}});

G({id:'kid-count', t:'عُدّ الحيوانات', c:'kids', e:'🐣', tags:['أطفال','أرقام'],
d:'كم حيواناً على الشاشة؟ اختر الرقم الصحيح — للأطفال الصغار.',
how:'انقر الرقم الصحيح', noPad:true,
make:function(E){
  var items,n,opts,round,e;
  function gen(){ n=E.ri(2,9); e=E.pick(['🐣','🐸','🐰','🐼','🐟','🦋','🐝','🐢']);
    items=[]; for(var i=0;i<n;i++) items.push({x:E.rnd(90,710),y:E.rnd(120,380),r:E.rnd(-.3,.3)});
    opts=[n]; while(opts.length<3){ var o=E.ri(1,10); if(opts.indexOf(o)<0)opts.push(o); }
    opts.sort(function(a,b){return a-b;}); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y<450)return; var i=Math.floor((x-100)/210); if(i<0||i>2)return;
    if(opts[i]===n){ E.add(100); E.s('coin'); round++;
      if(round>12) return E.won('عدّاد ماهر! 🐣','١٢ جولة'); gen(); }
    else { E.add(-20); E.s('buzz'); } },
  draw:function(c){
    E.sky('#bde8ff','#eef8ff');
    items.forEach(function(it){ E.spr(e,it.x,it.y,56,it.r); });
    E.tx('كم عددها؟',400,60,34,'#12305a');
    for(var i=0;i<3;i++){ E.rr(100+i*210,450,190,110,22,'#ffd166');
      E.tx(opts[i],195+i*210,505,50,'#12305a'); }
    E.tx('جولة '+round+'/12',110,590,20,'#12305a');
  }};
}});

G({id:'kid-jigsaw', t:'أحجية الصورة', c:'kids', e:'🧩', tags:['أطفال','تركيب'],
d:'قطّع الصورة إلى مربعات ورتّبها. أحجية لطيفة تكبر مع كل جولة.',
how:'انقر قطعتين لتبديلهما', noPad:true,
make:function(E){
  var N,tiles,sel,round,pic;
  function gen(){ N=2+Math.min(3,round); pic=E.pick(['🌈','🦁','🚀','🌻','🐳','🎠','🍉','🏰']);
    tiles=[]; for(var i=0;i<N*N;i++)tiles.push(i);
    do{ tiles.sort(function(){return Math.random()-.5;}); }while(tiles.every(function(v,i){return v===i;}));
    sel=-1; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    var S=Math.floor(420/N), OX=(800-N*S)/2, OY=(600-N*S)/2;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-OY)/S);
    if(cx<0||cy<0||cx>=N||cy>=N)return;
    var i=cy*N+cx;
    if(sel<0){ sel=i; E.s('tick'); return; }
    var t=tiles[sel]; tiles[sel]=tiles[i]; tiles[i]=t; sel=-1; E.s('pop');
    if(tiles.every(function(v,k){return v===k;})){ E.add(300); E.s('win'); round++;
      if(round>5) return E.won('أحجية مكتملة! 🧩','خمس صور'); gen(); } },
  draw:function(c){
    E.bg('#101828');
    var S=Math.floor(420/N), OX=(800-N*S)/2, OY=(600-N*S)/2;
    tiles.forEach(function(v,i){ var x=OX+(i%N)*S, y=OY+((i/N)|0)*S;
      E.rr(x+2,y+2,S-4,S-4,8, i===sel?'#7c5cff':'#232a3e');
      c.save(); c.beginPath(); c.rect(x+2,y+2,S-4,S-4); c.clip();
      var cx2 = OX + N*S/2 + ((i%N)-(v%N))*S;
      var cy2 = OY + N*S/2 + (((i/N)|0)-((v/N)|0))*S;
      E.spr(pic, cx2, cy2, N*S*.92);
      c.restore(); });
    E.tx('رتّب الصورة',400,50,26,'#dfe6ff');
    E.hudL('صورة '+round+'/5'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'kid-maze', t:'متاهة الأرنب', c:'kids', e:'🐰', tags:['أطفال','متاهة'],
d:'ساعد الأرنب ليصل إلى الجزرة. متاهات سهلة وواضحة للصغار.',
how:'الأسهم أو اسحب',
make:function(E){
  var W=11,H=9,m,px,py,lvl;
  function gen(){ m=[]; for(var y=0;y<H;y++){ m.push([]); for(var x=0;x<W;x++)m[y].push(1); }
    var st=[[1,1]]; m[1][1]=0;
    while(st.length){ var cur=st[st.length-1],x=cur[0],y=cur[1];
      var o=[[2,0],[-2,0],[0,2],[0,-2]].filter(function(d){ var nx=x+d[0],ny=y+d[1];
        return nx>0&&ny>0&&nx<W-1&&ny<H-1&&m[ny][nx]===1; });
      if(!o.length){st.pop();continue;}
      var d2=E.pick(o); m[y+d2[1]/2][x+d2[0]/2]=0; m[y+d2[1]][x+d2[0]]=0; st.push([x+d2[0],y+d2[1]]); }
    m[H-2][W-2]=0; px=1; py=1; }
  function reset(){ lvl=1; gen(); }
  reset();
  function mv(dx,dy){ var nx=px+dx,ny=py+dy;
    if(m[ny]&&m[ny][nx]===0){ px=nx;py=ny; E.s('tick');
      if(px===W-2&&py===H-2){ E.add(200); E.s('win'); lvl++;
        if(lvl>6) return E.won('وصل الأرنب للجزرة! 🥕','ست متاهات'); gen(); } } }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')mv(-1,0); if(k==='ArrowRight')mv(1,0);
    if(k==='ArrowUp')mv(0,-1); if(k==='ArrowDown')mv(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))mv(dx>0?1:-1,0); else mv(0,dy>0?1:-1); },
  draw:function(c){
    E.bg('#eef8e8');
    var S=56,OX=(800-W*S)/2,OY=(600-H*S)/2;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++)
      E.rr(OX+x*S,OY+y*S,S,S,6, m[y][x]?'#4a9e5c':'#f8fff0');
    E.spr('🥕',OX+(W-2)*S+S/2,OY+(H-2)*S+S/2,36);
    E.spr('🐰',OX+px*S+S/2,OY+py*S+S/2,38);
    E.tx('متاهة '+lvl+'/6',400,40,26,'#2a5a2a');
  }};
}});

G({id:'kid-notes', t:'نغمات الحيوانات', c:'kids', e:'🎶', tags:['أطفال','موسيقى'],
d:'اضغط الحيوانات لتسمع نغماتها، ثم أعِد اللحن القصير الذي سمعته.',
how:'انقر الحيوانات بالترتيب', noPad:true,
make:function(E){
  var A=[['🐮',262],['🐱',330],['🐶',392],['🐦',523],['🐸',440]];
  var seq,i,show,st,round;
  function gen(){ seq=[]; for(var k=0;k<1+round;k++)seq.push(E.ri(0,4));
    i=0; show=true; st=0; }
  function reset(){ round=1; gen(); }
  reset();
  function press(n){
    if(show)return;
    E.tone(A[n][1],.3,'triangle',.18);
    if(seq[i]===n){ i++; E.add(30);
      if(i>=seq.length){ E.add(100); E.s('win'); round++;
        if(round>8) return E.won('أذن موسيقية! 🎶','ثماني ألحان'); setTimeout(gen,700); show=true; st=-.7; i=0; } }
    else { E.add(-20); E.s('buzz'); i=0; } }
  return {
  down:function(x,y){ if(y<300||y>480)return; var n=Math.floor((x-30)/150); if(n>=0&&n<5)press(n); },
  update:function(dt){ if(!show)return; st+=dt;
    if(st>.5){ st=0;
      if(this._f>=0){ this._f=-1; }
      else if(i<seq.length){ this._f=seq[i]; E.tone(A[seq[i]][1],.35,'triangle',.2); i++; }
      else { show=false; i=0; } } },
  draw:function(c){
    E.sky('#fff0c0','#ffd8a0');
    E.tx(show?'استمع… 👂':'كرّر اللحن 🎶',400,140,34,'#8a4a00');
    for(var n=0;n<5;n++){ var x=30+n*150;
      E.rr(x,300,140,180,26, this._f===n?'#ffc93d':'#fff');
      E.spr(A[n][0],x+70,390,64); }
    E.tx('لحن '+round+'/8',400,540,24,'#8a4a00');
  }};
}});

G({id:'kid-paint', t:'لوّن بالأرقام', c:'kids', e:'🖍️', tags:['أطفال','ألوان'],
d:'كل خانة تحمل رقماً ولكل رقم لون. لوّن الصورة كاملة لتظهر.',
how:'اختر لوناً ثم انقر الخانات', noPad:true,
make:function(E){
  var N=10,map,col,C=['#ff5c5c','#5cc8ff','#9dff3d','#ffd166','#c98cff'],sel,done,pic,round;
  var PICS=[
    ['..111....','.11211...','1122211..','.1122111.','..11111..','...111...','....1....','....1....'],
    ['...44....','..4444...','.444444..','44444444.','..3333...','..3333...','..3..3...','..3..3...'],
    ['.22222...','2211122..','2111112..','2111112..','.211112..','..1111...','...11....','...11....']
  ];
  function gen(){ pic=PICS[(round-1)%PICS.length];
    map=[]; col=[];
    for(var y=0;y<8;y++){ map.push([]); col.push([]);
      for(var x=0;x<9;x++){ var ch=pic[y][x];
        map[y].push(ch==='.'?0:parseInt(ch,10)); col[y].push(0); } }
    sel=1; done=0; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y>500){ var i=Math.floor((x-150)/100)+1; if(i>=1&&i<=5){ sel=i; E.s('tick'); } return; }
    var S=56,OX=(800-9*S)/2,OY=40;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-OY)/S);
    if(cx<0||cy<0||cx>=9||cy>=8)return;
    if(!map[cy][cx])return;
    if(col[cy][cx]===0&&sel===map[cy][cx]){ col[cy][cx]=sel; done++; E.add(20); E.s('pop');
      var total=0; map.forEach(function(r){ r.forEach(function(v){ if(v)total++; }); });
      if(done>=total){ E.add(200); E.s('win'); round++;
        if(round>3) return E.won('رسّام صغير! 🖍️','ثلاث صور'); gen(); } }
    else E.s('buzz'); },
  draw:function(c){
    E.bg('#fdfbf5');
    var S=56,OX=(800-9*S)/2,OY=40;
    for(var y=0;y<8;y++)for(var x=0;x<9;x++){ var v=map[y][x]; if(!v)continue;
      E.rr(OX+x*S+2,OY+y*S+2,S-4,S-4,6, col[y][x]?C[col[y][x]-1]:'#f0eee6');
      if(!col[y][x]) E.tx(v,OX+x*S+S/2,OY+y*S+S/2,22,'#8a93b5'); }
    for(var i=1;i<=5;i++){ E.rr(150+(i-1)*100,505,86,70,14,C[i-1]);
      if(sel===i) E.sr(150+(i-1)*100,505,86,70,'#12161f',4);
      E.tx(i,193+(i-1)*100,540,26,'#12161f'); }
    E.tx('صورة '+round+'/3',100,40,22,'#4a5480');
  }};
}});
