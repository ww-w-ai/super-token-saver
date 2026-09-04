# super-token-saver

**L'unico plugin di Claude Code che legge davvero il codice sorgente di CC per trovare dove vanno i tuoi token — e lo corregge automaticamente. Spendi meno, programma più a lungo.**

> Risultato misurato: **riduzione dei costi del 45%** su un carico di lavoro reale di $326/giorno → $180/giorno. Delega automatica ai SubTask, ripristino del contesto a costo zero, un dashboard di analisi completo e una protezione contro la scadenza della cache. Una sola installazione, zero configurazione.

Funziona con **Max Plan ($200/mese)** e **API a pagamento per uso**. Lo stesso plugin, le stesse funzionalità. Più potente per ogni utente — specialmente quando ogni token è denaro reale.

![Dashboard di utilizzo — vedi esattamente dove vanno i tuoi token](docs/images/usage-view-overview.png)

### Cosa fa in 30 secondi

| Funzionalità | Cosa succede | Impatto |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delega automaticamente il lavoro pesante ai SubTask (cache 37,5% più economica) | Il contesto rimane piccolo, i costi calano |
| 🪶 Concise Mode | Riduce il padding nelle risposte, mantiene la sostanza | Meno token di output per risposta |
| 🔄 /s-continue | Sostituisce /compact — zero chiamate LLM, zero costo, zero perdita di informazioni, e ora ripristina anche le sessioni **Codex** | Ripristino del contesto gratuito su entrambi gli strumenti |
| 🤝 /s-compact | Scrive un handoff di sessione che /s-continue carica automaticamente — cattura i risultati dei subagent e degli strumenti che la trascrizione perde | Anche la sessione successiva recupera il contesto nascosto |
| 📊 Status Line | Costo in tempo reale, dimensione del contesto, limite di frequenza — sotto 50ms | Vedere i problemi prima che costino denaro |
| 📈 /usage-view | Dashboard HTML interattivo con analisi basata su IA | Analisi forense completa dei costi in un clic |
| ✂️ /setup-git-lite | Rimuove 2.200 token nascosti che CC inietta ogni sessione | ~$48/mese risparmiati solo sulle istruzioni git |
| 🛡️ Token Guardian | Ti avvisa nel momento in cui una scadenza della cache reinvia il tuo contesto, o lo blocca in modalità `block` | Basta con le sorprese silenziose da $9 |

---

## 😤 Il Problema

**Costi invisibili.** Nessuna visibilità in tempo reale. Nessun avviso "il tuo contesto è a 800K". Nessun alert "la cache è scaduta 3 minuti fa". Lo scopri dopo che il danno è fatto.

**Gonfiamento del contesto.** Lo stesso prompt con 200K vs 800K di contesto costa 4 volte di più. Ogni Read, Grep, Edit reinvia il contesto completo. Un prompt complesso può facilmente innescare 15+ chiamate API, ciascuna moltiplicata per la dimensione del tuo contesto.

**Scadenza della cache.** Torni dal pranzo. La cache è scomparsa. Il prossimo messaggio reinvia 900K token al prezzo pieno. $9 in un colpo solo.

**Tutto manuale.** Gestione del contesto, tempistica della scadenza della cache, delega ai SubTask, pulizia delle sessioni. Nessuno riesce a tenere traccia di tutto questo mentre programma davvero.

**Max Plan ($200/mese)?** Tutto quanto sopra, più un limite di frequenza di 5 ore che uccide il tuo flusso senza timer e senza ETA.

**API a pagamento per uso?** Tutto quanto sopra, tranne che non c'è un tetto. Un miss della cache = $9 di denaro reale. Dieci volte a settimana = $360/mese solo in incidenti. Un brutto martedì con contesto gonfio può costare più di quanto un abbonato al Max Plan paga in un mese.

super-token-saver gestisce tutto questo automaticamente. **Installa una volta. Fatto.**

---

## 🚀 Installazione

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Funziona automaticamente dopo l'installazione. Zero configurazione. Richiede [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Per il monitoraggio in tempo reale:

```
/setup-statusline install
```

