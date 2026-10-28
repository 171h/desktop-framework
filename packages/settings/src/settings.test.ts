import type { StorageLike } from '../src'
import { createFrameworkContext } from '@df/kernel'
import { describe, expect, it } from 'vitest'
import { apply as settingsPlugin, StorageService } from '../src'

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

describe('storage', () => {
  it('persists namespaced JSON values', async () => {
    const ctx = await createFrameworkContext({ environment: 'test' })
    await ctx.plugin(settingsPlugin, {
      namespace: 'test',
      storage: fakeStorage(),
    })
    ctx.storage.set('layout', { left: 280 })
    expect(ctx.storage.get('layout', { left: 0 })).toEqual({ left: 280 })
    expect(ctx.storage.keys()).toContain('layout')
    expect(ctx.storage).toBeInstanceOf(StorageService)
    await ctx.kernel.dispose()
  })

  it('falls back when JSON is corrupt', async () => {
    const ctx = await createFrameworkContext({ environment: 'test' })
    const backend = fakeStorage()
    backend.setItem('test:broken', '{')
    await ctx.plugin(settingsPlugin, { namespace: 'test', storage: backend })
    expect(ctx.storage.get('broken', 'fallback')).toBe('fallback')
    await ctx.kernel.dispose()
  })
})
