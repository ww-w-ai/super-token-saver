# super-token-saver

**Claude Code का एकमात्र प्लगइन जो CC के सोर्स कोड को वास्तव में पढ़कर यह पता लगाता है कि आपके टोकन कहाँ जाते हैं — और इसे स्वचालित रूप से ठीक करता है। कम खर्च करें, लंबे समय तक काम करें।**

> मापा गया परिणाम: एक वास्तविक $326/दिन के वर्कलोड पर **45% लागत में कमी** → $180/दिन। स्वचालित SubTask डेलिगेशन, शून्य लागत पर कॉन्टेक्स्ट रिस्टोरेशन, पूरी एनालिटिक्स डैशबोर्ड, और कैश एक्सपायरी के लिए एक guard — एक इंस्टॉलेशन में, बिना कॉन्फिग के।

**Max Plan ($200/माह)** और **API pay-per-use** दोनों के साथ काम करता है। एक ही प्लगइन, समान फीचर। हर यूज़र के लिए बेहतर — खासकर जब हर टोकन असली पैसा हो।

![Usage dashboard — देखें कि आपके टोकन कहाँ जाते हैं](docs/images/usage-view-overview.png)

### 30 सेकंड में यह क्या करता है

| फीचर | क्या होता है | प्रभाव |
| ---- | ------------ | ------ |
| 🧠 Session Architect | भारी काम को SubTasks को ऑटो-डेलिगेट करता है (37.5% सस्ता कैश) | कॉन्टेक्स्ट छोटा रहता है, लागत कम होती है |
| 🪶 Concise Mode | रिस्पॉन्स की padding काटता है, सामग्री रखता है | प्रति रिस्पॉन्स कम output टोकन |
| 🔄 /s-continue | /compact की जगह लेता है — शून्य LLM calls, शून्य लागत, शून्य जानकारी का नुकसान, और अब **Codex** sessions भी restore करता है | दोनों tools में मुफ्त कॉन्टेक्स्ट रिस्टोरेशन |
| 🤝 /s-compact | एक session handoff लिखता है जिसे /s-continue अपने आप लोड करता है — sub-agent findings और tool results को कैप्चर करता है जो transcript खो देता है | अगला session hidden context के साथ भी resume होता है |
| 📊 Status Line | रियल-टाइम लागत, कॉन्टेक्स्ट साइज़, रेट लिमिट — 50ms से कम | समस्याओं को खर्च होने से पहले देखें |
| 📈 /usage-view | AI-powered analysis के साथ इंटरएक्टिव HTML डैशबोर्ड | एक क्लिक में पूरी लागत forensics |
| ✂️ /setup-git-lite | CC हर सेशन में जो 2,200 छुपे टोकन डालता है उन्हें हटाता है | केवल git instructions पर ~$48/माह की बचत |
| 🛡️ Token Guardian | जिस पल कैश एक्सपायरी आपका कॉन्टेक्स्ट दोबारा भेजती है, आपको warn करता है, या `block` mode में उसे ब्लॉक करता है | अब चुपचाप $9 के surprise नहीं |

---

## 😤 समस्या

**अदृश्य लागत।** रियल-टाइम visibility नहीं। "आपका कॉन्टेक्स्ट 800K पर है" कोई warning नहीं। "कैश 3 मिनट पहले expire हो गया" कोई alert नहीं। नुकसान हो जाने के बाद पता चलता है।

**कॉन्टेक्स्ट bloat।** 200K बनाम 800K कॉन्टेक्स्ट पर एक ही prompt 4x महंगा होता है। हर Read, Grep, Edit पूरा कॉन्टेक्स्ट री-सेंड करता है। एक जटिल prompt 15+ API calls trigger करता है, हर एक आपके कॉन्टेक्स्ट साइज़ से गुणा।

**कैश एक्सपायरी।** आप लंच से वापस आए। कैश चला गया। एक prompt 900K टोकन पूरी कीमत पर री-सेंड करता है। एक बार में $9।

**सब कुछ manual।** कॉन्टेक्स्ट management, कैश expiry timing, SubTask delegation, session cleanup। कोई भी वास्तव में coding करते हुए यह सब track नहीं कर सकता।

**Max Plan ($200/माह)?** ऊपर सब कुछ, साथ में एक 5-घंटे की रेट लिमिट जो बिना timer और ETA के आपका flow बर्बाद करती है।

**API pay-per-use?** ऊपर सब कुछ, लेकिन कोई ceiling नहीं। एक cache miss = $9 असली पैसे। हफ्ते में दस बार = केवल accidents पर $360/माह। bloated कॉन्टेक्स्ट वाला एक बुरा मंगलवार Max Plan subscriber के महीने से ज़्यादा खर्च कर सकता है।

super-token-saver यह सब automatically handle करता है। **एक बार install करें। हो गया।**

---

## 🚀 इंस्टॉलेशन

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

