# Kiro IDE v0.9.2 UI 和配置变更分析

## 版本信息
- **旧版本**：v0.8.206
- **新版本**：v0.9.2
- **分析日期**：2026-02-07

---

## 一、UI 组件变更

### 1.1 StatusBarItem（状态栏）

**数量变更**：
- 旧版本：3 个
- 新版本：4 个
- **新增：1 个**

**新版本的 StatusBarItem**：

#### 1. Experiments StatusBarItem（新增）
**位置**：行 817993
```javascript
this.statusBarItem = vscode65.window.createStatusBarItem(
  EXPERIMENTS_ITEM_ID, 
  vscode65.StatusBarAlignment.Right, 
  -999
);
this.statusBarItem.text = EXPERIMENTS_ITEM_TEXT;
this.statusBarItem.tooltip = EXPERIMENTS_ITEM_TOOLTIP;
this.statusBarItem.command = EXPERIMENTS_ITEM_COMMAND;
this.statusBarItem.name = "Kiro Experiments";
```

**功能**：
- 显示实验功能状态
- 点击打开实验功能快速选择器
- 位置：右侧状态栏，优先级 -999

#### 2. Feedback StatusBarItem
**位置**：行 873193
```javascript
const feedbackStatusBarItem = vscode232.window.createStatusBarItem(
  FEEDBACK_ITEM_ID,
  vscode232.StatusBarAlignment.Right,
  -998
);
feedbackStatusBarItem.text = "$(bug) Report issue";
feedbackStatusBarItem.tooltip = `Report a bug or submit feedback to the ${APPLICATION_TITLE} team`;
feedbackStatusBarItem.command = "kiroAgent.fileFeedback";
feedbackStatusBarItem.name = "Feedback Provider";
```

**功能**：
- 报告问题或提交反馈
- 图标：$(bug)
- 位置：右侧状态栏，优先级 -998

#### 3. Usage Meter StatusBarItem
**位置**：行 873268
```javascript
const usageMeterStatusBarItem = vscode233.window.createStatusBarItem(
  USAGE_METER_ITEM_ID,
  vscode233.StatusBarAlignment.Right,
  -999
);
usageMeterStatusBarItem.text = USAGE_METER_ITEM_TEXT;
usageMeterStatusBarItem.tooltip = USAGE_METER_ITEM_TOOLTIP;
usageMeterStatusBarItem.command = USAGE_METER_ITEM_COMMAND;
usageMeterStatusBarItem.name = "Usage Meter";
```

**功能**：
- 显示配额使用情况
- 自动更新（每隔一定时间）
- 显示最后更新时间

#### 4. Tab Autocomplete StatusBarItem
**位置**：行 882251
```javascript
statusBarItem = vscode256.window.createStatusBarItem(
  "kiro.status.autocomplete", 
  vscode256.StatusBarAlignment.Right
);
statusBarItem.text = statusBarItemText(s8);
statusBarItem.tooltip = statusBarItemTooltip(s8 ?? statusBarStatus);
statusBarItem.command = "kiroAgent.openTabAutocompleteConfigMenu";
statusBarItem.name = "Tab Autocomplete";
```

**功能**：
- 显示 Tab 自动补全状态
- 状态：启用/禁用/加载中
- 点击打开配置菜单

### 1.2 QuickPick（快速选择器）

**使用场景**：

1. **Experiments QuickPick**（新增）
   - 行 818023：`showQuickPick()`
   - 功能：切换实验功能开关
   - 占位符：`"Toggle experimental features"`

2. **History QuickPick**
   - 行 591721：历史记录选择
   - 功能：选择历史会话

3. **Model QuickPick**
   - 行 591745：模型选择
   - 功能：选择 AI 模型

4. **Provider QuickPick**
   - 行 595548：提供者选择
   - 功能：选择认证提供者

5. **Custom Power QuickPick**
   - 行 851902：自定义 Power 添加方式
   - 功能：选择添加 Power 的方式

6. **Skill Import Method QuickPick**
   - 行 873562：Skill 导入方式
   - 功能：选择导入 Skill 的方式

7. **Autocomplete Config QuickPick**
   - 行 882827：自动补全配置
   - 功能：配置 Tab 自动补全

