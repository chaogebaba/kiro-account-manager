# Windows 安装包说明

## 安装包格式

从 v1.5.5 开始，Windows 只提供 MSI 安装包，不再提供 EXE (NSIS) 安装包。

## 为什么改用 MSI

之前使用 NSIS (exe) 安装包存在一个问题：用户自定义安装路径（如 D 盘）后，在线更新会安装到默认路径（C 盘），导致系统中出现两份应用。

MSI 安装包由 Windows Installer 服务管理，会在注册表中记录安装路径，在线更新时能自动找到原安装位置，不会出现两份的问题。

## 老用户迁移

如果你之前使用 EXE 安装包安装的应用：

1. 手动卸载旧版本
2. 下载新的 MSI 安装包重新安装
3. 之后的在线更新会自动更新到同一位置

## 技术细节

- MSI 由 WiX 工具生成
- 支持自定义安装路径
- 支持中文、英文、俄语三种安装界面语言
- 在线更新使用 passive 模式（显示进度条，自动完成）

## 配置参考

```json
{
  "bundle": {
    "targets": ["msi", "app", "dmg"],
    "windows": {
      "wix": {
        "language": ["zh-CN", "en-US", "ru-RU"]
      }
    }
  },
  "plugins": {
    "updater": {
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```
