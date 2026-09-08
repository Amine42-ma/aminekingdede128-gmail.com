/* ============ 10) سباق وسرعة ============ */

G({id:'top-race', t:'سباق الطريق السريع', c:'race', e:'🏎️', tags:['سباق','تفادي'],
d:'تجاوز السيارات على طريق سريع يضيق ويتسارع — وكل تجاوز يقرّبك من الحافة.',
how:'← → للتوجيه · ↑ لزيادة السرعة',
make:function(E){
  var p,cars,sp,scroll,road,lane;
  function reset(){ p={x:400,v:0}; cars=[]; sp=280; scroll=0; road=280; }
  reset();
  return {
  update:function(dt){
    sp=(280+scroll*.02)*(E.k('ArrowUp')?1.5:1);
    scroll+=sp*dt; E.setScore(Math.floor(scroll/20));
    road=Math.max(150,280-scroll*.002);
    var kx=E.kx(); if(E.m.down)kx=E.cl((E.m.x-p.x)/60,-1,1);
    p.v=E.lerp(p.v,kx*330,dt*10); p.x+=p.v*dt;
    var cx=400+Math.sin(scroll*.0015)*140;
    if(p.x<cx-road||p.x>cx+road){ E.shake(20); E.burst(p.x,470,['#ff3d7f'],22);
      return E.over('خرجت عن الطريق','قطعت '+E.score+' متراً'); }
    if(Math.random()<dt*(1.6+scroll*.00012))
      cars.push({x:cx+E.rnd(-road+40,road-40),y:-60,v:E.rnd(70,180),e:E.pick(['🚗','🚙','🚚','🏍️'])});
    for(var i=cars.length-1;i>=0;i--){ var c2=cars[i]; c2.y+=(sp-c2.v)*dt;
      if(c2.y>660){ cars.splice(i,1); E.add(25); continue; }
      if(Math.abs(c2.x-p.x)<34&&Math.abs(c2.y-470)<38){ E.shake(24); E.burst(p.x,470,['#ff3d7f','#ffc93d'],26);
        return E.over('اصطدمت','قطعت '+E.score+' متراً'); } } },
  draw:function(c){
    E.bg('#1a3a1a');
    var cx=400+Math.sin(scroll*.0015)*140;
    for(var y=-60;y<660;y+=30){ var yy=y;
      var ccx=400+Math.sin((scroll+ (600-yy))*.0015)*140;
      var rw=Math.max(150,280-(scroll)*.002);
      E.r(ccx-rw,yy,rw*2,32,'#2e3038');
      E.r(ccx-3,yy+((scroll*1)%60<30?0:16),6,14,'rgba(255,255,255,.35)'); }
    cars.forEach(function(c2){ E.spr(c2.e,c2.x,c2.y,40); });
    E.spr('🏎️',p.x,470,44);
    E.hud(E.score+' م'); E.hudL('السرعة '+Math.round(sp/3)+' كم/س');
  }};
}});

G({id:'tunnel-fly', t:'نفق بلا نهاية', c:'race', e:'🛸', tags:['سرعة','تفادي'],
d:'نفق يضيق ويتلوّى بسرعة متزايدة. لا شيء سوى أنت والجدران.',
how:'حرّك الفأرة أو الأسهم',
make:function(E){
  var p,segs,sp,scroll;
  function reset(){ p={y:300,v:0}; segs=[]; sp=260; scroll=0;
    for(var i=0;i<42;i++) segs.push({c:300,w:180}); }
  reset();
  function push(){ var last=segs[segs.length-1];
    segs.push({ c:E.cl(last.c+E.rnd(-26,26),90,510), w:Math.max(58,last.w+E.rnd(-6,4)) }); }
  return {
  update:function(dt){
    sp=260+scroll*.03; scroll+=sp*dt; E.setScore(Math.floor(scroll/20));
    var ky=E.ky();
    if(E.m.down||Math.abs(E.m.y-300)>4){ p.v=E.lerp(p.v,(E.m.y-p.y)*4,dt*10); }
    if(ky) p.v=ky*340;
    p.y=E.cl(p.y+p.v*dt,10,590);
    while(scroll>20){ scroll-=20; segs.shift(); push(); }
    var s=segs[8];
    if(p.y<s.c-s.w/2||p.y>s.c+s.w/2){ E.shake(22); E.burst(160,p.y,['#00d4ff','#fff'],24);
      return E.over('اصطدمت بالنفق','قطعت '+E.score+' متراً'); } },
  draw:function(c){
    E.bg('#04060e');
    segs.forEach(function(s,i){ var x=i*20-(scroll%20);
      E.r(x,0,21,s.c-s.w/2,'#1e2a55'); E.r(x,s.c+s.w/2,21,600,'#1e2a55');
      E.r(x,s.c-s.w/2-4,21,4,'#5b6bd4'); E.r(x,s.c+s.w/2,21,4,'#5b6bd4'); });
    E.spr('🛸',160,p.y,38);
    E.hud(E.score+' م'); E.hudL('السرعة '+Math.round(sp/3));
  }};
}});

