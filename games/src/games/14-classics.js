/* ============ 14) كلاسيكيات المتصفّح ============ */

G({id:'match3', t:'ثلاثة متطابقة', c:'puzzle', e:'💎', tags:['مطابقة','ألوان'],
d:'بدّل جوهرتين لتصنع صفاً من ثلاث أو أكثر — والسلاسل تنفجر تلقائياً.',
how:'انقر جوهرتين متجاورتين', noPad:true,
make:function(E){
  var W=8,H=8,g,sel,t,moves,combo;
  var C=['#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#c93dff','#ff9f3d'];
  function fill(){ for(var i=0;i<W*H;i++) if(g[i]<0) g[i]=E.ri(0,5); }
  function reset(){ g=new Array(W*H).fill(-1); fill(); sel=-1; t=90; moves=0; combo=0;
    while(findAll().length){ clearAll(true); } }
  reset();
  function findAll(){
    var out=[];
    for(var y=0;y<H;y++)for(var x=0;x<W-2;x++){ var v=g[y*W+x];
      if(v>=0&&g[y*W+x+1]===v&&g[y*W+x+2]===v) out.push([y*W+x,y*W+x+1,y*W+x+2]); }
    for(var x2=0;x2<W;x2++)for(var y2=0;y2<H-2;y2++){ var v2=g[y2*W+x2];
      if(v2>=0&&g[(y2+1)*W+x2]===v2&&g[(y2+2)*W+x2]===v2) out.push([y2*W+x2,(y2+1)*W+x2,(y2+2)*W+x2]); }
    return out; }
  function clearAll(silent){
    var m=findAll(); if(!m.length)return false;
    var set={}; m.forEach(function(t3){ t3.forEach(function(i){ set[i]=1; }); });
    var n=0;
    for(var k in set){ var i=+k;
      if(!silent){ E.burst((i%W)*62+62,((i/W)|0)*62+52,[C[g[i]]],8,120); }
      g[i]=-1; n++; }
    if(!silent){ combo++; E.add(n*20*combo); E.s('pop'); }
    for(var x=0;x<W;x++){ var col=[];
      for(var y=H-1;y>=0;y--) if(g[y*W+x]>=0) col.push(g[y*W+x]);
      for(var y2=H-1;y2>=0;y2--) g[y2*W+x]= col[H-1-y2]!==undefined?col[H-1-y2]:-1; }
    fill(); return true; }
  return {
  down:function(mx,my){
    var S=62,OX=31,OY=21;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=W||y>=H)return;
    var i=y*W+x;
    if(sel<0){ sel=i; E.s('tick'); return; }
    var sx=sel%W, sy=(sel/W)|0;
    if(Math.abs(sx-x)+Math.abs(sy-y)!==1){ sel=i; return; }
    var tmp=g[sel]; g[sel]=g[i]; g[i]=tmp;
    if(!findAll().length){ g[i]=g[sel]; g[sel]=tmp; E.s('buzz'); sel=-1; return; }
    moves++; combo=0; sel=-1; },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت 💎','النتيجة '+E.score);
    if(this._c==null)this._c=0;
    this._c-=dt;
    if(this._c<=0){ this._c=.18; if(!clearAll())combo=0; } },
  draw:function(c){
    E.bg('#0d1220');
    var S=62,OX=31,OY=21;
    for(var i=0;i<W*H;i++){ var x=OX+(i%W)*S, y=OY+((i/W)|0)*S;
      E.rr(x+2,y+2,S-4,S-4,8, i===sel?'#4a5480':'#1a2036');
      if(g[i]>=0){ E.o(x+S/2,y+S/2,S/2-11,C[g[i]]);
        E.o(x+S/2-6,y+S/2-6,5,'rgba(255,255,255,.5)'); } }
    E.rr(540,21,240,S*H,12,'#141a2a');
    E.tx('النتيجة',660,70,20,'#98a0b8'); E.tx(E.score,660,110,36,'#ffc93d');
    E.tx('الوقت',660,180,20,'#98a0b8'); E.tx(Math.max(0,t).toFixed(0),660,220,32, t<15?'#ff3d7f':'#9dff3d');
    E.tx('نقلات',660,290,20,'#98a0b8'); E.tx(moves,660,330,28,'#dfe6ff');
    if(combo>1) E.tx('سلسلة ×'+combo,660,400,26,'#9dff3d');
  }};
}});

