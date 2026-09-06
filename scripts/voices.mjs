/* Each species must sound like itself, and an attack must not sound like a call. */
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({viewport:{width:800,height:500}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/aminekingdede128-gmail.com/ark.html',{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__ark&&window.__ark.Game.state==='menu',null,{timeout:60000});
const fails=[];

console.log('--- VOICES: 23 species, 23 different animals ---');
const v = await p.evaluate(()=>{
  const {SPECIES,Sound}=window.__ark;
  Sound.init();
  /* Record what the synth is actually asked to make, rather than listening:
     every beast() and noise() call, with its parameters. */
  const cap=[];
  const realBeast=Sound.beast, realNoise=Sound.noise, realTone=Sound.tone;
  Sound.beast=function(f,d,o){cap.push(['beast',+f.toFixed(1),+d.toFixed(3),
    o.growl,o.rasp,+(o.bright||0).toFixed(3),o.sub,+(o.bend||0).toFixed(3),o.form,+(o.delay||0).toFixed(3)].join('|'));};
  Sound.noise=function(d,o){cap.push(['noise',+d.toFixed(3),Math.round(o.f0),Math.round(o.f1),+(o.q||0).toFixed(2)].join('|'));};
  Sound.tone=function(){};
  const grab=(sp,mode)=>{cap.length=0;
    /* pitch jitter would make every render unique; pin it */
    const r=Math.random; Math.random=()=>0.5;
    Sound.voice(sp.voice,{mode,vol:1});
    Math.random=r;
    return cap.join(' ~ ');};
  const out={species:{},ids:[]};
  for(const id in SPECIES){
    const sp=SPECIES[id]; if(!sp.voice) continue;
    out.ids.push(id);
    out.species[id]={call:grab(sp,'call'),attack:grab(sp,'attack'),
                     hurt:grab(sp,'hurt'),die:grab(sp,'die'),kind:sp.voice.kind};
  }
  Sound.beast=realBeast; Sound.noise=realNoise; Sound.tone=realTone;
  return out;
});
console.log('  species with a voice:', v.ids.length);

const seen=new Map();
for(const id of v.ids){
  const f=v.species[id].call;
  if(!f){fails.push(id+' produces no sound at all');continue;}
  if(seen.has(f)) fails.push(id+' sounds identical to '+seen.get(f));
  else seen.set(f,id);
}
console.log('  distinct call fingerprints:', seen.size, 'of', v.ids.length);

let sameAsCall=0;
for(const id of v.ids){
  const s=v.species[id];
  if(s.attack===s.call) {sameAsCall++; fails.push(id+': an attack is the same clip as a call');}
  if(s.hurt===s.call) fails.push(id+': being hurt is the same clip as a call');
  if(s.die===s.call) fails.push(id+': dying is the same clip as a call');
}
console.log('  attack differs from call for all species:', sameAsCall===0);

// species sharing a `kind` must still be told apart — this is the actual complaint
const byKind={};
for(const id of v.ids) (byKind[v.species[id].kind] ||= []).push(id);
for(const k in byKind){
  if(byKind[k].length<2) continue;
  const fps=new Set(byKind[k].map(id=>v.species[id].call));
  console.log(`  kind '${k}' shared by ${byKind[k].length}: ${fps.size} distinct`);
  if(fps.size!==byKind[k].length) fails.push(`species sharing kind '${k}' still collapse to ${fps.size} sounds`);
}

console.log('--- DANGER MUSIC: it must turn the moment something comes at you ---');
await p.evaluate(()=>{document.querySelector('#optSeed').value='424242';window.__ark.Game.startNew();});
await p.waitForFunction(()=>window.__ark.Game.state==='play',null,{timeout:180000});
const mus = await p.evaluate(async ()=>{
  const {Sound,Creatures,Player,World}=window.__ark;
  const V=Object.getPrototypeOf(Player.pos).constructor;
  Sound.init(); await Sound.ctx.resume(); Sound.startMusic();
  const out={};
  const step=(threat,n)=>{for(let i=0;i<(n||1);i++) Sound.musicTick(.05,12,threat);};
  // settle into a daytime bar
  Sound._mus.next = Sound.ctx.currentTime; step(0,3);
  out.calm = Sound._mus.mode;
  /* A hostile 35 m away and running at you. One tick must be enough — and
     what matters is when the sound is scheduled to be HEARD, so watch the
     delay the synth is actually handed rather than the next bar line. */
  let soonest = Infinity;
  const realTone = Sound.tone;
  Sound.tone = function(f, d, o) { if (o && o.delay != null) soonest = Math.min(soonest, o.delay);
                                   return realTone.apply(this, arguments); };
  const before = Sound.ctx.currentTime;
  step(Math.max(0, 1 - 35/72));
  Sound.tone = realTone;
  out.threatAt35m = +(1-35/72).toFixed(3);
  out.afterOneTick = Sound._mus.mode;
  out.startsWithin = soonest === Infinity ? -1 : +soonest.toFixed(2);
  // it must hold through a brief lull rather than flickering back
  step(0, 1);
  out.afterBriefLull = Sound._mus.mode;
  // ...but let go once the lull is real
  step(0, 80);
  out.afterLongLull = Sound._mus.mode;
  // and the old threshold: at 30 m the old curve gave .29, below the .5 switch
  Sound._mus.danger=false; Sound._mus.dangerHold=0; step(0,1);
  step(Math.max(0, 1 - 30/72));
  out.at30m = Sound._mus.mode;
  return out;
});
console.log(' ', mus);
if(mus.afterOneTick!=='danger') fails.push('an animal charging from 35 m does not turn the music: '+mus.afterOneTick);
if(mus.startsWithin<0) fails.push('the danger change scheduled no music at all');
else if(!(mus.startsWithin<=.4)) fails.push('the first danger note is '+mus.startsWithin+'s away — it must cut in, not wait out the bar');
if(mus.afterBriefLull!=='danger') fails.push('the music drops out of danger on a one-frame lull');
if(mus.afterLongLull==='danger') fails.push('the music never comes back out of danger');
if(mus.at30m!=='danger') fails.push('a hostile at 30 m still does not turn the music');

console.log('\nerrors:', errs.length?errs.slice(0,4):'none');
if(errs.length) fails.push(errs.length+' page errors');
if(fails.length){console.log('\nFAILED:');fails.slice(0,12).forEach(f=>console.log('  '+f));process.exitCode=1;}
else console.log('\nVOICES + DANGER MUSIC PASSED');
await b.close();
