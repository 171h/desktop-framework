import { createPlaygroundApp } from '@df/playground'
import 'virtual:uno.css'
import '@df/ui/theme.css'

async function boot(): Promise<void> {
  const app = await createPlaygroundApp({
    el: '#app',
    title: 'Desktop Framework — Web Playground',
  })
  window.addEventListener('beforeunload', () => {
    void app.dispose()
  })
}

boot().catch((error) => {
  console.error(error)
  const root = document.querySelector('#app')
  if (root) {
    root.innerHTML = `
      <div style="padding:40px;font-family:system-ui;color:#e7e9ec;background:#141619;min-height:100vh">
        <h1 style="font-size:18px">框架启动失败</h1>
        <pre style="color:#f06d6d;white-space:pre-wrap">${String(error?.stack ?? error)}</pre>
      </div>
    `
  }
})
