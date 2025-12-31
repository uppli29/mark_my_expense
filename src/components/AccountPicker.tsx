import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Account } from '../types';
import { getBankIcon } from '../utils/bankIcons';

interface AccountPickerProps {
    accounts: Account[];
    selectedAccountId: number | null;
    onSelect: (accountId: number) => void;
    placeholder?: string;
}

export const AccountPicker: React.FC<AccountPickerProps> = ({
    accounts,
    selectedAccountId,
    onSelect,
    placeholder = 'Select Account',
}) => {
    const [visible, setVisible] = useState(false);
    const { colors } = useTheme();

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    const handleSelect = (accountId: number) => {
        onSelect(accountId);
        setVisible(false);
    };

    return (
        <>
            <TouchableOpacity
                style={[styles.selector, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                onPress={() => setVisible(true)}
            >
                <View style={styles.selectorContent}>
                    <View style={[styles.iconBox, { backgroundColor: 'transparent' }]}>
                        <Image
                            source={getBankIcon(selectedAccount?.name || '', selectedAccount?.icon)}
                            style={styles.bankIconSmall}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={[
                        styles.selectorText,
                        { color: selectedAccount ? colors.text : colors.textMuted }
                    ]}>
                        {selectedAccount?.name || placeholder}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={() => setVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Select Account
                            </Text>
                            <TouchableOpacity onPress={() => setVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {accounts.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                    No accounts yet
                                </Text>
                                <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                                    Add an account first
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={accounts}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.accountItem,
                                            { backgroundColor: colors.surface },
                                            selectedAccountId === item.id && { borderColor: colors.primary, borderWidth: 2 }
                                        ]}
                                        onPress={() => handleSelect(item.id)}
                                    >
                                        <View style={[styles.accountIcon, { backgroundColor: 'transparent' }]}>
                                            <Image
                                                source={getBankIcon(item.name, item.icon)}
                                                style={styles.bankIconLarge}
                                                resizeMode="contain"
                                            />
                                        </View>
                                        <View style={styles.accountDetails}>
                                            <Text style={[styles.accountName, { color: colors.text }]}>
                                                {item.name}
                                            </Text>
                                            <Text style={[styles.accountType, { color: colors.textMuted }]}>
                                                {item.type === 'bank' ? 'Bank Account' : 'Card'}
                                            </Text>
                                        </View>
                                        {selectedAccountId === item.id && (
                                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                )}
                                contentContainerStyle={styles.listContent}
                            />
                        )}
                    </SafeAreaView>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    selectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    bankIconSmall: {
        width: 30,
        height: 30,
    },
    bankIconLarge: {
        width: 40,
        height: 40,
    },
    selectorText: {
        fontSize: 15,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 4,
    },
    listContent: {
        padding: 16,
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    accountIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    accountDetails: {
        flex: 1,
    },
    accountName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    accountType: {
        fontSize: 12,
    },
});
