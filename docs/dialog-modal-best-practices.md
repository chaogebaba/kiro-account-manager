# Dialog 和 Modal 组件封装最佳实践

基于 Radix UI 和 shadcn/ui 官方文档的研究总结。

## 核心概念

### 1. Radix UI 的 Compound Component Pattern（复合组件模式）

Radix UI 使用复合组件模式，通过 Root 组件提供 Context，所有子组件共享状态。

**官方推荐结构**：
```jsx
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title />
      <Dialog.Description />
      <Dialog.Close />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### 2. 两种封装层次

**基础组件（Primitives）**：
- 直接导出 Radix UI 的原始组件
- 添加样式和主题支持
- 保持最大灵活性
- 用于高级定制场景

**完整组件（Composed）**：
- 封装常见用例
- 提供开箱即用的 API
- 简化使用方式
- 用于快速开发

---

## 当前实现分析

### ✅ 做得好的地方

1. **正确使用 Radix UI Primitives**
   ```jsx
   const DialogRoot = DialogPrimitive.Root
   const DialogTrigger = DialogPrimitive.Trigger
   ```

2. **添加了无障碍支持**
   ```jsx
   <DialogPrimitive.Description className="sr-only">
     弹窗内容
   </DialogPrimitive.Description>
   ```

3. **集成了主题系统**
   ```jsx
   const { colors } = useApp()
   className={cn(colors.card, colors.cardBorder)}
   ```

4. **提供了两种使用方式**
   - 基础组件：`DialogRoot`, `DialogContent`, `DialogHeader` 等
   - 完整组件：`Dialog` 函数组件

### ⚠️ 需要改进的地方

1. **内边距问题**
   - `DialogContent` 有 `p-4`，但 `DialogHeader`、`DialogDescription`、`DialogFooter` 又有 `px-6`
   - 导致内边距叠加，不符合设计规范

2. **DialogDescription 语义错误**
   - 当前用作内容容器：`<DialogDescription>{children}</DialogDescription>`
   - 正确用法：用于描述弹窗目的，应该是文本而非容器

3. **缺少 DialogBody 组件**
   - 没有专门的内容区域组件
   - 导致用户需要手动添加 `px-6 py-4`

4. **完整组件的 children 位置不灵活**
   - 固定放在 `DialogDescription` 中
   - 无法自定义布局

---

## 正确的封装方式

### 方案 1：shadcn/ui 风格（推荐）

**特点**：
- 基础组件不带内边距
- 由使用者控制布局
- 最大灵活性

**实现**：
```jsx
// 基础组件
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50",
          "translate-x-[-50%] translate-y-[-50%]",
          "w-full shadow-2xl rounded-2xl border",
          // ⚠️ 注意：这里不添加 padding
          colors.card,
          colors.cardBorder,
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})

// Header 组件（带内边距）
const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("px-6 pt-6 pb-2", className)}
    {...props}
  />
)

// Body 组件（带内边距）
const DialogBody = ({ className, ...props }) => (
  <div
    className={cn("px-6 py-4", className)}
    {...props}
  />
)

// Footer 组件（带内边距）
const DialogFooter = ({ className, ...props }) => {
  const { colors } = useApp()
  return (
    <div
      className={cn("px-6 py-4 flex justify-end gap-3", colors.dialogFooter, className)}
      {...props}
    />
  )
}

// 使用示例
<DialogRoot open={open} onOpenChange={setOpen}>
  <DialogContent maxWidth="400px">
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
      <DialogDescription>描述文字</DialogDescription>
    </DialogHeader>
    
    <DialogBody>
      {/* 自定义内容 */}
    </DialogBody>
    
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>取消</Button>
      <Button onClick={handleConfirm}>确定</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
```

### 方案 2：Mantine 风格

**特点**：
- 完整组件提供所有功能
- 通过 props 控制行为
- 简化使用

**实现**：
```jsx
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = '400px',
  showClose = true,
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth={maxWidth} showClose={showClose}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        
        {children && (
          <DialogBody>{children}</DialogBody>
        )}
        
        {footer && (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </DialogRoot>
  )
}

// 使用示例
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="标题"
  description="描述"
  footer={
    <>
      <Button onClick={() => setOpen(false)}>取消</Button>
      <Button onClick={handleConfirm}>确定</Button>
    </>
  }
>
  {/* 自定义内容 */}
