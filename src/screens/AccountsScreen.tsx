import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    Platform,
    Image,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { accountRepository } from '../database/repositories/accountRepository';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { clearAllData } from '../database/database';
import { Account } from '../types';
import { exportToCSV, parseCSV, mapCategoryNameToId } from '../utils/csvUtils';
import { formatDate } from '../utils/dateUtils';
import { getBankIcon, BANK_ICON_OPTIONS } from '../utils/bankIcons';

export const AccountsScreen: React.FC = () => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEraseModal, setShowEraseModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [editAccountName, setEditAccountName] = useState('');
    const [editAccountType, setEditAccountType] = useState<'bank' | 'card'>('bank');
    const [editAccountIcon, setEditAccountIcon] = useState<string | null>(null);
    const [newAccountName, setNewAccountName] = useState('');
    const [accountType, setAccountType] = useState<'bank' | 'card'>('bank');
    const [accountIcon, setAccountIcon] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isErasing, setIsErasing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // Export date range
    const [exportStartDate, setExportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [exportEndDate, setExportEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const accountsList = await accountRepository.getAll();
            setAccounts(accountsList);
        } catch (error) {
            console.error('Failed to load accounts:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleAddAccount = async () => {
        if (!newAccountName.trim()) {
            Alert.alert('Error', 'Please enter an account name');
            return;
        }

        try {
            await accountRepository.create(newAccountName.trim(), accountType, accountIcon);
            setNewAccountName('');
            setAccountType('bank');
            setAccountIcon(null);
            setShowAddModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'Failed to add account');
        }
    };

    const handleDeleteAccount = (accountId: number, accountName: string) => {
        Alert.alert(
            'Delete Account',
            `Are you sure you want to delete "${accountName}"? All expenses linked to this account will also be deleted.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await accountRepository.delete(accountId);
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete account');
                        }
                    },
                },
            ]
        );
    };

    const handleEditAccount = (account: Account) => {
        setEditingAccount(account);
        setEditAccountName(account.name);
        setEditAccountType(account.type);
        setEditAccountIcon(account.icon);
        setShowEditModal(true);
    };

    const handleSaveEditAccount = async () => {
        if (!editingAccount) return;
        if (!editAccountName.trim()) {
            Alert.alert('Error', 'Please enter an account name');
            return;
        }

        try {
            await accountRepository.update(editingAccount.id, editAccountName.trim(), editAccountType, editAccountIcon);
            setShowEditModal(false);
            setEditingAccount(null);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'Failed to update account');
        }
    };

    const handleEraseAllData = async () => {
        if (deleteConfirmText !== 'DELETE') {
            Alert.alert('Error', 'Please type DELETE to confirm');
            return;
        }

        setIsErasing(true);
        try {
            await clearAllData();
            setDeleteConfirmText('');
            setShowEraseModal(false);
            loadData();
            Alert.alert('Success', 'All data has been erased successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to erase data');
        } finally {
            setIsErasing(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const expenses = await expenseRepository.getByDateRange(exportStartDate, exportEndDate);

            if (expenses.length === 0) {
                Alert.alert('No Data', 'No expenses found in the selected date range');
                setIsExporting(false);
                return;
            }

            const csvContent = exportToCSV(expenses);
            const fileName = `expenses_${formatDate(exportStartDate).replace(/\s/g, '_')}_to_${formatDate(exportEndDate).replace(/\s/g, '_')}.csv`;

            if (Platform.OS === 'android') {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

                if (permissions.granted) {
                    try {
                        const uri = await FileSystem.StorageAccessFramework.createFileAsync(
                            permissions.directoryUri,
                            fileName,
                            'text/csv'
                        );

                        await FileSystem.writeAsStringAsync(uri, csvContent, {
                            encoding: FileSystem.EncodingType.UTF8,
                        });

                        Alert.alert('Success', `Exported ${expenses.length} expenses successfully`);
                    } catch (e) {
                        console.error("Export save error", e);
                        Alert.alert('Error', 'Failed to save export file');
                    }
                }
            } else {
                const filePath = `${FileSystem.cacheDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(filePath, csvContent, {
                    encoding: FileSystem.EncodingType.UTF8,
                });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(filePath, {
                        mimeType: 'text/csv',
                        dialogTitle: 'Export Expenses',
                        UTI: 'public.comma-separated-values-text'
                    });
                } else {
                    Alert.alert('Success', `Exported ${expenses.length} expenses to ${fileName}`);
                }
            }

            setShowExportModal(false);
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Error', 'Failed to export expenses');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        setIsImporting(true);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                setIsImporting(false);
                return;
            }

            const file = result.assets[0];

            // Validate file extension
            if (!file.name?.toLowerCase().endsWith('.csv')) {
                Alert.alert('Invalid File', 'Please select a CSV file (.csv extension)');
                setIsImporting(false);
                return;
            }

            const content = await FileSystem.readAsStringAsync(file.uri);

            const parsedRows = parseCSV(content);

            // Map accounts and prepare expenses
            const expensesToCreate: Array<{
                accountId: number;
                amount: number;
                category: string;
                date: string;
                description?: string;
            }> = [];

            const missingAccounts: string[] = [];
            const createdAccounts: string[] = [];

            for (const row of parsedRows) {
                if (row.account === '' || row.account === null) {
                    console.warn("Account is empty/missing. Skipping row.", row);
                    continue;
                }

                let account = await accountRepository.getByName(row.account);

                // Auto-create account if it doesn't exist
                if (!account) {
                    try {
                        const newAccountId = await accountRepository.create(row.account, 'bank');
                        account = await accountRepository.getById(newAccountId);
                        if (account && !createdAccounts.includes(row.account)) {
                            createdAccounts.push(row.account);
                        }
                    } catch (createError) {
                        console.error('Failed to create account:', row.account, createError);
                        if (!missingAccounts.includes(row.account)) {
                            missingAccounts.push(row.account);
                        }
                        continue;
                    }
                }

                if (!account) {
                    if (!missingAccounts.includes(row.account)) {
                        missingAccounts.push(row.account);
                    }
                    continue;
                }

                expensesToCreate.push({
                    accountId: account.id,
                    amount: row.amount,
                    category: mapCategoryNameToId(row.category),
                    date: row.date,
                    description: row.description,
                });
            }

            if (expensesToCreate.length === 0) {
                const msg = missingAccounts.length > 0
                    ? `No expenses imported. Failed to create accounts: ${missingAccounts.join(', ')}`
                    : 'No valid expenses found in CSV';
                Alert.alert('Import Failed', msg);
                setIsImporting(false);
                return;
            }

            const insertedCount = await expenseRepository.bulkCreate(expensesToCreate);

            let successMsg = `Successfully imported ${insertedCount} expenses`;
            if (createdAccounts.length > 0) {
                successMsg += `\n\nAuto-created accounts: ${createdAccounts.join(', ')}`;
            }
            if (missingAccounts.length > 0) {
                successMsg += `\n\nSkipped rows with failed accounts: ${missingAccounts.join(', ')}`;
            }

            Alert.alert('Import Complete', successMsg);
            loadData();
        } catch (error) {
            console.error('Import error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to import expenses';
            Alert.alert('Import Failed', errorMessage);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDownloadSampleCSV = async () => {
        try {
            const sampleCSV = `Account,Category,Amount,Date,Description
"HDFC Savings","Food & Dining",250.00,2024-01-15,"Lunch at restaurant"
"ICICI Credit Card","Shopping",1500.00,2024-01-16,"Online shopping"
"SBI Account","Transportation",100.00,2024-01-17,"Cab fare"
"HDFC Savings","Groceries",800.00,2024-01-18,"Weekly groceries"
"ICICI Credit Card","Entertainment",350.00,2024-01-19,"Movie tickets"`;

            const fileName = 'sample_expenses_template.csv';

            if (Platform.OS === 'android') {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

                if (permissions.granted) {
                    try {
                        const uri = await FileSystem.StorageAccessFramework.createFileAsync(
                            permissions.directoryUri,
                            fileName,
                            'text/csv'
                        );

                        await FileSystem.writeAsStringAsync(uri, sampleCSV, {
                            encoding: FileSystem.EncodingType.UTF8,
                        });

                        Alert.alert('Success', 'Sample CSV saved successfully');
                    } catch (e) {
                        console.error("Save error", e);
                        Alert.alert('Error', 'Failed to save file');
                    }
                }
            } else {
                const filePath = `${FileSystem.cacheDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(filePath, sampleCSV, {
                    encoding: FileSystem.EncodingType.UTF8,
                });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(filePath, {
                        mimeType: 'text/csv',
                        dialogTitle: 'Download Sample CSV Template',
                        UTI: 'public.comma-separated-values-text' // iOS helps to open in Numbers/Excel
                    });
                } else {
                    Alert.alert('Error', 'Sharing is not available on this device');
                }
            }
        } catch (error) {
            console.error('Sample CSV error:', error);
            Alert.alert('Error', 'Failed to create sample CSV');
        }
    };

    const renderAccountItem = ({ item }: { item: Account }) => {
        const bankIcon = getBankIcon(item.name, item.icon);

        return (
            <View style={[styles.accountCard, { backgroundColor: colors.surface }]}>
                <View style={styles.accountIcon}>
                    <Image
                        source={bankIcon}
                        style={styles.bankLogo}
                        resizeMode="contain"
                    />
                </View>
                <View style={styles.accountInfo}>
                    <Text style={[styles.accountName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.accountType, { color: colors.textMuted }]}>
                        {item.type === 'card' ? 'Credit/Debit Card' : 'Bank Account'}
                    </Text>
                </View>
                <View style={styles.accountActions}>
                    <TouchableOpacity
                        onPress={() => handleEditAccount(item)}
                        style={styles.editButton}
                    >
                        <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleDeleteAccount(item.id, item.name)}
                        style={styles.deleteButton}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No accounts yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Add your first bank account or card
            </Text>
        </View>
    );

    const renderActionsSection = () => (
        <View style={styles.actionsSection}>
            {/* Export & Import */}
            <View style={[styles.actionCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.actionCardTitle, { color: colors.text }]}>Data Management</Text>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                    onPress={() => setShowExportModal(true)}
                    disabled={isExporting}
                >
                    <Ionicons name="download-outline" size={20} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Export to CSV</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                    onPress={handleImport}
                    disabled={isImporting}
                >
                    {isImporting ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="folder-open-outline" size={20} color={colors.primary} />
                            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Import from CSV</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.textMuted + '15', borderColor: colors.textMuted }]}
                    onPress={handleDownloadSampleCSV}
                >
                    <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Download Sample CSV Format</Text>
                </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={[styles.dangerZone, { backgroundColor: colors.surface, borderColor: colors.error + '30' }]}>
                <Text style={[styles.dangerTitle, { color: colors.error }]}>Danger Zone</Text>
                <Text style={[styles.dangerDescription, { color: colors.textMuted }]}>
                    Permanently delete all your data including accounts and expenses.
                </Text>
                <TouchableOpacity
                    style={[styles.eraseButton, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
                    onPress={() => setShowEraseModal(true)}
                >
                    <Ionicons name="trash" size={18} color={colors.error} />
                    <Text style={[styles.eraseButtonText, { color: colors.error }]}>Erase All Data</Text>
                </TouchableOpacity>
            </View>
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
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Accounts</Text>
                <View style={styles.headerRight}>
                    <ThemeToggle />
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={() => setShowAddModal(true)}
                    >
                        <Ionicons name="add" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={accounts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderAccountItem}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderActionsSection}
                contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            />

            {/* Add Account Modal */}
            <Modal
                visible={showAddModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior="padding"
                    style={styles.modalOverlay}
                    keyboardVerticalOffset={0}
                >
                    <TouchableOpacity
                        style={styles.modalDismissArea}
                        activeOpacity={1}
                        onPress={() => setShowAddModal(false)}
                    />
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Add Account
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Account Name
                                </Text>
                                <TextInput
                                    style={[styles.textInput, {
                                        backgroundColor: colors.surfaceVariant,
                                        borderColor: colors.border,
                                        color: colors.text
                                    }]}
                                    value={newAccountName}
                                    onChangeText={setNewAccountName}
                                    placeholder="e.g., HDFC Savings, ICICI Credit Card"
                                    placeholderTextColor={colors.textMuted}
                                    autoFocus
                                />
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Account Type
                                </Text>
                                <View style={styles.typeSelector}>
                                    <TouchableOpacity
                                        style={[
                                            styles.typeButton,
                                            { backgroundColor: colors.surface, borderColor: colors.border },
                                            accountType === 'bank' && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                        ]}
                                        onPress={() => setAccountType('bank')}
                                    >
                                        <Ionicons
                                            name="business"
                                            size={24}
                                            color={accountType === 'bank' ? colors.primary : colors.textMuted}
                                        />
                                        <Text style={[
                                            styles.typeText,
                                            { color: colors.text },
                                            accountType === 'bank' && { color: colors.primary, fontWeight: '600' }
                                        ]}>
                                            Bank
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.typeButton,
                                            { backgroundColor: colors.surface, borderColor: colors.border },
                                            accountType === 'card' && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                        ]}
                                        onPress={() => setAccountType('card')}
                                    >
                                        <Ionicons
                                            name="card"
                                            size={24}
                                            color={accountType === 'card' ? colors.primary : colors.textMuted}
                                        />
                                        <Text style={[
                                            styles.typeText,
                                            { color: colors.text },
                                            accountType === 'card' && { color: colors.primary, fontWeight: '600' }
                                        ]}>
                                            Card
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Bank Icon (Optional)
                                </Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.iconPickerContainer}
                                    contentContainerStyle={styles.iconPickerContent}
                                >
                                    {BANK_ICON_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.key}
                                            style={[
                                                styles.iconOption,
                                                { borderColor: colors.border },
                                                (accountIcon === option.key || (!accountIcon && option.key === 'default')) &&
                                                { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
                                            ]}
                                            onPress={() => setAccountIcon(option.key === 'default' ? null : option.key)}
                                        >
                                            <Image
                                                source={option.icon}
                                                style={styles.iconOptionImage}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                                onPress={handleAddAccount}
                            >
                                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                                <Text style={styles.submitButtonText}>Add Account</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Edit Account Modal */}
            <Modal
                visible={showEditModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowEditModal(false)}
            >
                <KeyboardAvoidingView
                    behavior="padding"
                    style={styles.modalOverlay}
                    keyboardVerticalOffset={0}
                >
                    <TouchableOpacity
                        style={styles.modalDismissArea}
                        activeOpacity={1}
                        onPress={() => setShowEditModal(false)}
                    />
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Edit Account
                            </Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Account Name
                                </Text>
                                <TextInput
                                    style={[styles.textInput, {
                                        backgroundColor: colors.surfaceVariant,
                                        borderColor: colors.border,
                                        color: colors.text
                                    }]}
                                    value={editAccountName}
                                    onChangeText={setEditAccountName}
                                    placeholder="e.g., HDFC Savings, ICICI Credit Card"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Account Type
                                </Text>
                                <View style={styles.typeSelector}>
                                    <TouchableOpacity
                                        style={[
                                            styles.typeButton,
                                            { backgroundColor: colors.surface, borderColor: colors.border },
                                            editAccountType === 'bank' && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                        ]}
                                        onPress={() => setEditAccountType('bank')}
                                    >
                                        <Ionicons
                                            name="business"
                                            size={24}
                                            color={editAccountType === 'bank' ? colors.primary : colors.textMuted}
                                        />
                                        <Text style={[
                                            styles.typeText,
                                            { color: colors.text },
                                            editAccountType === 'bank' && { color: colors.primary, fontWeight: '600' }
                                        ]}>
                                            Bank
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.typeButton,
                                            { backgroundColor: colors.surface, borderColor: colors.border },
                                            editAccountType === 'card' && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                        ]}
                                        onPress={() => setEditAccountType('card')}
                                    >
                                        <Ionicons
                                            name="card"
                                            size={24}
                                            color={editAccountType === 'card' ? colors.primary : colors.textMuted}
                                        />
                                        <Text style={[
                                            styles.typeText,
                                            { color: colors.text },
                                            editAccountType === 'card' && { color: colors.primary, fontWeight: '600' }
                                        ]}>
                                            Card
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Bank Icon (Optional)
                                </Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.iconPickerContainer}
                                    contentContainerStyle={styles.iconPickerContent}
                                >
                                    {BANK_ICON_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.key}
                                            style={[
                                                styles.iconOption,
                                                { borderColor: colors.border },
                                                (editAccountIcon === option.key || (!editAccountIcon && option.key === 'default')) &&
                                                { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
                                            ]}
                                            onPress={() => setEditAccountIcon(option.key === 'default' ? null : option.key)}
                                        >
                                            <Image
                                                source={option.icon}
                                                style={styles.iconOptionImage}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                                onPress={handleSaveEditAccount}
                            >
                                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                                <Text style={styles.submitButtonText}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Export Modal */}
            <Modal
                visible={showExportModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowExportModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Export Expenses
                            </Text>
                            <TouchableOpacity onPress={() => setShowExportModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Start Date
                                </Text>
                                <TouchableOpacity
                                    style={[styles.dateInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                                    onPress={() => setShowStartPicker(true)}
                                >
                                    <Ionicons name="calendar" size={20} color={colors.primary} />
                                    <Text style={[styles.dateText, { color: colors.text }]}>
                                        {formatDate(exportStartDate)}
                                    </Text>
                                </TouchableOpacity>
                                {showStartPicker && (
                                    <DateTimePicker
                                        value={exportStartDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, date) => {
                                            setShowStartPicker(false);
                                            if (date) setExportStartDate(date);
                                        }}
                                    />
                                )}
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    End Date
                                </Text>
                                <TouchableOpacity
                                    style={[styles.dateInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                                    onPress={() => setShowEndPicker(true)}
                                >
                                    <Ionicons name="calendar" size={20} color={colors.primary} />
                                    <Text style={[styles.dateText, { color: colors.text }]}>
                                        {formatDate(exportEndDate)}
                                    </Text>
                                </TouchableOpacity>
                                {showEndPicker && (
                                    <DateTimePicker
                                        value={exportEndDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, date) => {
                                            setShowEndPicker(false);
                                            if (date) setExportEndDate(date);
                                        }}
                                    />
                                )}
                            </View>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                                onPress={handleExport}
                                disabled={isExporting}
                            >
                                {isExporting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="download" size={20} color="#FFFFFF" />
                                        <Text style={styles.submitButtonText}>Export CSV</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Erase Data Modal */}
            <Modal
                visible={showEraseModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setShowEraseModal(false);
                    setDeleteConfirmText('');
                }}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.error }]}>
                                ⚠️ Erase All Data
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setShowEraseModal(false);
                                setDeleteConfirmText('');
                            }}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={[styles.warningBox, { backgroundColor: colors.error + '10' }]}>
                                <Ionicons name="warning" size={32} color={colors.error} />
                                <Text style={[styles.warningText, { color: colors.error }]}>
                                    This action cannot be undone!
                                </Text>
                            </View>

                            <Text style={[styles.eraseDescription, { color: colors.text }]}>
                                This will permanently delete:
                            </Text>
                            <View style={styles.deleteList}>
                                <Text style={[styles.deleteItem, { color: colors.textSecondary }]}>
                                    • All your accounts
                                </Text>
                                <Text style={[styles.deleteItem, { color: colors.textSecondary }]}>
                                    • All your expense records
                                </Text>
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Type DELETE to confirm
                                </Text>
                                <TextInput
                                    style={[styles.textInput, {
                                        backgroundColor: colors.surfaceVariant,
                                        borderColor: deleteConfirmText === 'DELETE' ? colors.error : colors.border,
                                        color: colors.text,
                                        textAlign: 'center',
                                        fontSize: 18,
                                        fontWeight: '600',
                                        letterSpacing: 2,
                                    }]}
                                    value={deleteConfirmText}
                                    onChangeText={setDeleteConfirmText}
                                    placeholder="DELETE"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { borderColor: colors.border }]}
                                onPress={() => {
                                    setShowEraseModal(false);
                                    setDeleteConfirmText('');
                                }}
                            >
                                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.eraseConfirmButton,
                                    { backgroundColor: deleteConfirmText === 'DELETE' ? colors.error : colors.textMuted }
                                ]}
                                onPress={handleEraseAllData}
                                disabled={deleteConfirmText !== 'DELETE' || isErasing}
                            >
                                {isErasing ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                                        <Text style={styles.eraseConfirmButtonText}>Erase All</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
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
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    accountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    accountIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    accountInfo: {
        flex: 1,
    },
    accountName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    accountType: {
        fontSize: 13,
    },
    accountActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editButton: {
        padding: 8,
    },
    deleteButton: {
        padding: 8,
    },
    bankLogo: {
        width: 40,
        height: 40,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    actionsSection: {
        marginTop: 24,
        gap: 16,
    },
    actionCard: {
        padding: 20,
        borderRadius: 16,
        gap: 12,
    },
    actionCardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dangerZone: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
    },
    dangerTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    dangerDescription: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 16,
    },
    eraseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    eraseButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalDismissArea: {
        flex: 1, // Takes up remaining space above modal for tap-to-dismiss
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        minHeight: '50%', // Ensure modal takes up enough space so inputs are above keyboard
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
        fontSize: 20,
        fontWeight: '600',
    },
    modalBody: {
        padding: 20,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
    },
    warningText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    eraseDescription: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 12,
    },
    deleteList: {
        marginBottom: 24,
    },
    deleteItem: {
        fontSize: 14,
        marginBottom: 6,
    },
    inputSection: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    textInput: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        fontSize: 16,
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '500',
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        gap: 10,
    },
    typeText: {
        fontSize: 15,
        fontWeight: '500',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        paddingBottom: 32,
        gap: 12,
    },
    submitButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        gap: 8,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    eraseConfirmButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        gap: 8,
    },
    eraseConfirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    iconPickerContainer: {
        marginTop: 8,
    },
    iconPickerContent: {
        paddingVertical: 8,
        gap: 12,
    },
    iconOption: {
        width: 56,
        height: 56,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    iconOptionImage: {
        width: 36,
        height: 36,
    },
});
