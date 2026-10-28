import { apply as commandsPlugin } from '@df/commands'
import { createFrameworkContext } from '@df/kernel'
import { describe, expect, it } from 'vitest'
import { apply as editorPlugin } from '../src'

const TestView = { name: 'TestView', template: '<div />' }

async function setup() {
  const ctx = await createFrameworkContext({ environment: 'test' })
  await ctx.plugin(commandsPlugin)
  await ctx.plugin(editorPlugin)
  return ctx
}

describe('editor', () => {
  it('opens documents and keeps a non-closable document', async () => {
    const ctx = await setup()
    expect(ctx.editor.documents).toHaveLength(1)
    const pinned = ctx.editor.open({
      id: 'pinned',
      title: '固定文档',
      component: TestView,
      closable: false,
      pinned: true,
    })
    const disposable = ctx.editor.open({
      id: 'scratch',
      title: '临时文档',
      component: TestView,
    })

    expect(ctx.editor.documents.map(document => document.id)).toEqual(['pinned', 'welcome', 'scratch'])
    expect(ctx.editor.activeId).toBe('scratch')
    expect(ctx.editor.close('pinned')).toBe(false)

    disposable.dispose()
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['pinned', 'welcome'])
    expect(ctx.editor.activeId).toBe('pinned')

    pinned.dispose()
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome'])
    await ctx.kernel.dispose()
  })

  it('cycles most recently used and sequential editors', async () => {
    const ctx = await setup()
    ctx.editor.open({ id: 'a', title: 'A', component: TestView })
    ctx.editor.open({ id: 'b', title: 'B', component: TestView })

    expect(ctx.editor.recentDocuments.map(document => document.id)).toEqual(['b', 'a', 'welcome'])
    ctx.editor.next()
    expect(ctx.editor.activeId).toBe('a')
    ctx.editor.previous()
    expect(ctx.editor.activeId).toBe('welcome')

    ctx.editor.activate('b')
    ctx.editor.nextInOrder()
    expect(ctx.editor.activeId).toBe('welcome')
    ctx.editor.previousInOrder()
    expect(ctx.editor.activeId).toBe('b')
    await ctx.kernel.dispose()
  })

  it('replaces preview editors and promotes them on request', async () => {
    const ctx = await setup()
    ctx.editor.open({
      id: 'preview-1',
      title: 'P1',
      component: TestView,
      preview: true,
    })
    expect(ctx.editor.activeDocument?.preview).toBe(true)

    ctx.editor.open({
      id: 'preview-2',
      title: 'P2',
      component: TestView,
      preview: true,
    })
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome', 'preview-2'])
    expect(ctx.editor.documents.filter(document => document.preview)).toHaveLength(1)

    ctx.editor.keepOpen('preview-2')
    expect(ctx.editor.activeDocument?.preview).toBe(false)

    ctx.editor.open({
      id: 'preview-3',
      title: 'P3',
      component: TestView,
      preview: true,
    })
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome', 'preview-2', 'preview-3'])
    expect(ctx.editor.documents.filter(document => document.preview)).toHaveLength(1)

    ctx.editor.open({
      id: 'preview-4',
      title: 'P4',
      component: TestView,
      preview: true,
    }, { activate: false })
    expect(ctx.editor.activeId).toBe('preview-4')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome', 'preview-2', 'preview-4'])
    await ctx.kernel.dispose()
  })

  it('keeps pinned tabs at the left and unpins as preview', async () => {
    const ctx = await setup()
    ctx.editor.open({ id: 'a', title: 'A', component: TestView })
    ctx.editor.open({ id: 'b', title: 'B', component: TestView })
    ctx.editor.open({ id: 'c', title: 'C', component: TestView })
    ctx.editor.togglePin('a')
    ctx.editor.togglePin('c')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['a', 'c', 'welcome', 'b'])

    ctx.editor.togglePin('a')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['c', 'a', 'welcome', 'b'])
    expect(ctx.editor.documents.find(document => document.id === 'a')?.preview).toBe(false)
    expect(ctx.editor.documents.find(document => document.id === 'c')?.pinned).toBe(true)
    await ctx.kernel.dispose()
  })

  it('reorders without moving documents across the pinned boundary', async () => {
    const ctx = await setup()
    ctx.editor.open({
      id: 'a',
      title: 'A',
      component: TestView,
      pinned: true,
    })
    ctx.editor.open({ id: 'b', title: 'B', component: TestView })
    ctx.editor.open({ id: 'c', title: 'C', component: TestView })
    ctx.editor.reorder(['c', 'b', 'a', 'welcome'])
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['a', 'c', 'b', 'welcome'])
    await ctx.kernel.dispose()
  })

  it('closes saved editors, restores closed editors and returns to MRU on close', async () => {
    const ctx = await setup()
    ctx.editor.open({ id: 'a', title: 'A', component: TestView })
    ctx.editor.open({ id: 'b', title: 'B', component: TestView })
    ctx.editor.activate('a')
    ctx.editor.activate('b')
    ctx.editor.close('b')
    expect(ctx.editor.activeId).toBe('a')

    ctx.editor.reopenClosed()
    expect(ctx.editor.activeId).toBe('b')
    ctx.editor.setDirty('b', true)
    ctx.editor.closeSaved()
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['b'])
    await ctx.kernel.dispose()
  })

  it('restores detached documents and isolates them in their window', async () => {
    const ctx = await setup()
    ctx.editor.open({
      id: 'detachable',
      title: '可分离文档',
      component: TestView,
      detachKey: 'detachable',
      getDetachState: () => ({ value: 42 }),
    })
    const payload = ctx.editor.detachPayload('detachable')
    expect(payload).toEqual({
      id: 'detachable',
      title: '可分离文档',
      icon: undefined,
      detachKey: 'detachable',
      state: { value: 42 },
    })

    ctx.editor.release('detachable')
    const registration = ctx.editor.registerDetachHandler('detachable', state => ({
      id: 'detachable',
      title: `可分离文档 ${(state as { value: number }).value}`,
      component: TestView,
      detachKey: 'detachable',
    }))
    expect(ctx.editor.restoreDetached(payload!)).toBe(true)
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['detachable'])
    expect(ctx.editor.activeDocument?.title).toBe('可分离文档 42')
    registration.dispose()
    await ctx.kernel.dispose()
  })

  it('accepts a detached document without closing existing tabs', async () => {
    const ctx = await setup()
    ctx.editor.open({ id: 'local', title: '本地', component: TestView })
    ctx.editor.open({
      id: 'remote',
      title: '远程',
      component: TestView,
      detachKey: 'remote',
    })
    const payload = ctx.editor.detachPayload('remote')!
    ctx.editor.release('remote')
    const registration = ctx.editor.registerDetachHandler('remote', () => ({
      id: 'remote',
      title: '远程',
      component: TestView,
      detachKey: 'remote',
    }))
    expect(ctx.editor.acceptDetached(payload)).toBe(true)
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome', 'local', 'remote'])
    expect(ctx.editor.activeId).toBe('remote')
    registration.dispose()
    await ctx.kernel.dispose()
  })
})
