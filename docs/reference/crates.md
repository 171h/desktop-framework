# Rust crate

## df_fuzzy

命令面板、插件搜索使用的模糊匹配内核。

- 子序列匹配，大小写不敏感；
- 单词边界、camelCase、连续字符加分；
- 长度惩罚；
- 返回 `index`、`score`、`positions`；
- 纯 Rust，无文件系统/浏览器依赖，可编译到 `wasm32-unknown-unknown`。

```rust
let results = df_fuzzy::search("fmt", &["Format Document", "File: New"], 10);
```

### 测试

```bash
cargo test -p df_fuzzy
```

## df_wasm

通过 `wasm-bindgen` 暴露：

```ts
fuzzySearch(query, candidatesJson, limit): string
fuzzyScore(query, candidate): number
version(): string
```

结果使用 JSON，因为候选通常是数百到数千条命令，最终只返回命中项与位置；如果未来候选数量进一步增长，可以改为传入 `Float32Array`/字节缓冲。

### 构建

```bash
pnpm build:wasm
```

输出到 `packages/wasm/generated`：

- `df_wasm.js`
- `df_wasm.d.ts`
- `df_wasm_bg.wasm`

`wasm-pack` 使用 `--no-opt`，不依赖 Binaryen 下载。Cargo `wasm-release` profile 负责体积优化。

### 为什么没有更多 crate

模型导入、几何处理等能力已按最新需求移除。后续需要 CPU 密集功能时，继续按“一个模块一个 crate”的方式扩展，并通过 `df_wasm` 暴露。

## 原生 vs WASM

| crate | WASM | 说明 |
| --- | --- | --- |
| `df_fuzzy` | ✅ | 纯计算 |
| `df_wasm` | ✅ | wasm-bindgen 绑定 |

没有原生专用 crate；若未来加入文件系统、子进程或原生 SDK，会单独放在不可 WASM 的 crate 中并记录原因。
