# GetUserInfo - 获取用户信息

## 请求

```
POST https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserInfo
Content-Type: application/cbor
smithy-protocol: rpc-v2-cbor
Authorization: Bearer {accessToken}
x-csrf-token: {csrfToken}
```

## 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| origin | string | 是 | KIRO_IDE |

## CBOR Body

```
[0xa1, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]
```
即 `{origin: "KIRO_IDE"}`

## 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| email | string | 用户邮箱 |
| userId | string | 用户ID，格式: d-xxx.xxx-xxx-xxx |
| idp | string | 登录提供商: Google / Github |
| status | string | 账号状态: Active |
| featureFlags | object | 功能开关 |

## 示例响应

```
email: hj6395759@gmail.com
userId: d-9067c98495.24086408-60c1-702b-48a8-ab955c773b71
idp: Google
status: Active
featureFlags: {
  enableBlinkingGhost: true,
  enableCoupons: true
}
```
