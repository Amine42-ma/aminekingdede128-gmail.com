/* ============ 8) كلمات وأرقام وموسيقى وحظّ ============ */

G({id:'type-race', t:'سباق الكتابة', c:'words', e:'⌨️', tags:['كلمات','سرعة'],
d:'اكتب الكلمات العربية قبل أن تصل إلى الحافة. سرعتك هي سلاحك الوحيد.',
how:'اكتب بلوحة المفاتيح', noPad:true,
make:function(E){
  var WORDS=['شمس','قمر','كتاب','مدرسة','سيارة','بحر','جبل','سماء','نجمة','قلم','باب','نافذة','حديقة',
    'طائر','سمكة','وردة','قهوة','خبز','ماء','صديق','عائلة','مدينة','طريق','جسر','مطر','ثلج','ريح',
    'صباح','مساء','ليل','نهار','فرح','أمل','حلم','سلام','قوة','عقل','قلب','يد','عين'];
  var ws,typed,t,lives,speed,done;
  function reset(){ ws=[]; typed=''; t=0; lives=3; speed=26; done=0; }
  reset();
  return {
  key:function(k,d){
    if(!d)return;
    if(k==='Backspace'){ typed=typed.slice(0,-1); return; }
    if(k.length!==1)return;
    typed+=k;
    for(var i=0;i<ws.length;i++) if(ws[i].w===typed){
      E.add(ws[i].w.length*25); done++; E.s('coin'); E.burst(ws[i].x,ws[i].y,['#9dff3d'],14);
      ws.splice(i,1); typed=''; return; }
    if(!ws.some(function(w){ return w.w.indexOf(typed)===0; })){ typed=''; E.s('tick'); } },
  update:function(dt){
    t+=dt; speed=26+t*1.1;
    if(Math.random()<dt*(.9+t*.02)&&ws.length<8)
      ws.push({w:E.pick(WORDS), x:820, y:E.rnd(80,480)});
    for(var i=ws.length-1;i>=0;i--){ ws[i].x-=speed*dt;
      if(ws[i].x<20){ ws.splice(i,1); lives--; E.s('buzz'); E.shake(10);
        if(lives<=0) return E.over('فاتتك الكلمات','كتبت '+done+' كلمة'); } } },
  draw:function(c){
    E.bg('#0b0f1a');
    E.r(0,0,26,600,'rgba(255,61,127,.18)');
    ws.forEach(function(w){
      var m = w.w.indexOf(typed)===0 && typed ? typed.length : 0;
      E.tx(w.w, w.x, w.y, 30, m?'#4a5480':'#e8ecff','right');
      if(m){ var c2=E.c; c2.font='700 30px "Noto Sans Arabic",Tahoma,sans-serif'; c2.textAlign='right';
        var full=c2.measureText(w.w).width, rest=c2.measureText(w.w.slice(m)).width;
        E.tx(w.w.slice(0,m), w.x-rest, w.y, 30, '#9dff3d','right'); } });
    E.rr(150,530,500,50,12,'#1c2338');
    E.tx(typed||'اكتب هنا…',400,556,26, typed?'#ffc93d':'#4a5480');
    E.hudL('❤️'.repeat(Math.max(0,lives))+' · كلمات '+done); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'hangman', t:'الرجل المشنوق', c:'words', e:'🪢', tags:['كلمات','تخمين'],
d:'خمّن الكلمة العربية حرفاً حرفاً. ستة أخطاء وينتهي كل شيء.',
how:'انقر الحروف', noPad:true,
make:function(E){
  var LIST=[['قطار','وسيلة نقل على قضبان'],['مكتبة','مكان الكتب'],['بستان','حديقة أشجار'],
    ['غيمة','في السماء وتمطر'],['نافذة','فتحة في الجدار'],['ساعة','تخبرك بالوقت'],
    ['بحيرة','ماء محاط باليابسة'],['فراشة','حشرة ملوّنة تطير'],['جسر','يربط ضفتين'],
    ['مفتاح','يفتح الأبواب'],['حصان','حيوان يُركب'],['عسل','ينتجه النحل'],['شتاء','فصل البرد'],
    ['قصيدة','نص شعري'],['بوصلة','تدلّك على الاتجاه']];
  var word,hint,guessed,wrong,round;
  var AB='ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
  function gen(){ var w=E.pick(LIST); word=w[0]; hint=w[1]; guessed=[]; wrong=0; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y<400)return;
    var cols=14, S=54, OX=(800-cols*S)/2;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-410)/58);
    var i=cy*cols+cx;
    if(cx<0||cx>=cols||i<0||i>=AB.length)return;
    var L=AB[i]; if(guessed.indexOf(L)>=0)return;
    guessed.push(L);
    if(word.indexOf(L)>=0){ E.add(40); E.s('coin');
      if(word.split('').every(function(ch){ return guessed.indexOf(ch)>=0 || ch==='ء'||ch==='آ'||ch==='أ'||ch==='إ'; })){
        E.add(200); E.s('win'); round++;
        if(round>5) return E.won('لغوي بارع! 🪢','خمس كلمات'); gen(); } }
    else { wrong++; E.add(-20); E.s('buzz');
      if(wrong>=6) E.over('شُنق الرجل — الكلمة: '+word,'وصلت للكلمة '+round); } },
  draw:function(c){
    E.bg('#0e1220');
    E.ln(120,340,240,340,'#8a6a3a',6); E.ln(160,340,160,90,'#8a6a3a',6);
    E.ln(160,90,250,90,'#8a6a3a',6); E.ln(250,90,250,130,'#8a6a3a',3);
    if(wrong>0)E.o(250,148,18,'#e8ecff');
    if(wrong>1)E.ln(250,166,250,230,'#e8ecff',4);
    if(wrong>2)E.ln(250,180,220,215,'#e8ecff',4);
    if(wrong>3)E.ln(250,180,280,215,'#e8ecff',4);
    if(wrong>4)E.ln(250,230,222,275,'#e8ecff',4);
    if(wrong>5)E.ln(250,230,278,275,'#e8ecff',4);
    E.tx('تلميح: '+hint,570,140,20,'#98a0b8');
    var shown=word.split('').map(function(ch){ return guessed.indexOf(ch)>=0?ch:'_'; }).join(' ');
    E.tx(shown,570,220,44,'#ffc93d');
    var cols=14, S=54, OX=(800-cols*S)/2;
    AB.forEach(function(L,i){ var x=OX+(i%cols)*S, y=410+Math.floor(i/cols)*58;
      var used=guessed.indexOf(L)>=0, good=used&&word.indexOf(L)>=0;
      E.rr(x+3,y+3,S-6,52,8, good?'#2f7a4d':used?'#3a2030':'#2b3350');
      E.tx(L,x+S/2,y+29,24, used?'#8a93b5':'#e8ecff'); });
    E.hudL('كلمة '+round+'/5 · أخطاء '+wrong+'/6'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'scramble', t:'رتّب الحروف', c:'words', e:'🔡', tags:['كلمات','ترتيب'],
d:'حروف مبعثرة وكلمة مخبّأة. رتّبها قبل نفاد الوقت.',
how:'انقر الحروف بالترتيب الصحيح', noPad:true,
make:function(E){
  var LIST=['مدرسة','طائرة','حديقة','مصباح','برتقال','فراشة','مكتبة','ساعة','قمر','شمس','كتاب','نافذة','بحر','جبل','مطر'];
  var word,letters,picked,t,round;
  function gen(){ word=E.pick(LIST);
    letters=word.split('').map(function(l,i){ return {l:l,i:i,used:false}; });
    letters.sort(function(){return Math.random()-.5;});
    picked=[]; t=Math.max(10,26-round*2); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y>380&&y<470){ var i=Math.floor((x-(400-letters.length*36))/72);
      if(i<0||i>=letters.length||letters[i].used)return;
      letters[i].used=true; picked.push(i); E.s('tick');
      if(picked.length===word.length){
        var made=picked.map(function(k){return letters[k].l;}).join('');
        if(made===word){ E.add(150+Math.floor(t)*10); E.s('win'); round++;
          if(round>7) return E.won('سيّد الحروف! 🔡','سبع كلمات'); gen(); }
        else { E.add(-40); E.s('buzz'); E.shake(10); picked=[]; letters.forEach(function(l){l.used=false;}); } }
      return; }
    if(y>200&&y<300&&picked.length){ var last=picked.pop(); letters[last].used=false; E.s('blip'); } },
  update:function(dt){ t-=dt; if(t<=0){ E.add(-50); E.s('lose');
    if(round>3&&E.score<60) return E.over('نفد الوقت','الكلمة كانت: '+word); gen(); } },
  draw:function(c){
    E.bg('#0d1220');
    E.tx('رتّب الحروف لتكوين كلمة',400,90,24,'#98a0b8');
    var pw=picked.length;
    for(var i=0;i<word.length;i++){ var x=400+(word.length/2-i-.5)*72;
      E.rr(x-32,215,64,70,10, i<pw?'#2f7a4d':'#1c2338');
      if(i<pw) E.tx(letters[picked[i]].l,x,250,34,'#fff'); }
    letters.forEach(function(L,i){ var x=(400-letters.length*36)+i*72;
      if(L.used)return;
      E.rr(x+4,385,64,72,10,'#3a4270'); E.tx(L.l,x+36,421,34,'#e8ecff'); });
    E.tx('انقر الصندوق العلوي للتراجع',400,320,15,'#6d7590');
    E.hudL('كلمة '+round+'/7'); E.hud('⏱ '+Math.max(0,t).toFixed(1), t<5?'#ff3d7f':'#fff');
  }};
}});

G({id:'math-blitz', t:'عاصفة الحساب', c:'math', e:'➗', tags:['أرقام','سرعة'],
d:'مسائل تتوالى بسرعة متزايدة. كل إجابة صحيحة تشتري لك ثانيتين إضافيتين.',
how:'انقر الإجابة الصحيحة', noPad:true,
make:function(E){
  var q,opts,t,lvl,streak;
  function gen(){
    var a,b,op,ans;
    var ops=lvl<4?['+','-']:lvl<8?['+','-','×']:['+','-','×','÷'];
    op=E.pick(ops);
    if(op==='+'){ a=E.ri(2,20+lvl*6); b=E.ri(2,20+lvl*6); ans=a+b; }
    else if(op==='-'){ a=E.ri(10,30+lvl*6); b=E.ri(1,a); ans=a-b; }
    else if(op==='×'){ a=E.ri(2,4+lvl); b=E.ri(2,9); ans=a*b; }
    else { b=E.ri(2,9); ans=E.ri(2,9+lvl); a=b*ans; }
    q=a+' '+op+' '+b;
    opts=[ans];
    while(opts.length<4){ var o=ans+E.ri(-Math.max(4,ans*.4|0),Math.max(4,ans*.4|0));
      if(o!==ans&&opts.indexOf(o)<0&&o>=0)opts.push(o); }
    opts.sort(function(){return Math.random()-.5;});
    q={txt:a+' '+op+' '+b+' = ؟', ans:ans}; }
  function reset(){ lvl=1; t=20; streak=0; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y<400)return; var i=Math.floor((x-40)/185); if(i<0||i>3)return;
    if(opts[i]===q.ans){ streak++; E.add(50+streak*10); E.s('coin'); t=Math.min(25,t+2); lvl++;
      if(lvl>30) return E.won('آلة حاسبة بشرية! ➗','٣٠ مسألة'); gen(); }
    else { streak=0; E.add(-40); E.s('buzz'); E.shake(10); t-=3; gen(); } },
  update:function(dt){ t-=dt; if(t<=0) E.over('نفد الوقت','حللت '+(lvl-1)+' مسألة'); },
  draw:function(c){
    E.bg('#0c1220');
    E.tx(q.txt,400,220,56,'#e8ecff');
    for(var i=0;i<4;i++){ E.rr(40+i*185,410,170,110,18,'#2b3350');
      E.tx(opts[i],125+i*185,465,40,'#ffc93d'); }
    E.rr(200,560,400,16,8,'#1c2338'); E.rr(202,562,396*E.cl(t/25,0,1),12,6, t<6?'#ff3d7f':'#9dff3d');
    E.hudL('مسألة '+lvl+' · تتابع '+streak); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'mastermind', t:'كسر الشيفرة', c:'brain', e:'🔐', tags:['منطق','استنتاج'],
d:'أربعة ألوان في ترتيب سرّي. كل محاولة تعطيك تلميحاً: كم لون صحيح ومكانه، وكم صحيح فقط.',
how:'انقر الخانات لتغيير اللون ثم «تحقّق»', noPad:true,
make:function(E){
  var C=['#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#7c5cff','#ff9f3d'];
  var code,guess,rows,round;
  function gen(){ code=[]; for(var i=0;i<4;i++)code.push(E.ri(0,5)); guess=[0,0,0,0]; rows=[]; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y>500&&x>300&&x<500){ check(); return; }
    if(y<420||y>490)return;
    var i=Math.floor((x-300)/60); if(i<0||i>3)return;
    guess[i]=(guess[i]+1)%6; E.s('tick'); },
  draw:function(c){
    E.bg('#0b0e1a');
    E.tx('اكسر الشيفرة — ٨ محاولات',400,40,24,'#98a0b8');
    rows.forEach(function(r,ri){ var y=80+ri*42;
      r.g.forEach(function(g,i){ E.o(320+i*46,y,16,C[g]); });
      E.tx('⚫'.repeat(r.b)+'⚪'.repeat(r.w),560,y,18,'#dfe6ff','left'); });
    for(var i=0;i<4;i++) E.o(330+i*60,455,26,C[guess[i]]);
    E.rr(300,500,200,52,12,'#2fbd6f'); E.tx('تحقّق',400,526,22,'#062012');
    E.hudL('محاولة '+(rows.length+1)+'/8'); E.hud('النتيجة '+E.score);
  }};
  function check(){
    var b=0,w=0, cc=code.slice(), gg=guess.slice();
    for(var i=3;i>=0;i--) if(gg[i]===cc[i]){ b++; cc.splice(i,1); gg.splice(i,1); }
    gg.forEach(function(g){ var k=cc.indexOf(g); if(k>=0){ w++; cc.splice(k,1); } });
    rows.push({g:guess.slice(),b:b,w:w}); E.s('blip');
    if(b===4){ E.add(400-rows.length*30); E.s('win'); round++;
      if(round>3) return E.won('كاسر شيفرات! 🔐','ثلاث شيفرات'); gen(); }
    else if(rows.length>=8) E.over('نفدت المحاولات','الشيفرة كانت مختلفة'); }
}});

