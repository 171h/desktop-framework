/**
 * 生命周期原语，统一从 `vscode-instantiation` 重新导出。
 *
 * 框架内的窗口、会话、IPC 监听器等资源应使用 `DisposableStore` 管理，
 * 而不是手写数组与布尔标记。
 */
export {
  combinedDisposable,
  DisposableStore,
  dispose,
  disposeIfDisposable,
  isDisposable,
  markAsDisposed,
  markAsSingleton,
  toDisposable,
  trackDisposable,
} from 'vscode-instantiation/common/lifecycle'

export type { IDisposable } from 'vscode-instantiation/common/lifecycle'
