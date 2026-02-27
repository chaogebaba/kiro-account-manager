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

### Hooks 文件校验时机（v0.10.32 源码验证）

- 保存路径：未发现 save-time 的 Hook Schema 阻断校验，内容会直接写入 `.kiro/hooks/*.kiro.hook`。
- 读取/使用路径：会在 JSON 解析后进行结构校验（`HookSchema.safeParse`），不合法内容在读取阶段报错。
- 结论：官方行为是“保存不拦截、读取时校验”。

## 对 Account Manager 文档更新建议

建议采用“版本演进”写法，避免覆盖式描述：

1. 保留 `v0.9.2 引入`（Skills/Agents/Powers registry-v2）
2. 单列 `v0.10.x 增强`（Spec/Bugfix/Hunk/Task Hooks/MCP 新能力）
3. 所有“版本要求”字段区分：
   - 引入版本（introduced in）
   - 当前验证版本（verified on v0.10.32）

## 当前状态

本仓库已按上述原则更新 README 与开发文档，采用“v0.9.2 → v0.10.32”分层描述。