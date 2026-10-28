import type { DockEdge, DockingLayout, DockPlacement, FloatingDockState } from '@df/core'
import type {} from '@df/platform'
import type { Context } from 'cordis'
import { clamp } from '@df/core'
import { cloneDocking } from '@df/workbench'
import { reactive } from 'vue'

export interface DockDropTarget {
  edge?: DockEdge
  groupId?: string
  placement: DockPlacement
  preview: FloatingDockState
}
export const dockDragState = reactive<{ active: boolean, target?: DockDropTarget }>({ active: false })

/** 边缘对齐只考虑投影重叠的浮窗；Ctrl 拖动可临时关闭。 */
export function snapFloatingGeometry(value: FloatingDockState, width: number, height: number, neighbors: FloatingDockState[], threshold = 12): FloatingDockState {
  const xs = [0, width - value.width]
  const ys = [0, height - value.height]
  for (const box of neighbors) {
    if (value.y + value.height >= box.y && value.y <= box.y + box.height)
      xs.push(box.x, box.x + box.width, box.x - value.width, box.x + box.width - value.width)
    if (value.x + value.width >= box.x && value.x <= box.x + box.width)
      ys.push(box.y, box.y + box.height, box.y - value.height, box.y + box.height - value.height)
  }
  const snap = (position: number, candidates: number[]): number => candidates.filter(candidate => Math.abs(candidate - position) <= threshold).sort((a, b) => Math.abs(a - position) - Math.abs(b - position))[0] ?? position
  return {
    ...value,
    x: clamp(snap(value.x, xs), 0, Math.max(0, width - value.width)),
    y: clamp(snap(value.y, ys), 0, Math.max(0, height - value.height)),
  }
}

/** 鼠标在面板中心时合并标签，在四边时分割。 */
export function panelDropPlacement(rect: { left: number, top: number, width: number, height: number }, x: number, y: number): DockPlacement {
  const dx = (x - rect.left) / rect.width
  const dy = (y - rect.top) / rect.height
  const distances = [
    { placement: 'left', distance: dx },
    { placement: 'right', distance: 1 - dx },
    { placement: 'top', distance: dy },
    { placement: 'bottom', distance: 1 - dy },
  ] as const
  const nearest = [...distances].sort((a, b) => a.distance - b.distance)[0]
  return nearest.distance < 0.25
    ? nearest.placement
    : 'center'
}

interface Session {
  ctx: Context
  groupId: string
  viewId?: string
  floatingId?: string
  element: HTMLElement
  workbench: HTMLElement
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  lastScreenX: number
  lastScreenY: number
  started: boolean
  outsideWindow: boolean
  watchStarted: boolean
  original: DockingLayout
}
let session: Session | undefined
let outsideSubscription: (() => void) | undefined

function isOutsideWindow(event: PointerEvent): boolean {
  return event.screenX < window.screenX
    || event.screenY < window.screenY
    || event.screenX > window.screenX + window.outerWidth
    || event.screenY > window.screenY + window.outerHeight
}

function onWindowBlur(): void {
  const current = session
  if (current?.started && current.outsideWindow && current.floatingId) {
    const panel = current.ctx.workbench.docking.floating.find(item => item.id === current.floatingId)
    if (panel) {
      void detachFloatingPanel(current.ctx, panel.id, {
        x: current.lastScreenX - current.offsetX,
        y: current.lastScreenY - current.offsetY,
        width: panel.geometry.width,
        height: panel.geometry.height,
      })
    }
    cleanup()
    return
  }
  cancelDockDrag()
}

function cleanup(): void {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', finish)
  window.removeEventListener('pointercancel', cancelDockDrag)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('keydown', keydown)
  if (session?.element.hasPointerCapture?.(session.pointerId)) {
    session.element.releasePointerCapture(session.pointerId)
  }
  session?.ctx.platform?.stopPanelDragWatch?.()
  outsideSubscription?.()
  outsideSubscription = undefined
  document.body.classList.remove('df-dock-dragging')
  dockDragState.active = false
  dockDragState.target = undefined
  session = undefined
}

