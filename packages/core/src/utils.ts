/** 通用小工具，保持零依赖与可 tree-shake。 */

/** 下一个微任务。 */
export function nextTick(): Promise<void> {
  return Promise.resolve()
}

/** 创建可控 Promise。 */
export function createDeferred<T = void>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 夹取数值。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 生成短 id。 */
export function createId(prefix = 'df'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/** 安全执行，返回错误而不是抛出。 */
export function safeCall<T>(fn: () => T): { ok: true, value: T } | { ok: false, error: unknown } {
  try {
    return {
      ok: true,
      value: fn(),
    }
  }
  catch (error) {
    return { ok: false, error }
  }
}

/** 合并多个 AbortSignal。 */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals)
  }
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

/** 防抖。 */
export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 150): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, delay)
  }
}

/** 节流。 */
export function throttle<T extends (...args: never[]) => void>(fn: T, interval = 16): (...args: Parameters<T>) => void {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Parameters<T> | undefined
  return (...args: Parameters<T>) => {
    const now = performance.now()
    const remaining = interval - (now - last)
    if (remaining <= 0) {
      last = now
      fn(...args)
    }
    else {
      pending = args
      timer ??= setTimeout(() => {
        timer = undefined
        last = performance.now()
        if (pending) {
          fn(...pending)
          pending = undefined
        }
      }, remaining)
    }
  }
}

/** 将未知错误转为可读字符串。 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return JSON.stringify(error)
}
