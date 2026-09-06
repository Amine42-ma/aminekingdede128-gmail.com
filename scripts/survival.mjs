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
console.log('--- SURVIVAL: minutes before hunger or thirst bites ---');
const surv = await p.evaluate(()=>{
  const {Player,Creatures,TUNE}=window.__ark;
  const out={};
  for(const key of ['easy','normal','hard']){
    Creatures.setDifficulty(key);
    const P=TUNE.player, d=Creatures.diff;
    // a survivor jogging: activity 1.25, temperate, so no cold/heat multiplier
    const act=1.25;
    const food=Player.max('food')/(P.foodDrain*act*d.drain);
    const water=Player.max('water')/(P.waterDrain*act*d.drain);
    out[key]={food:+(food/60).toFixed(1), water:+(water/60).toFixed(1),
              first:+(Math.min(food,water)/60).toFixed(1)};
  }
  Creatures.setDifficulty('normal');
  return out;
});
console.log(surv);
if(!(surv.normal.first>=12&&surv.normal.first<=18)) fails.push('normal time-to-first-damage '+surv.normal.first+' min, want 12-18');
if(!(surv.normal.food<surv.normal.water)) fails.push('water still empties before food');
if(!(surv.easy.first>surv.normal.first&&surv.normal.first>surv.hard.first)) fails.push('difficulty does not order the drains');

console.log('--- SPAWNING: a beach must be a nursery, not an ambush ---');
const spawn = await p.evaluate(()=>{
  const {Creatures,SPECIES}=window.__ark;
  const out={};
  for(const key of ['easy','normal','hard']){
    Creatures.setDifficulty(key);
    let dodo=0,pred=0,heavy=0,n=4000;
    for(let i=0;i<n;i++){
      const id=Creatures.speciesForBiome('beach');
      if(!id) continue;
      const sp=SPECIES[id];
      if(id==='dodo') dodo++;
      if(sp.temper==='aggressive'||sp.temper==='apex'){ pred++; if(sp.mass>=1200) heavy++; }
    }
    out[key]={dodoPct:+(dodo/n*100).toFixed(1), predatorPct:+(pred/n*100).toFixed(1), bigPredators:heavy};
  }
  Creatures.setDifficulty('normal');
  return out;
});
console.log(spawn);
for(const k of ['easy','normal']){
  if(spawn[k].bigPredators!==0) fails.push(k+': big predators on the starting beach');
  if(!(spawn[k].dodoPct>spawn[k].predatorPct)) fails.push(k+': predators outnumber dodos on the beach');
}
if(!(spawn.hard.predatorPct>spawn.normal.predatorPct&&spawn.normal.predatorPct>spawn.easy.predatorPct))
  fails.push('difficulty does not change the predator share');

console.log('--- DIFFICULTY: wild damage and level ---');
console.log(await p.evaluate(()=>{
  const {Creatures}=window.__ark; const o={};
  for(const k of ['easy','normal','hard']){Creatures.setDifficulty(k);
    let mx=0;for(let i=0;i<400;i++)mx=Math.max(mx,Creatures.pickLevel());
    o[k]={damageMul:Creatures.diff.damage,maxLevelSeen:mx};}
  Creatures.setDifficulty('normal'); return o;
}));
console.log('errors:',errs.length?errs.slice(0,3):'none');
if(fails.length){console.log('\nFAILED:');for(const f of fails)console.log('  '+f);process.exitCode=1;}
else console.log('\nSURVIVAL/SPAWN PASSED');
await b.close();
