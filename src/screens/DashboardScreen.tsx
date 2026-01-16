import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Alert,
    FlatList,
    Dimensions,
    RefreshControl,
    Image,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { ExpensePieChart } from '../components/ExpensePieChart';
import { ExpenseListItem } from '../components/ExpenseListItem';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { AccountExpensesModal } from '../components/AccountExpensesModal';
import { getBankIcon } from '../utils/bankIcons';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { accountRepository } from '../database/repositories/accountRepository';
import { Account, ExpenseWithAccount, CategorySummary, AccountSummary } from '../types';
import { getStartOfMonth, getToday, formatCurrency } from '../utils/dateUtils';
import { saveWidgetData } from '../utils/widgetStorage';
import { useDeepLink } from '../../App';
import { smsListenerService } from '../services/smsListenerService';

export const DashboardScreen: React.FC = () => {
    const { colors } = useTheme();
    const { shouldShowAddExpense, setShouldShowAddExpense } = useDeepLink();
    const [loading, setLoading] = useState(true);
    const [showAddExpense, setShowAddExpense] = useState(false);

    // Handle deep link to open Add Expense modal
    useEffect(() => {
        if (shouldShowAddExpense) {
            setSelectedExpense(null);
            setShowAddExpense(true);
            setShouldShowAddExpense(false);
        }
    }, [shouldShowAddExpense, setShouldShowAddExpense]);

    const [monthlyData, setMonthlyData] = useState<CategorySummary[]>([]);
    const [monthlyTotal, setMonthlyTotal] = useState(0);
    const [recentExpenses, setRecentExpenses] = useState<ExpenseWithAccount[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountSpends, setAccountSpends] = useState<AccountSummary[]>([]);
    const [activeAccountIndex, setActiveAccountIndex] = useState(0);

    // Edit State
    const [selectedExpense, setSelectedExpense] = useState<ExpenseWithAccount | null>(null);

    // Account Expenses Modal State
    const [selectedAccountForExpenses, setSelectedAccountForExpenses] = useState<AccountSummary | null>(null);
    const [accountExpenses, setAccountExpenses] = useState<ExpenseWithAccount[]>([]);
    const [accountExpensesLoading, setAccountExpensesLoading] = useState(false);
    const [showAccountExpensesModal, setShowAccountExpensesModal] = useState(false);

    // SMS Scanning State
    const [isScanning, setIsScanning] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const today = getToday();
            const monthStart = getStartOfMonth();

            const [
                monthly,
                monthTotal,
                recent,
                accts,
                acctSpends
            ] = await Promise.all([
                expenseRepository.getCategorySummary(monthStart, today),
                expenseRepository.getTotalSpend(monthStart, today),
                expenseRepository.getRecent(5),
                accountRepository.getAll(),
                accountRepository.getWithMonthlySpend(),
            ]);

            setMonthlyData(monthly);
            setMonthlyTotal(monthTotal);
            setRecentExpenses(recent);
            setAccounts(accts);
            setAccountSpends(acctSpends);

            // Sync widget data
            saveWidgetData(monthTotal);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleAddExpense = async (data: {
        amount: number;
        category: string;
        account_id: number;
        date: Date;
        description: string;
    }) => {
        await expenseRepository.create(
            data.account_id,
            data.amount,
            data.category,
            data.date,
            data.description
        );
        // If we are in account view, refresh that list too
        if (selectedAccountForExpenses) {
            await loadAccountExpenses(selectedAccountForExpenses);
        }
        loadData();
    };

    const handleUpdateExpense = async (data: {
        amount: number;
        category: string;
        account_id: number;
        date: Date;
        description: string;
    }) => {
        if (selectedExpense) {
            await expenseRepository.update(
                selectedExpense.id,
                data.account_id,
                data.amount,
                data.category,
                data.date,
                data.description
            );
            loadData();
        } else {
            // Fallback for new expense if somehow this is called
            await handleAddExpense(data);
        }
        // If we are in account view, refresh that list too
        if (selectedAccountForExpenses) {
            await loadAccountExpenses(selectedAccountForExpenses);
        }
        loadData();
    };

    const handleDeleteExpense = async () => {
        if (selectedExpense) {
            await expenseRepository.delete(selectedExpense.id);
            // If we are in account view, refresh that list too
            if (selectedAccountForExpenses) {
                await loadAccountExpenses(selectedAccountForExpenses);
            }
            loadData();
        }
    };

    const handleAccountPress = async (account: AccountSummary) => {
        setSelectedAccountForExpenses(account);
        setShowAccountExpensesModal(true);
        loadAccountExpenses(account);
    };

    const loadAccountExpenses = async (account: AccountSummary) => {
        setAccountExpensesLoading(true);
        try {
            const expenses = await expenseRepository.getByDateRange(
                getStartOfMonth(),
                getToday(), // Using today effectively covers the month up to now
                account.account_id
            );
            setAccountExpenses(expenses);
        } catch (error) {
            console.error('Error loading account expenses:', error);
            Alert.alert('Error', 'Failed to load account expenses');
        } finally {
            setAccountExpensesLoading(false);
        }
    };

    const handleExpensePress = (expense: ExpenseWithAccount) => {
        setSelectedExpense(expense);
        setShowAddExpense(true);
    };

    const handleSMSScan = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Not Supported', 'SMS scanning is only available on Android devices.');
            return;
        }

        // Check permissions
        const permissions = await smsListenerService.checkSMSPermissions();
        if (!permissions.hasReadSmsPermission) {
            Alert.alert(
                'Permission Required',
                'Please grant SMS permission in Settings to scan your messages.',
                [{ text: 'OK' }]
            );
            return;
        }

        setIsScanning(true);
        try {
            const result = await smsListenerService.scanSMSInbox();
            if (result.processed > 0) {
                Alert.alert(
                    'Scan Complete',
                    `Found ${result.processed} new transaction${result.processed > 1 ? 's' : ''} from SMS.`,
                    [{ text: 'OK' }]
                );
                // Reload data to show new expenses
                loadData();
            } else {
                Alert.alert(
                    'Scan Complete',
                    'No new transactions found in your SMS.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('SMS scan error:', error);
            Alert.alert('Error', 'Failed to scan SMS. Please try again.');
        } finally {
            setIsScanning(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard</Text>
                <ThemeToggle />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    Platform.OS === 'android' ? (
                        <RefreshControl
                            refreshing={isScanning}
                            onRefresh={handleSMSScan}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    ) : undefined
                }
            >
                {/* This Month Summary Card with Pie Chart */}
                <View style={styles.monthlyCard}>
                    <ExpensePieChart
                        data={monthlyData}
                        title="This Month"
                        total={monthlyTotal}
                    />
                </View>

                {/* Accounts Overview - Paged Carousel */}
                <View style={styles.accountsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Accounts Overview
                    </Text>
                    <FlatList
                        data={accountSpends}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.account_id.toString()}
                        snapToInterval={Dimensions.get('window').width - 32}
                        snapToAlignment="center"
                        decelerationRate="fast"
                        onScroll={(e) => {
                            const index = Math.round(
                                e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32)
                            );
                            setActiveAccountIndex(index);
                        }}
                        scrollEventThrottle={16}
                        contentContainerStyle={styles.accountsCarousel}
                        style={styles.accountsFlatList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.accountSpendCard,
                                    { backgroundColor: colors.surface, width: Dimensions.get('window').width - 64 }
                                ]}
                                activeOpacity={0.9}
                                onPress={() => handleAccountPress(item)}
                            >
                                <View style={[styles.accountIconCircle, { backgroundColor: colors.background }]}>
                                    <Image
                                        source={getBankIcon(item.account_name, item.icon)}
                                        style={styles.bankIcon}
                                        resizeMode="contain"
                                    />
                                </View>
                                <Text
                                    style={[styles.accountSpendName, { color: colors.text }]}
                                    numberOfLines={1}
                                >
                                    {item.account_name}
                                </Text>
                                <Text style={[styles.accountSpendAmount, { color: colors.primary }]}>
                                    {formatCurrency(item.total)}
                                </Text>
                                <Text style={[styles.accountSpendLabel, { color: colors.textMuted }]}>
                                    {item.transaction_count} transaction{item.transaction_count !== 1 ? 's' : ''} this month
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                    {/* Dot Indicators */}
                    {accountSpends.length > 1 && (
                        <View style={styles.dotContainer}>
                            {accountSpends.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.dot,
                                        {
                                            backgroundColor: index === activeAccountIndex
                                                ? colors.primary
                                                : colors.textMuted + '40'
                                        }
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>

                {/* Recent Expenses */}
                {recentExpenses.length > 0 && (
                    <View style={styles.recentSection}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            Recent Expenses
                        </Text>
                        {recentExpenses.map((expense) => (
                            <ExpenseListItem
                                key={expense.id}
                                expense={expense}
                                onPress={() => handleExpensePress(expense)}
                            />
                        ))}
                    </View>
                )}

                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Floating Add Button */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => {
                    setSelectedExpense(null);
                    setShowAddExpense(true);
                }}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>



            {/* Add Expense Modal */}
            <AddExpenseModal
                visible={showAddExpense}
                onClose={() => {
                    setShowAddExpense(false);
                    setSelectedExpense(null);
                }}
                onSubmit={selectedExpense ? handleUpdateExpense : handleAddExpense}
                onDelete={selectedExpense ? handleDeleteExpense : undefined}
                accounts={accounts}
                expense={selectedExpense}
            />
            {/* Account Expenses Modal */}
            <AccountExpensesModal
                visible={showAccountExpensesModal}
                onClose={() => setShowAccountExpensesModal(false)}
                account={selectedAccountForExpenses}
                expenses={accountExpenses}
                onExpensePress={(expense) => {
                    setSelectedExpense(expense);
                    setShowAddExpense(true);
                }}
                loading={accountExpensesLoading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    greeting: {
        fontSize: 13,
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
    monthlyCard: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    accountsSection: {
        marginTop: 24,
        marginBottom: 24,
    },
    accountsCarousel: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    accountsFlatList: {
        overflow: 'visible',
    },
    accountSpendCard: {
        marginHorizontal: 8,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 8,
        alignItems: 'center',
    },
    accountIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    bankIcon: {
        width: 28,
        height: 28,
    },
    accountSpendName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    accountSpendLabel: {
        fontSize: 12,
        marginTop: 8,
    },
    accountSpendAmount: {
        fontSize: 28,
        fontWeight: '700',
    },
    dotContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    recentSection: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 20,
        marginBottom: 12,
    },
    bottomPadding: {
        height: 120,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 100,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 999,
    },
    smsFab: {
        position: 'absolute',
        right: 20,
        bottom: 170,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 999,
    },
});
