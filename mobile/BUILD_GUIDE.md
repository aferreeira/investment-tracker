# Investment Tracker Mobile - Build Guide

## Overview
This document details the complete build process, all dependencies, environment setup, and known issues for building the Investment Tracker mobile app for iOS using React Native and Expo.

---

## Quick Start

```bash
# 1. Navigate to mobile directory
cd ~/Documents/projects/applications/investment-tracker/mobile

# 2. Switch to Node v24.15.0 (current)
nvm use v24.15.0

# 3. Install all dependencies with legacy peer deps flag
npm install --legacy-peer-deps

# 4. Generate the iOS native project
npx expo prebuild --clean

# 5. Build and deploy to physical iPhone
npx expo run:ios --device 00008140-000C698022D8801C
```

---

## Environment Requirements

### Node.js & Package Manager
- **Current Version**: v24.15.0 (via nvm)
- **npm**: Included with Node.js
- **Installation**: `nvm install v24.15.0 && nvm use v24.15.0`
- **Verification**: `node --version` and `npm --version`

### System Dependencies (macOS)

#### 1. Xcode
- **Version**: 26.4 (latest)
- **Installation**: `xcode-select --install` or App Store
- **Verification**: `xcode-select -p` (should show `/Applications/Xcode.app/...`)

#### 2. CocoaPods
- **Version**: 1.16.2_2 (pre-installed with Xcode)
- **Command**: `pod --version`
- **PATH Setup**: Ensure Homebrew is in PATH
  ```bash
  # Add to ~/.zshrc if not present:
  export PATH="/opt/homebrew/bin:$PATH"
  ```

#### 3. Watchman (Critical for large projects)
- **Purpose**: Replaces fs.watch to avoid EMFILE "too many open files" errors
- **Installation**: 
  ```bash
  brew install watchman
  ```
- **Verification**: `watchman version`
- **Why It's Essential**: Metro bundler file watcher can hit system open file descriptor limits without Watchman

---

## Dependencies & Versions

### React Native Ecosystem

| Package | Current Version | Status | Notes |
|---------|-----------------|--------|-------|
| `react-native` | 0.81.5 | ⚠️ Active | Latest version; uses fmt 11.0.2 |
| `react` | 19.1.0 | ⚠️ Active | Latest; aligned with RN 0.81.5 |
| `expo` | 54.0.0 | ⚠️ Active | Latest Expo SDK; supports RN 0.81.5 |
| `babel-preset-expo` | ~54.0.10 | ✅ | Matching Expo 54 |

### React Navigation
| Package | Version | Status |
|---------|---------|--------|
| `@react-navigation/native` | ^7.0.0 | ✅ |
| `@react-navigation/native-stack` | ^7.0.0 | ✅ |
| `@react-navigation/bottom-tabs` | ^7.0.0 | ✅ |
| `react-native-screens` | ~4.16.0 | ✅ |
| `react-native-safe-area-context` | ~5.6.0 | ✅ |

### Expo Modules
| Package | Version | Purpose |
|---------|---------|---------|
| `expo-asset` | ~12.0.12 | Asset loading |
| `expo-auth-session` | ~7.0.10 | OAuth authentication |
| `expo-constants` | ^55.0.14 | App constants |
| `expo-dev-client` | ~6.0.20 | Development client ⚠️ **MUST be in plugins** |
| `expo-font` | ~14.0.11 | Custom fonts |
| `expo-secure-store` | ~15.0.8 | Secure credential storage |
| `expo-status-bar` | ~3.0.9 | Status bar styling |
| `expo-web-browser` | ~15.0.10 | Web browser integration |

### API & Communication
| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.8.4 | HTTP client |
| `socket.io-client` | ^4.8.1 | WebSocket client |

### Dev Dependencies
| Package | Version |
|---------|---------|
| `@babel/core` | ^7.25.0 |

**Total Packages Installed**: ~1200+ (with transitive dependencies)

---

## app.config.js Configuration

### Current Configuration
```javascript
{
  expo: {
    name: "Investment Tracker",
    slug: "investment-tracker",
    scheme: "investmenttracker",
    version: "1.0.0",
    newArchEnabled: true,  // New Architecture (requires rebuild to take effect)
    ios: {
      bundleIdentifier: "com.investmenttracker.mobile",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.354292965032-fcea9mgss6mscekrsd1855oonbef62br"
            ]
          }
        ]
      }
    },
    plugins: [
      "expo-asset",
      "expo-font",
      "expo-secure-store",
      "expo-web-browser",
      // Note: "expo-dev-client" is MISSING - should be added
    ]
  }
}
```

