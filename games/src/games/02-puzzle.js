/* ============ 2) ألغاز وتفكير ============ */

G({id:'n2048', t:'٢٠٤٨ بالعربي', c:'puzzle', e:'🔢', tags:['أرقام','تفكير'],
d:'ادمج الأرقام المتشابهة حتى تصل إلى ٢٠٤٨ — ثم لا تتوقّف.',
how:'الأسهم أو اسحب',
make:function(E){
  var b,won,over;
  function reset(){ b=[]; for(var i=0;i<16;i++)b.push(0); won=false; over=false; add(); add(); }
  function add(){ var f=[]; for(var i=0;i<16;i++) if(!b[i])f.push(i);
    if(!f.length)return; b[E.pick(f)]=Math.random()<.9?2:4; }
  reset();
  function move(dx,dy){
    var moved=false;
    var order=[]; for(var i=0;i<16;i++)order.push(i);
    if(dx>0||dy>0) order.reverse();
    order.forEach(function(i){
      if(!b[i])return; var x=i%4,y=(i/4)|0, cx=x,cy=y;
      while(true){ var nx=cx+dx, ny=cy+dy;
        if(nx<0||ny<0||nx>3||ny>3)break;
        var ni=ny*4+nx, ci=cy*4+cx;
        if(!b[ni]){ b[ni]=b[ci]; b[ci]=0; cx=nx; cy=ny; moved=true; }
        else if(b[ni]===b[ci] && !b[ni+100]){ b[ni]*=2; b[ci]=0; E.add(b[ni]); moved=true; E.s('pop');
          if(b[ni]>=2048&&!won){ won=true; E.won('وصلت إلى ٢٠٤٨! 🎉','تابع اللعب إن أردت'); } break; }
        else break; } });
    if(moved){ add(); E.s('blip'); }
    if(!b.some(function(v){return !v;})){
      var can=false;
      for(var y=0;y<4;y++)for(var x=0;x<4;x++){ var v=b[y*4+x];
        if(x<3&&b[y*4+x+1]===v)can=true; if(y<3&&b[(y+1)*4+x]===v)can=true; }
      if(!can) E.over('اللوح ممتلئ','لا حركات متبقية'); }
  }
  var COL={2:'#3a4160',4:'#4a5480',8:'#7c5cff',16:'#9b5cff',32:'#ff6b9d',64:'#ff3d7f',
    128:'#ffc93d',256:'#ff9f3d',512:'#9dff3d',1024:'#3dffb0',2048:'#00d4ff'};
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')move(-1,0); if(k==='ArrowRight')move(1,0);
    if(k==='ArrowUp')move(0,-1); if(k==='ArrowDown')move(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<25)return;
    if(Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1,0); else move(0,dy>0?1:-1); },
  draw:function(c){
    E.bg('#0d101c');
    var S=110,OX=180,OY=90;
    E.rr(OX-10,OY-10,S*4+20,S*4+20,14,'#1a1f33');
    for(var i=0;i<16;i++){ var x=OX+(i%4)*S, y=OY+((i/4)|0)*S, v=b[i];
      E.rr(x+4,y+4,S-8,S-8,10, v?(COL[v]||'#00d4ff'):'rgba(255,255,255,.05)');
      if(v) E.tx(v, x+S/2, y+S/2, v>999?32:v>99?38:44, v<=4?'#dfe6ff':'#0b0d14', 'center', 800); }
    E.tx('النتيجة: '+E.score,400,50,26,'#ffc93d');
  }};
}});

G({id:'box-push', t:'دفع الصناديق', c:'puzzle', e:'📦', tags:['تفكير','كلاسيكي'],
d:'ادفع كل صندوق إلى نقطته. لا يمكنك السحب — فكّر قبل أن تدفع.',
how:'الأسهم · R لإعادة المرحلة',
make:function(E){
  var LV=[
    ["#######","#..O..#","#.#B#.#","#..P..#","#.#B#.#","#..O..#","#######"],
    ["########","#..O...#","#.BB.O.#","#..P.#.#","#.#..#.#","#...O..#","#..B...#","########"],
    ["#########","#...#...#","#.OBO.B.#","#..#P#..#","#.B.O.O.#","#...#.B.#","#########"],
    ["########","#OO....#","#OO.BB.#","#O..B.P#","#...BB.#","#......#","########"]
  ];
  var lvl,g,px,py,moves;
  function loadLv(){ var src=LV[lvl%LV.length]; g=src.map(function(r){return r.split('');}); moves=0;
    g.forEach(function(r,y){ r.forEach(function(ch,x){ if(ch==='P'){px=x;py=y;g[y][x]='.';} }); }); }
  function reset(){ lvl=0; loadLv(); }
  reset();
  function at(x,y){ return (g[y]&&g[y][x])||'#'; }
  function step(dx,dy){
    var nx=px+dx, ny=py+dy, t=at(nx,ny);
    if(t==='#')return;
    if(t==='B'||t==='*'){ var bx=nx+dx, by=ny+dy, t2=at(bx,by);
      if(t2==='#'||t2==='B'||t2==='*')return;
      g[ny][nx]= t==='*'?'O':'.';
      g[by][bx]= t2==='O'?'*':'B'; E.s('thud'); }
    else E.s('tick');
    px=nx; py=ny; moves++;
    var done=true; g.forEach(function(r){ r.forEach(function(ch){ if(ch==='B')done=false; }); });
    if(done){ E.add(500-moves*5); E.s('win'); lvl++;
      if(lvl>=LV.length) return E.won('أنهيت كل المراحل! 🏆','بحركات: '+moves);
      loadLv(); }
  }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')step(-1,0); if(k==='ArrowRight')step(1,0);
    if(k==='ArrowUp')step(0,-1); if(k==='ArrowDown')step(0,1);
    if(k==='r'||k==='R')loadLv(); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))step(dx>0?1:-1,0); else step(0,dy>0?1:-1); },
  draw:function(c){
    E.bg('#12141f');
    var S=64, W=g[0].length, H=g.length, OX=(800-W*S)/2, OY=(600-H*S)/2+10;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){ var ch=g[y][x], gx=OX+x*S, gy=OY+y*S;
      if(ch==='#'){ E.rr(gx+2,gy+2,S-4,S-4,7,'#39406b'); continue; }
      E.rr(gx+2,gy+2,S-4,S-4,7,'#1c2136');
      if(ch==='O') E.spr('🎯',gx+S/2,gy+S/2,26);
      if(ch==='B') E.spr('📦',gx+S/2,gy+S/2,40);
      if(ch==='*') E.spr('✅',gx+S/2,gy+S/2,38); }
    E.spr('🧍',OX+px*S+S/2,OY+py*S+S/2,40);
    E.hudL('مرحلة '+(lvl+1)+'/'+LV.length+' · حركات '+moves); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'slide15', t:'لغز الانزلاق', c:'puzzle', e:'🔀', tags:['كلاسيكي','ترتيب'],
