import 'virtual:uno.css'
import '@df/ui/theme.css'

async function boot(): Promise<void> {
  let runtime: Awaited<ReturnType<NonNullable<Window['desktopFramework']>['getRuntime']>> = null
  try {
    runtime = await window.desktopFramework?.getRuntime() ?? null
  }
  catch (error) {
    console.warn('[renderer] 无法读取框架运行时信息，使用本地版本', error)
  }
  if (runtime?.mode === 'remote' && runtime.entryUrl) {
    if (runtime.styleUrl) {
      await new Promise<void>((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = runtime.styleUrl!
        link.onload = () => resolve()
        link.onerror = () => reject(new Error('远程运行时样式加载失败'))
        document.head.append(link)
      })
    }
    const module = await import(/* @vite-ignore */ runtime.entryUrl) as {
      createFrameworkApp?: (options: Record<string, unknown>) => Promise<unknown>
    }
    if (typeof module.createFrameworkApp !== 'function') {
      throw new TypeError('远程运行时未导出 createFrameworkApp')
    }
    await module.createFrameworkApp({
      el: '#app',
      title: 'Desktop Framework — Runtime',
    })
    return
  }

  // 本地框架延迟到确定不走远程运行时后再加载，避免重复注册 nusys-ui Custom Elements。
  const [{ createPlaygroundApp }, { DetachedEditorShell, DetachedPanelShell }] = await Promise.all([
    import('@df/playground'),
    import('@df/app'),
  ])
  const windowContext = await window.desktopFramework?.getWindowContext?.() ?? null
  if (windowContext?.kind === 'editor') {
    await createPlaygroundApp({
      el: '#app',
      title: 'Desktop Framework — Editor',
      shell: {
        component: DetachedEditorShell,
      },
      shellProps: {
        context: windowContext,
      },
    })
    return
  }
  if (windowContext?.kind === 'panel') {
    await createPlaygroundApp({
      el: '#app',
      title: 'Desktop Framework — Panel',
      shell: {
        component: DetachedPanelShell,
      },
      shellProps: {
        context: windowContext,
      },
    })
    return
  }
  await createPlaygroundApp({
    el: '#app',
    title: 'Desktop Framework — Electron Playground',
  })
}

boot().catch((error) => {
  console.error(error)
  const root = document.querySelector('#app')
  if (root) {
    const heading = document.createElement('h1')
    heading.textContent = '桌面框架启动失败'
    const detail = document.createElement('pre')
    detail.textContent = String(error?.stack ?? error)
    root.replaceChildren(heading, detail)
  }
})
