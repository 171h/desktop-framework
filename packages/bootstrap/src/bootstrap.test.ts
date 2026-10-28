import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { create } from 'tar'
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
const commit = '0123456789abcdef0123456789abcdef01234567'
const repository = 'https://github.com/171h/desktop-framework'

async function archive(manifest: unknown = { commit, entry: 'index.js', style: 'style.css' }): Promise<Uint8Array<ArrayBuffer>> {
  const directory = await tempDir()
  await writeFile(join(directory, 'index.js'), 'export const ok = true')
  await writeFile(join(directory, 'style.css'), 'body{}')
  const files = ['index.js', 'style.css']
  if (manifest !== null) {
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest))
    files.push('manifest.json')
  }
  const stream = create({ cwd: directory, gzip: true }, files)
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return new Uint8Array(Buffer.concat(chunks))
}

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

  it.each([
    { commit: '../../outside' },
    { commit: 'not-a-hash' },
    { entry: 'C:/outside.js' },
    { entry: '../outside.js' },
    { timeoutMs: -1 },
  ])('rejects unsafe runtime configuration %j', (override) => {
    expect(() => parseFrameworkConfig({
      framework: { repository, commit, ...override },
    })).toThrow()
  })

  it('reuses a cached runtime when commit and entry match', async () => {
    const cacheDir = await tempDir()
    const bytes = await archive()
    let downloads = 0
    const resolver = new RuntimeResolver({
      cacheDir,
      fetch: async () => {
        downloads++
        return new Response(bytes)
      },
    })
    const config = parseFrameworkConfig({
      framework: {
        repository,
        commit,
        mode: 'remote',
      },
    })
    await resolver.resolve(config)
    const result = await resolver.resolve(config)
    expect(downloads).toBe(1)
    expect(result.mode).toBe('remote')
    expect(result.cached).toBe(true)
    expect(result.entryFile).toContain('index.js')
    expect(result.styleFile).toContain('style.css')
    const offline = new RuntimeResolver({ cacheDir, offline: true })
    expect((await offline.resolve(config)).mode).toBe('remote')
  })

  it.each([
    null,
    {
      commit: commit.slice(0, 7),
      entry: 'index.js',
    },
    { commit, entry: '../outside.js' },
    { commit, entry: 'C:/outside.js' },
    { commit, entry: 'missing.js' },
    { commit, entry: 'index.js', style: '../outside.css' },
  ])('rejects invalid runtime manifests %j', async (manifest) => {
    const bytes = await archive(manifest)
    const resolver = new RuntimeResolver({
      cacheDir: await tempDir(),
      fetch: async () => new Response(bytes),
    })
    await expect(resolver.resolve({
      framework: { repository, commit, mode: 'remote' },
    })).rejects.toThrow()
  })

  it('does not silently replace a pinned remote runtime while offline', async () => {
    const resolver = new RuntimeResolver({ cacheDir: await tempDir(), offline: true })
    await expect(resolver.resolve({
      framework: { repository, commit, mode: 'remote' },
    })).rejects.toThrow('离线')
  })

  it('invalidates cache when integrity changes', async () => {
    const bytes = await archive()
    const resolver = new RuntimeResolver({
      cacheDir: await tempDir(),
      fetch: async () => new Response(bytes),
    })
    await resolver.resolve({
      framework: { repository, commit, mode: 'remote' },
    })
    await expect(resolver.resolve({
      framework: {
        repository,
        commit,
        mode: 'remote',
        artifact: { integrity: 'sha256-AAAA' },
      },
    })).rejects.toThrow('校验失败')
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
