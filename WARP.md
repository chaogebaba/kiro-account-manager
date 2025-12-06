# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview

Kiro Token Manager is a cross‑platform desktop app (Windows/macOS) for managing Kiro IDE access tokens: multi‑account login (Google/Github/Builder ID + Web OAuth), quota monitoring, one‑click account switching (including machine ID reset), and syncing IDE settings. The UI is built with React 18 + Vite + TailwindCSS and packaged as a Tauri (Rust) desktop app. See `README.md` for user‑facing feature details and download links.

The `docs/api/desktop` folder documents the underlying Kiro desktop authentication APIs. It distinguishes Social (Google/Github) vs IdC (BuilderId/Enterprise) login flows and shows how both obtain quota info via the CodeWhisperer `getUsageLimits` API.

## Development environment & common commands

Project root is a Vite + Tauri workspace:

- Node side: `package.json`
- Tauri/Rust side: `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`

Install dependencies (Node modules; Rust is managed by `cargo`/Tauri):

- `npm install`

### Run the app in development

- Frontend‑only Vite dev server (browser):
  - `npm run dev`
  - Serves the React app (port 1420, see `vite.config.js`). Useful for quick UI work without the Tauri shell.

- Full desktop app via Tauri (recommended):
  - `npm run tauri dev`
  - Uses the Tauri CLI (from `@tauri-apps/cli`) to run the Rust backend and Vite dev server together, with desktop windows defined in `src-tauri/tauri.conf.json`.

### Build

- Build frontend assets only (Vite):
  - `npm run build`
  - Outputs to `dist/` and is also used by Tauri for bundling (see `tauri.conf.json` `beforeBuildCommand`/`distDir`).

- Build desktop installers (Tauri bundle):
  - `npm run tauri build`
  - Produces platform‑specific installers using the configuration under `src-tauri/tauri.conf.json` (icons, updater endpoints, bundle targets, etc.). This matches the Github Actions workflow in `.github/workflows/release.yml`.

### Preview

- Preview the built web bundle (without Tauri shell):
  - `npm run preview`

### Tests and linting

- There are currently no explicit lint/test scripts in `package.json`, and there are no Rust test modules under `src-tauri/src`. If you add a test or lint setup (e.g. Vitest/Jest/ESLint on the frontend or `#[test]` modules in Rust), also add the corresponding commands here.

## Frontend architecture (React + Vite + Tauri APIs)

### Entry and layout

- `index.html` mounts the app into `#root`.
- `src/main.jsx` sets up the React root, wraps the app in `ThemeProvider`, imports global Tailwind styles (`index.css`), and calls `appWindow.show()` after `DOMContentLoaded` so the Tauri window appears only after the UI is ready.
- `src/App.jsx` is the top‑level application shell:
  - Holds `user`, `loading`, and `activeMenu` state.
  - On mount:
    - Calls `invoke('get_current_user')` to determine login state.
    - Checks `window.location` for `/callback` to route to the OAuth callback view when launched from an external browser flow.
    - Subscribes to the global `login-success` event from the Rust side and, on success, refetches auth state and switches to the token manager.
  - Layout is `Sidebar` (left) + main content (right) with `activeMenu` driving which view is rendered.

### Theming and global UI state

- `src/contexts/ThemeContext.jsx` defines a `ThemeProvider` and the `useTheme` hook:
  - Provides a `theme` key (`light`/`dark`/`purple`/`green`), color tokens (`colors.*`), and the `setTheme` function.
  - Persists theme selection by calling `invoke('get_app_settings')` / `invoke('save_app_settings')`, which read/write `~/.kiro-token-manager/app-settings.json` on the Rust side.
  - Updates `document.body.className` to drive global dark‑mode styles.
- Many components (e.g. `Sidebar`, `Home`, `TokenManager`, `Settings`, `About`, `UpdateChecker`, `Login`, `WebOAuthLogin`) read `colors` from `useTheme()` instead of hard‑coding Tailwind color classes. When adding new UI, prefer these theme tokens so themes remain consistent.

### Main views and how they interact with Tauri

All cross‑process calls use `@tauri-apps/api/tauri.invoke` and `@tauri-apps/api/event.listen`. Command names must match the Rust `#[tauri::command]` functions registered in `src-tauri/src/main.rs`.

- `src/components/Sidebar.jsx`
  - Renders main navigation (`home`, `token`, `login`, `web-oauth`, `settings`, `about`) and the app logo.
  - On mount, calls `invoke('get_kiro_local_token')` to show the currently logged‑in Kiro IDE account and `getVersion()` from `@tauri-apps/api/app` to display the app version.
  - Manages an inline theme switcher, mapping theme keys to human names and icons using `themes` from the theme context.