d:'رتّب الأرقام من ١ إلى ١٥ بتحريك المربعات نحو الفراغ.',
how:'انقر مربعاً بجانب الفراغ',
make:function(E){
  var t,moves,tm;
  function reset(){ t=[]; for(var i=1;i<16;i++)t.push(i); t.push(0);
    for(var k=0;k<300;k++){ var z=t.indexOf(0), zx=z%4, zy=(z/4)|0;
      var o=E.pick([[1,0],[-1,0],[0,1],[0,-1]]), nx=zx+o[0], ny=zy+o[1];
      if(nx<0||ny<0||nx>3||ny>3)continue; t[z]=t[ny*4+nx]; t[ny*4+nx]=0; }
    moves=0; tm=0; }
  reset();
  function solved(){ for(var i=0;i<15;i++) if(t[i]!==i+1)return false; return true; }
  return {
  down:function(mx,my){
    var S=120,OX=160,OY=60, x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>3||y>3)return;
    var i=y*4+x, z=t.indexOf(0), zx=z%4, zy=(z/4)|0;
    if(Math.abs(zx-x)+Math.abs(zy-y)!==1)return;
    t[z]=t[i]; t[i]=0; moves++; E.s('tick');
    if(solved()){ E.add(Math.max(50,3000-moves*20-Math.floor(tm)*5)); E.won('رتّبتها! 🎉',moves+' حركة في '+tm.toFixed(0)+' ثانية'); } },
  update:function(dt){ tm+=dt; E.setScore(Math.max(0,3000-moves*20-Math.floor(tm)*5)); },
  draw:function(c){
    E.bg('#0e1120');
    var S=120,OX=160,OY=60;
    E.rr(OX-8,OY-8,S*4+16,S*4+16,14,'#191e33');
    for(var i=0;i<16;i++){ var v=t[i]; if(!v)continue;
      var x=OX+(i%4)*S, y=OY+((i/4)|0)*S, right=(v===i+1);
      E.rr(x+5,y+5,S-10,S-10,12, right?'#2f7a4d':'#3a4270');
      E.tx(v,x+S/2,y+S/2,44,'#fff'); }
    E.tx('حركات: '+moves+'  ·  الوقت '+tm.toFixed(0)+'ث',400,565,20,'#98a0b8');
  }};
}});

G({id:'mines', t:'كانسة الألغام', c:'brain', e:'💣', tags:['منطق','كلاسيكي'],
d:'اكشف كل المربعات الآمنة. نقرة طويلة أو زر ثانٍ لوضع علم.',
how:'انقر للكشف · اضغط مطوّلاً للعَلَم',
make:function(E){
  var W=16,H=12,M=30,g,revd,flag,dead,win,t0,first;
  function reset(){ g=[];revd=[];flag=[]; dead=false; win=false; t0=0; first=true;
    for(var i=0;i<W*H;i++){ g.push(0); revd.push(false); flag.push(false); } }
  function place(sx,sy){ var n=0;
    while(n<M){ var i=E.ri(0,W*H-1); var x=i%W,y=(i/W)|0;
      if(g[i]===-1)continue; if(Math.abs(x-sx)<2&&Math.abs(y-sy)<2)continue; g[i]=-1; n++; }
    for(var y2=0;y2<H;y2++)for(var x2=0;x2<W;x2++){ var j=y2*W+x2; if(g[j]===-1)continue;
      var c=0; for(var dy=-1;dy<2;dy++)for(var dx=-1;dx<2;dx++){ var nx=x2+dx,ny=y2+dy;
        if(nx>=0&&ny>=0&&nx<W&&ny<H&&g[ny*W+nx]===-1)c++; } g[j]=c; } }
  reset();
  function open(x,y){ if(x<0||y<0||x>=W||y>=H)return; var i=y*W+x;
    if(revd[i]||flag[i])return; revd[i]=true;
    if(g[i]===-1){ dead=true; E.shake(20); E.over('انفجر اللغم 💥','حاول أن تفكّر لا أن تخمّن'); return; }
    E.add(5);
    if(g[i]===0) for(var dy=-1;dy<2;dy++)for(var dx=-1;dx<2;dx++) if(dx||dy) open(x+dx,y+dy); }
  function check(){ var n=0; for(var i=0;i<W*H;i++) if(!revd[i])n++;
    if(n===M&&!win){ win=true; E.add(500); E.won('نظّفت الحقل! 🚩','بلا خسائر'); } }
  var COL=['','#4d9fff','#3dd17a','#ff9f3d','#ff3d7f','#c93dff','#00d4ff','#fff','#98a0b8'];
  return {
  down:function(mx,my){ this._t=Date.now(); this._p=[mx,my]; },
  up:function(mx,my){
    if(dead||win)return;
    var S=44,OX=(800-W*S)/2,OY=60, x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=W||y>=H)return;
    var i=y*W+x, longPress=Date.now()-(this._t||0)>350;
    if(longPress){ if(!revd[i]){ flag[i]=!flag[i]; E.s('blip'); } return; }
    if(first){ place(x,y); first=false; }
    open(x,y); E.s('tick'); check(); },
  key:function(k,d){ if(d&&k==='f'){ } },
  update:function(dt){ if(!dead&&!win&&!first)t0+=dt; },
  draw:function(c){
    E.bg('#0d1019');
    var S=44,OX=(800-W*S)/2,OY=60;
    for(var i=0;i<W*H;i++){ var x=OX+(i%W)*S, y=OY+((i/W)|0)*S;
      if(revd[i]){ E.rr(x+1,y+1,S-2,S-2,4,'#1b2136');
        if(g[i]===-1) E.spr('💣',x+S/2,y+S/2,26);
        else if(g[i]>0) E.tx(g[i],x+S/2,y+S/2,22,COL[g[i]]); }
      else { E.rr(x+1,y+1,S-2,S-2,5,'#39406b');
        if(flag[i]) E.spr('🚩',x+S/2,y+S/2,22); } }
    var fl=flag.filter(Boolean).length;
    E.hudL('💣 '+(M-fl)+'  ·  ⏱ '+t0.toFixed(0)+'ث'); E.hud('النتيجة '+E.score);
    E.tx('اضغط مطوّلاً لوضع عَلَم',400,575,15,'#6d7590');
  }};
}});

