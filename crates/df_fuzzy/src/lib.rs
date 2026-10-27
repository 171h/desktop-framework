//! `df_fuzzy` — 命令面板 / 插件搜索使用的模糊匹配。
//!
//! 目标：
//! - 对长列表保持线性扫描，单个候选的匹配只分配一个位置向量；
//! - 支持 camelCase、`:` / `-` / `_` 边界加分与连续字符奖励；
//! - 无文件系统、无浏览器 API，可编译到 `wasm32-unknown-unknown`。
//!
//! 匹配规则是 **子序列**：查询字符必须按顺序出现。空查询命中所有候选。

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// 单条搜索结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SearchResult {
    /// 候选下标。
    pub index: usize,
    /// 分数，越高越匹配。
    pub score: i32,
    /// 命中的字符位置（用于前端高亮）。
    pub positions: Vec<usize>,
}

/// 计算匹配分数；不匹配返回 `None`。
#[must_use]
pub fn score(query: &str, candidate: &str) -> Option<i32> {
    if query.is_empty() {
        return Some(0);
    }
    let query: Vec<char> = query.chars().flat_map(char::to_lowercase).collect();
    let candidate_chars: Vec<char> = candidate.chars().collect();
    let candidate_lower: Vec<char> = candidate_chars
        .iter()
        .flat_map(|character| character.to_lowercase())
        .collect();
    if query.len() > candidate_lower.len() {
        return None;
    }

    let mut query_index = 0;
    let mut positions = Vec::with_capacity(query.len());
    let mut total = 0_i32;
    let mut previous_match: Option<usize> = None;

    for (index, character) in candidate_lower.iter().enumerate() {
        if query_index >= query.len() {
            break;
        }
        if *character != query[query_index] {
            continue;
        }
        positions.push(index);
        total += 10;
        // 连续命中。
        if previous_match.is_some_and(|previous| previous + 1 == index) {
            total += 12;
        }
        // 单词边界、camelCase 与常见分隔符后的首字符。
        if index == 0 {
            total += 18;
        } else {
            let previous = candidate_chars[index - 1];
            if matches!(previous, ' ' | '-' | '_' | ':' | '.' | '/' | '\\' | '>') {
                total += 16;
            } else if previous.is_lowercase() && candidate_chars[index].is_uppercase() {
                total += 12;
            }
        }
        // 查询长度较短时更偏向短候选，避免长文本淹没精确命令。
        previous_match = Some(index);
        query_index += 1;
    }

    if query_index != query.len() {
        return None;
    }

    let length_penalty = i32::try_from(candidate_chars.len()).unwrap_or(i32::MAX) / 4;
    Some(total - length_penalty)
}

/// 在候选列表中搜索，按分数降序、原始顺序升序返回。
#[must_use]
pub fn search(query: &str, candidates: &[impl AsRef<str>], limit: usize) -> Vec<SearchResult> {
    let mut results: Vec<SearchResult> = candidates
        .iter()
        .enumerate()
        .filter_map(|(index, candidate)| {
            let candidate = candidate.as_ref();
            let value = score(query, candidate)?;
            let positions = match_positions(query, candidate).unwrap_or_default();
            Some(SearchResult {
                index,
                score: value,
                positions,
            })
        })
        .collect();
    results.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.index.cmp(&right.index))
    });
    results.truncate(limit);
    results
}

/// 返回查询字符在候选中的命中位置。
#[must_use]
pub fn match_positions(query: &str, candidate: &str) -> Option<Vec<usize>> {
    if query.is_empty() {
        return Some(Vec::new());
    }
    let query: Vec<char> = query.chars().flat_map(char::to_lowercase).collect();
    let mut query_index = 0;
    let mut positions = Vec::with_capacity(query.len());
    for (index, character) in candidate.chars().flat_map(char::to_lowercase).enumerate() {
        if query_index >= query.len() {
            break;
        }
        if character == query[query_index] {
            positions.push(index);
            query_index += 1;
        }
    }
    (query_index == query.len()).then_some(positions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_subsequence_case_insensitively() {
        assert!(score("fmt", "Format Document").is_some());
        assert!(score("viewl", "View: Toggle Left Panel").is_some());
        assert!(score("xyz", "Format Document").is_none());
    }

    #[test]
    fn boundary_matches_rank_higher() {
        let results = search(
            "tol",
            &["Toggle Left Panel", "Controls: Toolbox", "layout"],
            10,
        );
        assert_eq!(results[0].index, 0);
    }

    #[test]
    fn empty_query_returns_all_in_order() {
        let results = search("", &["a", "b", "c"], 2);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].index, 0);
    }

    #[test]
    fn positions_are_reported() {
        let positions = match_positions("abc", "a-b-c").unwrap();
        assert_eq!(positions, vec![0, 2, 4]);
    }
}
