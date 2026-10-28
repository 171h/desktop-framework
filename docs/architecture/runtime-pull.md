# 运行时拉取

## 目标

使用方不需要把框架仓库长期作为 submodule 维护，也不需要在 monorepo 中复制框架源码。配置文件记录**仓库地址 + commit**，应用启动时自动获得对应版本。

这与 VS Code 的思路类似：产品版本与扩展/运行时资产解耦，通过版本清单与完整性校验保证可复现。

## 配置

```json
{
  "framework": {
    "repository": "https://github.com/171h/desktop-framework",
    "commit": "<40位 commit>",
    "mode": "auto",
    "artifact": {
      "url": "https://github.com/171h/desktop-framework/releases/download/framework-{shortCommit}/desktop-framework-runtime-{shortCommit}.tar.gz",
      "integrity": "sha256-..."
    },
    "cache": true,
    "timeoutMs": 15000
  }
}
```

## 缓存键

```text
<userData>/framework/<配置commit>-<制品配置SHA256前8位>/
├─ manifest.json
├─ index.js
├─ style.css
└─ assets/...
```

制品配置哈希包含仓库、制品地址、入口和 integrity，变更制品或校验要求后不会复用旧缓存。缓存命中时验证 manifest 的完整 commit、入口和样式的实际文件路径。旧格式缓存不会自动迁移。

## 下载与校验

1. 解析 `{commit}` / `{shortCommit}` / `{repository}` 占位符；
2. fetch 超时控制；
3. 计算 SHA-256，与 `artifact.integrity` 比较；
4. 解压到临时目录；
5. 拒绝绝对路径、`..` 与符号链接；
6. 校验 `manifest.json.commit` 与配置一致；
7. 原子重命名到缓存目录。

任何一步失败：

- `mode: auto` → 记录 `fallbackReason`，使用宿主内置版本；
- `mode: remote` → 启动失败，不静默切换到其他 commit。

离线模式仍优先读取有效缓存。远程模块已经选定后，样式、导入或应用初始化失败均终止启动，以免混用两个运行时的全局组件和服务。

## 运行时归档

`pnpm build:runtime` 生成：

```text
manifest.json
index.js
style.css
assets/df_wasm_bg-*.wasm
assets/codicon-*.ttf
```

`index.js` 是包含 Vue、Cordis、nusys-ui 与框架插件的完整 ESM 运行时；宿主只需要动态 import 并调用 `createFrameworkApp`。

## 与 Electron 协议配合

主进程将缓存目录挂到：

```text
df-runtime://<shortCommit>/index.js
```

渲染进程拿到 `entryUrl` 与 `styleUrl` 后加载。协议 handler 会再次限制 host 必须等于当前 commit 的短哈希，防止读取其他缓存目录。

## GitHub Release 约定

标签：

```text
framework-<shortCommit>
```

资产：

```text
desktop-framework-runtime-<shortCommit>.tar.gz
```

Release workflow 会自动：

1. 构建 WASM；
2. 构建 runtime；
3. 读取 `integrity.txt`；
4. 上传归档；
5. 同时上传 Windows/macOS/Linux 安装包。

## 可复现性建议

- 生产配置使用完整 40 位 commit。
- 必须填写 integrity；CI 发布与宿主配置分离，避免发布后静默替换。
- 企业内网可以把归档镜像到私有对象存储，只需修改 `artifact.url`。
- 升级框架 = 修改 commit + integrity，回滚 = 改回旧值；缓存目录天然支持多版本共存。

## 开发模式

`mode: workspace` 时完全跳过网络，使用工作区源码。`apps/desktop` 在开发时默认 `auto`，并可通过 `DF_OFFLINE=1` 强制离线，便于演示与测试。
