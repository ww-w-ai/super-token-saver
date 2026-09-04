# super-token-saver

**De enige Claude Code-plugin die daadwerkelijk de broncode van CC leest om te vinden waar je tokens naartoe gaan — en het automatisch oplost. Minder uitgeven, langer coderen.**

> Gemeten resultaat: **45% kostenbesparing** bij een echte werklast van $326/dag → $180/dag. Automatische SubTask-delegatie, contextherstel zonder kosten, een volledig analysedashboard en een bewaker tegen cachevervaldatum — in één installatie, nul configuratie.

Werkt met **Max Plan ($200/maand)** en **API betaal-per-gebruik**. Dezelfde plugin, dezelfde functies. Krachtiger voor elke gebruiker — vooral wanneer elk token echt geld is.

![Gebruiksdashboard — zie precies waar je tokens naartoe gaan](docs/images/usage-view-overview.png)

### Wat het in 30 seconden doet

| Functie | Wat er gebeurt | Impact |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delegeert zwaar werk automatisch naar SubTasks (37,5% goedkopere cache) | Context blijft klein, kosten dalen |
| 🪶 Concise Mode | Snijdt responsopvulling weg, behoudt de kern | Minder uitvoertokens per respons |
| 🔄 /s-continue | Vervangt /compact — nul LLM-aanroepen, nul kosten, nul informatieverlies, en herstelt nu ook **Codex**-sessies | Gratis contextherstel over beide tools |
| 🤝 /s-compact | Schrijft een sessieoverdracht die /s-continue automatisch laadt — legt subagent-bevindingen & tool-resultaten vast die het transcript verliest | De volgende sessie hervat ook met de verborgen context |
| 📊 Status Line | Realtime kosten, contextgrootte, snelheidslimiet — onder 50ms | Zie problemen voordat ze je geld kosten |
| 📈 /usage-view | Interactief HTML-dashboard met AI-analyse | Volledige kostenforensica met één klik |
| ✂️ /setup-git-lite | Verwijdert 2.200 verborgen tokens die CC elke sessie injecteert | ~$48/maand bespaard alleen al op git-instructies |
| 🛡️ Token Guardian | Waarschuwt je op het moment dat een cachevervaldatum je context opnieuw verzendt, of blokkeert het in `block`-modus | Geen stille $9-verrassingen meer |

---

## 😤 Het probleem

**Onzichtbare kosten.** Geen realtime zichtbaarheid. Geen waarschuwing "je context is op 800K". Geen alert "cache is 3 minuten geleden vervallen". Je komt er pas achter nadat de schade is aangericht.

**Contextopblazing.** Dezelfde prompt bij 200K versus 800K context kost 4x zoveel. Elke Read, Grep, Edit stuurt de volledige context opnieuw. Één complexe prompt activeert 15+ API-aanroepen, elk vermenigvuldigd met jouw contextgrootte.

**Cache vervallen.** Je komt terug van de lunch. Cache is weg. Één prompt stuurt 900K tokens opnieuw met volle prijs. $9 in één keer.

**Alles handmatig.** Contextbeheer, tijdstippen van cachevervaldatum, SubTask-delegatie, sessieopruiming. Niemand kan dit allemaal bijhouden terwijl hij eigenlijk aan het coderen is.

**Max Plan ($200/maand)?** Al het bovenstaande, plus een 5-uurse snelheidslimiet die je workflow onderbreekt zonder timer of ETA.

**API betaal-per-gebruik?** Al het bovenstaande, behalve dat er geen plafond is. Eén cache-mislukking = $9 echt geld. Tien keer per week = $360/maand alleen aan ongelukken. Een slechte dinsdag met opgeblazen context kan meer kosten dan een Max Plan-abonnee in een maand betaalt.

super-token-saver handelt dit alles automatisch af. **Eén keer installeren. Klaar.**

---