- `src/components/Home.jsx`
  - Dashboard‑style overview using `get_tokens` (from Rust `token_cmd`) and `get_kiro_local_token` (from Rust `kiro`) to show:
    - Total accounts and active accounts.
    - Aggregate quotas/usage and Pro/Pro+ counts.
  - Clicking "查看全部" navigates to the detailed `TokenManager` view by switching `activeMenu`.

- `src/components/TokenManager.jsx`
  - The core account and quota management table. It is tightly coupled to the Rust `Token` shape in `src-tauri/src/token.rs`.
  - Responsibilities:
    - Fetch and display all tokens via `invoke('get_tokens')` (includes social, IdC, and Web OAuth accounts).
    - Auto‑refresh token quota from the APIs:
      - Periodic background refresh every 5 minutes (using `refresh_token_from_api`).
      - Manual refresh per‑row or "refresh all" (with progress UI).
    - Manage selection, bulk delete (`delete_tokens`), and export (`export_tokens`) to a JSON file.
    - Switch Kiro IDE account via `verify_token` and `switch_kiro_account`, including confirmation flows and quotas in the confirmation message.
    - Listen for `login-success` and `kiro-login-data` events to add tokens after login and then reload the list.
  - The UI expects many optional fields on each `Token` (e.g. subscription type and plan, free‑trial fields, bonuses, overage info, reset dates). If you change the `Token` struct or how CodeWhisperer responses are mapped onto it, audit `TokenManager.jsx` and `Home.jsx` for assumptions.

- `src/components/Login.jsx`
  - Implements the "desktop" login flow using Tauri commands:
    - Calls `invoke('kiro_login', { provider })` with `Google`, `Github`, or `BuilderId`.
    - Listens for `login-success` and passes the payload back via the `onLogin` callback, which `App.jsx` uses to update `user` and `activeMenu`.

- `src/components/WebOAuthLogin.jsx` and `src/api/webOAuth.js`
  - Implement a two‑step Web OAuth flow (browser‑based Cognito + CBOR):
    1. `web_oauth_initiate` (Rust: `web_oauth_cmd::web_oauth_initiate`) opens a browser and returns a state value.
    2. The user manually pastes the callback URL from the browser back into the app, which is passed to `web_oauth_complete`.
  - On success, Rust emits `login-success`, which updates the UI in the same way as the desktop login.
  - `src/api/webOAuth.js` is a thin wrapper over these Tauri commands; if you adjust the command signatures, keep this module in sync.

- `src/components/AuthCallback.jsx`
  - Handles `/callback` routes when the app is opened as an OAuth redirect target.
  - Extracts `code` and `state` from the URL and calls `invoke('handle_kiro_social_callback')`, then closes the window after updating status.

- `src/components/Settings.jsx`
  - Centralizes configuration for both Kiro IDE and the Token Manager app:
    - Reads Kiro IDE telemetry and settings via `get_kiro_telemetry_info` and `get_kiro_settings`.
    - Reads and writes app settings (theme, model lock) via `get_app_settings` / `save_app_settings`.
    - Updates Kiro IDE HTTP proxy and model selection via `set_kiro_proxy` / `set_kiro_model`.
    - Controls Kiro IDE lifecycle using `is_kiro_ide_running`, `close_kiro_ide`, and `start_kiro_ide`.
    - Provides a guided flow to reset the Kiro machine ID (`reset_kiro_machine_id`) and optionally restart Kiro IDE.
  - Also exposes the same theme selection options as `Sidebar`, driven by the theme context.

- `src/components/UpdateChecker.jsx` and `src/components/About.jsx`
  - `UpdateChecker`:
    - On mount, calls `checkUpdate()` from `@tauri-apps/api/updater`, using the `updater` configuration in `tauri.conf.json` (Github releases) and offers an "update & relaunch" flow via `installUpdate()` and `relaunch()`.
    - Renders a dismissible floating card; it is always mounted by `App.jsx`.
  - `About`:
    - Shows app info and tech stack.
    - Uses Tauri `getVersion()` and also calls the Github Releases API directly to check for newer versions, offering external links opened via `@tauri-apps/api/shell.open`.

## Backend architecture (Tauri + Rust)

### Tauri entrypoint and global state

