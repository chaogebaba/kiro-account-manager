# Hooks 开发指南

## 触发类型

- **userTriggered** - 手动触发（/hook名称）
- **fileEdited** - 文件保存时触发
- **promptSubmit** - 发送消息时触发
- **agentStop** - AI 回复完成后触发

## 动作类型

- **askAgent** - AI 执行自然语言指令（消耗额度）
- **runShellCommand** - 本地执行命令（不消耗额度）

## 项目现有 Hooks

- `/release` - 发布新版本流程
- `/sync-translations` - 同步翻译文件
- `/tauri-context` - 注入 Tauri 开发上下文
- `rust-check` - Rust 文件保存时自动 cargo check
- `commit-summary` - 任务完成后生成总结

## 创建建议

- 机械性任务用 Shell Command
- 需要理解和判断的用 Agent Prompt
- promptSubmit 触发要谨慎，避免每次都执行