G({id:'bubble-shoot', t:'قاذف الفقاعات', c:'puzzle', e:'🫧', tags:['تصويب','مطابقة'],
d:'أطلق الفقاعات لتجمع ثلاثاً من نفس اللون فتنفجر. لا تدعها تصل إلى الأسفل.',
how:'وجّه بالفأرة وانقر للإطلاق', noPad:true,
make:function(E){
  var COLS=13,ROWS=14,R=28,g,shot,next,cur,shots;
  var C=['#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#c93dff'];
  function px(r,c2){ return 40+c2*R*2+(r%2?R:0); }
  function py(r){ return 40+r*R*1.72; }
  function reset(){ g=[]; for(var r=0;r<ROWS;r++){ g.push([]);
      for(var c2=0;c2<COLS-(r%2);c2++) g[r].push(r<5?E.ri(0,4):-1); }
    shot=null; cur=E.ri(0,4); next=E.ri(0,4); shots=0; }
  reset();
  return {
  down:function(x,y){
    if(shot)return;
    var a=Math.atan2(y-560,x-400); if(a>-.25)a=-.25; if(a<-2.89)a=-2.89;
    shot={x:400,y:560,vx:Math.cos(a)*620,vy:Math.sin(a)*620,c:cur};
    cur=next; next=E.ri(0,4); shots++; E.s('laser'); },
  update:function(dt){
    if(!shot)return;
    shot.x+=shot.vx*dt; shot.y+=shot.vy*dt;
    if(shot.x<R){shot.x=R;shot.vx*=-1;E.s('tick');}
    if(shot.x>800-R){shot.x=800-R;shot.vx*=-1;E.s('tick');}
    var stick = shot.y<40;
    for(var r=0;r<ROWS&&!stick;r++)for(var c2=0;c2<g[r].length;c2++)
      if(g[r][c2]>=0&&E.dist(shot.x,shot.y,px(r,c2),py(r))<R*1.75){ stick=true; break; }
    if(!stick)return;
    var br=0,bc=0,bd=1e9;
    for(var r2=0;r2<ROWS;r2++)for(var c3=0;c3<g[r2].length;c3++)
      if(g[r2][c3]<0){ var d=E.dist(shot.x,shot.y,px(r2,c3),py(r2)); if(d<bd){bd=d;br=r2;bc=c3;} }
    g[br][bc]=shot.c; var col=shot.c; shot=null;
    var group=flood(br,bc,col);
    if(group.length>=3){ group.forEach(function(k){ E.burst(px(k[0],k[1]),py(k[0]),[C[col]],8,140); g[k[0]][k[1]]=-1; });
      E.add(group.length*40); E.s('pop'); dropFloating(); }
    else E.s('thud');
    for(var r3=0;r3<ROWS;r3++)for(var c4=0;c4<g[r3].length;c4++)
      if(g[r3][c4]>=0&&py(r3)>500) return E.over('وصلت الفقاعات للأسفل','النتيجة '+E.score);
    var left=0; g.forEach(function(row){ row.forEach(function(v){ if(v>=0)left++; }); });
    if(!left) E.won('نظّفت اللوح! 🫧','بـ'+shots+' طلقة'); },
  draw:function(c){
    E.bg('#0a1020');
    for(var r=0;r<ROWS;r++)for(var c2=0;c2<g[r].length;c2++) if(g[r][c2]>=0)
      E.o(px(r,c2),py(r),R-3,C[g[r][c2]]);
    var a=Math.atan2(E.m.y-560,E.m.x-400); if(a>-.25)a=-.25; if(a<-2.89)a=-2.89;
    E.ln(400,560,400+Math.cos(a)*140,560+Math.sin(a)*140,'rgba(255,255,255,.3)',3);
    if(shot) E.o(shot.x,shot.y,R-3,C[shot.c]);
    E.o(400,560,R-3,C[cur]); E.o(480,570,18,C[next]);
    E.hud('النتيجة '+E.score); E.hudL('طلقات '+shots);
  }};
  function flood(r,c2,col){
    var seen={}, st=[[r,c2]], out=[];
    while(st.length){ var p=st.pop(), k=p[0]+','+p[1];
      if(seen[k])continue; if(!g[p[0]]||g[p[0]][p[1]]!==col)continue;
      seen[k]=1; out.push(p);
      var odd=p[0]%2;
      [[0,-1],[0,1],[-1,odd?0:-1],[-1,odd?1:0],[1,odd?0:-1],[1,odd?1:0]].forEach(function(d){
        st.push([p[0]+d[0],p[1]+d[1]]); }); }
    return out; }
  function dropFloating(){
    var seen={}, st=[];
    for(var c2=0;c2<g[0].length;c2++) if(g[0][c2]>=0){ st.push([0,c2]); }
    while(st.length){ var p=st.pop(), k=p[0]+','+p[1];
      if(seen[k])continue; if(!g[p[0]]||g[p[0]][p[1]]==null||g[p[0]][p[1]]<0)continue;
      seen[k]=1; var odd=p[0]%2;
      [[0,-1],[0,1],[-1,odd?0:-1],[-1,odd?1:0],[1,odd?0:-1],[1,odd?1:0]].forEach(function(d){
        st.push([p[0]+d[0],p[1]+d[1]]); }); }
    for(var r=0;r<ROWS;r++)for(var c3=0;c3<g[r].length;c3++)
      if(g[r][c3]>=0&&!seen[r+','+c3]){ E.add(60); g[r][c3]=-1; } }
}});

G({id:'whack-mole', t:'اضرب الخُلد', c:'speed', e:'🐹', tags:['سرعة','ردّ فعل'],
d:'خُلد يظهر ويختفي — اضربه بسرعة، لكن لا تضرب الأرنب اللطيف.',
how:'انقر الخُلد', noPad:true,
make:function(E){
  var holes,t,hits,miss,rate;
  function reset(){ holes=[]; for(var i=0;i<9;i++) holes.push({up:0,kind:0});
    t=45; hits=0; miss=0; rate=1.4; }
  reset();
  return {
  down:function(x,y){
    var S=180, OX=130, OY=110;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-OY)/S);
    if(cx<0||cy<0||cx>2||cy>2)return;
    var h=holes[cy*3+cx];
    if(h.up<=0){ E.add(-10); E.s('tick'); return; }
    if(h.kind===1){ E.add(-80); E.s('buzz'); E.shake(10); miss++; }
    else { hits++; E.add(80); E.s('pop'); E.burst(OX+cx*S+S/2,OY+cy*S+S/2,['#a06a3a'],12); }
    h.up=0; },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت','ضربت '+hits+' خُلداً');
    rate=1.4+ (45-t)*.06;
    if(Math.random()<dt*rate){ var i=E.ri(0,8);
      if(holes[i].up<=0){ holes[i].up=E.rnd(.6,1.3); holes[i].kind=Math.random()<.22?1:0; } }
    holes.forEach(function(h){ if(h.up>0){ h.up-=dt; if(h.up<=0&&h.kind===0)miss++; } }); },
  draw:function(c){
    E.bg('#3d6b2a');
    var S=180, OX=130, OY=110;
    for(var i=0;i<9;i++){ var x=OX+(i%3)*S+S/2, y=OY+((i/3)|0)*S+S/2;
      E.o(x,y+20,58,'#2a1a10'); E.o(x,y+14,54,'#1a0f08');
      var h=holes[i];
      if(h.up>0) E.spr(h.kind===1?'🐰':'🐹',x,y-6,64); }
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · ضربات '+hits); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'mahjong-pair', t:'ماهجونغ الأزواج', c:'puzzle', e:'🀄', tags:['مطابقة','هدوء'],
d:'أزل البلاطات المتطابقة الحرّة (التي لها جانب فارغ) حتى يخلو اللوح.',
how:'انقر بلاطتين متطابقتين', noPad:true,
make:function(E){
  var tiles,sel,lvl;
  var EM=['🀄','🎋','🌸','🐉','🍀','🔥','💧','⛰️','🌙','☀️','🎐','🏮'];
  function gen(){ var W=8,H=5;
    var kinds=EM.slice(0,6+lvl);
    var pool=[];
    for(var i=0;i<W*H/2;i++){ var e=E.pick(kinds); pool.push(e); pool.push(e); }
    pool.sort(function(){return Math.random()-.5;});
    tiles=[]; for(var y=0;y<H;y++)for(var x=0;x<W;x++)
      tiles.push({x:x,y:y,e:pool.pop(),gone:false});
    sel=-1; }
  function reset(){ lvl=1; gen(); }
  reset();
  function free(t){
    var left = tiles.some(function(o){ return !o.gone&&o.y===t.y&&o.x===t.x-1; });
    var right= tiles.some(function(o){ return !o.gone&&o.y===t.y&&o.x===t.x+1; });
    return !left||!right; }
  return {
  down:function(mx,my){
    var S=88,OX=(800-8*S)/2,OY=(600-5*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=8||y>=5)return;
    var i=-1; tiles.forEach(function(t,k){ if(!t.gone&&t.x===x&&t.y===y)i=k; });
    if(i<0)return;
    if(!free(tiles[i])){ E.s('buzz'); return; }
    if(sel<0){ sel=i; E.s('tick'); return; }
    if(sel===i){ sel=-1; return; }
    if(tiles[sel].e===tiles[i].e){ tiles[sel].gone=true; tiles[i].gone=true; sel=-1;
      E.add(80); E.s('coin');
      if(tiles.every(function(t){return t.gone;})){ E.add(300); E.s('win'); lvl++;
        if(lvl>4) return E.won('لوح نظيف! 🀄','أربع مراحل'); gen(); } }
    else { sel=i; E.s('blip'); } },
  draw:function(c){
    E.bg('#0f2a20');
    var S=88,OX=(800-8*S)/2,OY=(600-5*S)/2;
    tiles.forEach(function(t,i){ if(t.gone)return;
      var x=OX+t.x*S, y=OY+t.y*S;
      E.rr(x+3,y+3,S-6,S-6,10, i===sel?'#ffc93d':(free(t)?'#f0e8d0':'#9a9484'));
      E.spr(t.e,x+S/2,y+S/2,42); });
    E.hudL('مرحلة '+lvl+'/4'); E.hud('النتيجة '+E.score);
    E.tx('البلاطة حرّة إذا كان أحد جانبيها فارغاً',400,585,15,'#6d7590');
  }};
}});

