/* tslint:disable */
/* eslint-disable */

/**
 * 计算单个候选的分数。
 */
export function fuzzyScore(query: string, candidate: string): number;

/**
 * 对 JSON 字符串数组执行模糊搜索。
 *
 * 参数：
 * - `query`：查询文本；
 * - `candidates_json`：`["..."]`；
 * - `limit`：最多返回条数。
 *
 * 返回 `[{ "index": 0, "score": 120, "positions": [0, 2] }]`。
 *
 * # Errors
 *
 * JSON 结构不合法时返回 `JsError`。
 */
export function fuzzySearch(query: string, candidates_json: string, limit: number): string;

/**
 * 安装 panic hook。
 */
export function start(): void;

/**
 * 版本号。
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly fuzzyScore: (a: number, b: number, c: number, d: number) => number;
    readonly fuzzySearch: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly start: () => void;
    readonly version: (a: number) => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
