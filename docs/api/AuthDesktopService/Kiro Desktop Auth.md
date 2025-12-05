# AuthDesktopService (桌面端认证)

Kiro 桌面端使用两套不同的认证系统：

## 目录结构

```
desktop/
├── social/     # Social 登录 (Google/GitHub)
│   ├── login.md           # 打开登录页面
│   ├── create_token.md    # 授权码换 Token
│   ├── refresh_token.md   # 刷新 Token
│   └── get_usage_limits.md # 获取配额
│
└── idc/        # IdC 登录 (BuilderId/Enterprise)
    ├── RegisterClient.md  # 注册 OIDC 客户端
    ├── Authorize.md       # 授权
    ├── CreateToken.md     # 获取 Token
    ├── RefreshToken.md    # 刷新 Token
    └── GetUsageLimits.md  # 获取配额
```

## Social vs IdC 对比

| | Social | IdC |
|---|---|---|
| 登录方式 | Google / GitHub | AWS Builder ID / Enterprise |
| 认证服务 | Desktop Auth API | AWS SSO OIDC |
| 端点 | `prod.us-east-1.auth.desktop.kiro.dev` | `oidc.{region}.amazonaws.com` |
| 需要注册客户端 | ❌ 不需要 | ✅ 需要 |
| 刷新需要 clientId | ❌ 不需要 | ✅ 需要 |
| csrfToken | ❌ 无 | ❌ 无 |
| 兑换奖励码 | ❌ 不支持 (需要 Web Portal) | ❌ 不支持 |

## 配额 API

两种登录方式都使用同一个 CodeWhisperer API 获取配额：

```
GET https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits
```
