# 快速开始

## 环境要求

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | 22.18+，推荐 24 | Vite 8 / Electron 45 的运行时 |
| pnpm | 12+ | 工作区与锁文件 |
| Rust | 1.90+ | WASM 模糊搜索内核 |
| wasm32 目标 | `rustup target add wasm32-unknown-unknown` | `build:wasm` 使用 |
| Git | 支持 submodule | 拉取 nusys-ui |

## 安装

```bash
git clone --recurse-submodules https://github.com/171h/desktop-framework.git
cd desktop-framework
corepack enable
pnpm install
```

如果克隆时遗漏了子模块：

```bash
pnpm prepare
# 或
git submodule update --init --depth 1 submodules/nusys-ui
```

Electron 二进制约 250MB，可能因网络或代理在 `pnpm install` 时下载失败。单独安装：

```bash
pnpm setup:electron
```

如果默认源不可用，脚本会自动尝试 npmmirror 镜像；也可以手动指定已有 Electron：

```powershell
$env:ELECTRON_EXEC_PATH="C:\path\to\electron.exe"
pnpm dev:desktop
```

`pnpm dev:desktop` 和 `pnpm package:desktop` 都会在启动前执行这一步检查。

## 构建 WASM

```bash
pnpm build:wasm        # wasm-release
pnpm build:wasm:dev    # 更快，适合调试
```

生成物写入 `packages/wasm/generated/`，由 `@df/wasm` 静态导入。生成物提交在仓库中，因此没有 Rust 工具链的宿主也可以直接启动；CI 会重新构建验证。

`wasm-pack` 通过 `--no-opt` 跳过 Binaryen 下载，避免离线或受限网络环境卡住。Rust 侧已使用 `wasm-release` profile 控制体积。

## 启动示例

```bash
pnpm dev            # http://127.0.0.1:5173
pnpm dev:desktop    # Electron 窗口
```

如果 Electron 二进制因网络原因未下载，可以：

```bash
pnpm rebuild electron
# 或设置 ELECTRON_OVERRIDE_DIST_PATH 指向已有 Electron 发行目录
```

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | Web 示例应用 |
| `pnpm dev:desktop` | 构建 WASM 后启动 Electron 示例 |
| `pnpm build` | WASM + Web + Electron 产物 |
| `pnpm build:web` | 构建 `apps/web` |
| `pnpm build:desktop` | electron-vite 构建 `apps/desktop` |
| `pnpm build:runtime` | 生成可按 commit 拉取的运行时 `.tar.gz` |
| `pnpm package:desktop` | electron-builder 生成当前平台安装包 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm typecheck` | vue-tsc 全仓库类型检查 |
| `pnpm lint` | ESLint / antfu 规则 |
| `pnpm rust:test` | Rust 单元测试 |
| `pnpm rust:clippy` | Rust 静态检查 |
| `pnpm docs:dev` | 本地文档站 |

## 目录导航

```text
crates/              Rust：模糊搜索、WASM 绑定
packages/            TS：内核、UI、工作台、画布、Electron、运行时加载器
apps/                Web / Electron 示例应用
playground/          示例插件、运行时配置与测试场景
docs/                VitePress 文档
submodules/nusys-ui  唯一 UI 组件来源
```

## 下一步

- [把自己的软件接入框架](/guide/integration)
- [编写第一个插件](/guide/plugins)
- [理解命令系统](/guide/commands)
- [了解 Electron 宿主实现](/architecture/electron)
