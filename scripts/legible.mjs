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
const r=await p.evaluate(()=>{
  const {Gfx,QUALITY,Sky,Flora,UI}=window.__ark;
  const out={tiers:{}};
  for(const t of ['low','medium','high','ultra']){
    const q=QUALITY[t];
    out.tiers[t]={pixel:q.pixel,view:q.view,floraCut:Math.min(q.view,q.view*(q.foliage||1))};
  }
  // fog thins as the view shortens
  out.fog={};
  for(const t of ['low','high']){
    Gfx.applyQuality(t); Sky.update(0.016, Gfx.camera.position);
    out.fog[t]=+Gfx.scene.fog.density.toFixed(6);
  }
  Gfx.applyQuality('medium');
  // sliders
  const px0=Gfx.renderer.getPixelRatio();
  Gfx.setResScale(.6); const pxLo=Gfx.renderer.getPixelRatio();
  Gfx.setResScale(1.5); const pxHi=Gfx.renderer.getPixelRatio();
  Gfx.setResScale(1);
  const v0=Gfx.q.view; Gfx.setViewScale(1.5); const v1=Gfx.q.view; Gfx.setViewScale(1);
  Gfx.setHudScale(1.3);
  const hud=getComputedStyle(document.documentElement).getPropertyValue('--hud-scale').trim();
  const tf=getComputedStyle(document.querySelector('#hud')).transform;
  Gfx.setHudScale(1);
  // clamps
  Gfx.setResScale(9); const clampHi=Gfx.resScale; Gfx.setResScale(1);
  return {...out,px0,pxLo,pxHi,v0,v1,hud,tf,clampHi,
    settingsKnobs:['resScale','viewScale','fogMul','hudScale'].map(k=>typeof Gfx[k])};
});
console.log(JSON.stringify(r,null,1));
for(const t of ['low','medium']) if(r.tiers[t].pixel<1) fails.push(t+' still renders below native ('+r.tiers[t].pixel+')');
for(const t of ['low','medium','high','ultra'])
  if(r.tiers[t].floraCut<r.tiers[t].view*0.8) fails.push(t+' cuts flora well short of its draw distance');
if(!(r.fog.low<r.fog.high*1.35)) fails.push('the short-view tier is not getting thinner fog: '+JSON.stringify(r.fog));
if(!(r.pxLo<r.px0&&r.pxHi>r.px0)) fails.push('the render-resolution slider does nothing');
if(!(r.v1>r.v0)) fails.push('the draw-distance slider does nothing');
if(r.hud!=='1.3') fails.push('the HUD scale variable is not set');
if(!/matrix/.test(r.tf)) fails.push('the HUD does not actually scale');
if(r.clampHi>1.5) fails.push('the render-resolution slider is not clamped');
// the settings panel must offer them
const rows=await p.evaluate(()=>{const{UI}=window.__ark;UI.openSettings();
  return [...document.querySelectorAll('#setBody .row .name')].map(n=>n.firstChild.textContent.trim());});
console.log(rows);
for(const want of ['Render resolution','Draw distance','Fog','Interface size'])
  if(!rows.includes(want)) fails.push('Settings has no "'+want+'" row');
console.log('errors:',errs.length?errs.slice(0,3):'none');
if(fails.length){console.log('\nFAILED:');fails.forEach(f=>console.log('  '+f));process.exitCode=1;}
else console.log('\nLEGIBILITY PASSED');
await b.close();
