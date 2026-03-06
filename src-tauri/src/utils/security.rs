/// Validate a URL before passing to yt-dlp.
/// Only allows http:// and https:// schemes, rejects option-injection attempts.
pub fn validate_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("URL cannot be empty".to_string());
    }
    if trimmed.starts_with('-') {
        return Err("Invalid URL: cannot start with '-'".to_string());
    }
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Invalid URL: only http:// and https:// are supported".to_string());
    }
    Ok(())
}

/// Normalize URLs to formats compatible with yt-dlp extractors.
///
/// Transforms platform-specific URL variants into the canonical format
/// expected by yt-dlp. Returns the original URL unchanged if no
/// normalization is needed.
///
/// # Supported transforms
///
/// ## Douyin
/// Any `douyin.com` page with a `modal_id` query parameter → direct video URL:
/// - `douyin.com/user/…?modal_id=123` → `douyin.com/video/123`
/// - `douyin.com/jingxuan?modal_id=123` → `douyin.com/video/123`
/// - `douyin.com/jingxuan/music?modal_id=123` → `douyin.com/video/123`
pub fn normalize_url(url: &str) -> String {
    // Fast path: only inspect URLs that mention douyin.com
    let lower = url.to_lowercase();
    if !lower.contains("douyin.com/") {
        return url.to_string();
    }

    normalize_douyin(url).unwrap_or_else(|| url.to_string())
}

/// Try to normalize a Douyin modal URL to a direct video URL.
/// Returns `None` when the URL does not match the expected pattern.
fn normalize_douyin(url: &str) -> Option<String> {
    // Split URL into base and query
    let (base, query) = url.split_once('?')?;

    // Already a direct video URL — leave it alone
    let lower_base = base.to_lowercase();
    if lower_base.contains("douyin.com/video/") {
        return None;
    }

    // Must be a douyin.com host
    if !lower_base.contains("douyin.com/") {
        return None;
    }

    // Find modal_id in query parameters
    let modal_id = query
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| *key == "modal_id")
        .map(|(_, value)| value)?;

    // Validate: must be a non-empty numeric string
    if modal_id.is_empty() || !modal_id.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    Some(format!("https://www.douyin.com/video/{}", modal_id))
}

/// Validate ffmpeg arguments to block dangerous patterns.
/// This is a defense-in-depth measure for AI-generated commands.
pub fn validate_ffmpeg_args(args: &[String]) -> Result<(), String> {
    for arg in args {
        // Block shell injection patterns (shouldn't appear in ffmpeg args)
        if arg.contains('`') || arg.contains("$(") {
            return Err(format!("Dangerous pattern in ffmpeg argument: {}", arg));
        }
        // Block dangerous ffmpeg protocols that could exfiltrate data
        let lower = arg.to_lowercase();
        for proto in &["concat:", "tcp:", "udp:", "ftp:", "smb:", "rtmp:", "rtp:"] {
            if lower.starts_with(proto) {
                return Err(format!("Blocked protocol in ffmpeg argument: {}", arg));
            }
        }
    }
    Ok(())
}

/// Convert a Vec of ffmpeg args into a display-friendly command string.
/// Quotes arguments containing spaces.
pub fn args_to_display_command(args: &[String]) -> String {
    let mut parts = vec!["ffmpeg".to_string()];
    for arg in args {
        if arg.contains(' ') || arg.contains('"') || arg.contains('\'') {
            parts.push(format!("\"{}\"", arg.replace('"', "\\\"")));
        } else {
            parts.push(arg.clone());
        }
    }
    parts.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    // — Douyin: various pages with modal_id —

    #[test]
    fn douyin_user_profile_modal() {
        let input =
            "https://www.douyin.com/user/self?modal_id=7587779409656007994&showTab=recommend";
        assert_eq!(
            normalize_url(input),
            "https://www.douyin.com/video/7587779409656007994"
        );
    }

    #[test]
    fn douyin_user_profile_with_extra_params() {
        let input = "https://www.douyin.com/user/MS4wLjABAAAApS8G4x1k10StKWUjcUv0nhgo5h4Zio_cfCH5Yjvs0gc?from_tab_name=main&modal_id=7338347129624218919";
        assert_eq!(
            normalize_url(input),
            "https://www.douyin.com/video/7338347129624218919"
        );
    }

    #[test]
    fn douyin_jingxuan_modal() {
        let input = "https://www.douyin.com/jingxuan?modal_id=7612685550327205158";
        assert_eq!(
            normalize_url(input),
            "https://www.douyin.com/video/7612685550327205158"
        );
    }

    #[test]
    fn douyin_jingxuan_search_modal() {
        let input = "https://www.douyin.com/jingxuan/search/%E6%AC%B2%E6%A2%A6?aid=8604cede-cf5d-4750-87e8-9bd39b73b239&modal_id=7602194190675655906&type=general";
        assert_eq!(
            normalize_url(input),
            "https://www.douyin.com/video/7602194190675655906"
        );
    }

    #[test]
    fn douyin_jingxuan_music_modal() {
        let input = "https://www.douyin.com/jingxuan/music?modal_id=7607040283255016755";
        assert_eq!(
            normalize_url(input),
            "https://www.douyin.com/video/7607040283255016755"
        );
    }

    // — Douyin: should NOT transform —

    #[test]
    fn douyin_direct_video_url_unchanged() {
        let input = "https://www.douyin.com/video/7587779409656007994";
        assert_eq!(normalize_url(input), input);
    }

    #[test]
    fn douyin_no_modal_id() {
        let input = "https://www.douyin.com/user/self?showTab=recommend";
        assert_eq!(normalize_url(input), input);
    }

    #[test]
    fn douyin_homepage_no_modal_id() {
        let input = "https://www.douyin.com/?recommend=1";
        assert_eq!(normalize_url(input), input);
    }

    #[test]
    fn douyin_non_numeric_modal_id() {
        let input = "https://www.douyin.com/user/self?modal_id=abc123&showTab=recommend";
        assert_eq!(normalize_url(input), input);
    }

    #[test]
    fn douyin_empty_modal_id() {
        let input = "https://www.douyin.com/user/self?modal_id=&showTab=recommend";
        assert_eq!(normalize_url(input), input);
    }

    // — Other platforms: unchanged —

    #[test]
    fn youtube_url_unchanged() {
        let input = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        assert_eq!(normalize_url(input), input);
    }

    #[test]
    fn bilibili_url_unchanged() {
        let input = "https://www.bilibili.com/video/BV1xx411c7mD";
        assert_eq!(normalize_url(input), input);
    }

    #[test]
    fn empty_url_unchanged() {
        assert_eq!(normalize_url(""), "");
    }
}