G({id:'drift-king', t:'ملك الانجراف', c:'race', e:'🏁', tags:['انجراف','نقاط'],
d:'حافظ على الانجراف داخل الحلبة أطول فترة ممكنة — والزاوية الكبرى تعني نقاطاً أكبر.',
how:'← → للتوجيه · ↑ للتسريع', noPad:false,
make:function(E){
  var car,t,drift,combo,cones;
  function reset(){ car={x:400,y:300,a:0,v:0,vx:0,vy:0}; t=60; drift=0; combo=0;
    cones=[]; for(var i=0;i<16;i++){ var a=i/16*6.283;
      cones.push({x:400+Math.cos(a)*250,y:300+Math.sin(a)*190}); } }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت','نقاط انجرافك '+E.score);
    var acc=(E.k('ArrowUp')||E.m.down)?260:-60;
    car.v=E.cl(car.v+acc*dt,0,340);
    car.a+=E.kx()*2.4*dt*(car.v/300+.3);
    var fx=Math.cos(car.a)*car.v, fy=Math.sin(car.a)*car.v;
    car.vx=E.lerp(car.vx,fx,dt*2.4); car.vy=E.lerp(car.vy,fy,dt*2.4);
    car.x+=car.vx*dt; car.y+=car.vy*dt;
    if(car.x<20||car.x>780){ car.vx*=-.4; car.x=E.cl(car.x,20,780); car.v*=.5; E.s('thud'); }
    if(car.y<20||car.y>580){ car.vy*=-.4; car.y=E.cl(car.y,20,580); car.v*=.5; E.s('thud'); }
    var mv=Math.atan2(car.vy,car.vx), diff=Math.abs(((mv-car.a+9.42)%6.283)-3.14159);
    var slip=Math.abs(3.14159-diff);
    if(slip>.35&&car.v>120){ drift+=dt; combo+=dt*(1+slip); E.add(Math.round(60*slip*dt));
      E.P.a.length<80&&E.burst(car.x-Math.cos(car.a)*18,car.y-Math.sin(car.a)*18,['#8a93b5'],1,30);
      if(Math.random()<dt*8)E.tone(200+slip*300,.04,'sawtooth',.04); }
    else { if(combo>2)E.s('coin'); combo=0; }
    cones.forEach(function(c2){ if(E.dist(car.x,car.y,c2.x,c2.y)<20&&!c2.hit){ c2.hit=true; E.add(-40); E.s('buzz'); } }); },
  draw:function(c){
    E.bg('#2a2a30');
    E.ring(400,300,250,'rgba(255,255,255,.08)',120);
    cones.forEach(function(c2){ E.spr(c2.hit?'💥':'🚧',c2.x,c2.y,26); });
    c.save(); c.translate(car.x,car.y); c.rotate(car.a);
    E.rr(-22,-12,44,24,5,'#ff3d7f'); E.r(2,-10,10,20,'#12161f'); c.restore();
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · انجراف '+drift.toFixed(1)+'ث');
    E.hud('النتيجة '+E.score, combo>1?'#9dff3d':'#fff');
    if(combo>1) E.tx('انجراف ×'+combo.toFixed(1),400,60,30,'#9dff3d');
  }};
}});

