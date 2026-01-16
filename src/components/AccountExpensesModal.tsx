import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Platform,
    Image,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { AccountSummary, ExpenseWithAccount } from '../types';
import { ExpenseListItem } from './ExpenseListItem';
import { formatCurrency } from '../utils/dateUtils';
import { getBankIcon } from '../utils/bankIcons';

interface AccountExpensesModalProps {
    visible: boolean;
    onClose: () => void;
    account: AccountSummary | null;
    expenses: ExpenseWithAccount[];
    onExpensePress: (expense: ExpenseWithAccount) => void;
    loading?: boolean;
}

export const AccountExpensesModal: React.FC<AccountExpensesModalProps> = ({
    visible,
    onClose,
    account,
    expenses,
    onExpensePress,
    loading = false,
}) => {
    const { colors, isDark } = useTheme();

    if (!account) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface }]}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.accountInfo}>
                            <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
                                <Image
                                    source={getBankIcon(account.account_name, account.icon)}
                                    style={styles.bankIcon}
                                    resizeMode="contain"
                                />
                            </View>
                            <View>
                                <Text style={[styles.accountName, { color: colors.text }]}>
                                    {account.account_name}
                                </Text>
                                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                                    This Month
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: colors.background }]}
                            onPress={onClose}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.amountContainer}>
                        <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total Spent</Text>
                        <Text style={[styles.totalAmount, { color: colors.primary }]}>
                            {formatCurrency(account.total)}
                        </Text>
                    </View>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.centerContent}>
                        <Text style={{ color: colors.textMuted }}>Loading expenses...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={expenses}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <ExpenseListItem
                                expense={item}
                                onPress={() => onExpensePress(item)}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.centerContent}>
                                <Text style={{ color: colors.textMuted }}>
                                    No expenses found for this month
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        zIndex: 10,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    accountInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    bankIcon: {
        width: 28,
        height: 28,
    },
    accountName: {
        fontSize: 18,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 13,
    },
    amountContainer: {
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 12,
        marginBottom: 2,
    },
    totalAmount: {
        fontSize: 28,
        fontWeight: '700',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingVertical: 16,
        paddingBottom: 40,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
});
