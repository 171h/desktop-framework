/**
 * 默认插件清单。
 *
 * 顺序代表首次加载顺序；依赖关系仍由 Cordis inject 解析。宿主可以传入
 * `include` / `exclude` 裁剪能力，或追加自己的插件。
 */
import type { PluginEntry } from '@desktop-framework/core'
import commands from '@desktop-framework/commands'
import explorer from '@desktop-framework/explorer'
import { pluginEntry } from '@desktop-framework/kernel'
import keybindings from '@desktop-framework/keybindings'
import menu from '@desktop-framework/menu'
import notifications from '@desktop-framework/notifications'
import output from '@desktop-framework/output'
import platform from '@desktop-framework/platform'
import properties from '@desktop-framework/properties'
import ribbon from '@desktop-framework/ribbon'
import selection from '@desktop-framework/selection'
import settings from '@desktop-framework/settings'
import statusbar from '@desktop-framework/statusbar'
import surface from '@desktop-framework/surface'
import ui from '@desktop-framework/ui'
import pinia from '@desktop-framework/vue'
import wasm from '@desktop-framework/wasm'
import workbench from '@desktop-framework/workbench'
import appCommands from './commands'

export interface PresetOptions {
  /** 只加载这些插件 id。 */
  include?: string[]
  /** 排除这些插件 id。 */
  exclude?: string[]
  /** 追加插件。 */
  extra?: PluginEntry[]
}

/** 默认清单。 */
export function createDefaultPreset(options: PresetOptions = {}): PluginEntry[] {
  const entries: PluginEntry[] = [
    pluginEntry(pinia, undefined, {
      id: 'framework:pinia',
      name: 'Pinia 状态',
      version: '0.1.0',
      description: '为插件提供共享 Pinia 实例',
    }),
    pluginEntry(settings, { namespace: 'desktop-framework' }, {
      id: 'framework:settings',
      name: '本地设置',
      version: '0.1.0',
      description: '命名空间化的本地存储',
    }),
    pluginEntry(commands, undefined, {
      id: 'framework:commands',
      name: '命令注册表',
      version: '0.1.0',
      description: '统一命令与执行状态',
    }),
    pluginEntry(keybindings, undefined, {
      id: 'framework:keybindings',
      name: '快捷键',
      version: '0.1.0',
      description: '跨平台快捷键解析与分发',
    }),
    pluginEntry(ui, undefined, {
      id: 'framework:ui',
      name: '界面基础层',
      version: '0.1.0',
      description: '主题、槽位、对话框与 nusys-ui 包装',
    }),
    pluginEntry(notifications, undefined, {
      id: 'framework:notifications',
      name: '通知中心',
      version: '0.1.0',
      description: '错误与操作反馈',
    }),
    pluginEntry(statusbar, undefined, {
      id: 'framework:statusbar',
      name: '状态栏',
      version: '0.1.0',
      description: '可扩展状态项',
    }),
    pluginEntry(workbench, undefined, {
      id: 'framework:workbench',
      name: '工作台',
      version: '0.1.0',
      description: '布局、停靠视图与工作区',
    }),
    pluginEntry(ribbon, undefined, {
      id: 'framework:ribbon',
      name: '功能区',
      version: '0.1.0',
      description: '命令驱动的 Ribbon',
    }),
    pluginEntry(menu, undefined, {
      id: 'framework:menu',
      name: '应用菜单',
      version: '0.1.0',
      description: '应用菜单与快速访问工具栏',
    }),
    pluginEntry(platform, undefined, {
      id: 'framework:platform',
      name: '平台能力',
      version: '0.1.0',
      description: '浏览器与 Electron 宿主适配',
    }),
    pluginEntry(wasm, { preload: true }, {
      id: 'framework:wasm',
      name: 'WASM 热路径',
      version: '0.1.0',
      description: '模糊搜索与 Rust 计算',
    }),
    pluginEntry(selection, undefined, {
      id: 'framework:selection',
      name: '选择状态',
      version: '0.1.0',
      description: '跨插件共享选中对象',
    }),
    pluginEntry(explorer, undefined, {
      id: 'framework:explorer',
      name: '资源浏览器',
      version: '0.1.0',
      description: '工作区与插件树',
    }),
    pluginEntry(properties, undefined, {
      id: 'framework:properties',
      name: '属性面板',
      version: '0.1.0',
      description: '选择对象详情',
    }),
    pluginEntry(output, undefined, {
      id: 'framework:output',
      name: '输出面板',
      version: '0.1.0',
      description: '运行日志与诊断',
    }),
    pluginEntry(surface, undefined, {
      id: 'framework:surface',
      name: '工作流画布',
      version: '0.1.0',
      description: 'WebGL2 无限画布',
    }),
    pluginEntry(appCommands, undefined, {
      id: 'framework:app-commands',
      name: '应用命令',
      version: '0.1.0',
      description: '保存工作区、帮助与退出',
    }),
  ]
  const filtered = entries.filter((entry) => {
    const id = entry.manifest?.id
    return (!options.include || !id || options.include.includes(id))
      && (!options.exclude || !id || !options.exclude.includes(id))
  })
  return [
    ...filtered,
    ...(options.extra ?? []),
  ]
}

/** 默认插件清单。 */
export const defaultPreset: PluginEntry[] = createDefaultPreset()
