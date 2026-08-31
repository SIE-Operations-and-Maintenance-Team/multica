# Fork release runbook（SIE fork 专用）

本 fork 的完整发版手册。目标读者：换新电脑后的自己，或任何接手发版的人。
参考上游 `.github/RELEASING.md` 与 [paseo fork 发版模式](https://github.com/lzm04521/paseo)建立。

**一句话**：fork 版本由 `v<上游基数>-local.<N>` 形式的 tag 驱动，push tag 即触发 CI 全自动发版
（Go 门禁 → GHCR 双架构镜像 → Windows/Linux 桌面安装包挂 GitHub Release），全程约 15-20 分钟。

## 1. 前置条件（新电脑一次性准备）

1. **Clone 仓库**（注意有 upstream / origin 两个 remote）：

   ```bash
   git clone https://github.com/SIE-Operations-and-Maintenance-Team/multica.git
   cd multica
   git remote add upstream https://github.com/multica-ai/multica.git
   git fetch upstream --tags
   ```

   - `origin` = 本 fork（SIE-Operations-and-Maintenance-Team/multica），push 目标
   - `upstream` = 官方 multica-ai/multica，只 fetch 同步，**绝不 push**

2. **GitHub CLI**（`gh`）登录，且对 origin 有 push 权限（打 tag / push main）。

3. **权限清单**：
   - origin 仓库 write（push main + tag）
   - org 的 GHCR 包管理权限（首次发版后需把 `multica-backend` / `multica-web` 设为 public，见 §7）

4. 本地**不需要**任何构建工具链——Go/pnpm/Node 全部在 CI 里装，本地只做 git 操作。

## 2. 版本号方案（硬约束，不要改）

Fork 版本 tag = **`v<上游基数>-local.<N>`**。

- 同一上游基数内迭代递增 N：`v0.4.37-local.1` → `v0.4.37-local.2` → …
- 上游发新版本后跟进：基数换成新上游版本，N 从 1 重开（`v0.4.38-local.1`）。
- **必须带 `v` 前缀**：Desktop 与 CLI 的版本号从 `git describe --tags --match 'v[0-9]*'` 派生
  （`apps/desktop/scripts/package.mjs`），不带 `v` 的 tag 会让版本退化成 `0.4.36-local.1` 变
  `0.0.0-g<hash>`，自动更新直接失效。
- **必须带 `-local.N` 后缀**：合法 semver prerelease，与上游 stable tag（`v0.4.37`）永不重号。
- **不需要 bump `package.json`**：根 package.json 的 version 只是占位，发版版本完全由 tag 驱动。

## 3. 日常发版（二开迭代，最常用）

在 `main` 上提交完二开 commit 并 push 后：

```bash
git tag v0.4.37-local.2        # N 在当前基数内递增
git push origin v0.4.37-local.2
```

约束：**tag 打在哪个 commit，哪个 commit 就必须已经包含 `release-local.yml`**
（GitHub 按 tag commit 上的 workflow 文件触发，不是按 main 最新文件）。正常在 main HEAD 打 tag 即可。

发版失败的完整重来流程见 §8；tag 号本身永不复用——失败的 `local.2` 作废，下一版直接 `local.3`。

## 4. 跟进上游新版本（官方发新版后）

```bash
# 1. 同步上游
git fetch upstream main --tags

# 2. 确认上游最新 tag（记下基数，如 v0.4.38）
gh api repos/multica-ai/multica/tags --jq '.[0:3] | .[].name'

# 3. merge 上游 main（当前 fork 只有运维补丁，通常零冲突或固定冲突集）
git merge upstream/main --no-edit

# 4. 若有冲突，按下表处理（固定冲突集）：
#    .github/workflows/release.yml     modify/delete → 保持删除：git rm .github/workflows/release.yml
#    apps/desktop/electron-builder.yml publish owner → 保留 fork owner，收上游其他改动
git merge --continue

# 5. 验证 fork 补丁还在（两个 grep 都应有输出）
grep -q "release-local.yml" .github/workflows/release-local.yml && grep -q "SIE-Operations-and-Maintenance-Team" apps/desktop/electron-builder.yml && echo OK

# 6. push + 发版
git push origin main
git tag v0.4.38-local.1
git push origin v0.4.38-local.1
```

merge 后顺手浏览上游变更（`git log --oneline <旧基数>..upstream/main`），关注
migrations 新增（自托管升级会自动执行）和 protocol/WS 消息变更（客户端兼容性）。

## 5. CI 流水线（release-local.yml）做什么

| 顺序 | Job | 内容 | 预期 |
|---|---|---|---|
| 1 | verify | tag 名校验（`vX.Y.Z-local.N` 正则）+ Go 全量测试 `--race` + govulncheck | 约 10 分钟，fail-closed |
| 2 | docker-*-build ×4 | backend/web 各 amd64+arm64 原生构建推 GHCR（by digest） | 与 desktop 并行 |
| 3 | docker-*-merge ×2 | 合并 manifest list，打 `latest` / 版本 tag / sha tag | 秒级 |
| 4 | desktop ×2 | Windows x64 + Linux x64，`package.mjs --publish always` 直传 GitHub Release | 与 docker 并行，最慢约 20 分钟 |
| 5 | mobile | Expo prebuild → Gradle `assembleRelease` → `multica-mobile-<tag>.apk` 上传同一 Release | 与 desktop 并行，约 15-25 分钟（NDK/C++ 编译慢） |

镜像名必须全小写：workflow 里用 `IMAGE_OWNER=${GITHUB_REPOSITORY_OWNER,,}` 转小写
（org 名 `SIE-Operations-and-Maintenance-Team` 含大写，这是首跑踩过的坑，已固化在 workflow 里）。

查进度：`gh run list --repo SIE-Operations-and-Maintenance-Team/multica --workflow "Release (fork)"`。

## 6. 发版产物

**GitHub Release**（tag 同名，如 `v0.4.37-local.1`）：

- `multica-desktop-<版本>-windows-x64.exe`（+ blockmap，自动更新用）
- `multica-desktop-<版本>-linux-*`（deb / rpm / AppImage）
- `multica-mobile-<tag>.apk`（Android 客户端，**debug 签名**——能装能测，对外分发前需接正式 keystore；API 地址默认官方云，设 repo variable `MULTICA_MOBILE_API_URL` 可在构建时改指自部署后端）
- `latest.yml` / `latest-linux.yml`（electron-updater 元数据）

**GHCR 镜像**（fork 自己的命名空间，恒双架构）：

- `ghcr.io/sie-operations-and-maintenance-team/multica-backend`
- `ghcr.io/sie-operations-and-maintenance-team/multica-web`
- tag：`latest`（= 最新 fork 发版）+ 版本 tag + sha tag

**Desktop 自动更新**：装了 fork 桌面包的客户端，electron-updater 静默查 **fork 的 GitHub Release**
（`apps/desktop/electron-builder.yml` 的 publish.owner 指向 fork），每小时检查一次，下载完在退出时安装。
发新版 tag 后已装客户端约 1 小时内自动收到更新。

**暂不发**（需要时再评估）：macOS 桌面包（需 Apple 签名公证，上游也是手工发）、独立 CLI artifact
（GoReleaser 的 Homebrew 段依赖上游 token；CLI 已随桌面包内嵌）、Helm chart。

## 7. 自托管部署对接

`docker-compose.selfhost.yml` 用环境变量切镜像源，部署机 `.env` 加三行：

```bash
MULTICA_BACKEND_IMAGE=ghcr.io/sie-operations-and-maintenance-team/multica-backend
MULTICA_WEB_IMAGE=ghcr.io/sie-operations-and-maintenance-team/multica-web
MULTICA_IMAGE_TAG=latest        # 或具体版本如 v0.4.37-local.1；回退就改这里
```

之后每次更新一条命令：`make selfhost`（自动 pull + up -d + 等健康检查）。
backend 容器启动时自动跑数据库迁移（`docker/entrypoint.sh`：migrator 先行，API 后起），
`pgdata` 数据卷不受升级影响。

**Desktop 连自部署服务**：每台机器放 `~/.multica/desktop.json`（运行时读取，不参与打包）：

```json
{
  "schemaVersion": 1,
  "apiUrl": "http://192.168.184.61:8080",
  "appUrl": "http://192.168.184.61:3000"
}
```

缺省时桌面端连官方云（api.multica.ai）。**约定：fork 桌面端连 fork 后端，成套使用，
不混连官方云**（原因：daemon↔后端的 WS 协议无版本协商，跨基数混用会静默漂移）。

**GHCR 可见性**：首次推送后包默认 private。部署机匿名拉取需把两个包改 public
（Package 页 → Package settings → Danger Zone → Change visibility；开源构建产物，无泄露风险），
否则部署机要先 `docker login ghcr.io`（PAT 需 `read:packages`）。

## 8. 故障处理

**发版 CI 某个 job 挂了**：

```bash
gh run view <run_id> --repo SIE-Operations-and-Maintenance-Team/multica --log-failed | grep -E "ERROR|error"
```

- Go 测试/govulncheck 挂 → 通常是上游代码问题，看日志定位，修完走 §3 重发（tag 号递增）
- Docker 挂 → 看 IMAGE_OWNER 转小写是否还在；网络类失败直接重跑 `gh run rerun <run_id> --failed`
- Desktop 挂 → 多为上游前端构建问题，同上

**同版本号重发（Tag 已 push 但产物不对）**——演练过两次的标准流程：

```bash
gh release delete v0.4.37-local.1 --repo SIE-Operations-and-Maintenance-Team/multica --cleanup-tag --yes
git tag -d v0.4.37-local.1
git tag v0.4.37-local.1          # 打在修复后的 commit 上
git push origin v0.4.37-local.1
```

已装客户端对同版本号无感知（同版本不触发更新），所以同版本重发安全。

**tag push 触发不了 workflow**：检查 tag commit 是否含 `release-local.yml`（§3 约束），
以及 org 设置里 Actions 是否允许。

## 9. Fork 运维补丁清单（二开/merge 必读）

| # | 文件 | 改动 | 说明 |
|---|---|---|---|
| 1 | `.github/workflows/release-local.yml` | 新增 | fork 发版 workflow，tag `v*-local.*` 触发；含 mobile APK 构建 job |
| 2 | `.github/workflows/release.yml` | 删除 | 上游 `v*.*.*` glob 会匹配 fork tag 造成双跑；上游 merge 若改它，保持删除 |
| 3 | `apps/desktop/electron-builder.yml` | 修改 | publish.owner → 本 fork（上传 Release + 客户端自动更新都靠它） |
| 4 | `.npmrc` | 修改 | `node-linker=hoisted`——pnpm 默认 symlink 布局会让 Windows 上的 Android 原生构建 CMake/ninja 死循环；上游 merge 改它要保持 hoisted |
| 5 | `apps/desktop/package.json` | 修改 | electron 版本固定（当前 39.8.7）——hoisted 布局下 electron 被提升到根 node_modules，`^` 区间会让 electron-builder postinstall 找不到版本而失败 |
| 6 | `apps/mobile/app.config.ts` | 修改 | 新增 `android` 段（package name 三变体 + icon），与 iOS 变体逻辑对齐 |
| 7 | `.github/RELEASING-FORK.md` | 新增 | 本文档 |

`ci.yml` / `desktop-smoke.yml` / `mobile-verify.yml` 保留原样（fork 二开仍用上游测试门禁）。

## 10. 关键文件索引

- `.github/workflows/release-local.yml` — 发版流水线本体
- `.github/RELEASING-FORK.md` — 本文档
- `apps/desktop/scripts/package.mjs` — Desktop 版本派生（git describe）与打包封装
- `apps/desktop/electron-builder.yml` — Desktop 打包/publish 配置（fork owner）
- `apps/desktop/src/main/updater.ts` — electron-updater 接入（自动更新行为）
- `docker/entrypoint.sh` — backend 容器启动链（迁移 → API）
- `docker-compose.selfhost.yml` — 自托管部署定义（镜像源环境变量）
- 上游发版文档：`.github/RELEASING.md`（fork 已删其 workflow，文档仍可参考）
