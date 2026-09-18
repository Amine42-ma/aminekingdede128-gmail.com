/* ============================================================================
   SPEED CITY — رخصة القيادة
   رخصة تنتهي ببطء مع مرور الأيّام في اللعبة (اليوم ≈ ٨ دقائق لعب).
   تجديدها من مركز الشرطة بـ ٥٠٠. وإن قدتَ وهي منتهية أوقفتك الشرطة
   وغرّمتك الضِّعف — ١٠٠٠ — وكرّرت ذلك حتى تجدّد.
   ========================================================================== */
SC.licence = (function () {
  const FEE = 500;                 // ثمن التجديد
  const FINE = FEE * 2;            // غرامة القيادة بلا رخصة: الضِّعف
  const DAYS = 30;                 // مدّة الرخصة بأيّام اللعبة
  const WARN_AT = 5;               // من هنا يبدأ التنبيه
  const GRACE = 25;                // ثوانٍ من القيادة قبل أوّل إيقاف
  const REPEAT = 90;               // ثمّ إيقاف كل هذه المدّة إن أصرّ
  const STOP_SEC = 4;              // كم ثانية تُمسك الشرطة السيارة

  const state = {
    days: DAYS,                    // ما بقي من أيّام الرخصة
    drive: 0,                      // ثوانٍ قيادة بلا رخصة منذ آخر إيقاف
    stop: 0,                       // عدّاد الإيقاف الحالي
    fines: 0,                      // كم غرامة دفع
    warned: 0,                     // آخر رقم يوم نبّهناه عنده
    onChange: null
  };

  const expired = () => state.days <= 0;
  const stopped = () => state.stop > 0;
  const fee = () => FEE;
  const fine = () => FINE;
  const full = () => DAYS;

  function emit() { if (state.onChange) state.onChange(state); }

  function load(save) {
    const l = save.licence || {};
    state.days = typeof l.days === 'number' ? l.days : DAYS;
    state.fines = l.fines || 0;
    state.drive = 0; state.stop = 0; state.warned = 0;
    emit();
  }
  function store(save) {
    save.licence = { days: +state.days.toFixed(3), fines: state.fines };
  }

  /* ينقص يوم كامل كلّما مرّ يوم في المدينة — لا بالساعة الحقيقية، بل بوقت
     اللعب، فلا تنتهي رخصة لاعبٍ تركَ اللعبة شهراً. */
  function tick(dt, drivingKmh) {
    if (state.days > 0) {
      const before = state.days;
      state.days = Math.max(0, state.days - dt / DAY_SECONDS());
      if (Math.ceil(before) !== Math.ceil(state.days)) emit();
      if (state.days <= 0) {
        emit();
        return { event: 'expired' };
      }
      const d = Math.ceil(state.days);
      if (d <= WARN_AT && d !== state.warned) { state.warned = d; return { event: 'warn', days: d }; }
      return null;
    }

    /* منتهية: الشرطة تراك */
    if (state.stop > 0) {
      state.stop = Math.max(0, state.stop - dt);
      if (state.stop === 0) emit();
      return state.stop > 0 ? { event: 'held' } : null;
    }
    if (drivingKmh > 8) state.drive += dt;
    const need = state.fines === 0 ? GRACE : REPEAT;
    if (state.drive >= need) {
      state.drive = 0;
      state.stop = STOP_SEC;
      state.fines++;
      emit();
      return { event: 'caught', fine: FINE };
    }
    return null;
  }

  function DAY_SECONDS() {
    /* اليوم في المدينة ≈ ٤٨٠ ثانية — نقرأه من العالم إن أتاحه */
    return (SC.world && SC.world.DAY_SECONDS) || 480;
  }

  function renew(save) {
    if (save.money < FEE) return { ok: false, why: 'money', need: FEE };
    save.money -= FEE;
    state.days = DAYS; state.drive = 0; state.stop = 0; state.warned = 0;
    emit();
    return { ok: true, paid: FEE, days: DAYS };
  }

  /* نصّ قصير للواجهة */
  function label() {
    if (expired()) return 'رخصتك منتهية';
    const d = Math.ceil(state.days);
    return d + ' ' + (d === 1 ? 'يوم' : d === 2 ? 'يومان' : d <= 10 ? 'أيّام' : 'يوماً');
  }
  const ratio = () => Math.max(0, Math.min(1, state.days / DAYS));

  return { state, load, store, tick, renew, expired, stopped, label, ratio,
           fee, fine, full, WARN_AT,
           set onChange(f) { state.onChange = f; } };
})();
