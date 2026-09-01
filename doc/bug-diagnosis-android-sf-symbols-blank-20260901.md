# Bug 诊断报告：Android APK 底部 Tab 栏与 More 菜单图标全部空白

- **日期**：2026-09-01
- **状态**：已修复（待 v0.4.37-local.4 APK 实机复验）
- **严重级别**：P2 一般（核心导航功能可用，视觉信息缺失）
- **报告人**：Claude Agent（Bug Diagnosis Skill）

---

## 问题描述

用户安装 fork 发版的 Android APK（v0.4.37-local.3）后发现：

- 底部 Tab 栏的 Inbox、My Issues、Chat、More 四个图标全部不显示，只剩文字；
- 点击 More 弹出的菜单里，Pinned、Issues、Projects 的图标也不显示；
- 其余图标（Inbox 列表的状态时钟/勾选/禁止图标、Header 右上角"…"/搜索/加号、emoji 头像）**均正常**。

## 环境信息

- 分支/版本：fork `main`，APK v0.4.37-local.3（CI 构建，targetSdk 36，minSdk 24）
- 模块：`apps/mobile`（Expo + React Native，expo-image、@expo/vector-icons）
- 复现步骤：Android 真机安装 APK → 打开任意 workspace → 观察底部 Tab 栏 / 点 More

---

## 可能原因分析

| # | 原因 | 概率 | 理由 |
|---|------|------|------|
| 1 | 缺失图标统一使用 expo-image 的 `sf:`（SF Symbols）source，该特性 **iOS 专属**，Android 上静默渲染空白 | 高 | 截图里"正常/失效"两组图标泾渭分明；失效的恰好是 Tab 栏 4 个 + More 菜单 3 个，代码里全部是 `source="sf:..."`（expo-image）。SF Symbols 是 Apple 平台私有图标集 |
| 2 | 图标字体（Ionicons 字体）未打进 APK | 低 | 同为 Ionicons 的 Header"…"/搜索/加号图标显示正常，排除全局字体缺失 |
| 3 | react-native-svg 新架构渲染问题 | 低 | 状态图标（react-native-svg 手绘）显示正常，排除 |

## 验证动作

- **验证方式**：代码检索 `sf:` 用法，与截图症状逐一对照
- **位置**：`apps/mobile/app/(app)/[workspace]/(tabs)/_layout.tsx:85-128`（4 个 Tab 图标）、
  `apps/mobile/components/nav/more-tab-dropdown.tsx:162,226,287`（菜单 + chevron）、
  `apps/mobile/app/(app)/[workspace]/switch-workspace.tsx:133`（勾选标记）
- **对照组**：`apps/mobile/components/ui/icon-button.tsx:13` 用 `@expo/vector-icons`（Ionicons）→ 跨平台正常；
  `apps/mobile/components/ui/priority-icon.tsx` 用 `react-native-svg` → 跨平台正常
- **预期结果**：全部 `sf:` 调用点与用户报告的失效位置一一吻合 → 原因 1 成立（已确认）

## 调用链与依赖分析

```
Tab 栏渲染链:
  expo-router <Tabs> (app/(app)/[workspace]/(tabs)/_layout.tsx)
    → Tabs.Screen options.tabBarIcon (render prop)
      → <Image source="sf:tray.fill" /> (expo-image)     ← 失效点
        → iOS: SF Symbols 字体解析 ✓
        → Android: 无 SF Symbols，expo-image 静默渲染空白 ✗

More 菜单渲染链:
  <MoreTabDropdownAnchor> (components/nav/more-tab-dropdown.tsx)
    → NAV_ITEMS.map → DropdownMenuItem
      → <ExpoImage source={`sf:${item.icon}`} />          ← 失效点（同上）
```

上游无数据依赖，纯渲染层问题。expo-image 对无效/不支持的 source **不抛错、不留占位**，
所以 Dev 环境也没任何报错——这是问题一路漏到真机才发现的原因。

## 边缘情况检查

| 维度 | 场景 | 当前行为 | 是否有问题 | 建议 |
|------|------|----------|------------|------|
| 平台差异 | `sf:` source 在 Android | 静默空白 | 是 | 统一走跨平台 Symbol 组件 |
| 静默失败 | 映射表漏了某个 `sf:` 名 | Android 无图标、无报错 | 是 | dev 构建直接 throw（symbol.tsx 已实现） |
| focused 态 | Tab 选中/未选中两套 Symbol 名 | 两名都要有映射 | 是 | `tray`/`tray.fill` 等成对收录 |
| 未来回归 | 新代码再直接写 `sf:` | Android 再次空白 | 风险 | 修复注释 + 本报告提示统一走 `<Symbol>` |

## 修复内容（已实施）

1. 新增 `apps/mobile/components/ui/symbol.tsx`：iOS 走 expo-image `sf:`（视觉零变化），
   Android 回退 Ionicons（`@expo/vector-icons`，项目既有图标库），显式映射表覆盖全部 12 个
   在用的 SF Symbol 名，缺映射在 `__DEV__` 下直接抛错。
2. 替换全部调用点（9 处）：`(tabs)/_layout.tsx` ×4、`more-tab-dropdown.tsx` ×4、
   `switch-workspace.tsx` ×1；清理不再使用的 expo-image import。
3. 验证：`turbo typecheck lint --filter=@multica/mobile` 全绿；iOS 分支未改变任何视觉参数
   （同 source、同 size、同 tintColor），iOS 侧无回归风险。

## 总结与建议

根因一句话：**SF Symbols 是 iOS 专属，`expo-image` 的 `sf:` source 在 Android 上静默渲染空白，
而失效的 7 个图标恰好全部用了它**。修复已落地（`<Symbol>` 组件 + 全调用点替换），随
v0.4.37-local.4 发版，请重装 APK 后复验 Tab 栏与 More 菜单图标。