G({id:'lights-off', t:'أطفئ كل الأنوار', c:'brain', e:'💡', tags:['منطق','ألغاز'],
d:'كل ضغطة تقلب المصباح وجيرانه. أطفئ اللوح كله بأقل ضغطات.',
how:'انقر أي مصباح',
make:function(E){
  var N=5,g,moves,lvl;
  function reset(){ lvl=1; gen(); }
  function gen(){ g=[]; for(var i=0;i<N*N;i++)g.push(false); moves=0;
    for(var k=0;k<3+lvl*2;k++) flip(E.ri(0,N-1),E.ri(0,N-1),true); }
  function flip(x,y,silent){ [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){
    var nx=x+o[0],ny=y+o[1]; if(nx>=0&&ny>=0&&nx<N&&ny<N) g[ny*N+nx]=!g[ny*N+nx]; });
    if(!silent){ moves++; E.s('blip'); } }
  reset();
  return {
  down:function(mx,my){
    var S=90,OX=(800-N*S)/2,OY=100, x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=N||y>=N)return;
    flip(x,y);
    if(g.every(function(v){return !v;})){ E.add(Math.max(20,300-moves*10)); E.s('win');
      lvl++; if(lvl>8) return E.won('أطفأت كل المستويات! 🌙','أنت خبير أنوار'); gen(); } },
  draw:function(c){
    E.bg('#080a12');
    var S=90,OX=(800-N*S)/2,OY=100;
    for(var i=0;i<N*N;i++){ var x=OX+(i%N)*S, y=OY+((i/N)|0)*S;
      if(g[i]){ E.o(x+S/2,y+S/2,S*.42,'rgba(255,201,61,.18)');
        E.rr(x+6,y+6,S-12,S-12,16,'#ffc93d'); E.spr('💡',x+S/2,y+S/2,34); }
      else { E.rr(x+6,y+6,S-12,S-12,16,'#1a1f33'); E.alpha(.28,function(){ E.spr('💡',x+S/2,y+S/2,30); }); } }
    E.tx('مستوى '+lvl+'  ·  ضغطات '+moves,400,50,24,'#98a0b8');
    E.tx('المتبقّي مضاءً: '+g.filter(Boolean).length,400,560,20,'#9dff3d');
  }};
}});

G({id:'hanoi', t:'أبراج هانوي', c:'brain', e:'🗼', tags:['منطق','كلاسيكي'],
d:'انقل البرج كله إلى العمود الأخير. لا يجوز وضع قرص كبير فوق صغير.',
how:'انقر عموداً لالتقاط قرص ثم عموداً لإسقاطه',
make:function(E){
  var N,pegs,hold,moves,lvl;
  function reset(){ lvl=3; setup(); }
  function setup(){ N=lvl; pegs=[[],[],[]]; for(var i=N;i>=1;i--)pegs[0].push(i); hold=null; moves=0; }
  reset();
  return {
  down:function(mx,my){
    var p=E.cl(Math.floor(mx/266),0,2);
    if(hold===null){ if(pegs[p].length){ hold={d:pegs[p].pop(),from:p}; E.s('blip'); } }
    else { var top=pegs[p][pegs[p].length-1];
      if(!top||top>hold.d){ pegs[p].push(hold.d); if(p!==hold.from)moves++; hold=null; E.s('tick');
        if(pegs[2].length===N){ E.add((N*200)-moves*5); E.s('win'); lvl++;
          if(lvl>6) return E.won('أتقنت هانوي! 🗼','ست طبقات كاملة'); setTimeout(setup,300); } }
      else { E.s('buzz'); } } },
  draw:function(c){
    E.bg('#0e1018');
    E.r(0,500,800,14,'#3a4270');
    var COL=['#ff3d7f','#ff9f3d','#ffc93d','#9dff3d','#00d4ff','#7c5cff'];
    for(var p=0;p<3;p++){ var cx=133+p*266;
      E.r(cx-6,220,12,282,'#39406b');
      pegs[p].forEach(function(d,i){ var w=50+d*36;
        E.rr(cx-w/2,486-i*30,w,26,8,COL[(d-1)%6]);
        E.tx(d,cx,499-i*30,16,'#0b0d14'); }); }
    if(hold){ var w2=50+hold.d*36; E.rr(E.m.x-w2/2,120,w2,26,8,COL[(hold.d-1)%6]); }
    E.tx('أقراص: '+N+'  ·  حركات: '+moves+'  ·  الأمثل: '+(Math.pow(2,N)-1),400,50,22,'#98a0b8');
  }};
}});