</Dialog>
```

---

## 推荐的最终方案

结合两种方案的优点：

### 1. 基础组件（用于高级定制）

```jsx
export {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,  // 不带内边距
  DialogHeader,   // 带内边距 px-6 pt-6 pb-2
  DialogTitle,
  DialogDescription,
  DialogBody,     // 带内边距 px-6 py-4（新增）
  DialogFooter,   // 带内边距 px-6 py-4
}
```

### 2. 完整组件（用于快速开发）

```jsx
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = '400px',
  icon: Icon,
  iconColor,
  iconBg,
  showClose = true,
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth={maxWidth} showClose={showClose}>
        {(title || description || Icon) && (
          <DialogHeader>
            {Icon && (
              <div className="flex items-center gap-4 mb-2">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  iconBg || "bg-gradient-to-br from-blue-500/20 to-indigo-500/10"
                )}>
                  <Icon size={24} className={iconColor || "text-blue-400"} />
                </div>
              </div>
            )}
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        
        {children && (
          <DialogBody>{children}</DialogBody>
        )}
        
        {footer && (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
```

### 3. 使用示例

**基础组件（灵活）**：
```jsx
<DialogRoot open={open} onOpenChange={setOpen}>
  <DialogContent maxWidth="600px">
    <DialogHeader>
      <DialogTitle>编辑账号</DialogTitle>
    </DialogHeader>
    
    <DialogBody>
      <form>
        <input ... />
        <textarea ... />
      </form>
    </DialogBody>
    
    <DialogFooter>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        取消
      </Button>
      <Button onClick={handleSave}>
        保存
      </Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
```

**完整组件（快速）**：
```jsx
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="确认删除"
  description="此操作无法撤销，确定要删除吗？"
  icon={AlertTriangle}
  iconColor="text-red-400"
  iconBg="bg-gradient-to-br from-red-500/20 to-rose-500/10"
  footer={
    <>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        取消
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        删除
      </Button>
    </>
  }
/>
```

---

## 关键改进点

### 1. 新增 DialogBody 组件

**原因**：
- 提供专门的内容区域
- 统一内边距 `px-6 py-4`
- 避免用户手动添加样式

**实现**：
```jsx
const DialogBody = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn("px-6 py-4", colors.text, className)}
      {...props}
    />
  )
})
DialogBody.displayName = "DialogBody"
```

### 2. 修正 DialogDescription 用法

**错误用法**：
```jsx
<DialogDescription>{children}</DialogDescription>  // ❌ 作为容器
```

**正确用法**：
```jsx
<DialogDescription>
  此操作无法撤销，确定要删除吗？
</DialogDescription>  // ✅ 作为描述文本
```

### 3. DialogContent 不带内边距

**原因**：
- 让子组件（Header、Body、Footer）控制自己的内边距
- 避免内边距叠加
- 更灵活的布局

**实现**：
```jsx
<DialogPrimitive.Content
  className={cn(
    "fixed left-[50%] top-[50%] z-50",
    "w-full shadow-2xl rounded-2xl border",
    // 不添加 p-4
    colors.card,
    colors.cardBorder
  )}
>
  {children}
</DialogPrimitive.Content>
```

### 4. 完整组件使用 footer prop

**原因**：
- 更灵活的按钮布局
- 支持自定义按钮
- 不限制按钮数量

**对比**：
```jsx
// ❌ 旧方式：固定的按钮
<Dialog
  confirmText="确定"
  cancelText="取消"
  onConfirm={handleConfirm}
/>

// ✅ 新方式：灵活的 footer
<Dialog
  footer={
    <>
      <Button variant="secondary">取消</Button>
      <Button variant="primary">保存</Button>
      <Button variant="danger">删除</Button>
    </>
  }
/>
```

---

## Modal vs Dialog 的区别

根据研究，**Modal 和 Dialog 在 Radix UI 中是同一个组件**。

### 建议

**方案 1：只保留 Dialog**
- 删除 modal.jsx
- 统一使用 dialog.jsx
- 更新所有引用

**方案 2：区分用途**
- **Dialog**：用于确认、提示等简单交互
- **Modal**：用于表单、复杂内容等

但从技术角度，它们是相同的，只是命名不同。

---

## 参考资料

1. [Radix UI Dialog 官方文档](https://www.radix-ui.com/primitives/docs/components/dialog)
2. [shadcn/ui Dialog 实现](https://ui.shadcn.com/docs/components/dialog)
3. [Radix UI Compound Component Pattern](https://www.radix-ui.com/primitives/docs/guides/composition)

---

## 迁移建议

### 步骤 1：更新基础组件

1. 移除 `DialogContent` 的 `p-4`
2. 新增 `DialogBody` 组件
3. 修正 `DialogDescription` 的用法

### 步骤 2：更新完整组件

1. 使用 `footer` prop 替代固定按钮
2. 添加 `DialogBody` 包裹 children
3. 修正 `DialogDescription` 的位置

### 步骤 3：更新现有代码

1. 搜索所有使用 `Dialog` 和 `Modal` 的地方
2. 根据新 API 更新
3. 测试所有弹窗功能

### 步骤 4：统一命名

1. 决定保留 Dialog 还是 Modal
2. 删除重复的组件
3. 更新所有导入语句

---

## 总结

**核心原则**：
1. 基础组件不带内边距，由子组件控制
2. 提供专门的 Body 组件用于内容区域
3. DialogDescription 用于描述文本，不是容器
4. 完整组件使用 footer prop 提供灵活性
5. 遵循 Radix UI 的复合组件模式

**最佳实践**：
- 简单场景用完整组件
- 复杂场景用基础组件
- 保持 API 一致性
- 遵循无障碍规范
