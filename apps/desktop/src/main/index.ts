import { join, resolve } from 'node:path'
import { bootstrapElectron, showStartupError } from '@df/electron/main'
import { app } from 'electron'

const configPath = process.env.DF_RUNTIME_CONFIG
  ?? (app.isPackaged
    ? join(process.resourcesPath, 'desktop-framework.config.json')
    : resolve(app.getAppPath(), '../../playground/desktop-framework.config.json'))

if (process.platform === 'win32') {
  app.setAppUserModelId('dev.desktop-framework.playground')
}

bootstrapElectron({
  appId: 'dev.desktop-framework.playground',
  productName: 'Desktop Framework',
  version: app.getVersion(),
  renderer: {
    devUrl: process.env.ELECTRON_RENDERER_URL,
    file: join(__dirname, '../renderer/index.html'),
    title: 'Desktop Framework — Playground',
    backgroundColor: '#141619',
  },
  window: {
    width: 1500,
    height: 940,
    minWidth: 1040,
    minHeight: 680,
  },
  runtime: {
    configPath,
    offline: process.env.DF_OFFLINE === '1',
  },
  externalProtocols: ['https:', 'http:', 'mailto:'],
}).catch((error) => {
  showStartupError(error)
  app.quit()
})
