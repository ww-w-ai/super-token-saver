# super-token-saver

**O único plugin do Claude Code que realmente lê o código-fonte do CC para descobrir para onde vão seus tokens — e corrige isso automaticamente. Gaste menos, programe por mais tempo.**

> Resultado medido: **redução de 45% nos custos** em uma carga de trabalho real de $326/dia → $180/dia. Delegação automática para SubTasks, restauração de contexto sem custo, um painel de análise completo e um guardião contra a expiração de cache — em uma única instalação, zero configuração.

Funciona com **Max Plan ($200/mês)** e **API de pagamento por uso**. O mesmo plugin, os mesmos recursos. Mais eficaz para todos os usuários — especialmente quando cada token representa dinheiro real.

![Painel de uso — veja exatamente para onde vão seus tokens](docs/images/usage-view-overview.png)

### O que faz em 30 segundos

| Recurso | O que acontece | Impacto |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delega automaticamente trabalho pesado para SubTasks (cache 37,5% mais barato) | Contexto permanece pequeno, custos caem |
| 🪶 Concise Mode | Reduz preenchimento nas respostas, mantém a substância | Menos tokens de saída por resposta |
| 🔄 /s-continue | Substitui /compact — zero chamadas LLM, zero custo, zero perda de informação, e também restaura sessões do **Codex** | Restauração de contexto gratuita, nas duas ferramentas |
| 🤝 /s-compact | Escreve um handoff de sessão que o /s-continue carrega automaticamente — captura descobertas de subagentes e resultados de ferramentas que a transcrição perde | A próxima sessão também recupera o contexto oculto |
| 📊 Status Line | Custo em tempo real, tamanho do contexto, limite de taxa — abaixo de 50ms | Ver problemas antes que custem dinheiro |
| 📈 /usage-view | Painel HTML interativo com análise alimentada por IA | Análise forense completa de custos em um clique |
| ✂️ /setup-git-lite | Remove 2.200 tokens ocultos que o CC injeta a cada sessão | ~$48/mês economizados apenas em instruções git |
| 🛡️ Token Guardian | Avisa você no momento em que uma expiração de cache reenvia seu contexto, ou bloqueia isso no modo `block` | Fim dos sustos silenciosos de $9 |

---

## 😤 O Problema

**Custos invisíveis.** Sem visibilidade em tempo real. Sem aviso de "seu contexto está em 800K". Sem alerta de "o cache expirou há 3 minutos". Você fica sabendo depois que o estrago está feito.

**Inchaço do contexto.** O mesmo prompt com 200K vs 800K de contexto custa 4 vezes mais. Cada Read, Grep, Edit reenvia o contexto completo. Um prompt complexo facilmente dispara 15+ chamadas à API, cada uma multiplicada pelo tamanho do seu contexto.

**Expiração de cache.** Você volta do almoço. O cache sumiu. A próxima mensagem reenvia 900K tokens ao preço cheio. $9 de uma vez.

**Tudo manual.** Gerenciamento do contexto, timing da expiração do cache, delegação para SubTask, limpeza de sessões. Ninguém consegue acompanhar tudo isso enquanto realmente programa.

**Max Plan ($200/mês)?** Tudo acima, mais um limite de taxa de 5 horas que mata seu fluxo sem temporizador e sem ETA.

**API de pagamento por uso?** Tudo acima, exceto que não há teto. Um miss de cache = $9 de dinheiro real. Dez vezes por semana = $360/mês só em acidentes. Uma terça-feira ruim com contexto inflado pode custar mais do que um assinante do Max Plan paga em um mês.

super-token-saver cuida de tudo isso automaticamente. **Instale uma vez. Pronto.**

---

