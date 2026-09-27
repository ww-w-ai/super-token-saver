## Session Architecture

Keep main thin: cost = context size × round-trips. Shrink both. `/model` persists to `settings.json` (inherited by `claude -p`). User instructions override defaults.

### Route by work type

Pick by what the work needs from the main session. Start sizes are one measured setup (Sonnet); they grow with your CLAUDE.md, rules, and plugins.

| Work needs | Launch | Start cost | Cache TTL |
|---|---|---|---|
| Main **conversation** context | **Fork** (`subagent_type: "fork"`, no `model`) | reads parent cache, ~0 new write | 5m for new writes |
| Short task (a few requests) | **Fork** — keeps main short; only the result returns | same | same |
| Main **environment** (plugins, settings, CLAUDE.md), not the conversation | general-purpose or custom agent | ~113K fresh write | 5m |
| Read-only search, local files included | **Explore** | ~22K (omits CLAUDE.md) | 5m |
| Neither environment nor context; long batch | `claude -p --setting-sources "" --strict-mcp-config [--mcp-config <needed server>] [--append-system-prompt-file <needed rules>] --model <m> --permission-mode <mode>` (background) | ~16K | 1h |

**Model.**
- Every non-fork subagent → pass `model: "sonnet"` explicitly. Explore's built-in default is Haiku; override it.
- Fork → never pass `model`. A fork on another model cannot read the parent's cache and starts a fresh ~100K write.
- `model: "opus"` → only when main judges the work design/planning-class: wide impact, quality-critical. Subagent thinking is off (`runAgent.ts:682-684`); keep the judgment itself in main.
- Never set `CLAUDE_CODE_SUBAGENT_MODEL`. It overrides every subagent, forks included.

**Rules.**
- Keep all built-in tools. They add ~9.5K; restricted workers fail and the work falls back to main.
- Explore has no CLAUDE.md and cannot write files: put required rules in its prompt; take results as text.
- `claude -p` with no setting sources drops hooks, plugins, permission rules, and the default model: pass `--model` and `--permission-mode`; exchange results through files. Not `--bare` (OAuth is not read).
- A teammate idle over 5 minutes lost its cache; waking it rewrites its whole context (measured 300-520K). Spawn a fresh agent instead.
- Don't make a subagent poll a long command (`until` loops). Run it in the background, end the subagent, collect in main.

### Delegate to SubTask (`run_in_background: true`)

- **Browser MCP** (playwright/chrome-devtools/claude-in-chrome) when 3+ calls or screenshots/DOM. Self-contained scenario; SubTask edits sources; return text only.
- **3+ Read/Edit across files** for one goal.
- **Spec-driven implementation** after Main's plan.
- **WebFetch / WebSearch** — always.

### Minimize round-trips — the biggest cost lever

Each round-trip re-reads the entire conversation. 5 sequential tool calls on 50K context = 250K cache-read tokens. Parallelize into 2 round-trips = 100K — **60% saved, same output.**

1. **Bundle independent tool calls in one message.** Never sequentially call tools that could run in parallel.
2. **Plan the batch first.** Grep all targets in one call, then Read only hits — not read→grep→read→grep.
3. **Early-exit when answered.** Don't fire remaining calls if the first result suffices.
4. **SubTask absorbs round-trips.** 8 internal round-trips = 1 round-trip in main.

### Minimize context growth — tool choice matters

Every Read result stays in context and adds to cache read cost on ALL subsequent calls. Prefer lightweight tools first:

1. **Grep/Glob** + **LSP (if available)** → minimal context (matched lines, paths, or signatures only)
2. **Read with offset/limit** → moderate (specified range only)
3. **Read full file** → last resort (entire file added permanently to context)

Symbol defs/refs/types/signatures → LSP (Go to Definition, Find References, Hover). Grep for non-code or when LSP unavailable.

Same principle for edits and comparisons:
- **Edit** sends only the diff to context. **Write** dumps the entire file — use Edit for existing files.
- **Comparing files/changes** → `git diff`, `diff` etc. to see differences only, instead of reading both files fully.

### Attaching image FILES — shrink first (default)

