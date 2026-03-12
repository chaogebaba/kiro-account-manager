# 手动修改 Token 教程

当切换账号后遇到 Token 报错失效时，可以手动修改缓存文件解决。

## 文件位置

Token 缓存文件位于：
```
Windows: C:\Users\你的用户名\.aws\sso\cache\kiro-auth-token.json
macOS/Linux: ~/.aws/sso/cache/kiro-auth-token.json
```

## 操作步骤

### 1. 关闭 Kiro IDE

修改前请先完全关闭 Kiro IDE。

### 2. 打开文件

用记事本或其他文本编辑器打开 `kiro-auth-token.json` 文件。

### 3. 替换内容

将文件内容替换为你要使用的账号 Token。

**Social 账号（Google/GitHub）格式：**
```json
{
  "accessToken": "你的accessToken",
  "authMethod": "social",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/xxx",
  "provider": "Google",
  "refreshToken": "你的refreshToken"
}
```

**IdC 账号（BuilderId）格式：**
```json
{
  "accessToken": "你的accessToken",
  "authMethod": "IdC",
  "clientIdHash": "你的clientIdHash",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "provider": "BuilderId",
  "refreshToken": "你的refreshToken",
  "region": "us-east-1"
}
```

### 4. 保存文件

保存后重新打开 Kiro IDE 即可。

## IdC 账号额外步骤

如果是 BuilderId/Enterprise 账号，还需要修改客户端缓存文件。

**文件位置：** `~/.aws/sso/cache/{clientIdHash}.json`

文件名就是 `kiro-auth-token.json` 里的 `clientIdHash` 值加 `.json`。

**内容格式：**
```json
{
  "clientId": "你的clientId",
  "clientSecret": "你的clientSecret",
  "expiresAt": "2026-04-01T00:00:00.000Z"
}
```

## 常见问题

**Q: 从哪里获取这些 Token 值？**

A: 从 Kiro Account Manager 导出账号，或者从之前备份的文件中复制。

**Q: 修改后还是报错？**

A: 检查 JSON 格式是否正确，特别是引号和逗号。可以用在线 JSON 校验工具检查。

**Q: expiresAt 过期了怎么办？**

A: 只要 refreshToken 有效，Kiro IDE 会自动刷新。可以把 expiresAt 改成未来的时间。

**Q: IdC 账号的 clientIdHash 怎么获取？**

A: 从 Kiro Account Manager 导出的账号数据中包含此字段。
