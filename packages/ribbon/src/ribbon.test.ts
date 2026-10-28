import type { StorageLike } from '@df/settings'
import { apply as commandsPlugin } from '@df/commands'
import { createFrameworkContext } from '@df/kernel'
import { apply as keybindingsPlugin } from '@df/keybindings'
import { apply as settingsPlugin } from '@df/settings'
import { describe, expect, it } from 'vitest'
import { apply as ribbonPlugin } from '../src'

function fakeStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: key => void map.delete(key),
    key: index => [
      ...map.keys(),
    ][index] ?? null,
  }
}

async function setup(backend = fakeStorage()) {
  const ctx = await createFrameworkContext({ environment: 'test' })
  await ctx.plugin(settingsPlugin, {
    namespace: 'test',
    storage: backend,
  })
  await ctx.plugin(commandsPlugin)
  await ctx.plugin(keybindingsPlugin)
  await ctx.plugin(ribbonPlugin)
  return { ctx, backend }
}

describe('ribbon', () => {
  it('builds tabs from command placement', async () => {
    const { ctx } = await setup()
    ctx.commands.register({
      id: 'test.hello',
      title: 'Hello',
      icon: 'wave',
      ribbon: {
        tab: 'home',
        tabTitle: '主页',
        group: '演示',
        order: 1,
      },
      run: () => undefined,
    })
    const home = ctx.ribbon.tabs.find(tab => tab.id === 'home')
    expect(home?.title).toBe('主页')
    const group = home?.groups.find(candidate => candidate.title === '演示')
    expect(group?.items[0].command).toBe('test.hello')
    await ctx.kernel.dispose()
  })

  it('toggles the ribbon tab placement', async () => {
    const { ctx, backend } = await setup()
    expect(ctx.ribbon.tabPlacement).toBe('titlebar')
    expect(ctx.commands.isChecked('ribbon.toggleTabPlacement')).toBe(true)
    ctx.ribbon.toggleTabPlacement()
    expect(ctx.ribbon.tabPlacement).toBe('separate')
    expect(ctx.commands.isChecked('ribbon.toggleTabPlacement')).toBe(false)
    expect(JSON.parse(backend.getItem('test:ribbon.tabPlacement') ?? 'null')).toBe('separate')
    ctx.ribbon.setTabPlacement('titlebar')
    expect(ctx.ribbon.tabPlacement).toBe('titlebar')
    expect(JSON.parse(backend.getItem('test:ribbon.tabPlacement') ?? 'null')).toBe('titlebar')
    await ctx.kernel.dispose()
  })

  it('reflects dynamic checked state', async () => {
    const { ctx } = await setup()
    let checked = false
    ctx.commands.register({
      id: 'test.toggle',
      title: 'Toggle',
      checked: () => checked,
      ribbon: { tab: 'view', group: '布局' },
      run: () => {
        checked = !checked
      },
    })
    let item = ctx.ribbon.tabs.find(tab => tab.id === 'view')?.groups[0].items[0]
    expect(item?.pressed).toBe(false)
    checked = true
    item = ctx.ribbon.tabs.find(tab => tab.id === 'view')?.groups[0].items[0]
    expect(item?.pressed).toBe(true)
    await ctx.kernel.dispose()
  })
})
