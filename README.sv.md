# super-token-saver

**Det enda Claude Code-tillägget som faktiskt läser CC:s källkod för att hitta var dina tokens tar vägen — och fixar det automatiskt. Spendera mindre, koda längre.**

> Uppmätt resultat: **45% kostnadsminskning** vid en verklig arbetsbelastning på $326/dag → $180/dag. Automatisk SubTask-delegering, kontextåterställning utan kostnad, en fullständig analysinstrumentpanel och ett skydd mot cache-utgång — i en installation, noll konfiguration.

Fungerar med **Max Plan ($200/mån)** och **API betala per användning**. Samma tillägg, samma funktioner. Kraftfullare för varje användare — särskilt när varje token är riktiga pengar.

![Användningsinstrumentpanel — se exakt var dina tokens tar vägen](docs/images/usage-view-overview.png)

### Vad det gör på 30 sekunder

| Funktion | Vad händer | Inverkan |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delegerar tungt arbete automatiskt till SubTasks (37,5% billigare cache) | Kontext förblir liten, kostnader sjunker |
| 🪶 Concise Mode | Tar bort svada i svar, behåller substansen | Färre utdatatokens per svar |
| 🔄 /s-continue | Ersätter /compact — noll LLM-anrop, noll kostnad, noll informationsförlust, och återställer numera även **Codex**-sessioner | Gratis kontextåterställning för båda verktygen |
| 🤝 /s-compact | Skriver en sessionsöverlämning som /s-continue laddar automatiskt — fångar subagent-fynd & verktygsresultat som transkriptet förlorar | Nästa session återupptar även med den dolda kontexten |
| 📊 Status Line | Realtidskostnad, kontextstorlek, hastighetsgräns — under 50ms | Se problem innan de kostar dig pengar |
| 📈 /usage-view | Interaktiv HTML-instrumentpanel med AI-analys | Fullständig kostnadsutredning med ett klick |
| ✂️ /setup-git-lite | Tar bort 2 200 dolda tokens som CC injicerar varje session | ~$48/mån sparad bara på git-instruktioner |
| 🛡️ Token Guardian | Varnar dig i samma ögonblick som en cache-utgång skickar om din kontext, eller blockerar den i `block`-läge | Inga fler tysta $9-överraskningar |

---

## 😤 Problemet

**Osynliga kostnader.** Ingen synlighet i realtid. Ingen varning att "din kontext är vid 800K". Ingen avisering om att "cachen gick ut för 3 minuter sedan". Du får reda på det efter att skadan är skedd.

**Kontextuppblåsning.** Samma prompt vid 200K kontra 800K kontext kostar 4x mer. Varje Read, Grep, Edit skickar om hela kontexten. En komplex prompt utlöser 15+ API-anrop, vart och ett multiplicerat med din kontextstorlek.

**Cache-utgång.** Du kommer tillbaka från lunchen. Cachen är borta. En prompt skickar om 900K tokens till fullt pris. $9 på ett bräde.

**Allt manuellt.** Kontexthantering, tidpunkter för cache-utgång, SubTask-delegering, sessionsrensning. Ingen kan hålla koll på allt detta medan de faktiskt kodar.

**Max Plan ($200/mån)?** Allt ovanstående, plus en 5-timmarsgräns som dödar ditt flöde utan timer och utan beräknad tid.

**API betala per användning?** Allt ovanstående, förutom att det inte finns något tak. En cache-miss = $9 riktiga pengar. Tio gånger i veckan = $360/mån bara på misstag. En dålig tisdag med uppblåst kontext kan kosta mer än vad en Max Plan-prenumerant betalar under en månad.

super-token-saver hanterar allt detta automatiskt. **Installera en gång. Klart.**

---

