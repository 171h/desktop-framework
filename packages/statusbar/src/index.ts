/**
 * @desktop-framework/statusbar · 状态栏
 *
 * 插件注册状态项，组件按左右分组渲染。动态项通过 `getText` 读取最新值，
 * 与命令系统相同，界面不缓存业务状态。
 */
import type { IDisposable, StatusBarItem } from '@desktop-framework/core'
import type { Context } from 'cordis'
import { Service } from 'cordis'
import { ref } from 'vue'

declare module 'cordis' {
  interface Context {
    statusbar: StatusBarService
  }
}

/** 状态栏服务。 */
export class StatusBarService extends Service {
  static inject = ['commands']

  private readonly itemMap = ref(new Map<string, StatusBarItem>())
  private readonly message = ref('就绪')

  constructor(ctx: Context) {
    super(ctx, 'statusbar')
  }

  /** 全部状态项。 */
  get items(): readonly StatusBarItem[] {
    return [
      ...this.itemMap.value.values(),
    ].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  }

  /** 当前状态消息。 */
  get statusMessage(): string {
    return this.message.value
  }

  /** 注册状态项。 */
  register(item: StatusBarItem): IDisposable {
    this.itemMap.value.set(item.id, item)
    this.itemMap.value = new Map(this.itemMap.value)
    return {
      dispose: () => {
        this.itemMap.value.delete(item.id)
        this.itemMap.value = new Map(this.itemMap.value)
      },
    }
  }

  /** 设置状态消息。 */
  setMessage(message: string): void {
    this.message.value = message
  }

  /** 读取动态文本。 */
  text(item: StatusBarItem): string {
    try {
      return item.getText?.() ?? item.text
    }
    catch {
      return item.text
    }
  }
}

/** 插件 id。 */
export const name = 'framework:statusbar'
export const inject = ['commands']

/** 插件主体。 */
export function apply(ctx: Context): void {
  ctx.plugin(StatusBarService)
}

export default { name, inject, apply }