G({id:'pipe-flow', t:'وصّل الأنابيب', c:'puzzle', e:'🚰', tags:['منطق','دوران'],
d:'أدر القطع حتى يصل الماء من الصنبور إلى الكأس قبل أن ينفد الوقت.',
how:'انقر أي قطعة لتدويرها',
make:function(E){
  var W=7,H=5,g,lvl,tm,flowed;
  var T={ I:[[0,2],[1,3]], L:[[0,1],[1,2],[2,3],[3,0]], T:[[0,1,2],[1,2,3],[2,3,0],[3,0,1]] };
  function reset(){ lvl=1; gen(); }
  function gen(){ g=[]; tm=45+lvl*5; flowed=false;
    for(var i=0;i<W*H;i++){ var t=E.pick(['I','L','L','T']); g.push({t:t,r:E.ri(0,3)}); }
    var y=E.ri(0,H-1), path=[];
    var cy=y; for(var x=0;x<W;x++){ path.push({x:x,y:cy});
      if(x<W-1 && Math.random()<.5 && cy<H-1){ cy++; path.push({x:x,y:cy}); }
      else if(x<W-1 && Math.random()<.3 && cy>0){ cy--; path.push({x:x,y:cy}); } }
    for(var i2=0;i2<path.length;i2++){ var p=path[i2], prev=path[i2-1], nx=path[i2+1];
      var cons=[]; if(prev)cons.push(dirOf(p,prev)); if(nx)cons.push(dirOf(p,nx));
      if(!prev)cons.push(3); if(!nx)cons.push(1);
      var cell=g[p.y*W+p.x];
      cell.t = (cons[0]+2)%4===cons[1] ? 'I' : 'L';
      cell.fixed=cons; cell.r=E.ri(0,3); } }
  function dirOf(a,b){ if(b.y<a.y)return 0; if(b.x>a.x)return 1; if(b.y>a.y)return 2; return 3; }
  reset();
  function conns(c2){ var base=T[c2.t]; return base[(c2.r)%base.length]; }
  function solve(){
    var seen={}, st=[{x:0,y:startY()}], ok=false;
    if(startY()<0) return false;
    while(st.length){ var p=st.pop(), k=p.x+','+p.y;
      if(seen[k])continue; seen[k]=1;
      if(p.x===W-1){ ok=true; }
      var cs=conns(g[p.y*W+p.x]);
      cs.forEach(function(d){ var o=[[0,-1],[1,0],[0,1],[-1,0]][d], nx=p.x+o[0], ny=p.y+o[1];
        if(nx<0||ny<0||nx>=W||ny>=H)return;
        var back=(d+2)%4; if(conns(g[ny*W+nx]).indexOf(back)>=0) st.push({x:nx,y:ny}); }); }
    return ok;
  }
  function startY(){ for(var y=0;y<H;y++) if(conns(g[y*W]).indexOf(3)>=0) return y; return -1; }
  return {
  down:function(mx,my){
    var S=90,OX=(800-W*S)/2,OY=90, x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=W||y>=H)return;
    g[y*W+x].r=(g[y*W+x].r+1)%4; E.s('tick');
    if(solve()&&!flowed){ flowed=true; E.add(200+Math.floor(tm)*5); E.s('win');
      lvl++; setTimeout(function(){ if(lvl>6) E.won('سبّاك محترف! 🚰','ستّ شبكات كاملة'); else gen(); },600); } },
  update:function(dt){ if(!flowed){ tm-=dt; if(tm<=0) E.over('نفد الوقت','المستوى '+lvl); } },
  draw:function(c){
    E.bg('#0b1018');
    var S=90,OX=(800-W*S)/2,OY=90, on=solve();
    for(var i=0;i<W*H;i++){ var x=OX+(i%W)*S, y=OY+((i/W)|0)*S;
      E.rr(x+3,y+3,S-6,S-6,10,'#171d30');
      var cs=conns(g[i]);
      cs.forEach(function(d){ var o=[[0,-1],[1,0],[0,1],[-1,0]][d];
        E.ln(x+S/2,y+S/2,x+S/2+o[0]*S/2,y+S/2+o[1]*S/2, on?'#00d4ff':'#5b6488',12); });
      E.o(x+S/2,y+S/2,8,on?'#8ce9ff':'#79839f'); }
    E.spr('🚰',OX-32,OY+startY()*S+S/2,34);
    E.spr(on?'💧':'🥛',OX+W*S+32,OY+S*2+S/2,34);
    E.hudL('مستوى '+lvl); E.hud('⏱ '+Math.max(0,tm).toFixed(0), tm<10?'#ff3d7f':'#fff');
  }};
}});