- `src-tauri/src/main.rs` is the Tauri entrypoint:
  - Defines modules: `auth`, `auth_social`, `aws_sso_client`, `codewhisperer_client`, `token`, `kiro_auth_client`, `oauth_callback_server`, `providers`, `kiro`, `process`, `state`, and `commands`.
  - Instantiates `AppState` with:
    - `store: Mutex<TokenStore>` – persistent token storage backed by JSON under `~/.kiro-token-manager/tokens.json`.
    - `auth: AuthState` – in‑memory authenticated user/session state.
    - `pending_login: Mutex<Option<PendingLogin>>` – used by some flows to hold intermediate OAuth state.
  - Registers all Tauri commands via `generate_handler!`, grouped roughly into:
    - Token commands: `get_tokens`, `update_token`, `delete_token`, `delete_tokens`, `refresh_token_from_api`, `verify_token`, `add_account_by_social`, `add_local_kiro_account`, `add_account_by_idc`, `import_tokens`, `export_tokens`.
    - Auth commands: `get_current_user`, `logout`, `kiro_login`, `get_supported_providers`, `handle_kiro_social_callback`, `add_kiro_token`.
    - Kiro IDE integration: `get_kiro_local_token`, `switch_kiro_account`, `get_kiro_telemetry_info`, `reset_kiro_machine_id`, plus process helpers `close_kiro_ide`, `start_kiro_ide`, `is_kiro_ide_running`.
    - Settings commands: `get_kiro_settings`, `set_kiro_proxy`, `set_kiro_model`, `get_app_settings`, `save_app_settings`.
    - Web OAuth commands: `web_oauth_initiate`, `web_oauth_complete`, `web_oauth_refresh`.

- `src-tauri/src/state.rs` defines `AppState` and `PendingLogin`. This is the shared state injected into commands via `State<AppState>` and must remain thread‑safe.

### Token model and persistence

- `src-tauri/src/token.rs`:
  - Defines the `Token` struct, which is serialized to JSON and sent directly to the frontend.
    - It contains core fields (`id`, `email`, `label`, `quota`, `used`, `status`, `created_at`) and many optional fields for quotas, free trials, bonuses, overage data, subscription plan, IdC info (SSO client IDs, region), profile ARN, and an `auth_method` marker.
    - The frontend assumes many of these fields exist and uses them to derive UI (e.g., PRO/PRO+ detection from `subscription_type`/`subscription_plan`, free‑trial and bonus chips, reset date labels, status badges). Be cautious when renaming or removing fields.
  - `TokenStore` owns a `Vec<Token>` and a `file_path` pointing to `~/.kiro-token-manager/tokens.json` (home is chosen from `USERPROFILE` or `HOME`).
    - `new()` loads tokens from disk if present.
    - `save_to_file()` persists the entire token list (pretty‑printed JSON).
    - Helper methods provide CRUD operations (`get_all`, `add_with_tokens`, `update`, `delete`, `delete_many`, etc.) used by the command modules.

### Command modules

All command modules live under `src-tauri/src/commands` and are re‑exported by `commands/mod.rs`. This is the primary bridge from Tauri to the frontend.

- `commands/token_cmd.rs`
  - Implements token management commands exposed to the UI:
    - Basic CRUD: `get_tokens`, `update_token`, `delete_token`, `delete_tokens`.
    - `refresh_token_from_api`: refreshes a single token’s access/refresh tokens and quota info.
      - Chooses either `IdcProvider` (for `BuilderId`) or `SocialProvider` (for Google/Github) from the `providers` module.
      - Uses `CodeWhispererClient` to fetch usage/quota, then updates quota, usage, reset date, free‑trial info, bonus info, and overage details on the `Token`.
  - This logic must stay in sync with how the frontend displays token statistics.

- `commands/auth_cmd.rs`
  - Centralized interface for desktop login flows:
    - `kiro_login` selects a provider configuration (`get_provider_config`) and dispatches to either social (`login_social`) or IdC (`login_idc`) flows.
    - Social flow uses `create_social_provider` and `auth_social` helpers; IdC flow uses `create_idc_provider` and `aws_sso_client`.
    - Both flows:
      - Obtain access/refresh tokens and expiration.
      - Call either the Desktop Auth API or CodeWhisperer to fetch user info and usage limits.
      - Insert or update a `Token` in `TokenStore` with enriched quota/bonus/overage data.
      - Update `AuthState` (current user + tokens) and emit the `login-success` event (payload is a token ID) consumed by the React app.

- `commands/settings_cmd.rs`
  - Bridges between the app, Kiro IDE configuration, and on‑disk settings files:
    - Defines `KiroSettings` (proxy + model) and `AppSettings` (theme, lock model, locked model).
    - Reads and writes app settings at `~/.kiro-token-manager/app-settings.json`.
    - Locates Kiro IDE’s `settings.json` (platform‑dependent path) and:
      - Reads the HTTP proxy and model selection fields.
      - Sets `http.proxy`, `http.proxyStrictSSL`, `http.proxySupport`, and `kiroAgent.modelSelection` when updating proxy/model.
    - All file IO is run via `tokio::task::spawn_blocking` and exposed as async Tauri commands (`get_app_settings`, `save_app_settings`, `get_kiro_settings`, `set_kiro_proxy`, `set_kiro_model`).

