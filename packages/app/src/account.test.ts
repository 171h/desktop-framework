import type { StorageLike } from '@df/settings'
import { createFrameworkContext } from '@df/kernel'
import { apply as settingsPlugin } from '@df/settings'
import { describe, expect, it } from 'vitest'
import { apply as accountPlugin } from './account'

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

async function setup(backend = fakeStorage()) {
  const ctx = await createFrameworkContext({ environment: 'test' })
  await ctx.plugin(settingsPlugin, {
    namespace: 'test',
    storage: backend,
  })
  await ctx.plugin(accountPlugin)
  return { ctx, backend }
}

describe('account', () => {
  it('logs in, updates the display name and logs out locally', async () => {
    const { ctx, backend } = await setup()
    expect(ctx.account.user).toBeNull()

    const user = ctx.account.login({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'secret1',
    })
    expect(user.initials).toBe('AL')
    expect(ctx.account.signedIn).toBe(true)
    expect(ctx.account.user?.email).toBe('ada@example.com')
    expect(backend.getItem('test:account.user')).toContain('Ada Lovelace')
    expect(backend.getItem('test:account.user')).not.toContain('secret1')

    ctx.account.updateName('Grace Hopper')
    expect(ctx.account.user?.initials).toBe('GH')

    ctx.account.logout()
    expect(ctx.account.user).toBeNull()
    expect(backend.getItem('test:account.user')).toBeNull()
    await ctx.kernel.dispose()
  })

  it('restores the persisted account', async () => {
    const backend = fakeStorage()
    const first = await setup(backend)
    first.ctx.account.login({
      name: 'Lin',
      email: 'lin@example.com',
      password: 'secret1',
    })
    await first.ctx.kernel.dispose()

    const second = await setup(backend)
    expect(second.ctx.account.user?.name).toBe('Lin')
    expect(second.ctx.account.user?.initials).toBe('LI')
    await second.ctx.kernel.dispose()
  })

  it('rejects invalid login credentials', async () => {
    const { ctx } = await setup()
    expect(() => ctx.account.login({ email: 'not-an-email', password: 'secret1' })).toThrow('邮箱')
    expect(() => ctx.account.login({ email: 'a@example.com', password: '123' })).toThrow('密码')
    await ctx.kernel.dispose()
  })
})