G({id:'solitaire-lite', t:'سوليتير مصغّر', c:'luck', e:'🂡', tags:['بطاقات','ترتيب'],
d:'رتّب البطاقات تنازلياً بألوان متبادلة، وابنِ الأكوام الأربعة من الآص إلى الملك.',
how:'انقر بطاقة ثم وجهتها', noPad:true,
make:function(E){
  var cols,found,sel,deck,waste;
  var SU=['♠','♥','♦','♣'], NM=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  function red(s){ return s===1||s===2; }
  function reset(){ deck=[];
    for(var s=0;s<4;s++)for(var v=1;v<=13;v++)deck.push({v:v,s:s,up:false});
    deck.sort(function(){return Math.random()-.5;});
    cols=[]; for(var i=0;i<5;i++){ cols.push([]);
      for(var k=0;k<=i;k++){ var c2=deck.pop(); c2.up=(k===i); cols[i].push(c2); } }
    found=[[],[],[],[]]; waste=[]; sel=null; }
  reset();
  return {
  down:function(x,y){
    if(y<110){
      if(x<120){ if(deck.length){ var c2=deck.pop(); c2.up=true; waste.push(c2); E.s('tick'); }
        else { deck=waste.reverse(); waste=[]; deck.forEach(function(q){q.up=false;}); E.s('blip'); }
        sel=null; return; }
      if(x>150&&x<260&&waste.length){ sel={from:'waste'}; E.s('tick'); return; }
      var fi=Math.floor((x-380)/100);
      if(fi>=0&&fi<4){ tryMove({from:'found',i:fi}); return; }
      return; }
    var ci=Math.floor((x-60)/145);
    if(ci<0||ci>4)return;
    var col=cols[ci];
    var idx=-1;
    for(var k=col.length-1;k>=0;k--){ var cy=150+k*34;
      if(y>cy&&y<cy+90&&col[k].up){ idx=k; break; } }
    if(sel){ tryMove({from:'col',i:ci}); return; }
    if(idx>=0){ sel={from:'col',i:ci,k:idx}; E.s('tick'); }
    else if(col.length&&!col[col.length-1].up){ col[col.length-1].up=true; E.add(10); E.s('blip'); } },
  draw:function(c){
    E.bg('#0d5a35');
    E.rr(20,20,100,84,8, deck.length?'#2b3350':'#0a4028');
    if(deck.length) E.tx(deck.length,70,62,24,'#dfe6ff');
    if(waste.length) card(waste[waste.length-1],150,20);
    for(var f=0;f<4;f++){ E.rr(380+f*100,20,80,84,8,'#0a4028'); E.tx(SU[f],420+f*100,62,26,'rgba(255,255,255,.3)');
      if(found[f].length) card(found[f][found[f].length-1],380+f*100,20); }
    cols.forEach(function(col,i){ col.forEach(function(c2,k){
      if(c2.up) card(c2,60+i*145,150+k*34);
      else { E.rr(60+i*145,150+k*34,90,88,8,'#39406b'); } }); });
    if(sel) E.tx('محدّد ✓',400,580,18,'#ffc93d');
    E.hud('النتيجة '+E.score);
  }};
  function card(c2,x,y){
    E.rr(x,y,90,88,8,'#f2f5ff');
    var col=red(c2.s)?'#d02040':'#12161f';
    E.tx(NM[c2.v],x+45,y+32,26,col); E.tx(SU[c2.s],x+45,y+64,26,col); }
  function top(t){
    if(t.from==='waste')return waste[waste.length-1];
    if(t.from==='col')return cols[t.i][cols[t.i].length-1];
    return found[t.i][found[t.i].length-1]; }
  function tryMove(dst){
    if(!sel)return;
    var src = sel.from==='waste' ? waste[waste.length-1] : cols[sel.i][sel.k];
    if(!src){ sel=null; return; }
    if(dst.from==='found'){
      var f=found[dst.i], okF = f.length? (f[f.length-1].v===src.v-1&&f[f.length-1].s===src.s) : src.v===1;
      var isTop = sel.from==='waste' || sel.k===cols[sel.i].length-1;
      if(okF&&isTop){ f.push(src);
        if(sel.from==='waste')waste.pop(); else cols[sel.i].pop();
        E.add(100); E.s('coin');
        if(found.every(function(q){return q.length===13;})) E.won('فزت! 🂡','سوليتير كامل'); }
      else E.s('buzz');
      sel=null; return; }
    var col=cols[dst.i], t2=col[col.length-1];
    var ok = t2 ? (t2.up && t2.v===src.v+1 && red(t2.s)!==red(src.s)) : src.v===13;
    if(ok){
      if(sel.from==='waste'){ col.push(waste.pop()); }
      else { var moving=cols[sel.i].splice(sel.k); moving.forEach(function(q){ col.push(q); }); }
      E.add(20); E.s('pop'); }
    else E.s('buzz');
    sel=null; }
}});

