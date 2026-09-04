# super-token-saver

**El único plugin de Claude Code que realmente lee el código fuente de CC para encontrar adónde van tus tokens — y lo corrige automáticamente. Gasta menos, programa más.**

> Resultado medido: **reducción de costos del 45 %** en una carga de trabajo real de $326/día → $180/día. Delegación automática a SubTasks, restauración de contexto sin costo, un panel de análisis completo y un guardián para la expiración de caché. Una sola instalación, cero configuración.

Funciona con **Max Plan ($200/mes)** y **API de pago por uso**. El mismo plugin, las mismas funciones. Más poderoso para cada usuario — especialmente cuando cada token es dinero real.

![Panel de uso — ve exactamente adónde van tus tokens](docs/images/usage-view-overview.png)

### Lo que hace en 30 segundos

| Función | Qué ocurre | Impacto |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Delega automáticamente el trabajo pesado a SubTasks (caché 37,5 % más barata) | El contexto se mantiene pequeño, los costos bajan |
| 🪶 Concise Mode | Elimina el relleno en respuestas, mantiene la sustancia | Menos tokens de salida por respuesta |
| 🔄 /s-continue | Reemplaza /compact — cero llamadas LLM, cero costo, cero pérdida de información, y también restaura sesiones de **Codex** | Restauración de contexto gratuita en ambas herramientas |
| 🤝 /s-compact | Escribe un traspaso de sesión que /s-continue carga automáticamente — captura hallazgos de subagentes y resultados de herramientas que la transcripción pierde | La siguiente sesión también recupera el contexto oculto |
| 📊 Status Line | Costo en tiempo real, tamaño de contexto, límite de velocidad — bajo 50 ms | Ver problemas antes de que te cuesten dinero |
| 📈 /usage-view | Panel HTML interactivo con análisis impulsado por IA | Análisis forense de costos completo en un clic |
| ✂️ /setup-git-lite | Elimina 2.200 tokens ocultos que CC inyecta cada sesión | ~$48/mes ahorrados solo en instrucciones de git |
| 🛡️ Token Guardian | Te avisa en el momento en que una expiración de caché reenvía tu contexto, o lo bloquea en modo `block` | Se acabaron las sorpresas silenciosas de $9 |

---

## 😤 El Problema

**Costos invisibles.** Sin visibilidad en tiempo real. Sin advertencia de "tu contexto está en 800K". Sin alerta de "la caché expiró hace 3 minutos". Te enteras después de que el daño está hecho.

**Inflación del contexto.** El mismo prompt a 200K vs 800K de contexto cuesta 4 veces más. Cada Read, Grep, Edit reenvía el contexto completo. Un prompt complejo fácilmente dispara 15+ llamadas a la API, cada una multiplicada por el tamaño de tu contexto.

**Expiración de caché.** Vuelves del almuerzo. La caché desapareció. El siguiente mensaje reenvía 900K tokens al precio completo. $9 de un solo golpe.

**Todo manual.** Gestión del contexto, tiempo de expiración de caché, delegación a SubTask, limpieza de sesiones. Nadie puede rastrear todo esto mientras realmente programa.

**¿Max Plan ($200/mes)?** Todo lo anterior, más un límite de velocidad de 5 horas que arruina tu flujo sin temporizador y sin ETA.

**¿API de pago por uso?** Todo lo anterior, excepto que no hay techo. Un fallo de caché = $9 de dinero real. Diez veces a la semana = $360/mes solo en accidentes. Un mal martes con contexto inflado puede costar más de lo que un suscriptor de Max Plan paga en un mes.

super-token-saver gestiona todo esto automáticamente. **Instala una vez. Listo.**

---

