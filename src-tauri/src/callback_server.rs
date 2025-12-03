use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use crate::{AppState, handle_kiro_social_callback};

/// 启动本地 HTTP 回调服务器，监听 127.0.0.1:17655
pub fn start_kiro_callback_server(app_handle: AppHandle) {
    let addr = "127.0.0.1:17655";
    println!("Starting Kiro OAuth callback server on {}", addr);

    // 使用 tiny-http 创建简单的 HTTP 服务器
    let server = tiny_http::Server::http(addr)
        .expect("Failed to start HTTP server");

    // 共享 app_handle
    let app_handle = Arc::new(Mutex::new(app_handle));

    // 在新线程中运行服务器
    std::thread::spawn(move || {
        loop {
            match server.recv() {
                Ok(request) => {
                    let app_handle = app_handle.clone();

                    std::thread::spawn(move || {
                        handle_request(request, app_handle);
                    });
                }
                Err(e) => {
                    eprintln!("HTTP server error: {}", e);
                    break;
                }
            }
        }
    });
}

/// 处理 HTTP 请求
fn handle_request(
    request: tiny_http::Request,
    app_handle: Arc<Mutex<AppHandle>>,
) {
    let url = request.url().to_string();
    let method = request.method().to_string();
    
    println!("Callback request: {} {}", method, url);
    
    // 只处理 GET /kiro-auth/callback
    if method == "GET" && url.starts_with("/kiro-auth/callback") {
        // 解析查询参数
        let params = parse_query_params(&url);
        
        if let (Some(code), Some(state_param)) = (params.get("code"), params.get("state")) {
            println!("Received OAuth callback: code={}, state={}", code, state_param);
            
            // 调用回调处理函数
            let result = {
                let app_handle_locked = app_handle.lock().unwrap().clone();
                let state: State<AppState> = app_handle_locked.state();
                tokio::runtime::Runtime::new().unwrap().block_on(
                    handle_kiro_social_callback(app_handle_locked.clone(), state, code.clone(), state_param.clone())
                )
            };
            
            match result {
                Ok(_) => {
                    println!("OAuth callback handled successfully");
                    send_success_response(request);
                }
                Err(e) => {
                    eprintln!("OAuth callback failed: {}", e);
                    send_error_response(request, &e);
                }
            }
        } else {
            eprintln!("Missing code or state in callback");
            send_error_response(request, "Missing code or state parameters");
        }
    } else {
        eprintln!("Invalid callback request: {} {}", method, url);
        send_error_response(request, "Invalid endpoint");
    }
}

/// 解析查询参数
fn parse_query_params(url: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    
    if let Some(query_start) = url.find('?') {
        let query = &url[query_start + 1..];
        for pair in query.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                if let (Ok(key), Ok(value)) = (
                    urlencoding::decode(key),
                    urlencoding::decode(value)
                ) {
                    params.insert(key.to_string(), value.to_string());
                }
            }
        }
    }
    
    params
}

/// 发送成功响应
fn send_success_response(request: tiny_http::Request) {
    let response = tiny_http::Response::new(
        tiny_http::StatusCode(200),
        vec![
            tiny_http::Header::from_bytes("Content-Type", "text/html; charset=utf-8").unwrap(),
            tiny_http::Header::from_bytes("Cache-Control", "no-store").unwrap(),
        ],
        std::io::Cursor::new("<html><body>登录成功！</body></html>"),
        Some(request.url().len()),
        None,
    );
    
    let _ = request.respond(response);
}

/// 发送错误响应
fn send_error_response(request: tiny_http::Request, error: &str) {
    let html = format!(
        r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>登录失败</title>
    <style>
        body {{ font-family: system-ui; padding: 2rem; text-align: center; }}
        .error {{ color: #d32f2f; }}
    </style>
</head>
<body>
    <h1 class="error">登录失败</h1>
    <p>{}</p>
    <p>请关闭此窗口并重试。</p>
</body>
</html>
        "#,
        error
    );
    
    let response = tiny_http::Response::new(
        tiny_http::StatusCode(400),
        vec![
            tiny_http::Header::from_bytes("Content-Type", "text/html; charset=utf-8").unwrap(),
            tiny_http::Header::from_bytes("Cache-Control", "no-store").unwrap(),
        ],
        std::io::Cursor::new(html),
        Some(request.url().len()),
        None,
    );
    
    let _ = request.respond(response);
}
