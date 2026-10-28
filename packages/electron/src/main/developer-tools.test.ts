import type { WebContents } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeDeveloperAction } from './developer-tools'

function contents() {
  return {
    toggleDevTools: vi.fn(),
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    isDestroyed: vi.fn(() => false),
  }
}

afterEach(() => vi.useRealTimers())

describe('developer IPC actions', () => {
  it('toggles DevTools and respects a host that disables it', () => {
    const target = contents()
    executeDeveloperAction(target as unknown as WebContents, 'toggleDevTools')
    expect(target.toggleDevTools).toHaveBeenCalledOnce()
    expect(() => executeDeveloperAction(target as unknown as WebContents, 'toggleDevTools', false)).toThrow('已关闭')
  })

  it.each(['reload', 'reloadIgnoringCache'] as const)('replies before %s and ignores a destroyed window', (action) => {
    vi.useFakeTimers()
    const target = contents()
    executeDeveloperAction(target as unknown as WebContents, action)
    expect(target[action]).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(target[action]).toHaveBeenCalledOnce()
    executeDeveloperAction(target as unknown as WebContents, action)
    target.isDestroyed.mockReturnValue(true)
    vi.runAllTimers()
    expect(target[action]).toHaveBeenCalledOnce()
  })

  it.each([
    'executeJavaScript',
    'openExternal',
    null,
    { action: 'reload' },
  ])('rejects arbitrary IPC arguments: %j', (action) => {
    const target = contents()
    expect(() => executeDeveloperAction(target as unknown as WebContents, action)).toThrow('未知')
    expect(target.toggleDevTools).not.toHaveBeenCalled()
    expect(target.reload).not.toHaveBeenCalled()
  })
})
