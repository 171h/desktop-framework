import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  defaultArtifactUrl,
  normalizeRepository,
  parseFrameworkConfig,
  resolveArtifactUrl,
  shortCommit,
} from '../src'
import { RuntimeResolver, verifyIntegrity } from '../src/node'

const temporary: string[] = []

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'df-bootstrap-'))
  temporary.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('bootstrap config', () => {
  it('normalizes repository and artifact url', () => {
    const repository = normalizeRepository('https://github.com/171h/desktop-framework.git/')
    expect(repository).toBe('https://github.com/171h/desktop-framework')
    expect(shortCommit('0123456789abcdef')).toBe('0123456')
    expect(defaultArtifactUrl(repository, '0123456789abcdef')).toContain('framework-0123456')
    const config = parseFrameworkConfig({
      framework: {
        repository,
        commit: '0123456789abcdef',
        artifact: { url: '{repository}/releases/{shortCommit}.tar.gz' },
      },
    })
    expect(config.framework.mode).toBe('auto')
    expect(resolveArtifactUrl(config.framework)).toBe(`${repository}/releases/0123456.tar.gz`)
  })

  it('rejects malformed configs', () => {
    expect(() => parseFrameworkConfig(null)).toThrow()
    expect(() => parseFrameworkConfig({
      framework: { repository: 'x', commit: '1234567' },
    })).toThrow()
    expect(() => parseFrameworkConfig({
      framework: { repository: 'https://x', commit: '123' },
    })).toThrow()
  })

  it('verifies sri and hex integrity', async () => {
    const bytes = new TextEncoder().encode('desktop-framework')
    const sri = await verifyIntegrity(bytes)
    expect(sri).toMatch(/^sha256-/)
    await expect(verifyIntegrity(bytes, sri)).resolves.toBe(sri)
    await expect(verifyIntegrity(bytes, 'sha256-AAAA')).rejects.toThrow()
    const hex = createHash('sha256').update(bytes).digest('hex')
    await expect(verifyIntegrity(bytes, `sha256:${hex}`)).resolves.toBe(`sha256:${hex}`)
  })

  it('reuses a cached runtime when commit and entry match', async () => {
    const cacheDir = await tempDir()
    const repository = 'https://github.com/171h/desktop-framework'
    const commit = '0123456789abcdef0123456789abcdef01234567'
    const repoHash = createHash('sha256').update(repository).digest('hex').slice(0, 8)
    const directory = join(cacheDir, `${commit.slice(0, 16)}-${repoHash}`)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({
      commit,
      entry: 'index.js',
      style: 'style.css',
    }))
    await writeFile(join(directory, 'index.js'), 'export const ok = true')
    await writeFile(join(directory, 'style.css'), 'body{}')
    const resolver = new RuntimeResolver({ cacheDir })
    const result = await resolver.resolve(parseFrameworkConfig({
      framework: {
        repository,
        commit,
        mode: 'remote',
      },
    }))
    expect(result.mode).toBe('remote')
    expect(result.cached).toBe(true)
    expect(result.entryFile).toContain('index.js')
    expect(result.styleFile).toContain('style.css')
  })

  it('falls back in auto mode when offline', async () => {
    const resolver = new RuntimeResolver({
      cacheDir: await tempDir(),
      offline: true,
    })
    const result = await resolver.resolve(parseFrameworkConfig({
      framework: {
        repository: 'https://github.com/171h/desktop-framework',
        commit: '0123456789abcdef0123456789abcdef01234567',
        mode: 'auto',
      },
    }))
    expect(result.mode).toBe('workspace')
    expect(result.fallbackReason).toContain('离线')
  })
})