install के बाद automatically काम करता है। Zero config। [Claude Code](https://claude.ai/claude-code) v2.1.71+ की ज़रूरत है।

live monitoring के लिए:

```
/setup-statusline install
```

CC के built-in git instructions से 2,200 hidden tokens trim करने के लिए ([विवरण](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Feature 1: Smart Session Architecture

**इसे install करें और cost-optimized work patterns automatically शुरू हो जाते हैं।**

अधिकांश users Main session में सब कुछ करते हैं। File reads, code generation, test runs। हर output कॉन्टेक्स्ट में जमा होता है और हर message के साथ री-सेंड होता है। Session bloat होती है। लागत snowball होती है।

Session Architect session start पर automatically एक delegation strategy inject करता है।

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| भूमिका           | Design, decisions, review         | Implementation, code gen, multi-file  |
| Cache tier       | 1 घंटा (ephemeral_1h)             | 5 मिनट                                |
| Cache write cost | ＄10/MTok                          | ＄6.25/MTok                            |
| Context size     | ~94K avg                          | ~33K avg                              |

SubTasks में Main की तुलना में **37.5% सस्ती cache writes** हैं। Context भी बहुत छोटा है। SubTasks को भारी काम delegate करने से लागत नाटकीय रूप से कम होती है।

**परिणाम:** Context 600K+ तक बढ़ने की बजाय 250K से नीचे रहता है। Same work output, आधा token cost। पूरी तरह automatic।

---

## 🪶 Concise Mode

**Same content। कम padding। By default on।**

SessionStart hook एक response-style rule भी inject करता है जो **हर session और हर model में** चलता है — कोई flags नहीं, कोई setup नहीं। तीन चीज़ें बदलती हैं:

- **Preamble out** — कोई "Let me check…", "I'll now…", आपके प्रश्न का दोबारा कहना, या diff पहले से जो दिखाता है उसका recap नहीं
- **Content के लिए सही format** — lists के लिए bullets, reasoning के लिए prose (tradeoffs, causation, rationale)। कुछ भी force नहीं
- **Tighter expression** — same point, कम words। Clearer prose shorter prose है

Hard limit: कभी भी content drop नहीं करना, verification skip नहीं करना, या nuance को एक sentence में collapse नहीं करना। Substance पूरी रहती है; केवल wrapper सिकुड़ता है।

एक बार install करें, everywhere apply।

---

## 🔄 Feature 2: /s-continue — Context Restoration

**`/compact` को replace करता है। Zero LLM calls। Zero token cost। Zero information loss।**

`/compact` आपका पूरा context (~1M tokens) को LLM को भेजता है इसे 3.3% summary में compress करने के लिए। अगर cache expire हो गया है, तो यह अकेले full re-cache trigger करता है। Information loss inevitable है।

`/s-continue` बिल्कुल अलग approach लेता है। यह पिछले session transcript को preprocess करता है और directly load करता है। कोई LLM call नहीं। कोई cost नहीं। Original conversation as-is restore होती है।

|                         | /compact                                    | /s-continue                                   |
| ----------------------- | ------------------------------------------- | ------------------------------------------- |
| कैसे काम करता है        | Summary के लिए full context LLM को भेजता है | Transcript preprocess करता है, directly पढ़ता है |
| LLM calls               | Required (typically 100K+ tokens)           | 0                                           |
| Token cost              | High                                        | 0                                           |
| Information loss        | Yes (3.3% summary)                          | None (original preserved)                   |
| Processing speed        | Tens of seconds                             | < 1 sec (even 60MB+ files)                  |
| जब cache expire हो      | Full re-cache cost ऊपर से                   | No impact                                   |
| Multi-session restore   | Not possible                                | Supported                                   |

Usage: `/clear` फिर `/s-continue`। पिछले sessions की list दिखेगी। Restore करने के लिए एक चुनें। Quick recovery के लिए: `/s-continue last`।

**परिणाम:** Zero cost पर पिछला काम resume करें। कोई information loss नहीं। 60MB+ transcripts को 1 second से कम में process करता है।

---
### 🤝 इसका जोड़ीदार: `/s-compact` — hidden layer की handoff

`/s-continue` transcript को restore करता है — जो आपने और Claude ने कहा। लेकिन एक working session की सबसे उपयोगी जानकारी अक्सर उस बातचीत के बाहर होती है: एक sub-agent ने क्या पाया (उसका transcript एक अलग file है जिसे restore कभी लोड नहीं करता), tool output में एक निर्णायक संख्या (test count, benchmark), या process से सीखा गया एक सबक ("headless reproduce नहीं हुआ ← वजह build थी, code नहीं")।

session के अंत में `/s-compact` चलाएं और यह ठीक उसी hidden layer को एक handoff में distill करके `~/.claude/super-token-saver-data/<project>/handoff.md` में save कर देता है। अगले session में, `/s-continue` restore किए गए transcript के ऊपर इसे अपने आप लोड कर लेता है — कुछ paste करने की जरूरत नहीं।

|                     | सिर्फ `/s-continue`             | `/s-compact` + `/s-continue` (जोड़ी)            |
| Recover करता है      | Transcript (जो कहा गया)          | Transcript और hidden layer दोनों                 |
| Sub-agent findings   | खो जाती हैं (अलग files)          | Handoff में distill होती हैं                      |
| Tool-output संख्याएं | सिर्फ अगर chat में quote की गईं  | जानबूझकर extract की जाती हैं                      |
| Process के सबक       | —                                | Capture होते हैं ताकि dead ends दोबारा न चलें     |

Workflow: session को `/s-compact` से खत्म करें → अगला session `/s-continue` से शुरू करें।

### 🔀 दो tools, एक history — Codex sessions भी यहीं से restore होते हैं

Codex अपने sessions `~/.codex/sessions/` में लिखता है; Claude Code `~/.claude/projects/` में। कोई भी tool दूसरे की files नहीं पढ़ता। इसलिए Codex में budget खत्म होने पर रुका हुआ sprint पहले Claude Code से पहुंच से बाहर होता था, और उल्टा भी।

`/s-continue` अब दोनों को list और restore करता है। Codex के rollout को किसी दूसरे parser को नहीं सौंपा जाता — बल्कि उसे उसी shape में फिर से लिखा जाता है जिसमें Claude Code लिखता है, **हर input line के बदले एक output line**, ताकि वही pipeline दोनों को serve करे और हर `L{n}` marker अब भी original Codex file की exact line की ओर इशारा करे। मापा गया: 12 MB का, 1,540-line rollout **0.13 s** में preprocess होता है।

|                        | Claude Code session | Codex session |
| ---------------------- | -------------------- | ------------- |
| `/s-continue` में listed | हां | हां, current project तक सीमित |
| zero LLM cost पर restore | हां | हां |
| original में `L{n}` seek | हां | हां — line numbers rollout के अपने हैं |
| Context-loss (`#0`) restore | `/compact`, auto-compact | Codex की अपनी compaction और thread rollback |
| `/s-compact` handoff | हर project के लिए shared — एक tool में लिखें, दूसरे में लोड करें |

```
/s-continue codex                    सिर्फ Codex sessions
/s-continue codex : rust migration   किसी topic से मेल खाते turns, पूरे तरीके से restored
```

दो details ही सही list और सही-दिखने-वाली-पर-गलत list के बीच फर्क बनाते हैं: Codex का `session_id` असल में **thread** id है, जिसे spawn किया गया कोई sub-agent inherit करता है, इसलिए sessions को `payload.id` पर key किया जाता है और sub-agent rollouts को उसी तरह filter किया जाता है जैसे Claude Code के subtask transcripts पहले से किए जाते हैं। और `<codex_internal_context source="goal">` machine-injected होता है, इसलिए यह restored context में तो रहता है पर कभी भी आपके टाइप किए turn के रूप में count नहीं होता।

यह plugin Codex में भी install होता है — देखें **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md))। `usage-view`, `report-limit` और `setup-statusline` फिलहाल सिर्फ Claude Code तक सीमित हैं।

---

## 📊 Feature 3: Live Status Line

**Real-time token/cost monitoring। 50ms से कम overhead।**

एक बार `/setup-statusline install` run करें और Claude Code के नीचे एक persistent status bar appear होती है।

**Normal operation** — हर metric एक नज़र में, zero context switching:

![Status line in normal state](docs/images/statusline-normal.png)

**Rate limit hit** — 102% पर 5H लाल हो जाती है, countdown exactly बताता है कब आप वापस होंगे, और एक one-tap `/report-limit` action automatically surface होती है:

![Status line when rate limited](docs/images/statusline-rate-limited.png)

| Indicator        | क्या दिखाता है                            | 🟢 Normal | 🟡 Warning | 🔴 Critical |
| ---------------- | ----------------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | आखिरी API call की cost                    | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | इस folder की cumulative cost              | —         | —          | —           |
| 5H               | 5-hour window usage + reset countdown     | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context window usage                      | < 35%     | >= 35%     | >= 70%      |

जब कोई भी indicator warning या critical पर हिट करे, `→ /usage-view current` hint automatically appear होता है।

हटाने के लिए: `/setup-statusline uninstall` (previous config auto-restored)।

**परिणाम:** हर cost problem real time में visible। 50ms से कम overhead — कोई perceptible delay नहीं।

> **API pay-per-use पर हैं?** 5H और W indicators auto-hide — आपके पास rate limit windows नहीं हैं। जो रहता है वह important है: RUN (real-time cost per turn) और CTX (context size)। आपका बिल control करने वाले दो levers, हमेशा visible।

---

## 📈 Usage Dashboard (/usage-view)

**आखिरकार जवाब दें: "वो सारा पैसा कहाँ गया?"**

Max Plan users rate limit पर hit होते हैं और wonder करते हैं क्यों। API users Anthropic invoice खोलते हैं और wonder करते हैं कैसे। किसी भी तरह, question same है: किस session ने सबसे ज़्यादा tokens जलाए? Costs कब spike हुईं? आपके usage में क्या patterns हैं? अब तक — सब invisible।

`/usage-view` सब कुछ दिखाता है। आपके browser में एक interactive HTML dashboard खुलती है, जिससे आप usage patterns analyze कर सकते हैं और cost spikes की root cause trace कर सकते हैं। कोई external dependencies नहीं। Standalone काम करता है। File के रूप में shareable।

**31 दिनों में $4,196। कहाँ गया सब?** एक नज़र — total cost, type-wise token breakdown, cache efficiency ratio, और session count। Donut chart instantly दिखाता है कि आपके spend का 65% cache reads है (जो normal और healthy है):

![Usage dashboard overview](docs/images/usage-view-overview.png)

**पहले बनाम बाद — measured, not guessed।** Orange dashed "Plugin installed" marker आपकी cost timeline को दो में split करता है। Daily bars token type (Input/Output/Cache Write/Cache Read) से stacked हैं ताकि आप exactly देख सकें कि install के बाद कौन सा component बदला। Average line trend दिखाती है:

![Daily cost trend](docs/images/usage-view-daily-trend.png)

**आप सबसे ज़्यादा कब burn करते हैं?** Time of day और day-of-week breakdown से hourly cost। Active-day average, all-day average, या max के बीच toggle करें। Fire icons आपके सबसे महंगे घंटे mark करते हैं — visible patterns (late-night binges, Wednesday spikes) instantly सामने आते हैं:

![Hourly and day-of-week cost pattern](docs/images/usage-view-hourly-pattern.png)

**क्या आप ज़्यादा efficient हो रहे हैं?** Total/Output ratio मापता है कि प्रति output token कितने tokens consume होते हैं। कम बेहतर है। "Plugin installed" marker आपको पहले बनाम बाद compare करने देता है। Spikes = cache misses या session restarts:

![Efficiency trend](docs/images/usage-view-efficiency.png)

**हर API call, context size और cost से plotted।** यह वह chart है जो cost structure को clear करती है। हर dot एक API call है। Red = Opus, blue = Sonnet, green = Haiku। Dashed lines theoretical pricing हैं — अगर आपके dots line से ऊपर हैं, आप overpaying कर रहे हैं। **User Turn** view पर toggle करें per API call की बजाय per conversation turn cost देखने के लिए।
किसी भी dot पर hover करें actual prompt text, token count, और full cost breakdown (Input/Output/Cache Write/Cache Read) देखने के लिए:

![Cost by Context Size — scatter chart](docs/images/usage-view-cost-scatter.png)

**आपके contexts कितने बड़े हैं?** अधिकांश calls 250K से नीचे cluster होती हैं। 350K से ऊपर का long tail वहाँ है जहाँ costs explode होती हैं — यह chart exactly दिखाता है आप कितनी बार danger zone में हैं:

![Context Size Distribution](docs/images/usage-view-context-dist.png)

**आपका coding schedule, घंटे से priced।** 30 दिनों में 5-hour window heatmap। Green (<$15/h), orange ($15-30/h), red ($30+/h)। Skull icon (💀) उन windows को mark करता है जहाँ आप rate limit hit करते हैं। ऊपर cost slider सस्ती windows को filter करता है ताकि महंगी pop हों — drag करें अपने worst days instantly find करने के लिए। 5-hour window और 1-hour block views के बीच toggle:

![Hourly usage calendar heatmap](docs/images/usage-view-calendar.png)

**उस window के sessions में drill करने के लिए किसी भी cell पर click करें।** उस time slot में हर session, cost, message count, token breakdown, और हर conversation के actual first/last messages के साथ। "Top Token Conversations" expand करें यह देखने के लिए कि कौन से specific exchanges ने सबसे ज़्यादा जलाया — हर entry prompt text, cost alert tags, और optimization hints दिखाती है:

![Session detail panel](docs/images/usage-view-session-drilldown.png)

**AI-powered analysis (optional)।** जब आप `/usage-view` `--no-ai` के बिना run करते हैं, तो एक AI analyst आपके पूरे dashboard data को पढ़ता है — API pricing reference baked in — और एक written report produce करता है: cost drivers, anomalies, optimization recommendations। आपकी OS language में automatically display (23 languages, RTL included; charts/tables always stay LTR):

**पैसा कहाँ गया** — total spend, token type से cost drivers, weekly trend, और real numbers में plugin impact:

![AI analysis — cost breakdown](docs/images/usage-view-ai-report-1.png)

**कब और कैसे आप काम करते हैं** — peak hours, busiest days, API call distribution, और rate limit patterns जो optimization opportunities reveal करते हैं:

![AI analysis — work patterns](docs/images/usage-view-ai-report-2.png)

**इसके बारे में क्या करें** — concrete, data-backed recommendations आपके actual usage के अनुरूप। Model switching, context management, session strategy:

![AI analysis — recommendations](docs/images/usage-view-ai-report-3.png)

**Share करें।** पूरा dashboard एक single self-contained HTML file है — सभी data embedded, कोई server नहीं चाहिए। अपनी team, manager, या accountant को भेजें। कोई external dependencies नहीं। Offline काम करता है। Share करने से पहले सभी prompt text strip करने के लिए `private` mode use करें — cost analytics intact रहती है जबकि conversation content remove हो जाती है।

```
/usage-view                  # All time, all projects
/usage-view current          # Current 5-hour window only
/usage-view last 7 days      # Last 7 days
/usage-view locale ja        # Japanese
/usage-view --no-ai          # Skip AI analysis (faster)
/usage-view private          # Strip prompt text (safe to share)
```

---

## 🔬 Rate Limit Research (/report-limit)

**Rate limit formula को reverse-engineer करने का community-driven project।**

Anthropic 5-hour window का exact formula publish नहीं करता। आइए मिलकर पता लगाएं।

जब आप rate limit hit करें, `/report-limit` run करें। आपका current usage data automatically GitHub Discussion के रूप में submit हो जाता है। जितना ज़्यादा data हम collect करेंगे, formula उतना ज़्यादा clear होगा।

---

## ✂️ Feature 4: /setup-git-lite — CC के Built-in Git Instructions Trim करें

**हमने Claude Code का source code पढ़ा। हमें 2,200 hidden tokens मिले जो हर session में inject होते हैं जिनके लिए आप चुपचाप pay कर रहे हैं।**

### खोज

2026-04-12 को, एक [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) ने reveal किया कि Claude Code का built-in `includeGitInstructions` setting हर session में चुपचाप tokens जलाता है। [इस gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) के माध्यम से independent reproduction ने numbers confirm किए: प्रत्येक git commit के बाद **session में +6,031 tokens cache writes में**, हर API call पर **+1,690 tokens cache reads में**।

### CC source analysis — tokens कहाँ जाते हैं

हमने Claude Code source (v2.1.88) में दो independent injection points पर tokens trace किए:

**1. `gitStatus` snapshot (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` branch + main branch + user.name + full status (up to 2000 chars) + **recent 5 commits** collect करता है
- `appendSystemContext` (`utils/api.ts:437`) के माध्यम से system prompt में join और append
- हर new commit, हर new modified file, हर branch switch text बदलता है → prefix cache invalidation

**2. Commit/PR workflow instructions (~1,700 tok) — Bash tool description**
- `tools/BashTool/prompt.ts:53` `Bash` tool के description में 60+ lines safety protocol, step-by-step commit procedure, HEREDOC examples, और PR creation templates append करता है
- System prompt के साथ cached, लेकिन `tools[]` parameter के रूप में shipped

### यह महंगा क्यों है

Cache structure (`utils/api.ts:321` `splitSysPromptPrefix`) में active MCP tools हैं या नहीं इस पर based तीन paths हैं:

- **Path A** (MCP active — most users): `gitStatus` एक `cacheScope: 'org'` block के अंदर है। कोई भी change → अगले session start पर पूरा block re-cached → 6K tok `cache_create` miss।
- **Path B** (no MCP): `gitStatus` एक `cacheScope: null` dynamic block में जाता है, जिसका मतलब है हर API call पर fresh `input_tokens` के रूप में re-sent — कोई cache miss नहीं, लेकिन कोई cache savings भी नहीं।
- **Path C** (3P provider / experimental betas disabled): Path A जैसा।

Typical interactive sessions में, commit/PR instructions (1.7K tok) **हर API call** पर `cache_read` के माध्यम से accumulate होते हैं। Opus 4.7 pricing पर 100-call session में, यह roughly **$0.08 per session** केवल उन instructions के लिए जो Claude की training already mostly cover करती है।

### super-token-saver इसे कैसे handle करता है

`/setup-git-lite` native path disable करता है और SessionStart hook के माध्यम से **curated 280-token replacement** inject करता है। हमने exactly वो रखा जो Claude के default behavior को override करता है (safety rules), और वो सब drop किया जो Claude training से already जानता है (step-by-step workflows, PR templates, gh usage patterns)।

**Retained — 11 critical override rules** (वो जो Claude की default helpfulness को caution में flip करते हैं):
- Explicit user request के बिना कभी commit/push/amend/PR/tag/merge नहीं
- Hooks skip नहीं करना, main/master पर force-push नहीं, destructive ops नहीं, git config modify नहीं
- `.env`, `credentials`, `*.pem`, `secret.*` matching files commit नहीं
- `git add -A` / `git add .` से बचें
- Multi-line commit messages के लिए HEREDOC + `Co-Authored-By: Claude` trailer
- Interactive flags (-i) use नहीं, empty commits नहीं
- अगर pre-commit hook fail हो → NEW commit create करें (not `--amend`)

**Dropped** — step-by-step commit workflow (3 steps), step-by-step PR workflow (3 steps), PR title/body template, `gh` command references, `-uall` flag warning, `--no-edit` with rebase warning, `NEVER use TodoWrite or Agent tools during commit` constraint। यह workflow verbosity है जो Claude training alone से correctly compose करता है।

**Added** — compact git state line: branch + HEAD short-sha + subject + current status (up to 20 modified files, else a count)। Recent commits list नहीं (Claude demand पर `git log` run कर सकता है)।

### Expected savings (Opus 4.7 pricing, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| Item | Original | With setup-git-lite | Saved |
| ---- | -------- | ------------------- | ----- |
| System prompt load (per new session) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| Repeat calls in same session | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100-call session (Opus 4.7) | — | — | **~$0.11 saved** |
| 20 sessions/day × 22 workdays | — | — | **~$48 saved/month** |

### Usage

```bash
/setup-git-lite status     # Read-only diagnostic — current state + what would change
/setup-git-lite install    # Disable CC native + enable our minimal hook
/setup-git-lite revert     # Restore default (aggressive; see below)
/setup-git-lite dismiss-banner    # Silence the occasional recommendation tip
/setup-git-lite undismiss-banner  # Re-enable the tip
/setup-git-lite help       # Full usage
```

### Install semantics

`install` robustness के लिए **दो** जगह modify करता है:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` add करता है
2. Shell profile (`~/.zshrc`, `~/.bashrc`, etc.) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` export करने वाला marker block append करता है

अकेले कोई भी CC native disable करने के लिए पर्याप्त है; हम दोनों set करते हैं ताकि environment override accidentally native behavior को re-enable न करे। Shell change नए shells में ही लागू होता है।

### Revert semantics — aggressive

`revert` **आपके shell profile से सभी `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` exports remove करता है**, including वो जो आपने इस skill को install करने से पहले manually add किए हों। यह intentional है — आपने `revert` run किया, इसलिए हम clean default restore करते हैं। हम हमेशा पहले shell profile का timestamped backup create करते हैं।

अगर आपको unrelated reasons के लिए env var चाहिए, `revert` run करने से पहले note कर लें और बाद में re-add करें।

### super-token-saver uninstall करने से पहले

**पहले `/setup-git-lite revert` run करें**, वरना आपके पास settings.json में `includeGitInstructions: false` रहेगा लेकिन कोई replacement hook नहीं (Claude को कोई git guidance नहीं मिलेगी)। Claude Code में currently कोई plugin uninstall lifecycle hook नहीं है, इसलिए हम इसे automate नहीं कर सकते।

### Trade-offs

आप क्या खोते हैं (और यह usually ठीक क्यों है):
- Claude को session start पर pre-computed `git status` / `git log -n 5` नहीं मिलता। अगर आप नए session में "क्या बदला?" पूछें, तो Claude वो commands खुद run करेगा (एक extra tool call, ~300 tok)।
- Claude CC की canonical 3-step commit procedure नहीं देखता। सैकड़ों commit flows पर हमारी testing में, training-level knowledge critical cases (HEREDOC formatting, no `--amend`, no force-push) handle करती है क्योंकि हम उन्हें explicit rules के रूप में रखते हैं।
- PR body template (`## Summary` + `## Test plan`) inject नहीं होता। अगर आप exactly उस format की परवाह करते हैं, तो इसे अपने project के CLAUDE.md में रखें।

### Recommendation banner

जब CC native git instructions आपकी machine पर अभी भी active हैं, super-token-saver session start पर **~20% of the time** एक one-paragraph tip दिखाता है (plus `/usage-view` और `/report-limit` outputs में)। `/setup-git-lite dismiss-banner` से permanently dismiss करें।

---

## 🛡️ Feature 5: Token Guardian

**जिस पल कैश एक्सपायरी आपको महंगी पड़ती है, आपको बता देता है। अगर आप कहें तो $9 री-सेंड को ब्लॉक भी कर सकता है।**

Claude Code के prompt cache का TTL 1 घंटा है। एक घंटे से ज़्यादा दूर जाएं और कैश expire हो जाता है। आपका अगला message पूरा कॉन्टेक्स्ट पूरी कीमत पर री-सेंड करता है। 900K tokens पर, यह एक बार में $9 है।

Token Guardian याद रखता है कि आखिरी reply कब आया। अगर 3,590 सेकंड से ज़्यादा बीत गए (TTL minus 10-second buffer), तो यह step in कर सकता है। **यह डिफ़ॉल्ट रूप से off है, Remote Control की वजह से।** hook का block message locally एक system message के रूप में render होता है जो remote client को कभी नहीं मिलता, तो एक remote user को prompt बिना किसी explanation के गायब होता दिखा। यह तय करने के बजाय कि आप कहां बैठे हैं उसके हिसाब से अलग व्यवहार करने वाला guard भेजें, हमने इसे off कर दिया। जब Remote Control hook messages forward करना शुरू करेगा, तो default वापस on हो जाएगा। तब तक, इसे दो modes में से किसी एक से खुद on करें।

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude अपनी पहली line में expiry का ज़िक्र करता है
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt एक बार नीचे वाले message के साथ refuse होता है
```

`warn` में prompt through हो जाता है, और Claude अपने reply की शुरुआत एक line से करता है जो बताती है कि cache expire हो चुका था, यह turn पूरे context के re-send के रूप में bill हुआ, और एक घंटे या उससे ज़्यादा के break के बाद `/clear` → `/s-continue` सस्ता रास्ता है। यह remote client तक पहुंचती है, क्योंकि Claude का reply forward होता है भले ही hook messages न हों।

`block` में prompt एक बार नीचे वाले message के साथ refuse होता है। दोबारा भेजें और वह through हो जाएगा। इसे local terminal में इस्तेमाल करें जब आपको hard stop चाहिए।

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Block message आपके OS locale के आधार पर 23 भाषाओं में दिखता है, और हर idle period में सिर्फ एक बार fire होता है।

**Background agents कभी block नहीं होते।** सिर्फ वही prompts जो इंसान खुद type करता है, check पाते हैं। Background agents और tasks की completion reports -- जो अब अक्सर launch होने के एक घंटे से ज़्यादा बाद आती हैं -- सीधे pass हो जाती हैं। किसी long-running agent का result कभी रुकता या खोता नहीं है।

**परिणाम:** warn mode में Token Guardian आपको हमेशा बताता है कि $9 री-सेंड कब हुआ, और क्यों। block mode में यह होता ही नहीं: हर cache expiry पकड़ी = $9 बचाए, और दिन में एक बार पकड़ने पर यह $270/माह शुद्ध बर्बादी खत्म।

> **अगर आप API pay-per-use पर हैं, यह ज़्यादा असर करता है।** Max Plan subscribers $200 buffer के अंदर $9 खोते हैं। आप $9 असली पैसे खोते हैं — चुपचाप, बार-बार, हर बार जब आप दूर जाते हैं। Block mode इसे हर बार रोकता है।

---

## 💡 Cache वास्तव में कैसे काम करता है (और क्यों अधिकांश users 40%+ waste करते हैं)

Claude Code हर API call पर model को पूरा conversation history भेजता है। "API call" का मतलब "आपका टाइप किया हुआ एक message" नहीं है। एक single prompt internal tool calls trigger करता है — Grep, Read, Edit, Write — और हर एक एक separate API call है। एक prompt easily 10+ API calls cause कर सकता है।

Prompt cache इस cost को 90% reduce करता है। लेकिन cache का एक lifespan है।

|                     | Main Session                               | SubTask                                    |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| Cache TTL           | 1 घंटा (ephemeral_1h)                      | 5 मिनट                                     |
| Cache write         | ＄10/MTok                                   | ＄6.25/MTok                                 |
| Cache read          | ＄0.50/MTok                                 | ＄0.50/MTok                                 |
| Cache expire होने पर | Full context full price पर re-sent         | Low impact (context छोटा है)               |

Cache alive होने पर भी, costs accumulate होती हैं। अंतर दिखाने के लिए एक extreme scenario।

### Scenario: Full-day coding (3h सुबह → 2h lunch/meeting → 3h दोपहर)

Conditions: Opus 4 pricing, 1 prompt per minute, ~5 API calls per prompt (~300 calls/hour)।

#### ❌ super-token-saver के बिना

अधिकांश काम Main session में होता है। Context तेज़ी से बढ़ता है।

| Phase       | Situation                         | Context size               | Cost                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| सुबह 3h     | Coding (mostly in Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0.50/M = ＄157.50  |
| Lunch/mtg   | 2 घंटे दूर                        | —                          | —                                      |
| वापसी       | Cache expired → full re-send      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| वापसी       | /compact (summarize)              | 600K → sent to LLM        | 600K × ＄0.50/M + summary output = ~＄1.50 |
| दोपहर 3h    | Coding continues (context regrows) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0.50/M = ＄157.50  |
|             | Total                             |                            | ~＄326                                  |

> इस usage level पर, आप likely 5-hour window rate limit hit करेंगे। **Cost बुरी है, लेकिन असली समस्या यह है कि आपका काम completely रुक जाता है। यह exactly वो moment है जब Claude Code dark हो जाता है।**

#### ✅ super-token-saver के साथ

भारी काम SubTasks को delegate। Main केवल design/decisions handle करता है।

| Phase       | Situation                                    | Context size                | Cost                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| सुबह 3h     | Coding (Main: design, SubTask: implementation) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
| Lunch/mtg   | 2 घंटे दूर                                   | —                           | —                                  |
| वापसी       | ⚡ Token Guardian (block mode) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| दोपहर 3h    | Coding continues                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 परिणाम

> **＄326 → ＄180। प्रति दिन ＄146 बचाए। 45% cost reduction।**
>
> **Max Plan:** कम tokens = आप rate limit नहीं hit करते। आपका काम नहीं रुकता। यही असली फर्क है।
>
> **API pay-per-use:** ＄146/day × 22 workdays = **＄3,200/माह सीधे आपके invoice से।** इस plugin के बिना भारी महीना ＄7,000 cross करता है। इसके साथ, ＄4,000 से कम। Same output।

### super-token-saver कहाँ step in करता है

```
[Session Start]
    │
    ├─ Session Architect → SubTask delegation pattern auto-inject करता है
    │                       Main context 250K से नीचे रखता है
    │
[Working]
    │
    ├─ Status Line → Real-time cost/context/rate limit monitoring
    │                  Warning zone में enter करने पर instant alert
    │
[1+ hour idle]
    │
    ├─ Token Guardian → Cache expiry detect करता है, warn करता है (या block mode में blocks)
    │
[Session restart]
    │
    └─ /s-continue → Zero cost पर previous context restore (no LLM calls)
```

---

## 🔧 Source Install & Customization

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver fully open-source है (Apache-2.0)। Plain JavaScript + Bash — कोई compiled binaries नहीं, कोई external API calls नहीं, कोई telemetry नहीं। हर line auditable है। इस README में हर claim एक specific file से map करती है जो आप पढ़ सकते हैं।

- **hooks/** — Cache expiry threshold change करें, warning messages customize करें, session architecture rules modify करें
- **scripts/** — Analysis logic, report builder, status line formatting
- **skills/** — /s-continue और /usage-view कैसे काम करते हैं, prompt templates
- **locales/** — Translations add/edit करें, नई languages add करें
- **skills/usage-view/** — Dashboard UI/UX design changes

इसे अपना बनाएं। Fork करें, experiment करें, और अगर आप कुछ बेहतर खोजें तो PR भेजें।

---

## 🌐 Supported Languages

23 languages supported। Claude Code usage के top 20 countries और global speaker count के top 20 languages को cross-reference करके select किए। Display language आपके OS locale से auto-detect होती है। आप manually भी specify कर सकते हैं: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Current translations AI-generated हैं। Native speaker contributions welcome हैं — `locales/` में अपनी language के लिए JSON file edit करें और PR submit करें।

---

## ⚖️ यह Plugin आपको क्या खर्च करता है

Plugin session start पर context inject करता है। यहाँ exactly कितना:

| Injection | कब | Tokens | Purpose |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (once) | ~1,100 | SubTask delegation strategy + concise mode rules |
| Git context (if git-lite enabled) | SessionStart (once) | ~280 | CC के native ~2,200 tok git instructions replace करता है |
| Cache expiry warning | Idle > 59m पर (once) | ~200 | महंगी re-send को flag करता है, सस्ता रास्ता दिखाता है |
| Status line | Every API call | 0 | Terminal status bar में render, conversation context नहीं |

**Session per net overhead: ~1,400 tokens (one-time, first call के बाद cached)।**

Opus pricing ($0.50/MTok cache read) पर, यह **$0.0007 per API call** है — एक cent के दसवें से कम। 100-call session में: $0.07।

अगर git-lite enabled है, plugin session पर ~1,920 tokens **save** करता है (2,200 को 280 से replace करता है)। Net effect negative है — plugin remove करने से कम consume करता है।

**API pay-per-use users के लिए:** $3,000/माह spend पर, plugin overhead $2/माह से कम है। हफ्ते में एक blocked $9 re-send (cache expiry prevention) एक single catch में एक साल के overhead के लिए pay करती है।

---

## 💡 Tips

### Cache समझें और आप देखेंगे पैसा कहाँ जाता है

- **1 prompt ≠ 1 API call।** हर बार जब Claude Grep, Read, या Edit call करता है, पूरा context re-sent होता है। एक single prompt easily 10+ API calls trigger कर सकता है। Unnecessary tool calls कम करने और costs cut करने के लिए clear prompts लिखें।
- **Cache timer आपके last prompt से नहीं, last API call से reset होता है।** काम करते रहें और cache कभी expire नहीं होगी। Danger दूर जाने में है। Token Guardian आपको बताता है कि यह कब हुआ, और `block` mode में prompt को एक बार रोकता है ताकि आप choose कर सकें: context reset करें, या as-is जारी रखें।
- **Context size = cost multiplier।** 200K बनाम 800K पर same API call 4x ज़्यादा cost करती है। जब status line [CTX] 35% cross करे (🟡), यह SubTasks को ज़्यादा delegate करने का signal है।

### Habits जो costs कम करती हैं

- **CLAUDE.md lean रखें।** यह हर API call पर system prompt में load होता है। हर line पैसा खर्च करती है।
- **भारी काम SubTasks को delegate करें।** Code generation, multi-file edits, test runs Main में नहीं होने चाहिए। SubTasks का smaller context और cheaper cache tier है।
- **1+ घंटे के लिए दूर?** `/clear` → वापस आएं → `/s-continue`। Context $0 पर restored।
- **[5H] 70% से ऊपर (🟡)?** Slow down। Lightweight review tasks पर switch करें या Main के API call count कम करने के लिए SubTask delegation बढ़ाएं।
- **Side questions के लिए `/btw` use करें।** यह conversation history में enter नहीं होता, इसलिए आपका context lean रहता है।

### API pay-per-use: सबसे ज़रूरी habits

ऊपर सब apply होता है, plus ये API-specific priorities:

- **[CTX] को speedometer की तरह watch करें।** Rate limit आपको नहीं रोकेगी — लेकिन 500K+ पर context का मतलब है हर API call 2-3x ज़्यादा cost करती है जितनी होनी चाहिए। `/clear` → `/s-continue` free है और आपका cost multiplier baseline पर reset करता है।
- **Weekly `/usage-view` run करें।** Max Plan users का rate limit होने पर naturally "ouch" moment होता है। आपका नहीं — costs silently climb करती हैं। Dashboard आपका early warning system है।
- **Mental daily budget set करें।** Cap के बिना, $200 days notice किए बिना होते हैं। Status line का RUN indicator per-turn cost visible बनाता है। अगर एक single turn $1 cross करे (🔴), आपका context too large है।

---

## 📚 Documentation

- [Prompt Cache Guide](guides/prompt-cache-guide.md) — आपकी ज़्यादातर cost cache क्यों है, providers (Anthropic, OpenAI, Gemini) में caching कैसे काम करती है, और इसे कैसे manage करें ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Fable 5.1 vs Opus 5 Cost Analysis](guides/fable-5-1-vs-opus-5-cost-analysis.md) — समान quality पर Opus 5 से कम से कम 24–38% सस्ता, 2,782 sessions पर
- [Fable 5.1 vs Opus 5 Cost Analysis (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Opus 4.7 vs 4.6 Cost Analysis](guides/opus-4-7-vs-4-6-cost-analysis.md) — 8,563 API calls पर side-by-side cost comparison
- [Opus 4.7 vs 4.6 Cost Analysis (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## License

Apache-2.0
