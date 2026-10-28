import type { DockEdge, DockGroupNode, DockingLayout, DockNode, DockPlacement, FloatingDockState, WorkbenchLayout } from '@df/core'
import { clamp } from '@df/core'

export const DOCK_EDGES: DockEdge[] = ['left', 'right', 'bottom']
let sequence = 0
export function dockId(): string {
  return `panel-${Date.now().toString(36)}-${++sequence}`
}

export function visitNodes(node: DockNode | null, callback: (node: DockNode) => void): void {
  if (!node)
    return
  callback(node)
  if (node.type === 'split')
    node.children.forEach(child => visitNodes(child, callback))
}

export function allNodes(layout: DockingLayout): DockNode[] {
  const nodes: DockNode[] = []
  DOCK_EDGES.forEach(edge => visitNodes(layout.roots[edge], node => nodes.push(node)))
  layout.floating.forEach(panel => visitNodes(panel.node, node => nodes.push(node)))
  return nodes
}

export function findGroup(layout: DockingLayout, id: string): DockGroupNode | undefined {
  return allNodes(layout).find((node): node is DockGroupNode => node.type === 'group' && node.id === id)
}

export function groupForView(layout: DockingLayout, viewId: string): DockGroupNode | undefined {
  return allNodes(layout).find((node): node is DockGroupNode => node.type === 'group' && node.views.includes(viewId))
}

export function sideForGroup(layout: DockingLayout, id: string): DockEdge {
  for (const edge of DOCK_EDGES) {
    let found = false
    visitNodes(layout.roots[edge], (node) => {
      if (node.id === id)
        found = true
    })
    if (found)
      return edge
  }
  return layout.floating.find(panel => containsNode(panel.node, id))?.lastSide ?? 'left'
}

export function containsNode(node: DockNode, id: string): boolean {
  return node.id === id || (node.type === 'split' && node.children.some(child => containsNode(child, id)))
}

export function cloneDocking(layout: DockingLayout): DockingLayout {
  return JSON.parse(JSON.stringify(layout)) as DockingLayout
}

function replace(node: DockNode | null, id: string, replacement: DockNode | null): DockNode | null {
  if (!node)
    return null
  if (node.id === id)
    return replacement
  if (node.type === 'group')
    return node
  const first = replace(node.children[0], id, replacement)
  const second = replace(node.children[1], id, replacement)
  if (!first)
    return second
  if (!second)
    return first
  return {
    ...node,
    children: [first, second],
  }
}

function replaceInLayout(layout: DockingLayout, id: string, replacement: DockNode | null): void {
  for (const edge of DOCK_EDGES) layout.roots[edge] = replace(layout.roots[edge], id, replacement)
  layout.floating = layout.floating.flatMap((panel) => {
    const node = replace(panel.node, id, replacement)
    return node
      ? [
          { ...panel, node },
        ]
      : []
  })
}

function detach(layout: DockingLayout, id: string, viewId?: string): DockGroupNode | undefined {
  const group = findGroup(layout, id)
  if (!group || (viewId && !group.views.includes(viewId)))
    return
  if (viewId && group.views.length > 1) {
    group.views = group.views.filter(view => view !== viewId)
    if (group.activeView === viewId)
      group.activeView = group.views[0]
    return {
      type: 'group',
      id: dockId(),
      views: [viewId],
      activeView: viewId,
    }
  }
  replaceInLayout(layout, id, null)
  return group
}

export function splitNode(target: DockNode, source: DockNode, placement: Exclude<DockPlacement, 'center'>): DockNode {
  return {
    type: 'split',
    id: dockId(),
    ratio: 0.5,
    orientation: placement === 'left' || placement === 'right'
      ? 'horizontal'
      : 'vertical',
    children: placement === 'left' || placement === 'top'
      ? [source, target]
      : [target, source],
  }
}

export function movePanel(layout: DockingLayout, sourceId: string, targetId: string, placement: DockPlacement, viewId?: string): boolean {
  const target = findGroup(layout, targetId)
  const source = findGroup(layout, sourceId)
  if (!target || !source)
    return false
  if (sourceId === targetId && (!viewId || source.views.length < 2 || placement === 'center'))
    return false
  const moved = detach(layout, sourceId, viewId)
  if (!moved)
    return false
  if (placement === 'center') {
    target.views = [
      ...new Set([
        ...target.views,
        ...moved.views,
      ]),
    ]
    target.activeView = moved.activeView ?? moved.views[0]
  }
  else {
    replaceInLayout(layout, targetId, splitNode(target, moved, placement))
  }
  return true
}

export function dockPanel(layout: DockingLayout, sourceId: string, edge: DockEdge): void {
  const moved = detach(layout, sourceId)
  if (!moved)
    return
  const root = layout.roots[edge]
  layout.roots[edge] = root
    ? splitNode(root, moved, edge === 'bottom'
        ? 'right'
        : 'bottom')
    : moved
}

