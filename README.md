# Mark My Expense

A slick, offline-first mobile expense tracking application built with React Native and Expo. Seamlessly track your daily expenses, manage accounts, and visualize your spending habits.

## 🚀 Features

-   **Dashboard Overview**: Get insights with interactive weekly and monthly expense pie charts.
-   **Expense Management**: Easily add, view, and delete daily expenses.
-   **Account Handling**: specific accounts (e.g., Cash, Credit Card, Savings) to categorize spending sources.
-   **Categories**: Organize expenses with a wide range of predefined categories (Food, Transport, Bills, etc.).
-   **Offline Functionality**: Data is stored securely on your device using SQLite, ensuring privacy and instant access without internet.
-   **Dark/Light Mode**: Fully supported theming based on system preferences or user choice.

## 🛠️ Technology Stack

-   **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Database**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
-   **Navigation**: [React Navigation 7](https://reactnavigation.org/)
-   **Icons**: [Expo Vector Icons](https://icons.expo.fyi/) (Ionicons)
-   **Fonts**: [Inter](https://fonts.google.com/specimen/Inter) via `@expo-google-fonts`

## 📂 Project Structure

```
expense_tracker_mobile/
├── src/
│   ├── components/    # Reusable UI components (CategoryPicker, Cards, etc.)
│   ├── constants/     # App constants and theme configurations
│   ├── context/       # React Context providers (ThemeContext)
│   ├── database/      # SQLite database setup, repositories, and schema
│   ├── navigation/    # Navigation setup (AppNavigator)
│   ├── screens/       # Main application screens (Dashboard, Expenses, Accounts)
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Helper functions (date formatting, currency, etc.)
├── assets/            # Static assets (images, fonts)
├── App.tsx            # Application entry point
├── app.json           # Expo configuration
└── package.json       # Dependencies and scripts
```

## ⚙️ Setup & Installation

### Prerequisites
1.  **Node.js**: Install the latest LTS version from [nodejs.org](https://nodejs.org/).
2.  **Expo Go / Simulators**:
    -   **Physical Device**: Install "Expo Go" from the App Store or Google Play.
    -   **Simulator**: Install Android Studio (for Android) or Xcode (for iOS/macOS).

### Installation Steps

1.  **Clone the repository**:
    ```bash
    git clone <repository_url>
    cd expense_tracker_mobile
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```
    *Note: If you encounter peer dependency issues, try `npm install --legacy-peer-deps`.*

3.  **Start the development server**:
    ```bash
    npm start
    # or
    npx expo start
    ```

4.  **Run on a device**:
    -   **QR Code**: Scan the QR code displayed in the terminal using the Expo Go app (Android) or Camera app (iOS).
    -   **Emulators**: Press `a` to open in Android Emulator or `i` to open in iOS Simulator (macOS only).

## 🧑‍💻 Development Flow

-   **Database Initialization**: The app checks for `expense_tracker.db` on launch. If missing, it initializes the schema defined in `src/database/schema.ts` via `initDatabase()` in `App.tsx`.
-   **Modifying Database**: If you modify the schema, you may need to clear the app data or uninstall/reinstall the app on your simulator/device to re-trigger initialization.
-   **Styling**: Use the `useTheme` hook from `src/context/ThemeContext.tsx` to access theme colors. Avoid hardcoding hex values; use the provided `colors` object for dark mode compatibility.

## 📝 Scripts

-   `npm start`: Start the Expo development server.
-   `npm run android`: specific command to start on Android.
-   `npm run ios`: specific command to start on iOS.
-   `npm run web`: Start the app in a web browser.
