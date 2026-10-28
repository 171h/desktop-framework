/**
 * @df/wasm · WASM 热路径
 *
 * 命令面板在候选很多时调用 Rust 模糊搜索；WASM 未构建、加载失败或运行在
 * 测试环境时自动退回等价的 TypeScript 实现，保证框架仍可启动。
 */
import type { Context } from 'cordis'
import { errorMessage } from '@df/core'
import { Service } from 'cordis'
import { ref } from 'vue'
// 生成物由 `pnpm build:wasm` 输出；提交生成物以便无 Rust 环境也能启动。
import init, {
  fuzzyScore as wasmFuzzyScore,
  fuzzySearch as wasmFuzzySearch,
  version as wasmVersion,
} from '../generated/df_wasm.js'

declare module 'cordis' {
  interface Context {
    wasm: WasmService
  }
}

/** 搜索命中。 */
export interface FuzzyResult {
  index: number
  score: number
  positions: number[]
}

/** WASM 服务配置。 */
export interface WasmConfig {
  /** 是否自动初始化。 */
  preload?: boolean
}

/** 服务状态。 */
export type WasmStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export class WasmService extends Service {
  private readonly statusRef = ref<WasmStatus>('idle')
  private readyPromise?: Promise<void>
  private wasmVersion = ''

  constructor(ctx: Context, config: WasmConfig = {}) {
    super(ctx, 'wasm')
    if (config.preload !== false) {
      void this.init()
    }
  }

  get status(): WasmStatus {
    return this.statusRef.value
  }

  get version(): string {
    return this.wasmVersion
  }

  /** 初始化 WASM；重复调用复用同一个 Promise。 */
  init(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise
    }
    this.statusRef.value = 'loading'
    this.readyPromise = init()
      .then(() => {
        this.wasmVersion = wasmVersion()
        this.statusRef.value = 'ready'
      })
      .catch((error) => {
        this.statusRef.value = 'unavailable'
        this.ctx.logger.warn(`[wasm] 初始化失败，使用 TypeScript 降级：${errorMessage(error)}`)
      })
    return this.readyPromise
  }

  /** 模糊搜索。 */
  async fuzzySearch(query: string, candidates: readonly string[], limit = 30): Promise<FuzzyResult[]> {
    if (this.statusRef.value === 'idle') {
      await this.init()
    }
    if (this.statusRef.value === 'ready') {
      try {
        const results = JSON.parse(wasmFuzzySearch(query, JSON.stringify(candidates), limit)) as FuzzyResult[]
        return results
      }
      catch (error) {
        this.ctx.logger.warn(`[wasm] 搜索失败，使用降级实现：${errorMessage(error)}`)
      }
    }
    return fallbackSearch(query, candidates, limit)
  }

  /** 单候选分数。 */
  score(query: string, candidate: string): number {
    if (this.statusRef.value === 'ready') {
      return wasmFuzzyScore(query, candidate)
    }
    return fallbackScore(query, candidate) ?? -1
  }
}

export const name = 'framework:wasm'
export const inject: string[] = []

export function apply(ctx: Context, config: WasmConfig = {}): void {
  ctx.plugin(WasmService, config)
}

export default { name, inject, apply }

function fallbackSearch(query: string, candidates: readonly string[], limit: number): FuzzyResult[] {
  return candidates
    .map((candidate, index) => {
      const score = fallbackScore(query, candidate)
      return score === null
        ? null
        : {
            index,
            score,
            positions: fallbackPositions(query, candidate),
          }
    })
    .filter((result): result is FuzzyResult => result !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
}

function fallbackScore(query: string, candidate: string): number | null {
  if (!query) {
    return 0
  }
  const lowerQuery = query.toLowerCase()
  const lowerCandidate = candidate.toLowerCase()
  let queryIndex = 0
  let score = 0
  let previous = -2
  for (let index = 0; index < lowerCandidate.length && queryIndex < lowerQuery.length; index++) {
    if (lowerCandidate[index] !== lowerQuery[queryIndex]) {
      continue
    }
    score += 10
    if (previous === index - 1) {
      score += 12
    }
    const before = candidate[index - 1]
    if (index === 0) {
      score += 18
    }
    else if (before && /[\s\-_:./\\>]/.test(before)) {
      score += 16
    }
    else if (before === before.toLowerCase() && candidate[index] === candidate[index].toUpperCase()) {
      score += 12
    }
    previous = index
    queryIndex++
  }
  return queryIndex === lowerQuery.length
    ? score - Math.floor(candidate.length / 4)
    : null
}

function fallbackPositions(query: string, candidate: string): number[] {
  const positions: number[] = []
  let target = 0
  for (let index = 0; index < candidate.length && target < query.length; index++) {
    if (candidate[index].toLowerCase() === query[target].toLowerCase()) {
      positions.push(index)
      target++
    }
  }
  return positions
}
