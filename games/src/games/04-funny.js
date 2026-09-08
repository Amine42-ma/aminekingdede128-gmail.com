/* ============ 4) ألعاب مضحكة ============ */

G({id:'fart-orchestra', t:'أوركسترا الرياح', c:'funny', e:'💨', tags:['موسيقى','إيقاع'],
d:'قائد أوركسترا… من نوع خاص. اضغط على العلامة في وقتها لتعزف اللحن.',
how:'انقر العمود الصحيح عند وصول العلامة للخط',
make:function(E){
  var notes,t,combo,miss,spd,lanes=4;
  var COL=['#ff3d7f','#ffc93d','#9dff3d','#00d4ff'];
  var EM=['🍑','🎺','💨','🎷'];
  function reset(){ notes=[]; t=0; combo=0; miss=0; spd=230; }
  reset();
  function hit(l){
    var best=-1,bd=1e9;
    notes.forEach(function(n,i){ if(n.l!==l||n.dead)return; var d=Math.abs(n.y-470); if(d<bd){bd=d;best=i;} });
    if(best>=0&&bd<48){ notes[best].dead=true; combo++;
      E.add(10+combo*2); E.s('fart'); E.burst(100+l*200,470,[COL[l]],14,180); }
    else { combo=0; E.add(-5); E.s('tick'); } }
  return {
  key:function(k,d){ if(!d)return; var i=['a','s','d','f'].indexOf(k.toLowerCase()); if(i>=0)hit(3-i);
    if(k==='ArrowLeft')hit(0); if(k==='ArrowUp')hit(1); if(k==='ArrowDown')hit(2); if(k==='ArrowRight')hit(3); },
  down:function(x,y){ hit(E.cl(Math.floor(x/200),0,3)); },
  update:function(dt){
    t+=dt; spd=230+t*7;
    if(Math.random()<dt*(2.4+t*.05)) notes.push({l:E.ri(0,3),y:-30});
    for(var i=notes.length-1;i>=0;i--){ var n=notes[i]; n.y+=spd*dt;
      if(n.y>560){ if(!n.dead){ miss++; combo=0; E.add(-8); E.s('buzz');
          if(miss>=12) return E.over('طردك الجمهور 😂','فاتتك '+miss+' نغمة'); }
        notes.splice(i,1); } } },
  draw:function(c){
    E.bg('#150a1e');
    for(var i=0;i<4;i++){ E.r(i*200,0,200,600, i%2?'rgba(255,255,255,.025)':'transparent');
      E.alpha(.5,function(){ E.r(i*200+2,450,196,40,COL[i]); }); }
    E.ln(0,470,800,470,'#fff',2);
    notes.forEach(function(n){ if(n.dead)return; E.spr(EM[n.l],100+n.l*200,n.y,44); });
    for(var j=0;j<4;j++) E.tx(['←','↑','↓','→'][j],100+j*200,530,26,'#98a0b8');
    E.hud('النتيجة '+E.score); E.hudL('تتابع ×'+combo+'  ·  فاتك '+miss, miss>8?'#ff3d7f':'#fff');
  }};
}});

G({id:'potato-panic', t:'البطاطس الهاربة', c:'funny', e:'🥔', tags:['التقاط','فوضى'],
d:'بطاطس تهرب من القدر — امسكها كلها، لكن احذر القنابل والجزر الغاضب.',
how:'حرّك القدر يميناً ويساراً',
make:function(E){
  var pot,items,t,lives;
  function reset(){ pot={x:400,w:120}; items=[]; t=0; lives=3; }
  reset();
  var GOOD=['🥔','🥔','🥔','🍟','🥔'], BAD=['💣','🥕','🌶️'];
  return {
  move:function(x){ pot.x=E.cl(x,60,740); },
  update:function(dt){
    t+=dt;
    if(E.kx()) pot.x=E.cl(pot.x+E.kx()*520*dt,60,740);
    if(Math.random()<dt*(1.6+t*.06)) items.push({x:E.rnd(40,760),y:-30,
      v:E.rnd(150,240)+t*4, bad:Math.random()<.22, e:'', sp:E.rnd(-2,2)});
    items.forEach(function(i){ if(!i.e) i.e = i.bad?E.pick(BAD):E.pick(GOOD); });
    for(var k=items.length-1;k>=0;k--){ var i2=items[k]; i2.y+=i2.v*dt; i2.x+=Math.sin(E.time*2+k)*i2.sp;
      if(i2.y>520&&Math.abs(i2.x-pot.x)<pot.w/2){
        if(i2.bad){ lives--; E.s('boom'); E.shake(18); E.burst(i2.x,520,['#ff3d7f'],16);
          if(lives<=0) return E.over('انفجر القدر 💥','التقطت '+E.score/10+' بطاطس'); }
        else { E.add(10); E.s('coin'); E.rise(i2.x,500,'#ffc93d',5); }
        items.splice(k,1); continue; }
      if(i2.y>620){ if(!i2.bad){ lives--; E.s('lose');
          if(lives<=0) return E.over('ضاعت البطاطس','النتيجة '+E.score); } items.splice(k,1); } } },
  draw:function(c){
    E.sky('#2a1a3e','#0d0716');
    items.forEach(function(i){ E.spr(i.e,i.x,i.y,38,Math.sin(E.time*4+i.x)*.4); });
    E.spr('🍲',pot.x,540,60);
    E.r(pot.x-pot.w/2,516,pot.w,4,'rgba(157,255,61,.35)');
    E.hud('النتيجة '+E.score); E.hudL('❤️'.repeat(Math.max(0,lives)));
  }};
}});

