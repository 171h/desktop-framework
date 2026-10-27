//! `df_wasm` — 框架前端与 Rust 热路径之间的 WASM 边界。
//!
//! 当前导出命令面板 / 插件搜索的模糊匹配。结果使用 JSON 传输，规模通常为
//! 数百到数千条命令，相比一次性复制完整候选列表更节省边界开销。
#![forbid(unsafe_code)]

use wasm_bindgen::prelude::*;

/// 安装 panic hook。
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// 版本号。
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 对 JSON 字符串数组执行模糊搜索。
///
/// 参数：
/// - `query`：查询文本；
/// - `candidates_json`：`["..."]`；
/// - `limit`：最多返回条数。
///
/// 返回 `[{ "index": 0, "score": 120, "positions": [0, 2] }]`。
///
/// # Errors
///
/// JSON 结构不合法时返回 `JsError`。
#[wasm_bindgen(js_name = fuzzySearch)]
pub fn fuzzy_search(query: &str, candidates_json: &str, limit: usize) -> Result<String, JsError> {
    let candidates: Vec<String> = serde_json::from_str(candidates_json)
        .map_err(|error| JsError::new(&format!("候选列表不是字符串数组：{error}")))?;
    let results = df_fuzzy::search(query, &candidates, limit);
    serde_json::to_string(&results)
        .map_err(|error| JsError::new(&format!("结果序列化失败：{error}")))
}

/// 计算单个候选的分数。
#[wasm_bindgen(js_name = fuzzyScore)]
#[must_use]
pub fn fuzzy_score(query: &str, candidate: &str) -> i32 {
    df_fuzzy::score(query, candidate).unwrap_or(-1)
}
