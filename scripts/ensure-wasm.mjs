#!/usr/bin/env node
/**
 * 开发启动时复用已有的 WASM 生成物。
 *
 * `pnpm dev:desktop` 每次重新执行 wasm-pack 会占用数秒启动时间。这里只检查
 * Rust 源码是否比生成物更新，必要时再执行开发构建；发布构建仍使用完整
 * `pnpm build:wasm`。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'crates/df_wasm')
const output = resolve(root, 'packages/wasm/generated')
const wasmFile = join(output, 'df_wasm_bg.wasm')
const jsFile = join(output, 'df_wasm.js')

if (!existsSync(wasmFile) || !existsSync(jsFile)) {
  build()
  process.exit(0)
}

const generatedAt = Math.max(statSync(wasmFile).mtimeMs, statSync(jsFile).mtimeMs)
const sourceAt = Math.max(
  latestMtime(source),
  latestMtime(resolve(root, 'crates/df_fuzzy')),
  statSync(resolve(root, 'Cargo.lock')).mtimeMs,
  statSync(resolve(root, 'Cargo.toml')).mtimeMs,
)
if (sourceAt > generatedAt) {
  build()
  process.exit(0)
}

console.log('[wasm] 生成物已是最新，跳过构建')

function build() {
  console.log('[wasm] 开发生成物缺失或已过期，执行开发构建')
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'scripts/build-wasm.mjs'),
      '--dev',
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
  if (result.error) {
    console.error(`[wasm] 无法启动构建脚本：${result.error.message}`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

function latestMtime(directory) {
  let latest = statSync(directory).mtimeMs
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'target' || entry.name === 'node_modules') {
      continue
    }
    const path = join(directory, entry.name)
    const time = entry.isDirectory()
      ? latestMtime(path)
      : statSync(path).mtimeMs
    latest = Math.max(latest, time)
  }
  return latest
}
