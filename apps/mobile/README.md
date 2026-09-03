# Multica Mobile (iOS / Android)

Expo + React Native iOS & Android client for Multica. Independent from web/desktop — shares only types from `@multica/core/`. See [`CLAUDE.md`](./CLAUDE.md) for the locked tech-stack baseline and import rules.

## Just want to use it on your phone? (no development)

Multica isn't on the App Store yet — until that changes, anyone who wants it on their iPhone builds from source. One command:

```bash
pnpm ios:mobile:device:prod:release
```

This connects to the same backend as `multica.ai`, so your existing account just works.

**Prerequisites**: Mac with Xcode, a free Apple ID added under Xcode → Settings → Accounts, iPhone connected via USB with [Developer Mode enabled](https://docs.expo.dev/guides/ios-developer-mode/). Walk through Expo's [Set up your environment](https://docs.expo.dev/get-started/set-up-your-environment/) (pick **Development build → iOS Device**) if any of that is missing.

Xcode signs the build with the "Personal Team" your Apple ID automatically owns — created silently the first time you signed into Xcode, no setup needed. The first build downloads CocoaPods + compiles React Native from source — expect 10–20 minutes. Subsequent builds reuse Xcode's cache.

**If Xcode rejects signing with "No matching provisioning profiles found"** — rare, happens if someone has claimed the default bundle id `ai.multica.mobile` on Apple's developer portal. Pick any reverse-domain you own and re-run:

```bash
export EXPO_BUNDLE_IDENTIFIER_PROD=com.yourname.multica
pnpm ios:mobile:device:prod:release
```

**If your Apple ID belongs to more than one Apple Developer team** — a personal team plus an employer's, say — the build signs with the first identity it finds, which may not be the team you meant, and it keeps reusing that choice on every later build. Pin the right one (find the id in the Apple Developer Portal under Membership):

```bash
export EXPO_APPLE_TEAM_ID=ABCDE12345
pnpm ios:mobile:device:prod:release
```

**7-day signing limit**: a free Apple ID signs builds for 7 days. After that, plug back into the Mac and re-run the command to re-sign. An Apple Developer Program account ($99/yr) extends this to 1 year.

Everything below is for app developers — you can ignore the rest if you only wanted a personal install.

## Scripts

| Command | What it does | Backend |
|---|---|---|
| `pnpm dev:mobile` | Metro only (reuse existing install) | local (`.env.development.local`) |
| `pnpm dev:mobile:staging` | Metro only (reuse existing install) | staging (`.env.staging`) |
| `pnpm dev:mobile:prod` | Metro only (reuse existing install) | production (`.env.production`) |
| `pnpm ios:mobile` | Full rebuild + install on **iOS Simulator**, Debug | local |
| `pnpm ios:mobile:staging` | Full rebuild + install on **iOS Simulator**, Debug | staging |
| `pnpm ios:mobile:prod` | Full rebuild + install on **iOS Simulator**, Debug | production |
| `pnpm ios:mobile:device` | Full rebuild + install on **USB iPhone**, Debug | local |
| `pnpm ios:mobile:device:staging` | Full rebuild + install on **USB iPhone**, Debug | staging |
| `pnpm ios:mobile:device:staging:release` | Full rebuild + install on **USB iPhone**, Release (standalone) | staging |
| `pnpm ios:mobile:device:prod` | Full rebuild + install on **USB iPhone**, Debug | production |
| `pnpm ios:mobile:device:prod:release` | Full rebuild + install on **USB iPhone**, Release (standalone) | production |

`dev:*` runs Metro only — assumes the matching variant is already installed. `ios:mobile*` does a full native rebuild + install.

Bundle id and display name switch on `APP_ENV` (see `app.config.ts`), so Dev / Staging / Production variants can coexist on the same device or simulator.

---

## ⚠️ ANDROID BUILD & RELEASE — READ THIS FIRST

> [!WARNING]
> **Installing dependencies with a plain `pnpm install` used to silently break every Android build**
> (颜色样式全部丢失 / `ClassNotFoundException: expo.modules.splashscreen.SplashScreenManager` / JS 模块解析到 `.pnpm` 物理路径).
> **Root cause**: Android 构建要求 `node_modules` 为 **hoisted 扁平布局**；pnpm v10 不再读 `.npmrc` 里的 `node-linker` 配置，
> 现已固定写在 [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) 顶部（`nodeLinker: hoisted`）。**不要删除这一行**。
> 完整事故复盘见 [`doc/bug-diagnosis-mobile-styles-lost-pnpm-node-linker-20260903.md`](../../doc/bug-diagnosis-mobile-styles-lost-pnpm-node-linker-20260903.md)。

## 30-second health check (run this if ANY Android build looks wrong)

```bash
# 1. Layout must be hoisted (flat): `.pnpm` must NOT exist as a virtual store
ls node_modules/.pnpm 2>/dev/null && echo "BROKEN: run 'rm -rf node_modules && pnpm install'" || echo "OK"

# 2. The built JS bundle must not reference .pnpm paths (0 = healthy)
unzip -p apps/mobile/android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | grep -ac ".pnpm"
```

Symptom → meaning: `.pnpm` count > 0 ⇒ Metro resolved deps into the physical store ⇒ `react-native-css-interop` gets bundled as two instances ⇒ **all color styles silently vanish** (layout classes still work — content stays centered, just colorless) and autolinking loses native modules (`ClassNotFoundException`). Fix = step 1 above + clear the stale autolinking cache (`rm -rf apps/mobile/android/build/generated/autolinking`) + force-rerun the bundle task (see below).

## Build a release APK (Android)

Prereq: deps installed in **hoisted** layout (see warning above), Android SDK installed (`android/local.properties` → `sdk.dir`).

```bash
cd apps/mobile/android
./gradlew.bat assembleRelease        # Windows (Git Bash: ./gradlew.bat works)
# or: ./gradlew assembleRelease      # macOS / Linux
```

Output APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (signed with the debug keystore — fine for internal distribution).

Backend URL is baked in at build time: hoisted installs read `.env.production.local` (self-hosted fork default, gitignored). Verify after building:

```bash
unzip -p apps/mobile/android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | grep -ac "218.13.91.107"   # >0 = self-hosted URL inlined
```

## Force-rebuild the embedded JS bundle

Gradle does **not** track `node_modules` as an input — after changing dependencies or env files the bundle task may be skipped (`up-to-date`) even though the output would differ. Force it:

```bash
cd apps/mobile/android
./gradlew.bat :app:createBundleReleaseJsAndAssets --rerun   # re-bundle JS only (~40s)
./gradlew.bat :app:assembleRelease                          # then repackage
```

Also clear the autolinking cache if native modules moved: `rm -rf apps/mobile/android/build/generated/autolinking`.

## Android day-to-day development

```bash
cd apps/mobile/android && ./gradlew.bat assembleDebug   # build the dev-client shell (no JS inside)
pnpm dev:mobile                                          # start Metro (terminal 1) — or pnpm dev:selfhost for the self-hosted backend
# launch the app on the device/emulator; the dev-launcher connects to Metro and pulls fresh JS
```

Android Studio works too: open `apps/mobile/android` and press Run (Debug = dev-client shell + Metro; Release = standalone APK with embedded JS). Known quirk: cold-starting the dev-client may ANR once on a busy emulator — relaunch.

## Release checklist (Android)

1. `ls node_modules/.pnpm` → must not exist (hoisted layout intact)
2. Build: `./gradlew.bat assembleRelease`
3. `unzip -p <apk> assets/index.android.bundle | grep -ac ".pnpm"` → must print **0**
4. `grep -ac "<your-backend-host>"` → >0 (correct backend inlined)
5. Install on a real device → login page content **vertically centered**, button has a dark filled background
   (quick tell: screenshot PNG ≥ ~90 KB = styled; ~32 KB = colorless/unstyled)

---

## First-time setup

`.env.staging` is committed (public staging URL). `.env.development.local` is gitignored — copy the template once:

```bash
cp apps/mobile/.env.example apps/mobile/.env.development.local
# then edit EXPO_PUBLIC_API_URL inside it to your Mac's LAN IP, e.g. http://192.168.1.42:8080
```

If your Apple ID isn't on the Multica Apple Developer team yet, also uncomment and set `EXPO_BUNDLE_IDENTIFIER_DEV` to a reverse-domain you own (e.g. `com.yourname.multica.dev`). This **only** overrides the dev variant — staging / production bundle ids are intentionally not overridable so variants can coexist.

If your Apple ID belongs to more than one Apple Developer team, also set `EXPO_APPLE_TEAM_ID` to the team that should sign your builds. Unlike the bundle id overrides it applies to every variant, and it is re-applied on each run — so it also fixes a checkout that has already latched onto the wrong team.

## Build it onto your iPhone

Two paths, depending on what you want to do:

### Day-to-day development (Mac in front of you)

```bash
pnpm ios:mobile:device:staging
```

Produces a **Debug build** with `expo-dev-launcher` embedded. Every launch the app probes Metro on your Mac and pulls fresh JS — perfect for hot-reload, painful when the Mac is asleep or you're on a different WiFi.

### Standalone / "just use it" (walk away from the Mac)

```bash
pnpm ios:mobile:device:staging:release
```

Produces a **Release build**. No `expo-dev-launcher`, no Metro probe, no "Downloading…" screen. Splash → app, exactly like an App Store install. Trade-off: every JS change requires re-running this command.

Both paths share the same prerequisites: Mac with Xcode, free Apple ID added under Xcode → Settings → Accounts, iPhone connected via USB with Developer Mode enabled. Follow Expo's [Set up your environment](https://docs.expo.dev/get-started/set-up-your-environment/) — pick **Development build → iOS Device** — if any of that is missing.

First build of either variant downloads CocoaPods + compiles React Native from source — expect 10-20 minutes. Subsequent builds reuse Xcode's DerivedData cache.

## Try it in the iOS Simulator (no iPhone needed)

```bash
pnpm ios:mobile:staging
```

Boots the simulator, builds, installs the dev-client. Faster to iterate than a device build because no signing / provisioning step. Same `dev:mobile:staging` Metro flow afterward.

## 7-day signing limit (device only)

A free Apple ID signs builds for **7 days only**, Debug and Release both. After that the app refuses to launch on the iPhone. Plug back into the Mac and re-run the corresponding `ios:mobile:device*` script to re-sign. Simulator builds are unaffected. The only workaround for the device limit is an Apple Developer Program account ($99/yr), which extends to 1 year.

## Pointing at a different backend

Edit `EXPO_PUBLIC_API_URL` in `.env.staging`, `.env.production`, or `.env.development.local` (whichever variant you're running). Then:

- For an installed **Debug build**: restart Metro (`pnpm dev:mobile:staging`) so the next JS bundle picks up the new value.
- For an installed **Release build**: re-run the `ios:mobile:device:staging:release` command — the value is baked into the embedded bundle at build time.

For local backend testing, use your Mac's LAN IP (`ipconfig getifaddr en0`), not `localhost`.
