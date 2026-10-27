# 贡献指南

## 提交规范

使用 Conventional Commits，描述使用中文：

```text
feat(ribbon): 增加命令驱动的上下文页签
fix(electron): 修复窗口还原后菜单栏重新出现
docs: 补充运行时缓存校验说明
refactor(surface): 拆分网格渲染器
```

每个提交应保持可构建、可测试。

## 代码风格

- TypeScript / Vue：antfu ESLint 规范，单引号、2 空格、无分号。
- CSS：UnoCSS 原子类 + 主题变量，不在模板里写死颜色。
- Rust：`cargo fmt`，Clippy `-D warnings`，公共项写中文文档注释。
- 包描述、Cargo 描述、面向用户的错误消息使用中文。

## 新增插件包

1. 在 `packages/<name>` 创建 `package.json`，包含完整中文 `description`。
2. 源码 `src/index.ts` 导出 `name`、`inject`、`apply`、`default`。
3. 使用 `ctx.effect` 管理注册与清理。
4. 依赖只指向 `workspace:*` 或公开包。
5. 在 `packages/app/src/preset.ts` 决定是否加入默认预设。
6. 在 `docs/reference/packages.md` 增加说明。
7. 添加 Vitest 测试，至少覆盖注册、执行、卸载。

## 新增 Rust crate

1. `crates/<name>/Cargo.toml` 继承 workspace 元数据，中文 description。
2. 纯计算优先支持 `wasm32-unknown-unknown`。
3. 若依赖文件系统/子进程，在 crate 文档与 `docs/reference/crates.md` 说明不能 WASM 的原因。
4. 更新根 `Cargo.toml` 的 workspace 依赖与 `rust:check:wasm` 脚本。
5. 运行 fmt、test、clippy。

## UI 修改

- 唯一来源是 `submodules/nusys-ui` 与 npm 包 `nusys-ui`。
- 框架级组合组件放 `packages/ui`。
- 不要直接修改 `node_modules`。
- 若确实需要上游改动，在 submodule 中开发并提交 PR，再升级框架依赖。

## 测试矩阵

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm rust:fmt:check
pnpm rust:clippy
pnpm rust:test
pnpm build:web
pnpm build:desktop
pnpm docs:build
```

## 文档

- 使用 VitePress。
- 新功能必须同时更新指南与参考页。
- 代码片段尽量可复制运行。
- 截图或图示放 `docs/public`。

## 子模块

`submodules/nusys-ui` 是唯一 UI 来源。更新时：

```bash
cd submodules/nusys-ui
git fetch
git checkout <commit>
cd ../..
git add submodules/nusys-ui
```

提交信息说明升级原因与影响范围。