### 1.3 InputBox（输入框）

**使用场景**：

1. **Spec Prompt InputBox**
   - 行 838428：Spec 提示输入
   - 功能：输入 Spec 描述

2. **URL InputBox**
   - 行 851857：URL 输入
   - 功能：输入 Power 的 URL

3. **Feature Idea InputBox**
   - 行 869394：功能想法输入
   - 功能：输入功能建议

4. **Rename InputBox**
   - 行 869460：重命名输入
   - 功能：重命名文件或项目

5. **Skill InputBox**（新增）
   - 行 873450：`createInputBox()`
   - 功能：输入 Skill 名称或描述

6. **Filename InputBox**
   - 行 873615：文件名输入
   - 功能：输入文件名

### 1.4 Notification（通知）

**统计**：
- `showInformationMessage`：~50 次
- `showWarningMessage`：~30 次
- `showErrorMessage`：~58 次
- **总计：~138 次**

**常见用途**：
- 操作成功提示
- 警告信息
- 错误信息
- 确认对话框

### 1.5 Progress（进度条）

**使用场景**：
- 行 839956：Onboarding 进度
- 行 840000：配置导入进度
- 行 840968：工作区初始化进度
- 行 842795：工具刷新进度
- 行 894690：其他异步操作进度

**功能**：
- 显示长时间操作的进度
- 支持取消操作
- 显示进度百分比或消息

### 1.6 Output Channel（输出通道）

**新版本的 Output Channel**：

1. **Kiro Logs**
   - 行 123771：`createOutputChannel("Kiro Logs", { log: true })`
   - 功能：主日志通道

2. **Kiro - MCP Logs**
   - 行 123802：`createOutputChannel("Kiro - MCP Logs", { log: true })`
   - 功能：MCP 日志通道

3. **Kiro - Powers**（新增）
   - 行 123842：`createOutputChannel("Kiro - Powers", { log: true })`
   - 功能：Powers 日志通道

4. **Kiro - Chat Webview State Log**
   - 行 590079：`createOutputChannel("Kiro - Chat Webview State Log")`
   - 功能：Chat Webview 状态日志

5. **Kiro - LLM Prompt/Completion**
   - 行 595809：`createOutputChannel("Kiro - LLM Prompt/Completion")`
   - 功能：LLM 提示和补全日志

6. **KiroLLMLogs**
   - 行 596345：`createOutputChannel("KiroLLMLogs", { log: true })`
   - 功能：LLM 详细日志

7. **code-references**
   - 行 684321：`createOutputChannel("code-references")`
   - 功能：代码引用日志

8. **q-client**
   - 行 685449：`createOutputChannel("q-client", { log: true })`
   - 功能：Q 客户端日志

9. **q-chat-api-log**
   - 行 685796：`createOutputChannel("q-chat-api-log")`
   - 功能：Q Chat API 日志

**新增**：
- Kiro - Powers（Powers 日志通道）

---

## 二、package.json 配置变更

### 2.1 版本信息

**版本号**：
- 旧版本：0.1.1
- 新版本：0.1.1
- **无变更**

**引擎版本**：
- VS Code：`^1.94.0`（无变更）
- Node：`^22.20.0`（无变更）

### 2.2 Commands（命令）

**数量变更**：
- 旧版本：~90 个
- 新版本：~89 个
- **减少：1 个**

**新增命令**：
1. `kiro.accountDashboard.showDashboard`
   - 标题：Show Account Dashboard
   - 图标：$(dashboard)
   - 功能：显示账号仪表板

**移除命令**：
- 需要详细对比才能确定具体移除了哪个命令

### 2.3 Keybindings（快捷键）

**主要快捷键**：

1. **Chat 相关**：
   - `Cmd+L` / `Ctrl+L`：聚焦输入框（不创建新会话）
   - `Cmd+Shift+L` / `Ctrl+Shift+L`：聚焦输入框（不清空）

2. **Diff 相关**：
   - `Shift+Cmd+Enter` / `Shift+Ctrl+Enter`：接受 Diff
   - `Shift+Cmd+Backspace` / `Shift+Ctrl+Backspace`：拒绝 Diff
   - `Cmd+Z` / `Ctrl+Z`：拒绝 Diff（当 Diff 可见时）

