# super-token-saver

**Den eneste Claude Code-utvidelsen som faktisk leser CC-kildekoden for å finne ut hvor tokenene dine tar veien — og fikser det automatisk. Bruk mindre, kod lenger.**

> Målt resultat: **45% kostnadsreduksjon** på en virkelig arbeidsmengde på $326/dag → $180/dag. Automatisk SubTask-delegering, konteksGjenoppretting uten kostnad, et fullstendig analystedashbord og en vakt mot cache-utløp — i én installasjon, null konfigurasjon.

Fungerer med **Max Plan ($200/mnd)** og **API betal-per-bruk**. Samme utvidelse, samme funksjoner. Sterkere for hver bruker — spesielt når hver token er ekte penger.

![Bruksdashbord — se nøyaktig hvor tokenene dine tar veien](docs/images/usage-view-overview.png)

### Hva det gjør på 30 sekunder

| Funksjon | Hva skjer | Innvirkning |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delegerer tungt arbeid automatisk til SubTasks (37,5% billigere cache) | Kontekst forblir liten, kostnader synker |
| 🪶 Concise Mode | Kutter responsutfylling, beholder substansen | Færre output-tokens per respons |
| 🔄 /s-continue | Erstatter /compact — null LLM-anrop, null kostnad, null informasjonstap, og gjenoppretter nå også **Codex**-økter | Gratis konteksGjenoppretting på tvers av begge verktøy |
| 🤝 /s-compact | Skriver en øktoverlevering som /s-continue laster automatisk — fanger opp subagent-funn og verktøyresultater transkriptet mister | Neste økt gjenopptar også med den skjulte konteksten |
| 📊 Status Line | Sanntidskostnad, kontekststørrelse, hastighetsgrense — under 50ms | Se problemer før de koster deg penger |
| 📈 /usage-view | Interaktivt HTML-dashbord med AI-analyse | Fullstendig kostnadsetterforskning med ett klikk |
| ✂️ /setup-git-lite | Fjerner 2 200 skjulte tokens som CC injiserer hver økt | ~$48/mnd spart bare på git-instruksjoner |
| 🛡️ Token Guardian | Advarer deg i det øyeblikket en cache-utløp sender konteksten på nytt, eller blokkerer den i `block`-modus | Ingen flere stille $9-overraskelser |

---

## 😤 Problemet

**Usynlige kostnader.** Ingen synlighet i sanntid. Ingen advarsel om at "konteksten din er på 800K". Ingen varsel om at "cachen utløp for 3 minutter siden". Du finner ut om det etter at skaden er skjedd.

**Konteksoppblåsing.** Samme forespørsel ved 200K kontra 800K kontekst koster 4x mer. Hvert Read, Grep, Edit sender hele konteksten på nytt. En kompleks forespørsel utløser 15+ API-anrop, hvert multiplisert med kontekststørrelsen din.

**Cache utløper.** Du kommer tilbake fra lunsj. Cachen er borte. En forespørsel sender 900K tokens på nytt til full pris. $9 i ett skudd.

**Alt manuelt.** Konteksthåndtering, tidspunkter for cache-utløp, SubTask-delegering, øktopprydding. Ingen kan holde styr på alt dette mens de faktisk koder.

**Max Plan ($200/mnd)?** Alt ovennevnte, pluss en 5-timers hastighetsgrense som dreper flyten din uten timer og uten estimert tid.

**API betal-per-bruk?** Alt ovennevnte, bortsett fra at det ikke er noe tak. En cache-miss = $9 ekte penger. Ti ganger i uken = $360/mnd bare på uhell. En dårlig tirsdag med oppblåst kontekst kan koste mer enn hva en Max Plan-abonnent betaler i løpet av en måned.

super-token-saver håndterer alt dette automatisk. **Installer én gang. Ferdig.**

---

