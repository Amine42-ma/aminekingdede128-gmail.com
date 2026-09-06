import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:900,height:560} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
await p.goto('file:///home/user/aminekingdede128-gmail.com/ark.html',{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__ark&&window.__ark.Game.state==='menu',null,{timeout:60000});
await p.evaluate(()=>{document.querySelector('#optSeed').value='424242';window.__ark.Game.startNew();});
await p.waitForFunction(()=>window.__ark.Game.state==='play',null,{timeout:180000});

console.log('--- FACING: head must lead the tail along the direction of travel ---');
console.log(await p.evaluate(()=>{
  const {Creatures,Player,World,SPECIES}=window.__ark;
  const V=Object.getPrototypeOf(Player.pos).constructor;
  const out=[];
  for(const id of ['rex','trike','parasaur','sarco']){
    for(const c of Creatures.list.slice()) c.remove();
    Creatures.list.length=0; Creatures.rebuildHash();
    const x=Player.pos.x+20, z=Player.pos.z;
    const c=Creatures.spawn(id,20,new V(x,World.heightAt(x,z),z));
    if(!c){out.push(id+': no spawn'); continue;}
    c.yaw=1.1; c.root.rotation.y=c.yaw;
    c.animate(.016); c.root.updateWorldMatrix(true,true);
    const head=c.parts.head&&c.parts.head.getWorldPosition(new V());
    const tail=c.parts.tail&&c.parts.tail.length&&c.parts.tail[c.parts.tail.length-1].getWorldPosition(new V());
    if(!head||!tail){out.push(id+': no head/tail'); continue;}
    const fx=Math.sin(c.yaw), fz=Math.cos(c.yaw);
    const d=(head.x-tail.x)*fx+(head.z-tail.z)*fz;      // >0 means head leads
    const side=Math.abs((head.x-tail.x)*fz-(head.z-tail.z)*fx);
    out.push(`${id}: forward=${d.toFixed(2)} sideways=${side.toFixed(2)} ${d>side?'OK':'CRAB-WALKING'}`);
  }
  return out;
}));

console.log('--- MELEE: a swing at a creature must land, even in a crowd ---');
console.log(await p.evaluate(()=>{
  const {Creatures,Player,World,Combat,Inventory}=window.__ark;
  const V=Object.getPrototypeOf(Player.pos).constructor;
  const trial=(crowd, species, dist)=>{
    for(const c of Creatures.list.slice()) c.remove();
    Creatures.list.length=0; Creatures.rebuildHash();
    Player.yaw=0; Player.pitch=0;
    /* place along the player's ACTUAL forward vector: at yaw 0 that is -Z,
       not +Z, and guessing it wrong puts the target behind you */
    const f=Player.forward(new V());
    const fx=f.x, fz=f.z;
    const tx=Player.pos.x+fx*dist, tz=Player.pos.z+fz*dist;
    const target=Creatures.spawn(species,5,new V(tx,World.heightAt(tx,tz),tz));
    if(!target) return 'no spawn';
    // and a crowd around it, so the spatial hash returns several bodies:
    // this is the case the aliasing bug broke and the old tests never hit
    for(let i=0;i<crowd;i++){
      const a=i/crowd*6.28, r=5+i;
      const x=Player.pos.x+Math.cos(a)*r, z=Player.pos.z+Math.sin(a)*r;
      Creatures.spawn(species,5,new V(x,World.heightAt(x,z),z));
    }
    /* the spatial hash is rebuilt in Creatures.update, and castCreature reads
       it — without a step the world does not know these creatures exist */
    Creatures.update(.016);
    let hits=0;
    for(let i=0;i<12;i++){
      const before=target.cur.health;
      Combat.cd=0; Combat.melee(Inventory.equipped());
      if(target.cur.health<before) hits++;
      target.cur.health=target.max('health');
    }
    return hits;
  };
  return {
    trikeAlone: trial(0,'trike',2.2)+'/12',
    trikeInCrowdOf8: trial(8,'trike',2.2)+'/12',
    trikeInCrowdOf20: trial(20,'trike',2.2)+'/12',
    rexAlone: trial(0,'rex',2.4)+'/12',
    rexInCrowdOf20: trial(20,'rex',2.4)+'/12',
    parasaurInCrowdOf20: trial(20,'parasaur',2.2)+'/12',
  };
}));
console.log('errors:', errs.length?errs.slice(0,4):'none');
await b.close();
