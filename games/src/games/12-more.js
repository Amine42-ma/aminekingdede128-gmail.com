/* ============ 12) مضحكة ومزعجة وغريبة — الجزء الثاني ============ */

G({id:'count-sheep', t:'عدّ الخراف', c:'funny', e:'🐑', tags:['نوم','تركيز'],
d:'عدّ الخراف القافزة لتنام… لكن بعضها بقرة، والبقرة تعيدك مستيقظاً.',
how:'انقر مع كل خروف يقفز', noPad:true,
make:function(E){
  var animals,sleep,t,counted,rate;
  function reset(){ animals=[]; sleep=0; t=0; counted=0; rate=1.4; }
  reset();
  return {
  down:function(){
    var near=null;
    animals.forEach(function(a){ if(!a.done&&Math.abs(a.x-400)<110) near=a; });
    if(!near){ sleep=Math.max(0,sleep-6); E.s('buzz'); E.add(-20); return; }
    near.done=true;
    if(near.sheep){ counted++; sleep+=6; E.add(40); E.s('pop'); E.tone(300+counted*8,.1,'sine',.1); }
    else { sleep=Math.max(0,sleep-18); E.add(-80); E.s('burp'); E.shake(12); } },
  update:function(dt){
    t+=dt; rate=1.4+t*.04;
    sleep=Math.max(0,sleep-dt*1.6);
    if(Math.random()<dt*rate) animals.push({x:-60,y:E.rnd(300,430),v:E.rnd(160,280),sheep:Math.random()>.24,done:false});
    for(var i=animals.length-1;i>=0;i--){ var a=animals[i]; a.x+=a.v*dt;
      if(a.x>870){ if(a.sheep&&!a.done){ sleep=Math.max(0,sleep-4); } animals.splice(i,1); } }
    if(sleep>=100) E.won('نمت أخيراً 😴','عددت '+counted+' خروفاً');
    if(t>75) E.over('طلع الفجر ولم تنم','عددت '+counted+' خروفاً'); },
  draw:function(c){
    var d=E.cl(sleep/100,0,1);
    E.sky('#1a2440','#05060e');
    E.alpha(d*.7,function(){ E.bg('#000'); });
    E.r(0,450,800,150,'#1a2a1a');
    animals.forEach(function(a){ if(a.done)return;
      var y=a.y-Math.abs(Math.sin(a.x*.02))*60;
      E.spr(a.sheep?'🐑':'🐄',a.x,y,44); });
    E.spr(d>.7?'😴':d>.4?'😪':'😐',400,180,80);
    E.rr(250,520,300,24,10,'#1c2338'); E.rr(252,522,296*d,20,8,'#7c5cff');
    E.tx('النعاس',400,532,14,'#dfe6ff');
    E.hudL('خراف: '+counted); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'hot-potato', t:'البطاطا الساخنة', c:'funny', e:'🥔', tags:['توقيت','مخاطرة'],
d:'مرّر البطاطا قبل أن تنفجر — لكن كل ثانية تحتفظ بها تعطيك نقاطاً أكثر.',
how:'انقر للتمرير · اصبر لنقاط أكثر', noPad:true,
make:function(E){
  var fuse,holder,round,banked,t;
  function newR(){ fuse=E.rnd(2.2,6); t=0; holder=0; }
  function reset(){ round=1; banked=0; newR(); }
  reset();
  return {
  down:function(){
    if(holder!==0)return;
    var pts=Math.round(t*60); banked+=pts; E.add(pts); E.s('swish');
    holder=1; },
  update:function(dt){
    t+=dt; fuse-=dt;
    if(holder===0&&Math.random()<dt*.02){}
    if(holder===1){ 
      if(t>fuse-.35||Math.random()<dt*1.6){ 
        if(fuse<=0){} else { holder=0; t=Math.max(0,t-0); E.s('pop'); } } }
    if(fuse<=0){ E.s('boom'); E.shake(22); E.burst(400,300,['#ff6b3d','#ffc93d'],28,240);
      if(holder===0){ E.add(-200);
        if(E.score<0) return E.over('انفجرت في يدك 💥','رصيدك '+banked);
        round++; if(round>8) return E.won('نجوت بأعصابك 🥔','مجموع '+banked); newR(); }
      else { E.add(200); round++; E.s('win');
        if(round>8) return E.won('نجوت بأعصابك 🥔','مجموع '+banked); newR(); } } },
  draw:function(c){
    E.bg('#20120a');
    E.spr('🧑',220,380,90); E.spr('🧑‍🦰',580,380,90);
    var hx = holder===0?250:550;
    E.spr('🥔',hx,300,60+Math.sin(E.time*20)*4);
    E.spr('🔥',hx,250,26+Math.sin(E.time*14)*6);
    E.tx('نقاط في يدك: '+Math.round(t*60),400,120,30, t>3?'#ff3d7f':'#ffc93d');
    E.tx('الجولة '+round+'/8 · بنك '+banked,400,70,22,'#98a0b8');
    E.tx(holder===0?'انقر للتمرير':'الطرف الآخر يمسكها…',400,520,22,'#dfe6ff');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'pigeon-rain', t:'مطر الحمام', c:'funny', e:'🐦', tags:['تفادي','حظّ'],
d:'حمام غاضب فوق المدينة… وأنت تحت. تفادَ ما ينزل واحمِ قهوتك.',
how:'← → للحركة · ↑ لفتح المظلّة',
make:function(E){
  var p,drops,birds,t,umb,hits;
  function reset(){ p={x:400}; drops=[]; birds=[]; t=50; umb=3; hits=0;
    for(var i=0;i<6;i++) birds.push({x:E.rnd(60,740),y:E.rnd(60,180),v:E.rnd(-70,70)}); }
  reset();
  return {
  key:function(k,d){ if(d&&(k==='ArrowUp'||k===' ')&&umb>0&&!this.open){ this.open=1.4; umb--; E.s('pop'); } },
  down:function(x,y){ if(y<300){ if(umb>0&&!this.open){ this.open=1.4; umb--; E.s('pop'); } }
    else p.x=E.cl(x,30,770); },
  move:function(x,y){ if(y>300)p.x=E.cl(x,30,770); },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('نجوت من الحمام! ☕','بقيت قهوتك سليمة');
    if(this.open>0)this.open-=dt;
    p.x=E.cl(p.x+E.kx()*330*dt,30,770);
    birds.forEach(function(b){ b.x+=b.v*dt; if(b.x<40||b.x>760)b.v*=-1;
      if(Math.random()<dt*.45) drops.push({x:b.x,y:b.y+16,v:120}); });
    for(var i=drops.length-1;i>=0;i--){ var d=drops[i]; d.v+=500*dt; d.y+=d.v*dt;
      if(d.y>600){ drops.splice(i,1); continue; }
      if(d.y>440&&Math.abs(d.x-p.x)<(this.open>0?60:22)){
        if(this.open>0){ drops.splice(i,1); E.add(20); E.s('tick'); continue; }
        drops.splice(i,1); hits++; E.add(-70); E.s('buzz'); E.shake(12);
        if(hits>=5) return E.over('غطّاك الحمام 🐦','صمدت '+(50-t).toFixed(0)+' ثانية'); } }
    E.add(Math.round(14*dt)); },
  draw:function(c){
    E.sky('#7cb0e0','#2a4060');
    birds.forEach(function(b){ E.spr('🐦',b.x,b.y,34); });
    drops.forEach(function(d){ E.o(d.x,d.y,5,'#e8ecff'); });
    E.r(0,500,800,100,'#4a4a54');
    if(this.open>0){ E.arc(p.x,470,58,3.14159,6.283,'#ff3d7f',12); }
    E.spr('🧍',p.x,470,50); E.spr('☕',p.x+26,478,20);
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · ☂️×'+umb+' · إصابات '+hits+'/5');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'snooze-war', t:'حرب زرّ الغفوة', c:'funny', e:'⏰', tags:['صباح','توقيت'],
d:'المنبّه يرنّ. اضغط غفوة… لكن كل غفوة تجعل المنبّه أذكى وأسرع في الهروب.',
how:'انقر زر الغفوة قبل نفاد الصبر', noPad:true,
make:function(E){
  var btn,snoozes,t,limit,late;
  function reset(){ btn={x:400,y:400,r:70}; snoozes=0; t=0; limit=5; late=0; }
  reset();
  return {
  down:function(x,y){
    if(E.dist(x,y,btn.x,btn.y)<btn.r){ snoozes++; E.add(80); E.s('pop'); t=0;
      limit=Math.max(1.4,5-snoozes*.35);
      btn.x=E.rnd(100,700); btn.y=E.rnd(200,520); btn.r=Math.max(26,70-snoozes*3.5);
      if(snoozes>=15) E.won('نمت ١٥ غفوة! ⏰','تأخرت عن كل شيء، لكن ارتحت'); }
    else { E.add(-30); E.s('buzz'); } },
  update:function(dt){
    t+=dt;
    if(snoozes>4){ btn.x+=Math.sin(E.time*2.4+snoozes)*90*dt; btn.x=E.cl(btn.x,70,730); }
    if(!MUTED&&Math.random()<dt*6) E.tone(900,.04,'square',.05);
    if(t>limit){ late++; E.add(-150); E.s('alarm'); E.shake(14); t=0;
      if(late>=3) E.over('تأخرت عن العمل ⏰','غفوات: '+snoozes); } },
  draw:function(c){
    E.bg('#0e1220');
    E.spr('⏰',400,140,90+Math.sin(E.time*20)*8);
    E.tx('غفوات: '+snoozes,400,240,30,'#ffc93d');
    E.o(btn.x,btn.y,btn.r,'#2fbd6f'); E.ring(btn.x,btn.y,btn.r,'#9dff3d',3);
    E.tx('غفوة',btn.x,btn.y,Math.max(12,btn.r/3),'#062012');
    E.rr(250,555,300,16,8,'#1c2338'); E.rr(252,557,296*(1-t/limit),12,6, t/limit>.7?'#ff3d7f':'#00d4ff');
    E.hudL('تأخير '+late+'/3'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'gum-shoe', t:'العلكة تحت الحذاء', c:'annoy', e:'🦶', tags:['مزعج','لزج'],
d:'علكة التصقت بحذائك. اسحب لتخليصها — لكنها تمطّ وتلتصق من جديد.',
how:'اسحب سريعاً للأعلى مراراً', noPad:true,
make:function(E){
  var stick,pulls,t,stretch,last;
  function reset(){ stick=100; pulls=0; t=45; stretch=0; last=0; }
  reset();
  return {
  down:function(x,y){ last=y; },
  move:function(x,y){
    if(!E.m.down)return;
    var d=last-y;
    if(d>0){ stretch=Math.min(180,stretch+d*.6); stick-=d*.09; pulls++;
      if(Math.random()<.25)E.s('tick'); E.add(4); }
    last=y; },
  up:function(){ stretch=0; },
  update:function(dt){
    t-=dt; if(t<=0) return E.over('استسلمت للعلكة','بقي '+Math.max(0,stick).toFixed(0)+'٪');
    stick=Math.min(100,stick+dt*4.5);
    if(stick<=0) E.won('تخلّصت منها! 🦶','بعد '+pulls+' سحبة'); },
  draw:function(c){
    E.bg('#20242e');
    E.r(0,480,800,120,'#3a3a44');
    E.spr('👟',400,430,90);
    c.strokeStyle='#ff9fd0'; c.lineWidth=Math.max(4,26-stretch*.1); c.lineCap='round';
    c.beginPath(); c.moveTo(400,470); c.quadraticCurveTo(400+Math.sin(E.time*3)*30,470+stretch/2,400,480+stretch); c.stroke();
    E.o(400,480+stretch,18,'#ff9fd0');
    E.rr(250,60,300,24,10,'#1c2338'); E.rr(252,62,296*E.cl(stick/100,0,1),20,8,'#ff9fd0');
    E.tx('الالتصاق '+Math.max(0,stick).toFixed(0)+'٪',400,110,20,'#dfe6ff');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · سحبات '+pulls); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'autocorrect', t:'التصحيح التلقائي', c:'annoy', e:'📱', tags:['مزعج','كلمات'],
d:'اكتب الكلمة المطلوبة… لكن التصحيح التلقائي يغيّر حروفك عشوائياً. صحّح بسرعة.',
how:'اكتب بلوحة المفاتيح', noPad:true,
make:function(E){
  var WORDS=['سلام','كتاب','قهوة','مدرسة','هاتف','نافذة','مطر','شكرا','جميل','سريع'];
  var target,typed,t,round,changed,ct;
  function gen(){ target=E.pick(WORDS); typed=''; t=Math.max(5,14-round); changed=''; ct=0; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if(k==='Backspace'){ typed=typed.slice(0,-1); return; }
    if(k.length!==1)return;
    typed+=k;
    if(Math.random()<.32&&typed.length>1){
      var i=E.ri(0,typed.length-1);
      var pool='ابتثجحخدذرزسشصضطعفقكلمنهوي';
      var ch=pool[E.ri(0,pool.length-1)];
      changed='غيّر «'+typed[i]+'» إلى «'+ch+'»'; ct=1.6;
      typed=typed.slice(0,i)+ch+typed.slice(i+1); E.s('buzz'); }
    if(typed===target){ E.add(150+Math.floor(t)*10); E.s('win'); round++;
      if(round>8) return E.won('هزمت التصحيح! 📱','ثماني كلمات'); gen(); }
    else if(typed.length>target.length+2){ typed=''; E.add(-30); E.s('tick'); } },
  update:function(dt){ t-=dt; if(ct>0)ct-=dt;
    if(t<=0){ E.add(-60); E.s('lose');
      if(round>3&&E.score<50) return E.over('غلبك التصحيح','الكلمة كانت: '+target); gen(); } },
  draw:function(c){
    E.bg('#0d1220');
    E.rr(180,90,440,420,26,'#1c2338');
    E.tx('اكتب: '+target,400,170,32,'#ffc93d');
    E.rr(220,250,360,70,12,'#0d1220');
    E.tx(typed||'…',400,285,30, typed===target?'#9dff3d':'#e8ecff');
    if(ct>0) E.tx('التصحيح التلقائي '+changed,400,360,17,'#ff3d7f');
    E.rr(220,420,360,14,7,'#0d1220'); E.rr(222,422,356*E.cl(t/14,0,1),10,5,'#00d4ff');
    E.hudL('كلمة '+round+'/8'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'buffering', t:'إنترنت بطيء', c:'annoy', e:'⌛', tags:['مزعج','صبر'],
d:'الفيديو يتوقّف للتخزين المؤقّت باستمرار. حرّك الهوائي وأعد التحميل لتشاهد ٦٠ ثانية.',
how:'اسحب الهوائي · انقر «إعادة تحميل»', noPad:true,
make:function(E){
  var ant,sweet,watched,buf,t,reloads;
  function reset(){ ant=400; sweet=E.rnd(120,680); watched=0; buf=0; t=0; reloads=3; }
  reset();
  return {
  down:function(x,y){ if(y>500&&x>320&&x<480){ if(reloads>0){ reloads--; buf=0; sweet=E.rnd(120,680); E.s('power'); } return; }
    ant=E.cl(x,40,760); },
  move:function(x,y){ if(E.m.down&&y<480) ant=E.cl(x,40,760); },
  update:function(dt){
    t+=dt;
    var q=E.cl(1-Math.abs(ant-sweet)/260,0,1);
    if(Math.random()<dt*.35) sweet=E.cl(sweet+E.rnd(-120,120),80,720);
    if(q>.55){ watched+=dt; buf=Math.max(0,buf-dt); E.add(Math.round(30*dt)); }
    else { buf+=dt; if(Math.random()<dt*2)E.s('tick');
      if(buf>7){ E.add(-100); buf=0;
        if(reloads<=0&&watched<20) return E.over('انقطع الاتصال نهائياً','شاهدت '+watched.toFixed(0)+' ثانية'); } }
    if(watched>=60) E.won('شاهدت الفيديو كاملاً! 📺','رغم الإنترنت'); },
  draw:function(c){
    E.bg('#0d1018');
    var q=E.cl(1-Math.abs(ant-sweet)/260,0,1);
    E.rr(140,80,520,300,14,'#000');
    if(q>.55){ E.rr(150,90,500,280,10,'#1a3a5a'); E.spr('📺',400,230,90);
      E.tx('يعمل ✅',400,340,22,'#9dff3d'); }
    else { E.spr('⌛',400,210,64);
      E.tx('تخزين مؤقّت… '+Math.round(buf/7*100)+'٪',400,300,24,'#ff9f3d');
      E.arc(400,210,50,E.time*4,E.time*4+2,'#00d4ff',5); }
    E.ln(ant,470,ant,400,'#8a93b5',5); E.o(ant,398,10,'#00d4ff');
    E.r(40,470,720,8,'#2b3350');
    E.rr(320,505,160,54,12, reloads>0?'#7c5cff':'#39406b');
    E.tx('إعادة تحميل ('+reloads+')',400,532,17,'#fff');
    E.rr(250,570,300,14,7,'#1c2338'); E.rr(252,572,296*(watched/60),10,5,'#9dff3d');
    E.hudL('الإشارة '+Math.round(q*100)+'٪', q>.55?'#9dff3d':'#ff3d7f');
    E.hud('شاهدت '+watched.toFixed(0)+'/60 ث');
  }};
}});

G({id:'broken-cart', t:'عربة التسوّق العنيدة', c:'annoy', e:'🛒', tags:['مزعج','قيادة'],
d:'عجلة العربة مكسورة وتنحرف دائماً. اجمع قائمة التسوّق دون كسر شيء.',
how:'حرّك الفأرة أو الأسهم', noPad:false,
make:function(E){
  var cart,items,got,t,bias,shelves;
  function reset(){ cart={x:400,y:500,vx:0,vy:0}; got=0; t=60; bias=E.rnd(-1,1)*120;
    items=[]; for(var i=0;i<8;i++) items.push({x:E.rnd(60,740),y:E.rnd(80,420),e:E.pick(['🍞','🥛','🧀','🍅','🥚','🍫','🧻','🍌']),got:false});
    shelves=[]; for(var j=0;j<5;j++) shelves.push({x:E.rnd(80,620),y:E.rnd(80,420),w:E.rnd(80,160),h:24}); }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.over('أُغلق المتجر','جمعت '+got+'/8');
    if(Math.random()<dt*.5) bias=E.rnd(-1,1)*150;
    var kx=E.kx(), ky=E.ky();
    if(!kx&&!ky&&E.m.down){ kx=E.cl((E.m.x-cart.x)/60,-1,1); ky=E.cl((E.m.y-cart.y)/60,-1,1); }
    cart.vx=E.lerp(cart.vx,kx*220+bias,dt*3.2);
    cart.vy=E.lerp(cart.vy,ky*220,dt*3.2);
    cart.x=E.cl(cart.x+cart.vx*dt,20,780); cart.y=E.cl(cart.y+cart.vy*dt,20,580);
    shelves.forEach(function(s){ if(cart.x>s.x-18&&cart.x<s.x+s.w+18&&cart.y>s.y-18&&cart.y<s.y+s.h+18){
      E.add(-50); E.s('boom'); E.shake(12); cart.vx*=-1; cart.vy*=-1;
      cart.x=E.cl(cart.x+cart.vx*.1,20,780); } });
    items.forEach(function(it){ if(!it.got&&E.dist(cart.x,cart.y,it.x,it.y)<30){
      it.got=true; got++; E.add(150); E.s('coin');
      if(got>=8) E.won('أنهيت التسوّق! 🛒','رغم العجلة المكسورة'); } }); },
  draw:function(c){
    E.bg('#e8ecf4');
    shelves.forEach(function(s){ E.rr(s.x,s.y,s.w,s.h,4,'#8a6a3a'); });
    items.forEach(function(it){ if(!it.got) E.spr(it.e,it.x,it.y,36); });
    E.spr('🛒',cart.x,cart.y,44);
    E.ln(cart.x,cart.y,cart.x+bias*.3,cart.y,'rgba(255,61,127,.5)',3);
    E.tx('⏱ '+Math.max(0,t).toFixed(0)+' · '+got+'/8',110,30,22,'#1a1f33');
    E.tx('النتيجة '+E.score,690,30,22,'#1a1f33');
  }};
}});

G({id:'printer-jam', t:'الطابعة العنيدة', c:'annoy', e:'🖨️', tags:['مزعج','إصلاح'],
d:'ورق عالق، حبر ناقص، وطلب طباعة عاجل. أصلح المشاكل فور ظهورها.',
how:'انقر المشكلة الظاهرة لإصلاحها', noPad:true,
make:function(E){
  var jobs,issue,t,printed,it;
  var ISSUES=[['ورق عالق','📄'],['الحبر ناقص','🖋️'],['غطاء مفتوح','🚪'],['اتصال مقطوع','🔌'],['ورق فارغ','📥']];
  function reset(){ jobs=10; issue=null; t=60; printed=0; it=0; }
  reset();
  return {
  down:function(x,y){
    if(!issue)return;
    if(x>issue.x-70&&x<issue.x+70&&y>issue.y-40&&y<issue.y+40){
      issue=null; E.add(80); E.s('power'); }
    else { E.add(-25); E.s('buzz'); } },
  update:function(dt){
    t-=dt; if(t<=0) return E.over('انتهى الوقت','طبعت '+printed+'/10');
    if(!issue){ it+=dt;
      if(it>1.1){ printed++; it=0; E.add(120); E.s('tick');
        if(printed>=10) return E.won('طبعت كل شيء! 🖨️','معجزة'); }
      if(Math.random()<dt*.85){ var i=E.pick(ISSUES);
        issue={n:i[0],e:i[1],x:E.rnd(150,650),y:E.rnd(150,450)}; E.s('alarm'); } } },
  draw:function(c){
    E.bg('#131722');
    E.rr(280,220,240,180,16,'#4a5480'); E.rr(300,190,200,40,8,'#39406b');
    E.spr('🖨️',400,300,80);
    if(issue){ E.rr(issue.x-70,issue.y-40,140,80,12,'#ff3d7f');
      E.spr(issue.e,issue.x,issue.y-8,30); E.tx(issue.n,issue.x,issue.y+24,14,'#fff'); }
    else { E.tx('جارٍ الطباعة…',400,140,26,'#9dff3d'); }
    E.rr(250,470,300,20,8,'#1c2338'); E.rr(252,472,296*(printed/10),16,6,'#9dff3d');
    E.tx(printed+' / 10 صفحات',400,510,20,'#dfe6ff');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'color-mix', t:'خلط الألوان', c:'weird', e:'🎨', tags:['ألوان','دقّة'],
d:'اضبط الأحمر والأخضر والأزرق لتطابق اللون المطلوب — بعينك فقط، بلا أرقام.',
how:'اسحب المزالق الثلاثة', noPad:true,
make:function(E){
  var t3,cur,round,drag,res,rt;
  function gen(){ t3=[E.ri(30,225),E.ri(30,225),E.ri(30,225)]; cur=[128,128,128]; res=''; rt=0; }
  function reset(){ round=1; gen(); drag=-1; }
  reset();
  return {
  down:function(x,y){ for(var i=0;i<3;i++){ var yy=340+i*70;
      if(y>yy-26&&y<yy+26&&x>120&&x<680){ drag=i; cur[i]=Math.round(E.cl((x-120)/560*255,0,255)); return; } }
    if(y>510&&x>320&&x<480)check(); },
  move:function(x,y){ if(drag>=0) cur[drag]=Math.round(E.cl((x-120)/560*255,0,255)); },
  up:function(){ drag=-1; },
  update:function(dt){ if(rt>0)rt-=dt; },
  draw:function(c){
    E.bg('#0d1018');
    E.rr(150,70,240,190,18,'rgb('+t3.join(',')+')');
    E.rr(410,70,240,190,18,'rgb('+cur.join(',')+')');
    E.tx('المطلوب',270,285,20,'#98a0b8'); E.tx('لونك',530,285,20,'#98a0b8');
    ['#ff4d4d','#4dff8a','#4d9fff'].forEach(function(col,i){ var y=340+i*70;
      E.rr(120,y-11,560,22,11,'#1c2338');
      E.rr(120,y-11,560*(cur[i]/255),22,11,col);
      E.o(120+560*(cur[i]/255),y,15,'#e8ecff'); });
    E.rr(320,510,160,54,14,'#7c5cff'); E.tx('تحقّق',400,537,22,'#fff');
    if(rt>0) E.tx(res,400,585,20,'#ffc93d');
    E.hudL('جولة '+round+'/6'); E.hud('النتيجة '+E.score);
  }};
  function check(){
    var d=Math.abs(cur[0]-t3[0])+Math.abs(cur[1]-t3[1])+Math.abs(cur[2]-t3[2]);
    if(d<52){ E.add(300-d*3); E.s('win'); res='مطابقة ممتازة!'; rt=2; round++;
      if(round>6) return E.won('عين ملوّنة! 🎨','ست جولات'); setTimeout(gen,600); }
    else { E.add(-40); E.s('buzz'); res= d<120?'قريب جداً…':'بعيد — انظر جيداً'; rt=2; } }
}});

G({id:'memory-palace', t:'قصر الذاكرة', c:'memory', e:'🏛️', tags:['ذاكرة','مواقع'],
d:'رموز تظهر في مواقع ثم تختفي. أعِد كل رمز إلى مكانه بالضبط.',
how:'اسحب الرموز إلى أماكنها', noPad:true,
make:function(E){
  var slots,pool,show,t,round,drag;
  var EM=['🔑','🕯️','📕','🏺','🪞','🗝️','🧭','⏳','🔔','🪶'];
  function gen(){ var n=3+Math.min(5,round);
    var set=EM.slice().sort(function(){return Math.random()-.5;}).slice(0,n);
    slots=set.map(function(e,i){ return {x:E.rnd(120,680),y:E.rnd(120,380),e:e,put:null}; });
    pool=set.slice().sort(function(){return Math.random()-.5;}).map(function(e,i){
      return {e:e,x:90+i*(620/Math.max(1,n-1)||0)+ (n===1?300:0),y:520,home:true}; });
    show=2.4+n*.35; t=25; drag=null; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){ if(show>0)return;
    for(var i=pool.length-1;i>=0;i--) if(E.dist(x,y,pool[i].x,pool[i].y)<32){ drag=i; return; } },
  move:function(x,y){ if(drag!=null){ pool[drag].x=x; pool[drag].y=y; } },
  up:function(x,y){ if(drag==null)return;
    var p=pool[drag]; drag=null;
    var s=null; slots.forEach(function(sl){ if(!sl.put&&E.dist(p.x,p.y,sl.x,sl.y)<48)s=sl; });
    if(s){ s.put=p.e; p.placed=true; p.x=s.x; p.y=s.y; E.s('tick');
      if(slots.every(function(sl){return sl.put;})) judge(); } },
  update:function(dt){ if(show>0){ show-=dt; return; }
    t-=dt; if(t<=0){ E.add(-70); E.s('lose');
      if(round>3&&E.score<80) return E.over('ضاعت الذاكرة','الجولة '+round); gen(); } },
  draw:function(c){
    E.bg('#141020');
    slots.forEach(function(s){ E.ring(s.x,s.y,34,'#4a5480',3);
      if(show>0) E.spr(s.e,s.x,s.y,40);
      else if(s.put) E.spr(s.put,s.x,s.y,40); });
    if(show>0){ E.tx('احفظ المواقع! '+show.toFixed(1),400,50,26,'#ffc93d'); }
    else { pool.forEach(function(p){ if(!p.placed) E.spr(p.e,p.x,p.y,40); });
      E.tx('أعِد كل رمز إلى مكانه',400,50,24,'#9dff3d'); }
    E.hudL('جولة '+round+'/6'); E.hud(show>0?'…':'⏱ '+Math.max(0,t).toFixed(1));
  }};
  function judge(){
    var right=slots.filter(function(s){ return s.put===s.e; }).length;
    if(right===slots.length){ E.add(200+round*40); E.s('win'); round++;
      if(round>6) return E.won('قصر ذاكرة كامل! 🏛️','ست جولات'); gen(); }
    else { E.add(right*30-60); E.s('buzz'); E.shake(10); gen(); } }
}});

G({id:'tempo-guess', t:'خمّن الإيقاع', c:'music', e:'🎼', tags:['سمع','إيقاع'],
d:'استمع لنبضة ثم أعِد نقرها بنفس السرعة دون سماعها. أذنك الداخلية تحت الاختبار.',
how:'استمع ثم انقر أربع نقرات', noPad:true,
make:function(E){
  var bpm,st,t,beats,taps,round;
  function gen(){ bpm=E.rnd(60,160); st='listen'; t=0; beats=0; taps=[]; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(){
    if(st!=='tap')return;
    taps.push(E.time); E.s('tick'); E.tone(700,.06,'square',.12);
    if(taps.length>=5){
      var ivs=[]; for(var i=1;i<taps.length;i++) ivs.push(taps[i]-taps[i-1]);
      var avg=ivs.reduce(function(a,b){return a+b;},0)/ivs.length;
      var myBpm=60/avg, err=Math.abs(myBpm-bpm)/bpm;
      if(err<.12){ E.add(Math.round(300*(1-err/.12))+100); E.s('win'); round++;
        if(round>6) return E.won('إيقاع داخلي مضبوط! 🎼','ست جولات'); gen(); }
      else { E.add(-60); E.s('buzz'); E.shake(8); st='result'; this._my=myBpm; t=0; } } },
  update:function(dt){
    t+=dt;
    if(st==='listen'){
      var iv=60/bpm;
      if(t>=iv){ t-=iv; beats++; E.tone(880,.07,'triangle',.16);
        if(beats>=6){ st='tap'; taps=[]; } } }
    else if(st==='result'&&t>2){ gen(); } },
  draw:function(c){
    E.bg('#0f0e1c');
    var iv=60/bpm;
    E.o(400,250,st==='listen'?60+Math.max(0,(1-t/iv))*40:70,'rgba(124,92,255,.25)');
    E.spr('🎼',400,250,72);
    if(st==='listen') E.tx('استمع… '+(6-beats)+' نبضات',400,400,28,'#ffc93d');
    else if(st==='tap') E.tx('انقر ٥ مرات بنفس السرعة ('+taps.length+'/5)',400,400,26,'#9dff3d');
    else E.tx('إيقاعك '+(this._my||0).toFixed(0)+' مقابل '+bpm.toFixed(0),400,400,26,'#ff3d7f');
    E.hudL('جولة '+round+'/6'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'shadow-match', t:'مطابقة الظلال', c:'weird', e:'🌗', tags:['ملاحظة','أشكال'],
d:'ظلّ واحد فقط يطابق الشكل. الأشكال تدور والظلال تكذب.',
how:'انقر الظل الصحيح', noPad:true,
make:function(E){
  var shape,opts,round,t,rot;
  var SH=['🐘','🦒','🚲','⛵','🎸','🦋','🍍','🏺','🦕','🧩'];
  function gen(){ shape=E.pick(SH);
    opts=[shape]; while(opts.length<4){ var s=E.pick(SH); if(opts.indexOf(s)<0)opts.push(s); }
    opts.sort(function(){return Math.random()-.5;});
    t=Math.max(3,10-round*.5); rot=E.rnd(-.5,.5); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y<380)return; var i=Math.floor((x-40)/185); if(i<0||i>3)return;
    if(opts[i]===shape){ E.add(120+round*20); E.s('coin'); round++;
      if(round>12) return E.won('عين حادّة! 🌗','١٢ جولة'); gen(); }
    else { E.add(-70); E.s('buzz'); E.shake(10);
      if(E.score<-80) return E.over('خدعتك الظلال','الجولة '+round); gen(); } },
  update:function(dt){ t-=dt; rot+=dt*.3;
    if(t<=0){ E.add(-50); gen(); if(E.score<-80) E.over('نفد الوقت','الجولة '+round); } },
  draw:function(c){
    E.bg('#0b0d16');
    E.spr(shape,400,200,110,Math.sin(rot)*.35);
    E.tx('أيّ ظلّ يطابق؟',400,340,22,'#98a0b8');
    for(var i=0;i<4;i++){ E.rr(40+i*185,380,170,170,18,'#161b2a');
      c.save(); c.globalAlpha=1; c.filter='brightness(0) invert(0.12)';
      E.spr(opts[i],125+i*185,465,80,Math.sin(rot+i)*.35);
      c.filter='none'; c.restore(); }
    E.hudL('جولة '+round+'/12 · ⏱ '+Math.max(0,t).toFixed(1)); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'grav-puzzle', t:'لغز الجاذبية', c:'weird', e:'🧲', tags:['ابتكار','ألغاز'],
d:'اقلب اتجاه الجاذبية لتُسقط الصناديق على الأهداف. فكّر بأربعة اتجاهات.',
how:'الأسهم تختار اتجاه الجاذبية',
make:function(E){
  var W=10,H=8,g,boxes,goals,lvl,moves;
  function gen(){ g=[]; for(var y=0;y<H;y++){ g.push([]); for(var x=0;x<W;x++)
      g[y].push((x===0||y===0||x===W-1||y===H-1||Math.random()<.1)?1:0); }
    boxes=[]; goals=[];
    for(var i=0;i<2+Math.min(3,lvl);i++){
      var bx,by; do{ bx=E.ri(1,W-2); by=E.ri(1,H-2); }while(g[by][bx]||boxes.some(function(b){return b.x===bx&&b.y===by;}));
      boxes.push({x:bx,y:by});
      var gx,gy; do{ gx=E.ri(1,W-2); gy=E.ri(1,H-2); }while(g[gy][gx]||goals.some(function(q){return q.x===gx&&q.y===gy;}));
      goals.push({x:gx,y:gy}); }
    moves=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  function apply(dx,dy){
    moves++; E.s('swish');
    for(var it=0;it<20;it++){ var moved=false;
      var order=boxes.slice().sort(function(a,b){ return (b.x*dx+b.y*dy)-(a.x*dx+a.y*dy); });
      order.forEach(function(b){ var nx=b.x+dx, ny=b.y+dy;
        if(g[ny]&&g[ny][nx]===0&&!boxes.some(function(o){return o!==b&&o.x===nx&&o.y===ny;})){
          b.x=nx; b.y=ny; moved=true; } });
      if(!moved)break; }
    var done=goals.every(function(q){ return boxes.some(function(b){return b.x===q.x&&b.y===q.y;}); });
    if(done){ E.add(300-moves*10); E.s('win'); lvl++;
      if(lvl>6) return E.won('سيّد الجاذبية! 🧲','ست مراحل'); gen(); }
    if(moves>25){ E.over('حركات كثيرة جداً','المرحلة '+lvl); } }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')apply(-1,0); if(k==='ArrowRight')apply(1,0);
    if(k==='ArrowUp')apply(0,-1); if(k==='ArrowDown')apply(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))apply(dx>0?1:-1,0); else apply(0,dy>0?1:-1); },
  draw:function(c){
    E.bg('#0c1018');
    var S=68,OX=(800-W*S)/2,OY=(600-H*S)/2;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++)
      E.rr(OX+x*S+2,OY+y*S+2,S-4,S-4,6, g[y][x]?'#39406b':'#161c2e');
    goals.forEach(function(q){ E.ring(OX+q.x*S+S/2,OY+q.y*S+S/2,20,'#9dff3d',3); });
    boxes.forEach(function(b){ var on=goals.some(function(q){return q.x===b.x&&q.y===b.y;});
      E.rr(OX+b.x*S+8,OY+b.y*S+8,S-16,S-16,8, on?'#2f7a4d':'#a06a3a'); });
    E.hudL('مرحلة '+lvl+' · حركات '+moves+'/25'); E.hud('النتيجة '+E.score);
    E.tx('الأسهم = اتجاه الجاذبية',400,585,15,'#6d7590');
  }};
}});

G({id:'queue-jump', t:'قطع الطابور', c:'funny', e:'🚶', tags:['تسلل','توقيت'],
d:'تقدّم في الطابور خطوة كلما التفت الناس بعيداً — وإن رأوك، عُدت للخلف.',
how:'اضغط مطوّلاً للتقدّم',
make:function(E){
  var pos,look,lt,t,busted;
  function reset(){ pos=0; look=false; lt=2; t=60; busted=0; }
  reset();
  return {
  down:function(){ this.h=true; }, up:function(){ this.h=false; },
  key:function(k,d){ if(k===' '||k==='ArrowUp')this.h=d; },
  update:function(dt){
    t-=dt; if(t<=0) return E.over('أُغلق الشبّاك','وصلت '+Math.round(pos)+'٪');
    lt-=dt;
    if(lt<=0){ look=!look; lt=look?E.rnd(.9,2.2):E.rnd(1.2,2.8); if(look)E.s('alarm'); }
    if(this.h||E.m.down){
      if(look){ busted++; pos=Math.max(0,pos-12); E.add(-80); E.s('buzz'); E.shake(12); this.h=false;
        if(busted>=5) return E.over('طردوك من الطابور 🚶','بعد ٥ ضبطات'); }
      else { pos+=22*dt; E.add(Math.round(24*dt)); } }
    if(pos>=100) E.won('وصلت للمقدّمة! 🚶','بلا أن يلاحظك أحد'); },
  draw:function(c){
    E.bg(look?'#2a1420':'#141a26');
    for(var i=0;i<8;i++){ var x=90+i*88;
      E.spr(look?'👀':'🧍',x,300,52); }
    E.spr('🏪',740,290,60);
    E.spr('😅',90+pos*6.2,400,48);
    E.tx(look?'ينظرون إليك! توقّف':'لا أحد ينظر — تقدّم',400,120,30, look?'#ff3d7f':'#9dff3d');
    E.rr(150,500,500,24,10,'#1c2338'); E.rr(152,502,496*(pos/100),20,8,'#9dff3d');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · ضُبطت '+busted+'/5'); E.hud('التقدّم '+Math.round(pos)+'٪');
  }};
}});

G({id:'lie-detector', t:'كاشف الكذب', c:'weird', e:'🫀', tags:['استنتاج','ابتكار'],
d:'ثلاثة مشتبهين وجملة واحدة صادقة. راقب نبض كل واحد واستنتج من يكذب.',
how:'انقر على المشتبه الكاذب', noPad:true,
make:function(E){
  var sus,liar,round,t,phase;
  var NAMES=['سالم','ليلى','فارس','نورة','زياد'];
  function gen(){ var ns=NAMES.slice().sort(function(){return Math.random()-.5;}).slice(0,3);
    liar=E.ri(0,2);
    sus=ns.map(function(n,i){ return {n:n, base:E.rnd(60,85), amp: i===liar?E.rnd(16,26):E.rnd(3,8),
      ph:E.rnd(0,6), e:E.pick(['🧔','👩','🧑','👨‍🦰','👩‍🦱'])}; });
    t=Math.max(4,11-round*.5); phase=0; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    var i=Math.floor((x-40)/253); if(i<0||i>2||y<140||y>460)return;
    if(i===liar){ E.add(180+round*20); E.s('coin'); round++;
      if(round>10) return E.won('كاشف كذب بشري! 🫀','عشر قضايا'); gen(); }
    else { E.add(-90); E.s('buzz'); E.shake(12);
      if(E.score<-100) return E.over('صدّقت الكاذب','القضية '+round); gen(); } },
  update:function(dt){ phase+=dt; t-=dt;
    if(t<=0){ E.add(-60); gen(); if(E.score<-100) E.over('نفد الوقت','القضية '+round); } },
  draw:function(c){
    E.bg('#0b0f18');
    E.tx('من يكذب؟ راقب النبض',400,60,26,'#dfe6ff');
    sus.forEach(function(s,i){ var x=40+i*253;
      E.rr(x+10,140,233,320,18,'#161c2c');
      E.spr(s.e,x+126,220,64);
      E.tx(s.n,x+126,290,22,'#dfe6ff');
      c.strokeStyle='#9dff3d'; c.lineWidth=2; c.beginPath();
      for(var k=0;k<210;k++){ var xx=x+22+k;
        var v=Math.sin((k*.09)+phase*3+s.ph)*s.amp*(Math.sin(k*.5)>.85?2.4:1);
        if(k===0)c.moveTo(xx,390-v); else c.lineTo(xx,390-v); }
      c.stroke();
      E.tx(Math.round(s.base+Math.sin(phase*3+s.ph)*s.amp)+' نبضة',x+126,435,17,'#98a0b8'); });
    E.rr(200,500,400,12,6,'#1c2338'); E.rr(202,502,396*E.cl(t/11,0,1),8,4,'#7c5cff');
    E.hudL('قضية '+round+'/10'); E.hud('النتيجة '+E.score);
  }};
}});
