/**
 * 示例应用装配。
 *
 * 这个包不修改框架内部：它只是新增一个 Cordis 插件，通过公开服务注册视图、
 * 命令与 Ribbon 条目，然后调用框架的 `createFrameworkApp`。
 */
import type { PluginEntry } from '@df/core'
import type { Component } from 'vue'
import { createDefaultPreset, createFrameworkApp } from '@df/app'
import { pluginEntry } from '@df/kernel'
import labPlugin from './plugin'

export interface CreatePlaygroundOptions {
  el: string | HTMLElement
  title?: string
  plugins?: PluginEntry[]
  /** 自定义外壳；独立窗口使用精简外壳。 */
  shell?: { component: Component, inject?: string[] }
  /** 自定义外壳的根组件属性。 */
  shellProps?: Record<string, unknown>
}

/** 这些插件不阻塞首屏：外壳挂载后再注册视图、画布和开发者工具。 */
const DEFERRED_IDS = new Set([
  'framework:explorer',
  'framework:properties',
  'framework:output',
  'framework:devtools',
  'framework:surface',
])

export async function createPlaygroundApp(options: CreatePlaygroundOptions) {
  const preset = createDefaultPreset()
  const eager = preset.filter(entry => !DEFERRED_IDS.has(entry.manifest?.id ?? ''))
  const deferred = preset.filter(entry => DEFERRED_IDS.has(entry.manifest?.id ?? ''))
  const lab = pluginEntry(labPlugin, undefined, {
    id: 'playground:lab',
    name: '插件实验室',
    version: '0.1.0',
    description: '演示如何通过公开 API 扩展视图、命令与 Ribbon',
  })
  const app = await createFrameworkApp({
    el: options.el,
    title: options.title ?? 'Desktop Framework',
    preset: eager,
    plugins: options.plugins ?? [],
    deferred: [
      ...deferred,
      lab,
    ],
    shell: options.shell,
    shellProps: options.shellProps,
  })
  scheduleIdle(() => {
    void app.ctx.wasm?.init()
  })
  return app
}

function scheduleIdle(task: () => void): void {
  const idle = (globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }).requestIdleCallback
  if (idle) {
    idle(task, { timeout: 1500 })
    return
  }
  setTimeout(task, 200)
}

export { labPlugin }
