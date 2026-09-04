# super-token-saver

**Das einzige Claude Code Plugin, das den CC-Quellcode tatsächlich liest, um herauszufinden, wohin deine Tokens fließen — und es automatisch behebt. Weniger ausgeben, länger coden.**

> Gemessenes Ergebnis: **45 % Kostenreduktion** bei einer realen Auslastung von $326/Tag → $180/Tag. Automatische SubTask-Delegation, kostenfreie Kontextwiederherstellung, ein vollständiges Analyse-Dashboard und ein Schutz vor Cache-Ablauf. Eine Installation, null Konfiguration.

Funktioniert mit **Max Plan ($200/Monat)** und **API Pay-per-Use**. Dasselbe Plugin, dieselben Funktionen. Besser für jeden Nutzer — besonders wenn jedes Token echtes Geld bedeutet.

![Nutzungs-Dashboard — sieh genau, wohin deine Tokens fließen](docs/images/usage-view-overview.png)

### Was es in 30 Sekunden tut

| Funktion | Was passiert | Auswirkung |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delegiert schwere Arbeit automatisch an SubTasks (37,5 % günstigerer Cache) | Kontext bleibt klein, Kosten sinken |
| 🪶 Concise Mode | Reduziert Fülltext, behält das Wesentliche | Weniger Ausgabe-Tokens pro Antwort |
| 🔄 /s-continue | Ersetzt /compact — null LLM-Aufrufe, null Kosten, null Informationsverlust, stellt jetzt auch **Codex**-Sessions wieder her | Kostenfreie Kontextwiederherstellung über beide Tools hinweg |
| 🤝 /s-compact | Schreibt eine Session-Übergabe, die /s-continue automatisch lädt — erfasst Subagent-Erkenntnisse & Tool-Ergebnisse, die das Transkript verliert | Die nächste Session setzt auch mit dem verborgenen Kontext fort |
| 📊 Status Line | Echtzeit-Kosten, Kontextgröße, Rate-Limit — unter 50 ms | Probleme sehen bevor sie Kosten verursachen |
| 📈 /usage-view | Interaktives HTML-Dashboard mit KI-gestützter Analyse | Vollständige Kostenanalyse per Klick |
| ✂️ /setup-git-lite | Entfernt 2.200 versteckte Tokens, die CC jede Sitzung injiziert | ~$48/Monat allein durch Git-Anweisungen gespart |
| 🛡️ Token Guardian | Warnt dich in dem Moment, in dem ein Cache-Ablauf deinen Kontext neu sendet, oder blockiert es im `block`-Modus | Keine stillen $9-Überraschungen mehr |

---

## 😤 Das Problem

**Unsichtbare Kosten.** Keine Echtzeittransparenz. Keine Warnung „dein Kontext ist bei 800.000 Token". Kein Alert „Cache ist vor 3 Minuten abgelaufen". Du erfährst es erst, nachdem der Schaden entstanden ist.

**Kontext-Aufblähung.** Derselbe Prompt kostet bei 200K versus 800K Kontext das Vierfache. Jedes Read, Grep, Edit sendet den vollständigen Kontext erneut. Ein komplexer Prompt löst 15+ API-Aufrufe aus, jeder multipliziert mit deiner Kontextgröße.

**Cache-Ablauf.** Du kommst vom Mittagessen zurück. Der Cache ist weg. Die nächste Nachricht sendet 900.000 Tokens zum vollen Preis neu. $9 auf einen Schlag.

**Alles manuell.** Kontextverwaltung, Cache-Ablauftiming, SubTask-Delegation, Session-Bereinigung. Niemand kann das alles im Blick behalten, während er tatsächlich programmiert.

**Max Plan ($200/Monat)?** Alles oben genannte, plus ein 5-Stunden-Rate-Limit, das deinen Flow ohne Timer und ohne ETA unterbricht.

**API Pay-per-Use?** Alles oben genannte, nur ohne Obergrenze. Ein Cache-Miss = $9 echtes Geld. Zehnmal pro Woche = $360/Monat allein durch Fehler. Ein schlechter Dienstag mit aufgeblähtem Kontext kann mehr kosten als ein Max-Plan-Abonnent im Monat zahlt.

super-token-saver erledigt das alles automatisch. **Einmal installieren. Fertig.**

---

