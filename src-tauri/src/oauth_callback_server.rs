use std::net::TcpListener;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// OAuth 回调结果
pub struct OAuthCallbackResult {
    pub code: String,
    pub state: String,
}

#[derive(Clone)]
enum Strategy {
    Random,
    Predefined(Vec<u16>),
}

/// 本地 OAuth 回调服务器
/// 支持随机端口和预定义端口列表
pub struct OAuthCallbackServer {
    strategy: Strategy,
    hostname: String,
    timeout: Duration,
    result_rx: Arc<Mutex<Option<Receiver<Result<OAuthCallbackResult, String>>>>>,
}

impl OAuthCallbackServer {
    /// 使用随机端口（端口 0）策略
    pub fn new_random(hostname: &str) -> Self {
        Self {
            strategy: Strategy::Random,
            hostname: hostname.to_string(),
            timeout: Duration::from_millis(300_000), // 5 分钟
            result_rx: Arc::new(Mutex::new(None)),
        }
    }

    /// 使用预定义端口列表策略
    pub fn new_predefined(hostname: &str, ports: Vec<u16>) -> Self {
        Self {
            strategy: Strategy::Predefined(ports),
            hostname: hostname.to_string(),
            timeout: Duration::from_millis(300_000),
            result_rx: Arc::new(Mutex::new(None)),
        }
    }

    /// 启动服务器，返回 redirect_uri（包含实际端口）
    pub fn start(&mut self) -> Result<String, String> {
        // 克隆一份策略，避免同时存在可变与不可变借用
        let strategy = self.strategy.clone();
        match strategy {
            Strategy::Random => self.start_with_random_port(),
            Strategy::Predefined(ports) => self.start_with_predefined_ports(&ports),
        }
    }

    fn start_with_random_port(&mut self) -> Result<String, String> {
        let listener = TcpListener::bind((self.hostname.as_str(), 0))
            .map_err(|e| format!("Failed to bind random port: {}", e))?;
        let addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local addr: {}", e))?;
        self.spawn_server(listener, addr.port())
    }

    fn start_with_predefined_ports(&mut self, ports: &[u16]) -> Result<String, String> {
        if ports.is_empty() {
            return Err("Predefined port strategy requires a non-empty ports array".to_string());
        }

        let mut last_err: Option<String> = None;
        for port in ports {
            match TcpListener::bind((self.hostname.as_str(), *port)) {
                Ok(listener) => {
                    let addr = listener
                        .local_addr()
                        .map_err(|e| format!("Failed to get local addr: {}", e))?;
                    return self.spawn_server(listener, addr.port());
                }
                Err(e) => {
                    last_err = Some(format!("{}", e));
                    continue;
                }
            }
        }

        Err(format!(
            "Failed to start server on any predefined port. Last error: {}",
            last_err.unwrap_or_else(|| "unknown".to_string())
        ))
    }

    fn spawn_server(&mut self, listener: TcpListener, port: u16) -> Result<String, String> {
        let server = tiny_http::Server::from_listener(listener, None)
            .map_err(|e| format!("Failed to start HTTP server: {}", e))?;

        let (tx, rx): (
            Sender<Result<OAuthCallbackResult, String>>,
            Receiver<Result<OAuthCallbackResult, String>>,
        ) = mpsc::channel();
        *self.result_rx.lock().unwrap() = Some(rx);

        let redirect_uri = format!("http://{}:{}/oauth/callback", self.hostname, port);

        std::thread::spawn(move || {
            loop {
                let request = match server.recv() {
                    Ok(req) => req,
                    Err(e) => {
                        let _ = tx.send(Err(format!("HTTP server error: {}", e)));
                        break;
                    }
                };

                let url = request.url().to_string();
                let method = request.method().as_str().to_string();

                if method == "GET" && url.starts_with("/oauth/callback") {
                    let result = handle_oauth_callback(request);
                    let _ = tx.send(result);
                    break;
                } else {
                    send_404_response(request);
                }
            }
        });

        Ok(redirect_uri)
    }

    /// 等待 OAuth 回调，直到成功或超时
    pub fn wait_for_callback(&self) -> Result<OAuthCallbackResult, String> {
        let rx_opt = self
            .result_rx
            .lock()
            .unwrap()
            .take();

        let rx = match rx_opt {
            Some(r) => r,
            None => return Err("Callback channel not initialized".to_string()),
        };

        match rx.recv_timeout(self.timeout) {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("OAuth callback timeout (5 minutes)".to_string()),
        }
    }
}

