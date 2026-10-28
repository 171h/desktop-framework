---
layout: home

hero:
  name: Desktop Framework
  text: 可组合的桌面软件工作台
  tagline: 借鉴 AutoDesk 的统一界面结构与 VS Code 的 Electron 工程实践，用 Cordis 把一切能力做成可热插拔的插件。
  image:
    src: /logo.svg
    alt: Desktop Framework
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 架构总览
      link: /architecture/overview
    - theme: alt
      text: GitHub
      link: https://github.com/171h/desktop-framework

features:
  - icon: 🧩
    title: 一切皆插件
    details: 内核、命令、Ribbon、面板、画布、Electron 主进程能力均由 Cordis 插件提供，可运行时加载、卸载与替换。
  - icon: 🎛️
    title: AutoDesk 式工作台
    details: 应用菜单、快速访问工具栏、Ribbon、停靠面板与状态栏共享统一坐标系，支持保存和切换工作区。
  - icon: ⚡
    title: 高性能交互
    details: WebGL2 按需渲染、DPR 上限、缓冲区复用；Rust/WASM 承担模糊搜索等热路径，复杂列表仍保持流畅。
  - icon: 🖥️
    title: 安全的 Electron 宿主
    details: 单实例、受控 df-app / df-runtime 协议、sandbox preload、窗口状态持久化、原生菜单与崩溃诊断。
  - icon: 🧬
    title: 运行时拉取
    details: 通过 desktop-framework.config.json 配置仓库和 commit，启动时自动查找缓存或拉取对应运行时制品并校验 SHA-256。
  - icon: 🌐
    title: 跨平台工作流
    details: Windows、macOS、Linux 共用同一套源码与 GitHub Actions，electron-builder 输出安装包。
---

## 它解决什么问题

当团队同时开发多个复杂桌面软件时，常见的问题不是某个功能写不出来，而是每个产品都重新实现一套标题栏、Ribbon、面板系统、快捷键、命令面板、窗口管理和构建流程，最终交互不一致、插件无法复用、性能问题反复出现。

Desktop Framework 把这些问题抽象为**稳定的服务契约 + 可替换的插件实现**：

```text
┌──────────────────────────────────────────────────────────────┐
│  Titlebar · Application Menu · Quick Access · Window controls │
├──────────────────────────────────────────────────────────────┤
│  Ribbon（由命令元数据自动生成）                                │
├───────────────┬──────────────────────────────┬───────────────┤
│  Explorer     │  Surface / Main View         │  Properties   │
│  Dock Views   │  WebGL2 demand rendering     │  Dock Views   │
├───────────────┴──────────────────────────────┴───────────────┤
│  Output / Bottom Dock                                        │
├──────────────────────────────────────────────────────────────┤
│  Status Bar · Notifications · Command Palette                │
└──────────────────────────────────────────────────────────────┘
```

## 三分钟了解架构

- **Cordis 内核**：插件通过 `inject` 声明依赖，Cordis 负责等待、排序、失败隔离和资源释放。
- **命令注册表**：Ribbon、菜单、快速访问工具栏、快捷键与命令面板共享同一份命令定义。
- **Pinia 工作台**：布局、面板宽度、活动视图、工作区预设全部可序列化。
- **WASM 热路径**：模糊搜索在 Rust 中执行，前端只消费紧凑结果；WASM 不可用时自动降级。
- **Electron 宿主**：主进程同样由插件组成，`lifecycle / runtime / protocol / window / ipc / menu / session` 各自独立。
- **运行时拉取**：宿主只保存配置，框架版本由仓库 + commit 决定，缓存命中时零重复下载。

## 从示例应用开始

```bash
git clone --recurse-submodules https://github.com/171h/desktop-framework.git
cd desktop-framework
corepack enable
pnpm install
pnpm build:wasm
pnpm dev            # 浏览器工作台
pnpm dev:desktop    # Electron 工作台
```

示例应用位于 `apps/`，示例插件位于 `playground/`。它们只使用框架公开 API，不修改框架内部。
