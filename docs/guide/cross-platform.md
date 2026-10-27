# 跨平台构建

## 开发

| 平台 | 命令 |
| --- | --- |
| Windows / macOS / Linux | `pnpm dev`、`pnpm dev:desktop` |

Vite 与 electron-vite 处理路径差异；WASM 构建使用 `wasm-pack`，Windows 下脚本显式使用 `.cmd`。

## 打包

```bash
pnpm package:desktop
```

electron-builder 配置位于 `apps/desktop/electron-builder.yml`：

- Windows：NSIS
- macOS：DMG，hardened runtime
- Linux：AppImage + deb

产物输出到 `apps/desktop/release/`。

## Electron 路径

- 主进程 preload：`out/preload/index.cjs`
- 渲染页面：`out/renderer/index.html`
- 生产加载：`df-app://bundle/index.html`
- 运行时配置：`process.resourcesPath/desktop-framework.config.json`
- 运行时缓存：`app.getPath('userData')/framework/...`

绝不使用 `file://` 加载渲染进程，避免 WASM fetch 与 CSP 问题。

## GitHub Actions

### CI

`.github/workflows/ci.yml`：

- `web`：pnpm install、lint、typecheck、test、build web、build runtime、build docs。
- `rust`：Windows/macOS/Linux 矩阵，fmt、test、clippy、wasm32 check。

### Release

`.github/workflows/release.yml`：

- 触发：`v*` tag 或手动。
- 三平台矩阵构建 WASM、runtime、electron 安装包。
- 上传 runtime 归档 `desktop-framework-runtime-<short>.tar.gz`。
- 创建 GitHub Release，附安装包与 `integrity.txt`。

### Docs

`.github/workflows/docs.yml`：构建 VitePress 并部署 GitHub Pages。

## 签名

未配置证书时产物未签名，适合内部测试。生产需要：

- Windows：`CSC_LINK` / `CSC_KEY_PASSWORD`
- macOS：Developer ID 证书 + notarization（`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`）
- Linux：可选 GPG 签名

签名信息只放在 CI Secrets，不写入仓库。

## 平台差异注意

| 项目 | 处理 |
| --- | --- |
| 自定义标题栏 | Windows/Linux `frame:false`；macOS `hiddenInset` 保留交通灯 |
| 菜单栏 | Windows/Linux 隐藏但保留快捷键；macOS 使用系统菜单 |
| 文件路径 | 统一 `node:path`，协议 URL 使用 POSIX 风格 |
| 字体 | 系统字体回退链，避免打包字体体积 |
| 快捷键 | `Mod` 在 macOS 解析为 Cmd，其他为 Ctrl |
| 单实例 | 三平台一致，macOS 额外处理 `open-file` |

## 离线构建

- `pnpm build:wasm` 使用 `--no-opt`，不下载 Binaryen。
- 提交 `packages/wasm/generated`，无 Rust 环境也能构建前端。
- Electron 二进制可通过镜像或 `ELECTRON_OVERRIDE_DIST_PATH` 指定。
- 运行时配置 `mode: workspace` 可完全离线。

## 原生依赖

当前 Electron 主进程没有原生 node 模块；`tar` 是纯 JS。`npmRebuild: false` 可缩短打包时间。若未来加入原生模块，需要恢复 electron-builder 的 app-deps 安装，并在 CI 三平台分别编译。
