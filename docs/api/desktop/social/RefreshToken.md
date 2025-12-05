# RefreshToken (Desktop) - 桌面端刷新 Token

## 说明

这是 Kiro IDE 桌面端使用的 RefreshToken 接口，与网页端接口不同：
- 网页端: `https://app.kiro.dev/service/KiroWebPortalService/operation/RefreshToken` (CBOR)
- 桌面端: `https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken` (JSON)

## 请求

```
POST https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken
Content-Type: application/json
User-Agent: KiroIDE-0.5.35-xxx
```

## 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refreshToken | string | 是 | RefreshToken (aor开头) |

## 请求示例

```json
{
  "refreshToken": "aorAAAAAGmihg8MyR9aIZ45rmQkYl4WudaPyg--zhLJ4nGZxQ01oXNsdY_xuZytcS0RFerV4fpwWyFLnjJIPdJNkcBkc0:MGUCMQCN9wGo5+0S1Q3zeTsTSf+nfKOtOusdquQOOgeCyI74UyVXBubcEW8bi08gpRw+x7wCMC6Vlg/G/7E0R7jvsOFzIa7/Iu5OAazaVIRUveb6CiWPLgO7pZH2HKgueurTKdiCcQ"
}
```

## 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 新的访问令牌 (aoa开头) |
| refreshToken | string | RefreshToken (不变) |
| expiresIn | number | 过期时间(秒)，3600 |
| profileArn | string | AWS Profile ARN |

## 响应示例

```json
{
  "accessToken": "aoaAAAAAGksktkS8fI-Y6vkULFiGG5W2HBIO19dVcCITFaz4h4SlUIPey6aKEUZdNqO1BPxt2mSzg9OCPLk2CXR3IBkc0:MGUCMHhWGJkKb4RYukKU8eI7SN3EJsODUTneVrExN/X7QZYERRe31u5U5cEwWNe9RODyxAIxAKy4RegTsHf3YaFzRRR0u2LM6Wm52JqHzEV70q+w9OkUvnFfVgkPYo4j3j9IcvNGWg",
  "expiresIn": 3600,
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "refreshToken": "aorAAAAAGmihg8MyR9aIZ45rmQkYl4WudaPyg--zhLJ4nGZxQ01oXNsdY_xuZytcS0RFerV4fpwWyFLnjJIPdJNkcBkc0:MGUCMQCN9wGo5+0S1Q3zeTsTSf+nfKOtOusdquQOOgeCyI74UyVXBubcEW8bi08gpRw+x7wCMC6Vlg/G/7E0R7jvsOFzIa7/Iu5OAazaVIRUveb6CiWPLgO7pZH2HKgueurTKdiCcQ"
}
```

## 优势

相比网页端接口：
1. **不需要 csrfToken** - 只需要 refreshToken
2. **不需要 AccessToken** - 只需要 refreshToken
3. **JSON 格式** - 不需要 CBOR 编解码
4. **简单直接** - 适合手动添加账号场景