fn handle_oauth_callback(request: tiny_http::Request) -> Result<OAuthCallbackResult, String> {
    let url_path = request.url().to_string();

    let (path, query) = match url_path.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (url_path.as_str(), None),
    };

    if path != "/oauth/callback" {
        send_404_response(request);
        return Err("Invalid callback path".to_string());
    }

    let mut params = std::collections::HashMap::new();
    if let Some(q) = query {
        for pair in q.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                if let (Ok(k), Ok(v)) = (urlencoding::decode(k), urlencoding::decode(v)) {
                    params.insert(k.to_string(), v.to_string());
                }
            }
        }
    }

    if let Some(error) = params.get("error") {
        let description = params
            .get("error_description")
            .cloned()
            .unwrap_or_else(|| "Unknown error".to_string());
        let _state = params.get("state").cloned();

        send_error_response(request, error, &description);
        return Err(format!("OAuth error: {} - {}", error, description));
    }

    let code = match params.get("code") {
        Some(c) => c.clone(),
        None => {
            send_validation_error_response(request, "Missing code parameter");
            return Err("OAuth callback missing authorization code".to_string());
        }
    };

    let state = match params.get("state") {
        Some(s) => s.clone(),
        None => {
            send_validation_error_response(request, "Missing state parameter");
            return Err("OAuth callback missing state".to_string());
        }
    };

    send_success_response(request);
    Ok(OAuthCallbackResult { code, state })
}

fn send_success_response(request: tiny_http::Request) {
    let html = r#"<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    .success-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: #2d3748;
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
    }
    p {
      color: #718096;
      margin: 0;
      line-height: 1.6;
    }
    .close-hint {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      font-size: 0.875rem;
      color: #a0aec0;
    }
  </style>
</head>
<body>
  <div class=\"container\">
    <div class=\"success-icon\">✅</div>
    <h1>Authentication Successful!</h1>
    <p>You have successfully authenticated.</p>
    <p>You can now close this window and return to the app.</p>
    <div class=\"close-hint\">This window will close automatically in 3 seconds...</div>
  </div>
  <script>
    setTimeout(() => window.close(), 3000);
  </script>
</body>
</html>"#;

    let response = tiny_http::Response::new(
        tiny_http::StatusCode(200),
        vec![
            tiny_http::Header::from_bytes("Content-Type", "text/html; charset=utf-8").unwrap(),
        ],
        std::io::Cursor::new(html.to_string()),
        Some(html.len()),
        None,
    );

    let _ = request.respond(response);
}

fn send_error_response(request: tiny_http::Request, error: &str, description: &str) {
    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
  <title>Authentication Failed</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }}
    .container {{
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }}
    .error-icon {{
      font-size: 4rem;
      margin-bottom: 1rem;
    }}
    h1 {{
      color: #2d3748;
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
    }}
    .error-details {{
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0;
      text-align: left;
    }}
    .error-code {{
      font-family: monospace;
      color: #c53030;
      font-weight: bold;
    }}
    .error-description {{
      color: #718096;
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }}
  </style>
</head>
<body>
  <div class=\"container\">
    <div class=\"error-icon\">❌</div>
    <h1>Authentication Failed</h1>
    <div class=\"error-details\">
      <div class=\"error-code\">{}</div>
      <div class=\"error-description\">{}</div>
    </div>
    <p>Please try again or contact support if the problem persists.</p>
  </div>
</body>
</html>"#,
        escape_html(error),
        escape_html(description),
    );

    let response = tiny_http::Response::new(
        tiny_http::StatusCode(400),
        vec![
            tiny_http::Header::from_bytes("Content-Type", "text/html; charset=utf-8").unwrap(),
        ],
        std::io::Cursor::new(html.to_string()),
        Some(html.len()),
        None,
    );

    let _ = request.respond(response);
}

fn send_validation_error_response(request: tiny_http::Request, message: &str) {
    send_error_response(request, "invalid_request", message);
}

fn escape_html(text: &str) -> String {
    let mut s = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => s.push_str("&amp;"),
            '<' => s.push_str("&lt;"),
            '>' => s.push_str("&gt;"),
            '"' => s.push_str("&quot;"),
            '\'' => s.push_str("&#039;"),
            _ => s.push(ch),
        }
    }
    s
}

fn send_404_response(request: tiny_http::Request) {
    let html = "<h1>404 Not Found</h1>";
    let response = tiny_http::Response::new(
        tiny_http::StatusCode(404),
        vec![
            tiny_http::Header::from_bytes("Content-Type", "text/html").unwrap(),
        ],
        std::io::Cursor::new(html.to_string()),
        Some(html.len()),
        None,
    );

    let _ = request.respond(response);
}
