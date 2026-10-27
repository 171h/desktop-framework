import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
  ],
  resolve: {
    alias: {
      '@desktop-framework': fileURLToPath(new URL('./packages', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: [
      'packages/**/*.test.ts',
      'playground/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.{ts,vue}'],
      exclude: ['**/*.d.ts', 'packages/wasm/generated/**'],
    },
  },
})