## 🚀 Installatie

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Werkt automatisch na installatie. Nul configuratie. Vereist [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Voor live monitoring:

```
/setup-statusline install
```

Om 2.200 verborgen tokens te verwijderen uit de ingebouwde git-instructies van CC ([details](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---


## 🧠 Functie 1: Slimme sessiearchitectuur

**Installeer het en kostengeoptimaliseerde werkpatronen treden automatisch in werking.**

De meeste gebruikers doen alles in de Main-sessie. Bestanden lezen, code genereren, tests uitvoeren. Elke uitvoer hoopt op in de context en wordt met elk bericht opnieuw verzonden. De sessie groeit op. Kosten stapelen zich op als een sneeuwbal.

Session Architect injecteert automatisch een delegatiestrategie bij het begin van de sessie.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rol              | Ontwerp, beslissingen, beoordeling | Implementatie, codegeneratie, meerdere bestanden |
| Cache-laag       | 1 uur (ephemeral_1h)              | 5 minuten                             |
| Cache-schrijfkosten | ＄10/MTok                       | ＄6.25/MTok                            |
| Contextgrootte   | ~94K gemiddeld                    | ~33K gemiddeld                        |

SubTasks hebben **37,5% goedkopere cache-schrijfbewerkingen** dan Main. De context is ook veel kleiner. Zwaar werk delegeren aan SubTasks verlaagt de kosten drastisch.

**Resultaat:** Context blijft onder 250K in plaats van te groeien naar 600K+. Zelfde werkprestaties, halve tokenkosten. Volledig automatisch.

---

## 🪶 Concise Mode

**Dezelfde inhoud. Minder opvulling. Standaard ingeschakeld.**

De SessionStart-hook injecteert ook een responsstijlregel die in **elke sessie en elk model** loopt — geen vlaggen, geen instelling. Drie dingen veranderen:

- **Preambule eruit** — geen "Laat me controleren…", "Ik zal nu…", jouw vraag herhalen of samenvatten wat de diff al laat zien
- **Juist formaat voor de inhoud** — opsommingstekens voor lijsten, proza voor redeneren (afwegingen, causaliteit, motivering). Geen van beide wordt afgedwongen
- **Strakker taalgebruik** — hetzelfde punt, minder woorden. Helderder proza is korter proza

Harde limiet: nooit inhoud weglaten, verificatie overslaan of nuance samendrukken tot één zin. De kern blijft volledig; alleen de verpakking krimpt.

Eén keer installeren, overal van toepassing.

---

## 🔄 Functie 2: /s-continue — Contextherstel

**Vervangt `/compact`. Nul LLM-aanroepen. Nul tokenkosten. Nul informatieverlies.**

`/compact` stuurt je volledige context (~1M tokens) naar de LLM om het te comprimeren tot een samenvatting van 3,3%. Als de cache is verlopen, activeert dat alleen al een volledige herrecaching. Informatieverlies is onvermijdelijk.

`/s-continue` neemt een compleet andere aanpak. Het verwerkt het vorige sessietranscript vooraf en laadt het direct. Geen LLM-aanroep. Geen kosten. Het originele gesprek wordt hersteld zoals het was.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Hoe het werkt           | Stuurt volledige context naar LLM voor samenvatting | Verwerkt transcript vooraf, leest direct |
| LLM-aanroepen           | Vereist (doorgaans 100K+ tokens)  | 0                                |
| Tokenkosten             | Hoog                              | 0                                |
| Informatieverlies       | Ja (samenvatting van 3,3%)        | Geen (origineel bewaard)         |
| Verwerkingssnelheid     | Tientallen seconden               | < 1 sec (zelfs 60MB+ bestanden)  |
| Wanneer cache verlopen is | Extra volledige herrecachingkosten | Geen impact                    |
| Herstel meerdere sessies | Niet mogelijk                    | Ondersteund                      |

Gebruik: `/clear` dan `/s-continue`. Je ziet een lijst met vorige sessies. Kies er een om te herstellen. Voor snel herstel: `/s-continue last`.

**Resultaat:** Hervat eerder werk zonder kosten. Geen informatieverlies. Verwerkt 60MB+ transcripts in minder dan 1 seconde.

### 🤝 De tegenhanger: `/s-compact` — draag de verborgen laag over

`/s-continue` herstelt het **transcript** — wat jij en Claude hebben gezegd. Maar de nuttigste kennis
van een werksessie leeft vaak BUITEN die dialoog: wat een **subagent** heeft gevonden (het transcript
daarvan is een apart bestand dat het herstel nooit laadt), een beslissend **getal in tool-uitvoer**
(een testaantal, een benchmark), een **les die tijdens het proces is geleerd** ("kon niet reproduceren
in headless-modus → het lag aan de build, niet aan de code").

Voer `/s-compact` uit aan het **einde** van een sessie en het distilleert precies die verborgen laag
tot een overdracht, opgeslagen in `~/.claude/super-token-saver-data/<project>/handoff.md`. In de
volgende sessie laadt `/s-continue` deze **automatisch** bovenop het herstelde transcript — niets plakken nodig.

|                     | Alleen `/s-continue`           | `/s-compact` + `/s-continue` (het duo)          |
| ------------------- | -------------------------------- | ------------------------------------------------ |
| Herstelt            | Het transcript (wat gezegd is)   | Het transcript **plus** de verborgen laag         |
| Subagent-bevindingen | Verloren (aparte bestanden)     | Gedistilleerd in de overdracht                     |
| Getallen uit tool-uitvoer | Alleen indien in de chat geciteerd | Doelbewust geëxtraheerd                     |
| Procesinzichten     | —                                 | Vastgelegd zodat doodlopende paden niet herhaald worden |

**De workflow:** sluit een sessie af met `/s-compact` → start de volgende met `/s-continue`.


### 🔀 Eén geschiedenis voor twee tools — Codex-sessies herstel je hier ook

Codex schrijft zijn sessies naar `~/.codex/sessions/`; Claude Code schrijft naar `~/.claude/projects/`. Geen van beide leest de bestanden van de ander. Een sprint waarvan het budget in Codex opraakte, was dus onbereikbaar vanuit Claude Code — en omgekeerd net zo.

`/s-continue` toont en herstelt nu allebei. Een Codex-rollout gaat niet naar een tweede parser — hij wordt herschreven naar precies het formaat waarin Claude Code schrijft, **één uitvoerregel per invoerregel**, zodat dezelfde pipeline beide tools bedient en elke `L{n}`-markering nog steeds naar exact dezelfde regel in het oorspronkelijke Codex-bestand wijst. Gemeten: een 12 MB, 1,540-line rollout wordt in **0.13 s** voorverwerkt.

|                            | Claude Code-sessie | Codex-sessie |
| -------------------------- | -------------------- | -------------- |
| Getoond door `/s-continue` | Ja | Ja, beperkt tot het huidige project |
| Hersteld zonder LLM-kosten | Ja | Ja |
| `L{n}`-sprong naar origineel | Ja | Ja — regelnummers komen uit de rollout zelf |
| Herstel na contextverlies (`#0`) | `/compact`, auto-compact | Codex-compactie en thread-rollback |
| `/s-compact`-overdracht | Gedeeld per project — schrijf in de ene tool, laad in de andere |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Twee details maken het verschil tussen een correcte lijst en een aannemelijk ogende foute: Codex' `session_id` is het id van de **thread**, dat een gestarte subagent overneemt, dus sessies worden geïdentificeerd op `payload.id` en subagent-rollouts worden er op dezelfde manier uitgefilterd als Claude Code al doet met zijn eigen subtask-transcripten. En `<codex_internal_context source="goal">` wordt door de machine zelf ingevoegd, dus die blijft in het herstelde context staan maar telt nooit mee als een beurt die jij hebt getypt.

De plugin installeert zich ook in Codex — zie **[README-CODEX.md](./README-CODEX.md)**
([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)).
`usage-view`, `report-limit` en `setup-statusline` blijven voorlopig exclusief voor Claude Code.

---

## 📊 Functie 3: Live statusregel

**Realtime token-/kostenbewaking. Minder dan 50ms overhead.**

Voer `/setup-statusline install` eenmalig uit en een permanente statusbalk verschijnt onderaan Claude Code.

**Normale werking** — elke metriek in één oogopslag, nul contextomschakeling:

![Statusregel in normale staat](docs/images/statusline-normal.png)

**Snelheidslimiet bereikt** — 5H wordt rood bij 102%, het aftellen laat precies zien wanneer je terug bent, en een `/report-limit`-actie verschijnt automatisch met één tik:

![Statusregel bij snelheidslimiet](docs/images/statusline-rate-limited.png)

| Indicator        | Wat het toont                       | 🟢 Normaal | 🟡 Waarschuwing | 🔴 Kritiek |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Kosten van de laatste API-aanroep   | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Gecumuleerde kosten voor deze map   | —         | —          | —           |
| 5H               | Gebruik 5-uursvenster + resetaftelling | < 70%     | >= 70%     | >= 90%      |
| CTX              | Gebruik contextvenster              | < 35%     | >= 35%     | >= 70%      |

Wanneer een indicator het waarschuwings- of kritieke niveau bereikt, verschijnt automatisch een hint `→ /usage-view current`.

Om te verwijderen: `/setup-statusline uninstall` (vorige configuratie automatisch hersteld).

**Resultaat:** Elk kostenprobleem zichtbaar in realtime. Minder dan 50ms overhead — geen merkbare vertraging.

> **Gebruik je API betaal-per-gebruik?** De indicatoren 5H en W worden automatisch verborgen — je hebt geen snelheidslimietvensters. Wat overblijft is wat telt: RUN (realtime kosten per beurt) en CTX (contextgrootte). De twee hendels die je rekening beheersen, altijd zichtbaar.

---

## 📈 Gebruiksdashboard (/usage-view)

**Eindelijk antwoord: "Waar is al dat geld naartoe gegaan?"**

Max Plan-gebruikers bereiken de snelheidslimiet en vragen zich af waarom. API-gebruikers openen de Anthropic-factuur en vragen zich af hoe. In beide gevallen is de vraag dezelfde: welke sessie verbrandde de meeste tokens? Wanneer schoten de kosten omhoog? Welke patronen bestaan er in je gebruik? Tot nu toe — allemaal onzichtbaar.

`/usage-view` laat alles zien. Een interactief HTML-dashboard opent in je browser, waarmee je gebruikspatronen kunt analyseren en de hoofdoorzaak van kostenpieken kunt traceren. Geen externe afhankelijkheden. Werkt zelfstandig. Deelbaar als bestand.

**$4.196 in 31 dagen. Waar is het allemaal naartoe gegaan?** Eén blik — totale kosten, tokenopstelling per type, cache-efficiëntieverhouding en sessieaantal. Het ringdiagram laat onmiddellijk zien dat 65% van je uitgaven cache-reads zijn (wat normaal en gezond is):

![Overzicht gebruiksdashboard](docs/images/usage-view-overview.png)

**Voor en na — gemeten, niet geraden.** De oranje gestippelde markering "Plugin installed" splitst je kostentijdlijn in tweeën. Dagelijkse balken zijn gestapeld per tokentype (Input/Output/Cache Write/Cache Read), zodat je precies kunt zien welk onderdeel na installatie veranderde. De gemiddelde lijn toont de trend:

![Dagelijkse kostentrend](docs/images/usage-view-daily-trend.png)

**Wanneer verbrand je het meest?** Kosten per uur op tijdstip van dag en dag-van-de-week-analyse. Schakel tussen actief-dag-gemiddelde, heel-dag-gemiddelde of maximum. Vuurpictogrammen markeren je duurste uren — zichtbare patronen (nachtelijke codeersessies, woensdagpieken) springen er meteen uit:

![Uurlijks en dag-van-de-week kostenpatroon](docs/images/usage-view-hourly-pattern.png)

**Word je efficiënter?** De Total/Output-verhouding meet hoeveel tokens worden verbruikt per geproduceerde uitvoertoken. Lager is beter. De markering "Plugin installed" laat je voor en na vergelijken. Pieken = cache-missers of sessie-herstarts:

![Efficiëntietrend](docs/images/usage-view-efficiency.png)

**Elke API-aanroep, uitgezet op contextgrootte en kosten.** Dit is de grafiek die de kostenstructuur duidelijk maakt. Elke stip is één API-aanroep. Rood = Opus, blauw = Sonnet, groen = Haiku. De stippellijnen zijn theoretische prijzen — als je stippen boven de lijn liggen, betaal je te veel. Schakel naar de **User Turn**-weergave om kosten per gesprekswisseling te zien in plaats van per API-aanroep.
Beweeg de muis over een stip om de werkelijke prompttekst, het aantal tokens en de volledige kostenuitsplitsing te zien (Input/Output/Cache Write/Cache Read):

![Kosten per contextgrootte — spreidingsdiagram](docs/images/usage-view-cost-scatter.png)

**Hoe groot zijn je contexten?** De meeste aanroepen clusteren onder 250K. De lange staart boven 350K is waar kosten exploderen — deze grafiek laat precies zien hoe vaak je in de gevarenzone zit:

![Verdeling contextgrootte](docs/images/usage-view-context-dist.png)

**Je codeerrooster, geprijsd per uur.** Een 5-uursvenster warmtekaart over 30 dagen. Groen (<$15/u), oranje ($15-30/u), rood ($30+/u). Het doodshoofd (💀) markeert vensters waar je de snelheidslimiet raakte. De kostenschuifregelaar bovenaan filtert goedkope vensters eruit zodat dure vensters opvallen — sleep om meteen je slechtste dagen te vinden. Schakel tussen 5-uursvenster en 1-uursblok weergaven:

![Uurlijkse gebruikskalender warmtekaart](docs/images/usage-view-calendar.png)

**Klik op een cel om in te zoomen op de sessies van dat venster.** Elke sessie in dat tijdvak, met kosten, berichtenaantal, tokenopstelling en de werkelijke eerste/laatste berichten van elk gesprek. Vouw "Top Token Conversations" uit om te zien welke specifieke uitwisselingen het meest verbrandden — elk item toont de prompttekst, kostenwaarschuwingstags en optimalisatiehints:

![Sessiedetailpaneel](docs/images/usage-view-session-drilldown.png)

**AI-analyse (optioneel).** Wanneer je `/usage-view` uitvoert zonder `--no-ai`, leest een AI-analist al je dashboardgegevens — met ingebouwde API-prijsreferentie — en maakt een geschreven rapport: kostendriver, anomalieën, optimalisatieaanbevelingen. Automatisch weergegeven in de taal van je besturingssysteem (23 talen, RTL inbegrepen; grafieken/tabellen blijven altijd LTR):

**Waar het geld naartoe ging** — totale uitgaven, kostendrivers per tokentype, wekelijkse trend en plugin-impact gemeten in echte cijfers:

![AI-analyse — kostenuitsplitsing](docs/images/usage-view-ai-report-1.png)

**Wanneer en hoe je werkt** — piekuren, drukste dagen, API-aanroepdistributie en snelheidslimietpatronen die optimalisatiemogelijkheden onthullen:

![AI-analyse — werkpatronen](docs/images/usage-view-ai-report-2.png)

**Wat je eraan kunt doen** — concrete, op data gebaseerde aanbevelingen afgestemd op je werkelijke gebruik. Modelwisseling, contextbeheer, sessiestrategie:

![AI-analyse — aanbevelingen](docs/images/usage-view-ai-report-3.png)

**Deel het.** Het volledige dashboard is één op zichzelf staand HTML-bestand — alle gegevens ingebed, geen server nodig. Stuur het naar je team, manager of accountant. Geen externe afhankelijkheden. Werkt offline. Gebruik de `private`-modus om alle prompttekst te verwijderen vóór het delen — behoudt kostenanalyse terwijl gespreksinhoud wordt verwijderd.

```
/usage-view                  # Alle tijd, alle projecten
/usage-view current          # Alleen huidige 5-uursvenster
/usage-view last 7 days      # Afgelopen 7 dagen
/usage-view locale ja        # Japans
/usage-view --no-ai          # AI-analyse overslaan (sneller)
/usage-view private          # Prompttekst verwijderen (veilig te delen)
```

---

## 🔬 Snelheidslimietonderzoek (/report-limit)

**Community-gedreven project om de snelheidslimietformule te reverse-engineeren.**

Anthropic publiceert de exacte formule voor het 5-uursvenster niet. Laten we het samen uitzoeken.

Wanneer je een snelheidslimiet bereikt, voer `/report-limit` uit. Je huidige gebruiksgegevens worden automatisch ingediend als GitHub Discussion. Hoe meer data we verzamelen, hoe duidelijker de formule wordt.

---

## ✂️ Functie 4: /setup-git-lite — Snij CC's ingebouwde git-instructies bij

**We lazen de broncode van Claude Code. We vonden 2.200 verborgen tokens die elke sessie worden geïnjecteerd en waarvoor je stilletjes betaalt.**

### De ontdekking

Op 2026-04-12 onthulde een [GitHub-issue](https://github.com/anthropics/claude-code/issues/47107) dat de ingebouwde `includeGitInstructions`-instelling van Claude Code elke sessie stilletjes tokens verbrandt. Onafhankelijke reproductie via [deze gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bevestigde de cijfers: **+6.031 tokens in cache-schrijfbewerkingen** per sessie na elke git-commit, **+1.690 tokens in cache-reads** bij elke API-aanroep.

### CC-bronanalyse — waar de tokens naartoe gaan

We volgden de tokens naar twee onafhankelijke injectiepunten in de Claude Code-broncode (v2.1.88):

**1. `gitStatus`-snapshot (~500 tok) — systeemprompt**
- `context.ts:36-111` `getGitStatus()` verzamelt branch + hoofdbranch + user.name + volledige status (tot 2000 tekens) + **recente 5 commits**
- Samengevoegd en toegevoegd aan systeemprompt via `appendSystemContext` (`utils/api.ts:437`)
- Elke nieuwe commit, elk nieuw gewijzigd bestand, elke branchwissel wijzigt de tekst → prefix-cache-invalidatie

**2. Commit-/PR-workflowinstructies (~1.700 tok) — Bash-toolbeschrijving**
- `tools/BashTool/prompt.ts:53` voegt 60+ regels veiligheidsprotocol, stapsgewijze commitprocedure, HEREDOC-voorbeelden en PR-aanmaakmallonen toe aan de beschrijving van de `Bash`-tool
- Gecached naast systeemprompt, maar verzonden als `tools[]`-parameter

### Waarom het duur is

De cachestructuur (`utils/api.ts:321` `splitSysPromptPrefix`) heeft drie paden gebaseerd op of je actieve MCP-tools hebt:

- **Pad A** (MCP actief — de meeste gebruikers): `gitStatus` zit in een `cacheScope: 'org'`-blok. Elke wijziging → heel blok opnieuw gecached bij volgende sessiestart → 6K tok `cache_create`-mislukking.
- **Pad B** (geen MCP): `gitStatus` gaat naar een `cacheScope: null` dynamisch blok, wat betekent dat het wordt verzonden als verse `input_tokens` bij elke API-aanroep — geen cache-mislukking, maar ook geen cachebesparingen.
- **Pad C** (externe provider / experimentele bèta's uitgeschakeld): hetzelfde als pad A.

In typische interactieve sessies stapelen de commit/PR-instructies (1,7K tok) zich **bij elke API-aanroep** op via `cache_read`. Bij een sessie van 100 aanroepen bij Opus 4.7-prijzen is dat ruwweg **$0,08 per sessie** alleen voor instructies die Claude's training al grotendeels dekt.

### Hoe super-token-saver het aanpakt

`/setup-git-lite` schakelt het native pad uit en injecteert een **zorgvuldig samengestelde vervanging van 280 tokens** via een SessionStart-hook. We behielden precies de dingen die Claude's standaardgedrag overschrijven (veiligheidsregels) en lieten alles vallen wat Claude al uit training weet (stapsgewijze workflows, PR-mallonen, gh-gebruikspatronen).

**Behouden — 11 kritieke overschrijvingsregels** (degenen die Claude's standaardbehulpzaamheid omzetten in voorzichtigheid):
- Nooit commit/push/amend/PR/tag/merge zonder expliciete gebruikersverzoek
- Nooit hooks overslaan, force-push naar main/master, destructieve operaties uitvoeren, git-config wijzigen
- Nooit bestanden committen die overeenkomen met `.env`, `credentials`, `*.pem`, `secret.*`
- Vermijd `git add -A` / `git add .`
- HEREDOC voor meerdere-regel commitberichten + `Co-Authored-By: Claude`-trailer
- Nooit interactieve vlaggen (-i) gebruiken, geen lege commits
- Als pre-commit-hook mislukt → maak een NIEUWE commit (niet `--amend`)

**Weggelaten** — stapsgewijze commit-workflow (3 stappen), stapsgewijze PR-workflow (3 stappen), PR-titel-/hoofdtekstmallon, `gh`-commandoverwijzingen, `-uall`-vlagwaarschuwing, `--no-edit` met rebase-waarschuwing, `NEVER use TodoWrite or Agent tools during commit`-beperking. Dit is workflowuitgebreidheid die Claude alleen al uit training correct samenstelt.

**Toegevoegd** — compacte git-statusregel: branch + HEAD korte-sha + onderwerp + huidige status (tot 20 gewijzigde bestanden, anders een telling). Geen lijst met recente commits (Claude kan `git log` op aanvraag uitvoeren).

### Verwachte besparingen (Opus 4.7-prijzen, $25/MTok uitvoer, $5/MTok invoer, $0,50/MTok cache-read)

| Item | Origineel | Met setup-git-lite | Bespaard |
| ---- | -------- | ------------------- | ----- |
| Systeemprompt laden (per nieuwe sessie) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Herhaalde aanroepen in dezelfde sessie | ~1.700 tok cache_read/aanroep | ~280 tok cache_read/aanroep | ~1.420 tok/aanroep |
| Sessie van 100 aanroepen (Opus 4.7) | — | — | **~$0,11 bespaard** |
| 20 sessies/dag × 22 werkdagen | — | — | **~$48 bespaard/maand** |

### Gebruik

```bash
/setup-git-lite status     # Alleen-lezen diagnose — huidige staat + wat zou veranderen
/setup-git-lite install    # CC native uitschakelen + onze minimale hook inschakelen
/setup-git-lite revert     # Standaard herstellen (agressief; zie hieronder)
/setup-git-lite dismiss-banner    # De occasionele aanbevelingstip dempen
/setup-git-lite undismiss-banner  # De tip opnieuw inschakelen
/setup-git-lite help       # Volledig gebruik
```

### Installatiesemantiek

`install` wijzigt **twee** plaatsen voor robuustheid:

1. `~/.claude/settings.json` — voegt `"includeGitInstructions": false` toe
2. Shell-profiel (`~/.zshrc`, `~/.bashrc`, enz.) — voegt een markeringsblok toe dat `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` exporteert

Elk van beide is voldoende om CC native uit te schakelen; we stellen beide in zodat een omgevingsoverschrijving het native gedrag niet per ongeluk opnieuw inschakelt. De shellwijziging is alleen van kracht in nieuwe shells.

### Terugdraaisemantiek — agressief

`revert` **verwijdert ALLE `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-exports uit je shell-profiel**, inclusief eventuele die je handmatig hebt toegevoegd vóór het installeren van deze skill. Dit is opzettelijk — je voerde `revert` uit, dus we herstellen de schone standaard. We maken altijd eerst een tijdgestempelde back-up van het shell-profiel.

Als je de omgevingsvariabele om niet-gerelateerde redenen nodig hebt, noteer hem dan vóór het uitvoeren van `revert` en voeg hem daarna opnieuw toe.

### Vóór het verwijderen van super-token-saver

**Voer eerst `/setup-git-lite revert` uit**, anders blijf je achter met `includeGitInstructions: false` in je settings.json maar zonder vervangingshook (Claude krijgt helemaal geen git-richtlijnen). Claude Code heeft momenteel geen plugin-uninstall-lifecycle-hook, dus we kunnen dit niet automatiseren.

### Afwegingen

Wat je verliest (en waarom het meestal prima is):
- Claude ontvangt niet langer een vooraf berekende `git status` / `git log -n 5` bij sessiestart. Als je in een nieuwe sessie vraagt "wat is er veranderd?", voert Claude die commando's zelf uit (één extra toolaanroep, ~300 tok).
- Claude ziet niet langer CC's canonieke 3-staps commitprocedure. In onze tests over honderden commit-flows handelt kennis op trainingsniveau de kritieke gevallen af (HEREDOC-opmaak, geen `--amend`, geen force-push) omdat we die als expliciete regels behouden.
- PR-tekstmallon (`## Summary` + `## Test plan`) wordt niet geïnjecteerd. Als je precies dat formaat belangrijk vindt, zet het dan in de CLAUDE.md van je project.

### Aanbevelingsbanner

Wanneer de native git-instructies van CC nog steeds actief zijn op je machine, toont super-token-saver bij sessiestart **~20% van de tijd** een alinea-tip (plus in de uitvoer van `/usage-view` en `/report-limit`). Permanent dempen met `/setup-git-lite dismiss-banner`.

---

## 🛡️ Functie 5: Token Guardian

**Vertelt je op het moment dat een cachevervaldatum je geld kost. Kan de $9-herverzending blokkeren als je dat wilt.**

De promptcache van Claude Code leeft 1 uur. Stap langer dan dat weg en de cache verloopt. Je volgende bericht stuurt de volledige context opnieuw met volle prijs. Bij 900K tokens is dat $9 in één keer.

Token Guardian houdt bij wanneer de laatste reactie werd ontvangen. Als er meer dan 3.590 seconden zijn verstreken (de TTL minus een buffer van 10 seconden), kan het ingrijpen. **Het staat standaard uit, vanwege Remote Control.** Het blokkeerbericht van een hook wordt lokaal weergegeven als een systeembericht dat de externe client nooit ontvangt, dus een externe gebruiker zag de prompt zonder uitleg verdwijnen. In plaats van een beveiliging uit te brengen die zich anders gedraagt afhankelijk van waar je zit, hebben we hem uitgezet. Zodra Remote Control hookberichten begint door te sturen, gaat de standaard weer aan. Tot die tijd zet je hem zelf aan met een van de twee modi.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude vermeldt de vervaldatum in de eerste regel van zijn antwoord
export CC_TOKEN_SAVER_CACHE_GUARD=block   # de prompt wordt één keer geweigerd met onderstaand bericht
```

In `warn` gaat de prompt door, en Claude opent zijn antwoord met één regel die zegt dat de cache was verlopen, dat deze beurt de volledige context heeft betaald, en dat na een pauze van een uur of langer `/clear` → `/s-continue` de goedkopere weg terug is. Deze bereikt wel een externe client, omdat Claude's antwoord wordt doorgestuurd, ook al worden hookberichten dat niet.

In `block` wordt de prompt één keer geweigerd met onderstaand bericht. Stuur hem opnieuw en hij gaat door. Gebruik dit in een lokale terminal wanneer je de harde stop wilt.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Het blokkeerbericht wordt weergegeven in 23 talen, gekozen op basis van je OS-locale, en verschijnt één keer per inactieve periode.

**Achtergrondagents worden nooit geblokkeerd.** Alleen prompts die een mens heeft getypt, krijgen de controle. Voltooiingsrapporten van achtergrondagents en -taken, die tegenwoordig vaak meer dan een uur na het starten binnenkomen, gaan er gewoon doorheen. Het resultaat van een langlopende agent wordt nooit opgehouden of verloren.

**Resultaat:** in waarschuwingsmodus weet je altijd wanneer een herverzending van $9 heeft plaatsgevonden, en waarom. In blokkeermodus gebeurt het niet: elke onderschepte vervaldatum bespaart $9, en bij één per dag is dat $270/maand aan pure verspilling geëlimineerd.

> **Bij betaal-per-gebruik raakt dit harder.** Een Max Plan-abonnee verliest $9 binnen een buffer van $200. Jij verliest $9 echt geld, stilletjes, elke keer dat je wegstapt. Blokkeermodus stopt het elke keer.

---

## 💡 Hoe cache echt werkt (en waarom de meeste gebruikers er 40%+ aan verspillen)

Claude Code stuurt bij elke API-aanroep de volledige gespreksgeschiedenis naar het model. "API-aanroep" betekent niet "één bericht dat je hebt getypt." Een enkele prompt activeert interne toolaanroepen — Grep, Read, Edit, Write — en elk daarvan is een aparte API-aanroep. Eén prompt veroorzaakt gemakkelijk 10+ API-aanroepen.

Promptcache vermindert deze kosten met 90%. Maar cache heeft een levensduur.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 uur (ephemeral_1h)                  | 5 minuten                              |
| Cache-schrijfbewerking | ＄10/MTok                           | ＄6.25/MTok                             |
| Cache-leesbewerking | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Wanneer cache verloopt | Volledige context opnieuw verzonden tegen volle prijs | Weinig impact (context is klein)   |

Zelfs met cache actief lopen de kosten op. Hier is een extreem scenario om het verschil te laten zien.

### Scenario: Volledige dag coderen (3u ochtend → 2u lunch/vergadering → 3u middag)

Omstandigheden: Opus 4-prijzen, 1 prompt per minuut, ~5 API-aanroepen per prompt (~300 aanroepen/uur).

#### ❌ Zonder super-token-saver

Het meeste werk vindt plaats in de Main-sessie. Context groeit snel.

| Fase        | Situatie                          | Contextgrootte              | Kosten                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Ochtend 3u  | Coderen (voornamelijk in Main)    | 100K → 600K (gem. 350K)    | 900 aanroepen × 350K × ＄0.50/M = ＄157.50  |
| Lunch/verg. | 2 uur weg                         | —                          | —                                      |
| Terugkeer   | Cache verlopen → volledige herverzending | 600K volle prijs     | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Terugkeer   | /compact (samenvatten)            | 600K → verzonden naar LLM  | 600K × ＄0.50/M + samenvatting uitvoer = ~＄1.50 |
| Middag 3u   | Coderen gaat door (context groeit opnieuw) | 100K → 600K (gem. 350K) | 900 aanroepen × 350K × ＄0.50/M = ＄157.50 |
|             | Totaal                            |                            | ~＄326                                  |

> Bij dit gebruiksniveau zul je waarschijnlijk de snelheidslimiet van het 5-uursvenster bereiken. **De kosten zijn slecht, maar het echte probleem is dat je werk volledig stopt. Dit is het exacte moment waarop Claude Code uitvalt.**

#### ✅ Met super-token-saver

Zwaar werk wordt gedelegeerd aan SubTasks. Main handelt alleen ontwerp/beslissingen af.

| Fase        | Situatie                                     | Contextgrootte                | Kosten                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Ochtend 3u  | Coderen (Main: ontwerp, SubTask: implementatie) | Main 100K → 300K (gem. 200K) | 900 aanroepen × 200K × ＄0.50/M = ＄90 |
| Lunch/verg. | 2 uur weg                                    | —                           | —                                  |
| Terugkeer   | ⚡ Token Guardian (block-modus) → /clear + /s-continue | —                        | ＄0 (geen LLM-aanroepen)            |
| Middag 3u   | Coderen gaat door                            | Main 100K → 300K (gem. 200K) | 900 aanroepen × 200K × ＄0.50/M = ＄90 |
|             | Totaal                                       |                             | ~＄180                              |

#### 💰 Resultaat

> **＄326 → ＄180. ＄146 bespaard per dag. 45% kostenbesparing.**
>
> **Max Plan:** Minder tokens = je bereikt de snelheidslimiet niet. Je werk stopt niet. Dat is het echte verschil.
>
> **API betaal-per-gebruik:** ＄146/dag × 22 werkdagen = **＄3.200/maand recht van je factuur.** Een zware maand zonder deze plugin overschrijdt ＄7.000. Met de plugin onder ＄4.000. Zelfde output.

### Waar super-token-saver ingrijpt

```
[Session Start]
    │
    ├─ Session Architect → Injecteert automatisch het SubTask-delegatiepatroon
    │                       Houdt Main-context onder 250K
    │
[Werkend]
    │
    ├─ Status Line → Realtime kosten/context/snelheidslimiet-bewaking
    │                  Onmiddellijk alarm bij binnentreden van waarschuwingszone
    │
[1+ uur inactief]
    │
    ├─ Token Guardian → Detecteert cachevervaldatum, waarschuwt (of blokkeert in block-modus)
    │
[Sessie herstarten]
    │
    └─ /s-continue → Herstelt vorige context zonder kosten (geen LLM-aanroepen)
```

---

## 🔧 Broninstallatie en aanpassing

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver is volledig open-source (Apache-2.0). Gewone JavaScript + Bash — geen gecompileerde binaries, geen externe API-aanroepen, geen telemetrie. Elke regel is controleerbaar. Elke bewering in deze README verwijst naar een specifiek bestand dat je kunt lezen.

- **hooks/** — Verander de vervaldatumdrempel van cache, pas waarschuwingsberichten aan, wijzig sessie-architectuurregels
- **scripts/** — Analyselogica, rapportbouwer, statusregelopmaak
- **skills/** — Hoe /s-continue en /usage-view werken, promptmallonen
- **locales/** — Vertalingen toevoegen/bewerken, nieuwe talen toevoegen
- **skills/usage-view/** — Dashboard UI/UX-ontwerpwijzigingen

Maak het van jou. Fork het, experimenteer en stuur een PR als je iets beters vindt.

---

## 🌐 Ondersteunde talen

23 talen ondersteund. Geselecteerd door de top 20 landen op Claude Code-gebruik te kruisverwijzen met de top 20 talen op mondiaal sprekersaantal. De weergavetaal wordt automatisch gedetecteerd vanuit je OS-locale. Je kunt ook handmatig opgeven: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Huidige vertalingen zijn AI-gegenereerd. Bijdragen van native speakers zijn welkom — bewerk het JSON-bestand voor jouw taal in `locales/` en dien een PR in.

---

## ⚖️ Wat deze plugin je kost

De plugin injecteert context bij sessiestart. Hier is precies hoeveel:

| Injectie | Wanneer | Tokens | Doel |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (eenmalig) | ~1.100 | SubTask-delegatiestrategie + concise mode-regels |
| Git-context (als git-lite ingeschakeld) | SessionStart (eenmalig) | ~280 | Vervangt CC's native ~2.200 tok git-instructies |
| Cache-vervaldatumwaarschuwing | Bij inactiviteit > 59m (eenmalig) | ~200 | Signaleert de dure herverzending, toont het goedkopere pad |
| Status line | Elke API-aanroep | 0 | Wordt weergegeven in de terminale statusbalk, niet in de gesprekscontext |

**Netto overhead per sessie: ~1.400 tokens (eenmalig, gecached na eerste aanroep).**

Bij Opus-prijzen ($0,50/MTok cache-read) is dat **$0,0007 per API-aanroep** — minder dan een tiende cent. Over een sessie van 100 aanroepen: $0,07.

Als git-lite is ingeschakeld, **bespaart** de plugin ~1.920 tokens per sessie (vervangt 2.200 door 280). Het netto-effect is negatief — de plugin verbruikt minder dan het verwijdert.

**Voor API betaal-per-gebruik gebruikers:** bij $3.000/maand uitgaven is de plugin-overhead onder $2/maand. De besparingen alleen al door het voorkomen van cachevervaldatum (één geblokkeerde herverzending van $9 per week) betalen een jaar overhead in één onderschepping.

---

## 💡 Tips

### Begrijp cache en je ziet waar het geld naartoe gaat

- **1 prompt ≠ 1 API-aanroep.** Elke keer dat Claude Grep, Read of Edit aanroept, wordt de volledige context opnieuw verzonden. Een enkele prompt activeert gemakkelijk 10+ API-aanroepen. Schrijf duidelijke prompts om onnodige toolaanroepen te verminderen en kosten te verlagen.
- **De cachetimer reset vanaf de laatste API-aanroep, niet jouw laatste prompt.** Blijf werken en de cache verloopt nooit. Het gevaar is wegstappen. Token Guardian vertelt je wanneer het is gebeurd, en stopt in `block`-modus de prompt één keer zodat je kunt kiezen: de context resetten, of doorgaan zoals het is.
- **Contextgrootte = kostenvermenigvuldiger.** Dezelfde API-aanroep bij 200K versus 800K kost 4x zoveel. Wanneer de statusregel [CTX] 35% (🟡) overschrijdt, is dat je signaal om meer te delegeren aan SubTasks.

### Gewoonten die kosten verlagen

- **Houd CLAUDE.md beknopt.** Het wordt bij elke API-aanroep in de systeemprompt geladen. Elke regel kost geld.
- **Delegeer zwaar werk aan SubTasks.** Codegeneratie, meervoudige bestandsbewerkingen, testruns horen niet in Main. SubTasks hebben een kleinere context en een goedkopere cache-laag.
- **1+ uur weg?** `/clear` → kom terug → `/s-continue`. Context hersteld voor $0.
- **[5H] boven 70% (🟡)?** Vertraag. Schakel over op lichte beoordelingstaken of vergroot SubTask-delegatie om het API-aanroepenaantal van Main te verminderen.
- **Gebruik `/btw` voor zijdelingse vragen.** Het gaat niet in de gespreksgeschiedenis, zodat je context beknopt blijft.

### API betaal-per-gebruik: de gewoonten die het meest tellen

Al het bovenstaande geldt, plus deze API-specifieke prioriteiten:

- **Bekijk [CTX] als een snelheidsmeter.** Geen snelheidslimiet zal je stoppen — maar context bij 500K+ betekent dat elke API-aanroep 2-3x zoveel kost als zou moeten. `/clear` → `/s-continue` is gratis en reset je kostenvermenigvuldiger naar de basislijn.
- **Voer wekelijks `/usage-view` uit.** Max Plan-gebruikers hebben een natuurlijk "au"-moment wanneer ze de snelheidslimiet bereiken. Jij niet — kosten stijgen stilletjes. Het dashboard is je vroegwaarschuwingssysteem.
- **Stel een mentaal dagbudget in.** Zonder een maximum komen $200-dagen voorbij zonder dat je het merkt. De RUN-indicator van de statusregel maakt kosten per beurt zichtbaar. Als een enkele beurt $1 (🔴) overschrijdt, is je context te groot.

---

## 📚 Documentatie

- [Promptcache-gids](guides/prompt-cache-guide.md) — Waarom de meeste kosten cache zijn, hoe caching werkt bij providers (Anthropic, OpenAI, Gemini) en hoe je het beheert ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Kostenanalyse Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Minstens 24–38% goedkoper dan Opus 5 bij gelijke kwaliteit, over 2.782 sessies
- [Kostenanalyse Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Kostenanalyse Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Naast-elkaar-vergelijking over 8.563 API-aanroepen
- [Kostenanalyse Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licentie

Apache-2.0
