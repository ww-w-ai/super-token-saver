# 面向 Codex 的 super-token-saver

[English](./README-CODEX.md) · [한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)

> 上一次会话在冲刺过程中耗尽了预算。它学到的一切都还留在磁盘上——存在一个没有任何工具会替你读取的文件里。

Codex 把每个会话写入 `~/.codex/sessions/`。Claude Code 把每个会话写入 `~/.claude/projects/`。两边互不读取对方的文件。找回上下文的常规办法——让模型总结刚才发生了什么——会在你敲下第一条指令之前就先耗掉一整个上下文窗口。

**这个插件直接读取转写记录(transcript)。** `/s-continue` 通过直接解析 JSONL 来恢复任意一方工具的历史会话:不调用总结、不消耗额外 token。每个恢复出来的对话轮次都带有 `L{n}` 标记,指向原始 rollout 中的确切行号,被截断的内容可以随时按行取出全文。

## 你能获得什么

| 技能 | 使用场景 |
|---|---|
| `s-continue` | 恢复此前的 Claude Code **或** Codex 会话——从列表中选择,或直接跳到最近一次。 |
| `s-compact` | 在清空上下文前写交接记录,保存转写记录留不住的内容:子代理的发现、工具输出中的数字、被放弃的方案。 |

交接文件按项目保存,而不是按工具保存。在 Codex 里结束一个冲刺,再到 Claude Code 里接着做,文件已经在那里等着。反过来回到 Codex 也一样。能同时恢复两个工具历史的插件只有这一个,所以一边的额度用完,就在另一边从同一行接着做。

## 为什么适合 Codex

- **理解 Codex 的压缩机制,而不是忽略它。** 触发了 auto-compact 的 rollout,会从压缩前的内容——也就是模型脑子里已经不再保留的那部分——恢复,而不是重新读一遍它本来就知道的东西。
- **过滤掉子代理的 rollout。** 在 Codex 中,派生出的子代理会直接继承父会话的 `session_id`,导致三个文件可能都声称拥有同一个 id。会话按 `payload.id` 识别,列表里只会出现你亲自输入过的那些。
- **目标控制提示不会冒充你的指令。** `<codex_internal_context source="goal">` 是机器注入的内容;它会保留在恢复出的上下文里,但绝不会被算作你写的一轮对话。
- **一个解析器,服务两个工具。** Codex 的 rollout 会被改写成 Claude Code 所使用的格式,输入的每一行对应输出的一行,于是同一条代码路径可以同时服务两边,行号依旧精确指向你的原始文件。
- **按宿主隔离钩子。** Codex 只注入 Codex 专用的会话指导和压缩恢复，不再运行 Claude Code 的提示缓存、状态栏或 Git 上下文钩子。
- **没有安装步骤。** 只需要 Node——没有 npm 依赖,不用构建。

实测数据:一个 12MB、1,540 行的真实 Codex 会话,预处理耗时 0.13 秒。

## 安装

```
codex plugin marketplace add ww-w-ai/marketplace
codex plugin add super-token-saver@ww-w-ai
```

验证并升级:

```
codex plugin list
codex plugin marketplace upgrade ww-w-ai
```

## 使用

```
/s-continue           列出这个项目在两个工具中的会话,选择要恢复的那一个
/s-continue last      恢复最近一次会话
/s-continue codex     只列出 Codex 会话
/s-continue codex : rust migration      恢复匹配该主题的对话轮次,取全文
/s-compact            为下一个接手的人写交接记录
```

## 压缩之后,不用开口就恢复

宿主自行压缩时,插件的压缩后钩子会在你输入任何内容之前把被裁掉的轮次放回来:你的轮次、模型的回复、
队友消息和子代理通知,一律原文,只省去工具调用。它为每个会话记一份台账,所以一次运行跨越多次压缩,
或跨越同一项目的多个会话时,更早的轮次会以折叠形式在 token 预算内一路带下去。每一行都保留指向原始
rollout 的 `L{n}` 标记。

`/s-continue` 恢复你所选会话的全部轮次;长轮次保留首尾各 24 条回复的存储原样,其余缩短到 50 个字符,
没有任何内容被丢弃。

如果 Codex 状态没有存放在 `~/.codex`,插件会读取 `CODEX_HOME`。

两个宿主上的技能名称完全一致,在一边学会的命令在另一边同样适用。

## 这个插件不做什么

`usage-view` 也能读取 Codex 会话。由于 Codex 订阅按购买的额度计费而非按 token 计费,它显示的是该会话所用额度的换算值,而不是账单金额。`report-limit` 目前仅支持 Claude Code —— Codex 同样会在 rollout 中直接给出速率限制,所以这只是尚未移植,而非做不到。`setup-statusline` 情况不同:Codex 本身已有状态栏,通过 `config.toml` 中的 `status_line` 配置。

## 许可证

Apache-2.0。参见 [LICENSE](./LICENSE)。
