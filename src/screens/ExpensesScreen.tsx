import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { ExpensePieChart } from '../components/ExpensePieChart';
import { SpendingGraph } from '../components/SpendingGraph';
import { ExpenseListItem } from '../components/ExpenseListItem';
import { DateRangePicker } from '../components/DateRangePicker';
import { CategoryFilter } from '../components/CategoryFilter';
import { AccountPicker } from '../components/AccountPicker';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { accountRepository } from '../database/repositories/accountRepository';
import { Account, ExpenseWithAccount, CategorySummary } from '../types';
import { getLast7Days, getToday, formatCurrency, subMonths } from '../utils/dateUtils';

export const ExpensesScreen: React.FC = () => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState(getLast7Days());
    const [endDate, setEndDate] = useState(getToday());
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const [expenses, setExpenses] = useState<ExpenseWithAccount[]>([]);
    const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
    const [trendData, setTrendData] = useState<{ month: string; total: number }[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [total, setTotal] = useState(0);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<ExpenseWithAccount | null>(null);

    // Multi-select State
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const loadData = useCallback(async () => {
        try {
            // Determine trend start date
            const durationMs = endDate.getTime() - startDate.getTime();
            const daysDiff = durationMs / (1000 * 3600 * 24);
            const trendStart = daysDiff > 88 ? startDate : subMonths(endDate, 6);

            const [expensesList, summary, totalSpend, accts, trend] = await Promise.all([
                expenseRepository.getByDateRange(startDate, endDate, selectedAccountId || undefined),
                expenseRepository.getCategorySummary(startDate, endDate, selectedAccountId || undefined),
                expenseRepository.getTotalSpend(startDate, endDate, selectedAccountId || undefined),
                accountRepository.getAll(),
                expenseRepository.getMonthlyTrend(trendStart, endDate, selectedAccountId || undefined)
            ]);

            setExpenses(expensesList);
            setCategorySummary(summary);
            setTotal(totalSpend);
            setAccounts(accts);
            setTrendData(trend);
        } catch (error) {
            console.error('Failed to load expenses:', error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedAccountId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleExpensePress = (expense: ExpenseWithAccount) => {
        setSelectedExpense(expense);
        setModalVisible(true);
    };

    const handleModalClose = () => {
        setModalVisible(false);
        setSelectedExpense(null);
    };

    const handleUpdateExpense = async (data: {
        amount: number;
        category: string;
        account_id: number;
        date: Date;
        description: string;
    }) => {
        if (!selectedExpense) return;
        try {
            await expenseRepository.update(
                selectedExpense.id,
                data.account_id,
                data.amount,
                data.category,
                data.date,
                data.description
            );
            loadData();
        } catch (error) {
            console.error('Failed to update expense:', error);
            throw error; // Re-throw to let modal handle error state
        }
    };

    const handleDeleteExpense = async () => {
        if (!selectedExpense) return;
        try {
            await expenseRepository.delete(selectedExpense.id);
            loadData();
        } catch (error) {
            console.error('Failed to delete expense:', error);
            throw error;
        }
    };

    // Swipe single delete — stable ref for memo
    const handleSwipeDelete = useCallback(async (id: number) => {
        try {
            await expenseRepository.delete(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete expense:', error);
        }
    }, [loadData]);

    // Multi-select handlers — stable refs for memo
    const handleLongPress = useCallback((id: number) => {
        setIsSelecting(true);
        setSelectedIds(new Set([id]));
    }, []);

    const handleToggleSelect = useCallback((id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleCancelSelection = useCallback(() => {
        setIsSelecting(false);
        setSelectedIds(new Set());
    }, []);

    // Filter expenses by category (must be before handleSelectAll)
    const filteredExpenses = selectedCategory
        ? expenses.filter(e => e.category === selectedCategory)
        : expenses;

    const handleSelectAll = useCallback(() => {
        const allIds = new Set(filteredExpenses.map(e => e.id));
        setSelectedIds(prev => prev.size === filteredExpenses.length ? new Set() : allIds);
    }, [filteredExpenses]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;
        Alert.alert(
            'Delete Expenses',
            `Are you sure you want to delete ${selectedIds.size} expense${selectedIds.size > 1 ? 's' : ''}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await expenseRepository.deleteMany(Array.from(selectedIds));
                            handleCancelSelection();
                            loadData();
                        } catch (error) {
                            console.error('Failed to bulk delete:', error);
                            Alert.alert('Error', 'Failed to delete expenses.');
                        }
                    },
                },
            ]
        );
    }, [selectedIds, handleCancelSelection, loadData]);

    const renderHeader = () => (
        <View>
            {/* Filters */}
            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={(date) => {
                    setStartDate(date);
                }}
                onEndDateChange={(date) => {
                    setEndDate(date);
                }}
            />

            {/* Account Filter */}
            <View style={styles.accountFilter}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Account</Text>
                <View style={styles.accountPickerContainer}>
                    <AccountPicker
                        accounts={[{ id: 0, name: 'All Accounts', type: 'bank', icon: null, created_at: '' }, ...accounts]}
                        selectedAccountId={selectedAccountId || 0}
                        onSelect={(id) => {
                            setSelectedAccountId(id === 0 ? null : id);
                        }}
                        placeholder="All Accounts"
                    />
                </View>
            </View>

            {/* Apply Button */}
            <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                    setLoading(true);
                    loadData();
                }}
            >
                <Text style={styles.applyButtonText}>Apply Filter</Text>
            </TouchableOpacity>

            {/* Summary */}
            <View style={[styles.summaryBanner, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.summaryText, { color: colors.primary }]}>
                    Total: {formatCurrency(total)} ({expenses.length} expenses)
                </Text>
            </View>

            {/* Spending Graph */}
            <View style={styles.chartContainer}>
                <SpendingGraph
                    data={trendData}
                    title="Spending Trend"
                />
            </View>

            {/* Pie Chart */}
            <View style={styles.chartContainer}>
                <ExpensePieChart
                    data={categorySummary}
                    title="Expenses by Category"
                    total={total}
                />
            </View>

            {/* Category Filter */}
            <View style={styles.categoryFilterSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Expense List
                </Text>
                <CategoryFilter
                    selectedCategory={selectedCategory}
                    onSelect={setSelectedCategory}
                />
            </View>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {selectedCategory ? 'No expenses in this category' : 'No expenses found'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                {selectedCategory ? 'Try selecting a different category' : 'Add your first expense from the Dashboard'}
            </Text>
        </View>
    );

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
            {isSelecting ? (
                <View style={[styles.header, styles.selectionHeader, { backgroundColor: colors.primary }]}> 
                    <TouchableOpacity onPress={handleCancelSelection} style={styles.selectionAction}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.selectionTitle}>
                        {selectedIds.size} selected
                    </Text>
                    <View style={styles.selectionActions}>
                        <TouchableOpacity onPress={handleSelectAll} style={styles.selectionAction}>
                            <Ionicons
                                name={selectedIds.size === filteredExpenses.length ? 'checkbox' : 'checkbox-outline'}
                                size={22}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleBulkDelete} style={styles.selectionAction}>
                            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={[styles.header, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Expenses</Text>
                    <ThemeToggle />
                </View>
            )}

            <FlatList
                data={filteredExpenses}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <ExpenseListItem
                        expense={item}
                        onPress={() => handleExpensePress(item)}
                        onDelete={handleSwipeDelete}
                        onLongPress={() => handleLongPress(item.id)}
                        isSelecting={isSelecting}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={handleToggleSelect}
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            />

            <AddExpenseModal
                visible={modalVisible}
                onClose={handleModalClose}
                onSubmit={handleUpdateExpense}
                onDelete={handleDeleteExpense}
                accounts={accounts}
                expense={selectedExpense}
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
        paddingBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    selectionHeader: {
        shadowOpacity: 0.15,
        elevation: 4,
    },
    selectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    selectionAction: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    accountFilter: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    accountPickerContainer: {
        // Style for account picker container
    },
    summaryBanner: {
        marginHorizontal: 16,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 6,
    },
    summaryText: {
        fontSize: 14,
        fontWeight: '600',
    },
    chartContainer: {
        paddingHorizontal: 16,
    },
    categoryFilterSection: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 16,
    },
    listContent: {
        paddingBottom: 30,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    applyButton: {
        marginHorizontal: 16,
        marginVertical: 12,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    refreshButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    smsFab: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
});
