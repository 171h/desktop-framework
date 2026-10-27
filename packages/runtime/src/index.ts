/**
 * 远程运行时公共入口。
 *
 * 该入口会被打包成单文件 ESM 归档，由 `@desktop-framework/bootstrap` 按
 * commit 下载并缓存。宿主通过 `createFrameworkApp` 启动，并通过
 * `definePlugin` / `pluginEntry` 扩展。
 */
export { AppShell, createDefaultPreset, createFrameworkApp, defaultPreset } from '@desktop-framework/app'
export {
  clamp,
  createDeferred,
  debounce,
  errorMessage,
  throttle,
} from '@desktop-framework/core'
export type {
  CommandDefinition,
  FrameworkPluginManifest,
  PluginEntry,
  RibbonPlacement,
  ViewDefinition,
  WorkbenchLayout,
  WorkspacePreset,
} from '@desktop-framework/core'
export {
  createFrameworkContext,
  definePlugin,
  definePluginModule,
  detectEnvironment,
  KernelService,
  loadPlugins,
  pluginEntry,
  version,
} from '@desktop-framework/kernel'