3. **Vertical Diff**：
   - `Alt+Cmd+Y` / `Alt+Ctrl+Y`：接受垂直 Diff 块
   - `Alt+Cmd+N` / `Alt+Ctrl+N`：拒绝垂直 Diff 块

4. **Inline Chat**：
   - `Cmd+I` / `Ctrl+I`：启动 Inline Chat

5. **Terminal**：
   - `Cmd+Shift+R` / `Ctrl+Shift+R`：调试终端

6. **Autocomplete**：
   - `Cmd+K Cmd+A` / `Ctrl+K Ctrl+A`：切换 Tab 自动补全

7. **Spec 相关**（新增）：
   - `Cmd+Shift+Enter` / `Ctrl+Shift+Enter`：刷新 Requirements/Design/Plan 文件
   - `Cmd+Alt+Enter` / `Ctrl+Alt+Enter`：运行所有任务

### 2.4 Views（视图）

**Activity Bar 视图容器**：

1. **continue**
   - 标题：Chat
   - 图标：（空）

2. **kiro**
   - 标题：Kiro
   - 图标：`./packages/kiricons/src/kiro.svg`

3. **powers**（新增）
   - 标题：Powers
   - 图标：`$(powers)`

**Kiro 视图容器中的视图**：

1. `kiro.views.emptyWorkspace`
   - 名称：（空）
   - 条件：工作区为空

2. `kiro.views.specExplorer`
   - 名称：Specs
   - 条件：工作区不为空

3. `kiroAgent.views.hooksStatus`
   - 名称：Hooks
   - 条件：工作区不为空

4. `kiroAgent.views.steeringExplorer`
   - 名称：Steering
   - 条件：工作区不为空

5. `kiroAgent.views.mcpServerStatus`
   - 名称：MCP Server Status
   - 条件：工作区不为空

**Powers 视图容器中的视图**（新增）：

1. `kiro.views.installedPowersList`
   - 名称：Installed Powers
   - 类型：Webview

2. `kiro.views.recommendedPowersList`
   - 名称：Recommended Powers
   - 类型：Webview

### 2.5 Menus（菜单）

**新增菜单项**：

1. **spec/editor/navbar**（新增）
   - 导航到 Requirements
   - 导航到 Design
   - 导航到 Tasks

2. **steering/toolbar**（新增）
   - 优化 Steering 文件

3. **spec/editor/toolbar**（新增）
   - 刷新 Requirements 文件
   - 刷新 Design 文件
   - 刷新 Plan 文件
   - 运行所有任务

4. **mcp/config/toolbar**（新增）
   - 打开工作区 MCP 配置
   - 打开用户 MCP 配置

5. **scm/inputBox**（新增）
   - 生成提交消息

### 2.6 Custom Editors（自定义编辑器）

**新增**：
- `testSpecification.editor`
  - 显示名称：Test Specification Editor
  - 文件模式：`*`（所有文件）
  - 优先级：option

### 2.7 Activation Events（激活事件）

**新增激活事件**：
- `onFileSystem:kiro-spec`
- `onView:kiroAgent.hooksView`
- `onCommand:kiroAgent.onboarding.checkSteps`
- `onCommand:kiroAgent.onboarding.checkStep`
- `onCommand:kiroAgent.onboarding.executeStep`
- `onCommand:kiroAgent.configuration.startOnboarding`
- `onCommand:kiroAgent.configuration.completeOnboarding`
- `onCommand:kiroAgent.viewHome`
- `onCommand:kiroAgent.viewLetsBuild`
- `onCommand:kiroAgent.executions.getExecutionHistory`

---

## 三、主题和样式变更

### 3.1 Semantic Token Types（新增）

**新增语义 Token 类型**：

1. `contextProvider`
   - 超类型：namespace
   - 描述：Context provider type

2. `pathSegment`
   - 超类型：parameter
   - 描述：Path segment in context provider

3. `delimiter`
   - 超类型：operator
   - 描述：Delimiter in context provider syntax

### 3.2 Semantic Token Scopes（新增）

