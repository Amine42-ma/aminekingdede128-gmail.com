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
console.log(await p.evaluate(()=>{
  const {Creatures,Player,World}=window.__ark;
  const V=Object.getPrototypeOf(Player.pos).constructor;
  const out=[];
  for(const id of ['megalodon','sarco']){
    for(const c of Creatures.list.slice()) c.remove();
    Creatures.list.length=0; Creatures.rebuildHash();
    // find deep water and the nearest dry land to it
    let sea=null, land=null;
    for(let r=40;r<900&&!sea;r+=10) for(let a=0;a<32;a++){
      const x=Math.cos(a/32*6.28)*r, z=Math.sin(a/32*6.28)*r;
      if(World.heightAt(x,z)<World.seaLevel-12){sea=new V(x,World.seaLevel-6,z);break;}
    }
    if(!sea){out.push(id+': no deep water');continue;}
    // walk from the sea toward the island centre until we are on dry land
    const n=Math.hypot(sea.x,sea.z);
    for(let t=0;t<600;t+=2){
      const x=sea.x*(1-t/n>0?1-t/n:0), z=sea.z*(1-t/n>0?1-t/n:0);
      const h=World.heightAt(x,z);
      if(h>World.seaLevel+2){land=new V(x,h,z);break;}
    }
    if(!land){out.push(id+': no shore');continue;}
    const c=Creatures.spawn(id,40,sea.clone());
    if(!c){out.push(id+': no spawn');continue;}
    Player.pos.copy(land); Player.pos.y=land.y;
    c.behavior='aggressive'; c.acquire(Player);
    let maxY=-99, ashore=0;
    for(let i=0;i<1800;i++){
      Creatures.update(1/30);
      if(c.pos.y>maxY) maxY=c.pos.y;
      if(World.heightAt(c.pos.x,c.pos.z)>World.seaLevel) ashore++;
    }
    out.push(`${id}: maxY=${maxY.toFixed(2)} seaLevel=${World.seaLevel.toFixed(2)} framesOnLand=${ashore} target=${c.target?'still chasing':'disengaged'} state=${c.state}`);
  }
  return out;
}));
console.log('errors:',errs.length?errs.slice(0,3):'none');
await b.close();