## 🚀 Installasjon

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Fungerer automatisk etter installasjon. Null konfigurasjon. Krever [Claude Code](https://claude.ai/claude-code) v2.1.71+.

For direkteovervåking:

```
/setup-statusline install
```

For å trimme 2 200 skjulte tokens fra CC-ens innebygde git-instruksjoner ([detaljer](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Funksjon 1: Smart øktarkitektur

**Installer det og kostnadsoptimaliserte arbeidsmønstre trer i kraft automatisk.**

De fleste brukere gjør alt i Main-økt. Fillesing, kodegenerering, testkjøringer. Hvert utdata hoper seg opp i konteksten og sendes på nytt med hver melding. Økten svulmer. Kostnadene snøres opp.

Session Architect injiserer automatisk en delegeringsstrategi ved øktstart.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rolle            | Design, beslutninger, gjennomgang | Implementering, kodegenerering, multi-fil |
| Cache-lag        | 1 time (ephemeral_1h)             | 5 min                                 |
| Cache-skrivekostnad | ＄10/MTok                       | ＄6.25/MTok                            |
| Kontekststørrelse | ~94K gjennomsnitt                | ~33K gjennomsnitt                     |

SubTasks har **37,5% billigere cache-skrivinger** enn Main. Konteksten er også mye mindre. Å delegere tungt arbeid til SubTasks reduserer kostnadene dramatisk.

**Resultat:** Kontekst forblir under 250K i stedet for å vokse til 600K+. Samme arbeidsutdata, halve tokenkostnaden. Fullstendig automatisk.

---

## 🪶 Concise Mode

**Samme innhold. Mindre utfylling. På som standard.**

SessionStart-hooken injiserer også en regelregelstil som kjøres i **hver økt og hver modell** — ingen flagg, ingen oppsett. Tre ting endres:

- **Ingen innledning** — ikke "La meg sjekke…", "Nå skal jeg…", gjenta spørsmålet ditt eller oppsummere hva diff-en allerede viser
- **Riktig format for innholdet** — punktliste for lister, prosa for resonnement (avveininger, kausalitet, begrunnelse). Ingen av dem er tvungen
- **Strammere uttrykk** — samme poeng, færre ord. Klarere prosa er kortere prosa

Hardt grense: aldri droppe innhold, hoppe over verifisering eller komprimere nyanser til én setning. Substansen forblir full; bare innpakningen krymper.

Installer én gang, gjelder overalt.

---

## 🔄 Funksjon 2: /s-continue — KonteksGjenoppretting

**Erstatter `/compact`. Null LLM-anrop. Null tokenkostnad. Null informasjonstap.**

`/compact` sender hele konteksten din (~1M tokens) til LLM-en for å komprimere den til et 3,3%-sammendrag. Hvis cachen har utløpt, utløser det alene en full re-caching. Informasjonstap er uunngåelig.

`/s-continue` tar en helt annen tilnærming. Den forhåndsbehandler det forrige økt-transkriptet og laster det direkte. Intet LLM-anrop. Ingen kostnad. Den opprinnelige samtalen gjenopprettes som den var.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Hvordan det fungerer    | Sender full kontekst til LLM for sammendrag | Forhåndsbehandler transkripsjon, leser direkte |
| LLM-anrop               | Påkrevd (vanligvis 100K+ tokens)  | 0                                |
| Tokenkostnad            | Høy                               | 0                                |
| Informasjonstap         | Ja (3,3% sammendrag)              | Ingen (original bevart)          |
| Behandlingshastighet    | Titalls sekunder                  | < 1 sek (selv 60MB+ filer)       |
| Når cache er utløpt     | Full re-cachekostnad på toppen    | Ingen innvirkning                |
| Multi-økt-gjenoppretting | Ikke mulig                       | Støttet                          |

Bruk: `/clear` deretter `/s-continue`. Du ser en liste over tidligere økter. Velg én for å gjenopprette. For rask gjenoppretting: `/s-continue last`.

**Resultat:** Gjenoppta tidligere arbeid uten kostnad. Ingen informasjonstap. Behandler 60MB+ transskripter på under 1 sekund.

### 🤝 Makkeren: `/s-compact` — overlever det skjulte laget

`/s-continue` gjenoppretter **transkriptet** — det du og Claude sa. Men den mest nyttige kunnskapen fra
en arbeidsøkt lever ofte UTENFOR den dialogen: hva en **subagent** fant (transkriptet dens er en egen
fil som gjenopprettingen aldri laster), et avgjørende **tall i verktøyresultater** (et testantall, en
benchmark), en **lærdom fra prosessen** ("kunne ikke reprodusere i headless-modus → det var byggingen, ikke koden").

Kjør `/s-compact` på **slutten** av en økt, så destillerer den nettopp det skjulte laget til en
overlevering, lagret i `~/.claude/super-token-saver-data/<project>/handoff.md`. I neste økt
laster `/s-continue` den **automatisk** oppå det gjenopprettede transkriptet — ingen liming nødvendig.

|                     | Bare `/s-continue`             | `/s-compact` + `/s-continue` (paret)            |
| ------------------- | -------------------------------- | ------------------------------------------------ |
| Gjenoppretter       | Transkriptet (det som ble sagt)  | Transkriptet **pluss** det skjulte laget          |
| Subagent-funn       | Tapt (separate filer)            | Destillert inn i overleveringen                    |
| Tall fra verktøyresultater | Kun hvis sitert i chatten  | Hentet ut bevisst                                 |
| Lærdommer fra prosessen | —                            | Fanget opp så blindveier ikke gjentas             |

**Arbeidsflyten:** avslutt en økt med `/s-compact` → start den neste med `/s-continue`.


### 🔀 To verktøy, én historikk — Codex-økter gjenopprettes her også

Codex skriver øktene sine til `~/.codex/sessions/`, Claude Code til `~/.claude/projects/`. Ingen av dem leser filene til den andre. En sprint som gikk tom for budsjett i Codex var derfor utilgjengelig fra Claude Code — og motsatt.

`/s-continue` lister og gjenoppretter nå begge deler. En Codex-rollout sendes ikke til en ny parser — den skrives om til nøyaktig det formatet Claude Code bruker, **én utdatalinje per inndatalinje**, slik at samme pipeline betjener begge verktøy og hver `L{n}`-markør fortsatt peker på nøyaktig samme linje i den opprinnelige Codex-filen. Målt: en 12 MB, 1,540-line rollout forhåndsbehandles på **0.13 s**.

|                             | Claude Code-økt | Codex-økt |
| --------------------------- | ------------------ | ----------- |
| Listet i `/s-continue`     | Ja | Ja, avgrenset til gjeldende prosjekt |
| Gjenopprettet uten LLM-kostnad | Ja | Ja |
| `L{n}`-hopp til originalen | Ja | Ja — linjenumrene er rollout'ens egne |
| Gjenoppretting etter kontekstap (`#0`) | `/compact`, auto-compact | Codex-komprimering og tråd-tilbakestilling |
| `/s-compact`-overlevering | Delt per prosjekt — skriv i det ene verktøyet, last i det andre |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

To detaljer avgjør forskjellen mellom en korrekt liste og en som bare ser riktig ut: Codex' `session_id` er id-en til **tråden**, som en startet subagent arver, så økter nøkles på `payload.id`, og subagent-rollouter filtreres bort på samme måte som Claude Code allerede filtrerer sine egne deloppgave-transkripsjoner. Og `<codex_internal_context source="goal">` settes inn av maskinen selv, så den beholdes i den gjenopprettede konteksten, men telles aldri som en tur du skrev.

Pluginet installerer seg også i Codex — se **[README-CODEX.md](./README-CODEX.md)**
([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)).
`usage-view`, `report-limit` og `setup-statusline` er foreløpig bare for Claude Code.

---

## 📊 Funksjon 3: Live statuslinje

**Sanntids token-/kostnadsovervåking. Under 50ms overhead.**

Kjør `/setup-statusline install` én gang og en permanent statuslinje vises nederst i Claude Code.

**Normal drift** — alle beregninger med et blikk, null kontekstbytte:

![Statuslinje i normal tilstand](docs/images/statusline-normal.png)

**Hastighetsgrense nådd** — 5H blir rød ved 102%, nedtelling viser nøyaktig når du er tilbake, og en engangs `/report-limit`-handling dukker opp automatisk:

![Statuslinje ved hastighetsgrense](docs/images/statusline-rate-limited.png)

| Indikator        | Hva den viser                       | 🟢 Normal | 🟡 Advarsel | 🔴 Kritisk |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Kostnad for det siste API-anropet   | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Kumulativ kostnad for denne mappen  | —         | —          | —           |
| 5H               | 5-timers vindusbruk + tilbakestillingstelling | < 70%     | >= 70%     | >= 90%      |
| CTX              | Kontekstvindubruk                   | < 35%     | >= 35%     | >= 70%      |

Når en indikator når advarsel- eller kritisknivå, vises et hint `→ /usage-view current` automatisk.

For å fjerne: `/setup-statusline uninstall` (forrige konfigurasjon gjenopprettes automatisk).

**Resultat:** Hvert kostnadsproblem synlig i sanntid. Under 50ms overhead — ingen merkbar forsinkelse.

> **Bruker du API betal-per-bruk?** Indikatorene 5H og W skjules automatisk — du har ikke hastighetsgrensevinduer. Det som gjenstår er det som betyr noe: RUN (sanntidskostnad per tur) og CTX (kontekststørrelse). De to spakene som kontrollerer regningen din, alltid synlige.

---

## 📈 Bruksdashbord (/usage-view)

**Svar endelig: "Hvor tok alle de pengene veien?"**

Max Plan-brukere treffer hastighetsgrensen og lurer på hvorfor. API-brukere åpner Anthropic-fakturaen og lurer på hvordan. Uansett er spørsmålet det samme: hvilken økt brente flest tokens? Når skjøt kostnadene i været? Hvilke mønstre finnes i bruken din? Hittil — alt usynlig.

`/usage-view` viser alt. Et interaktivt HTML-dashbord åpnes i nettleseren din, slik at du kan analysere bruksmønstre og spore grunnårsaken til kostnadstoppene. Ingen eksterne avhengigheter. Fungerer frittstående. Kan deles som en fil.

**$4 196 på 31 dager. Hvor tok det hele veien?** Et blikk — total kostnad, tokenfordeling etter type, cache-effektivitetsforhold og øktantall. Smultringdiagrammet viser umiddelbart at 65% av utgiftene dine er cache-lesinger (som er normalt og sunt):

![Oversikt over bruksdashbord](docs/images/usage-view-overview.png)

**Før og etter — målt, ikke gjettet.** Det oransje stiplede "Plugin installed"-merket deler kostnadstidslinjen din i to. Daglige søyler er stablet etter tokentype (Input/Output/Cache Write/Cache Read) slik at du kan se nøyaktig hvilken komponent som endret seg etter installasjon. Gjennomsnittslinjen viser trenden:

![Daglig kostnadstrend](docs/images/usage-view-daily-trend.png)

**Når brenner du mest?** Timekostnad etter tid på dagen og dag-i-uken-fordeling. Bytt mellom aktivdag-gjennomsnitt, heldag-gjennomsnitt eller maks. Brann-ikoner markerer de dyreste timene dine — synlige mønstre (sene nattlige kodingsøkter, onsdagstopper) hopper frem umiddelbart:

![Timemønster og dag-i-uken-kostnadsmønster](docs/images/usage-view-hourly-pattern.png)

**Blir du mer effektiv?** Total/Output-forholdet måler hvor mange tokens som forbrukes per produsert output-token. Lavere er bedre. "Plugin installed"-merket lar deg sammenligne før og etter. Topper = cache-misser eller øktomstarter:

![Effektivitetstrend](docs/images/usage-view-efficiency.png)

**Hvert API-anrop, plottet etter kontekststørrelse og kostnad.** Dette er diagrammet som gjør kostnadsstrukturen klar. Hvert punkt er ett API-anrop. Rød = Opus, blå = Sonnet, grønn = Haiku. De stiplede linjene er teoretisk prissetting — hvis punktene dine ligger over linjen, betaler du for mye. Bytt til **User Turn**-visning for å se kostnad per samtaletur i stedet for per API-anrop.
Hold musepekeren over et punkt for å se den faktiske promptteksten, tokenantall og full kostnadsfordeling (Input/Output/Cache Write/Cache Read):

![Kostnad etter kontekststørrelse — spredningsdiagram](docs/images/usage-view-cost-scatter.png)

**Hvor store er kontekstene dine?** De fleste anrop klynger seg under 250K. Den lange halen over 350K er der kostnadene eksploderer — dette diagrammet viser nøyaktig hvor ofte du er i faresonen:

![Distribusjon av kontekststørrelse](docs/images/usage-view-context-dist.png)

**Kodingsplanen din, priset per time.** Et 5-timers vindus varmekart over 30 dager. Grønn (<$15/t), oransje ($15-30/t), rød ($30+/t). Hodeskalle-ikonet (💀) markerer vinduer der du nådde hastighetsgrensen. Kostnadsglidebryteren øverst filtrerer ut billige vinduer slik at dyre hopper frem — dra den for å umiddelbart finne de verste dagene dine. Bytt mellom 5-timers vindu- og 1-timers blokkvisninger:

![Timelig brukskalender varmekart](docs/images/usage-view-calendar.png)

**Klikk på en celle for å gå inn på det vinduets økter.** Hver økt i den tidsluka, med kostnad, meldingsantall, tokenfordeling og de faktiske første/siste meldingene fra hver samtale. Utvid "Top Token Conversations" for å se hvilke spesifikke utvekslinger som brente mest — hvert oppføring viser promptteksten, kostnadsvarselkoder og optimaliseringstips:

![Øktdetalj-panel](docs/images/usage-view-session-drilldown.png)

**AI-drevet analyse (valgfritt).** Når du kjører `/usage-view` uten `--no-ai`, leser en AI-analytiker alle dashborddata dine — med innebygd API-prisereferanse — og produserer en skriftlig rapport: kostnadsdrivere, anomalier, optimaliseringsanbefalinger. Vises automatisk på OS-språket ditt (23 språk, RTL inkludert; diagrammer/tabeller forblir alltid LTR):

**Hvor pengene tok veien** — total utgift, kostnadsdrivere etter tokentype, ukentlig trend og utvidelsespåvirkning målt i virkelige tall:

![AI-analyse — kostnadsfordeling](docs/images/usage-view-ai-report-1.png)

**Når og hvordan du jobber** — topp-timer, de travleste dagene, API-anropsfordeling og hastighetsgrensemønstre som avslører optimaliseringsmuligheter:

![AI-analyse — arbeidsmønstre](docs/images/usage-view-ai-report-2.png)

**Hva du bør gjøre med det** — konkrete, datadrevne anbefalinger tilpasset din faktiske bruk. Modellbytte, konteksthåndtering, økt-strategi:

![AI-analyse — anbefalinger](docs/images/usage-view-ai-report-3.png)

**Del det.** Hele dashbordet er én frittstående HTML-fil — alle data innebygd, ingen server nødvendig. Send det til teamet ditt, sjefen din eller regnskapsføreren din. Ingen eksterne avhengigheter. Fungerer offline. Bruk `private`-modus for å fjerne all prompttekst før deling — bevarer kostnadsanalytikken mens samtalinnhold fjernes.

```
/usage-view                  # All tid, alle prosjekter
/usage-view current          # Kun gjeldende 5-timers vindu
/usage-view last 7 days      # Siste 7 dager
/usage-view locale ja        # Japansk
/usage-view --no-ai          # Hopp over AI-analyse (raskere)
/usage-view private          # Fjern prompttekst (trygt å dele)
```

---

## 🔬 Hastighetsgrenseforskning (/report-limit)

**Fellesskapsdrevet prosjekt for å reversere hastighetsgrenseformelen.**

Anthropic publiserer ikke den eksakte formelen for 5-timersvinduet. La oss finne det ut sammen.

Når du treffer en hastighetsgrense, kjør `/report-limit`. Gjeldende bruksdata sendes automatisk inn som en GitHub Discussion. Jo mer data vi samler, desto klarere blir formelen.

---

## ✂️ Funksjon 4: /setup-git-lite — Trim CC-ens innebygde git-instruksjoner

**Vi leste Claude Code-kildekoden. Vi fant 2 200 skjulte tokens injisert i hver økt som du stille betaler for.**

### Oppdagelsen

2026-04-12 avslørte et [GitHub-problem](https://github.com/anthropics/claude-code/issues/47107) at Claude Codes innebygde `includeGitInstructions`-innstilling stille brenner tokens i hver økt. Uavhengig reproduksjon via [dette gist-et (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bekreftet tallene: **+6 031 tokens i cache-skrivinger** per økt etter hver git-commit, **+1 690 tokens i cache-lesinger** ved hvert API-anrop.

### CC-kildeanalyse — hvor tokenene tar veien

Vi sporet tokenene til to uavhengige injeksjonspunkter i Claude Code-kildekode (v2.1.88):

**1. `gitStatus`-øyeblikksbilde (~500 tok) — systemprompt**
- `context.ts:36-111` `getGitStatus()` samler gren + hovedgren + user.name + full status (opptil 2 000 tegn) + **siste 5 commits**
- Sammenføyd og lagt til systemprompt via `appendSystemContext` (`utils/api.ts:437`)
- Hver nye commit, hver ny modifisert fil, hvert grenbyttet endrer teksten → prefiks-cache-ugyldiggjøring

**2. Commit/PR-arbeidsflytinstruksjoner (~1 700 tok) — Bash-verktøybeskrivelse**
- `tools/BashTool/prompt.ts:53` legger til 60+ linjer sikkerhetsprotokoll, steg-for-steg commit-prosedyre, HEREDOC-eksempler og PR-opprettingsmaler til `Bash`-verktøyets beskrivelse
- Bufret sammen med systemprompt, men sendt som `tools[]`-parameter

### Hvorfor det er dyrt

Cache-strukturen (`utils/api.ts:321` `splitSysPromptPrefix`) har tre stier basert på om du har aktive MCP-verktøy:

- **Sti A** (MCP aktiv — de fleste brukere): `gitStatus` sitter inne i en `cacheScope: 'org'`-blokk. Enhver endring → hele blokken re-caches ved neste øktstart → 6K tok `cache_create`-miss.
- **Sti B** (ingen MCP): `gitStatus` går til en dynamisk `cacheScope: null`-blokk, noe som betyr at den sendes på nytt som ferske `input_tokens` ved hvert API-anrop — ingen cache-miss, men heller ingen cache-besparelser.
- **Sti C** (tredjepartsleverandør / eksperimentelle betaer deaktivert): samme som sti A.

I typiske interaktive økter akkumuleres commit/PR-instruksjonene (1,7K tok) **ved hvert API-anrop** via `cache_read`. Over en 100-anrops økt ved Opus 4.7-prissetting er det omtrent **$0,08 per økt** bare for instruksjoner som Claudes trening allerede for det meste dekker.

### Hvordan super-token-saver håndterer det

`/setup-git-lite` deaktiverer den native stien og injiserer en **nøye utvalgt 280-tokens-erstatning** via en SessionStart-hook. Vi beholdt nøyaktig de tingene som overstyrer Claudes standardatferd (sikkerhetsregler) og droppet alt som Claude allerede vet fra trening (steg-for-steg-arbeidsflyter, PR-maler, gh-bruksmønstre).

**Beholdt — 11 kritiske overstyringsregler** (de som snur Claudes standard hjelpsomhet til forsiktighet):
- Aldri commit/push/amend/PR/tag/merge uten eksplisitt brukerforespørsel
- Aldri hoppe over hooks, force-pushe til main/master, kjøre destruktive operasjoner, endre git config
- Aldri committe filer som matcher `.env`, `credentials`, `*.pem`, `secret.*`
- Unngå `git add -A` / `git add .`
- HEREDOC for flerlinjes commit-meldinger + `Co-Authored-By: Claude`-trailer
- Aldri bruke interaktive flagg (-i), ingen tomme commits
- Hvis pre-commit-hook mislykkes → opprett en NY commit (ikke `--amend`)

**Droppet** — steg-for-steg commit-arbeidsflyt (3 steg), steg-for-steg PR-arbeidsflyt (3 steg), PR-tittel/brødtekstmal, `gh`-kommandreferanser, `-uall`-flaggadvarsel, `--no-edit` med rebase-advarsel, `NEVER use TodoWrite or Agent tools during commit`-begrensning. Dette er arbeidsflytutfylling som Claude sammensetter riktig fra trening alene.

**Lagt til** — kompakt git-statuslinje: gren + HEAD kort-sha + emne + gjeldende status (opptil 20 modifiserte filer, ellers et antall). Ingen liste over siste commits (Claude kan kjøre `git log` på forespørsel).

### Forventede besparelser (Opus 4.7-prissetting, $25/MTok utdata, $5/MTok inndata, $0,50/MTok cache-lesing)

| Element | Original | Med setup-git-lite | Spart |
| ---- | -------- | ------------------- | ----- |
| Systemprompt-lasting (per ny økt) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Gjentatte anrop i samme økt | ~1 700 tok cache_read/anrop | ~280 tok cache_read/anrop | ~1 420 tok/anrop |
| 100-anrops økt (Opus 4.7) | — | — | **~$0,11 spart** |
| 20 økter/dag × 22 arbeidsdager | — | — | **~$48 spart/mnd** |

### Bruk

```bash
/setup-git-lite status     # Skrivebeskyttet diagnose — gjeldende tilstand + hva som ville endres
/setup-git-lite install    # Deaktiver CC native + aktiver vår minimale hook
/setup-git-lite revert     # Gjenopprett standard (aggressiv; se nedenfor)
/setup-git-lite dismiss-banner    # Dempe det tidvise anbefalingstipset
/setup-git-lite undismiss-banner  # Reaktiver tipset
/setup-git-lite help       # Full bruk
```

### Installasjonssemantikk

`install` endrer **to** steder for robusthet:

1. `~/.claude/settings.json` — legger til `"includeGitInstructions": false`
2. Shell-profil (`~/.zshrc`, `~/.bashrc`, osv.) — legger til en markeringsblokk som eksporterer `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Enten alene er nok til å deaktivere CC native; vi setter begge slik at en miljøoverstyring ikke ved et uhell reaktiverer den native atferden. Shell-endringen trer i kraft i nye shell.

### Tilbakestillingssemantikk — aggressiv

`revert` **fjerner ALLE `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-eksporter fra shell-profilen din**, inkludert eventuelle du kan ha lagt til manuelt før installering av denne ferdigheten. Dette er bevisst — du kjørte `revert`, så vi gjenoppretter den rene standarden. Vi oppretter alltid en tidsstemplet sikkerhetskopi av shell-profilen først.

Hvis du trenger miljøvariabelen av urelaterte årsaker, noter den ned før du kjører `revert` og legg den til igjen etterpå.

### Før avinstallering av super-token-saver

**Kjør `/setup-git-lite revert` først**, ellers blir du sittende igjen med `includeGitInstructions: false` i settings.json men uten erstatningshook (Claude får ingen git-veiledning i det hele tatt). Claude Code har for øyeblikket ingen avinstalleringslivssyklus-hook for utvidelser, så vi kan ikke automatisere dette.

### Avveininger

Hva du mister (og hvorfor det vanligvis er greit):
- Claude mottar ikke lenger en forhåndsberegnet `git status` / `git log -n 5` ved øktstart. Hvis du spør "hva er endret?" i en ny økt, kjører Claude disse kommandoene selv (ett ekstra verktøyanrop, ~300 tok).
- Claude ser ikke lenger CC:s kanoniske 3-trinns commit-prosedyre. I testene våre over hundrevis av commit-flyter håndterer treningsnivåkunnskap de kritiske tilfellene (HEREDOC-formatering, ingen `--amend`, ingen force-push) fordi vi beholder disse som eksplisitte regler.
- PR-brødtekstmalen (`## Summary` + `## Test plan`) injiseres ikke. Hvis du bryr deg om nøyaktig det formatet, legg det i prosjektets CLAUDE.md.

### Anbefalingsbanner

Når CC:s innebygde git-instruksjoner fortsatt er aktive på maskinen din, viser super-token-saver et avsnittips ved øktstart **~20% av tiden** (pluss i `/usage-view`- og `/report-limit`-utdata). Demp permanent med `/setup-git-lite dismiss-banner`.

---

## 🛡️ Funksjon 5: Token Guardian

**Forteller deg i det øyeblikket en cache-utløp koster deg noe. Kan blokkere $9-gjenoversendelsen hvis du ber den om det.**

Claude Codes promptcache lever i 1 time. Er du borte lenger enn det, utløper den. Neste melding sender hele konteksten på nytt til full pris. Ved 900K tokens er det $9 i ett skudd.

Token Guardian husker når siste svar kom inn. Hvis det har gått mer enn 3 590 sekunder (TTL-en minus 10 sekunders buffer), kan den gripe inn. **Den er avslått som standard, på grunn av fjernstyring (Remote Control).** En hooks blokkeringsmelding vises lokalt som en systemmelding som den eksterne klienten aldri mottar, så en ekstern bruker så forespørselen bare forsvinne uten forklaring. Fremfor å levere en vakt som oppfører seg ulikt avhengig av hvor du sitter, slo vi den av. Når Remote Control begynner å videresende hook-meldinger, slås standarden på igjen. Frem til da slår du den på selv med én av to moduser.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude nevner utløpet i den første linjen
export CC_TOKEN_SAVER_CACHE_GUARD=block   # forespørselen avvises én gang med meldingen under
```

I `warn` går forespørselen gjennom, og Claude åpner svaret med én linje som sier at cachen hadde utløpt, at denne turen betalte for hele konteksten, og at etter en pause på en time eller mer er `/clear` → `/s-continue` den billigste veien tilbake. Denne når frem til en ekstern klient, fordi Claudes svar videresendes selv om hook-meldinger ikke gjør det.

I `block` avvises forespørselen én gang med meldingen under. Send den på nytt, og den går gjennom. Bruk den i en lokal terminal når du vil ha den harde stoppen.

```
🚨 Cache expired (68m 23s idle)

Promptcachen har utløpt. Hvis du fortsetter, sendes hele konteksten på nytt.
Kostnaden kan øke betydelig.

👉 /context — Sjekk gjeldende kontekstbruk før du bestemmer deg
👉 /clear → /s-continue — Tilbakestill, gjenopprett deretter forrige kontekst (anbefalt, billigst)
👉 Send på nytt — Fortsett som normalt (full re-cache-kostnad påløper)
```

Blokkeringsmeldingen vises på 23 språk, valgt ut fra OS-locale, og utløses bare én gang per inaktiv periode.

**Bakgrunnsagenter blokkeres aldri.** Kun det et menneske har skrevet, får sjekken. Fullføringsrapporter fra bakgrunnsagenter og oppgaver -- som nå rutinemessig kommer mer enn en time etter at de ble startet -- går rett gjennom, slik at resultatet fra en langvarig agent aldri holdes tilbake eller går tapt.

**Resultat:** I `warn`-modus vet du alltid når en $9-gjenoversendelse skjedde, og hvorfor. I `block`-modus skjer det ikke: hver fanget utløp sparer $9, og med én i døgnet er det $270/mnd i rent sløseri eliminert.

> **Hvis du bruker API betal-per-bruk, treffer dette hardere.** Max Plan-abonnenter mister $9 innenfor en $200-buffer. Du mister $9 ekte penger — stille, gjentatte ganger, hver gang du går bort. `block`-modus stopper det hver gang.

---

## 💡 Hvordan cache faktisk fungerer (og hvorfor de fleste brukere kaster bort 40%+ på det)

Claude Code sender hele samtalehistorikken til modellen ved hvert API-anrop. "API-anrop" betyr ikke "én melding du skrev". En enkelt forespørsel utløser interne verktøyanrop — Grep, Read, Edit, Write — og hvert er et separat API-anrop. Én forespørsel kan lett forårsake 10+ API-anrop.

Promptcache reduserer denne kostnaden med 90%. Men cache har en levetid.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 time (ephemeral_1h)                 | 5 min                                  |
| Cache-skriving      | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache-lesing        | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Når cache utløper   | Full kontekst sendt på nytt til full pris | Lav innvirkning (kontekst er liten) |

Selv med aktiv cache akkumulerer kostnadene seg. Her er et ekstremt scenario for å vise forskjellen.

### Scenario: Heldagskoding (3t morgen → 2t lunsj/møte → 3t ettermiddag)

Betingelser: Opus 4-prissetting, 1 forespørsel per minutt, ~5 API-anrop per forespørsel (~300 anrop/time).

#### ❌ Uten super-token-saver

Det meste av arbeidet skjer i Main-økt. Konteksten vokser raskt.

| Fase         | Situasjon                         | Kontekststørrelse             | Kostnad                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Morgen 3t   | Koding (mest i Main)              | 100K → 600K (snitt 350K)   | 900 anrop × 350K × ＄0.50/M = ＄157.50  |
| Lunsj/møte  | Borte i 2 timer                   | —                          | —                                      |
| Retur        | Cache utløpt → full gjenoversendelse | 600K full pris          | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Retur        | /compact (oppsummer)              | 600K → sendt til LLM       | 600K × ＄0.50/M + sammendragsutdata = ~＄1.50 |
| Ettermiddag 3t | Koding fortsetter (kontekst vokser igjen) | 100K → 600K (snitt 350K) | 900 anrop × 350K × ＄0.50/M = ＄157.50 |
|             | Totalt                            |                            | ~＄326                                  |

> På dette bruksnivået vil du sannsynligvis nå hastighetsgrensen for 5-timersvinduet. **Kostnaden er dårlig, men det virkelige problemet er at arbeidet ditt stopper fullstendig. Dette er det nøyaktige øyeblikket Claude Code slukker.**

#### ✅ Med super-token-saver

Tungt arbeid delegeres til SubTasks. Main håndterer bare design/beslutninger.

| Fase         | Situasjon                                    | Kontekststørrelse                | Kostnad                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Morgen 3t   | Koding (Main: design, SubTask: implementering) | Main 100K → 300K (snitt 200K) | 900 anrop × 200K × ＄0.50/M = ＄90 |
| Lunsj/møte  | Borte i 2 timer                              | —                           | —                                  |
| Retur        | ⚡ Token Guardian (block-modus) → /clear + /s-continue | —                        | ＄0 (ingen LLM-anrop)               |
| Ettermiddag 3t | Koding fortsetter                         | Main 100K → 300K (snitt 200K) | 900 anrop × 200K × ＄0.50/M = ＄90 |
|             | Totalt                                       |                             | ~＄180                              |

#### 💰 Resultat

> **＄326 → ＄180. ＄146 spart per dag. 45% kostnadsreduksjon.**
>
> **Max Plan:** Færre tokens = du treffer ikke hastighetsgrensen. Arbeidet ditt stopper ikke. Det er den virkelige forskjellen.
>
> **API betal-per-bruk:** ＄146/dag × 22 arbeidsdager = **＄3 200/mnd rett fra fakturaen din.** En tung måned uten denne utvidelsen krysser ＄7 000. Med den, under ＄4 000. Samme utdata.

### Hvor super-token-saver griper inn

```
[Session Start]
    │
    ├─ Session Architect → Injiserer automatisk SubTask-delegeringsmønsteret
    │                       Holder Main-konteksten under 250K
    │
[Jobber]
    │
    ├─ Status Line → Sanntidsovervåking av kostnad/kontekst/hastighetsgrense
    │                  Umiddelbar alarm ved inntog i advarselssonen
    │
[1+ time inaktiv]
    │
    ├─ Token Guardian → Oppdager cache-utløp, advarer (eller blokkerer i block-modus)
    │
[Økt-omstart]
    │
    └─ /s-continue → Gjenoppretter tidligere kontekst uten kostnad (ingen LLM-anrop)
```

---

## 🔧 Kildeinstallasjon og tilpasning

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver er fullt åpen kildekode (Apache-2.0). Ren JavaScript + Bash — ingen kompilerte binærfiler, ingen eksterne API-anrop, ingen telemetri. Hver linje er reviderbar. Hvert krav i denne README-en kartlegges til en spesifikk fil du kan lese.

- **hooks/** — Endre cache-utløpsterskelen, tilpass advarselsmeldinker, endre øktarkitekturregler
- **scripts/** — Analyselogikk, rapportbygger, statuslinjeformatering
- **skills/** — Hvordan /s-continue og /usage-view fungerer, promptmaler
- **locales/** — Legg til/rediger oversettelser, legg til nye språk
- **skills/usage-view/** — Dashbord UI/UX-designendringer

Gjør det til ditt. Fork det, eksperimenter og send en PR hvis du finner noe bedre.

---

## 🌐 Støttede språk

23 språk støttes. Valgt ved å kryssreferere de 20 beste landene etter Claude Code-bruk med de 20 beste språkene etter globalt talerantall. Visningsspråket er automatisk oppdaget fra OS-locale. Du kan også spesifisere manuelt: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Nåværende oversettelser er AI-generert. Bidrag fra morsmålsbrukere er velkomne — rediger JSON-filen for språket ditt i `locales/` og send inn en PR.

---

## ⚖️ Hva denne utvidelsen koster deg

Utvidelsen injiserer kontekst ved øktstart. Her er nøyaktig hvor mye:

| Injeksjon | Når | Tokens | Formål |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (én gang) | ~1 100 | SubTask-delegeringsstrategi + concise mode-regler |
| Git-kontekst (hvis git-lite aktivert) | SessionStart (én gang) | ~280 | Erstatter CC:s native ~2 200 tok git-instruksjoner |
| Cache-utløpsadvarsel | Ved inaktivitet > 59m (én gang) | ~200 | Flagger den dyre gjenoversendelsen, viser den billigere veien |
| Status line | Hvert API-anrop | 0 | Gjengis til terminal-statuslinjen, ikke til samtalekontext |

**Netto overhead per økt: ~1 400 tokens (én gang, bufret etter første anrop).**

Ved Opus-prissetting ($0,50/MTok cache-lesing) er det **$0,0007 per API-anrop** — mindre enn en tidels cent. Over en 100-anrops økt: $0,07.

Hvis git-lite er aktivert, **sparer** utvidelsen ~1 920 tokens per økt (erstatter 2 200 med 280). Netto effekt er negativ — utvidelsen forbruker mindre enn den fjerner.

**For API betal-per-bruk-brukere:** ved $3 000/mnd i utgifter er utvidelsesoverhead under $2/mnd. Besparelsene fra forebygging av cache-utløp alene (én blokkert $9-gjenoversendelse per uke) betaler for et år med overhead i ett enkelt fangst.

---

## 💡 Tips

### Forstå cache og du ser hvor pengene tar veien

- **1 forespørsel ≠ 1 API-anrop.** Hver gang Claude kaller Grep, Read eller Edit, sendes hele konteksten på nytt. En enkelt forespørsel utløser lett 10+ API-anrop. Skriv tydelige forespørsler for å redusere unødvendige verktøyanrop og kutte kostnader.
- **Cache-timeren tilbakestilles fra det siste API-anropet, ikke din siste forespørsel.** Fortsett å jobbe og cachen utløper aldri. Faren er å gå bort. Token Guardian forteller deg når det skjedde, og i `block`-modus stopper den forespørselen én gang, slik at du kan velge: tilbakestill konteksten, eller fortsett som normalt.
- **Kontekststørrelse = kostnadsmultiplikator.** Samme API-anrop ved 200K kontra 800K koster 4x mer. Når statuslinjen [CTX] krysser 35% (🟡), er det signalet ditt om å delegere mer til SubTasks.

### Vaner som reduserer kostnader

- **Hold CLAUDE.md kort.** Den lastes inn i systemprompt ved hvert API-anrop. Hver linje koster penger.
- **Deleger tungt arbeid til SubTasks.** Kodegenerering, flerfils-redigeringer, testkjøringer hører ikke hjemme i Main. SubTasks har mindre kontekst og et billigere cache-lag.
- **Borte i 1+ time?** `/clear` → kom tilbake → `/s-continue`. Kontekst gjenopprettet for $0.
- **[5H] over 70% (🟡)?** Bremse. Bytt til lette gjennomgangsoppgaver eller øk SubTask-delegering for å redusere Mains API-anropsantall.
- **Bruk `/btw` for sideforespørsler.** Det går ikke inn i samtalehistorikken, slik at konteksten din forblir kompakt.

### API betal-per-bruk: de viktigste vanene

Alt ovennevnte gjelder, pluss disse API-spesifikke prioriteringene:

- **Se [CTX] som et fartsmåler.** Ingen hastighetsgrense vil stoppe deg — men kontekst ved 500K+ betyr at hvert API-anrop koster 2-3x mer enn det burde. `/clear` → `/s-continue` er gratis og tilbakestiller kostnadsmultiplikatoren til grunnlinjen.
- **Kjør `/usage-view` ukentlig.** Max Plan-brukere har et naturlig "au"-øyeblikk når de treffer hastighetsgrensen. Det har ikke du — kostnader stiger stille. Dashbordet er ditt tidlige varslingssystem.
- **Sett et mentalt daglig budsjett.** Uten et tak skjer $200-dager uten at du legger merke til det. RUN-indikatoren på statuslinjen gjør kostnad per tur synlig. Hvis en enkelt tur krysser $1 (🔴), er konteksten din for stor.

---

## 📚 Dokumentasjon

- [Guide for promptcache](guides/prompt-cache-guide.md) — Hvorfor det meste av kostnaden din er cache, hvordan caching fungerer på tvers av leverandører (Anthropic, OpenAI, Gemini) og hvordan du håndterer det ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Kostnadsanalyse Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Minst 24–38 % billigere enn Opus 5 ved lik kvalitet, over 2 782 økter
- [Kostnadsanalyse Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Kostnadsanalyse Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Side-ved-side kostnadssammenligning over 8 563 API-anrop
- [Kostnadsanalyse Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Lisens

Apache-2.0
