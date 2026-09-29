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
   Hindi (Devanagari) keeps the familiar technical words in English — AI,
   Assets, Code, Project, Game, Scene, Script, Build, NEXUS Pro — the way
   Indian creators say them (Hinglish).
   ============================================================ */
window.NX_I18N = {
  langs: {
    ar: { name: 'العربية', short: 'ع', dir: 'rtl' },
    en: { name: 'English', short: 'EN', dir: 'ltr' },
    hi: { name: 'हिन्दी', short: 'हि', dir: 'ltr' }
  },

  keys: {
    /* ---- the platform (older T() keys) ---- */
    games: ['الألعاب', 'Games', 'Games'], discover: ['استكشاف', 'Discover', 'Explore'], create: ['إنشاء', 'Create', 'बनाएँ'],
    mygames: ['ألعابي', 'My Games', 'मेरे Games'], assets: ['الأصول', 'Assets', 'Assets'], profile: ['الحساب', 'Profile', 'Profile'],
    search: ['بحث', 'Search', 'खोजें'], searchAssets: ['ابحث في الأصول…', 'Search assets…', 'Assets में खोजें…'], searchGames: ['ابحث عن لعبة…', 'Search games…', 'Game खोजें…'],
    all: ['الكل', 'All', 'सभी'], audio: ['صوت', 'Audio', 'Audio'], textures: ['صور', 'Textures', 'Textures'], other: ['أخرى', 'Other', 'अन्य'],
    add: ['إضافة', 'ADD', 'जोड़ें'], added: ['أُضيف', 'Added', 'जोड़ दिया'], upload: ['رفع', 'Upload', 'Upload'], uploadAsset: ['رفع أصل', 'UPLOAD ASSET', 'Asset upload करें'],
    cancel: ['إلغاء', 'Cancel', 'रद्द करें'], save: ['حفظ', 'Save', 'Save करें'], delete: ['حذف', 'Delete', 'Delete करें'], close: ['إغلاق', 'Close', 'बंद करें'],
    apply: ['تطبيق', 'Apply', 'लागू करें'], undo: ['تراجع', 'Undo', 'Undo'], redo: ['إعادة', 'Redo', 'Redo'], preview: ['معاينة', 'Preview', 'Preview'], publish: ['نشر', 'Publish', 'Publish'],
    name: ['الاسم', 'Name', 'नाम'], description: ['الوصف', 'Description', 'विवरण'], category: ['الفئة', 'Category', 'Category'], tags: ['الوسوم', 'Tags', 'Tags'],
    license: ['الترخيص', 'License', 'License'], visibility: ['الظهور', 'Visibility', 'Visibility'], public: ['عام', 'Public', 'Public'], private: ['خاص', 'Private', 'Private'],
    creator: ['المنشئ', 'Creator', 'Creator'], usage: ['الاستخدام', 'Usage', 'इस्तेमाल'], newest: ['الأحدث', 'Newest', 'सबसे नया'], mostUsed: ['الأكثر استخدامًا', 'Most Used', 'सबसे ज़्यादा इस्तेमाल'],
    relevance: ['الصلة', 'Relevance', 'Relevance'], scene: ['المشهد', 'Scene', 'Scene'], code: ['الكود', 'Code', 'Code'], world: ['العالم', 'World', 'World'], ai: ['الذكاء', 'AI', 'AI'], more: ['المزيد', 'More', 'और'],
    inspector: ['الخصائص', 'Inspector', 'Inspector'], hierarchy: ['الشجرة', 'Hierarchy', 'Hierarchy'], emptyTitle: ['عالم فارغ', 'Empty world', 'खाली दुनिया'],
    emptyBody: ['لا توجد مكتبة مجسمات جاهزة. افتح «الأصول» لرفع مجسماتك أو لإضافة أصل عام من المكتبة، أو افتح «الكود» وابدأ البرمجة.',
      'No bundled model library. Open Assets to upload your own or add a public asset, or open Code and start programming.',
      'कोई तैयार model library नहीं है। अपने models upload करने या library से कोई public Asset जोड़ने के लिए Assets खोलें, या Code खोलकर programming शुरू करें।'],
    noResults: ['لا توجد نتائج', 'No results', 'कोई result नहीं'], noAssetsYet: ['لا توجد أصول بعد — كن أول من يرفع', 'No assets yet — be the first to upload', 'अभी कोई Asset नहीं — सबसे पहले आप upload करें'],
    signIn: ['تسجيل الدخول', 'Sign in', 'Sign in'], signOut: ['خروج', 'Sign out', 'Sign out'], newProject: ['مشروع جديد', 'New project', 'नया Project'], open: ['فتح', 'Open', 'खोलें'],
    play: ['تشغيل', 'Play', 'चलाएँ'], plays: ['تشغيل', 'plays', 'plays'], likes: ['إعجاب', 'likes', 'likes'], created: ['أُنشئ', 'Created', 'बनाया गया'], updated: ['حُدّث', 'Updated', 'Update हुआ'],
    position: ['الموقع', 'Position', 'Position'], rotation: ['الدوران', 'Rotation', 'Rotation'], scale: ['الحجم', 'Scale', 'Scale'], components: ['المكونات', 'Components', 'Components'],
    scripts: ['السكربتات', 'Scripts', 'Scripts'], addComponent: ['إضافة مكون', 'Add component', 'Component जोड़ें'], newScript: ['سكربت جديد', 'New script', 'नई Script'], run: ['تشغيل', 'Run', 'Run'],
    apiDocs: ['توثيق الـAPI', 'API Docs', 'API Docs'], settings: ['الإعدادات', 'Settings', 'Settings'], local: ['محلي', 'Local', 'Local'], online: ['متصل', 'Online', 'Online'],
    loading: ['تحميل…', 'Loading…', 'Load हो रहा है…'], confirm: ['تأكيد', 'Confirm', 'पक्का करें'], yes: ['نعم', 'Yes', 'हाँ'], no: ['لا', 'No', 'नहीं'],

    /* ---- the page itself ---- */
    APP_TITLE: ['NEXUS · محرك ألعاب فارغ — أنت من يبنيه', 'NEXUS · An empty game engine — you build it', 'NEXUS · एक खाली Game Engine — इसे आप बनाते हैं'],
    BOOT_STARTING: ['جارٍ تشغيل NEXUS…', 'Starting NEXUS…', 'NEXUS शुरू हो रहा है…'],
    BOOT_ENGINE: ['تحميل المحرك', 'Loading the engine', 'Engine load हो रहा है'],
    AGO: ['قبل {n} {u}', '{n}{u} ago', '{n} {u} पहले'],
    UNITS: ['سنة|شهر|يوم|ساعة|دقيقة|ثانية', 'y|mo|d|h|m|s', 'साल|महीने|दिन|घंटे|मिनट|सेकंड'],

    /* ---- the language switcher ---- */
    LANG: ['اللغة', 'Language', 'भाषा'],
    LANG_HINT: ['لغة الواجهة — تتغير فورًا دون إعادة تحميل', 'Interface language — changes at once, no reload', 'इंटरफ़ेस की भाषा — तुरंत बदलती है, reload की ज़रूरत नहीं'],
    LANG_NOTE: ['نصوص نادرة قد تبقى بالعربية حتى تُضاف إلى translations.js', 'A few rare texts may stay in Arabic until they are added to translations.js', 'कुछ कम दिखने वाले texts translations.js में जुड़ने तक Arabic में रह सकते हैं'],
    LANG_CHANGED: ['اللغة: العربية', 'Language: English', 'भाषा: हिन्दी'],

    /* ---- 🎓 the live tutor ---- */
    TUTOR: ['🎓 كيف أبرمج؟', '🎓 How do I code?', '🎓 Coding कैसे करें?'],
    TUTOR_SUB: ['NEXUS AI يبرمج أمامك خطوة بخطوة ويشرح', 'NEXUS AI codes in front of you, step by step, and explains', 'NEXUS AI आपके सामने step by step code करता है और समझाता है'],
    TUTOR_INTRO: ['تعلّم أساسيات البرمجة في محرر NEXUS نفسه: المتغيرات، أوامر الحركة، وربط الأزرار باللعبة.',
      'Learn the basics of programming in the NEXUS editor itself: variables, movement commands and connecting buttons to the game.',
      'NEXUS editor में ही programming की basics सीखें: variables, movement commands और buttons को Game से जोड़ना।'],
    TUTOR_ASK_TITLE: ['السماح لـ NEXUS AI', 'Allow NEXUS AI', 'NEXUS AI को अनुमति दें'],
    TUTOR_ASK: ['هل تسمح للذكاء الاصطناعي بفتح القوائم وكتابة الكود أمامك لتوضيح طريقة البرمجة؟',
      'Do you allow the AI to open the menus and write code in front of you to show how programming works?',
      'क्या आप AI को menus खोलने और आपके सामने code लिखने की अनुमति देते हैं, ताकि वह programming करके दिखा सके?'],
    TUTOR_ASK_NOTE: ['يكتب في ملف درس جديد داخل مشروعك فقط — لا يغيّر ملفاتك. تستطيع الإيقاف والخروج في أي لحظة.',
      'It writes only in a new lesson file in your project — your own files are not changed. You can pause or leave at any moment.',
      'यह सिर्फ़ आपके Project की एक नई lesson file में लिखता है — आपकी files नहीं बदलता। आप कभी भी pause कर सकते हैं या बाहर निकल सकते हैं।'],
    TUTOR_OK: ['موافق', 'Allow', 'ठीक है'], TUTOR_NO: ['إلغاء', 'Cancel', 'रद्द करें'],
    TUTOR_START: ['▶ علّمني مباشرة', '▶ Teach me live', '▶ मुझे live सिखाओ'],
    TUTOR_BASICS: ['الأساسيات', 'The basics', 'Basics'],
    TUTOR_B1: ['المتغيرات', 'Variables', 'Variables'], TUTOR_B1_T: ['صندوق باسم يحفظ قيمة تتغير أثناء اللعب.', 'A named box that keeps a value that changes while you play.', 'एक नाम वाला डिब्बा जो खेलते समय बदलने वाली value रखता है।'],
    TUTOR_B2: ['أوامر الحركة', 'Movement commands', 'Movement commands'], TUTOR_B2_T: ['في update(dt) تقرأ المفاتيح أو اللمس وتحرّك الكائن قليلًا في كل إطار.', 'In update(dt) you read the keys or touch and move the object a little every frame.', 'update(dt) में आप keys या touch पढ़ते हैं और हर frame में object को थोड़ा move करते हैं।'],
    TUTOR_B3: ['ربط الأزرار باللعبة', 'Connecting buttons to the game', 'Buttons को Game से जोड़ना'], TUTOR_B3_T: ['UI.button يرسم زرًا وينفّذ دالتك عند الضغط.', 'UI.button draws a button and runs your function when it is pressed.', 'UI.button एक button बनाता है और दबाने पर आपका function चलाता है।'],
    TUTOR_AI_LESSON: ['🧠 درس من NEXUS AI عن موضوعك', '🧠 A lesson from NEXUS AI on your topic', '🧠 आपके topic पर NEXUS AI का lesson'],
    TUTOR_AI_PH: ['مثال: كيف أجعل المكعب يقفز؟', 'e.g. How do I make the cube jump?', 'जैसे: cube को jump कैसे कराऊँ?'],
    TUTOR_AI_MAKE: ['اصنع الدرس', 'Make the lesson', 'Lesson बनाओ'],
    TUTOR_AI_MAKING: ['NEXUS AI يحضّر درسك…', 'NEXUS AI is preparing your lesson…', 'NEXUS AI आपका lesson तैयार कर रहा है…'],
    TUTOR_AI_FAIL: ['تعذّر أن يحضّر NEXUS AI الدرس الآن — جرّب الدرس المدمج', 'NEXUS AI could not prepare the lesson now — try the built-in lesson', 'NEXUS AI अभी lesson तैयार नहीं कर सका — built-in lesson आज़माएँ'],
    TUTOR_NEED_PROJECT: ['درس البرمجة', 'Coding lesson', 'Coding lesson'],
    TUTOR_PAUSE: ['إيقاف مؤقت', 'Pause', 'Pause'], TUTOR_PLAY: ['تشغيل', 'Play', 'Play'], TUTOR_REPLAY: ['أعد الخطوة', 'Replay step', 'Step दोबारा'],
    TUTOR_NEXT: ['الخطوة التالية', 'Next step', 'अगला step'], TUTOR_SPEED: ['السرعة', 'Speed', 'Speed'],
    TUTOR_EXIT: ['خروج وتجربة الكود بنفسي', 'Exit & practice', 'बाहर निकलें और खुद आज़माएँ'],
    TUTOR_STEP: ['الخطوة {i} من {n}', 'Step {i} of {n}', 'Step {i} / {n}'],
    TUTOR_PAUSED: ['متوقف مؤقتًا — اضغط ▶ للمتابعة', 'Paused — press ▶ to continue', 'Paused — जारी रखने के लिए ▶ दबाएँ'],
    TUTOR_PRACTICE: ['دورك الآن: عدّل الكود ثم اضغط RUN', 'Your turn: change the code, then press RUN', 'अब आपकी बारी: code बदलें, फिर RUN दबाएँ'],

    /* the built-in lesson: «your first game script» */
    TL1_TITLE: ['أول سكربت لك: متغيرات، حركة، وزر', 'Your first script: variables, movement and a button', 'आपकी पहली Script: variables, movement और एक button'],
    TL1_1: ['أهلًا! سأبرمج أمامك لعبة صغيرة خطوة بخطوة. أنت المتحكم: أوقفني، أعد الخطوة، أو غيّر السرعة من الشريط بالأسفل.',
      'Hi! I will program a small game in front of you, step by step. You are in control: pause me, replay a step or change the speed from the bar below.',
      'नमस्ते! मैं आपके सामने एक छोटा Game step by step program करूँगा। Control आपके पास है: नीचे वाली bar से मुझे pause करें, step दोबारा देखें या speed बदलें।'],
    TL1_2: ['هذه «الأصول» (Assets): مجسمات وأصوات وصور جاهزة تضيفها إلى لعبتك. نبدأ اليوم بمكعب بسيط.',
      'These are the Assets: ready models, sounds and images you can add to your game. Today we start with a simple cube.',
      'ये Assets हैं: तैयार models, sounds और images जिन्हें आप अपने Game में जोड़ सकते हैं। आज हम एक simple cube से शुरू करेंगे।'],
    TL1_3: ['أضفت إلى المشهد مكعبًا اسمه «Player» — سنحرّكه بالكود.', 'I added a cube named "Player" to the scene — we will move it with code.', 'मैंने Scene में "Player" नाम का एक cube जोड़ा है — हम इसे code से move करेंगे।'],
    TL1_4: ['هذا محرر الكود. في كل سكربت دالتان مهمتان: start() تعمل مرة عند البداية، وupdate(dt) تعمل في كل إطار.',
      'This is the code editor. Every script has two key functions: start() runs once at the beginning, update(dt) runs every frame.',
      'यह Code editor है। हर Script में दो ज़रूरी functions होते हैं: start() शुरुआत में एक बार चलता है, और update(dt) हर frame में।'],
    TL1_5: ['المتغيرات صناديق تحفظ القيم: let الاسم = القيمة; — هنا السرعة والنقاط.', 'Variables are boxes that keep values: let name = value; — here, the speed and the score.', 'Variables ऐसे डिब्बे हैं जो values रखते हैं: let name = value; — यहाँ speed और score.'],
    TL1_6: ['start() تعمل مرة واحدة: نكتب النقاط على الشاشة، وننشئ زرًا ونربطه بدالة تُنفَّذ عند الضغط.',
      'start() runs once: we show the score on screen and create a button bound to a function that runs when it is pressed.',
      'start() एक बार चलता है: हम screen पर score दिखाते हैं और एक button बनाकर उसे ऐसे function से जोड़ते हैं जो दबाने पर चलता है।'],
    TL1_7: ['update(dt) تعمل في كل إطار: نقرأ الأسهم أو عصا اللمس بـ Input.axis ونحرّك المكعب. dt هو الزمن منذ الإطار السابق، فتبقى الحركة واحدة على كل الأجهزة.',
      'update(dt) runs every frame: we read the arrows or the touch joystick with Input.axis and move the cube. dt is the time since the last frame, so the movement is the same on every device.',
      'update(dt) हर frame में चलता है: हम Input.axis से arrows या touch joystick पढ़ते हैं और cube को move करते हैं। dt पिछले frame से बीता समय है, ताकि movement हर device पर एक जैसी रहे।'],
    TL1_8: ['نشغّل اللعبة الآن: حرّك المكعب بالأسهم، واضغط JUMP لتزيد النقاط.', 'Now we run the game: move the cube with the arrows and press JUMP to add points.', 'अब Game चलाते हैं: arrows से cube को move करें और points बढ़ाने के लिए JUMP दबाएँ।'],
    TL1_9: ['انتهى الدرس! جرّب بنفسك: غيّر speed إلى 10 أو نص الزر، ثم شغّل من جديد.', 'Lesson done! Try it yourself: change speed to 10 or the button text, then run again.', 'Lesson पूरा हुआ! अब खुद आज़माएँ: speed को 10 करें या button का text बदलें, फिर दोबारा चलाएँ।'],
    TL1_C1: ['المتغيرات: صناديق تحفظ القيم', 'Variables: boxes that keep values', 'Variables: values रखने वाले डिब्बे'],
    TL1_C2: ['start(): تعمل مرة واحدة عند بداية اللعبة', 'start(): runs once when the game begins', 'start(): Game शुरू होने पर एक बार चलता है'],
    TL1_C3: ['زر مربوط باللعبة: يزيد النقاط عند الضغط', 'A button bound to the game: adds a point when pressed', 'Game से जुड़ा button: दबाने पर point बढ़ाता है'],
    TL1_C4: ['update(dt): تعمل في كل إطار — الحركة', 'update(dt): runs every frame — movement', 'update(dt): हर frame में चलता है — movement']
  },

  phrases: {
    /* the top bar, the studio bar and the tabs */
    'رجوع': ['Back', 'वापस'], 'العودة إلى الصفحة الرئيسية': ['Back to the home page', 'Home page पर वापस'],
    'الفريق': ['Team', 'Team'], 'ادعُ أصدقاءك للعمل معك على المشروع': ['Invite friends to work with you on the project', 'दोस्तों को अपने Project पर साथ काम करने के लिए बुलाएँ'],
    'احفظ آخر تغييراتك': ['Save your latest changes', 'अपने नए बदलाव Save करें'], 'جرّب لعبتك الآن': ['Try your game now', 'अपना Game अभी आज़माएँ'],
    'كل أدوات المشروع': ['All project tools', 'Project के सभी tools'],
    'أضف شكلًا أو كائنًا إلى المشهد': ['Add a shape or an object to the scene', 'Scene में कोई shape या object जोड़ें'],
    'الكاميرا': ['Camera', 'Camera'], 'اجعل الكاميرا تنظر إلى الكائن المحدّد': ['Point the camera at the selected object', 'Camera को चुने हुए object की ओर करें'],
    'الشبكة': ['Grid', 'Grid'], 'إظهار أو إخفاء خطوط الأرضية': ['Show or hide the floor lines', 'ज़मीन की lines दिखाएँ या छिपाएँ'],
    'اللون والحجم والفيزياء للكائن المحدّد': ['Colour, size and physics of the selected object', 'चुने हुए object का रंग, size और physics'],
    'تعليق': ['Comment', 'Comment'], 'اكتب ملاحظة لفريقك على هذا الكائن': ['Leave a note for your team on this object', 'इस object पर अपनी Team के लिए note लिखें'],
    'اسأل الذكاء': ['Ask AI', 'AI से पूछें'], 'اطلب من المساعد أن يعدّل هذا الكائن أو يصلحه': ['Ask the assistant to change or fix this object', 'Assistant से इस object को बदलने या ठीक करने को कहें'],
    'تكرار': ['Duplicate', 'Duplicate'], 'نسخة من الكائن بجانبه مباشرة': ['A copy of the object right beside it', 'Object की copy, ठीक उसके बगल में'],
    'قائمة': ['Menu', 'Menu'], 'كل أوامر الكائن: حذف، قفل، إخفاء، تجميع، محاذاة…': ['All object commands: delete, lock, hide, group, align…', 'Object के सभी commands: delete, lock, hide, group, align…'],
    'ابحث عن لعبة أو صانع أو أصل': ['Find a game, a creator or an asset', 'Game, creator या Asset खोजें'],
    'التنبيهات': ['Notifications', 'Notifications'], 'الإعجابات والمتابعات والدعوات': ['Likes, follows and invites', 'Likes, follows और invites'],
    'اللغة والألوان والحساب والذكاء الاصطناعي': ['Language, colours, account and AI', 'भाषा, रंग, account और AI'],
    'تحريك': ['Move', 'Move'], 'حرّك الكائن بالسحب': ['Drag to move the object', 'खींचकर object को move करें'],
    'تدوير': ['Rotate', 'Rotate'], 'دوّر الكائن': ['Rotate the object', 'Object को rotate करें'], 'كبّر أو صغّر الكائن': ['Make the object bigger or smaller', 'Object को बड़ा या छोटा करें'],
    'الرئيسية': ['Home', 'Home'], 'مشاريعي': ['My projects', 'मेरे Projects'], 'المجتمع': ['Community', 'Community'],
    'المساعد': ['Assistant', 'Assistant'], 'صفحة اللعبة': ['Game page', 'Game page'],

    /* the home page */
    'إنشاء لعبة': ['Create a game', 'Game बनाएँ'], 'دع AI يبنيها': ['Let AI build it', 'AI से बनवाएँ'], 'عرض الكل': ['See all', 'सब देखें'],
    'ليس لديك مشاريع بعد.': ['You have no projects yet.', 'अभी आपके कोई Projects नहीं हैं।'],
    'ابدأ من الصفر أو دع المساعد يبنيها لك.': ['Start from scratch or let the assistant build it for you.', 'शुरू से बनाएँ या Assistant से बनवाएँ।'],
    'إنشاء أول لعبة': ['Create your first game', 'अपना पहला Game बनाएँ'], 'دع AI يبني لعبتك': ['Let AI build your game', 'AI से अपना Game बनवाएँ'],
    'استيراد مشروع': ['Import a project', 'Project import करें'], 'أكمل من حيث توقّفت': ['Continue where you left off', 'जहाँ छोड़ा था वहीं से जारी रखें'],
    'أحدث الألعاب المنشورة': ['Latest published games', 'नए published Games'], 'لا توجد ألعاب منشورة بعد': ['No published games yet', 'अभी कोई published Game नहीं'],
    'أنشئ أول لعبة على هذه المنصة.': ['Create the first game on this platform.', 'इस platform पर पहला Game बनाएँ।'],
    'الأكثر تشغيلًا': ['Most played', 'सबसे ज़्यादा खेले गए'], 'لا ألعاب بعد': ['No games yet', 'अभी कोई Game नहीं'], 'الجديد': ['New', 'नया'],
    'أتابعهم': ['Following', 'Following'], 'ألعاب': ['Games', 'Games'], 'بث': ['Live', 'Live'], 'ابدأ بثًا': ['Go live', 'Live शुरू करें'],
    'لا بث مباشر الآن': ['Nobody is live now', 'अभी कोई Live नहीं'], 'رفع فيديو': ['Upload a video', 'Video upload करें'], 'تسجيل مقطع': ['Record a clip', 'Clip record करें'], 'بث مباشر': ['Live stream', 'Live stream'],
    'لعبتي الأولى': ['My first game', 'मेरा पहला Game'], 'لا نتائج لبحثك': ['No results for your search', 'आपकी खोज का कोई result नहीं'],

    /* 🏆 challenges (the main words) */
    'كل التحديات': ['All challenges', 'सभी Challenges'], 'شارك في التحدي': ['Join the challenge', 'Challenge में शामिल हों'], 'ينتهي بعد': ['Ends in', 'खत्म होने में'],
    'المشاركون': ['Players', 'Players'], 'الجائزة': ['Prize', 'इनाम'], 'ابتكره وحكّمه NEXUS AI': ['Invented and judged by NEXUS AI', 'NEXUS AI ने बनाया और judge किया'],
    'NEXUS AI يبتكر التحدي التالي…': ['NEXUS AI is inventing the next challenge…', 'NEXUS AI अगला Challenge बना रहा है…'],
    '🏆 سلّم لعبتك': ['🏆 Submit your game', '🏆 अपना Game submit करें'], 'التحدي': ['Challenge', 'Challenge'], 'المشاركات': ['Entries', 'Entries'],
    'السابقة': ['Past', 'पिछले'], '👥 الأصدقاء': ['👥 Friends', '👥 दोस्त'], 'الإدارة': ['Admin', 'Admin'], '👥 مع الأصدقاء': ['👥 With friends', '👥 दोस्तों के साथ'],
    '🏆 تسليم اللعبة للتحدي': ['🏆 Submit the game to a challenge', '🏆 Game को Challenge में submit करें'], 'مشروع جديد للتحدي': ['New project for the challenge', 'Challenge के लिए नया Project'],
    '🏁 شارك في التحدي': ['🏁 Join the challenge', '🏁 Challenge में शामिल हों'], 'ألعاب مسلّمة': ['Games submitted', 'Submit हुए Games'], 'الأول': ['1st', 'पहला'], 'الثاني': ['2nd', 'दूसरा'], 'الثالث': ['3rd', 'तीसरा'],
    '📖 القصة': ['📖 The story', '📖 कहानी'], '🎯 الهدف': ['🎯 The goal', '🎯 लक्ष्य'], '📜 القواعد': ['📜 The rules', '📜 नियम'], '⚙️ الميكانيكيات': ['⚙️ Mechanics', '⚙️ Mechanics'],
    '🏁 كيف يُحدَّد الفائز': ['🏁 How the winner is decided', '🏁 विजेता कैसे तय होगा'], '🧾 القواعد العامة': ['🧾 General rules', '🧾 सामान्य नियम'],

    /* the studio's «المزيد» */
    'حفظ المشروع': ['Save the project', 'Project Save करें'], 'يحفظ آخر تغييراتك على الخادم (يحفظ وحده أيضًا كل قليل)': ['Saves your latest changes to the server (it also saves by itself every so often)', 'आपके नए बदलाव server पर Save करता है (यह अपने आप भी Save करता रहता है)'],
    'تشغيل تجريبي': ['Test run', 'Test run'], 'جرّب لعبتك الآن كما سيراها اللاعب': ['Try your game now as players will see it', 'अपना Game अभी वैसे आज़माएँ जैसे players देखेंगे'],
    'نشر اللعبة · Publish': ['Publish the game · Publish', 'Game Publish करें · Publish'], 'اجعل لعبتك متاحة للناس برابط وصفحة عرض': ['Make your game available with a link and a showcase page', 'अपने Game को link और showcase page के साथ सबके लिए उपलब्ध करें'],
    'وسائط اللعبة · GAME MEDIA': ['Game media · GAME MEDIA', 'Game media · GAME MEDIA'], 'كل صور الصفحة وخلفيتها وترتيب أقسامها': ["All the page's images, background and section order", 'Page की सभी images, background और sections का क्रम'],
    'تراجع عن آخر تغيير في المشهد': ['Undo the last scene change', 'Scene का आखिरी बदलाव Undo करें'], 'يلغي آخر تعديل على الكائنات': ['Cancels the last edit to the objects', 'Objects पर आखिरी edit रद्द करता है'],
    'الكود ومتعدّد اللغات': ['Code (many languages)', 'Code (कई भाषाएँ)'], 'افتح ملفات الكود وعدّلها': ['Open and edit the code files', 'Code files खोलें और edit करें'],
    'بناء المشروع · BUILD': ['Build the project · BUILD', 'Project Build करें · BUILD'], 'يجهّز اللعبة للتشغيل ويكشف أخطاء الكود': ['Prepares the game to run and finds code errors', 'Game को चलाने के लिए तैयार करता है और code की गलतियाँ ढूँढता है'],
    'سلاسل الأدوات · Toolchains': ['Toolchains', 'Toolchains'], 'لغات برمجة إضافية (للمحترفين)': ['Extra programming languages (for pros)', 'अतिरिक्त programming languages (pros के लिए)'],
    'الأمان وقواعد الحماية': ['Security and protection rules', 'Security और protection rules'], 'القواعد التي تحمي بياناتك، وفحص أمان المشروع': ['The rules that protect your data, and a project security scan', 'आपका data सुरक्षित रखने वाले rules, और Project का security scan'],
    'لوحة المشروع': ['Project dashboard', 'Project dashboard'], 'ملخّص مشروعك وكل أقسامه في شاشة واحدة': ['Your project and all its parts on one screen', 'आपका Project और उसके सभी हिस्से एक screen पर'],
    'تصدير / استيراد': ['Export / Import', 'Export / Import'], 'احفظ نسخة من مشروعك في ملف، أو افتح نسخة': ['Save a copy of your project to a file, or open one', 'अपने Project की copy file में Save करें, या कोई copy खोलें'],
    'كل مشاريعك — افتح أو أنشئ أو احذف': ['All your projects — open, create or delete', 'आपके सभी Projects — खोलें, बनाएँ या delete करें'],
    'تاريخ المشروع ونقاط الرجوع': ['Project history and restore points', 'Project history और restore points'], 'ارجع إلى نسخة سابقة من مشروعك': ['Go back to an earlier version of your project', 'अपने Project के पुराने version पर लौटें'],
    'الأوامر والبحث': ['Commands and search', 'Commands और search'], 'ابحث عن أي أداة باسمها': ['Find any tool by its name', 'किसी भी tool को नाम से खोजें'],
    'التبديل إلى وضع المحترف': ['Switch to pro mode', 'Pro mode पर जाएँ'], 'يُظهر كل الأدوات المتقدّمة في الأسفل': ['Shows all the advanced tools at the bottom', 'नीचे सभी advanced tools दिखाता है'],
    'التبديل إلى وضع المبتدئ': ['Switch to beginner mode', 'Beginner mode पर जाएँ'], 'واجهة أبسط بأدوات أقل': ['A simpler interface with fewer tools', 'कम tools वाला आसान interface'],
    'تفريغ المشهد': ['Clear the scene', 'Scene खाली करें'], 'يحذف كل الكائنات من المشهد (تبقى السكربتات)': ['Deletes every object in the scene (scripts stay)', 'Scene के सभी objects delete करता है (scripts बनी रहती हैं)'],
    '📁 الملفات': ['📁 Files', '📁 Files'], 'ملفات المشروع ومجلّداته': ["The project's files and folders", 'Project की files और folders'],
    '📦 المكتبات': ['📦 Libraries', '📦 Libraries'], 'مكتبات جاهزة يستعملها كودك': ['Ready-made libraries your code uses', 'आपके code के लिए तैयार libraries'],
    '🧩 الإضافات': ['🧩 Plugins', '🧩 Plugins'], 'أدوات إضافية للاستوديو': ['Extra tools for the studio', 'Studio के लिए अतिरिक्त tools'],
    '🐞 الأخطاء': ['🐞 Bugs', '🐞 Bugs'], 'أخطاء أبلغ عنها الفريق أو اللاعبون': ['Bugs reported by the team or players', 'Team या players द्वारा बताए गए bugs'],
    '💬 التعليقات': ['💬 Comments', '💬 Comments'], 'ملاحظات الفريق على الكائنات والكود': ["The team's notes on objects and code", 'Objects और code पर Team के notes'],
    '✅ المهام': ['✅ Tasks', '✅ Tasks'], 'من يفعل ماذا في المشروع': ['Who does what in the project', 'Project में कौन क्या कर रहा है'],
    '🧪 اختبار جماعي': ['🧪 Group playtest', '🧪 Group playtest'], 'العب مع فريقك لتجربة اللعبة معًا': ['Play with your team to test the game together', 'Game को साथ में test करने के लिए अपनी Team के साथ खेलें'],
    '🌐 الترجمة': ['🌐 Translation', '🌐 अनुवाद'], 'نصوص اللعبة بلغات أخرى': ["Your game's texts in other languages", 'आपके Game के texts दूसरी भाषाओं में'],
    '🏆 لوحة الصدارة': ['🏆 Leaderboard', '🏆 Leaderboard'], 'ترتيب أفضل اللاعبين في لعبتك': ['The best players of your game', 'आपके Game के सबसे अच्छे players'],
    '📊 التحليلات': ['📊 Analytics', '📊 Analytics'], 'كم شخصًا لعب، وكم بقي': ['How many played, and how long they stayed', 'कितने लोगों ने खेला, और कितनी देर रुके'],
    '🎞 الإعادات': ['🎞 Replays', '🎞 Replays'], 'تسجيلات لعب يمكن مشاهدتها': ['Recorded play sessions you can watch', 'खेल की recordings जिन्हें आप देख सकते हैं'],
    '🎨 ألوان صفحة اللعبة': ['🎨 Game page colours', '🎨 Game page के रंग'], 'ألوان صفحة عرض لعبتك': ["The colours of your game's showcase page", 'आपके Game के showcase page के रंग'],
    '🛡️ فحص الأمان · Scan Project': ['🛡️ Security scan · Scan Project', '🛡️ Security scan · Scan Project'], 'يبحث عن مشاكل أمان في كودك': ['Looks for security problems in your code', 'आपके code में security problems ढूँढता है'],
    '📱 اختبار الجهاز · Test Mobile': ['📱 Device test · Test Mobile', '📱 Device test · Test Mobile'], 'هل تعمل لعبتك جيدًا على الهاتف؟': ['Does your game work well on phones?', 'क्या आपका Game phone पर अच्छा चलता है?'],
    '🧹 تحسين المشروع · Optimize': ['🧹 Optimize the project · Optimize', '🧹 Project Optimize करें · Optimize'], 'يجعل لعبتك أخفّ وأسرع': ['Makes your game lighter and faster', 'आपके Game को हल्का और तेज़ बनाता है'],
    'مرجع الأوامر التي يستعملها كود اللعبة': ['Reference of the commands game code uses', 'Game code में इस्तेमाल होने वाले commands का reference'],
    '🎬 صفحة لعبتك — أيقونة · غلاف · فيديو · صور · شرح': ["🎬 Your game's page — icon · cover · video · images · description", '🎬 आपके Game का page — icon · cover · video · images · description'],
    'ما يراه الناس قبل أن يلعبوا. اضغط لإضافتها أو تغييرها': ['What people see before they play. Tap to add or change it', 'खेलने से पहले लोग यही देखते हैं। जोड़ने या बदलने के लिए tap करें'],
    'وضع المحترف — كل الأدوات ظاهرة': ['Pro mode — all tools shown', 'Pro mode — सभी tools दिख रहे हैं'], 'وضع المبتدئ — واجهة مبسّطة': ['Beginner mode — a simpler interface', 'Beginner mode — आसान interface'],
    'الفريق · TEAM': ['Team · TEAM', 'Team · TEAM'], 'ادعُ أصدقاءك للعمل معك على نفس المشروع، وحدّد دور كل واحد': ['Invite friends to the same project and give each one a role', 'दोस्तों को उसी Project पर बुलाएँ और हर किसी का role तय करें'],
    'مكتبة الأصول': ['Assets library', 'Assets library'], 'فتح مكتبة الأصول لإضافة مجسم': ['Open the Assets library to add a model', 'Model जोड़ने के लिए Assets library खोलें'], 'إضافة من الأصول': ['Add from Assets', 'Assets से जोड़ें'],

    /* settings */
    'اللغة والمظهر': ['Language and appearance', 'भाषा और रूप'], '🎨 ألوان واجهتي · My colours': ['🎨 My interface colours · My colours', '🎨 मेरे interface के रंग · My colours'],
    'اختر ألوان NEXUS كما تحبها — تتبعك على كل أجهزتك': ["Choose NEXUS's colours your way — they follow you on all your devices", 'NEXUS के रंग अपनी पसंद से चुनें — ये आपके सभी devices पर साथ रहेंगे'],
    '💰 نقاطي': ['💰 My points', '💰 मेरे Points'], 'الاتصال': ['Connection', 'Connection'], 'تسجيل الدخول (Google أو البريد)': ['Sign in (Google or e-mail)', 'Sign in (Google या e-mail)'],
    'الذكاء الاصطناعي': ['Artificial intelligence', 'AI (Artificial Intelligence)'], 'مزوّدو الذكاء الاصطناعي': ['AI providers', 'AI providers'],
    'اختر النموذج، أو أضف مفتاحك الخاص (يبقى في هذا المتصفح فقط)': ['Choose the model, or add your own key (kept in this browser only)', 'Model चुनें, या अपनी key जोड़ें (सिर्फ़ इसी browser में रहती है)'],
    '🔑 مفاتيح الذكاء المجاني — لصاحب الموقع': ['🔑 Free AI keys — for the site owner', '🔑 Free AI keys — site owner के लिए'], '🤝 تبرّع بمفتاح للذكاء المجاني': ['🤝 Donate a key to the free AI', '🤝 Free AI के लिए key donate करें'],
    'لأي لاعب: مفتاحك يساعد الجميع ولا يستطيع أحد قراءته — وتسحبه متى شئت': ['For any player: your key helps everyone, nobody can read it — and you can take it back any time', 'हर player के लिए: आपकी key सबकी मदद करती है, इसे कोई पढ़ नहीं सकता — और आप इसे कभी भी वापस ले सकते हैं'],
    'الحساب والأمان': ['Account and security', 'Account और security'], '🎂 العمر والمحتوى': ['🎂 Age and content', '🎂 उम्र और content'],
    'عمرك في حسابك: يحدّد أي ألعاب ومواقع (فوق 3+) تظهر لك وتُفتح': ['The age on your account decides which games and sites (above 3+) you see and open', 'आपके account में उम्र तय करती है कि कौन से Games और sites (3+ से ऊपर) आपको दिखें और खुलें'],
    '🔑 مفاتيح المرور · Passkeys': ['🔑 Passkeys', '🔑 Passkeys'], 'ادخل ببصمتك أو وجهك بدل كلمة المرور (اختياري)': ['Sign in with your fingerprint or face instead of a password (optional)', 'Password की जगह fingerprint या face से sign in करें (optional)'],
    'القواعد التي تحمي بيانات موقعك (لمالك الموقع)': ["The rules that protect your site's data (for the site owner)", 'आपकी site का data सुरक्षित रखने वाले rules (site owner के लिए)'],
    'إذا حدثت مشكلة': ['If something goes wrong', 'अगर कोई समस्या हो'], 'التشخيص': ['Diagnostics', 'Diagnostics'],
    'يفحص الاتصال والتخزين والنشر، ويقول ما الذي لا يعمل ولماذا': ["Checks the connection, storage and publishing, and says what isn't working and why", 'Connection, storage और publishing जाँचता है, और बताता है क्या नहीं चल रहा और क्यों'],
    'سجلّ الأخطاء والتشخيص': ['Error and diagnostics log', 'Errors और diagnostics log'], 'آخر الأخطاء التي حدثت مع المساعد والأدوات': ['The latest errors with the assistant and the tools', 'Assistant और tools के साथ हुई नई गलतियाँ'],
    'مسح ذاكرة الأصول المؤقتة': ['Clear the assets cache', 'Assets cache साफ़ करें'], 'الأمان': ['Security', 'Security'],

    /* signing in */
    'المتابعة مع Google': ['Continue with Google', 'Google के साथ जारी रखें'], 'البريد وكلمة المرور': ['E-mail and password', 'E-mail और password'],
    '🔑 الدخول بمفتاح المرور · Passkey': ['🔑 Sign in with a passkey · Passkey', '🔑 Passkey से sign in करें · Passkey'], 'أهلًا': ['Welcome', 'स्वागत है'],
    'زائر (بلا جلسة)': ['Visitor (no session)', 'Visitor (कोई session नहीं)'], 'إعادة محاولة الاتصال': ['Retry the connection', 'फिर से connect करें'], 'التشخيص الكامل': ['Full diagnostics', 'पूरा diagnostics'],
    'سجّل الدخول أولًا': ['Sign in first', 'पहले sign in करें'], 'افتح مشروعًا أولًا': ['Open a project first', 'पहले कोई Project खोलें'],

    /* the assistant */
    'محادثة': ['Chat', 'Chat'], 'بناء': ['Build', 'Build'], 'ما الذي يراه؟': ['What does it see?', 'यह क्या देखता है?'],
    'صف ما تريد… مثال: «اصنع لعبة سباق في مدينة فيها شرطة»': ['Describe what you want… e.g. «Make a racing game in a city with police»', 'बताइए आप क्या चाहते हैं… जैसे: «पुलिस वाले शहर में एक racing Game बनाओ»'],

    /* the code editor */
    'الكود · Multi-language': ['Code · Multi-language', 'Code · Multi-language'], '+ ملف': ['+ File', '+ File'],
    'لا مخرجات بعد. اضغط BUILD.': ['No output yet. Press BUILD.', 'अभी कोई output नहीं। BUILD दबाएँ।'],

    /* words everywhere */
    'حذف': ['Delete', 'Delete करें'], 'فتح': ['Open', 'खोलें'], 'إغلاق': ['Close', 'बंद करें'], 'متابعة': ['Follow', 'Follow'], 'مشاركة': ['Share', 'Share करें'],
    'تعديل': ['Edit', 'Edit करें'], 'إعادة المحاولة': ['Retry', 'फिर कोशिश करें'], 'الحالة': ['Status', 'स्थिति'], 'إزالة': ['Remove', 'हटाएँ'], 'التالي': ['Next', 'अगला'],
    'إظهار': ['Show', 'दिखाएँ'], 'إخفاء': ['Hide', 'छिपाएँ'], 'نُسخ الرابط': ['Link copied', 'Link copy हो गया'], 'ملف جديد': ['New file', 'नई file'], 'منشور': ['Published', 'Published'],
    'إبلاغ': ['Report', 'Report करें'], 'نسخ': ['Copy', 'Copy करें'], 'نُسخ': ['Copied', 'Copy हो गया'], 'إضافة كائن': ['Add an object', 'Object जोड़ें'], 'اسم المشروع': ['Project name', 'Project का नाम'],
    'لا نتائج': ['No results', 'कोई result नहीं'], 'إرسال': ['Send', 'भेजें'], 'التفاصيل': ['Details', 'Details'], 'تحميل': ['Download', 'Download'], 'جارٍ التحميل…': ['Loading…', 'Load हो रहा है…'],
    'إعادة تسمية': ['Rename', 'नाम बदलें'], 'إيقاف مؤقت': ['Pause', 'Pause'], 'فيديو': ['Video', 'Video'], 'جارٍ…': ['Working…', 'हो रहा है…'], 'اللعبة': ['Game', 'Game'],
    'الإصدار': ['Version', 'Version'], 'الأيقونة': ['Icon', 'Icon'], 'رفع صورة': ['Upload an image', 'Image upload करें'], '✓ حُفظ': ['✓ Saved', '✓ Save हो गया'], 'تمّ.': ['Done.', 'हो गया।'],
    'المالك': ['Owner', 'Owner'], 'النقاط': ['Points', 'Points'], 'اللاعب': ['Player', 'Player'], 'تعذّر التحميل': ["Couldn't load", 'Load नहीं हो सका'], 'آخر تعديل': ['Last edited', 'आखिरी बदलाव'],
    'مشروع': ['Project', 'Project'], 'أنت': ['You', 'आप'], 'متاح': ['Available', 'उपलब्ध'], 'غير متاح': ['Unavailable', 'उपलब्ध नहीं'], 'يعمل': ['Working', 'चल रहा है'], 'متوقف': ['Stopped', 'रुका हुआ'],
    'تسجيل الدخول': ['Sign in', 'Sign in'], 'سجّل الدخول': ['Sign in', 'Sign in'], 'نسختي': ['My copy', 'मेरी copy'], 'نسخة': ['Copy', 'Copy'], 'عضو': ['Member', 'Member'], 'تلقائي': ['Automatic', 'Automatic'],
    'نقطة': ['point', 'point'], 'انتهى': ['Ended', 'खत्म'], 'رفض': ['Decline', 'मना करें'], 'قبول': ['Accept', 'स्वीकार करें'], 'تم': ['Done', 'हो गया']
  }
};