## 🚀 Installation

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Fungerar automatiskt efter installation. Noll konfiguration. Kräver [Claude Code](https://claude.ai/claude-code) v2.1.71+.

För live-övervakning:

```
/setup-statusline install
```

För att ta bort 2 200 dolda tokens från CC:s inbyggda git-instruktioner ([detaljer](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Funktion 1: Smart sessionsarkitektur

**Installera det och kostnadsoptimerade arbetsmönster startar automatiskt.**

De flesta användare gör allt i Main-sessionen. Filläsning, kodgenerering, testkörningar. Varje utdata staplas i kontexten och skickas om med varje meddelande. Sessionen sväller. Kostnaderna snöar ihop.

Session Architect injicerar automatiskt en delegeringsstrategi vid sessionens start.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Roll             | Design, beslut, granskning        | Implementering, kodgenerering, multi-fil |
| Cache-lager      | 1 timme (ephemeral_1h)            | 5 min                                 |
| Cache-skrivkostnad | ＄10/MTok                        | ＄6.25/MTok                            |
| Kontextstorlek   | ~94K i genomsnitt                 | ~33K i genomsnitt                     |

SubTasks har **37,5% billigare cache-skrivningar** än Main. Kontexten är också mycket mindre. Att delegera tungt arbete till SubTasks sänker kostnaderna dramatiskt.

**Resultat:** Kontext förblir under 250K istället för att växa till 600K+. Samma arbetsresultat, hälften av tokenkostnaden. Helt automatiskt.

---

## 🪶 Concise Mode

**Samma innehåll. Mindre fyllnad. Aktivt som standard.**

SessionStart-hooken injicerar också en regeluppsättning för svarsstil som körs i **varje session och varje modell** — inga flaggor, ingen inställning. Tre saker förändras:

- **Ingen inledning** — inget "Låt mig kolla…", "Nu ska jag…", upprepning av din fråga eller sammanfattning av vad diff:en redan visar
- **Rätt format för innehållet** — punktlistor för listor, prosa för resonemang (avvägningar, kausalitet, motivering). Inget av dem tvingas fram
- **Tightare uttryckssätt** — samma poäng, färre ord. Klarare prosa är kortare prosa

Hårt gräns: aldrig hoppa över innehåll, utelämna verifiering eller komprimera nyanser till en enda mening. Substansen förblir fullständig; bara omslaget krymper.

Installera en gång, tillämpas överallt.

---

## 🔄 Funktion 2: /s-continue — Kontextåterställning

**Ersätter `/compact`. Noll LLM-anrop. Noll tokenkostnad. Noll informationsförlust.**

`/compact` skickar hela din kontext (~1M tokens) till LLM för att komprimera den till en 3,3%-sammanfattning. Om cachen har gått ut utlöser det ensamt en full åter-cachning. Informationsförlust är oundviklig.

`/s-continue` tar ett helt annat angreppssätt. Det förbehandlar det föregående sessiontranskriptet och laddar det direkt. Inget LLM-anrop. Ingen kostnad. Det ursprungliga samtalet återställs i befintligt skick.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Hur det fungerar        | Skickar full kontext till LLM för sammanfattning | Förbehandlar transkript, läser direkt |
| LLM-anrop               | Obligatoriskt (vanligtvis 100K+ tokens) | 0                           |
| Tokenkostnad            | Hög                               | 0                                |
| Informationsförlust     | Ja (3,3% sammanfattning)          | Ingen (original bevarat)         |
| Bearbetningshastighet   | Tiotals sekunder                  | < 1 sek (även 60MB+ filer)       |
| När cachen gått ut      | Full åter-cachningskostnad ovanpå | Ingen inverkan                   |
| Multi-session-återställning | Inte möjlig                   | Stöds                            |

Användning: `/clear` sedan `/s-continue`. Du ser en lista med tidigare sessioner. Välj en att återställa. För snabb återhämtning: `/s-continue last`.

**Resultat:** Återuppta tidigare arbete utan kostnad. Ingen informationsförlust. Bearbetar 60MB+ transkript på under 1 sekund.

### 🤝 Dess motpart: `/s-compact` — lämna över det dolda lagret

`/s-continue` återställer **transkriptet** — vad du och Claude sa. Men den mest användbara kunskapen
från en arbetssession lever ofta UTANFÖR den dialogen: vad en **subagent** kom fram till (dess
transkript är en separat fil som återställningen aldrig laddar), ett avgörande **tal i
verktygsresultat** (ett antal tester, ett benchmark), en **lärdom från processen** ("gick inte att
återskapa headless → det berodde på bygget, inte koden").

Kör `/s-compact` i **slutet** av en session så destillerar det just det dolda lagret till en
överlämning, sparad i `~/.claude/super-token-saver-data/<project>/handoff.md`. I nästa session
laddar `/s-continue` den **automatiskt** ovanpå det återställda transkriptet — inget klistrande behövs.

|                     | Enbart `/s-continue`            | `/s-compact` + `/s-continue` (paret)            |
| ------------------- | -------------------------------- | ------------------------------------------------ |
| Återställer         | Transkriptet (vad som sades)     | Transkriptet **plus** det dolda lagret            |
| Subagent-fynd       | Förlorade (separata filer)       | Destillerade i överlämningen                       |
| Tal från verktygsresultat | Endast om citerat i chatten | Extraherade avsiktligt                            |
| Lärdomar från processen | —                             | Fångade så återvändsgränder inte körs igen        |

**Arbetsflödet:** avsluta en session med `/s-compact` → starta nästa med `/s-continue`.


### 🔀 Två verktyg, en historik — Codex-sessioner återställs här också

Codex skriver sina sessioner till `~/.codex/sessions/`, Claude Code till `~/.claude/projects/`. Ingetdera läser den andras filer. En sprint som tog slut på budget i Codex gick därför inte att nå från Claude Code — och tvärtom.

`/s-continue` listar och återställer nu båda. En Codex-rollout skickas inte till en andra parser — den skrivs om till exakt det format Claude Code använder, **en utdatarad per indatarad**, så samma pipeline betjänar båda verktygen och varje `L{n}`-markering fortfarande pekar på precis samma rad i den ursprungliga Codex-filen. Uppmätt: en 12 MB, 1,540-line rollout förbehandlas på **0.13 s**.

|                             | Claude Code-session | Codex-session |
| --------------------------- | ---------------------- | --------------- |
| Listas av `/s-continue`    | Ja | Ja, avgränsat till aktuellt projekt |
| Återställs utan LLM-kostnad | Ja | Ja |
| `L{n}`-hopp till originalet | Ja | Ja — radnumren kommer från rollouten själv |
| Återställning efter kontextförlust (`#0`) | `/compact`, auto-compact | Codex-komprimering och trådåterställning |
| `/s-compact`-överlämning | Delad per projekt — skriv i det ena verktyget, ladda i det andra |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Två detaljer avgör skillnaden mellan en korrekt lista och en som bara ser rätt ut: Codex `session_id` är **trådens** id, som ärvs av en startad subagent, så sessioner nyckelas på `payload.id` och subagent-rollouter filtreras bort på samma sätt som Claude Code redan filtrerar sina egna deluppgiftstranskript. Och `<codex_internal_context source="goal">` läggs till av systemet, så den behålls i det återställda sammanhanget men räknas aldrig som ett drag du skrev själv.

Pluginet installeras även i Codex — se **[README-CODEX.md](./README-CODEX.md)**
([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)).
`usage-view`, `report-limit` och `setup-statusline` är tills vidare bara för Claude Code.

---

## 📊 Funktion 3: Live statusrad

**Realtidsövervakning av tokens/kostnad. Under 50ms overhead.**

Kör `/setup-statusline install` en gång och ett permanent statusfält visas längst ner i Claude Code.

**Normal drift** — varje mätvärde i en blick, noll kontextbyte:

![Statusrad i normalt läge](docs/images/statusline-normal.png)

**Hastighetsgräns nådd** — 5H blir rött vid 102%, nedräkning visar exakt när du är tillbaka, och en `/report-limit`-åtgärd med ett tryck visas automatiskt:

![Statusrad vid hastighetsgräns](docs/images/statusline-rate-limited.png)

| Indikator        | Vad den visar                       | 🟢 Normal | 🟡 Varning | 🔴 Kritisk |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Kostnad för det senaste API-anropet | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Ackumulerad kostnad för den här mappen | —      | —          | —           |
| 5H               | 5-timmarsfönstersanvändning + återställningsnedräkning | < 70% | >= 70%   | >= 90%      |
| CTX              | Kontextfönstersanvändning           | < 35%     | >= 35%     | >= 70%      |

När en indikator når varnings- eller kritisk nivå visas en ledtråd `→ /usage-view current` automatiskt.

För att ta bort: `/setup-statusline uninstall` (föregående konfiguration återställs automatiskt).

**Resultat:** Varje kostnadsproblem synligt i realtid. Under 50ms overhead — ingen märkbar fördröjning.

> **Använder du API betala per användning?** Indikatorerna 5H och W döljs automatiskt — du har inga hastighetsgränsfönster. Det som stannar är det som spelar roll: RUN (realtidskostnad per tur) och CTX (kontextstorlek). De två spakarna som styr din nota, alltid synliga.

---

## 📈 Användningsinstrumentpanel (/usage-view)

**Svara äntligen: "Var tog alla de pengarna vägen?"**

Max Plan-användare når hastighetsgränsen och undrar varför. API-användare öppnar Anthropic-fakturan och undrar hur. Hur som helst är frågan densamma: vilken session brände flest tokens? När sköt kostnaderna upp? Vilka mönster finns i din användning? Hittills — allt osynligt.

`/usage-view` visar allt. En interaktiv HTML-instrumentpanel öppnas i din webbläsare och låter dig analysera användningsmönster och spåra grundorsaken till kostnadspikar. Inga externa beroenden. Fungerar fristående. Kan delas som en fil.

**$4 196 på 31 dagar. Var tog allt vägen?** En blick — total kostnad, tokenuppdelning per typ, cache-effektivitetskvot och sessionsantal. Ringdiagrammet visar omedelbart att 65% av dina utgifter är cache-läsningar (vilket är normalt och hälsosamt):

![Översikt av användningsinstrumentpanel](docs/images/usage-view-overview.png)

**Före och efter — mätt, inte gissat.** Den orange streckade markeringen "Plugin installed" delar din kostnadstidslinje i två. Dagliga staplar är staplade per tokentyp (Input/Output/Cache Write/Cache Read) så att du kan se exakt vilken komponent som förändrades efter installationen. Medellinjen visar trenden:

![Daglig kostnadstrend](docs/images/usage-view-daily-trend.png)

**När bränner du mest?** Kostnad per timme efter tid på dagen och dag-i-veckan-uppdelning. Växla mellan aktivdagsgenomsnitt, heldagsgenomsnitt eller max. Eldikoner markerar dina dyraste timmar — synliga mönster (sena nattliga sessioner, onsdagspikar) hoppar fram omedelbart:

![Timkostnadsmönster och dag-i-veckan-mönster](docs/images/usage-view-hourly-pattern.png)

**Blir du mer effektiv?** Förhållandet Total/Output mäter hur många tokens som förbrukas per producerad utdatatoken. Lägre är bättre. Markeringen "Plugin installed" låter dig jämföra före och efter. Pikar = cache-missar eller sessionsomstarter:

![Effektivitetstrend](docs/images/usage-view-efficiency.png)

**Varje API-anrop, utplacerat efter kontextstorlek och kostnad.** Det här är diagrammet som gör kostnadsstrukturen begriplig. Varje punkt är ett API-anrop. Röd = Opus, blå = Sonnet, grön = Haiku. De streckade linjerna är teoretisk prissättning — om dina punkter ligger ovanför linjen betalar du för mycket. Växla till **User Turn**-vyn för att se kostnad per konversationstur istället för per API-anrop.
Hovra över en punkt för att se den faktiska prompttexten, tokenantal och fullständig kostnadsuppdelning (Input/Output/Cache Write/Cache Read):

![Kostnad per kontextstorlek — spridningsdiagram](docs/images/usage-view-cost-scatter.png)

**Hur stora är dina kontexter?** De flesta anrop klustrar under 250K. Den långa svansen över 350K är där kostnaderna exploderar — det här diagrammet visar exakt hur ofta du befinner dig i farozonen:

![Fördelning av kontextstorlek](docs/images/usage-view-context-dist.png)

**Ditt kodningsschema, prisat per timme.** En värmekarta för 5-timmarsfönstret under 30 dagar. Grön (<$15/h), orange ($15-30/h), röd ($30+/h). Skallens ikon (💀) markerar fönster där du nådde hastighetsgränsen. Kostnadsskjutreglaget längst upp filtrerar bort billiga fönster så att dyra poppar fram — dra det för att omedelbart hitta dina värsta dagar. Växla mellan 5-timmarsfönster- och 1-timmesblockvyer:

![Timvärde för användningskalenderns värmekarta](docs/images/usage-view-calendar.png)

**Klicka på en cell för att gå in på det fönstrets sessioner.** Varje session i den tidsslotten, med kostnad, meddelandeantal, tokenuppdelning och de faktiska första/sista meddelandena från varje samtal. Expandera "Top Token Conversations" för att se vilka specifika utbyten som brände mest — varje post visar prompttexten, kostnadsvarningstaggar och optimeringstips:

![Sessionsdetaljpanel](docs/images/usage-view-session-drilldown.png)

**AI-driven analys (valfritt).** När du kör `/usage-view` utan `--no-ai` läser en AI-analytiker alla dina instrumentpanelsdata — med inbyggd API-prisreferens — och producerar en skriftlig rapport: kostnadsdrivare, anomalier, optimeringsrekommendationer. Visas automatiskt på ditt OS-språk (23 språk, RTL inkluderat; diagram/tabeller förblir alltid LTR):

**Vart pengarna tog vägen** — totala utgifter, kostnadsdrivare per tokentyp, veckotrender och insticksprogrammets inverkan mätt i verkliga siffror:

![AI-analys — kostnadsuppdelning](docs/images/usage-view-ai-report-1.png)

**När och hur du arbetar** — topptimmar, de mest hektiska dagarna, API-anropsfördelning och hastighetsgränsmönster som avslöjar optimeringsmöjligheter:

![AI-analys — arbetsmönster](docs/images/usage-view-ai-report-2.png)

**Vad du ska göra åt det** — konkreta, databaserade rekommendationer anpassade till din faktiska användning. Modellbyte, kontexthantering, sessionsstrategi:

![AI-analys — rekommendationer](docs/images/usage-view-ai-report-3.png)

**Dela det.** Hela instrumentpanelen är en enda fristående HTML-fil — alla data inbäddade, ingen server behövs. Skicka det till ditt team, din chef eller din revisor. Inga externa beroenden. Fungerar offline. Använd `private`-läge för att ta bort all prompttext innan delning — bevarar kostnadsanalytiken samtidigt som samtalsinnehållet tas bort.

```
/usage-view                  # All tid, alla projekt
/usage-view current          # Enbart aktuellt 5-timmarsfönster
/usage-view last 7 days      # Senaste 7 dagarna
/usage-view locale ja        # Japanska
/usage-view --no-ai          # Hoppa över AI-analys (snabbare)
/usage-view private          # Ta bort prompttext (säker att dela)
```

---

## 🔬 Forskning om hastighetsgränser (/report-limit)

**Communitydriven undersökning för att bakåtlösa hastighetsgränsformeln.**

Anthropic publicerar inte den exakta formeln för 5-timmarsfönstret. Låt oss ta reda på det tillsammans.

När du når en hastighetsgräns, kör `/report-limit`. Dina aktuella användningsdata skickas automatiskt in som en GitHub Discussion. Ju mer data vi samlar in, desto tydligare blir formeln.

---

## ✂️ Funktion 4: /setup-git-lite — Klipp bort CC:s inbyggda git-instruktioner

**Vi läste Claude Codes källkod. Vi hittade 2 200 dolda tokens som injiceras varje session och som du tyst betalar för.**

### Upptäckten

2026-04-12 avslöjade ett [GitHub-ärende](https://github.com/anthropics/claude-code/issues/47107) att Claude Codes inbyggda `includeGitInstructions`-inställning tyst bränner tokens varje session. Oberoende reproduktion via [det här gist:et (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bekräftade siffrorna: **+6 031 tokens i cache-skrivningar** per session efter varje git-commit, **+1 690 tokens i cache-läsningar** vid varje API-anrop.

### CC källkodsanalys — var tokens tar vägen

Vi spårade tokens till två oberoende injektionspunkter i Claude Codes källkod (v2.1.88):

**1. `gitStatus`-ögonblicksbild (~500 tok) — systemprompt**
- `context.ts:36-111` `getGitStatus()` samlar gren + huvudgren + user.name + fullständig status (upp till 2 000 tecken) + **de senaste 5 commits**
- Sammanfogas och läggs till systemprompt via `appendSystemContext` (`utils/api.ts:437`)
- Varje ny commit, varje ny modifierad fil, varje grenbyte ändrar texten → prefixcacheinvalidering

**2. Commit-/PR-arbetsflödesinstruktioner (~1 700 tok) — Bash-verktygsbeskrivning**
- `tools/BashTool/prompt.ts:53` lägger till 60+ rader säkerhetsprotokoll, steg-för-steg commit-procedur, HEREDOC-exempel och PR-skapningsmallar till `Bash`-verktygets beskrivning
- Cachelagras tillsammans med systemprompten, men skickas som `tools[]`-parameter

### Varför det är dyrt

Cachestrukturen (`utils/api.ts:321` `splitSysPromptPrefix`) har tre sökvägar beroende på om du har aktiva MCP-verktyg:

- **Sökväg A** (MCP aktiv — de flesta användare): `gitStatus` sitter inuti ett `cacheScope: 'org'`-block. Varje ändring → hela blocket åter-cachelagras vid nästa sessionsstart → 6K tok `cache_create`-miss.
- **Sökväg B** (ingen MCP): `gitStatus` går till ett dynamiskt `cacheScope: null`-block, vilket innebär att det återsänds som färska `input_tokens` vid varje API-anrop — ingen cache-miss, men inga cache-besparingar heller.
- **Sökväg C** (tredjepartsleverantör / experimentella betor inaktiverade): samma som sökväg A.

I typiska interaktiva sessioner ackumuleras commit/PR-instruktionerna (1,7K tok) **vid varje API-anrop** via `cache_read`. Under en 100-anropssession vid Opus 4.7-prissättning är det ungefär **$0,08 per session** bara för instruktioner som Claudes träning redan till stor del täcker.

### Hur super-token-saver hanterar det

`/setup-git-lite` inaktiverar den ursprungliga sökvägen och injicerar ett **noggrant sammansatt 280-tokens-substitut** via en SessionStart-hook. Vi behöll exakt de saker som åsidosätter Claudes standardbeteende (säkerhetsregler) och kasserade allt som Claude redan vet från träning (steg-för-steg-arbetsflöden, PR-mallar, gh-användningsmönster).

**Bevarat — 11 kritiska åsidosättningsregler** (de som vänder Claudes standardhjälpsamhet till försiktighet):
- Aldrig commit/push/amend/PR/tag/merge utan explicit användarbegäran
- Aldrig hoppa över hooks, force-pusha till main/master, köra destruktiva åtgärder, modifiera git config
- Aldrig committa filer som matchar `.env`, `credentials`, `*.pem`, `secret.*`
- Undvik `git add -A` / `git add .`
- HEREDOC för flerradiga commit-meddelanden + `Co-Authored-By: Claude`-trailer
- Aldrig använda interaktiva flaggor (-i), inga tomma commits
- Om pre-commit-hook misslyckas → skapa en NY commit (inte `--amend`)

**Kasserat** — steg-för-steg commit-arbetsflöde (3 steg), steg-för-steg PR-arbetsflöde (3 steg), PR-titel/brödtextmall, `gh`-kommandreferenser, `-uall`-flaggvarning, `--no-edit` med rebase-varning, `NEVER use TodoWrite or Agent tools during commit`-begränsning. Det här är arbetsflödesverbositet som Claude sammanställer korrekt från enbart träning.

**Tillagt** — kompakt git-statusrad: gren + HEAD kort-sha + ämne + aktuell status (upp till 20 modifierade filer, annars ett antal). Ingen lista med senaste commits (Claude kan köra `git log` på begäran).

### Förväntade besparingar (Opus 4.7-prissättning, $25/MTok utdata, $5/MTok indata, $0,50/MTok cache-läsning)

| Post | Original | Med setup-git-lite | Sparat |
| ---- | -------- | ------------------- | ----- |
| Systempromptladdning (per ny session) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Upprepade anrop i samma session | ~1 700 tok cache_read/anrop | ~280 tok cache_read/anrop | ~1 420 tok/anrop |
| 100-anropssession (Opus 4.7) | — | — | **~$0,11 sparat** |
| 20 sessioner/dag × 22 arbetsdagar | — | — | **~$48 sparat/mån** |

### Användning

```bash
/setup-git-lite status     # Skrivskyddad diagnostik — aktuellt tillstånd + vad som skulle ändras
/setup-git-lite install    # Inaktivera CC native + aktivera vår minimala hook
/setup-git-lite revert     # Återställ standard (aggressiv; se nedan)
/setup-git-lite dismiss-banner    # Tysta det tillfälliga rekommendationstipset
/setup-git-lite undismiss-banner  # Återaktivera tipset
/setup-git-lite help       # Fullständig användning
```

### Installationssemantik

`install` modifierar **två** ställen för robusthet:

1. `~/.claude/settings.json` — lägger till `"includeGitInstructions": false`
2. Shell-profil (`~/.zshrc`, `~/.bashrc`, osv.) — lägger till ett markeringsblock som exporterar `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Endera är tillräckligt för att inaktivera CC native; vi ställer in båda så att en miljööverskridning inte råkar återaktivera det ursprungliga beteendet. Shell-ändringen träder i kraft i nya skal.

### Återgångssemantik — aggressiv

`revert` **tar bort ALLA `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-exporter från din shell-profil**, inklusive eventuella du kan ha lagt till manuellt innan du installerade den här skickligheten. Det är avsiktligt — du körde `revert`, så vi återställer den rena standarden. Vi skapar alltid en tidsstämplad säkerhetskopia av shell-profilen först.

Om du behöver miljövariabeln av orelaterade skäl, notera den innan du kör `revert` och lägg till den igen efteråt.

### Innan du avinstallerar super-token-saver

**Kör `/setup-git-lite revert` först**, annars lämnas du med `includeGitInstructions: false` i din settings.json men ingen ersättningshook (Claude får inga git-vägledningar alls). Claude Code har för närvarande ingen plugin-avinstallationslivscykelhook, så vi kan inte automatisera detta.

### Avvägningar

Vad du förlorar (och varför det vanligtvis är okej):
- Claude får inte längre en förberäknad `git status` / `git log -n 5` vid sessionstart. Om du frågar "vad har ändrats?" i en ny session kör Claude dessa kommandon själv (ett extra verktygsanrop, ~300 tok).
- Claude ser inte längre CC:s kanoniska 3-stegscommit-procedur. I våra tester över hundratals commit-flöden hanterar träningsnivåkunskap de kritiska fallen (HEREDOC-formatering, inget `--amend`, ingen force-push) eftersom vi behåller dessa som explicita regler.
- PR-brödtextmall (`## Summary` + `## Test plan`) injiceras inte. Om du bryr dig om exakt det formatet, lägg det i ditt projekts CLAUDE.md.

### Rekommendationsbanner

När CC:s inbyggda git-instruktioner fortfarande är aktiva på din maskin visar super-token-saver ett styckestips vid sessionstart **~20% av tiden** (plus i `/usage-view`- och `/report-limit`-utdata). Tysta permanent med `/setup-git-lite dismiss-banner`.

---

## 🛡️ Funktion 5: Token Guardian

**Säger till i samma ögonblick som en cache-utgång kostar dig pengar. Kan blockera $9-återsändningen om du ber om det.**

Promptcachens TTL i Claude Code är 1 timme. Gå bort längre än så och cachen går ut. Ditt nästa meddelande skickar om hela kontexten till fullt pris. Vid 900K tokens är det $9 på en gång.

Token Guardian kommer ihåg när det senaste svaret kom. Om mer än 3 590 sekunder har gått (TTL minus en 10-sekundersbuffert) kan den gripa in. **Den är avstängd som standard, på grund av Remote Control.** Ett hooks blockeringsmeddelande renderas lokalt som ett systemmeddelande som fjärrklienten aldrig tar emot, så en fjärranvändare såg prompten försvinna utan förklaring. Istället för att leverera en spärr som beter sig olika beroende på var du sitter stängde vi av den. När Remote Control börjar vidarebefordra hook-meddelanden slås standardvärdet på igen. Fram tills dess slår du på den själv med ett av två lägen.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude nämner utgången i sin första rad
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompten avvisas en gång med meddelandet nedan
```

I `warn` går prompten igenom, och Claude inleder sitt svar med en rad som säger att cachen hade gått ut, att den här turen fakturerades som en fullständig återsändning, och att den billigare vägen tillbaka efter en paus på en timme eller mer är `/clear` → `/s-continue`. Den här når faktiskt fram till en fjärrklient, eftersom Claudes svar vidarebefordras även om hook-meddelanden inte gör det.

I `block` avvisas prompten en gång med meddelandet nedan. Skicka den igen så går den igenom. Använd det i en lokal terminal när du vill ha det hårda stoppet.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Blockeringsmeddelandet visas på 23 språk, valt utifrån ditt OS-locale, och utlöses en gång per inaktiv period.

**Bakgrundsagenter blockeras aldrig.** Endast promptar som en människa skrivit får kontrollen. Slutförranderapporter från bakgrundsagenter och uppgifter, som numera ofta kommer in mer än en timme efter start, passerar rakt igenom. Resultatet från en långvarig agent hålls aldrig tillbaka eller går förlorat.

**Resultat:** i warn-läge vet du alltid när en $9-återsändning inträffade, och varför. I block-läge inträffar den inte: varje fångad cache-utgång sparar $9, och med en om dagen är det $270/mån av rent slöseri borta.

> **Om du använder API betala per användning slår detta hårdare.** En Max Plan-prenumerant förlorar $9 inom en buffert på $200. Du förlorar $9 riktiga pengar — tyst, varje gång du går bort. Token Guardians block-läge stoppar det varje gång.

---

## 💡 Hur cache faktiskt fungerar (och varför de flesta användare slösar 40%+ på det)

Claude Code skickar hela konversationshistoriken till modellen vid varje API-anrop. "API-anrop" betyder inte "ett meddelande du skrev." En enda prompt utlöser interna verktygsanrop — Grep, Read, Edit, Write — och vart och ett är ett separat API-anrop. En prompt kan lätt orsaka 10+ API-anrop.

Promptcache minskar den här kostnaden med 90%. Men cache har en livslängd.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 timme (ephemeral_1h)                | 5 min                                  |
| Cache-skrivning     | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache-läsning       | ＄0.50/MTok                            | ＄0.50/MTok                             |
| När cachen går ut   | Full kontext återsänd till fullt pris | Låg inverkan (kontexten är liten)      |

Även med cachen aktiv ackumuleras kostnader. Här är ett extremt scenario för att visa skillnaden.

### Scenario: Heldagskodning (3h morgon → 2h lunch/möte → 3h eftermiddag)

Villkor: Opus 4-prissättning, 1 prompt per minut, ~5 API-anrop per prompt (~300 anrop/timme).

#### ❌ Utan super-token-saver

Det mesta arbetet sker i Main-sessionen. Kontexten växer snabbt.

| Fas         | Situation                         | Kontextstorlek               | Kostnad                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Morgon 3h   | Kodning (mest i Main)             | 100K → 600K (snitt 350K)   | 900 anrop × 350K × ＄0.50/M = ＄157.50  |
| Lunch/möte  | Borta i 2 timmar                  | —                          | —                                      |
| Återkomst   | Cache gick ut → full återsändning | 600K fullt pris            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Återkomst   | /compact (sammanfatta)            | 600K → skickad till LLM    | 600K × ＄0.50/M + sammanfattningsutdata = ~＄1.50 |
| Eftermiddag 3h | Kodning fortsätter (kontext växer igen) | 100K → 600K (snitt 350K) | 900 anrop × 350K × ＄0.50/M = ＄157.50 |
|             | Totalt                            |                            | ~＄326                                  |

> Vid den här användningsnivån kommer du troligen att nå hastighetsgränsen för 5-timmarsfönstret. **Kostnaden är dålig, men det verkliga problemet är att ditt arbete stannar helt. Det här är det exakta ögonblicket Claude Code slocknar.**

#### ✅ Med super-token-saver

Tungt arbete delegeras till SubTasks. Main hanterar bara design/beslut.

| Fas         | Situation                                    | Kontextstorlek                | Kostnad                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Morgon 3h   | Kodning (Main: design, SubTask: implementering) | Main 100K → 300K (snitt 200K) | 900 anrop × 200K × ＄0.50/M = ＄90 |
| Lunch/möte  | Borta i 2 timmar                             | —                           | —                                  |
| Återkomst   | ⚡ Token Guardian (block-läge) → /clear + /s-continue | —                        | ＄0 (inga LLM-anrop)                |
| Eftermiddag 3h | Kodning fortsätter                        | Main 100K → 300K (snitt 200K) | 900 anrop × 200K × ＄0.50/M = ＄90 |
|             | Totalt                                       |                             | ~＄180                              |

#### 💰 Resultat

> **＄326 → ＄180. ＄146 sparat per dag. 45% kostnadsminskning.**
>
> **Max Plan:** Färre tokens = du når inte hastighetsgränsen. Ditt arbete stannar inte. Det är den verkliga skillnaden.
>
> **API betala per användning:** ＄146/dag × 22 arbetsdagar = **＄3 200/mån direkt från din faktura.** En tung månad utan det här tillägget överstiger ＄7 000. Med det, under ＄4 000. Samma utdata.

### Var super-token-saver ingriper

```
[Session Start]
    │
    ├─ Session Architect → Injicerar automatiskt SubTask-delegeringsmönstret
    │                       Håller Main-kontexten under 250K
    │
[Arbetar]
    │
    ├─ Status Line → Realtidsövervakning av kostnad/kontext/hastighetsgräns
    │                  Omedelbart larm vid inträde i varningszonen
    │
[1+ timme inaktiv]
    │
    ├─ Token Guardian → Identifierar cache-utgång, varnar (eller blockerar i block-läge)
    │
[Sessionsomstart]
    │
    └─ /s-continue → Återställer tidigare kontext utan kostnad (inga LLM-anrop)
```

---

## 🔧 Källinstallation och anpassning

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver är helt öppen källkod (Apache-2.0). Ren JavaScript + Bash — inga kompilerade binärer, inga externa API-anrop, ingen telemetri. Varje rad är granskningsbar. Varje påstående i den här README:n mappas till en specifik fil du kan läsa.

- **hooks/** — Ändra tröskeln för cache-utgång, anpassa varningsmeddelanden, ändra sessionsarkitekturregler
- **scripts/** — Analyslogik, rapportbyggare, statusradsformatering
- **skills/** — Hur /s-continue och /usage-view fungerar, promptmallar
- **locales/** — Lägg till/redigera översättningar, lägg till nya språk
- **skills/usage-view/** — Förändringar i instrumentpanelens UI/UX-design

Gör det till ditt. Forka det, experimentera och skicka in en PR om du hittar något bättre.

---

## 🌐 Stödda språk

23 språk stöds. Valda genom att korshänvisa de 20 bästa länderna efter Claude Code-användning med de 20 bästa språken efter globalt talarantal. Visningsspråket identifieras automatiskt från ditt OS-locale. Du kan också ange manuellt: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Nuvarande översättningar är AI-genererade. Bidrag från modersmålstalare välkomnas — redigera JSON-filen för ditt språk i `locales/` och skicka in en PR.

---

## ⚖️ Vad det här tillägget kostar dig

Tillägget injicerar kontext vid sessionstart. Här är exakt hur mycket:

| Injektion | När | Tokens | Syfte |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (en gång) | ~1 100 | SubTask-delegeringsstrategi + concise mode-regler |
| Git-kontext (om git-lite aktiverat) | SessionStart (en gång) | ~280 | Ersätter CC:s ursprungliga ~2 200 tok git-instruktioner |
| Cache-utgångsvarning | Vid inaktivitet > 59m (en gång) | ~200 | Flaggar den dyra återsändningen, visar den billigare vägen |
| Status line | Varje API-anrop | 0 | Renderas till terminalens statusfält, inte till konversationskontext |

**Netto overhead per session: ~1 400 tokens (engångskostad, cachelagrad efter första anropet).**

Med Opus-prissättning ($0,50/MTok cache-läsning) är det **$0,0007 per API-anrop** — mindre än en tiondels cent. Under en 100-anropssession: $0,07.

Om git-lite är aktiverat **sparar** tillägget ~1 920 tokens per session (ersätter 2 200 med 280). Nettoeffekten är negativ — tillägget förbrukar mindre än det tar bort.

**För API betala per användning-användare:** vid $3 000/mån i utgifter är tilläggets overhead under $2/mån. Besparingarna från cache-utgångsförebyggande ensamt (en blockerad $9-återsändning per vecka) betalar för ett år av overhead i ett enda fångst.

---

## 💡 Tips

### Förstå cache och du ser var pengarna tar vägen

- **1 prompt ≠ 1 API-anrop.** Varje gång Claude anropar Grep, Read eller Edit skickas hela kontexten om. En enda prompt utlöser lätt 10+ API-anrop. Skriv tydliga promptar för att minska onödiga verktygsanrop och sänka kostnader.
- **Cache-timern återställs från det senaste API-anropet, inte din senaste prompt.** Fortsätt arbeta och cachen går aldrig ut. Faran är att gå bort. Token Guardian säger till när det hände, och i `block`-läge stoppar den prompten en gång så att du kan välja: återställ kontexten eller fortsätt som den är.
- **Kontextstorlek = kostnadsmultiplikator.** Samma API-anrop vid 200K kontra 800K kostar 4x mer. När statusradsindikatorn [CTX] överstiger 35% (🟡) är det din signal att delegera mer till SubTasks.

### Vanor som sänker kostnader

- **Håll CLAUDE.md kortfattad.** Den laddas in i systemprompten vid varje API-anrop. Varje rad kostar pengar.
- **Delegera tungt arbete till SubTasks.** Kodgenerering, flerfils-redigeringar, testkörningar hör inte hemma i Main. SubTasks har mindre kontext och ett billigare cache-lager.
- **Borta i 1+ timme?** `/clear` → kom tillbaka → `/s-continue`. Kontext återställd för $0.
- **[5H] över 70% (🟡)?** Bromsa. Byt till lätta granskningsuppgifter eller öka SubTask-delegering för att minska Mains API-anropsantal.
- **Använd `/btw` för sidofrågor.** Det går inte in i konversationshistoriken, så din kontext förblir kompakt.

### API betala per användning: de viktigaste vanorna

Allt ovanstående gäller, plus dessa API-specifika prioriteringar:

- **Se [CTX] som en hastighetsmätare.** Ingen hastighetsgräns kommer att stoppa dig — men kontext vid 500K+ innebär att varje API-anrop kostar 2-3 gånger så mycket som det borde. `/clear` → `/s-continue` är gratis och återställer din kostnadsmultiplikator till grundlinjen.
- **Kör `/usage-view` varje vecka.** Max Plan-användare har ett naturligt "aj"-ögonblick när de når hastighetsgränsen. Det har inte du — kostnader stiger tyst. Instrumentpanelen är ditt tidiga varningssystem.
- **Sätt en mental daglig budget.** Utan ett tak inträffar $200-dagar utan att du märker det. RUN-indikatorn på statusraden gör kosten per tur synlig. Om ett enskilt tur överstiger $1 (🔴) är din kontext för stor.

---

## 📚 Dokumentation

- [Guide för promptcache](guides/prompt-cache-guide.md) — Varför det mesta av din kostnad är cache, hur caching fungerar hos leverantörer (Anthropic, OpenAI, Gemini) och hur du hanterar det ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Kostnadsanalys Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Minst 24–38 % billigare än Opus 5 vid samma kvalitet, över 2 782 sessioner
- [Kostnadsanalys Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Kostnadsanalys Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Jämförelse sida vid sida över 8 563 API-anrop
- [Kostnadsanalys Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licens

Apache-2.0
