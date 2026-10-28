#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
/**
 * 构建可按 commit 拉取的框架运行时归档。
 *
 * 1. Vite 将 packages/runtime 打包为 ESM + CSS；
 * 2. 写入 manifest.json（包含精确 commit）；
 * 3. 使用 tar.gz 打包到 packages/runtime/release；
 * 4. 输出 SHA-256，供 desktop-framework.config.json 的 integrity 字段使用。
 *
 * 用法：
 *   pnpm build:runtime
 *   pnpm build:runtime -- --commit <sha>
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, rm, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { create } from 'tar'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDir = join(root, 'packages/runtime')
const dist = join(runtimeDir, 'dist')
const release = join(runtimeDir, 'release')

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('pnpm', ['--filter', '@df/runtime', 'build'])

const commitArgIndex = process.argv.indexOf('--commit')
const commit = commitArgIndex >= 0
  ? process.argv[commitArgIndex + 1]
  : spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()

if (!commit) {
  console.error('无法确定 commit；请在 git 仓库中运行或传入 --commit')
  process.exit(1)
}
const short = commit.slice(0, 7)
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

// Vite 库模式在多个 CSS 来源时可能输出 style.css / style2.css。合并为单一样式表，
// 避免远程运行时只加载其中一个导致组件样式缺失。
const cssFiles = readdirSync(dist)
  .filter(file => file.endsWith('.css'))
  .sort((left, right) => left === 'style.css'
    ? -1
    : right === 'style.css'
      ? 1
      : left.localeCompare(right))
if (cssFiles.length > 1) {
  const merged = cssFiles.map(file => readFileSync(join(dist, file), 'utf8')).join('\n')
  writeFileSync(join(dist, 'style.css'), merged, 'utf8')
  for (const file of cssFiles) {
    if (file !== 'style.css') {
      await unlink(join(dist, file))
    }
  }
}
const style = existsSync(join(dist, 'style.css'))
const manifest = {
  commit,
  version,
  entry: 'index.js',
  ...(style
    ? { style: 'style.css' }
    : {}),
}
writeFileSync(join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

await rm(release, { recursive: true, force: true })
await mkdir(release, { recursive: true })
const archive = join(release, `desktop-framework-runtime-${short}.tar.gz`)
await create(
  {
    gzip: true,
    cwd: dist,
    file: archive,
    portable: true,
  },
  [
    'manifest.json',
    'index.js',
    ...(style
      ? ['style.css']
      : []),
    'assets',
  ].filter(path => existsSync(join(dist, path))),
)

const bytes = readFileSync(archive)
const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
writeFileSync(join(release, 'integrity.txt'), `${integrity}\n`, 'utf8')
console.log(`\n运行时归档：${archive}`)
console.log(`commit：${commit}`)
console.log(`integrity：${integrity}`)
