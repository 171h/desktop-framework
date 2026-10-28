import { defineConfig } from 'vitepress'

const base = process.env.DOCS_BASE ?? '/'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Desktop Framework',
  description: '插件化、跨平台、AutoDesk 风格的桌面应用框架',
  base,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    [
      'meta',
      { name: 'theme-color', content: '#141619' },
    ],
    [
      'meta',
      { property: 'og:type', content: 'website' },
    ],
    [
      'meta',
      { property: 'og:title', content: 'Desktop Framework' },
    ],
    [
      'meta',
      { property: 'og:description', content: 'Rust + WebAssembly + Vue 3 + Electron 的插件化桌面应用框架' },
    ],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '架构', link: '/architecture/overview' },
      { text: '参考', link: '/reference/packages' },
      { text: 'GitHub', link: 'https://github.com/171h/desktop-framework' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '集成到自己的软件', link: '/guide/integration' },
            { text: '命令系统', link: '/guide/commands' },
            { text: '文档标签页', link: '/guide/editor' },
            { text: '浮动侧栏与停靠', link: '/guide/docking' },
            { text: '工作区', link: '/guide/workspaces' },
          ],
        },
        {
          text: '开发',
          items: [
            { text: '插件开发', link: '/guide/plugins' },
            { text: '主题与 nusys-ui', link: '/guide/theming' },
            { text: '跨平台构建', link: '/guide/cross-platform' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: '架构',
          items: [
            { text: '总览', link: '/architecture/overview' },
            { text: '源码布局', link: '/architecture/source-layout' },
            { text: '插件模型', link: '/architecture/plugin-model' },
            { text: 'Electron 宿主', link: '/architecture/electron' },
            { text: '运行时拉取', link: '/architecture/runtime-pull' },
            { text: '性能策略', link: '/architecture/performance' },
          ],
        },
      ],
      '/design/': [
        {
          text: '设计参考',
          items: [
            { text: 'AutoDesk 的设计共性', link: '/design/autodesk' },
            { text: 'VS Code 的实现借鉴', link: '/design/vscode' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '包清单', link: '/reference/packages' },
            { text: 'Rust crate', link: '/reference/crates' },
            { text: '配置 schema', link: '/reference/configuration' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/171h/desktop-framework' },
    ],
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
      label: '本页目录',
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: { dateStyle: 'medium', timeStyle: 'short' },
    },
    footer: {
      message: 'MIT License · 以插件组装复杂桌面软件',
      copyright: 'Copyright © 2026 171H',
    },
    editLink: {
      pattern: 'https://github.com/171h/desktop-framework/edit/main/docs/:path',
      text: '编辑此页',
    },
  },
})