G({id:'hill-bike', t:'دراجة التلال', c:'race', e:'🏍️', tags:['فيزياء','توازن'],
d:'تضاريس متموّجة ودرّاجة تنقلب بسهولة. وازن ميلانك أثناء الطيران.',
how:'↑ تسريع · ↓ فرملة · ← → للميلان',
make:function(E){
  var b,ter,cam,fuel;
  function gen(){ ter=[]; var y=430;
    for(var x=0;x<=6000;x+=40){ y=E.cl(y+E.rnd(-30,28),260,540); ter.push(y); }
    b={x:80,y:300,vx:0,vy:0,a:0,va:0,w:0}; cam=0; fuel=100; }
  function reset(){ gen(); }
  reset();
  function gy(x){ var i=E.cl(Math.floor(x/40),0,ter.length-2);
    return E.lerp(ter[i],ter[i+1],(x%40)/40); }
  return {
  update:function(dt){
    var gas=E.k('ArrowUp')||(E.m.down&&E.m.x>400);
    var brake=E.k('ArrowDown')||(E.m.down&&E.m.x<400);
    if(gas&&fuel>0){ b.vx+=250*dt; fuel-=6*dt; b.va-=1.4*dt; }
    if(brake){ b.vx-=180*dt; b.va+=1.4*dt; }
    b.va+=E.kx()*2.4*dt;
    b.vy+=900*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
    b.a+=b.va*dt; b.va*=.985; b.vx*=.996;
    var g=gy(b.x);
    if(b.y>g-16){ b.y=g-16; b.vy=Math.min(0,b.vy);
      var slope=Math.atan2(gy(b.x+20)-gy(b.x-20),40);
      b.a=E.lerp(b.a,slope,dt*8); b.va*=.85;
      b.vx=Math.max(0,b.vx*.998); }
    if(Math.abs(b.a)>2.1){ E.shake(18); E.s('boom');
      return E.over('انقلبت الدرّاجة 🏍️','قطعت '+E.score+' متراً'); }
    if(fuel<=0&&b.vx<12) return E.over('نفد الوقود','قطعت '+E.score+' متراً');
    E.setScore(Math.floor(b.x/10));
    cam=E.lerp(cam,b.x-220,dt*6);
    if(b.x>5800) E.won('وصلت للنهاية! 🏁','٥٨٠ متراً'); },
  draw:function(c){
    E.sky('#5a8ad0','#1a2440');
    c.save(); c.translate(-cam,0);
    c.beginPath(); c.moveTo(cam,600);
    for(var x=Math.max(0,cam-40);x<cam+880;x+=40) c.lineTo(x,gy(x));
    c.lineTo(cam+880,600); c.closePath(); c.fillStyle='#3d5b2a'; c.fill();
    c.strokeStyle='#6fa63d'; c.lineWidth=5; c.stroke();
    c.save(); c.translate(b.x,b.y); c.rotate(b.a);
    E.spr('🏍️',0,0,46); c.restore();
    c.restore();
    E.rr(20,560,200,18,8,'#1c2338'); E.rr(22,562,196*(fuel/100),14,6, fuel<25?'#ff3d7f':'#9dff3d');
    E.tx('وقود',120,569,12,'#0b0d14');
    E.hud(E.score+' م'); E.hudL('الميل '+(b.a*57).toFixed(0)+'°', Math.abs(b.a)>1.6?'#ff3d7f':'#fff');
  }};
}});