Per rimuovere 2.200 token nascosti dalle istruzioni git integrate di CC ([dettagli](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Funzionalità 1: Smart Session Architecture

**Installalo e i modelli di lavoro ottimizzati per i costi si attivano automaticamente.**

La maggior parte degli utenti fa tutto nella Main Session. Lettura di file, generazione di codice, esecuzione di test. Ogni output si accumula nel contesto e viene reinviato con ogni messaggio. La sessione si gonfia. I costi crescono come una palla di neve.

Session Architect inietta automaticamente una strategia di delega all'avvio della sessione.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Ruolo             | Design, decisioni, revisione         | Implementazione, generazione codice, multi-file  |
| Livello cache       | 1 ora (ephemeral_1h)             | 5 min                                 |
| Costo scrittura cache | ＄10/MTok                          | ＄6,25/MTok                            |
| Dimensione contesto     | ~94K in media                          | ~33K in media                              |

I SubTask hanno **scritture cache 37,5% più economiche** di Main. Il contesto è anche molto più piccolo. Delegare il lavoro pesante ai SubTask riduce drasticamente i costi.

**Risultato:** Il contesto rimane sotto 250K invece di crescere a 600K+. Lo stesso output di lavoro, metà del costo in token. Completamente automatico.

---

## 🪶 Concise Mode

**Lo stesso contenuto. Meno padding. Attivato per impostazione predefinita.**

L'hook SessionStart inietta anche una regola di stile di risposta che viene eseguita in **ogni sessione e ogni modello** — nessun flag, nessuna configurazione. Tre cose cambiano:

- **Nessun preambolo** — niente più "Fammi controllare…", "Adesso farò…", riformulare la tua domanda o ricapitolare ciò che il diff mostra già
- **Il formato giusto per il contenuto** — punti elenco per le liste, prosa per il ragionamento (compromessi, causalità, motivazione). Nessuno è forzato
- **Espressione più concisa** — lo stesso punto, meno parole. Una prosa più chiara è una prosa più breve

Limite rigido: non omettere mai contenuto, saltare la verifica o comprimere le sfumature in una singola frase. La sostanza rimane completa; si riduce solo il contenitore.

Installa una volta, si applica ovunque.

---

## 🔄 Funzionalità 2: /s-continue — Ripristino del Contesto

**Sostituisce `/compact`. Zero chiamate LLM. Zero costo di token. Zero perdita di informazioni.**

`/compact` invia l'intero contesto (~1M token) all'LLM per comprimerlo in un riassunto del 3,3%. Se la cache è scaduta, questo solo innesca un ri-caching completo. La perdita di informazioni è inevitabile.

`/s-continue` adotta un approccio completamente diverso. Pre-elabora la trascrizione della sessione precedente e la carica direttamente. Nessuna chiamata LLM. Nessun costo. La conversazione originale viene ripristinata così com'era.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Come funziona            | Invia il contesto completo all'LLM per un riassunto | Pre-elabora la trascrizione, la legge direttamente |
| Chiamate LLM               | Necessarie (tipicamente 100K+ token) | 0                                |
| Costo token              | Alto                              | 0                                |
| Perdita di informazioni        | Sì (riassunto del 3,3%)                | Nessuna (originale preservato)        |
| Velocità di elaborazione        | Decine di secondi                   | < 1 sec (anche file da 60MB+)       |
| Quando la cache è scaduta   | Costo di ri-caching completo aggiuntivo         | Nessun impatto                        |
| Ripristino multi-sessione   | Non possibile                      | Supportato                        |

Utilizzo: `/clear` poi `/s-continue`. Vedrai un elenco delle sessioni precedenti. Scegli quella da ripristinare. Per recupero rapido: `/s-continue last`.

**Risultato:** Riprendi il lavoro precedente a costo zero. Nessuna perdita di informazioni. Elabora trascrizioni da 60MB+ in meno di 1 secondo.

### 🤝 Il suo compagno: `/s-compact` — trasmetti lo strato nascosto

`/s-continue` ripristina la **trascrizione** — ciò che tu e Claude avete detto. Ma la conoscenza più utile di una sessione di lavoro spesso vive AL DI FUORI di quel dialogo: ciò che un **subagent** ha trovato (la sua trascrizione è un file separato che il ripristino non carica mai), un **numero decisivo nell'output di uno strumento** (un conteggio di test, un benchmark), una **lezione appresa dal processo** ("impossibile riprodurre in headless → era il build, non il codice").

Esegui `/s-compact` alla **fine** di una sessione e distillerà esattamente quello strato nascosto in un handoff, salvato in `~/.claude/super-token-saver-data/<project>/handoff.md`. Nella sessione successiva, `/s-continue` lo **carica automaticamente** sopra la trascrizione ripristinata — senza incollare nulla.

|                     | `/s-continue` da solo            | `/s-compact` + `/s-continue` (la coppia)          |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| Recupera            | La trascrizione (ciò che è stato detto)  | La trascrizione **più** lo strato nascosto         |
| Risultati dei subagent   | Persi (file separati)           | Distillati nell'handoff                       |
| Numeri di output degli strumenti | Solo se citati nella chat    | Estratti deliberatamente                            |
| Lezioni dal processo     | —                               | Catturate per non ripetere i vicoli ciechi              |

**Il flusso di lavoro:** termina una sessione con `/s-compact` → inizia la successiva con `/s-continue`.

### 🔀 Due strumenti, una sola cronologia — anche le sessioni Codex si ripristinano qui

Codex scrive le sue sessioni in `~/.codex/sessions/`, Claude Code in `~/.claude/projects/`. Nessuno dei due legge i file dell'altro, quindi uno sprint che finiva il budget su Codex restava irraggiungibile da Claude Code, e viceversa.

Ora `/s-continue` elenca e ripristina entrambi. Un rollout di Codex non passa per un secondo parser: viene riscritto nel formato che scrive Claude Code, **una riga di output per ogni riga di input**, così la stessa pipeline serve entrambi e ogni marcatore `L{n}` continua a indicare esattamente la riga del file Codex originale. Misurato: un rollout da 12 MB e 1.540 righe viene pre-elaborato in **0,13 s**.

|                        | Sessione Claude Code | Sessione Codex |
| ---------------------- | ------------------- | ------------- |
| Elencata da `/s-continue` | Sì | Sì, limitata al progetto corrente |
| Ripristinata a costo LLM zero | Sì | Sì |
| Salto `L{n}` all'originale | Sì | Sì — i numeri di riga sono quelli del rollout stesso |
| Ripristino dopo perdita di contesto (`#0`) | `/compact`, auto-compact | Compaction di Codex e rollback del thread |
| Handoff di `/s-compact` | Condiviso per progetto — scritto in uno strumento, caricato nell'altro |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Due dettagli separano un elenco corretto da uno solo apparentemente giusto. Il `session_id` di Codex è in realtà l'id del **thread**, ereditato da qualsiasi subagent generato, quindi le sessioni si distinguono tramite `payload.id` e i rollout dei subagent vengono filtrati nello stesso modo in cui Claude Code filtra già le proprie trascrizioni di subtask. E `<codex_internal_context source="goal">` viene iniettato dalla macchina, quindi resta nel contesto ripristinato ma non viene mai contato come un turno digitato da te.

Il plugin si installa anche in Codex — vedi **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit` e `setup-statusline` restano per ora esclusivi di Claude Code.

---

## 📊 Funzionalità 3: Status Line in Tempo Reale

**Monitoraggio token/costi in tempo reale. Meno di 50ms di overhead.**

Esegui `/setup-statusline install` una volta e una barra di stato persistente appare nella parte inferiore di Claude Code.

**Funzionamento normale** — tutte le metriche a colpo d'occhio, zero cambio di contesto:

![Barra di stato in stato normale](docs/images/statusline-normal.png)

**Limite di frequenza raggiunto** — 5H diventa rossa al 102%, il conto alla rovescia mostra esattamente quando torni operativo, e un'azione `/report-limit` a un tocco appare automaticamente:

![Barra di stato quando si raggiunge il limite di frequenza](docs/images/statusline-rate-limited.png)

| Indicatore        | Cosa mostra                       | 🟢 Normale | 🟡 Attenzione | 🔴 Critico |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Costo dell'ultima chiamata API           | < ＄0,30   | >= ＄0,30   | >= ＄1,00    |
| RUN (cumulativo) | Costo cumulativo per questa cartella     | —         | —          | —           |
| 5H               | Utilizzo della finestra di 5 ore + conto alla rovescia reset | < 70%     | >= 70%     | >= 90%      |
| CTX              | Utilizzo della finestra di contesto                | < 35%     | >= 35%     | >= 70%      |

Quando un indicatore raggiunge attenzione o critico, appare automaticamente un suggerimento `→ /usage-view current`.

Per rimuovere: `/setup-statusline uninstall` (la configurazione precedente viene ripristinata automaticamente).

**Risultato:** Ogni problema di costo visibile in tempo reale. Meno di 50ms di overhead — nessun ritardo percepibile.

> **Con API a pagamento per uso?** Gli indicatori 5H e W si nascondono automaticamente — non hai finestre di limite di frequenza. Ciò che rimane è ciò che conta: RUN (costo in tempo reale per turno) e CTX (dimensione del contesto). Le due leve che controllano la tua fattura, sempre visibili.

---

## 📈 Dashboard di Utilizzo (/usage-view)

**Finalmente la risposta: "Dove sono andati tutti quei soldi?"**

Gli utenti del Max Plan raggiungono il limite di frequenza e si chiedono perché. Gli utenti API aprono la fattura di Anthropic e si chiedono come. In ogni caso, la domanda è la stessa: quale sessione ha bruciato più token? Quando sono aumentati i costi? Quali schemi esistono nel tuo utilizzo? Finora — tutto invisibile.

`/usage-view` mostra tutto. Un dashboard HTML interattivo si apre nel browser, permettendoti di analizzare i modelli di utilizzo e risalire alla causa principale dei picchi di costo. Nessuna dipendenza esterna. Funziona in modo autonomo. Condivisibile come file.

**$4.196 in 31 giorni. Dove è andato tutto?** Un'occhiata — costo totale, suddivisione dei token per tipo, rapporto di efficienza della cache e conteggio delle sessioni. Il grafico a ciambella mostra istantaneamente che il 65% della spesa sono letture cache (il che è normale e sano):

![Panoramica del dashboard di utilizzo](docs/images/usage-view-overview.png)

**Prima vs. dopo — misurato, non indovinato.** Il marcatore arancione tratteggiato "Plugin installed" divide la tua cronologia dei costi in due. Le barre giornaliere sono impilate per tipo di token (Input/Output/Cache Write/Cache Read) in modo da vedere esattamente quale componente è cambiato dopo l'installazione. La linea media mostra la tendenza:

![Tendenza dei costi giornalieri](docs/images/usage-view-daily-trend.png)

**Quando bruci di più?** Costo orario in base all'ora del giorno e suddivisione per giorno della settimana. Alterna tra media dei giorni attivi, media di tutti i giorni o massimo. Le icone di fiamma marcano le tue ore più costose — i modelli visibili (maratone notturne, picchi del mercoledì) emergono istantaneamente:

![Modello di costo orario e per giorno della settimana](docs/images/usage-view-hourly-pattern.png)

**Stai diventando più efficiente?** Il rapporto Total/Output misura quanti token vengono consumati per token di output prodotto. Meno è meglio. Il marcatore "Plugin installed" ti permette di confrontare prima vs. dopo. I picchi = miss della cache o riavvii di sessione:

![Tendenza dell'efficienza](docs/images/usage-view-efficiency.png)

**Ogni chiamata API, tracciata per dimensione del contesto e costo.** Questo è il grafico che rende chiara la struttura dei costi. Ogni punto è una chiamata API. Rosso = Opus, blu = Sonnet, verde = Haiku. Le linee tratteggiate sono i prezzi teorici — se i tuoi punti sono sopra la linea, stai pagando troppo. Passa alla vista **User Turn** per vedere il costo per turno di conversazione invece che per chiamata API.
Passa il mouse su qualsiasi punto per vedere il testo effettivo del prompt, il conteggio dei token e la suddivisione completa dei costi (Input/Output/Cache Write/Cache Read):

![Costo per dimensione del contesto — grafico a dispersione](docs/images/usage-view-cost-scatter.png)

**Quanto sono grandi i tuoi contesti?** La maggior parte delle chiamate si raggruppa sotto 250K. La coda lunga sopra 350K è dove i costi esplodono — questo grafico mostra esattamente quanto spesso sei nella zona di pericolo:

![Distribuzione della dimensione del contesto](docs/images/usage-view-context-dist.png)

**Il tuo programma di codifica, con prezzo orario.** Una mappa di calore della finestra di 5 ore per 30 giorni. Verde (<$15/h), arancione ($15-30/h), rosso ($30+/h). L'icona del teschio (💀) marca le finestre in cui hai raggiunto il limite di frequenza. Il cursore del costo in alto filtra le finestre economiche per far emergere quelle costose — trascinalo per trovare istantaneamente i tuoi giorni peggiori. Alterna tra le viste finestra di 5 ore e blocco di 1 ora:

![Mappa di calore del calendario di utilizzo orario](docs/images/usage-view-calendar.png)

**Clicca su qualsiasi cella per approfondire le sessioni di quella finestra.** Ogni sessione in quel intervallo di tempo, con costo, conteggio messaggi, suddivisione token e i primi/ultimi messaggi reali di ogni conversazione. Espandi "Top Token Conversations" per vedere quali scambi specifici hanno bruciato di più — ogni voce mostra il testo del prompt, i tag di avviso costo e suggerimenti di ottimizzazione:

![Pannello dei dettagli della sessione](docs/images/usage-view-session-drilldown.png)

**Analisi basata su IA (opzionale).** Quando esegui `/usage-view` senza `--no-ai`, un analista IA legge tutti i dati del tuo dashboard — con riferimento ai prezzi API incorporato — e produce un report scritto: fattori di costo, anomalie, raccomandazioni di ottimizzazione. Visualizzato automaticamente nella lingua del sistema operativo (23 lingue, RTL incluso; grafici/tabelle rimangono sempre in LTR):

**Dove sono andati i soldi** — spesa totale, fattori di costo per tipo di token, tendenza settimanale e impatto del plugin misurato in numeri reali:

![Analisi IA — suddivisione dei costi](docs/images/usage-view-ai-report-1.png)

**Quando e come lavori** — ore di punta, giorni più intensi, distribuzione delle chiamate API e modelli di limite di frequenza che rivelano opportunità di ottimizzazione:

![Analisi IA — modelli di lavoro](docs/images/usage-view-ai-report-2.png)

**Cosa fare** — raccomandazioni concrete e basate sui dati adattate al tuo utilizzo reale. Cambio di modello, gestione del contesto, strategia di sessione:

![Analisi IA — raccomandazioni](docs/images/usage-view-ai-report-3.png)

**Condividilo.** L'intero dashboard è un singolo file HTML autonomo — tutti i dati incorporati, nessun server necessario. Invialo al tuo team, al tuo manager o al tuo contabile. Nessuna dipendenza esterna. Funziona offline. Usa la modalità `private` per rimuovere tutto il testo dei prompt prima di condividere — mantiene l'analisi dei costi intatta rimuovendo il contenuto della conversazione.

```
/usage-view                  # Tutto il tempo, tutti i progetti
/usage-view current          # Solo la finestra corrente di 5 ore
/usage-view last 7 days      # Ultimi 7 giorni
/usage-view locale ja        # Giapponese
/usage-view --no-ai          # Salta l'analisi IA (più veloce)
/usage-view private          # Rimuovi il testo dei prompt (sicuro da condividere)
```

---

## 🔬 Ricerca sul Limite di Frequenza (/report-limit)

**Progetto guidato dalla community per fare reverse engineering della formula del limite di frequenza.**

Anthropic non pubblica la formula esatta per la finestra di 5 ore. Scopriamola insieme.

Quando raggiungi un limite di frequenza, esegui `/report-limit`. I tuoi dati di utilizzo attuali vengono inviati automaticamente come GitHub Discussion. Più dati raccogliamo, più chiara diventa la formula.

---

## ✂️ Funzionalità 4: /setup-git-lite — Alleggerire le Istruzioni Git Integrate di CC

**Abbiamo letto il codice sorgente di Claude Code. Abbiamo trovato 2.200 token nascosti iniettati ad ogni sessione per cui stai pagando silenziosamente.**

### La scoperta

Il 12/04/2026, un [issue GitHub](https://github.com/anthropics/claude-code/issues/47107) ha rivelato che l'impostazione integrata `includeGitInstructions` di Claude Code brucia token silenziosamente ad ogni sessione. La riproduzione indipendente tramite [questo gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) ha confermato i numeri: **+6.031 token in scritture cache** per sessione dopo ogni commit git, **+1.690 token in letture cache** ad ogni chiamata API.

### Analisi del codice sorgente di CC — dove vanno i token

Abbiamo tracciato i token fino a due punti di iniezione indipendenti nel codice sorgente di Claude Code (v2.1.88):

**1. Snapshot di `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` raccoglie branch + branch principale + user.name + stato completo (fino a 2000 caratteri) + **gli ultimi 5 commit**
- Unito e aggiunto al system prompt tramite `appendSystemContext` (`utils/api.ts:437`)
- Ogni nuovo commit, ogni nuovo file modificato, ogni cambio di branch cambia il testo → invalidazione della cache del prefisso

**2. Istruzioni del flusso di lavoro commit/PR (~1.700 tok) — descrizione dello strumento Bash**
- `tools/BashTool/prompt.ts:53` aggiunge 60+ righe di protocollo di sicurezza, procedura di commit passo dopo passo, esempi HEREDOC e modelli di creazione PR alla descrizione dello strumento `Bash`
- Memorizzato nella cache insieme al system prompt, ma inviato come parametro `tools[]`

### Perché è costoso

La struttura della cache (`utils/api.ts:321` `splitSysPromptPrefix`) ha tre percorsi in base al fatto che tu abbia strumenti MCP attivi:

- **Percorso A** (MCP attivo — la maggior parte degli utenti): `gitStatus` si trova all'interno di un blocco `cacheScope: 'org'`. Qualsiasi modifica → l'intero blocco viene ri-messo in cache al prossimo avvio della sessione → miss di 6K tok `cache_create`.
- **Percorso B** (nessun MCP): `gitStatus` va in un blocco dinamico `cacheScope: null`, il che significa che viene reinviato come `input_tokens` fresco ad ogni chiamata API — nessun miss della cache, ma nemmeno risparmi sulla cache.
- **Percorso C** (provider 3P / beta sperimentali disabilitati): uguale al Percorso A.

Nelle tipiche sessioni interattive, le istruzioni commit/PR (1,7K tok) si accumulano **ad ogni chiamata API** tramite `cache_read`. Ai prezzi di Opus 4.7, su una sessione di 100 chiamate, si tratta di circa **~$0,08 per sessione** solo per istruzioni che il training di Claude copre già in gran parte.

### Come lo gestisce super-token-saver

`/setup-git-lite` disabilita il percorso nativo e inietta un **sostituto curato di 280 token** tramite un hook SessionStart. Abbiamo mantenuto esattamente ciò che sostituisce il comportamento predefinito di Claude (regole di sicurezza), e abbiamo eliminato tutto ciò che Claude sa già dal training (flussi di lavoro passo dopo passo, modelli PR, schemi di utilizzo di gh).

**Mantenuto — 11 regole di sostituzione critiche** (quelle che trasformano la predisposizione aiutare di Claude in cautela):
- Non fare mai commit/push/amend/PR/tag/merge senza richiesta esplicita dell'utente
- Non saltare mai gli hook, fare force-push su main/master, eseguire operazioni distruttive, modificare la configurazione git
- Non fare mai commit di file che corrispondono a `.env`, `credentials`, `*.pem`, `secret.*`
- Evitare `git add -A` / `git add .`
- HEREDOC per i messaggi di commit su più righe + trailer `Co-Authored-By: Claude`
- Non usare mai flag interattivi (-i), nessun commit vuoto
- Se l'hook pre-commit fallisce → creare un NUOVO commit (non `--amend`)

**Eliminato** — flusso di lavoro commit passo dopo passo (3 passi), flusso di lavoro PR passo dopo passo (3 passi), modello titolo/corpo PR, riferimenti comandi `gh`, avviso flag `-uall`, avviso `--no-edit` con rebase, vincolo `NON usare mai TodoWrite o strumenti Agent durante il commit`. Sono verbosità del flusso di lavoro che Claude compone correttamente dal training da solo.

**Aggiunto** — riga di stato git compatta: branch + HEAD short-sha + oggetto + stato attuale (fino a 20 file modificati, altrimenti un conteggio). Nessun elenco di commit recenti (Claude può eseguire `git log` su richiesta).

### Risparmi attesi (prezzi Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok lettura cache)

| Elemento | Originale | Con setup-git-lite | Risparmiato |
| ---- | -------- | ------------------- | ----- |
| Caricamento system prompt (per nuova sessione) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Chiamate ripetute nella stessa sessione | ~1.700 tok cache_read/chiamata | ~280 tok cache_read/chiamata | ~1.420 tok/chiamata |
| Sessione da 100 chiamate (Opus 4.7) | — | — | **~$0,11 risparmiati** |
| 20 sessioni/giorno × 22 giorni lavorativi | — | — | **~$48 risparmiati/mese** |

### Utilizzo

```bash
/setup-git-lite status     # Diagnostica in sola lettura — stato attuale + cosa cambierebbe
/setup-git-lite install    # Disabilitare CC nativo + abilitare il nostro hook minimale
/setup-git-lite revert     # Ripristinare le impostazioni predefinite (aggressivo; vedi sotto)
/setup-git-lite dismiss-banner    # Silenziare il suggerimento di raccomandazione occasionale
/setup-git-lite undismiss-banner  # Riabilitare il suggerimento
/setup-git-lite help       # Utilizzo completo
```

### Semantica dell'installazione

`install` modifica **due** posti per robustezza:

1. `~/.claude/settings.json` — aggiunge `"includeGitInstructions": false`
2. Profilo shell (`~/.zshrc`, `~/.bashrc`, ecc.) — aggiunge un blocco marcatore che esporta `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Ognuno da solo è sufficiente per disabilitare CC nativo; impostiamo entrambi in modo che una sostituzione dell'ambiente non riabiliti accidentalmente il comportamento nativo. La modifica dello shell ha effetto solo nelle nuove shell.

### Semantica del ripristino — aggressiva

`revert` **rimuove TUTTE le esportazioni di `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` dal tuo profilo shell**, incluse quelle che potresti aver aggiunto manualmente prima di installare questo skill. Questo è intenzionale — hai eseguito `revert`, quindi ripristiniamo l'impostazione predefinita pulita. Creiamo sempre prima un backup con timestamp del profilo shell.

Se hai bisogno della variabile d'ambiente per ragioni non correlate, annotala prima di eseguire `revert` e riaggiungila dopo.

### Prima di disinstallare super-token-saver

**Esegui prima `/setup-git-lite revert`**, altrimenti rimarrai con `includeGitInstructions: false` nel tuo settings.json ma senza hook sostitutivo (Claude non riceve alcuna guida git). Claude Code attualmente non ha un hook del ciclo di vita di disinstallazione del plugin, quindi non possiamo automatizzarlo.

### Compromessi

Cosa perdi (e perché di solito va bene):
- Claude non riceve più un `git status` / `git log -n 5` pre-calcolato all'avvio della sessione. Se chiedi "cosa è cambiato?" in una nuova sessione, Claude eseguirà quei comandi da solo (una chiamata di strumento aggiuntiva, ~300 tok).
- Claude non vede più la procedura di commit canonica in 3 passi di CC. Nei nostri test su centinaia di flussi di commit, le conoscenze di livello training gestiscono i casi critici (formattazione HEREDOC, nessun `--amend`, nessun force-push) perché li manteniamo come regole esplicite.
- Il modello del corpo PR (`## Summary` + `## Test plan`) non viene iniettato. Se ti importa esattamente quel formato, inseriscilo nel CLAUDE.md del tuo progetto.

### Banner di raccomandazione

Quando le istruzioni git native di CC sono ancora attive sulla tua macchina, super-token-saver mostra un suggerimento di un paragrafo all'avvio della sessione **~20% del tempo** (plus negli output di `/usage-view` e `/report-limit`). Chiudilo permanentemente con `/setup-git-lite dismiss-banner`.

---

## 🛡️ Funzionalità 5: Token Guardian

**Ti avvisa nel momento in cui una scadenza della cache ti costa denaro. Può bloccare il reinvio da $9, se glielo chiedi.**

Il TTL della cache dei prompt di Claude Code è di 1 ora. Allontanati per più a lungo e la cache scade. Il prossimo messaggio reinvia l'intero contesto al prezzo pieno. Con 900K token, sono $9 in un colpo solo.

Token Guardian tiene traccia di quando è arrivata l'ultima risposta. Se sono passati più di 3.590 secondi (il TTL meno un buffer di 10 secondi), può intervenire. **È disattivato per impostazione predefinita, a causa di Remote Control.** Il messaggio di blocco di un hook viene renderizzato localmente come messaggio di sistema che il client remoto non riceve mai, quindi un utente remoto vedeva il prompt sparire senza alcuna spiegazione. Invece di distribuire un controllo che si comporta diversamente a seconda di dove ti trovi, lo abbiamo disattivato. Quando Remote Control inizierà a inoltrare i messaggi degli hook, l'impostazione predefinita tornerà attiva. Fino ad allora, attivalo tu stesso con una delle due modalità.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude menziona la scadenza nella prima riga della sua risposta
export CC_TOKEN_SAVER_CACHE_GUARD=block   # il prompt viene rifiutato una volta con il messaggio qui sotto
```

In `warn` il prompt prosegue, e Claude apre la sua risposta con una riga che dice che la cache era scaduta, che questo turno ha pagato per l'intero contesto, e che dopo una pausa di un'ora o più il percorso più economico è `/clear` → `/s-continue`. Questa raggiunge un client remoto, perché la risposta di Claude viene inoltrata anche se i messaggi degli hook non lo sono.

In `block` il prompt viene rifiutato una volta con il messaggio qui sotto. Rinvialo e passa. Usala in un terminale locale quando vuoi il blocco netto.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Il messaggio di blocco viene mostrato in 23 lingue, scelte in base alle impostazioni locali del sistema operativo, e si attiva una sola volta per periodo di inattività.

**Gli agenti in background non vengono mai bloccati.** Solo i prompt digitati da una persona ricevono il controllo. I report di completamento di agenti e task in background — che ormai arrivano di norma più di un'ora dopo essere stati avviati — passano dritti. Il risultato di un agente di lunga durata non viene mai trattenuto né perso.

**Risultato:** in modalità warn sai sempre quando è avvenuto un reinvio da $9, e perché. In modalità block non avviene affatto: ogni scadenza intercettata risparmia $9, e con una al giorno sono $270/mese di puro spreco eliminato.

> **Se utilizzi l'API a pagamento per uso, l'impatto è maggiore.** Un abbonato al Max Plan perde $9 all'interno di un buffer di $200. Tu perdi $9 di denaro reale, silenziosamente, ogni volta che ti allontani. Token Guardian in modalità block lo blocca ogni volta.

---

## 💡 Come Funziona Davvero la Cache (e Perché la Maggior Parte degli Utenti Spreca il 40%+)

Claude Code invia l'intera cronologia della conversazione al modello ad ogni chiamata API. "Chiamata API" non significa "un messaggio che hai digitato". Un singolo prompt innesca chiamate di strumenti interni — Grep, Read, Edit, Write — e ognuna è una chiamata API separata. Un prompt può facilmente causare 10+ chiamate API.

La cache dei prompt riduce questo costo del 90%. Ma la cache ha una durata di vita.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| TTL cache           | 1 ora (ephemeral_1h)                 | 5 min                                  |
| Scrittura cache         | ＄10/MTok                              | ＄6,25/MTok                             |
| Lettura cache          | ＄0,50/MTok                            | ＄0,50/MTok                             |
| Quando la cache scade  | Contesto completo reinviato al prezzo pieno    | Basso impatto (il contesto è piccolo)          |

Anche con la cache attiva, i costi si accumulano. Ecco uno scenario estremo per mostrare la differenza.

### Scenario: Giornata completa di codifica (3h mattina → 2h pranzo/riunione → 3h pomeriggio)

Condizioni: prezzi Opus 4, 1 prompt al minuto, ~5 chiamate API per prompt (~300 chiamate/ora).

#### ❌ Senza super-token-saver

La maggior parte del lavoro avviene nella Main Session. Il contesto cresce rapidamente.

| Fase       | Situazione                         | Dimensione contesto               | Costo                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Mattina 3h  | Codifica (principalmente in Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0,50/M = ＄157,50  |
| Pranzo/Riunione   | Assente 2 ore                  | —                          | —                                      |
| Ritorno      | Cache scaduta → reinvio completo      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Ritorno      | /compact (riassumere)              | 600K → sent to LLM        | 600K × ＄0,50/M + summary output = ~＄1,50 |
| Pomeriggio 3h | La codifica continua (il contesto ri-cresce) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0,50/M = ＄157,50  |
|             | Totale                             |                            | ~＄326                                  |

> A questo livello di utilizzo, probabilmente raggiungerai il limite di frequenza della finestra di 5 ore. **Il costo è brutto, ma il vero problema è che il tuo lavoro si ferma completamente. Questo è esattamente il momento in cui Claude Code va al buio.**

#### ✅ Con super-token-saver

Il lavoro pesante viene delegato ai SubTask. Main gestisce solo design/decisioni.

| Fase       | Situazione                                    | Dimensione contesto                | Costo                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Mattina 3h  | Codifica (Main: design, SubTask: implementazione) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
| Pranzo/Riunione   | Assente 2 ore                             | —                           | —                                  |
| Ritorno      | ⚡ Token Guardian (modalità block) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| Pomeriggio 3h | La codifica continua                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
|             | Totale                                        |                             | ~＄180                              |

#### 💰 Risultato

> **＄326 → ＄180. ＄146 risparmiati al giorno. 45% di riduzione dei costi.**
>
> **Max Plan:** Meno token = non raggiungi il limite di frequenza. Il tuo lavoro non si ferma. Questa è la vera differenza.
>
> **API a pagamento per uso:** ＄146/giorno × 22 giorni lavorativi = **＄3.200/mese direttamente dalla tua fattura.** Un mese intenso senza questo plugin supera ＄7.000. Con esso, sotto ＄4.000. Lo stesso output.

### Dove interviene super-token-saver

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

## 🔧 Installazione da Sorgente & Personalizzazione

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver è completamente open-source (Apache-2.0). JavaScript puro + Bash — nessun binario compilato, nessuna chiamata API esterna, nessuna telemetria. Ogni riga è verificabile. Ogni affermazione in questo README corrisponde a un file specifico che puoi leggere.

- **hooks/** — Modificare la soglia di scadenza della cache, personalizzare i messaggi di avviso, modificare le regole dell'architettura di sessione
- **scripts/** — Logica di analisi, costruttore di report, formattazione della barra di stato
- **skills/** — Come funzionano /s-continue e /usage-view, modelli di prompt
- **locales/** — Aggiungere/modificare traduzioni, aggiungere nuove lingue
- **skills/usage-view/** — Modifiche al design UI/UX del dashboard

Rendilo tuo. Forkalo, sperimenta e invia un PR se trovi qualcosa di meglio.

---

## 🌐 Lingue Supportate

23 lingue supportate. Selezionate incrociando i 20 principali paesi per utilizzo di Claude Code con le 20 principali lingue per numero di parlanti globali. La lingua di visualizzazione viene rilevata automaticamente dalla configurazione locale del sistema operativo. Puoi anche specificarla manualmente: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Inglese    | 🇰🇷 Coreano     | 🇯🇵 Giapponese  | 🇨🇳 Cinese    |
| 🇪🇸 Spagnolo    | 🇫🇷 Francese     | 🇩🇪 Tedesco    | 🇧🇷 Portoghese |
| 🇮🇹 Italiano    | 🇷🇺 Russo    | 🇸🇦 Arabo    | 🇮🇳 Hindi      |
| 🇧🇩 Bengalese    | 🇮🇩 Indonesiano | 🇲🇾 Malese     | 🇹🇭 Tailandese       |
| 🇻🇳 Vietnamita | 🇹🇷 Turco    | 🇵🇱 Polacco    | 🇳🇱 Olandese      |
| 🇮🇱 Ebraico     | 🇸🇪 Svedese    | 🇳🇴 Norvegese |                 |

Le traduzioni attuali sono generate dall'IA. I contributi dei madrelingua sono benvenuti — modifica il file JSON per la tua lingua in `locales/` e invia un PR.

---

## ⚖️ Quanto Ti Costa Questo Plugin

Il plugin inietta contesto all'avvio della sessione. Ecco esattamente quanto:

| Iniezione | Quando | Token | Scopo |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (una volta) | ~1.100 | Strategia di delega SubTask + regole Concise Mode |
| Contesto git (se git-lite abilitato) | SessionStart (una volta) | ~280 | Sostituisce le ~2.200 tok di istruzioni git native di CC |
| Avviso scadenza cache | Con inattività > 59 min (una volta) | ~200 | Segnala il reinvio costoso, mostra il percorso più economico |
| Status line | Ogni chiamata API | 0 | Si renderizza nella barra di stato del terminale, non nel contesto della conversazione |

**Overhead netto per sessione: ~1.400 token (memorizzati in cache dopo la prima chiamata).**

Ai prezzi di Opus ($0,50/MTok lettura cache), sono **$0,0007 per chiamata API** — meno di un decimo di centesimo. Su una sessione di 100 chiamate: $0,07.

Se git-lite è abilitato, il plugin **risparmia** ~1.920 token per sessione (sostituisce 2.200 con 280). L'effetto netto è negativo — il plugin consuma meno di quanto rimuove.

**Per gli utenti API a pagamento per uso:** con una spesa di $3.000/mese, l'overhead del plugin è inferiore a $2/mese. I risparmi della sola prevenzione della scadenza della cache (un reinvio da $9 bloccato a settimana) coprono un anno di overhead con una singola intercettazione.

---

## 💡 Suggerimenti

### Comprendi la cache e vedrai dove vanno i soldi

- **1 prompt ≠ 1 chiamata API.** Ogni volta che Claude chiama Grep, Read o Edit, l'intero contesto viene reinviato. Un singolo prompt innesca facilmente 10+ chiamate API. Scrivi prompt chiari per ridurre le chiamate di strumenti non necessarie e tagliare i costi.
- **Il timer della cache si reimposta dall'ultima chiamata API, non dal tuo ultimo prompt.** Continua a lavorare e la cache non scade mai. Il pericolo è allontanarsi. Token Guardian ti dice quando è successo, e in modalità `block` blocca il prompt una volta così puoi scegliere: reimpostare il contesto o continuare così com'è.
- **Dimensione del contesto = moltiplicatore di costo.** La stessa chiamata API a 200K vs 800K costa 4 volte di più. Quando la barra di stato [CTX] supera il 35% (🟡), è il segnale per delegare di più ai SubTask.

### Abitudini che riducono i costi

- **Mantieni CLAUDE.md snello.** Viene caricato nel system prompt ad ogni chiamata API. Ogni riga costa denaro.
- **Delega il lavoro pesante ai SubTask.** La generazione di codice, le modifiche multi-file, le esecuzioni di test non appartengono a Main. I SubTask hanno un contesto più piccolo e un livello di cache più economico.
- **Assente per 1+ ore?** `/clear` → torna → `/s-continue`. Contesto ripristinato a $0.
- **[5H] sopra il 70% (🟡)?** Rallenta. Passa a compiti di revisione leggeri o aumenta la delega ai SubTask per ridurre il conteggio delle chiamate API di Main.
- **Usa `/btw` per le domande secondarie.** Non entra nella cronologia delle conversazioni, quindi il tuo contesto rimane snello.

### API a pagamento per uso: le abitudini che contano di più

Tutto quanto sopra si applica, più queste priorità specifiche per l'API:

- **Tieni d'occhio [CTX] come un tachimetro.** Nessun limite di frequenza ti fermerà — ma il contesto a 500K+ significa che ogni chiamata API costa 2-3 volte quello che dovrebbe. `/clear` → `/s-continue` è gratuito e reimposta il moltiplicatore di costo alla linea di base.
- **Esegui `/usage-view` settimanalmente.** Gli utenti del Max Plan hanno un momento naturale di "ahia" quando vengono limitati. Tu no — i costi salgono silenziosamente. Il dashboard è il tuo sistema di allerta precoce.
- **Stabilisci un budget giornaliero mentale.** Senza tetto, le giornate da $200 accadono senza accorgersene. L'indicatore RUN nella barra di stato rende visibile il costo per turno. Se un singolo turno supera $1 (🔴), il tuo contesto è troppo grande.

---

## 📚 Documentazione

- [Guida alla Cache dei Prompt](guides/prompt-cache-guide.md) — Perché la maggior parte del tuo costo è cache, come funziona il caching tra i provider (Anthropic, OpenAI, Gemini) e come gestirlo ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 lingue](guides/))
- [Analisi dei Costi Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Almeno il 24–38% più economico di Opus 5 a parità di qualità, su 2.782 sessioni
- [Analisi dei Costi Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Analisi dei Costi Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Confronto dei costi fianco a fianco su 8.563 chiamate API
- [Analisi dei Costi Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licenza

Apache-2.0