export function floatPanel(layout: DockingLayout, sourceId: string, geometry: FloatingDockState, viewId?: string): string | undefined {
  const lastSide = sideForGroup(layout, sourceId)
  const moved = detach(layout, sourceId, viewId)
  if (!moved)
    return
  layout.floating.push({
    id: moved.id,
    node: moved,
    geometry: sanitizeGeometry(geometry),
    lastSide,
  })
  return moved.id
}

export function ensurePanel(layout: DockingLayout, viewId: string, edge: DockEdge, visible: boolean, activeView?: string): void {
  if (groupForView(layout, viewId))
    return
  let group = findGroup(layout, `legacy-${edge}`)
  if (!group) {
    group = {
      type: 'group',
      id: dockId(),
      views: [],
    }
    const root = layout.roots[edge]
    layout.roots[edge] = root
      ? splitNode(root, group, edge === 'bottom'
          ? 'right'
          : 'bottom')
      : group
  }
  group.views.push(viewId)
  if (!group.activeView || activeView === viewId)
    group.activeView = viewId
  if (!visible && !layout.hidden.includes(viewId))
    layout.hidden.push(viewId)
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback
}

export function sanitizeGeometry(value: FloatingDockState): FloatingDockState {
  return {
    x: finite(value?.x, 40, 0, 10000),
    y: finite(value?.y, 40, 0, 10000),
    width: finite(value?.width, 300, 200, 2400),
    height: finite(value?.height, 420, 140, 1800),
  }
}

/** 限制节点数量 / 深度、去重 ID 和视图，防止损坏的持久化布局破坏递归渲染。 */
export function restoreDocking(value: DockingLayout | undefined, legacy: WorkbenchLayout): DockingLayout {
  const result: DockingLayout = {
    version: 2,
    roots: { left: null, right: null, bottom: null },
    floating: [],
    hidden: [],
  }
  if (value?.version !== 2) {
    for (const edge of DOCK_EDGES) {
      const dock = legacy[edge] ?? { visible: true, size: 300 }
      const node: DockGroupNode = {
        type: 'group',
        id: `legacy-${edge}`,
        views: [],
        activeView: dock.activeView,
      }
      if (edge !== 'bottom' && dock.floating) {
        result.floating.push({
          id: node.id,
          node,
          geometry: sanitizeGeometry(dock.floating),
          lastSide: dock.side ?? edge,
        })
      }
      else {
        const side = edge === 'bottom'
          ? edge
          : dock.side ?? edge
        result.roots[side] = result.roots[side]
          ? splitNode(result.roots[side]!, node, 'bottom')
          : node
      }
    }
    return result
  }
  const ids = new Set<string>()
  const views = new Set<string>()
  let budget = 256
  const read = (node: DockNode | null, depth = 0): DockNode | null => {
    if (!node || typeof node !== 'object' || depth > 16 || --budget < 0)
      return null
    if (typeof node.id !== 'string' || !node.id || ids.has(node.id))
      return null
    ids.add(node.id)
    if (node.type === 'group' && Array.isArray(node.views)) {
      const members = node.views.filter((id) => {
        if (typeof id !== 'string' || !id || views.has(id))
          return false
        views.add(id)
        return true
      })
      return {
        type: 'group',
        id: node.id,
        views: members,
        activeView: members.includes(node.activeView ?? '') || (!members.length && typeof node.activeView === 'string')
          ? node.activeView
          : members[0],
      }
    }
    if (node.type !== 'split' || !Array.isArray(node.children))
      return null
    const first = read(node.children[0], depth + 1)
    const second = read(node.children[1], depth + 1)
    if (!first)
      return second
    if (!second)
      return first
    return {
      type: 'split',
      id: node.id,
      orientation: node.orientation === 'horizontal'
        ? 'horizontal'
        : 'vertical',
      ratio: finite(node.ratio, 0.5, 0.15, 0.85),
      children: [first, second],
    }
  }
  for (const edge of DOCK_EDGES) result.roots[edge] = read(value.roots?.[edge] ?? null)
  const floatingIds = new Set<string>()
  for (const panel of (Array.isArray(value.floating)
    ? value.floating
    : []).slice(0, 64)) {
    const node = read(panel?.node)
    if (node) {
      let id = typeof panel.id === 'string' && panel.id
        ? panel.id
        : node.id
      if (floatingIds.has(id))
        id = dockId()
      floatingIds.add(id)
      result.floating.push({
        id,
        node,
        geometry: sanitizeGeometry(panel.geometry),
        lastSide: DOCK_EDGES.includes(panel.lastSide)
          ? panel.lastSide
          : 'left',
      })
    }
  }
  result.hidden = Array.isArray(value.hidden)
    ? [
        ...new Set(value.hidden.filter(id => typeof id === 'string' && views.has(id))),
      ]
    : []
  return result
}
