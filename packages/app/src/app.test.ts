import { pluginEntry } from '@df/kernel'
import pinia from '@df/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createDefaultPreset, createFrameworkApp } from './index'

afterEach(() => document.body.replaceChildren())

const component = defineComponent({
  render: () => h('div', 'Custom shell'),
})

describe('application composition', () => {
  it('settles the complete default service graph before mounting a host shell', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const preset = createDefaultPreset().map(entry => entry.manifest?.id === 'framework:wasm'
      ? {
          ...entry,
          config: { preload: false },
        }
      : entry)
    const app = await createFrameworkApp({
      el: target,
      preset,
      shell: { component },
    })
    try {
      expect(app.shell.mounted).toBe(true)
      expect(app.ctx.kernel.plugins.every(info => info.status === 'loaded')).toBe(true)
      expect(app.ctx.workbench).toBeDefined()
    }
    finally { await app.dispose() }
  })

  it('supports a minimal host without the default workbench and canvas', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const app = await createFrameworkApp({
      el: target,
      preset: [
        pluginEntry(pinia),
      ],
      shell: { component, inject: [] },
    })
    try {
      expect(target.textContent).toBe('Custom shell')
      expect(app.ctx.kernel.plugins.map(info => info.id)).toEqual(['framework:pinia', 'framework:shell'])
    }
    finally {
      await app.dispose()
    }
    expect(target.textContent).toBe('')
  })

  it('mounts the shell before loading deferred plugins', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    let applied = false
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = await createFrameworkApp({
      el: target,
      preset: [
        pluginEntry(pinia),
      ],
      shell: { component, inject: [] },
      deferred: async () => {
        await gate
        return [
          pluginEntry({
            name: 'deferred-fixture',
            apply() {
              applied = true
            },
          }),
        ]
      },
    })
    try {
      expect(app.shell.mounted).toBe(true)
      expect(applied).toBe(false)
      release()
      await app.ready
      expect(applied).toBe(true)
      expect(app.ctx.kernel.plugins.some(info => info.id === 'deferred-fixture')).toBe(true)
    }
    finally {
      await app.dispose()
    }
  })

  it('disposes already loaded plugins when shell mounting fails', async () => {
    let disposed = false
    await expect(createFrameworkApp({
      el: '#missing-target',
      preset: [
        pluginEntry(pinia),
        pluginEntry({
          name: 'fixture',
          apply(ctx) {
            ctx.effect(() => () => {
              disposed = true
            })
          },
        }),
      ],
      shell: { component, inject: [] },
    })).rejects.toThrow('外壳插件加载失败')
    expect(disposed).toBe(true)
  })
})
