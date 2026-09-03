# Bug 诊断报告：Android 打包后样式全部失效（pnpm node-linker 布局问题）

- **日期**：2026-09-03
- **状态**：已修复并实机验证
- **严重级别**：P1（应用可用但 UI 全坏，阻塞所有 Android 打包）
- **处理人**：Claude Agent（bug-diagnosis）
- **影响范围**：apps/mobile 的所有 release/debug APK 构建

---

## 一、问题现象

1. **release APK 颜色样式全部失效**：登录页内容垂直居中（布局正常）、文字无颜色（浅灰）、按钮无底色（白底）——整体看起来"没有一点样式"。
2. **debug 壳（dev-client）启动报错**：`ClassNotFoundException: expo.modules.splashscreen.SplashScreenManager`，部分场景启动失败/ANR。
3. **分界线非常清晰**：2026-09-01 21:29 的 APK 样式正常；2026-09-02 当天构建的所有 APK（12:47、22:25、00:05）全部失效。

## 二、根因（完整因果链）

```
当天早上为安装 expo-notifications 执行了普通 pnpm install
        ↓
node_modules 从 [hoisted 扁平布局] 被重置为 [symlink 布局]
（关键：pnpm v10 已把 node-linker 配置从 .npmrc 迁移到 pnpm-workspace.yaml，
  .npmrc 里的 node-linker=hoisted 不再生效——.npmrc 注释里其实写了这一点）
        ↓
两个后果同时发生：
  ① Metro 把依赖解析到 node_modules/.pnpm/... 物理路径
     → react-native-css-interop 被打成两个实例
     → babel 注册样式表用的实例 A，JSX runtime 查表用的实例 B
     → 颜色类样式（text-foreground、bg-primary 等）查表为空 → 全部失效
     → 布局类样式（flex-1、justify-center）是静态内联 → 仍然生效
     → 于是出现"内容居中但没颜色"的怪象
  ② expo-modules-autolinking 找不到部分原生工程
     （transitive 包如 expo-splash-screen 不在子包 node_modules）
     → debug 壳缺原生类 → ClassNotFoundException
```

**背景知识**：`.npmrc` 原注释明确写了——Android 原生构建需要 `node-linker=hoisted`（symlink 布局会让 CMake/ninja 死锁，且 hoisted 才能保证原生模块被 autolinking 找到），但该配置在 pnpm v10 要写在 `pnpm-workspace.yaml`（键名 `nodeLinker`）。

## 三、修复步骤（已执行）

```bash
# 1. pnpm-workspace.yaml 顶部加入（v10 的正确配置位置）
nodeLinker: hoisted

# 2. 删除旧 node_modules 重新安装（必须删，否则 pnpm 认为已就绪跳过重排）
rm -rf node_modules
pnpm install

# 3. 清掉 Gradle 侧缓存的 autolinking 结果（里面存着已失效的 .pnpm 路径）
rm -rf apps/mobile/android/build/generated/autolinking

# 4. 强制重跑 JS bundle 任务（Gradle 不跟踪 node_modules 变化，bundle 任务会被跳过）
cd apps/mobile/android
./gradlew.bat :app:createBundleReleaseJsAndAssets --rerun
./gradlew.bat :app:assembleRelease
```

修复后 bundle 特征（验证通过）：模块路径中 `.pnpm` 出现次数 **0**（坏版为 12）。

## 四、验证方法（可复用的判据）

| 层面 | 方法 | 正常判据 |
|---|---|---|
| bundle 解析路径 | 解包 APK，`grep -c ".pnpm" index.android.bundle` | **0**（出现 ≥1 即布局坏了） |
| 后端地址内联 | bundle 中 grep 自建服务器 IP | 存在且不含 `api.multica.ai` |
| 布局样式 | `uiautomator dump` 看元素 bounds | 登录内容 y≈1011-1473（垂直居中） |
| **视觉样式（最关键）** | 截图后 PIL 采样按钮区域颜色 | 按钮中心线均色 ≈ `#a0a0a0`（深底白字混合）；**坏版是 `#ffffff`** |
| 快速信号 | **截图 PNG 文件大小** | 有样式 ≈ 90KB；无样式 ≈ 32KB（接近纯白） |

⚠️ **教训：uiautomator bounds 只能证明布局位置，不能证明颜色/视觉样式。** 本次排查中途曾被 bounds 居中误导为"模拟器有样式"，被用户纠正后改用截图像素分析才定位到"布局生效、颜色失效"的分层失效现象。

## 五、排查过程的弯路（供后人避免）

1. **先入为主怀疑 expo-notifications 原生模块没链接** → 跑了 prebuild、验证了 autolinking，方向错误（通知模块代码注释二分后排除）。
2. **用 bounds 冒充视觉验证** → 差点错过真正的症状分层（布局 OK / 颜色失效）。
3. **bundle 字符串级对比一直"等价"** → 类名、CSS 变量字符串两版都在，差点得出"bundle 无问题"；真正的差异在**模块解析路径**（`.pnpm` 物理路径 vs 逻辑路径），要用 `grep .pnpm` 这种特征检查才能看到。
4. **清错了 Metro 缓存**：`apps/mobile/.expo/cache` 和 `node_modules/.cache` 不是 Metro 实际使用的缓存；真正的在 `%LOCALAPPDATA%/Temp/metro-cache` 和 `metro-file-map-*`。且清掉后 **Gradle 仍会跳过 bundle 任务**（Gradle 不跟踪 node_modules 变化），必须 `--rerun`。
5. **pnpm install 中断会留下损坏的中间态**：hoisted 重排时若 postinstall 失败（如 apps/docs 的 fumadocs-mdx），子包 symlink 会指向已删除的 .pnpm（悬空链接），此时构建报 `Configuring project ':xxx' without an existing directory`。处理：`pnpm install --ignore-scripts` 补完链接（docs 的 postinstall 失败不影响 mobile）。
6. **adb 在本机不稳定**（daemon 反复重启）：install/pull 可能 protocol failure 或截断，每一步都要校验结果（安装看 lastUpdateTime、pull 看文件大小）。

## 六、遗留事项与注意事项

1. **`pnpm-workspace.yaml` 顶部已加 `nodeLinker: hoisted`、`.npmrc` 尾部也加了同名配置（双保险）**，`.npmrc` 原文件备份为 `.npmrc.bak`。**今后装依赖直接普通 `pnpm install` 即可，不要再单独加 --config 参数。**
2. ⚠️ `.npmrc` 原注释警告：hoisted 布局在 **Linux** 下会破坏 web 构建（zod 类型问题）并使 desktop 打包内存膨胀。CI（`.github/workflows/release-local.yml`）里是按 job 传参的，不受影响；若在 Linux/WSL 下构建 web 出问题，临时移除 `nodeLinker: hoisted` 再装依赖。
3. **apps/docs 的 postinstall 当前失败**（fumadocs-mdx 的 bin 在 hoisted 重排后缺失）——只影响 docs 文档站，mobile/web/desktop 不受影响。需要跑 docs 时：`pnpm --filter @multica/docs install` 或单独重装该包。
4. **今后任何"Android 打包样式异常"，第一反应先查 bundle 的 `.pnpm` 路径计数**（见第四节表格），30 秒即可确认/排除本问题。
5. `.env.local`（gitignored）已配置自建后端地址 `EXPO_PUBLIC_API_URL=http://218.13.91.107:8416`，本机所有构建默认指向自建后端；CI/EAS 无此文件仍指向官方云。
