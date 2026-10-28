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
    expect(ctx.editor.activeId).toBe('welcome')

    pinned.dispose()
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome'])
    await ctx.kernel.dispose()
  })

  it('navigates, reorders and pins documents', async () => {
    const ctx = await setup()
    ctx.editor.open({ id: 'a', title: 'A', component: TestView })
    ctx.editor.open({ id: 'b', title: 'B', component: TestView })

    ctx.editor.next()
    expect(ctx.editor.activeId).toBe('welcome')
    ctx.editor.previous()
    expect(ctx.editor.activeId).toBe('b')

    ctx.editor.reorder(['b', 'a', 'welcome'])
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['b', 'a', 'welcome'])

    ctx.editor.togglePin('a')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['a', 'b', 'welcome'])
    ctx.editor.togglePin('a')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['a', 'b', 'welcome'])
    await ctx.kernel.dispose()
  })

  it('closes other and right-side documents', async () => {
    const ctx = await setup()
    ctx.editor.open({ id: 'a', title: 'A', component: TestView })
    ctx.editor.open({ id: 'b', title: 'B', component: TestView })
    ctx.editor.closeToRight('welcome')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome'])
    expect(ctx.editor.activeId).toBe('welcome')

    ctx.editor.open({ id: 'c', title: 'C', component: TestView })
    ctx.editor.closeOthers('welcome')
    expect(ctx.editor.documents.map(document => document.id)).toEqual(['welcome'])
    await ctx.kernel.dispose()
  })

  it('registers tab commands and dirty state', async () => {
    const ctx = await setup()
    expect(ctx.commands.get('editor.closeActive')?.keybinding).toBe('Mod+W')
    expect(ctx.commands.get('editor.nextTab')?.keybinding).toBe('Ctrl+Tab')
    ctx.editor.setDirty('welcome', true)
    expect(ctx.editor.documents[0].dirty).toBe(true)
    ctx.editor.setDirty('welcome', false)
    expect(ctx.editor.documents[0].dirty).toBe(false)
    await ctx.kernel.dispose()
  })
})