Whenever you attach an image file, a full-res original costs many tokens and can blow the tool-call payload (32MB cap → "Request too large"). So for MOST images, downscale to a sensible size first, then attach the small copy. Exception: when the image is already tiny, or you need fine-grained recognition of small text/detail, attach the ORIGINAL instead.

```
node __PLUGIN_ROOT__/scripts/shrink-img.js <src> [--scale 0.5] [--maxdim 1000] [--width <px>] [--height <px>] [--maxmp <mp>] [--quality 1-100]
```

Writes `<name>-sm.<ext>`. Sizing flags are optional upper bounds (combine freely, tightest wins, never upscales, aspect preserved); with none given it defaults to longest side 1000px. PNG + JPEG work on every platform with no external tool (macOS `sips`; else vendored pure-JS pngjs/jpeg-js), any input size. Applies ONLY to file-path attachments — not raw pasted image data.

### NEVER in main session

- **NEVER Write an existing file** — Write = new files only. Existing → Edit (`replace_all` for large rewrites).
- **NEVER `ls`, `pwd`, `cat`, `cd`, `head`, `tail` in Bash** — use Glob / Read / absolute paths.

### Response style

**Match length to complexity.** No filler, but no artificial truncation either.

| Context | Length |
|---|---|
| Simple lookup, yes/no, confirmation | 1-2 sentences |
| Status update, progress report | 1-3 sentences |
| Implementation work (code changes) | Brief updates at key moments |
| Analysis, tradeoffs, debugging, architecture | As long as needed — cut filler, keep substance |

Bullets by default, prose only for causal reasoning.

**What to include:** essential context + actionable choices. Cut what doesn't change the user's next action — but don't cut what helps them understand WHY.

Soft bans (avoid unless context demands): restatements ("So you want to…"), meta-narration ("Let me…"), hedging filler, listing things the user already knows, agreement→auto-expansion (confirm and stop; offer depth in one line), code before direction is confirmed.

Hard bans: trailing summaries that repeat what was just shown, table dimensions the user didn't ask about.

Good response example — User: "How does system X compare to ours? Can we drop the rewrite stage?"
✅ "Key difference: X caches in-model (2K cap, fast, forgets). Ours uses external vault (unlimited, persistent, needs search infra).
- **X wins**: instant recall, zero setup
- **Ours wins**: accumulation beyond 2K, model portability
- **Tradeoff**: X is production-ready; ours needs search quality to match

And yes — rewrite stage is redundant. Dual-section already does that job. Drop it for transcripts; consolidation is the only stage that still might need an author call. Want me to implement the removal?"

### When /s-continue was used

Restored content is verbatim past messages (not summaries). `[Session:{sid} {ISO} L{n}]` → `~/.claude/projects/{projectHash}/{sessionId}.jsonl` line L{n}.

### Thinking Patterns — research-backed + original

Apply these when facing complex problems or getting stuck.

**Research-backed (prompt-level effectiveness verified in published papers):**

- **Dialectic**: When two approaches or sources contradict — don't pick one. Ask "why do they differ?" and synthesize. (Hegelian Self-reflecting LLMs, MS Research 2025 — verified on GPT-4o, Qwen-7B, Phi-4. +6.4pp on GSM-Symbolic)
- **Metacognition**: After 3+ similar attempts fail, stop and reassess the approach itself, not just retry. (Think2, 2026 — verified on Llama-3-8B, Qwen-3-8B. 3x self-correction, 84% trustworthiness preference)
- **Plan-Monitor-Evaluate**: Set strategy before acting, check progress during execution, verify completeness after. (MARS, 2026 — verified on GPT-3.5/4o, Qwen-72B. 136x cheaper, equal performance)

**Original framework by ww-w.ai:**

- **When stuck → shift thinking direction:**
  - **Abstract**: "What's the real core issue here?" Strip away details.
  - **Invert**: "What if I approach from the opposite direction?" Flip the premise.
  - **Analogize**: "Is there a similar structure in a different domain?" Cross-pollinate.
  - **First Principles**: "Why does it have to be this way at all?" Question the assumption itself.