## 🚀 Instalación

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Funciona automáticamente después de la instalación. Cero configuración. Requiere [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Para monitoreo en vivo:

```
/setup-statusline install
```

Para eliminar 2.200 tokens ocultos de las instrucciones git integradas de CC ([detalles](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Función 1: Smart Session Architecture

**Instálalo y los patrones de trabajo optimizados en costos se activan automáticamente.**

La mayoría de los usuarios hacen todo en la Main Session. Lectura de archivos, generación de código, ejecución de pruebas. Cada salida se apila en el contexto y se reenvía con cada mensaje. La sesión se infla. Los costos se acumulan como una bola de nieve.

Session Architect inyecta automáticamente una estrategia de delegación al inicio de la sesión.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rol             | Diseño, decisiones, revisión         | Implementación, generación de código, múltiples archivos  |
| Nivel de caché       | 1 hora (ephemeral_1h)             | 5 min                                 |
| Costo de escritura en caché | ＄10/MTok                          | ＄6,25/MTok                            |
| Tamaño del contexto     | ~94K promedio                          | ~33K promedio                              |

Las SubTasks tienen escrituras en caché **37,5 % más baratas** que Main. El contexto también es mucho más pequeño. Delegar el trabajo pesado a SubTasks reduce drásticamente los costos.

**Resultado:** El contexto se mantiene por debajo de 250K en lugar de crecer a 600K+. El mismo rendimiento de trabajo, la mitad del costo en tokens. Completamente automático.

---

## 🪶 Concise Mode

**El mismo contenido. Menos relleno. Activado por defecto.**

El hook SessionStart también inyecta una regla de estilo de respuesta que se ejecuta en **cada sesión y cada modelo** — sin flags, sin configuración. Tres cosas cambian:

- **Sin preámbulo** — no más "Déjame revisar…", "Ahora voy a…", reformular tu pregunta, o recapitular lo que el diff ya muestra
- **El formato correcto para el contenido** — viñetas para listas, prosa para el razonamiento (compensaciones, causalidad, justificación). Ninguno se fuerza
- **Expresión más concisa** — el mismo punto, menos palabras. Una prosa más clara es una prosa más corta

Límite estricto: nunca omitir contenido, saltarse verificaciones, o colapsar matices en una sola frase. La sustancia permanece completa; solo el envoltorio se reduce.

Instala una vez, se aplica en todas partes.

---

## 🔄 Función 2: /s-continue — Restauración de Contexto

**Reemplaza `/compact`. Cero llamadas LLM. Cero costo de tokens. Cero pérdida de información.**

`/compact` envía tu contexto completo (~1M tokens) al LLM para comprimirlo en un resumen del 3,3 %. Si la caché ha expirado, eso solo ya desencadena un re-caché completo. La pérdida de información es inevitable.

`/s-continue` adopta un enfoque completamente diferente. Preprocesa la transcripción de la sesión anterior y la carga directamente. Sin llamada LLM. Sin costo. La conversación original se restaura tal cual.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Cómo funciona            | Envía el contexto completo al LLM para un resumen | Preprocesa la transcripción, la lee directamente |
| Llamadas LLM               | Necesarias (típicamente 100K+ tokens) | 0                                |
| Costo de tokens              | Alto                              | 0                                |
| Pérdida de información        | Sí (resumen del 3,3 %)                | Ninguna (original preservado)        |
| Velocidad de procesamiento        | Decenas de segundos                   | < 1 seg (incluso archivos de 60MB+)       |
| Cuando la caché expiró   | Costo adicional de re-caché completo         | Sin impacto                        |
| Restauración de múltiples sesiones   | No posible                      | Compatible                        |

Uso: `/clear` luego `/s-continue`. Verás una lista de sesiones anteriores. Elige una para restaurar. Para recuperación rápida: `/s-continue last`.

**Resultado:** Reanuda el trabajo anterior a costo cero. Sin pérdida de información. Procesa transcripciones de 60MB+ en menos de 1 segundo.

### 🤝 Su pareja: `/s-compact` — traspasa la capa oculta

`/s-continue` restaura la **transcripción** — lo que tú y Claude dijeron. Pero el conocimiento más útil de una sesión de trabajo a menudo vive FUERA de ese diálogo: lo que encontró un **subagente** (su transcripción es un archivo separado que la restauración nunca carga), un **número decisivo en la salida de una herramienta** (un conteo de tests, un benchmark), una **lección aprendida del proceso** ("no se pudo reproducir en headless → era el build, no el código").

Ejecuta `/s-compact` al **final** de una sesión y destila exactamente esa capa oculta en un traspaso, guardado en `~/.claude/super-token-saver-data/<project>/handoff.md`. En la siguiente sesión, `/s-continue` lo **carga automáticamente** encima de la transcripción restaurada — sin pegar nada.

|                     | `/s-continue` solo            | `/s-compact` + `/s-continue` (el conjunto)          |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| Recupera            | La transcripción (lo que se dijo)  | La transcripción **más** la capa oculta         |
| Hallazgos de subagentes   | Perdidos (archivos separados)           | Destilados en el traspaso                       |
| Números de salida de herramientas | Solo si se citan en el chat    | Extraídos deliberadamente                            |
| Lecciones del proceso     | —                               | Capturadas para no repetir callejones sin salida              |

**El flujo de trabajo:** termina una sesión con `/s-compact` → empieza la siguiente con `/s-continue`.

### 🔀 Dos herramientas, un solo historial — las sesiones de Codex también se restauran aquí

Codex guarda sus sesiones en `~/.codex/sessions/`; Claude Code, en `~/.claude/projects/`. Ninguno lee los archivos del otro, así que un sprint que se quedaba sin presupuesto en Codex era inalcanzable desde Claude Code, y viceversa.

`/s-continue` ahora lista y restaura ambos. Un rollout de Codex no pasa por un segundo analizador: se reescribe en el formato que escribe Claude Code, **una línea de salida por cada línea de entrada**, así que el mismo pipeline sirve a los dos y cada marca `L{n}` sigue apuntando exactamente a la línea del archivo Codex original. Medido: un rollout de 12 MB y 1.540 líneas se preprocesa en **0,13 s**.

|                        | Sesión de Claude Code | Sesión de Codex |
| ---------------------- | ------------------- | ------------- |
| Listada por `/s-continue` | Sí | Sí, limitada al proyecto actual |
| Restaurada sin coste de LLM | Sí | Sí |
| Salto `L{n}` al original | Sí | Sí — los números de línea son los del propio rollout |
| Restauración tras pérdida de contexto (`#0`) | `/compact`, auto-compact | Compactación de Codex y reversión de hilo |
| Traspaso de `/s-compact` | Compartido por proyecto — se escribe en una herramienta y se carga en la otra |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Dos detalles marcan la diferencia entre una lista correcta y otra que solo parece serlo. El `session_id` de Codex es en realidad el id del **hilo**, que hereda cualquier subagente que se lance, así que las sesiones se identifican por `payload.id` y los rollouts de subagentes se filtran igual que Claude Code ya filtra sus propias transcripciones de subtareas. Y `<codex_internal_context source="goal">` lo inyecta la máquina, así que se conserva en el contexto restaurado pero nunca cuenta como un turno que escribiste tú.

El plugin también se instala en Codex — mira **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit` y `setup-statusline` siguen siendo exclusivos de Claude Code por ahora.

---

## 📊 Función 3: Status Line en Vivo

**Monitoreo de tokens/costos en tiempo real. Menos de 50 ms de sobrecarga.**

Ejecuta `/setup-statusline install` una vez y aparece una barra de estado persistente en la parte inferior de Claude Code.

**Operación normal** — cada métrica de un vistazo, cero cambio de contexto:

![Barra de estado en estado normal](docs/images/statusline-normal.png)

**Límite de velocidad alcanzado** — 5H se vuelve roja al 102 %, la cuenta regresiva muestra exactamente cuándo vuelves, y aparece automáticamente una acción `/report-limit` de un solo toque:

![Barra de estado cuando se alcanza el límite de velocidad](docs/images/statusline-rate-limited.png)

| Indicador        | Lo que muestra                       | 🟢 Normal | 🟡 Advertencia | 🔴 Crítico |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Costo de la última llamada a la API           | < ＄0,30   | >= ＄0,30   | >= ＄1,00    |
| RUN (acumulado) | Costo acumulado para esta carpeta     | —         | —          | —           |
| 5H               | Uso de la ventana de 5 horas + cuenta regresiva de reinicio | < 70%     | >= 70%     | >= 90%      |
| CTX              | Uso de la ventana de contexto                | < 35%     | >= 35%     | >= 70%      |

Cuando cualquier indicador alcanza advertencia o crítico, aparece automáticamente una sugerencia `→ /usage-view current`.

Para eliminar: `/setup-statusline uninstall` (la configuración anterior se restaura automáticamente).

**Resultado:** Cada problema de costos visible en tiempo real. Menos de 50 ms de sobrecarga — sin retraso perceptible.

> **¿En API de pago por uso?** Los indicadores 5H y W se ocultan automáticamente — no tienes ventanas de límite de velocidad. Lo que permanece es lo que importa: RUN (costo en tiempo real por turno) y CTX (tamaño del contexto). Las dos palancas que controlan tu factura, siempre visibles.

---

## 📈 Panel de Uso (/usage-view)

**Finalmente responde: "¿Adónde fue todo ese dinero?"**

Los usuarios de Max Plan alcanzan el límite de velocidad y se preguntan por qué. Los usuarios de API abren la factura de Anthropic y se preguntan cómo. De cualquier manera, la pregunta es la misma: ¿qué sesión quemó más tokens? ¿Cuándo se dispararon los costos? ¿Qué patrones existen en tu uso? Hasta ahora — todo invisible.

`/usage-view` muestra todo. Un panel HTML interactivo se abre en tu navegador, permitiéndote analizar patrones de uso y rastrear la causa raíz de los picos de costos. Sin dependencias externas. Funciona de forma autónoma. Se puede compartir como archivo.

**$4.196 en 31 días. ¿Adónde fue todo?** Un vistazo — costo total, desglose de tokens por tipo, ratio de eficiencia del caché y recuento de sesiones. El gráfico de dona muestra instantáneamente que el 65 % de tu gasto son lecturas de caché (lo cual es normal y saludable):

![Descripción general del panel de uso](docs/images/usage-view-overview.png)

**Antes vs. después — medido, no adivinado.** El marcador naranja discontinuo "Plugin installed" divide tu línea de tiempo de costos en dos. Las barras diarias están apiladas por tipo de token (Input/Output/Cache Write/Cache Read) para que puedas ver exactamente qué componente cambió después de la instalación. La línea de promedio muestra la tendencia:

![Tendencia de costos diarios](docs/images/usage-view-daily-trend.png)

**¿Cuándo quemas más?** Costo por hora según la hora del día y desglose por día de la semana. Alterna entre promedio de días activos, promedio de todos los días o máximo. Los iconos de llama marcan tus horas más costosas — los patrones visibles (atracones nocturnos, picos del miércoles) destacan instantáneamente:

![Patrón de costos por hora y día de la semana](docs/images/usage-view-hourly-pattern.png)

**¿Te estás volviendo más eficiente?** La ratio Total/Output mide cuántos tokens se consumen por token de salida producido. Menos es mejor. El marcador "Plugin installed" te permite comparar antes vs. después. Los picos = fallos de caché o reinicios de sesión:

![Tendencia de eficiencia](docs/images/usage-view-efficiency.png)

**Cada llamada a la API, trazada por tamaño de contexto y costo.** Este es el gráfico que hace que la estructura de costos quede clara. Cada punto es una llamada a la API. Rojo = Opus, azul = Sonnet, verde = Haiku. Las líneas discontinuas son precios teóricos — si tus puntos están por encima de la línea, estás pagando de más. Cambia a la vista **User Turn** para ver el costo por turno de conversación en lugar de por llamada a la API.
Pasa el cursor sobre cualquier punto para ver el texto real del prompt, el recuento de tokens y el desglose completo de costos (Input/Output/Cache Write/Cache Read):

![Costo por tamaño de contexto — gráfico de dispersión](docs/images/usage-view-cost-scatter.png)

**¿Qué tan grandes son tus contextos?** La mayoría de las llamadas se agrupan por debajo de 250K. La cola larga por encima de 350K es donde los costos se disparan — este gráfico muestra exactamente con qué frecuencia estás en la zona de peligro:

![Distribución del tamaño del contexto](docs/images/usage-view-context-dist.png)

**Tu horario de programación, con precio por hora.** Un mapa de calor de ventana de 5 horas durante 30 días. Verde (<$15/h), naranja ($15-30/h), rojo ($30+/h). El ícono de calavera (💀) marca las ventanas donde alcanzaste el límite de velocidad. El control deslizante de costos en la parte superior filtra las ventanas baratas para que las costosas destaquen — arrástralo para encontrar tus peores días al instante. Alterna entre vistas de ventana de 5 horas y bloque de 1 hora:

![Mapa de calor de calendario de uso por hora](docs/images/usage-view-calendar.png)

**Haz clic en cualquier celda para profundizar en las sesiones de esa ventana.** Cada sesión en ese intervalo de tiempo, con costo, recuento de mensajes, desglose de tokens y los primeros/últimos mensajes reales de cada conversación. Expande "Top Token Conversations" para ver qué intercambios específicos quemaron más — cada entrada muestra el texto del prompt, etiquetas de alerta de costo y sugerencias de optimización:

![Panel de detalles de la sesión](docs/images/usage-view-session-drilldown.png)

**Análisis impulsado por IA (opcional).** Cuando ejecutas `/usage-view` sin `--no-ai`, un analista de IA lee todos tus datos del panel — con referencia de precios de la API incorporada — y produce un informe escrito: factores de costo, anomalías, recomendaciones de optimización. Se muestra automáticamente en el idioma de tu sistema operativo (23 idiomas, RTL incluido; los gráficos/tablas siempre permanecen en LTR):

**Adónde fue el dinero** — gasto total, factores de costo por tipo de token, tendencia semanal e impacto del plugin medido en números reales:

![Análisis de IA — desglose de costos](docs/images/usage-view-ai-report-1.png)

**Cuándo y cómo trabajas** — horas pico, días más ocupados, distribución de llamadas a la API y patrones de límite de velocidad que revelan oportunidades de optimización:

![Análisis de IA — patrones de trabajo](docs/images/usage-view-ai-report-2.png)

**Qué hacer al respecto** — recomendaciones concretas y respaldadas por datos adaptadas a tu uso real. Cambio de modelo, gestión del contexto, estrategia de sesión:

![Análisis de IA — recomendaciones](docs/images/usage-view-ai-report-3.png)

**Compártelo.** El panel completo es un único archivo HTML autónomo — todos los datos incorporados, sin necesidad de servidor. Envíalo a tu equipo, tu gerente o tu contador. Sin dependencias externas. Funciona sin conexión. Usa el modo `private` para eliminar todo el texto de los prompts antes de compartir — mantiene el análisis de costos intacto mientras elimina el contenido de la conversación.

```
/usage-view                  # Todo el tiempo, todos los proyectos
/usage-view current          # Solo la ventana actual de 5 horas
/usage-view last 7 days      # Últimos 7 días
/usage-view locale ja        # Japonés
/usage-view --no-ai          # Omitir análisis de IA (más rápido)
/usage-view private          # Eliminar texto de prompts (seguro para compartir)
```

---

## 🔬 Investigación de límite de velocidad (/report-limit)

**Proyecto comunitario para hacer ingeniería inversa de la fórmula del límite de velocidad.**

Anthropic no publica la fórmula exacta para la ventana de 5 horas. Vamos a descubrirla juntos.

Cuando alcances un límite de velocidad, ejecuta `/report-limit`. Tus datos de uso actuales se envían automáticamente como GitHub Discussion. Cuantos más datos recopilemos, más clara será la fórmula.

---

## ✂️ Función 4: /setup-git-lite — Reducir las instrucciones git integradas de CC

**Leímos el código fuente de Claude Code. Encontramos 2.200 tokens ocultos inyectados en cada sesión por los que estás pagando silenciosamente.**

### El descubrimiento

El 12/04/2026, un [issue de GitHub](https://github.com/anthropics/claude-code/issues/47107) reveló que la configuración integrada `includeGitInstructions` de Claude Code quema tokens silenciosamente en cada sesión. La reproducción independiente mediante [este gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) confirmó los números: **+6.031 tokens en escrituras de caché** por sesión después de cada commit de git, **+1.690 tokens en lecturas de caché** en cada llamada a la API.

### Análisis del código fuente de CC — adónde van los tokens

Rastreamos los tokens hasta dos puntos de inyección independientes en el código fuente de Claude Code (v2.1.88):

**1. Instantánea de `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` recopila rama + rama principal + user.name + estado completo (hasta 2000 caracteres) + **los últimos 5 commits**
- Se une y agrega al system prompt mediante `appendSystemContext` (`utils/api.ts:437`)
- Cada nuevo commit, cada nuevo archivo modificado, cada cambio de rama cambia el texto → invalidación del caché de prefijo

**2. Instrucciones del flujo de trabajo commit/PR (~1.700 tok) — descripción de la herramienta Bash**
- `tools/BashTool/prompt.ts:53` agrega más de 60 líneas de protocolo de seguridad, procedimiento de commit paso a paso, ejemplos de HEREDOC y plantillas de creación de PR a la descripción de la herramienta `Bash`
- Guardado en caché junto con el system prompt, pero enviado como parámetro `tools[]`

### Por qué es caro

La estructura de caché (`utils/api.ts:321` `splitSysPromptPrefix`) tiene tres rutas según si tienes herramientas MCP activas:

- **Ruta A** (MCP activo — la mayoría de los usuarios): `gitStatus` se encuentra dentro de un bloque `cacheScope: 'org'`. Cualquier cambio → todo el bloque se vuelve a guardar en caché en el próximo inicio de sesión → fallo de `cache_create` de 6K tok.
- **Ruta B** (sin MCP): `gitStatus` va a un bloque dinámico `cacheScope: null`, lo que significa que se reenvía como `input_tokens` frescas en cada llamada a la API — sin fallo de caché, pero tampoco ahorros de caché.
- **Ruta C** (proveedor 3P / betas experimentales deshabilitadas): igual que la Ruta A.

En sesiones interactivas típicas, las instrucciones commit/PR (1,7K tok) se acumulan **en cada llamada a la API** mediante `cache_read`. Con los precios de Opus 4.7, en una sesión de 100 llamadas, eso son aproximadamente **~$0,08 por sesión** solo para instrucciones que el entrenamiento de Claude ya cubre en su mayor parte.

### Cómo lo gestiona super-token-saver

`/setup-git-lite` deshabilita la ruta nativa e inyecta un **reemplazo curado de 280 tokens** mediante un hook SessionStart. Conservamos exactamente lo que anula el comportamiento predeterminado de Claude (reglas de seguridad), y eliminamos todo lo que Claude ya sabe por entrenamiento (flujos de trabajo paso a paso, plantillas de PR, patrones de uso de gh).

**Conservado — 11 reglas de anulación críticas** (las que convierten la utilidad predeterminada de Claude en precaución):
- Nunca hacer commit/push/amend/PR/tag/merge sin petición explícita del usuario
- Nunca omitir hooks, hacer force-push a main/master, ejecutar operaciones destructivas, modificar la configuración de git
- Nunca hacer commit de archivos que coincidan con `.env`, `credentials`, `*.pem`, `secret.*`
- Evitar `git add -A` / `git add .`
- HEREDOC para mensajes de commit multilínea + tráiler `Co-Authored-By: Claude`
- Nunca usar flags interactivos (-i), sin commits vacíos
- Si el hook pre-commit falla → crear un NUEVO commit (no `--amend`)

**Eliminado** — flujo de trabajo de commit paso a paso (3 pasos), flujo de trabajo de PR paso a paso (3 pasos), plantilla de título/cuerpo de PR, referencias de comandos `gh`, advertencia de flag `-uall`, advertencia de `--no-edit` con rebase, restricción `NUNCA usar TodoWrite o herramientas Agent durante el commit`. Estos son detalles verbosos de flujo de trabajo que Claude compone correctamente solo con el entrenamiento.

**Añadido** — línea compacta de estado de git: rama + HEAD short-sha + asunto + estado actual (hasta 20 archivos modificados, sino un recuento). Sin lista de commits recientes (Claude puede ejecutar `git log` bajo demanda).

### Ahorros esperados (precios de Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Elemento | Original | Con setup-git-lite | Ahorrado |
| ---- | -------- | ------------------- | ----- |
| Carga del system prompt (por nueva sesión) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Llamadas repetidas en la misma sesión | ~1.700 tok cache_read/llamada | ~280 tok cache_read/llamada | ~1.420 tok/llamada |
| Sesión de 100 llamadas (Opus 4.7) | — | — | **~$0,11 ahorrados** |
| 20 sesiones/día × 22 días laborables | — | — | **~$48 ahorrados/mes** |

### Uso

```bash
/setup-git-lite status     # Diagnóstico de solo lectura — estado actual + qué cambiaría
/setup-git-lite install    # Deshabilitar CC nativo + habilitar nuestro hook mínimo
/setup-git-lite revert     # Restaurar predeterminado (agresivo; ver abajo)
/setup-git-lite dismiss-banner    # Silenciar el consejo de recomendación ocasional
/setup-git-lite undismiss-banner  # Volver a habilitar el consejo
/setup-git-lite help       # Uso completo
```

### Semántica de la instalación

`install` modifica **dos** lugares para mayor robustez:

1. `~/.claude/settings.json` — agrega `"includeGitInstructions": false`
2. Perfil de shell (`~/.zshrc`, `~/.bashrc`, etc.) — agrega un bloque marcador que exporta `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Cualquiera de los dos por separado es suficiente para deshabilitar CC nativo; configuramos ambos para que una anulación de entorno no reactive accidentalmente el comportamiento nativo. El cambio de shell solo tiene efecto en nuevos shells.

### Semántica de reversión — agresiva

`revert` **elimina TODAS las exportaciones de `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` de tu perfil de shell**, incluidas las que pudieras haber agregado manualmente antes de instalar este skill. Esto es intencional — ejecutaste `revert`, así que restauramos el predeterminado limpio. Siempre creamos primero una copia de seguridad con marca de tiempo del perfil de shell.

Si necesitas la variable de entorno por razones no relacionadas, anótala antes de ejecutar `revert` y vuelve a agregarla después.

### Antes de desinstalar super-token-saver

**Ejecuta primero `/setup-git-lite revert`**, o te quedarás con `includeGitInstructions: false` en tu settings.json pero sin hook de reemplazo (Claude no recibe ninguna orientación de git). Claude Code actualmente no tiene un hook de ciclo de vida de desinstalación de plugins, así que no podemos automatizar esto.

### Compensaciones

Lo que pierdes (y por qué normalmente está bien):
- Claude ya no recibe un `git status` / `git log -n 5` precalculado al inicio de la sesión. Si preguntas "¿qué ha cambiado?" en una nueva sesión, Claude ejecutará esos comandos él mismo (una llamada a herramienta adicional, ~300 tok).
- Claude ya no ve el procedimiento canónico de commit en 3 pasos de CC. En nuestras pruebas con cientos de flujos de commit, el conocimiento a nivel de entrenamiento maneja los casos críticos (formato HEREDOC, sin `--amend`, sin force-push) porque los conservamos como reglas explícitas.
- La plantilla del cuerpo del PR (`## Summary` + `## Test plan`) no se inyecta. Si te importa exactamente ese formato, ponlo en el CLAUDE.md de tu proyecto.

### Banner de recomendación

Cuando las instrucciones git nativas de CC aún están activas en tu máquina, super-token-saver muestra un consejo de un párrafo al inicio de la sesión **~20 % del tiempo** (además en las salidas de `/usage-view` y `/report-limit`). Descártalo permanentemente con `/setup-git-lite dismiss-banner`.

---

## 🛡️ Función 5: Token Guardian

**Te avisa en el momento en que una expiración de caché reenvía tu contexto. Puede bloquear el reenvío de $9 si se lo pides.**

El caché de prompts de Claude Code vive durante 1 hora. Auséntate más tiempo y expira. Tu siguiente mensaje reenvía el contexto completo al precio completo. Con 900K tokens, eso son $9 de un golpe.

Token Guardian registra cuándo llegó la última respuesta. Si han pasado más de 3.590 segundos (el TTL menos un margen de 10 segundos), puede intervenir. **Está desactivado por defecto, por Remote Control.** El mensaje de bloqueo de un hook se renderiza localmente como un mensaje del sistema que el cliente remoto nunca recibe, así que un usuario remoto vio el prompt desaparecer sin ninguna explicación. En lugar de lanzar un guardián que se comporta de forma distinta según dónde estés, lo desactivamos. Cuando Remote Control empiece a reenviar los mensajes de los hooks, el valor por defecto volverá a activarse. Hasta entonces, actívalo tú mismo con uno de estos dos modos.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude menciona la expiración en su primera línea
export CC_TOKEN_SAVER_CACHE_GUARD=block   # el prompt se rechaza una vez con el mensaje de abajo
```

En modo `warn` el prompt pasa, y Claude abre su respuesta con una línea que dice que el caché había expirado, que este turno se facturó como un reenvío completo del contexto, y que tras una pausa de una hora o más el camino más barato de vuelta es `/clear` → `/s-continue`. Este sí llega a un cliente remoto, porque la respuesta de Claude se reenvía aunque los mensajes de los hooks no.

En modo `block` el prompt se rechaza una vez con el mensaje de abajo. Envíalo de nuevo y pasa. Úsalo en una terminal local cuando quieras el bloqueo duro.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

El mensaje de bloqueo se muestra en 23 idiomas, elegidos según tu configuración regional del sistema operativo, y se activa una sola vez por período de inactividad.

**Los agentes en segundo plano nunca se bloquean.** Solo los prompts que escribió un humano reciben la comprobación. Los informes de finalización de agentes y tareas en segundo plano — que hoy en día suelen llegar más de una hora después de haberse lanzado — pasan directo. El resultado de un agente de larga duración nunca queda retenido ni se pierde.

**Resultado:** en modo warn siempre sabes cuándo ocurrió un reenvío de $9, y por qué. En modo block, no ocurre: cada expiración capturada ahorra $9, y con una al día son $270/mes de desperdicio puro eliminado.

> **En pago por uso esto pega más fuerte.** Un suscriptor de Max Plan pierde $9 dentro de un margen de $200. Tú pierdes $9 de dinero real, silenciosamente, cada vez que te alejas. El modo block lo detiene siempre.

---

## 💡 Cómo funciona realmente el caché (y por qué la mayoría de los usuarios desperdician más del 40 %)

Claude Code envía el historial completo de la conversación al modelo en cada llamada a la API. "Llamada a la API" no significa "un mensaje que escribiste". Un solo prompt desencadena llamadas a herramientas internas — Grep, Read, Edit, Write — y cada una es una llamada a la API separada. Un prompt fácilmente puede causar 10+ llamadas a la API.

El caché de prompts reduce este costo en un 90 %. Pero el caché tiene una vida útil.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| TTL del caché           | 1 hora (ephemeral_1h)                 | 5 min                                  |
| Escritura en caché         | ＄10/MTok                              | ＄6,25/MTok                             |
| Lectura de caché          | ＄0,50/MTok                            | ＄0,50/MTok                             |
| Cuando el caché expira  | Contexto completo reenviado al precio completo    | Bajo impacto (contexto es pequeño)          |

Incluso con el caché activo, los costos se acumulan. Aquí hay un escenario extremo para mostrar la diferencia.

### Escenario: Día completo de programación (3h mañana → 2h almuerzo/reunión → 3h tarde)

Condiciones: precios de Opus 4, 1 prompt por minuto, ~5 llamadas a la API por prompt (~300 llamadas/hora).

#### ❌ Sin super-token-saver

La mayor parte del trabajo ocurre en la Main Session. El contexto crece rápidamente.

| Fase       | Situación                         | Tamaño del contexto               | Costo                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Mañana 3h  | Programando (principalmente en Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0,50/M = ＄157,50  |
| Almuerzo/Reunión   | Fuera 2 horas                  | —                          | —                                      |
| Regreso      | Caché expiró → reenvío completo      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Regreso      | /compact (resumir)              | 600K → sent to LLM        | 600K × ＄0,50/M + summary output = ~＄1,50 |
| Tarde 3h | Continúa programando (el contexto vuelve a crecer) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0,50/M = ＄157,50  |
|             | Total                             |                            | ~＄326                                  |

> A este nivel de uso, probablemente alcanzarás el límite de velocidad de la ventana de 5 horas. **El costo es malo, pero el verdadero problema es que tu trabajo se detiene por completo. Este es el momento exacto en que Claude Code se apaga.**

#### ✅ Con super-token-saver

El trabajo pesado se delega a SubTasks. Main solo maneja diseño/decisiones.

| Fase       | Situación                                    | Tamaño del contexto                | Costo                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Mañana 3h  | Programando (Main: diseño, SubTask: implementación) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
| Almuerzo/Reunión   | Fuera 2 horas                             | —                           | —                                  |
| Regreso      | ⚡ Token Guardian (modo block) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| Tarde 3h | Continúa programando                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 Resultado

> **＄326 → ＄180. ＄146 ahorrados por día. 45 % de reducción de costos.**
>
> **Max Plan:** Menos tokens = no alcanzas el límite de velocidad. Tu trabajo no se detiene. Esa es la diferencia real.
>
> **API de pago por uso:** ＄146/día × 22 días laborables = **＄3.200/mes directo de tu factura.** Un mes pesado sin este plugin supera ＄7.000. Con él, bajo ＄4.000. El mismo output.

### Dónde interviene super-token-saver

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

## 🔧 Instalación desde el código fuente y personalización

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver es completamente de código abierto (Apache-2.0). JavaScript puro + Bash — sin binarios compilados, sin llamadas a API externas, sin telemetría. Cada línea es auditable. Cada afirmación en este README corresponde a un archivo específico que puedes leer.

- **hooks/** — Cambiar el umbral de expiración de caché, personalizar mensajes de advertencia, modificar reglas de arquitectura de sesión
- **scripts/** — Lógica de análisis, constructor de informes, formato de la barra de estado
- **skills/** — Cómo funcionan /s-continue y /usage-view, plantillas de prompts
- **locales/** — Agregar/editar traducciones, agregar nuevos idiomas
- **skills/usage-view/** — Cambios de diseño UI/UX del panel

Hazlo tuyo. Forkéalo, experimenta y envía un PR si encuentras algo mejor.

---

## 🌐 Idiomas soportados

23 idiomas soportados. Seleccionados cruzando los 20 principales países por uso de Claude Code con los 20 principales idiomas por número de hablantes globales. El idioma de visualización se detecta automáticamente desde tu configuración regional del sistema operativo. También puedes especificarlo manualmente: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Inglés    | 🇰🇷 Coreano     | 🇯🇵 Japonés  | 🇨🇳 Chino    |
| 🇪🇸 Español    | 🇫🇷 Francés     | 🇩🇪 Alemán    | 🇧🇷 Portugués |
| 🇮🇹 Italiano    | 🇷🇺 Ruso    | 🇸🇦 Árabe    | 🇮🇳 Hindi      |
| 🇧🇩 Bengalí    | 🇮🇩 Indonesio | 🇲🇾 Malayo     | 🇹🇭 Tailandés       |
| 🇻🇳 Vietnamita | 🇹🇷 Turco    | 🇵🇱 Polaco    | 🇳🇱 Neerlandés      |
| 🇮🇱 Hebreo     | 🇸🇪 Sueco    | 🇳🇴 Noruego |                 |

Las traducciones actuales son generadas por IA. Las contribuciones de hablantes nativos son bienvenidas — edita el archivo JSON para tu idioma en `locales/` y envía un PR.

---

## ⚖️ Lo que te cuesta este plugin

El plugin inyecta contexto al inicio de la sesión. Aquí está exactamente cuánto:

| Inyección | Cuándo | Tokens | Propósito |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (una vez) | ~1.100 | Estrategia de delegación a SubTask + reglas de Concise Mode |
| Contexto de git (si git-lite está habilitado) | SessionStart (una vez) | ~280 | Reemplaza las ~2.200 tok de instrucciones git nativas de CC |
| Advertencia de expiración de caché | Al estar inactivo > 59 min (una vez) | ~200 | Marca el reenvío costoso, muestra el camino más barato |
| Status line | Cada llamada a la API | 0 | Se renderiza en la barra de estado del terminal, no en el contexto de la conversación |

**Sobrecarga neta por sesión: ~1.400 tokens (en caché después de la primera llamada).**

Con los precios de Opus ($0,50/MTok lectura de caché), eso son **$0,0007 por llamada a la API** — menos de una décima parte de un centavo. Durante una sesión de 100 llamadas: $0,07.

Si git-lite está habilitado, el plugin **ahorra** ~1.920 tokens por sesión (reemplaza 2.200 con 280). El efecto neto es negativo — el plugin consume menos de lo que elimina.

**Para usuarios de API de pago por uso:** con un gasto de $3.000/mes, la sobrecarga del plugin es inferior a $2/mes. Los ahorros solo de la prevención de expiración de caché (un reenvío de $9 bloqueado por semana) pagan un año de sobrecarga con una sola captura.

---

## 💡 Consejos

### Entiende el caché y verás adónde va el dinero

- **1 prompt ≠ 1 llamada a la API.** Cada vez que Claude llama a Grep, Read o Edit, se reenvía el contexto completo. Un solo prompt fácilmente desencadena 10+ llamadas a la API. Escribe prompts claros para reducir llamadas a herramientas innecesarias y bajar costos.
- **El temporizador del caché se reinicia desde la última llamada a la API, no desde tu último prompt.** Sigue trabajando y el caché nunca expira. El peligro está en alejarse. Token Guardian te avisa cuando ocurrió, y en modo `block` detiene el prompt una vez para que elijas: restablecer el contexto o continuar tal cual.
- **Tamaño del contexto = multiplicador de costos.** La misma llamada a la API a 200K vs 800K cuesta 4 veces más. Cuando la barra de estado [CTX] supera el 35 % (🟡), esa es tu señal para delegar más a SubTasks.

### Hábitos que reducen costos

- **Mantén CLAUDE.md ligero.** Se carga en el system prompt en cada llamada a la API. Cada línea cuesta dinero.
- **Delega el trabajo pesado a SubTasks.** La generación de código, las ediciones de múltiples archivos y las ejecuciones de pruebas no pertenecen a Main. Las SubTasks tienen contexto más pequeño y un nivel de caché más barato.
- **¿Fuera 1+ hora?** `/clear` → regresa → `/s-continue`. Contexto restaurado a $0.
- **¿[5H] por encima del 70 % (🟡)?** Baja el ritmo. Cambia a tareas de revisión ligeras o aumenta la delegación a SubTask para reducir el recuento de llamadas a la API de Main.
- **Usa `/btw` para preguntas secundarias.** No entra en el historial de conversaciones, por lo que tu contexto se mantiene ligero.

### API de pago por uso: los hábitos que más importan

Todo lo anterior aplica, más estas prioridades específicas de la API:

- **Vigila [CTX] como un velocímetro.** Ningún límite de velocidad te detendrá — pero el contexto en 500K+ significa que cada llamada a la API cuesta 2-3 veces lo que debería. `/clear` → `/s-continue` es gratuito y restablece tu multiplicador de costos a la línea base.
- **Ejecuta `/usage-view` semanalmente.** Los usuarios de Max Plan tienen un momento natural de "ay" cuando son limitados por velocidad. Tú no — los costos suben silenciosamente. El panel es tu sistema de alerta temprana.
- **Establece un presupuesto diario mental.** Sin techo, los días de $200 suceden sin darse cuenta. El indicador RUN de la barra de estado hace visible el costo por turno. Si un solo turno supera $1 (🔴), tu contexto es demasiado grande.

---

## 📚 Documentación

- [Guía de caché de prompts](guides/prompt-cache-guide.md) — Por qué la mayor parte de tu costo es caché, cómo funciona el caché entre proveedores (Anthropic, OpenAI, Gemini) y cómo gestionarlo ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 idiomas](guides/))
- [Análisis de costos Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Al menos un 24–38 % más barato que Opus 5 a igual calidad, en 2.782 sesiones
- [Análisis de costos Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Análisis de costos Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Comparación de costos lado a lado en 8.563 llamadas a la API
- [Análisis de costos Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licencia

Apache-2.0
