/**
 * @desktop-framework/notifications · 通知中心
 *
 * 通知状态使用 Vue 响应式数组，宿主的通知 UI 直接消费；命令失败会被自动
 * 转成错误通知，避免每个调用点重复处理。
 */
import type { FrameworkNotification, NotificationLevel } from '@desktop-framework/core'
import type { Context } from 'cordis'
import { errorMessage } from '@desktop-framework/core'
import { Service } from 'cordis'
import { ref } from 'vue'

declare module 'cordis' {
  interface Context {
    notifications: NotificationService
  }
}

/** 通知服务。 */
export class NotificationService extends Service {
  private readonly items = ref<FrameworkNotification[]>([])
  private nextId = 0
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>()

  constructor(ctx: Context) {
    super(ctx, 'notifications')
    ctx.on('command/failed', (_id, error) => {
      this.error(errorMessage(error))
    })
    ctx.effect(() => () => {
      for (const timer of this.timers.values()) {
        clearTimeout(timer)
      }
      this.timers.clear()
    }, 'notifications:timers')
  }

  /** 当前通知。 */
  get list(): readonly FrameworkNotification[] {
    return this.items.value
  }

  /** 推送通知。 */
  notify(message: string, level: NotificationLevel = 'info', timeout = level === 'error'
    ? 0
    : 6000): number {
    const id = ++this.nextId
    const notification: FrameworkNotification = { id, message, level, timeout }
    this.items.value = [...this.items.value, notification]
    this.ctx.emit('notification/added', id)
    if (timeout > 0) {
      this.timers.set(id, setTimeout(() => this.dismiss(id), timeout))
    }
    return id
  }

  /** 便捷方法。 */
  info(message: string, timeout?: number): number {
    return this.notify(message, 'info', timeout)
  }

  success(message: string, timeout?: number): number {
    return this.notify(message, 'success', timeout)
  }

  warning(message: string, timeout?: number): number {
    return this.notify(message, 'warning', timeout)
  }

  error(message: string, timeout = 0): number {
    return this.notify(message, 'error', timeout)
  }

  /** 关闭通知。 */
  dismiss(id: number): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
    this.items.value = this.items.value.filter(item => item.id !== id)
  }

  /** 清空。 */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.items.value = []
  }
}

/** 插件 id。 */
export const name = 'framework:notifications'
export const inject: string[] = []

/** 插件主体。 */
export function apply(ctx: Context): void {
  ctx.plugin(NotificationService)
}

export default { name, inject, apply }
