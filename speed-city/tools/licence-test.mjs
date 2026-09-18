/* ============================================================================
   فحص منطق رخصة القيادة وحده — بلا متصفّح ولا مشهد ثلاثي الأبعاد.
   يُشغَّل من جذر المشروع:  node tools/licence-test.mjs
   ========================================================================== */
import { readFileSync } from 'node:fs';
const SC = { world: { DAY_SECONDS: 480 } };
globalThis.SC = SC;
new Function('SC', readFileSync('src/65_licence.js', 'utf8'))(SC);
const L = SC.licence;

let fails = 0;
const check = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
const save = { money: 5000 };

check(L.state.days === 30, 'تبدأ ٣٠ يوماً: ' + L.state.days);
check(L.fee() === 500 && L.fine() === 1000, 'التجديد ٥٠٠ والغرامة ١٠٠٠ — الضِّعف');

/* دقيقة لعب واحدة */
for (let i = 0; i < 60 * 60; i++) L.tick(1 / 60, 60);
const gone = 30 - L.state.days;
check(gone > 0.12 && gone < 0.13, 'دقيقة لعب أنقصت ' + gone.toFixed(4) + ' يوم — بطيئة كالحقيقة');
check(Math.abs(L.state.days - 29.875) < 0.01, 'المتبقّي ' + L.state.days.toFixed(3) + ' يوماً');

/* ٤ ساعات لعب تُنهيها */
let expired = false;
for (let i = 0; i < 60 * 60 * 60 * 4 && !expired; i++) {
  const e = L.tick(1 / 60, 60);
  if (e && e.event === 'expired') expired = true;
}
check(expired && L.expired(), 'تنتهي بعد ≈٤ ساعات قيادة');
check(L.label() === 'رخصتك منتهية', 'والنصّ يقول: ' + L.label());

/* القيادة وهي منتهية: إيقاف وغرامة الضِّعف */
L.state.drive = 0; L.state.fines = 0;
let caught = null, held = 0;
for (let i = 0; i < 60 * 27; i++) {
  const e = L.tick(1 / 60, 60);
  if (e && e.event === 'caught') caught = e;
  if (L.stopped()) held++;
}
check(!!caught && caught.fine === 1000, 'الشرطة أوقفتك وغرّمتك ' + (caught && caught.fine));
check(L.state.fines === 1, 'مرّة واحدة بعد مهلة ٢٥ ثانية');
check(held > 100 && held < 260, 'وأمسكت السيارة ' + (held / 60).toFixed(1) + ' ثانية');
check(L.stopped(), 'وما زالت ممسوكة عند الثانية ٢٧');

/* تتكرّر إن أصرّ */
for (let i = 0; i < 60 * 130; i++) L.tick(1 / 60, 60);
check(L.state.fines === 2, 'وتتكرّر ما دام مصرّاً: ' + L.state.fines + ' إيقافات');

/* واقفاً لا تُحسب عليه */
const before = L.state.drive;
for (let i = 0; i < 60 * 30; i++) L.tick(1 / 60, 0);
check(L.state.drive === before, 'ولا تُحسب عليه وهو واقف لا يقود');

/* التجديد */
const r = L.renew(save);
check(r.ok && save.money === 4500, 'التجديد خصم ٥٠٠: 5000 ← ' + save.money);
check(Math.round(L.state.days) === 30 && !L.expired(), 'وعادت ٣٠ يوماً');

/* لا تجديد بلا مال */
save.money = 100;
L.state.days = 0;
const poor = L.renew(save);
check(!poor.ok && poor.why === 'money' && save.money === 100, 'ولا يُخصم شيء إن لم يكفِ المال');

/* الحفظ والاسترجاع */
L.state.days = 7.5; L.state.fines = 3;
const box = {};
L.store(box);
check(Math.abs(box.licence.days - 7.5) < 0.001 && box.licence.fines === 3,
      'تُحفظ مع اللعبة: ' + JSON.stringify(box.licence));
L.state.days = 1;
L.load(box);
check(Math.abs(L.state.days - 7.5) < 0.001, 'وتُسترجع كما كانت');

console.log(fails ? '\nERRS ' + fails : '\nERRS 0');
process.exit(fails ? 1 : 0);