G({id:'flood', t:'طوفان الألوان', c:'puzzle', e:'🎨', tags:['ألوان','تفكير'],
d:'ابدأ من الزاوية ولوّن اللوح كله بلون واحد خلال عدد محدود من الخطوات.',
how:'انقر لوناً من الأسفل',
make:function(E){
  var N=14,g,left,lvl,C=['#ff3d7f','#ffc93d','#9dff3d','#00d4ff','#7c5cff','#ff9f3d'];
  function reset(){ lvl=1; gen(); }
  function gen(){ g=[]; for(var i=0;i<N*N;i++)g.push(E.ri(0,5)); left=22-lvl; }
  reset();
  function fill(nc){
    var oc=g[0]; if(oc===nc)return;
    var st=[0],seen={};
    while(st.length){ var i=st.pop(); if(seen[i]||g[i]!==oc)continue; seen[i]=1; g[i]=nc;
      var x=i%N,y=(i/N)|0;
      if(x>0)st.push(i-1); if(x<N-1)st.push(i+1); if(y>0)st.push(i-N); if(y<N-1)st.push(i+N); }
    left--; E.s('pop');
    if(g.every(function(v){return v===nc;})){ E.add(100+left*20); E.s('win'); lvl++;
      if(lvl>6) return E.won('غمرت كل الألواح! 🎨','ستّ مراحل'); gen(); }
    else if(left<=0) E.over('نفدت الخطوات','المرحلة '+lvl);
  }
  return {
  down:function(mx,my){
    if(my>500){ var i=Math.floor((mx-100)/100); if(i>=0&&i<6) fill(i); } },
  draw:function(c){
    E.bg('#0b0e18');
    var S=32,OX=(800-N*S)/2,OY=50;
    for(var i=0;i<N*N;i++) E.r(OX+(i%N)*S,OY+((i/N)|0)*S,S,S,C[g[i]]);
    E.sr(OX,OY,N*S,N*S,'#39406b',3);
    for(var k=0;k<6;k++) E.rr(100+k*100+8,505,84,60,14,C[k]);
    E.tx('خطوات متبقية: '+left,400,585,17, left<4?'#ff3d7f':'#98a0b8');
    E.hudL('مرحلة '+lvl); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'labyrinth', t:'متاهة لا تنتهي', c:'puzzle', e:'🌀', tags:['متاهة','استكشاف'],
d:'متاهة جديدة كل مرة، والرؤية محدودة حولك فقط.',
how:'الأسهم للتحرّك نحو الخروج 🏁',
make:function(E){
  var W=21,H=15,m,px,py,lvl,steps;
  function gen(){ m=[]; for(var y=0;y<H;y++){ m.push([]); for(var x=0;x<W;x++) m[y].push(1); }
    var st=[[1,1]]; m[1][1]=0;
    while(st.length){ var cur=st[st.length-1], x=cur[0], y=cur[1];
      var opts=[[2,0],[-2,0],[0,2],[0,-2]].filter(function(o){
        var nx=x+o[0], ny=y+o[1]; return nx>0&&ny>0&&nx<W-1&&ny<H-1&&m[ny][nx]===1; });
      if(!opts.length){ st.pop(); continue; }
      var o2=E.pick(opts); m[y+o2[1]/2][x+o2[0]/2]=0; m[y+o2[1]][x+o2[0]]=0; st.push([x+o2[0],y+o2[1]]); }
    m[H-2][W-2]=0; px=1; py=1; }
  function reset(){ lvl=1; steps=0; gen(); }
  reset();
  function mv(dx,dy){ var nx=px+dx, ny=py+dy;
    if(m[ny]&&m[ny][nx]===0){ px=nx; py=ny; steps++; E.s('tick');
      if(px===W-2&&py===H-2){ E.add(300-Math.min(250,steps)); E.s('win'); lvl++; steps=0;
        if(lvl>5) return E.won('خرجت من كل المتاهات! 🏁','خمس متاهات'); gen(); } } }
  return {
  key:function(k,d){ if(!d)return;
    if(k==='ArrowLeft')mv(-1,0); if(k==='ArrowRight')mv(1,0);
    if(k==='ArrowUp')mv(0,-1); if(k==='ArrowDown')mv(0,1); },
  down:function(x,y){ this._x=x;this._y=y; },
  up:function(x,y){ var dx=x-this._x,dy=y-this._y; if(Math.abs(dx)+Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))mv(dx>0?1:-1,0); else mv(0,dy>0?1:-1); },
  draw:function(c){
    E.bg('#05070e');
    var S=38,OX=(800-W*S)/2,OY=(600-H*S)/2;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){
      var d=Math.max(Math.abs(x-px),Math.abs(y-py));
      if(d>4.5)continue;
      var a=E.cl(1-(d-1.5)/3.4,.1,1);
      c.globalAlpha=a;
      E.rr(OX+x*S,OY+y*S,S,S,4, m[y][x]?'#2c3560':'#141a2c');
      c.globalAlpha=1; }
    E.spr('🏁',OX+(W-2)*S+S/2,OY+(H-2)*S+S/2,26);
    E.spr('🧭',OX+px*S+S/2,OY+py*S+S/2,28);
    E.hudL('متاهة '+lvl+' · خطوات '+steps); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'picross', t:'بيكروس صغير', c:'brain', e:'⬛', tags:['منطق','رسم'],
d:'الأرقام تخبرك بعدد المربعات المتصلة في كل صف وعمود. ارسم الصورة المخفية.',
how:'انقر للتلوين · ضغطة طويلة لعلامة ×',
make:function(E){
  var N=8,sol,st,rows,cols,lvl;
  function reset(){ lvl=1; gen(); }
  function gen(){ sol=[]; st=[];
    for(var i=0;i<N*N;i++){ sol.push(Math.random()<.5?1:0); st.push(0); }
    rows=[];cols=[];
    for(var y=0;y<N;y++) rows.push(clues(sol.slice(y*N,y*N+N)));
    for(var x=0;x<N;x++){ var col=[]; for(var y2=0;y2<N;y2++)col.push(sol[y2*N+x]); cols.push(clues(col)); } }
  function clues(a){ var r=[],n=0; a.forEach(function(v){ if(v)n++; else if(n){r.push(n);n=0;} }); if(n)r.push(n); return r.length?r:[0]; }
  reset();
  function check(){ for(var i=0;i<N*N;i++){ if(sol[i]&&st[i]!==1)return false; if(!sol[i]&&st[i]===1)return false; } return true; }
  return {
  down:function(){ this._t=Date.now(); },
  up:function(mx,my){
    var S=48,OX=250,OY=170, x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=N||y>=N)return;
    var i=y*N+x, lp=Date.now()-(this._t||0)>340;
    st[i]= lp ? (st[i]===2?0:2) : (st[i]===1?0:1);
    E.s(lp?'blip':'tick');
    if(check()){ E.add(400); E.s('win'); lvl++;
      if(lvl>4) return E.won('حللت كل الصور! ⬛','أربع لوحات'); gen(); } },
  draw:function(c){
    E.bg('#0d1019');
    var S=48,OX=250,OY=170;
    for(var y=0;y<N;y++) E.tx(rows[y].join(' '),OX-10,OY+y*S+S/2,15,'#98a0b8','right');
    for(var x=0;x<N;x++) cols[x].forEach(function(v,k){ E.tx(v,OX+x*S+S/2,OY-14-(cols[x].length-1-k)*17,15,'#98a0b8'); });
    for(var i=0;i<N*N;i++){ var gx=OX+(i%N)*S, gy=OY+((i/N)|0)*S;
      E.rr(gx+1,gy+1,S-2,S-2,4, st[i]===1?'#e8ecff':'#1c2236');
      if(st[i]===2) E.tx('×',gx+S/2,gy+S/2,22,'#ff3d7f'); }
    E.hudL('لوحة '+lvl); E.hud('النتيجة '+E.score);
    E.tx('ضغطة طويلة = ×',400,575,14,'#6d7590');
  }};
}});

G({id:'sudo6', t:'سودوكو ٦×٦', c:'brain', e:'🔷', tags:['منطق','أرقام'],
d:'كل صف وعمود ومستطيل ٣×٢ يحوي الأرقام ١-٦ مرة واحدة.',
how:'انقر خانة ثم اكتب رقماً ١-٦',
make:function(E){
  var g,fixed,sel,sol,lvl;
  function full(){
    var b=[]; for(var i=0;i<36;i++)b.push(0);
    function ok(i,v){ var x=i%6,y=(i/6)|0;
      for(var k=0;k<6;k++){ if(b[y*6+k]===v||b[k*6+x]===v)return false; }
      var bx=(x/3|0)*3, by=(y/2|0)*2;
      for(var dy=0;dy<2;dy++)for(var dx=0;dx<3;dx++) if(b[(by+dy)*6+bx+dx]===v)return false;
      return true; }
    function go(i){ if(i===36)return true;
      var vs=[1,2,3,4,5,6].sort(function(){return Math.random()-.5;});
      for(var j=0;j<6;j++) if(ok(i,vs[j])){ b[i]=vs[j]; if(go(i+1))return true; b[i]=0; }
      return false; }
    go(0); return b; }
  function gen(){ sol=full(); g=sol.slice(); fixed=[];
    var holes=14+lvl*2, idx=[]; for(var i=0;i<36;i++)idx.push(i);
    idx.sort(function(){return Math.random()-.5;});
    for(var k=0;k<holes;k++) g[idx[k]]=0;
    for(var i2=0;i2<36;i2++) fixed.push(g[i2]!==0);
    sel=-1; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(mx,my){ var S=76,OX=(800-6*S)/2,OY=90;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x>=0&&y>=0&&x<6&&y<6){ var i=y*6+x; if(!fixed[i]){ sel=i; E.s('tick'); } return; }
    if(my>510){ var n=Math.floor((mx-172)/76)+1; if(n>=1&&n<=6&&sel>=0) put(n); } },
  key:function(k,d){ if(!d||sel<0)return;
    var n=parseInt(k,10); if(n>=1&&n<=6) put(n);
    if(k==='Backspace'||k==='0'||k==='Delete'){ g[sel]=0; } },
  draw:function(c){
    E.bg('#0b0f1a');
    var S=76,OX=(800-6*S)/2,OY=90;
    for(var i=0;i<36;i++){ var x=OX+(i%6)*S, y=OY+((i/6)|0)*S;
      var bad = g[i]&&g[i]!==sol[i];
      E.rr(x+2,y+2,S-4,S-4,7, i===sel?'#3d4d8a':(fixed[i]?'#1a2036':'#232a45'));
      if(g[i]) E.tx(g[i],x+S/2,y+S/2,34, bad?'#ff3d7f':(fixed[i]?'#98a0b8':'#9dff3d')); }
    for(var bx=0;bx<2;bx++)for(var by=0;by<3;by++) E.sr(OX+bx*3*S,OY+by*2*S,3*S,2*S,'#5a6799',3);
    for(var n=1;n<=6;n++) E.rr(172+(n-1)*76,510,66,60,10,'#2a3152'),E.tx(n,172+(n-1)*76+33,540,30,'#dfe6ff');
    E.hudL('لغز '+lvl); E.hud('النتيجة '+E.score);
  }};
  function put(n){ if(sel<0)return; g[sel]=n; E.s(n===sol[sel]?'blip':'buzz');
    if(n===sol[sel])E.add(10); else E.add(-5);
    for(var i=0;i<36;i++) if(g[i]!==sol[i])return;
    E.add(300); E.s('win'); lvl++;
    if(lvl>4) return E.won('حللت كل الألغاز! 🔷','أربعة ألواح'); gen(); }
}});

G({id:'memo-pairs', t:'أزواج الذاكرة الفوضوية', c:'memory', e:'🃏', tags:['ذاكرة','تركيز'],
d:'بطاقات مطابقة… لكن البطاقات تتبادل أماكنها كلما أخطأت مرتين.',
how:'انقر بطاقتين متطابقتين',
make:function(E){
  var cards,open,lock,miss,lvl,shuf;
  var EMO=['🍕','🐙','🚀','🎩','🌵','🐸','🎸','🍩','👻','🧊','🦄','🍔'];
  function gen(){ var n=6+lvl*2, set=EMO.slice(0,n/2); var a=set.concat(set);
    a.sort(function(){return Math.random()-.5;});
    cards=a.map(function(e,i){ return {e:e,up:false,done:false}; });
    open=[]; lock=0; miss=0; shuf=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(mx,my){
    if(lock>0)return;
    var n=cards.length, cols=Math.min(6,n/2|0+2), S=110;
    cols=n<=8?4:6; var rows=Math.ceil(n/cols);
    var OX=(800-cols*S)/2, OY=(600-rows*S)/2+10;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=cols||y>=rows)return;
    var i=y*cols+x; if(i>=n)return;
    var c2=cards[i]; if(c2.up||c2.done)return;
    c2.up=true; open.push(i); E.s('tick');
    if(open.length===2){ lock=.7;
      if(cards[open[0]].e===cards[open[1]].e){ E.add(50); E.s('coin');
        cards[open[0]].done=cards[open[1]].done=true; open=[]; lock=.15;
        if(cards.every(function(q){return q.done;})){ E.add(200); E.s('win'); lvl++;
          if(lvl>4) return E.won('ذاكرة حديدية! 🧠','أربع مراحل'); setTimeout(gen,500); } }
      else { miss++; E.add(-5); } } },
  update:function(dt){
    if(lock>0){ lock-=dt;
      if(lock<=0&&open.length===2){ cards[open[0]].up=false; cards[open[1]].up=false; open=[]; E.s('buzz');
        if(miss%2===0&&miss>0){ shuf=.6;
          var idx=[]; cards.forEach(function(c2,i){ if(!c2.done)idx.push(i); });
          var pool=idx.map(function(i){return cards[i];}).sort(function(){return Math.random()-.5;});
          idx.forEach(function(i,k){ cards[i]=pool[k]; }); E.s('swish'); } } }
    if(shuf>0)shuf-=dt; },
  draw:function(c){
    E.bg('#0d1120');
    var n=cards.length, cols=n<=8?4:6, rows=Math.ceil(n/cols), S=110;
    var OX=(800-cols*S)/2, OY=(600-rows*S)/2+10;
    cards.forEach(function(c2,i){ var x=OX+(i%cols)*S, y=OY+((i/cols)|0)*S;
      if(c2.done){ E.alpha(.28,function(){ E.rr(x+6,y+6,S-12,S-12,14,'#1f6b45'); E.spr(c2.e,x+S/2,y+S/2,40); }); }
      else if(c2.up){ E.rr(x+6,y+6,S-12,S-12,14,'#e8ecff'); E.spr(c2.e,x+S/2,y+S/2,46); }
      else { E.rr(x+6,y+6,S-12,S-12,14,'#39406b'); E.tx('؟',x+S/2,y+S/2,34,'#8a93b5'); } });
    E.hudL('مرحلة '+lvl+' · أخطاء '+miss); E.hud('النتيجة '+E.score);
    if(shuf>0) E.tx('البطاقات تبدّلت! 🔀',400,570,22,'#ff9f3d');
  }};
}});

G({id:'simon-say', t:'كرّر النغمة', c:'memory', e:'🎵', tags:['ذاكرة','موسيقى'],
d:'اسمع التسلسل ثم كرّره. يطول واحداً كل جولة حتى تنكسر ذاكرتك.',
how:'انقر الألوان بالترتيب',
make:function(E){
  var seq,idx,show,st,t,flash,round;
  var C=['#ff3d7f','#9dff3d','#00d4ff','#ffc93d'], F=[262,330,392,523];
  function reset(){ seq=[]; round=0; next(); }
  function next(){ round++; seq.push(E.ri(0,3)); idx=0; show=true; st=0; t=0; flash=-1; }
  reset();
  return {
  down:function(mx,my){
    if(show)return;
    var i=hitPad(mx,my); if(i<0)return;
    flash=i; E.note(F[i],.25); t=.2;
    if(seq[idx]===i){ idx++; E.add(10);
      if(idx>=seq.length){ E.add(50*round); setTimeout(next,600); show=true; st=-.6; } }
    else E.over('خطأ في الجولة '+round,'التسلسل كان أطول من ذاكرتك'); },
  update:function(dt){
    if(t>0){ t-=dt; if(t<=0)flash=-1; }
    if(show){ st+=dt;
      if(st>.55){ st=0; if(flash>=0){ flash=-1; }
        else { var i=Math.floor(idx); if(i<seq.length){ flash=seq[i]; E.note(F[flash],.35); idx++; t=.4; }
          else { show=false; idx=0; } } } }
  },
  draw:function(c){
    E.bg('#080b14');
    var cx=400,cy=310,R=200;
    for(var i=0;i<4;i++){ var a0=i*1.5708-.785, a1=a0+1.5708;
      c.beginPath(); c.moveTo(cx,cy); c.arc(cx,cy,R,a0,a1); c.closePath();
      c.fillStyle= flash===i? '#fff': C[i]; c.globalAlpha= flash===i?1:.75; c.fill(); c.globalAlpha=1; }
    E.o(cx,cy,60,'#0e1220');
    E.tx(round,cx,cy-10,38,'#fff'); E.tx('الجولة',cx,cy+22,14,'#98a0b8');
    E.tx(show?'استمع… 👂':'كرّر الآن 👆',400,60,26, show?'#ffc93d':'#9dff3d');
    E.hud('النتيجة '+E.score);
  }};
  function hitPad(mx,my){ var dx=mx-400, dy=my-310;
    if(Math.sqrt(dx*dx+dy*dy)>200||Math.sqrt(dx*dx+dy*dy)<62)return -1;
    var a=Math.atan2(dy,dx)+.785; if(a<0)a+=6.283;
    return Math.floor(a/1.5708)%4; }
}});

G({id:'xo-impossible', t:'إكس أو المستحيلة', c:'board', e:'❌', tags:['ذكاء','لوح'],
d:'حاول أن تفوز على خوارزمية لا تخسر أبداً. أفضل ما يمكنك هو التعادل.',
how:'انقر خانة فارغة',
make:function(E){
  var b,turn,done,wins,draws,losses;
  function reset(){ b=['','','','','','','','','']; turn='X'; done=false; wins=0;draws=0;losses=0; }
  reset();
  var L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function win(bb,p){ return L.some(function(l){ return l.every(function(i){ return bb[i]===p; }); }); }
  function minimax(bb,p,dep){
    if(win(bb,'O'))return 10-dep; if(win(bb,'X'))return dep-10;
    if(bb.every(function(v){return v;}))return 0;
    var best=p==='O'?-99:99;
    for(var i=0;i<9;i++){ if(bb[i])continue; bb[i]=p;
      var s=minimax(bb,p==='O'?'X':'O',dep+1); bb[i]='';
      best = p==='O' ? Math.max(best,s) : Math.min(best,s); }
    return best; }
  function ai(){ var bi=-1,bs=-99;
    for(var i=0;i<9;i++){ if(b[i])continue; b[i]='O'; var s=minimax(b,'X',0); b[i]='';
      if(s>bs){bs=s;bi=i;} }
    if(bi>=0){ b[bi]='O'; E.s('hit'); } }
  function newRound(){ b=['','','','','','','','','']; turn='X'; done=false; }
  return {
  down:function(mx,my){
    if(done){ newRound(); return; }
    var S=140,OX=(800-3*S)/2,OY=110;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>2||y>2)return; var i=y*3+x; if(b[i])return;
    b[i]='X'; E.s('tick');
    if(win(b,'X')){ done=true; wins++; E.add(1000); E.won('مستحيل! فزت 😱','هل غششت؟'); return; }
    if(b.every(function(v){return v;})){ done=true; draws++; E.add(50); E.s('blip'); return; }
    ai();
    if(win(b,'O')){ done=true; losses++; E.add(-20); E.s('lose'); return; }
    if(b.every(function(v){return v;})){ done=true; draws++; E.add(50); } },
  draw:function(c){
    E.bg('#0c1018');
    var S=140,OX=(800-3*S)/2,OY=110;
    for(var i=0;i<9;i++){ var x=OX+(i%3)*S, y=OY+((i/3)|0)*S;
      E.rr(x+5,y+5,S-10,S-10,14,'#1a2036');
      if(b[i]) E.tx(b[i]==='X'?'✖':'⭕',x+S/2,y+S/2,64, b[i]==='X'?'#00d4ff':'#ff3d7f'); }
    E.tx('تعادلات: '+draws+'  ·  خسائر: '+losses,400,60,22,'#98a0b8');
    E.tx(done?'انقر لجولة جديدة':'دورك ✖',400,560,22, done?'#ffc93d':'#9dff3d');
  }};
}});