function onPanelDragOutside(point: { x: number, y: number }): void {
  const current = session
  if (!current?.floatingId) {
    return
  }
  const panel = current.ctx.workbench.docking.floating.find(item => item.id === current.floatingId)
  if (!panel) {
    return
  }
  void detachFloatingPanel(current.ctx, panel.id, {
    x: point.x - current.offsetX,
    y: point.y - current.offsetY,
    width: panel.geometry.width,
    height: panel.geometry.height,
  })
  cleanup()
}

export function cancelDockDrag(): void {
  if (session?.started)
    session.ctx.workbench.restorePanelLayout(session.original)
  cleanup()
}

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelDockDrag()
  }
}

function dropTarget(current: Session, event: PointerEvent): DockDropTarget | undefined {
  if (event.ctrlKey)
    return
  const bounds = current.workbench.getBoundingClientRect()
  const x = event.clientX - bounds.left
  const y = event.clientY - bounds.top
  if (x < 0 || x > bounds.width || y < 0 || y > bounds.height)
    return
  const edge = x < 28
    ? 'left'
    : x > bounds.width - 28
      ? 'right'
      : y > bounds.height - 28
        ? 'bottom'
        : undefined
  if (edge) {
    return {
      edge,
      placement: 'center',
      preview: edge === 'bottom'
        ? {
            x: 0,
            y: bounds.height * 0.7,
            width: bounds.width,
            height: bounds.height * 0.3,
          }
        : {
            x: edge === 'left'
              ? 0
              : bounds.width - Math.min(320, bounds.width * 0.3),
            y: 0,
            width: Math.min(320, bounds.width * 0.3),
            height: bounds.height,
          },
    }
  }
  for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
    const group = element.closest<HTMLElement>('.df-panel-group')
    if (!group || !current.workbench.contains(group) || group.dataset.groupId === current.groupId)
      continue
    if (group.closest<HTMLElement>('[data-floating-id]')?.dataset.floatingId === current.floatingId)
      continue
    const rect = group.getBoundingClientRect()
    const placement = panelDropPlacement(rect, event.clientX, event.clientY)
    const preview = {
      x: rect.left - bounds.left,
      y: rect.top - bounds.top,
      width: rect.width,
      height: rect.height,
    }
    if (placement === 'left' || placement === 'right') {
      preview.width /= 2
      if (placement === 'right')
        preview.x += preview.width
    }
    if (placement === 'top' || placement === 'bottom') {
      preview.height /= 2
      if (placement === 'bottom')
        preview.y += preview.height
    }
    return { groupId: group.dataset.groupId, placement, preview }
  }
}

