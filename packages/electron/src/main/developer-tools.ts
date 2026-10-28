import type { WebContents } from 'electron'

/** IPC 参数必须在主进程校验；只操作发起请求的可信窗口。 */
export function executeDeveloperAction(contents: WebContents, action: unknown, devToolsEnabled = true): void {
  switch (action) {
    case 'toggleDevTools':
      if (!devToolsEnabled) {
        throw new Error('宿主已关闭开发者工具')
      }
      contents.toggleDevTools()
      return
    case 'reload':
    case 'reloadIgnoringCache':
      // 先回复 invoke 再刷新，避免销毁发起 IPC 的 frame 导致 Promise 拒绝。
      setTimeout(() => {
        if (contents.isDestroyed())
          return
        if (action === 'reload')
          contents.reload()
        else contents.reloadIgnoringCache()
      }, 0)
      return
    default:
      throw new TypeError('未知的开发者操作')
  }
}
