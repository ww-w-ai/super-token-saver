# super-token-saver

**Claude Code-এর একমাত্র প্লাগইন যা CC-এর সোর্স কোড সত্যিকার অর্থে পড়ে জানতে পারে আপনার টোকেন কোথায় যাচ্ছে — এবং এটি স্বয়ংক্রিয়ভাবে ঠিক করে দেয়। কম খরচ করুন, বেশিক্ষণ কাজ করুন।**

> পরিমাপ করা ফলাফল: একটি বাস্তব $326/দিনের কাজের চাপে **৪৫% খরচ সাশ্রয়** → $180/দিন। স্বয়ংক্রিয় SubTask ডেলিগেশন, শূন্য খরচে কনটেক্সট পুনরুদ্ধার, পূর্ণ অ্যানালিটিক্স ড্যাশবোর্ড এবং ক্যাশ এক্সপায়ারির জন্য একটি গার্ড — একটি ইনস্টলে, কোনো কনফিগ ছাড়া।

**Max Plan ($200/মাস)** এবং **API pay-per-use** উভয়ের সাথে কাজ করে। একই প্লাগইন, একই ফিচার। প্রতিটি ব্যবহারকারীর জন্য শক্তিশালী — বিশেষত যখন প্রতিটি টোকেন প্রকৃত অর্থ।

![Usage dashboard — দেখুন আপনার টোকেন ঠিক কোথায় যাচ্ছে](docs/images/usage-view-overview.png)

### ৩০ সেকেন্ডে এটি কী করে

| ফিচার | কী হয় | প্রভাব |
| ----- | ------- | ------ |
| 🧠 Session Architect | ভারী কাজ স্বয়ংক্রিয়ভাবে SubTask-এ ডেলিগেট করে (৩৭.৫% সস্তা ক্যাশ) | কনটেক্সট ছোট থাকে, খরচ কমে |
| 🪶 Concise Mode | রেসপন্সের padding কাটে, বিষয়বস্তু রাখে | প্রতি রেসপন্সে কম output টোকেন |
| 🔄 /s-continue | /compact প্রতিস্থাপন করে — শূন্য LLM কল, শূন্য খরচ, শূন্য তথ্য হারানো, আর এখন **Codex** সেশনও পুনরুদ্ধার করে | দুই টুলেই বিনামূল্যে কনটেক্সট পুনরুদ্ধার |
| 🤝 /s-compact | একটি সেশন handoff লেখে যা /s-continue স্বয়ংক্রিয়ভাবে লোড করে — sub-agent findings ও tool results ধরে রাখে যা transcript হারিয়ে ফেলে | পরের সেশন hidden context সহও resume হয় |
| 📊 Status Line | রিয়েল-টাইম খরচ, কনটেক্সট সাইজ, রেট লিমিট — ৫০ms-এর কম | সমস্যা খরচ হওয়ার আগেই দেখুন |
| 📈 /usage-view | AI-চালিত বিশ্লেষণ সহ ইন্টারেক্টিভ HTML ড্যাশবোর্ড | এক ক্লিকে সম্পূর্ণ খরচ ফরেনসিক্স |
| ✂️ /setup-git-lite | CC প্রতিটি সেশনে যে ২,২০০ লুকানো টোকেন ইনজেক্ট করে তা সরায় | শুধু git নির্দেশাবলীতে ~$48/মাস সাশ্রয় |
| 🛡️ Token Guardian | ক্যাশ এক্সপায়ারি আপনার কনটেক্সট রি-সেন্ড করার মুহূর্তেই সতর্ক করে, বা `block` mode-এ সেটি ব্লক করে | আর কোনো নীরব $9 চমক নয় |

---

## 😤 সমস্যা

**অদৃশ্য খরচ।** রিয়েল-টাইম দৃশ্যমানতা নেই। "আপনার কনটেক্সট ৮০০K-এ" কোনো সতর্কতা নেই। "ক্যাশ ৩ মিনিট আগে মেয়াদ শেষ হয়েছে" কোনো অ্যালার্ট নেই। ক্ষতি হওয়ার পরে জানতে পারেন।

**কনটেক্সট ফোলা।** ২০০K বনাম ৮০০K কনটেক্সটে একই prompt ৪গুণ বেশি ব্যয়বহুল। প্রতিটি Read, Grep, Edit পুরো কনটেক্সট রি-সেন্ড করে। একটি জটিল prompt ১৫+ API কল ট্রিগার করে, প্রতিটি আপনার কনটেক্সট সাইজ দিয়ে গুণ।

**ক্যাশ এক্সপায়ারি।** আপনি লাঞ্চ থেকে ফিরলেন। ক্যাশ চলে গেছে। একটি prompt ৯০০K টোকেন পুরো দামে রি-সেন্ড করে। এক শটে $9।

**সব ম্যানুয়াল।** কনটেক্সট ম্যানেজমেন্ট, ক্যাশ এক্সপায়ারি টাইমিং, SubTask ডেলিগেশন, সেশন ক্লিনআপ। প্রকৃতপক্ষে কোড করতে করতে কেউ এসব ট্র্যাক করতে পারে না।

**Max Plan ($200/মাস)?** উপরের সব, প্লাস একটি ৫-ঘণ্টার রেট লিমিট যা কোনো টাইমার এবং ETA ছাড়াই আপনার প্রবাহ নষ্ট করে।

**API pay-per-use?** উপরের সব, তবে কোনো সিলিং নেই। একটি cache miss = $9 প্রকৃত অর্থ। সপ্তাহে দশবার = শুধু দুর্ঘটনায় $360/মাস। ফুলে ওঠা কনটেক্সটের একটি খারাপ মঙ্গলবার Max Plan সাবস্ক্রাইবার মাসে যা দেয় তার চেয়ে বেশি খরচ করতে পারে।

super-token-saver এই সব স্বয়ংক্রিয়ভাবে হ্যান্ডেল করে। **একবার ইনস্টল করুন। শেষ।**

---

## 🚀 ইনস্টলেশন

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

