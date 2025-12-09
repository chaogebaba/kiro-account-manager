---
inclusion: always
---

# UI 样式规范

## 表单元素

### 下拉框 (select)
使用 ThemeContext 提供的 colors 变量，确保所有主题下样式一致：

```jsx
<select
  className={`px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
>
  <option value="xxx">选项</option>
</select>
```

**禁止**：
- ❌ 不要用 `bg-white/5` 或 `border-white/10` 这类硬编码
- ❌ 不要用 `style={{ backgroundColor: ... }}` 内联样式
- ❌ 不要给 `<option>` 单独设置样式（浏览器不支持）

**正确做法**：
- ✅ 使用 `${colors.input}` 设置背景和边框
- ✅ 使用 `${colors.inputFocus}` 设置聚焦样式
- ✅ 使用 `${colors.text}` 设置文字颜色

### 输入框 (input)
```jsx
<input
  className={`px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
/>
```

### 文本域 (textarea)
```jsx
<textarea
  className={`p-4 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 resize-none`}
/>
```

## ThemeContext colors 参考

| 变量 | 用途 |
|------|------|
| `colors.text` | 主文字颜色 |
| `colors.textMuted` | 次要文字颜色 |
| `colors.input` | 输入框背景+边框 |
| `colors.inputFocus` | 输入框聚焦样式 |
| `colors.card` | 卡片背景 |
| `colors.cardBorder` | 卡片边框 |
