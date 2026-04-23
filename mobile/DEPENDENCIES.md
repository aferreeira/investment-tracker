# Dependency Management Reference

## Current Dependency Tree (package.json)

### Core Framework Versions
```
react-native@0.81.5
├── Uses: fmt@11.0.2 (potential C++ compatibility issue with Xcode 26.4)
├── Hermes JavaScript Engine: enabled
└── New Architecture: configurable via app.config.js

react@19.1.0
├── Aligned with React Native 0.81.5
└── Latest React version

expo@54.0.0
├── SDK Level: 54
├── Requires Node >= 14
└── All expo-* packages should be compatible with this version
```

### Complete Package List with Purposes

#### Navigation & UI
```json
{
  "@react-navigation/native": "^7.0.0",           // Base navigation context
  "@react-navigation/native-stack": "^7.0.0",    // Stack navigator
  "@react-navigation/bottom-tabs": "^7.0.0",     // Bottom tab navigation
  "react-native-screens": "~4.16.0",             // Native screen management
  "react-native-safe-area-context": "~5.6.0"    // Safe area insets
}
```

#### Expo Modules (Must be in app.config.js plugins)
```json
{
  "expo": "^54.0.0",                    // Core Expo framework
  "expo-asset": "~12.0.12",             // Asset loading/caching
  "expo-auth-session": "~7.0.10",       // OAuth flows
  "expo-constants": "^55.0.14",         // App constants
  "expo-dev-client": "~6.0.20",         // ⚠️ CRITICAL - currently MISSING from plugins
  "expo-font": "~14.0.11",              // Custom fonts
  "expo-secure-store": "~15.0.8",       // Credential storage
  "expo-status-bar": "~3.0.9",          // Status bar control
  "expo-web-browser": "~15.0.10",       // OAuth browser
  "babel-preset-expo": "~54.0.10"       // Babel config for Expo SDK 54
}
```

#### API & Communication
```json
{
  "axios": "^1.8.4",              // HTTP client (current backend requests)
  "socket.io-client": "^4.8.1"    // WebSocket (future real-time features)
}
```

#### Build Tools
```json
{
  "@babel/core": "^7.25.0"  // JavaScript transpiler (dev dependency)
}
```

## Dependency Installation Stats
```
Total Packages: ~1,213 (including transitive dependencies)
Direct Dependencies: 18
Dev Dependencies: 1
Installation Method: npm install --legacy-peer-deps
Installation Size: ~500-600 MB (node_modules)
```

## Version Pinning Strategy

### Exact Versions (most critical)
```
react-native: "0.81.5"  - Latest stable, causes fmt issues on Xcode 26.4
react: "19.1.0"         - Must match React Native major
babel-preset-expo: "~54.0.10"  - Must match Expo major
```

### Tilde (~) - Patch Updates Allowed
```
expo-asset: "~12.0.12"              - Allow 12.0.x but not 12.1.0
expo-auth-session: "~7.0.10"        - Allow 7.0.x but not 7.1.0
expo-constants: "^55.0.14"          - Different: allow up to 56.0.0
expo-dev-client: "~6.0.20"          - Allow 6.0.x but not 6.1.0
expo-font: "~14.0.11"               - Allow 14.0.x but not 14.1.0
expo-secure-store: "~15.0.8"        - Allow 15.0.x but not 15.1.0
expo-status-bar: "~3.0.9"           - Allow 3.0.x but not 3.1.0
expo-web-browser: "~15.0.10"        - Allow 15.0.x but not 15.1.0
react-native-screens: "~4.16.0"     - Allow 4.16.x but not 4.17.0
react-native-safe-area-context: "~5.6.0"  - Allow 5.6.x but not 5.7.0
```

### Caret (^) - Minor & Patch Updates Allowed
```
@react-navigation/bottom-tabs: "^7.0.0"    - Allow 7.x.x but not 8.0.0
@react-navigation/native: "^7.0.0"         - Allow 7.x.x but not 8.0.0
@react-navigation/native-stack: "^7.0.0"   - Allow 7.x.x but not 8.0.0
@babel/core: "^7.25.0"                     - Allow 7.x.x but not 8.0.0
axios: "^1.8.4"                            - Allow 1.x.x but not 2.0.0
expo: "^54.0.0"                            - Allow 54.x.x but not 55.0.0
expo-constants: "^55.0.14"                 - Allow 55.x.x but not 56.0.0
socket.io-client: "^4.8.1"                 - Allow 4.x.x but not 5.0.0
```

## Peer Dependencies & Conflicts

### Known Peer Dependency Chain
```
@react-navigation/bottom-tabs
├── Requires: react-native-screens >= 4.0.0
├── Requires: react-native-safe-area-context >= 5.0.0
├── Requires: @react-navigation/native >= 7.0.0
└── Requires: react >= 18.0.0
```

### Why --legacy-peer-deps Needed
React Navigation v7 has strict peer requirements, but React Native 0.81.5 has older compatible versions in the middle of their version ranges. The flag allows npm to resolve these without failing, but it still validates the actual dependency resolution.

## Environment Variable Dependencies

These are referenced in app.config.js but are NOT npm packages:

```javascript
process.env.API_BASE_URL           // Backend API endpoint (default: localhost:9100)
process.env.GOOGLE_WEB_CLIENT_ID   // Google OAuth web client (not set by default)
process.env.GOOGLE_IOS_CLIENT_ID   // Google OAuth iOS client (not set by default)
```

Set these in `.env` file at project root or in shell:
```bash
export API_BASE_URL="http://localhost:9100"
export GOOGLE_IOS_CLIENT_ID="[your-client-id]"
```

## System-Level Dependencies (Not in package.json)

| Dependency | Version | Installation | Purpose |
|------------|---------|--------------|---------|
| Node.js | v24.15.0 | nvm | JavaScript runtime |
| npm | ~10.9+ | bundled with Node | Package manager |
| Xcode | 26.4 | App Store | iOS compilation |
| CocoaPods | 1.16.2_2 | pre-installed | iOS dependency manager |
| Watchman | latest | brew | File watcher (critical) |

## app.config.js Plugin Mapping

Currently in app.config.js:
```javascript
plugins: [
  "expo-asset",
  "expo-font",
  "expo-secure-store",
  "expo-web-browser",
]
```

**ISSUE**: Missing `"expo-dev-client"` which is critical for:
- Development build creation
- Remote debugging
- Native module `ExpoAsset` linking

**Should be**:
```javascript
plugins: [
  "expo-asset",
  "expo-dev-client",  // ADD THIS
  "expo-font",
  "expo-secure-store",
  "expo-web-browser",
]
```

Each plugin in this array corresponds to a native module that needs linking during `npx expo prebuild`.

## Upgrade Path (If Needed)

### Option A: Stay Current (React Native 0.81.5)
- Monitor for fmt compilation issues with Xcode 26.4
- Use if: No C++ errors occur, app builds successfully

### Option B: Downgrade to Stable (React Native 0.74.5)
- Tested and confirmed working 6 days ago
- Required cascade updates:
  ```json
  {
    "react-native": "0.74.5",
    "react": "18.2.0",
    "expo": "^51.0.0",
    "react-native-screens": "~3.30.0",
    "react-native-safe-area-context": "~5.4.0"
  }
  ```
- Use if: fmt C++20 errors encountered

## Future Dependency Monitoring

Keep watch on:
1. **React Native** - Check for C++ compatibility issues with latest Xcode
2. **fmt library** - If upgraded past 11.0.2, C++20 support may improve
3. **Expo** - Track SDK releases for better React Native version compatibility
4. **Node.js** - v24.15.0 may have different file watcher behavior than v20

