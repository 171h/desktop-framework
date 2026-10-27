import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import UnoCSS from 'unocss/vite'

const frameworkPackages = [
  '@desktop-framework/core',
  '@desktop-framework/kernel',
  '@desktop-framework/vscode',
  '@desktop-framework/electron',
  '@desktop-framework/bootstrap',
  '@desktop-framework/platform',
  '@desktop-framework/playground',
  'cordis',
  'cosmokit',
  'vscode-instantiation',
  '@standard-schema/spec',
  'tar',
]

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({ exclude: frameworkPackages }),
    ],
    build: {
      rollupOptions: {
        input: fileURLToPath(new URL('./src/main/index.ts', import.meta.url)),
        output: {
          entryFileNames: 'index.js',
        },
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({ exclude: frameworkPackages }),
    ],
    build: {
      rollupOptions: {
        input: fileURLToPath(new URL('./src/preload/index.ts', import.meta.url)),
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs',
        },
      },
    },
  },
  renderer: {
    root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
    base: './',
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
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        input: fileURLToPath(new URL('./src/renderer/index.html', import.meta.url)),
      },
    },
  },
})
