import { apply as commandsPlugin } from '@df/commands'
import { createFrameworkContext } from '@df/kernel'
import { describe, expect, it } from 'vitest'
import {
  isEditableTarget,
  apply as keybindingsPlugin,
  normalizeBinding,
} from '../src'

describe('keybindings', () => {
  it('normalizes modifiers in stable order', () => {
    expect(normalizeBinding('shift+mod+p', false)).toBe('Ctrl+Shift+P')
    expect(normalizeBinding('Shift+Cmd+Mod+P', true)).toBe('Shift+Meta+P')
    expect(normalizeBinding('mod+shift+p', true)).toBe('Shift+Meta+P')
  })

  it('auto-registers command keybindings and dispatches', async () => {
    const ctx = await createFrameworkContext({ environment: 'test' })
    await ctx.plugin(commandsPlugin)
    await ctx.plugin(keybindingsPlugin)
    let calls = 0
    ctx.commands.register({
      id: 'test.shortcut',
      title: 'Shortcut',
      keybinding: 'Mod+Shift+P',
      run: () => {
        calls += 1
      },
    })
    const event = new KeyboardEvent('keydown', {
      key: 'P',
      ctrlKey: ctx.keybindings.platform !== 'mac',
      metaKey: ctx.keybindings.platform === 'mac',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(event)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(calls).toBe(1)
    await ctx.kernel.dispose()
  })

  it('detects editable targets', () => {
    const input = document.createElement('input')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    expect(isEditableTarget(input)).toBe(true)
    expect(isEditableTarget(checkbox)).toBe(false)
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
  })

  it('unregisters command shortcuts on command disposal', async () => {
    const ctx = await createFrameworkContext({ environment: 'test' })
    await ctx.plugin(commandsPlugin)
    await ctx.plugin(keybindingsPlugin)
    const registration = ctx.commands.register({
      id: 'test.temp',
      title: 'Temp',
      keybinding: 'Mod+K',
      run: () => undefined,
    })
    expect(ctx.keybindings.list.some(binding => binding.command === 'test.temp')).toBe(true)
    registration.dispose()
    expect(ctx.keybindings.list.some(binding => binding.command === 'test.temp')).toBe(false)
    await ctx.kernel.dispose()
  })
})