**Markdown 语言的语义作用域**：
```json
{
  "language": "markdown",
  "scopes": {
    "contextProvider": ["entity.name.class.context-provider"],
    "pathSegment": ["variable.parameter.context-provider"],
    "delimiter": ["punctuation.separator.context-provider"]
  }
}
```

**功能**：
- 为 Markdown 中的 Context Provider 语法提供语法高亮
- 支持路径段和分隔符的高亮

### 3.3 Configuration Defaults（新增）

**Markdown 配置默认值**：
```json
{
  "[markdown]": {
    "editor.semanticHighlighting.enabled": true
  }
}
```

**功能**：
- 为 Markdown 文件启用语义高亮
- 支持 Context Provider 语法高亮

---

## 四、国际化变更

### 4.1 L10n 支持

**配置**：
```json
"l10n": "./l10n"
```

**功能**：
- 支持多语言
- 语言包位置：`./l10n` 目录

### 4.2 国际化字符串

**使用方式**：
- 命令标题：`%KiroAgent.command.xxx%`
- 视图名称：`%KiroAgent.views.xxx%`
- 菜单项：`%Kiro.xxx%`

**示例**：
- `%KiroAgent.title%` → "Kiro Agent"
- `%KiroAgent.command.inlineChat.start%` → "Start Inline Chat"
- `%Kiro.spec.navigateToRequirements%` → "Navigate to Requirements"

---

## 五、性能优化

### 5.1 Size Limit（包大小限制）

**配置**：
```json
"size-limit": [
  {
    "name": "Extension bundle",
    "path": "dist/extension.js",
    "limit": "6.5 MB"
  }
]
```

**功能**：
- 限制扩展包大小不超过 6.5 MB
- 防止包体积过大影响性能

### 5.2 Lint Staged（代码检查）

**配置**：
```json
"lint-staged": {
  "*.{js,ts,jsx,tsx,mjs}": [
    "prettier --write",
    "eslint --cache --fix"
  ],
  "*.{json,yml,md}": "prettier --write"
}
```

**功能**：
- 提交前自动格式化代码
- 自动修复 ESLint 错误
- 使用缓存提升性能

---

## 六、依赖库版本

### 6.1 Overrides（依赖覆盖）

**配置**：
```json
"overrides": {
  "@types/react": "^19.2.7",
  "@types/react-dom": "^19.2.3",
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "whatwg-url": "^14.0.0",
  "rollup": "^4.57.1",
  "vite": "^7.3.1"
}
```

**变更**：
- React 升级到 v19.2.3
- Vite 升级到 v7.3.1
- Rollup 升级到 v4.57.1

---

## 七、总结

### 7.1 主要变更

1. **UI 组件**：
   - 新增 Experiments StatusBarItem
   - 新增 Kiro - Powers Output Channel
   - 新增多个 QuickPick 和 InputBox

2. **配置**：
   - 新增 Powers 视图容器
   - 新增 Spec 编辑器工具栏
   - 新增 Steering 工具栏
   - 新增 MCP 配置工具栏

3. **主题**：
   - 新增语义 Token 类型
   - 新增 Markdown 语义高亮

4. **国际化**：
   - 支持 L10n
   - 所有 UI 文本支持国际化

5. **性能**：
   - 限制包大小
   - 优化代码检查流程

### 7.2 影响评估

**高影响**：
- Powers 视图容器（全新功能）
- Experiments StatusBarItem（实验功能管理）
- Spec 编辑器工具栏（Spec 模式增强）

**中影响**：
- 语义高亮（Markdown 体验改进）
- 国际化支持（多语言支持）
- 依赖库升级（React 19, Vite 7）

**低影响**：
- Output Channel 增加（日志管理）
- 菜单项调整（用户体验优化）

---

## 八、相关文档

1. **Kiro-v0.9.2-Tools-Comparison.md** - 工具对比
2. **Kiro-v0.9.2-Complete-Code-Analysis.md** - 完整代码分析
3. **Kiro-v0.9.2-Module-Deep-Dive.md** - 模块深度分析
4. **Kiro-v0.9.2-Final-Summary.md** - 最终总结

---

## 九、更新记录

- 2026-02-07：创建 UI 和配置变更分析文档