G({id:'chess-mate', t:'كش مات في نقلة', c:'board', e:'♔', tags:['شطرنج','تكتيك'],
d:'وضعيات شطرنج حقيقية: نقلة واحدة فقط تنهي المباراة. جدها.',
how:'انقر القطعة ثم المربع', noPad:true,
make:function(E){
  var PUZ=[
    {b:{'a8':'k','h1':'K','a1':'R','b7':'P'}, sol:['a1','a7'], hint:'الرخّ يزحف'},
    {b:{'h8':'k','g7':'p','h7':'p','a1':'R','h2':'K'}, sol:['a1','a8'], hint:'العمود المفتوح'},
    {b:{'e8':'k','e1':'R','d1':'K'}, sol:['e1','e7'], hint:'مواجهة مباشرة'},
    {b:{'a8':'k','b6':'N','c7':'Q','h1':'K'}, sol:['c7','b7'], hint:'الوزير يقترب'},
    {b:{'g8':'k','f7':'p','g7':'p','h7':'p','a2':'Q','h2':'K'}, sol:['a2','a8'], hint:'القطر الطويل'}
  ];
  var idx,pos,sel,msg,mt;
  function load(){ pos={}; var p=PUZ[idx%PUZ.length];
    for(var k in p.b) pos[k]=p.b[k]; sel=null; msg=''; mt=0; }
  function reset(){ idx=0; load(); }
  reset();
  var GL={'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙','k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'};
  function sq(x,y){ return 'abcdefgh'[x]+(8-y); }
  return {
  down:function(mx,my){
    if(mt>0)return;
    var S=64,OX=(800-8*S)/2,OY=(600-8*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>7||y>7)return;
    var s=sq(x,y);
    if(!sel){ if(pos[s]&&pos[s]===pos[s].toUpperCase()){ sel=s; E.s('tick'); } return; }
    var p=PUZ[idx%PUZ.length];
    if(sel===p.sol[0]&&s===p.sol[1]){
      pos[s]=pos[sel]; delete pos[sel]; sel=null;
      E.add(300); E.s('win'); msg='كش مات! ♔'; mt=1.8; idx++;
      if(idx>=PUZ.length){ E.won('حللت كل الوضعيات! ♔','خمس نقلات قاتلة'); return; } }
    else { E.add(-50); E.s('buzz'); E.shake(10); msg='ليست مات — حاول مجدداً'; mt=1.4; sel=null; } },
  update:function(dt){ if(mt>0){ mt-=dt; if(mt<=0&&msg.indexOf('كش')===0) load(); } },
  draw:function(c){
    E.bg('#12161f');
    var S=64,OX=(800-8*S)/2,OY=(600-8*S)/2;
    for(var y=0;y<8;y++)for(var x=0;x<8;x++){
      var s=sq(x,y);
      E.r(OX+x*S,OY+y*S,S,S, s===sel?'#7ba05b':((x+y)%2?'#6b8a4a':'#e8e0c8'));
      if(pos[s]) E.spr(GL[pos[s]],OX+x*S+S/2,OY+y*S+S/2,46); }
    E.tx('وضعية '+(idx+1)+'/'+PUZ.length+' — الأبيض يلعب ويمات في نقلة',400,50,22,'#dfe6ff');
    E.tx('تلميح: '+PUZ[idx%PUZ.length].hint,400,570,18,'#98a0b8');
    if(mt>0) E.tx(msg,400,300,34, msg.indexOf('كش')===0?'#9dff3d':'#ff3d7f');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'spot-diff', t:'اكتشف الفرق', c:'brain', e:'🔎', tags:['ملاحظة','مقارنة'],
d:'لوحتان متطابقتان… إلا في ثلاثة مواضع. جدها كلها قبل نفاد الوقت.',
how:'انقر مواضع الاختلاف', noPad:true,
make:function(E){
  var items,diffs,found,t,round;
  var EM=['⭐','🔺','🟦','🟢','🍀','🔔','🎈','🧿','🍁','🎲'];
  function gen(){ var n=16;
    items=[]; for(var i=0;i<n;i++) items.push({x:E.rnd(30,340),y:E.rnd(90,500),
      e:E.pick(EM), r:E.rnd(-.4,.4), diff:false});
    diffs=[];
    for(var k=0;k<3;k++){ var i2; do{ i2=E.ri(0,n-1); }while(items[i2].diff);
      items[i2].diff=true; items[i2].e2=E.pick(EM.filter(function(e){return e!==items[i2].e;}));
      diffs.push(i2); }
    found=[]; t=Math.max(15,40-round*3); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    var ox = x<400 ? 30 : 410;
    for(var i=0;i<items.length;i++){ var it=items[i];
      if(it.diff&&found.indexOf(i)<0&&E.dist(x-ox,y,it.x,it.y)<34){
        found.push(i); E.add(150); E.s('coin'); E.burst(x,y,['#9dff3d'],14);
        if(found.length===3){ E.add(200+Math.floor(t)*10); E.s('win'); round++;
          if(round>8) return E.won('عين مدقّقة! 🔎','ثماني لوحات'); gen(); }
        return; } }
    E.add(-40); E.s('buzz'); t-=1.5; },
  update:function(dt){ t-=dt; if(t<=0) E.over('نفد الوقت','اللوحة '+round); },
  draw:function(c){
    E.bg('#0d1120');
    [0,1].forEach(function(side){ var ox=side?410:30;
      E.rr(ox-10,60,380,470,14,'#161c2c');
      items.forEach(function(it,i){
        var e = (side===1&&it.diff&&found.indexOf(i)<0) ? it.e2 : it.e;
        E.spr(e,ox+it.x-30+30,it.y,44,it.r);
        if(it.diff&&found.indexOf(i)>=0) E.ring(ox+it.x,it.y,30,'#9dff3d',3); }); });
    E.tx('وجدت '+found.length+'/3',400,40,26,'#dfe6ff');
    E.hudL('لوحة '+round+'/8'); E.hud('⏱ '+Math.max(0,t).toFixed(0), t<8?'#ff3d7f':'#fff');
  }};
}});

G({id:'trivia', t:'سؤال وجواب', c:'brain', e:'❓', tags:['معلومات','ثقافة'],
d:'أسئلة معلومات عامة بالعربية. الإجابة السريعة تعطي نقاطاً أكثر.',
how:'اختر الإجابة الصحيحة', noPad:true,
make:function(E){
  var Q=[
    ['ما أطول نهر في العالم؟',['النيل','الأمازون','اليانغتسي','المسيسيبي'],0],
    ['كم عدد أضلاع المسدّس؟',['٥','٦','٧','٨'],1],
    ['ما أكبر كوكب في المجموعة الشمسية؟',['زحل','المشتري','نبتون','الأرض'],1],
    ['ما عاصمة اليابان؟',['أوساكا','كيوتو','طوكيو','ناغويا'],2],
    ['كم لوناً في قوس قزح؟',['٥','٦','٧','٨'],2],
    ['ما الرمز الكيميائي للذهب؟',['Ag','Au','Fe','Gd'],1],
    ['كم قارّة في العالم؟',['٥','٦','٧','٨'],2],
    ['ما أصغر عدد أوّلي؟',['٠','١','٢','٣'],2],
    ['في أي قارة تقع مصر؟',['آسيا','أوروبا','أفريقيا','أستراليا'],2],
    ['ما الحيوان الأسرع على اليابسة؟',['الفهد','الأسد','الحصان','الغزال'],0],
    ['كم عدد عظام جسم الإنسان البالغ؟',['١٨٦','٢٠٦','٢٢٦','٢٥٦'],1],
    ['ما أعمق محيط في العالم؟',['الأطلسي','الهندي','الهادئ','المتجمّد'],2],
    ['كم يوماً في السنة الكبيسة؟',['٣٦٤','٣٦٥','٣٦٦','٣٦٧'],2],
    ['ما العنصر الأكثر وفرة في الكون؟',['الأكسجين','الهيدروجين','الكربون','الحديد'],1],
    ['كم مربعاً في رقعة الشطرنج؟',['٣٦','٤٩','٦٤','٨١'],2],
    ['ما أكبر صحراء حارّة في العالم؟',['الربع الخالي','الكبرى','كالاهاري','أتاكاما'],1],
    ['كم عدد أوتار الكمان؟',['٣','٤','٥','٦'],1],
    ['ما أسرع وسيلة انتقال للضوء؟',['الفراغ','الماء','الزجاج','الهواء'],0]
  ];
  var order,i,t,streak,q;
  function reset(){ order=Q.map(function(_,k){return k;}).sort(function(){return Math.random()-.5;});
    i=0; streak=0; next(); }
  function next(){ q=Q[order[i%order.length]]; t=12; }
  reset();
  return {
  down:function(x,y){
    if(y<330)return;
    var k=Math.floor((y-330)/62); if(k<0||k>3)return;
    if(k===q[2]){ streak++; E.add(100+Math.floor(t)*15+streak*20); E.s('coin'); i++;
      if(i>=12) return E.won('مثقّف! ❓','١٢ إجابة صحيحة'); next(); }
    else { streak=0; E.add(-70); E.s('buzz'); E.shake(10); i++;
      if(E.score<-100) return E.over('انتهت اللعبة','أجبت '+i+' سؤالاً'); next(); } },
  update:function(dt){ t-=dt; if(t<=0){ E.add(-50); streak=0; i++; E.s('lose');
    if(E.score<-100) return E.over('نفد الوقت','أجبت '+i+' سؤالاً'); next(); } },
  draw:function(c){
    E.bg('#0c1020');
    E.rr(60,80,680,180,20,'#1a2136');
    E.tx(q[0],400,170,28,'#e8ecff');
    for(var k=0;k<4;k++){ E.rr(120,330+k*62,560,54,12,'#2b3350');
      E.tx(q[1][k],400,357+k*62,22,'#dfe6ff'); }
    E.rr(120,290,560,12,6,'#1c2338'); E.rr(122,292,556*(t/12),8,4, t<4?'#ff3d7f':'#9dff3d');
    E.hudL('سؤال '+(i+1)+'/12 · تتابع '+streak); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'word-ladder', t:'سلّم الكلمات', c:'words', e:'🪜', tags:['كلمات','ربط'],
d:'اكتب كلمة تبدأ بآخر حرف من الكلمة السابقة، ولا تكرر كلمة. الوقت يضغط.',
how:'اكتب ثم Enter', noPad:true,
make:function(E){
  var used,cur,typed,t,chain,msg,mt;
  function reset(){ used={}; cur='شمس'; used['شمس']=1; typed=''; t=45; chain=1; msg=''; mt=0; }
  reset();
  return {
  key:function(k,d){ if(!d)return;
    if(k==='Backspace'){ typed=typed.slice(0,-1); return; }
    if(k==='Enter'){ submit(); return; }
    if(k.length===1&&/[؀-ۿ]/.test(k)) typed+=k; },
  down:function(x,y){ if(y>480)submit(); },
  update:function(dt){ t-=dt; if(mt>0)mt-=dt;
    if(t<=0) E.over('نفد الوقت 🪜','سلسلة من '+chain+' كلمة'); },
  draw:function(c){
    E.bg('#0d1220');
    E.tx('الكلمة الحالية',400,90,20,'#98a0b8');
    E.tx(cur,400,160,50,'#ffc93d');
    var last=cur[cur.length-1];
    E.tx('ابدأ كلمتك بحرف: '+last,400,230,26,'#9dff3d');
    E.rr(180,300,440,74,14,'#1c2338');
    E.tx(typed||'اكتب…',400,337,30, typed?'#e8ecff':'#4a5480');
    if(mt>0) E.tx(msg,400,410,22,'#ff3d7f');
    E.rr(320,480,160,54,12,'#7c5cff'); E.tx('إرسال',400,507,20,'#fff');
    E.hudL('سلسلة '+chain); E.hud('⏱ '+Math.max(0,t).toFixed(0), t<10?'#ff3d7f':'#fff');
  }};
  function submit(){
    var w=typed.trim(); typed='';
    if(w.length<2){ msg='كلمة قصيرة جداً'; mt=1.5; E.s('buzz'); return; }
    if(used[w]){ msg='استُخدمت من قبل'; mt=1.5; E.s('buzz'); E.add(-20); return; }
    if(w[0]!==cur[cur.length-1]){ msg='يجب أن تبدأ بحرف «'+cur[cur.length-1]+'»'; mt=1.8; E.s('buzz'); E.add(-20); return; }
    used[w]=1; cur=w; chain++; t=Math.min(45,t+6);
    E.add(60+w.length*20); E.s('coin'); msg='ممتاز!'; mt=1;
    if(chain>=15) E.won('سلّم من ١٥ كلمة! 🪜','لغوي بارع'); }
}});

G({id:'restaurant', t:'مطعم الطلبات', c:'brain', e:'🍔', tags:['إدارة','وقت'],
d:'زبائن يطلبون وجبات مختلفة. حضّرها بالترتيب الصحيح قبل أن ينفد صبرهم.',
how:'انقر المكوّنات ثم «قدّم»', noPad:true,
make:function(E){
  var ING=['🍞','🥩','🧀','🥬','🍅','🥓'];
  var orders,plate,t,served,rate;
  function reset(){ orders=[]; plate=[]; t=70; served=0; rate=1.2; add(); }
  function add(){ if(orders.length>=4)return;
    var n=2+E.ri(0,2), o=[];
    for(var i=0;i<n;i++) o.push(E.pick(ING));
    orders.push({o:o,p:16+E.rnd(0,8)}); E.s('blip'); }
  reset();
  return {
  down:function(x,y){
    if(y>470&&y<560){ var i=Math.floor((x-90)/106); if(i>=0&&i<6){ plate.push(ING[i]); E.s('tick'); } return; }
    if(y>560){ if(x<400){ plate=[]; E.s('blip'); } else serve(); return; } },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهت المناوبة 🍔','قدّمت '+served+' طلباً');
    if(Math.random()<dt*(1/rate)) add();
    for(var i=orders.length-1;i>=0;i--){ orders[i].p-=dt;
      if(orders[i].p<=0){ orders.splice(i,1); E.add(-120); E.s('buzz'); E.shake(10); } } },
  draw:function(c){
    E.bg('#20160e');
    orders.forEach(function(o,i){ var x=30+i*196;
      E.rr(x,50,180,170,14,'#2e2418');
      E.spr('🧑',x+90,90,36);
      o.o.forEach(function(e,k){ E.spr(e,x+40+k*36,150,30); });
      E.r(x+16,196,148,8,'#3a2030'); E.r(x+16,196,148*(o.p/24),8, o.p<6?'#ff3d7f':'#9dff3d'); });
    E.rr(250,270,300,170,14,'#3a2c18');
    E.tx('طبقك',400,300,20,'#c8a86a');
    plate.forEach(function(e,i){ E.spr(e,300+i*44,370,34); });
    ING.forEach(function(e,i){ E.rr(90+i*106,470,96,86,12,'#3a2c18'); E.spr(e,138+i*106,513,40); });
    E.rr(20,566,360,30,8,'#5a2030'); E.tx('مسح',200,581,17,'#fff');
    E.rr(420,566,360,30,8,'#2f7a4d'); E.tx('قدّم',600,581,17,'#fff');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · قدّمت '+served); E.hud('النتيجة '+E.score);
  }};
  function serve(){
    for(var i=0;i<orders.length;i++){ var o=orders[i].o;
      if(o.length===plate.length&&o.every(function(e,k){return plate[k]===e;})){
        orders.splice(i,1); served++; E.add(200); E.s('coin'); plate=[]; t+=3; return; } }
    E.add(-60); E.s('buzz'); E.shake(8); plate=[]; }
}});

G({id:'plant-care', t:'اعتنِ بالنبتة', c:'kids', e:'🌱', tags:['هدوء','عناية'],
d:'ماء وشمس وسماد — بالتوازن الصحيح. أكثر من اللازم يقتلها، وأقلّ يذبلها.',
how:'انقر الأزرار الثلاثة عند الحاجة', noPad:true,
make:function(E){
  var w,s,f,growth,t,alive;
  function reset(){ w=50; s=50; f=50; growth=0; t=0; alive=true; }
  reset();
  return {
  down:function(x,y){
    if(y<470)return;
    var i=Math.floor((x-90)/210); if(i<0||i>2)return;
    if(i===0){ w=Math.min(100,w+16); E.s('pop'); }
    if(i===1){ s=Math.min(100,s+16); E.s('blip'); }
    if(i===2){ f=Math.min(100,f+16); E.s('tick'); } },
  update:function(dt){
    if(!alive)return;
    t+=dt;
    w-=dt*5.5; s-=dt*4.2; f-=dt*3;
    var vals=[w,s,f];
    var good=vals.every(function(v){ return v>28&&v<86; });
    if(good){ growth+=dt*4.5; E.add(Math.round(20*dt)); }
    else growth-=dt*1.6;
    if(vals.some(function(v){ return v<=0||v>=100; })){ alive=false;
      E.over('ذبلت النبتة 🥀','نمت إلى '+Math.round(growth)+'٪'); }
    if(growth>=100) E.won('أزهرت النبتة! 🌷','عناية مثالية'); },
  draw:function(c){
    E.sky('#a8d8f8','#e8f4e0');
    E.r(0,430,800,170,'#8a6a3a');
    E.rr(320,400,160,120,16,'#a0522d');
    var h=Math.max(6,growth*2.4);
    E.ln(400,400,400,400-h,'#3d8a2a',10);
    for(var i=1;i<=Math.floor(growth/18);i++){
      var y=400-h*(i/(growth/18+1));
      E.spr('🍃',400+(i%2?26:-26),y,30,(i%2?.5:-.5)); }
    if(growth>75) E.spr('🌸',400,400-h-10,44);
    var L=['💧 ماء','☀️ شمس','🌿 سماد'], V=[w,s,f], C2=['#4d9fff','#ffc93d','#9dff3d'];
    for(var k=0;k<3;k++){
      E.rr(90+k*210,60,180,26,10,'rgba(255,255,255,.6)');
      E.rr(92+k*210,62,176*E.cl(V[k]/100,0,1),22,9, (V[k]>28&&V[k]<86)?C2[k]:'#ff3d7f');
      E.tx(L[k],180+k*210,110,20,'#12305a');
      E.rr(90+k*210,470,180,80,16,'#fff'); E.tx(L[k],180+k*210,510,22,'#12305a'); }
    E.tx('النمو '+Math.round(E.cl(growth,0,100))+'٪',400,560,24,'#12305a');
  }};
}});

G({id:'idle-factory', t:'مصنع النقر', c:'luck', e:'🏭', tags:['تراكمي','ترقية'],
d:'انقر لتنتج، ثم اشترِ عمّالاً وآلات تنتج عنك. كم يمكنك أن تجمع في دقيقتين؟',
how:'انقر الزر الكبير · اشترِ الترقيات', noPad:true,
make:function(E){
  var coins,perClick,perSec,ups,t;
  function reset(){ coins=0; perClick=1; perSec=0; t=120;
    ups=[{n:'يد أسرع',c:20,d:'+١ لكل نقرة',f:function(){perClick+=1;}},
         {n:'عامل',c:50,d:'+١ في الثانية',f:function(){perSec+=1;}},
         {n:'آلة',c:250,d:'+٦ في الثانية',f:function(){perSec+=6;}},
         {n:'مصنع',c:1200,d:'+٣٠ في الثانية',f:function(){perSec+=30;}},
         {n:'مطرقة ذهبية',c:400,d:'×٢ لكل نقرة',f:function(){perClick*=2;}}]; }
  reset();
  return {
  down:function(x,y){
    if(x<440&&y>150&&y<480&&E.dist(x,y,220,320)<150){
      coins+=perClick; E.add(perClick); E.s('coin'); E.rise(220,300,'#ffc93d',3); return; }
    if(x>460){ var i=Math.floor((y-90)/94); if(i<0||i>=ups.length)return;
      var u=ups[i];
      if(coins>=u.c){ coins-=u.c; u.f(); u.c=Math.round(u.c*1.75); E.s('power'); }
      else E.s('buzz'); } },
  update:function(dt){ t-=dt;
    coins+=perSec*dt; E.add(Math.round(perSec*dt));
    if(t<=0) E.won('انتهى الوقت 🏭','أنتجت '+Math.round(coins)+' عملة'); },
  draw:function(c){
    E.bg('#131a12');
    E.o(220,320,150,'#2f7a4d'); E.ring(220,320,150,'#9dff3d',5);
    E.spr('🏭',220,300,90); E.tx('انقر!',220,400,26,'#eaffd0');
    E.tx(Math.round(coins)+' 🪙',220,90,40,'#ffc93d');
    E.tx('+'+perClick+' لكل نقرة  ·  +'+perSec+'/ث',220,140,18,'#98a0b8');
    ups.forEach(function(u,i){ var y=90+i*94;
      E.rr(470,y,310,84,12, coins>=u.c?'#2b3350':'#1a1f2e');
      E.tx(u.n,760,y+28,20,'#dfe6ff','right');
      E.tx(u.d,760,y+54,15,'#98a0b8','right');
      E.tx(u.c+' 🪙',490,y+42,18, coins>=u.c?'#9dff3d':'#ff3d7f','left'); });
    E.hud('⏱ '+Math.max(0,t).toFixed(0));
  }};
}});

G({id:'zuma-line', t:'سلسلة الكرات', c:'action', e:'🔮', tags:['تصويب','مطابقة'],
d:'كرات ملوّنة تزحف نحو الحفرة. أطلق كرة لتصنع ثلاثاً متشابهة فتختفي.',
how:'وجّه بالفأرة وانقر للإطلاق', noPad:true,
make:function(E){
  var path,line,shot,cur,next,sp,lvl;
  var C=['#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#c93dff'];
  function mkPath(){ path=[];
    for(var i=0;i<=520;i++){ var t=i/520;
      path.push({ x:80+t*640 + Math.sin(t*9)*0, y:70+ Math.sin(t*7)*0 + t*0 }); }
    path=[]; var a=0;
    for(var k=0;k<620;k++){ var tt=k/620;
      var r=60+tt*180, ang=tt*8.4;
      path.push({x:400+Math.cos(ang)*r*1.6, y:300+Math.sin(ang)*r*.9}); }
    path.reverse(); }
  function reset(){ mkPath(); line=[]; sp=22; lvl=1;
    for(var i=0;i<26;i++) line.push({p:i*13,c:E.ri(0,4)});
    shot=null; cur=E.ri(0,4); next=E.ri(0,4); }
  reset();
  return {
  down:function(x,y){ if(shot)return;
    var a=Math.atan2(y-300,x-400);
    shot={x:400,y:300,vx:Math.cos(a)*560,vy:Math.sin(a)*560,c:cur};
    cur=next; next=E.ri(0,4); E.s('laser'); },
  update:function(dt){
    line.forEach(function(b){ b.p+=sp*dt; });
    for(var i=0;i<line.length;i++) if(line[i].p>=path.length-1)
      return E.over('وصلت الكرات للحفرة','النتيجة '+E.score);
    if(shot){ shot.x+=shot.vx*dt; shot.y+=shot.vy*dt;
      if(shot.x<0||shot.x>800||shot.y<0||shot.y>600){ shot=null; return; }
      for(var k=0;k<line.length;k++){ var b=line[k], pt=path[Math.floor(b.p)];
        if(pt&&E.dist(shot.x,shot.y,pt.x,pt.y)<24){
          line.splice(k,0,{p:b.p-6,c:shot.c}); shot=null;
          for(var j=0;j<line.length;j++) line[j].p = line[0].p + j*13;
          check(k); return; } } } },
  draw:function(c){
    E.bg('#1a1230');
    c.strokeStyle='rgba(255,255,255,.05)'; c.lineWidth=26; c.beginPath();
    path.forEach(function(p,i){ if(i%6)return; i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y); }); c.stroke();
    line.forEach(function(b){ var pt=path[Math.floor(E.cl(b.p,0,path.length-1))];
      if(pt) E.o(pt.x,pt.y,13,C[b.c]); });
    if(shot) E.o(shot.x,shot.y,13,C[shot.c]);
    var a=Math.atan2(E.m.y-300,E.m.x-400);
    E.ln(400,300,400+Math.cos(a)*90,300+Math.sin(a)*90,'rgba(255,255,255,.3)',4);
    E.o(400,300,17,C[cur]); E.o(400,340,11,C[next]);
    E.spr('🕳️',path[path.length-1].x,path[path.length-1].y,34);
    E.hud('النتيجة '+E.score); E.hudL('كرات '+line.length);
  }};
  function check(i){
    var col=line[i].c, a=i,b=i;
    while(a>0&&line[a-1].c===col)a--;
    while(b<line.length-1&&line[b+1].c===col)b++;
    if(b-a+1>=3){ var n=b-a+1;
      for(var k=a;k<=b;k++){ var pt=path[Math.floor(line[k].p)];
        if(pt) E.burst(pt.x,pt.y,[C[col]],10,150); }
      line.splice(a,n); E.add(n*60); E.s('pop');
      for(var j=0;j<line.length;j++) line[j].p = line[0].p + j*13;
      if(a<line.length&&a>0) check(a-1); }
    if(!line.length){ E.add(500); E.s('win'); lvl++; sp+=6;
      if(lvl>4) return E.won('نظّفت المسار! 🔮','أربع مراحل');
      for(var q=0;q<26+lvl*4;q++) line.push({p:q*13,c:E.ri(0,4)}); } }
}});

G({id:'traffic-light', t:'شرطي المرور', c:'brain', e:'🚦', tags:['إدارة','ضغط'],
d:'تقاطع مزدحم وأنت الإشارة. بدّل الاتجاهات لتمنع الاصطدام وتقلّل الازدحام.',
how:'انقر لتبديل الاتجاه المفتوح', noPad:true,
make:function(E){
  var dir,cars,t,passed,rate;
  function reset(){ dir=0; cars=[]; t=70; passed=0; rate=1.1; }
  reset();
  return {
  down:function(){ dir=1-dir; E.s('tick'); },
  key:function(k,d){ if(d&&k===' ')dir=1-dir; },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهت المناوبة 🚦','مرّرت '+passed+' سيارة');
    rate=1.1+(70-t)*.02;
    if(Math.random()<dt*rate&&cars.length<16){
      var d2=E.ri(0,3);
      cars.push({d:d2,p:0,sp:E.rnd(80,140),wait:0}); }
    cars.forEach(function(c2){
      var axis = (c2.d===0||c2.d===2)?0:1;
      var atLight = c2.p>240&&c2.p<300;
      if(atLight&&axis!==dir){ c2.wait+=dt; E.add(Math.round(-4*dt)); }
      else c2.p+=c2.sp*dt;
      if(c2.wait>12){ E.over('ازدحام خانق 🚦','مرّرت '+passed+' سيارة'); } });
    for(var i=cars.length-1;i>=0;i--){ if(cars[i].p>760){ cars.splice(i,1); passed++; E.add(60); E.s('tick'); } }
    for(var a=0;a<cars.length;a++)for(var b=a+1;b<cars.length;b++){
      var x1=pos(cars[a]), x2=pos(cars[b]);
      if(cars[a].d!==cars[b].d&&E.dist(x1.x,x1.y,x2.x,x2.y)<26){
        E.shake(22); E.s('boom'); return E.over('وقع حادث! 💥','مرّرت '+passed+' سيارة'); } } },
  draw:function(c){
    E.bg('#1a2a1a');
    E.r(0,250,800,100,'#2e3038'); E.r(350,0,100,600,'#2e3038');
    cars.forEach(function(c2){ var p=pos(c2);
      E.spr(['🚗','🚙','🚕','🚚'][c2.d],p.x,p.y,32, c2.d===0?0:c2.d===1?1.57:c2.d===2?3.14:-1.57); });
    E.o(370,230,12, dir===0?'#3dd17a':'#5a2030'); E.o(430,230,12, dir===1?'#3dd17a':'#5a2030');
    E.tx(dir===0?'أفقي مفتوح ↔':'رأسي مفتوح ↕',400,50,26,'#9dff3d');
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · مرّ '+passed); E.hud('النتيجة '+E.score);
    E.tx('انقر لتبديل الإشارة',400,585,15,'#6d7590');
  }};
  function pos(c2){
    if(c2.d===0) return {x:c2.p,y:280};
    if(c2.d===2) return {x:800-c2.p,y:320};
    if(c2.d===1) return {x:380,y:c2.p*0.75};
    return {x:420,y:600-c2.p*0.75}; }
}});

G({id:'lights-speed', t:'الأضواء السريعة', c:'speed', e:'💡', tags:['ردّ فعل','دقّة'],
d:'أضواء تومض في شبكة. أطفئ كل ضوء قبل أن ينطفئ وحده — والسرعة ترتفع بلا رحمة.',
how:'انقر الأضواء المضاءة', noPad:true,
make:function(E){
  var N=5,cells,t,rate,missed,hits;
  function reset(){ cells=[]; for(var i=0;i<N*N;i++)cells.push(0);
    t=45; rate=1.6; missed=0; hits=0; }
  reset();
  return {
  down:function(x,y){
    var S=88,OX=(800-N*S)/2,OY=(600-N*S)/2+10;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-OY)/S);
    if(cx<0||cy<0||cx>=N||cy>=N)return;
    var i=cy*N+cx;
    if(cells[i]>0){ cells[i]=0; hits++; E.add(40); E.s('pop'); E.burst(OX+cx*S+S/2,OY+cy*S+S/2,['#ffc93d'],8); }
    else { E.add(-25); E.s('buzz'); } },
  update:function(dt){
    t-=dt; if(t<=0) return E.won('انتهى الوقت 💡','أطفأت '+hits+' ضوءاً');
    rate=1.6+(45-t)*.13;
    if(Math.random()<dt*rate){ var i=E.ri(0,N*N-1); if(!cells[i]) cells[i]=Math.max(.7,2.2-(45-t)*.03); }
    for(var k=0;k<N*N;k++) if(cells[k]>0){ cells[k]-=dt;
      if(cells[k]<=0){ missed++; E.add(-50); E.s('tick');
        if(missed>=15) return E.over('فاتك ١٥ ضوءاً','أطفأت '+hits); } } },
  draw:function(c){
    E.bg('#0a0d16');
    var S=88,OX=(800-N*S)/2,OY=(600-N*S)/2+10;
    for(var i=0;i<N*N;i++){ var x=OX+(i%N)*S, y=OY+((i/N)|0)*S;
      var on=cells[i]>0;
      if(on) E.o(x+S/2,y+S/2,S*.52,'rgba(255,201,61,.14)');
      E.rr(x+5,y+5,S-10,S-10,14, on?'#ffc93d':'#1a2036');
      if(on){ E.r(x+10,y+S-14,(S-20)*E.cl(cells[i]/2.2,0,1),5,'#0b0d14'); } }
    E.hudL('⏱ '+Math.max(0,t).toFixed(0)+' · فاتك '+missed+'/15'); E.hud('النتيجة '+E.score);
  }};
}});
