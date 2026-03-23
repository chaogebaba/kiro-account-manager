# SSO OIDC 客户端

文件：`packages/kiro-shared/dist/sso-oidc-client-BbOoOoXP.js`

## 核心类

### AuthServiceClient

Social 登录（Google/GitHub）的认证客户端。

```javascript
const AUTH_ENDPOINT = "https://prod.us-east-1.auth.desktop.kiro.dev";

class AuthServiceClient {
  constructor(machineId) {
    this.machineId = machineId;
  }

  // 发起登录
  async login(provider, redirectUri, codeChallenge, state) {
    const url = `${AUTH_ENDPOINT}/login?` + new URLSearchParams({
      provider,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state
    });
    // 打开浏览器
  }

  // 交换 Token
  async createToken(code, codeVerifier, redirectUri) {
    return fetch(`${AUTH_ENDPOINT}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-machine-id": this.machineId
      },
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri })
    });
  }

  // 刷新 Token
  async refreshToken(refreshToken) {
    return fetch(`${AUTH_ENDPOINT}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-machine-id": this.machineId
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  }
}
```

### SSOOIDCClient

IdC 登录（BuilderId/Enterprise）的 SSO 客户端。

```javascript
class SSOOIDCClient {
  constructor(region) {
    this.endpoint = `https://oidc.${region}.amazonaws.com`;
  }

  // 注册客户端
  async registerClient(clientName, scopes, redirectUri) {
    return fetch(`${this.endpoint}/client/register`, {
      method: "POST",
      body: JSON.stringify({
        clientName,
        clientType: "public",
        scopes,
        redirectUris: [redirectUri],
        grantTypes: ["authorization_code", "refresh_token"],
        issuerUrl: startUrl
      })
    });
  }

  // 交换 Token
  async createToken(clientId, clientSecret, code, codeVerifier, redirectUri) {
    return fetch(`${this.endpoint}/token`, {
      method: "POST",
      body: JSON.stringify({
        clientId,
        clientSecret,
        grantType: "authorization_code",
        code,
        codeVerifier,
        redirectUri
      })
    });
  }

  // 刷新 Token
  async refreshToken(clientId, clientSecret, refreshToken) {
    return fetch(`${this.endpoint}/token`, {
      method: "POST",
      body: JSON.stringify({
        clientId,
        clientSecret,
        grantType: "refresh_token",
        refreshToken
      })
    });
  }
}
```

## 关键常量

- Auth Endpoint: `https://prod.us-east-1.auth.desktop.kiro.dev`
- SSO OIDC Endpoint: `https://oidc.{region}.amazonaws.com`
- Scopes: `codewhisperer:completions`, `codewhisperer:analysis`, `codewhisperer:conversations`, `codewhisperer:transformations`, `codewhisperer:taskassist`

## 我们的实现

- `src-tauri/src/kiro_auth_client.rs` - AuthServiceClient
- `src-tauri/src/aws_sso_client.rs` - SSOOIDCClient
