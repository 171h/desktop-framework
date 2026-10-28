#!/usr/bin/env node
/**
 * 确保 Electron 二进制可用。
 *
 * pnpm 安装 Electron 包时，其 postinstall 可能因为网络、代理或 GitHub
 * 限流失败，留下 `path.txt` 缺失的“Electron uninstall”状态。dev:desktop
 * 在启动 electron-vite 前调用本脚本：
 *
 * - 已安装：直接返回；
 * - 未安装：先按当前环境安装，失败后用国内镜像重试；
 * - 仍失败：输出明确的手动安装命令与镜像变量。
 *
 * 该脚本不修改源码，也不把 Electron 二进制提交进仓库。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'apps/desktop/package.json'))

function resolveElectronPackage() {
  try {
    return dirname(require.resolve('electron/package.json'))
  }
  catch {
    // pnpm 在部分版本中不导出 package.json 时，回退到 require('electron')
    try {
      return dirname(require.resolve('electron'))
    }
    catch {
      return undefined
    }
  }
}

function platformExecutable() {
  if (process.platform === 'darwin') {
    return 'Electron.app/Contents/MacOS/Electron'
  }
  if (process.platform === 'win32') {
    return 'electron.exe'
  }
  return 'electron'
}

function isInstalled(electronDir) {
  const executable = join(electronDir, 'dist', platformExecutable())
  const pathFile = join(electronDir, 'path.txt')
  return existsSync(executable) && existsSync(pathFile)
}

function install(electronDir, label, env) {
  console.log(`[electron] ${label}`)
  return spawnSync(process.execPath, ['install.js'], {
    cwd: electronDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  }).status === 0
}

const electronDir = resolveElectronPackage()
if (!electronDir) {
  console.error('[electron] 找不到 electron 包，请先执行 pnpm install。')
  process.exit(1)
}

if (isInstalled(electronDir)) {
  process.exit(0)
}

if (process.env.ELECTRON_EXEC_PATH && existsSync(process.env.ELECTRON_EXEC_PATH)) {
  // electron-vite 直接读取这个环境变量，不需要 path.txt。
  console.log(`[electron] 使用 ELECTRON_EXEC_PATH=${process.env.ELECTRON_EXEC_PATH}`)
  process.exit(0)
}

console.log('[electron] 未找到 Electron 二进制，开始安装…')
const installed = install(electronDir, '尝试从默认源安装 Electron', {}) && isInstalled(electronDir)
if (!installed) {
  const installedWithMirror = install(electronDir, '默认源失败，使用 npmmirror 镜像重试', {
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
    electron_mirror: 'https://npmmirror.com/mirrors/electron/',
  }) && isInstalled(electronDir)
  if (!installedWithMirror) {
    console.error('\n[electron] 安装失败。请检查网络后手动执行：')
    console.error('  $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"')
    console.error(`  cd "${electronDir}"`)
    console.error('  node install.js')
    console.error('\n或设置已有 Electron 可执行文件：')
    console.error('  $env:ELECTRON_EXEC_PATH="C:\\path\\to\\electron.exe"')
    process.exit(1)
  }
}

console.log('[electron] 安装完成')
