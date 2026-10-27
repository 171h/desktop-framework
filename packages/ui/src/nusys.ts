/**
 * nusys-ui 引导。
 *
 * 组件库依赖宿主页面中以固定 id 引入的 Codicon 样式表；这里通过 Vite 的
 * `?url` 导入生成带哈希的 CSS 地址，再插入 `<link id="vscode-codicon-stylesheet">`，
 * 既支持浏览器也支持 Electron 的 `df-app://` 协议。
 */
import type { VscRibbonTab } from 'nusys-ui'
import codiconCssUrl from '@vscode/codicons/dist/codicon.css?url'
import 'nusys-ui'

let installed = false

/** 确保 Codicon 样式表已插入。 */
export function ensureCodiconStylesheet(): void {
  if (installed || typeof document === 'undefined') {
    return
  }
  installed = true
  if (document.getElementById('vscode-codicon-stylesheet')) {
    return
  }
  const link = document.createElement('link')
  link.id = 'vscode-codicon-stylesheet'
  link.rel = 'stylesheet'
  link.href = codiconCssUrl
  document.head.append(link)
}

export type { VscRibbonTab }
