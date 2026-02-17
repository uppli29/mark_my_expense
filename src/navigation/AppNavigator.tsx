import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { AccountsScreen } from '../screens/AccountsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
    const { colors } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: true,
                tabBarStyle: {
                    borderTopWidth: 0,
                    elevation: 10,
                    backgroundColor: colors.surface,
                    height: 80,
                    paddingTop: 8,
                    paddingBottom: 12,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.tabBarInactive,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap;

                    switch (route.name) {
                        case 'Dashboard':
                            iconName = focused ? 'home' : 'home-outline';
                            break;
                        case 'Expenses':
                            iconName = focused ? 'receipt' : 'receipt-outline';
                            break;
                        case 'Budget':
                            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
                            break;
                        case 'Accounts':
                            iconName = focused ? 'card' : 'card-outline';
                            break;
                        case 'Settings':
                            iconName = focused ? 'settings' : 'settings-outline';
                            break;
                        default:
                            iconName = 'home-outline';
                    }

                    return <Ionicons name={iconName} size={26} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Expenses" component={ExpensesScreen} />
            <Tab.Screen name="Budget" component={BudgetScreen} />
            <Tab.Screen name="Accounts" component={AccountsScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