### Critical Configuration Flow
1. **Source of Truth**: `app.config.js`
2. **Generated During Prebuild**: `ios/` directory and `ios/Podfile.properties.json`
3. **When ios folder deleted**: Next prebuild regenerates everything from app.config.js

### Important Settings
- **newArchEnabled**: Currently `true` (New Architecture enabled)
  - Change to `false` if Native Architecture compatibility issues occur
  - Requires full rebuild: `rm -rf ios && npx expo prebuild --clean`
- **deploymentTarget**: Should be `14.0` (compatible with all dependencies)
- **plugins**: Must include all Expo modules that need native linking

---

## Build Process Steps

### Step 1: Navigate & Setup Node
```bash
cd ~/Documents/projects/applications/investment-tracker/mobile
nvm use v24.15.0
```

### Step 2: Install Dependencies
```bash
npm install --legacy-peer-deps
```
**Why `--legacy-peer-deps`?**
- React Navigation requires stricter versions that may conflict
- Flag tells npm to bypass strict peer dependency checking
- Still validates dependency resolution, just more lenient
- Results in ~1200+ packages installed

### Step 3: Generate iOS Native Project
```bash
npx expo prebuild --clean
```
**What this does:**
1. Reads `app.config.js` configuration
2. Generates `ios/` directory with Xcode project
3. Creates CocoaPods Podfile from app.config.js settings
4. Links all plugins listed in app.config.js
5. Generates `Podfile.properties.json` with configuration values

**Output**: 
- `ios/InvestmentTracker.xcworkspace` (Xcode workspace)
- `ios/Podfile` (CocoaPods configuration)
- 94+ CocoaPods dependencies linked

### Step 4: Build & Deploy to Device
```bash
npx expo run:ios --device 00008140-000C698022D8801C
```

**What happens:**
1. Metro bundler starts (requires file watcher - needs Watchman)
2. Xcode compiles native code
3. Bundle JavaScript code into metro bundle
4. Signs app with Apple Development certificate
5. Installs app on device via USB
6. Launches app and attaches debugger

**Device Details:**
- Device ID: `00008140-000C698022D8801C`
- Device Name: Alexandre iPhone (26.3.1)
- Team ID: 3P769Q7G42
- Signing Identity: alexandrefs.ferreira@gmail.com (283C5AMK27)

---

## Known Issues & Solutions

### Issue 1: React Native 0.81.5 - fmt C++20 Compatibility (⚠️ Current Risk)
**Symptom:**
```
Error: call to consteval function 'fmt::basic_format_string' is not a constant expression
```

**Root Cause:**
- React Native 0.81.5 bundles fmt 11.0.2
- Xcode 26.4's clang has stricter C++20 consteval support
- iOS builds fail with exit code 65

**Previous Workarounds Tested (Failed):**
- Adding `GCC_PREPROCESSOR_DEFINITIONS = FMT_CONSTEVAL=` in Podfile post_install hook
- Compiler flags `-fno-consteval` (unsupported by clang)
- Source file patching

**Working Solution (If Issue Occurs):**
Downgrade to stable React Native 0.74.5:
```bash
# Update package.json dependencies:
"react-native": "0.74.5",
"react": "18.2.0",
"expo": "^51.0.0",
"react-native-screens": "~3.30.0",
"react-native-safe-area-context": "~5.4.0",

# Then rebuild:
npm install --legacy-peer-deps
rm -rf ios
npx expo prebuild --clean
npx expo run:ios --device 00008140-000C698022D8801C
```

### Issue 2: EMFILE - Too Many Open Files (⚠️ With Node v24?)
**Symptom:**
```
Error: EMFILE: too many open files, watch
```

**Root Cause:**
- Metro bundler's file watcher hits macOS file descriptor limit (~256)
- Occurs after successful build, preventing app delivery to device
- May be worse with Node v24 due to stricter file watching

**Solution:**
- Ensure Watchman is installed: `brew install watchman`
- Watchman uses kernel notifications instead of fs.watch
- Increases effective file descriptor limit significantly

### Issue 3: Native Module Linking Failed
**Symptom:**
```
Cannot find native module 'ExpoAsset'
Invariant Violation: 'main' has not been registered
```

**Root Cause:**
- Expo plugin missing from `app.config.js` plugins array
- Common missing plugins: `expo-dev-client`, `expo-asset`

