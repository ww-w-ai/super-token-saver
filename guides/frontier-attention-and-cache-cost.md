# Four Frontier Models Arrived at the Same Architecture

Date: 2026-09-06

> 한국어: [frontier-attention-and-cache-cost.ko.md](./frontier-attention-and-cache-cost.ko.md)

## Summary

This piece is for people who use a coding agent every day and are curious about how it works
underneath.

In the summer of 2026 four labs (Moonshot, Z.ai, DeepSeek, and Alibaba's Qwen team) each released
their newest large model. Line the four up and they are built almost the same way. Teams that do
not share code arrived at the same answer.

By the end you will know three things: how model design is changing, why that design is what lets
you drop a whole codebase or a 500-page document into one request, and why your bill is still set
by how much text you keep sending.

## Terms used in this piece

Every term used in the text and the table is explained here, once. Skip this section if you know
them.

**Parameter.** A language model is a very large table of numbers, and each number is a parameter.
Training adjusts those numbers; using the model reads them. "2.8T" means 2.8 trillion of them. More
parameters can store more knowledge, and cost more to run.

**Total versus active parameters.** Modern large models do not use every parameter for every
word. They are split into many small specialist blocks called "experts", and for each word only a
few experts are switched on. "1.6T / 49B" means the model stores 1.6 trillion parameters but any
single word passes through only 49 billion of them. The active number sets the compute cost. The
total number is what the model has to keep in memory.

**Mixture of experts (MoE).** The name for the expert structure above. Each layer has many experts
and a small router picks a few of them for each token. A "shared" expert is one every token goes
through regardless of the router; "routed" experts are chosen per token. "1 shared + 8 of 288"
means one token passes through the shared expert plus 8 experts chosen out of 288.

**Layer.** The model processes text in stages stacked on top of each other, and each stage is a
layer. Text enters at the first layer, and each layer refines the result of the one before it. In a
93-layer model every word goes through 93 stages. Each layer has two parts: an attention part,
which looks at other words, and a feed-forward part, which transforms the word on its own. The
experts live in the feed-forward part. This piece is mostly about the attention part, because that
is where the cost of long text lives.

**Token and context.** Models do not read characters or words. They read tokens, pieces of text
about three-quarters of an English word long, so 1,000 tokens is roughly 750 words. The context is
everything the model can see at once: your conversation so far, the files you attached, the
instructions the app added. "1M context" means the model can hold about one million tokens, which
is roughly 750,000 words, about ten novels, or a mid-sized codebase.

**Attention.** The mechanism that lets a word look at other words. When the model produces the
next token, each attention layer compares that token against every earlier token in the context and
works out which ones matter for it. With 1,000 tokens of context that is 1,000 comparisons per
layer per new token; with 1,000,000 tokens it is 1,000,000 comparisons. This is where long contexts
get expensive.

**KV cache.** To avoid recomputing the whole context on every new token, the model saves the
processed result of every earlier token in memory. It saves two vectors per token per layer, K and
V, and this store is the KV cache. It grows with every token you add, and every new token has to
read it. The size of the KV cache decides how many users a server can hold at once and how fast
each one gets an answer. Most of the engineering in this piece is about making it smaller.

**Full attention.** What the original Transformer design does and what every well-known model did
until about 2025. For each new token, the layer scores that token against every earlier token, then
blends the earlier tokens by those scores. Two costs follow. First, the work per new token grows
with the length of the context, so processing a whole document grows with the square of its length:
doubling the text quadruples the work. Second, the KV cache keeps one entry per token, so memory
grows in a straight line with length and never shrinks.

**Linear attention.** A design that changes what is stored. Instead of keeping every earlier
token, the layer keeps one fixed-size summary per attention head and updates that summary as each
token arrives. The work per new token is then constant no matter how long the context is, and the
memory does not grow at all. The price is precision: a fixed-size summary cannot hold every detail
of a million tokens, so a model built only from linear layers loses the ability to pull one exact
line out of a long file. Kimi Delta Attention (KDA) and Gated DeltaNet in the table are both
"delta rule" variants of linear attention. The delta rule means the summary is updated only by the
difference between what a new token says and what the summary already predicted for it, which
keeps repeated information from swamping the summary. "Gated" means the layer can also decide how
much of the old summary to forget.

**Layer pattern.** The order in which full-attention and linear-attention layers are stacked.
"3 linear : 1 full" means three cheap layers, then one exact layer, repeated to the top.

**Sparse attention.** One way to cut cost inside a full-attention layer. Every token stays in the
cache, but the layer does not look at all of them. A small, cheap scorer (an indexer) ranks the
earlier tokens for the current one, and the expensive attention step runs only on the top-ranked
few thousand. The full cache is still stored; the saving is compute per token. DeepSeek Sparse
Attention (DSA) in the table is this.

**Compressed attention.** A way to shrink the cache itself. Several neighbouring tokens are folded
into one stored entry before they go into the cache, so the cache has fewer entries and each new
token reads less. The saving is memory and the amount read per generated token. Compressed Sparse
Attention (CSA) and Heavily Compressed Attention (HCA) in the table are this.

**Multi-head Latent Attention (MLA).** A third way to shrink the cache, invented by DeepSeek for
its V2 model in 2024. Instead of storing the full K and V vectors for each token, it stores one much
smaller "latent" vector and reconstructs K and V from it when needed. It cuts the cache per token
by a large factor without dropping any tokens.

**Residual connection.** A layer does not replace its input; it adds a correction to it. The
output of a layer is the input plus whatever the layer computed, written as output = input +
f(input). The "plus input" part is the residual connection. It exists because deep networks are
hard to train: with dozens of layers stacked, the training signal that tells early layers how to
improve has to travel back through all of them, and it fades on the way. Passing the input straight
through gives that signal a direct path. Every Transformer since 2017 has had it, and it is usually
the one part nobody touches. "Residual path" in the table is how each model builds this connection.

**Prompt cache.** A billing term. When you send a request, the provider processes your whole
context from scratch and then keeps the processed result (the KV cache) on its servers for a short
time, typically 5 minutes or 1 hour depending on the tier. If your next request starts with the
same text, the provider reuses the stored result instead of recomputing it. Billing has three
prices: **input**, the base price for text the model processes fresh; **cache write**, charged
when the provider stores your context for reuse (2 times the input price on Claude Code's 1-hour
tier); and **cache read**, charged when a request reuses stored context (one tenth of the input
price on Anthropic's list prices).

**Open-weight.** A model whose parameters are published so anyone can download and run it,
usually with a technical report describing how it is built. OpenAI, Anthropic, xAI, and Google do
not publish theirs. Everything below comes from labs that do.

## The four models compared

The models from OpenAI, Anthropic, xAI, and Google are closed. Their weights are not published, so
nobody outside can say how they are built. The open-weight side is different. Moonshot (Kimi K3),
Z.ai (GLM-5.3-Flash), and DeepSeek (V4-Pro) publish weights and technical reports. Qwen3.8-Max
itself is served only through Alibaba's API, but Qwen publishes its text backbone as
Qwen3.8-2.4T-A95B and calls Max "the official version based on" it, so the architecture is public
too.

| | Kimi K3 | GLM-5.3-Flash | DeepSeek V4-Pro | Qwen3.8-Max (open backbone: Qwen3.8-2.4T-A95B) |
|---|---|---|---|---|
| Total / active params | 2.8T / 104B | 320B / 18B (5.6%) | 1.6T / 49B | 2.4T / 95B |
| Layers | 93 | 45 | 61 | 92 |
| Linear-attention layers | Kimi Delta Attention (KDA) | KDA, 34 layers | none | Gated DeltaNet, 69 layers |
| Full-attention layers | Gated Multi-head Latent Attention (MLA), no positional encoding (NoPE) | MLA + DeepSeek Sparse Attention (DSA), 11 layers | Compressed Sparse Attention (CSA) and Heavily Compressed Attention (HCA), no linear layers | Gated attention, 23 layers |
| Layer pattern | 3 linear : 1 full, plus one extra MLA layer at the end | 3 : 1 exactly (first 3 layers dense) | HCA in the first two layers, then CSA and HCA interleaved | 3 linear : 1 full, 23 times |
| Residual path | AttnRes (8 blocks, fed from the embedding and earlier-block summaries) | mHC, 4 parallel streams | mHC, 4 parallel streams (`hc_mult: 4`) | plain residual |
| Experts per token | Stable LatentMoE: 2 shared + 16 of 896 | 1 shared + 8 of 288 | 1 shared + 6 of 384 | 1 shared + 10 of 512 |
| Context | 1M | 1M | 1M | 262k native (Max serves 1M) |

The open Qwen3.8 weights load as the same `Qwen3_5Moe` architecture class as Qwen3.5, scaled up
(60 to 92 layers, hidden size 4096 to 8192); the expert layout is unchanged from Qwen3.5's largest
model. That backbone is text-only. Vision and the 1M default context are in the API-served Max.

## Trend 1. Most layers are linear attention; one in four stays full

Three of the four models use the same layer rhythm: three linear-attention layers, then one
full-attention layer, repeated. Kimi K3 and GLM-5.3-Flash use Kimi Delta Attention; Qwen3.8-Max
uses Gated DeltaNet.

What this changes: the 3:1 mix keeps one full layer in four, so the square-law cost and the growing
KV cache do not disappear, they shrink to roughly a quarter. The full layers are still there so the
model can retrieve exact details; the linear layers carry the rest of the work cheaply. That is the
honest version of "linear attention is now standard": standard as the majority layer type, with
full attention deliberately kept.

DeepSeek V4-Pro is the exception. Its technical report never mentions linear attention, DeltaNet,
or state-space layers; all 61 layers are softmax attention, and it attacks the cache from the other
side, by compressing it. That is Trend 2.

## Trend 2. Inside the full layers, look at fewer tokens or smaller ones

Two of the four add a second mechanism on top of the layer split.

- **DeepSeek V4-Pro** uses Heavily Compressed Attention in its first two layers and then
  interleaves Compressed Sparse Attention with it. CSA folds every 4 key-value entries into one
  and a "Lightning Indexer" picks the top-scoring compressed entries for the actual attention;
  HCA compresses 128 to 1. The cache stores the compressed entries, in BF16 for the positional
  (RoPE) dimensions and FP8 for the rest (two number formats; FP8 takes half the space of BF16).
  The report puts the result at 10% of V3.2's KV cache.
- **GLM-5.3-Flash** pairs Multi-head Latent Attention with DeepSeek Sparse Attention in its 11
  full layers. A lightweight indexer scores all tokens, and the attention then attends only to the
  top-scoring ones. The indexer still touches every token, so the cost is not truly constant, but
  the expensive part runs on a short list.

Kimi K3 does neither: it leans on the linear layers and keeps its full layers as plain gated MLA.
The open Qwen3.8 config has gated attention with no MLA keys and no indexer keys.

Multi-head Latent Attention, DeepSeek's own invention from V2, now appears on Kimi and GLM. The
V4 report does not name MLA at all: the query side still uses a compressed latent vector, but the
key-value side is shared-KV multi-query attention over the compressed entries.

## Trend 3. The residual path is being redesigned

The residual connection that nobody had touched since 2017 was redesigned this year by three of
the four labs.

- **DeepSeek V4-Pro and GLM-5.3-Flash** use Manifold-Constrained Hyper-Connections (mHC): four
  parallel residual streams, mixed before and after each part of a layer, instead of one stream.
  In plain terms, the model carries four copies of the running state side by side. Each layer
  reads a learned blend of the four and writes back into them. A mathematical constraint on the
  blend stops the values from growing out of control across 45 or 61 layers. DeepSeek's report
  sets the expansion factor to 4 and its config carries it as `hc_mult: 4`; GLM's config carries
  the same 4-stream fields.
- **Kimi K3** uses Attention Residuals (AttnRes): eight blocks whose residual input is a learned mix
  of the token embedding and summaries of earlier blocks, so late layers can read early signal
  directly instead of receiving it only through every layer in between.
- **Qwen3.8** keeps the plain residual. Its config has no hyper-connection keys and no custom
  modeling code, so it runs through the stock Transformers implementation.

Two teams that do not share code arriving at the same four-stream design is the clearest sign in
the whole picture that the field is converging. Training-side details such as the optimizer are
not in the reports checked here, so this piece does not make claims about them.

## A fourth thing they share: only a few experts are on

All four are mixture-of-experts models with always-on shared experts (two for Kimi, one for the
others) plus a small routed set. The active fraction is small: Kimi K3 runs 104B of its 2.8T
parameters per token, GLM-5.3-Flash 18B of 320B, DeepSeek V4-Pro 49B of 1.6T, Qwen3.8 95B of
2.4T. Total parameter count is a storage figure; the active count is what a token actually costs
to run.

## Conclusion: speed goes up, and the way to cut your bill stays the same

**Speed is set directly by the architecture.** Three of the four support a 1M-token context, and
the design above is why that is affordable to serve. Every new token has to read the KV cache. A
cache one quarter the size (Trend 1) or one tenth the size (Trend 2) means each generated token
reads less, so the first token arrives sooner and generation runs faster, and the longer the
context, the bigger the gap. When a coding agent takes in your whole repository and starts
answering within a few seconds, this is what made it possible.

**The bill is a separate matter.** Hosted APIs do not charge for bytes of KV cache. They charge per
token, at the three prices of input, cache write, and cache read. In a long agent session almost
all your tokens are cache reads: every turn re-sends the whole conversation, and the provider reads
it back from the cache. That is cheap per token, but there are a great many of them. The expensive
moments are when the cache has gone cold, because the next request pays the cache-write price on
the entire context at once.

Nothing in the four architectures changes those three prices. They change what it costs the
provider to serve you, not what the provider charges. So what you can do about cost is the same as
before, and there are three things:

1. **Keep the context small.** Every turn re-reads all of it. A 400,000-token session costs
   ten times as much per turn as a 40,000-token one, before the model writes a single word.
2. **Keep the prompt cache warm.** If you step away for longer than the cache lifetime, the next
   request reads the context with the cache cold: a cache write on the whole context, at twice the
   input rate on the 1-hour tier. After a long break, starting a fresh session and restoring only
   what you need is cheaper than continuing the old one.
3. **Send execution to subagents.** Tool output (test logs, file listings, search results) is the
   fastest way a context grows. A subagent reads it in its own context and returns a short answer,
   so the main conversation stays small.

Those three are exactly what super-token-saver measures and enforces. The architecture trend does
not change the advice; it explains why long contexts are becoming normal and why the cache is still
where the money goes.

## Sources

- **Starting point**: Sebastian Raschka, "Frontier LLM Architectures" (LLM Architecture Gallery),
  the four-model comparison diagram of Kimi K3, GLM-5.3-Flash, DeepSeek V4-Pro, and Qwen3.8-Max.
  Seen via Youngsun Joung's LinkedIn post that shared it: https://lnkd.in/p/geDS6fnb. Every cell of
  the table was then checked against the model's own material below; where the diagram and the
  source differed, the source won.
- **Kimi K3**: technical report (`k3_tech_report.pdf`) and README at
  https://github.com/MoonshotAI/Kimi-K3; announcement https://www.kimi.ai/blog/kimi-k3. Settled the
  active count (104B), the expert layout (2 shared, 16 of 896), the extra MLA layer, NoPE, AttnRes
  with 8 blocks, and the absence of any sparse or compressed attention.
- **GLM-5.3-Flash**: `config.json` at https://huggingface.co/zai-org/GLM-5.3-Flash (layer list,
  34 KDA and 11 MLA+DSA layers, 4-stream hyper-connection fields, 1 shared + 8 of 288 experts,
  1,048,576 context, first 3 layers dense); parameter counts from
  https://sebastianraschka.com/blog/2026/glm-5-3-flash-architecture-notes.html.
- **DeepSeek V4-Pro**: technical report arXiv:2606.19348 (sections 2.3, 3.5, 4.2.1) and
  `config.json` / README at https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro. Settled the HCA
  first two layers then CSA/HCA interleave (`compress_ratios` = 128, 128, 4, 128, 4, ...),
  `hc_mult: 4`, the Lightning Indexer, the BF16/FP8 cache format, 1 shared + 6 of 384 experts,
  and that MLA is not named in the report.
- **Qwen3.8**: model card and `config.json` at https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B,
  compared with https://huggingface.co/Qwen/Qwen3.5-397B-A17B. Settled `layer_types` (69 linear,
  23 full, interval 4), gated attention with no MLA or indexer keys, no residual-related keys,
  512 experts with 10 + 1, 262,144 context, and that the open weights are text-only. The qwen.ai
  blog pages could not be fetched, so Max-only details come from the model card's own description.
- **Prices**: Anthropic's published API list prices (input, cache write at 1.25x for 5-minute and
  2x for 1-hour, cache read at 0.1x), https://platform.claude.com/docs/en/about-claude/pricing.
