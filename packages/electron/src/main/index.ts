/**
 * Electron 主进程启动器。
 *
 * 与 VS Code 一致的部分：
 * - 在 app ready 前注册自定义协议与单实例锁；
 * - 主进程也使用 Cordis 插件，窗口/IPC/菜单/会话/运行时各自独立；
 * - 渲染进程通过受控协议加载，不暴露 Node；
 * - 启动阶段使用 performance mark 与 `vscode-instantiation` 生命周期工具。
 */
import type { Context } from 'cordis'
import type { ElectronHost, ElectronHostOptions } from '../shared'
import { errorMessage } from '@desktop-framework/core'
import { createFrameworkContext, pluginEntry } from '@desktop-framework/kernel'
import { app, crashReporter, dialog, protocol } from 'electron'
import * as ipcPlugin from './plugins/ipc'
import * as lifecyclePlugin from './plugins/lifecycle'
import * as menuPlugin from './plugins/menu'
import * as protocolPlugin from './plugins/protocol'
import * as runtimePlugin from './plugins/runtime'
import * as sessionPlugin from './plugins/session'
import * as windowPlugin from './plugins/window'
import { ElectronHostService } from './service'

export * from '../shared'
export { ElectronHostService } from './service'

/** 启动 Electron 宿主。 */
export async function bootstrapElectron(options: ElectronHostOptions): Promise<ElectronHost> {
  configureApplication(options)

  const ctx = await createFrameworkContext({
    environment: 'electron-main',
    version: options.version,
    strict: false,
  })
  try {
    ctx.on('kernel/plugin-loaded', (info) => {
      console.info(`[kernel] ✓ ${info.name} (${info.durationMs?.toFixed(1) ?? '?'}ms)`)
    })
    ctx.on('kernel/plugin-failed', (info) => {
      console.error(`[kernel] ✗ ${info.name}: ${info.error}`)
    })
    await options.setup?.(ctx)
    await ctx.kernel.load([
      pluginEntry(createHostPlugin(), options, {
        id: 'electron:host',
        name: 'Electron Host',
        version: options.version,
        description: '主进程共享状态',
      }),
      pluginEntry(lifecyclePlugin, undefined, { id: 'electron:lifecycle', name: '生命周期' }),
      pluginEntry(runtimePlugin, undefined, { id: 'electron:runtime', name: '运行时解析' }),
      pluginEntry(protocolPlugin, undefined, { id: 'electron:protocol', name: '安全协议' }),
      // IPC 必须先于窗口注册，确保首屏的 getRuntime 请求已有 handler。
      pluginEntry(ipcPlugin, undefined, { id: 'electron:ipc', name: 'IPC 桥' }),
      pluginEntry(windowPlugin, undefined, { id: 'electron:window', name: '主窗口' }),
      pluginEntry(menuPlugin, undefined, { id: 'electron:menu', name: '原生菜单' }),
      pluginEntry(sessionPlugin, undefined, { id: 'electron:session', name: '会话安全' }),
      ...(options.plugins ?? []),
    ])
    const host = ctx.electronHost
    if (!host?.mainWindow) {
      throw new Error('窗口创建失败')
    }
    host.startup.mark('bootstrapped')
    return {
      ctx,
      window: host.mainWindow,
      runtime: host.runtimeInfo,
      dispose: () => ctx.kernel.dispose(),
    }
  }
  catch (error) {
    await ctx.kernel.dispose().catch(() => {})
    throw error
  }
}

function createHostPlugin() {
  return {
    name: 'electron:host',
    inject: [] as string[],
    apply(ctx: Context, config: ElectronHostOptions) {
      ctx.plugin(ElectronHostService, config)
    },
  }
}

function configureApplication(options: ElectronHostOptions): void {
  const productName = options.productName ?? 'Desktop Framework'
  app.setName(productName)
  if (process.platform === 'win32') {
    app.setAppUserModelId(options.appId ?? 'dev.desktop-framework.app')
    // VS Code 同样在 Windows 上关闭原生窗口遮挡计算，避免后台窗口被错误节流。
    app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
  }
  app.commandLine.appendSwitch('force-color-profile', 'srgb')
  if (process.env.DF_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration()
  }
  if (options.crashReportUrl) {
    crashReporter.start({
      productName,
      submitURL: options.crashReportUrl,
      uploadToServer: true,
      compress: true,
    })
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'df-app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
    {
      scheme: 'df-runtime',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])

  if (options.singleInstance !== false) {
    const locked = app.requestSingleInstanceLock()
    if (!locked) {
      app.quit()
      throw new Error('已有实例正在运行')
    }
  }

  process.on('uncaughtException', (error) => {
    console.error('[electron] 未捕获异常', error)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[electron] 未处理 Promise 拒绝', reason)
  })

  app.on('ready', () => {
    app.setAboutPanelOptions({
      applicationName: productName,
      applicationVersion: options.version,
    })
  })
}

/** 显示启动失败对话框；在 app ready 之前会退回控制台。 */
export function showStartupError(error: unknown): void {
  const message = errorMessage(error)
  console.error('[electron] 启动失败', error)
  if (app.isReady()) {
    dialog.showErrorBox('应用启动失败', message)
  }
}
