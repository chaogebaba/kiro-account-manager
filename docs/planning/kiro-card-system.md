# Kiro 发卡系统规划

## 项目概述

基于 Web 的 Kiro 账号自动发卡系统，支持账号导入、自动提取、状态检测、交易记录等功能。

## 技术栈

### 后端
- **框架**: Rust + Axum（高性能 Web 框架）
- **数据库**: SQLite（开发）/ PostgreSQL（生产）
- **认证**: JWT + API Key
- **定时任务**: tokio::time（自动检测账号状态）

### 前端
- **框架**: React 18 + Vite
- **样式**: Tailwind CSS v4
- **UI 组件**: Headless UI + 自定义组件
- **状态管理**: React Context + Hooks
- **HTTP 客户端**: Fetch API

### 部署
- **后端**: Railway / Fly.io / VPS
- **前端**: Vercel / Netlify
- **数据库**: Railway PostgreSQL / Supabase

## 核心功能

### 1. 账号管理
- ✅ 批量导入账号（JSON 格式）
- ✅ 账号列表展示（邮箱、提供商、状态、配额）
- ✅ 账号状态管理（可售、已售、已封禁）
- ✅ 账号搜索和筛选

### 2. 提取功能（核心）
- ✅ 按提供商提取（Google/GitHub/BuilderId/Enterprise）
- ✅ 自动标记已售出
- ✅ 返回完整账号 JSON
- ✅ 支持多种交付方式：
  - JSON 字符串（直接显示）
  - 下载为文件
  - 复制到剪贴板
  - 加密分享链接

### 3. 自动检测
- ✅ 定时检测账号状态（是否被封禁）
- ✅ 自动刷新配额信息
- ✅ 检测 Token 是否过期

### 4. 统计面板
- ✅ 总账号数
- ✅ 可售账号数
- ✅ 已封禁数
- ✅ 已售出数
- ✅ 按提供商分类统计

### 5. 交易记录
- ✅ 提取记录（时间、账号、用户）
- ✅ 导入记录
- ✅ 检测记录
- ✅ 日志导出

### 6. API 接口
- ✅ RESTful API
- ✅ API Key 认证
- ✅ 频率限制
- ✅ IP 白名单

## 数据库设计

### accounts 表
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    provider TEXT NOT NULL,  -- Google/GitHub/BuilderId/Enterprise
    auth_method TEXT NOT NULL,  -- Social/Idc
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    user_id TEXT,
    quota_total INTEGER,
    quota_used INTEGER,
    quota_remaining INTEGER,
    subscription_type TEXT,
    status TEXT DEFAULT 'available',  -- available/sold/banned
    sold_to TEXT,
    sold_at TIMESTAMP,
    last_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_provider ON accounts(provider);
CREATE INDEX idx_accounts_sold_to ON accounts(sold_to);
```

### transactions 表
```sql
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    action TEXT NOT NULL,  -- extract/import/check/ban
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,  -- JSON 格式的额外信息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_action ON transactions(action);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
```

### api_keys 表
```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL,  -- JSON 数组: ["extract", "import", "check"]
    rate_limit INTEGER DEFAULT 60,  -- 每分钟请求次数
    ip_whitelist TEXT,  -- JSON 数组
    enabled BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_enabled ON api_keys(enabled);
```

## API 接口设计

### 1. 提取账号
```
POST /api/v1/extract
Headers:
  Authorization: Bearer <api_key>
Body:
  {
    "provider": "Google",  // 可选
    "userId": "user123",   // 购买者标识
    "quantity": 1
  }
Response:
  {
    "success": true,
    "account": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "test@gmail.com",
      "provider": "Google",
      "accessToken": "ya29.xxx",
      "refreshToken": "1//0xxx",
      "expiresAt": "2026-02-01T12:00:00Z",
      "quotaRemaining": 48766
    },
    "transactionId": "txn_123"
  }
```

### 2. 导入账号
```
POST /api/v1/import
Headers:
  Authorization: Bearer <api_key>
Body:
  {
    "accounts": [
      {
        "email": "test@gmail.com",
        "provider": "Google",
        "accessToken": "ya29.xxx",
        ...
      }
    ]
  }
Response:
  {
    "success": true,
    "imported": 10,
    "failed": 0,
    "errors": []
  }
```

### 3. 检测账号
```
POST /api/v1/check
Headers:
  Authorization: Bearer <api_key>
Body:
  {
    "accountIds": ["id1", "id2"],  // 可选，不传则检测所有
    "force": false  // 是否强制刷新
  }
Response:
  {
    "success": true,
    "checked": 10,
    "banned": 2,
    "updated": 8
  }
```

### 4. 获取统计
```
GET /api/v1/stats
Headers:
  Authorization: Bearer <api_key>
Response:
  {
    "total": 116,
    "available": 74,
    "sold": 5,
    "banned": 35,
    "byProvider": {
      "Google": 50,
      "GitHub": 30,
      "BuilderId": 20,
      "Enterprise": 16
    }
  }
```

### 5. 查询交易记录
```
GET /api/v1/transactions?page=1&limit=20&action=extract
Headers:
  Authorization: Bearer <api_key>
