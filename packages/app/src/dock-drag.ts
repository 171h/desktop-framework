/**
 * 停靠侧栏拖拽控制器。
 *
 * 拖动停靠侧栏会将其转为浮动面板；拖动浮动面板可自由移动。靠近工作台
 * 左右边缘时显示停靠提示，释放后停靠到对应一侧。控制器使用 window 级
 * pointer 事件，因此面板在拖拽过程中从停靠 DOM 切换到浮动 DOM 也不会
 * 中断拖拽。
 */
import type { DockSide, FloatingDockState, SidebarId } from '@desktop-framework/core'
import type { Context } from 'cordis'
import { clamp } from '@desktop-framework/core'
import { reactive } from 'vue'

export interface DockDragState {
  active: boolean
  location?: SidebarId
  hint?: DockSide
}

export const dockDragState = reactive<DockDragState>({
  active: false,
})

interface DragSession {
  ctx: Context
  location: SidebarId
  panel: HTMLElement
  workbench: HTMLElement
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  started: boolean
  wasFloating: boolean
  originalSide: DockSide
  originalFloating?: FloatingDockState
}

let session: DragSession | undefined
let onMove: ((event: PointerEvent) => void) | undefined
let onUp: ((event: PointerEvent) => void) | undefined
let onCancel: (() => void) | undefined
let onBlur: (() => void) | undefined
let onKeyDown: ((event: KeyboardEvent) => void) | undefined

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('button, input, textarea, select, a, [contenteditable="true"], vscode-toolbar-button, vscode-button, vscode-icon[action-icon]'))
}

function cleanup(): void {
  if (onMove) {
    window.removeEventListener('pointermove', onMove)
  }
  if (onUp) {
    window.removeEventListener('pointerup', onUp)
  }
  if (onCancel) {
    window.removeEventListener('pointercancel', onCancel)
  }
  if (onBlur) {
    window.removeEventListener('blur', onBlur)
  }
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown)
  }
  document.body.classList.remove('df-dock-dragging')
  dockDragState.active = false
  dockDragState.location = undefined
  dockDragState.hint = undefined
  session = undefined
}

function hintFor(workbench: DOMRect, event: PointerEvent): DockSide | undefined {
  const threshold = Math.max(48, workbench.width * 0.08)
  if (event.clientX - workbench.left <= threshold) {
    return 'left'
  }
  if (workbench.right - event.clientX <= threshold) {
    return 'right'
  }
  return undefined
}

/** 开始拖动侧栏。 */
export function startDockDrag(
  ctx: Context,
  location: SidebarId,
  event: PointerEvent,
  panel: HTMLElement | undefined,
): void {
  if (event.button !== 0 || !panel || isInteractive(event.target)) {
    return
  }
  const dock = ctx.workbench.layout[location]
  if (!dock.visible) {
    return
  }
  const workbench = panel.closest<HTMLElement>('.df-workbench')
  if (!workbench) {
    return
  }
  const rect = panel.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  cleanup()
  session = {
    ctx,
    location,
    panel,
    workbench,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    started: false,
    wasFloating: Boolean(dock.floating),
    originalSide: dock.side ?? location,
    originalFloating: dock.floating
      ? { ...dock.floating }
      : undefined,
  }

  onMove = (moveEvent) => {
    const current = session
    if (!current) {
      return
    }
    if (!current.started) {
      const distance = Math.hypot(moveEvent.clientX - current.startX, moveEvent.clientY - current.startY)
      if (distance < 4) {
        return
      }
      current.started = true
      dockDragState.active = true
      dockDragState.location = current.location
      document.body.classList.add('df-dock-dragging')
      if (!current.ctx.workbench.isFloating(current.location)) {
        const workRect = current.workbench.getBoundingClientRect()
        const panelRect = current.panel.getBoundingClientRect()
        const width = clamp(panelRect.width, 240, Math.max(240, workRect.width - 24))
        const height = clamp(panelRect.height, 320, Math.max(320, Math.min(workRect.height - 32, 560)))
        current.ctx.workbench.floatDock(current.location, {
          x: clamp(panelRect.left - workRect.left, 0, Math.max(0, workRect.width - 80)),
          y: clamp(panelRect.top - workRect.top, 0, Math.max(0, workRect.height - 38)),
          width,
          height,
        })
      }
    }
    moveEvent.preventDefault()
    const workRect = current.workbench.getBoundingClientRect()
    const floating = current.ctx.workbench.layout[current.location].floating
    const x = moveEvent.clientX - workRect.left - current.offsetX
    const y = moveEvent.clientY - workRect.top - current.offsetY
    current.ctx.workbench.moveFloatingDock(
      current.location,
      clamp(x, 0, Math.max(0, workRect.width - (floating?.width ?? 0))),
      clamp(y, 0, Math.max(0, workRect.height - (floating?.height ?? 0))),
    )
    dockDragState.hint = hintFor(workRect, moveEvent)
  }

  onUp = () => {
    const current = session
    if (current?.started && dockDragState.hint) {
      current.ctx.workbench.dockSidebar(current.location, dockDragState.hint)
    }
    cleanup()
  }

  onCancel = () => {
    cleanup()
  }

  onBlur = () => {
    cleanup()
  }

  onKeyDown = (keyEvent) => {
    if (keyEvent.key !== 'Escape') {
      return
    }
    const current = session
    if (current?.started) {
      if (current.wasFloating && current.originalFloating) {
        current.ctx.workbench.resizeFloatingDock(
          current.location,
          current.originalFloating.width,
          current.originalFloating.height,
        )
        current.ctx.workbench.moveFloatingDock(
          current.location,
          current.originalFloating.x,
          current.originalFloating.y,
        )
      }
      else {
        current.ctx.workbench.dockSidebar(current.location, current.originalSide)
      }
    }
    cleanup()
  }

  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('blur', onBlur)
  window.addEventListener('keydown', onKeyDown)
}
