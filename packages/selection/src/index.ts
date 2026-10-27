/**
 * @desktop-framework/selection · 通用选择状态
 *
 * 选择对象由 `kind` 与 `id` 标识，`data` 为插件私有的只读载荷。资源树、
 * 画布、属性面板通过该服务协同，不直接互相依赖。
 */
import type { Context } from 'cordis'
import { Service } from 'cordis'
import { computed, shallowRef } from 'vue'

declare module 'cordis' {
  interface Context {
    selection: SelectionService
  }
}

export interface SelectionItem {
  id: string
  kind: string
  label: string
  description?: string
  data?: Record<string, unknown>
}

export class SelectionService extends Service {
  static inject: string[] = []

  private readonly item = shallowRef<SelectionItem | null>(null)
  readonly current = computed(() => this.item.value)

  constructor(ctx: Context) {
    super(ctx, 'selection')
    ctx.effect(() => () => {
      this.item.value = null
    }, 'selection:clear')
  }

  /** 设置选择。 */
  select(item: SelectionItem): void {
    this.item.value = item
    this.ctx.emit('selection/changed', item)
  }

  /** 清空。 */
  clear(): void {
    this.item.value = null
    this.ctx.emit('selection/changed', null)
  }

  /** 是否选中指定对象。 */
  isSelected(kind: string, id: string): boolean {
    return this.item.value?.kind === kind && this.item.value.id === id
  }

  /** 是否为某一类选择。 */
  hasKind(kind: string): boolean {
    return this.item.value?.kind === kind
  }
}

declare module 'cordis' {
  interface Events {
    'selection/changed': (item: SelectionItem | null) => void
  }
}

export const name = 'framework:selection'
export const inject: string[] = []

export function apply(ctx: Context): void {
  ctx.plugin(SelectionService)
}

export default { name, inject, apply }
