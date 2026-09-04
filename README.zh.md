# super-token-saver

**唯一真正读取 CC 源代码、找出 token 流向并自动修复的 Claude Code 插件。花更少的钱，写更久的代码。**

> 实测结果：在真实的 $326/天 工作负载下实现 **45% 成本削减** → $180/天。SubTask 自动委托、零成本上下文恢复、完整的分析仪表盘，以及缓存过期防护——一键安装，零配置。

支持 **Max Plan（$200/月）** 和 **API 按量付费**。同一插件，同样功能。对所有用户都更强大——对每个 token 都是真金白银的用户尤其如此。

![使用仪表盘——精确查看 token 的去向](docs/images/usage-view-overview.png)

### 30 秒速览功能

| 功能 | 效果 | 影响 |
| ------- | ------------ | ------ |
| 🧠 Session Architect | 自动将繁重工作委托给 SubTask（缓存便宜 37.5%） | 上下文保持精简，成本下降 |
| 🪶 Concise Mode | 削减冗余填充，保留核心内容 | 每次响应的输出 token 减少 |
| 🔄 /s-continue | 替代 /compact——零 LLM 调用，零成本，零信息损失，还能恢复 **Codex** 会话 | 两个工具的上下文都能免费恢复 |
| 🤝 /s-compact | 编写 /s-continue 自动加载的会话交接记录——捕获 transcript 会丢失的子代理发现和工具结果 | 下一个会话也能恢复隐藏的上下文 |
| 📊 Status Line | 实时成本、上下文大小、速率限制——延迟低于 50ms | 在问题产生费用之前发现它 |
| 📈 /usage-view | 带 AI 分析的交互式 HTML 仪表盘 | 一键完成成本全面溯源 |
| ✂️ /setup-git-lite | 移除 CC 每次会话注入的 2,200 个隐藏 token | 仅 git 指令每月节省约 $48 |
| 🛡️ Token Guardian | 在缓存过期即将导致上下文重发的那一刻发出警告，或在 `block` 模式下直接拦截 | 再也不会被悄无声息的 $9 账单吓一跳 |

---

## 😤 问题所在

**隐形成本。** 没有实时可见性。没有"你的上下文已达 80 万 token"的警告。没有"缓存 3 分钟前已过期"的提示。等你发现时，损失已经造成。

**上下文膨胀。** 同样的提示，20 万 token 上下文和 80 万 token 上下文的成本相差 4 倍。每次 Read、Grep、Edit 都会重发整个上下文。一个复杂提示轻松触发 15 次以上 API 调用，每次都乘以你的上下文大小。

**缓存过期。** 你去吃了个午饭，回来缓存已经没了。下一条消息以全价重发 90 万 token，一次 $9。

**全靠手动。** 上下文管理、缓存过期时机、SubTask 委托、会话清理。没有人能在真正写代码的同时追踪这一切。

**用的是 Max Plan（$200/月）？** 以上全部，再加上没有倒计时、没有预计恢复时间的 5 小时速率限制，随时打断你的工作流。

**API 按量付费？** 以上全部，而且没有上限。一次缓存未命中 = $9 真实资金。每周十次 = 仅事故就 $360/月。一个上下文膨胀的糟糕星期二，花费可能超过 Max Plan 用户一整个月的订阅费。

super-token-saver 自动处理这一切。**安装一次，搞定。**

---

## 🚀 安装

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

