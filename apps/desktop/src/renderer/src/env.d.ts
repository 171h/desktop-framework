/// <reference types="vite/client" />
import type { DesktopBridge } from '@desktop-framework/core'

declare global {
  interface Window {
    desktopFramework?: DesktopBridge
  }
}

export {}
