# 源码布局

布局参考 [rolldown](https://github.com/rolldown/rolldown)：Rust 工作区与 TypeScript 工作区并列，示例应用、文档与脚本位于根目录。

```text
desktop-framework/
├─ crates/
│  ├─ df_fuzzy/            # Rust 模糊搜索内核
│  └─ df_wasm/             # wasm-bindgen 绑定
├─ packages/
│  ├─ core/                # 类型、事件、工具
│  ├─ kernel/              # Cordis 内核
│  ├─ vscode/              # vscode-instantiation 适配层
│  ├─ vue/                 # Pinia / Vue 桥
│  ├─ settings/            # 本地存储
│  ├─ commands/            # 命令
│  ├─ keybindings/         # 快捷键
│  ├─ ui/                  # 主题、槽位、nusys-ui 包装
│  ├─ notifications/       # 通知
│  ├─ statusbar/           # 状态栏
│  ├─ workbench/           # 布局与工作区
│  ├─ editor/              # 文档标签页
│  ├─ ribbon/              # Ribbon
│  ├─ menu/                # 应用菜单
│  ├─ selection/           # 选择状态
│  ├─ surface/             # WebGL2 画布
│  ├─ explorer/            # 资源浏览器
│  ├─ properties/          # 属性面板
│  ├─ output/              # 输出面板
│  ├─ wasm/                # WASM 加载器
│  ├─ platform/            # 宿主能力
│  ├─ bootstrap/           # 运行时配置、下载、缓存
│  ├─ electron/            # Electron 宿主库
│  ├─ runtime/             # 远程运行时聚合入口
│  └─ app/                 # 装配、默认预设、AppShell
├─ apps/
│  ├─ web/                 # Vite Web 示例
│  └─ desktop/             # electron-vite + electron-builder
├─ playground/
│  ├─ app/                 # 示例插件与装配
│  └─ desktop-framework.config.json
├─ docs/                   # VitePress
├─ scripts/                # WASM / 运行时构建
├─ submodules/nusys-ui/    # UI 组件库
└─ .github/workflows/      # CI / Release / Pages
```

## 命名约定

- 包：`@desktop-framework/<capability>`
- Rust crate：`df_<capability>`；WASM 包名固定 `df_wasm`
- Cordis 插件 id：`framework:<capability>`；业务插件建议 `vendor:<name>`
- 服务名：短小写，例如 `commands`、`workbench`
- 命令 id：`域.动作`，例如 `view.toggleLeft`

## 为什么每个能力独立成包

1. **可裁剪**：不使用 Ribbon 的产品可以只加载 `commands`、`workbench` 与自己的 UI。
2. **可替换**：`ribbon` 可以换成企业自己的工具栏实现，命令注册表不变。
3. **可独立测试**：包之间通过契约与服务交互，Vitest 可以单独加载插件。
4. **可运行时更新**：插件边界清晰，远程运行时可以按插件粒度热替换。

## apps 与 playground 的区别

- `apps/` 是可执行的宿主：负责 Electron/Vite 入口、打包配置、窗口参数与运行时配置。
- `playground/` 是业务插件示例：只通过公开 API 扩展视图、命令与画布内容，不修改框架内部。

## Rust 与 TypeScript 的边界

```text
TS: 命令候选列表 ──JSON──▶ WASM df_fuzzy
                              │
TS: 结果排序/高亮 ◀──JSON────┘
```

WASM 只承担 CPU 密集、数据量大的纯计算，不访问 DOM、文件系统或网络。文件下载、缓存与解压由 Node/Electron 完成。