G({id:'burp-duel', t:'نزال التجشّؤ', c:'funny', e:'🥤', tags:['توقيت','مبارزة'],
d:'اشحن تجشؤك… لكن إن بالغت ستنفجر. أطول تجشؤ يكسب الجولة.',
how:'اضغط مطوّلاً للشحن وأفلت للتجشّؤ',
make:function(E){
  var ch,charging,foe,round,st,msg,mt,wins,losses;
  function reset(){ ch=0; charging=false; foe=0; round=1; st='ready'; msg=''; mt=0; wins=0; losses=0; }
  reset();
  function release(){
    if(!charging)return; charging=false;
    if(ch>1){ msg='انفجرت! 🤢'; mt=2; E.s('boom'); E.shake(20); losses++; E.add(-50); }
    else { foe=E.rnd(.45,.96);
      E.s('burp');
      if(ch>foe){ msg='فزت بالجولة! 🏆 ('+(ch*100).toFixed(0)+' مقابل '+(foe*100).toFixed(0)+')'; mt=2.4;
        wins++; E.add(Math.round(ch*200)); E.s('win'); }
      else { msg='خصمك أعلى 😩 ('+(foe*100).toFixed(0)+')'; mt=2.4; losses++; E.add(-20); } }
    round++; ch=0;
    if(wins>=5) E.won('بطل التجشّؤ! 🥇','خمس جولات');
    if(losses>=3) E.over('خسرت البطولة','فزت بـ'+wins+' جولة'); }
  return {
  down:function(){ if(mt>0)return; charging=true; ch=0; },
  up:release,
  key:function(k,d){ if(k!==' ')return; if(d){ if(mt<=0){charging=true;ch=0;} } else release(); },
  update:function(dt){
    if(mt>0){ mt-=dt; return; }
    if(charging){ ch+=dt*.45; if(Math.random()<.4) E.tone(80+ch*90,.05,'square',.05); } },
  draw:function(c){
    E.sky('#2e1a10','#100a06');
    E.spr('🧔',220,320,110);
    E.spr('🧑',580,320,110);
    if(charging){ E.spr('💨',300,300,40+ch*50); }
    E.rr(250,470,300,34,10,'#1e2540');
    E.rr(252,472,296*Math.min(1,ch),30,9, ch>.9?'#ff3d7f':ch>.6?'#ffc93d':'#9dff3d');
    E.r(250+300*.99,466,3,42,'#ff3d7f');
    E.tx('اضغط مطوّلاً… وأفلت',400,530,20,'#98a0b8');
    E.tx('الجولة '+round+' · فوز '+wins+' · خسارة '+losses,400,60,24,'#dfe6ff');
    if(mt>0) E.tx(msg,400,180,30,'#ffc93d');
  }};
}});

