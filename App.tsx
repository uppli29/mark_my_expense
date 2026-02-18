import React, { useEffect, useState, createContext, useContext } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/database';
import { notificationService } from './src/services/notificationService';
import { smsListenerService } from './src/services/smsListenerService';

// Context to share deep link state across the app
interface DeepLinkContextType {
  shouldShowAddExpense: boolean;
  setShouldShowAddExpense: (value: boolean) => void;
}

const DeepLinkContext = createContext<DeepLinkContextType>({
  shouldShowAddExpense: false,
  setShouldShowAddExpense: () => { },
});

export const useDeepLink = () => useContext(DeepLinkContext);

const AppContent: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [shouldShowAddExpense, setShouldShowAddExpense] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      try {
        // Initialize database
        await initDatabase();
        setDbReady(true);

        // Schedule notifications after DB is ready
        await notificationService.scheduleAllNotifications();

        // Initialize SMS service for auto-tracking (Android only)
        await smsListenerService.initSMSService();

        // Check for 9 PM auto-scan trigger as a fallback
        const shouldScan = await smsListenerService.shouldPerformAutoScan();
        if (shouldScan) {
          await smsListenerService.autoScanAndNotify();
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };

    setupApp();
  }, []);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (url.includes('add-expense')) {
        setShouldShowAddExpense(true);
      }
    };

    // Handle app opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('add-expense')) {
        setShouldShowAddExpense(true);
      }
    });

    // Handle deep link while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  if (!dbReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <DeepLinkContext.Provider value={{ shouldShowAddExpense, setShouldShowAddExpense }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </DeepLinkContext.Provider>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
