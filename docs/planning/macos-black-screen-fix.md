# macOS 黑屏问题修复方案

## 问题描述

**Issue**: #21  
**版本**: v1.7.3  
**系统**: macOS 15.6.1 (Apple M2)  
**现象**: 应用打开后显示黑屏，无法看到任何内容

## 根本原因

### 1. 缺少默认背景色

**问题代码**（`src/index.css`）：
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  transition: background-color 0.3s ease;
  /* ❌ 没有设置 background-color */
}
```

**影响**：
- 如果主题初始化失败或延迟，body 背景是透明的
- macOS 系统默认透明背景显示为黑色
- 用户看到黑屏

### 2. 主题初始化时机

**当前流程**：
1. React 应用启动
2. ThemeContext 初始化（从 localStorage 读取主题）
3. 应用主题到 body
4. 显示窗口（100ms 延迟）

**问题**：
- 如果 localStorage 读取失败 → 主题未应用
- 如果 ThemeContext 初始化慢 → 短暂黑屏
- macOS 对这种情况更敏感（Windows 默认白色背景）

## 解决方案

### 方案 1：添加默认背景色（推荐）

**修改 `src/index.css`**：
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  transition: background-color 0.3s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  
  /* ✅ 添加默认背景色（浅色主题） */
  background-color: #f5f5f5;
}
```

**优点**：
- 简单直接
- 即使主题初始化失败也有合理的默认值
- 兼容所有平台

**缺点**：
- 深色主题用户会看到短暂的白色闪烁

### 方案 2：预加载主题（最佳）

**修改 `index.html`**：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kiro Account Manager</title>
  
  <!-- ✅ 预加载主题，避免闪烁 -->
  <script>
    // 在 React 加载前读取主题
    (function() {
      try {
        const theme = localStorage.getItem('theme') || 'light'
        const colors = {
          light: '#f5f5f5',
          dark: '#0f0f0f',
          purple: '#1a0f2e',
          green: '#0f1f0f'
        }
        document.body.style.backgroundColor = colors[theme] || colors.light
      } catch (e) {
        // localStorage 失败，使用默认浅色
        document.body.style.backgroundColor = '#f5f5f5'
      }
    })()
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**优点**：
- 无闪烁
- 支持所有主题
- 在 React 加载前就应用背景色

**缺点**：
- 需要维护两份颜色定义（index.html 和 ThemeContext）

### 方案 3：延长窗口显示延迟

**修改 `src/main.jsx`**：
```javascript
// 页面加载完成后显示窗口
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    getCurrentWindow().show()
  }, 300) // ✅ 从 100ms 增加到 300ms
})
```

**优点**：
- 确保主题完全应用后再显示窗口

**缺点**：
- 启动速度变慢
- 治标不治本（如果主题初始化失败仍然黑屏）

## 推荐方案

**组合方案**：方案 1 + 方案 2

1. **添加默认背景色**（兜底）
2. **预加载主题**（优化体验）

### 实现步骤

#### 步骤 1：修改 `src/index.css`

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  transition: background-color 0.3s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  
  /* 默认背景色（兜底） */
  background-color: #f5f5f5;
}
```

#### 步骤 2：修改 `index.html`

在 `<head>` 中添加预加载脚本：

```html
<script>
  // 预加载主题，避免闪烁
  (function() {
    try {
      const theme = localStorage.getItem('theme') || 'light'
      const colors = {
        light: '#f5f5f5',
        dark: '#0f0f0f',
        purple: '#1a0f2e',
        green: '#0f1f0f'
      }
      document.body.style.backgroundColor = colors[theme] || colors.light
    } catch (e) {
      // localStorage 失败，使用默认浅色
      document.body.style.backgroundColor = '#f5f5f5'
    }
  })()
</script>
```

#### 步骤 3：验证修复

**测试场景**：
1. ✅ 首次启动（无 localStorage）
2. ✅ 浅色主题启动
3. ✅ 深色主题启动
4. ✅ 紫色主题启动
5. ✅ 绿色主题启动
6. ✅ localStorage 损坏
7. ✅ macOS 系统（M1/M2）
8. ✅ Windows 系统
9. ✅ 主题切换无闪烁

## 其他可能原因

### 1. Vite 构建问题

**检查**：
```bash
npm run build
# 检查 dist/ 目录是否正常生成
```

**症状**：
- CSS 文件缺失
- JS 文件加载失败

**解决**：
- 清理缓存：`rm -rf dist node_modules/.vite`
- 重新构建：`npm install && npm run build`

### 2. Tauri WebView 问题

**检查**：
- 打开开发者工具（macOS: Cmd+Option+I）
- 查看 Console 是否有错误

**常见错误**：
- `Failed to load resource`
- `Uncaught ReferenceError`
- `SyntaxError`

**解决**：
- 更新 Tauri 依赖
- 检查 tauri.conf.json 配置

### 3. macOS 权限问题

**检查**：
- 系统偏好设置 → 安全性与隐私
- 是否允许应用运行

**解决**：
- 右键应用 → 打开
- 或：`xattr -cr /Applications/KiroAccountManager.app`

## 测试计划

### 单元测试

**测试主题预加载脚本**：
```javascript
describe('Theme Preload', () => {
  it('should apply light theme by default', () => {
    // 模拟无 localStorage
    expect(document.body.style.backgroundColor).toBe('#f5f5f5')
  })
  
  it('should apply saved theme', () => {
    localStorage.setItem('theme', 'dark')
    // 重新加载
    expect(document.body.style.backgroundColor).toBe('#0f0f0f')
  })
})
```

### 集成测试

**测试场景**：
1. 全新安装（无配置）
2. 从 v1.7.1 升级
3. 从 v1.7.2 升级
4. 清除所有数据后启动

### 平台测试

**测试平台**：
- macOS 15.x (M1/M2)
- macOS 14.x (Intel)
- Windows 11
- Windows 10

## 发布计划

### v1.7.5 修复版本

**修复内容**：
1. 添加默认背景色
2. 预加载主题脚本
3. 优化窗口显示时机

**Release Notes**：
```markdown
## v1.7.5

### 🐛 Bug 修复

- 修复 macOS 打开黑屏问题 (#21)
  - 添加默认背景色，避免透明背景显示为黑色
  - 预加载主题，消除启动时的闪烁
  - 优化窗口显示时机

### 🔧 优化

- 改善应用启动体验
- 提升主题切换流畅度
```

## 参考资料

- [Tauri Window API](https://tauri.app/v1/api/js/window/)
- [Tauri macOS Issues](https://github.com/tauri-apps/tauri/issues?q=is%3Aissue+macos+black+screen)
- [React 主题最佳实践](https://react.dev/learn/preserving-and-resetting-state)

## 更新记录

- 2026-01-26: 创建文档，分析问题并提出解决方案
