/* ============ 11) ألغاز منطقية إضافية ============ */

G({id:'rush-out', t:'أخرج سيارتك', c:'puzzle', e:'🚗', tags:['منطق','انزلاق'],
d:'سيارتك الحمراء محاصرة. حرّك السيارات الأخرى (كل واحدة في اتجاهها فقط) لتفتح الطريق.',
how:'اسحب أي سيارة في اتجاه محورها', noPad:true,
make:function(E){
  var LV=[
    [[2,2,2,'h',0],[0,0,2,'h',1],[0,3,3,'v',2],[3,1,2,'v',3],[4,4,3,'h',4],[5,0,3,'v',5]],
    [[2,1,2,'h',0],[0,0,3,'h',1],[3,0,2,'v',2],[4,2,2,'v',3],[1,3,3,'h',4],[0,4,2,'v',5],[5,3,3,'v',6]],
    [[2,0,2,'h',0],[0,0,2,'v',1],[1,1,3,'h',2],[4,1,2,'v',3],[0,3,3,'h',4],[3,4,3,'h',5],[5,0,2,'v',6]]
  ];
  var cars,lvl,moves,drag;
  function load(){ cars=LV[lvl%LV.length].map(function(c2){ return {y:c2[0],x:c2[1],len:c2[2],d:c2[3],i:c2[4]}; });
    moves=0; drag=null; }
  function reset(){ lvl=0; load(); }
  reset();
  function occupied(ix,iy,skip){
    for(var i=0;i<cars.length;i++){ if(i===skip)continue; var c2=cars[i];
      for(var k=0;k<c2.len;k++){ var cx=c2.x+(c2.d==='h'?k:0), cy=c2.y+(c2.d==='v'?k:0);
        if(cx===ix&&cy===iy)return true; } }
    return false; }
  function move(i,dir){
    var c2=cars[i];
    var nx=c2.x+(c2.d==='h'?dir:0), ny=c2.y+(c2.d==='v'?dir:0);
    if(nx<0||ny<0)return false;
    var ex=nx+(c2.d==='h'?c2.len-1:0), ey=ny+(c2.d==='v'?c2.len-1:0);
    if(ex>5||ey>5)return false;
    var tx=dir>0?ex:nx, ty=dir>0?ey:ny;
    if(occupied(tx,ty,i))return false;
    c2.x=nx; c2.y=ny; moves++; E.s('tick');
    if(i===0&&c2.x+c2.len>=6){ } 
    return true; }
  return {
  down:function(mx,my){
    var S=88,OX=(800-6*S)/2,OY=(600-6*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    for(var i=0;i<cars.length;i++){ var c2=cars[i];
      for(var k=0;k<c2.len;k++){ var cx=c2.x+(c2.d==='h'?k:0), cy=c2.y+(c2.d==='v'?k:0);
        if(cx===x&&cy===y){ drag={i:i,sx:mx,sy:my}; return; } } } },
  up:function(mx,my){
    if(!drag)return;
    var dx=mx-drag.sx, dy=my-drag.sy, c2=cars[drag.i];
    var dir = c2.d==='h' ? (dx>30?1:dx<-30?-1:0) : (dy>30?1:dy<-30?-1:0);
    if(dir) move(drag.i,dir);
    drag=null;
    var me=cars[0];
    if(me.x+me.len>=6){
      E.add(400-moves*8); E.s('win'); lvl++;
      if(lvl>=LV.length) return E.won('حرّرت كل السيارات! 🚗','بـ'+moves+' حركة'); load(); } },
  draw:function(c){
    E.bg('#141826');
    var S=88,OX=(800-6*S)/2,OY=(600-6*S)/2;
    E.rr(OX-8,OY-8,6*S+16,6*S+16,14,'#232a3e');
    for(var y=0;y<6;y++)for(var x=0;x<6;x++) E.rr(OX+x*S+2,OY+y*S+2,S-4,S-4,6,'#1a2036');
    E.r(OX+6*S+2,OY+2*S+6,10,S-12,'#9dff3d');
    cars.forEach(function(c2,i){
      var w=c2.d==='h'?c2.len*S-8:S-8, h=c2.d==='v'?c2.len*S-8:S-8;
      E.rr(OX+c2.x*S+4,OY+c2.y*S+4,w,h,12, i===0?'#ff3d7f':'#4a5480');
      E.spr(i===0?'🚗':'🚙',OX+c2.x*S+w/2+4,OY+c2.y*S+h/2+4,34); });
    E.hudL('لغز '+(lvl+1)+'/'+LV.length+' · حركات '+moves); E.hud('النتيجة '+E.score);
    E.tx('اسحب السيارة في اتجاه محورها',400,585,15,'#6d7590');
  }};
}});

G({id:'one-stroke', t:'ارسم بخط واحد', c:'puzzle', e:'✏️', tags:['منطق','مسار'],
d:'مرّر على كل خط مرة واحدة فقط دون رفع القلم. رياضيات أويلر في لعبة.',
how:'اسحب من عقدة لأخرى على طول الخطوط', noPad:true,
make:function(E){
  var nodes,edges,cur,used,lvl;
  function gen(){ var n=4+Math.min(4,lvl);
    nodes=[]; for(var i=0;i<n;i++) nodes.push({x:400+Math.cos(i/n*6.283-1.57)*180, y:300+Math.sin(i/n*6.283-1.57)*180});
    edges=[];
    var path=[0], v=0;
    for(var k=0;k<n+lvl+2;k++){ var w; var tries=0;
      do{ w=E.ri(0,n-1); tries++; }while((w===v||edges.some(function(e){return (e.a===v&&e.b===w)||(e.a===w&&e.b===v);}))&&tries<30);
      if(tries>=30)break;
      edges.push({a:v,b:w,used:false}); v=w; }
    cur=0; used=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(x,y){ for(var i=0;i<nodes.length;i++) if(E.dist(x,y,nodes[i].x,nodes[i].y)<28){
      if(edges.every(function(e){return !e.used;})) cur=i; return; } },
  up:function(x,y){
    for(var i=0;i<nodes.length;i++) if(E.dist(x,y,nodes[i].x,nodes[i].y)<32){
      var e=edges.filter(function(ed){ return !ed.used&&((ed.a===cur&&ed.b===i)||(ed.b===cur&&ed.a===i)); })[0];
      if(e){ e.used=true; cur=i; used++; E.s('tick'); E.add(20);
        if(edges.every(function(ed){return ed.used;})){ E.add(200); E.s('win'); lvl++;
          if(lvl>7) return E.won('رسّام أويلر! ✏️','سبعة ألغاز'); gen(); } }
      else E.s('buzz');
      return; } },
  draw:function(c){
    E.bg('#0d1120');
    edges.forEach(function(e){ E.ln(nodes[e.a].x,nodes[e.a].y,nodes[e.b].x,nodes[e.b].y,
      e.used?'#9dff3d':'#39406b', e.used?6:4); });
    nodes.forEach(function(n,i){ E.o(n.x,n.y,20, i===cur?'#ffc93d':'#00d4ff'); E.o(n.x,n.y,10,'#0d1120'); });
    E.tx('خطوط متبقّية: '+edges.filter(function(e){return !e.used;}).length,400,50,24,'#98a0b8');
    E.tx('لا يمكن رفع القلم · إعادة بالزر ↻',400,580,15,'#6d7590');
    E.hudL('لغز '+lvl+'/7'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'river-cross', t:'الذئب والماعز والكرنب', c:'brain', e:'🛶', tags:['ألغاز كلاسيكية','منطق'],
d:'انقلهم عبر النهر واحداً واحداً — الذئب يأكل الماعز، والماعز يأكل الكرنب، إن تُركا وحدهما.',
how:'انقر ما تريد نقله ثم القارب', noPad:true,
make:function(E){
  var side,boat,round,msg,mt;
  var N=['🐺','🐐','🥬'];
  function gen(){ side=[0,0,0]; boat=0; msg=''; mt=0; }
  function reset(){ round=1; gen(); }
  reset();
  function bad(s){
    for(var b=0;b<2;b++){ if(boat===b)continue;
      var here=[0,1,2].filter(function(i){ return side[i]===b; });
      if(here.indexOf(0)>=0&&here.indexOf(1)>=0)return 'الذئب أكل الماعز!';
      if(here.indexOf(1)>=0&&here.indexOf(2)>=0)return 'الماعز أكل الكرنب!'; }
    return null; }
  return {
  down:function(x,y){
    if(y>460){ cross(null); return; }
    for(var i=0;i<3;i++){ var px=(side[i]===0?140:660), py=180+i*90;
      if(E.dist(x,y,px,py)<46&&side[i]===boat){ cross(i); return; } } },
  update:function(dt){ if(mt>0)mt-=dt; },
  draw:function(c){
    E.sky('#3a6a3a','#1a2a2a');
    E.r(280,0,240,600,'#1a5a8a');
    for(var i=0;i<3;i++){ var px=(side[i]===0?140:660), py=180+i*90;
      E.spr(N[i],px,py,52); }
    E.rr(boat===0?230:490,470,80,44,10,'#7a5a34'); E.spr('🛶',boat===0?270:530,486,40);
    E.tx('انقر الكائن ثم القارب لنقله',400,80,22,'#dfe6ff');
    E.tx('انقر أسفل الشاشة للعبور وحدك',400,560,16,'#98a0b8');
    if(mt>0) E.tx(msg,400,300,26,'#ff3d7f');
    E.hudL('محاولة '+round); E.hud('النتيجة '+E.score);
  }};
  function cross(i){
    if(i!=null) side[i]=1-boat;
    boat=1-boat;
    var b=bad();
    if(b){ msg=b; mt=2.2; E.s('buzz'); E.shake(12); E.add(-60); round++; gen(); return; }
    E.s('pop');
    if(side.every(function(s){return s===1;})){ E.add(500); E.won('نقلتهم بسلام! 🛶','لغز كلاسيكي محلول'); } }
}});

G({id:'water-jugs', t:'أباريق الماء', c:'brain', e:'🪣', tags:['منطق','قياس'],
d:'لديك إبريقان بسعتين مختلفتين. اقِس الكمية المطلوبة بالضبط — بالصبّ والملء والتفريغ.',
how:'انقر الأزرار لملء/تفريغ/صبّ', noPad:true,
make:function(E){
  var A,B,a,b,target,steps,lvl;
  function gen(){ var pairs=[[3,5,4],[5,8,6],[4,9,6],[7,11,5],[3,7,5],[6,10,8]];
    var p=pairs[(lvl-1)%pairs.length]; A=p[0]; B=p[1]; target=p[2]; a=0; b=0; steps=0; }
  function reset(){ lvl=1; gen(); }
  reset();
  function act(f){ f(); steps++; E.s('tick');
    if(a===target||b===target){ E.add(300-steps*10); E.s('win'); lvl++;
      if(lvl>6) return E.won('قيّاس بارع! 🪣','ستة ألغاز'); gen(); } }
  return {
  down:function(x,y){
    if(y<430)return;
    var i=Math.floor((x-40)/126); if(i<0||i>5)return;
    if(i===0)act(function(){a=A;});
    if(i===1)act(function(){b=B;});
    if(i===2)act(function(){a=0;});
    if(i===3)act(function(){b=0;});
    if(i===4)act(function(){ var t=Math.min(a,B-b); a-=t; b+=t; });
    if(i===5)act(function(){ var t=Math.min(b,A-a); b-=t; a+=t; }); },
  draw:function(c){
    E.bg('#0b1220');
    E.tx('اقِس بالضبط: '+target+' لتر',400,60,30,'#ffc93d');
    [[250,A,a,'أ'],[550,B,b,'ب']].forEach(function(j){
      var h=Math.min(260,j[1]*32);
      E.rr(j[0]-60,360-h,120,h,10,'#1c2338');
      var fh=h*(j[2]/j[1]);
      E.rr(j[0]-58,360-fh,116,fh,8,'#1a7ac0');
      E.sr(j[0]-60,360-h,120,h,'#5b6488',3);
      E.tx(j[3]+' : '+j[2]+'/'+j[1],j[0],390,22,'#dfe6ff'); });
    var L=['املأ أ','املأ ب','فرّغ أ','فرّغ ب','أ ← ب','ب ← أ'];
    for(var i=0;i<6;i++){ E.rr(40+i*126,440,116,70,12,'#2b3350'); E.tx(L[i],98+i*126,475,17,'#dfe6ff'); }
    E.hudL('لغز '+lvl+'/6 · خطوات '+steps); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'fake-coin', t:'العملة المزيّفة', c:'brain', e:'⚖️', tags:['منطق','استنتاج'],
d:'إحدى العملات أخفّ من البقية. جدها بأقل عدد من الوزنات على الميزان ذي الكفّتين.',
how:'ضع العملات في الكفّتين ثم زِن', noPad:true,
make:function(E){
  var N,coins,fake,left,right,weighs,lvl,res;
  function gen(){ N=9+ (lvl-1)*3; coins=[]; for(var i=0;i<N;i++)coins.push(i);
    fake=E.ri(0,N-1); left=[]; right=[]; weighs=0; res=''; }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y>500){ if(x<270)weigh(); else if(x<540){ left=[]; right=[]; res=''; } else guessMode(); return; }
    var cols=Math.min(12,N), S=58, OX=(800-cols*S)/2;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-320)/64);
    var i=cy*cols+cx;
    if(i<0||i>=N||cx<0||cx>=cols)return;
    if(guessing){ if(i===fake){ E.add(400-weighs*50); E.s('win'); lvl++;
        if(lvl>4) return E.won('منطق حديدي! ⚖️','أربعة ألغاز'); guessing=false; gen(); }
      else { E.add(-150); E.s('buzz'); E.shake(14); guessing=false;
        if(E.score<0) return E.over('اخترت الخطأ','العملة كانت رقم '+(fake+1)); gen(); }
      return; }
    var li=left.indexOf(i), ri=right.indexOf(i);
    if(li>=0)left.splice(li,1);
    else if(ri>=0)right.splice(ri,1);
    else if(left.length<=right.length)left.push(i); else right.push(i);
    E.s('tick'); },
  draw:function(c){
    E.bg('#0d1018');
    E.tx('اعثر على العملة الأخفّ بين '+N,400,50,26,'#dfe6ff');
    var tilt = res==='L'?-.12: res==='R'?.12:0;
    c.save(); c.translate(400,180); c.rotate(tilt);
    E.ln(-180,0,180,0,'#8a93b5',7);
    E.rr(-230,-8,110,16,6,'#4a5480'); E.rr(120,-8,110,16,6,'#4a5480');
    E.tx(left.length,-175,-24,20,'#00d4ff'); E.tx(right.length,175,-24,20,'#ff3d7f');
    c.restore();
    E.r(396,180,8,80,'#5b6488');
    var cols=Math.min(12,N), S=58, OX=(800-cols*S)/2;
    for(var i=0;i<N;i++){ var x=OX+(i%cols)*S, y=320+Math.floor(i/cols)*64;
      var inL=left.indexOf(i)>=0, inR=right.indexOf(i)>=0;
      E.o(x+S/2,y+26,24, inL?'#00d4ff':inR?'#ff3d7f':'#4a5480');
      E.tx(i+1,x+S/2,y+26,16,'#0b0d14'); }
    E.rr(20,505,240,70,12,'#2fbd6f'); E.tx('⚖️ زِن',140,540,22,'#062012');
    E.rr(280,505,240,70,12,'#3a4270'); E.tx('مسح',400,540,22,'#dfe6ff');
    E.rr(540,505,240,70,12, guessing?'#ffc93d':'#7c5cff'); E.tx(guessing?'اختر العملة':'أعرف الجواب',660,540,20,'#fff');
    E.hudL('لغز '+lvl+' · وزنات '+weighs); E.hud('النتيجة '+E.score);
  }};
  var guessing=false;
  function guessMode(){ guessing=!guessing; E.s('blip'); }
  function weigh(){
    if(!left.length||left.length!==right.length){ E.s('buzz'); return; }
    weighs++; E.add(-20); E.s('tick');
    var lf=left.indexOf(fake)>=0, rf=right.indexOf(fake)>=0;
    res = lf?'L' : rf?'R' : 'E'; }
}});

G({id:'knight-tour', t:'جولة الحصان', c:'brain', e:'♞', tags:['شطرنج','مسار'],
d:'حرّك الحصان بحركته الشهيرة وزُر كل مربع مرة واحدة فقط. أصعب مما يبدو.',
how:'انقر مربعاً يصله الحصان', noPad:true,
make:function(E){
  var N,vis,px,py,n,lvl;
  function gen(){ N=4+lvl; vis=[]; for(var i=0;i<N*N;i++)vis.push(0);
    px=0; py=0; vis[0]=1; n=1; }
  function reset(){ lvl=1; gen(); }
  reset();
  function ok(x,y){ if(x<0||y<0||x>=N||y>=N||vis[y*N+x])return false;
    var dx=Math.abs(x-px), dy=Math.abs(y-py);
    return (dx===1&&dy===2)||(dx===2&&dy===1); }
  return {
  down:function(mx,my){
    var S=Math.floor(440/N), OX=(800-N*S)/2, OY=(600-N*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(!ok(x,y)){ E.s('buzz'); return; }
    px=x; py=y; vis[y*N+x]=++n; E.s('tick'); E.add(20);
    if(n>=N*N){ E.add(400); E.s('win'); lvl++;
      if(lvl>3) return E.won('فارس مثالي! ♞','ثلاث جولات'); gen(); return; }
    var any=false;
    for(var yy=0;yy<N;yy++)for(var xx=0;xx<N;xx++) if(ok(xx,yy))any=true;
    if(!any) E.over('علِق الحصان','زرت '+n+' من '+(N*N)); },
  draw:function(c){
    E.bg('#0e1220');
    var S=Math.floor(440/N), OX=(800-N*S)/2, OY=(600-N*S)/2;
    for(var y=0;y<N;y++)for(var x=0;x<N;x++){ var i=y*N+x;
      E.rr(OX+x*S+1,OY+y*S+1,S-2,S-2,4, vis[i]?'#2f5a7a':((x+y)%2?'#2b3350':'#39406b'));
      if(vis[i]) E.tx(vis[i],OX+x*S+S/2,OY+y*S+S/2,Math.min(22,S/3),'#9dff3d');
      if(ok(x,y)) E.ring(OX+x*S+S/2,OY+y*S+S/2,S/3,'#ffc93d',3); }
    E.spr('♞',OX+px*S+S/2,OY+py*S+S/2,S*.6);
    E.hudL('لوح '+N+'×'+N+' · '+n+'/'+(N*N)); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'queens', t:'الوزيرات', c:'brain', e:'♛', tags:['شطرنج','منطق'],
d:'ضع الوزيرات دون أن تهدد إحداهنّ الأخرى — لا صف ولا عمود ولا قطر مشترك.',
how:'انقر المربعات لوضع وزيرة', noPad:true,
make:function(E){
  var N,q,lvl;
  function gen(){ N=4+lvl; q=[]; }
  function reset(){ lvl=1; gen(); }
  reset();
  function safe(x,y){ return !q.some(function(p){ return p.x===x||p.y===y||Math.abs(p.x-x)===Math.abs(p.y-y); }); }
  return {
  down:function(mx,my){
    var S=Math.floor(460/N), OX=(800-N*S)/2, OY=(600-N*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=N||y>=N)return;
    var i=-1; q.forEach(function(p,k){ if(p.x===x&&p.y===y)i=k; });
    if(i>=0){ q.splice(i,1); E.s('blip'); return; }
    if(!safe(x,y)){ E.s('buzz'); E.shake(8); E.add(-10); return; }
    q.push({x:x,y:y}); E.s('tick'); E.add(30);
    if(q.length===N){ E.add(300); E.s('win'); lvl++;
      if(lvl>4) return E.won('ثماني وزيرات! ♛','أربعة ألواح'); gen(); } },
  draw:function(c){
    E.bg('#0d1220');
    var S=Math.floor(460/N), OX=(800-N*S)/2, OY=(600-N*S)/2;
    for(var y=0;y<N;y++)for(var x=0;x<N;x++){
      var attacked = q.some(function(p){ return (p.x===x||p.y===y||Math.abs(p.x-x)===Math.abs(p.y-y))&&!(p.x===x&&p.y===y); });
      E.rr(OX+x*S+1,OY+y*S+1,S-2,S-2,3, attacked?'#4a2030':((x+y)%2?'#2b3350':'#39406b')); }
    q.forEach(function(p){ E.spr('♛',OX+p.x*S+S/2,OY+p.y*S+S/2,S*.6); });
    E.tx('ضع '+N+' وزيرات — لديك '+q.length,400,40,24,'#dfe6ff');
    E.hudL('لوح '+N+'×'+N); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'binary-puz', t:'صفر وواحد', c:'brain', e:'🔲', tags:['منطق','ثنائي'],
d:'املأ الشبكة بالأصفار والآحاد: لا ثلاثة متجاورة متشابهة، وكل صف وعمود متوازن.',
how:'انقر خانة لتبديلها بين ٠ و ١ وفارغ', noPad:true,
make:function(E){
  var N=6,g,fixed,sol,lvl;
  function build(){
    var b=new Array(N*N).fill(-1);
    function okAt(i,v){ var x=i%N,y=(i/N)|0; b[i]=v;
      function run(arr){ var c2=1; for(var k=1;k<arr.length;k++){ if(arr[k]===arr[k-1]&&arr[k]!==-1)c2++; else c2=1; if(c2>2)return false; } return true; }
      var row=[],col=[];
      for(var k=0;k<N;k++){ row.push(b[y*N+k]); col.push(b[k*N+x]); }
      var r0=row.filter(function(v2){return v2===0;}).length, r1=row.filter(function(v2){return v2===1;}).length;
      var c0=col.filter(function(v2){return v2===0;}).length, c1=col.filter(function(v2){return v2===1;}).length;
      var ok=run(row)&&run(col)&&r0<=N/2&&r1<=N/2&&c0<=N/2&&c1<=N/2;
      b[i]=-1; return ok; }
    function go(i){ if(i===N*N)return true;
      var vs=Math.random()<.5?[0,1]:[1,0];
      for(var k=0;k<2;k++) if(okAt(i,vs[k])){ b[i]=vs[k]; if(go(i+1))return true; b[i]=-1; }
      return false; }
    go(0); return b; }
  function gen(){ sol=build(); g=sol.slice(); fixed=[];
    var holes=16+lvl*3, idx=[]; for(var i=0;i<N*N;i++)idx.push(i);
    idx.sort(function(){return Math.random()-.5;});
    for(var k=0;k<holes;k++) g[idx[k]]=-1;
    for(var j=0;j<N*N;j++) fixed.push(g[j]!==-1); }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(mx,my){
    var S=76,OX=(800-N*S)/2,OY=(600-N*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=N||y>=N)return;
    var i=y*N+x; if(fixed[i])return;
    g[i] = g[i]===-1?0 : g[i]===0?1 : -1;
    E.s('tick');
    for(var k=0;k<N*N;k++) if(g[k]!==sol[k])return;
    E.add(400); E.s('win'); lvl++;
    if(lvl>4) return E.won('ثنائي مثالي! 🔲','أربعة ألواح'); gen(); },
  draw:function(c){
    E.bg('#0c1018');
    var S=76,OX=(800-N*S)/2,OY=(600-N*S)/2;
    for(var i=0;i<N*N;i++){ var x=OX+(i%N)*S, y=OY+((i/N)|0)*S;
      var wrong = g[i]!==-1&&g[i]!==sol[i];
      E.rr(x+2,y+2,S-4,S-4,8, fixed[i]?'#2b3350':'#1a2036');
      if(g[i]!==-1) E.tx(g[i],x+S/2,y+S/2,34, wrong?'#ff3d7f':(fixed[i]?'#98a0b8':'#9dff3d')); }
    E.tx('لا ثلاثة متشابهة متجاورة · توازن كل صف وعمود',400,60,18,'#6d7590');
    E.hudL('لوح '+lvl+'/4'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'make24', t:'اصنع ٢٤', c:'math', e:'🧮', tags:['حساب','منطق'],
d:'أربعة أرقام وأربع عمليات. اجعل الناتج ٢٤ بالضبط — كل رقم يُستخدم مرة واحدة.',
how:'انقر رقماً ثم عملية ثم رقماً آخر', noPad:true,
make:function(E){
  var nums,sel,op,round,t;
  function gen(){ nums=[]; for(var i=0;i<4;i++) nums.push({v:E.ri(1,9),dead:false});
    sel=-1; op=null; t=90; }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y>420&&y<500){ var i=Math.floor((x-260)/72); if(i>=0&&i<4){ op=['+','-','×','÷'][i]; E.s('blip'); } return; }
    if(y>520){ gen(); E.add(-30); E.s('buzz'); return; }
    var live=nums.filter(function(n){return !n.dead;});
    var idx=Math.floor((x-(400-live.length*70))/140);
    if(idx<0||idx>=live.length)return;
    var real=nums.indexOf(live[idx]);
    if(sel<0){ sel=real; E.s('tick'); return; }
    if(sel===real){ sel=-1; return; }
    if(!op){ sel=real; return; }
    var a=nums[sel].v, b=nums[real].v, r;
    if(op==='+')r=a+b; else if(op==='-')r=a-b; else if(op==='×')r=a*b;
    else { if(b===0||a%b!==0){ E.s('buzz'); return; } r=a/b; }
    nums[sel].dead=true; nums[real].v=r; sel=-1; op=null; E.s('pop');
    var rest=nums.filter(function(n){return !n.dead;});
    if(rest.length===1){
      if(rest[0].v===24){ E.add(200+Math.floor(t)*3); E.s('win'); round++;
        if(round>6) return E.won('عبقري ٢٤! 🧮','ست جولات'); gen(); }
      else { E.add(-50); E.s('buzz'); E.shake(10); gen(); } } },
  update:function(dt){ t-=dt; if(t<=0){ E.add(-60); gen();
    if(round>2&&E.score<0) E.over('نفد الوقت','الجولة '+round); } },
  draw:function(c){
    E.bg('#0d1220');
    E.tx('اجعل الناتج ٢٤',400,70,32,'#ffc93d');
    var live=nums.filter(function(n){return !n.dead;});
    live.forEach(function(n,i){ var x=(400-live.length*70)+i*140;
      E.rr(x+10,220,120,120,20, nums.indexOf(n)===sel?'#7c5cff':'#2b3350');
      E.tx(n.v,x+70,280,44,'#e8ecff'); });
    ['+','-','×','÷'].forEach(function(o,i){ E.rr(260+i*72,420,64,64,14, op===o?'#2fbd6f':'#39406b');
      E.tx(o,292+i*72,452,30,'#fff'); });
    E.rr(320,520,160,50,12,'#3a2030'); E.tx('أرقام جديدة',400,545,17,'#dfe6ff');
    E.hudL('جولة '+round+'/6'); E.hud('⏱ '+Math.max(0,t).toFixed(0));
  }};
}});

G({id:'magic-square', t:'المربع السحري', c:'brain', e:'🔯', tags:['أرقام','منطق'],
d:'ضع الأرقام ١-٩ بحيث يكون مجموع كل صف وعمود وقطر ١٥ بالضبط.',
how:'انقر خانة ثم رقماً من الأسفل', noPad:true,
make:function(E){
  var g,sel,used,lvl,t;
  function gen(){ g=new Array(9).fill(0); sel=-1; used=new Array(10).fill(false); t=120;
    var hints=Math.max(0,3-lvl);
    var sol=[2,7,6,9,5,1,4,3,8];
    for(var k=0;k<hints;k++){ var i=E.ri(0,8); g[i]=sol[i]; used[sol[i]]=true; } }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(x,y){
    var S=120,OX=(800-3*S)/2,OY=80;
    if(y>OY&&y<OY+3*S){ var cx=Math.floor((x-OX)/S), cy=Math.floor((y-OY)/S);
      if(cx>=0&&cy>=0&&cx<3&&cy<3){ var i=cy*3+cx;
        if(g[i]){ used[g[i]]=false; g[i]=0; E.s('blip'); } else sel=i;
        return; } }
    if(y>470){ var n=Math.floor((x-115)/68)+1;
      if(n<1||n>9||sel<0||used[n])return;
      g[sel]=n; used[n]=true; sel=-1; E.s('tick'); check(); } },
  update:function(dt){ t-=dt; if(t<=0) E.over('نفد الوقت','المربع '+lvl); },
  draw:function(c){
    E.bg('#0d1120');
    var S=120,OX=(800-3*S)/2,OY=80;
    for(var i=0;i<9;i++){ var x=OX+(i%3)*S, y=OY+((i/3)|0)*S;
      E.rr(x+4,y+4,S-8,S-8,12, i===sel?'#7c5cff':'#232a3e');
      if(g[i]) E.tx(g[i],x+S/2,y+S/2,44,'#ffc93d'); }
    for(var r=0;r<3;r++){ var s=g[r*3]+g[r*3+1]+g[r*3+2];
      E.tx(s||'',OX-30,OY+r*S+S/2,20, s===15?'#9dff3d':'#6d7590');
      var cs=g[r]+g[r+3]+g[r+6];
      E.tx(cs||'',OX+r*S+S/2,OY+3*S+22,20, cs===15?'#9dff3d':'#6d7590'); }
    for(var n=1;n<=9;n++){ E.rr(115+(n-1)*68,470,60,60,12, used[n]?'#232a3e':'#39406b');
      E.tx(n,145+(n-1)*68,500,26, used[n]?'#4a5480':'#e8ecff'); }
    E.tx('كل صف وعمود وقطر = ١٥',400,555,18,'#98a0b8');
    E.hudL('مربع '+lvl+' · ⏱ '+Math.max(0,t).toFixed(0)); E.hud('النتيجة '+E.score);
  }};
  function check(){
    if(g.some(function(v){return !v;}))return;
    var L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    if(L.every(function(l){ return g[l[0]]+g[l[1]]+g[l[2]]===15; })){
      E.add(400); E.s('win'); lvl++;
      if(lvl>3) return E.won('ساحر الأرقام! 🔯','ثلاثة مربعات'); gen(); }
    else { E.add(-50); E.s('buzz'); E.shake(10); } }
}});

G({id:'sequence', t:'أكمل المتتالية', c:'math', e:'🔢', tags:['أنماط','منطق'],
d:'خمسة أرقام تتبع قاعدة خفيّة. ما الرقم السادس؟ القواعد تزداد مكراً.',
how:'اختر الإجابة الصحيحة', noPad:true,
make:function(E){
  var seq,ans,opts,round,t;
  function gen(){
    var kind=E.ri(0,5+Math.min(3,round/2|0)), a=E.ri(1,9), d=E.ri(2,9), r=E.ri(2,4);
    seq=[];
    if(kind===0){ for(var i=0;i<5;i++)seq.push(a+i*d); ans=a+5*d; }
    else if(kind===1){ for(var i=0;i<5;i++)seq.push(a*Math.pow(r,i)); ans=a*Math.pow(r,5); }
    else if(kind===2){ var x=a,y=d; seq=[x,y]; for(var i=0;i<3;i++){ var z=x+y; seq.push(z); x=y; y=z; } ans=x+y; }
    else if(kind===3){ for(var i=1;i<=5;i++)seq.push(i*i+a); ans=36+a; }
    else if(kind===4){ for(var i=0;i<5;i++)seq.push(a+ (i%2?d:-d) + i*2); ans=a+(5%2?d:-d)+10; }
    else { for(var i=0;i<5;i++)seq.push(a*(i+1)+d*i); ans=a*6+d*5; }
    opts=[ans]; while(opts.length<4){ var o=ans+E.ri(-Math.max(3,Math.abs(ans)*.3|0),Math.max(3,Math.abs(ans)*.3|0));
      if(o!==ans&&opts.indexOf(o)<0)opts.push(o); }
    opts.sort(function(){return Math.random()-.5;}); t=Math.max(6,16-round); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    if(y<430)return; var i=Math.floor((x-40)/185); if(i<0||i>3)return;
    if(opts[i]===ans){ E.add(120+round*15); E.s('coin'); round++;
      if(round>12) return E.won('كاشف الأنماط! 🔢','اثنتا عشرة متتالية'); gen(); }
    else { E.add(-70); E.s('buzz'); E.shake(10);
      if(E.score<-100) return E.over('النمط أذكى منك','الجولة '+round); gen(); } },
  update:function(dt){ t-=dt; if(t<=0){ E.add(-60); gen();
    if(E.score<-100) E.over('نفد الوقت','الجولة '+round); } },
  draw:function(c){
    E.bg('#0b1120');
    E.tx('ما الرقم التالي؟',400,90,26,'#98a0b8');
    E.tx(seq.join('  ,  ')+'  ,  ؟',400,220,40,'#e8ecff');
    for(var i=0;i<4;i++){ E.rr(40+i*185,430,170,100,18,'#2b3350');
      E.tx(opts[i],125+i*185,480,34,'#ffc93d'); }
    E.rr(200,560,400,12,6,'#1c2338'); E.rr(202,562,396*E.cl(t/16,0,1),8,4,'#7c5cff');
    E.hudL('متتالية '+round+'/12'); E.hud('النتيجة '+E.score);
  }};
}});

G({id:'odd-one', t:'الشاذّ من المجموعة', c:'brain', e:'🔍', tags:['ملاحظة','سرعة'],
d:'كل الرموز متطابقة… إلا واحداً. جده قبل أن ينفد الوقت، والشبكة تكبر.',
how:'انقر الرمز المختلف', noPad:true,
make:function(E){
  var n,items,odd,t,round;
  var SETS=[['😀','😃'],['🔵','🔷'],['🐶','🐕'],['⭐','🌟'],['🍎','🍏'],['🚗','🚙'],['❤️','🧡'],['🌲','🎄']];
  function gen(){ n=Math.min(9,3+Math.floor(round/2)+1);
    var s=E.pick(SETS);
    items=[]; for(var i=0;i<n*n;i++)items.push(s[0]);
    odd=E.ri(0,n*n-1); items[odd]=s[1];
    t=Math.max(3.5,12-round*.7); }
  function reset(){ round=1; gen(); }
  reset();
  return {
  down:function(x,y){
    var S=Math.floor(440/n), OX=(800-n*S)/2, OY=(600-n*S)/2+20;
    var cx=Math.floor((x-OX)/S), cy=Math.floor((y-OY)/S);
    if(cx<0||cy<0||cx>=n||cy>=n)return;
    if(cy*n+cx===odd){ E.add(100+round*20); E.s('coin'); round++;
      if(round>15) return E.won('عين نسر! 🔍','١٥ جولة'); gen(); }
    else { E.add(-50); E.s('buzz'); E.shake(8); t-=1.5; } },
  update:function(dt){ t-=dt; if(t<=0) E.over('لم تجده','الجولة '+round); },
  draw:function(c){
    E.bg('#0d1018');
    var S=Math.floor(440/n), OX=(800-n*S)/2, OY=(600-n*S)/2+20;
    items.forEach(function(e,i){ E.spr(e,OX+(i%n)*S+S/2,OY+((i/n)|0)*S+S/2,S*.7); });
    E.tx('جولة '+round+'/15',400,45,24,'#dfe6ff');
    E.rr(250,560,300,14,7,'#1c2338'); E.rr(252,562,296*E.cl(t/12,0,1),10,5, t<3?'#ff3d7f':'#9dff3d');
    E.hud('النتيجة '+E.score);
  }};
}});

G({id:'towers-logic', t:'ناطحات السحاب', c:'brain', e:'🏙️', tags:['منطق','أبراج'],
d:'ضع أبراجاً بارتفاعات ١-٤. الأرقام على الحواف تخبرك كم برجاً يُرى من تلك الجهة.',
how:'انقر خانة لزيادة الارتفاع', noPad:true,
make:function(E){
  var N=4,g,sol,clues,lvl;
  function build(){
    var b=[];
    function ok(i,v){ var x=i%N,y=(i/N)|0;
      for(var k=0;k<N;k++){ if(b[y*N+k]===v)return false; if(b[k*N+x]===v)return false; }
      return true; }
    function go(i){ if(i===N*N)return true;
      var vs=[1,2,3,4].sort(function(){return Math.random()-.5;});
      for(var k=0;k<N;k++){ b[i]=vs[k]; if(ok(i,vs[k])&&go(i+1))return true; b[i]=0; }
      b[i]=0; return false; }
    for(var i=0;i<N*N;i++)b.push(0);
    go(0); return b; }
  function see(arr){ var n=0,m=0; arr.forEach(function(v){ if(v>m){m=v;n++;} }); return n; }
  function gen(){ sol=build(); g=new Array(N*N).fill(0); clues={t:[],b:[],l:[],r:[]};
    for(var x=0;x<N;x++){ var col=[]; for(var y=0;y<N;y++)col.push(sol[y*N+x]);
      clues.t.push(see(col)); clues.b.push(see(col.slice().reverse())); }
    for(var y2=0;y2<N;y2++){ var row=[]; for(var x2=0;x2<N;x2++)row.push(sol[y2*N+x2]);
      clues.l.push(see(row)); clues.r.push(see(row.slice().reverse())); } }
  function reset(){ lvl=1; gen(); }
  reset();
  return {
  down:function(mx,my){
    var S=100,OX=(800-N*S)/2,OY=(600-N*S)/2;
    var x=Math.floor((mx-OX)/S), y=Math.floor((my-OY)/S);
    if(x<0||y<0||x>=N||y>=N)return;
    var i=y*N+x; g[i]=(g[i]+1)%(N+1); E.s('tick');
    for(var k=0;k<N*N;k++) if(g[k]!==sol[k])return;
    E.add(400); E.s('win'); lvl++;
    if(lvl>4) return E.won('مهندس أبراج! 🏙️','أربعة ألغاز'); gen(); },
  draw:function(c){
    E.bg('#0c1018');
    var S=100,OX=(800-N*S)/2,OY=(600-N*S)/2;
    for(var i=0;i<N;i++){
      E.tx(clues.t[i],OX+i*S+S/2,OY-28,24,'#ffc93d');
      E.tx(clues.b[i],OX+i*S+S/2,OY+N*S+28,24,'#ffc93d');
      E.tx(clues.l[i],OX-28,OY+i*S+S/2,24,'#00d4ff');
      E.tx(clues.r[i],OX+N*S+28,OY+i*S+S/2,24,'#00d4ff'); }
    for(var k=0;k<N*N;k++){ var x=OX+(k%N)*S, y=OY+((k/N)|0)*S;
      E.rr(x+3,y+3,S-6,S-6,8,'#1e2540');
      if(g[k]) { E.rr(x+18,y+S-18-g[k]*16,S-36,g[k]*16,4,'#4a6ec0'); E.tx(g[k],x+S/2,y+26,22,'#dfe6ff'); } }
    E.tx('كم برجاً يُرى من كل جهة',400,40,17,'#6d7590');
    E.hudL('لغز '+lvl+'/4'); E.hud('النتيجة '+E.score);
  }};
}});
