#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
/**
 * 确保 nusys-ui submodule 已检出。
 *
 * `pnpm install` 会触发 prepare；在 tarball 或离线环境中 submodule 可能不存在，
 * 此时只给出提示，不让依赖安装失败。CI 使用 actions/checkout 的 submodules 选项。
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'submodules/nusys-ui')
const marker = resolve(target, 'package.json')

if (existsSync(marker)) {
  process.exit(0)
}

if (!existsSync(resolve(root, '.git'))) {
  console.warn('[desktop-framework] 未找到 .git，跳过 nusys-ui 子模块初始化。')
  process.exit(0)
}

console.log('[desktop-framework] 正在初始化 nusys-ui 子模块…')
const result = spawnSync('git', [
  'submodule',
  'update',
  '--init',
  '--depth',
  '1',
  'submodules/nusys-ui',
], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  console.warn('[desktop-framework] 子模块初始化失败；UI 包仍可通过 npm 安装使用。')
}
