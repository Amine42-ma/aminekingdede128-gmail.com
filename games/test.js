// اختبار آلي: يفتح كل لعبة، يضخّ إدخالاً عشوائياً، ويرصد أي خطأ.
// التشغيل:  node test.js      (يتطلّب playwright)
function loadPW(){
  const paths = ['playwright', '/opt/node22/lib/node_modules/playwright',
                 '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'];
  for (const p of paths) { try { return require(p); } catch (e) {} }
  console.error('لم يُعثر على playwright — ثبّته بـ: npm i -g playwright');
  process.exit(1);
}
const { chromium } = loadPW();
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(300);
  const ids = await page.evaluate(() => GAMES.map(g => g.id));
  const bad = [];
  for (const id of ids) {
    errors.length = 0;
    const runErr = await page.evaluate(async (id) => {
      const errs = [];
      const keys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '];
      try { openGame(id); } catch(e){ return ['open: '+e.message]; }
      let restarts = 0;
      for (let i = 0; i < 900; i++) {
        try {
          if (ENG.ended) { if (restarts++ > 6) break; restart(); continue; }
          const k = keys[(Math.random()*keys.length)|0];
          if (i % 3 === 0) { ENG.keys[k] = true; ENG.hitKeys[k] = true; if (ENG.g.key) ENG.g.key(k,true); }
          if (i % 4 === 0) { for (const kk of keys){ if(ENG.keys[kk]){ENG.keys[kk]=false; if(ENG.g.key)ENG.g.key(kk,false);} } }
          const x = Math.random()*800, y = Math.random()*600;
          ENG.m.dx = x - ENG.m.x; ENG.m.dy = y - ENG.m.y; ENG.m.x = x; ENG.m.y = y;
          if (i % 4 === 1) { ENG.m.down = true; if(ENG.g.down) ENG.g.down(x,y); }
          if (i % 4 === 2) { if(ENG.g.move) ENG.g.move(x,y); }
          if (i % 4 === 3) { ENG.m.down = false; if(ENG.g.up) ENG.g.up(x,y); }
          ENG.step(1/60);
        } catch (e) { errs.push('frame '+i+': '+e.message+' @ '+(e.stack||'').split('\n')[1]); break; }
      }
      return errs;
    }, id);
    if (runErr.length) bad.push(id + ' -> ' + runErr[0]);
    if (errors.length) bad.push(id + ' -> ' + errors[0]);
  }
  console.log('=== أخطاء: ' + bad.length + ' ===');
  bad.forEach(b => console.log(' ✗ ' + b));
  await browser.close();
})();
