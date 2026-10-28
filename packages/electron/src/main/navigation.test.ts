import { describe, expect, it } from 'vitest'
import { isAllowedNavigation } from './navigation'

describe('trusted navigation', () => {
  it.each([
    'http://localhost:51730/evil',
    'http://localhost:5173.evil.example/',
    'http://localhost:5173@evil.example/',
    'df-app://evil/index.html',
    'df-runtime://abcdef0/index.js',
    'file:///etc/passwd',
    'invalid',
  ])('rejects lookalike origins and non-page protocols: %s', (url) => {
    expect(isAllowedNavigation(url, 'http://localhost:5173')).toBe(false)
  })

  it('allows the app bundle and the exact development origin', () => {
    expect(isAllowedNavigation('df-app://bundle/index.html')).toBe(true)
    expect(isAllowedNavigation('http://localhost:5173/src/main.ts', 'http://localhost:5173/')).toBe(true)
    expect(isAllowedNavigation('https://example.com')).toBe(false)
  })
})
