export * from './instantiation'
/**
 * VS Code 兼容适配层。
 *
 * 生命周期与依赖注入直接使用 `vscode-instantiation`。性能追踪等尚未发布到
 * 该包的能力先放在本目录的 `performance/` 中，后续整体迁移到 npm 包后可以
 * 只替换这里的导出。
 */
export * from './lifecycle'
export * from './performance'
