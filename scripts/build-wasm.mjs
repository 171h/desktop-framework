#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
/**
 * 构建 Rust → WebAssembly。
 *
 * 输出到 `packages/wasm/generated`，与 `@df/wasm` 的静态导入
 * 路径一致。生成物建议提交到仓库，保证没有 Rust 工具链的宿主也能直接启动；
 * CI 会重新构建并验证一致性。
 *
 * 用法：
 *   pnpm build:wasm        发布构建（体积优化）
 *   pnpm build:wasm:dev    开发构建（编译更快）
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'packages/wasm/generated')
const dev = process.argv.includes('--dev')

if (!existsSync(resolve(root, 'crates/df_wasm/Cargo.toml'))) {
  console.error('未找到 crates/df_wasm，请在仓库根目录运行。')
  process.exit(1)
}

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

const command = process.platform === 'win32'
  ? 'wasm-pack.cmd'
  : 'wasm-pack'
const args = [
  'build',
  'crates/df_wasm',
  '--target',
  'web',
  '--out-dir',
  output,
  '--out-name',
  'df_wasm',
  // 不下载 Binaryen；Rust 侧已经使用 wasm-release 体积优化。
  '--no-opt',
  ...(dev
    ? ['--dev']
    : ['--profile', 'wasm-release']),
]

console.log(`[wasm] ${command} ${args.join(' ')}`)
const result = spawnSync(command, args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error(`[wasm] 无法启动 wasm-pack：${result.error.message}`)
  console.error('请先执行 pnpm install，或安装 wasm-pack：cargo install wasm-pack')
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(`[wasm] 输出目录：${output}`)
