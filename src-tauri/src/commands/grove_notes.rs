use reqwest::Method;
use serde::Serialize;

const GROVE_NOTES_BASE_URL: &str = "https://grovenotes.com";

#[derive(Debug, Serialize)]
pub struct GroveNotesResponse {
    pub status: u16,
    pub body: String,
}

#[tauri::command]
pub async fn grove_notes_request(
    api_key: String,
    path: String,
    method: Option<String>,
    body: Option<String>,
) -> Result<GroveNotesResponse, String> {
    if api_key.trim().is_empty() {
        return Err("GroveNotes API key is required.".into());
    }

    let normalized_path = if path.starts_with('/') {
        path
    } else {
        format!("/{path}")
    };
    let url = format!("{GROVE_NOTES_BASE_URL}{normalized_path}");

    let (method, include_json_content_type) =
        match method.as_deref().unwrap_or("GET").to_uppercase().as_str() {
            "GET" => (Method::GET, false),
            "PUT" => (Method::PUT, true),
            "POST" => (Method::POST, true),
            "DELETE" => (Method::DELETE, false),
            other => return Err(format!("Unsupported HTTP method: {other}")),
        };

    let client = reqwest::Client::builder()
        .user_agent("GroveNotes-Desktop")
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client
        .request(method, &url)
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .header("Accept", "application/json");

    if include_json_content_type {
        request = request.header("Content-Type", "application/json");
    }

    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request.send().await.map_err(|e| {
        format!("Could not reach GroveNotes at {GROVE_NOTES_BASE_URL}: {e}")
    })?;

    Ok(GroveNotesResponse {
        status: response.status().as_u16(),
        body: response.text().await.map_err(|e| e.to_string())?,
    })
}