- `commands/web_oauth_cmd.rs`
  - Implements the browser‑based Web OAuth flow as two commands:
    - `web_oauth_initiate(provider)`:
      - Validates provider (`Google` or `Github`).
      - Uses `WebOAuthProvider` (`providers::web_oauth`) to start login and open the browser.
      - Stores the returned `WebOAuthInitResult` (provider ID, code verifier, state) in a global `OnceLock<Mutex<...>>` and returns the `state` string.
    - `web_oauth_complete(callback_url)`:
      - Parses the callback URL to extract `code` and `state`.
      - Retrieves the pending login data, completes the flow with `WebOAuthProvider::complete_login`, and uses `CodeWhispererClient` to enrich quota info.
      - Creates/updates a `Token` flagged with `auth_method = "web_oauth"`, saves it, updates `AuthState`, and emits `login-success`.
    - `web_oauth_refresh(token_id)` refreshes previously created Web OAuth tokens and re‑pulls usage limits.

### Provider and lower‑level modules

- `src-tauri/src/providers` contains the provider abstraction layer used by the command modules:
  - `base.rs` defines common types (`AuthResult`, `AuthProvider`, `RefreshMetadata`).
  - `social.rs` and `idc.rs` implement concrete providers for Social and IdC flows.
  - `factory.rs` exposes `get_provider_config`, `create_social_provider`, `create_idc_provider`, and related helpers.
  - `web_oauth.rs` implements the browser‑based Web OAuth provider used only by `web_oauth_cmd`.
- Other important modules (consult them when making deeper changes):
  - `auth.rs`, `auth_social.rs` – core auth state and desktop auth helpers.
  - `codewhisperer_client.rs` – thin client for the `getUsageLimits` API, shared across Social/IdC/Web OAuth.
  - `aws_sso_client.rs` – AWS SSO OIDC client for IdC logins.
  - `kiro_auth_client.rs`, `kiro.rs`, `oauth_callback_server.rs`, `process.rs` – Kiro IDE integration (local tokens, telemetry, callback server, process management).

## Frontend–backend contracts and gotchas

When modifying or extending functionality, keep these cross‑cutting contracts in mind:

- **Tauri command names and signatures**
  - Every command used via `invoke()` on the frontend must be registered in `src-tauri/src/main.rs` and implemented in one of the `commands/*` modules (or other modules re‑exported there).
  - If you rename or change the parameters/return types of a command, update all callers in `src/` (components and `src/api/webOAuth.js`) and, if applicable, any event payload expectations.

- **Events**
  - `login-success` is the primary event bridging login flows to the UI:
    - Emitted from Rust after any successful login or Web OAuth completion (payload is a token ID or token‑related data).
    - Listened to by `App.jsx`, `Login.jsx`, `WebOAuthLogin.jsx`, and `TokenManager.jsx`.
  - Some flows also emit `kiro-login-data`, which `TokenManager` listens to in order to add tokens from external login flows. If you change these events, search for all listeners before making changes.

- **Token shape expectations**
  - `TokenManager.jsx` and `Home.jsx` expect consistent semantics for `quota`, `used`, `subscription_type`, `subscription_plan`, `free_trial_*`, `bonuses`, `overage_*`, `reset_date`, and `days_until_reset`.
  - If you extend `Token` with new quota or billing fields (e.g., new bonus types or currencies), prefer to:
    - Add fields to `Token` with `#[serde(skip_serializing_if = "Option::is_none")]` to keep compatibility.
    - Map them in the appropriate extractor helper in the command modules (e.g., `extract_usage_fields`, `extract_usage_fields_cw`, `extract_usage_fields_web`).
    - Update frontend components to gracefully handle `null`/missing values.

- **Settings and persistence**
  - Theme and some app preferences are stored in `AppSettings` under `~/.kiro-token-manager/app-settings.json`. Changes to this schema should be mirrored in `ThemeContext.jsx` and `Settings.jsx`.
  - Tokens are stored under `~/.kiro-token-manager/tokens.json`. If you introduce a different storage backend (e.g., the existing `rusqlite` dependency), consider migration/compat and keep the `TokenStore` API stable for callers.

By following these patterns and respecting the existing contracts between React components and Tauri commands, future modifications should stay coherent across the frontend, backend, and external Kiro/AWS APIs.