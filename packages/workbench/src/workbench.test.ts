import type { StorageLike } from '@df/settings'
import { apply as commandsPlugin } from '@df/commands'
import { createFrameworkContext } from '@df/kernel'
import { apply as settingsPlugin } from '@df/settings'
import { apply as piniaPlugin } from '@df/vue'
import { describe, expect, it } from 'vitest'
import { apply as workbenchPlugin } from '../src'
import { groupForView } from './docking'

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
  await ctx.plugin(piniaPlugin)
  await ctx.plugin(settingsPlugin, { namespace: 'test', storage: backend })
  await ctx.plugin(commandsPlugin)
  await ctx.plugin(workbenchPlugin)
  return { ctx, backend }
}

describe('workbench', () => {
  it('persists split trees, tab selection, hidden panels and floating geometry on immediate restart', async () => {
    const { ctx, backend } = await setup()
    const register = (context: typeof ctx): void => {
      for (const id of ['a', 'b', 'c', 'd']) {
        context.workbench.registerView({
          id,
          title: id,
          location: id === 'a'
            ? 'left'
            : 'right',
        })
      }
    }
    register(ctx)
    const left = groupForView(ctx.workbench.docking, 'a')!
    const right = groupForView(ctx.workbench.docking, 'b')!
    ctx.workbench.movePanel(right.id, left.id, 'bottom', 'b')
    const floatingId = ctx.workbench.floatPanel(groupForView(ctx.workbench.docking, 'c')!.id, {
      x: 100,
      y: 120,
      width: 340,
      height: 420,
    }, 'c')!
    ctx.workbench.movePanel(groupForView(ctx.workbench.docking, 'd')!.id, groupForView(ctx.workbench.docking, 'a')!.id, 'center', 'd')
    ctx.workbench.activatePanel(groupForView(ctx.workbench.docking, 'a')!.id, 'd')
    ctx.workbench.hidePanel('c')
    const split = ctx.workbench.docking.roots.left!
    ctx.workbench.setPanelRatio(split.id, 0.35)
    const expected = JSON.parse(JSON.stringify(ctx.workbench.docking))
    // 没有等待 150ms 的防抖；页面退出必须同步保存最后一次操作。
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(backend.getItem('test:workbench')!).layout.docking).toEqual(expected)
    await ctx.kernel.dispose()
    const restored = await setup(backend)
    register(restored.ctx)
    expect(JSON.parse(JSON.stringify(restored.ctx.workbench.docking))).toEqual(expected)
    expect(restored.ctx.workbench.docking.floating.find(panel => panel.id === floatingId)?.geometry).toEqual({
      x: 100,
      y: 120,
      width: 340,
      height: 420,
    })
    await restored.ctx.commands.execute('view.restoreHiddenPanel')
    expect(restored.ctx.workbench.hiddenPanels).toHaveLength(0)
    expect(groupForView(restored.ctx.workbench.docking, 'a')?.activeView).toBe('d')
    await restored.ctx.kernel.dispose()
  })

  it('restores panels in their original groups and resets layouts without losing registered panels', async () => {
    const { ctx } = await setup()
    const registration = ctx.workbench.registerView({
      id: 'panel',
      title: 'Panel',
      location: 'left',
      keybinding: 'Mod+Alt+8',
    })
    const group = groupForView(ctx.workbench.docking, 'panel')!.id
    await ctx.commands.execute('view.toggle.panel')
    expect(ctx.workbench.hiddenPanels.map(view => view.id)).toContain('panel')
    ctx.workbench.openView('panel')
    expect(groupForView(ctx.workbench.docking, 'panel')!.id).toBe(group)
    ctx.workbench.applyWorkspace('focus')
    expect(ctx.workbench.hiddenPanels.map(view => view.id)).toContain('panel')
    ctx.workbench.applyWorkspace('modeling')
    expect(groupForView(ctx.workbench.docking, 'panel')).toBeDefined()
    expect(ctx.workbench.hiddenPanels).toHaveLength(0)
    registration.dispose()
    expect(ctx.commands.has('view.toggle.panel')).toBe(false)
    await ctx.kernel.dispose()
  })

  it('starts with modeling layout', async () => {
    const { ctx } = await setup()
    expect(ctx.workbench.layout.left.visible).toBe(true)
    expect(ctx.workbench.activeWorkspace.id).toBe('modeling')
    await ctx.kernel.dispose()
  })

  it('floats a composed region and restores all its hidden panels with one region shortcut', async () => {
    const { ctx } = await setup()
    ctx.workbench.registerView({ id: 'a', title: 'A', location: 'left' })
    ctx.workbench.registerView({ id: 'b', title: 'B', location: 'right' })
    ctx.workbench.movePanel('legacy-right', 'legacy-left', 'bottom')
    ctx.workbench.floatRegion('left')
    expect(ctx.workbench.docking.floating[0].node.type).toBe('split')
    ctx.workbench.hidePanel('a')
    ctx.workbench.hidePanel('b')
    expect(ctx.commands.isChecked('view.toggleLeft')).toBe(false)
    await ctx.commands.execute('view.toggleLeft')
    expect(ctx.workbench.hiddenPanels).toHaveLength(0)
    expect(ctx.workbench.docking.floating[0].node.type).toBe('split')
    await ctx.kernel.dispose()
  })

  it('creates a portable payload for a floating panel and removes it', async () => {
    const { ctx } = await setup()
    ctx.workbench.registerView({ id: 'a', title: 'A', location: 'left' })
    ctx.workbench.registerView({ id: 'b', title: 'B', location: 'left' })
    const group = groupForView(ctx.workbench.docking, 'a')!
    ctx.workbench.activatePanel(group.id, 'b')
    const floatingId = ctx.workbench.floatPanel(group.id, {
      x: 10,
      y: 20,
      width: 300,
      height: 400,
    })!
    const payload = ctx.workbench.detachPanelPayload(floatingId)
    expect(payload?.title).toBe('B')
    expect(payload?.node.type).toBe('group')
    expect(payload?.node.type === 'group' && payload.node.views).toEqual(['a', 'b'])
    expect(payload?.width).toBe(300)
    ctx.workbench.removeFloatingPanel(floatingId)
    expect(ctx.workbench.docking.floating).toHaveLength(0)
    expect(groupForView(ctx.workbench.docking, 'a')).toBeUndefined()
    await ctx.kernel.dispose()
  })

  it('applies workspaces and emits events', async () => {
    const { ctx } = await setup()
    let applied = ''
    ctx.on('workbench/workspace-applied', (workspace) => {
      applied = workspace.id
    })
    ctx.workbench.applyWorkspace('focus')
    expect(applied).toBe('focus')
    expect(ctx.workbench.layout.left.visible).toBe(false)
    expect(ctx.workbench.layout.ribbonCollapsed).toBe(true)
    await ctx.kernel.dispose()
  })

  it('registers views and opens them', async () => {
    const { ctx } = await setup()
    const view = ctx.workbench.registerView({
      id: 'test.side',
      title: '测试视图',
      location: 'left',
      default: true,
    })
    expect(ctx.workbench.viewsAt('left')).toHaveLength(1)
    ctx.workbench.toggleDock('left')
    expect(ctx.workbench.layout.left.visible).toBe(false)
    ctx.workbench.openView('test.side')
    expect(ctx.workbench.layout.left.visible).toBe(true)
    expect(ctx.workbench.activeView('left')?.id).toBe('test.side')
    view.dispose()
    expect(ctx.workbench.viewsAt('left')).toHaveLength(0)
    await ctx.kernel.dispose()
  })

  it('floats, docks and hides sidebars', async () => {
    const { ctx } = await setup()
    ctx.workbench.floatDock('left', {
      x: 20,
      y: 30,
      width: 300,
      height: 420,
    })
    expect(ctx.workbench.layout.left.floating).toEqual({
      x: 20,
      y: 30,
      width: 300,
      height: 420,
    })
    expect(ctx.workbench.dockedSidebar('left')).toBeUndefined()
    expect(ctx.workbench.dockedSidebar('right')).toBe('right')

    ctx.workbench.moveFloatingDock('left', 25, 35)
    ctx.workbench.resizeFloatingDock('left', 310, 430)
    expect(ctx.workbench.layout.left.floating).toEqual({
      x: 25,
      y: 35,
      width: 310,
      height: 430,
    })

    ctx.workbench.dockSidebar('left', 'right')
    expect(ctx.workbench.layout.left.floating).toBeNull()
    expect(ctx.workbench.layout.left.side).toBe('right')
    expect(ctx.workbench.layout.left.size).toBe(310)
    expect(ctx.workbench.layout.right.floating).toBeNull()
    expect(ctx.workbench.docking.roots.right?.type).toBe('split')
    expect(ctx.workbench.dockedSidebar('right')).toBe('left')
    expect(ctx.workbench.dockedSidebar('left')).toBeUndefined()

    ctx.workbench.floatDock('left', {
      x: 10,
      y: 10,
      width: 280,
      height: 380,
    })
    ctx.workbench.toggleDock('left')
    expect(ctx.workbench.layout.left.visible).toBe(false)
    expect(ctx.workbench.layout.left.floating).toBeTruthy()
    ctx.workbench.toggleDock('left')
    expect(ctx.workbench.layout.left.visible).toBe(true)
    expect(ctx.workbench.layout.left.floating).toEqual({
      x: 10,
      y: 10,
      width: 280,
      height: 380,
    })
    await ctx.kernel.dispose()
  })

  it('persists layout and custom workspaces', async () => {
    const { ctx, backend } = await setup()
    ctx.workbench.toggleDock('left')
    ctx.workbench.setDockSize('right', 400)
    ctx.workbench.floatDock('right', {
      x: 40,
      y: 50,
      width: 320,
      height: 440,
    })
    const custom = ctx.workbench.saveWorkspace('我的工作区')
    expect(custom.builtin).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 220))
    expect(backend.getItem('test:workbench')).toContain('我的工作区')
    await ctx.kernel.dispose()

    const next = await setup(backend)
    expect(next.ctx.workbench.layout.left.visible).toBe(false)
    expect(next.ctx.workbench.layout.right.size).toBe(400)
    expect(next.ctx.workbench.layout.right.floating).toEqual({
      x: 40,
      y: 50,
      width: 320,
      height: 440,
    })
    expect(next.ctx.workbench.workspaces.some(workspace => workspace.name === '我的工作区')).toBe(true)
    await next.ctx.kernel.dispose()
  })

  it('creates layout commands with checked state', async () => {
    const { ctx } = await setup()
    expect(ctx.commands.has('view.toggleLeft')).toBe(true)
    expect(ctx.commands.has('view.floatLeft')).toBe(true)
    expect(ctx.commands.isChecked('view.toggleLeft')).toBe(true)
    await ctx.commands.execute('view.toggleLeft')
    expect(ctx.commands.isChecked('view.toggleLeft')).toBe(false)
    await ctx.kernel.dispose()
  })
})