G({id:'jetpack', t:'الحقيبة النفّاثة', c:'race', e:'🚀', tags:['طيران','تفادي'],
d:'حلّق داخل مختبر مليء بأشعة الليزر والصواريخ، واجمع الشرائح الذهبية.',
how:'اضغط مطوّلاً للصعود',
make:function(E){
  var p,lasers,coins,rockets,scroll,sp,up;
  function reset(){ p={y:400,v:0}; lasers=[]; coins=[]; rockets=[]; scroll=0; sp=300; up=false;
    for(var i=0;i<6;i++) lasers.push({x:800+i*280,y:E.rnd(100,450),h:E.rnd(90,220),a:Math.random()<.4});
    for(var j=0;j<20;j++) coins.push({x:700+j*90,y:E.rnd(80,520),got:false}); }
  reset();
  return {
  down:function(){ up=true; }, up:function(){ up=false; },
  key:function(k,d){ if(k===' '||k==='ArrowUp')up=d; },
  update:function(dt){
    sp=300+scroll*.02; scroll+=sp*dt; E.setScore(Math.floor(scroll/25));
    p.v+= (up?-1450:1150)*dt; p.v=E.cl(p.v,-460,560);
    p.y+=p.v*dt;
    if(p.y<24){p.y=24;p.v=0;} 
    if(p.y>556){p.y=556;p.v=0;}
    if(up&&Math.random()<.6) E.burst(160,p.y+18,['#ffc93d','#ff6b3d'],1,60);
    lasers.forEach(function(l){ l.x-=sp*dt;
      if(l.x<-60){ l.x+=6*280+E.rnd(0,200); l.y=E.rnd(80,440); l.h=E.rnd(90,230); l.a=Math.random()<.4; }
      var on = !l.a || Math.sin(E.time*3+l.x)>0;
      if(on&&Math.abs(l.x-160)<20&&p.y>l.y&&p.y<l.y+l.h){ E.shake(20); E.burst(160,p.y,['#ff3d7f'],22);
        E.over('أصابك الليزر','قطعت '+E.score+' متراً'); } });
    coins.forEach(function(c2){ c2.x-=sp*dt;
      if(c2.x<-40){ c2.x+=20*90+E.rnd(0,300); c2.y=E.rnd(70,530); c2.got=false; }
      if(!c2.got&&Math.abs(c2.x-160)<26&&Math.abs(c2.y-p.y)<26){ c2.got=true; E.add(60); E.s('coin'); } });
    if(Math.random()<dt*.5) rockets.push({x:840,y:E.rnd(60,540),warn:1.1});
    for(var i=rockets.length-1;i>=0;i--){ var r=rockets[i];
      if(r.warn>0){ r.warn-=dt; if(r.warn<=0)E.s('laser'); continue; }
      r.x-=520*dt;
      if(r.x<-60){ rockets.splice(i,1); continue; }
      if(Math.abs(r.x-160)<26&&Math.abs(r.y-p.y)<26){ E.shake(22); E.over('أصابك صاروخ','قطعت '+E.score+' متراً'); } } },
  draw:function(c){
    E.bg('#101828');
    E.r(0,0,800,20,'#2b3350'); E.r(0,580,800,20,'#2b3350');
    lasers.forEach(function(l){ var on=!l.a||Math.sin(E.time*3+l.x)>0;
      E.o(l.x,l.y,10,'#ffc93d'); E.o(l.x,l.y+l.h,10,'#ffc93d');
      if(on) E.ln(l.x,l.y,l.x,l.y+l.h,'#ff3d7f',7); });
    coins.forEach(function(c2){ if(!c2.got) E.spr('🪙',c2.x,c2.y,24); });
    rockets.forEach(function(r){ if(r.warn>0){ E.spr('⚠️',770,r.y,32); }
      else E.spr('🚀',r.x,r.y,34,3.14); });
    E.spr('🧑‍🚀',160,p.y,40);
    E.hud(E.score+' م');
  }};
}});

G({id:'parking', t:'ركن السيارة', c:'race', e:'🅿️', tags:['دقّة','قيادة'],
d:'أوقف السيارة داخل المستطيل الأصفر دون خدش أي شيء. تزداد الزوايا صعوبة.',
how:'↑↓ للحركة · ←→ للتوجيه',
make:function(E){
  var car,spot,walls,lvl,t;
  function gen(){ car={x:80,y:520,a:-1.5708,v:0};
    spot={x:E.rnd(250,650),y:E.rnd(100,400),a:E.pick([0,1.5708,.6,-.6])};
    walls=[]; for(var i=0;i<2+lvl;i++) walls.push({x:E.rnd(120,700),y:E.rnd(80,500),w:E.rnd(40,150),h:E.rnd(30,110)});
    t=45; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.over('نفد الوقت','المرحلة '+lvl);
    var ky=E.ky(); if(E.m.down)ky=E.m.y<300?-1:1;
    car.v=E.lerp(car.v,-ky*130,dt*5);
    car.a+=E.kx()*1.8*dt*E.cl(Math.abs(car.v)/60,0,1)*(car.v<0?-1:1);
    car.x+=Math.cos(car.a)*car.v*dt; car.y+=Math.sin(car.a)*car.v*dt;
    if(car.x<24||car.x>776||car.y<24||car.y>576){ E.shake(14); E.s('boom');
      return E.over('اصطدمت بالسور','المرحلة '+lvl); }
    for(var i=0;i<walls.length;i++){ var w=walls[i];
      if(car.x>w.x-20&&car.x<w.x+w.w+20&&car.y>w.y-20&&car.y<w.y+w.h+20){
        E.shake(16); E.s('boom'); return E.over('خدشت سيارة أخرى','المرحلة '+lvl); } }
    var da=Math.abs(((car.a-spot.a+9.42)%3.14159)-1.5708);
    if(E.dist(car.x,car.y,spot.x,spot.y)<26&&Math.abs(car.v)<20&&da>1.35){
      E.add(200+Math.floor(t)*10); E.s('win'); lvl++;
      if(lvl>7) return E.won('سائق محترف! 🅿️','سبع مراحل'); gen(); } },
  draw:function(c){
    E.bg('#2a2a32');
    walls.forEach(function(w){ E.rr(w.x,w.y,w.w,w.h,6,'#4a4a58'); E.spr('🚙',w.x+w.w/2,w.y+w.h/2,26); });
    c.save(); c.translate(spot.x,spot.y); c.rotate(spot.a);
    c.strokeStyle='#ffc93d'; c.lineWidth=4; c.setLineDash([12,8]); c.strokeRect(-26,-46,52,92); c.setLineDash([]);
    c.restore();
    E.spr('🅿️',spot.x,spot.y,26);
    c.save(); c.translate(car.x,car.y); c.rotate(car.a+1.5708);
    E.rr(-20,-40,40,80,8,'#00d4ff'); E.r(-14,-30,28,22,'#0d1420'); c.restore();
    E.hudL('مرحلة '+lvl); E.hud('⏱ '+Math.max(0,t).toFixed(0), t<10?'#ff3d7f':'#fff');
  }};
}});

