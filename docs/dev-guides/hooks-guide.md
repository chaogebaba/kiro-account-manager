# Hooks 源码总结（v0.10.32）

## 核心结论

- 存储位置：项目工作区下 `.kiro/hooks/*.kiro.hook`。
- 文件格式：JSON；常见结构为 `name` + `when` + `then`，并包含 `enabled/description/version` 等扩展字段。
- 触发端（when.type）：`userTriggered`、`fileEdited`、`promptSubmit`、`agentStop`。
- 执行端（then.type）：`askAgent`、`runShellCommand`。
- 保存行为：保存链路以写入为主，未发现 save-time 的 Hook Schema 阻断校验。
- 读取行为：读取/使用链路会在 JSON 解析后执行结构校验（`HookSchema.safeParse`）；不合法文件在读取阶段报 invalid-data。
- 路径约束：仅处理 hooks 目录目标文件，并对文件路径做安全限制（防止非法路径穿越）。

## Hook JSON 结构（常见示例）

```json
{
  "enabled": true,
  "name": "release",
  "description": "",
  "version": "1",
  "when": {
    "type": "userTriggered",
    "filePattern": null
  },
  "then": {
    "type": "askAgent",
    "prompt": "请在这里填写执行说明"
  },
  "workspaceFolderName": "",
  "shortName": "release",
  "fileName": "release.kiro.hook"
}
```

## 示例 Hook

- `release.kiro.hook` - 发布流程

## 使用建议

- 机械性任务优先 `runShellCommand`
- 需要理解和判断的任务优先 `askAgent`
- `promptSubmit` 触发要谨慎，避免每次对话都触发
