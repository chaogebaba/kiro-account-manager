# Kiro v0.9.2 → v0.10.32 变更对照（基于官网 + 本地源码）

## 结论摘要

本次对照确认：

- `v0.9.2` 是 **Skills / Custom Agents / Hook 扩展 / 企业治理能力** 的关键引入版本。
- `v0.10.x`（当前对齐 `v0.10.32`）是 **Spec 工作流体系化增强** 的关键版本，重点是：
  - Design-First Feature Specs
  - Bugfix Specs（`bugfix.md`）
  - Supervised hunk 级审查
  - Pre/Post Task Execution Hooks
  - MCP Prompts / Resource Templates / Elicitation

## 数据来源

- 官网 Changelog：`https://kiro.dev/changelog/` 及 `ide/0-9`、`ide/0-10` 等页面
- 官网 Blog：`https://kiro.dev/blog/` 及对应文章
- 本地源码：
  - `E:\VSCodeSpace\Kiro\kiro-agent-source-analysis\0.9.2\dist\extension.js`
  - `E:\VSCodeSpace\Kiro\kiro-agent-source-analysis\0.10.32\dist\extension.js`

> 说明：官网部分页面存在 cookie/动态加载限制，本文以已成功抓取并与本地源码可验证内容为准。

## 版本能力对照

### v0.9.2（引入）

- Custom Subagents / Agent Skills / Pre&Post Tool Use Hooks（官网 `ide/0-9`）
- 企业治理：Web tools governance、Custom extension registry
- 本地 `0.9.2/extension.js` 可见：
  - `feature-design-first-workflow`
  - `feature-requirements-first-workflow`
  - `bugfix-workflow`
  - `elicitation/create`
  - `kiro.spec.runAllTasks`

### v0.10.x（增强，当前使用 v0.10.32）

- 官网 `ide/0-10` 明确新增/强化：
  - Design-First Feature Specs
  - Bugfix Specs
  - Hunk-Based Review in Supervised Mode
  - Pre and Post Task Execution Hooks
  - MCP Prompts, Resource Templates, and Elicitation
- 本地 `0.10.32/extension.js` 可见对应标识：
  - `kiro.spec.navigateToBugfix`
  - `supervisedDiff.discussHunk`
  - `kiro.spec.runAllTasks`
  - `feature-design-first-workflow`
  - `feature-requirements-first-workflow`
  - `bugfix-workflow`
  - `elicitation/create`
- 同文件还可见：
  - MCP 路径：`~/.kiro/settings/mcp.json` 与 `<workspace>/.kiro/settings/mcp.json`
  - MCP 合并顺序：user → workspace → powers（后者覆盖前者）
  - Steering `inclusion: auto` 通过 `discloseContext` 按需激活（非关键词匹配）

### Hooks 源码总结（v0.10.32）

- 存储位置：项目工作区下 `.kiro/hooks/*.kiro.hook`。
- 文件格式：JSON；常见结构为 `name` + `when` + `then`，并包含 `enabled/description/version` 等扩展字段。
- 触发端（when.type）：`userTriggered`、`fileEdited`、`promptSubmit`、`agentStop`。
- 执行端（then.type）：`askAgent`、`runShellCommand`。
- 保存行为：保存链路以写入为主，未发现 save-time 的 Hook Schema 阻断校验。
- 读取行为：读取/使用链路会在 JSON 解析后执行结构校验（`HookSchema.safeParse`）；不合法文件在读取阶段报 invalid-data。
- 路径约束：仅处理 hooks 目录目标文件，并对文件路径做安全限制（防止非法路径穿越）。

## 对 Account Manager 文档更新建议

建议采用“版本演进 + 源码证据”写法，避免覆盖式描述：

1. 保留 `v0.9.2 引入`（Skills/Agents/Powers registry-v2）
2. 单列 `v0.10.x 增强`（Spec/Bugfix/Hunk/Task Hooks/MCP 新能力）
3. 所有“版本要求”字段区分：
   - 引入版本（introduced in）
   - 当前验证版本（verified on v0.10.32）

## 当前状态

本仓库已按上述原则更新 README 与开发文档，采用“v0.9.2 → v0.10.32”分层描述。