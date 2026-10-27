/**
 * 示例应用装配。
 *
 * 这个包不修改框架内部：它只是新增一个 Cordis 插件，通过公开服务注册视图、
 * 命令与 Ribbon 条目，然后调用框架的 `createFrameworkApp`。
 */
import type { PluginEntry } from '@desktop-framework/core'
import { createDefaultPreset, createFrameworkApp } from '@desktop-framework/app'
import { pluginEntry } from '@desktop-framework/kernel'
import labPlugin from './plugin'

export interface CreatePlaygroundOptions {
  el: string | HTMLElement
  title?: string
  plugins?: PluginEntry[]
}

export async function createPlaygroundApp(options: CreatePlaygroundOptions) {
  const entries = [
    pluginEntry(labPlugin, undefined, {
      id: 'playground:lab',
      name: '插件实验室',
      version: '0.1.0',
      description: '演示如何通过公开 API 扩展视图、命令与 Ribbon',
    }),
    ...(options.plugins ?? []),
  ]
  return createFrameworkApp({
    el: options.el,
    title: options.title ?? 'Desktop Framework',
    preset: createDefaultPreset(),
    plugins: entries,
  })
}

export { labPlugin }
