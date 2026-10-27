export * from './startup'
/**
 * 性能追踪入口。
 *
 * `mark` / `getMarks` 直接来自 `vscode-instantiation` 的 VS Code 实现；
 * `StartupTimer` 是框架对 VS Code 启动阶段标记模式的轻量封装。
 */
export { clearMarks, getMarks, mark } from 'vscode-instantiation/common/performance'
export type { PerformanceMark } from 'vscode-instantiation/common/performance'
