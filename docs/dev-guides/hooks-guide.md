# Hooks 开发指南

## 存储位置（当前实现）

- 仅支持**项目级 Hooks**：`<project>/.kiro/hooks/*.kiro.hook`
- 后端命令：`get_hooks/get_hook/save_hook/create_hook/delete_hook`

## 触发类型（when.type）

- **userTriggered** - 手动触发（/hook名称）
- **fileEdited** - 文件保存时触发
- **promptSubmit** - 发送消息时触发
- **agentStop** - AI 回复完成后触发

## 动作类型（then.type）

- **askAgent** - AI 执行自然语言指令（需 `prompt`）
- **runShellCommand** - 本地执行命令（需 `command`）

## Hook JSON 结构示例

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

## 读取与保存行为

- 保存：不做 schema 阻断，按文件内容直接写入
- 读取：会做结构校验（invalid-data），无效文件读取失败

## 当前仓库已有 Hook

- `release.kiro.hook` - 发布流程

## 创建建议

- 机械性任务优先 `runShellCommand`
- 需要理解和判断的任务优先 `askAgent`
- `promptSubmit` 触发要谨慎，避免每次对话都触发
