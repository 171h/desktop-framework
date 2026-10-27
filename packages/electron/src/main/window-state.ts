/** 窗口位置与尺寸持久化。 */
import type { BrowserWindow, Rectangle } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { screen } from 'electron'

export interface StoredWindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized?: boolean
}

const DEFAULT_STATE: StoredWindowState = {
  width: 1440,
  height: 900,
}

export async function loadWindowState(path: string): Promise<StoredWindowState> {
  let stored: Partial<StoredWindowState> = {}
  try {
    stored = JSON.parse(await readFile(path, 'utf8')) as Partial<StoredWindowState>
  }
  catch {
    stored = {}
  }
  const state: StoredWindowState = {
    width: clampDimension(stored.width, DEFAULT_STATE.width, 720),
    height: clampDimension(stored.height, DEFAULT_STATE.height, 480),
    x: Number.isFinite(stored.x)
      ? stored.x
      : undefined,
    y: Number.isFinite(stored.y)
      ? stored.y
      : undefined,
    maximized: Boolean(stored.maximized),
  }
  if (state.x !== undefined && state.y !== undefined) {
    const visible = screen.getAllDisplays().some((display) => {
      const bounds = display.workArea
      return intersects(bounds, {
        x: state.x!,
        y: state.y!,
        width: state.width,
        height: state.height,
      })
    })
    if (!visible) {
      state.x = undefined
      state.y = undefined
    }
  }
  return state
}

export async function saveWindowState(path: string, window: BrowserWindow): Promise<void> {
  if (window.isDestroyed()) {
    return
  }
  const bounds = window.isMaximized()
    ? window.getNormalBounds()
    : window.getBounds()
  const state: StoredWindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: window.isMaximized(),
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), 'utf8')
}

function clampDimension(value: unknown, fallback: number, min: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.round(value))
    : fallback
}

function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
