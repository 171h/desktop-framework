import { createFrameworkContext } from '@desktop-framework/kernel'
import { describe, expect, it } from 'vitest'
import { CommandService, apply as commandsPlugin } from '../src'

async function setup(): Promise<Awaited<ReturnType<typeof createFrameworkContext>>> {
  const ctx = await createFrameworkContext({ environment: 'test' })
  await ctx.plugin(commandsPlugin)
  return ctx
}

describe('commands', () => {
  it('registers and executes commands', async () => {
    const ctx = await setup()
    let value = 0
    ctx.commands.register({
      id: 'test.increment',
      title: 'Increment',
      run: (_ctx, amount) => {
        value += Number(amount)
      },
    })
    await ctx.commands.execute('test.increment', 3)
    expect(value).toBe(3)
    expect(ctx.commands.get('test.increment')?.title).toBe('Increment')
    await ctx.kernel.dispose()
  })

  it('rejects duplicate ids unless override is requested', async () => {
    const ctx = await setup()
    const command = {
      id: 'test.dup',
      title: 'A',
      run: () => 'a',
    }
    const registration = ctx.commands.register(command)
    expect(() => ctx.commands.register(command)).toThrow(/已注册/)
    registration.dispose()
    expect(ctx.commands.has('test.dup')).toBe(false)
    await ctx.kernel.dispose()
  })

  it('restores overridden commands on dispose', async () => {
    const ctx = await setup()
    ctx.commands.register({
      id: 'test.override',
      title: 'Base',
      run: () => 'base',
    })
    const override = ctx.commands.register(
      {
        id: 'test.override',
        title: 'Override',
        run: () => 'override',
      },
      { override: true },
    )
    expect(await ctx.commands.execute('test.override')).toBe('override')
    override.dispose()
    expect(await ctx.commands.execute('test.override')).toBe('base')
    await ctx.kernel.dispose()
  })

  it('keeps hidden commands executable', async () => {
    const ctx = await setup()
    let called = 0
    ctx.commands.register({
      id: 'test.hidden',
      title: 'Hidden',
      hidden: () => true,
      run: () => {
        called++
      },
    })
    expect(ctx.commands.visible()).toHaveLength(0)
    await ctx.commands.execute('test.hidden')
    expect(called).toBe(1)
    await ctx.kernel.dispose()
  })

  it('honours enabled and checked predicates', async () => {
    const ctx = await setup()
    let enabled = false
    ctx.commands.register({
      id: 'test.state',
      title: 'State',
      enabled: () => enabled,
      checked: () => enabled,
      run: () => undefined,
    })
    await expect(ctx.commands.execute('test.state')).rejects.toThrow(/不可用/)
    enabled = true
    await expect(ctx.commands.execute('test.state')).resolves.toBeUndefined()
    expect(ctx.commands.isChecked('test.state')).toBe(true)
    await ctx.kernel.dispose()
  })

  it('emits failure events', async () => {
    const ctx = await setup()
    const seen: unknown[] = []
    ctx.on('command/failed', (_id, error) => seen.push(error))
    ctx.commands.register({
      id: 'test.fail',
      title: 'Fail',
      run: () => { throw new Error('boom') },
    })
    await expect(ctx.commands.execute('test.fail')).rejects.toThrow('boom')
    expect(seen).toHaveLength(1)
    await ctx.kernel.dispose()
  })

  it('keeps CommandService registered on the context', async () => {
    const ctx = await setup()
    expect(ctx.commands).toBeInstanceOf(CommandService)
    await ctx.kernel.dispose()
  })
})