G({id:'sneeze-hold', t:'اكتم العطسة', c:'funny', e:'🤧', tags:['توقيت','إحراج'],
d:'أنت في مكتبة صامتة. اكتم عطستك… وأطلقها فقط حين لا ينظر إليك أحد.',
how:'اضغط مطوّلاً للكتم · أفلت للعطس',
make:function(E){
  var press,build,look,lookT,round,shame;
  function reset(){ press=false; build=0; look=false; lookT=2; round=1; shame=0; }
  reset();
  return {
  down:function(){ press=true; },
  up:function(){
    if(!press)return; press=false;
    if(build<.35){ E.s('tick'); return; }
    E.s('sneeze');
    if(look){ shame++; E.add(-80); E.shake(14);
      if(shame>=3) return E.over('طردك أمين المكتبة 🤫','ثلاث عطسات محرجة'); }
    else { E.add(Math.round(build*150)); E.s('coin'); round++;
      if(round>8) return E.won('عطسات خفيّة تماماً! 🤫','ثماني عطسات ناجحة'); }
    build=0; },
  key:function(k,d){ if(k!==' ')return; if(d)this.down(); else this.up(); },
  update:function(dt){
    lookT-=dt;
    if(lookT<=0){ look=!look; lookT=look?E.rnd(1.1,2.4):E.rnd(1.4,3); if(look)E.s('alarm'); }
    if(press){ build+=dt*.34;
      if(build>=1){ build=0; press=false; E.s('sneeze'); shame++; E.add(-100); E.shake(20);
        if(shame>=3) E.over('انفجرت عطسة هائلة 🤧','لم تستطع الكتم'); } }
    else build=Math.max(0,build-dt*.12); },
  draw:function(c){
    E.bg(look?'#3a1420':'#101828');
    for(var i=0;i<5;i++) E.rr(60+i*150,120,110,300,6,'#3a2a18');
    E.spr('📚',400,90,44);
    E.spr(look?'👀':'😐',400,190,64);
    E.tx(look?'أمين المكتبة ينظر إليك!':'لا أحد ينظر… الآن!',400,260,26, look?'#ff3d7f':'#9dff3d');
    E.spr(press?'😖':'🙂',400,400,80);
    E.rr(250,490,300,28,10,'#1e2540');
    E.rr(252,492,296*build,24,9, build>.75?'#ff3d7f':'#00d4ff');
    E.tx('ضغط الأنف',400,540,16,'#98a0b8');
    E.hudL('إحراج '+shame+'/3'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'banana-trap', t:'مصيدة الموز', c:'funny', e:'🍌', tags:['فخاخ','تخطيط'],
d:'ضع قشور الموز في طريق المارّة… لكن لا توقع الجدّة، وإلا خسرت.',
how:'انقر لوضع قشرة موز', noPad:true,
make:function(E){
  var peels,walkers,t,slips,granny;
  function reset(){ peels=[]; walkers=[]; t=45; slips=0; }
  reset();
  var TYPES=[{e:'🕴️',v:110,pts:50},{e:'🏃',v:220,pts:100},{e:'👮',v:130,pts:150},{e:'👵',v:60,pts:-300},{e:'🚶',v:90,pts:40}];
  return {
  down:function(x,y){ if(peels.length>=6){ E.s('buzz'); return; }
    peels.push({x:x,y:E.cl(y,120,540),t:9}); E.s('pop'); },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت','أوقعت '+slips+' شخصاً');
    if(Math.random()<dt*1.1){ var ty=E.pick(TYPES), dir=Math.random()<.5?1:-1;
      walkers.push({x:dir>0?-40:840,y:E.rnd(130,530),v:ty.v*dir,e:ty.e,pts:ty.pts,down:0}); }
    for(var i=walkers.length-1;i>=0;i--){ var w=walkers[i];
      if(w.down>0){ w.down-=dt; if(w.down<=0)walkers.splice(i,1); continue; }
      w.x+=w.v*dt;
      if(w.x<-60||w.x>860){ walkers.splice(i,1); continue; }
      for(var j=peels.length-1;j>=0;j--){ var p=peels[j];
        if(Math.abs(p.x-w.x)<24&&Math.abs(p.y-w.y)<26){
          peels.splice(j,1); w.down=1.3; slips++;
          E.add(w.pts); E.s(w.pts>0?'coin':'buzz'); E.burst(w.x,w.y,[w.pts>0?'#ffc93d':'#ff3d7f'],14);
          if(w.pts<0){ E.shake(20); if(E.score<-200) return E.over('أوقعت الجدّة مرات كثيرة 👵','هذا ليس لطيفاً'); }
          break; } } }
    for(var k=peels.length-1;k>=0;k--){ peels[k].t-=dt; if(peels[k].t<=0)peels.splice(k,1); } },
  draw:function(c){
    E.bg('#2a2a30');
    for(var y=110;y<560;y+=70) E.r(0,y,800,54,'#3a3a44');
    peels.forEach(function(p){ E.alpha(p.t<2?Math.abs(Math.sin(E.time*8)):1,function(){ E.spr('🍌',p.x,p.y,30); }); });
    walkers.forEach(function(w){ E.spr(w.down>0?'💫':w.e,w.x,w.y,42, w.down>0?1.4:0); });
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · قشور '+(6-peels.length)); E.hud('النتيجة '+E.score);
    E.tx('لا توقع الجدّة 👵 (-٣٠٠)',400,580,17,'#ff9f3d');
  }};
}});

G({id:'philosophic-chicken', t:'الدجاجة الفيلسوفة', c:'funny', e:'🐔', tags:['عبور','فلسفة'],
d:'لماذا عبرت الدجاجة الطريق؟ اعبر وستعرف — إن نجوت.',
how:'الأسهم للحركة',
make:function(E){
  var p,cars,cross,quote,qt;
  var Q=['لأن الجانب الآخر كان يبدو أفضل.','لتثبت أن الحرية ممكنة.','لم تعبر… الطريق هو من عبرها.',
    'كانت تهرب من سؤالك هذا.','لأن أحداً لم يمنعها.','لتصل إلى بيضة معنى الحياة.','لأن الدجاج لا يقرأ إشارات المرور.'];
  function reset(){ p={x:400,y:560}; cars=[]; cross=0; quote=''; qt=0;
    for(var i=0;i<7;i++) cars.push({y:90+i*62, x:E.rnd(0,800), v:E.rnd(90,220)*(i%2?1:-1)}); }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowUp')p.y-=44; if(k==='ArrowDown')p.y=Math.min(560,p.y+44);
    if(k==='ArrowLeft')p.x=Math.max(20,p.x-44); if(k==='ArrowRight')p.x=Math.min(780,p.x+44);
    E.s('tick'); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<18)return;
    this.key(Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'),true); },
  update:function(dt){
    if(qt>0)qt-=dt;
    cars.forEach(function(c2){ c2.x+=c2.v*dt*(1+cross*.13);
      if(c2.x>860)c2.x=-60; if(c2.x<-60)c2.x=860;
      if(Math.abs(c2.x-p.x)<38&&Math.abs(c2.y-p.y)<26){
        E.shake(22); E.burst(p.x,p.y,['#ff3d7f','#fff'],26);
        E.over('انتهت الرحلة الفلسفية 🐔','عبرت '+cross+' مرة'); } });
    if(p.y<70){ cross++; E.add(100); E.s('win'); quote=E.pick(Q); qt=3.2; p={x:400,y:560}; } },
  draw:function(c){
    E.bg('#1a2418');
    E.r(0,60,800,440,'#2e3038');
    for(var y=88;y<500;y+=62) E.r(0,y+26,800,3,'rgba(255,255,255,.15)');
    E.r(0,0,800,62,'#2b4a24'); E.r(0,500,800,100,'#2b4a24');
    cars.forEach(function(c2){ E.spr(c2.v>0?'🚗':'🚚',c2.x,c2.y,40); });
    E.spr('🐔',p.x,p.y,40);
    E.hudL('عبور: '+cross); E.hud('النتيجة '+E.score);
    if(qt>0){ E.rr(60,240,680,90,14,'rgba(0,0,0,.75)');
      E.tx('«'+quote+'»',400,285,24,'#ffc93d'); } }
  };
}});

G({id:'face-factory', t:'مصنع الوجوه', c:'funny', e:'🤪', tags:['ذاكرة','تركيب'],
d:'انظر للوجه المطلوب ثانيتين ثم ركّبه من القطع قبل نفاد الوقت.',
how:'انقر القطع لتغييرها',
make:function(E){
  var EY=['👁️','😑','😵','🤨','😴'], MO=['👄','😬','😮','😛','🫦'], HA=['🎩','👑','🧢','🎓','🪖'];
  var target,cur,show,t,round;
  function gen(){ target={e:E.ri(0,4),m:E.ri(0,4),h:E.ri(0,4)}; cur={e:0,m:0,h:0}; show=2.2; t=14; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(show>0)return;
    if(y<200) cur.h=(cur.h+1)%5; else if(y<340) cur.e=(cur.e+1)%5; else if(y<470) cur.m=(cur.m+1)%5;
    else { check(); return; }
    E.s('tick'); },
  update:function(dt){
    if(show>0){ show-=dt; return; }
    t-=dt; if(t<=0){ E.add(-50); E.s('lose');
      if(round>=3&&E.score<100) return E.over('انتهى الوقت','وجوه ضائعة');
      round++; if(round>6) return E.won('صانع وجوه ماهر! 🤪','ست جولات'); gen(); } },
  draw:function(c){
    E.bg('#181024');
    if(show>0){ E.tx('احفظ هذا الوجه!',400,90,30,'#ffc93d');
      E.o(400,320,140,'#ffd9a0');
      E.spr(HA[target.h],400,200,64); E.spr(EY[target.e],360,290,44); E.spr(EY[target.e],440,290,44);
      E.spr(MO[target.m],400,380,52);
      E.tx(show.toFixed(1),400,540,34,'#ff3d7f'); return; }
    E.tx('ركّب الوجه — ⏱ '+t.toFixed(1),400,50,26, t<4?'#ff3d7f':'#dfe6ff');
    E.o(400,320,140,'#ffd9a0');
    E.spr(HA[cur.h],400,200,64); E.spr(EY[cur.e],360,290,44); E.spr(EY[cur.e],440,290,44);
    E.spr(MO[cur.m],400,380,52);
    E.tx('↑ قبعة',680,180,18,'#98a0b8'); E.tx('↑ عيون',680,300,18,'#98a0b8'); E.tx('↑ فم',680,410,18,'#98a0b8');
    E.rr(300,500,200,54,14,'#2fbd6f'); E.tx('تحقّق!',400,527,24,'#062012');
    E.hudL('جولة '+round);
  }};
  function check(){
    if(cur.e===target.e&&cur.m===target.m&&cur.h===target.h){
      E.add(150+Math.floor(t)*10); E.s('win'); round++;
      if(round>6) return E.won('صانع وجوه ماهر! 🤪','ست جولات'); gen(); }
    else { E.add(-30); E.s('buzz'); E.shake(10); t=Math.max(2,t-3); } }
}});

G({id:'laugh-meter', t:'مقياس الضحك', c:'funny', e:'😂', tags:['توازن','أعصاب'],
d:'اضحك بما يكفي… لا أكثر ولا أقل. حافظ على المؤشر داخل المنطقة المتحركة.',
how:'اضغط مطوّلاً لرفع الضحك',
make:function(E){
  var v,zone,zt,t,ok;
  function reset(){ v=.5; zone={c:.5,w:.16,d:1}; t=30; ok=0; zt=0; }
  reset();
  return {
  down:function(){ this.h=true; }, up:function(){ this.h=false; },
  key:function(k,d){ if(k===' ')this.h=d; },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('ضحكة متزنة! 😂','بقيت '+ok.toFixed(0)+' ثانية داخل المنطقة');
    v += ((this.h||E.m.down)?.55:-.42)*dt; v=E.cl(v,0,1);
    zt+=dt; zone.c=.5+Math.sin(zt*.9)*.3+Math.sin(zt*2.3)*.09;
    zone.w=Math.max(.06,.16-(30-t)*.0026);
    if(Math.abs(v-zone.c)<zone.w){ ok+=dt; E.add(Math.round(30*dt)); if(Math.random()<dt*4)E.s('tick'); }
    else { E.add(Math.round(-25*dt));
      if(E.score<-150) return E.over('ضحكة كارثية 😐','لم تجد الإيقاع'); } },
  draw:function(c){
    E.bg('#101020');
    var X=340,Y0=90,H=420;
    E.rr(X,Y0,120,H,16,'#1c2338');
    E.rr(X+4,Y0+H*(1-zone.c-zone.w),112,H*zone.w*2,10,'rgba(157,255,61,.35)');
    var y=Y0+H*(1-v);
    E.rr(X-14,y-9,148,18,9, Math.abs(v-zone.c)<zone.w?'#9dff3d':'#ff3d7f');
    E.spr(v>.8?'🤣':v>.55?'😂':v>.3?'🙂':'😐',400,545,60);
    E.tx('⏱ '+Math.max(0,t).toFixed(1),400,50,28,'#dfe6ff');
    E.tx('داخل المنطقة: '+ok.toFixed(1)+'ث',400,575,17,'#98a0b8');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'noodle-dance', t:'رقصة النودلز', c:'funny', e:'🍜', tags:['ذاكرة','رقص'],
d:'رجل النودلز يريك خطوات الرقص. كرّرها بالترتيب… وهي تطول.',
how:'انقر الأسهم بنفس الترتيب',
make:function(E){
  var seq,i,show,st,cur,round,flash;
  var AR=['⬅️','⬆️','⬇️','➡️'], KEY=['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'];
  function reset(){ seq=[]; round=0; next(); }
  function next(){ round++; seq.push(E.ri(0,3)); i=0; show=true; st=0; cur=-1; flash=0; }
  reset();
  function press(k){
    if(show)return; var n=KEY.indexOf(k); if(n<0)return;
    flash=.2; cur=n;
    if(seq[i]===n){ i++; E.add(15); E.note(300+n*90,.15);
      if(i>=seq.length){ E.add(60*round); E.s('win'); setTimeout(next,700); show=true; st=-.7; i=0; } }
    else E.over('خطوة خاطئة! 🍜','وصلت للجولة '+round); }
  return {
  key:function(k,d){ if(d)press(k); },
  down:function(x,y){ var n=E.cl(Math.floor((x-160)/120),0,3); press(KEY[n]); },
  update:function(dt){
    if(flash>0){flash-=dt; if(flash<=0)cur=-1;}
    if(show){ st+=dt;
      if(st>.5){ st=0;
        if(cur>=0)cur=-1;
        else if(i<seq.length){ cur=seq[i]; flash=.4; E.note(300+cur*90,.3); i++; }
        else { show=false; i=0; } } } },
  draw:function(c){
    E.bg('#0f1a22');
    E.spr('🍜',400,200,110+ (cur>=0?16:0));
    for(var n=0;n<4;n++){ var x=160+n*120;
      E.rr(x+8,400,104,104,20, cur===n?'#ffc93d':'#232c44');
      E.spr(AR[n],x+60,452,44); }
    E.tx(show?'شاهد الرقصة… 👀':'ارقص مثلها! 💃',400,80,28, show?'#ffc93d':'#9dff3d');
    E.hudL('جولة '+round); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'sock-hunt', t:'الجورب المفقود', c:'funny', e:'🧦', tags:['ملاحظة','بحث'],
d:'كل الجوارب متشابهة… إلا اثنين. جدهما قبل أن ينفد صبرك.',
how:'انقر الجوربين المتطابقين', noPad:true,
make:function(E){
  var socks,pick,t,round,pairIdx;
  function gen(){ var n=8+round*4; socks=[];
    var base=E.ri(0,300);
    for(var i=0;i<n;i++) socks.push({x:E.rnd(70,730),y:E.rnd(110,520),h:(base+E.ri(20,340))%360,r:E.rnd(-.6,.6),m:false});
    var a=E.ri(0,n-1), b; do{ b=E.ri(0,n-1); }while(b===a);
    socks[b].h=socks[a].h; pairIdx=[a,b]; pick=[]; t=Math.max(8,22-round*1.6); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    for(var i=socks.length-1;i>=0;i--){ if(E.dist(x,y,socks[i].x,socks[i].y)<28){
      if(pick.indexOf(i)>=0)return;
      pick.push(i); socks[i].m=true; E.s('tick');
      if(pick.length===2){
        if(Math.abs(socks[pick[0]].h-socks[pick[1]].h)<1){
          E.add(150+Math.floor(t)*10); E.s('win'); round++;
          if(round>6) return E.won('خبير جوارب! 🧦','ست جولات'); gen(); }
        else { E.add(-40); E.s('buzz'); E.shake(10); t=Math.max(2,t-2.5);
          socks[pick[0]].m=false; socks[pick[1]].m=false; pick=[]; } }
      return; } } },
  update:function(dt){ t-=dt; if(t<=0) E.over('ضاع الجورب للأبد 🧦','الجولة '+round); },
  draw:function(c){
    E.bg('#141824');
    socks.forEach(function(s,i){ c.save(); c.translate(s.x,s.y); c.rotate(s.r);
      c.fillStyle='hsl('+s.h+',65%,55%)';
      if(c.roundRect){ c.beginPath(); c.roundRect(-14,-30,28,44,10); c.fill();
        c.beginPath(); c.roundRect(-14,4,42,22,10); c.fill(); }
      else { c.fillRect(-14,-30,28,44); c.fillRect(-14,4,42,22); }
      c.fillStyle='rgba(255,255,255,.25)'; c.fillRect(-14,-30,28,8);
      if(s.m){ c.strokeStyle='#fff'; c.lineWidth=3; c.strokeRect(-18,-34,50,64); }
      c.restore(); });
    E.tx('جولة '+round+' — جد الجوربين المتطابقين',400,50,24,'#dfe6ff');
    E.hud('النتيجة '+E.score); E.hudL('⏱ '+Math.max(0,t).toFixed(1), t<5?'#ff3d7f':'#fff');
  }};
}});

G({id:'hiccup-stop', t:'أوقف الحازوقة', c:'funny', e:'😵', tags:['إيقاع','توقيت'],
d:'الحازوقة تأتي بإيقاع. اشرب الماء في اللحظة التي تسبقها بالضبط.',
how:'انقر قبل الحازوقة مباشرة',
make:function(E){
  var beat,t,cured,fails,tempo;
  function reset(){ tempo=1.6; t=0; cured=0; fails=0; beat=false; }
  reset();
  return {
  down:function(){
    var phase=t/tempo, d=Math.min(Math.abs(phase-1),phase);
    if(phase>.78&&phase<.99){ cured++; E.add(120); E.s('coin'); E.burst(400,300,['#00d4ff'],14);
      t=0; tempo=Math.max(.7,tempo-.08);
      if(cured>=10) return E.won('شُفيت من الحازوقة! 💧','عشر مرات'); }
    else { fails++; E.add(-40); E.s('buzz'); E.shake(8);
      if(fails>=6) return E.over('حازوقة أبدية 😵','شربت في الوقت الخاطئ'); } },
  key:function(k,d){ if(d&&k===' ')this.down(); },
  update:function(dt){ t+=dt;
    if(t>=tempo){ t=0; E.s('pop'); E.shake(6); fails+=.5;
      if(fails>=6) E.over('حازوقة أبدية 😵','لم توقفها في الوقت'); } },
  draw:function(c){
    var p=t/tempo;
    E.bg('#101a26');
    E.spr(p>.9?'😵':'🙂',400,260,100+(p>.92?24:0));
    E.ring(400,430,90,'#1e2540',14);
    E.arc(400,430,90,-1.5708,-1.5708+p*6.283,'#00d4ff',14);
    E.arc(400,430,90,-1.5708+.78*6.283,-1.5708+.99*6.283,'#9dff3d',16);
    E.spr('💧',400,430,40);
    E.tx('شُفي: '+cured+'/10',400,60,26,'#9dff3d');
    E.hud('النتيجة '+E.score); E.hudL('أخطاء '+fails.toFixed(0)+'/6');
  }};
}});

G({id:'pigeon-post', t:'الحمام الزاجل المشاغب', c:'funny', e:'🕊️', tags:['طيران','توصيل'],
d:'أوصل الرسائل للنوافذ الصحيحة، وتفادَ المظلات والغسيل المنشور.',
how:'الأسهم للطيران · مسافة لإسقاط الرسالة',
make:function(E){
  var p,wins,obs,letters,t,done;
  function reset(){ p={x:120,y:300,vy:0}; obs=[]; letters=[]; t=50; done=0;
    wins=[]; for(var i=0;i<4;i++) wins.push({x:640,y:110+i*120,ok:i===0});
    for(var j=0;j<7;j++) obs.push({x:E.rnd(220,560),y:E.rnd(80,520),v:E.rnd(-70,70),e:E.pick(['☂️','🧺','🪁','🎈'])}); }
  reset();
  return {
  key:function(k,d){ if(d&&k===' ')drop(); },
  down:function(x,y){ if(x>600)drop(); else { p.vy=(y-p.y)*2; } },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهت المناوبة','أوصلت '+done+' رسالة');
    var ky=E.ky(); if(ky)p.vy=ky*260; else p.vy*=.9;
    if(E.m.down)p.vy=(E.m.y-p.y)*3;
    p.y=E.cl(p.y+p.vy*dt,30,570);
    obs.forEach(function(o){ o.y+=o.v*dt; if(o.y<60||o.y>560)o.v*=-1;
      if(Math.abs(o.x-p.x)<30&&Math.abs(o.y-p.y)<30){ E.shake(14); E.s('boom'); E.add(-60);
        p.x=120; p.y=300; } });
    for(var i=letters.length-1;i>=0;i--){ var l=letters[i]; l.x+=340*dt; l.y+=l.vy*dt; l.vy+=180*dt;
      if(l.x>860||l.y>600){ letters.splice(i,1); continue; }
      wins.forEach(function(w){ if(Math.abs(l.x-w.x)<44&&Math.abs(l.y-w.y)<40){
        if(w.ok){ done++; E.add(200); E.s('coin'); E.burst(w.x,w.y,['#9dff3d'],14);
          wins.forEach(function(q){q.ok=false;}); E.pick(wins).ok=true; }
        else { E.add(-70); E.s('buzz'); }
        letters.splice(letters.indexOf(l),1); } }); } },
  draw:function(c){
    E.sky('#3a6ea8','#132038');
    E.r(600,0,200,600,'#5a4a3a');
    wins.forEach(function(w){ E.rr(w.x-42,w.y-38,84,76,6, w.ok?'#ffc93d':'#2b3350');
      E.spr(w.ok?'📬':'🪟',w.x,w.y,40); });
    obs.forEach(function(o){ E.spr(o.e,o.x,o.y,38); });
    letters.forEach(function(l){ E.spr('✉️',l.x,l.y,26); });
    E.spr('🕊️',p.x,p.y,42);
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · أوصلت '+done); E.hud('النتيجة '+E.score);
  }};
  function drop(){ if(letters.length<3){ letters.push({x:p.x,y:p.y,vy:-60}); E.s('swish'); } }
}});

G({id:'cow-launch', t:'إطلاق البقرة', c:'funny', e:'🐄', tags:['قذف','مسافة'],
d:'اقذف البقرة أبعد ما يمكن — واصطدم بالترامبولينات لتطير أكثر.',
how:'انقر لضبط الزاوية ثم القوة',
make:function(E){
  var st,ang,pw,cow,dist,tramps,best;
  function reset(){ st=0; ang=0; pw=0; cow=null; dist=0; best=0;
    tramps=[]; for(var i=0;i<10;i++) tramps.push({x:600+i*E.rnd(300,600),y:520}); }
  reset();
  return {
  down:function(){
    if(st===0){ st=1; }
    else if(st===1){ st=2; }
    else if(st===2){ cow={x:80,y:480,vx:Math.cos(-ang)*pw*11,vy:Math.sin(-ang)*pw*11,r:.0}; st=3; E.s('boom'); E.shake(10); }
    else if(st===3&&!cow){ st=0; ang=0; pw=0; } },
  key:function(k,d){ if(d&&k===' ')this.down(); },
  update:function(dt){
    if(st===1){ ang=(Math.sin(E.time*2.2)*.5+.5)*1.4; }
    if(st===2){ pw=(Math.sin(E.time*3.4)*.5+.5)*100; }
    if(st===3&&cow){ cow.vy+=760*dt; cow.x+=cow.vx*dt; cow.y+=cow.vy*dt; cow.r+=cow.vx*dt*.02;
      dist=Math.max(dist,Math.round(cow.x/10));
      tramps.forEach(function(t2){ if(Math.abs(cow.x-t2.x)<50&&cow.y>t2.y-24&&cow.y<t2.y+20&&cow.vy>0){
        cow.vy=-Math.abs(cow.vy)*1.12-120; cow.vx*=1.06; E.s('pop'); E.burst(cow.x,t2.y,['#9dff3d'],12); } });
      if(cow.y>556){ cow.y=556; cow.vy*=-.42; cow.vx*=.72;
        if(Math.abs(cow.vy)<60&&Math.abs(cow.vx)<40){ E.setScore(dist); E.s('win');
          if(dist>best)best=dist;
          E.won('طارت '+dist+' متراً 🐄', dist>400?'بقرة فضائية!':dist>200?'رمية محترمة':'حاول زاوية ٤٥'); } } } },
  draw:function(c){
    E.sky('#6ea8d8','#20304a');
    var cam= cow? Math.max(0,cow.x-300):0;
    c.save(); c.translate(-cam,0);
    E.r(cam,556,900,44,'#3d6b2a');
    tramps.forEach(function(t2){ if(t2.x<cam-60||t2.x>cam+900)return;
      E.rr(t2.x-46,t2.y-8,92,14,7,'#ff3d7f'); E.r(t2.x-40,t2.y+6,8,44,'#39406b'); E.r(t2.x+32,t2.y+6,8,44,'#39406b'); });
    E.spr('🎪',80+0,520,54);
    if(cow) E.spr('🐄',cow.x,cow.y,44,cow.r);
    c.restore();
    if(st<3){ E.spr('🐄',80,480,44);
      E.ln(110,490,110+Math.cos(-ang)*110,490+Math.sin(-ang)*110,'#ffc93d',5);
      E.rr(60,560,300,26,8,'#1e2540'); E.rr(62,562,296*(pw/100),22,7,'#ff3d7f');
      E.tx(st===0?'انقر لبدء تحديد الزاوية':st===1?'انقر لتثبيت الزاوية':'انقر لتثبيت القوة والإطلاق',400,50,24,'#fff'); }
    E.hud('المسافة '+dist+' م'); E.hudL('الأفضل '+best+' م');
  }};
}});

G({id:'bubble-gum', t:'فقاعة العلكة', c:'funny', e:'🫧', tags:['أعصاب','مخاطرة'],
d:'انفخ الفقاعة أكبر ما يمكن — لكنها تنفجر في وجهك إن بالغت، وحدّ الانفجار يتغيّر.',
how:'اضغط مطوّلاً للنفخ · أفلت لتثبيت النتيجة',
make:function(E){
  var sz,lim,blow,round,banked;
  function reset(){ round=1; banked=0; newR(); }
  function newR(){ sz=20; lim=E.rnd(120,260); blow=false; }
  reset();
  return {
  down:function(){ blow=true; },
  up:function(){ if(!blow)return; blow=false;
    var pts=Math.round((sz-20)*3); banked+=pts; E.add(pts); E.s('coin'); round++;
    if(round>7) return E.won('لسان ذهبي! 🫧','مجموع '+banked);
    newR(); },
  key:function(k,d){ if(k!==' ')return; if(d)this.down(); else this.up(); },
  update:function(dt){
    if(blow){ sz+=(60+round*8)*dt; if(Math.random()<.25)E.tone(200+sz,.04,'sine',.05);
      if(sz>lim){ blow=false; E.s('boom'); E.shake(22); E.add(-Math.round(sz)); 
        E.burst(400,320,['#ff9fd0','#fff'],26,240);
        if(E.score<0) return E.over('انفجرت في وجهك 🤡','النتيجة سالبة');
        round++; if(round>7) return E.won('نجوت بصعوبة','مجموع '+banked); newR(); } } },
  draw:function(c){
    E.bg('#1b1020');
    E.spr('🧒',260,400,110);
    E.o(430,320,sz,'rgba(255,159,208,.75)');
    E.ring(430,320,sz,'#ffd0e6',3);
    E.o(430-sz*.35,320-sz*.35,sz*.18,'rgba(255,255,255,.6)');
    E.tx('الجولة '+round+'/7',400,60,26,'#dfe6ff');
    E.tx('حجم: '+Math.round(sz-20),400,545,22,'#ffc93d');
    E.tx('أفلت لتثبيت النقاط — أو خاطر أكثر',400,575,15,'#98a0b8');
    E.hud('النتيجة '+E.score);
  }};
}});
