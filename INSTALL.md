# Mark My Expense - Installation Guide

## Quick Start

### Prerequisites

1. **Node.js** (v18 or later) - [Download](https://nodejs.org/)
2. **Expo Go App** on your mobile device:
   - Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

---

## Installation Steps

### Step 1: Clone & Install

```bash
# Clone the repository
git clone <repository_url>
cd expense_tracker_mobile

# Install dependencies
npm install
```

> **Note**: If you encounter peer dependency issues, try `npm install --legacy-peer-deps`

### Step 2: Start Development Server

```bash
# Standard mode (requires same WiFi network)
npx expo start

# Tunnel mode (works across networks)
npx expo start --tunnel
```

This will display a QR code in your terminal.

### Step 3: Run on Mobile

#### Android
1. Open the **Expo Go** app
2. Tap **Scan QR Code**
3. Scan the QR code shown in your terminal

#### iOS
1. Open the **Camera** app
2. Point at the QR code
3. Tap the notification banner to open in Expo Go

---

## Building for Production

### Android APK

```bash
# Install EAS CLI (one-time)
npm install -g eas-cli

# Login to Expo account
eas login

# Build preview APK
eas build -p android --profile preview

# Build production AAB (for Play Store)
eas build -p android --profile production
```

### iOS Build

Requires macOS with Xcode:

```bash
# Build for TestFlight/App Store
eas build -p ios --profile preview
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code not scanning | Use tunnel mode: `npx expo start --tunnel` |
| "Network request failed" | Ensure phone and computer on same WiFi |
| App stuck on splash | Shake device → Reload |
| Metro bundler error | Delete `node_modules` and reinstall |
| SQLite error on web | Use mobile device - SQLite works best on iOS/Android |
| Notifications not working | Check app permissions in device settings |

### Clear Cache

```bash
# Clear Expo cache
npx expo start --clear

# Clear Metro bundler cache
rm -rf node_modules/.cache

# Full reset
rm -rf node_modules
npm install
npx expo start --clear
```

---

## App Features Overview

### Dashboard
- Weekly and monthly expense bar charts
- Quick add expense button (FAB)
- Recent expenses list
- Dark/Light mode toggle

### Expenses
- Date range picker with presets
- Account filter dropdown
- Category filter dropdown
- 6-month spending trend graph
- Category breakdown chart
- Full expense list with edit/delete

### Accounts
- Add bank accounts and cards
- Custom bank icons
- Export expenses to CSV
- Import expenses from CSV
- Download sample CSV format

### Settings (NEW)
- **Daily Reminder**: Toggle 9 PM expense logging reminder
- **Weekly Summary**: Toggle Sunday 9 PM spending summary
- **Test Notifications**: Verify notifications work
- **Erase All Data**: Delete all accounts and expenses

---

## Data Storage

All data is stored **locally on your device** using SQLite:
- Location: `expense_tracker.db` in app's private directory
- No cloud sync (fully offline)
- Data persists across app updates

### Database Tables

1. **accounts**: Bank accounts and cards
2. **expenses**: All expense records

See [Architecture Guide](./docs/ARCHITECTURE.md) for detailed schema.

---

## Optional: Offline Assistant (Local LLM)

The Assistant screen supports a fully offline LLM workflow. It never sends data to any cloud API.

### Model Files
- Use a **GGUF** model file (for example a small Gemma variant).
- Download the file from a trusted source or import it from local storage.
- The model file is stored in the app's private documents directory.

### Local Runtime (Native Module)
To enable real LLM inference on-device, you need a native runtime. The app looks for a `NativeModules.LocalLlm` module with the following methods:

```ts
loadModel(path: string): Promise<void>
generate(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string>
unloadModel?(): Promise<void>
```

If no native runtime is installed, the Assistant falls back to offline rule-based insights.

### Recommended Approach
For React Native, a llama.cpp based runtime is commonly used. You can:
1. Add a local LLM runtime package to your project.
2. Expose it as `LocalLlm` in `NativeModules`.
3. Build with EAS or a custom dev client (Expo Go cannot load native modules).

This keeps answers fully offline while using a local model file.

---

## Notification Permissions

The app requests notification permissions on first launch:

- **Android**: Automatically requested
- **iOS**: Permission popup will appear

To manage permissions later:
- **Android**: Settings → Apps → Mark My Expense → Notifications
- **iOS**: Settings → Mark My Expense → Notifications

---

## Development

### Recommended VSCode Extensions

- ESLint
- Prettier
- React Native Tools
- TypeScript Hero

### Hot Reload

Changes to React components will hot reload automatically. For database schema changes, you may need to:
1. Clear app data, or
2. Uninstall and reinstall the app

### Debugging

- Shake device to open React Native dev menu
- Use "Debug Remote JS" for Chrome DevTools
- Console logs appear in Metro bundler terminal

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) above
2. Review [Architecture Guide](./docs/ARCHITECTURE.md)
3. File an issue on GitHub
