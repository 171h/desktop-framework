/**
 * 远程运行时公共入口。
 *
 * 该入口会被打包成单文件 ESM 归档，由 `@df/bootstrap` 按
 * commit 下载并缓存。宿主通过 `createFrameworkApp` 启动，并通过
 * `definePlugin` / `pluginEntry` 扩展。
 */
export { AppShell, createDefaultPreset, createFrameworkApp, defaultPreset } from '@df/app'
export {
  clamp,
  createDeferred,
  debounce,
  errorMessage,
  throttle,
} from '@df/core'
export type {
  CommandDefinition,
  DockEdge,
  DockGroupNode,
  DockingLayout,
  DockNode,
  DockPlacement,
  DockSide,
  DockSplitNode,
  FloatingDockState,
  FloatingPanel,
  FrameworkPluginManifest,
  PluginEntry,
  RibbonPlacement,
  RibbonTabPlacement,
  SidebarId,
  ViewDefinition,
  WorkbenchLayout,
  WorkspacePreset,
} from '@df/core'
export {
  createFrameworkContext,
  definePlugin,
  definePluginModule,
  detectEnvironment,
  KernelService,
  loadPlugins,
  pluginEntry,
  version,
} from '@df/kernel'
