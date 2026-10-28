import type { DockingLayout, DockNode } from '@df/core'
import { describe, expect, it } from 'vitest'
import { allNodes, dockPanel, ensurePanel, floatPanel, groupForView, movePanel, restoreDocking } from './docking'
import { DEFAULT_LAYOUT } from './store'

function setup(): DockingLayout {
  const layout = restoreDocking(undefined, DEFAULT_LAYOUT)
  ensurePanel(layout, 'explorer', 'left', true)
  ensurePanel(layout, 'properties', 'right', true)
  ensurePanel(layout, 'output', 'bottom', false)
  return layout
}

function ids(layout: DockingLayout): string[] {
  return allNodes(layout).flatMap(node => node.type === 'group'
    ? node.views
    : [])
}

describe('composable panel layout', () => {
  it.each(['left', 'right', 'top', 'bottom'] as const)('splits panels at %s without evicting the target', (placement) => {
    const layout = setup()
    expect(movePanel(layout, 'legacy-left', 'legacy-right', placement)).toBe(true)
    expect(layout.roots.left).toBeNull()
    const root = layout.roots.right!
    expect(root.type).toBe('split')
    if (root.type !== 'split')
      throw new Error('Expected split')
    expect(root.orientation).toBe(placement === 'left' || placement === 'right'
      ? 'horizontal'
      : 'vertical')
    expect(new Set(ids(layout))).toEqual(new Set(['explorer', 'properties', 'output']))
    expect(ids(layout)).toHaveLength(3)
  })

  it('merges tabs, extracts one tab, docks on an occupied edge and collapses empty splits', () => {
    const layout = setup()
    movePanel(layout, 'legacy-left', 'legacy-right', 'center')
    expect(groupForView(layout, 'properties')?.views).toEqual(['properties', 'explorer'])
    const extracted = floatPanel(layout, 'legacy-right', {
      x: 30,
      y: 40,
      width: 300,
      height: 400,
    }, 'explorer')!
    expect(groupForView(layout, 'properties')?.views).toEqual(['properties'])
    expect(layout.floating).toHaveLength(1)
    dockPanel(layout, extracted, 'right')
    expect(layout.floating).toHaveLength(0)
    expect(layout.roots.right?.type).toBe('split')
    movePanel(layout, extracted, 'legacy-right', 'center')
    expect(layout.roots.right?.type).toBe('group')
    expect(ids(layout)).toHaveLength(3)
  })

  it('migrates legacy sidebars on the same side and preserves floating geometry', () => {
    const layout = restoreDocking(undefined, {
      ...DEFAULT_LAYOUT,
      left: { ...DEFAULT_LAYOUT.left, side: 'right' },
      right: { ...DEFAULT_LAYOUT.right, side: 'right' },
    })
    expect(layout.roots.right?.type).toBe('split')
    expect(layout.floating).toHaveLength(0)
    const floating = restoreDocking(undefined, {
      ...DEFAULT_LAYOUT,
      left: {
        ...DEFAULT_LAYOUT.left,
        floating: {
          x: 20,
          y: 30,
          width: 280,
          height: 410,
        },
      },
    })
    expect(floating.floating[0].geometry).toEqual({
      x: 20,
      y: 30,
      width: 280,
      height: 410,
    })
  })

  it('repairs duplicate membership and invalid ratios in persisted layouts', () => {
    const layout = setup()
    layout.roots.left = {
      type: 'split',
      id: 'split',
      ratio: Number.NaN,
      orientation: 'horizontal',
      children: [
        layout.roots.left!,
        {
          type: 'group',
          id: 'duplicate',
          views: ['explorer', 'extra'],
        },
      ],
    }
    layout.hidden = ['extra', 'missing', 'extra']
    const restored = restoreDocking(layout, DEFAULT_LAYOUT)
    expect(ids(restored).filter(id => id === 'explorer')).toHaveLength(1)
    expect(restored.hidden).toEqual(['extra'])
    expect(restored.roots.left?.type === 'split' && restored.roots.left.ratio).toBe(0.5)
    const circular = {
      type: 'split',
      id: 'loop',
      ratio: 0.5,
      orientation: 'vertical',
      children: [],
    } as unknown as DockNode
    if (circular.type === 'split')
      circular.children = [circular, circular]
    expect(() => restoreDocking({
      ...layout,
      roots: { ...layout.roots, left: circular },
    }, DEFAULT_LAYOUT)).not.toThrow()
  })
})