## 🚀 Installation

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Funktioniert nach der Installation automatisch. Null Konfiguration. Benötigt [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Für Live-Monitoring:

```
/setup-statusline install
```

Um 2.200 versteckte Tokens aus CCs eingebauten Git-Anweisungen zu entfernen ([Details](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Funktion 1: Smart Session Architecture

**Installier es, und kostenoptimierte Arbeitsmuster greifen automatisch.**

Die meisten Nutzer erledigen alles in der Main Session. Dateien lesen, Code generieren, Tests ausführen. Jede Ausgabe stapelt sich im Kontext und wird mit jeder Nachricht erneut gesendet. Die Session bläht sich auf. Kosten schneeballartig.

Session Architect injiziert automatisch eine Delegationsstrategie beim Sitzungsstart.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rolle             | Design, Entscheidungen, Review         | Implementierung, Code-Gen, Multi-File  |
| Cache-Tier       | 1 Stunde (ephemeral_1h)             | 5 Min                                 |
| Cache-Schreibkosten | ＄10/MTok                          | ＄6,25/MTok                            |
| Kontextgröße     | ~94K Durchschnitt                          | ~33K Durchschnitt                              |

SubTasks haben **37,5 % günstigere Cache-Schreibvorgänge** als Main. Der Kontext ist auch viel kleiner. Schwere Arbeit an SubTasks zu delegieren senkt die Kosten drastisch.

**Ergebnis:** Kontext bleibt unter 250K statt auf 600K+ zu wachsen. Gleicher Arbeitsoutput, halbe Token-Kosten. Vollautomatisch.

---

## 🪶 Concise Mode

**Gleicher Inhalt. Weniger Fülltext. Standardmäßig aktiviert.**

Der SessionStart-Hook injiziert auch eine Antwortstil-Regel, die in **jeder Session und jedem Modell** läuft — keine Flags, kein Setup. Drei Dinge ändern sich:

- **Kein Vorwort** — kein „Lass mich prüfen…", „Ich werde jetzt…", keine Wiederholung deiner Frage oder Zusammenfassung von dem, was das Diff bereits zeigt
- **Richtiges Format für den Inhalt** — Stichpunkte für Listen, Fließtext für Überlegungen (Abwägungen, Kausalität, Begründung). Keines wird erzwungen
- **Präziserer Ausdruck** — gleicher Punkt, weniger Wörter. Klarerer Text ist kürzerer Text

Hartes Limit: Niemals Inhalte weglassen, Verifizierung überspringen oder Nuancen in einen einzelnen Satz zusammenpressen. Inhalt bleibt vollständig; nur die Verpackung schrumpft.

Einmal installieren, überall angewendet.

---

## 🔄 Funktion 2: /s-continue — Kontextwiederherstellung

**Ersetzt `/compact`. Null LLM-Aufrufe. Null Token-Kosten. Null Informationsverlust.**

`/compact` sendet deinen gesamten Kontext (~1M Tokens) an das LLM, um ihn auf eine 3,3%-Zusammenfassung zu komprimieren. Ist der Cache abgelaufen, löst das allein einen vollständigen Re-Cache aus. Informationsverlust ist unvermeidlich.

`/s-continue` verfolgt einen völlig anderen Ansatz. Es verarbeitet das Transkript der vorherigen Session vor und lädt es direkt. Kein LLM-Aufruf. Keine Kosten. Das ursprüngliche Gespräch wird wie es war wiederhergestellt.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Funktionsweise            | Sendet vollständigen Kontext an LLM für Zusammenfassung | Verarbeitet Transkript vor, liest direkt |
| LLM-Aufrufe               | Erforderlich (typischerweise 100K+ Tokens) | 0                                |
| Token-Kosten              | Hoch                              | 0                                |
| Informationsverlust        | Ja (3,3% Zusammenfassung)                | Nein (Original erhalten)        |
| Verarbeitungsgeschwindigkeit        | Viele Sekunden                   | < 1 Sek (auch bei 60MB+ Dateien)       |
| Bei abgelaufenem Cache   | Vollständige Re-Cache-Kosten on top         | Keine Auswirkung                        |
| Multi-Session-Restore   | Nicht möglich                      | Unterstützt                        |

Nutzung: `/clear` dann `/s-continue`. Eine Liste vorheriger Sessions erscheint. Eine auswählen zum Wiederherstellen. Für schnelle Wiederherstellung: `/s-continue last`.

**Ergebnis:** Vorherige Arbeit zum Nulltarif fortsetzen. Kein Informationsverlust. 60MB+ Transkripte in unter 1 Sekunde verarbeitet.

### 🤝 Sein Gegenstück: `/s-compact` — die verborgene Ebene übergeben

`/s-continue` stellt das **Transkript** wieder her — was du und Claude gesagt habt. Aber das nützlichste
Wissen einer Arbeitssession lebt oft AUSSERHALB dieses Dialogs: was ein **Subagent** herausgefunden hat
(dessen Transkript liegt in einer separaten Datei, die die Wiederherstellung nie lädt), eine entscheidende
**Zahl aus einer Tool-Ausgabe** (eine Testanzahl, ein Benchmark), eine **aus dem Prozess gelernte Lektion**
("konnte im Headless-Modus nicht reproduzieren → lag am Build, nicht am Code").

Führe `/s-compact` am **Ende** einer Session aus, und es destilliert genau diese verborgene Ebene in eine
Übergabe, gespeichert unter `~/.claude/super-token-saver-data/<project>/handoff.md`. In der nächsten
Session lädt `/s-continue` sie **automatisch** zusätzlich zum wiederhergestellten Transkript — kein Einfügen nötig.

|                     | Nur `/s-continue`              | `/s-compact` + `/s-continue` (das Duo)          |
| ------------------- | -------------------------------- | ------------------------------------------------ |
| Stellt wieder her   | Das Transkript (was gesagt wurde) | Das Transkript **plus** die verborgene Ebene     |
| Subagent-Erkenntnisse | Verloren (separate Dateien)    | In der Übergabe destilliert                       |
| Zahlen aus Tool-Ausgaben | Nur wenn im Chat zitiert    | Gezielt extrahiert                                |
| Prozess-Lektionen   | —                                 | Erfasst, damit Sackgassen nicht erneut durchlaufen werden |

**Der Ablauf:** eine Session mit `/s-compact` beenden → die nächste mit `/s-continue` starten.

### 🔀 Zwei Tools, eine Historie — Codex-Sessions lassen sich jetzt hier wiederherstellen

Codex schreibt seine Sessions nach `~/.codex/sessions/`, Claude Code nach `~/.claude/projects/`. Keins der beiden liest die Dateien des anderen — ein Sprint, dem in Codex das Budget ausging, war von Claude Code aus bisher unerreichbar, und umgekehrt genauso.

`/s-continue` listet und stellt jetzt beide wieder her. Ein Codex-Rollout wandert dabei nicht durch einen zweiten Parser, sondern wird **Zeile für Zeile** in das Format umgeschrieben, das Claude Code schreibt — dieselbe Pipeline bedient also beide, und jede `L{n}`-Marke zeigt weiterhin exakt auf die passende Zeile der ursprünglichen Codex-Datei. Gemessen: Ein 12-MB-Rollout mit 1.540 Zeilen wird in **0,13 s** vorverarbeitet.

|                        | Claude-Code-Session | Codex-Session |
| ---------------------- | ------------------- | ------------- |
| Von `/s-continue` gelistet | Ja | Ja, begrenzt auf das aktuelle Projekt |
| Wiederherstellung ohne LLM-Kosten | Ja | Ja |
| Sprung mit `L{n}` ins Original | Ja | Ja — die Zeilennummern stammen direkt aus dem Rollout |
| Wiederherstellung nach Kontextverlust (`#0`) | `/compact`, Auto-Compact | Codex-Compaction und Thread-Rollback |
| `/s-compact`-Übergabe | Projektweit geteilt — in einem Tool geschrieben, im anderen geladen |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Zwei Details entscheiden darüber, ob die Liste stimmt oder nur plausibel aussieht: Codexʼ `session_id` ist die **Thread**-ID, die ein gespawnter Subagent erbt — deshalb werden Sessions über `payload.id` unterschieden, und Subagent-Rollouts werden genauso herausgefiltert wie Claude Codes eigene Subtask-Transkripte. Und `<codex_internal_context source="goal">` wird maschinell eingefügt, bleibt also im wiederhergestellten Kontext erhalten, zählt aber nie als eine von dir getippte Runde.

Das Plugin installiert sich auch in Codex — siehe **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit` und `setup-statusline` bleiben vorerst Claude Code vorbehalten.

---

## 📊 Funktion 3: Live Status Line

**Echtzeit-Token/Kosten-Monitoring. Unter 50 ms Overhead.**

Einmal `/setup-statusline install` ausführen und eine permanente Statusleiste erscheint am unteren Rand von Claude Code.

**Normalbetrieb** — alle Metriken auf einen Blick, null Kontextwechsel:

![Statusleiste im Normalzustand](docs/images/statusline-normal.png)

**Rate-Limit erreicht** — 5H wird bei 102% rot, der Countdown zeigt genau wann du wieder kannst, und eine Ein-Tipp-`/report-limit`-Aktion erscheint automatisch:

![Statusleiste bei Rate-Limit](docs/images/statusline-rate-limited.png)

| Indikator        | Was er zeigt                       | 🟢 Normal | 🟡 Warnung | 🔴 Kritisch |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (Delta)      | Kosten des letzten API-Aufrufs           | < ＄0,30   | >= ＄0,30   | >= ＄1,00    |
| RUN (Kumulativ) | Kumulative Kosten für diesen Ordner     | —         | —          | —           |
| 5H               | Nutzung des 5-Stunden-Fensters + Reset-Countdown | < 70%     | >= 70%     | >= 90%      |
| CTX              | Nutzung des Kontextfensters                | < 35%     | >= 35%     | >= 70%      |

Wenn ein Indikator Warnung oder Kritisch erreicht, erscheint automatisch ein `→ /usage-view current`-Hinweis.

Zum Entfernen: `/setup-statusline uninstall` (vorherige Konfiguration wird automatisch wiederhergestellt).

**Ergebnis:** Jedes Kostenproblem in Echtzeit sichtbar. Unter 50 ms Overhead — keine wahrnehmbare Verzögerung.

> **Bei API Pay-per-Use?** Die 5H- und W-Indikatoren werden automatisch ausgeblendet — du hast keine Rate-Limit-Fenster. Was bleibt, ist das Wichtige: RUN (Echtzeit-Kosten pro Runde) und CTX (Kontextgröße). Die zwei Hebel, die deine Rechnung kontrollieren, immer sichtbar.

---

## 📈 Nutzungs-Dashboard (/usage-view)

**Endlich die Antwort: „Wo ist das ganze Geld hingegangen?"**

Max-Plan-Nutzer erreichen das Rate-Limit und fragen sich warum. API-Nutzer öffnen die Anthropic-Rechnung und fragen sich wie. Die Frage ist in beiden Fällen dieselbe: Welche Session hat die meisten Tokens verbrannt? Wann sind die Kosten gestiegen? Welche Muster gibt es bei deiner Nutzung? Bisher — alles unsichtbar.

`/usage-view` zeigt alles. Ein interaktives HTML-Dashboard öffnet sich im Browser, mit dem du Nutzungsmuster analysieren und die Grundursache von Kostenspitzen zurückverfolgen kannst. Keine externen Abhängigkeiten. Funktioniert standalone. Als Datei teilbar.

**$4.196 in 31 Tagen. Wohin sind sie gegangen?** Auf einen Blick — Gesamtkosten, Token-Aufschlüsselung nach Typ, Cache-Effizienzquote und Sitzungsanzahl. Das Donut-Diagramm zeigt sofort, dass 65 % deiner Ausgaben Cache-Reads sind (was normal und gesund ist):

![Nutzungs-Dashboard-Übersicht](docs/images/usage-view-overview.png)

**Vorher vs. nachher — gemessen, nicht geraten.** Der orangefarbene gestrichelte „Plugin installed"-Marker teilt deine Kosten-Zeitlinie in zwei. Tagesbalkens sind nach Token-Typ gestapelt (Input/Output/Cache Write/Cache Read), sodass du genau siehst, welche Komponente sich nach der Installation verändert hat. Die Durchschnittslinie zeigt den Trend:

![Täglicher Kostentrend](docs/images/usage-view-daily-trend.png)

**Wann verbrauchst du am meisten?** Stündliche Kosten nach Tageszeit und Wochentag-Aufschlüsselung. Zwischen Aktiv-Tage-Durchschnitt, Alle-Tage-Durchschnitt und Maximum umschalten. Flammen-Icons markieren deine teuersten Stunden — sichtbare Muster (nächtliche Marathons, Mittwochspitzen) springen sofort ins Auge:

![Stündliches und wöchentliches Kostenmuster](docs/images/usage-view-hourly-pattern.png)

**Wirst du effizienter?** Das Total/Output-Verhältnis misst, wie viele Tokens pro produziertem Output-Token verbraucht werden. Niedriger ist besser. Der „Plugin installed"-Marker lässt dich vorher vs. nachher vergleichen. Spitzen = Cache-Misses oder Session-Neustarts:

![Effizienztrend](docs/images/usage-view-efficiency.png)

**Jeder API-Aufruf, aufgetragen nach Kontextgröße und Kosten.** Das ist das Diagramm, das die Kostenstruktur klarmacht. Jeder Punkt ist ein API-Aufruf. Rot = Opus, Blau = Sonnet, Grün = Haiku. Die gestrichelten Linien sind theoretische Preise — wenn deine Punkte über der Linie liegen, überzahlst du. Auf **User Turn**-Ansicht umschalten, um Kosten pro Gesprächsrunde statt pro API-Aufruf zu sehen.
Über jeden Punkt hovern, um den tatsächlichen Prompt-Text, Token-Anzahl und vollständige Kostenaufschlüsselung (Input/Output/Cache Write/Cache Read) zu sehen:

![Kosten nach Kontextgröße — Streudiagramm](docs/images/usage-view-cost-scatter.png)

**Wie groß sind deine Kontexte?** Die meisten Aufrufe clustern unter 250K. Der lange Schwanz über 350K ist wo die Kosten explodieren — dieses Diagramm zeigt genau, wie oft du in der Gefahrenzone bist:

![Kontextgrößenverteilung](docs/images/usage-view-context-dist.png)

**Dein Coding-Zeitplan, stündlich bepreist.** Eine 5-Stunden-Fenster-Heatmap über 30 Tage. Grün (<$15/h), Orange ($15-30/h), Rot ($30+/h). Das Schädel-Icon (💀) markiert Fenster, in denen du das Rate-Limit getroffen hast. Der Kosten-Schieberegler oben filtert günstige Fenster heraus, sodass teure hervorstechen — zieh ihn, um sofort deine schlimmsten Tage zu finden. Zwischen 5-Stunden-Fenster- und 1-Stunden-Block-Ansichten umschalten:

![Stündliche Nutzungskalender-Heatmap](docs/images/usage-view-calendar.png)

**Auf eine Zelle klicken, um die Sessions dieses Fensters aufzuschlüsseln.** Jede Session in diesem Zeitslot, mit Kosten, Nachrichtenanzahl, Token-Aufschlüsselung und den tatsächlichen ersten/letzten Nachrichten jedes Gesprächs. „Top Token Conversations" ausklappen, um zu sehen, welche spezifischen Austausche am meisten verbrannt haben — jeder Eintrag zeigt den Prompt-Text, Kosten-Alert-Tags und Optimierungshinweise:

![Session-Detailbereich](docs/images/usage-view-session-drilldown.png)

**KI-gestützte Analyse (optional).** Wenn du `/usage-view` ohne `--no-ai` ausführst, liest ein KI-Analyst deine vollständigen Dashboard-Daten — mit eingebettetem API-Preisreferenz — und erstellt einen schriftlichen Bericht: Kostentreiber, Anomalien, Optimierungsempfehlungen. Automatisch in deiner OS-Sprache angezeigt (23 Sprachen, RTL inklusive; Diagramme/Tabellen bleiben immer LTR):

**Wohin das Geld gegangen ist** — Gesamtausgaben, Kostentreiber nach Token-Typ, Wochentrend und Plugin-Auswirkung in echten Zahlen gemessen:

![KI-Analyse — Kostenaufschlüsselung](docs/images/usage-view-ai-report-1.png)

**Wann und wie du arbeitest** — Spitzenstunden, geschäftigste Tage, API-Aufruf-Verteilung und Rate-Limit-Muster, die Optimierungsmöglichkeiten aufzeigen:

![KI-Analyse — Arbeitsmuster](docs/images/usage-view-ai-report-2.png)

**Was dagegen zu tun ist** — konkrete, datengestützte Empfehlungen, zugeschnitten auf deine tatsächliche Nutzung. Modellwechsel, Kontextverwaltung, Session-Strategie:

![KI-Analyse — Empfehlungen](docs/images/usage-view-ai-report-3.png)

**Teilen.** Das gesamte Dashboard ist eine einzelne selbstständige HTML-Datei — alle Daten eingebettet, kein Server nötig. An dein Team, deinen Manager oder deinen Buchhalter schicken. Keine externen Abhängigkeiten. Funktioniert offline. `private`-Modus nutzen, um alle Prompt-Texte vor dem Teilen zu entfernen — Kostenanalyse bleibt intakt, Gesprächsinhalte werden entfernt.

```
/usage-view                  # Alle Zeit, alle Projekte
/usage-view current          # Nur aktuelles 5-Stunden-Fenster
/usage-view last 7 days      # Letzte 7 Tage
/usage-view locale ja        # Japanisch
/usage-view --no-ai          # KI-Analyse überspringen (schneller)
/usage-view private          # Prompt-Text entfernen (sicher zum Teilen)
```

---

## 🔬 Rate-Limit-Forschung (/report-limit)

**Community-getriebenes Projekt zum Reverse-Engineering der Rate-Limit-Formel.**

Anthropic veröffentlicht die genaue Formel für das 5-Stunden-Fenster nicht. Lass sie uns gemeinsam herausfinden.

Wenn du ein Rate-Limit erreichst, führe `/report-limit` aus. Deine aktuellen Nutzungsdaten werden automatisch als GitHub-Discussion eingereicht. Je mehr Daten wir sammeln, desto klarer wird die Formel.

---

## ✂️ Funktion 4: /setup-git-lite — CCs eingebaute Git-Anweisungen kürzen

**Wir haben Claude Codes Quellcode gelesen. Wir haben 2.200 versteckte Tokens gefunden, die jede Sitzung injiziert werden und für die du lautlos bezahlst.**

### Die Entdeckung

Am 12.04.2026 enthüllte ein [GitHub-Issue](https://github.com/anthropics/claude-code/issues/47107), dass Claude Codes eingebaute `includeGitInstructions`-Einstellung jede Sitzung lautlos Tokens verbrennt. Unabhängige Reproduktion via [dieses Gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bestätigte die Zahlen: **+6.031 Tokens in Cache-Schreibvorgängen** pro Sitzung nach jedem Git-Commit, **+1.690 Tokens in Cache-Reads** bei jedem API-Aufruf.

### CC-Quelltextanalyse — wohin die Tokens fließen

Wir haben die Tokens zu zwei unabhängigen Injektionspunkten im Claude Code-Quellcode (v2.1.88) verfolgt:

**1. `gitStatus`-Snapshot (~500 Tok) — System-Prompt**
- `context.ts:36-111` `getGitStatus()` sammelt Branch + Main-Branch + user.name + vollständigen Status (bis zu 2000 Zeichen) + **die letzten 5 Commits**
- Per `appendSystemContext` (`utils/api.ts:437`) an den System-Prompt angehängt
- Jeder neue Commit, jede neue geänderte Datei, jeder Branch-Wechsel ändert den Text → Präfix-Cache-Invalidierung

**2. Commit/PR-Workflow-Anweisungen (~1.700 Tok) — Bash-Tool-Beschreibung**
- `tools/BashTool/prompt.ts:53` hängt 60+ Zeilen Sicherheitsprotokoll, schrittweise Commit-Prozedur, HEREDOC-Beispiele und PR-Erstellungsvorlagen an die `Bash`-Tool-Beschreibung an
- Zusammen mit dem System-Prompt gecacht, aber als `tools[]`-Parameter übertragen

### Warum es teuer ist

Die Cache-Struktur (`utils/api.ts:321` `splitSysPromptPrefix`) hat drei Pfade basierend darauf, ob du aktive MCP-Tools hast:

- **Pfad A** (MCP aktiv — die meisten Nutzer): `gitStatus` sitzt in einem `cacheScope: 'org'`-Block. Jede Änderung → ganzer Block wird beim nächsten Sitzungsstart neu gecacht → 6K Tok `cache_create`-Miss.
- **Pfad B** (kein MCP): `gitStatus` geht in einen `cacheScope: null`-Dynamikblock, was bedeutet, er wird bei jedem API-Aufruf als frische `input_tokens` neu gesendet — kein Cache-Miss, aber auch keine Cache-Einsparungen.
- **Pfad C** (3P-Provider / experimentelle Betas deaktiviert): wie Pfad A.

In typischen interaktiven Sitzungen akkumulieren sich die Commit/PR-Anweisungen (1,7K Tok) über `cache_read` **bei jedem API-Aufruf**. Bei Opus 4.7-Preisen über eine 100-Aufruf-Sitzung sind das grob **~$0,08 pro Sitzung** allein für Anweisungen, die Claudes Training größtenteils bereits abdeckt.

### Wie super-token-saver es handhabt

`/setup-git-lite` deaktiviert den nativen Pfad und injiziert über einen SessionStart-Hook einen **kuratierten 280-Token-Ersatz**. Wir haben genau das behalten, was Claudes Standardverhalten überschreibt (Sicherheitsregeln), und alles fallen gelassen, was Claude bereits aus dem Training weiß (schrittweise Workflows, PR-Vorlagen, gh-Verwendungsmuster).

**Behalten — 11 kritische Override-Regeln** (diejenigen, die Claudes standardmäßige Hilfsbereitschaft in Vorsicht verwandeln):
- Niemals commit/push/amend/PR/tag/merge ohne explizite Benutzeranfrage
- Niemals Hooks überspringen, zu main/master force-pushen, destruktive Ops ausführen, git-Config modifizieren
- Niemals Dateien commiten, die `.env`, `credentials`, `*.pem`, `secret.*` entsprechen
- `git add -A` / `git add .` vermeiden
- HEREDOC für mehrzeilige Commit-Nachrichten + `Co-Authored-By: Claude`-Trailer
- Niemals interaktive Flags (-i) verwenden, keine leeren Commits
- Wenn pre-commit-Hook fehlschlägt → NEUEN Commit erstellen (nicht `--amend`)

**Fallen gelassen** — schrittweiser Commit-Workflow (3 Schritte), schrittweiser PR-Workflow (3 Schritte), PR-Titel/Body-Vorlage, `gh`-Befehlsreferenzen, `-uall`-Flag-Warnung, `--no-edit` mit Rebase-Warnung, `NIEMALS TodoWrite oder Agent-Tools beim Commit verwenden`-Einschränkung. Das sind Workflow-Ausführlichkeiten, die Claude allein aus dem Training heraus korrekt zusammensetzt.

**Hinzugefügt** — kompakte Git-Statuszeile: Branch + HEAD-Kurz-SHA + Betreff + aktueller Status (bis zu 20 geänderte Dateien, sonst eine Zählung). Keine aktuelle Commit-Liste (Claude kann `git log` bei Bedarf ausführen).

### Erwartete Einsparungen (Opus 4.7-Preise, $25/MTok Output, $5/MTok Input, $0,50/MTok Cache-Read)

| Posten | Original | Mit setup-git-lite | Gespart |
| ---- | -------- | ------------------- | ----- |
| System-Prompt-Laden (pro neue Sitzung) | ~2.200 Tok cache_create | ~280 Tok cache_create | ~1.920 Tok |
| Wiederholungsaufrufe in derselben Sitzung | ~1.700 Tok cache_read/Aufruf | ~280 Tok cache_read/Aufruf | ~1.420 Tok/Aufruf |
| 100-Aufruf-Sitzung (Opus 4.7) | — | — | **~$0,11 gespart** |
| 20 Sitzungen/Tag × 22 Arbeitstage | — | — | **~$48 gespart/Monat** |

### Verwendung

```bash
/setup-git-lite status     # Nur-Lese-Diagnose — aktueller Zustand + was sich ändern würde
/setup-git-lite install    # CC-Nativ deaktivieren + unseren minimalen Hook aktivieren
/setup-git-lite revert     # Standard wiederherstellen (aggressiv; siehe unten)
/setup-git-lite dismiss-banner    # Gelegentlichen Empfehlungshinweis stummschalten
/setup-git-lite undismiss-banner  # Hinweis wieder aktivieren
/setup-git-lite help       # Vollständige Verwendung
```

### Installations-Semantik

`install` modifiziert **zwei** Stellen für Robustheit:

1. `~/.claude/settings.json` — fügt `"includeGitInstructions": false` hinzu
2. Shell-Profil (`~/.zshrc`, `~/.bashrc`, etc.) — hängt einen Marker-Block an, der `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` exportiert

Jede einzeln reicht aus, um CC-Nativ zu deaktivieren; wir setzen beide, damit ein Umgebungsüberschreiben das native Verhalten nicht versehentlich wieder aktiviert. Die Shell-Änderung tritt nur in neuen Shells in Kraft.

### Revert-Semantik — aggressiv

`revert` **entfernt ALLE `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-Exporte aus deinem Shell-Profil**, einschließlich solcher, die du möglicherweise manuell hinzugefügt hast, bevor du dieses Skill installiert hast. Das ist beabsichtigt — du hast `revert` ausgeführt, also stellen wir den sauberen Standard wieder her. Wir erstellen immer zuerst ein zeitgestempeltes Backup des Shell-Profils.

Wenn du die Umgebungsvariable aus anderen Gründen brauchst, notiere sie dir vor dem Ausführen von `revert` und füge sie danach wieder hinzu.

### Vor dem Deinstallieren von super-token-saver

**Führe zuerst `/setup-git-lite revert` aus**, sonst bleibt `includeGitInstructions: false` in deiner settings.json aber ohne Ersatz-Hook (Claude erhält überhaupt keine Git-Anleitung). Claude Code hat aktuell keinen Plugin-Deinstallations-Lifecycle-Hook, daher können wir das nicht automatisieren.

### Kompromisse

Was du verlierst (und warum es normalerweise in Ordnung ist):
- Claude erhält beim Sitzungsstart keinen vorberechneten `git status` / `git log -n 5`. Wenn du in einer neuen Sitzung fragst „was hat sich verändert?", führt Claude diese Befehle selbst aus (ein zusätzlicher Tool-Aufruf, ~300 Tok).
- Claude sieht CCs kanonische 3-Schritt-Commit-Prozedur nicht mehr. In unseren Tests über Hunderte von Commit-Flows bewältigt das Training die kritischen Fälle (HEREDOC-Formatierung, kein `--amend`, kein Force-Push), weil wir diese als explizite Regeln behalten.
- PR-Body-Vorlage (`## Summary` + `## Test plan`) wird nicht injiziert. Wenn dir dieses genaue Format wichtig ist, füge es in dein Projekt-CLAUDE.md ein.

### Empfehlungs-Banner

Wenn CCs native Git-Anweisungen auf deinem Rechner noch aktiv sind, zeigt super-token-saver beim Sitzungsstart **~20 % der Zeit** einen einabsatzigen Hinweis (plus in `/usage-view`- und `/report-limit`-Ausgaben). Dauerhaft stummschalten mit `/setup-git-lite dismiss-banner`.

---

## 🛡️ Funktion 5: Token Guardian

**Sagt dir sofort, wenn ein Cache-Ablauf dich Geld kostet. Kann die $9-Neuübertragung blockieren, wenn du das willst.**

Der Prompt-Cache von Claude Code lebt 1 Stunde. Bleibst du länger weg, läuft er ab. Deine nächste Nachricht sendet den gesamten Kontext zum vollen Preis neu. Bei 900.000 Tokens sind das $9 auf einen Schlag.

Token Guardian merkt sich, wann die letzte Antwort eingetroffen ist. Sind mehr als 3.590 Sekunden vergangen (TTL minus 10 Sekunden Puffer), kann es eingreifen. **Standardmäßig ist es deaktiviert, wegen Remote Control.** Die Block-Nachricht eines Hooks wird lokal als Systemnachricht gerendert, die der Remote-Client nie erhält — ein Remote-Nutzer sah den Prompt also ohne jede Erklärung verschwinden. Statt eines Guards, der sich je nach Standort unterschiedlich verhält, haben wir ihn abgeschaltet. Sobald Remote Control Hook-Nachrichten weiterleitet, kommt der Standard zurück. Bis dahin schaltest du ihn selbst ein — mit einem von zwei Modi.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude erwähnt den Ablauf in der ersten Zeile
export CC_TOKEN_SAVER_CACHE_GUARD=block   # der Prompt wird einmal mit der Meldung unten abgelehnt
```

Im Modus `warn` geht der Prompt durch, und Claude beginnt seine Antwort mit einer Zeile, die sagt, dass der Cache abgelaufen war, dass dieser Turn als volle Neuübertragung des Kontexts abgerechnet wurde, und dass nach einer Pause von einer Stunde oder mehr der günstigere Weg zurück `/clear` → `/s-continue` ist. Diese erreicht tatsächlich einen Remote-Client, denn Claudes Antwort wird weitergeleitet, auch wenn Hook-Nachrichten es nicht sind.

Im Modus `block` wird der Prompt einmal mit der Meldung unten abgelehnt. Schick ihn erneut ab und er geht durch. Nutze diesen Modus in einem lokalen Terminal, wenn du den harten Stopp willst.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Die Block-Nachricht wird in 23 Sprachen angezeigt, basierend auf deinem OS-Gebietsschema, und erscheint einmal pro Leerlaufperiode.

**Background Agents werden nie blockiert.** Nur Prompts, die ein Mensch selbst eingegeben hat, lösen die Prüfung aus. Abschlussberichte von Background Agents und Tasks — die inzwischen oft erst mehr als eine Stunde nach dem Start eintreffen — laufen ungehindert durch. Das Ergebnis eines lang laufenden Agents wird nie zurückgehalten oder verliert sich.

**Ergebnis:** Im Warn-Modus weißt du immer, wann eine $9-Neuübertragung passiert ist, und warum. Im Block-Modus passiert es gar nicht erst: Jeder abgefangene Ablauf spart $9, und bei einem Abfang pro Tag sind das $270/Monat reiner Verschwendung, die eliminiert wird.

> **Bei API Pay-per-Use trifft das härter.** Ein Max-Plan-Abonnent verliert $9 innerhalb eines $200-Puffers. Du verlierst $9 echtes Geld — lautlos, jedes Mal wenn du kurz weggehst. Token Guardian im Block-Modus stoppt es jedes Mal.

---

## 💡 Wie Cache wirklich funktioniert (und warum die meisten Nutzer 40 %+ verschwenden)

Claude Code sendet die gesamte Gesprächshistorie bei jedem API-Aufruf an das Modell. „API-Aufruf" bedeutet nicht „eine von dir getippte Nachricht." Ein einzelner Prompt löst interne Tool-Aufrufe aus — Grep, Read, Edit, Write — und jeder ist ein separater API-Aufruf. Ein Prompt kann leicht 10+ API-Aufrufe verursachen.

Prompt-Cache reduziert diese Kosten um 90 %. Aber Cache hat eine Lebensdauer.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache-TTL           | 1 Stunde (ephemeral_1h)                 | 5 Min                                  |
| Cache-Schreibvorgänge         | ＄10/MTok                              | ＄6,25/MTok                             |
| Cache-Reads          | ＄0,50/MTok                            | ＄0,50/MTok                             |
| Bei Cache-Ablauf  | Vollständiger Kontext zum vollen Preis neu gesendet    | Geringe Auswirkung (Kontext ist klein)          |

Auch mit lebendem Cache häufen sich Kosten an. Hier ist ein Extremszenario zur Verdeutlichung des Unterschieds.

### Szenario: Ganztägiges Coden (3h morgens → 2h Mittagspause/Meeting → 3h nachmittags)

Bedingungen: Opus 4-Preise, 1 Prompt pro Minute, ~5 API-Aufrufe pro Prompt (~300 Aufrufe/Stunde).

#### ❌ Ohne super-token-saver

Der meiste Aufwand passiert in der Main Session. Kontext wächst schnell.

| Phase       | Situation                         | Kontextgröße               | Kosten                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Morgen 3h  | Coden (hauptsächlich in Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0,50/M = ＄157,50  |
| Mittagspause/Mtg   | 2 Stunden weg                  | —                          | —                                      |
| Rückkehr      | Cache abgelaufen → vollständige Neuübertragung      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Rückkehr      | /compact (zusammenfassen)              | 600K → sent to LLM        | 600K × ＄0,50/M + summary output = ~＄1,50 |
| Nachmittag 3h | Coden weiter (Kontext wächst wieder) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0,50/M = ＄157,50  |
|             | Gesamt                             |                            | ~＄326                                  |

> Bei dieser Nutzungsintensität wirst du wahrscheinlich das 5-Stunden-Fenster-Rate-Limit erreichen. **Die Kosten sind schlimm, aber das eigentliche Problem ist, dass deine Arbeit komplett stoppt. Das ist genau der Moment, in dem Claude Code dunkel wird.**

#### ✅ Mit super-token-saver

Schwere Arbeit wird an SubTasks delegiert. Main behandelt nur Design/Entscheidungen.

| Phase       | Situation                                    | Kontextgröße                | Kosten                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Morgen 3h  | Coden (Main: Design, SubTask: Implementierung) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
| Mittagspause/Mtg   | 2 Stunden weg                             | —                           | —                                  |
| Rückkehr      | ⚡ Token Guardian (Block-Modus) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| Nachmittag 3h | Coden weiter                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
|             | Gesamt                                        |                             | ~＄180                              |

#### 💰 Ergebnis

> **＄326 → ＄180. ＄146 pro Tag gespart. 45 % Kostenreduktion.**
>
> **Max Plan:** Weniger Tokens = kein Rate-Limit. Deine Arbeit stoppt nicht. Das ist der eigentliche Unterschied.
>
> **API Pay-per-Use:** ＄146/Tag × 22 Arbeitstage = **＄3.200/Monat direkt von deiner Rechnung.** Ein schwerer Monat ohne dieses Plugin kostet über ＄7.000. Damit unter ＄4.000. Gleicher Output.

### Wo super-token-saver eingreift

```
[Session Start]
    │
    ├─ Session Architect → Auto-injects SubTask delegation pattern
    │                       Keeps Main context under 250K
    │
[Working]
    │
    ├─ Status Line → Real-time cost/context/rate limit monitoring
    │                  Instant alert when entering warning zone
    │
[1+ hour idle]
    │
    ├─ Token Guardian → Detects cache expiry, warns (or blocks in block mode)
    │
[Session restart]
    │
    └─ /s-continue → Restores previous context at zero cost (no LLM calls)
```

---

## 🔧 Quell-Installation & Anpassung

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver ist vollständig Open-Source (Apache-2.0). Reines JavaScript + Bash — keine kompilierten Binaries, keine externen API-Aufrufe, kein Telemetrie. Jede Zeile ist auditierbar. Jede Behauptung in dieser README verweist auf eine spezifische Datei, die du lesen kannst.

- **hooks/** — Cache-Ablauf-Schwellenwert ändern, Warnmeldungen anpassen, Session-Architektur-Regeln modifizieren
- **scripts/** — Analyselogik, Report-Builder, Statusleisten-Formatierung
- **skills/** — Wie /s-continue und /usage-view funktionieren, Prompt-Vorlagen
- **locales/** — Übersetzungen hinzufügen/bearbeiten, neue Sprachen hinzufügen
- **skills/usage-view/** — Dashboard-UI/UX-Designänderungen

Mach es zu deinem. Forke es, experimentiere und schick einen PR, wenn du etwas Besseres findest.

---

## 🌐 Unterstützte Sprachen

23 Sprachen unterstützt. Ausgewählt durch Kreuzreferenzierung der Top-20-Länder nach Claude Code-Nutzung mit den Top-20-Sprachen nach weltweiter Sprecherzahl. Die Anzeigesprache wird automatisch aus deinem OS-Gebietsschema erkannt. Du kannst auch manuell angeben: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Englisch    | 🇰🇷 Koreanisch     | 🇯🇵 Japanisch  | 🇨🇳 Chinesisch    |
| 🇪🇸 Spanisch    | 🇫🇷 Französisch     | 🇩🇪 Deutsch    | 🇧🇷 Portugiesisch |
| 🇮🇹 Italienisch    | 🇷🇺 Russisch    | 🇸🇦 Arabisch    | 🇮🇳 Hindi      |
| 🇧🇩 Bengalisch    | 🇮🇩 Indonesisch | 🇲🇾 Malaiisch     | 🇹🇭 Thailändisch       |
| 🇻🇳 Vietnamesisch | 🇹🇷 Türkisch    | 🇵🇱 Polnisch    | 🇳🇱 Niederländisch      |
| 🇮🇱 Hebräisch     | 🇸🇪 Schwedisch    | 🇳🇴 Norwegisch |                 |

Aktuelle Übersetzungen sind KI-generiert. Beiträge von Muttersprachlern willkommen — bearbeite die JSON-Datei für deine Sprache in `locales/` und reiche einen PR ein.

---

## ⚖️ Was dieses Plugin dich kostet

Das Plugin injiziert beim Sitzungsstart Kontext. Hier ist genau wie viel:

| Injektion | Wann | Tokens | Zweck |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (einmalig) | ~1.100 | SubTask-Delegationsstrategie + Concise-Mode-Regeln |
| Git-Kontext (wenn git-lite aktiviert) | SessionStart (einmalig) | ~280 | Ersetzt CCs native ~2.200-Tok-Git-Anweisungen |
| Cache-Ablaufwarnung | Bei Leerlauf > 59 Min (einmalig) | ~200 | Markiert die teure Neuübertragung, zeigt den günstigeren Weg |
| Status line | Jeder API-Aufruf | 0 | Rendert in Terminal-Statusleiste, nicht in Gesprächskontext |

**Nettooverhead pro Sitzung: ~1.400 Tokens (einmalig, nach erstem Aufruf gecacht).**

Bei Opus-Preisen ($0,50/MTok Cache-Read) sind das **$0,0007 pro API-Aufruf** — weniger als ein Zehntel eines Cents. Über eine 100-Aufruf-Sitzung: $0,07.

Wenn git-lite aktiviert ist, **spart** das Plugin ~1.920 Tokens pro Sitzung (ersetzt 2.200 durch 280). Der Nettoeffekt ist negativ — das Plugin verbraucht weniger als es entfernt.

**Für API Pay-per-Use-Nutzer:** Bei $3.000/Monat Ausgaben liegt der Plugin-Overhead unter $2/Monat. Die Einsparungen allein durch Cache-Ablauf-Prävention (eine blockierte $9-Neuübertragung pro Woche) decken einen Jahres-Overhead mit einem einzigen Abfang.

---

## 💡 Tipps

### Versteh den Cache und du wirst sehen, wohin das Geld geht

- **1 Prompt ≠ 1 API-Aufruf.** Jedes Mal wenn Claude Grep, Read oder Edit aufruft, wird der gesamte Kontext neu gesendet. Ein einzelner Prompt löst leicht 10+ API-Aufrufe aus. Schreib klare Prompts, um unnötige Tool-Aufrufe zu reduzieren und Kosten zu senken.
- **Der Cache-Timer resettet vom letzten API-Aufruf, nicht von deinem letzten Prompt.** Bleib am Arbeiten und der Cache läuft nie ab. Die Gefahr liegt im Weggehen. Token Guardian sagt dir, wann es passiert ist, und stoppt den Prompt im `block`-Modus einmal, sodass du wählen kannst: Kontext zurücksetzen oder so fortfahren.
- **Kontextgröße = Kostenmultiplikator.** Derselbe API-Aufruf bei 200K vs 800K kostet das Vierfache. Wenn die Statusleiste [CTX] 35% (🟡) überschreitet, ist das dein Signal, mehr an SubTasks zu delegieren.

### Gewohnheiten, die Kosten senken

- **CLAUDE.md schlank halten.** Es wird bei jedem API-Aufruf in den System-Prompt geladen. Jede Zeile kostet Geld.
- **Schwere Arbeit an SubTasks delegieren.** Code-Generierung, Multi-File-Bearbeitungen, Test-Durchläufe gehören nicht in Main. SubTasks haben kleineren Kontext und einen günstigeren Cache-Tier.
- **1+ Stunden weg?** `/clear` → zurückkommen → `/s-continue`. Kontext wiederhergestellt für $0.
- **[5H] über 70% (🟡)?** Tempo drosseln. Auf leichte Review-Aufgaben wechseln oder SubTask-Delegation erhöhen, um Mains API-Aufruf-Anzahl zu reduzieren.
- **`/btw` für Nebenfragen nutzen.** Es geht nicht in die Gesprächshistorie, also bleibt dein Kontext schlank.

### API Pay-per-Use: Die wichtigsten Gewohnheiten

Alles oben Genannte gilt, plus diese API-spezifischen Prioritäten:

- **[CTX] wie einen Tacho im Blick behalten.** Kein Rate-Limit wird dich stoppen — aber Kontext bei 500K+ bedeutet, dass jeder API-Aufruf 2-3x so viel kostet wie er sollte. `/clear` → `/s-continue` ist kostenlos und resettet deinen Kostenmultiplikator auf den Ausgangswert.
- **Wöchentlich `/usage-view` ausführen.** Max-Plan-Nutzer haben einen natürlichen „Autsch"-Moment, wenn sie rate-gelinited werden. Du nicht — Kosten steigen lautlos. Das Dashboard ist dein Frühwarnsystem.
- **Mentales Tagesbudget setzen.** Ohne Obergrenze passieren $200-Tage unbemerkt. Der RUN-Indikator in der Statusleiste macht Per-Runde-Kosten sichtbar. Wenn eine einzelne Runde $1 (🔴) überschreitet, ist dein Kontext zu groß.

---

## 📚 Dokumentation

- [Prompt-Cache-Leitfaden](guides/prompt-cache-guide.md) — Warum der Großteil deiner Kosten Cache ist, wie Caching über Provider (Anthropic, OpenAI, Gemini) funktioniert und wie man es verwaltet ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 Sprachen](guides/))
- [Fable 5.1 vs Opus 5 Kostenanalyse](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Bei gleicher Qualität mindestens 24–38 % günstiger als Opus 5, über 2.782 Sitzungen
- [Fable 5.1 vs Opus 5 Kostenanalyse (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Opus 4.7 vs 4.6 Kostenanalyse](guides/opus-4-7-vs-4-6-cost-analysis.md) — Seite-an-Seite-Kostenvergleich über 8.563 API-Aufrufe
- [Opus 4.7 vs 4.6 Kostenanalyse (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Lizenz

Apache-2.0
