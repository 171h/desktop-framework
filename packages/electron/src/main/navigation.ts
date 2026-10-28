/** 页面导航与 IPC 共用同一来源规则；运行时协议仅加载资产，不作为顶层页面。 */
export function isAllowedNavigation(value: string, devUrl?: string): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password)
      return false
    if (url.protocol === 'df-app:')
      return url.hostname === 'bundle' && !url.port
    if (!devUrl)
      return false
    const dev = new URL(devUrl)
    return ['http:', 'https:'].includes(dev.protocol) && url.origin === dev.origin
  }
  catch {
    return false
  }
}
