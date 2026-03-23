# MCP 服务器管理功能规划

## 功能概述

在 Kiro Account Manager 中添加 MCP 服务器配置管理，让用户可以可视化管理 `~/.kiro/settings/mcp.json`（用户级）。

## 目标文件

- **用户级配置路径**: `~/.kiro/settings/mcp.json`
- **Windows**: `C:\Users\<用户名>\.kiro\settings\mcp.json`
- **macOS**: `/Users/<用户名>/.kiro/settings/mcp.json`
- **工作区级配置路径**: `<project>/.kiro/settings/mcp.json`（如存在则可覆盖全局）

## 配置文件结构

```json
{
  "mcpServers": {
    "<服务器名称>": {
      "command": "uvx",           // 启动命令
      "args": ["<包名>"],          // 命令参数
      "env": {},                   // 环境变量
      "disabled": false,           // 是否禁用
      "autoApprove": []            // 自动批准的工具列表
    }
  }
}
```

## 核心功能

### 1. 查看服务器列表
- 列表展示所有已配置的 MCP 服务器
- 显示服务器名称、命令、状态（启用/禁用）
- 显示自动批准的工具数量

### 2. 添加服务器
- 手动输入配置
- 从预设模板快速添加常用服务器

### 3. 编辑服务器
- 修改服务器名称
- 修改启动命令和参数
- 配置环境变量
- 管理自动批准工具列表

### 4. 删除服务器
- 确认后删除服务器配置

### 5. 启用/禁用
- 快速切换 `disabled` 状态
- 无需删除即可临时禁用

### 6. 预设模板
提供常用 MCP 服务器的快速添加模板：

| 名称 | 包名 | 功能 |
|------|------|------|
| fetch | mcp-server-fetch | 网页内容抓取 |
| acetool | acetool | 代码语义搜索 |
| aws-docs | awslabs.aws-documentation-mcp-server@latest | AWS 文档查询 |
| filesystem | @anthropic/mcp-server-filesystem | 文件系统操作 |
| github | @anthropic/mcp-server-github | GitHub API |
| sqlite | @anthropic/mcp-server-sqlite | SQLite 数据库 |

## 技术实现

### 后端 (Rust)

**新增文件:**
```
src-tauri/src/
├── commands/
│   └── mcp_cmd.rs          # MCP 相关 Tauri 命令
└── mcp.rs                  # MCP 配置读写逻辑
```

**Tauri 命令:**
```rust
// 获取 MCP 配置
#[tauri::command]
fn get_mcp_config() -> Result<McpConfig, String>

// 保存/更新服务器配置
#[tauri::command]
fn save_mcp_server(name: String, config: McpServer) -> Result<(), String>

// 删除服务器
#[tauri::command]
fn delete_mcp_server(name: String) -> Result<(), String>

// 启用/禁用服务器
#[tauri::command]
fn toggle_mcp_server(name: String, disabled: bool) -> Result<(), String>
```

**数据结构:**
```rust
#[derive(Serialize, Deserialize)]
struct McpConfig {
    #[serde(rename = "mcpServers")]
    mcp_servers: HashMap<String, McpServer>,
}

#[derive(Serialize, Deserialize)]
struct McpServer {
    command: String,
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    #[serde(default)]
    disabled: bool,
    #[serde(default, rename = "autoApprove")]
    auto_approve: Vec<String>,
}
```

### 前端 (React)

**新增文件:**
```
src/components/
├── MCPManager/
│   ├── index.jsx           # 主容器
│   ├── MCPServerList.jsx   # 服务器列表
│   ├── MCPServerCard.jsx   # 单个服务器卡片
│   ├── AddMCPModal.jsx     # 添加弹窗
│   ├── EditMCPModal.jsx    # 编辑弹窗
│   └── MCPTemplates.js     # 预设模板数据
```

**路由:**
- 在 `App.jsx` 添加 `/mcp` 路由
- 在 `Sidebar.jsx` 添加 "MCP 管理" 菜单项

## UI 设计

### 列表页面
```
┌─────────────────────────────────────────────────────┐
│  MCP 服务器管理                        [+ 添加服务器] │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐    │
│  │ 🟢 fetch                              [开关] │    │
│  │ uvx mcp-server-fetch                        │    │
│  │ 自动批准: 0 个工具                   [编辑] [删除] │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🟢 acetool                            [开关] │    │
│  │ uvx acetool                                 │    │
│  │ 自动批准: 1 个工具                   [编辑] [删除] │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 添加弹窗
```
┌─────────────────────────────────────────┐
│  添加 MCP 服务器                    [X] │
├─────────────────────────────────────────┤
│  快速添加:                              │
│  [fetch] [acetool] [aws-docs] [更多...] │
│                                         │
│  ─────── 或手动配置 ───────             │
│                                         │
│  服务器名称: [________________]         │
│  启动命令:   [uvx_____________]         │
│  参数:       [________________]         │
│  环境变量:   [+ 添加]                   │
│                                         │
│           [取消]  [添加]                │
└─────────────────────────────────────────┘
```

## 实现步骤

### 第一阶段：后端基础
1. 创建 `mcp.rs` - 配置文件读写
2. 创建 `mcp_cmd.rs` - Tauri 命令
3. 在 `main.rs` 注册命令

### 第二阶段：前端基础
1. 创建 `MCPManager` 组件目录
2. 实现服务器列表展示
3. 添加路由和侧边栏入口

### 第三阶段：CRUD 功能
1. 实现添加服务器功能
2. 实现编辑服务器功能
3. 实现删除服务器功能
4. 实现启用/禁用切换

### 第四阶段：增强功能
1. 添加预设模板
2. 环境变量管理
3. 自动批准工具管理

## 注意事项

1. **文件不存在处理**: 如果目标 `mcp.json` 不存在，创建默认空配置
2. **目录创建**: 如果 `~/.kiro/settings/` 或 `<project>/.kiro/settings/` 不存在，需要先创建
3. **JSON 格式化**: 保存时保持 JSON 格式化（缩进 2 空格）
4. **备份**: 修改前可选择性备份原文件
5. **权限**: 确保有读写权限
