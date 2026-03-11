# 设计：移除 deep link TODO 注释

## 背景
当前 `DeepLinkCallbackWaiter::get_redirect_uri` 使用固定 `kiro://` 协议。
原注释包含“等 Cognito 配置好新协议后再改回来”的 TODO。
该 TODO 已无意义，需移除。

## 目标
- 移除 TODO 注释。
- 不修改任何逻辑与返回值。

## 方案
- 仅删除 TODO 行，保留其余注释与实现。

## 影响范围
- 文件：`src-tauri/src/deep_link_handler.rs`
- 行为影响：无

## 验收标准
- TODO 注释移除且逻辑不变。
- `git diff` 仅包含注释删除。
