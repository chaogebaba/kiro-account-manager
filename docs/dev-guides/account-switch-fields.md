# 账号切换字段需求文档

本文档详细说明四种账号类型（Google、GitHub、BuilderId、Enterprise）在切换账号时需要的字段。

---

## 目录

1. [Google 账号](#google-账号)
2. [GitHub 账号](#github-账号)
3. [BuilderId 账号](#builderid-账号)
4. [Enterprise 账号](#enterprise-账号)
5. [字段对比](#字段对比)
6. [Kiro IDE 写入格式](#kiro-ide-写入格式)
7. [常见问题](#常见问题)

---

## Google 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "email": "user@gmail.com",
  "label": "我的 Google 账号",
  "refresh_token": "aor_xxx",
  "access_token": "ya29.xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "provider": "Google",
  "auth_method": "social",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/accounts.google.com",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "email": "user@gmail.com",
  "refresh_token": "aor_xxx",
  "provider": "Google",
  "auth_method": "social"
}
```

### 可选字段

```json
{
  "access_token": "ya29.xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/accounts.google.com",
  "machine_id": "uuid-xxx"
}
```

### 不需要的字段

```json
{
  "user_id": null,
  "client_id": null,
  "client_secret": null,
  "client_id_hash": null,
  "start_url": null,
  "region": null
}
```

---

## GitHub 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "email": "user@github.com",
  "label": "我的 GitHub 账号",
  "refresh_token": "aor_xxx",
  "access_token": "gho_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "provider": "GitHub",
  "auth_method": "social",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/token.actions.githubusercontent.com",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "email": "user@github.com",
  "refresh_token": "aor_xxx",
  "provider": "GitHub",
  "auth_method": "social"
}
```

### 可选字段

```json
{
  "access_token": "gho_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/token.actions.githubusercontent.com",
  "machine_id": "uuid-xxx"
}
```

### 不需要的字段

```json
{
  "user_id": null,
  "client_id": null,
  "client_secret": null,
  "client_id_hash": null,
  "start_url": null,
  "region": null
}
```

---

## BuilderId 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "email": "user@example.com",
  "label": "我的 BuilderId 账号",
  "refresh_token": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "access_token": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "expires_at": "2026-01-23T15:55:14.153942900+00:00",
  "provider": "BuilderId",
  "auth_method": "IdC",
  "region": "us-east-1",
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "email": "user@example.com",
  "refresh_token": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "client_id": "xxx",
  "client_secret": "xxx",
  "region": "us-east-1",
  "provider": "BuilderId",
  "auth_method": "IdC"
}
```

### 可选字段

```json
{
  "access_token": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "expires_at": "2026-01-23T15:55:14.153942900+00:00",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "machine_id": "uuid-xxx"
}
```

**说明**：
- `client_id_hash` 可选，如果没有会根据固定的 Start URL（`https://view.awsapps.com/start`）自动计算

### 不需要的字段

```json
{
  "user_id": null,
  "profile_arn": null,
  "start_url": null
}
```

---

## Enterprise 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "user_id": "xxx-xxx-xxx",
  "email": null,
  "label": "我的 Enterprise 账号",
  "refresh_token": "aor_xxx",
  "access_token": "xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "provider": "Enterprise",
  "auth_method": "IdC",
  "region": "ap-southeast-2",
  "start_url": "https://xxx.awsapps.com/start",
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "sha256-xxx",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "user_id": "xxx-xxx-xxx",
  "refresh_token": "aor_xxx",
  "client_id": "xxx",
  "client_secret": "xxx",
  "region": "ap-southeast-2",
  "start_url": "https://xxx.awsapps.com/start",
  "provider": "Enterprise",
  "auth_method": "IdC"
}
```

### 可选字段

```json
{
  "email": null,
  "access_token": "xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "client_id_hash": "sha256-xxx",
  "machine_id": "uuid-xxx"
}
```

**说明**：
- `email` 可选，Enterprise 账号可能没有 email
- `client_id_hash` 可选，如果没有会根据 `start_url` 自动计算

### 不需要的字段

```json
{
  "profile_arn": null
}
```

---

## 字段对比

### 核心字段对比

```json
{
  "Google": {
    "email": "required",
    "user_id": "not_used",
    "refresh_token": "required",
    "provider": "Google",
    "auth_method": "social",
    "client_id": "not_used",
    "client_secret": "not_used",
    "region": "not_used",
    "start_url": "not_used",
    "profile_arn": "optional"
  },
  "GitHub": {
    "email": "required",
    "user_id": "not_used",
    "refresh_token": "required",
    "provider": "GitHub",
    "auth_method": "social",
    "client_id": "not_used",
    "client_secret": "not_used",
    "region": "not_used",
    "start_url": "not_used",
    "profile_arn": "optional"
  },
  "BuilderId": {
    "email": "required",
    "user_id": "not_used",
    "refresh_token": "required",
    "provider": "BuilderId",
    "auth_method": "IdC",
    "client_id": "required",
    "client_secret": "required",
    "region": "required",
    "start_url": "not_used",
    "profile_arn": "not_used"
  },
  "Enterprise": {
    "email": "optional",
    "user_id": "required",
    "refresh_token": "required",
    "provider": "Enterprise",
    "auth_method": "IdC",
    "client_id": "required",
    "client_secret": "required",
    "region": "required",
    "start_url": "required",
    "profile_arn": "not_used"
  }
}
```

---

## Kiro IDE 写入格式

### Google/GitHub（Social）

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

**Google 示例**：
```json
{
  "accessToken": "aoaAAAAAGlzmfwTIFYXBGo6MbK0Uc5tBAK36PSGN_DL9eMqd6wRi4qu7V4Bn_V27QZbGatQDfMcAyC2t5Ol98MWAcBkc0:MGYCMQD83+33KN2qKdRsmoD0HpJrtNQshb3JWn5VV5ga/Bp2TSZ6cpUm0pdP6NDEJlgL4noCMQC734N1hb1zOJ3O4NBm3Cca+t09oPShL0ORDhn91DT3FI4o+RdEpddBXzQvMZWU0Z8",
  "authMethod": "social",
  "expiresAt": "2026-01-23T16:14:04.053082400+00:00",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "provider": "Google",
  "refreshToken": "aorAAAAAGnRHpwTIubdiosK1deXVGirP0_o-tkmWYpyaO3zwx87mR_9LUu6rLPztQ79CFU6uQMbjuGEhosgc3Q5fEBkc0:MGUCMB8i5bq4tu58ByXXj8cCS7sXUFLWzDxuJ8ookvPh95EzBG1c0rqhWLTJhm6iEpb33gIxANE3XFAtK2CGF6N1PtKIhdMMUjNC84c/jcHQH7w3OI/6y/wC9hdT1CH9aGQQzcnIIA"
}
```

**GitHub 示例**：
```json
{
  "accessToken": "aoaAAAAAGlzmVUeI_8gaJNdgtyeBQfoAaIsy9_99WWHw8Y9V1qgs6-_Izr6wnZeQR1zHZOxNp_6FqJJ0QyRcHoeyIBkc0:MGQCMD+An+ZfQCjYd1p/E0yOCqUwEvK9/wTsJBU35MXa4qAecooBcRmqeW5nVoZWiKyWyQIwCbUHK7J4pOCSRACy4Iy57nU/Qn4fYwl6riQMH/lyb4u81VfFFHtQm6G2X4mG65Q8",
  "authMethod": "social",
  "expiresAt": "2026-01-23T16:14:48.790448100+00:00",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "provider": "Github",
  "refreshToken": "aorAAAAAGmrJCoVczruhi7H0sR_nA3vGjTquOXaNdPrpoOCAWXRGm0xSyaI1891eG0Wvh5MmOjaoKhuS9zQgD7-tIBkc0:MGUCMQDJzvBRAoT+o3N30nmQSZlQyI0gA8UgAZADXXyyZ7nMLrcKkgwddD5w/GbcSB682KACMGoVITeiZU6z6Y04dY10iTr1lOX3ywISgc5gLQsYQ6LCIeKZfJ3J2eyTzwNKMkpK9w"
}
```

**关键点**：
- ✅ 字段名使用驼峰格式（`accessToken`、`refreshToken`、`expiresAt`、`profileArn`、`authMethod`）
- ✅ 不需要 `clientId`、`clientSecret`、`clientIdHash`
- ✅ 不需要 `region`（虽然后端可能会添加）
- ✅ 有 `profileArn` 字段

### BuilderId（IdC）

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "authMethod": "IdC",
  "clientIdHash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "expiresAt": "2026-01-23T15:55:14.153942900+00:00",
  "provider": "BuilderId",
  "refreshToken": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "region": "us-east-1"
}
```

**关键点**：
- ✅ 字段名使用驼峰格式（`accessToken`、`refreshToken`、`expiresAt`、`authMethod`、`clientIdHash`）
- ✅ 需要 `clientIdHash`（根据固定 Start URL 计算）
- ✅ 需要 `region`
- ✅ 没有 `profileArn` 字段
- ⚠️ **注意**：没有 `clientId` 和 `clientSecret` 字段（这些字段存储在账号管理器中，不写入 Kiro IDE）

### Enterprise（IdC）

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAAGlzllwmet_r6NCXwX9f47uEl6x8R2IFaES87UoK2C_kt_CTCwhDx793ltv5P7a7D7X7IxML5gxIjZWKykBbg1:MGYCMQDlqT37HBa2RObtq/u9TsuhH8G7d1o6Us8NMmdel7xluASmT3kd59JFdK7xiuroN5wCMQDFaO1gK0ZOtFVNBDV81x/aF4ik4gHvbLSTSyNQP0kkcWt01DitdHzxpOWXucJ7ktI",
  "refreshToken": "aorAAAAAGnnhFcE-lz3fyoGmmOdc99Nsgu9iwWwPgFnjrNdUzYgUgn6BaZdtf3-Gxuu408sZqoLUkpfZRMhsqyUDABbg1:MGUCMQCV3aaHmN5XIL4M5kcFaitYAqiUVJxN2LcM76ecZTPdBtFCabIDkGGzEeoLvBbH1Q8CMDLxoqvL1DeYnZEssM3k4Dds2u/qQud788lI25dLiF0hZ34DprM4Pgpvfxu95gdsCw",
  "expiresAt": "2026-01-23T15:40:14.847Z",
  "clientIdHash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "authMethod": "IdC",
  "provider": "Enterprise",
  "region": "ap-southeast-2"
}
```

**关键点**：
- ✅ 字段名使用驼峰格式（`accessToken`、`refreshToken`、`expiresAt`、`authMethod`、`clientIdHash`）
- ✅ 需要 `clientIdHash`（根据 `start_url` 计算）
- ✅ 需要 `region`（可以是任意 AWS 区域）
- ✅ 没有 `profileArn` 字段
- ⚠️ **注意**：没有 `clientId`、`clientSecret` 和 `startUrl` 字段（这些字段存储在账号管理器中，不写入 Kiro IDE）

---

## 常见问题

### Q1: 为什么 Enterprise 账号可能没有 email？

**A**: Enterprise 账号使用 AWS IAM Identity Center，配额响应中只有 `userId`，没有 `email` 字段。这是 AWS 的设计，不是 bug。

**示例**：
```json
{
  "email": null,
  "user_id": "xxx-xxx-xxx"
}
```

### Q2: 为什么 Kiro IDE 写入的文件中没有 clientId 和 clientSecret？

**A**: `clientId` 和 `clientSecret` 是敏感信息，只存储在账号管理器中（`accounts.json`），不会写入 Kiro IDE 的 Token 文件。Kiro IDE 只需要 `clientIdHash` 来验证身份。

**账号管理器存储**：
```json
{
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

**Kiro IDE 写入**：
```json
{
  "clientIdHash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

### Q3: start_url 在哪里使用？

**A**: `start_url` 只在以下场景使用：
1. **切换账号时**：计算 `clientIdHash`（本地操作）
2. **刷新 token 时**：计算 `clientIdHash`（本地操作）
3. **不参与 API 调用**：刷新 token 的 API 不需要 `start_url` 参数
4. **不写入 Kiro IDE**：`start_url` 只存储在账号管理器中

### Q4: clientIdHash 如何计算？

**A**: 
```rust
fn compute_client_id_hash(start_url: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(start_url.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

**示例**：
```json
{
  "start_url": "https://view.awsapps.com/start",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

### Q5: BuilderId 的 start_url 是什么？

**A**: BuilderId 使用固定的 Start URL：`https://view.awsapps.com/start`

**示例**：
```json
{
  "provider": "BuilderId",
  "start_url": null,
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

### Q6: 为什么字段名是驼峰格式？

**A**: Kiro IDE 使用驼峰格式（`accessToken`、`refreshToken`），而账号管理器使用下划线格式（`access_token`、`refresh_token`）。切换账号时需要转换字段名。

**账号管理器格式**：
```json
{
  "access_token": "xxx",
  "refresh_token": "xxx",
  "expires_at": "xxx"
}
```

**Kiro IDE 格式**：
```json
{
  "accessToken": "xxx",
  "refreshToken": "xxx",
  "expiresAt": "xxx"
}
```

---

## 相关文档

- `docs/dev-guides/account-structure.md` - Account 结构体字段说明
- `docs/api-reference/Kiro Desktop Auth Provider.md` - 认证流程说明
- `src-tauri/src/account.rs` - Account 结构体定义
- `src-tauri/src/kiro.rs` - 切换账号实现

---

## 更新记录

- 2026-01-27: 创建文档，使用 JSON 格式展示字段需求
