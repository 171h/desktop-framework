/// <reference types="vite/client" />
import type { DesktopBridge } from '@df/core'

declare global {
  interface Window {
    desktopFramework?: DesktopBridge
  }
}

export {}
