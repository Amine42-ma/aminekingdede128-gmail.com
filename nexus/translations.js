/* ============================================================
   NEXUS · translations.js — the interface in العربية · English · हिन्दी
   One place for every translated text of the platform (index.html reads it
   before it starts; without this file NEXUS simply stays in Arabic).
   • keys     KEY: [ar, en, hi] — for data-i18n="KEY" in the HTML and NX.t('KEY')
              in the code (the lower-case keys are the older T('cancel') ones).
   • phrases  'نص عربي': [en, hi] — the rest of the interface, exactly as it is
              written in Arabic in index.html: translated wherever it appears on
              screen, the moment it appears. To translate one more text, add one
              line here — nothing else changes.
   Hindi is written in Devanagari — technical words too (गेम, प्रोजेक्ट, कोड,
   सेटिंग्स); only AI, NEXUS, brand names and code stay in Latin letters.
   A text missing here is translated once by NEXUS AI for everyone
   (netlify/edge-functions/i18n.js) the first time it appears.
   ============================================================ */
window.NX_I18N = {
  langs: {
    ar: { name: 'العربية', short: 'ع', dir: 'rtl' },
    en: { name: 'English', short: 'EN', dir: 'ltr' },
    hi: { name: 'हिन्दी', short: 'हि', dir: 'ltr' }
  },

  keys: {
    /* ---- the platform (older T() keys) ---- */
    games: ['الألعاب', 'Games', 'गेम'], discover: ['استكشاف', 'Discover', 'एक्सप्लोर करें'], create: ['إنشاء', 'Create', 'बनाएँ'],
    mygames: ['ألعابي', 'My Games', 'मेरे गेम'], assets: ['الأصول', 'Assets', 'एसेट'], profile: ['الحساب', 'Profile', 'प्रोफ़ाइल'],
    search: ['بحث', 'Search', 'खोजें'], searchAssets: ['ابحث في الأصول…', 'Search assets…', 'एसेट में खोजें…'], searchGames: ['ابحث عن لعبة…', 'Search games…', 'गेम खोजें…'],
    all: ['الكل', 'All', 'सभी'], audio: ['صوت', 'Audio', 'ऑडियो'], textures: ['صور', 'Textures', 'टेक्सचर'], other: ['أخرى', 'Other', 'अन्य'],
    add: ['إضافة', 'ADD', 'जोड़ें'], added: ['أُضيف', 'Added', 'जोड़ दिया'], upload: ['رفع', 'Upload', 'अपलोड'], uploadAsset: ['رفع أصل', 'UPLOAD ASSET', 'एसेट अपलोड करें'],
    cancel: ['إلغاء', 'Cancel', 'रद्द करें'], save: ['حفظ', 'Save', 'सेव करें'], delete: ['حذف', 'Delete', 'हटाएँ'], close: ['إغلاق', 'Close', 'बंद करें'],
    apply: ['تطبيق', 'Apply', 'लागू करें'], undo: ['تراجع', 'Undo', 'अनडू'], redo: ['إعادة', 'Redo', 'रीडू'], preview: ['معاينة', 'Preview', 'प्रीव्यू'], publish: ['نشر', 'Publish', 'पब्लिश'],
    name: ['الاسم', 'Name', 'नाम'], description: ['الوصف', 'Description', 'विवरण'], category: ['الفئة', 'Category', 'श्रेणी'], tags: ['الوسوم', 'Tags', 'टैग'],
    license: ['الترخيص', 'License', 'लाइसेंस'], visibility: ['الظهور', 'Visibility', 'दृश्यता'], public: ['عام', 'Public', 'सार्वजनिक'], private: ['خاص', 'Private', 'निजी'],
    creator: ['المنشئ', 'Creator', 'क्रिएटर'], usage: ['الاستخدام', 'Usage', 'इस्तेमाल'], newest: ['الأحدث', 'Newest', 'सबसे नया'], mostUsed: ['الأكثر استخدامًا', 'Most Used', 'सबसे ज़्यादा इस्तेमाल'],
    relevance: ['الصلة', 'Relevance', 'प्रासंगिकता'], scene: ['المشهد', 'Scene', 'सीन'], code: ['الكود', 'Code', 'कोड'], world: ['العالم', 'World', 'वर्ल्ड'], ai: ['الذكاء', 'AI', 'AI'], more: ['المزيد', 'More', 'और'],
    inspector: ['الخصائص', 'Inspector', 'इंस्पेक्टर'], hierarchy: ['الشجرة', 'Hierarchy', 'हायरार्की'], emptyTitle: ['عالم فارغ', 'Empty world', 'खाली दुनिया'],
    emptyBody: ['لا توجد مكتبة مجسمات جاهزة. افتح «الأصول» لرفع مجسماتك أو لإضافة أصل عام من المكتبة، أو افتح «الكود» وابدأ البرمجة.', 'No bundled model library. Open Assets to upload your own or add a public asset, or open Code and start programming.', 'कोई तैयार मॉडल लाइब्रेरी नहीं है। अपने मॉडल अपलोड करने या लाइब्रेरी से कोई सार्वजनिक एसेट जोड़ने के लिए एसेट खोलें, या कोड खोलकर प्रोग्रामिंग शुरू करें।'],
    noResults: ['لا توجد نتائج', 'No results', 'कोई परिणाम नहीं'], noAssetsYet: ['لا توجد أصول بعد — كن أول من يرفع', 'No assets yet — be the first to upload', 'अभी कोई एसेट नहीं — सबसे पहले आप अपलोड करें'],
    signIn: ['تسجيل الدخول', 'Sign in', 'साइन इन'], signOut: ['خروج', 'Sign out', 'साइन आउट'], newProject: ['مشروع جديد', 'New project', 'नया प्रोजेक्ट'], open: ['فتح', 'Open', 'खोलें'],
    play: ['تشغيل', 'Play', 'चलाएँ'], plays: ['تشغيل', 'plays', 'बार खेला गया'], likes: ['إعجاب', 'likes', 'लाइक'], created: ['أُنشئ', 'Created', 'बनाया गया'], updated: ['حُدّث', 'Updated', 'अपडेट हुआ'],
    position: ['الموقع', 'Position', 'स्थिति'], rotation: ['الدوران', 'Rotation', 'घुमाव'], scale: ['الحجم', 'Scale', 'स्केल'], components: ['المكونات', 'Components', 'कंपोनेंट'],
    scripts: ['السكربتات', 'Scripts', 'स्क्रिप्ट'], addComponent: ['إضافة مكون', 'Add component', 'कंपोनेंट जोड़ें'], newScript: ['سكربت جديد', 'New script', 'नई स्क्रिप्ट'], run: ['تشغيل', 'Run', 'चलाएँ'],
    apiDocs: ['توثيق الـAPI', 'API Docs', 'API दस्तावेज़'], settings: ['الإعدادات', 'Settings', 'सेटिंग्स'], local: ['محلي', 'Local', 'लोकल'], online: ['متصل', 'Online', 'ऑनलाइन'],
    loading: ['تحميل…', 'Loading…', 'लोड हो रहा है…'], confirm: ['تأكيد', 'Confirm', 'पक्का करें'], yes: ['نعم', 'Yes', 'हाँ'], no: ['لا', 'No', 'नहीं'],

    /* ---- the page itself ---- */
    APP_TITLE: ['NEXUS · محرك ألعاب فارغ — أنت من يبنيه', 'NEXUS · An empty game engine — you build it', 'NEXUS · एक खाली गेम इंजन — इसे आप बनाते हैं'],
    BOOT_STARTING: ['جارٍ تشغيل NEXUS…', 'Starting NEXUS…', 'NEXUS शुरू हो रहा है…'],
    BOOT_ENGINE: ['تحميل المحرك', 'Loading the engine', 'इंजन लोड हो रहा है'],
    AGO: ['قبل {n} {u}', '{n}{u} ago', '{n} {u} पहले'],
    UNITS: ['سنة|شهر|يوم|ساعة|دقيقة|ثانية', 'y|mo|d|h|m|s', 'साल|महीने|दिन|घंटे|मिनट|सेकंड'],

    /* ---- the language switcher ---- */
    LANG: ['اللغة', 'Language', 'भाषा'],
    LANG_HINT: ['لغة الواجهة — تتغير فورًا دون إعادة تحميل', 'Interface language — changes at once, no reload', 'इंटरफ़ेस की भाषा — तुरंत बदलती है, रीलोड की ज़रूरत नहीं'],
    LANG_NOTE: ['النصوص النادرة التي لم تُترجم بعد يترجمها NEXUS AI تلقائيًا عند ظهورها أول مرة', 'Rare texts not translated yet are translated automatically by NEXUS AI the first time they appear', 'जो कम दिखने वाले टेक्स्ट अभी अनुवादित नहीं हैं, उन्हें NEXUS AI पहली बार दिखते ही अपने आप अनुवाद कर देता है'],
    LANG_CHANGED: ['اللغة: العربية', 'Language: English', 'भाषा: हिन्दी'],

    /* ---- the player's own models · 2D games ---- */
    MINE_ON: ['✓ من الآن يجيبك نموذجك أنت: {p} · {m} — لا يُستعمل NEXUS AI إلا إذا طلبته.', '✓ From now on your own model answers: {p} · {m} — NEXUS AI is used only if you ask.', '✓ अब से आपका अपना मॉडल जवाब देगा: {p} · {m} — NEXUS AI तभी इस्तेमाल होगा जब आप कहेंगे।'],
    MINE_NONE: ['لم تضف نموذجًا خاصًا بك بعد: أضف مفتاحك (أو Base URL لموقعك) في إعدادات الذكاء، ثم اختبره.', 'You have not added a model of your own yet: add your key (or your site\'s Base URL) in the AI settings, then test it.', 'आपने अभी तक अपना कोई मॉडल नहीं जोड़ा: AI सेटिंग्स में अपनी की (या अपनी साइट का Base URL) जोड़ें, फिर उसे टेस्ट करें।'],
    MINE_NEXUS: ['✓ عدت إلى NEXUS AI المجاني.', '✓ Back to the free NEXUS AI.', '✓ मुफ़्त NEXUS AI पर वापस।'],
    MINE_ADD: ['إعدادات الذكاء', 'AI settings', 'AI सेटिंग्स'],
    G2D: ['الألعاب ثنائية الأبعاد', '2D games', '2D गेम'],
    G2D_NO_AI: ['لصنع لعبة ثنائية الأبعاد اربط نموذج ذكاء أولًا (مفتاحك أو NEXUS AI).', 'To make a 2D game, connect an AI model first (your key or NEXUS AI).', '2D गेम बनाने के लिए पहले एक AI मॉडल जोड़ें (अपनी की या NEXUS AI)।'],
    G2D_WRITING: ['النموذج يكتب لعبتك ثنائية الأبعاد كاملة…', 'The model is writing your complete 2D game…', 'मॉडल आपका पूरा 2D गेम लिख रहा है…'],
    G2D_FIXING: ['تصحيح خطأ في الكود', 'Fixing an error in the code', 'कोड की एक गलती ठीक हो रही है'],
    G2D_FAIL: ['لم يكتب النموذج لعبة صالحة — جرّب مرة أخرى أو نموذجًا أقوى', 'The model did not write a working game — try again or a stronger model', 'मॉडल ने चलने लायक गेम नहीं लिखा — फिर से कोशिश करें या कोई ज़्यादा शक्तिशाली मॉडल चुनें'],
    G2D_SAVING: ['حفظ اللعبة في حسابك…', 'Saving the game to your account…', 'गेम आपके अकाउंट में सेव हो रहा है…'],
    G2D_READY: ['لعبتك «{t}» جاهزة — العبها، عدّل ملفاتها، أو انشرها.', 'Your game "{t}" is ready — play it, edit its files or publish it.', 'आपका गेम "{t}" तैयार है — खेलें, इसकी फ़ाइलें बदलें या पब्लिश करें।'],
    G2D_PLAY: ['العب الآن', 'Play now', 'अभी खेलें'],

    /* ---- 🎓 the live tutor ---- */
    TUTOR: ['🎓 كيف أبرمج؟', '🎓 How do I code?', '🎓 कोडिंग कैसे करें?'],
    TUTOR_SUB: ['NEXUS AI يبرمج أمامك خطوة بخطوة ويشرح', 'NEXUS AI codes in front of you, step by step, and explains', 'NEXUS AI आपके सामने क़दम-दर-क़दम कोड लिखता है और समझाता है'],
    TUTOR_INTRO: ['تعلّم أساسيات البرمجة في محرر NEXUS نفسه: المتغيرات، أوامر الحركة، وربط الأزرار باللعبة.', 'Learn the basics of programming in the NEXUS editor itself: variables, movement commands and connecting buttons to the game.', 'NEXUS एडिटर में ही प्रोग्रामिंग की बुनियादी बातें सीखें: वेरिएबल, मूवमेंट कमांड और बटन को गेम से जोड़ना।'],
    TUTOR_ASK_TITLE: ['السماح لـ NEXUS AI', 'Allow NEXUS AI', 'NEXUS AI को अनुमति दें'],
    TUTOR_ASK: ['هل تسمح للذكاء الاصطناعي بفتح القوائم وكتابة الكود أمامك لتوضيح طريقة البرمجة؟', 'Do you allow the AI to open the menus and write code in front of you to show how programming works?', 'क्या आप AI को मेन्यू खोलने और आपके सामने कोड लिखने की अनुमति देते हैं, ताकि वह प्रोग्रामिंग करके दिखा सके?'],
    TUTOR_ASK_NOTE: ['يكتب في ملف درس جديد داخل مشروعك فقط — لا يغيّر ملفاتك. تستطيع الإيقاف والخروج في أي لحظة.', 'It writes only in a new lesson file in your project — your own files are not changed. You can pause or leave at any moment.', 'यह सिर्फ़ आपके प्रोजेक्ट की एक नई पाठ फ़ाइल में लिखता है — आपकी फ़ाइलें नहीं बदलता। आप कभी भी रोक सकते हैं या बाहर निकल सकते हैं।'],
    TUTOR_OK: ['موافق', 'Allow', 'ठीक है'], TUTOR_NO: ['إلغاء', 'Cancel', 'रद्द करें'],
    TUTOR_START: ['▶ علّمني مباشرة', '▶ Teach me live', '▶ मुझे लाइव सिखाओ'],
    TUTOR_BASICS: ['الأساسيات', 'The basics', 'बुनियादी बातें'],
    TUTOR_B1: ['المتغيرات', 'Variables', 'वेरिएबल'], TUTOR_B1_T: ['صندوق باسم يحفظ قيمة تتغير أثناء اللعب.', 'A named box that keeps a value that changes while you play.', 'एक नाम वाला डिब्बा जो खेलते समय बदलने वाली वैल्यू रखता है।'],
    TUTOR_B2: ['أوامر الحركة', 'Movement commands', 'मूवमेंट कमांड'], TUTOR_B2_T: ['في update(dt) تقرأ المفاتيح أو اللمس وتحرّك الكائن قليلًا في كل إطار.', 'In update(dt) you read the keys or touch and move the object a little every frame.', 'update(dt) में आप कीज़ या टच पढ़ते हैं और हर फ़्रेम में ऑब्जेक्ट को थोड़ा मूव करते हैं।'],
    TUTOR_B3: ['ربط الأزرار باللعبة', 'Connecting buttons to the game', 'बटन को गेम से जोड़ना'], TUTOR_B3_T: ['UI.button يرسم زرًا وينفّذ دالتك عند الضغط.', 'UI.button draws a button and runs your function when it is pressed.', 'UI.button एक बटन बनाता है और दबाने पर आपका फ़ंक्शन चलाता है।'],
    TUTOR_AI_LESSON: ['🧠 درس من NEXUS AI عن موضوعك', '🧠 A lesson from NEXUS AI on your topic', '🧠 आपके विषय पर NEXUS AI का पाठ'],
    TUTOR_AI_PH: ['مثال: كيف أجعل المكعب يقفز؟', 'e.g. How do I make the cube jump?', 'जैसे: क्यूब को जंप कैसे कराऊँ?'],
    TUTOR_AI_MAKE: ['اصنع الدرس', 'Make the lesson', 'पाठ बनाओ'],
    TUTOR_AI_MAKING: ['NEXUS AI يحضّر درسك…', 'NEXUS AI is preparing your lesson…', 'NEXUS AI आपका पाठ तैयार कर रहा है…'],
    TUTOR_AI_FAIL: ['تعذّر أن يحضّر NEXUS AI الدرس الآن — جرّب الدرس المدمج', 'NEXUS AI could not prepare the lesson now — try the built-in lesson', 'NEXUS AI अभी पाठ तैयार नहीं कर सका — बिल्ट-इन पाठ आज़माएँ'],
    TUTOR_NEED_PROJECT: ['درس البرمجة', 'Coding lesson', 'कोडिंग पाठ'],
    TUTOR_PAUSE: ['إيقاف مؤقت', 'Pause', 'रोकें'], TUTOR_PLAY: ['تشغيل', 'Play', 'चलाएँ'], TUTOR_REPLAY: ['أعد الخطوة', 'Replay step', 'स्टेप दोबारा'],
    TUTOR_NEXT: ['الخطوة التالية', 'Next step', 'अगला स्टेप'], TUTOR_SPEED: ['السرعة', 'Speed', 'स्पीड'],
    TUTOR_EXIT: ['خروج وتجربة الكود بنفسي', 'Exit & practice', 'बाहर निकलें और खुद आज़माएँ'],
    TUTOR_STEP: ['الخطوة {i} من {n}', 'Step {i} of {n}', 'स्टेप {i} / {n}'],
    TUTOR_PAUSED: ['متوقف مؤقتًا — اضغط ▶ للمتابعة', 'Paused — press ▶ to continue', 'रुका हुआ — जारी रखने के लिए ▶ दबाएँ'],
    TUTOR_PRACTICE: ['دورك الآن: عدّل الكود ثم اضغط RUN', 'Your turn: change the code, then press RUN', 'अब आपकी बारी: कोड बदलें, फिर RUN दबाएँ'],

    /* the built-in lesson: «your first game script» */
    TL1_TITLE: ['أول سكربت لك: متغيرات، حركة، وزر', 'Your first script: variables, movement and a button', 'आपकी पहली स्क्रिप्ट: वेरिएबल, मूवमेंट और एक बटन'],
    TL1_1: ['أهلًا! سأبرمج أمامك لعبة صغيرة خطوة بخطوة. أنت المتحكم: أوقفني، أعد الخطوة، أو غيّر السرعة من الشريط بالأسفل.', 'Hi! I will program a small game in front of you, step by step. You are in control: pause me, replay a step or change the speed from the bar below.', 'नमस्ते! मैं आपके सामने एक छोटा गेम क़दम-दर-क़दम प्रोग्राम करूँगा। कंट्रोल आपके पास है: नीचे वाली बार से मुझे रोकें, स्टेप दोबारा देखें या speed बदलें।'],
    TL1_2: ['هذه «الأصول» (Assets): مجسمات وأصوات وصور جاهزة تضيفها إلى لعبتك. نبدأ اليوم بمكعب بسيط.', 'These are the Assets: ready models, sounds and images you can add to your game. Today we start with a simple cube.', 'ये एसेट हैं: तैयार मॉडल, साउंड और इमेज जिन्हें आप अपने गेम में जोड़ सकते हैं। आज हम एक सरल क्यूब से शुरू करेंगे।'],
    TL1_3: ['أضفت إلى المشهد مكعبًا اسمه «Player» — سنحرّكه بالكود.', 'I added a cube named "Player" to the scene — we will move it with code.', 'मैंने सीन में "Player" नाम का एक क्यूब जोड़ा है — हम इसे कोड से मूव करेंगे।'],
    TL1_4: ['هذا محرر الكود. في كل سكربت دالتان مهمتان: start() تعمل مرة عند البداية، وupdate(dt) تعمل في كل إطار.', 'This is the code editor. Every script has two key functions: start() runs once at the beginning, update(dt) runs every frame.', 'यह कोड एडिटर है। हर स्क्रिप्ट में दो ज़रूरी फ़ंक्शन होते हैं: start() शुरुआत में एक बार चलता है, और update(dt) हर फ़्रेम में।'],
    TL1_5: ['المتغيرات صناديق تحفظ القيم: let الاسم = القيمة; — هنا السرعة والنقاط.', 'Variables are boxes that keep values: let name = value; — here, the speed and the score.', 'वेरिएबल ऐसे डिब्बे हैं जो वैल्यू रखते हैं: let name = value; — यहाँ speed और score.'],
    TL1_6: ['start() تعمل مرة واحدة: نكتب النقاط على الشاشة، وننشئ زرًا ونربطه بدالة تُنفَّذ عند الضغط.', 'start() runs once: we show the score on screen and create a button bound to a function that runs when it is pressed.', 'start() एक बार चलता है: हम स्क्रीन पर score दिखाते हैं और एक बटन बनाकर उसे ऐसे फ़ंक्शन से जोड़ते हैं जो दबाने पर चलता है।'],
    TL1_7: ['update(dt) تعمل في كل إطار: نقرأ الأسهم أو عصا اللمس بـ Input.axis ونحرّك المكعب. dt هو الزمن منذ الإطار السابق، فتبقى الحركة واحدة على كل الأجهزة.', 'update(dt) runs every frame: we read the arrows or the touch joystick with Input.axis and move the cube. dt is the time since the last frame, so the movement is the same on every device.', 'update(dt) हर फ़्रेम में चलता है: हम Input.axis से ऐरो कीज़ या टच जॉयस्टिक पढ़ते हैं और क्यूब को मूव करते हैं। dt पिछले फ़्रेम से बीता समय है, ताकि मूवमेंट हर डिवाइस पर एक जैसी रहे।'],
    TL1_8: ['نشغّل اللعبة الآن: حرّك المكعب بالأسهم، واضغط JUMP لتزيد النقاط.', 'Now we run the game: move the cube with the arrows and press JUMP to add points.', 'अब गेम चलाते हैं: ऐरो कीज़ से क्यूब को मूव करें और पॉइंट बढ़ाने के लिए JUMP दबाएँ।'],
    TL1_9: ['انتهى الدرس! جرّب بنفسك: غيّر speed إلى 10 أو نص الزر، ثم شغّل من جديد.', 'Lesson done! Try it yourself: change speed to 10 or the button text, then run again.', 'पाठ पूरा हुआ! अब खुद आज़माएँ: speed को 10 करें या बटन का टेक्स्ट बदलें, फिर दोबारा चलाएँ।'],
    TL1_C1: ['المتغيرات: صناديق تحفظ القيم', 'Variables: boxes that keep values', 'वेरिएबल: वैल्यू रखने वाले डिब्बे'],
    TL1_C2: ['start(): تعمل مرة واحدة عند بداية اللعبة', 'start(): runs once when the game begins', 'start(): गेम शुरू होने पर एक बार चलता है'],
    TL1_C3: ['زر مربوط باللعبة: يزيد النقاط عند الضغط', 'A button bound to the game: adds a point when pressed', 'गेम से जुड़ा बटन: दबाने पर पॉइंट बढ़ाता है'],
    TL1_C4: ['update(dt): تعمل في كل إطار — الحركة', 'update(dt): runs every frame — movement', 'update(dt): हर फ़्रेम में चलता है — मूवमेंट']
  },

  phrases: {
    /* the top bar, the studio bar and the tabs */
    'رجوع': ['Back', 'वापस'], 'العودة إلى الصفحة الرئيسية': ['Back to the home page', 'होम पेज पर वापस'],
    'الفريق': ['Team', 'टीम'], 'ادعُ أصدقاءك للعمل معك على المشروع': ['Invite friends to work with you on the project', 'दोस्तों को अपने प्रोजेक्ट पर साथ काम करने के लिए बुलाएँ'],
    'احفظ آخر تغييراتك': ['Save your latest changes', 'अपने नए बदलाव सेव करें'], 'جرّب لعبتك الآن': ['Try your game now', 'अपना गेम अभी आज़माएँ'],
    'كل أدوات المشروع': ['All project tools', 'प्रोजेक्ट के सभी टूल'],
    'أضف شكلًا أو كائنًا إلى المشهد': ['Add a shape or an object to the scene', 'सीन में कोई आकृति या ऑब्जेक्ट जोड़ें'],
    'الكاميرا': ['Camera', 'कैमरा'], 'اجعل الكاميرا تنظر إلى الكائن المحدّد': ['Point the camera at the selected object', 'कैमरा को चुने हुए ऑब्जेक्ट की ओर करें'],
    'الشبكة': ['Grid', 'ग्रिड'], 'إظهار أو إخفاء خطوط الأرضية': ['Show or hide the floor lines', 'ज़मीन की लाइनें दिखाएँ या छिपाएँ'],
    'اللون والحجم والفيزياء للكائن المحدّد': ['Colour, size and physics of the selected object', 'चुने हुए ऑब्जेक्ट का रंग, साइज़ और फ़िज़िक्स'],
    'تعليق': ['Comment', 'कमेंट'], 'اكتب ملاحظة لفريقك على هذا الكائن': ['Leave a note for your team on this object', 'इस ऑब्जेक्ट पर अपनी टीम के लिए नोट लिखें'],
    'اسأل الذكاء': ['Ask AI', 'AI से पूछें'], 'اطلب من المساعد أن يعدّل هذا الكائن أو يصلحه': ['Ask the assistant to change or fix this object', 'असिस्टेंट से इस ऑब्जेक्ट को बदलने या ठीक करने को कहें'],
    'تكرار': ['Duplicate', 'डुप्लिकेट'], 'نسخة من الكائن بجانبه مباشرة': ['A copy of the object right beside it', 'ऑब्जेक्ट की कॉपी, ठीक उसके बगल में'],
    'قائمة': ['Menu', 'मेन्यू'], 'كل أوامر الكائن: حذف، قفل، إخفاء، تجميع، محاذاة…': ['All object commands: delete, lock, hide, group, align…', 'ऑब्जेक्ट के सभी कमांड: डिलीट, लॉक, छिपाएँ, ग्रुप, अलाइन…'],
    'ابحث عن لعبة أو صانع أو أصل': ['Find a game, a creator or an asset', 'गेम, क्रिएटर या एसेट खोजें'],
    'التنبيهات': ['Notifications', 'सूचनाएँ'], 'الإعجابات والمتابعات والدعوات': ['Likes, follows and invites', 'लाइक, फ़ॉलो और आमंत्रण'],
    'اللغة والألوان والحساب والذكاء الاصطناعي': ['Language, colours, account and AI', 'भाषा, रंग, अकाउंट और AI'],
    'تحريك': ['Move', 'मूव'], 'حرّك الكائن بالسحب': ['Drag to move the object', 'खींचकर ऑब्जेक्ट को मूव करें'],
    'تدوير': ['Rotate', 'रोटेट'], 'دوّر الكائن': ['Rotate the object', 'ऑब्जेक्ट को रोटेट करें'], 'كبّر أو صغّر الكائن': ['Make the object bigger or smaller', 'ऑब्जेक्ट को बड़ा या छोटा करें'],
    'الرئيسية': ['Home', 'होम'], 'مشاريعي': ['My projects', 'मेरे प्रोजेक्ट'], 'المجتمع': ['Community', 'कम्युनिटी'],
    'المساعد': ['Assistant', 'असिस्टेंट'], 'صفحة اللعبة': ['Game page', 'गेम पेज'],

    /* the home page */
    'إنشاء لعبة': ['Create a game', 'गेम बनाएँ'], 'دع AI يبنيها': ['Let AI build it', 'AI से बनवाएँ'], 'عرض الكل': ['See all', 'सब देखें'],
    'ليس لديك مشاريع بعد.': ['You have no projects yet.', 'अभी आपके कोई प्रोजेक्ट नहीं हैं।'],
    'ابدأ من الصفر أو دع المساعد يبنيها لك.': ['Start from scratch or let the assistant build it for you.', 'शुरू से बनाएँ या असिस्टेंट से बनवाएँ।'],
    'إنشاء أول لعبة': ['Create your first game', 'अपना पहला गेम बनाएँ'], 'دع AI يبني لعبتك': ['Let AI build your game', 'AI से अपना गेम बनवाएँ'],
    'استيراد مشروع': ['Import a project', 'प्रोजेक्ट इंपोर्ट करें'], 'أكمل من حيث توقّفت': ['Continue where you left off', 'जहाँ छोड़ा था वहीं से जारी रखें'],
    'أحدث الألعاب المنشورة': ['Latest published games', 'नए पब्लिश हुए गेम'], 'لا توجد ألعاب منشورة بعد': ['No published games yet', 'अभी कोई पब्लिश हुआ गेम नहीं'],
    'أنشئ أول لعبة على هذه المنصة.': ['Create the first game on this platform.', 'इस प्लेटफ़ॉर्म पर पहला गेम बनाएँ।'],
    'الأكثر تشغيلًا': ['Most played', 'सबसे ज़्यादा खेले गए'], 'لا ألعاب بعد': ['No games yet', 'अभी कोई गेम नहीं'], 'الجديد': ['New', 'नया'],
    'أتابعهم': ['Following', 'फ़ॉलोइंग'], 'ألعاب': ['Games', 'गेम'], 'بث': ['Live', 'लाइव'], 'ابدأ بثًا': ['Go live', 'लाइव शुरू करें'],
    'لا بث مباشر الآن': ['Nobody is live now', 'अभी कोई लाइव नहीं'], 'رفع فيديو': ['Upload a video', 'वीडियो अपलोड करें'], 'تسجيل مقطع': ['Record a clip', 'क्लिप रिकॉर्ड करें'], 'بث مباشر': ['Live stream', 'लाइव स्ट्रीम'],
    'لعبتي الأولى': ['My first game', 'मेरा पहला गेम'], 'لا نتائج لبحثك': ['No results for your search', 'आपकी खोज का कोई परिणाम नहीं'],

    /* 🏆 challenges (the main words) */
    'كل التحديات': ['All challenges', 'सभी चैलेंज'], 'شارك في التحدي': ['Join the challenge', 'चैलेंज में शामिल हों'], 'ينتهي بعد': ['Ends in', 'खत्म होने में'],
    'المشاركون': ['Players', 'खिलाड़ी'], 'الجائزة': ['Prize', 'इनाम'], 'ابتكره وحكّمه NEXUS AI': ['Invented and judged by NEXUS AI', 'NEXUS AI ने बनाया और जज किया'],
    'NEXUS AI يبتكر التحدي التالي…': ['NEXUS AI is inventing the next challenge…', 'NEXUS AI अगला चैलेंज बना रहा है…'],
    '🏆 سلّم لعبتك': ['🏆 Submit your game', '🏆 अपना गेम सबमिट करें'], 'التحدي': ['Challenge', 'चैलेंज'], 'المشاركات': ['Entries', 'एंट्री'],
    'السابقة': ['Past', 'पिछले'], '👥 الأصدقاء': ['👥 Friends', '👥 दोस्त'], 'الإدارة': ['Admin', 'एडमिन'], '👥 مع الأصدقاء': ['👥 With friends', '👥 दोस्तों के साथ'],
    '🏆 تسليم اللعبة للتحدي': ['🏆 Submit the game to a challenge', '🏆 गेम को चैलेंज में सबमिट करें'], 'مشروع جديد للتحدي': ['New project for the challenge', 'चैलेंज के लिए नया प्रोजेक्ट'],
    '🏁 شارك في التحدي': ['🏁 Join the challenge', '🏁 चैलेंज में शामिल हों'], 'ألعاب مسلّمة': ['Games submitted', 'सबमिट हुए गेम'], 'الأول': ['1st', 'पहला'], 'الثاني': ['2nd', 'दूसरा'], 'الثالث': ['3rd', 'तीसरा'],
    '📖 القصة': ['📖 The story', '📖 कहानी'], '🎯 الهدف': ['🎯 The goal', '🎯 लक्ष्य'], '📜 القواعد': ['📜 The rules', '📜 नियम'], '⚙️ الميكانيكيات': ['⚙️ Mechanics', '⚙️ मैकेनिक्स'],
    '🏁 كيف يُحدَّد الفائز': ['🏁 How the winner is decided', '🏁 विजेता कैसे तय होगा'], '🧾 القواعد العامة': ['🧾 General rules', '🧾 सामान्य नियम'],

    /* the studio's «المزيد» */
    'حفظ المشروع': ['Save the project', 'प्रोजेक्ट सेव करें'], 'يحفظ آخر تغييراتك على الخادم (يحفظ وحده أيضًا كل قليل)': ['Saves your latest changes to the server (it also saves by itself every so often)', 'आपके नए बदलाव सर्वर पर सेव करता है (यह अपने आप भी सेव करता रहता है)'],
    'تشغيل تجريبي': ['Test run', 'टेस्ट रन'], 'جرّب لعبتك الآن كما سيراها اللاعب': ['Try your game now as players will see it', 'अपना गेम अभी वैसे आज़माएँ जैसे खिलाड़ी देखेंगे'],
    'نشر اللعبة · Publish': ['Publish the game · Publish', 'गेम पब्लिश करें · Publish'], 'اجعل لعبتك متاحة للناس برابط وصفحة عرض': ['Make your game available with a link and a showcase page', 'अपने गेम को लिंक और शोकेस पेज के साथ सबके लिए उपलब्ध करें'],
    'وسائط اللعبة · GAME MEDIA': ['Game media · GAME MEDIA', 'गेम मीडिया · GAME MEDIA'], 'كل صور الصفحة وخلفيتها وترتيب أقسامها': ["All the page's images, background and section order", 'पेज की सभी इमेज, बैकग्राउंड और सेक्शन का क्रम'],
    'تراجع عن آخر تغيير في المشهد': ['Undo the last scene change', 'सीन का आखिरी बदलाव अनडू करें'], 'يلغي آخر تعديل على الكائنات': ['Cancels the last edit to the objects', 'ऑब्जेक्ट पर आखिरी एडिट रद्द करता है'],
    'الكود ومتعدّد اللغات': ['Code (many languages)', 'कोड (कई भाषाएँ)'], 'افتح ملفات الكود وعدّلها': ['Open and edit the code files', 'कोड फ़ाइलें खोलें और एडिट करें'],
    'بناء المشروع · BUILD': ['Build the project · BUILD', 'प्रोजेक्ट बिल्ड करें · BUILD'], 'يجهّز اللعبة للتشغيل ويكشف أخطاء الكود': ['Prepares the game to run and finds code errors', 'गेम को चलाने के लिए तैयार करता है और कोड की गलतियाँ ढूँढता है'],
    'سلاسل الأدوات · Toolchains': ['Toolchains', 'टूलचेन'], 'لغات برمجة إضافية (للمحترفين)': ['Extra programming languages (for pros)', 'अतिरिक्त प्रोग्रामिंग भाषाएँ (प्रो यूज़र्स के लिए)'],
    'الأمان وقواعد الحماية': ['Security and protection rules', 'सुरक्षा नियम'], 'القواعد التي تحمي بياناتك، وفحص أمان المشروع': ['The rules that protect your data, and a project security scan', 'आपका डेटा सुरक्षित रखने वाले नियम, और प्रोजेक्ट का सुरक्षा स्कैन'],
    'لوحة المشروع': ['Project dashboard', 'प्रोजेक्ट डैशबोर्ड'], 'ملخّص مشروعك وكل أقسامه في شاشة واحدة': ['Your project and all its parts on one screen', 'आपका प्रोजेक्ट और उसके सभी हिस्से एक स्क्रीन पर'],
    'تصدير / استيراد': ['Export / Import', 'एक्सपोर्ट / इंपोर्ट'], 'احفظ نسخة من مشروعك في ملف، أو افتح نسخة': ['Save a copy of your project to a file, or open one', 'अपने प्रोजेक्ट की कॉपी फ़ाइल में सेव करें, या कोई कॉपी खोलें'],
    'كل مشاريعك — افتح أو أنشئ أو احذف': ['All your projects — open, create or delete', 'आपके सभी प्रोजेक्ट — खोलें, बनाएँ या डिलीट करें'],
    'تاريخ المشروع ونقاط الرجوع': ['Project history and restore points', 'प्रोजेक्ट हिस्ट्री और रीस्टोर पॉइंट'], 'ارجع إلى نسخة سابقة من مشروعك': ['Go back to an earlier version of your project', 'अपने प्रोजेक्ट के पुराने वर्ज़न पर लौटें'],
    'الأوامر والبحث': ['Commands and search', 'कमांड और सर्च'], 'ابحث عن أي أداة باسمها': ['Find any tool by its name', 'किसी भी टूल को नाम से खोजें'],
    'التبديل إلى وضع المحترف': ['Switch to pro mode', 'प्रो मोड पर जाएँ'], 'يُظهر كل الأدوات المتقدّمة في الأسفل': ['Shows all the advanced tools at the bottom', 'नीचे सभी एडवांस्ड टूल दिखाता है'],
    'التبديل إلى وضع المبتدئ': ['Switch to beginner mode', 'शुरुआती मोड पर जाएँ'], 'واجهة أبسط بأدوات أقل': ['A simpler interface with fewer tools', 'कम टूल वाला आसान इंटरफ़ेस'],
    'تفريغ المشهد': ['Clear the scene', 'सीन खाली करें'], 'يحذف كل الكائنات من المشهد (تبقى السكربتات)': ['Deletes every object in the scene (scripts stay)', 'सीन के सभी ऑब्जेक्ट डिलीट करता है (स्क्रिप्ट बनी रहती हैं)'],
    '📁 الملفات': ['📁 Files', '📁 फ़ाइलें'], 'ملفات المشروع ومجلّداته': ["The project's files and folders", 'प्रोजेक्ट की फ़ाइलें और फ़ोल्डर'],
    '📦 المكتبات': ['📦 Libraries', '📦 लाइब्रेरी'], 'مكتبات جاهزة يستعملها كودك': ['Ready-made libraries your code uses', 'आपके कोड के लिए तैयार लाइब्रेरी'],
    '🧩 الإضافات': ['🧩 Plugins', '🧩 प्लगइन'], 'أدوات إضافية للاستوديو': ['Extra tools for the studio', 'स्टूडियो के लिए अतिरिक्त टूल'],
    '🐞 الأخطاء': ['🐞 Bugs', '🐞 बग'], 'أخطاء أبلغ عنها الفريق أو اللاعبون': ['Bugs reported by the team or players', 'टीम या खिलाड़ियों द्वारा बताए गए बग'],
    '💬 التعليقات': ['💬 Comments', '💬 कमेंट'], 'ملاحظات الفريق على الكائنات والكود': ["The team's notes on objects and code", 'ऑब्जेक्ट और कोड पर टीम के नोट'],
    '✅ المهام': ['✅ Tasks', '✅ टास्क'], 'من يفعل ماذا في المشروع': ['Who does what in the project', 'प्रोजेक्ट में कौन क्या कर रहा है'],
    '🧪 اختبار جماعي': ['🧪 Group playtest', '🧪 ग्रुप प्लेटेस्ट'], 'العب مع فريقك لتجربة اللعبة معًا': ['Play with your team to test the game together', 'गेम को साथ में टेस्ट करने के लिए अपनी टीम के साथ खेलें'],
    '🌐 الترجمة': ['🌐 Translation', '🌐 अनुवाद'], 'نصوص اللعبة بلغات أخرى': ["Your game's texts in other languages", 'आपके गेम के टेक्स्ट दूसरी भाषाओं में'],
    '🏆 لوحة الصدارة': ['🏆 Leaderboard', '🏆 लीडरबोर्ड'], 'ترتيب أفضل اللاعبين في لعبتك': ['The best players of your game', 'आपके गेम के सबसे अच्छे खिलाड़ी'],
    '📊 التحليلات': ['📊 Analytics', '📊 एनालिटिक्स'], 'كم شخصًا لعب، وكم بقي': ['How many played, and how long they stayed', 'कितने लोगों ने खेला, और कितनी देर रुके'],
    '🎞 الإعادات': ['🎞 Replays', '🎞 रीप्ले'], 'تسجيلات لعب يمكن مشاهدتها': ['Recorded play sessions you can watch', 'खेल की रिकॉर्डिंग जिन्हें आप देख सकते हैं'],
    '🎨 ألوان صفحة اللعبة': ['🎨 Game page colours', '🎨 गेम पेज के रंग'], 'ألوان صفحة عرض لعبتك': ["The colours of your game's showcase page", 'आपके गेम के शोकेस पेज के रंग'],
    '🛡️ فحص الأمان · Scan Project': ['🛡️ Security scan · Scan Project', '🛡️ सुरक्षा स्कैन · Scan Project'], 'يبحث عن مشاكل أمان في كودك': ['Looks for security problems in your code', 'आपके कोड में सुरक्षा समस्याएँ ढूँढता है'],
    '📱 اختبار الجهاز · Test Mobile': ['📱 Device test · Test Mobile', '📱 डिवाइस टेस्ट · Test Mobile'], 'هل تعمل لعبتك جيدًا على الهاتف؟': ['Does your game work well on phones?', 'क्या आपका गेम फ़ोन पर अच्छा चलता है?'],
    '🧹 تحسين المشروع · Optimize': ['🧹 Optimize the project · Optimize', '🧹 प्रोजेक्ट ऑप्टिमाइज़ करें · Optimize'], 'يجعل لعبتك أخفّ وأسرع': ['Makes your game lighter and faster', 'आपके गेम को हल्का और तेज़ बनाता है'],
    'مرجع الأوامر التي يستعملها كود اللعبة': ['Reference of the commands game code uses', 'गेम कोड में इस्तेमाल होने वाले कमांड का रेफ़रेंस'],
    '🎬 صفحة لعبتك — أيقونة · غلاف · فيديو · صور · شرح': ["🎬 Your game's page — icon · cover · video · images · description", '🎬 आपके गेम का पेज — आइकन · कवर · वीडियो · इमेज · विवरण'],
    'ما يراه الناس قبل أن يلعبوا. اضغط لإضافتها أو تغييرها': ['What people see before they play. Tap to add or change it', 'खेलने से पहले लोग यही देखते हैं। जोड़ने या बदलने के लिए टैप करें'],
    'وضع المحترف — كل الأدوات ظاهرة': ['Pro mode — all tools shown', 'प्रो मोड — सभी टूल दिख रहे हैं'], 'وضع المبتدئ — واجهة مبسّطة': ['Beginner mode — a simpler interface', 'शुरुआती मोड — आसान इंटरफ़ेस'],
    'الفريق · TEAM': ['Team · TEAM', 'टीम · TEAM'], 'ادعُ أصدقاءك للعمل معك على نفس المشروع، وحدّد دور كل واحد': ['Invite friends to the same project and give each one a role', 'दोस्तों को उसी प्रोजेक्ट पर बुलाएँ और हर किसी की भूमिका तय करें'],
    'مكتبة الأصول': ['Assets library', 'एसेट लाइब्रेरी'], 'فتح مكتبة الأصول لإضافة مجسم': ['Open the Assets library to add a model', 'मॉडल जोड़ने के लिए एसेट लाइब्रेरी खोलें'], 'إضافة من الأصول': ['Add from Assets', 'एसेट से जोड़ें'],

    /* settings */
    'اللغة والمظهر': ['Language and appearance', 'भाषा और रूप'], '🎨 ألوان واجهتي · My colours': ['🎨 My interface colours · My colours', '🎨 मेरे इंटरफ़ेस के रंग · My colours'],
    'اختر ألوان NEXUS كما تحبها — تتبعك على كل أجهزتك': ["Choose NEXUS's colours your way — they follow you on all your devices", 'NEXUS के रंग अपनी पसंद से चुनें — ये आपके सभी डिवाइस पर साथ रहेंगे'],
    '💰 نقاطي': ['💰 My points', '💰 मेरे पॉइंट'], 'الاتصال': ['Connection', 'कनेक्शन'], 'تسجيل الدخول (Google أو البريد)': ['Sign in (Google or e-mail)', 'साइन इन (Google या ई-मेल)'],
    'الذكاء الاصطناعي': ['Artificial intelligence', 'AI (आर्टिफ़िशियल इंटेलिजेंस)'], 'مزوّدو الذكاء الاصطناعي': ['AI providers', 'AI प्रोवाइडर'],
    'اختر النموذج، أو أضف مفتاحك الخاص (يبقى في هذا المتصفح فقط)': ['Choose the model, or add your own key (kept in this browser only)', 'मॉडल चुनें, या अपनी की जोड़ें (सिर्फ़ इसी ब्राउज़र में रहती है)'],
    '🔑 مفاتيح الذكاء المجاني — لصاحب الموقع': ['🔑 Free AI keys — for the site owner', '🔑 फ़्री AI कीज़ — साइट के मालिक के लिए'], '🤝 تبرّع بمفتاح للذكاء المجاني': ['🤝 Donate a key to the free AI', '🤝 फ़्री AI के लिए की डोनेट करें'],
    'لأي لاعب: مفتاحك يساعد الجميع ولا يستطيع أحد قراءته — وتسحبه متى شئت': ['For any player: your key helps everyone, nobody can read it — and you can take it back any time', 'हर खिलाड़ी के लिए: आपकी की सबकी मदद करती है, इसे कोई पढ़ नहीं सकता — और आप इसे कभी भी वापस ले सकते हैं'],
    'الحساب والأمان': ['Account and security', 'अकाउंट और सुरक्षा'], '🎂 العمر والمحتوى': ['🎂 Age and content', '🎂 उम्र और कंटेंट'],
    'عمرك في حسابك: يحدّد أي ألعاب ومواقع (فوق 3+) تظهر لك وتُفتح': ['The age on your account decides which games and sites (above 3+) you see and open', 'आपके अकाउंट में उम्र तय करती है कि कौन से गेम और साइट्स (3+ से ऊपर) आपको दिखें और खुलें'],
    '🔑 مفاتيح المرور · Passkeys': ['🔑 Passkeys', '🔑 पासकी'], 'ادخل ببصمتك أو وجهك بدل كلمة المرور (اختياري)': ['Sign in with your fingerprint or face instead of a password (optional)', 'पासवर्ड की जगह फ़िंगरप्रिंट या चेहरे से साइन इन करें (वैकल्पिक)'],
    'القواعد التي تحمي بيانات موقعك (لمالك الموقع)': ["The rules that protect your site's data (for the site owner)", 'आपकी साइट का डेटा सुरक्षित रखने वाले नियम (साइट के मालिक के लिए)'],
    'إذا حدثت مشكلة': ['If something goes wrong', 'अगर कोई समस्या हो'], 'التشخيص': ['Diagnostics', 'डायग्नॉस्टिक्स'],
    'يفحص الاتصال والتخزين والنشر، ويقول ما الذي لا يعمل ولماذا': ["Checks the connection, storage and publishing, and says what isn't working and why", 'कनेक्शन, स्टोरेज और पब्लिशिंग जाँचता है, और बताता है क्या नहीं चल रहा और क्यों'],
    'سجلّ الأخطاء والتشخيص': ['Error and diagnostics log', 'एरर और डायग्नॉस्टिक्स लॉग'], 'آخر الأخطاء التي حدثت مع المساعد والأدوات': ['The latest errors with the assistant and the tools', 'असिस्टेंट और टूल के साथ हुई नई गलतियाँ'],
    'مسح ذاكرة الأصول المؤقتة': ['Clear the assets cache', 'एसेट कैश साफ़ करें'], 'الأمان': ['Security', 'सुरक्षा'],

    /* signing in */
    'المتابعة مع Google': ['Continue with Google', 'Google के साथ जारी रखें'], 'البريد وكلمة المرور': ['E-mail and password', 'ई-मेल और पासवर्ड'],
    '🔑 الدخول بمفتاح المرور · Passkey': ['🔑 Sign in with a passkey · Passkey', '🔑 पासकी से साइन इन करें · Passkey'], 'أهلًا': ['Welcome', 'स्वागत है'],
    'زائر (بلا جلسة)': ['Visitor (no session)', 'विज़िटर (कोई सेशन नहीं)'], 'إعادة محاولة الاتصال': ['Retry the connection', 'फिर से कनेक्ट करें'], 'التشخيص الكامل': ['Full diagnostics', 'पूरा डायग्नॉस्टिक्स'],
    'سجّل الدخول أولًا': ['Sign in first', 'पहले साइन इन करें'], 'افتح مشروعًا أولًا': ['Open a project first', 'पहले कोई प्रोजेक्ट खोलें'],

    /* the assistant */
    'محادثة': ['Chat', 'चैट'], 'بناء': ['Build', 'बिल्ड'], 'ما الذي يراه؟': ['What does it see?', 'यह क्या देखता है?'],
    'صف ما تريد… مثال: «اصنع لعبة سباق في مدينة فيها شرطة»': ['Describe what you want… e.g. «Make a racing game in a city with police»', 'बताइए आप क्या चाहते हैं… जैसे: «पुलिस वाले शहर में एक रेसिंग गेम बनाओ»'],

    /* the code editor */
    'الكود · Multi-language': ['Code · Multi-language', 'कोड · Multi-language'], '+ ملف': ['+ File', '+ फ़ाइल'],
    'لا مخرجات بعد. اضغط BUILD.': ['No output yet. Press BUILD.', 'अभी कोई आउटपुट नहीं। BUILD दबाएँ।'],

    /* words everywhere */
    'حذف': ['Delete', 'हटाएँ'], 'فتح': ['Open', 'खोलें'], 'إغلاق': ['Close', 'बंद करें'], 'متابعة': ['Follow', 'फ़ॉलो करें'], 'مشاركة': ['Share', 'शेयर करें'],
    'تعديل': ['Edit', 'एडिट करें'], 'إعادة المحاولة': ['Retry', 'फिर कोशिश करें'], 'الحالة': ['Status', 'स्थिति'], 'إزالة': ['Remove', 'हटाएँ'], 'التالي': ['Next', 'अगला'],
    'إظهار': ['Show', 'दिखाएँ'], 'إخفاء': ['Hide', 'छिपाएँ'], 'نُسخ الرابط': ['Link copied', 'लिंक कॉपी हो गया'], 'ملف جديد': ['New file', 'नई फ़ाइल'], 'منشور': ['Published', 'पब्लिश हुआ'],
    'إبلاغ': ['Report', 'रिपोर्ट करें'], 'نسخ': ['Copy', 'कॉपी करें'], 'نُسخ': ['Copied', 'कॉपी हो गया'], 'إضافة كائن': ['Add an object', 'ऑब्जेक्ट जोड़ें'], 'اسم المشروع': ['Project name', 'प्रोजेक्ट का नाम'],
    'لا نتائج': ['No results', 'कोई परिणाम नहीं'], 'إرسال': ['Send', 'भेजें'], 'التفاصيل': ['Details', 'विवरण'], 'تحميل': ['Download', 'डाउनलोड'], 'جارٍ التحميل…': ['Loading…', 'लोड हो रहा है…'],
    'إعادة تسمية': ['Rename', 'नाम बदलें'], 'إيقاف مؤقت': ['Pause', 'रोकें'], 'فيديو': ['Video', 'वीडियो'], 'جارٍ…': ['Working…', 'हो रहा है…'], 'اللعبة': ['Game', 'गेम'],
    'الإصدار': ['Version', 'वर्ज़न'], 'الأيقونة': ['Icon', 'आइकन'], 'رفع صورة': ['Upload an image', 'इमेज अपलोड करें'], '✓ حُفظ': ['✓ Saved', '✓ सेव हो गया'], 'تمّ.': ['Done.', 'हो गया।'],
    'المالك': ['Owner', 'मालिक'], 'النقاط': ['Points', 'पॉइंट'], 'اللاعب': ['Player', 'खिलाड़ी'], 'تعذّر التحميل': ["Couldn't load", 'लोड नहीं हो सका'], 'آخر تعديل': ['Last edited', 'आखिरी बदलाव'],
    'مشروع': ['Project', 'प्रोजेक्ट'], 'أنت': ['You', 'आप'], 'متاح': ['Available', 'उपलब्ध'], 'غير متاح': ['Unavailable', 'उपलब्ध नहीं'], 'يعمل': ['Working', 'चल रहा है'], 'متوقف': ['Stopped', 'रुका हुआ'],
    'تسجيل الدخول': ['Sign in', 'साइन इन'], 'سجّل الدخول': ['Sign in', 'साइन इन'], 'نسختي': ['My copy', 'मेरी कॉपी'], 'نسخة': ['Copy', 'कॉपी'], 'عضو': ['Member', 'सदस्य'], 'تلقائي': ['Automatic', 'अपने आप'],
    'نقطة': ['point', 'पॉइंट'], 'انتهى': ['Ended', 'खत्म'], 'رفض': ['Decline', 'मना करें'], 'قبول': ['Accept', 'स्वीकार करें'], 'تم': ['Done', 'हो गया']
  }
};
