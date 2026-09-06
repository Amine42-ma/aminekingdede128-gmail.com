/* The three defects reported from the phone playtest, each asserted directly. */
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:900,height:420}, hasTouch:true, isMobile:true });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const cdp = await ctx.newCDPSession(p);
const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,
  touchPoints:pts.map(q=>({x:q.x,y:q.y,id:q.id||0}))});

await p.goto('file:///home/user/aminekingdede128-gmail.com/ark.html',{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__ark&&window.__ark.Game.state==='menu',null,{timeout:60000});
await p.evaluate(()=>{document.querySelector('#optSeed').value='424242';window.__ark.Game.startNew();});
await p.waitForFunction(()=>window.__ark.Game.state==='play',null,{timeout:180000});
await p.evaluate(()=>{window.__ark.Touch.forced=true;window.__ark.Touch.apply();});

const fails=[];
const axis=()=>p.evaluate(()=>({x:+window.__ark.Touch.move.x.toFixed(3),
                               y:+window.__ark.Touch.move.y.toFixed(3)}));
const settle=async n=>{for(let i=0;i<(n||14);i++) await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};

console.log('--- STICK: the direction you walk must be the direction of your thumb ---');
// a plain push up-and-right
await touch('touchStart',[{x:200,y:300}]);
await touch('touchMove',[{x:230,y:255}]);
await settle();
let a = await axis();
console.log('  plain push up-right:', a);
if(!(a.y>0.2 && a.x>0.1)) fails.push('a push up-and-right does not move up-and-right: '+JSON.stringify(a));

// THE BUG: the viewport changes size mid-gesture (the first touch of a session
// asks for fullscreen, which does exactly this). The thumb has not moved, so
// the direction must not either.
await p.setViewportSize({width:900,height:380});
await touch('touchMove',[{x:230,y:255}]);
await touch('touchMove',[{x:236,y:250}]);
await settle();
const afterResize = await axis();
// The stick re-anchors under the thumb, so the deflection restarts near zero.
// What must never happen is that it points the other way.
console.log('  after a mid-gesture resize:', afterResize);
if(afterResize.y < -0.02) fails.push('a resize mid-gesture reversed the walk direction: '+JSON.stringify(afterResize));
// and pushing again after the resize must still walk the way the thumb goes
await touch('touchMove',[{x:236,y:190}]);
await settle();
const pushAfterResize = await axis();
console.log('  pushing up again after the resize:', pushAfterResize);
if(!(pushAfterResize.y>0.4)) fails.push('the stick does not work after a mid-gesture resize: '+JSON.stringify(pushAfterResize));
await touch('touchEnd',[]);
await settle();

// a sliding origin: push far past the limit, then come back a little. The
// origin should have followed the thumb, so a small return is a small move.
await p.setViewportSize({width:900,height:420});
await touch('touchStart',[{x:200,y:300}]);
await touch('touchMove',[{x:200,y:100}]);   // far past the radius
await settle();
const far = await axis();
await touch('touchMove',[{x:200,y:118}]);   // ease back a touch
await settle();
const eased = await axis();
console.log('  full push:',far,' eased back:',eased);
if(!(far.y>0.9)) fails.push('a full push is not full deflection: '+JSON.stringify(far));
if(!(eased.y>0.1 && eased.y<far.y)) fails.push('the origin did not slide with the thumb: '+JSON.stringify(eased));
await touch('touchEnd',[]);
await settle();

// a second finger in the left zone must not steal the stick from the first
await touch('touchStart',[{x:200,y:300,id:1}]);
await touch('touchMove',[{x:200,y:240,id:1}]);
await settle();
const oneFinger = await axis();
/* CDP wants every active point listed on start/move, so the intruder lands
   alongside the thumb rather than replacing it. */
await touch('touchStart',[{x:200,y:240,id:1},{x:120,y:340,id:2}]);
await touch('touchEnd',[{x:120,y:340,id:2}]);          // the intruder lifts
await touch('touchMove',[{x:200,y:235,id:1}]);         // the first thumb, still down
await settle();
const stillDriving = await axis();
console.log('  one finger:',oneFinger,' after a second finger came and went:',stillDriving);
if(!(stillDriving.y>0.1)) fails.push('a second finger in the left zone killed the stick: '+JSON.stringify(stillDriving));
await touch('touchEnd',[]);
await settle();

console.log('--- FOLIAGE: a cutout mask must not bleed black into its mips ---');
const masks = await p.evaluate(()=>{
  const out={};
  for (const [name,cut] of [['frondMask',.38],['leafMask',.42]]) {
    const t=window.__ark.TexLab.cache[name];
    if(!t){out[name]={missing:true};continue;}
    const cv=t.image, g=cv.getContext('2d');
    const d=g.getImageData(0,0,cv.width,cv.height).data;
    let dark=0, total=0, minLum=255;
    for(let i=0;i<d.length;i+=4){
      total++;
      const lum=(d[i]+d[i+1]+d[i+2])/3;
      if(lum<minLum) minLum=lum;
      /* a texel dark enough to show as grit once mip averaging spreads it */
      if(lum<40) dark++;
    }
    out[name]={darkPct:+(dark/total*100).toFixed(2), minLum, size:cv.width, cut};
  }
  return out;
});
console.log(' ',masks);
for(const k in masks){
  if(masks[k].missing){fails.push(k+' was never built');continue;}
  if(masks[k].darkPct>0.5) fails.push(k+' still has near-black texels ('+masks[k].darkPct+'%) — they bleed into the mips as grit');
}

console.log('--- NAMEPLATES: only what you can see, and only what you look at ---');
const np = await p.evaluate(async ()=>{
  const {Creatures,Player,World,Combat,UI,Physics}=window.__ark;
  const V=Object.getPrototypeOf(Player.pos).constructor;
  const clear=()=>{for(const c of Creatures.list.slice())c.remove();
                   Creatures.list.length=0;Creatures.tamedList.length=0;Creatures.rebuildHash();
                   for(const[,n]of UI.nameplateMap)n.remove();UI.nameplateMap.clear();};
  const plates=()=>[...document.querySelectorAll('#nameplates .np')].map(n=>({
    name:n.querySelector('.nm').textContent,
    detail:n.classList.contains('detail'),
    hostile:n.classList.contains('hostile'),
    lvShown:getComputedStyle(n.querySelector('.lv')).display!=='none',
    barShown:getComputedStyle(n.querySelector('.bar.hp')).display!=='none',
  }));
  const frame=()=>{Combat.updateAim();UI.updateNameplates();};

  clear(); Player.yaw=0; Player.pitch=0;
  const f=Player.forward(new V());
  // one straight ahead at 12 m, in the open
  const ax=Player.pos.x+f.x*12, az=Player.pos.z+f.z*12;
  Creatures.spawn('trike',5,new V(ax,World.heightAt(ax,az),az));
  // one at the same distance but 90 degrees to the side: visible to the game,
  // never looked at. Under the old code this got a full red plate too.
  const sx=Player.pos.x+f.z*12, sz=Player.pos.z-f.x*12;
  Creatures.spawn('raptor',5,new V(sx,World.heightAt(sx,sz),sz));
  Creatures.update(.016);
  frame();
  const aimedAt = Combat.aimed && Combat.aimed.sp.name;
  const shown = plates();

  // now look away from both and confirm nothing is left hanging in the air
  Player.yaw = Math.PI; frame();
  const lookingAway = plates();

  /* And an animal with ground between it and the player gets nothing. The
     terrain is reported as closer than the animal — which is what a dune in
     the way looks like to the code — and the plate must not appear. */
  clear(); Player.yaw=0;
  const tx=Player.pos.x+f.x*20, tz=Player.pos.z+f.z*20;
  Creatures.spawn('trike',5,new V(tx,World.heightAt(tx,tz),tz));
  Creatures.update(.016); frame();
  const beforeOcclusion = plates().length;
  const realCast = Physics.raycastTerrain;
  Physics.raycastTerrain = (o,d,max) => ({ hit:true, dist:max*.5, point:o.clone() });
  frame();
  const throughTerrain = { beforeOcclusion, aimed: !!Combat.aimed, plates: plates().length };
  Physics.raycastTerrain = realCast;
  clear();
  return {aimedAt, shown, lookingAway, throughTerrain};
});
console.log(' ', JSON.stringify(np,null,1));
if(np.shown.length!==1) fails.push('expected exactly one plate — the animal being looked at — got '+np.shown.length);
if(np.shown[0] && !np.shown[0].detail) fails.push('the animal under the crosshair shows no level or health');
if(np.shown[0] && !(np.shown[0].lvShown && np.shown[0].barShown)) fails.push('detail class set but the rows are still hidden');
if(np.lookingAway.length!==0) fails.push('plates are still drawn for animals nobody is looking at');
if(np.throughTerrain.beforeOcclusion!==1) fails.push('the occlusion case never had a plate to remove');
if(np.throughTerrain.plates!==0) fails.push('a creature behind the terrain still gets a nameplate');

console.log('\nerrors:', errs.length?errs.slice(0,4):'none');
if(errs.length) fails.push(errs.length+' page errors');
if(fails.length){console.log('\nFAILED:');fails.forEach(f=>console.log('  '+f));process.exitCode=1;}
else console.log('\nPLAYTEST FIXES PASSED');
await b.close();
