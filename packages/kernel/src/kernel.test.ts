import type { Context } from 'cordis'
import { Service } from 'cordis'
import { describe, expect, it } from 'vitest'
import { createFrameworkContext, pluginEntry } from './index'

describe('kernel lifecycle', () => {
  it('waits for providers even when consumers are registered first', async () => {
    const ctx = await createFrameworkContext({ environment: 'test' })
    let active = false
    const consumer = {
      name: 'consumer',
      inject: ['fixture'],
      apply() { active = true },
    }
    class Fixture extends Service {
      constructor(ctx: Context) { super(ctx, 'fixture') }
    }
    try {
      const result = await ctx.kernel.load([
        pluginEntry(consumer),
        pluginEntry(Fixture),
      ])
      expect(active).toBe(true)
      expect(result.map(info => info.status)).toEqual(['loaded', 'loaded'])
      await ctx.kernel.unload('Fixture')
      expect(ctx.kernel.info('consumer')?.status).toBe('pending')
      await ctx.kernel.loadOne(pluginEntry(Fixture))
      expect(ctx.kernel.info('consumer')?.status).toBe('loaded')
    }
    finally {
      await ctx.kernel.dispose()
    }
  })

  it('reports missing dependencies as pending and protects diagnostic records', async () => {
    const ctx = await createFrameworkContext({ environment: 'test' })
    try {
      const info = await ctx.kernel.loadOne(pluginEntry({
        name: 'waiting',
        inject: ['absent'],
        apply() {},
      }))
      expect(info.status).toBe('pending')
      ctx.kernel.plugins[0].status = 'loaded'
      expect(ctx.kernel.info('waiting')?.status).toBe('pending')
    }
    finally { await ctx.kernel.dispose() }
  })

  it('records asynchronous failures and rejects duplicate batches before applying plugins', async () => {
    const ctx = await createFrameworkContext({ environment: 'test', strict: true })
    try {
      await expect(ctx.kernel.loadOne(pluginEntry({
        name: 'broken',
        async apply() { throw new Error('fixture failure') },
      }))).rejects.toThrow('fixture failure')
      expect(ctx.kernel.info('broken')?.status).toBe('failed')
      const entry = pluginEntry({
        name: 'duplicate',
        apply() {},
      })
      await expect(ctx.kernel.load([entry, entry])).rejects.toThrow('已加载')
      expect(ctx.kernel.info('duplicate')).toBeUndefined()
    }
    finally { await ctx.kernel.dispose() }
  })
})
