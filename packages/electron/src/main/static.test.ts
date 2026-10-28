import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { serveFile } from './static'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('static protocol', () => {
  it('serves wasm MIME and refuses malformed or escaping paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'df-static-'))
    directories.push(root)
    await writeFile(join(root, 'test.wasm'), new Uint8Array([0, 97, 115, 109]))
    const response = await serveFile({ root, pathname: '/test.wasm' })
    expect(response.headers.get('content-type')).toBe('application/wasm')
    expect((await serveFile({ root, pathname: '/%ZZ' })).status).toBe(400)
    expect((await serveFile({ root, pathname: '/%2e%2e/outside' })).status).toBe(403)
  })

  it('refuses directory links that escape the published root', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'df-static-'))
    directories.push(directory)
    const root = join(directory, 'public')
    const outside = join(directory, 'private')
    await mkdir(root)
    await mkdir(outside)
    await writeFile(join(outside, 'secret.txt'), 'private')
    await symlink(outside, join(root, 'link'), process.platform === 'win32'
      ? 'junction'
      : 'dir')
    expect((await serveFile({ root, pathname: '/link/secret.txt' })).status).toBe(403)
  })
})
