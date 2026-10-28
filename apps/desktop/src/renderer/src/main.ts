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
    try {
      if (runtime.styleUrl) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = runtime.styleUrl
        document.head.append(link)
      }
      const module = await import(/* @vite-ignore */ runtime.entryUrl) as {
        createFrameworkApp?: (options: Record<string, unknown>) => Promise<unknown>
      }
      if (module.createFrameworkApp) {
        await module.createFrameworkApp({
          el: '#app',
          title: 'Desktop Framework — Runtime',
        })
        return
      }
    }
    catch (error) {
      console.warn('[renderer] 远程运行时加载失败，回退本地版本', error)
    }
  }

  // 本地框架延迟到确定不走远程运行时后再加载，避免重复注册 nusys-ui Custom Elements。
  const { createPlaygroundApp } = await import('@df/playground')
  await createPlaygroundApp({
    el: '#app',
    title: 'Desktop Framework — Electron Playground',
  })
}

boot().catch((error) => {
  console.error(error)
  const root = document.querySelector('#app')
  if (root) {
    root.innerHTML = `
      <div style="padding:40px;font-family:system-ui;color:#e7e9ec;background:#141619;min-height:100vh">
        <h1 style="font-size:18px">桌面框架启动失败</h1>
        <pre style="color:#f06d6d;white-space:pre-wrap">${String(error?.stack ?? error)}</pre>
      </div>
    `
  }
})