G({id:'count-fast', t:'العدّ الخاطف', c:'math', e:'👁️', tags:['ملاحظة','أرقام'],
d:'ترى الأشكال لثانية واحدة فقط. كم كان عددها؟',
how:'انظر بسرعة ثم اختر العدد', noPad:true,
make:function(E){
  var n,items,show,t,round,opts;
  function gen(){ n=E.ri(4,8+round*2); items=[];
    for(var i=0;i<n;i++) items.push({x:E.rnd(60,740),y:E.rnd(90,470),e:E.pick(['🔵','🟣','🔴','🟢'])});
    var e=E.pick(['🔵','🟣','🔴','🟢']); items.forEach(function(it){ it.e=e; });
    show=Math.max(.45,1.4-round*.09); t=show;
    opts=[n]; while(opts.length<4){ var o=n+E.ri(-4,4); if(o>0&&opts.indexOf(o)<0)opts.push(o); }
    opts.sort(function(a,b){return a-b;}); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(t>0)return;
    if(y<440)return; var i=Math.floor((x-40)/185); if(i<0||i>3)return;
    if(opts[i]===n){ E.add(120+round*20); E.s('coin'); round++;
      if(round>10) return E.won('عين إحصائية! 👁️','عشر جولات'); gen(); }
    else { E.add(-60); E.s('buzz'); E.shake(10);
      if(round>3&&E.score<0) return E.over('عينك خانتك','الجولة '+round); gen(); } },
  update:function(dt){ if(t>0)t-=dt; },
  draw:function(c){
    E.bg('#0b0f1a');
    if(t>0){ items.forEach(function(it){ E.spr(it.e,it.x,it.y,34); });
      E.tx('عُدّ بسرعة!',400,45,26,'#ffc93d'); }
    else { E.tx('كم كان العدد؟',400,220,34,'#e8ecff');
      for(var i=0;i<4;i++){ E.rr(40+i*185,440,170,90,16,'#2b3350');
        E.tx(opts[i],125+i*185,485,36,'#ffc93d'); } }
    E.hudL('جولة '+round+'/10'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'piano-tiles', t:'بلاطات البيانو', c:'music', e:'🎹', tags:['إيقاع','سرعة'],
d:'اضغط البلاطات السوداء فقط، وتتسارع بلا رحمة. كل بلاطة تعزف نغمة من لحن.',
how:'انقر البلاطات السوداء', noPad:true,
make:function(E){
  var rows,sp,t,n,melody=[262,294,330,349,392,440,494,523],mi;
  function reset(){ rows=[]; sp=200; t=0; n=0; mi=0;
    for(var i=0;i<5;i++) rows.push({y:-i*150,c:E.ri(0,3),hit:false}); }
  reset();
  return {
  down:function(x,y){
    var col=E.cl(Math.floor(x/200),0,3);
    var best=null;
    rows.forEach(function(r){ if(!r.hit&&y>r.y&&y<r.y+150) best=r; });
    if(best&&best.c===col){ best.hit=true; n++; E.add(20+n);
      E.note(melody[mi%melody.length]*(mi>7?2:1),.22); mi++;
      E.burst(col*200+100,best.y+75,['#9dff3d'],10); }
    else { E.shake(14); E.s('buzz'); E.over('بلاطة خاطئة 🎹','عزفت '+n+' نغمة'); } },
  update:function(dt){
    sp=200+n*7; t+=dt;
    rows.forEach(function(r){ r.y+=sp*dt; });
    if(rows[rows.length-1].y>0){ var top=Math.min.apply(null,rows.map(function(r){return r.y;}));
      rows.push({y:top-150,c:E.ri(0,3),hit:false}); }
    for(var i=rows.length-1;i>=0;i--){ if(rows[i].y>600){
      if(!rows[i].hit){ E.shake(14); return E.over('فاتتك بلاطة','عزفت '+n+' نغمة'); }
      rows.splice(i,1); } }
    if(n>=60) E.won('عزفت اللحن كله! 🎹','ستون نغمة'); },
  draw:function(c){
    E.bg('#f2f5ff');
    for(var i=1;i<4;i++) E.ln(i*200,0,i*200,600,'#c8cfe0',1);
    rows.forEach(function(r){ E.rr(r.c*200+3,r.y+3,194,144,6, r.hit?'#c8cfe0':'#12161f'); });
    E.r(0,560,800,3,'#7c5cff');
    E.tx('نغمات: '+n,400,580,20,'#4a5480');
  }};
}});

G({id:'drum-copy', t:'قلّد الإيقاع', c:'music', e:'🥁', tags:['ذاكرة','إيقاع'],
d:'استمع لنمط الطبول ثم أعِد عزفه بنفس الترتيب والتوقيت النسبي.',
how:'انقر الطبول الأربعة', noPad:true,
make:function(E){
  var pat,idx,show,st,round,flash;
  var F=[110,160,220,320], N=['كبيرة','وسطى','صغيرة','صنج'];
  function gen(){ pat=[]; for(var i=0;i<2+round;i++)pat.push(E.ri(0,3));
    idx=0; show=true; st=0; flash=-1; }
  function reset(){ round=1; gen(); }
  reset();
  function press(i){
    if(show)return;
    flash=i; setTimeout(function(){flash=-1;},120);
    if(i===0)E.noise(.18,.3,0,60); else E.tone(F[i],.14,'triangle',.18);
    if(pat[idx]===i){ idx++; E.add(20);
      if(idx>=pat.length){ E.add(80*round); E.s('win'); round++;
        if(round>8) return E.won('طبّال ماهر! 🥁','ثماني أنماط'); setTimeout(gen,600); show=true; st=-.6; idx=0; } }
    else E.over('إيقاع خاطئ','وصلت للنمط '+round); }
  return {
  down:function(x,y){ if(y<250)return; press(E.cl(Math.floor((x-60)/170),0,3)); },
  key:function(k,d){ if(!d)return; var i=['a','s','d','f'].indexOf(k.toLowerCase()); if(i>=0)press(3-i); },
  update:function(dt){
    if(!show)return;
    st+=dt;
    if(st>.42){ st=0;
      if(flash>=0)flash=-1;
      else if(idx<pat.length){ flash=pat[idx];
        if(flash===0)E.noise(.18,.3,0,60); else E.tone(F[flash],.16,'triangle',.18);
        idx++; }
      else { show=false; idx=0; } } },
  draw:function(c){
    E.bg('#160e18');
    E.tx(show?'استمع… 👂':'أعِد الإيقاع 🥁',400,120,30, show?'#ffc93d':'#9dff3d');
    for(var i=0;i<4;i++){ var x=60+i*170;
      E.o(x+80,380,72, flash===i?'#ffc93d':'#3a2a3e');
      E.ring(x+80,380,72,'#8a6a3a',5);
      E.tx(N[i],x+80,470,17,'#98a0b8'); }
    E.hudL('نمط '+round+'/8 · طول '+pat.length); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'blackjack', t:'واحد وعشرون', c:'luck', e:'🃏', tags:['بطاقات','حظّ'],
d:'اقترب من ٢١ دون أن تتجاوزها. الموزّع يسحب حتى ١٧.',
how:'«اسحب» أو «قف»', noPad:true,
make:function(E){
  var deck,me,dl,st,chips,bet,msg;
  function newDeck(){ deck=[]; for(var s=0;s<4;s++)for(var v=1;v<=13;v++)deck.push({v:v,s:s});
    deck.sort(function(){return Math.random()-.5;}); }
  function val(h){ var t=0,a=0; h.forEach(function(c2){ var v=Math.min(10,c2.v); if(c2.v===1){a++;v=11;} t+=v; });
    while(t>21&&a){ t-=10; a--; } return t; }
  function deal(){ newDeck(); me=[deck.pop(),deck.pop()]; dl=[deck.pop(),deck.pop()]; st='play'; msg=''; }
  function reset(){ chips=200; bet=20; deal(); E.setScore(200); }
  reset();
  var SU=['♠','♥','♦','♣'], NM=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return {
  down:function(x,y){
    if(y<490)return;
    if(st==='play'){
      if(x<270){ me.push(deck.pop()); E.s('tick');
        if(val(me)>21){ st='done'; msg='تجاوزت! خسرت '+bet; chips-=bet; E.s('lose'); } }
      else if(x<530){ st='done'; stand(); }
      else { bet=Math.min(chips,bet+20); E.s('blip'); } }
    else { if(chips<=0) return E.over('أفلست 🃏','انتهت الرقائق');
      if(chips>=500) return E.won('ربحت ٥٠٠ رقاقة! 🃏','خرجت وأنت رابح');
      deal(); }
    E.setScore(chips); },
  draw:function(c){
    E.bg('#0a3a2a');
    E.tx('الموزّع: '+(st==='play'?'?':val(dl)),400,55,24,'#dfe6ff');
    dl.forEach(function(c2,i){ card(c2, 300+i*66, 90, st==='play'&&i>0); });
    E.tx('أنت: '+val(me),400,290,24,'#ffc93d');
    me.forEach(function(c2,i){ card(c2, 300+i*66, 320, false); });
    if(st==='play'){ btn(20,'اسحب','#2fbd6f'); btn(290,'قف','#ff9f3d'); btn(550,'رهان +٢٠','#3a4270'); }
    else { E.rr(250,495,300,70,14,'#7c5cff'); E.tx('جولة جديدة',400,530,24,'#fff'); }
    if(msg) E.tx(msg,400,470,26, msg.indexOf('ربحت')>=0?'#9dff3d':'#ff3d7f');
    E.hudL('رقائق '+chips+' · رهان '+bet); E.hud('النتيجة '+E.score);
  }};
  function card(c2,x,y,hidden){
    E.rr(x,y,58,84,8, hidden?'#39406b':'#f2f5ff');
    if(hidden){ E.tx('?',x+29,y+42,30,'#8a93b5'); return; }
    var col = c2.s===1||c2.s===2 ? '#d02040':'#12161f';
    E.tx(NM[c2.v],x+29,y+32,24,col); E.tx(SU[c2.s],x+29,y+62,24,col); }
  function btn(x,t,col){ E.rr(x+10,495,250,70,14,col); E.tx(t,x+135,530,24,'#fff'); }
  function stand(){
    while(val(dl)<17) dl.push(deck.pop());
    var m=val(me), d=val(dl);
    if(d>21||m>d){ chips+=bet; msg='ربحت '+bet+'! 🎉'; E.s('win'); }
    else if(m===d){ msg='تعادل'; E.s('blip'); }
    else { chips-=bet; msg='خسرت '+bet; E.s('lose'); }
    E.setScore(chips); }
}});

G({id:'higher-lower', t:'أعلى أم أقل؟', c:'luck', e:'📈', tags:['حظّ','تخمين'],
d:'رقم مخفي بين ١ و ١٠٠. هل التالي أعلى أم أقل؟ سلسلة طويلة = نقاط ضخمة.',
how:'اختر «أعلى» أو «أقل»', noPad:true,
make:function(E){
  var cur,nxt,streak,best,msg,mt;
  function reset(){ cur=E.ri(1,100); nxt=E.ri(1,100); streak=0; best=0; msg=''; mt=0; }
  reset();
  return {
  down:function(x,y){
    if(y<430||mt>0)return;
    var up = x<400;
    var right = up ? nxt>cur : nxt<cur;
    if(nxt===cur)right=true;
    if(right){ streak++; best=Math.max(best,streak); E.add(streak*30); E.s('coin');
      msg='صحيح! ('+nxt+')'; mt=1.1;
      if(streak>=12) return E.won('١٢ تخميناً متتالياً! 📈','حظّ أم حساب؟'); }
    else { E.add(-40); E.s('buzz'); msg='خطأ! كان '+nxt; mt=1.4; streak=0;
      if(E.score<-100) return E.over('نفد حظّك','أطول سلسلة '+best); }
    cur=nxt; nxt=E.ri(1,100); },
  update:function(dt){ if(mt>0)mt-=dt; },
  draw:function(c){
    E.bg('#101828');
    E.tx('الرقم الحالي',400,120,22,'#98a0b8');
    E.tx(cur,400,220,90,'#ffc93d');
    E.rr(60,430,320,120,20,'#2f7a4d'); E.tx('⬆️ أعلى',220,490,30,'#fff');
    E.rr(420,430,320,120,20,'#a02040'); E.tx('⬇️ أقل',580,490,30,'#fff');
    if(mt>0) E.tx(msg,400,340,32, msg.indexOf('صحيح')>=0?'#9dff3d':'#ff3d7f');
    E.hudL('سلسلة '+streak+' · الأفضل '+best); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'dice-duel', t:'نزال النرد', c:'luck', e:'🎲', tags:['حظّ','مخاطرة'],
d:'ارمِ النرد واجمع النقاط، لكن كل رمية قد تُفقدك كل ما جمعته. متى تتوقف؟',
how:'«ارمِ» للمخاطرة · «احتفظ» للأمان', noPad:true,
make:function(E){
  var pot,bank,foe,turn,dice,msg,anim;
  function reset(){ pot=0; bank=0; foe=0; turn='me'; dice=1; msg=''; anim=0; }
  reset();
  return {
  down:function(x,y){
    if(y<470||anim>0||turn!=='me')return;
    if(x<400){ anim=.5; }
    else { bank+=pot; pot=0; E.s('coin'); E.setScore(bank); turn='foe'; msg='دور الخصم…';
      setTimeout(foeTurn,900); } },
  update:function(dt){
    if(anim>0){ anim-=dt; dice=E.ri(1,6);
      if(anim<=0){ dice=E.ri(1,6); E.s('tick');
        if(dice===1){ pot=0; msg='واحد! ضاع كل شيء'; E.s('buzz'); E.shake(10); turn='foe';
          setTimeout(foeTurn,900); }
        else { pot+=dice; msg='+'+dice; } } } },
  draw:function(c){
    E.bg('#12101c');
    E.tx('أنت: '+bank,220,80,28,'#9dff3d'); E.tx('الخصم: '+foe,580,80,28,'#ff3d7f');
    E.rr(320,180,160,160,24,'#e8ecff');
    E.tx(['','⚀','⚁','⚂','⚃','⚄','⚅'][dice],400,262,90,'#12161f');
    E.tx('في القِدر: '+pot,400,390,30,'#ffc93d');
    if(msg) E.tx(msg,400,430,22,'#98a0b8');
    E.rr(60,470,320,100,18, turn==='me'?'#2fbd6f':'#2b3350'); E.tx('🎲 ارمِ',220,520,28,'#fff');
    E.rr(420,470,320,100,18, turn==='me'?'#7c5cff':'#2b3350'); E.tx('💰 احتفظ',580,520,28,'#fff');
    E.hud('النتيجة '+E.score);
  }};
  function foeTurn(){
    var p=0;
    var step=function(){
      var d=E.ri(1,6);
      if(d===1){ msg='الخصم خسر قِدره'; turn='me'; return; }
      p+=d;
      if(p>=18||(foe+p>=90)){ foe+=p; msg='الخصم احتفظ بـ'+p; turn='me';
        if(foe>=100) E.over('فاز الخصم','رصيدك '+bank); return; }
      setTimeout(step,500); };
    setTimeout(step,400);
    if(bank>=100) E.won('وصلت إلى ١٠٠! 🎲','فزت على الخصم'); }
}});

G({id:'rps-evolve', t:'حجر ورقة… متطوّرة', c:'luck', e:'✊', tags:['خصم ذكي','نمط'],
d:'الخصم يتعلّم أنماطك ويتنبأ بحركتك القادمة. هل تستطيع أن تكون عشوائياً حقاً؟',
how:'اختر ✊ ✋ ✌️', noPad:true,
make:function(E){
  var hist,wins,loss,draws,msg,mt,memory;
  function reset(){ hist=[]; wins=0;loss=0;draws=0; msg=''; mt=0; memory={}; }
  reset();
  var E3=['✊','✋','✌️'];
  return {
  down:function(x,y){
    if(y<400||mt>0)return; var i=Math.floor((x-70)/230); if(i<0||i>2)return;
    var pred=predict();
    var ai=(pred+1)%3;
    var r=(i-ai+3)%3;
    if(r===1){ wins++; E.add(60); msg='فزت! '+E3[i]+' ضد '+E3[ai]; E.s('coin'); }
    else if(r===0){ draws++; E.add(10); msg='تعادل '+E3[i]; E.s('blip'); }
    else { loss++; E.add(-30); msg='خسرت! '+E3[i]+' ضد '+E3[ai]; E.s('buzz'); }
    if(hist.length>=2){ var k=hist.slice(-2).join('');
      memory[k]=memory[k]||[0,0,0]; memory[k][i]++; }
    hist.push(i); mt=1.2;
    if(wins>=15) return E.won('تغلّبت على الخوارزمية! ✊','١٥ فوزاً');
    if(loss>=15) return E.over('توقّعت الخوارزمية أنماطك','فزت '+wins+' فقط'); },
  update:function(dt){ if(mt>0)mt-=dt; },
  draw:function(c){
    E.bg('#0e1220');
    E.tx('فوز '+wins+'  ·  خسارة '+loss+'  ·  تعادل '+draws,400,70,26,'#dfe6ff');
    E.tx('الخصم يحلّل آخر '+hist.length+' حركة',400,110,17,'#6d7590');
    for(var i=0;i<3;i++){ E.rr(70+i*230,400,200,150,24,'#2b3350');
      E.spr(E3[i],170+i*230,475,72); }
    if(mt>0) E.tx(msg,400,270,32, msg.indexOf('فزت')===0?'#9dff3d':msg.indexOf('تعادل')===0?'#ffc93d':'#ff3d7f');
    E.hud('النتيجة '+E.score);
  }};
  function predict(){
    if(hist.length<2) return E.ri(0,2);
    var k=hist.slice(-2).join(''), m=memory[k];
    if(!m) return E.ri(0,2);
    var b=0; for(var i=1;i<3;i++) if(m[i]>m[b])b=i;
    return m[b]>0 ? b : E.ri(0,2); }
}});

G({id:'air-hockey', t:'هوكي الهواء', c:'two', e:'🏒', tags:['لاعبان','سرعة'],
d:'لاعبان على جهاز واحد: أنت بالفأرة/اللمس والآخر بالأسهم — أو العب ضد الحاسوب.',
how:'اللمس/الفأرة للأزرق · ↑↓ للأحمر',
make:function(E){
  var p1,p2,pk,s1,s2,ai;
  function reset(){ p1={x:120,y:300}; p2={x:680,y:300}; s1=0; s2=0; ai=true;
    pk={x:400,y:300,vx:E.pick([-1,1])*260,vy:E.rnd(-140,140)}; }
  reset();
  return {
  move:function(x,y){ if(x<400){ p1.x=E.cl(x,40,380); p1.y=E.cl(y,40,560); } },
  key:function(k,d){ if(d&&(k==='ArrowUp'||k==='ArrowDown'))ai=false; },
  update:function(dt){
    if(E.ky()) { ai=false; p2.y=E.cl(p2.y+E.ky()*420*dt,40,560); }
    if(ai){ var ty=pk.vx>0?pk.y:300; p2.y+=E.cl(ty-p2.y,-1,1)*Math.min(300,Math.abs(ty-p2.y)*6)*dt;
      p2.x=E.cl(680+(pk.x>500?-60:0),420,760); }
    pk.x+=pk.vx*dt; pk.y+=pk.vy*dt; pk.vx*=.999; pk.vy*=.999;
    if(pk.y<16||pk.y>584){ pk.vy*=-1; pk.y=E.cl(pk.y,16,584); E.s('tick'); }
    [p1,p2].forEach(function(p){ var d=E.dist(pk.x,pk.y,p.x,p.y);
      if(d<44&&d>0){ var nx=(pk.x-p.x)/d, ny=(pk.y-p.y)/d;
        pk.x=p.x+nx*44; pk.y=p.y+ny*44;
        var sp=Math.max(300,Math.sqrt(pk.vx*pk.vx+pk.vy*pk.vy)*1.06);
        pk.vx=nx*sp; pk.vy=ny*sp; E.s('pop'); } });
    if(pk.x<16){ if(pk.y>210&&pk.y<390){ s2++; E.s('lose'); E.shake(14); serve(1); }
      else { pk.vx*=-1; pk.x=16; E.s('tick'); } }
    if(pk.x>784){ if(pk.y>210&&pk.y<390){ s1++; E.add(100); E.s('coin'); serve(-1); }
      else { pk.vx*=-1; pk.x=784; E.s('tick'); } }
    if(s1>=7) E.won('فزت '+s1+'—'+s2,'هدف قاتل');
    if(s2>=7) E.over('خسرت '+s1+'—'+s2,'حاول مرة أخرى'); },
  draw:function(c){
    E.bg('#0a2a3a');
    E.ln(400,0,400,600,'rgba(255,255,255,.15)',3); E.ring(400,300,80,'rgba(255,255,255,.15)',3);
    E.r(0,210,10,180,'#9dff3d'); E.r(790,210,10,180,'#9dff3d');
    E.o(p1.x,p1.y,34,'#00d4ff'); E.o(p1.x,p1.y,18,'#0a2a3a');
    E.o(p2.x,p2.y,34,'#ff3d7f'); E.o(p2.x,p2.y,18,'#0a2a3a');
    E.o(pk.x,pk.y,14,'#fff');
    E.tx(s1,300,50,40,'#00d4ff'); E.tx(s2,500,50,40,'#ff3d7f');
    E.tx(ai?'الحاسوب — اضغط ↑↓ للاعب ثانٍ':'لاعبان',400,580,15,'#6d7590');
  }};
  function serve(d){ pk={x:400,y:300,vx:d*280,vy:E.rnd(-140,140)}; }
}});

G({id:'sumo-push', t:'دفع السومو', c:'two', e:'🤼', tags:['لاعبان','فيزياء'],
d:'ادفع خصمك خارج الحلبة. اضغط سريعاً لتكسب الزخم — لكن الاندفاع الزائد يُخرجك أنت.',
how:'لاعب ١: A · لاعب ٢: L (أو انقر يمين/يسار الشاشة)', noPad:true,
make:function(E){
  var a,b,round,w1,w2,over;
  function newRound(){ a={x:320,vx:0}; b={x:480,vx:0}; over=0; }
  function reset(){ w1=0;w2=0; round=1; newRound(); }
  reset();
  return {
  key:function(k,d){ if(!d||over)return;
    if(k==='a'||k==='A'||k==='ArrowRight'){ a.vx+=95; E.s('thud'); }
    if(k==='l'||k==='L'||k==='ArrowLeft'){ b.vx-=95; E.s('thud'); } },
  down:function(x,y){ if(over)return; if(x<400){ a.vx+=95; } else { b.vx-=95; } E.s('thud'); },
  update:function(dt){
    if(over){ over-=dt; if(over<=0)newRound(); return; }
    a.x+=a.vx*dt; b.x+=b.vx*dt; a.vx*=.94; b.vx*=.94;
    if(b.x-a.x<70){ var mid=(a.x+b.x)/2; a.x=mid-35; b.x=mid+35;
      var t=a.vx; a.vx=(a.vx+b.vx)/2-Math.abs(a.vx-b.vx)*.35; b.vx=(t+b.vx)/2+Math.abs(t-b.vx)*.35; }
    if(a.x<120){ w2++; E.s('lose'); over=1.4; E.add(-50); }
    if(b.x>680){ w1++; E.s('win'); over=1.4; E.add(150); }
    if(w1>=3) E.won('فاز اللاعب الأزرق 🤼','ثلاث جولات');
    if(w2>=3) E.over('فاز اللاعب الأحمر 🤼','جولاتك '+w1); },
  draw:function(c){
    E.bg('#2a1a10');
    E.o(400,340,290,'#c8a86a'); E.ring(400,340,290,'#8a6a3a',10);
    E.r(0,0,120,600,'rgba(0,0,0,.5)'); E.r(680,0,120,600,'rgba(0,0,0,.5)');
    E.spr('🤼',a.x,320,80); E.spr('🤼',b.x,320,80);
    E.o(a.x,400,18,'#00d4ff'); E.o(b.x,400,18,'#ff3d7f');
    E.tx('أزرق '+w1+'  —  '+w2+' أحمر',400,60,30,'#dfe6ff');
    E.tx('اضغط A / انقر يسار الشاشة',200,560,15,'#98a0b8');
    E.tx('اضغط L / انقر يمين الشاشة',600,560,15,'#98a0b8');
  }};
}});

G({id:'balloon-pop', t:'فرقعة البالونات', c:'kids', e:'🎈', tags:['أطفال','ألوان'],
d:'لعبة لطيفة للصغار: فرقع البالونات الملوّنة قبل أن تطير بعيداً.',
how:'انقر البالونات', noPad:true,
make:function(E){
  var bs,t,popped,missed;
  function reset(){ bs=[]; t=60; popped=0; missed=0; }
  reset();
  return {
  down:function(x,y){
    for(var i=bs.length-1;i>=0;i--) if(E.dist(x,y,bs[i].x,bs[i].y)<34){
      E.burst(bs[i].x,bs[i].y,[bs[i].c],18,180); E.s('pop'); E.tone(400+Math.random()*400,.1,'sine',.14);
      bs.splice(i,1); popped++; E.add(20); return; } },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('أحسنت! 🎈','فرقعت '+popped+' بالوناً');
    if(Math.random()<dt*1.7&&bs.length<12)
      bs.push({x:E.rnd(50,750),y:640,v:E.rnd(45,105),c:E.pick(['#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#c93dff','#ff9f3d']),
        s:E.rnd(-1,1)});
    for(var i=bs.length-1;i>=0;i--){ var b=bs[i]; b.y-=b.v*dt; b.x+=Math.sin(E.time*2+i)*b.s;
      if(b.y<-50){ bs.splice(i,1); missed++; } } },
  draw:function(c){
    E.sky('#7cc4f0','#cfe9ff');
    bs.forEach(function(b){ E.o(b.x,b.y,30,b.c); E.o(b.x-9,b.y-10,8,'rgba(255,255,255,.55)');
      E.ln(b.x,b.y+30,b.x+Math.sin(E.time*3+b.x)*8,b.y+62,'#8a93b5',2); });
    E.tx('فرقعت: '+popped,400,44,30,'#12305a');
    E.tx('⏱ '+Math.max(0,t).toFixed(0),700,44,26,'#12305a');
  }};
}});

G({id:'shape-sort', t:'فرز الأشكال', c:'kids', e:'🔷', tags:['أطفال','منطق'],
d:'اسحب كل شكل إلى صندوقه الصحيح. بسيطة، هادئة، وممتعة للصغار.',
how:'اسحب الأشكال إلى الصناديق', noPad:true,
make:function(E){
  var items,bins,drag,done,t;
  var SH=[['⭐','#ffc93d'],['🔷','#00d4ff'],['🔴','#ff3d7f'],['🟩','#9dff3d']];
  function gen(){ items=[]; for(var i=0;i<8;i++){ var k=E.ri(0,3);
      items.push({x:E.rnd(80,720),y:E.rnd(90,330),k:k,done:false}); }
    bins=SH.map(function(s,i){ return {x:70+i*180,y:450,k:i}; }); done=0; }
  function reset(){ gen(); t=90; }
  reset();
  return {
  down:function(x,y){ for(var i=items.length-1;i>=0;i--){ var it=items[i];
      if(!it.done&&E.dist(x,y,it.x,it.y)<32){ drag=i; return; } } },
  move:function(x,y){ if(drag!=null){ items[drag].x=x; items[drag].y=y; } },
  up:function(x,y){ if(drag==null)return;
    var it=items[drag];
    bins.forEach(function(b){ if(Math.abs(it.x-(b.x+70))<80&&Math.abs(it.y-(b.y+55))<70){
      if(b.k===it.k){ it.done=true; done++; E.add(50); E.s('coin'); E.burst(it.x,it.y,[SH[it.k][1]],14);
        if(done>=items.length) E.won('أحسنت! فرزت كل الأشكال 🔷','ممتاز'); }
      else { E.s('buzz'); it.x=E.rnd(80,720); it.y=E.rnd(90,330); } } });
    drag=null; },
  update:function(dt){ t-=dt; if(t<=0) E.over('انتهى الوقت','فرزت '+done); },
  draw:function(c){
    E.sky('#1a2b40','#0a1220');
    bins.forEach(function(b){ E.rr(b.x,b.y,140,110,16,'rgba(255,255,255,.06)');
      E.sr(b.x,b.y,140,110,SH[b.k][1],3); E.spr(SH[b.k][0],b.x+70,b.y+55,44); });
    items.forEach(function(it){ if(it.done)return; E.spr(SH[it.k][0],it.x,it.y,50); });
    E.tx('فرزت '+done+' من '+items.length,400,45,26,'#dfe6ff');
    E.hud('⏱ '+Math.max(0,t).toFixed(0));
  }};
}});
