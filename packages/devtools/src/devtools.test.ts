import type { DesktopBridge, SaveFileRequest } from '@df/core'
import type { Context } from 'cordis'
import { CommandService } from '@df/commands'
import { EditorService } from '@df/editor'
import { createFrameworkContext, pluginEntry } from '@df/kernel'
import { PlatformService } from '@df/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import devtools from './index'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.kernel.dispose()))
  delete window.desktopFramework
})

async function setup(bridge?: Partial<DesktopBridge>) {
  window.desktopFramework = bridge as DesktopBridge | undefined
  const ctx = await createFrameworkContext({ environment: 'test' })
  contexts.push(ctx)
  await ctx.plugin(CommandService)
  await ctx.plugin(EditorService)
  await ctx.plugin(PlatformService)
  ctx.provide('workbench', {
    views: [],
    openView: vi.fn(),
  } as unknown as Context['workbench'])
  await ctx.kernel.loadOne(pluginEntry(devtools))
  return ctx
}

describe('developer tools plugin', () => {
  it('contributes Ribbon commands and disables unsupported browser operations', async () => {
    const ctx = await setup()
    const commands = ctx.commands.visible().filter(command => command.category === '开发者')
    expect(commands).toHaveLength(6)
    expect(commands.every(command => !Array.isArray(command.ribbon) && command.ribbon?.tab === 'developer')).toBe(true)
    expect(ctx.commands.isEnabled('developer.toggleDevTools')).toBe(false)
    expect(ctx.commands.isEnabled('developer.reloadIgnoringCache')).toBe(false)
    expect(ctx.commands.isEnabled('developer.showDiagnostics')).toBe(true)
    await expect(ctx.platform.developerAction('toggleDevTools')).rejects.toThrow('不支持')
  })

  it('uses the desktop bridge and blocks reload while documents are dirty', async () => {
    const developerAction = vi.fn(async () => {})
    const ctx = await setup({ platform: 'win32', developerAction })
    await ctx.commands.execute('developer.toggleDevTools')
    expect(developerAction).toHaveBeenCalledWith('toggleDevTools')
    ctx.editor.open({
      id: 'dirty',
      title: 'Dirty',
      component: {},
      dirty: true,
    })
    await expect(ctx.commands.execute('developer.reloadWindow')).rejects.toThrow('不可用')
    const event = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    ctx.editor.setDirty('dirty', false)
    await ctx.commands.execute('developer.reloadIgnoringCache')
    expect(developerAction).toHaveBeenCalledWith('reloadIgnoringCache')
  })

  it('opens one diagnostics document and removes contributions on unload', async () => {
    const ctx = await setup()
    await ctx.commands.execute('developer.showDiagnostics')
    await ctx.commands.execute('developer.showDiagnostics')
    expect(ctx.editor.documents.filter(document => document.id === 'developer.diagnostics')).toHaveLength(1)
    await ctx.kernel.unload('framework:devtools')
    expect(ctx.commands.has('developer.showDiagnostics')).toBe(false)
    expect(ctx.editor.documents.some(document => document.id === 'developer.diagnostics')).toBe(false)
    ctx.editor.open({
      id: 'dirty',
      title: 'Dirty',
      component: {},
      dirty: true,
    })
    const event = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('exports a diagnostic snapshot without host paths or configuration secrets', async () => {
    const saveFile = vi.fn(async (_request: SaveFileRequest) => 'diagnostics.json')
    const ctx = await setup({
      platform: 'win32',
      versions: { app: '1.0', electron: '45' },
      saveFile,
      getRuntime: async () => ({
        mode: 'remote',
        repository: 'https://example.com/repo',
        commit: 'a'.repeat(40),
        directory: 'PRIVATE_PATH',
        entryUrl: 'df-runtime://aaaaaaa/index.js',
        cached: true,
      }),
      getDeveloperDiagnostics: async () => ({
        startup: [
          { name: 'boot', at: 10, delta: 10 },
        ],
        processes: [
          {
            pid: 42,
            type: 'Browser',
            cpuPercent: 0,
            memoryMB: 80,
          },
        ],
      }),
    })
    await ctx.commands.execute('developer.exportDiagnostics')
    const request = saveFile.mock.calls[0][0]
    const json = new TextDecoder().decode(request.data)
    const snapshot = JSON.parse(json)
    expect(snapshot.plugins.some((plugin: { id: string }) => plugin.id === 'framework:devtools')).toBe(true)
    expect(snapshot.desktop.processes[0].pid).toBe(42)
    expect(snapshot.runtime.commit).toBe('a'.repeat(40))
    expect(json).not.toContain('PRIVATE_PATH')
  })
})
