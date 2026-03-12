# Social 认证提供者

文件：`packages/kiro-shared/dist/social-auth-provider-cN_RAEO7.js`

## 核心类

### SocialAuthProvider

Google/GitHub 登录实现。

```javascript
const REDIRECT_URI = "kiro://kiro.kiroAgent/authenticate-success";

class SocialAuthProvider {
  async login(provider) {
    // 1. 生成 PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = uuid();

    // 2. 打开浏览器登录
    await authClient.login(provider, REDIRECT_URI, codeChallenge, state);

    // 3. 等待 deep link 回调
    const { code } = await waitForCallback(state);

    // 4. 交换 Token
    const tokens = await authClient.createToken(code, codeVerifier, REDIRECT_URI);

    // 5. 保存到本地
    await this.saveTokens(tokens);
  }

  async saveTokens(tokens) {
    const data = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      profileArn: tokens.profileArn,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      authMethod: "social",
      provider: this.provider
    };
    
    // 原子写入
    const tmpPath = tokenPath + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, tokenPath);
  }
}
```

### IDCAuthProvider

BuilderId/Enterprise 登录实现。

```javascript
const BUILDER_ID_START_URL = "https://view.awsapps.com/start";

class IDCAuthProvider {
  // 计算 clientIdHash
  computeClientIdHash(startUrl) {
    const input = JSON.stringify({ startUrl });
    return crypto.createHash("sha1").update(input).digest("hex");
  }

  async login() {
    // 1. 注册客户端
    const clientReg = await ssoClient.registerClient(...);

    // 2. 生成 PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // 3. 构建授权 URL
    const authorizeUrl = `${ssoClient.authorizeUrl}?` + new URLSearchParams({
      response_type: "code",
      client_id: clientReg.clientId,
      redirect_uri: redirectUri,
      scopes: SCOPES.join(","),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    // 4. 打开浏览器
    await openBrowser(authorizeUrl);

    // 5. 等待回调，交换 Token
    const { code } = await waitForCallback();
    const tokens = await ssoClient.createToken(...);

    // 6. 保存 Token 和 Client Registration
    await this.saveTokens(tokens);
    await this.saveClientRegistration(clientReg);
  }

  async saveTokens(tokens) {
    const data = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(...).toISOString(),
      authMethod: "IdC",
      provider: this.provider,
      clientIdHash: this.clientIdHash,
      region: this.region
    };
    // 原子写入...
  }

  async saveClientRegistration(reg) {
    const path = `~/.aws/sso/cache/${this.clientIdHash}.json`;
    const data = {
      clientId: reg.clientId,
      clientSecret: reg.clientSecret,
      expiresAt: new Date(reg.expiresAt - 15 * 60 * 1000).toISOString()  // 提前 15 分钟
    };
    // 原子写入...
  }
}
```

## Token 文件格式

路径：`~/.aws/sso/cache/kiro-auth-token.json`

### Social Token

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "profileArn": "arn:aws:codewhisperer:us-east-1:...",
  "expiresAt": "2025-01-04T12:00:00.000Z",
  "authMethod": "social",
  "provider": "Google"
}
```

### IdC Token

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": "2025-01-04T12:00:00.000Z",
  "authMethod": "IdC",
  "provider": "BuilderId",
  "clientIdHash": "abc123...",
  "region": "us-east-1"
}
```

## Client Registration 文件

路径：`~/.aws/sso/cache/{clientIdHash}.json`

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "expiresAt": "2025-04-04T12:00:00.000Z"
}
```

## 关键点

1. **时间格式**：ISO 8601（`toISOString()`）
2. **原子写入**：先写 `.tmp` 再 rename
3. **clientIdHash**：SHA1(JSON.stringify({ startUrl }))
4. **Client 过期**：提前 15 分钟标记过期

## 我们的实现

- `src-tauri/src/providers/social.rs` - SocialProvider
- `src-tauri/src/providers/idc.rs` - IdcProvider
- `src-tauri/src/kiro.rs` - Token 文件读写