G({id:'four-row', t:'أربعة على التوالي', c:'board', e:'🔴', tags:['ذكاء','لوح'],
d:'أسقط أقراصك واصنع أربعة متتالية قبل الحاسوب — وهو يفكّر ثلاث خطوات للأمام.',
how:'انقر العمود الذي تريد',
make:function(E){
  var W=7,H=6,b,turn,done;
  function reset(){ b=[]; for(var i=0;i<W*H;i++)b.push(0); turn=1; done=false; }
  reset();
  function drop(bb,col,p){ for(var y=H-1;y>=0;y--) if(!bb[y*W+col]){ bb[y*W+col]=p; return y; } return -1; }
  function winner(bb){
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){ var p=bb[y*W+x]; if(!p)continue;
      [[1,0],[0,1],[1,1],[1,-1]].forEach(function(d){ });
      var ds=[[1,0],[0,1],[1,1],[1,-1]];
      for(var k=0;k<4;k++){ var d=ds[k],n=1;
        while(n<4){ var nx=x+d[0]*n, ny=y+d[1]*n;
          if(nx<0||ny<0||nx>=W||ny>=H||bb[ny*W+nx]!==p)break; n++; }
        if(n>=4)return p; } }
    return 0; }
  function score(bb,p){
    var s=0;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){
      var ds=[[1,0],[0,1],[1,1],[1,-1]];
      for(var k=0;k<4;k++){ var d=ds[k], me=0,op=0,valid=true;
        for(var n=0;n<4;n++){ var nx=x+d[0]*n, ny=y+d[1]*n;
          if(nx<0||ny<0||nx>=W||ny>=H){valid=false;break;}
          var v=bb[ny*W+nx]; if(v===p)me++; else if(v)op++; }
        if(!valid)continue;
        if(me&&!op)s+=[0,1,8,60,1000][me]; if(op&&!me)s-=[0,1,10,80,1200][op]; } }
    return s; }
  function think(bb,p,dep,al,be){
    var w=winner(bb); if(w===2)return 100000-dep; if(w===1)return dep-100000;
    if(dep>=4)return score(bb,2);
    var best= p===2?-1e9:1e9;
    for(var col=0;col<W;col++){ var cp=bb.slice(); if(drop(cp,col,p)<0)continue;
      var v=think(cp,p===2?1:2,dep+1,al,be);
      if(p===2){ best=Math.max(best,v); al=Math.max(al,v); } else { best=Math.min(best,v); be=Math.min(be,v); }
      if(be<=al)break; }
    return best===1e9||best===-1e9?0:best; }
  function ai(){ var bc=-1,bs=-1e9;
    var order=[3,2,4,1,5,0,6];
    for(var i=0;i<7;i++){ var col=order[i], cp=b.slice(); if(drop(cp,col,2)<0)continue;
      var v=think(cp,1,1,-1e9,1e9); if(v>bs){bs=v;bc=col;} }
    if(bc>=0){ drop(b,bc,2); E.s('thud'); } }
  return {
  down:function(mx,my){
    if(done){ reset(); return; }
    var S=80,OX=(800-W*S)/2, col=Math.floor((mx-OX)/S);
    if(col<0||col>=W)return;
    if(drop(b,col,1)<0)return; E.s('pop');
    if(winner(b)===1){ done=true; E.add(500); return E.won('فزت! 🔴','أربعة على التوالي'); }
    if(b.every(function(v){return v;})){ done=true; E.add(100); return E.won('تعادل','لوح ممتلئ'); }
    ai();
    if(winner(b)===2){ done=true; return E.over('فاز الحاسوب 🟡','فكّر أبعد المرة القادمة'); }
    if(b.every(function(v){return v;})){ done=true; E.add(100); E.won('تعادل','لوح ممتلئ'); } },
  draw:function(c){
    E.bg('#0a0e1a');
    var S=80,OX=(800-W*S)/2,OY=80;
    E.rr(OX-8,OY-8,W*S+16,H*S+16,16,'#1e46a8');
    for(var i=0;i<W*H;i++){ var x=OX+(i%W)*S+S/2, y=OY+((i/W)|0)*S+S/2;
      E.o(x,y,S/2-7, b[i]===1?'#ff3d7f':b[i]===2?'#ffc93d':'#0d1424'); }
    var hc=Math.floor((E.m.x-OX)/S); if(hc>=0&&hc<W&&!done) E.o(OX+hc*S+S/2,45,26,'rgba(255,61,127,.55)');
    E.tx(done?'انقر لجولة جديدة':'دورك 🔴',400,575,20,'#98a0b8');
  }};
}});

