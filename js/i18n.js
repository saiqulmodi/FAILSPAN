/* English / Bengali. t("English text", {n: 3}) returns the Bengali line when Bengali is on,
 * otherwise the English one, with {placeholders} filled in. Keys are the English text itself. */
(function (root) {
  "use strict";
  const BN = {
    // ---- top bar, buttons, screens ----
    "Score": "স্কোর", "Treasury": "কোষাগার", "Govt Subsidies": "সরকারি ভর্তুকি", "Subsidy": "ভর্তুকি",
    "{n}-day streak": "{n} দিনের ধারা", "Trainee": "শিক্ষানবিশ", "Junior Engineer": "জুনিয়র ইঞ্জিনিয়ার",
    "Site Engineer": "সাইট ইঞ্জিনিয়ার", "Chief Engineer": "চিফ ইঞ্জিনিয়ার", "Expert Engineer": "বিশেষজ্ঞ প্রকৌশলী",
    "Loading FAILSPAN…": "FAILSPAN লোড হচ্ছে…",
    "FAILSPAN": "FAILSPAN",
    "STRUCTURAL MAYHEM": "স্ট্রাকচারাল মেহেম",
    "STRESS": "চাপ", "💥 STRUCTURAL FAILURE": "💥 কাঠামো ভেঙে পড়েছে", "✔ BRIDGE HOLDS": "✔ সেতু টিকে আছে",
    "⚠ FRACTURE IMMINENT": "⚠ ভাঙন আসন্ন", "Low graphics": "হালকা গ্রাফিক্স", "Fewer effects for slow phones": "ধীর ফোনের জন্য কম ইফেক্ট",
    "Locked": "বন্ধ", "STRESS COEFFICIENT": "চাপ সহগ", "Small steps. Bigger every class.": "ছোট ছোট পা, প্রতি ক্লাসে আরও বড়।", "View:": "দৃশ্য:", "Switch to 2D": "2D-তে যাও", "Switch to 3D": "3D-তে যাও",
    "✏️ Build (2D)": "✏️ বানাও (2D)", "🧊 3D view": "🧊 3D দৃশ্য",
    "3D could not start on this device. 2D still works.": "এই ডিভাইসে 3D চালু হলো না। 2D ঠিকই চলবে।",
    "Build. Stress. Snap.": "গড়ো। চাপ দাও। ভাঙো।",
    "Every class has its own building on the road. Answer your class's questions to earn parts, then build a real-physics bridge and test it with traffic. Easy bridges first, tougher ones as you climb.":
      "রাস্তার ধারে প্রতিটি শ্রেণির নিজের ভবন। নিজের শ্রেণির প্রশ্নের উত্তর দিয়ে যন্ত্রাংশ জেতো, তারপর আসল পদার্থবিজ্ঞানের সেতু বানিয়ে গাড়ি চালিয়ে পরীক্ষা করো। প্রথমে সহজ সেতু, যত উপরে উঠবে তত কঠিন।",
    "Which class are you in?": "তুমি কোন শ্রেণিতে পড়ো?",
    "Buildings up to your class open now; build a bridge to open the next one.": "তোমার শ্রেণি পর্যন্ত ভবন এখনই খোলা; সেতু বানালে পরের ভবন খুলবে।",
    "◀ World": "◀ ক্যাম্পাস", "🧭 Guide": "🧭 নির্দেশিকা", "📋 Q&A Bank": "📋 প্রশ্নব্যাংক",
    "Swipe or drag to move along the road · tap a building to enter": "রাস্তা ধরে যেতে সোয়াইপ বা টেনে আনো · ভবনে ঢুকতে ট্যাপ করো",
    "🏆 Weekly challenge": "🏆 সাপ্তাহিক চ্যালেঞ্জ",
    "Project {n}": "প্রকল্প {n}", "BRIDGE BUILT": "সেতু তৈরি", "{n} Q · {s} subjects": "{n} প্রশ্ন · {s} বিষয়",
    "🔒 {a} is locked.<br>Build the bridge in {b} to open the next building.": "🔒 {a} বন্ধ।<br>পরের ভবন খুলতে {b}-এর সেতু বানাও।",
    "mastery {m}/{g} · bridge quiz {b}/{c}": "দক্ষতা {m}/{g} · সেতু কুইজ {b}/{c}",
    "All": "সব", "🌉 Bridge quiz": "🌉 সেতু কুইজ",
    // ---- question card ----
    "Loading {name} questions…": "{name}-এর প্রশ্ন লোড হচ্ছে…", "No questions here yet.": "এখানে এখনো প্রশ্ন নেই।",
    "right = +{n} parts": "ঠিক = +{n} যন্ত্রাংশ", "Daily challenge: {a}/{b} right today": "দৈনিক চ্যালেঞ্জ: আজ {a}/{b} ঠিক",
    "Daily challenge done ✓": "দৈনিক চ্যালেঞ্জ শেষ ✓", "✓ Right! +{n} parts.": "✓ ঠিক! +{n} যন্ত্রাংশ।",
    "✗ Answer: {a}.": "✗ উত্তর: {a}।", "Next ▶": "পরের ▶", "🔈 Read": "🔈 পড়ে শোনাও", "Auto-read": "নিজে পড়বে",
    "(English only)": "(শুধু ইংরেজিতে আছে)",
    "🔥 Daily challenge done! {n}-day streak · +{p} bonus parts": "🔥 দৈনিক চ্যালেঞ্জ শেষ! {n} দিনের ধারা · +{p} বোনাস যন্ত্রাংশ",
    // ---- build ----
    "Parts {p} (+{n} per right answer)": "যন্ত্রাংশ {p} (প্রতি ঠিক উত্তরে +{n})", "span {n} m": "দৈর্ঘ্য {n} m",
    "par {p} parts (used {u})": "লক্ষ্য {p} যন্ত্রাংশ (ব্যবহৃত {u})", "× {n} impact": "× {n} ধাক্কা",
    "Physics: {s}": "পদার্থবিজ্ঞান: {s}",
    "Guide: everything is built - press Test!": "নির্দেশিকা: সব তৈরি - এবার পরীক্ষা করো!",
    "Guide step {k}/{n}: {s} Glowing joints = next member ({m}).": "নির্দেশিকা ধাপ {k}/{n}: {s} জ্বলজ্বলে জোড় = পরের অংশ ({m})।",
    "🗑 Delete": "🗑 মুছো", "↶ Undo": "↶ ফেরাও", "Clear": "সব মুছো", "💡 Hint": "💡 সংকেত", "▶ Show me": "▶ দেখাও",
    "🚗 Test bridge": "🚗 সেতু পরীক্ষা", "🔍 Forces": "🔍 বল দেখো",
    "Delete mode: tap a member you built to remove it (parts come back).": "মোছার মোড: তোমার বানানো অংশে ট্যাপ করো (যন্ত্রাংশ ফেরত পাবে)।",
    "Undone - parts returned.": "ফেরানো হলো - যন্ত্রাংশ ফেরত।", "Cleared - all parts returned.": "সব মোছা হলো - সব যন্ত্রাংশ ফেরত।",
    "Removed - parts returned.": "সরানো হলো - যন্ত্রাংশ ফেরত।", "Now tap the joint at the other end.": "এবার অন্য প্রান্তের জোড়ে ট্যাপ করো।",
    "Built {m}.": "তৈরি হলো: {m}।", "Built {m} for you. {s}": "তোমার জন্য বানালাম: {m}। {s}",
    "Everything in the guide is built. Press Test bridge!": "নির্দেশিকার সব তৈরি। সেতু পরীক্ষা চাপো!",
    "{msg} Next: {m} between the glowing joints.": "{msg} পরের অংশ: জ্বলজ্বলে জোড়ের মধ্যে {m}।",
    "Hint {k}/{n}: {s}": "সংকেত {k}/{n}: {s}",
    "Pick two different joints.": "দুটি আলাদা জোড় বেছে নাও।", "Those joints are already joined.": "এই জোড় দুটি আগেই জোড়া।",
    "Need {c} parts for size {s} - answer questions to earn parts.": "{s} মাপের জন্য {c}টি যন্ত্রাংশ লাগবে - প্রশ্নের উত্তর দিয়ে জেতো।",
    "Forces mode: tap a joint to see the pushes and pulls on it.": "বল মোড: কোনো জোড়ে ট্যাপ করে তার উপর ঠেলা আর টান দেখো।",
    "Forces at this joint with the {v} parked mid-span. Blue arrows pull (tension), red arrows push (compression). They balance: ΣF = 0.":
      "{v} মাঝখানে দাঁড়িয়ে থাকলে এই জোড়ের বল। নীল তীর টানে (টান), লাল তীর ঠেলে (চাপ)। সব মিলে সাম্য: ΣF = 0।",
    "The frame can wobble - build more before reading forces.": "কাঠামো নড়বড়ে - বল দেখার আগে আরও অংশ বানাও।",
    "Collapsed: the frame can wobble freely. Every road joint must be held up and every joint needs two members that are not in one line.":
      "ভেঙে পড়ল: কাঠামো নড়বড়ে। রাস্তার প্রতিটি জোড় ধরে রাখতে হবে, আর প্রতিটি জোড়ে এক সরলরেখায় নয় এমন দুটি অংশ লাগবে।",
    "{why} Strengthen the dark red member (bigger size, stronger material) or add bracing.": "{why} গাঢ় লাল অংশটি মজবুত করো (বড় মাপ, শক্ত উপাদান) বা ঠেকনা দাও।",
    "Bridge passed! The {v} crossed. Highest load {n}% of breaking.": "সেতু পাস! {v} পার হলো। সর্বোচ্চ ভার ভাঙনের {n}%।",
    "🎉 Bridge passed!": "🎉 সেতু পাস!", "💥 The bridge failed": "💥 সেতু ভেঙে গেল",
    "The {v} crossed safely. The most loaded member reached <b>{n}%</b> of its limit.": "{v} নিরাপদে পার হলো। সবচেয়ে বেশি ভার পাওয়া অংশ তার সীমার <b>{n}%</b>-এ পৌঁছেছে।",
    "Bridge holds": "সেতু টিকে আছে", "Built within par: {u} / {p} parts": "লক্ষ্যের মধ্যে তৈরি: {u} / {p} যন্ত্রাংশ",
    "Bridge quiz: {a} / {b} right": "সেতু কুইজ: {a} / {b} ঠিক", "is now open on the road!": "এখন রাস্তায় খুলে গেছে!",
    "Back to the road": "রাস্তায় ফেরো", "Keep improving": "আরও ভালো করো", "Try again": "আবার চেষ্টা করো",
    "Second chance: show the next guided member": "দ্বিতীয় সুযোগ: পরের নির্দেশিত অংশ দেখাও",
    "The broken member is dark red. Hover or tap any member to read its force.": "ভাঙা অংশটি গাঢ় লাল। যেকোনো অংশে ট্যাপ করে তার বল পড়ো।",
    "Nothing broke - the frame could move like a mechanism, so it needs more members.": "কিছু ভাঙেনি - কাঠামো যন্ত্রের মতো নড়তে পারত, তাই আরও অংশ লাগবে।",
    "Your design is complete - make the red member bigger.": "নকশা সম্পূর্ণ - লাল অংশটি বড় করো।",
    "Start building": "বানানো শুরু করো",
    "On the bridge, the glowing joints show the next member. Tap them, or press ▶ Show me to place it with your parts. Stuck? 💡 Hint gives three hints in turn.":
      "সেতুতে জ্বলজ্বলে জোড়গুলো পরের অংশ দেখায়। সেগুলোতে ট্যাপ করো, অথবা ▶ দেখাও চেপে তোমার যন্ত্রাংশে বসিয়ে দাও। আটকে গেলে 💡 সংকেত পরপর তিনটি সংকেত দেয়।",
    "🧭 Guided build: {p}": "🧭 নির্দেশিত নির্মাণ: {p}",
    // ---- bank, handbook, profile, report ----
    "📋 Q&A Bank: {a} - {b} ({n})": "📋 প্রশ্নব্যাংক: {a} - {b} ({n})", "All subjects": "সব বিষয়",
    "◀ Prev": "◀ আগের", "Page {a} of {b}": "পৃষ্ঠা {a} / {b}", "Answer: {a}": "উত্তর: {a}",
    "📘 Engineering Handbook": "📘 প্রকৌশল হ্যান্ডবুক", "Search both languages…": "দুই ভাষাতেই খোঁজো…", "No matches.": "কিছু মেলেনি।",
    "200 answers from the classic FAILSPAN levels: the physics of trusses, beams, wind, quakes and money.":
      "পুরোনো FAILSPAN লেভেলের ২০০টি উত্তর: ট্রাস, বিম, বাতাস, ভূমিকম্প আর টাকার পদার্থবিজ্ঞান।",
    "{a} of 9 bridges built · {b} of 27 stars · {c} right answers · best score {d} · 🔥 {e}-day streak":
      "৯টির মধ্যে {a}টি সেতু তৈরি · ২৭টির মধ্যে {b}টি তারা · {c}টি ঠিক উত্তর · সেরা স্কোর {d} · 🔥 {e} দিনের ধারা",
    "My class:": "আমার শ্রেণি:", "- buildings up to your class are open.": "- তোমার শ্রেণি পর্যন্ত ভবন খোলা।",
    "Done": "ঠিক আছে", "Class saved": "শ্রেণি সংরক্ষিত", "📄 Report card": "📄 রিপোর্ট কার্ড",
    "📄 Report card - {d}": "📄 রিপোর্ট কার্ড - {d}", "Building": "ভবন", "Stars": "তারা", "Bridge": "সেতু", "Right answers": "ঠিক উত্তর",
    "Mastery": "দক্ষতা", "Bridge quiz": "সেতু কুইজ", "Best parts": "সেরা যন্ত্রাংশ", "built": "তৈরি", "not yet": "এখনো নয়",
    "🖨 Print / Save PDF": "🖨 প্রিন্ট / PDF", "📋 Copy text": "📋 লেখা কপি", "Copied": "কপি হয়েছে",
    "Title": "পদবি", "Streak": "ধারা", "Total right answers": "মোট ঠিক উত্তর", "Bridges built": "তৈরি সেতু",
    // ---- weekly challenge ----
    "🏆 Weekly Bridge Challenge - week {w}": "🏆 সাপ্তাহিক সেতু চ্যালেঞ্জ - সপ্তাহ {w}",
    "This week everyone builds the same bridge: {p} with a {v} {m} t ({x} × heavier than normal). Parts are free - the fewest parts that pass wins. Your best this week: {b}.":
      "এই সপ্তাহে সবাই একই সেতু বানাবে: {p}, সঙ্গে {v} {m} t (সাধারণের চেয়ে {x} গুণ ভারী)। যন্ত্রাংশ বিনামূল্যে - সবচেয়ে কম যন্ত্রাংশে যে পাস করবে সে জিতবে। এই সপ্তাহে তোমার সেরা: {b}।",
    "none yet": "এখনো নেই", "Start the challenge": "চ্যালেঞ্জ শুরু করো", "Weekly challenge": "সাপ্তাহিক চ্যালেঞ্জ",
    "Challenge passed with {u} parts! Your best this week: {b} parts.": "চ্যালেঞ্জ পাস {u} যন্ত্রাংশে! এই সপ্তাহে তোমার সেরা: {b} যন্ত্রাংশ।",
    "New personal best!": "নতুন ব্যক্তিগত রেকর্ড!",
    "Weekly challenge: parts are free. Build with as few parts as you can, then Test.": "সাপ্তাহিক চ্যালেঞ্জ: যন্ত্রাংশ বিনামূল্যে। যত কম পারো যন্ত্রাংশে বানাও, তারপর পরীক্ষা করো।",
    "New badge: {s}": "নতুন ব্যাজ: {s}",
    // ---- locked buildings: 5 free questions, then wait or clear the class before ----
    "You tried {n} questions of {a}. Come back in {w} for {n} more,": "তুমি {a}-এর {n}টি প্রশ্ন চেষ্টা করেছ। আরও {n}টির জন্য {w} পরে ফিরে এসো,",
    "or clear {b}: build its bridge and get {g} right answers.": "অথবা {b} শেষ করো: তার সেতু বানাও আর {g}টি ঠিক উত্তর দাও।",
    "{b}: bridge {x} · right answers {r}/{g}": "{b}: সেতু {x} · ঠিক উত্তর {r}/{g}",
    "Go to {b}": "{b}-এ যাও", "Try {n} free questions": "{n}টি প্রশ্ন বিনামূল্যে", "Back in {w}": "{w} পরে খুলবে",
    "Preview: {n} free questions left. Clear {b} to build here.": "ঝলক: আর {n}টি প্রশ্ন বিনামূল্যে। এখানে বানাতে {b} শেষ করো।",
    "{a} is now open!": "{a} এখন খোলা!", "To clear": "শেষ করতে",
    "Get {n} more right answers here to clear this class and open the next building.": "এই শ্রেণি শেষ করে পরের ভবন খুলতে এখানে আরও {n}টি ঠিক উত্তর দাও।",
    "Clear a class (bridge + {g} right answers) to open the next one. Locked buildings let you try {n} questions every {h} hours.":
      "একটি শ্রেণি শেষ করো (সেতু + {g}টি ঠিক উত্তর), তাহলে পরেরটি খুলবে। বন্ধ ভবনে প্রতি {h} ঘণ্টায় {n}টি প্রশ্ন চেষ্টা করা যায়।",
    // ---- the 50% opening rule ----
    "or answer {h}% of {b}'s questions right to open half of this class (now {c}%).": "অথবা এই শ্রেণির অর্ধেক খুলতে {b}-এর {h}% প্রশ্নের ঠিক উত্তর দাও (এখন {c}%)।",
    "Half open": "অর্ধেক খোলা", "{a} is now half open!": "{a} এখন অর্ধেক খোলা!", "{a} is now fully open!": "{a} এখন পুরো খোলা!",
    "covered {c}% of {n} questions · bridge quiz {b}/{q}": "{n}টি প্রশ্নের {c}% শেষ · সেতু কুইজ {b}/{q}",
    "Preview: {n} free questions left. Answer {h}% of {b} right to open half of this class (now {c}%).":
      "ঝলক: আর {n}টি প্রশ্ন বিনামূল্যে। এই শ্রেণির অর্ধেক খুলতে {b}-এর {h}% প্রশ্নের ঠিক উত্তর দাও (এখন {c}%)।",
    "Answer questions here: at {h}% the next class opens halfway, at 100% fully. Now {c}%.":
      "এখানে প্রশ্নের উত্তর দাও: {h}% হলে পরের শ্রেণি অর্ধেক খুলবে, ১০০% হলে পুরো। এখন {c}%।",
    "Answer {a}% of a class's questions right and the next class opens halfway; 100% opens it fully. Locked buildings let you try {n} questions every {h} hours.":
      "কোনো শ্রেণির {a}% প্রশ্নের ঠিক উত্তর দিলে পরের শ্রেণি অর্ধেক খুলবে; ১০০% হলে পুরো খুলবে। বন্ধ ভবনে প্রতি {h} ঘণ্টায় {n}টি প্রশ্ন চেষ্টা করা যায়।",
    "Covered": "শেষ হয়েছে",
    "The way to your destination": "তোমার গন্তব্যের পথ", "Skip ▶": "এড়িয়ে যাও ▶",
    // ---- badges ----
    "First Answer": "প্রথম উত্তর", "Junior Engineer: first bridge": "জুনিয়র ইঞ্জিনিয়ার: প্রথম সেতু",
    "Site Engineer: 5 bridges": "সাইট ইঞ্জিনিয়ার: ৫টি সেতু", "Chief Engineer: 7 bridges": "চিফ ইঞ্জিনিয়ার: ৭টি সেতু",
    "Expert Engineer: all 9 bridges": "বিশেষজ্ঞ প্রকৌশলী: ৯টি সেতুই", "Quiz Ace: 100 right answers": "কুইজ তারকা: ১০০টি ঠিক উত্তর",
    "Scholar: 1,000 right answers": "পণ্ডিত: ১,০০০টি ঠিক উত্তর", "3-day streak": "৩ দিনের ধারা", "7-day streak": "৭ দিনের ধারা",
    "30-day streak": "৩০ দিনের ধারা", "Perfect bridge: 3 stars": "নিখুঁত সেতু: ৩ তারা",
    "Thrifty builder: pass within par parts": "মিতব্যয়ী নির্মাতা: লক্ষ্যের মধ্যে পাস", "Weekly champion: pass a weekly challenge": "সাপ্তাহিক চ্যাম্পিয়ন: সাপ্তাহিক চ্যালেঞ্জ পাস",
    // ---- level, subject, material, vehicle and project names ----
    "Class {n}": "শ্রেণি {n}", "BE": "বিই", "NIT": "এনআইটি", "IIT": "আইআইটি",
    "⚡ Edge": "⚡ এজ", "Math": "গণিত", "Physics": "পদার্থবিজ্ঞান", "Chemistry": "রসায়ন", "Biology": "জীববিজ্ঞান", "EVS": "পরিবেশ পরিচিতি",
    "Commerce": "বাণিজ্য", "Economics": "অর্থনীতি", "Finance": "অর্থসংস্থান", "Geography": "ভূগোল", "Safety": "নিরাপত্তা",
    "Civil Engg": "পুর প্রকৌশল", "Engineering": "প্রকৌশল", "Computer": "কম্পিউটার",
    "Steel cable": "ইস্পাতের তার", "Carbon cable": "কার্বন তার", "Steel beam": "ইস্পাতের বিম", "Timber beam": "কাঠের বিম",
    "Concrete beam": "কংক্রিটের বিম", "pylon": "স্তম্ভ",
    "Car": "গাড়ি", "Minibus": "মিনিবাস", "Truck": "ট্রাক", "Heavy-haul trailer": "ভারী ট্রেলার", "Freight convoy": "মালবাহী গাড়ির সারি",
    "Tension Fibers": "টান-তন্তু", "Coplanar Trusses": "সমতলীয় ট্রাস", "Parabolic Thrust": "অধিবৃত্ত ঠেলা",
    "Stay Dynamics": "স্টে গতিবিদ্যা", "Matrix Dissipation": "ম্যাট্রিক্স অপচয়",
    // ---- project goals, tips, lessons ----
    "Hold up the 3 middle road joints with cables from the two masts.": "দুই মাস্তুল থেকে তার দিয়ে রাস্তার মাঝের ৩টি জোড় ধরে রাখো।",
    "Click a mast top, then a road joint, to hang a cable. Cables can only pull.": "তার ঝোলাতে মাস্তুলের মাথায়, তারপর রাস্তার জোড়ে ট্যাপ করো। তার শুধু টানতে পারে।",
    "A cable is pulled tight (tension). Its pull T holds the road up: T sin(angle) = load.": "তার টানটান থাকে (টান)। তার টান T রাস্তাকে ধরে রাখে: T sin(কোণ) = ভার।",
    "Build a truss: a top chord and diagonals so every panel is a triangle.": "ট্রাস বানাও: উপরের কর্ড আর কর্ণ, যাতে প্রতিটি ঘর ত্রিভুজ হয়।",
    "A square can fold flat; a triangle cannot. Join every top joint so it makes triangles.": "বর্গ ভাঁজ হয়ে চ্যাপ্টা হতে পারে; ত্রিভুজ পারে না। উপরের প্রতিটি জোড় এমনভাবে জোড়ো যাতে ত্রিভুজ হয়।",
    "Triangles keep their shape. Members are pulled (tension) or pushed (compression); pushed long thin members buckle: P_cr = pi^2 E I / L^2.":
      "ত্রিভুজ আকার ধরে রাখে। অংশগুলো টানা (টান) বা ঠেলা (চাপ) খায়; ঠেলা খাওয়া লম্বা সরু অংশ বেঁকে যায়: P_cr = π²EI/L²।",
    "Build the arch rib from bank to bank, hang the road from it, and brace it.": "এক পাড় থেকে অন্য পাড় পর্যন্ত খিলান বানাও, তা থেকে রাস্তা ঝোলাও, আর ঠেকনা দাও।",
    "Arches are pushed (compression): steel or concrete. A moving truck can make a cable hanger go slack - steel hangers can push and pull. Add a few diagonal braces.":
      "খিলান ঠেলা খায় (চাপ): ইস্পাত বা কংক্রিট। চলন্ত ট্রাক তারের ঝুলন্ত অংশকে ঢিলা করে দিতে পারে - ইস্পাতের ঝুলন্ত অংশ ঠেলা ও টান দুটোই নিতে পারে। কয়েকটি কর্ণ ঠেকনা দাও।",
    "A parabolic arch carries an even load in pure compression; it pushes outward on both banks (thrust H = w L^2 / 8h), so both supports must be pinned.":
      "অধিবৃত্ত খিলান সমান ভার শুধু চাপে বহন করে; এটি দুই পাড়ে বাইরের দিকে ঠেলে (ঠেলা H = wL²/8h), তাই দুই অবলম্বনই পিন করা হতে হবে।",
    "Cable-stay the road from one tall pylon. Balance the cables on both sides.": "একটি উঁচু স্তম্ভ থেকে তারে রাস্তা ধরো। দুই দিকের তার সমান রাখো।",
    "Anchor the pylon top with a backstay cable to each bank support, then put matching cables left and right. Flat cables need a bigger size.":
      "স্তম্ভের মাথা দুই পাড়ের অবলম্বনে পেছনের তার দিয়ে বাঁধো, তারপর বাঁয়ে-ডানে মিলিয়ে তার দাও। চ্যাপ্টা তারের বড় মাপ লাগে।",
    "A flat cable needs a bigger pull for the same lift: T = W / sin(angle). The horizontal parts of the stays must balance at the pylon top.":
      "একই ভার তুলতে চ্যাপ্টা তারে বেশি টান লাগে: T = W / sin(কোণ)। স্তম্ভের মাথায় তারগুলোর অনুভূমিক অংশ সমান হতে হবে।",
    "Two pylons, a long span and a heavy convoy with 30% impact. Use parts wisely.": "দুটি স্তম্ভ, লম্বা সেতু আর ৩০% ধাক্কাসহ ভারী গাড়ির সারি। যন্ত্রাংশ বুঝে খরচ করো।",
    "Anchor each pylon top to its bank, tie the two tops together, and share the middle span between both pylons. Carbon cable is stronger for the same size.":
      "প্রতিটি স্তম্ভের মাথা তার পাড়ে বাঁধো, দুই মাথা একসঙ্গে বাঁধো, আর মাঝের অংশ দুই স্তম্ভে ভাগ করো। একই মাপে কার্বন তার বেশি শক্ত।",
    "Impact (dynamic) load = 1.3 x static. The stiffness matrix [K][U] = [F] shares the load between all members in proportion to their stiffness E A / L.":
      "ধাক্কা (গতিশীল) ভার = ১.৩ x স্থির ভার। দৃঢ়তা ম্যাট্রিক্স [K][U] = [F] সব অংশের মধ্যে তাদের দৃঢ়তা EA/L অনুপাতে ভার ভাগ করে।",
    // ---- guided steps ----
    "Hang a cable from the left mast top to road joint 1.": "বাঁ মাস্তুলের মাথা থেকে রাস্তার ১ নম্বর জোড়ে তার ঝোলাও।",
    "Hang a cable from the left mast top to the middle road joint.": "বাঁ মাস্তুলের মাথা থেকে রাস্তার মাঝের জোড়ে তার ঝোলাও।",
    "Hang a cable from the right mast top to road joint 3.": "ডান মাস্তুলের মাথা থেকে রাস্তার ৩ নম্বর জোড়ে তার ঝোলাও।",
    "Build the top chord: join the five top joints in a line.": "উপরের কর্ড বানাও: উপরের পাঁচটি জোড় এক লাইনে জোড়ো।",
    "Add the two end posts from the supports up to the top. They carry the most, so use size L.": "অবলম্বন থেকে উপর পর্যন্ত দুটি প্রান্ত-খুঁটি দাও। এরাই সবচেয়ে বেশি ভার নেয়, তাই L মাপ দাও।",
    "Add a vertical under every top joint.": "উপরের প্রতিটি জোড়ের নিচে একটি খাড়া অংশ দাও।",
    "Add diagonals sloping down towards the middle, so every panel is a triangle.": "মাঝের দিকে নামা কর্ণ দাও, যাতে প্রতিটি ঘর ত্রিভুজ হয়।",
    "Build the arch rib from bank to bank through the arch joints (steel, size L).": "খিলানের জোড় দিয়ে এক পাড় থেকে অন্য পাড় পর্যন্ত খিলান বানাও (ইস্পাত, L মাপ)।",
    "Hang the road from the arch: a steel hanger from each arch joint straight down.": "খিলান থেকে রাস্তা ঝোলাও: প্রতিটি খিলান-জোড় থেকে সোজা নিচে একটি ইস্পাতের ঝুলন্ত অংশ।",
    "Brace the arch with diagonals so it cannot change shape.": "কর্ণ দিয়ে খিলানে ঠেকনা দাও যাতে আকার বদলাতে না পারে।",
    "Anchor the pylon top with a backstay cable to each bank support.": "স্তম্ভের মাথা দুই পাড়ের অবলম্বনে পেছনের তার দিয়ে বাঁধো।",
    "Fan stays from the pylon top to the left half of the road.": "স্তম্ভের মাথা থেকে রাস্তার বাঁ অর্ধেকে পাখার মতো তার দাও।",
    "Mirror the fan on the right half so the pulls balance.": "ডান অর্ধেকে একই রকম পাখা দাও যাতে টান সমান হয়।",
    "Anchor each pylon top to its bank support.": "প্রতিটি স্তম্ভের মাথা তার পাড়ের অবলম্বনে বাঁধো।",
    "Tie the two pylon tops together.": "দুই স্তম্ভের মাথা একসঙ্গে বাঁধো।",
    "Fan carbon stays from the left pylon over its side of the road.": "বাঁ স্তম্ভ থেকে তার দিকের রাস্তায় কার্বন তারের পাখা দাও।",
    "Fan carbon stays from the right pylon; road joint 8 in the middle gets one from each pylon.": "ডান স্তম্ভ থেকে কার্বন তারের পাখা দাও; মাঝের ৮ নম্বর জোড় দুই স্তম্ভ থেকেই একটি করে পাবে।",
    // ---- hints ----
    "Cables can only pull. Each road joint between the banks needs one cable pulling it up.": "তার শুধু টানতে পারে। দুই পাড়ের মাঝের প্রতিটি রাস্তার জোড়ে উপরে টানা একটি তার লাগবে।",
    "Join a mast top (the joints high on the banks) to the road joints 1, 2 and 3.": "মাস্তুলের মাথা (পাড়ের উঁচু জোড়) রাস্তার ১, ২ আর ৩ নম্বর জোড়ের সঙ্গে জোড়ো।",
    "Size S is strong enough for a car - save your parts.": "গাড়ির জন্য S মাপই যথেষ্ট - যন্ত্রাংশ বাঁচাও।",
    "A frame of squares folds flat. Every panel needs a diagonal to make two triangles.": "বর্গের কাঠামো ভাঁজ হয়ে চ্যাপ্টা হয়। প্রতিটি ঘরে দুটি ত্রিভুজ বানাতে একটি কর্ণ লাগবে।",
    "Start with the top chord, then the end posts, verticals and diagonals.": "উপরের কর্ড দিয়ে শুরু করো, তারপর প্রান্ত-খুঁটি, খাড়া অংশ আর কর্ণ।",
    "If an end post buckles, make it size L - long pushed members buckle first.": "প্রান্ত-খুঁটি বেঁকে গেলে L মাপ দাও - ঠেলা খাওয়া লম্বা অংশ আগে বাঁকে।",
    "The arch must go from bank to bank through all the arch joints, and it is pushed (compression).": "খিলান সব খিলান-জোড় দিয়ে এক পাড় থেকে অন্য পাড়ে যাবে, আর এটি ঠেলা খায় (চাপ)।",
    "Cable hangers can go slack when the truck lifts the arch - steel hangers push and pull.": "ট্রাক খিলান তুললে তারের ঝুলন্ত অংশ ঢিলা হতে পারে - ইস্পাতের ঝুলন্ত অংশ ঠেলা ও টান দুটোই নেয়।",
    "Brace the arch: diagonals between arch joints and the road joints next to them.": "খিলানে ঠেকনা দাও: খিলান-জোড় আর পাশের রাস্তার জোড়ের মধ্যে কর্ণ।",
    "Without backstays the pylon top can sway: tie it to both bank supports first.": "পেছনের তার ছাড়া স্তম্ভের মাথা দুলতে পারে: আগে দুই পাড়ের অবলম্বনে বাঁধো।",
    "Then give every road joint its own stay, balanced left and right.": "তারপর রাস্তার প্রতিটি জোড়ে নিজের তার দাও, বাঁয়ে-ডানে সমান করে।",
    "Flat stays near the banks pull hardest; use size M or bigger.": "পাড়ের কাছের চ্যাপ্টা তার সবচেয়ে জোরে টানে; M বা বড় মাপ দাও।",
    "Each pylon top needs a backstay to its bank, and a tie to the other pylon top.": "প্রতিটি স্তম্ভের মাথায় পাড়ে পেছনের তার, আর অন্য স্তম্ভের মাথায় একটি বাঁধন লাগবে।",
    "Every road joint needs a stay; the middle joint can take one from each pylon.": "রাস্তার প্রতিটি জোড়ে একটি তার লাগবে; মাঝের জোড় দুই স্তম্ভ থেকেই নিতে পারে।",
    "Carbon cable is stronger for the same size. Watch the stays near the banks.": "একই মাপে কার্বন তার বেশি শক্ত। পাড়ের কাছের তারগুলোর দিকে নজর রাখো।",
  };
  let lang = "en";
  function t(en, vars) {
    let s = (lang === "bn" && BN[en]) || en;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  root.BWi18n = { t, setLang: l => { lang = l; }, getLang: () => lang, BN };
})(window);
