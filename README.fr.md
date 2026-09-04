# super-token-saver

**Le seul plugin Claude Code qui lit réellement le code source de CC pour trouver où vont vos tokens — et le corrige automatiquement. Dépensez moins, codez plus longtemps.**

> Résultat mesuré : **réduction des coûts de 45 %** sur une charge de travail réelle de $326/jour → $180/jour. Délégation automatique aux SubTasks, restauration du contexte sans frais, tableau de bord analytique complet, et une protection contre l'expiration du cache — en une seule installation, zéro configuration.

Fonctionne avec **Max Plan ($200/mois)** et **API à la consommation**. Le même plugin, les mêmes fonctionnalités. Plus puissant pour chaque utilisateur — surtout quand chaque token représente de l'argent réel.

![Tableau de bord d'utilisation — voyez exactement où vont vos tokens](docs/images/usage-view-overview.png)

### Ce qu'il fait en 30 secondes

| Fonctionnalité | Ce qui se passe | Impact |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Délègue automatiquement le travail lourd aux SubTasks (cache 37,5 % moins cher) | Le contexte reste petit, les coûts baissent |
| 🪶 Concise Mode | Supprime le rembourrage des réponses, conserve la substance | Moins de tokens de sortie par réponse |
| 🔄 /s-continue | Remplace /compact — zéro appel LLM, zéro coût, zéro perte d'information, et restaure aussi les sessions **Codex** | Restauration du contexte gratuite, pour les deux outils |
| 🤝 /s-compact | Écrit une passation de session que /s-continue charge automatiquement — capture les découvertes des sous-agents et les résultats d'outils que la transcription perd | La session suivante récupère aussi le contexte caché |
| 📊 Status Line | Coût en temps réel, taille du contexte, limite de débit — sous 50 ms | Voir les problèmes avant qu'ils vous coûtent de l'argent |
| 📈 /usage-view | Tableau de bord HTML interactif avec analyse alimentée par IA | Analyse forensique complète des coûts en un clic |
| ✂️ /setup-git-lite | Supprime 2 200 tokens cachés que CC injecte à chaque session | ~$48/mois économisés rien que sur les instructions git |
| 🛡️ Token Guardian | Vous avertit dès qu'une expiration de cache renvoie votre contexte, ou le bloque en mode `block` | Plus de mauvaises surprises silencieuses à $9 |

---

## 😤 Le Problème

**Coûts invisibles.** Aucune visibilité en temps réel. Pas d'avertissement « votre contexte est à 800 000 tokens ». Pas d'alerte « le cache a expiré il y a 3 minutes ». Vous l'apprenez après que le dommage est fait.

**Gonflement du contexte.** Le même prompt à 200 000 vs 800 000 tokens de contexte coûte 4 fois plus cher. Chaque Read, Grep, Edit renvoie le contexte complet. Un prompt complexe déclenche facilement 15+ appels API, chacun multiplié par la taille de votre contexte.

**Expiration du cache.** Vous revenez du déjeuner. Le cache a disparu. Le prochain message renvoie 900 000 tokens au prix plein. $9 d'un coup.

**Tout manuel.** Gestion du contexte, timing de l'expiration du cache, délégation aux SubTasks, nettoyage des sessions. Personne ne peut suivre tout ça en codant réellement.

**Max Plan ($200/mois) ?** Tout ce qui précède, plus une limite de débit de 5 heures qui tue votre flow sans minuterie et sans ETA.

**API à la consommation ?** Tout ce qui précède, sauf qu'il n'y a pas de plafond. Un cache miss = $9 d'argent réel. Dix fois par semaine = $360/mois rien qu'en accidents. Un mauvais mardi avec un contexte gonflé peut coûter plus qu'un abonné Max Plan ne paie en un mois.

super-token-saver gère tout cela automatiquement. **Installez une fois. C'est réglé.**

---

## 🚀 Installation

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Fonctionne automatiquement après l'installation. Zéro configuration. Nécessite [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Pour la surveillance en direct :

```
/setup-statusline install
```

Pour supprimer 2 200 tokens cachés des instructions git intégrées de CC ([détails](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)) :

```
/setup-git-lite install
```

---

## 🧠 Fonctionnalité 1 : Smart Session Architecture

**Installez-le et les schémas de travail optimisés en coûts s'activent automatiquement.**

La plupart des utilisateurs font tout dans la Main Session. Lecture de fichiers, génération de code, exécution de tests. Chaque sortie s'empile dans le contexte et est renvoyée à chaque message. La session gonfle. Les coûts s'accumulent comme une boule de neige.

Session Architect injecte automatiquement une stratégie de délégation au démarrage de la session.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rôle             | Conception, décisions, révision         | Implémentation, génération de code, multi-fichiers  |
| Niveau de cache       | 1 heure (ephemeral_1h)             | 5 min                                 |
| Coût d'écriture du cache | ＄10/MTok                          | ＄6,25/MTok                            |
| Taille du contexte     | ~94K en moyenne                          | ~33K en moyenne                              |

Les SubTasks ont des **écritures de cache 37,5 % moins chères** que Main. Le contexte est aussi beaucoup plus petit. Déléguer le travail lourd aux SubTasks réduit considérablement les coûts.

**Résultat :** Le contexte reste sous 250K au lieu de croître à 600K+. Le même rendement de travail, la moitié du coût en tokens. Entièrement automatique.

---

## 🪶 Concise Mode

**Le même contenu. Moins de rembourrage. Activé par défaut.**

Le hook SessionStart injecte également une règle de style de réponse qui s'exécute dans **chaque session et chaque modèle** — sans flags, sans configuration. Trois choses changent :

- **Pas de préambule** — plus de « Laissez-moi vérifier… », « Je vais maintenant… », reformuler votre question ou résumer ce que le diff montre déjà
- **Le bon format pour le contenu** — puces pour les listes, prose pour le raisonnement (compromis, causalité, justification). Aucun n'est forcé
- **Expression plus concise** — le même point, moins de mots. Une prose plus claire est une prose plus courte

Limite stricte : ne jamais supprimer du contenu, sauter des vérifications ou condenser des nuances en une seule phrase. La substance reste complète ; seul l'emballage rétrécit.

Installez une fois, s'applique partout.

---

## 🔄 Fonctionnalité 2 : /s-continue — Restauration du Contexte

**Remplace `/compact`. Zéro appel LLM. Zéro coût en tokens. Zéro perte d'information.**

`/compact` envoie tout votre contexte (~1M de tokens) au LLM pour le compresser en un résumé de 3,3 %. Si le cache a expiré, cela seul déclenche un re-cache complet. La perte d'information est inévitable.

`/s-continue` adopte une approche complètement différente. Il prétraite la transcription de la session précédente et la charge directement. Pas d'appel LLM. Pas de coût. La conversation originale est restaurée telle quelle.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Fonctionnement            | Envoie le contexte complet au LLM pour un résumé | Prétraite la transcription, la lit directement |
| Appels LLM               | Nécessaires (typiquement 100K+ tokens) | 0                                |
| Coût en tokens              | Élevé                              | 0                                |
| Perte d'information        | Oui (résumé de 3,3 %)                | Aucune (original préservé)        |
| Vitesse de traitement        | Dizaines de secondes                   | < 1 sec (même fichiers 60Mo+)       |
| Quand le cache a expiré   | Coût de re-cache complet en plus         | Aucun impact                        |
| Restauration multi-session   | Impossible                      | Pris en charge                        |

Utilisation : `/clear` puis `/s-continue`. Vous verrez une liste des sessions précédentes. Choisissez-en une à restaurer. Pour une récupération rapide : `/s-continue last`.

**Résultat :** Reprenez le travail précédent à coût zéro. Aucune perte d'information. Traite les transcriptions de 60Mo+ en moins d'1 seconde.

### 🤝 Son binôme : `/s-compact` — transmettre la couche cachée

`/s-continue` restaure la **transcription** — ce que vous et Claude avez dit. Mais la connaissance la plus utile d'une session de travail vit souvent EN DEHORS de ce dialogue : ce qu'un **sous-agent** a trouvé (sa transcription est un fichier séparé que la restauration ne charge jamais), un **chiffre décisif dans la sortie d'un outil** (un nombre de tests, un benchmark), une **leçon tirée du processus** ("impossible à reproduire en headless → c'était le build, pas le code").

Exécutez `/s-compact` à la **fin** d'une session et il distille exactement cette couche cachée dans une passation, enregistrée dans `~/.claude/super-token-saver-data/<project>/handoff.md`. À la session suivante, `/s-continue` la **charge automatiquement** par-dessus la transcription restaurée — sans copier-coller.

|                     | `/s-continue` seul            | `/s-compact` + `/s-continue` (la paire)          |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| Récupère            | La transcription (ce qui a été dit)  | La transcription **plus** la couche cachée         |
| Découvertes des sous-agents   | Perdues (fichiers séparés)           | Distillées dans la passation                       |
| Chiffres de sortie d'outils | Uniquement si cités dans le chat    | Extraits délibérément                            |
| Leçons du processus     | —                               | Capturées pour ne pas rejouer les impasses              |

**Le déroulé :** terminez une session avec `/s-compact` → démarrez la suivante avec `/s-continue`.

### 🔀 Deux outils, un seul historique — les sessions Codex se restaurent ici aussi

Codex écrit ses sessions dans `~/.codex/sessions/`, Claude Code dans `~/.claude/projects/`. Ni l'un ni l'autre ne lit les fichiers de l'autre : un sprint dont le budget s'épuisait dans Codex restait donc inaccessible depuis Claude Code, et inversement.

`/s-continue` liste et restaure désormais les deux. Un rollout Codex n'est pas confié à un second analyseur : il est réécrit dans le format que produit Claude Code, **une ligne de sortie pour une ligne d'entrée**, si bien qu'un seul pipeline sert les deux outils et que chaque repère `L{n}` continue de pointer exactement la ligne du fichier Codex d'origine. Mesuré : un rollout de 12 Mo et 1 540 lignes se prétraite en **0,13 s**.

|                        | Session Claude Code | Session Codex |
| ---------------------- | ------------------- | ------------- |
| Listée par `/s-continue` | Oui | Oui, limitée au projet en cours |
| Restaurée sans coût LLM | Oui | Oui |
| Navigation `L{n}` vers l'original | Oui | Oui — les numéros de ligne viennent du rollout lui-même |
| Restauration après perte de contexte (`#0`) | `/compact`, auto-compact | Compaction Codex et retour en arrière du thread |
| Passation `/s-compact` | Partagée par projet — écrite dans un outil, chargée dans l'autre |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Deux détails séparent une liste correcte d'une liste plausible mais fausse. Le `session_id` de Codex est en fait l'id du **thread**, hérité par tout sous-agent lancé — les sessions sont donc identifiées via `payload.id`, et les rollouts de sous-agents sont filtrés de la même façon que Claude Code filtre déjà ses propres transcriptions de sous-tâches. Et `<codex_internal_context source="goal">` est injecté par la machine : il reste dans le contexte restauré mais n'est jamais compté comme un tour que vous avez tapé.

Le plugin s'installe aussi dans Codex — voir **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit` et `setup-statusline` restent pour l'instant réservés à Claude Code.

---

## 📊 Fonctionnalité 3 : Status Line en Temps Réel

**Surveillance des tokens/coûts en temps réel. Moins de 50 ms de surcoût.**

Exécutez `/setup-statusline install` une fois et une barre d'état persistante apparaît en bas de Claude Code.

**Fonctionnement normal** — toutes les métriques en un coup d'œil, zéro changement de contexte :

![Barre d'état en état normal](docs/images/statusline-normal.png)

**Limite de débit atteinte** — 5H devient rouge à 102 %, le compte à rebours indique exactement quand vous récupérez l'accès, et une action `/report-limit` en un seul geste apparaît automatiquement :

![Barre d'état quand la limite de débit est atteinte](docs/images/statusline-rate-limited.png)

| Indicateur        | Ce qu'il affiche                       | 🟢 Normal | 🟡 Avertissement | 🔴 Critique |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Coût du dernier appel API           | < ＄0,30   | >= ＄0,30   | >= ＄1,00    |
| RUN (cumulatif) | Coût cumulé pour ce dossier     | —         | —          | —           |
| 5H               | Utilisation de la fenêtre de 5 heures + compte à rebours | < 70%     | >= 70%     | >= 90%      |
| CTX              | Utilisation de la fenêtre de contexte                | < 35%     | >= 35%     | >= 70%      |

Quand un indicateur atteint avertissement ou critique, un conseil `→ /usage-view current` apparaît automatiquement.

Pour supprimer : `/setup-statusline uninstall` (la configuration précédente est automatiquement restaurée).

**Résultat :** Chaque problème de coût visible en temps réel. Moins de 50 ms de surcoût — aucun délai perceptible.

> **En API à la consommation ?** Les indicateurs 5H et W se masquent automatiquement — vous n'avez pas de fenêtres de limite de débit. Ce qui reste est ce qui compte : RUN (coût en temps réel par tour) et CTX (taille du contexte). Les deux leviers qui contrôlent votre facture, toujours visibles.

---

## 📈 Tableau de Bord d'Utilisation (/usage-view)

**Enfin la réponse : « Où est passé tout cet argent ? »**

Les utilisateurs Max Plan atteignent la limite de débit et se demandent pourquoi. Les utilisateurs API ouvrent la facture Anthropic et se demandent comment. Dans les deux cas, la question est la même : quelle session a brûlé le plus de tokens ? Quand les coûts ont-ils grimpé ? Quels schémas existe-t-il dans votre utilisation ? Jusqu'ici — tout invisible.

`/usage-view` montre tout. Un tableau de bord HTML interactif s'ouvre dans votre navigateur, vous permettant d'analyser les schémas d'utilisation et de retracer la cause première des pics de coûts. Aucune dépendance externe. Fonctionne de manière autonome. Partageable en tant que fichier.

**$4 196 en 31 jours. Où est tout allé ?** En un coup d'œil — coût total, répartition des tokens par type, ratio d'efficacité du cache et nombre de sessions. Le graphique en anneau montre instantanément que 65 % de vos dépenses sont des lectures de cache (ce qui est normal et sain) :

![Vue d'ensemble du tableau de bord d'utilisation](docs/images/usage-view-overview.png)

**Avant vs. après — mesuré, pas deviné.** Le marqueur orange en pointillés « Plugin installed » divise votre chronologie des coûts en deux. Les barres quotidiennes sont empilées par type de token (Input/Output/Cache Write/Cache Read) pour que vous voyiez exactement quel composant a changé après l'installation. La ligne de moyenne montre la tendance :

![Tendance des coûts quotidiens](docs/images/usage-view-daily-trend.png)

**Quand brûlez-vous le plus ?** Coût horaire selon l'heure de la journée et la répartition par jour de la semaine. Basculez entre la moyenne des jours actifs, la moyenne tous jours confondus ou le maximum. Les icônes de flamme marquent vos heures les plus coûteuses — les schémas visibles (marathons nocturnes, pics du mercredi) sautent aux yeux instantanément :

![Schéma de coût horaire et par jour de la semaine](docs/images/usage-view-hourly-pattern.png)

**Devenez-vous plus efficace ?** Le ratio Total/Output mesure combien de tokens sont consommés par token de sortie produit. Moins c'est mieux. Le marqueur « Plugin installed » vous permet de comparer avant vs. après. Les pics = cache misses ou redémarrages de session :

![Tendance d'efficacité](docs/images/usage-view-efficiency.png)

**Chaque appel API, tracé par taille de contexte et coût.** C'est le graphique qui rend la structure des coûts limpide. Chaque point est un appel API. Rouge = Opus, bleu = Sonnet, vert = Haiku. Les lignes en pointillés sont les prix théoriques — si vos points sont au-dessus de la ligne, vous payez trop. Basculez en vue **User Turn** pour voir le coût par tour de conversation plutôt que par appel API.
Survolez n'importe quel point pour voir le texte réel du prompt, le nombre de tokens et la ventilation complète des coûts (Input/Output/Cache Write/Cache Read) :

![Coût par taille de contexte — graphique de dispersion](docs/images/usage-view-cost-scatter.png)

**Quelle est la taille de vos contextes ?** La plupart des appels se regroupent sous 250K. La longue queue au-dessus de 350K est l'endroit où les coûts explosent — ce graphique montre exactement à quelle fréquence vous êtes dans la zone de danger :

![Distribution de la taille du contexte](docs/images/usage-view-context-dist.png)

**Votre planning de codage, tarifé à l'heure.** Une carte thermique de la fenêtre de 5 heures sur 30 jours. Vert (<$15/h), orange ($15-30/h), rouge ($30+/h). L'icône de crâne (💀) marque les fenêtres où vous avez atteint la limite de débit. Le curseur de coût en haut filtre les fenêtres bon marché pour faire ressortir les coûteuses — faites-le glisser pour trouver instantanément vos pires jours. Basculez entre les vues fenêtre de 5 heures et bloc de 1 heure :

![Carte thermique du calendrier d'utilisation horaire](docs/images/usage-view-calendar.png)

**Cliquez sur n'importe quelle cellule pour plonger dans les sessions de cette fenêtre.** Chaque session dans ce créneau horaire, avec le coût, le nombre de messages, la ventilation des tokens et les premiers/derniers messages réels de chaque conversation. Développez « Top Token Conversations » pour voir quels échanges spécifiques ont le plus brûlé — chaque entrée montre le texte du prompt, les étiquettes d'alerte de coût et des conseils d'optimisation :

![Panneau de détails de la session](docs/images/usage-view-session-drilldown.png)

**Analyse alimentée par IA (optionnel).** Quand vous exécutez `/usage-view` sans `--no-ai`, un analyste IA lit toutes les données de votre tableau de bord — avec référence de prix API intégrée — et produit un rapport écrit : facteurs de coût, anomalies, recommandations d'optimisation. Affiché automatiquement dans la langue de votre système d'exploitation (23 langues, RTL inclus ; graphiques/tableaux restent toujours en LTR) :

**Où est parti l'argent** — dépenses totales, facteurs de coût par type de token, tendance hebdomadaire et impact du plugin mesuré en chiffres réels :

![Analyse IA — ventilation des coûts](docs/images/usage-view-ai-report-1.png)

**Quand et comment vous travaillez** — heures de pointe, jours les plus chargés, distribution des appels API et schémas de limite de débit révélant des opportunités d'optimisation :

![Analyse IA — schémas de travail](docs/images/usage-view-ai-report-2.png)

**Quoi faire** — recommandations concrètes et étayées par des données adaptées à votre utilisation réelle. Changement de modèle, gestion du contexte, stratégie de session :

![Analyse IA — recommandations](docs/images/usage-view-ai-report-3.png)

**Partagez-le.** Le tableau de bord entier est un unique fichier HTML autonome — toutes les données intégrées, pas de serveur nécessaire. Envoyez-le à votre équipe, votre responsable ou votre comptable. Aucune dépendance externe. Fonctionne hors ligne. Utilisez le mode `private` pour supprimer tout le texte des prompts avant de partager — conserve l'analyse des coûts intacte tout en supprimant le contenu des conversations.

```
/usage-view                  # Tout le temps, tous les projets
/usage-view current          # Fenêtre actuelle de 5 heures uniquement
/usage-view last 7 days      # 7 derniers jours
/usage-view locale ja        # Japonais
/usage-view --no-ai          # Ignorer l'analyse IA (plus rapide)
/usage-view private          # Supprimer le texte des prompts (sûr à partager)
```

---

## 🔬 Recherche sur la Limite de Débit (/report-limit)

**Projet communautaire pour rétroconcevoir la formule de la limite de débit.**

Anthropic ne publie pas la formule exacte pour la fenêtre de 5 heures. Découvrons-la ensemble.

Quand vous atteignez une limite de débit, exécutez `/report-limit`. Vos données d'utilisation actuelles sont automatiquement soumises comme GitHub Discussion. Plus nous collectons de données, plus la formule devient claire.

---

## ✂️ Fonctionnalité 4 : /setup-git-lite — Alléger les instructions git intégrées de CC

**Nous avons lu le code source de Claude Code. Nous avons trouvé 2 200 tokens cachés injectés à chaque session pour lesquels vous payez silencieusement.**

### La découverte

Le 12/04/2026, un [issue GitHub](https://github.com/anthropics/claude-code/issues/47107) a révélé que le paramètre intégré `includeGitInstructions` de Claude Code brûle silencieusement des tokens à chaque session. La reproduction indépendante via [ce gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) a confirmé les chiffres : **+6 031 tokens en écritures de cache** par session après chaque commit git, **+1 690 tokens en lectures de cache** à chaque appel API.

### Analyse du code source de CC — où vont les tokens

Nous avons retracé les tokens jusqu'à deux points d'injection indépendants dans le code source de Claude Code (v2.1.88) :

**1. Instantané `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` collecte branch + branche principale + user.name + statut complet (jusqu'à 2 000 caractères) + **les 5 derniers commits**
- Joint et annexé au system prompt via `appendSystemContext` (`utils/api.ts:437`)
- Chaque nouveau commit, chaque nouveau fichier modifié, chaque changement de branch modifie le texte → invalidation du cache de préfixe

**2. Instructions du flux de travail commit/PR (~1 700 tok) — description de l'outil Bash**
- `tools/BashTool/prompt.ts:53` ajoute 60+ lignes de protocole de sécurité, procédure de commit étape par étape, exemples HEREDOC et modèles de création de PR à la description de l'outil `Bash`
- Mis en cache avec le system prompt, mais envoyé comme paramètre `tools[]`

### Pourquoi c'est coûteux

La structure du cache (`utils/api.ts:321` `splitSysPromptPrefix`) a trois chemins selon que vous avez des outils MCP actifs :

- **Chemin A** (MCP actif — la plupart des utilisateurs) : `gitStatus` est dans un bloc `cacheScope: 'org'`. Toute modification → tout le bloc est re-mis en cache au prochain démarrage de session → miss de 6K tok `cache_create`.
- **Chemin B** (pas de MCP) : `gitStatus` va dans un bloc dynamique `cacheScope: null`, ce qui signifie qu'il est renvoyé comme `input_tokens` frais à chaque appel API — pas de miss de cache, mais pas d'économies de cache non plus.
- **Chemin C** (fournisseur 3P / betas expérimentaux désactivés) : identique au chemin A.

Dans les sessions interactives typiques, les instructions commit/PR (1,7K tok) s'accumulent **à chaque appel API** via `cache_read`. Sur une session de 100 appels aux prix Opus 4.7, c'est environ **~$0,08 par session** rien que pour des instructions que l'entraînement de Claude couvre déjà en grande partie.

### Comment super-token-saver le gère

`/setup-git-lite` désactive le chemin natif et injecte un **remplacement curé de 280 tokens** via un hook SessionStart. Nous avons conservé exactement ce qui modifie le comportement par défaut de Claude (règles de sécurité), et supprimé tout ce que Claude sait déjà de l'entraînement (flux de travail étape par étape, modèles PR, schémas d'utilisation de gh).

**Conservé — 11 règles de remplacement critiques** (celles qui transforment l'utilité par défaut de Claude en prudence) :
- Ne jamais faire commit/push/amend/PR/tag/merge sans demande explicite de l'utilisateur
- Ne jamais ignorer les hooks, force-pusher sur main/master, exécuter des opérations destructives, modifier la config git
- Ne jamais commiter des fichiers correspondant à `.env`, `credentials`, `*.pem`, `secret.*`
- Éviter `git add -A` / `git add .`
- HEREDOC pour les messages de commit multi-lignes + trailer `Co-Authored-By: Claude`
- Ne jamais utiliser de flags interactifs (-i), pas de commits vides
- Si le hook pre-commit échoue → créer un NOUVEAU commit (pas `--amend`)

**Supprimé** — flux de travail de commit étape par étape (3 étapes), flux de travail de PR étape par étape (3 étapes), modèle de titre/corps de PR, références de commandes `gh`, avertissement de flag `-uall`, avertissement `--no-edit` avec rebase, contrainte `Ne JAMAIS utiliser TodoWrite ou les outils Agent pendant le commit`. Ce sont des verbosités de flux de travail que Claude compose correctement à partir de l'entraînement seul.

**Ajouté** — ligne d'état git compacte : branch + HEAD short-sha + sujet + statut actuel (jusqu'à 20 fichiers modifiés, sinon un décompte). Pas de liste de commits récents (Claude peut exécuter `git log` à la demande).

### Économies attendues (tarifs Opus 4.7, $25/MTok sortie, $5/MTok entrée, $0,50/MTok lecture cache)

| Élément | Original | Avec setup-git-lite | Économisé |
| ---- | -------- | ------------------- | ----- |
| Chargement system prompt (par nouvelle session) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Appels répétés dans la même session | ~1 700 tok cache_read/appel | ~280 tok cache_read/appel | ~1 420 tok/appel |
| Session de 100 appels (Opus 4.7) | — | — | **~$0,11 économisés** |
| 20 sessions/jour × 22 jours ouvrables | — | — | **~$48 économisés/mois** |

### Utilisation

```bash
/setup-git-lite status     # Diagnostic en lecture seule — état actuel + ce qui changerait
/setup-git-lite install    # Désactiver CC natif + activer notre hook minimal
/setup-git-lite revert     # Restaurer les paramètres par défaut (agressif ; voir ci-dessous)
/setup-git-lite dismiss-banner    # Réduire au silence le conseil de recommandation occasionnel
/setup-git-lite undismiss-banner  # Réactiver le conseil
/setup-git-lite help       # Utilisation complète
```

### Sémantique d'installation

`install` modifie **deux** endroits pour la robustesse :

1. `~/.claude/settings.json` — ajoute `"includeGitInstructions": false`
2. Profil shell (`~/.zshrc`, `~/.bashrc`, etc.) — ajoute un bloc marqueur exportant `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

L'un ou l'autre seul suffit à désactiver CC natif ; nous définissons les deux pour qu'un remplacement d'environnement ne réactive pas accidentellement le comportement natif. Le changement shell prend effet uniquement dans les nouveaux shells.

### Sémantique de restauration — agressive

`revert` **supprime TOUS les exports de `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` de votre profil shell**, y compris ceux que vous avez peut-être ajoutés manuellement avant d'installer ce skill. C'est intentionnel — vous avez exécuté `revert`, donc nous restaurons le paramètre par défaut propre. Nous créons toujours d'abord une sauvegarde horodatée du profil shell.

Si vous avez besoin de la variable d'environnement pour des raisons non liées, notez-la avant d'exécuter `revert` et rajoutez-la après.

### Avant de désinstaller super-token-saver

**Exécutez d'abord `/setup-git-lite revert`**, sinon vous vous retrouverez avec `includeGitInstructions: false` dans votre settings.json mais sans hook de remplacement (Claude ne reçoit aucune guidance git du tout). Claude Code n'a actuellement pas de hook de cycle de vie de désinstallation de plugin, donc nous ne pouvons pas automatiser cela.

### Compromis

Ce que vous perdez (et pourquoi c'est généralement acceptable) :
- Claude ne reçoit plus un `git status` / `git log -n 5` précalculé au démarrage de la session. Si vous demandez « qu'est-ce qui a changé ? » dans une nouvelle session, Claude exécutera ces commandes lui-même (un appel d'outil supplémentaire, ~300 tok).
- Claude ne voit plus la procédure canonique de commit en 3 étapes de CC. Dans nos tests sur des centaines de flux de commit, les connaissances de niveau entraînement gèrent les cas critiques (formatage HEREDOC, pas de `--amend`, pas de force-push) parce que nous les conservons comme règles explicites.
- Le modèle de corps de PR (`## Summary` + `## Test plan`) n'est pas injecté. Si ce format précis vous importe, mettez-le dans le CLAUDE.md de votre projet.

### Bannière de recommandation

Quand les instructions git natives de CC sont encore actives sur votre machine, super-token-saver affiche un conseil d'un paragraphe au démarrage de la session **~20 % du temps** (plus dans les sorties `/usage-view` et `/report-limit`). Dismissez définitivement avec `/setup-git-lite dismiss-banner`.

---

## 🛡️ Fonctionnalité 5 : Token Guardian

**Vous signale à l'instant où une expiration de cache vous coûte de l'argent. Peut bloquer le renvoi à $9 si vous le lui demandez.**

Le cache de prompts de Claude Code vit pendant 1 heure. Éloignez-vous plus longtemps et il expire. Votre prochain message renvoie tout le contexte au prix plein. Avec 900 000 tokens, c'est $9 d'un coup.

Token Guardian se souvient de l'heure d'arrivée de la dernière réponse. Si plus de 3 590 secondes se sont écoulées (le TTL moins un tampon de 10 secondes), il peut intervenir. **Il est désactivé par défaut, à cause de Remote Control.** Le message de blocage d'un hook est rendu localement comme un message système que le client distant ne reçoit jamais, si bien qu'un utilisateur distant voyait le prompt disparaître sans aucune explication. Plutôt que de livrer une protection qui se comporte différemment selon où vous êtes, nous l'avons désactivée. Quand Remote Control commencera à transmettre les messages des hooks, ce comportement par défaut reviendra. En attendant, activez-le vous-même avec l'un des deux modes.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude mentionne l'expiration dans sa première ligne
export CC_TOKEN_SAVER_CACHE_GUARD=block   # le prompt est refusé une fois avec le message ci-dessous
```

En mode `warn`, le prompt passe, et Claude ouvre sa réponse par une ligne indiquant que le cache avait expiré, que ce tour a été facturé comme un renvoi complet du contexte, et qu'après une pause d'une heure ou plus, `/clear` → `/s-continue` est le chemin le moins cher pour reprendre. Celui-ci atteint bien un client distant, car la réponse de Claude est transmise même si les messages des hooks ne le sont pas.

En mode `block`, le prompt est refusé une fois avec le message ci-dessous. Renvoyez-le et il passe. Utilisez-le dans un terminal local quand vous voulez l'arrêt strict.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Le message de blocage s'affiche en 23 langues, choisies selon votre paramètre régional du système d'exploitation, et se déclenche une seule fois par période d'inactivité.

**Les agents en arrière-plan ne sont jamais bloqués.** Seuls les prompts tapés par un humain déclenchent la vérification. Les rapports d'achèvement des agents et tâches en arrière-plan — qui arrivent désormais couramment plus d'une heure après leur lancement — passent directement. Le résultat d'un agent de longue durée n'est jamais retenu ni perdu.

**Résultat :** en mode avertissement, vous savez toujours quand un renvoi à $9 s'est produit, et pourquoi. En mode block, cela ne se produit pas : chaque expiration interceptée économise $9, et à raison d'une par jour, c'est $270/mois de gaspillage pur éliminé.

> **Si vous utilisez l'API à la consommation, l'impact est plus fort.** Les abonnés Max Plan perdent $9 dans un tampon de $200. Vous perdez $9 d'argent réel — silencieusement, à chaque fois que vous vous éloignez. Le mode block l'intercepte à chaque fois.

---

## 💡 Comment le cache fonctionne réellement (et pourquoi la plupart des utilisateurs gaspillent 40 %+)

Claude Code envoie tout l'historique de la conversation au modèle à chaque appel API. « Appel API » ne signifie pas « un message que vous avez tapé ». Un seul prompt déclenche des appels d'outils internes — Grep, Read, Edit, Write — et chacun est un appel API séparé. Un prompt peut facilement provoquer 10+ appels API.

Le cache de prompts réduit ce coût de 90 %. Mais le cache a une durée de vie.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| TTL du cache           | 1 heure (ephemeral_1h)                 | 5 min                                  |
| Écriture de cache         | ＄10/MTok                              | ＄6,25/MTok                             |
| Lecture de cache          | ＄0,50/MTok                            | ＄0,50/MTok                             |
| Quand le cache expire  | Contexte complet renvoyé au prix plein    | Faible impact (contexte est petit)          |

Même avec le cache actif, les coûts s'accumulent. Voici un scénario extrême pour montrer la différence.

### Scénario : Journée complète de codage (3h matin → 2h déjeuner/réunion → 3h après-midi)

Conditions : tarifs Opus 4, 1 prompt par minute, ~5 appels API par prompt (~300 appels/heure).

#### ❌ Sans super-token-saver

La plupart du travail se fait dans la Main Session. Le contexte grossit vite.

| Phase       | Situation                         | Taille du contexte               | Coût                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Matin 3h  | Codage (principalement dans Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0,50/M = ＄157,50  |
| Déjeuner/Réunion   | Absent 2 heures                  | —                          | —                                      |
| Retour      | Cache expiré → renvoi complet      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Retour      | /compact (résumer)              | 600K → sent to LLM        | 600K × ＄0,50/M + summary output = ~＄1,50 |
| Après-midi 3h | Codage continue (contexte regrossit) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0,50/M = ＄157,50  |
|             | Total                             |                            | ~＄326                                  |

> À ce niveau d'utilisation, vous atteindrez probablement la limite de débit de la fenêtre de 5 heures. **Le coût est mauvais, mais le vrai problème est que votre travail s'arrête complètement. C'est exactement le moment où Claude Code devient noir.**

#### ✅ Avec super-token-saver

Le travail lourd est délégué aux SubTasks. Main gère uniquement la conception/les décisions.

| Phase       | Situation                                    | Taille du contexte                | Coût                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Matin 3h  | Codage (Main : conception, SubTask : implémentation) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
| Déjeuner/Réunion   | Absent 2 heures                             | —                           | —                                  |
| Retour      | ⚡ Token Guardian (mode block) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| Après-midi 3h | Codage continue                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 Résultat

> **＄326 → ＄180. ＄146 économisés par jour. 45 % de réduction des coûts.**
>
> **Max Plan :** Moins de tokens = vous n'atteignez pas la limite de débit. Votre travail ne s'arrête pas. C'est la vraie différence.
>
> **API à la consommation :** ＄146/jour × 22 jours ouvrables = **＄3 200/mois directement de votre facture.** Un mois chargé sans ce plugin dépasse ＄7 000. Avec lui, sous ＄4 000. Le même rendement.

### Où super-token-saver intervient

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
    ├─ Token Guardian → Détecte l'expiration du cache, avertit (ou bloque en mode block)
    │
[Session restart]
    │
    └─ /s-continue → Restores previous context at zero cost (no LLM calls)
```

---

## 🔧 Installation depuis les sources & Personnalisation

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver est entièrement open-source (Apache-2.0). JavaScript pur + Bash — pas de binaires compilés, pas d'appels API externes, pas de télémétrie. Chaque ligne est auditable. Chaque affirmation dans ce README correspond à un fichier spécifique que vous pouvez lire.

- **hooks/** — Modifier le seuil d'expiration du cache, personnaliser les messages d'avertissement, modifier les règles d'architecture de session
- **scripts/** — Logique d'analyse, constructeur de rapports, formatage de la barre d'état
- **skills/** — Comment /s-continue et /usage-view fonctionnent, modèles de prompts
- **locales/** — Ajouter/modifier des traductions, ajouter de nouvelles langues
- **skills/usage-view/** — Modifications de conception UI/UX du tableau de bord

Faites-en le vôtre. Forkez-le, expérimentez et envoyez un PR si vous trouvez quelque chose de mieux.

---

## 🌐 Langues Prises en Charge

23 langues prises en charge. Sélectionnées en croisant les 20 premiers pays par utilisation de Claude Code avec les 20 premières langues par nombre de locuteurs mondiaux. La langue d'affichage est détectée automatiquement depuis votre paramètre régional du système d'exploitation. Vous pouvez aussi spécifier manuellement : `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Anglais    | 🇰🇷 Coréen     | 🇯🇵 Japonais  | 🇨🇳 Chinois    |
| 🇪🇸 Espagnol    | 🇫🇷 Français     | 🇩🇪 Allemand    | 🇧🇷 Portugais |
| 🇮🇹 Italien    | 🇷🇺 Russe    | 🇸🇦 Arabe    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonésien | 🇲🇾 Malais     | 🇹🇭 Thaï       |
| 🇻🇳 Vietnamien | 🇹🇷 Turc    | 🇵🇱 Polonais    | 🇳🇱 Néerlandais      |
| 🇮🇱 Hébreu     | 🇸🇪 Suédois    | 🇳🇴 Norvégien |                 |

Les traductions actuelles sont générées par IA. Les contributions de locuteurs natifs sont bienvenues — modifiez le fichier JSON pour votre langue dans `locales/` et soumettez un PR.

---

## ⚖️ Ce que ce Plugin vous Coûte

Le plugin injecte du contexte au démarrage de la session. Voici exactement combien :

| Injection | Quand | Tokens | Objectif |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (une fois) | ~1 100 | Stratégie de délégation SubTask + règles Concise Mode |
| Contexte git (si git-lite activé) | SessionStart (une fois) | ~280 | Remplace les ~2 200 tok d'instructions git natives de CC |
| Avertissement d'expiration de cache | À l'inactivité > 59 min (une fois) | ~200 | Signale le renvoi coûteux, montre le chemin le moins cher |
| Status line | Chaque appel API | 0 | S'affiche dans la barre d'état du terminal, pas dans le contexte de la conversation |

**Surcoût net par session : ~1 400 tokens (mis en cache après le premier appel).**

Aux tarifs Opus ($0,50/MTok lecture cache), c'est **$0,0007 par appel API** — moins d'un dixième de centime. Sur une session de 100 appels : $0,07.

Si git-lite est activé, le plugin **économise** ~1 920 tokens par session (remplace 2 200 par 280). L'effet net est négatif — le plugin consomme moins qu'il ne supprime.

**Pour les utilisateurs API à la consommation :** à $3 000/mois de dépenses, le surcoût du plugin est inférieur à $2/mois. Les économies de la seule prévention de l'expiration du cache (un renvoi de $9 bloqué par semaine) couvrent une année de surcoût en une seule interception.

---

## 💡 Conseils

### Comprenez le cache et vous verrez où va l'argent

- **1 prompt ≠ 1 appel API.** Chaque fois que Claude appelle Grep, Read ou Edit, le contexte entier est renvoyé. Un seul prompt déclenche facilement 10+ appels API. Rédigez des prompts clairs pour réduire les appels d'outils inutiles et les coûts.
- **Le minuteur du cache se réinitialise depuis le dernier appel API, pas votre dernier prompt.** Continuez à travailler et le cache n'expire jamais. Le danger est de s'éloigner. Token Guardian vous indique quand c'est arrivé, et en mode `block`, il bloque le prompt une fois pour que vous puissiez choisir : réinitialiser le contexte, ou continuer tel quel.
- **Taille du contexte = multiplicateur de coût.** Le même appel API à 200K vs 800K coûte 4 fois plus. Quand la barre d'état [CTX] dépasse 35 % (🟡), c'est le signal de déléguer davantage aux SubTasks.

### Habitudes qui réduisent les coûts

- **Garder CLAUDE.md léger.** Il se charge dans le system prompt à chaque appel API. Chaque ligne coûte de l'argent.
- **Déléguer le travail lourd aux SubTasks.** La génération de code, les éditions multi-fichiers, les exécutions de tests n'ont pas leur place dans Main. Les SubTasks ont un contexte plus petit et un niveau de cache moins cher.
- **Absent 1+ heures ?** `/clear` → revenir → `/s-continue`. Contexte restauré pour $0.
- **[5H] au-dessus de 70 % (🟡) ?** Ralentir. Passer à des tâches de révision légères ou augmenter la délégation aux SubTasks pour réduire le nombre d'appels API de Main.
- **Utiliser `/btw` pour les questions secondaires.** Cela ne rentre pas dans l'historique des conversations, donc votre contexte reste léger.

### API à la consommation : les habitudes qui comptent le plus

Tout ce qui précède s'applique, plus ces priorités spécifiques à l'API :

- **Surveiller [CTX] comme un compteur de vitesse.** Aucune limite de débit ne vous arrêtera — mais un contexte à 500K+ signifie que chaque appel API coûte 2-3 fois ce qu'il devrait. `/clear` → `/s-continue` est gratuit et remet votre multiplicateur de coût à la valeur de base.
- **Exécuter `/usage-view` chaque semaine.** Les utilisateurs Max Plan ont un moment naturel « aïe » quand ils sont limités. Vous non — les coûts montent silencieusement. Le tableau de bord est votre système d'alerte précoce.
- **Définir un budget quotidien mental.** Sans plafond, les journées à $200 arrivent sans qu'on s'en aperçoive. L'indicateur RUN dans la barre d'état rend le coût par tour visible. Si un seul tour dépasse $1 (🔴), votre contexte est trop grand.

---

## 📚 Documentation

- [Guide du cache de prompts](guides/prompt-cache-guide.md) — Pourquoi la plupart de vos coûts sont liés au cache, comment la mise en cache fonctionne entre les fournisseurs (Anthropic, OpenAI, Gemini) et comment la gérer ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 langues](guides/))
- [Analyse des coûts Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Au moins 24–38 % moins cher qu'Opus 5 à qualité égale, sur 2 782 sessions
- [Analyse des coûts Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Analyse des coûts Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Comparaison des coûts côte à côte sur 8 563 appels API
- [Analyse des coûts Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licence

Apache-2.0
