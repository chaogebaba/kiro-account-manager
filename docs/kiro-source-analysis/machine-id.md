# Machine ID 生成

文件：`packages/kiro-shared/dist/machine-id-DDyBZGvP.js`

## 实现

使用 `node-machine-id` 库的 `machineIdSync()` 方法：

```javascript
import { machineIdSync } from 'node-machine-id';

function getMachineId() {
  return machineIdSync();
}
```

## 原理

- Windows: 读取注册表 `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography\MachineGuid`
- macOS: 读取 `IOPlatformUUID`
- Linux: 读取 `/etc/machine-id` 或 `/var/lib/dbus/machine-id`

## 我们的实现

`src-tauri/src/commands/machine_guid_cmd.rs` 中使用相同方法读取 Windows MachineGuid。
