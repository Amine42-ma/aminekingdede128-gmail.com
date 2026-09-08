/* ============ 7) أفكار لم ترها من قبل ============ */

G({id:'gravity-painter', t:'رسّام الجاذبية', c:'weird', e:'🖌️', tags:['ابتكار','فيزياء'],
d:'لا تتحكم بالكرة — بل ترسم حقول جاذبية تجذبها. حبرك محدود.',
how:'ارسم بالسحب لخلق حقول جذب', noPad:true,
make:function(E){
  var ball,goal,ink,fields,lvl,drawing,walls;
  function gen(){ ball={x:80,y:E.rnd(100,500),vx:60,vy:0}; goal={x:720,y:E.rnd(80,520),r:32};
    ink=100; fields=[]; walls=[];
    for(var i=0;i<lvl+1;i++) walls.push({x:E.rnd(250,560),y:E.rnd(60,420),w:26,h:E.rnd(90,190)}); }
  function reset(){ lvl=1; gen(); drawing=false; }
  reset();
  return {
  down:function(x,y){ drawing=true; },
  move:function(x,y){ if(!drawing||ink<=0)return;
    var last=fields[fields.length-1];
    if(!last||E.dist(x,y,last.x,last.y)>22){ fields.push({x:x,y:y}); ink-=1.6; } },
  up:function(){ drawing=false; },
  update:function(dt){
    fields.forEach(function(f){
      var dx=f.x-ball.x, dy=f.y-ball.y, d=Math.max(24,Math.sqrt(dx*dx+dy*dy));
      if(d<180){ ball.vx+=dx/d*2200/d*dt*3; ball.vy+=dy/d*2200/d*dt*3; } });
    ball.vy+=40*dt; ball.vx*=.995; ball.vy*=.995;
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
    if(ball.x<8||ball.x>792)ball.vx*=-.8; if(ball.y<8||ball.y>592)ball.vy*=-.8;
    ball.x=E.cl(ball.x,8,792); ball.y=E.cl(ball.y,8,592);
    walls.forEach(function(w){ if(ball.x>w.x-9&&ball.x<w.x+w.w+9&&ball.y>w.y-9&&ball.y<w.y+w.h+9){
      E.s('lose'); E.shake(12); ball={x:80,y:300,vx:60,vy:0}; E.add(-30); } });
    if(E.dist(ball.x,ball.y,goal.x,goal.y)<goal.r){ E.add(200+Math.round(ink)*4); E.s('win');
      E.burst(goal.x,goal.y,['#9dff3d','#fff'],22); lvl++;
      if(lvl>6) return E.won('فنّان جاذبية! 🖌️','ست لوحات'); gen(); }
    if(ink<=0&&Math.abs(ball.vx)<8&&Math.abs(ball.vy)<8) E.over('نفد الحبر والكرة متوقفة','المرحلة '+lvl); },
  draw:function(c){
    E.bg('#0a0c16');
    fields.forEach(function(f){ E.o(f.x,f.y,26,'rgba(124,92,255,.10)'); E.o(f.x,f.y,5,'#7c5cff'); });
    walls.forEach(function(w){ E.rr(w.x,w.y,w.w,w.h,5,'#ff3d7f'); });
    E.ring(goal.x,goal.y,goal.r,'#9dff3d',3); E.spr('🕳️',goal.x,goal.y,32);
    E.o(ball.x,ball.y,9,'#00d4ff');
    E.rr(20,560,220,18,8,'#1c2338'); E.rr(22,562,216*(ink/100),14,6,'#7c5cff');
    E.tx('حبر',130,569,12,'#dfe6ff');
    E.hudL('لوحة '+lvl); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'echo-maze', t:'متاهة الصدى', c:'weird', e:'🔊', tags:['ابتكار','صوت'],
d:'الظلام دامس. أطلق نبضة صوتية فترتد عن الجدران وتكشفها للحظة. المخرج بالسمع.',
how:'الأسهم للحركة · مسافة لإطلاق نبضة',
make:function(E){
  var W=17,H=13,CS=44,m,px,py,pings,lvl,steps,gx,gy;
  function gen(){ m=[]; for(var y=0;y<H;y++){ m.push([]); for(var x=0;x<W;x++)m[y].push(1); }
    var st=[[1,1]]; m[1][1]=0;
    while(st.length){ var cur=st[st.length-1], x=cur[0],y=cur[1];
      var o=[[2,0],[-2,0],[0,2],[0,-2]].filter(function(d){ var nx=x+d[0],ny=y+d[1];
        return nx>0&&ny>0&&nx<W-1&&ny<H-1&&m[ny][nx]===1; });
      if(!o.length){ st.pop(); continue; }
      var d2=E.pick(o); m[y+d2[1]/2][x+d2[0]/2]=0; m[y+d2[1]][x+d2[0]]=0; st.push([x+d2[0],y+d2[1]]); }
    px=1;py=1; gx=W-2; gy=H-2; m[gy][gx]=0; pings=[]; }
  function reset(){ lvl=1; steps=0; gen(); }
  reset();
  function ping(){ pings.push({x:px,y:py,r:0}); E.s('pop'); E.tone(700,.3,'sine',.1,300); }
  function mv(dx,dy){ var nx=px+dx,ny=py+dy;
    if(m[ny]&&m[ny][nx]===0){ px=nx;py=ny; steps++; E.s('tick'); E.tone(200,.05,'sine',.05);
      if(px===gx&&py===gy){ E.add(400-Math.min(350,steps*4)); E.s('win'); lvl++; steps=0;
        if(lvl>4) return E.won('خرجت بالسمع! 🔊','أربع متاهات'); gen(); } }
    else { E.s('thud'); E.tone(90,.1,'square',.08); } }
  return {
  key:function(k,d){ if(!d)return;
    if(k===' ')ping();
    if(k==='ArrowLeft')mv(-1,0); if(k==='ArrowRight')mv(1,0);
    if(k==='ArrowUp')mv(0,-1); if(k==='ArrowDown')mv(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y;
    if(Math.abs(dx)+Math.abs(dy)<20){ ping(); return; }
    if(Math.abs(dx)>Math.abs(dy))mv(dx>0?1:-1,0); else mv(0,dy>0?1:-1); },
  update:function(dt){ for(var i=pings.length-1;i>=0;i--){ pings[i].r+=9*dt; if(pings[i].r>12)pings.splice(i,1); } },
  draw:function(c){
    E.bg('#04050a');
    var OX=(800-W*CS)/2, OY=(600-H*CS)/2;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){
      var a=0;
      pings.forEach(function(p){ var d=E.dist(x,y,p.x,p.y);
        if(Math.abs(d-p.r)<1.3) a=Math.max(a,(1-p.r/12)*(1-Math.abs(d-p.r))); });
      if(E.dist(x,y,px,py)<1.6) a=Math.max(a,.5);
      if(a<=.02)continue;
      c.globalAlpha=E.cl(a,0,1);
      E.rr(OX+x*CS+2,OY+y*CS+2,CS-4,CS-4,4, m[y][x]?'#5b6bd4':'#141c30');
      if(x===gx&&y===gy) E.spr('🚪',OX+x*CS+CS/2,OY+y*CS+CS/2,26);
      c.globalAlpha=1; }
    E.o(OX+px*CS+CS/2,OY+py*CS+CS/2,9,'#9dff3d');
    var d2=Math.abs(gx-px)+Math.abs(gy-py);
    E.hudL('متاهة '+lvl+' · خطوات '+steps);
    E.hud('حرارة: '+(d2<4?'ساخن 🔥':d2<9?'دافئ':'بارد ❄️'), d2<4?'#ff9f3d':'#98a0b8');
    E.tx('مسافة/نقرة = نبضة صوتية',400,585,14,'#4a5480');
  }};
}});

G({id:'shadow-clone', t:'ظلال الماضي', c:'weird', e:'👤', tags:['ابتكار','تكرار'],
d:'كل جولة تُسجَّل. في الجولة التالية يظهر «أنتَ الماضي» كظلّ يعيد حركاتك — تعاون معه أو تفاداه.',
how:'الأسهم للحركة · اجمع كل المفاتيح',
make:function(E){
  var p,rec,ghosts,keys,t,round,doors;
  function gen(){ p={x:80,y:300}; rec=[]; t=0;
    keys=[]; for(var i=0;i<3;i++) keys.push({x:E.rnd(180,740),y:E.rnd(70,530),got:false});
    doors=[]; for(var j=0;j<round;j++) doors.push({x:E.rnd(220,700),y:E.rnd(60,500),w:22,h:E.rnd(70,150)}); }
  function reset(){ round=1; ghosts=[]; gen(); }
  reset();
  return {
  update:function(dt){
    t+=dt;
    var dx=E.kx(), dy=E.ky();
    if(E.m.down){ dx=E.cl((E.m.x-p.x)/50,-1,1); dy=E.cl((E.m.y-p.y)/50,-1,1); }
    p.x=E.cl(p.x+dx*250*dt,12,788); p.y=E.cl(p.y+dy*250*dt,12,588);
    if(rec.length<3000&&(rec.length===0||t-rec[rec.length-1].t>.04)) rec.push({x:p.x,y:p.y,t:t});
    doors.forEach(function(d){ if(p.x>d.x-10&&p.x<d.x+d.w+10&&p.y>d.y-10&&p.y<d.y+d.h+10){
      E.s('buzz'); E.shake(8); p.x=80; p.y=300; E.add(-30); } });
    keys.forEach(function(k){ if(!k.got&&E.dist(p.x,p.y,k.x,k.y)<24){ k.got=true; E.add(100); E.s('coin');
      E.burst(k.x,k.y,['#ffc93d'],14); } });
    ghosts.forEach(function(g){
      var i=0; while(i<g.length-1&&g[i].t<t)i++;
      g.cur=g[Math.min(i,g.length-1)];
      if(g.cur&&E.dist(p.x,p.y,g.cur.x,g.cur.y)<22){ E.add(-2); if(Math.random()<.05)E.s('tick'); } });
    if(keys.every(function(k){return k.got;})){
      E.add(300); E.s('win'); ghosts.push(rec.slice()); round++;
      if(round>5) return E.won('خمسة ظلال معك! 👥','رقصة زمنية'); gen(); }
    if(t>40) E.over('نفد وقت الجولة','الجولة '+round); },
  draw:function(c){
    E.bg('#0a0a14');
    doors.forEach(function(d){ E.rr(d.x,d.y,d.w,d.h,4,'#ff3d7f'); });
    ghosts.forEach(function(g,i){ if(!g.cur)return;
      E.alpha(.35,function(){ E.o(g.cur.x,g.cur.y,12,'hsl('+(200+i*40)+',70%,60%)'); }); });
    keys.forEach(function(k){ if(!k.got) E.spr('🔑',k.x,k.y,28); });
    E.o(p.x,p.y,13,'#9dff3d');
    E.hudL('الجولة '+round+' · ظلال '+ghosts.length); E.hud('⏱ '+Math.max(0,40-t).toFixed(0));
  }};
}});

G({id:'time-rewind', t:'زرّ إعادة اللف', c:'weird', e:'⏪', tags:['ابتكار','زمن'],
d:'ثلاث ثوانٍ من الماضي محفوظة دائماً. أخطأت؟ لُفّ الزمن للخلف واستمر.',
how:'الأسهم للحركة · اضغط مطوّلاً على مسافة للف الزمن',
make:function(E){
  var p,hist,coins,spikes,rw,fuel,t,got;
  function reset(){ p={x:100,y:300,vx:0,vy:0}; hist=[]; rw=false; fuel=3; t=0; got=0;
    coins=[]; for(var i=0;i<10;i++) coins.push({x:E.rnd(80,740),y:E.rnd(60,540),got:false});
    spikes=[]; for(var j=0;j<9;j++) spikes.push({x:E.rnd(120,700),y:E.rnd(60,540),
      vx:E.rnd(-130,130),vy:E.rnd(-130,130),r:16}); }
  reset();
  return {
  key:function(k,d){ if(k===' ')rw=d; },
  down:function(x,y){ if(x>620&&y>460)rw=true; },
  up:function(){ rw=false; },
  update:function(dt){
    if(rw&&fuel>0&&hist.length>2){
      fuel-=dt; var s=hist.pop();
      p.x=s.x; p.y=s.y;
      s.sp.forEach(function(v,i){ spikes[i].x=v.x; spikes[i].y=v.y; });
      s.co.forEach(function(v,i){ if(coins[i].got&&!v){ coins[i].got=false; got--; E.add(-40); } });
      if(Math.random()<.4)E.tone(1200-hist.length%400,.03,'sine',.04);
      return; }
    t+=dt;
    var dx=E.kx(), dy=E.ky();
    if(E.m.down&&E.m.x<620){ dx=E.cl((E.m.x-p.x)/50,-1,1); dy=E.cl((E.m.y-p.y)/50,-1,1); }
    p.x=E.cl(p.x+dx*270*dt,12,788); p.y=E.cl(p.y+dy*270*dt,12,588);
    spikes.forEach(function(s){ s.x+=s.vx*dt; s.y+=s.vy*dt;
      if(s.x<16||s.x>784)s.vx*=-1; if(s.y<16||s.y>584)s.vy*=-1; });
    hist.push({x:p.x,y:p.y,sp:spikes.map(function(s){return {x:s.x,y:s.y};}),
      co:coins.map(function(c2){return c2.got;})});
    if(hist.length>240)hist.shift();
    coins.forEach(function(c2){ if(!c2.got&&E.dist(p.x,p.y,c2.x,c2.y)<24){ c2.got=true; got++;
      E.add(120); E.s('coin'); } });
    for(var i=0;i<spikes.length;i++) if(E.dist(p.x,p.y,spikes[i].x,spikes[i].y)<spikes[i].r+10){
      E.shake(18); E.s('lose');
      if(fuel<=0) return E.over('لا وقود زمني','جمعت '+got+' عملة');
      fuel=Math.max(0,fuel-.8); p.x=100;p.y=300; }
    if(got>=10) E.won('جمعتها كلها! ⏪','سيّد الزمن'); },
  draw:function(c){
    E.bg(rw?'#141a30':'#0a0d18');
    if(rw) for(var i=0;i<12;i++) E.ln(0,i*50+(E.time*300)%50,800,i*50+(E.time*300)%50,'rgba(0,212,255,.05)',2);
    coins.forEach(function(c2){ if(!c2.got) E.spr('🪙',c2.x,c2.y,26); });
    spikes.forEach(function(s){ E.spr('⚡',s.x,s.y,30); });
    E.o(p.x,p.y,12,'#9dff3d');
    hist.slice(-40).forEach(function(h,i){ E.alpha(i/120,function(){ E.o(h.x,h.y,5,'#00d4ff'); }); });
    E.rr(620,460,160,60,14, fuel>0?(rw?'#00d4ff':'#2b3350'):'#3a2030');
    E.tx('⏪ لفّ الزمن',700,480,17,'#dfe6ff'); 
    E.rr(632,498,136,10,5,'#1c2338'); E.rr(633,499,134*(fuel/3),8,4,'#00d4ff');
    E.hudL('عملات '+got+'/10'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'word-gravity', t:'جاذبية الكلمات', c:'weird', e:'🔤', tags:['كلمات','ابتكار'],
d:'حروف عربية تسقط. رتّبها في القاع لتكوّن كلمة حقيقية فتنفجر وتمنحك نقاطاً.',
how:'← → لتحريك الحرف · ↓ للإسقاط',
make:function(E){
  var W=9,cols,cur,t,step,words;
  var LET='ابتثجحدذرزسشصضطعفقكلمنهوي'.split('');
  var DICT=['باب','بيت','قلم','كتاب','شمس','قمر','نار','ماء','سلام','كلب','قط','ورد','بحر','جبل','نجم',
    'علم','عين','يد','رجل','باص','دار','نور','خبز','سمك','حب','امل','قلب','عقل','طير','زهر','صبر','شكر'];
  function reset(){ cols=[]; for(var i=0;i<W;i++)cols.push([]);
    t=0; step=.9; words=0; spawn(); }
  function spawn(){ cur={c:E.ri(0,W-1), l:E.pick(LET), y:0}; }
  reset();
  function drop(){
    var col=cols[cur.c];
    if(col.length>=8) return E.over('امتلأ العمود','كوّنت '+words+' كلمة');
    col.push(cur.l); E.s('thud'); check(); spawn(); }
  function check(){
    for(var i=0;i<W;i++){ var col=cols[i];
      for(var len=5;len>=2;len--){ if(col.length<len)continue;
        var w=col.slice(col.length-len).join('');
        var rev=w.split('').reverse().join('');
        if(DICT.indexOf(w)>=0||DICT.indexOf(rev)>=0){
          col.splice(col.length-len,len); words++;
          E.add(len*len*25); E.s('power'); E.burst(60+i*82,500-len*20,['#9dff3d','#ffc93d'],20);
          if(words>=10) E.won('عشر كلمات! 🔤','لغوي بارع'); return; } } }
    // أفقي
    for(var r=0;r<8;r++){ var row='';
      for(var j=0;j<W;j++) row+= cols[j][r]||' ';
      DICT.forEach(function(d){ var idx=row.indexOf(d);
        if(d.length>=3&&idx>=0){ for(var k=0;k<d.length;k++) cols[idx+k].splice(r,1);
          words++; E.add(d.length*d.length*30); E.s('power'); } }); } }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')cur.c=(cur.c+W-1)%W;
    if(k==='ArrowRight')cur.c=(cur.c+1)%W;
    if(k==='ArrowDown'||k===' ')drop(); },
  down:function(x,y){ if(y>430)drop(); else cur.c=E.cl(Math.floor((x-20)/82),0,W-1); },
  update:function(dt){ t+=dt; if(t>step){ t=0; drop(); } },
  draw:function(c){
    E.bg('#0b1018');
    for(var i=0;i<W;i++){ E.r(20+i*82,80,78,470,'rgba(255,255,255,.03)');
      cols[i].forEach(function(l,j){ E.rr(22+i*82,520-j*54,74,50,8,'#3a4270');
        E.tx(l,59+i*82,545-j*54,32,'#e8ecff'); }); }
    E.rr(22+cur.c*82,26,74,50,8,'#ffc93d'); E.tx(cur.l,59+cur.c*82,51,32,'#0b0d14');
    E.hudL('كلمات '+words+'/10'); E.hud('النتيجة '+E.score);
    E.tx('كوّن كلمات عربية عمودياً أو أفقياً',400,580,15,'#6d7590');
  }};
}});

G({id:'stroop', t:'الكلمة تكذب', c:'weird', e:'🌈', tags:['دماغ','ألوان'],
d:'اضغط على لون الحبر لا على معنى الكلمة. دماغك سيقاومك بشدّة.',
how:'اختر لون الحبر من الأسفل', noPad:true,
make:function(E){
  var NAMES=['أحمر','أخضر','أزرق','أصفر'], COLS=['#ff3d5f','#3ddc84','#3d8cff','#ffc93d'];
  var word,ink,t,round,streak;
  function gen(){ word=E.ri(0,3); do{ ink=E.ri(0,3); }while(ink===word&&Math.random()<.75);
    t=Math.max(.9,2.4-round*.09); }
  function reset(){ round=1; streak=0; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y<430)return; var i=Math.floor((x-60)/180);
    if(i<0||i>3)return;
    if(i===ink){ streak++; E.add(50+streak*10); E.s('coin'); round++;
      if(round>25) return E.won('دماغ مقاوم! 🌈','٢٥ جولة'); gen(); }
    else { streak=0; E.add(-60); E.s('buzz'); E.shake(10);
      if(E.score<-100) return E.over('خدعتك الكلمات','الجولة '+round); gen(); } },
  update:function(dt){ t-=dt; if(t<=0){ streak=0; E.add(-40); E.s('buzz'); gen();
    if(E.score<-100) E.over('بطيء جداً','الجولة '+round); } },
  draw:function(c){
    E.bg('#0d1018');
    E.tx('اضغط على لون الحبر — لا الكلمة',400,70,20,'#98a0b8');
    E.tx(NAMES[word],400,250,86,COLS[ink]);
    for(var i=0;i<4;i++){ E.rr(60+i*180,440,160,90,18,COLS[i]);
      E.tx(NAMES[i],140+i*180,485,22,'#0b0d14'); }
    E.rr(200,390,400,12,6,'#1c2338'); E.rr(202,392,396*E.cl(t/2.4,0,1),8,4,'#7c5cff');
    E.hudL('جولة '+round+' · تتابع '+streak); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'sound-shape', t:'الشكل الصوتي', c:'weird', e:'📡', tags:['سمع','ابتكار'],
d:'كل شكل له لحن. استمع ثم اختر الشكل الذي يطابق ما سمعت — بلا أي دليل بصري.',
how:'استمع ثم انقر الشكل الصحيح', noPad:true,
make:function(E){
  var SH=[[3,'مثلث'],[4,'مربع'],[5,'خماسي'],[6,'سداسي'],[8,'ثماني']];
  var target,opts,round,playing,pi,pt,revealed;
  function gen(){ target=E.ri(0,SH.length-1);
    opts=[target]; while(opts.length<4){ var r=E.ri(0,SH.length-1); if(opts.indexOf(r)<0)opts.push(r); }
    opts.sort(function(){return Math.random()-.5;});
    playing=true; pi=0; pt=0; revealed=false; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y>500&&x>320&&x<480){ playing=true; pi=0; pt=0; return; }
    if(playing||revealed)return;
    var i=Math.floor((x-70)/175); if(i<0||i>3||y<180||y>420)return;
    if(opts[i]===target){ E.add(150); E.s('win'); round++;
      if(round>8) return E.won('أذن هندسية! 📡','ثماني جولات'); gen(); }
    else { E.add(-60); E.s('buzz'); E.shake(10); revealed=true;
      setTimeout(function(){ if(round>3&&E.score<0)E.over('فقدت الإيقاع','الجولة '+round); else gen(); },900); } },
  update:function(dt){
    if(!playing)return;
    pt-=dt;
    if(pt<=0){ var n=SH[target][0];
      if(pi<n){ E.tone(220*Math.pow(1.26,pi%n)+n*30,.18,'triangle',.14); pi++; pt=.26; }
      else { playing=false; } } },
  draw:function(c){
    E.bg('#0b0f1c');
    E.tx(playing?'استمع… 👂':'أي شكل سمعت؟',400,90,30, playing?'#ffc93d':'#9dff3d');
    if(playing){ E.o(400,250,60+Math.sin(E.time*12)*10,'rgba(255,201,61,.18)'); E.spr('🔊',400,250,64); }
    else opts.forEach(function(o,i){
      var cx=150+i*175, cy=300, n=SH[o][0], pts=[];
      for(var k=0;k<n;k++) pts.push([cx+Math.cos(k/n*6.283-1.57)*54, cy+Math.sin(k/n*6.283-1.57)*54]);
      E.poly(pts, revealed&&o===target?'#9dff3d':'#3a4270');
      E.tx(SH[o][1],cx,cy+82,16,'#98a0b8'); });
    E.rr(320,500,160,52,12,'#2b3350'); E.tx('🔁 أعد',400,526,20,'#dfe6ff');
    E.hudL('جولة '+round+'/8'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'quantum-cat', t:'القط الكمّي', c:'weird', e:'🐈', tags:['ابتكار','احتمال'],
d:'القط في كل الصناديق حتى تفتح واحداً. كل ملاحظة تُغيّر الاحتمالات — فكّر ككمّي.',
how:'انقر صندوقاً لتقيسه · «قِس» يعطي تلميحاً', noPad:true,
make:function(E){
  var N,probs,realIdx,round,tries,hintUsed,msg,mt;
  function gen(){ N=4+Math.min(4,round);
    probs=[]; for(var i=0;i<N;i++)probs.push(1/N);
    realIdx=E.ri(0,N-1); tries=3; hintUsed=false; msg=''; mt=0; }
  function reset(){ round=1; gen(); }
  reset();
  function collapse(){ // القط يقفز بين الصناديق حسب الاحتمالات
    var r=Math.random(),acc=0;
    for(var i=0;i<N;i++){ acc+=probs[i]; if(r<=acc){ realIdx=i; return; } }
    realIdx=N-1; }
  return {
  down:function(x,y){
    if(y>500&&x>300&&x<500){ hint(); return; }
    var S=110, OX=(800-N*S)/2;
    var i=Math.floor((x-OX)/S);
    if(i<0||i>=N||y<210||y>380)return;
    if(i===realIdx){ E.add(200+round*50); E.s('win'); round++;
      if(round>6) return E.won('أمسكت القط الكمّي! 🐈','ست تجارب'); gen(); }
    else { tries--; E.s('buzz'); E.shake(8); E.add(-40);
      probs[i]=0; var s=probs.reduce(function(a,b){return a+b;},0);
      probs=probs.map(function(p){ return s? p/s : 1/N; });
      collapse();
      msg='لم يكن هنا… القط انتقل!'; mt=1.6;
      if(tries<=0) return E.over('انهارت الدالة الموجية','الجولة '+round); } },
  update:function(dt){ if(mt>0)mt-=dt; },
  draw:function(c){
    E.bg('#0b0a18');
    E.tx('الجولة '+round+' — محاولات: '+tries,400,60,26,'#dfe6ff');
    var S=110, OX=(800-N*S)/2;
    for(var i=0;i<N;i++){ var x=OX+i*S;
      E.rr(x+6,210,S-12,170,14,'#2b3350');
      E.spr('📦',x+S/2,280,58);
      E.alpha(.25+probs[i]*1.6,function(){ E.spr('🐈',x+S/2,285,40); });
      E.tx((probs[i]*100).toFixed(0)+'%',x+S/2,355,17,'#7c5cff'); }
    E.rr(300,500,200,52,12, hintUsed?'#3a4270':'#7c5cff');
    E.tx(hintUsed?'استُهلك القياس':'📡 قياس ضعيف',400,526,18,'#fff');
    if(mt>0) E.tx(msg,400,440,24,'#ff9f3d');
    E.hud('النتيجة '+E.score);
  }};
  function hint(){ if(hintUsed)return; hintUsed=true; E.add(-30); E.s('blip');
    var half = realIdx < N/2 ? 'النصف الأيمن' : 'النصف الأيسر';
    msg='القياس يقول: القط في '+half; mt=3; }
}});

G({id:'breathe', t:'لعبة التنفّس', c:'weird', e:'🫁', tags:['هدوء','إيقاع'],
d:'اللعبة الوحيدة التي تفوز فيها بالهدوء: اضغط للشهيق وأفلت للزفير بإيقاع الدائرة.',
how:'اضغط مطوّلاً مع اتساع الدائرة · أفلت مع انكماشها',
make:function(E){
  var ph,t,held,score2,cycles,acc;
  function reset(){ ph=0; t=0; cycles=0; acc=0; held=false; }
  reset();
  return {
  down:function(){ held=true; }, up:function(){ held=false; },
  key:function(k,d){ if(k===' ')held=d; },
  update:function(dt){
    t+=dt; var cyc=8; ph=(t%cyc)/cyc;
    var wantIn = ph<.45;
    var ok = (wantIn===held);
    if(ok){ acc+=dt; E.add(Math.round(22*dt)); }
    else acc=Math.max(0,acc-dt*1.4);
    if(t>0&&Math.floor(t/cyc)>cycles){ cycles=Math.floor(t/cyc); E.s('pop'); E.add(60);
      if(cycles>=6) E.won('ستّ دورات هادئة 🫁','خفض معدّل نبضك'); } },
  draw:function(c){
    var wantIn=ph<.45, sz = wantIn ? 60+ (ph/.45)*150 : 210-((ph-.45)/.55)*150;
    var ok=(wantIn===held);
    E.sky(ok?'#0d2438':'#2a1020','#050810');
    E.o(400,290,sz+30,'rgba(0,212,255,.06)');
    E.o(400,290,sz,ok?'rgba(0,212,255,.28)':'rgba(255,61,127,.25)');
    E.ring(400,290,sz,ok?'#00d4ff':'#ff3d7f',3);
    E.tx(wantIn?'شهيق… اضغط':'زفير… أفلت',400,290,30,'#e8ecff');
    E.tx('دورة '+cycles+'/6',400,500,24,'#98a0b8');
    E.rr(250,540,300,14,7,'#1c2338'); E.rr(252,542,296*E.cl(acc/40,0,1),10,5,'#9dff3d');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'anti-snake', t:'الأفعى العكسية', c:'weird', e:'🪱', tags:['عكس','ابتكار'],
d:'كل شيء معكوس: الطعام يقتلك، والجوع يطيل عمرك. تجنّب الأكل وابقَ حيّاً.',
how:'الأسهم · تجنّب التفاح واجمع الفراغ',
make:function(E){
  var CS=40,CW=20,CH=15,s,dir,nd,apples,t,step,hunger,zone;
  function reset(){ s=[{x:10,y:7},{x:9,y:7},{x:8,y:7},{x:7,y:7},{x:6,y:7},{x:5,y:7},{x:4,y:7},{x:3,y:7}];
    dir={x:1,y:0}; nd={x:1,y:0}; t=0; step=.15; hunger=100;
    apples=[]; for(var i=0;i<8;i++) place(); zone=newZone(); }
  function place(){ apples.push({x:E.ri(0,CW-1),y:E.ri(0,CH-1)}); }
  function newZone(){ return {x:E.ri(1,CW-2),y:E.ri(1,CH-2)}; }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    var o={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
    if(o&&(dir.x!==-o[0]||dir.y!==-o[1])) nd={x:o[0],y:o[1]}; },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    this.key(Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'),true); },
  update:function(dt){
    hunger-=dt*3.5; E.add(Math.round(14*dt));
    if(hunger<=0) return E.over('تضوّرت جوعاً حتى الاختفاء','لكن هذا كان الهدف… تقريباً');
    t+=dt; if(t<step)return; t=0; dir=nd;
    var h={x:(s[0].x+dir.x+CW)%CW, y:(s[0].y+dir.y+CH)%CH};
    if(s.some(function(c2){return c2.x===h.x&&c2.y===h.y;})) return E.over('التففت على نفسك','النتيجة '+E.score);
    s.unshift(h); s.pop();
    for(var i=apples.length-1;i>=0;i--) if(apples[i].x===h.x&&apples[i].y===h.y){
      apples.splice(i,1); place();
      s.push({x:s[s.length-1].x,y:s[s.length-1].y}); s.push({x:s[s.length-1].x,y:s[s.length-1].y});
      E.add(-120); E.s('buzz'); E.shake(10);
      if(s.length>26) return E.over('صرت طويلاً جداً 🪱','الطول هو الخسارة هنا'); }
    if(h.x===zone.x&&h.y===zone.y){ hunger=Math.min(100,hunger+34); E.add(150); E.s('coin');
      E.burst(h.x*CS+20,h.y*CS+20,['#00d4ff'],14); zone=newZone();
      if(s.length>3){ s.pop(); } } },
  draw:function(c){
    E.bg('#0a1014'); E.grid(CS,'rgba(255,255,255,.03)');
    apples.forEach(function(a){ E.spr('🍎',a.x*CS+20,a.y*CS+20,28); });
    E.ring(zone.x*CS+20,zone.y*CS+20,15,'#00d4ff',3); E.spr('💨',zone.x*CS+20,zone.y*CS+20,22);
    s.forEach(function(p,i){ E.rr(p.x*CS+4,p.y*CS+4,CS-8,CS-8,8, i?'#4a5480':'#9dff3d'); });
    E.rr(20,560,220,18,8,'#1c2338'); E.rr(22,562,216*(hunger/100),14,6, hunger<30?'#ff3d7f':'#ffc93d');
    E.tx('جوع',130,569,12,'#0b0d14');
    E.hud('النتيجة '+E.score); E.hudL('الطول '+s.length+' (الأقصر أفضل)');
  }};
}});

G({id:'un-tetris', t:'تتريس عكسي', c:'weird', e:'🧱', tags:['عكس','توازن'],
d:'اللوح ممتلئ من البداية. اسحب القطع للخارج دون أن ينهار البرج على الأرض.',
how:'انقر قطعة لإزالتها', noPad:true,
make:function(E){
  var W=10,H=12,b,removed,lvl;
  function gen(){ b=[]; for(var y=0;y<H;y++){ b.push([]); for(var x=0;x<W;x++)
      b[y].push(y> H-4-lvl ? E.ri(1,5) : (Math.random()<.55?E.ri(1,5):0)); }
    removed=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  var COL=['','#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#7c5cff'];
  function supported(){
    // كل قطعة يجب أن تتصل بالأرض عبر جيرانها
    var seen=[]; for(var i=0;i<H;i++){ seen.push([]); for(var j=0;j<W;j++)seen[i].push(false); }
    var st=[];
    for(var x=0;x<W;x++) if(b[H-1][x]){ st.push([x,H-1]); seen[H-1][x]=true; }
    while(st.length){ var p=st.pop();
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ var nx=p[0]+d[0], ny=p[1]+d[1];
        if(nx<0||ny<0||nx>=W||ny>=H||seen[ny][nx]||!b[ny][nx])return;
        seen[ny][nx]=true; st.push([nx,ny]); }); }
    var lost=0;
    for(var y=0;y<H;y++)for(var x2=0;x2<W;x2++) if(b[y][x2]&&!seen[y][x2])lost++;
    return lost; }
  return {
  down:function(mx,my){
    var S=44,OX=(800-W*S)/2,OY=60;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=W||y>=H||!b[y][x])return;
    var old=b[y][x]; b[y][x]=0;
    var lost=supported();
    if(lost>0){ b[y][x]=old; E.s('buzz'); E.shake(10); E.add(-40);
      E.tx('',0,0,0);
      return; }
    removed++; E.add(30); E.s('pop'); E.burst(OX+x*S+S/2,OY+y*S+S/2,[COL[old]],8);
    var left=0; b.forEach(function(r){ r.forEach(function(v){ if(v)left++; }); });
    if(left<=W*2){ E.add(300); E.s('win'); lvl++;
      if(lvl>5) return E.won('هدّام محترف! 🧱','خمسة أبراج'); gen(); } },
  draw:function(c){
    E.bg('#0c101a');
    var S=44,OX=(800-W*S)/2,OY=60;
    E.r(OX,OY+H*S,W*S,8,'#5b6488');
    for(var y=0;y<H;y++)for(var x=0;x<W;x++) if(b[y][x])
      E.rr(OX+x*S+1,OY+y*S+1,S-2,S-2,5,COL[b[y][x]]);
    var left=0; b.forEach(function(r){ r.forEach(function(v){ if(v)left++; }); });
    E.hudL('برج '+lvl+' · أزلت '+removed); E.hud('متبقٍ '+left);
    E.tx('لا تُسقط أي قطعة معلّقة',400,580,15,'#6d7590');
  }};
}});

G({id:'emotion-mix', t:'خالط المشاعر', c:'weird', e:'🎭', tags:['ابتكار','تركيب'],
d:'اخلط ثلاث مشاعر بنِسَب صحيحة لتصنع الشعور المطلوب. علم نفس… بالمقادير.',
how:'اسحب المزالق ثم اضغط «اخلط»', noPad:true,
make:function(E){
  var v,target,round,drag,res,rt;
  var NAMES=['فرح','غضب','خوف'];
  var RECIPES=[['حماس',[70,25,5]],['قلق',[10,20,70]],['غيرة',[15,55,30]],['شجاعة',[45,40,15]],
    ['حنين',[55,10,35]],['إحراج',[30,15,55]],['تحدٍّ',[25,60,15]],['رضا',[80,5,15]]];
  function gen(){ target=E.pick(RECIPES); v=[33,33,34]; res=''; rt=0; }
  function reset(){ round=1; gen(); drag=-1; }
  reset();
  return {
  down:function(x,y){ for(var i=0;i<3;i++){ var yy=200+i*90;
      if(y>yy-30&&y<yy+30&&x>120&&x<680){ drag=i; setV(i,x); return; } }
    if(y>470&&x>320&&x<480) mix(); },
  move:function(x,y){ if(drag>=0)setV(drag,x); },
  up:function(){ drag=-1; },
  update:function(dt){ if(rt>0)rt-=dt; },
  draw:function(c){
    E.bg('#120e20');
    E.tx('اصنع شعور: '+target[0],400,80,32,'#ffc93d');
    for(var i=0;i<3;i++){ var y=200+i*90;
      E.rr(120,y-9,560,18,9,'#1e2540');
      E.rr(120,y-9,560*(v[i]/100),18,9,['#9dff3d','#ff3d7f','#7c5cff'][i]);
      E.o(120+560*(v[i]/100),y,16,'#e8ecff');
      E.tx(NAMES[i]+' '+v[i].toFixed(0)+'%',60,y,18,'#98a0b8','center'); }
    E.rr(320,470,160,54,14,'#2fbd6f'); E.tx('اخلط',400,497,22,'#062012');
    if(rt>0) E.tx(res,400,556,24, res.indexOf('نجح')>=0?'#9dff3d':'#ff9f3d');
    E.hudL('جولة '+round+'/6'); E.hud('النتيجة '+E.score);
  }};
  function setV(i,x){ var nv=E.cl((x-120)/560*100,0,100);
    var other=(100-nv)/2;
    v[i]=nv; v[(i+1)%3]=other; v[(i+2)%3]=other; }
  function mix(){
    var d=0; for(var i=0;i<3;i++) d+=Math.abs(v[i]-target[1][i]);
    if(d<26){ E.add(200-Math.round(d*4)); E.s('win'); res='نجح المزيج! 🎭'; rt=2; round++;
      if(round>6) return E.won('كيميائي مشاعر! 🎭','ست وصفات'); setTimeout(gen,700); }
    else { E.add(-40); E.s('buzz'); res= d<60?'قريب… عدّل قليلاً':'بعيد جداً عن الوصفة'; rt=2; } }
}});

G({id:'gravity-flip', t:'قلب الجاذبية', c:'weird', e:'🔃', tags:['ابتكار','ركض'],
d:'اضغط لتقلب الجاذبية بدل أن تقفز. الأرضية والسقف كلاهما أرض.',
how:'انقر أو مسافة لقلب الجاذبية',
make:function(E){
  var p,obs,coins,sp,scroll,g;
  function reset(){ p={y:520,vy:0}; g=1; obs=[]; coins=[]; sp=300; scroll=0;
    for(var i=0;i<7;i++) obs.push({x:600+i*E.rnd(220,330), top:Math.random()<.5, h:E.rnd(70,180)});
    for(var j=0;j<9;j++) coins.push({x:700+j*E.rnd(180,280), y:E.rnd(120,480), got:false}); }
  reset();
  function flip(){ g*=-1; E.s('power'); E.burst(160,p.y,['#7c5cff'],10); }
  return {
  down:flip, key:function(k,d){ if(d&&(k===' '||k==='ArrowUp'))flip(); },
  update:function(dt){
    sp=300+scroll*.02; scroll+=sp*dt; E.setScore(Math.floor(scroll/15));
    p.vy+=1500*g*dt; p.y+=p.vy*dt;
    if(p.y>520){p.y=520;p.vy=0;} if(p.y<80){p.y=80;p.vy=0;}
    obs.forEach(function(o){ o.x-=sp*dt;
      if(o.x<-70){ o.x+=7*270+E.rnd(0,180); o.top=Math.random()<.5; o.h=E.rnd(70,190); }
      var y0=o.top?60:600-o.h, y1=o.top?60+o.h:600;
      if(o.x<184&&o.x+46>136&&p.y>y0-18&&p.y<y1+18){ E.shake(22); E.burst(160,p.y,['#ff3d7f'],20);
        E.over('اصطدمت','قطعت '+E.score+' متراً'); } });
    coins.forEach(function(c2){ c2.x-=sp*dt;
      if(c2.x<-40){ c2.x+=9*230+E.rnd(0,200); c2.y=E.rnd(110,490); c2.got=false; }
      if(!c2.got&&Math.abs(c2.x-160)<26&&Math.abs(c2.y-p.y)<26){ c2.got=true; E.add(50); E.s('coin'); } }); },
  draw:function(c){
    E.sky(g>0?'#141b3a':'#2a1430','#07070f');
    E.r(0,540,800,60,'#2b3350'); E.r(0,0,800,60,'#2b3350');
    obs.forEach(function(o){ if(o.x<-80||o.x>860)return;
      E.rr(o.x,o.top?60:600-o.h,46,o.h,5,'#ff3d7f'); });
    coins.forEach(function(c2){ if(!c2.got&&c2.x>-40&&c2.x<840) E.spr('🪙',c2.x,c2.y,24); });
    E.rr(142,p.y-18,36,36,8,'#00d4ff');
    E.spr(g>0?'⬇️':'⬆️',160,p.y-40,18);
    E.hud(E.score+' م'); E.hudL('الجاذبية '+(g>0?'للأسفل':'للأعلى'));
  }};
}});

G({id:'paradox-loop', t:'حلقة المفارقة', c:'weird', e:'♾️', tags:['ابتكار','زمن'],
d:'كل ٨ ثوانٍ يعود الزمن للبداية، وتظهر نسخة منك تعيد ما فعلته. تعاون مع نفسك لفتح البوابات.',
how:'الأسهم · قف على الأزرار لفتح البوابات',
make:function(E){
  var p,recs,cur,t,loop,btns,gates,goal,done;
  function gen(){ btns=[]; gates=[];
    for(var i=0;i<2+Math.min(2,loop);i++){
      btns.push({x:E.rnd(80,720),y:E.rnd(70,530),on:false});
      gates.push({x:E.rnd(200,650),y:E.rnd(60,440),w:24,h:E.rnd(80,160)}); }
    goal={x:730,y:E.rnd(80,520)}; }
  function reset(){ recs=[]; loop=0; t=0; cur=[]; p={x:60,y:300}; done=false; gen(); }
  reset();
  return {
  update:function(dt){
    if(done)return;
    t+=dt;
    if(t>8){ recs.push(cur); cur=[]; t=0; loop++; p={x:60,y:300}; E.s('alarm');
      if(recs.length>5){ return E.over('ضاعت في الحلقة','٦ حلقات دون خروج'); } }
    var dx=E.kx(), dy=E.ky();
    if(E.m.down){ dx=E.cl((E.m.x-p.x)/50,-1,1); dy=E.cl((E.m.y-p.y)/50,-1,1); }
    p.x=E.cl(p.x+dx*250*dt,12,788); p.y=E.cl(p.y+dy*250*dt,12,588);
    if(cur.length===0||t-cur[cur.length-1].t>.05) cur.push({x:p.x,y:p.y,t:t});
    var actors=[{x:p.x,y:p.y}];
    recs.forEach(function(r){ var i=0; while(i<r.length-1&&r[i].t<t)i++;
      r.cur=r[Math.min(i,r.length-1)]; if(r.cur)actors.push(r.cur); });
    btns.forEach(function(b,i){ b.on=actors.some(function(a){ return E.dist(a.x,a.y,b.x,b.y)<26; }); });
    gates.forEach(function(g,i){ g.open=btns[i]&&btns[i].on; });
    var blocked=gates.some(function(g){ return !g.open && p.x>g.x-10&&p.x<g.x+g.w+10&&p.y>g.y-10&&p.y<g.y+g.h+10; });
    if(blocked){ p.x-=dx*250*dt*1.4; p.y-=dy*250*dt*1.4; }
    if(E.dist(p.x,p.y,goal.x,goal.y)<26&&gates.every(function(g){return g.open;})){
      E.add(400); E.s('win'); done=true;
      E.won('خرجت من الحلقة! ♾️','بمساعدة '+recs.length+' نسخة منك'); } },
  draw:function(c){
    E.bg('#0a0b18');
    gates.forEach(function(g){ E.alpha(g.open?.2:1,function(){ E.rr(g.x,g.y,g.w,g.h,5,'#ff3d7f'); }); });
    btns.forEach(function(b){ E.ring(b.x,b.y,22, b.on?'#9dff3d':'#5b6488',3);
      E.o(b.x,b.y,12, b.on?'#9dff3d':'#2b3350'); });
    E.spr('🚪',goal.x,goal.y,36);
    recs.forEach(function(r,i){ if(!r.cur)return;
      E.alpha(.4,function(){ E.o(r.cur.x,r.cur.y,12,'hsl('+(180+i*35)+',70%,60%)'); }); });
    E.o(p.x,p.y,13,'#ffc93d');
    E.rr(250,560,300,14,7,'#1c2338'); E.rr(252,562,296*(t/8),10,5,'#7c5cff');
    E.hudL('حلقة '+(loop+1)+' · نسخ '+recs.length); E.hud('⏱ '+(8-t).toFixed(1));
  }};
}});
