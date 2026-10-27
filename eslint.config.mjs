import antfu from '@antfu/eslint-config'

/**
 * 仓库级 ESLint 配置。
 *
 * 采用 antfu 的现代前端规范；nusys-ui 是原生 Custom Elements，因此需要
 * 放行其命名插槽，并把 submodule、Rust 产物和生成代码排除在检查之外。
 */
export default antfu({
  type: 'lib',
  vue: true,
  typescript: true,
  unocss: true,
  formatters: false,
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  ignores: [
    '**/dist/**',
    '**/out/**',
    '**/node_modules/**',
    '**/coverage/**',
    'submodules/**',
    'target/**',
    'crates/**/pkg/**',
    'packages/wasm/generated/**',
    'docs/.vitepress/cache/**',
    'docs/.vitepress/dist/**',
    'pnpm-lock.yaml',
    '**/Cargo.toml',
  ],
  rules: {
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'ts/explicit-function-return-type': 'off',
    'ts/ban-ts-comment': 'off',
    'ts/no-explicit-any': 'warn',
    'vue/multi-word-component-names': 'off',
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/no-deprecated-slot-attribute': ['error', {
      ignoreParents: [
        'vscode-ribbon',
        'vscode-split-layout',
        'vscode-tabs',
        'vscode-textfield',
        'vscode-tree-item',
      ],
    }],
    'unocss/order': 'warn',
  },
})
