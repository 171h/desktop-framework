import type { Context } from 'cordis'
import { CommandService } from '@df/commands'
import { createFrameworkContext } from '@df/kernel'
import { apply as settings } from '@df/settings'
import { apply as pinia } from '@df/vue'
import { apply as workbench } from '@df/workbench'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelDockDrag, dockDragState, panelDropPlacement, snapFloatingGeometry, startDockDrag } from './dock-drag'

const contexts: Context[] = []
afterEach(async () => {
  cancelDockDrag()
  await Promise.all(contexts.splice(0).map(ctx => ctx.kernel.dispose()))
  document.body.replaceChildren()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'elementsFromPoint')
})

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  }
}

async function setup() {
  const ctx = await createFrameworkContext({ environment: 'test' })
  contexts.push(ctx)
  await ctx.plugin(pinia)
  await ctx.plugin(settings, { namespace: `drag-${Math.random()}` })
  await ctx.plugin(CommandService)
  await ctx.plugin(workbench)
  ctx.workbench.registerView({ id: 'a', title: 'A', location: 'left' })
  ctx.workbench.registerView({ id: 'b', title: 'B', location: 'right' })
  const root = document.createElement('div')
  root.className = 'df-workbench'
  document.body.append(root)
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1000, 800))
  const source = document.createElement('section')
  const target = document.createElement('section')
  source.className = target.className = 'df-panel-group'
  source.dataset.groupId = 'legacy-left'
  target.dataset.groupId = 'legacy-right'
  root.append(source, target)
  vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 280, 800))
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(700, 0, 300, 800))
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: vi.fn(() => [target]),
  })
  return { ctx, source }
}

describe('panel drag and snap', () => {
  it('snaps to the workspace and neighboring floating edges', () => {
    expect(snapFloatingGeometry({
      x: 7,
      y: 195,
      width: 200,
      height: 200,
    }, 1000, 800, []).x).toBe(0)
    expect(snapFloatingGeometry({
      x: 294,
      y: 200,
      width: 200,
      height: 200,
    }, 1000, 800, [
      {
        x: 500,
        y: 180,
        width: 200,
        height: 200,
      },
    ]).x).toBe(300)
    expect(snapFloatingGeometry({
      x: 294,
      y: 500,
      width: 200,
      height: 200,
    }, 1000, 800, [
      {
        x: 500,
        y: 0,
        width: 200,
        height: 200,
      },
    ]).x).toBe(294)
  })

  it('chooses split edges and the central tab merge zone', () => {
    const box = rect(0, 0, 200, 200)
    expect(panelDropPlacement(box, 100, 100)).toBe('center')
    expect(panelDropPlacement(box, 5, 100)).toBe('left')
    expect(panelDropPlacement(box, 195, 100)).toBe('right')
    expect(panelDropPlacement(box, 100, 5)).toBe('top')
    expect(panelDropPlacement(box, 100, 195)).toBe('bottom')
  })

  it('rolls back the complete layout on Escape or pointer cancellation', async () => {
    const { ctx, source } = await setup()
    const original = JSON.parse(JSON.stringify(ctx.workbench.docking))
    for (const cancel of ['escape', 'pointercancel']) {
      startDockDrag(ctx, 'legacy-left', new PointerEvent('pointerdown', {
        button: 0,
        clientX: 80,
        clientY: 15,
        pointerId: 1,
      }), source)
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 450, clientY: 250, pointerId: 1 }))
      expect(dockDragState.active).toBe(true)
      if (cancel === 'escape')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      else window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }))
      expect(dockDragState.active).toBe(false)
      expect(JSON.parse(JSON.stringify(ctx.workbench.docking))).toEqual(original)
    }
  })

  it('merges at the drop target and Ctrl suppresses docking', async () => {
    const { ctx, source } = await setup()
    startDockDrag(ctx, 'legacy-left', new PointerEvent('pointerdown', {
      button: 0,
      clientX: 80,
      clientY: 15,
      pointerId: 1,
    }), source)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 850, clientY: 400, pointerId: 1 }))
    expect(dockDragState.target?.placement).toBe('center')
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 850, clientY: 400, pointerId: 1 }))
    expect(ctx.workbench.panelGroup('legacy-right')?.views).toEqual(['b', 'a'])
    startDockDrag(ctx, 'legacy-right', new PointerEvent('pointerdown', {
      button: 0,
      clientX: 80,
      clientY: 15,
      pointerId: 2,
    }), source)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 5,
      clientY: 300,
      pointerId: 2,
      ctrlKey: true,
    }))
    window.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 5,
      clientY: 300,
      pointerId: 2,
      ctrlKey: true,
    }))
    expect(ctx.workbench.docking.floating).toHaveLength(1)
  })
})
