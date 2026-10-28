/**
 * 跨窗口状态同步。
 *
 * 独立面板和编辑器窗口拥有各自的服务实例；选择状态通过主进程广播同步，
 * 让属性面板、资源树和画布在多个窗口之间保持一致。
 */
import type { SelectionItem } from '@df/selection'
import type { Context } from 'cordis'

export const name = 'framework:window-sync'
export const inject = ['platform', 'selection']

export function apply(ctx: Context): void {
  if (!ctx.platform.isElectron) {
    return
  }
  const state = {
    applying: false,
    main: false,
  }

  ctx.on('selection/changed', (item) => {
    if (!state.applying) {
      ctx.platform.sendWindowMessage('selection', item)
    }
  })

  ctx.effect(() => ctx.platform.onWindowMessage((message) => {
    if (message.topic === 'selection/request') {
      if (state.main) {
        ctx.platform.sendWindowMessage('selection', ctx.selection.current.value)
      }
      return
    }
    if (message.topic !== 'selection') {
      return
    }
    const item = message.payload as SelectionItem | null
    state.applying = true
    try {
      if (item) {
        ctx.selection.select(item)
      }
      else {
        ctx.selection.clear()
      }
    }
    finally {
      state.applying = false
    }
  }).dispose, 'window-sync:messages')

  void ctx.platform.getWindowContext().then((context) => {
    state.main = !context
    if (!state.main) {
      ctx.platform.sendWindowMessage('selection/request', null)
    }
  })
}

export default { name, inject, apply }