ইনস্টলের পরে স্বয়ংক্রিয়ভাবে কাজ করে। Zero config। [Claude Code](https://claude.ai/claude-code) v2.1.71+ প্রয়োজন।

লাইভ মনিটরিংয়ের জন্য:

```
/setup-statusline install
```

CC-এর built-in git নির্দেশাবলী থেকে ২,২০০ লুকানো টোকেন ট্রিম করতে ([বিবরণ](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 ফিচার ১: Smart Session Architecture

**এটি ইনস্টল করুন এবং cost-optimized কাজের প্যাটার্নগুলি স্বয়ংক্রিয়ভাবে শুরু হয়।**

অধিকাংশ ব্যবহারকারী Main session-এ সবকিছু করেন। ফাইল পড়া, কোড জেনারেশন, টেস্ট রান। প্রতিটি আউটপুট কনটেক্সটে জমা হয় এবং প্রতিটি বার্তার সাথে রি-সেন্ড হয়। সেশন ফুলে ওঠে। খরচ তুষারপাতের মতো বাড়ে।

Session Architect সেশন শুরুতে স্বয়ংক্রিয়ভাবে একটি ডেলিগেশন কৌশল ইনজেক্ট করে।

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| ভূমিকা           | Design, decisions, review         | Implementation, code gen, multi-file  |
| Cache tier       | ১ ঘণ্টা (ephemeral_1h)             | ৫ মিনিট                               |
| Cache write cost | ＄10/MTok                          | ＄6.25/MTok                            |
| Context size     | ~৯৪K গড়                          | ~৩৩K গড়                              |

SubTask-এর Main-এর তুলনায় **৩৭.৫% সস্তা cache write** আছে। কনটেক্সটও অনেক ছোট। SubTask-এ ভারী কাজ ডেলিগেট করা খরচ নাটকীয়ভাবে কমায়।

**ফলাফল:** কনটেক্সট ৬০০K+-এ বাড়ার বদলে ২৫০K-এর নিচে থাকে। একই কাজের আউটপুট, অর্ধেক টোকেন খরচ। সম্পূর্ণ স্বয়ংক্রিয়।

---

## 🪶 Concise Mode

**একই বিষয়বস্তু। কম padding। ডিফল্টে চালু।**

SessionStart hook একটি রেসপন্স-স্টাইল নিয়মও ইনজেক্ট করে যা **প্রতিটি সেশনে এবং প্রতিটি মডেলে** চলে — কোনো ফ্ল্যাগ নেই, কোনো সেটআপ নেই। তিনটি জিনিস পরিবর্তন হয়:

- **Preamble বাদ** — কোনো "Let me check…", "I'll now…", আপনার প্রশ্নের পুনরাবৃত্তি, বা diff যা দেখায় তার recap নেই
- **কনটেন্টের জন্য সঠিক ফরম্যাট** — তালিকার জন্য bullet, যুক্তির জন্য prose (tradeoffs, causation, rationale)। কিছুই জোর করা হয় না
- **আরও সংক্ষিপ্ত প্রকাশ** — একই বিষয়, কম শব্দ। স্পষ্ট prose হল সংক্ষিপ্ত prose

কঠিন সীমা: কখনো কনটেন্ট বাদ দেবে না, যাচাই এড়াবে না, বা সূক্ষ্মতা এক বাক্যে সংকুচিত করবে না। বিষয়বস্তু পুরো থাকে; শুধু wrapper সংকোচিত হয়।

একবার ইনস্টল করুন, সর্বত্র প্রযোজ্য।

---

## 🔄 ফিচার ২: /s-continue — কনটেক্সট পুনরুদ্ধার

**`/compact` প্রতিস্থাপন করে। শূন্য LLM কল। শূন্য টোকেন খরচ। শূন্য তথ্য হারানো।**

`/compact` আপনার পুরো কনটেক্সট (~১M টোকেন) LLM-এ পাঠায় এটিকে ৩.৩% সারসংক্ষেপে সংকুচিত করতে। যদি ক্যাশ মেয়াদ শেষ হয়, এটি একা একটি পূর্ণ রি-ক্যাশ ট্রিগার করে। তথ্য হারানো অনিবার্য।

`/s-continue` সম্পূর্ণ ভিন্ন পদ্ধতি নেয়। এটি পূর্ববর্তী সেশন ট্রান্সক্রিপ্ট প্রি-প্রসেস করে এবং সরাসরি লোড করে। কোনো LLM কল নেই। কোনো খরচ নেই। মূল কথোপকথন যেমন ছিল তেমনই পুনরুদ্ধার হয়।

|                         | /compact                                    | /s-continue                                   |
| ----------------------- | ------------------------------------------- | ------------------------------------------- |
| কীভাবে কাজ করে         | সারসংক্ষেপের জন্য LLM-এ পুরো কনটেক্সট পাঠায় | ট্রান্সক্রিপ্ট প্রি-প্রসেস করে, সরাসরি পড়ে |
| LLM কল                  | প্রয়োজন (সাধারণত ১০০K+ টোকেন)              | ০                                           |
| টোকেন খরচ               | বেশি                                        | ০                                           |
| তথ্য হারানো             | হ্যাঁ (৩.৩% সারসংক্ষেপ)                     | না (মূল সংরক্ষিত)                           |
| প্রক্রিয়াকরণ গতি       | দশ সেকেন্ড                                   | < ১ সেকেন্ড (৬০MB+ ফাইলেও)                  |
| ক্যাশ মেয়াদ শেষ হলে   | উপরে পূর্ণ রি-ক্যাশ খরচ                     | কোনো প্রভাব নেই                             |
| মাল্টি-সেশন পুনরুদ্ধার | সম্ভব নয়                                    | সমর্থিত                                     |

ব্যবহার: `/clear` তারপর `/s-continue`। পূর্ববর্তী সেশনের তালিকা দেখাবে। পুনরুদ্ধারের জন্য একটি বেছে নিন। দ্রুত পুনরুদ্ধারের জন্য: `/s-continue last`।

**ফলাফল:** শূন্য খরচে পূর্ববর্তী কাজ পুনরায় শুরু করুন। কোনো তথ্য হারানো নেই। ৬০MB+ ট্রান্সক্রিপ্ট ১ সেকেন্ডেরও কম সময়ে প্রক্রিয়া করে।

---
### 🤝 এর জোড়া: `/s-compact` — লুকানো স্তরের handoff

`/s-continue` transcript পুনরুদ্ধার করে — আপনি ও Claude যা বলেছেন। কিন্তু একটি working session-এর সবচেয়ে দরকারি জ্ঞান প্রায়ই সেই কথোপকথনের বাইরে থাকে: একটি sub-agent কী খুঁজে পেয়েছিল (তার transcript একটি আলাদা ফাইল যা পুনরুদ্ধার কখনো লোড করে না), tool output-এর একটি সিদ্ধান্তমূলক সংখ্যা (test count, benchmark), অথবা প্রক্রিয়া থেকে শেখা একটি শিক্ষা ("headless reproduce করা যায়নি ← কারণ ছিল build, code নয়")।

সেশনের শেষে `/s-compact` চালান, এটি ঠিক সেই লুকানো স্তরকে distill করে একটি handoff-এ পরিণত করে, যা সংরক্ষিত হয় `~/.claude/super-token-saver-data/<project>/handoff.md`-এ। পরের সেশনে, `/s-continue` পুনরুদ্ধারকৃত transcript-এর উপরে এটি স্বয়ংক্রিয়ভাবে লোড করে — কিছু paste করার দরকার নেই।

|                     | শুধু `/s-continue`              | `/s-compact` + `/s-continue` (জোড়া)             |
| পুনরুদ্ধার করে       | Transcript (যা বলা হয়েছে)        | Transcript এবং লুকানো স্তর দুটোই                 |
| Sub-agent findings   | হারিয়ে যায় (আলাদা ফাইল)          | Handoff-এ distill হয়                              |
| Tool-output সংখ্যা   | শুধু chat-এ উদ্ধৃত হলে           | ইচ্ছাকৃতভাবে extract হয়                            |
| প্রক্রিয়ার শিক্ষা    | —                                | Capture হয় যাতে dead end আবার না চলে              |

Workflow: সেশন শেষ করুন `/s-compact` দিয়ে → পরেরটি শুরু করুন `/s-continue` দিয়ে।

### 🔀 দুটো টুল, একটাই history — Codex সেশনও এখান থেকেই পুনরুদ্ধার হয়

Codex তার সেশন লেখে `~/.codex/sessions/`-এ; Claude Code লেখে `~/.claude/projects/`-এ। একটা টুল অন্যটার ফাইল পড়ে না। ফলে Codex-এ বাজেট ফুরিয়ে থেমে যাওয়া কোনো স্প্রিন্ট আগে Claude Code থেকে ধরাই যেত না, আর উল্টোটাও।

`/s-continue` এখন দুটোই দেখায় ও পুনরুদ্ধার করে। Codex-এর rollout-কে দ্বিতীয় কোনো parser-এর হাতে দেওয়া হয় না — বরং সেটাকে Claude Code যে আকারে লেখে সেই আকারেই নতুন করে লেখা হয়, **প্রতিটি input লাইনের জন্য একটা output লাইন**, ফলে একই pipeline দুটো টুলকেই সার্ভ করে আর প্রতিটি `L{n}` marker এখনও মূল Codex ফাইলের ঠিক সেই লাইনকেই নির্দেশ করে। পরিমাপ: 12 MB, 1,540-লাইনের একটা rollout preprocess হয় মাত্র **0.13 s**-এ।

|                        | Claude Code সেশন | Codex সেশন |
| ---------------------- | ------------------- | ------------- |
| `/s-continue`-এ তালিকাভুক্ত | হ্যাঁ | হ্যাঁ, বর্তমান project-এর মধ্যে সীমিত |
| শূন্য LLM খরচে পুনরুদ্ধার | হ্যাঁ | হ্যাঁ |
| মূল ফাইলে `L{n}` দিয়ে খোঁজা | হ্যাঁ | হ্যাঁ — লাইন নম্বর rollout-এরই নিজস্ব |
| কনটেক্সট-হারানো (`#0`) পুনরুদ্ধার | `/compact`, auto-compact | Codex-এর নিজস্ব compaction ও thread rollback |
| `/s-compact` handoff | প্রতি project-এ শেয়ার হয় — এক টুলে লিখুন, আরেকটাতে লোড করুন |

```
/s-continue codex                    শুধু Codex সেশন
/s-continue codex : rust migration   একটা টপিকের সাথে মেলা turn-গুলো, সম্পূর্ণভাবে পুনরুদ্ধার করা
```

দুটো ছোট বিষয় সঠিক তালিকা আর দেখতে-ঠিক-কিন্তু-ভুল তালিকার মধ্যে পার্থক্য গড়ে দেয়: Codex-এর `session_id` আসলে **thread**-এর id, যেটা spawn হওয়া কোনো sub-agent উত্তরাধিকার সূত্রে পায়, তাই সেশনগুলো `payload.id` দিয়ে key করা হয় আর sub-agent rollout-কে সেই একই ভাবে বাদ দেওয়া হয় যেভাবে Claude Code-এর subtask transcript ইতিমধ্যে বাদ দেওয়া হয়। আর `<codex_internal_context source="goal">` machine-injected, তাই সেটা পুনরুদ্ধার করা কনটেক্সটে থাকে ঠিকই, কিন্তু আপনার টাইপ করা turn হিসেবে কখনো গোনা হয় না।

এই plugin Codex-এও install হয় — দেখুন **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md))। `usage-view`, `report-limit` আর `setup-statusline` আপাতত শুধু Claude Code-এর জন্যই থাকছে।

---

## 📊 ফিচার ৩: লাইভ স্ট্যাটাস লাইন

**রিয়েল-টাইম টোকেন/খরচ মনিটরিং। ৫০ms-এর কম ওভারহেড।**

একবার `/setup-statusline install` চালান এবং Claude Code-এর নীচে একটি স্থায়ী স্ট্যাটাস বার উপস্থিত হয়।

**স্বাভাবিক অপারেশন** — এক নজরে প্রতিটি মেট্রিক, শূন্য কনটেক্সট স্যুইচিং:

![Status line in normal state](docs/images/statusline-normal.png)

**রেট লিমিট হিট** — ১০২%-এ 5H লাল হয়, কাউন্টডাউন ঠিক কখন ফিরবেন দেখায়, এবং একটি one-tap `/report-limit` অ্যাকশন স্বয়ংক্রিয়ভাবে প্রকাশ পায়:

![Status line when rate limited](docs/images/statusline-rate-limited.png)

| ইন্ডিকেটর       | কী দেখায়                                  | 🟢 স্বাভাবিক | 🟡 সতর্কতা | 🔴 সংকটজনক |
| ---------------- | ----------------------------------------- | ------------ | ---------- | ---------- |
| RUN (delta)      | শেষ API কলের খরচ                          | < ＄0.30      | >= ＄0.30   | >= ＄1.00   |
| RUN (cumulative) | এই ফোল্ডারের ক্রমবর্ধমান খরচ             | —            | —          | —          |
| 5H               | ৫-ঘণ্টা উইন্ডো ব্যবহার + রিসেট কাউন্টডাউন | < ৭০%        | >= ৭০%     | >= ৯০%     |
| CTX              | কনটেক্সট উইন্ডো ব্যবহার                   | < ৩৫%        | >= ৩৫%     | >= ৭০%     |

যখন কোনো ইন্ডিকেটর সতর্কতা বা সংকটজনক হিট করে, `→ /usage-view current` হিন্ট স্বয়ংক্রিয়ভাবে উপস্থিত হয়।

সরাতে: `/setup-statusline uninstall` (পূর্ববর্তী কনফিগ auto-restored)।

**ফলাফল:** প্রতিটি খরচ সমস্যা রিয়েল টাইমে দৃশ্যমান। ৫০ms-এর কম ওভারহেড — কোনো লক্ষণীয় বিলম্ব নেই।

> **API pay-per-use-এ আছেন?** 5H এবং W ইন্ডিকেটর auto-hide হয় — আপনার রেট লিমিট উইন্ডো নেই। যা থাকে তা গুরুত্বপূর্ণ: RUN (প্রতি টার্নে রিয়েল-টাইম খরচ) এবং CTX (কনটেক্সট সাইজ)। আপনার বিল নিয়ন্ত্রণের দুটি লিভার, সবসময় দৃশ্যমান।

---

## 📈 Usage Dashboard (/usage-view)

**অবশেষে উত্তর দিন: "সেই সব টাকা কোথায় গেল?"**

Max Plan ব্যবহারকারীরা রেট লিমিট হিট করেন এবং ভাবেন কেন। API ব্যবহারকারীরা Anthropic ইনভয়েস খোলেন এবং ভাবেন কীভাবে। যেকোনোভাবেই হোক, প্রশ্ন একই: কোন সেশন সবচেয়ে বেশি টোকেন পোড়াল? খরচ কখন বেড়েছিল? আপনার ব্যবহারে কী প্যাটার্ন আছে? এখন পর্যন্ত — সব অদৃশ্য ছিল।

`/usage-view` সবকিছু দেখায়। আপনার ব্রাউজারে একটি ইন্টারেক্টিভ HTML ড্যাশবোর্ড খোলে, যা আপনাকে ব্যবহার প্যাটার্ন বিশ্লেষণ করতে এবং খরচ বৃদ্ধির মূল কারণ ট্রেস করতে দেয়। কোনো বাহ্যিক ডিপেন্ডেন্সি নেই। স্বাধীনভাবে কাজ করে। ফাইল হিসেবে শেয়ারযোগ্য।

**৩১ দিনে $4,196। সব কোথায় গেল?** এক নজর — মোট খরচ, ধরন অনুযায়ী টোকেন বিভাজন, ক্যাশ দক্ষতার অনুপাত এবং সেশন সংখ্যা। ডোনাট চার্ট তাৎক্ষণিকভাবে দেখায় যে আপনার ব্যয়ের ৬৫% ক্যাশ রিড (যা স্বাভাবিক ও স্বাস্থ্যকর):

![Usage dashboard overview](docs/images/usage-view-overview.png)

**আগে বনাম পরে — পরিমাপ করা, অনুমান করা নয়।** কমলা রঙের ড্যাশড "Plugin installed" মার্কার আপনার খরচের টাইমলাইন দুটিতে ভাগ করে। দৈনিক বারগুলি টোকেন ধরন (Input/Output/Cache Write/Cache Read) অনুযায়ী স্ট্যাকড যাতে ইনস্টলের পরে ঠিক কোন উপাদান পরিবর্তিত হয়েছে তা দেখতে পারেন। গড় লাইন প্রবণতা দেখায়:

![Daily cost trend](docs/images/usage-view-daily-trend.png)

**আপনি সবচেয়ে বেশি কখন পোড়ান?** দিনের সময় এবং সপ্তাহের দিন অনুযায়ী ঘণ্টাওয়ারি খরচ। সক্রিয়-দিনের গড়, সব-দিনের গড়, বা সর্বোচ্চের মধ্যে টগল করুন। আগুনের আইকন আপনার সবচেয়ে ব্যয়বহুল ঘণ্টা চিহ্নিত করে — দৃশ্যমান প্যাটার্ন (রাতের মার্থন, বুধবারের স্পাইক) তাৎক্ষণিকভাবে সামনে আসে:

![Hourly and day-of-week cost pattern](docs/images/usage-view-hourly-pattern.png)

**আপনি কি আরও দক্ষ হচ্ছেন?** Total/Output অনুপাত পরিমাপ করে প্রতিটি output টোকেন উৎপন্নে কতগুলি টোকেন খরচ হয়। কম ভালো। "Plugin installed" মার্কার আপনাকে আগে বনাম পরে তুলনা করতে দেয়। স্পাইক = ক্যাশ মিস বা সেশন রিস্টার্ট:

![Efficiency trend](docs/images/usage-view-efficiency.png)

**প্রতিটি API কল, কনটেক্সট সাইজ এবং খরচ দিয়ে প্লট করা।** এটি সেই চার্ট যা খরচ কাঠামো স্পষ্ট করে। প্রতিটি ডট একটি API কল। লাল = Opus, নীল = Sonnet, সবুজ = Haiku। ড্যাশড লাইন তাত্ত্বিক মূল্য — আপনার ডট লাইনের উপরে থাকলে আপনি অতিরিক্ত পরিশোধ করছেন। প্রতি API কলের পরিবর্তে প্রতি কথোপকথন টার্নে খরচ দেখতে **User Turn** ভিউতে টগল করুন।
যেকোনো ডটে হোভার করুন আসল prompt টেক্সট, টোকেন সংখ্যা এবং সম্পূর্ণ খরচ বিভাজন (Input/Output/Cache Write/Cache Read) দেখতে:

![Cost by Context Size — scatter chart](docs/images/usage-view-cost-scatter.png)

**আপনার কনটেক্সটগুলি কতটা বড়?** বেশিরভাগ কল ২৫০K-এর নিচে ক্লাস্টার করে। ৩৫০K-এর উপরের লম্বা লেজ যেখানে খরচ বিস্ফোরিত হয় — এই চার্ট ঠিক দেখায় আপনি বিপদজনক অঞ্চলে কতবার থাকেন:

![Context Size Distribution](docs/images/usage-view-context-dist.png)

**আপনার কোডিং শিডিউল, ঘণ্টা দিয়ে মূল্য নির্ধারিত।** ৩০ দিনে ৫-ঘণ্টা উইন্ডো হিটম্যাপ। সবুজ (<$15/ঘণ্টা), কমলা ($15-30/ঘণ্টা), লাল ($30+/ঘণ্টা)। মাথার খুলি আইকন (💀) উইন্ডো চিহ্নিত করে যেখানে আপনি রেট লিমিট হিট করেছেন। উপরে খরচ স্লাইডার সস্তা উইন্ডো ফিল্টার করে যাতে ব্যয়বহুল পপ হয় — আপনার সবচেয়ে খারাপ দিন তাৎক্ষণিকভাবে খুঁজে পেতে টেনে আনুন। ৫-ঘণ্টা উইন্ডো এবং ১-ঘণ্টা ব্লক ভিউয়ের মধ্যে টগল:

![Hourly usage calendar heatmap](docs/images/usage-view-calendar.png)

**সেই উইন্ডোর সেশনে ড্রিল করতে যেকোনো সেল ক্লিক করুন।** সেই টাইম স্লটের প্রতিটি সেশন, খরচ, মেসেজ সংখ্যা, টোকেন বিভাজন এবং প্রতিটি কথোপকথনের আসল প্রথম/শেষ মেসেজ সহ। "Top Token Conversations" প্রসারিত করুন দেখতে কোন নির্দিষ্ট আদান-প্রদান সবচেয়ে বেশি পুড়িয়েছে — প্রতিটি এন্ট্রি prompt টেক্সট, খরচ অ্যালার্ট ট্যাগ এবং অপ্টিমাইজেশন হিন্ট দেখায়:

![Session detail panel](docs/images/usage-view-session-drilldown.png)

**AI-চালিত বিশ্লেষণ (ঐচ্ছিক)।** যখন আপনি `--no-ai` ছাড়া `/usage-view` চালান, একজন AI বিশ্লেষক আপনার সম্পূর্ণ ড্যাশবোর্ড ডেটা পড়েন — API মূল্য রেফারেন্স baked in — এবং একটি লিখিত রিপোর্ট তৈরি করেন: খরচ চালক, অস্বাভাবিকতা, অপ্টিমাইজেশন সুপারিশ। আপনার OS ভাষায় স্বয়ংক্রিয়ভাবে প্রদর্শিত (২৩টি ভাষা, RTL সহ; চার্ট/টেবিল সবসময় LTR থাকে):

**টাকা কোথায় গেল** — মোট ব্যয়, টোকেন ধরন অনুযায়ী খরচ চালক, সাপ্তাহিক প্রবণতা এবং প্রকৃত সংখ্যায় প্লাগইন প্রভাব:

![AI analysis — cost breakdown](docs/images/usage-view-ai-report-1.png)

**কখন এবং কীভাবে আপনি কাজ করেন** — পিক আওয়ার, ব্যস্ততম দিন, API কল বিতরণ এবং রেট লিমিট প্যাটার্ন যা অপ্টিমাইজেশন সুযোগ প্রকাশ করে:

![AI analysis — work patterns](docs/images/usage-view-ai-report-2.png)

**এটি সম্পর্কে কী করবেন** — কংক্রিট, ডেটা-ভিত্তিক সুপারিশ আপনার প্রকৃত ব্যবহারের সাথে মানানসই। মডেল স্যুইচিং, কনটেক্সট ম্যানেজমেন্ট, সেশন কৌশল:

![AI analysis — recommendations](docs/images/usage-view-ai-report-3.png)

**শেয়ার করুন।** পুরো ড্যাশবোর্ড একটি একক স্বয়ংসম্পূর্ণ HTML ফাইল — সব ডেটা এমবেডেড, কোনো সার্ভার দরকার নেই। আপনার টিম, ম্যানেজার বা অ্যাকাউন্ট্যান্টকে পাঠান। কোনো বাহ্যিক ডিপেন্ডেন্সি নেই। অফলাইনে কাজ করে। শেয়ার করার আগে সব prompt টেক্সট স্ট্রিপ করতে `private` মোড ব্যবহার করুন — খরচ বিশ্লেষণ অক্ষত থাকে যখন কথোপকথনের বিষয়বস্তু সরানো হয়।

```
/usage-view                  # সব সময়, সব প্রকল্প
/usage-view current          # শুধু বর্তমান ৫-ঘণ্টা উইন্ডো
/usage-view last 7 days      # শেষ ৭ দিন
/usage-view locale ja        # জাপানি
/usage-view --no-ai          # AI বিশ্লেষণ এড়িয়ে যান (দ্রুত)
/usage-view private          # prompt টেক্সট স্ট্রিপ করুন (শেয়ার করার জন্য নিরাপদ)
```

---

## 🔬 রেট লিমিট গবেষণা (/report-limit)

**রেট লিমিট ফর্মুলা রিভার্স-ইঞ্জিনিয়ার করার কমিউনিটি-চালিত প্রকল্প।**

Anthropic ৫-ঘণ্টা উইন্ডোর সঠিক ফর্মুলা প্রকাশ করে না। আসুন একসাথে বের করি।

যখন আপনি রেট লিমিট হিট করেন, `/report-limit` চালান। আপনার বর্তমান ব্যবহার ডেটা স্বয়ংক্রিয়ভাবে GitHub Discussion হিসেবে জমা হয়। আমরা যত বেশি ডেটা সংগ্রহ করব, ফর্মুলা তত স্পষ্ট হবে।

---

## ✂️ ফিচার ৪: /setup-git-lite — CC-এর Built-in Git Instructions ট্রিম করুন

**আমরা Claude Code-এর সোর্স কোড পড়েছি। আমরা ২,২০০ লুকানো টোকেন খুঁজে পেয়েছি যা প্রতিটি সেশনে ইনজেক্ট হয় এবং আপনি নীরবে পরিশোধ করছেন।**

### আবিষ্কার

২০২৬-০৪-১২ তারিখে, একটি [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) প্রকাশ করে যে Claude Code-এর built-in `includeGitInstructions` সেটিং প্রতিটি সেশনে নীরবে টোকেন পোড়াচ্ছে। [এই gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) এর মাধ্যমে স্বাধীন পুনরুৎপাদন সংখ্যাগুলি নিশ্চিত করেছে: প্রতিটি git commit-এর পরে প্রতি সেশনে **cache writes-এ +৬,০৩১ টোকেন**, প্রতিটি API কলে **cache reads-এ +১,৬৯০ টোকেন**।

### CC সোর্স বিশ্লেষণ — টোকেন কোথায় যায়

আমরা Claude Code সোর্সে (v2.1.88) দুটি স্বাধীন ইনজেকশন পয়েন্টে টোকেন ট্রেস করেছি:

**১. `gitStatus` স্ন্যাপশট (~৫০০ tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` branch + main branch + user.name + full status (সর্বোচ্চ ২০০০ chars) + **সাম্প্রতিক ৫টি commit** সংগ্রহ করে
- `appendSystemContext` (`utils/api.ts:437`) এর মাধ্যমে system prompt-এ যুক্ত ও append
- প্রতিটি নতুন commit, প্রতিটি নতুন modified ফাইল, প্রতিটি branch switch টেক্সট পরিবর্তন করে → prefix cache invalidation

**২. Commit/PR workflow instructions (~১,৭০০ tok) — Bash tool description**
- `tools/BashTool/prompt.ts:53` `Bash` tool-এর বিবরণে ৬০+ লাইন safety protocol, step-by-step commit procedure, HEREDOC examples এবং PR creation template append করে
- System prompt-এর সাথে cached, কিন্তু `tools[]` parameter হিসেবে shipped

### এটি কেন ব্যয়বহুল

Cache structure (`utils/api.ts:321` `splitSysPromptPrefix`)-এর active MCP tools আছে কিনা তার উপর ভিত্তি করে তিনটি পথ আছে:

- **Path A** (MCP active — বেশিরভাগ ব্যবহারকারী): `gitStatus` একটি `cacheScope: 'org'` ব্লকের ভেতরে আছে। যেকোনো পরিবর্তন → পরবর্তী সেশন শুরুতে পুরো ব্লক re-cached → ৬K tok `cache_create` miss।
- **Path B** (MCP নেই): `gitStatus` একটি `cacheScope: null` dynamic ব্লকে যায়, যার মানে প্রতিটি API কলে fresh `input_tokens` হিসেবে re-sent — cache miss নেই, কিন্তু cache savings-ও নেই।
- **Path C** (3P provider / experimental betas disabled): Path A-এর মতো।

সাধারণ interactive সেশনে, commit/PR instructions (১.৭K tok) `cache_read` এর মাধ্যমে **প্রতিটি API কলে** জমা হয়। Opus 4.7 মূল্যে ১০০-কল সেশনে, এটি মোটামুটি **প্রতি সেশনে $০.০৮** শুধুমাত্র সেই instructions-এর জন্য যা Claude-এর training ইতিমধ্যে বেশিরভাগ cover করে।

### super-token-saver কীভাবে এটি handle করে

`/setup-git-lite` native path disable করে এবং SessionStart hook-এর মাধ্যমে **curated ২৮০-টোকেন প্রতিস্থাপন** ইনজেক্ট করে। আমরা ঠিক সেটুকু রেখেছি যা Claude-এর default behavior override করে (safety rules), এবং যা Claude training থেকে ইতিমধ্যে জানে তা বাদ দিয়েছি (step-by-step workflows, PR templates, gh usage patterns)।

**Retained — ১১টি critical override rule** (যেগুলি Claude-এর default helpfulness-কে সতর্কতায় রূপান্তরিত করে):
- Explicit user request ছাড়া কখনো commit/push/amend/PR/tag/merge নয়
- Hooks skip নয়, main/master-এ force-push নয়, destructive ops নয়, git config modify নয়
- `.env`, `credentials`, `*.pem`, `secret.*` matching ফাইল commit নয়
- `git add -A` / `git add .` এড়িয়ে চলুন
- Multi-line commit messages-এর জন্য HEREDOC + `Co-Authored-By: Claude` trailer
- Interactive flags (-i) ব্যবহার নয়, empty commits নয়
- যদি pre-commit hook fail হয় → NEW commit তৈরি করুন (not `--amend`)

**Dropped** — step-by-step commit workflow (৩ ধাপ), step-by-step PR workflow (৩ ধাপ), PR title/body template, `gh` command references, `-uall` flag warning, `--no-edit` with rebase warning, `NEVER use TodoWrite or Agent tools during commit` constraint। এগুলি workflow verbosity যা Claude training থেকে সঠিকভাবে compose করে।

**Added** — compact git state line: branch + HEAD short-sha + subject + current status (সর্বোচ্চ ২০ modified ফাইল, অন্যথায় সংখ্যা)। কোনো recent commits list নেই (Claude চাহিদা অনুযায়ী `git log` চালাতে পারে)।

### প্রত্যাশিত সাশ্রয় (Opus 4.7 মূল্য, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| আইটেম | মূল | setup-git-lite সহ | সাশ্রয় |
| ------ | ---- | ----------------- | ------- |
| System prompt load (প্রতি নতুন সেশনে) | ~২,২০০ tok cache_create | ~২৮০ tok cache_create | ~১,৯২০ tok |
| একই সেশনে repeat calls | ~১,৭০০ tok cache_read/call | ~২৮০ tok cache_read/call | ~১,৪২০ tok/call |
| ১০০-কল সেশন (Opus 4.7) | — | — | **~$০.১১ সাশ্রয়** |
| ২০ সেশন/দিন × ২২ কর্মদিন | — | — | **~$৪৮ সাশ্রয়/মাস** |

### ব্যবহার

```bash
/setup-git-lite status     # Read-only diagnostic — বর্তমান অবস্থা + কী পরিবর্তন হবে
/setup-git-lite install    # CC native disable + আমাদের minimal hook সক্ষম করুন
/setup-git-lite revert     # Default পুনরুদ্ধার (aggressive; নিচে দেখুন)
/setup-git-lite dismiss-banner    # মাঝে মাঝে recommendation tip নীরব করুন
/setup-git-lite undismiss-banner  # tip পুনরায় সক্ষম করুন
/setup-git-lite help       # সম্পূর্ণ ব্যবহার
```

### Install semantics

`install` দৃঢ়তার জন্য **দুটি** জায়গা পরিবর্তন করে:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` যোগ করে
2. Shell profile (`~/.zshrc`, `~/.bashrc`, ইত্যাদি) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` export করা একটি marker block append করে

যেকোনো একটি একা CC native disable করার জন্য যথেষ্ট; আমরা উভয় set করি যাতে environment override দুর্ঘটনাক্রমে native behavior পুনরায় সক্ষম না করে। Shell পরিবর্তন শুধুমাত্র নতুন shell-এ কার্যকর হয়।

### Revert semantics — aggressive

`revert` **আপনার shell profile থেকে সমস্ত `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` export সরায়**, যার মধ্যে এই skill ইনস্টল করার আগে আপনি যা ম্যানুয়ালি যোগ করেছেন তাও। এটি ইচ্ছাকৃত — আপনি `revert` চালিয়েছেন, তাই আমরা clean default পুনরুদ্ধার করি। আমরা সবসময় আগে shell profile-এর একটি timestamped backup তৈরি করি।

যদি আপনার অসম্পর্কিত কারণে env var দরকার হয়, `revert` চালানোর আগে নোট করে রাখুন এবং পরে পুনরায় যোগ করুন।

### super-token-saver আনইনস্টল করার আগে

**প্রথমে `/setup-git-lite revert` চালান**, অন্যথায় আপনার settings.json-এ `includeGitInstructions: false` থাকবে কিন্তু কোনো replacement hook থাকবে না (Claude কোনো git guidance পাবে না)। Claude Code-এ বর্তমানে কোনো plugin uninstall lifecycle hook নেই, তাই আমরা এটি automate করতে পারি না।

### Trade-offs

আপনি কী হারান (এবং এটি সাধারণত কেন ঠিক আছে):
- Claude আর session শুরুতে pre-computed `git status` / `git log -n 5` পায় না। যদি আপনি নতুন সেশনে "কী পরিবর্তিত হয়েছে?" জিজ্ঞেস করেন, Claude নিজেই সেই commands চালাবে (একটি extra tool call, ~৩০০ tok)।
- Claude আর CC-এর canonical ৩-step commit procedure দেখতে পায় না। শত শত commit flow-এ আমাদের testing-এ, training-level knowledge critical cases (HEREDOC formatting, no `--amend`, no force-push) handle করে কারণ আমরা সেগুলি explicit rules হিসেবে রাখি।
- PR body template (`## Summary` + `## Test plan`) ইনজেক্ট হয় না। যদি আপনি ঠিক সেই format নিয়ে যত্নশীল হন, এটি আপনার project-এর CLAUDE.md-এ রাখুন।

### Recommendation banner

যখন CC native git instructions এখনও আপনার machine-এ সক্রিয়, super-token-saver session শুরুতে **~২০% সময়** একটি one-paragraph tip দেখায় (plus `/usage-view` এবং `/report-limit` outputs-এ)। `/setup-git-lite dismiss-banner` দিয়ে স্থায়ীভাবে dismiss করুন।

---

## 🛡️ ফিচার ৫: Token Guardian

**ক্যাশ এক্সপায়ারি যে মুহূর্তে আপনার খরচ বাড়ায়, তখনই জানিয়ে দেয়। চাইলে $9 রি-সেন্ড ব্লকও করতে পারে।**

Claude Code-এর prompt cache ১ ঘণ্টা বাঁচে। এর বেশি সময় দূরে থাকলে এটির মেয়াদ শেষ হয়। আপনার পরবর্তী বার্তা পুরো কনটেক্সট পুরো দামে রি-সেন্ড করে। ৯০০K টোকেনে সেটি এক শটে $9।

Token Guardian মনে রাখে শেষ রিপ্লাই কখন এসেছিল। যদি ৩,৫৯০ সেকেন্ডের বেশি কেটে যায় (TTL মাইনাস ১০-সেকেন্ড বাফার), এটি হস্তক্ষেপ করতে পারে। **এটি ডিফল্টে বন্ধ থাকে, Remote Control-এর কারণে।** একটি hook-এর block বার্তা স্থানীয়ভাবে system message হিসেবে রেন্ডার হয়, যা remote client কখনো পায় না, তাই একজন remote user দেখেছিলেন prompt কোনো ব্যাখ্যা ছাড়াই অদৃশ্য হয়ে গেছে। আপনি কোথায় বসে আছেন তার উপর ভিত্তি করে ভিন্ন আচরণ করা guard শিপ করার বদলে, আমরা এটি বন্ধ করে দিয়েছি। যখন Remote Control hook বার্তা ফরওয়ার্ড করা শুরু করবে, ডিফল্ট আবার চালু হবে। ততক্ষণ, দুটি মোডের একটি দিয়ে নিজে এটি চালু করুন।

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude তার প্রথম লাইনে expiry উল্লেখ করে
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt একবার নিচের বার্তা সহ প্রত্যাখ্যাত হয়
```

warn mode-এ prompt চলে যায়, এবং Claude তার রিপ্লাই শুরু করে এক লাইন দিয়ে যা বলে ক্যাশের মেয়াদ শেষ হয়ে গিয়েছিল, এই টার্ন পুরো কনটেক্সটের জন্য বিল হয়েছে, এবং এক ঘণ্টা বা তার বেশি বিরতির পরে সস্তা পথ হল `/clear` → `/s-continue`। এটি remote client-এ ঠিকই পৌঁছায়, কারণ hook বার্তা না পৌঁছালেও Claude-এর রিপ্লাই ফরওয়ার্ড হয়।

block mode-এ prompt নিচের বার্তা সহ একবার প্রত্যাখ্যাত হয়। আবার পাঠান, এটি চলে যাবে। যখন আপনি hard stop চান, local টার্মিনালে এটি ব্যবহার করুন।

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Block বার্তা আপনার OS locale অনুযায়ী ২৩টি ভাষায় দেখানো হয় এবং প্রতিটি idle সময়কালে মাত্র একবার ট্রিগার হয়।

**Background agents কখনো block হয় না।** শুধুমাত্র একজন মানুষ নিজে হাতে যা টাইপ করেন তা-ই চেক পায়। Background agents ও tasks থেকে completion reports -- যা এখন প্রায়ই launch হওয়ার এক ঘণ্টারও বেশি পরে আসে -- সরাসরি pass হয়ে যায়। একটি দীর্ঘসময় ধরে চলা agent-এর result কখনো আটকে থাকে না বা হারিয়ে যায় না।

**ফলাফল:** warn mode-এ আপনি সবসময় জানেন কখন একটি $9 রি-সেন্ড ঘটেছে, এবং কেন। block mode-এ এটি ঘটেই না: প্রতিটি ধরা পড়া এক্সপায়ারি $9 সাশ্রয় করে, এবং দিনে একবার ধরলে সেটি $270/মাস বিশুদ্ধ অপচয় দূর।

> **Pay-per-use-এ এটি আরও বেশি আঘাত করে।** একজন Max Plan সাবস্ক্রাইবার $200 বাফারের মধ্যে $9 হারান। আপনি $9 প্রকৃত অর্থ হারান — নীরবে, প্রতিবার আপনি দূরে যান। Block mode-এ Token Guardian এটি প্রতিবার থামায়।

---

## 💡 Cache আসলে কীভাবে কাজ করে (এবং কেন বেশিরভাগ ব্যবহারকারী ৪০%+ নষ্ট করেন)

Claude Code প্রতিটি API কলে model-এ পুরো conversation history পাঠায়। "API call" মানে "আপনার টাইপ করা একটি বার্তা" নয়। একটি single prompt internal tool calls trigger করে — Grep, Read, Edit, Write — এবং প্রতিটি একটি আলাদা API call। একটি prompt সহজেই ১০+ API call cause করতে পারে।

Prompt cache এই খরচ ৯০% কমায়। কিন্তু cache-এর একটি lifespan আছে।

|                     | Main Session                               | SubTask                                    |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| Cache TTL           | ১ ঘণ্টা (ephemeral_1h)                     | ৫ মিনিট                                    |
| Cache write         | ＄10/MTok                                   | ＄6.25/MTok                                 |
| Cache read          | ＄0.50/MTok                                 | ＄0.50/MTok                                 |
| Cache expire হলে    | Full context full price-এ re-sent          | Low impact (কনটেক্সট ছোট)                  |

Cache জীবিত থাকলেও, খরচ জমে। পার্থক্য দেখাতে একটি extreme scenario।

### Scenario: Full-day coding (৩h সকাল → ২h দুপুর/মিটিং → ৩h বিকেল)

Conditions: Opus 4 মূল্য, প্রতি মিনিটে ১টি prompt, প্রতি prompt-এ ~৫ API calls (~৩০০ calls/hour)।

#### ❌ super-token-saver ছাড়া

বেশিরভাগ কাজ Main session-এ হয়। কনটেক্সট দ্রুত বাড়ে।

| Phase       | Situation                         | Context size               | Cost                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| সকাল ৩h     | Coding (mostly in Main)           | ১০০K → ৬০০K (avg ৩৫০K)    | ৯০০ calls × ৩৫০K × ＄0.50/M = ＄157.50  |
| দুপুর/মিটিং  | ২ ঘণ্টা দূরে                      | —                          | —                                      |
| ফেরা        | Cache expired → full re-send      | ৬০০K full price            | ৬০০K × ＄5/M + ৬০০K × ＄10/M = ＄9       |
| ফেরা        | /compact (summarize)              | ৬০০K → sent to LLM        | ৬০০K × ＄0.50/M + summary output = ~＄1.50 |
| বিকেল ৩h    | Coding continues (context regrows) | ১০০K → ৬০০K (avg ৩৫০K)   | ৯০০ calls × ৩৫০K × ＄0.50/M = ＄157.50  |
|             | Total                             |                            | ~＄326                                  |

> এই ব্যবহারের মাত্রায়, আপনি সম্ভবত ৫-ঘণ্টা উইন্ডো রেট লিমিট হিট করবেন। **খরচ খারাপ, কিন্তু আসল সমস্যা হল আপনার কাজ সম্পূর্ণ থেমে যায়। এটি ঠিক সেই মুহূর্ত যখন Claude Code অন্ধকার হয়।**

#### ✅ super-token-saver সহ

ভারী কাজ SubTask-এ delegate। Main শুধু design/decisions handle করে।

| Phase       | Situation                                    | Context size                | Cost                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| সকাল ৩h     | Coding (Main: design, SubTask: implementation) | Main ১০০K → ৩০০K (avg ২০০K) | ৯০০ calls × ২০০K × ＄0.50/M = ＄90 |
| দুপুর/মিটিং  | ২ ঘণ্টা দূরে                                 | —                           | —                                  |
| ফেরা        | ⚡ Token Guardian (block mode) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| বিকেল ৩h    | Coding continues                             | Main ১০০K → ৩০০K (avg ২০০K) | ৯০০ calls × ২০০K × ＄0.50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 ফলাফল

> **＄326 → ＄180। প্রতিদিন ＄146 সাশ্রয়। ৪৫% খরচ সাশ্রয়।**
>
> **Max Plan:** কম টোকেন = রেট লিমিট হিট করেন না। আপনার কাজ থামে না। এটাই আসল পার্থক্য।
>
> **API pay-per-use:** ＄146/day × ২২ workdays = **আপনার invoice থেকে সরাসরি ＄3,200/মাস।** এই প্লাগইন ছাড়া ভারী মাস ＄7,000 অতিক্রম করে। এটি সহ, ＄4,000-এর নিচে। একই আউটপুট।

### super-token-saver কোথায় step in করে

```
[Session Start]
    │
    ├─ Session Architect → SubTask delegation pattern auto-inject করে
    │                       Main কনটেক্সট ২৫০K-এর নিচে রাখে
    │
[Working]
    │
    ├─ Status Line → রিয়েল-টাইম cost/context/rate limit monitoring
    │                  Warning zone-এ প্রবেশ করলে তাৎক্ষণিক alert
    │
[১+ ঘণ্টা idle]
    │
    ├─ Token Guardian → Cache expiry শনাক্ত করে, সতর্ক করে (বা block mode-এ block করে)
    │
[Session restart]
    │
    └─ /s-continue → শূন্য খরচে previous কনটেক্সট পুনরুদ্ধার (no LLM calls)
```

---

## 🔧 Source Install & Customization

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver সম্পূর্ণ open-source (Apache-2.0)। Plain JavaScript + Bash — কোনো compiled binaries নেই, কোনো external API calls নেই, কোনো telemetry নেই। প্রতিটি লাইন auditable। এই README-এ প্রতিটি claim একটি নির্দিষ্ট ফাইলে map করে যা আপনি পড়তে পারেন।

- **hooks/** — Cache expiry threshold পরিবর্তন করুন, warning messages customize করুন, session architecture rules modify করুন
- **scripts/** — Analysis logic, report builder, status line formatting
- **skills/** — /s-continue এবং /usage-view কীভাবে কাজ করে, prompt templates
- **locales/** — Translations যোগ/সম্পাদনা করুন, নতুন ভাষা যোগ করুন
- **skills/usage-view/** — Dashboard UI/UX design changes

এটি আপনার নিজের করুন। Fork করুন, পরীক্ষা করুন, এবং যদি কিছু ভালো খুঁজে পান PR পাঠান।

---

## 🌐 সমর্থিত ভাষাসমূহ

২৩টি ভাষা সমর্থিত। Claude Code ব্যবহারে শীর্ষ ২০টি দেশ এবং বৈশ্বিক স্পিকার সংখ্যায় শীর্ষ ২০টি ভাষার ক্রস-রেফারেন্স করে বাছাই। Display ভাষা আপনার OS locale থেকে auto-detect হয়। আপনি manually-ও নির্দিষ্ট করতে পারেন: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

বর্তমান অনুবাদগুলি AI-জেনারেটেড। Native speaker অবদান স্বাগত — `locales/`-এ আপনার ভাষার JSON ফাইল সম্পাদনা করুন এবং PR submit করুন।

---

## ⚖️ এই প্লাগইন আপনার কী খরচ

প্লাগইন session শুরুতে কনটেক্সট ইনজেক্ট করে। এখানে ঠিক কতটা:

| Injection | কখন | Tokens | উদ্দেশ্য |
| --------- | ---- | ------ | --------- |
| Session Architect | SessionStart (একবার) | ~১,১০০ | SubTask delegation strategy + concise mode rules |
| Git context (git-lite enabled হলে) | SessionStart (একবার) | ~২৮০ | CC-এর native ~২,২০০ tok git instructions প্রতিস্থাপন |
| Cache expiry warning | Idle > ৫৯m-এ (একবার) | ~২০০ | ব্যয়বহুল re-send flag করে, সস্তা পথ দেখায় |
| Status line | প্রতিটি API call | ০ | Terminal status bar-এ render, conversation কনটেক্সটে নয় |

**প্রতি সেশনে মোট ওভারহেড: ~১,৪০০ টোকেন (একবার, প্রথম কলের পরে cached)।**

Opus মূল্যে ($0.50/MTok cache read), এটি **প্রতি API কলে $0.0007** — এক cent-এর এক দশমের কম। ১০০-কল সেশনে: $0.07।

যদি git-lite enabled থাকে, প্লাগইন প্রতি সেশনে ~১,৯২০ টোকেন **সাশ্রয়** করে (২,২০০-কে ২৮০ দিয়ে প্রতিস্থাপন)। মোট প্রভাব নেতিবাচক — প্লাগইন যা সরায় তার চেয়ে কম consume করে।

**API pay-per-use ব্যবহারকারীদের জন্য:** $3,000/মাস খরচে, প্লাগইন ওভারহেড $2/মাসের কম। সপ্তাহে একটি blocked $9 re-send (ক্যাশ এক্সপায়ারি প্রতিরোধ) একটি single catch-এ এক বছরের ওভারহেড পরিশোধ করে।

---

## 💡 টিপস

### Cache বুঝুন এবং আপনি দেখবেন টাকা কোথায় যায়

- **১টি prompt ≠ ১টি API call।** প্রতিবার Claude Grep, Read, বা Edit call করলে, পুরো কনটেক্সট re-sent হয়। একটি single prompt easily ১০+ API calls trigger করতে পারে। অপ্রয়োজনীয় tool calls কমাতে এবং খরচ কাটাতে clear prompts লিখুন।
- **Cache timer আপনার last prompt থেকে নয়, last API call থেকে reset হয়।** কাজ চালিয়ে যান এবং cache কখনো expire হবে না। Danger দূরে যাওয়ায়। Token Guardian জানিয়ে দেয় কখন এটি ঘটেছে, এবং `block` mode-এ prompt একবার থামিয়ে দেয় যাতে আপনি choose করতে পারেন: কনটেক্সট reset করুন বা as-is চালিয়ে যান।
- **Context size = cost multiplier।** ২০০K বনাম ৮০০K-এ একই API call ৪গুণ বেশি খরচ করে। যখন status line [CTX] ৩৫% cross করে (🟡), এটি SubTask-এ আরও delegate করার signal।

### খরচ কমানোর অভ্যাস

- **CLAUDE.md সংক্ষিপ্ত রাখুন।** এটি প্রতিটি API call-এ system prompt-এ load হয়। প্রতিটি লাইন অর্থ ব্যয় করে।
- **SubTask-এ ভারী কাজ delegate করুন।** Code generation, multi-file edits, test runs Main-এ থাকার নয়। SubTask-এর smaller context এবং cheaper cache tier আছে।
- **১+ ঘণ্টার জন্য দূরে?** `/clear` → ফিরে আসুন → `/s-continue`। কনটেক্সট $0-এ restored।
- **[5H] ৭০%-এর উপরে (🟡)?** Slow down। Lightweight review tasks-এ switch করুন বা Main-এর API call count কমাতে SubTask delegation বাড়ান।
- **Side questions-এর জন্য `/btw` ব্যবহার করুন।** এটি conversation history-তে প্রবেশ করে না, তাই আপনার কনটেক্সট lean থাকে।

### API pay-per-use: সবচেয়ে গুরুত্বপূর্ণ অভ্যাস

উপরের সবকিছু প্রযোজ্য, plus এই API-specific priorities:

- **[CTX]-কে speedometer-এর মতো দেখুন।** Rate limit আপনাকে থামাবে না — কিন্তু ৫০০K+-এ কনটেক্সট মানে প্রতিটি API call যা হওয়া উচিত তার চেয়ে ২-৩গুণ বেশি খরচ করে। `/clear` → `/s-continue` free এবং আপনার cost multiplier baseline-এ reset করে।
- **Weekly `/usage-view` চালান।** Max Plan ব্যবহারকারীদের রেট লিমিট হলে naturally "ouch" moment থাকে। আপনার নেই — খরচ নীরবে বাড়ে। Dashboard আপনার early warning system।
- **Mental daily budget set করুন।** Cap ছাড়া, $200 days না জেনেই হয়। Status line-এর RUN indicator per-turn cost দৃশ্যমান করে। যদি একটি single turn $1 cross করে (🔴), আপনার কনটেক্সট too large।

---

## 📚 Documentation

- [Prompt Cache Guide](guides/prompt-cache-guide.md) — আপনার বেশিরভাগ খরচ কেন cache, providers (Anthropic, OpenAI, Gemini) জুড়ে caching কীভাবে কাজ করে, এবং কীভাবে manage করবেন ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Fable 5.1 vs Opus 5 Cost Analysis](guides/fable-5-1-vs-opus-5-cost-analysis.md) — একই quality-তে Opus 5-এর চেয়ে অন্তত ২৪–৩৮% সস্তা, ২,৭৮২ session জুড়ে
- [Fable 5.1 vs Opus 5 Cost Analysis (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Opus 4.7 vs 4.6 Cost Analysis](guides/opus-4-7-vs-4-6-cost-analysis.md) — ৮,৫৬৩ API calls জুড়ে side-by-side খরচ তুলনা
- [Opus 4.7 vs 4.6 Cost Analysis (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## লাইসেন্স

Apache-2.0
