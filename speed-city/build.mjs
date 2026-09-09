/* ============================================================================
   يبني ملف HTML واحداً مستقلاً (index.html) يحتوي كل شيء:
   المكتبة + الشيفرة + الأنماط + نماذج ثلاثية الأبعاد مضمّنة بصيغة base64.
   التشغيل:  node build.mjs
   ========================================================================== */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const kb = (n) => (n / 1024).toFixed(0) + ' KB';

let html = read('dev.html');

/* 1) الأنماط */
html = html.replace(/<link rel="stylesheet" href="css\/game\.css">/,
  '<style>\n' + read('css/game.css') + '\n</style>');

/* 2) الشيفرة (المكتبة ثم وحدات اللعبة) */
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = read(src);
  return '<!-- ===== ' + src + ' ===== -->\n<script>\n' + code + '\n</script>';
});

/* 3) النماذج ثلاثية الأبعاد مضمّنة */
const models = {
  building_stanley: 'building_stanley.glb',
  building_residential5: 'building_residential5.glb',
  building_office2: 'building_office2.glb',
  building_shop: 'building_shop.glb',
  building_house: 'building_house.glb',
  building_school: 'building_school.glb',
  car_cortina: 'car_cortina.glb',
  bike_cyberpunk: 'bike_cyberpunk.glb',
  van_motorhome: 'van_motorhome.glb'
};
let payload = 'window.SC_MODEL_DATA = {\n';
let total = 0;
for (const [key, file] of Object.entries(models)) {
  const buf = readFileSync(join(root, 'assets/models', file));
  total += buf.length;
  payload += '  ' + key + ': "' + buf.toString('base64') + '",\n';
  console.log('  •', file.padEnd(28), kb(buf.length));
}
payload += '};\n';

html = html.replace('<script>\n' + read('src/95_boot.js'),
  '<script>\n' + payload + '</script>\n<script>\n' + read('src/95_boot.js'));

writeFileSync(join(root, 'index.html'), html);
console.log('\nتمّ إنشاء index.html —', kb(statSync(join(root, 'index.html')).size),
  '(النماذج:', kb(total) + ')');
