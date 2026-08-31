# Fork release runbook（SIE fork 专用）

参考上游 `.github/RELEASING.md` 与 [paseo fork 发版模式](https://github.com/lzm04521/paseo)建立。
本 fork 的发版体系与上游的差异全部记录在此。

## 版本号方案

Fork 版本 tag = **`v<上游基数>-local.<N>`**，例如基于上游 v0.4.36 的第一版：`v0.4.36-local.1`。

- 同一上游基数内迭代递增 N：`v0.4.36-local.1` → `v0.4.36-local.2` → …
- 上游发新版本后跟进：基数换成新上游版本，N 从 1 重开（如 `v0.4.37-local.1`）。
- `v` 前缀是硬约束：Desktop 与 CLI 的版本号都从 `git describe --tags --match 'v[0-9]*'`
  派生（见 `apps/desktop/scripts/package.mjs`），不带 `v` 的 tag 会让版本退化成 `0.0.0-g<hash>`。
- `-local.N` 是合法 semver prerelease，与上游 stable tag（`v0.4.36`）永不重号。
- **不需要 bump `package.json`**：根 package.json 的 version（0.2.0）只是占位，发版版本完全由 tag 驱动。

## 触发发版

在 `main`（或发版分支）上打好运维/功能 commit 并 push 后：

```bash
git tag v0.4.36-local.1
git push origin v0.4.36-local.1
```

`release-local.yml` 只认 `v*-local.*` tag。tag 打在哪个 commit，哪个 commit 就必须已经包含
`release-local.yml`（GitHub 按 tag commit 上的 workflow 文件触发）。

## CI 产物（每个 release tag）

| 产物 | 目标 |
|---|---|
| Go 测试 + govulncheck | 门禁，fail-closed |
| `ghcr.io/sie-operations-and-maintenance-team/multica-backend` | amd64 + arm64，tag：`latest` / 版本 tag / sha |
| `ghcr.io/sie-operations-and-maintenance-team/multica-web` | 同上 |
| Desktop 安装包（win + linux，x64） | 上传到本 fork 的 GitHub Release，electron-builder 生成 `latest.yml` 供自动更新 |

- fork 镜像恒推 `latest`（fork 语境里 latest = 最新 fork 发版，不区分 prerelease）。
- macOS 桌面端需要 Apple 签名/公证，与上游一样不进 CI。
- Helm chart 与独立 CLI（GoReleaser + Homebrew）暂不发：CLI 已随 Desktop 包内嵌
  （`bundle-cli.mjs`），需要独立分发时再评估（GoReleaser 的 brew 段依赖上游 token，fork 不可直接复用）。

## 与上游发版体系的差异（fork 运维补丁清单）

1. **新增** `.github/workflows/release-local.yml`：fork 发版 workflow。
2. **删除** `.github/workflows/release.yml`：其 `v*.*.*` glob 会匹配 fork tag 造成双跑。
   上游 merge 若改动该文件，冲突解法=保持删除。
3. **修改** `apps/desktop/electron-builder.yml` 的 `publish.owner` → 本 fork，
   使 `--publish always` 上传到 fork Release，且已装 fork 客户端的 electron-updater 查 fork Release 自动更新。

## 自托管部署对接

`docker-compose.selfhost.yml` 通过环境变量切换镜像源，fork 部署示例：

```bash
MULTICA_BACKEND_IMAGE=ghcr.io/sie-operations-and-maintenance-team/multica-backend
MULTICA_WEB_IMAGE=ghcr.io/sie-operations-and-maintenance-team/multica-web
MULTICA_IMAGE_TAG=v0.4.36-local.1   # 或 latest
```

Desktop 连自部署服务：每台机器放 `~/.multica/desktop.json`（运行时读取，不参与打包）：

```json
{
  "schemaVersion": 1,
  "apiUrl": "http://192.168.184.61:8080",
  "appUrl": "http://192.168.184.61:3000"
}
```

缺省时桌面端连官方云（api.multica.ai）。若要开箱即连内网，后续二开可把内网地址写为 fork 默认值。

## 跟进上游新版本（概要）

1. `git fetch upstream` 同步上游 main / tags（尚未配置 upstream remote 时先加）。
2. merge 上游 main 到 fork main；固定预期冲突集：`.github/workflows/release.yml`
   （保持删除）、`apps/desktop/electron-builder.yml`（保留 fork owner）。
3. 验证（`make check` 或依赖 CI）后按上文「触发发版」打 `v<新上游版本>-local.1`。