function move(event: PointerEvent): void {
  const current = session
  if (!current || event.pointerId !== current.pointerId)
    return
  current.lastScreenX = event.screenX
  current.lastScreenY = event.screenY
  const bounds = current.workbench.getBoundingClientRect()
  if (!current.started) {
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 5)
      return
    const rect = current.element.getBoundingClientRect()
    current.started = true
    const floating = current.ctx.workbench.docking.floating.find(panel => panel.node.type === 'group' && panel.node.id === current.groupId && (!current.viewId || panel.node.views.length === 1))
    if (floating) {
      current.floatingId = floating.id
    }
    else {
      const id = current.ctx.workbench.floatPanel(current.groupId, {
        x: Math.max(0, rect.left - bounds.left),
        y: Math.max(0, rect.top - bounds.top),
        width: Math.max(240, Math.min(rect.width, bounds.width - 16)),
        height: Math.max(180, Math.min(rect.height, bounds.height - 16, 560)),
      }, current.viewId)
      if (!id) {
        cleanup()
        return
      }
      current.groupId = id
      current.floatingId = id
    }
    document.body.classList.add('df-dock-dragging')
    dockDragState.active = true
    if (current.floatingId && !current.watchStarted && current.ctx.platform?.supportsPanelDragWatch) {
      current.watchStarted = true
      current.ctx.platform.startPanelDragWatch?.()
    }
  }
  event.preventDefault()
  const panel = current.ctx.workbench.docking.floating.find(panel => panel.id === current.floatingId)
  if (!panel)
    return
  current.outsideWindow = isOutsideWindow(event)
  const geometry = { ...panel.geometry, x: event.clientX - bounds.left - current.offsetX, y: event.clientY - bounds.top - current.offsetY }
  const neighbors = current.ctx.workbench.docking.floating.filter(other => other.id !== panel.id && current.ctx.workbench.visibleDockNode(other.node)).map(other => other.geometry)
  current.ctx.workbench.setFloatingGeometry(panel.id, snapFloatingGeometry(geometry, bounds.width, bounds.height, event.ctrlKey
    ? []
    : neighbors, event.ctrlKey ? 0 : 12))
  dockDragState.target = dropTarget(current, event)
}

function finish(event: PointerEvent): void {
  const current = session
  if (!current || event.pointerId !== current.pointerId)
    return
  const outside = current.outsideWindow || isOutsideWindow(event)
  if (current.started && outside && current.floatingId) {
    const panel = current.ctx.workbench.docking.floating.find(item => item.id === current.floatingId)
    if (panel) {
      const bounds = {
        x: event.screenX - current.offsetX,
        y: event.screenY - current.offsetY,
        width: panel.geometry.width,
        height: panel.geometry.height,
      }
      void detachFloatingPanel(current.ctx, panel.id, bounds)
    }
    cleanup()
    return
  }
  if (current.started) {
    const target = dropTarget(current, event)
    if (target?.edge)
      current.ctx.workbench.dockPanel(current.groupId, target.edge)
    else if (target?.groupId)
      current.ctx.workbench.movePanel(current.groupId, target.groupId, target.placement)
  }
  cleanup()
}

async function detachFloatingPanel(ctx: Context, panelId: string, bounds: { x: number, y: number, width: number, height: number }): Promise<void> {
  const payload = ctx.workbench.detachPanelPayload(panelId)
  if (!payload) {
    return
  }
  try {
    const created = await ctx.platform.openDetachedWindow({
      kind: 'panel',
      title: payload.title,
      payload,
      bounds,
    })
    if (created) {
      ctx.workbench.removeFloatingPanel(panelId)
    }
  }
  catch (error) {
    ctx.logger.warn(`[workbench] 创建独立面板窗口失败：${String(error)}`)
  }
}

export function startDockDrag(ctx: Context, groupId: string, event: PointerEvent, panel?: HTMLElement, viewId?: string): void {
  const interactive = event.composedPath().some(target => target instanceof Element && (target.matches('input,textarea,select,a,vscode-toolbar-button,vscode-button') || (!viewId && target.matches('button'))))
  if (event.button !== 0 || !panel || interactive)
    return
  const workbench = panel.closest<HTMLElement>('.df-workbench')
  if (!workbench)
    return
  cancelDockDrag()
  const rect = panel.getBoundingClientRect()
  event.preventDefault()
  event.stopPropagation()
  try {
    panel.setPointerCapture(event.pointerId)
  }
  catch {}
  session = {
    ctx,
    groupId,
    viewId,
    element: panel,
    workbench,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    lastScreenX: event.screenX,
    lastScreenY: event.screenY,
    started: false,
    outsideWindow: false,
    watchStarted: false,
    original: cloneDocking(ctx.workbench.docking),
  }
  outsideSubscription?.()
  outsideSubscription = ctx.platform?.onPanelDragOutside?.(onPanelDragOutside)?.dispose
  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancelDockDrag)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('keydown', keydown)
}
