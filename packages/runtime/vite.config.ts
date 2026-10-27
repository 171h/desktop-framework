import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  publicDir: false,
  // 运行时在纯浏览器环境加载，必须移除 Vue 等依赖中的 Node 环境判断。
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '({})',
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('vscode-'),
        },
      },
    }),
    UnoCSS({
      configFile: fileURLToPath(new URL('../../uno.config.ts', import.meta.url)),
    }),
  ],
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    sourcemap: false,
    minify: 'oxc',
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: assetInfo => assetInfo.name?.endsWith('.css')
          ? 'style.css'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
})
