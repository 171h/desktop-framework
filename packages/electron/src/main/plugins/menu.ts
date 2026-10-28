/** 原生菜单插件。 */
import type { Context } from 'cordis'
import type { MenuItemConstructorOptions } from 'electron'
import { DisposableStore, toDisposable } from '@df/vscode'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { CHANNELS } from '../../shared'

export const name = 'electron:menu'
export const inject = ['electronHost']

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await host.whenReady()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:menu')

  const send = (command: string) => (): void => {
    // DevTools 独立窗口可能持有焦点；菜单命令始终发给安装了框架桥的主窗口。
    const target = host.mainWindow
    target?.webContents.send(CHANNELS.command, command)
  }

  const template = host.options.menu === false
    ? null
    : host.options.menu ?? defaultTemplate(send)

  if (template) {
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }
  else {
    Menu.setApplicationMenu(null)
  }

  const hideMenuBar = (): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.setMenuBarVisibility(false)
    }
  }
  hideMenuBar()
  const onCreate = (): void => hideMenuBar()
  app.on('browser-window-created', onCreate)
  disposables.add(toDisposable(() => app.off('browser-window-created', onCreate)))
}

function defaultTemplate(send: (command: string) => () => void): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  template.push(
    {
      label: '文件',
      submenu: [
        {
          label: '命令面板…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: send('ui.commandPalette'),
        },
        { type: 'separator' },
        isMac
          ? { role: 'close' }
          : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换左侧栏',
          accelerator: 'CmdOrCtrl+B',
          click: send('view.toggleLeft'),
        },
        {
          label: '切换右侧栏',
          accelerator: 'CmdOrCtrl+Alt+B',
          click: send('view.toggleRight'),
        },
        {
          label: '切换底部面板',
          accelerator: 'CmdOrCtrl+J',
          click: send('view.toggleBottom'),
        },
        {
          label: '折叠功能区',
          click: send('view.toggleRibbon'),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '开发者',
      submenu: [
        {
          label: '切换开发者工具',
          accelerator: isMac ? 'Command+Alt+I' : 'Ctrl+Shift+I',
          click: send('developer.toggleDevTools'),
        },
        {
          label: '重载窗口',
          accelerator: 'CmdOrCtrl+R',
          click: send('developer.reloadWindow'),
        },
        {
          label: '忽略缓存重载',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: send('developer.reloadIgnoringCache'),
        },
        { type: 'separator' },
        {
          label: '运行诊断',
          click: send('developer.showDiagnostics'),
        },
        {
          label: '运行输出',
          click: send('developer.showOutput'),
        },
        {
          label: '导出诊断',
          click: send('developer.exportDiagnostics'),
        },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { role: 'front' as const },
            ]
          : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '打开框架文档',
          click: () => {
            void shell.openExternal('https://github.com/171h/desktop-framework/tree/main/docs')
          },
        },
      ],
    },
  )

  return template
}