**Solution:**
Add to `app.config.js` plugins array:
```javascript
plugins: [
  "expo-asset",
  "expo-dev-client",  // Critical for dev builds
  "expo-font",
  "expo-secure-store",
  "expo-web-browser",
]
```

Then rebuild: `rm -rf ios && npx expo prebuild --clean`

### Issue 4: iOS Deployment Target Mismatch
**Symptom:**
```
CocoaPods error: required a higher minimum deployment target
```

**Solution:**
Add to `app.config.js` ios section:
```javascript
ios: {
  deploymentTarget: "14.0",
  // ... other settings
}
```

### Issue 5: Peer Dependency Resolution Failures
**Symptom:**
```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
Use `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
```

---

## Node Version Considerations

### Node v24.15.0 (Current)
**Advantages:**
- Latest LTS track moving toward v24
- Latest performance improvements
- Better ES2024 support

**Potential Issues:**
- May have stricter file watcher limits than v20
- Less testing history with Metro bundler
- If EMFILE errors occur, ensure Watchman is installed

**Comparison to v20.20.2 (Previously Tested):**
| Aspect | v20.20.2 | v24.15.0 |
|--------|----------|----------|
| Metro Stability | More proven | Newer, less tested |
| File Watcher | Standard | May be stricter |
| npm v10 | Yes | Yes (later minor) |
| Watchman Dependency | Less critical | More critical |

**If v24 Causes Issues:**
```bash
nvm install v20.20.2
nvm use v20.20.2
npm install --legacy-peer-deps  # Fresh install
# Then rebuild
```

---

## Build Verification Checklist

- [ ] Node v24.15.0 active: `node --version`
- [ ] npm installed: `npm --version`
- [ ] Watchman installed: `watchman version`
- [ ] CocoaPods available: `pod --version`
- [ ] Xcode path correct: `xcode-select -p`
- [ ] Device connected: `xcrun instruments -s devices` (shows device)
- [ ] Dependencies installed: `npm install --legacy-peer-deps` succeeds
- [ ] Prebuild succeeds: `npx expo prebuild --clean` completes without errors
- [ ] Build succeeds: `npx expo run:ios --device [ID]` - "Build Succeeded" message
- [ ] App launches: Device shows Investment Tracker app
- [ ] No crashes: Check Xcode console for runtime errors

---

## Troubleshooting Commands

```bash
# Check Node version
nvm list

# Verify Watchman is running
watchman watch-list

# Clear npm cache
npm cache clean --force

# Completely reset build (nuclear option)
rm -rf node_modules ios
npm install --legacy-peer-deps
npx expo prebuild --clean
npx expo run:ios --device 00008140-000C698022D8801C

# Check connected iOS devices
xcrun instruments -s devices

# View Xcode build logs
cat ~/Library/Logs/DiagnosticMessages/*.log

# Kill Metro bundler if stuck
lsof -i :8081 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

---

## Configuration Source of Truth

| File | Purpose | Editable? | Generated? |
|------|---------|-----------|-----------|
| `package.json` | NPM dependencies | ✅ Yes | ❌ No |
| `app.config.js` | Expo app configuration | ✅ Yes | ❌ No |
| `ios/Podfile` | CocoaPods configuration | ⚠️ No (edit app.config.js instead) | ✅ Prebuild |
| `ios/Podfile.properties.json` | CocoaPods flags | ⚠️ No (edit app.config.js instead) | ✅ Prebuild |
| `ios/InvestmentTracker.xcworkspace` | Xcode project | ⚠️ Limited (use Xcode UI for signing) | ✅ Prebuild |

**Key Rule**: If you need to change native build behavior, edit `app.config.js` and regenerate with `npx expo prebuild --clean`. Never manually edit generated files.

---

## Next Steps

1. **First Build with v24**: Run quick start commands and watch for any EMFILE errors
2. **Monitor Metro**: Check if file watcher stays stable with Watchman
3. **If fmt Error Occurs**: See Issue 1 solution to downgrade React Native
4. **If All Works**: Document success and establish this as baseline
5. **New Architecture**: Can enable `newArchEnabled: true` in app.config.js later if desired

---

## Support Files
- Backend API Server: `../backend/server.js`
- Main App Component: `./App.js`
- Environment Variables: Set via `.env` or process.env in app.config.js
- Credentials: Stored via `expo-secure-store` in app
- Configuration: `/config.js` in src/

