import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:800,height:500} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/aminekingdede128-gmail.com/ark.html',{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__ark&&window.__ark.Game.state==='menu',null,{timeout:60000});
await p.evaluate(()=>{document.querySelector('#optSeed').value='424242';window.__ark.Game.startNew();});
await p.waitForFunction(()=>window.__ark.Game.state==='play',null,{timeout:180000});
const fails=[];
const r = await p.evaluate(()=>{
  const {Sound,Combat,Player,Creatures,World,ViewModel,Inventory,ITEMS}=window.__ark;
  const V=Object.getPrototypeOf(Player.pos).constructor;
  // count scheduled sources per call by wrapping the audio bank
  const count=(fn)=>{const n0=Sound._probe=0;const on=Sound.noise,ot=Sound.tone;
    Sound.noise=function(...a){Sound._probe++;return on.apply(this,a);};
    Sound.tone=function(...a){Sound._probe++;return ot.apply(this,a);};
    try{fn();}finally{Sound.noise=on;Sound.tone=ot;}return Sound._probe;};
  const swingVoices={};
  for(const k of ['fists','blade','heavy','polearm']) swingVoices[k]=count(()=>Sound.swing(k));
  const whiffVoices=count(()=>Sound.whiff('blade'));
  const kinds={};
  for(const id of ['fists','torch','spear','pike','club','stone_hatchet','metal_pick'])
    kinds[id]=Combat.swingKindFor({id});
  // hit vs miss: shake and sounds
  for(const c of Creatures.list.slice()) c.remove();
  Creatures.list.length=0; Creatures.rebuildHash();
  Player.yaw=0; Player.pitch=0;
  const f=Player.forward(new V());
  const tx=Player.pos.x+f.x*2.2, tz=Player.pos.z+f.z*2.2;
  const t=Creatures.spawn('trike',5,new V(tx,World.heightAt(tx,tz),tz));
  Creatures.update(.016);
  const eq=Inventory.equipped();
  Player.camShake=0; Combat.cd=0;
  const hitSounds=count(()=>Combat.melee(eq));
  const hitShake=Player.camShake;
  const landed=t.cur.health<t.max('health');
  // now miss: turn around
  /* a genuine miss: nothing in reach at all, and aimed above the ground */
  t.pos.x += 60; t.pos.z += 60; Creatures.update(.016);
  Player.camShake=0; Combat.cd=0; Player.pitch=-0.5;
  const hpBefore=t.cur.health;
  const missSounds=count(()=>Combat.melee(eq));
  const missShake=Player.camShake;
  const missAlsoHit=t.cur.health<hpBefore;
  // swing clock: viewmodel follows Combat
  Combat.cd=0; Combat.melee(eq);
  const c0=Combat.swing; ViewModel.update(0);
  const vm0=ViewModel.swingT;
  Combat.update(.05); ViewModel.update(.05);
  return {swingVoices,whiffVoices,kinds,landed,hitSounds,missSounds,
    hitShake:+hitShake.toFixed(3),missShake:+missShake.toFixed(3),
    missAlsoHit,
    clockSynced: Math.abs(vm0-c0)<1e-9 && Math.abs(ViewModel.swingT-Combat.swing)<1e-9,
    swingRate:+Combat.swingRate.toFixed(2)};
});
console.log(r);
if(!(r.swingVoices.fists>0&&r.swingVoices.heavy>r.swingVoices.blade)) fails.push('swing has no per-tool variation');
if(!(r.whiffVoices>r.swingVoices.blade)) fails.push('a miss sounds the same as a swing');
if(r.kinds.club!=='heavy'||r.kinds.pike!=='polearm'||r.kinds.fists!=='fists'||r.kinds.stone_hatchet!=='blade')
  fails.push('swing kinds are wrong: '+JSON.stringify(r.kinds));
if(!r.landed) fails.push('the test swing did not land');
if(!(r.hitShake>0)) fails.push('a landed hit does not kick the camera');
if(!(r.missShake===0)) fails.push('a miss kicks the camera like a hit');
if(!(r.missSounds>0)) fails.push('a miss is silent');
if(!r.clockSynced) fails.push('the viewmodel and Combat are on different swing clocks');
console.log('errors:',errs.length?errs.slice(0,3):'none');
if(fails.length){console.log('\nFAILED:');fails.forEach(f=>console.log('  '+f));process.exitCode=1;}
else console.log('\nFEEDBACK PASSED');
await b.close();