G({id:'rail-switch', t:'محوّل السكك', c:'brain', e:'🚂', tags:['تخطيط','ضغط'],
d:'قطارات ملوّنة تتقدّم نحو محطات. بدّل المسارات في الوقت المناسب قبل التصادم.',
how:'انقر مفصل السكة لتبديله', noPad:true,
make:function(E){
  var trains,sw,t,delivered,rate;
  var C=['#ff3d7f','#00d4ff','#9dff3d','#ffc93d'];
  function reset(){ trains=[]; sw=[false,false,false]; t=0; delivered=0; rate=2.4; }
  reset();
  return {
  down:function(x,y){
    for(var i=0;i<3;i++){ if(E.dist(x,y,300,160+i*140)<40){ sw[i]=!sw[i]; E.s('tick'); return; } } },
  update:function(dt){
    t+=dt;
    if(Math.random()<dt*(1/rate)*2&&trains.length<8){
      var lane=E.ri(0,2);
      trains.push({x:-60,lane:lane,c:E.ri(0,3),sp:E.rnd(70,110)+t*.6,routed:false}); }
    rate=Math.max(1,2.4-t*.02);
    for(var i=trains.length-1;i>=0;i--){ var tr=trains[i];
      tr.x+=tr.sp*dt;
      if(!tr.routed&&tr.x>300){ tr.routed=true;
        if(sw[tr.lane]) tr.lane=(tr.lane+1)%3; }
      if(tr.x>760){ trains.splice(i,1);
        if(tr.c===tr.lane||tr.c===3){ delivered++; E.add(100); E.s('coin'); }
        else { E.add(-60); E.s('buzz'); E.shake(8);
          if(E.score<-200) return E.over('فوضى في المحطة','أوصلت '+delivered); }
        continue; }
      for(var j=0;j<trains.length;j++){ if(j===i)continue; var o=trains[j];
        if(o.lane===tr.lane&&Math.abs(o.x-tr.x)<44){
          E.shake(24); E.s('boom'); return E.over('تصادم! 🚂','أوصلت '+delivered+' قطاراً'); } } }
    if(delivered>=30) E.won('محوّل بارع! 🚂','٣٠ قطاراً'); },
  draw:function(c){
    E.bg('#12161f');
    for(var i=0;i<3;i++){ var y=160+i*140;
      E.r(0,y-4,800,8,'#4a4a58');
      for(var x=0;x<800;x+=22) E.r(x,y-12,5,24,'#3a3a48');
      E.rr(700,y-40,90,80,10,C[i]); E.tx('محطة',745,y,15,'#0b0d14');
      E.o(300,y,26, sw[i]?'#9dff3d':'#39406b'); E.tx(sw[i]?'⇄':'—',300,y,20,'#0b0d14'); }
    trains.forEach(function(tr){ var y=160+tr.lane*140;
      E.rr(tr.x-26,y-16,52,32,6,C[tr.c]); E.tx('🚂',tr.x,y,20); });
    E.hudL('أوصلت '+delivered+'/30'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'elevator', t:'المصعد المزدحم', c:'brain', e:'🛗', tags:['إدارة','ضغط'],
d:'ركّاب يظهرون في الطوابق ويريدون طوابق أخرى. حرّك المصعد بذكاء قبل نفاد صبرهم.',
how:'↑↓ لتحريك المصعد · مسافة للفتح',
make:function(E){
  var F=6,floor,riders,inside,t,served,open;
  function reset(){ floor=0; riders=[]; inside=[]; t=70; served=0; open=0; }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowUp')floor=Math.min(F-1,floor+1);
    if(k==='ArrowDown')floor=Math.max(0,floor-1);
    if(k===' ')doOpen(); },
  down:function(x,y){ if(x>600){ doOpen(); return; }
    var f=F-1-Math.floor((y-60)/80); floor=E.cl(f,0,F-1); },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهت المناوبة','خدمت '+served+' راكباً');
    if(open>0)open-=dt;
    if(Math.random()<dt*.9&&riders.length<9){
      var f=E.ri(0,F-1), to; do{ to=E.ri(0,F-1); }while(to===f);
      riders.push({f:f,to:to,p:12}); E.s('blip'); }
    for(var i=riders.length-1;i>=0;i--){ riders[i].p-=dt;
      if(riders[i].p<=0){ riders.splice(i,1); E.add(-70); E.s('buzz'); } } },
  draw:function(c){
    E.bg('#141824');
    for(var f=0;f<F;f++){ var y=520-f*80;
      E.r(60,y,680,4,'#3a4270');
      E.tx('ط'+(f+1),36,y-24,17,'#98a0b8');
      var n=0;
      riders.forEach(function(r){ if(r.f!==f)return;
        E.spr('🧍',180+n*44,y-26,30);
        E.r(166+n*44,y-52,28,5,'#3a2030'); E.r(166+n*44,y-52,28*(r.p/12),5, r.p<4?'#ff3d7f':'#9dff3d');
        E.tx('→'+(r.to+1),180+n*44,y-58,11,'#ffc93d'); n++; }); }
    var ey=520-floor*80;
    E.rr(600,ey-64,120,64,6, open>0?'#2fbd6f':'#39406b');
    inside.forEach(function(r,i){ E.spr('🧑',618+i*24,ey-32,22); });
    E.tx('داخل: '+inside.length+'/4',660,ey-8,13,'#dfe6ff');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · خدمت '+served); E.hud('النتيجة '+E.score);
    E.tx('انقر يمين الشاشة للفتح',400,580,15,'#6d7590');
  }};
  function doOpen(){
    open=.6; E.s('pop');
    for(var i=inside.length-1;i>=0;i--) if(inside[i].to===floor){
      inside.splice(i,1); served++; E.add(150); E.s('coin'); }
    for(var j=riders.length-1;j>=0;j--) if(riders[j].f===floor&&inside.length<4){
      inside.push(riders[j]); riders.splice(j,1); E.add(20); } }
}});

G({id:'taxi-rush', t:'سائق التاكسي', c:'race', e:'🚕', tags:['توصيل','وقت'],
d:'التقط الركّاب وأوصلهم لوجهتهم قبل نفاد الوقت. كل توصيلة تشتري ثوانٍ إضافية.',
how:'الأسهم للقيادة',
make:function(E){
  var car,pass,dest,t,done,blocks;
  function gen(){ blocks=[]; for(var y=0;y<4;y++)for(var x=0;x<5;x++)
      blocks.push({x:60+x*150,y:70+y*130,w:100,h:80});
    pass=spot(); dest=spot(); }
  function spot(){ return {x:E.rnd(40,760),y:E.rnd(40,560)}; }
  function reset(){ car={x:400,y:300,a:0,v:0}; t=45; done=0; gen(); }
  reset();
  return {
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهت المناوبة 🚕','أوصلت '+done+' راكباً');
    var ky=E.ky(); if(E.m.down) ky=-1;
    car.v=E.lerp(car.v,-ky*240,dt*6);
    if(E.m.down) car.a+=E.cl((E.m.x-400)/300,-1,1)*2.4*dt;
    car.a+=E.kx()*2.6*dt*E.cl(Math.abs(car.v)/90,0,1);
    car.x+=Math.cos(car.a)*car.v*dt; car.y+=Math.sin(car.a)*car.v*dt;
    car.x=E.cl(car.x,16,784); car.y=E.cl(car.y,16,584);
    blocks.forEach(function(b){ if(car.x>b.x-14&&car.x<b.x+b.w+14&&car.y>b.y-14&&car.y<b.y+b.h+14){
      var ox=Math.min(car.x-(b.x-14),(b.x+b.w+14)-car.x), oy=Math.min(car.y-(b.y-14),(b.y+b.h+14)-car.y);
      if(ox<oy) car.x = car.x<b.x+b.w/2 ? b.x-14 : b.x+b.w+14;
      else car.y = car.y<b.y+b.h/2 ? b.y-14 : b.y+b.h+14;
      car.v*=.3; if(Math.random()<.2)E.s('thud'); } });
    if(pass&&E.dist(car.x,car.y,pass.x,pass.y)<30){ pass=null; E.s('pop'); E.add(40); }
    if(!pass&&E.dist(car.x,car.y,dest.x,dest.y)<30){ done++; E.add(200); t+=8; E.s('coin');
      E.burst(dest.x,dest.y,['#ffc93d'],16);
      pass=spot(); dest=spot(); } },
  draw:function(c){
    E.bg('#3a3a44');
    blocks.forEach(function(b){ E.rr(b.x,b.y,b.w,b.h,6,'#232630');
      E.tx('🏢',b.x+b.w/2,b.y+b.h/2,30); });
    if(pass){ E.spr('🧍',pass.x,pass.y,32); E.ring(pass.x,pass.y,26,'#9dff3d',3); }
    else { E.spr('🏁',dest.x,dest.y,32); E.ring(dest.x,dest.y,26,'#ffc93d',3); }
    c.save(); c.translate(car.x,car.y); c.rotate(car.a); E.spr('🚕',0,0,38); c.restore();
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · '+done+' توصيلة', t<10?'#ff3d7f':'#fff');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'wave-surf', t:'راكب الموج', c:'sport', e:'🏄', tags:['فيزياء','توازن'],
d:'ابقَ على قمّة الموجة واقفز فوق الأمواج المرتفعة — والسقوط يعني نهاية الجولة.',
how:'← → للسرعة · مسافة للقفز',
make:function(E){
  var s,ph,t,air;
  function reset(){ s={x:250,y:400,vy:0,onW:true}; ph=0; t=0; air=0; }
  reset();
  function waveY(x,tt){ return 380+Math.sin(x*.012+tt*2)*70+Math.sin(x*.005-tt*1.1)*40; }
  return {
  key:function(k,d){ if(d&&k===' '&&s.onW){ s.vy=-460; s.onW=false; E.s('jump'); } },
  down:function(){ if(s.onW){ s.vy=-460; s.onW=false; E.s('jump'); } },
  update:function(dt){
    t+=dt; E.add(Math.round(24*dt));
    s.x=E.cl(s.x+E.kx()*230*dt,60,740);
    var wy=waveY(s.x,t);
    if(s.onW){ s.y=wy-14; }
    else { s.vy+=1150*dt; s.y+=s.vy*dt; air+=dt;
      if(s.y>=wy-14&&s.vy>0){ s.y=wy-14; s.onW=true;
        if(air>.55){ E.add(Math.round(air*250)); E.s('coin'); E.burst(s.x,s.y,['#00d4ff','#fff'],16); }
        air=0; } }
    if(s.y>580) return E.over('غرقت 🌊','صمدت '+t.toFixed(1)+' ثانية');
    if(t>70) E.won('راكب أمواج محترف! 🏄','٧٠ ثانية'); },
  draw:function(c){
    E.sky('#1a5a9a','#062038');
    c.beginPath(); c.moveTo(0,600);
    for(var x=0;x<=800;x+=10) c.lineTo(x,waveY(x,t));
    c.lineTo(800,600); c.closePath(); c.fillStyle='#1470b0'; c.fill();
    c.strokeStyle='#7cd4ff'; c.lineWidth=4; c.stroke();
    E.spr('🏄',s.x,s.y-14,44);
    E.hud('النتيجة '+E.score); E.hudL(s.onW?'على الموج':'في الهواء! '+air.toFixed(1)+'ث', s.onW?'#fff':'#9dff3d');
  }};
}});

G({id:'sled-slope', t:'الزلاجة الجبلية', c:'race', e:'🛷', tags:['سرعة','تفادي'],
d:'انزلق على منحدر ثلجي بين الأشجار والصخور. السرعة تزداد ولا تتوقف أبداً.',
how:'← → للمناورة',
make:function(E){
  var p,obs,sp,scroll,flags;
  function reset(){ p={x:400,v:0}; obs=[]; sp=260; scroll=0; flags=0; }
  reset();
  return {
  update:function(dt){
    sp=260+scroll*.03; scroll+=sp*dt; E.setScore(Math.floor(scroll/20));
    var kx=E.kx(); if(E.m.down)kx=E.cl((E.m.x-p.x)/70,-1,1);
    p.v=E.lerp(p.v,kx*300,dt*8); p.x=E.cl(p.x+p.v*dt,20,780);
    if(Math.random()<dt*3.4) obs.push({x:E.rnd(20,780),y:-40,e:E.pick(['🌲','🌲','🪨','⛄']),
      t:Math.random()<.16?'gate':''});
    for(var i=obs.length-1;i>=0;i--){ var o=obs[i]; o.y+=sp*dt;
      if(o.y>660){ obs.splice(i,1); continue; }
      if(o.t==='gate'){ if(Math.abs(o.y-470)<12&&Math.abs(o.x-p.x)<50){ flags++; E.add(120); E.s('coin'); o.t='done'; } }
      else if(Math.abs(o.x-p.x)<26&&Math.abs(o.y-470)<26){ E.shake(22); E.burst(p.x,470,['#fff','#ff3d7f'],22);
        return E.over('اصطدمت','قطعت '+E.score+' متراً'); } } },
  draw:function(c){
    E.bg('#dfe9ff');
    for(var i=0;i<24;i++){ var y=((i*90)+(scroll*.6))%700-50;
      E.r(0,y,800,3,'rgba(150,180,220,.25)'); }
    obs.forEach(function(o){ if(o.t==='gate'){ E.ln(o.x-50,o.y,o.x-50,o.y-50,'#ff3d7f',5);
        E.ln(o.x+50,o.y,o.x+50,o.y-50,'#ff3d7f',5); E.spr('🚩',o.x,o.y-50,20); }
      else if(o.t!=='done') E.spr(o.e,o.x,o.y,38); });
    E.spr('🛷',p.x,470,42);
    E.hud(E.score+' م'); E.hudL('بوابات '+flags);
  }};
}});

G({id:'meteor-dodge', t:'بين النيازك', c:'race', e:'☄️', tags:['فضاء','تفادي'],
d:'حقل نيازك بلا نهاية، وسفينتك تُبطئ الزمن لثانية واحدة كل عشر ثوانٍ.',
how:'الأسهم/الفأرة للحركة · مسافة لإبطاء الزمن',
make:function(E){
  var p,ms,t,slow,cd;
  function reset(){ p={x:400,y:480}; ms=[]; t=0; slow=0; cd=0; }
  reset();
  return {
  key:function(k,d){ if(d&&k===' '&&cd<=0){ slow=1.2; cd=10; E.s('power'); } },
  down:function(x,y){ if(cd<=0&&y<120){ slow=1.2; cd=10; E.s('power'); } },
  update:function(dt){
    t+=dt; if(cd>0)cd-=dt;
    var sc = slow>0 ? .32 : 1;
    if(slow>0)slow-=dt;
    E.add(Math.round(28*dt));
    if(E.kx()||E.ky()){ p.x=E.cl(p.x+E.kx()*340*dt,14,786); p.y=E.cl(p.y+E.ky()*340*dt,14,586); }
    else { p.x+=(E.m.x-p.x)*Math.min(1,dt*10); p.y+=(E.m.y-p.y)*Math.min(1,dt*10); }
    if(Math.random()<dt*(2.6+t*.06)) ms.push({x:E.rnd(0,800),y:-40,
      vx:E.rnd(-70,70), vy:E.rnd(140,260)+t*3, r:E.rnd(12,32), a:0, va:E.rnd(-3,3)});
    for(var i=ms.length-1;i>=0;i--){ var m=ms[i];
      m.x+=m.vx*dt*sc; m.y+=m.vy*dt*sc; m.a+=m.va*dt*sc;
      if(m.y>660){ ms.splice(i,1); continue; }
      if(E.dist(m.x,m.y,p.x,p.y)<m.r+10){ E.shake(24); E.burst(p.x,p.y,['#ff3d7f','#ffc93d'],26);
        return E.over('اصطدمت بنيزك','صمدت '+t.toFixed(1)+' ثانية'); } } },
  draw:function(c){
    E.bg(slow>0?'#0d1a2a':'#05060e');
    for(var i=0;i<50;i++) E.o((i*163)%800,((i*97)+E.time*40)%600,1,'rgba(255,255,255,.35)');
    ms.forEach(function(m){ E.spr('☄️',m.x,m.y,m.r*2,m.a); });
    E.spr('🛰️',p.x,p.y,36);
    if(slow>0) E.tx('الزمن بطيء',400,60,28,'#00d4ff');
    E.hud('النتيجة '+E.score);
    E.hudL(cd>0?'⏳ '+cd.toFixed(1):'مسافة = إبطاء الزمن', cd>0?'#6d7590':'#9dff3d');
  }};
}});