安装后自动运行。零配置。需要 [Claude Code](https://claude.ai/claude-code) v2.1.71+。

实时监控：

```
/setup-statusline install
```

从 CC 内置 git 指令中移除 2,200 个隐藏 token（[详情](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)）：

```
/setup-git-lite install
```

---

## 🧠 功能 1：智能会话架构

**安装即生效，成本优化的工作模式自动启动。**

大多数用户在 Main session 中做所有事情：读文件、生成代码、跑测试。所有输出堆积到上下文中，随每条消息重发。会话越来越臃肿，成本像滚雪球一样增长。

Session Architect 在会话开始时自动注入委托策略。

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| 角色             | 设计、决策、评审         | 实现、代码生成、多文件  |
| 缓存有效期       | 1 小时 (ephemeral_1h)             | 5 分钟                                 |
| 缓存写入成本 | ＄10/MTok                          | ＄6.25/MTok                            |
| 上下文大小     | 平均 ~94K                          | 平均 ~33K                              |

SubTask 的缓存写入比 Main **便宜 37.5%**，上下文也小得多。将繁重工作委托给 SubTask 可大幅降低成本。

**结果：** 上下文保持在 250K 以下，而不是膨胀到 600K+。同样的工作产出，token 成本减半。完全自动。

---

## 🪶 Concise Mode

**同样的内容，更少的填充。默认开启。**

SessionStart 钩子还会在**每个会话和每个模型**中注入响应风格规则——无需任何标志或设置。三项变化：

- **去掉前言** — 不再有"让我来检查一下……"、"我现在将……"、重述你的问题，或概括 diff 已经显示的内容
- **内容决定格式** — 列表用项目符号，推理（权衡、因果、依据）用散文。不强制任何一种
- **更精炼的表达** — 同样的观点，更少的字。更清晰的散文就是更短的散文

硬限制：绝不省略内容、跳过验证，或把细微差别压缩成一句话。实质内容完整保留，只有包装缩小。

安装一次，处处生效。

---

## 🔄 功能 2：/s-continue——上下文恢复

**替代 `/compact`。零 LLM 调用。零 token 成本。零信息损失。**

`/compact` 将你的整个上下文（约 100 万 token）发送给 LLM，压缩成 3.3% 的摘要。如果缓存已过期，光这一步就会触发全量重缓存。信息损失不可避免。

`/s-continue` 采用完全不同的方式。它对上一个会话的 transcript 进行预处理并直接加载。无 LLM 调用，无成本。原始对话原样恢复。

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| 工作原理            | 将完整上下文发送给 LLM 生成摘要 | 预处理 transcript，直接读取 |
| LLM 调用               | 需要（通常 10 万+ token） | 0                                |
| Token 成本              | 高                              | 0                                |
| 信息损失        | 有（3.3% 摘要）                | 无（保留原始内容）        |
| 处理速度        | 数十秒                   | < 1 秒（即使 60MB+ 文件）       |
| 缓存过期时   | 额外触发全量重缓存费用         | 无影响                        |
| 多会话恢复   | 不支持                      | 支持                        |

用法：`/clear` 然后 `/s-continue`。会看到之前会话的列表，选择要恢复的那个。快速恢复：`/s-continue last`。

**结果：** 零成本恢复之前的工作。无信息损失。60MB+ 的 transcript 在 1 秒内处理完毕。

### 🤝 它的搭档：`/s-compact` —— 交接隐藏的那一层

`/s-continue` 恢复的是 **transcript**——你和 Claude 说过的话。但一个工作会话中最有用的知识，常常存在于这段对话之外：**子代理（subagent）** 发现的内容（它的 transcript 是单独的文件，恢复时不会加载）、工具输出中的关键**数字**（测试数量、基准值）、从过程中得到的**经验教训**（"headless 下无法复现——原来是构建问题，不是代码问题"）。

在会话结束时运行 `/s-compact`，它会把这层隐藏的知识提炼成交接记录，保存到 `~/.claude/super-token-saver-data/<project>/handoff.md`。到下一个会话，`/s-continue` 会在恢复 transcript 的同时**自动加载**它——无需手动粘贴。

|                     | 仅 `/s-continue`            | `/s-compact` + `/s-continue`（组合）          |
| 恢复内容            | transcript（说过的话）  | transcript 加上隐藏的那一层             |
| 子代理发现   | 丢失（单独文件）           | 提炼进交接记录                       |
| 工具输出数字 | 仅当在对话中被引用    | 有意提取                            |
| 过程经验     | 无                               | 记录下来，避免重复走弯路              |

**工作流程：** 用 `/s-compact` 结束一个会话 → 用 `/s-continue` 开始下一个会话。

### 🔀 两个工具，一份历史——Codex 会话也能在这里恢复

Codex 把会话写到 `~/.codex/sessions/`，Claude Code 写到 `~/.claude/projects/`。两边互不读取对方的文件，所以以前在 Codex 里预算耗尽的任务，在 Claude Code 里根本碰不到，反过来也一样。

现在 `/s-continue` 会把两份历史一起列出并恢复。Codex 的 rollout 不会交给另一个解析器处理，而是按 **输入一行、输出一行** 的方式改写成 Claude Code 写入的格式——这样同一条流水线能同时服务两者，`L{n}` 标记依然精确指向原始 Codex 文件的那一行。实测：一份 12 MB、1,540 行的 rollout，预处理只需 **0.13 s**。

|                        | Claude Code 会话 | Codex 会话 |
| ---------------------- | ------------------- | ------------- |
| 被 `/s-continue` 列出 | 是 | 是，限定在当前项目内 |
| 零 LLM 成本恢复 | 是 | 是 |
| 用 `L{n}` 跳回原文 | 是 | 是——行号就是 rollout 自身的行号 |
| 上下文丢失（`#0`）恢复 | `/compact`、自动 compact | Codex 自己的 compaction 和线程回退 |
| `/s-compact` 交接记录 | 按项目共享——在一个工具里写，在另一个工具里加载 |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

能不能列对，靠的就是这两个细节。Codex 的 `session_id` 其实是子代理也会继承的 **线程** id，所以恢复靠 `payload.id` 来区分会话，子代理的 rollout 会被过滤掉——用的是 Claude Code 过滤子任务 transcript 的同一套方法。而 `<codex_internal_context source="goal">` 是系统自动注入的，恢复时会保留在上下文里，但不会被算作你输入的一轮对话。

这个插件也会安装进 Codex——参见 **[README-CODEX.md](./README-CODEX.md)**（[한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)）。`usage-view`、`report-limit` 和 `setup-statusline` 目前仍然只支持 Claude Code。

---

## 📊 功能 3：实时状态栏

**实时 token/成本监控。延迟低于 50ms。**

运行一次 `/setup-statusline install`，Claude Code 底部就会出现一个持久状态栏。

**正常运行** — 所有指标一目了然，无需切换上下文：

![正常状态的状态栏](docs/images/statusline-normal.png)

**达到速率限制时** — 5H 变红显示 102%，倒计时精确显示何时恢复，一键 `/report-limit` 操作自动浮现：

![速率限制时的状态栏](docs/images/statusline-rate-limited.png)

| 指标        | 显示内容                       | 🟢 正常 | 🟡 警告 | 🔴 危险 |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN（差值）      | 上次 API 调用的成本           | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN（累计） | 该文件夹的累计成本     | —         | —          | —           |
| 5H               | 5 小时窗口使用率 + 重置倒计时 | < 70%     | >= 70%     | >= 90%      |
| CTX              | 上下文窗口使用率                | < 35%     | >= 35%     | >= 70%      |

当任意指标进入警告或危险状态时，`→ /usage-view current` 提示会自动出现。

移除：`/setup-statusline uninstall`（之前的配置自动恢复）。

**结果：** 所有成本问题实时可见。延迟低于 50ms——无可感知的卡顿。

> **API 按量付费？** 5H 和 W 指标自动隐藏——你没有速率限制窗口。保留的是真正重要的：RUN（每轮实时成本）和 CTX（上下文大小）。控制账单的两个杠杆，始终可见。

---

## 📈 使用仪表盘（/usage-view）

**终于能回答这个问题："那些钱都去哪了？"**

Max Plan 用户触发速率限制后一脸茫然。API 用户打开 Anthropic 账单后一头雾水。问题都是一样的：哪个会话烧掉了最多 token？成本是什么时候飙升的？使用模式是什么？到目前为止——一切都是不透明的。

`/usage-view` 把一切都展示出来。一个交互式 HTML 仪表盘在浏览器中打开，让你分析使用模式，追溯成本飙升的根本原因。无外部依赖，可独立运行，可作为文件分享。

**31 天花了 $4,196，都去哪了？** 一眼看清——总成本、按类型分的 token 明细、缓存效率比、会话数量。环形图立刻显示你 65% 的支出是缓存读取（正常且健康）：

![使用仪表盘概览](docs/images/usage-view-overview.png)

**安装前后对比——实测，而非猜测。** 橙色虚线"Plugin installed"标记将成本时间线一分为二。每日柱状图按 token 类型堆叠（Input/Output/Cache Write/Cache Read），精确显示安装后哪个组件发生了变化。平均线展示趋势：

![每日成本趋势](docs/images/usage-view-daily-trend.png)

**什么时候烧得最多？** 按时段的每小时成本和按星期几的分布。可在活跃日均值、全天均值和最大值之间切换。火焰图标标记你最贵的时段——清晰的规律（深夜狂刷、周三峰值）立刻跳出来：

![按时段和星期几的成本规律](docs/images/usage-view-hourly-pattern.png)

**效率在提升吗？** Total/Output 比率衡量每产生一个输出 token 消耗了多少 token。越低越好。"Plugin installed"标记让你对比安装前后。峰值 = 缓存未命中或会话重启：

![效率趋势](docs/images/usage-view-efficiency.png)

**每次 API 调用，按上下文大小和成本绘图。** 这张图让成本结构一目了然。每个点代表一次 API 调用。红色 = Opus，蓝色 = Sonnet，绿色 = Haiku。虚线是理论定价——如果你的点在线上方，说明你多付了钱。切换到 **User Turn** 视图，可以看到每次对话轮次而非每次 API 调用的成本。
悬停任意点可查看实际提示文本、token 数量和完整成本明细（Input/Output/Cache Write/Cache Read）：

![按上下文大小的成本——散点图](docs/images/usage-view-cost-scatter.png)

**你的上下文有多大？** 大多数调用集中在 250K 以下。350K 以上的长尾才是成本爆炸的地方——这张图精确显示你有多频繁进入危险区：

![上下文大小分布](docs/images/usage-view-context-dist.png)

**按小时计价的编程日程表。** 30 天的 5 小时窗口热力图。绿色（< $15/h）、橙色（$15-30/h）、红色（$30+/h）。骷髅图标（💀）标记你触发速率限制的窗口。顶部的成本滑块过滤掉便宜的窗口，让贵的凸显出来——拖动即可立刻找到你最糟糕的日子。可在 5 小时窗口和 1 小时块视图之间切换：

![每小时使用情况日历热力图](docs/images/usage-view-calendar.png)

**点击任意格子，深入查看该窗口的会话。** 该时段的每个会话，附带成本、消息数、token 明细，以及每次对话的实际首条/最后一条消息。展开"Top Token Conversations"可查看哪些具体对话烧得最多——每条记录显示提示文本、成本警告标签和优化建议：

![会话详情面板](docs/images/usage-view-session-drilldown.png)

**AI 驱动的分析（可选）。** 不带 `--no-ai` 运行 `/usage-view`，AI 分析师会读取你的完整仪表盘数据——内置 API 定价参考——生成一份书面报告：成本驱动因素、异常、优化建议。根据你的操作系统语言自动显示（23 种语言，含从右到左语言；图表/表格始终保持从左到右）：

**钱的去向** — 总支出、按 token 类型分的成本驱动、周趋势、用实际数字衡量的插件效果：

![AI 分析——成本明细](docs/images/usage-view-ai-report-1.png)

**工作时间和方式** — 高峰时段、最忙的日子、API 调用分布，以及揭示优化机会的速率限制规律：

![AI 分析——工作规律](docs/images/usage-view-ai-report-2.png)

**下一步该怎么做** — 基于你实际使用数据的具体、有数据支撑的建议。模型切换、上下文管理、会话策略：

![AI 分析——建议](docs/images/usage-view-ai-report-3.png)

**分享出去。** 整个仪表盘是一个独立自包含的 HTML 文件——所有数据内嵌，无需服务器。发给你的团队、老板或会计。无外部依赖，离线可用。使用 `private` 模式在分享前清除所有提示文本——保留成本分析的同时移除对话内容。

```
/usage-view                  # 所有时间，所有项目
/usage-view current          # 仅当前 5 小时窗口
/usage-view last 7 days      # 最近 7 天
/usage-view locale ja        # 日语
/usage-view --no-ai          # 跳过 AI 分析（更快）
/usage-view private          # 清除提示文本（安全分享）
```

---

## 🔬 速率限制研究（/report-limit）

**社区驱动的项目，旨在逆向工程速率限制公式。**

Anthropic 没有公布 5 小时窗口的精确计算公式。让我们一起搞清楚。

触发速率限制时，运行 `/report-limit`。你当前的使用数据会自动提交为 GitHub Discussion。收集的数据越多，公式就越清晰。

---

## ✂️ 功能 4：/setup-git-lite——精简 CC 内置 Git 指令

**我们读了 Claude Code 的源代码。发现了每次会话注入的 2,200 个你在悄悄付费的隐藏 token。**

### 这一发现

2026 年 4 月 12 日，一个 [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) 揭示了 Claude Code 内置的 `includeGitInstructions` 设置每次会话都在悄悄消耗 token。通过[这个 gist（spilist）](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98)的独立复现确认了数字：每次 git commit 后的会话中，**缓存写入 +6,031 token**，每次 API 调用**缓存读取 +1,690 token**。

### CC 源代码分析——token 的去向

我们在 Claude Code 源码（v2.1.88）中追踪到两个独立的注入点：

**1. `gitStatus` 快照（约 500 token）——系统提示**
- `context.ts:36-111` 中的 `getGitStatus()` 收集分支 + 主分支 + user.name + 完整状态（最多 2000 字符）+ **最近 5 次提交**
- 通过 `appendSystemContext`（`utils/api.ts:437`）附加到系统提示
- 每次新提交、新修改文件、分支切换都会改变文本 → 前缀缓存失效

**2. Commit/PR 工作流指令（约 1,700 token）——Bash 工具描述**
- `tools/BashTool/prompt.ts:53` 将 60 多行安全协议、逐步提交流程、HEREDOC 示例和 PR 创建模板附加到 `Bash` 工具的描述中
- 与系统提示一起缓存，但作为 `tools[]` 参数发送

### 为什么如此昂贵

缓存结构（`utils/api.ts:321` `splitSysPromptPrefix`）根据是否有活跃的 MCP 工具分为三条路径：

- **路径 A**（MCP 活跃——大多数用户）：`gitStatus` 位于 `cacheScope: 'org'` 块中。任何变化 → 下次会话开始时整块重新缓存 → 6K token 的 `cache_create` 未命中。
- **路径 B**（无 MCP）：`gitStatus` 进入 `cacheScope: null` 动态块，每次 API 调用作为新鲜的 `input_tokens` 重发——没有缓存未命中，但也没有缓存节省。
- **路径 C**（第三方提供商 / 实验性 beta 禁用）：与路径 A 相同。

在典型的交互式会话中，commit/PR 指令（1.7K token）通过 `cache_read` 在**每次 API 调用**中累积。以 Opus 4.7 定价计算，100 次调用的会话中，仅这些 Claude 训练已基本涵盖的指令就要花费约 **$0.08/会话**。

### super-token-saver 如何处理

`/setup-git-lite` 禁用原生路径，通过 SessionStart 钩子注入一个**精心筛选的 280 token 替代品**。我们只保留了覆盖 Claude 默认行为的内容（安全规则），删除了 Claude 从训练中已经知道的一切（逐步工作流、PR 模板、gh 使用模式）。

**保留——11 条关键覆盖规则**（将 Claude 的默认善意转变为谨慎的规则）：
- 未经明确用户请求，绝不 commit/push/amend/PR/tag/merge
- 绝不跳过钩子、强推到 main/master、执行破坏性操作、修改 git 配置
- 绝不提交匹配 `.env`、`credentials`、`*.pem`、`secret.*` 的文件
- 避免 `git add -A` / `git add .`
- 多行 commit 消息用 HEREDOC + `Co-Authored-By: Claude` 尾注
- 绝不使用交互式标志（-i），禁止空提交
- 如果 pre-commit 钩子失败 → 创建新提交（不用 `--amend`）

**删除** — 逐步 commit 工作流（3 步）、逐步 PR 工作流（3 步）、PR 标题/正文模板、`gh` 命令参考、`-uall` 标志警告、rebase 时的 `--no-edit` 警告、`提交期间绝不使用 TodoWrite 或 Agent 工具`约束。这些都是 Claude 从训练中就能正确完成的工作流冗余描述。

**新增** — 紧凑的 git 状态行：分支 + HEAD 短 SHA + 主题 + 当前状态（最多 20 个修改文件，超出则显示数量）。不含近期提交列表（Claude 可按需运行 `git log`）。

### 预期节省（Opus 4.7 定价，输出 $25/MTok，输入 $5/MTok，缓存读取 $0.50/MTok）

| 项目 | 原始 | 使用 setup-git-lite 后 | 节省 |
| ---- | -------- | ------------------- | ----- |
| 系统提示加载（每个新会话） | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| 同一会话中的重复调用 | ~1,700 tok cache_read/次 | ~280 tok cache_read/次 | ~1,420 tok/次 |
| 100 次调用会话（Opus 4.7） | — | — | **节省约 $0.11** |
| 每天 20 个会话 × 22 个工作日 | — | — | **每月节省约 $48** |

### 用法

```bash
/setup-git-lite status     # 只读诊断——当前状态 + 将会发生什么变化
/setup-git-lite install    # 禁用 CC 原生 + 启用我们的最小钩子
/setup-git-lite revert     # 恢复默认（激进；见下文）
/setup-git-lite dismiss-banner    # 屏蔽偶尔出现的推荐提示
/setup-git-lite undismiss-banner  # 重新启用提示
/setup-git-lite help       # 完整用法
```

### 安装说明

`install` 为稳健性修改**两处**：

1. `~/.claude/settings.json` — 添加 `"includeGitInstructions": false`
2. Shell 配置文件（`~/.zshrc`、`~/.bashrc` 等）— 追加一个导出 `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` 的标记块

任意一处单独就足以禁用 CC 原生；我们同时设置两处，以防环境变量覆盖意外重新启用原生行为。Shell 变更仅在新 shell 中生效。

### 还原说明——激进模式

`revert` 会**从你的 shell 配置文件中移除所有 `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` 导出**，包括你在安装此技能之前手动添加的那些。这是有意为之——你运行了 `revert`，我们就恢复干净的默认状态。我们总会先创建一个带时间戳的 shell 配置文件备份。

如果你因其他原因需要该环境变量，请在运行 `revert` 前记下来，之后再重新添加。

### 卸载 super-token-saver 之前

**先运行 `/setup-git-lite revert`**，否则你的 settings.json 中会留有 `includeGitInstructions: false` 但没有替代钩子（Claude 完全得不到 git 指导）。Claude Code 目前没有插件卸载生命周期钩子，我们无法自动化这一步。

### 权衡

你失去的（以及为什么通常没关系）：
- Claude 在会话开始时不再收到预先计算的 `git status` / `git log -n 5`。如果你在新会话中问"什么改变了？"，Claude 会自己运行这些命令（额外一次工具调用，约 300 token）。
- Claude 不再看到 CC 标准的 3 步提交流程。在数百次提交流程的测试中，训练层面的知识能处理关键情况（HEREDOC 格式、无 `--amend`、无强推），因为我们将这些作为明确规则保留。
- PR 正文模板（`## Summary` + `## Test plan`）不再注入。如果你很在意这个格式，把它放进你项目的 CLAUDE.md。

### 推荐横幅

当 CC 原生 git 指令在你机器上仍处于活跃状态时，super-token-saver 会在会话开始时**约 20% 的概率**显示一段建议提示（在 `/usage-view` 和 `/report-limit` 输出中也会显示）。使用 `/setup-git-lite dismiss-banner` 永久关闭。

---

## 🛡️ 功能 5：Token Guardian

**在缓存过期造成损失的那一刻就告诉你。如果你要求，它也可以直接拦截那笔 $9 的重发。**

Claude Code 的提示缓存 TTL 为 1 小时。离开超过一小时，缓存就会过期。下一条消息会以全价重发整个上下文。90 万 token 的话，一次就是 $9。

Token Guardian 会记住上一次收到回复的时间。如果间隔超过 3,590 秒（TTL 减去 10 秒缓冲），它就可以介入。**但默认情况下它是关闭的，因为 Remote Control（远程控制）。** 钩子的拦截消息是在本地渲染为系统消息的，远程客户端根本收不到，导致一位远程用户看到提示就这样悄无声息地消失了，没有任何解释。与其发布一个因你所在位置不同而表现不一致的防护，我们选择先把它关掉。等 Remote Control 开始转发钩子消息，默认值就会重新打开。在那之前，你可以自己用两种模式之一打开它。

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude 会在回复第一行提到缓存过期
export CC_TOKEN_SAVER_CACHE_GUARD=block   # 提示会被拒绝一次，并显示下面这条消息
```

在 `warn` 模式下，提示照常放行，Claude 会在回复开头用一行话说明缓存已经过期、这一轮被按全价重发计费，并提示离开一小时以上后更省钱的做法是 `/clear` → `/s-continue`。这条消息真的能送达远程客户端，因为即便钩子消息送不到，Claude 的回复也会被转发。

在 `block` 模式下，提示会被拒绝一次，并显示下面这条消息。再次发送即可通过。想要硬性拦截时，在本地终端里使用它。

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

拦截消息会根据你的操作系统语言环境自动以 23 种语言显示，每次闲置期只触发一次。

**后台代理永远不会被拦截。** 只有人工直接输入的提示才会触发这项检查。后台代理和任务的完成报告——如今动辄在启动一个多小时后才送达——会直接放行，因此长时间运行的代理结果永远不会被卡住或丢失。

**结果：** 在警告模式下，你始终知道 $9 的重发何时发生、为什么发生。在拦截模式下，它根本不会发生：每拦截一次过期就省下 $9，每天拦截一次，一个月就能消除 $270 的纯浪费。

> **如果你是 API 按量付费用户，影响更大。** Max Plan 用户损失的 $9 是在 $200 的预算缓冲之内；而你损失的是真金白银的 $9——悄无声息地，每次离开都如此。Token Guardian 的拦截模式能每次都挡下它。

---

## 💡 缓存的实际运作原理（以及为什么大多数用户浪费了 40% 以上）

Claude Code 在每次 API 调用时将整个对话历史发送给模型。"API 调用"不等于"你输入的一条消息"。一个提示会触发内部工具调用——Grep、Read、Edit、Write——每次都是单独的 API 调用。一个提示轻易就能触发 10 次以上 API 调用。

提示缓存能将这个成本降低 90%。但缓存有寿命。

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| 缓存 TTL           | 1 小时 (ephemeral_1h)                 | 5 分钟                                  |
| 缓存写入         | ＄10/MTok                              | ＄6.25/MTok                             |
| 缓存读取          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| 缓存过期时  | 整个上下文以全价重发    | 影响小（上下文较小）          |

即使缓存有效，成本也在累积。下面是一个极端场景，展示差异。

### 场景：全天写代码（上午 3 小时 → 午饭/会议 2 小时 → 下午 3 小时）

条件：Opus 4 定价，每分钟一个提示，每个提示约 5 次 API 调用（约 300 次/小时）。

#### ❌ 没有 super-token-saver

大多数工作在 Main session 中完成。上下文快速增长。

| 阶段       | 情况                         | 上下文大小               | 成本                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| 上午 3 小时  | 写代码（主要在 Main session 中）           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0.50/M = ＄157.50  |
| 午饭/会议   | 离开 2 小时                  | —                          | —                                      |
| 返回      | 缓存过期 → 全量重发      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| 返回      | /compact（摘要）              | 600K → sent to LLM        | 600K × ＄0.50/M + summary output = ~＄1.50 |
| 下午 3 小时 | 继续写代码（上下文重新增长） | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0.50/M = ＄157.50  |
|             | 合计                             |                            | ~＄326                                  |

> 在这个使用量级别下，你很可能会触发 5 小时窗口速率限制。**成本固然糟糕，但真正的问题是你的工作完全停止。这就是 Claude Code 变成黑屏的那一刻。**

#### ✅ 有 super-token-saver

繁重工作委托给 SubTask，Main 只处理设计/决策。

| 阶段       | 情况                                    | 上下文大小                | 成本                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| 上午 3 小时  | 写代码（Main：设计，SubTask：实现） | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
| 午饭/会议   | 离开 2 小时                             | —                           | —                                  |
| 返回      | ⚡ Token Guardian（拦截模式）→ /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| 下午 3 小时 | 继续写代码                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
|             | 合计                                        |                             | ~＄180                              |

#### 💰 结果

> **＄326 → ＄180。每天节省 ＄146。成本降低 45%。**
>
> **Max Plan：** 更少的 token = 不触发速率限制 = 工作不停止。这才是真正的差别。
>
> **API 按量付费：** ＄146/天 × 22 个工作日 = **每月账单直接减少 ＄3,200。** 没有这个插件的繁重月份超过 ＄7,000。有了它，不到 ＄4,000。同样的产出。

### super-token-saver 的介入点

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

## 🔧 源码安装与定制

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver 完全开源（Apache-2.0）。纯 JavaScript + Bash——无编译二进制文件，无外部 API 调用，无遥测。每一行都可审计。README 中的每项声明都对应一个你可以直接查看的具体文件。

- **hooks/** — 修改缓存过期阈值，自定义警告消息，修改会话架构规则
- **scripts/** — 分析逻辑、报告构建器、状态栏格式化
- **skills/** — /s-continue 和 /usage-view 的工作原理，提示模板
- **locales/** — 添加/编辑翻译，添加新语言
- **skills/usage-view/** — 仪表盘 UI/UX 设计改动

把它变成你自己的。Fork 它，实验它，如果你发现更好的方案，发一个 PR 过来。

---

## 🌐 支持的语言

支持 23 种语言。通过交叉参考 Claude Code 使用量前 20 的地区与全球使用者数量前 20 的语言来选定。显示语言从你的操作系统语言环境自动检测。也可手动指定：`/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 英语    | 🇰🇷 韩语     | 🇯🇵 日语  | 🇨🇳 中文    |
| 🇪🇸 西班牙语    | 🇫🇷 法语     | 🇩🇪 德语    | 🇧🇷 葡萄牙语 |
| 🇮🇹 意大利语    | 🇷🇺 俄语    | 🇸🇦 阿拉伯语    | 🇮🇳 印地语      |
| 🇧🇩 孟加拉语    | 🇮🇩 印度尼西亚语 | 🇲🇾 马来语     | 🇹🇭 泰语       |
| 🇻🇳 越南语 | 🇹🇷 土耳其语    | 🇵🇱 波兰语    | 🇳🇱 荷兰语      |
| 🇮🇱 希伯来语     | 🇸🇪 瑞典语    | 🇳🇴 挪威语 |                 |

当前翻译由 AI 生成。欢迎母语使用者贡献——编辑 `locales/` 中你的语言 JSON 文件并提交 PR。

---

## ⚖️ 这个插件的成本

插件在会话开始时注入上下文。具体数量如下：

| 注入内容 | 时机 | Token 数 | 目的 |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart（一次） | ~1,100 | SubTask 委托策略 + Concise Mode 规则 |
| Git 上下文（如果启用了 git-lite） | SessionStart（一次） | ~280 | 替换 CC 原生约 2,200 token 的 git 指令 |
| 缓存过期警告 | 闲置超过 59 分钟（一次） | ~200 | 标记昂贵的重发，并显示更省钱的路径 |
| Status line | 每次 API 调用 | 0 | 渲染到终端状态栏，不进入对话上下文 |

**每个会话的净开销：约 1,400 token（第一次调用后缓存）。**

以 Opus 定价（$0.50/MTok 缓存读取）计算，这是**每次 API 调用 $0.0007**——不到一分钱的十分之一。100 次调用的会话：$0.07。

如果启用了 git-lite，插件每个会话**节省**约 1,920 token（用 280 替换 2,200）。净效果为负——插件消耗的比它移除的少。

**API 按量付费用户：** 在 $3,000/月的支出下，插件开销不到 $2/月。仅缓存过期预防的节省（每周拦截一次 $9 的重发）一次就能覆盖一年的开销。

---

## 💡 使用技巧

### 理解缓存，就能看清钱的去向

- **1 个提示 ≠ 1 次 API 调用。** 每次 Claude 调用 Grep、Read 或 Edit，整个上下文都会重发。一个提示轻易触发 10 次以上 API 调用。写清晰的提示，减少不必要的工具调用，降低成本。
- **缓存计时器从最后一次 API 调用重置，而不是你最后一个提示。** 持续工作，缓存就不会过期。危险在于离开。Token Guardian 会告诉你缓存何时过期，并在 `block` 模式下拦截一次提示，让你选择：重置上下文，还是照常继续。
- **上下文大小 = 成本乘数。** 同样的 API 调用，20 万 token 和 80 万 token 相差 4 倍。当状态栏 [CTX] 超过 35%（🟡），就是将更多工作委托给 SubTask 的信号。

### 降低成本的习惯

- **保持 CLAUDE.md 精简。** 它在每次 API 调用时加载到系统提示。每一行都有成本。
- **将繁重工作委托给 SubTask。** 代码生成、多文件编辑、测试运行不属于 Main session。SubTask 上下文更小，缓存层更便宜。
- **离开超过 1 小时？** `/clear` → 回来 → `/s-continue`。上下文以 $0 恢复。
- **[5H] 超过 70%（🟡）？** 放慢节奏。切换到轻量级审查任务，或增加 SubTask 委托以减少 Main session 的 API 调用次数。
- **用 `/btw` 处理旁枝问题。** 它不进入对话历史，你的上下文保持精简。

### API 按量付费：最重要的习惯

以上所有规则都适用，另加这些 API 专属优先项：

- **像盯速度表一样盯 [CTX]。** 没有速率限制会阻止你——但上下文超过 50 万 token 意味着每次 API 调用的成本是应有水平的 2-3 倍。`/clear` → `/s-continue` 免费将你的成本乘数重置到基准。
- **每周运行 `/usage-view`。** Max Plan 用户在触发速率限制时会有自然的"心痛"时刻。你没有——成本悄悄攀升。仪表盘是你的早期预警系统。
- **设定心理日预算。** 没有上限的话，$200 的一天可以在不知不觉中发生。状态栏的 RUN 指标让每轮的成本可见。如果一轮超过 $1（🔴），你的上下文太大了。

---

## 📚 文档

- [提示缓存指南](guides/prompt-cache-guide.md) — 为什么你的大部分成本都来自缓存，缓存如何在各提供商（Anthropic、OpenAI、Gemini）间运作，以及如何管理它（[한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 种语言](guides/)）
- [Fable 5.1 vs Opus 5 成本分析](guides/fable-5-1-vs-opus-5-cost-analysis.md) — 同等质量下比 Opus 5 至少便宜 24–38%，基于 2,782 个会话
- [Fable 5.1 vs Opus 5 成本分析 （한국어）](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Opus 4.7 vs 4.6 成本分析](guides/opus-4-7-vs-4-6-cost-analysis.md) — 8,563 次 API 调用的并排成本比较
- [Opus 4.7 vs 4.6 成本分析（한국어）](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## 许可证

Apache-2.0