## 🚀 Instalação

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Funciona automaticamente após a instalação. Zero configuração. Requer [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Para monitoramento ao vivo:

```
/setup-statusline install
```

Para remover 2.200 tokens ocultos das instruções git integradas do CC ([detalhes](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Recurso 1: Smart Session Architecture

**Instale e os padrões de trabalho otimizados em custos entram em ação automaticamente.**

A maioria dos usuários faz tudo na Main Session. Leitura de arquivos, geração de código, execução de testes. Cada saída se acumula no contexto e é reenviada a cada mensagem. A sessão infla. Os custos crescem como uma bola de neve.

O Session Architect injeta automaticamente uma estratégia de delegação no início da sessão.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Papel             | Design, decisões, revisão         | Implementação, geração de código, multi-arquivo  |
| Nível de cache       | 1 hora (ephemeral_1h)             | 5 min                                 |
| Custo de escrita no cache | ＄10/MTok                          | ＄6,25/MTok                            |
| Tamanho do contexto     | ~94K em média                          | ~33K em média                              |

SubTasks têm **escritas no cache 37,5% mais baratas** que Main. O contexto também é muito menor. Delegar trabalho pesado para SubTasks reduz os custos dramaticamente.

**Resultado:** O contexto permanece abaixo de 250K em vez de crescer para 600K+. O mesmo rendimento de trabalho, metade do custo em tokens. Totalmente automático.

---

## 🪶 Concise Mode

**O mesmo conteúdo. Menos preenchimento. Ativado por padrão.**

O hook SessionStart também injeta uma regra de estilo de resposta que roda em **cada sessão e cada modelo** — sem flags, sem configuração. Três coisas mudam:

- **Sem preâmbulo** — sem "Deixa eu verificar…", "Vou agora…", reformular sua pergunta ou recapitular o que o diff já mostra
- **Formato certo para o conteúdo** — marcadores para listas, prosa para raciocínio (trade-offs, causalidade, justificativa). Nenhum é forçado
- **Expressão mais concisa** — o mesmo ponto, menos palavras. Uma prosa mais clara é uma prosa mais curta

Limite rígido: nunca omitir conteúdo, pular verificação ou colapsar nuances em uma única frase. A substância permanece completa; apenas o invólucro encolhe.

Instale uma vez, aplica-se em todos os lugares.

---

## 🔄 Recurso 2: /s-continue — Restauração de Contexto

**Substitui `/compact`. Zero chamadas LLM. Zero custo de tokens. Zero perda de informação.**

`/compact` envia todo o seu contexto (~1M de tokens) para o LLM para compactá-lo em um resumo de 3,3%. Se o cache expirou, isso sozinho dispara um re-cache completo. A perda de informação é inevitável.

`/s-continue` adota uma abordagem completamente diferente. Ele pré-processa a transcrição da sessão anterior e a carrega diretamente. Sem chamada LLM. Sem custo. A conversa original é restaurada como estava.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Como funciona            | Envia contexto completo ao LLM para resumo | Pré-processa transcrição, lê diretamente |
| Chamadas LLM               | Necessárias (tipicamente 100K+ tokens) | 0                                |
| Custo de tokens              | Alto                              | 0                                |
| Perda de informação        | Sim (resumo de 3,3%)                | Nenhuma (original preservado)        |
| Velocidade de processamento        | Dezenas de segundos                   | < 1 seg (mesmo arquivos de 60MB+)       |
| Quando o cache expirou   | Custo de re-cache completo adicional         | Sem impacto                        |
| Restauração multi-sessão   | Não possível                      | Suportado                        |

Uso: `/clear` depois `/s-continue`. Você verá uma lista de sessões anteriores. Escolha uma para restaurar. Para recuperação rápida: `/s-continue last`.

**Resultado:** Retome o trabalho anterior com custo zero. Sem perda de informação. Processa transcrições de 60MB+ em menos de 1 segundo.

### 🤝 Seu par: `/s-compact` — entregue a camada oculta

`/s-continue` restaura a **transcrição** — o que você e o Claude disseram. Mas o conhecimento mais útil de uma sessão de trabalho geralmente vive FORA desse diálogo: o que um **subagente** descobriu (sua transcrição é um arquivo separado que a restauração nunca carrega), um **número decisivo na saída de uma ferramenta** (uma contagem de testes, um benchmark), uma **lição aprendida do processo** ("não conseguiu reproduzir em headless → era o build, não o código").

Execute `/s-compact` no **fim** de uma sessão e ele destila exatamente essa camada oculta em um handoff, salvo em `~/.claude/super-token-saver-data/<project>/handoff.md`. Na próxima sessão, `/s-continue` **carrega automaticamente** por cima da transcrição restaurada — sem colar nada.

|                     | `/s-continue` sozinho            | `/s-compact` + `/s-continue` (o conjunto)          |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| Recupera            | A transcrição (o que foi dito)  | A transcrição **mais** a camada oculta         |
| Descobertas de subagentes   | Perdidas (arquivos separados)           | Destiladas no handoff                       |
| Números de saída de ferramentas | Só se citados no chat    | Extraídos deliberadamente                            |
| Lições do processo     | —                               | Capturadas para não repetir becos sem saída              |

**O fluxo de trabalho:** termine uma sessão com `/s-compact` → comece a próxima com `/s-continue`.


### 🔀 Duas ferramentas, um só histórico — sessões do Codex também restauram aqui

O Codex grava suas sessões em `~/.codex/sessions/`; o Claude Code grava as suas em `~/.claude/projects/`. Nenhum dos dois lê as do outro. Então um sprint que ficou sem orçamento no Codex era inacessível a partir do Claude Code — e o inverso também.

`/s-continue` agora lista e restaura os dois. Um rollout do Codex não é entregue a um segundo parser: ele é reescrito no mesmo formato que o Claude Code grava, **uma linha de saída por linha de entrada**, de modo que o mesmo pipeline atende ambas as ferramentas e cada marcador `L{n}` continua apontando exatamente para a linha do arquivo original do Codex. Medido: um rollout de 12 MB, 1,540-line, é pré-processado em **0.13 s**.

|                        | Sessão do Claude Code | Sessão do Codex |
| ---------------------- | ---------------------- | ---------------- |
| Listada por `/s-continue` | Sim | Sim, restrita ao projeto atual |
| Restaurada com custo zero de LLM | Sim | Sim |
| Busca `L{n}` no original | Sim | Sim — os números de linha são do próprio rollout |
| Restauração de perda de contexto (`#0`) | `/compact`, auto-compact | Compactação do Codex e rollback de thread |
| Handoff do `/s-compact` | Compartilhado por projeto — escreva em uma ferramenta, carregue na outra |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Dois detalhes fazem a diferença entre uma lista correta e uma errada que só parece certa: o `session_id` do Codex é o id da **thread**, herdado por qualquer subagente disparado, então as sessões são indexadas por `payload.id` e os rollouts de subagentes são filtrados do mesmo jeito que os transcritos de subtarefa do Claude Code já são. E `<codex_internal_context source="goal">` é injetado pela própria máquina, então permanece no contexto restaurado, mas nunca é contado como um turno que você digitou.

O plugin também se instala no Codex — veja **[README-CODEX.md](./README-CODEX.md)**
([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)).
`usage-view`, `report-limit` e `setup-statusline` continuam exclusivos do Claude Code por enquanto.

---

## 📊 Recurso 3: Status Line ao Vivo

**Monitoramento de tokens/custos em tempo real. Menos de 50ms de sobrecarga.**

Execute `/setup-statusline install` uma vez e uma barra de status persistente aparece na parte inferior do Claude Code.

**Operação normal** — todas as métricas de uma olhada, zero troca de contexto:

![Barra de status em estado normal](docs/images/statusline-normal.png)

**Limite de taxa atingido** — 5H fica vermelha a 102%, a contagem regressiva mostra exatamente quando você voltará, e uma ação `/report-limit` de um toque aparece automaticamente:

![Barra de status quando limitado por taxa](docs/images/statusline-rate-limited.png)

| Indicador        | O que mostra                       | 🟢 Normal | 🟡 Atenção | 🔴 Crítico |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Custo da última chamada à API           | < ＄0,30   | >= ＄0,30   | >= ＄1,00    |
| RUN (cumulativo) | Custo cumulativo para esta pasta     | —         | —          | —           |
| 5H               | Uso da janela de 5 horas + contagem regressiva de redefinição | < 70%     | >= 70%     | >= 90%      |
| CTX              | Uso da janela de contexto                | < 35%     | >= 35%     | >= 70%      |

Quando qualquer indicador atinge atenção ou crítico, uma dica `→ /usage-view current` aparece automaticamente.

Para remover: `/setup-statusline uninstall` (configuração anterior restaurada automaticamente).

**Resultado:** Cada problema de custo visível em tempo real. Menos de 50ms de sobrecarga — sem atraso perceptível.

> **Na API de pagamento por uso?** Os indicadores 5H e W se ocultam automaticamente — você não tem janelas de limite de taxa. O que permanece é o que importa: RUN (custo em tempo real por turno) e CTX (tamanho do contexto). As duas alavancas que controlam sua fatura, sempre visíveis.

---

## 📈 Painel de Uso (/usage-view)

**Finalmente responda: "Para onde foi todo esse dinheiro?"**

Usuários do Max Plan atingem o limite de taxa e se perguntam por quê. Usuários da API abrem a fatura da Anthropic e se perguntam como. De qualquer forma, a pergunta é a mesma: qual sessão queimou mais tokens? Quando os custos dispararam? Que padrões existem no seu uso? Até agora — tudo invisível.

`/usage-view` mostra tudo. Um painel HTML interativo abre no seu navegador, permitindo analisar padrões de uso e rastrear a causa raiz de picos de custo. Sem dependências externas. Funciona de forma autônoma. Compartilhável como arquivo.

**$4.196 em 31 dias. Para onde foi tudo?** Uma olhada — custo total, detalhamento de tokens por tipo, proporção de eficiência do cache e contagem de sessões. O gráfico de rosca mostra instantaneamente que 65% dos seus gastos são leituras de cache (o que é normal e saudável):

![Visão geral do painel de uso](docs/images/usage-view-overview.png)

**Antes vs. depois — medido, não adivinhado.** O marcador pontilhado laranja "Plugin installed" divide sua linha do tempo de custos em duas. As barras diárias são empilhadas por tipo de token (Input/Output/Cache Write/Cache Read) para que você veja exatamente qual componente mudou após a instalação. A linha de média mostra a tendência:

![Tendência de custo diário](docs/images/usage-view-daily-trend.png)

**Quando você gasta mais?** Custo por hora de acordo com a hora do dia e detalhamento por dia da semana. Alterne entre média de dias ativos, média de todos os dias ou máximo. Ícones de chama marcam suas horas mais caras — padrões visíveis (maratonas noturnas, picos de quarta-feira) saltam aos olhos instantaneamente:

![Padrão de custo por hora e dia da semana](docs/images/usage-view-hourly-pattern.png)

**Você está ficando mais eficiente?** A proporção Total/Output mede quantos tokens são consumidos por token de saída produzido. Menor é melhor. O marcador "Plugin installed" permite comparar antes vs. depois. Picos = misses de cache ou reinicializações de sessão:

![Tendência de eficiência](docs/images/usage-view-efficiency.png)

**Cada chamada à API, plotada por tamanho de contexto e custo.** Este é o gráfico que torna a estrutura de custos clara. Cada ponto é uma chamada à API. Vermelho = Opus, azul = Sonnet, verde = Haiku. As linhas pontilhadas são preços teóricos — se seus pontos estão acima da linha, você está pagando a mais. Alterne para a visualização **User Turn** para ver o custo por turno de conversa em vez de por chamada à API.
Passe o mouse sobre qualquer ponto para ver o texto real do prompt, a contagem de tokens e o detalhamento completo de custos (Input/Output/Cache Write/Cache Read):

![Custo por tamanho de contexto — gráfico de dispersão](docs/images/usage-view-cost-scatter.png)

**Quão grandes são seus contextos?** A maioria das chamadas se agrupa abaixo de 250K. A longa cauda acima de 350K é onde os custos explodem — este gráfico mostra exatamente com que frequência você está na zona de perigo:

![Distribuição do tamanho do contexto](docs/images/usage-view-context-dist.png)

**Seu cronograma de programação, com preço por hora.** Um mapa de calor de janela de 5 horas ao longo de 30 dias. Verde (<$15/h), laranja ($15-30/h), vermelho ($30+/h). O ícone de caveira (💀) marca janelas onde você atingiu o limite de taxa. O controle deslizante de custo no topo filtra janelas baratas para que as caras se destaquem — arraste-o para encontrar seus piores dias instantaneamente. Alterne entre visualizações de janela de 5 horas e bloco de 1 hora:

![Mapa de calor do calendário de uso por hora](docs/images/usage-view-calendar.png)

**Clique em qualquer célula para detalhar as sessões dessa janela.** Cada sessão naquele intervalo de tempo, com custo, contagem de mensagens, detalhamento de tokens e as primeiras/últimas mensagens reais de cada conversa. Expanda "Top Token Conversations" para ver quais trocas específicas queimaram mais — cada entrada mostra o texto do prompt, tags de alerta de custo e dicas de otimização:

![Painel de detalhes da sessão](docs/images/usage-view-session-drilldown.png)

**Análise alimentada por IA (opcional).** Quando você executa `/usage-view` sem `--no-ai`, um analista de IA lê todos os dados do seu painel — com referência de preços da API incorporada — e produz um relatório escrito: fatores de custo, anomalias, recomendações de otimização. Exibido automaticamente no idioma do seu sistema operacional (23 idiomas, RTL incluído; gráficos/tabelas sempre permanecem em LTR):

**Para onde foi o dinheiro** — gasto total, fatores de custo por tipo de token, tendência semanal e impacto do plugin medido em números reais:

![Análise de IA — detalhamento de custos](docs/images/usage-view-ai-report-1.png)

**Quando e como você trabalha** — horários de pico, dias mais movimentados, distribuição de chamadas à API e padrões de limite de taxa que revelam oportunidades de otimização:

![Análise de IA — padrões de trabalho](docs/images/usage-view-ai-report-2.png)

**O que fazer a respeito** — recomendações concretas e baseadas em dados adaptadas ao seu uso real. Troca de modelo, gerenciamento de contexto, estratégia de sessão:

![Análise de IA — recomendações](docs/images/usage-view-ai-report-3.png)

**Compartilhe.** O painel inteiro é um único arquivo HTML autônomo — todos os dados incorporados, sem necessidade de servidor. Envie para sua equipe, seu gerente ou seu contador. Sem dependências externas. Funciona offline. Use o modo `private` para remover todo o texto dos prompts antes de compartilhar — mantém a análise de custos intacta enquanto remove o conteúdo da conversa.

```
/usage-view                  # Todo o tempo, todos os projetos
/usage-view current          # Apenas a janela atual de 5 horas
/usage-view last 7 days      # Últimos 7 dias
/usage-view locale ja        # Japonês
/usage-view --no-ai          # Pular análise de IA (mais rápido)
/usage-view private          # Remover texto dos prompts (seguro para compartilhar)
```

---

## 🔬 Pesquisa de Limite de Taxa (/report-limit)

**Projeto comunitário para fazer engenharia reversa da fórmula do limite de taxa.**

A Anthropic não publica a fórmula exata para a janela de 5 horas. Vamos descobrir juntos.

Quando você atingir um limite de taxa, execute `/report-limit`. Seus dados de uso atuais são enviados automaticamente como GitHub Discussion. Quanto mais dados coletarmos, mais clara a fórmula fica.

---

## ✂️ Recurso 4: /setup-git-lite — Reduzir as Instruções Git Integradas do CC

**Lemos o código-fonte do Claude Code. Encontramos 2.200 tokens ocultos injetados a cada sessão pelos quais você está pagando silenciosamente.**

### A descoberta

Em 12/04/2026, um [issue do GitHub](https://github.com/anthropics/claude-code/issues/47107) revelou que a configuração integrada `includeGitInstructions` do Claude Code queima tokens silenciosamente a cada sessão. Reprodução independente via [este gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) confirmou os números: **+6.031 tokens em escritas de cache** por sessão após cada commit git, **+1.690 tokens em leituras de cache** em cada chamada à API.

### Análise do código-fonte do CC — para onde vão os tokens

Rastreamos os tokens até dois pontos de injeção independentes no código-fonte do Claude Code (v2.1.88):

**1. Snapshot de `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` coleta branch + branch principal + user.name + status completo (até 2000 caracteres) + **os últimos 5 commits**
- Unido e anexado ao system prompt via `appendSystemContext` (`utils/api.ts:437`)
- Cada novo commit, cada novo arquivo modificado, cada troca de branch muda o texto → invalidação do cache de prefixo

**2. Instruções do fluxo de trabalho commit/PR (~1.700 tok) — descrição da ferramenta Bash**
- `tools/BashTool/prompt.ts:53` anexa 60+ linhas de protocolo de segurança, procedimento de commit passo a passo, exemplos de HEREDOC e modelos de criação de PR à descrição da ferramenta `Bash`
- Armazenado em cache junto com o system prompt, mas enviado como parâmetro `tools[]`

### Por que é caro

A estrutura de cache (`utils/api.ts:321` `splitSysPromptPrefix`) tem três caminhos baseados em se você tem ferramentas MCP ativas:

- **Caminho A** (MCP ativo — a maioria dos usuários): `gitStatus` fica dentro de um bloco `cacheScope: 'org'`. Qualquer mudança → todo o bloco é re-armazenado em cache no próximo início de sessão → miss de 6K tok `cache_create`.
- **Caminho B** (sem MCP): `gitStatus` vai para um bloco dinâmico `cacheScope: null`, o que significa que é reenviado como `input_tokens` fresco em cada chamada à API — sem miss de cache, mas sem economias de cache também.
- **Caminho C** (provedor 3P / betas experimentais desabilitados): igual ao Caminho A.

Em sessões interativas típicas, as instruções commit/PR (1,7K tok) se acumulam **em cada chamada à API** via `cache_read`. Nos preços do Opus 4.7, em uma sessão de 100 chamadas, isso é aproximadamente **~$0,08 por sessão** apenas para instruções que o treinamento do Claude já cobre em sua maior parte.

### Como o super-token-saver lida com isso

`/setup-git-lite` desabilita o caminho nativo e injeta um **substituto curado de 280 tokens** via um hook SessionStart. Mantivemos exatamente o que substitui o comportamento padrão do Claude (regras de segurança), e descartamos tudo que o Claude já sabe pelo treinamento (fluxos de trabalho passo a passo, modelos de PR, padrões de uso do gh).

**Mantido — 11 regras de substituição críticas** (as que transformam a utilidade padrão do Claude em cautela):
- Nunca fazer commit/push/amend/PR/tag/merge sem solicitação explícita do usuário
- Nunca pular hooks, fazer force-push para main/master, executar operações destrutivas, modificar configuração do git
- Nunca commitar arquivos que correspondam a `.env`, `credentials`, `*.pem`, `secret.*`
- Evitar `git add -A` / `git add .`
- HEREDOC para mensagens de commit multi-linha + trailer `Co-Authored-By: Claude`
- Nunca usar flags interativos (-i), sem commits vazios
- Se o hook pre-commit falhar → criar um NOVO commit (não `--amend`)

**Descartado** — fluxo de trabalho de commit passo a passo (3 passos), fluxo de trabalho de PR passo a passo (3 passos), modelo de título/corpo de PR, referências de comandos `gh`, aviso de flag `-uall`, aviso de `--no-edit` com rebase, restrição `NUNCA usar TodoWrite ou ferramentas Agent durante o commit`. São verbosidades de fluxo de trabalho que o Claude compõe corretamente apenas com o treinamento.

**Adicionado** — linha compacta de estado do git: branch + HEAD short-sha + assunto + status atual (até 20 arquivos modificados, senão uma contagem). Sem lista de commits recentes (Claude pode executar `git log` sob demanda).

### Economias esperadas (preços do Opus 4.7, $25/MTok saída, $5/MTok entrada, $0,50/MTok leitura de cache)

| Item | Original | Com setup-git-lite | Economizado |
| ---- | -------- | ------------------- | ----- |
| Carregamento do system prompt (por nova sessão) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Chamadas repetidas na mesma sessão | ~1.700 tok cache_read/chamada | ~280 tok cache_read/chamada | ~1.420 tok/chamada |
| Sessão de 100 chamadas (Opus 4.7) | — | — | **~$0,11 economizados** |
| 20 sessões/dia × 22 dias úteis | — | — | **~$48 economizados/mês** |

### Uso

```bash
/setup-git-lite status     # Diagnóstico somente leitura — estado atual + o que mudaria
/setup-git-lite install    # Desabilitar CC nativo + habilitar nosso hook mínimo
/setup-git-lite revert     # Restaurar padrão (agressivo; veja abaixo)
/setup-git-lite dismiss-banner    # Silenciar a dica de recomendação ocasional
/setup-git-lite undismiss-banner  # Reativar a dica
/setup-git-lite help       # Uso completo
```

### Semântica de instalação

`install` modifica **dois** lugares para robustez:

1. `~/.claude/settings.json` — adiciona `"includeGitInstructions": false`
2. Perfil do shell (`~/.zshrc`, `~/.bashrc`, etc.) — adiciona um bloco marcador exportando `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Qualquer um sozinho é suficiente para desabilitar o CC nativo; definimos ambos para que uma substituição de ambiente não reative acidentalmente o comportamento nativo. A mudança no shell só entra em vigor em novos shells.

### Semântica de reversão — agressiva

`revert` **remove TODAS as exportações de `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` do seu perfil de shell**, incluindo as que você pode ter adicionado manualmente antes de instalar este skill. Isso é intencional — você executou `revert`, então restauramos o padrão limpo. Sempre criamos primeiro um backup com timestamp do perfil do shell.

Se você precisar da variável de ambiente por razões não relacionadas, anote-a antes de executar `revert` e adicione-a novamente depois.

### Antes de desinstalar o super-token-saver

**Execute primeiro `/setup-git-lite revert`**, ou você ficará com `includeGitInstructions: false` no seu settings.json mas sem hook de substituição (Claude não recebe nenhuma orientação de git). O Claude Code atualmente não tem um hook de ciclo de vida de desinstalação de plugin, então não podemos automatizar isso.

### Compensações

O que você perde (e por que normalmente está tudo bem):
- Claude não recebe mais um `git status` / `git log -n 5` pré-calculado no início da sessão. Se você perguntar "o que mudou?" em uma nova sessão, Claude executará esses comandos por conta própria (uma chamada de ferramenta extra, ~300 tok).
- Claude não vê mais o procedimento canônico de commit de 3 etapas do CC. Em nossos testes com centenas de fluxos de commit, o conhecimento no nível de treinamento lida com os casos críticos (formatação HEREDOC, sem `--amend`, sem force-push) porque os mantemos como regras explícitas.
- O modelo de corpo do PR (`## Summary` + `## Test plan`) não é injetado. Se você se importa exatamente com esse formato, coloque-o no CLAUDE.md do seu projeto.

### Banner de recomendação

Quando as instruções git nativas do CC ainda estão ativas na sua máquina, o super-token-saver mostra uma dica de um parágrafo no início da sessão **~20% do tempo** (além nas saídas de `/usage-view` e `/report-limit`). Descarte permanentemente com `/setup-git-lite dismiss-banner`.

---

## 🛡️ Recurso 5: Token Guardian

**Avisa você no momento em que uma expiração de cache custa dinheiro. Pode bloquear o reenvio de $9 se você pedir.**

O cache de prompts do Claude Code vive por 1 hora. Fique ausente por mais tempo que isso e ele expira. Sua próxima mensagem reenvia o contexto inteiro ao preço cheio. Com 900K tokens, isso são $9 de uma vez.

O Token Guardian lembra quando a última resposta chegou. Se mais de 3.590 segundos se passaram (o TTL menos uma margem de 10 segundos), ele pode entrar em ação. **Por padrão ele está desativado, por causa do Remote Control.** A mensagem de bloqueio de um hook é renderizada localmente como uma mensagem de sistema que o cliente remoto nunca recebe, então um usuário remoto via o prompt simplesmente sumir sem explicação. Em vez de lançar uma proteção que se comporta de forma diferente dependendo de onde você está, nós a desativamos. Quando o Remote Control começar a encaminhar mensagens de hooks, o padrão volta a ser ativado. Até lá, ative-a você mesmo com um dos dois modos.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude menciona a expiração na primeira linha
export CC_TOKEN_SAVER_CACHE_GUARD=block   # o prompt é recusado uma vez com a mensagem abaixo
```

No modo `warn` o prompt passa, e o Claude abre a resposta com uma linha dizendo que o cache havia expirado, que esse turno pagou por todo o contexto, e que depois de uma pausa de uma hora ou mais o caminho mais barato de volta é `/clear` → `/s-continue`. Este chega até um cliente remoto, porque a resposta do Claude é encaminhada mesmo quando as mensagens de hooks não são.

No modo `block` o prompt é recusado uma vez com a mensagem abaixo. Envie de novo e ele passa. Use-o em um terminal local quando você quiser a parada total.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

A mensagem de bloqueio é exibida em 23 idiomas, escolhidos a partir da configuração regional do seu sistema operacional, e dispara uma vez por período de inatividade.

**Agentes em segundo plano nunca são bloqueados.** Só os prompts que um humano digitou recebem a checagem. Relatórios de conclusão de agentes e tarefas em segundo plano, que hoje em dia costumam chegar mais de uma hora depois de terem sido iniciados, passam direto. O resultado de um agente de longa duração nunca fica retido nem se perde.

**Resultado:** no modo warn você sempre sabe quando um reenvio de $9 aconteceu, e por quê. No modo block isso não acontece: cada expiração interceptada economiza $9, e com uma interceptação por dia são $270/mês de desperdício puro eliminado.

> **Na API de pagamento por uso, o impacto é maior.** Um assinante do Max Plan perde $9 dentro de um limite de $200. Você perde $9 de dinheiro real, silenciosamente, toda vez que se afasta. O modo block impede isso sempre.

---

## 💡 Como o Cache Realmente Funciona (e Por Que a Maioria dos Usuários Desperdiça 40%+)

O Claude Code envia todo o histórico da conversa para o modelo em cada chamada à API. "Chamada à API" não significa "uma mensagem que você digitou". Um único prompt dispara chamadas de ferramentas internas — Grep, Read, Edit, Write — e cada uma é uma chamada à API separada. Um prompt pode facilmente causar 10+ chamadas à API.

O cache de prompts reduz esse custo em 90%. Mas o cache tem uma vida útil.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| TTL do cache           | 1 hora (ephemeral_1h)                 | 5 min                                  |
| Escrita no cache         | ＄10/MTok                              | ＄6,25/MTok                             |
| Leitura do cache          | ＄0,50/MTok                            | ＄0,50/MTok                             |
| Quando o cache expira  | Contexto completo reenviado ao preço cheio    | Baixo impacto (contexto é pequeno)          |

Mesmo com o cache ativo, os custos se acumulam. Aqui está um cenário extremo para mostrar a diferença.

### Cenário: Dia completo de programação (3h manhã → 2h almoço/reunião → 3h tarde)

Condições: preços do Opus 4, 1 prompt por minuto, ~5 chamadas à API por prompt (~300 chamadas/hora).

#### ❌ Sem super-token-saver

A maior parte do trabalho acontece na Main Session. O contexto cresce rapidamente.

| Fase       | Situação                         | Tamanho do contexto               | Custo                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Manhã 3h  | Programando (principalmente em Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0,50/M = ＄157,50  |
| Almoço/Reunião   | Ausente por 2 horas                  | —                          | —                                      |
| Retorno      | Cache expirou → reenvio completo      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Retorno      | /compact (resumir)              | 600K → sent to LLM        | 600K × ＄0,50/M + summary output = ~＄1,50 |
| Tarde 3h | Programação continua (contexto volta a crescer) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0,50/M = ＄157,50  |
|             | Total                             |                            | ~＄326                                  |

> Neste nível de uso, você provavelmente atingirá o limite de taxa da janela de 5 horas. **O custo é ruim, mas o verdadeiro problema é seu trabalho parar completamente. Este é o exato momento em que o Claude Code fica escuro.**

#### ✅ Com super-token-saver

O trabalho pesado é delegado para SubTasks. Main cuida apenas de design/decisões.

| Fase       | Situação                                    | Tamanho do contexto                | Custo                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Manhã 3h  | Programando (Main: design, SubTask: implementação) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
| Almoço/Reunião   | Ausente por 2 horas                             | —                           | —                                  |
| Retorno      | ⚡ Token Guardian (modo block) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| Tarde 3h | Programação continua                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 Resultado

> **＄326 → ＄180. ＄146 economizados por dia. 45% de redução de custos.**
>
> **Max Plan:** Menos tokens = você não atinge o limite de taxa. Seu trabalho não para. Essa é a diferença real.
>
> **API de pagamento por uso:** ＄146/dia × 22 dias úteis = **＄3.200/mês direto da sua fatura.** Um mês pesado sem este plugin ultrapassa ＄7.000. Com ele, abaixo de ＄4.000. O mesmo output.

### Onde o super-token-saver intervém

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

## 🔧 Instalação de Fonte & Personalização

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver é totalmente open-source (Apache-2.0). JavaScript puro + Bash — sem binários compilados, sem chamadas a APIs externas, sem telemetria. Cada linha é auditável. Cada afirmação neste README mapeia para um arquivo específico que você pode ler.

- **hooks/** — Mudar o limite de expiração do cache, personalizar mensagens de aviso, modificar regras de arquitetura de sessão
- **scripts/** — Lógica de análise, construtor de relatórios, formatação da barra de status
- **skills/** — Como /s-continue e /usage-view funcionam, modelos de prompts
- **locales/** — Adicionar/editar traduções, adicionar novos idiomas
- **skills/usage-view/** — Mudanças de design UI/UX do painel

Faça dele seu. Bifurque, experimente e envie um PR se encontrar algo melhor.

---

## 🌐 Idiomas Suportados

23 idiomas suportados. Selecionados cruzando os 20 principais países por uso do Claude Code com os 20 principais idiomas por número de falantes globais. O idioma de exibição é detectado automaticamente a partir da configuração regional do seu sistema operacional. Você também pode especificar manualmente: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Inglês    | 🇰🇷 Coreano     | 🇯🇵 Japonês  | 🇨🇳 Chinês    |
| 🇪🇸 Espanhol    | 🇫🇷 Francês     | 🇩🇪 Alemão    | 🇧🇷 Português |
| 🇮🇹 Italiano    | 🇷🇺 Russo    | 🇸🇦 Árabe    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonésio | 🇲🇾 Malaio     | 🇹🇭 Tailandês       |
| 🇻🇳 Vietnamita | 🇹🇷 Turco    | 🇵🇱 Polonês    | 🇳🇱 Holandês      |
| 🇮🇱 Hebraico     | 🇸🇪 Sueco    | 🇳🇴 Norueguês |                 |

As traduções atuais são geradas por IA. Contribuições de falantes nativos são bem-vindas — edite o arquivo JSON para o seu idioma em `locales/` e envie um PR.

---

## ⚖️ O Que Este Plugin Te Custa

O plugin injeta contexto no início da sessão. Veja exatamente quanto:

| Injeção | Quando | Tokens | Propósito |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (uma vez) | ~1.100 | Estratégia de delegação SubTask + regras do Concise Mode |
| Contexto do git (se git-lite habilitado) | SessionStart (uma vez) | ~280 | Substitui as ~2.200 tok de instruções git nativas do CC |
| Aviso de expiração de cache | Ao ficar inativo > 59 min (uma vez) | ~200 | Sinaliza o reenvio caro, mostra o caminho mais barato |
| Status line | Cada chamada à API | 0 | Renderiza na barra de status do terminal, não no contexto da conversa |

**Sobrecarga líquida por sessão: ~1.400 tokens (armazenados em cache após a primeira chamada).**

Nos preços do Opus ($0,50/MTok leitura de cache), isso é **$0,0007 por chamada à API** — menos de um décimo de centavo. Em uma sessão de 100 chamadas: $0,07.

Se git-lite estiver habilitado, o plugin **economiza** ~1.920 tokens por sessão (substitui 2.200 por 280). O efeito líquido é negativo — o plugin consome menos do que remove.

**Para usuários de API de pagamento por uso:** com gastos de $3.000/mês, a sobrecarga do plugin é inferior a $2/mês. As economias apenas da prevenção de expiração de cache (um reenvio de $9 bloqueado por semana) cobrem um ano de sobrecarga em uma única interceptação.

---

## 💡 Dicas

### Entenda o cache e você verá para onde vai o dinheiro

- **1 prompt ≠ 1 chamada à API.** Toda vez que Claude chama Grep, Read ou Edit, o contexto completo é reenviado. Um único prompt facilmente dispara 10+ chamadas à API. Escreva prompts claros para reduzir chamadas de ferramentas desnecessárias e cortar custos.
- **O temporizador do cache reinicia a partir da última chamada à API, não do seu último prompt.** Continue trabalhando e o cache nunca expira. O perigo é se afastar. O Token Guardian te avisa quando isso aconteceu, e no modo `block` interrompe o prompt uma vez para que você escolha: redefinir o contexto ou continuar como está.
- **Tamanho do contexto = multiplicador de custo.** A mesma chamada à API com 200K vs 800K custa 4 vezes mais. Quando a barra de status [CTX] ultrapassa 35% (🟡), esse é o sinal para delegar mais para SubTasks.

### Hábitos que reduzem custos

- **Mantenha CLAUDE.md enxuto.** Ele é carregado no system prompt em cada chamada à API. Cada linha custa dinheiro.
- **Delegue trabalho pesado para SubTasks.** Geração de código, edições de múltiplos arquivos, execuções de testes não pertencem a Main. SubTasks têm contexto menor e um nível de cache mais barato.
- **Ausente por 1+ hora?** `/clear` → volte → `/s-continue`. Contexto restaurado por $0.
- **[5H] acima de 70% (🟡)?** Desacelere. Mude para tarefas de revisão leves ou aumente a delegação para SubTask para reduzir a contagem de chamadas à API do Main.
- **Use `/btw` para perguntas secundárias.** Não entra no histórico de conversas, então seu contexto se mantém enxuto.

### API de pagamento por uso: os hábitos que mais importam

Tudo acima se aplica, mais estas prioridades específicas da API:

- **Monitore [CTX] como um velocímetro.** Nenhum limite de taxa vai te parar — mas contexto em 500K+ significa que cada chamada à API custa 2-3 vezes o que deveria. `/clear` → `/s-continue` é gratuito e redefine seu multiplicador de custo para a linha de base.
- **Execute `/usage-view` semanalmente.** Usuários do Max Plan têm um momento natural de "ai" quando são limitados por taxa. Você não — custos sobem silenciosamente. O painel é seu sistema de alerta antecipado.
- **Defina um orçamento diário mental.** Sem teto, dias de $200 acontecem sem perceber. O indicador RUN na barra de status torna o custo por turno visível. Se um único turno ultrapassa $1 (🔴), seu contexto está grande demais.

---

## 📚 Documentação

- [Guia de Cache de Prompts](guides/prompt-cache-guide.md) — Por que a maior parte do seu custo é cache, como o cache funciona em diferentes provedores (Anthropic, OpenAI, Gemini) e como gerenciá-lo ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 idiomas](guides/))
- [Análise de Custos Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Pelo menos 24–38% mais barato que o Opus 5 com a mesma qualidade, em 2.782 sessões
- [Análise de Custos Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Análise de Custos Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Comparação de custos lado a lado em 8.563 chamadas à API
- [Análise de Custos Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licença

Apache-2.0