Response:
  {
    "transactions": [
      {
        "id": "txn_123",
        "accountEmail": "test@gmail.com",
        "action": "extract",
        "userId": "user123",
        "createdAt": "2026-01-27T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
```

## 前端界面设计

### 1. 统计面板（首页）
```
┌─────────────────────────────────────────┐
│  Kiro 账号商店管理系统                   │
│  自动检测 · 智能管理                     │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐            │
│  │ 总账号数  │  │ 可售账号  │            │
│  │   116    │  │    74    │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │ 已封禁   │  │ 已售出   │            │
│  │    35    │  │     5    │            │
│  └──────────┘  └──────────┘            │
├─────────────────────────────────────────┤
│  [导入] [提取] [检测] [刷新]            │
│  [设置] [记录] [清空]                   │
└─────────────────────────────────────────┘
```

### 2. 提取弹窗
```
┌─────────────────────────────────────────┐
│  提取账号                                │
├─────────────────────────────────────────┤
│  提供商: [所有 ▼]                       │
│  数量:   [1]                            │
│                                         │
│  [取消]  [确认提取]                     │
└─────────────────────────────────────────┘

提取成功后显示：
┌─────────────────────────────────────────┐
│  提取成功                                │
├─────────────────────────────────────────┤
│  {                                      │
│    "email": "test@gmail.com",          │
│    "provider": "Google",               │
│    "accessToken": "ya29.xxx",          │
│    ...                                 │
│  }                                     │
├─────────────────────────────────────────┤
│  [复制] [下载] [关闭]                   │
└─────────────────────────────────────────┘
```

### 3. 账号列表
```
┌─────────────────────────────────────────┐
│  搜索: [输入邮箱或搜索...]              │
│  状态: [所有状态 ▼]                     │
├─────────────────────────────────────────┤
│  邮箱              提供商  状态  配额   │
│  test@gmail.com   Google  正常  48766  │
│  user@github.com  GitHub  已售  0      │
│  ...                                    │
└─────────────────────────────────────────┘
```

## 安全措施

### 1. API Key 认证
- 每个请求必须携带有效的 API Key
- API Key 支持权限控制（extract/import/check）
- API Key 支持过期时间

### 2. 频率限制
- 默认：每分钟 60 次请求
- 可针对不同 API Key 设置不同限制
- 超过限制返回 429 Too Many Requests

### 3. IP 白名单
- 支持为 API Key 配置 IP 白名单
- 只允许白名单内的 IP 访问

### 4. 数据加密
- 数据库中的 Token 使用 AES-256-GCM 加密
- 传输使用 HTTPS
- API Key 使用 bcrypt 哈希存储

### 5. 日志审计
- 记录所有 API 请求
- 记录所有账号操作
- 支持日志导出和分析

## 自动化任务

### 1. 定时检测
```rust
// 每小时检测一次所有账号
tokio::spawn(async {
    loop {
        check_all_accounts().await;
        tokio::time::sleep(Duration::from_secs(3600)).await;
    }
});
```

### 2. Token 刷新
```rust
// 每 30 分钟刷新即将过期的 Token
tokio::spawn(async {
    loop {
        refresh_expiring_tokens().await;
        tokio::time::sleep(Duration::from_secs(1800)).await;
    }
});
```

### 3. 清理过期数据
```rust
// 每天清理 30 天前的交易记录
tokio::spawn(async {
    loop {
        clean_old_transactions(30).await;
        tokio::time::sleep(Duration::from_secs(86400)).await;
    }
});
```

## 部署方案

### 方案 A：Railway（推荐）
- 后端 + 数据库一键部署
- 自动 HTTPS
- 支持环境变量
- 免费额度：500 小时/月

### 方案 B：Vercel + Supabase
- 前端部署到 Vercel
- 后端使用 Vercel Serverless Functions
- 数据库使用 Supabase PostgreSQL

### 方案 C：VPS 自建
- 使用 Docker Compose
- Nginx 反向代理
- Let's Encrypt SSL 证书

## 开发计划

### Phase 1：基础功能（1-2 周）
- [ ] 数据库设计和初始化
- [ ] 后端 API 框架搭建
- [ ] 账号导入功能
- [ ] 账号提取功能
- [ ] 基础前端界面

### Phase 2：核心功能（1-2 周）
- [ ] API Key 管理
- [ ] 自动检测功能
- [ ] 交易记录
- [ ] 统计面板
- [ ] 搜索和筛选

### Phase 3：优化和部署（1 周）
- [ ] 频率限制
- [ ] IP 白名单
- [ ] 数据加密
- [ ] 日志审计
- [ ] 部署到生产环境

## 项目结构

```
kiro-card-system/
├── backend/                 # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── api/            # API 路由
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑
│   │   ├── db/             # 数据库操作
│   │   └── utils/          # 工具函数
│   ├── Cargo.toml
│   └── .env.example
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml      # Docker 部署
└── README.md
```

## 下一步

需要我开始实现吗？从哪个部分开始？
1. 后端 API 框架
2. 数据库设计
3. 前端界面
4. 完整的 MVP（最小可行产品）