G({id:'reversi', t:'أوثيللو', c:'board', e:'⚫', tags:['ذكاء','لوح'],
d:'احصر أقراص الخصم بين قرصيك لتقلبها. من يملك أكثر في النهاية يفوز.',
how:'انقر خانة صالحة (تظهر بنقطة)',
make:function(E){
  var N=8,b,turn,done,pass;
  function reset(){ b=[]; for(var i=0;i<64;i++)b.push(0);
    b[27]=b[36]=1; b[28]=b[35]=2; turn=1; done=false; pass=0; }
  reset();
  var DS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  function flips(bb,i,p){
    var x=i%N,y=(i/N)|0,out=[];
    if(bb[i])return out;
    DS.forEach(function(d){ var line=[],cx=x+d[0],cy=y+d[1];
      while(cx>=0&&cy>=0&&cx<N&&cy<N){ var v=bb[cy*N+cx];
        if(!v)return; if(v===p){ out=out.concat(line); return; } line.push(cy*N+cx); cx+=d[0]; cy+=d[1]; } });
    return out; }
  function moves(bb,p){ var m=[]; for(var i=0;i<64;i++) if(!bb[i]&&flips(bb,i,p).length)m.push(i); return m; }
  function play(i,p){ var f=flips(b,i,p); b[i]=p; f.forEach(function(j){ b[j]=p; }); E.s('pop'); }
  function count(p){ return b.filter(function(v){return v===p;}).length; }
  function endCheck(){
    if(!moves(b,1).length&&!moves(b,2).length){ done=true;
      var a=count(1),c2=count(2); E.add(a*10);
      if(a>c2) E.won('فزت '+a+'—'+c2,'سيطرة كاملة'); else if(a<c2) E.over('خسرت '+a+'—'+c2,'الزوايا هي السر');
      else E.won('تعادل '+a+'—'+c2,'صراع متكافئ'); return true; }
    return false; }
  function ai(){
    var m=moves(b,2); if(!m.length)return;
    var W=[120,-20,20,5,5,20,-20,120];
    var best=m[0],bs=-1e9;
    m.forEach(function(i){ var f=flips(b,i,2), x=i%N,y=(i/N)|0;
      var s=f.length + (W[x]*W[y])/60;
      if((x===0||x===7)&&(y===0||y===7))s+=200;
      if(s>bs){bs=s;best=i;} });
    play(best,2); }
  return {
  down:function(mx,my){
    if(done)return;
    var S=64,OX=(800-N*S)/2,OY=50;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=N||y>=N)return;
    var i=y*N+x; if(!flips(b,i,1).length)return;
    play(i,1);
    if(endCheck())return;
    var tries=0;
    while(moves(b,2).length&&tries<3){ ai(); tries++;
      if(endCheck())return;
      if(moves(b,1).length)break; }
    endCheck(); },
  draw:function(c){
    E.bg('#0a1410');
    var S=64,OX=(800-N*S)/2,OY=50;
    E.rr(OX-6,OY-6,N*S+12,N*S+12,10,'#0f5c37');
    for(var i=0;i<64;i++){ var x=OX+(i%N)*S, y=OY+((i/N)|0)*S;
      E.rr(x+1,y+1,S-2,S-2,4,'#177a4a');
      if(b[i]) E.o(x+S/2,y+S/2,S/2-7, b[i]===1?'#12161f':'#f2f5ff'); }
    if(!done) moves(b,1).forEach(function(i){ E.o(OX+(i%N)*S+S/2,OY+((i/N)|0)*S+S/2,7,'rgba(255,255,255,.35)'); });
    E.tx('أنت ⚫ '+count(1)+'   —   الحاسوب ⚪ '+count(2),400,570,22,'#dfe6ff');
  }};
}});
