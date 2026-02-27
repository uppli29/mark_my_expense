# Mark My Expense

A slick, offline-first mobile expense tracking application built with React Native and Expo. Seamlessly track your daily expenses, manage accounts, and visualize your spending habits.

## 🚀 Features

### Core Features
- **Dashboard Overview**: Get insights with interactive weekly and monthly expense charts
- **Spending Trends**: Visualize your spending habits with a dynamic 6-month trend line graph
- **Expense Management**: Easily add, view, edit, and delete daily expenses
- **Account Handling**: Manage bank accounts and cards with custom icons
- **Categories**: 20 predefined categories with customizable icons and colors
- **Offline Functionality**: Data stored securely on-device using SQLite

### Recent Updates
- **📊 Horizontal Bar Charts**: Replaced pie charts with dynamic horizontal bar charts for better category visualization
- **🔔 Push Notifications**: Daily reminders (9 PM) and weekly summaries (Sundays 9 PM)
- **⚙️ Settings Screen**: New settings tab with notification controls and data management
- **🎯 Category Filter Dropdown**: Replaced horizontal chip filters with a sleek dropdown picker
- **🗑️ Data Deletion**: Moved to Settings screen for better organization

### UI/UX
- **Dark/Light Mode**: Full theming support based on system preferences or user choice
- **Modern Design**: Premium UI with smooth animations and gradients
- **Inter Font**: Beautiful typography with the Inter font family

## 🛠️ Technology Stack

| Technology | Purpose |
|------------|---------|
| [React Native](https://reactnative.dev/) | Cross-platform mobile framework |
| [Expo](https://expo.dev/) (SDK 54) | Development platform & build tools |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | Local database storage |
| [React Navigation 7](https://reactnavigation.org/) | Screen navigation |
| [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) | Push notifications |
| [Ionicons](https://icons.expo.fyi/) | Icon library |
| [Inter Font](https://fonts.google.com/specimen/Inter) | Typography |

## 📂 Project Structure

```
expense_tracker_mobile/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── AccountCard.tsx
│   │   ├── AccountPicker.tsx
│   │   ├── AddExpenseModal.tsx
│   │   ├── CategoryFilter.tsx      # Dropdown category filter
│   │   ├── CategoryPicker.tsx
│   │   ├── DateRangePicker.tsx
│   │   ├── ExpenseListItem.tsx
│   │   ├── ExpensePieChart.tsx     # Horizontal bar chart (renamed)
│   │   ├── SpendingGraph.tsx       # Line chart for trends
│   │   └── ThemeToggle.tsx
│   ├── constants/
│   │   ├── categories.ts           # 20 expense categories
│   │   └── theme.ts                # Color palette
│   ├── context/
│   │   └── ThemeContext.tsx        # Dark/Light mode provider
│   ├── database/
│   │   ├── database.ts             # SQLite connection & utils
│   │   ├── schema.ts               # Table definitions
│   │   └── repositories/
│   │       ├── accountRepository.ts
│   │       └── expenseRepository.ts
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Bottom tab navigation
│   ├── screens/
│   │   ├── DashboardScreen.tsx     # Home with charts
│   │   ├── ExpensesScreen.tsx      # Expense list & filters
│   │   ├── AccountsScreen.tsx      # Account management
│   │   └── SettingsScreen.tsx      # Settings & notifications
│   ├── services/
│   │   └── notificationService.ts  # Push notification logic
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── utils/
│       ├── bankIcons.ts            # Bank logo mappings
│       ├── csvUtils.ts             # Import/Export utilities
│       └── dateUtils.ts            # Date formatting helpers
├── assets/                          # Static assets & bank logos
├── App.tsx                          # Application entry point
├── app.json                         # Expo configuration
└── package.json                     # Dependencies
```

## ⚙️ Setup & Installation

### Prerequisites
1. **Node.js** v18+ - [Download](https://nodejs.org/)
2. **Expo Go App** on your mobile device:
   - Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

### Quick Start

```bash
# Clone and install
git clone <repository_url>
cd expense_tracker_mobile
npm install

# Start development server
npx expo start

# Or use tunnel mode for easier device connection
npx expo start --tunnel
```

### Running on Device
- **Android**: Open Expo Go → Scan QR code
- **iOS**: Open Camera → Scan QR code → Open in Expo Go

## 📲 Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build Android APK
eas build -p android --profile preview

# Build iOS (requires macOS)
eas build -p ios --profile preview
```

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start Expo development server |
| `npm run android` | Start on Android emulator |
| `npm run ios` | Start on iOS simulator |
| `npm run web` | Start in web browser |

## 📖 Documentation

For detailed documentation, see:
- **[Architecture Guide](./docs/ARCHITECTURE.md)** - Database schema, component diagrams, data flow
- **[Installation Guide](./INSTALL.md)** - Step-by-step setup instructions

## 🔔 Notifications

The app includes scheduled push notifications:
- **Daily Reminder** (9 PM): Reminder to log expenses
- **Weekly Summary** (Sunday 9 PM): Weekly spending summary

Manage notifications in Settings → Notifications.

## 📊 Data Management

- **Export**: Export expenses to CSV (filtered by date range)
- **Import**: Import expenses from CSV (auto-creates accounts)
- **Erase**: Delete all data (Settings → Danger Zone)

All data is stored locally on your device using SQLite.

## 🤖 Offline Assistant (Optional)

The app includes a local Assistant screen that can answer questions about your expenses without any cloud API calls.

### How It Works
- A **local model file** (GGUF) can be downloaded or imported to the device.
- If a local model runtime is installed, the Assistant uses it.
- If not, the Assistant falls back to offline rule-based insights (still fully on-device).

### Typical Questions
- "How much did I spend this month?"
- "Top categories this week?"
- "Show my recent expenses."

See `INSTALL.md` for setup details.

## 📄 License

MIT License - See LICENSE file for details.
