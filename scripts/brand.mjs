import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:1100,height:640} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/aminekingdede128-gmail.com/ark.html',{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__ark&&window.__ark.Game.state==='menu',null,{timeout:60000});
const fails=[];

// 1. no user-visible ARK, in either language
for (const lang of ['en','ar']) {
  const r = await p.evaluate((lg)=>{
    const {I18N}=window.__ark; I18N.set(lg);
    const bad=[];
    const walk=(n)=>{
      if(n.nodeType===3){ if(/\bARK\b/i.test(n.nodeValue)) bad.push(n.nodeValue.trim().slice(0,60)); return; }
      if(n.nodeType!==1) return;
      if(n.tagName==='SCRIPT'||n.tagName==='STYLE') return;
      for(const a of ['title','placeholder','aria-label','alt'])
        if(n.getAttribute&&/\bARK\b/i.test(n.getAttribute(a)||'')) bad.push(a+'='+n.getAttribute(a));
      for(const c of n.childNodes) walk(c);
    };
    walk(document.body);
    // every translated string in the table, both columns
    for(const k in I18N.ui) for(const v of I18N.ui[k]) if(/\bARK\b/i.test(v)) bad.push('i18n.'+k+': '+v);
    return {bad, title: document.title};
  }, lang);
  if (r.bad.length) fails.push(lang+': user-visible ARK — '+r.bad.slice(0,5).join(' | '));
  if (!/PRIMA/.test(r.title)) fails.push(lang+': the tab title is not PRIMA ('+r.title+')');
}
await p.evaluate(()=>window.__ark.I18N.set('en'));

// 2. the menu has its own drawn logo, and it is not a loaded image
const brand = await p.evaluate(()=>{
  const m=document.querySelector('#menu .brand .mark svg');
  const h1=document.querySelector('#menu .brand h1');
  const box=m?m.getBoundingClientRect():null;
  return {hasSvg:!!m, paths:m?m.querySelectorAll('path,circle').length:0,
    externalImgs:document.querySelectorAll('#menu img').length,
    w:box?Math.round(box.width):0, h:box?Math.round(box.height):0,
    heading:h1?h1.textContent.trim():'',
    tagline:(document.querySelector('#menu .tagline')||{}).textContent};
});
console.log(brand);
if(!brand.hasSvg||brand.paths<4) fails.push('the menu has no drawn logo');
if(brand.externalImgs) fails.push('the menu loads an image instead of drawing it');
if(!(brand.w>40&&brand.h>40)) fails.push('the logo is not actually laid out ('+brand.w+'x'+brand.h+')');
if(brand.heading!=='PRIMA') fails.push('the menu heading is '+brand.heading);

// 3. the menu has music: a mode of its own, and bars actually scheduled
const music = await p.evaluate(async ()=>{
  const {Sound,Game}=window.__ark;
  Sound.init(); await Sound.ctx.resume(); Sound.startMusic();
  let notes=0; const on=Sound.tone;
  Sound.tone=function(...a){notes++;return on.apply(this,a);};
  const t0=Sound._mus.bar;
  for(let i=0;i<400;i++){ Sound._mus.next=Sound.ctx.currentTime; Sound.musicTick(.05,10,'menu'); }
  Sound.tone=on;
  return {mode:Sound._mus.mode, bars:Sound._mus.bar-t0, notes, state:Game.state,
    hasMenuMode:!!Sound.MUSIC.menu};
});
console.log(music);
if(!music.hasMenuMode) fails.push('there is no menu music mode');
if(music.mode!=='menu') fails.push('the menu does not select its own mode (got '+music.mode+')');
if(!(music.bars>0&&music.notes>0)) fails.push('the menu schedules no music at all');

console.log('errors:',errs.length?errs.slice(0,3):'none');
if(fails.length){console.log('\nFAILED:');fails.forEach(f=>console.log('  '+f));process.exitCode=1;}
else console.log('\nBRANDING PASSED');
await b.close();
