/**
 * 启动计时器。
 *
 * 设计参考 VS Code `src/vs/base/common/performance.ts` 与 workbench 启动
 * 阶段标记：主进程、preload、渲染进程共享 `df/startup/*` 命名空间，最终
 * 可通过 IPC 汇总为一条启动链路。
 *
 * 该文件暂放在 `packages/vscode`，后续可迁入 `vscode-instantiation`。
 */
import { getMarks, mark } from 'vscode-instantiation/common/performance'

const PREFIX = 'df/startup/'

/** 启动阶段。 */
export interface StartupPhase {
  name: string
  /** 相对 `timeOrigin` 的毫秒数。 */
  at: number
  /** 与上一阶段的差值。 */
  delta: number
}

/** 启动计时器。 */
export class StartupTimer {
  private readonly phases: StartupPhase[] = []
  private last = 0

  constructor(private readonly scope: string) {
    this.mark('origin')
  }

  /** 记录一个阶段，同时写入浏览器 performance timeline。 */
  mark(name: string): void {
    const label = `${PREFIX}${this.scope}/${name}`
    mark(label)
    const now = performance.now()
    this.phases.push({
      name,
      at: now,
      delta: this.last === 0
        ? now
        : now - this.last,
    })
    this.last = now
  }

  /** 返回当前阶段快照。 */
  snapshot(): readonly StartupPhase[] {
    return this.phases
  }

  /** 导出给主进程或日志系统。 */
  report(): {
    scope: string
    totalMs: number
    phases: readonly StartupPhase[]
    marks: ReturnType<typeof getMarks>
  } {
    return {
      scope: this.scope,
      totalMs: this.last,
      phases: this.phases,
      marks: getMarks(),
    }
  }
}
