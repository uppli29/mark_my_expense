/**
 * SMS Listener Service
 * Handles SMS permissions, listening for incoming bank transaction messages,
 * and scanning SMS inbox for historical transaction messages
 */
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SmsAndroid from 'react-native-get-sms-android';
import { parseSMS, ParsedTransaction, getBankDisplayName } from './smsParser';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { accountRepository } from '../database/repositories/accountRepository';
import { getDatabase } from '../database/database';
import { notificationService } from './notificationService';

// Storage keys
const STORAGE_KEY_SCAN_DURATION = '@sms_scan_duration';

// SMS Permission status
export interface SMSPermissionStatus {
    hasReceiveSmsPermission: boolean;
    hasReadSmsPermission: boolean;
}

// Settings for SMS feature
export interface SMSSettings {
    enabled: boolean;
    showNotifications: boolean;
}

// SMS Scan Duration type
export type SMSScanDuration = '3months' | 'thisYear' | 'allTime';

// Scan result interface
export interface SMSScanResult {
    processed: number;
    skipped: number;
    errors: number;
}

// Default SMS settings
const DEFAULT_SMS_SETTINGS: SMSSettings = {
    enabled: false,
    showNotifications: true,
};

// In-memory settings
let smsSettings: SMSSettings = { ...DEFAULT_SMS_SETTINGS };
let isListening = false;
let hasRegisteredListener = false;
let processedHashes: Set<string> = new Set(); // In-memory cache for incoming SMS

/**
 * Check if current platform supports SMS reading
 */
export function isSMSSupported(): boolean {
    return Platform.OS === 'android';
}

/**
 * Check SMS permissions
 */
export async function checkSMSPermissions(): Promise<SMSPermissionStatus> {
    if (!isSMSSupported()) {
        return { hasReceiveSmsPermission: false, hasReadSmsPermission: false };
    }
    try {
        const hasReceiveSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
        const hasReadSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);

        return {
            hasReceiveSmsPermission: hasReceiveSms,
            hasReadSmsPermission: hasReadSms,
        };
    } catch (error) {
        console.error('Error checking SMS permissions:', error);
        return { hasReceiveSmsPermission: false, hasReadSmsPermission: false };
    }
}

/**
 * Request SMS permissions
 */
export async function requestSMSPermissions(): Promise<boolean> {
    if (!isSMSSupported()) {
        return false;
    }
    try {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);

        const hasReceiveSms = granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;
        const hasReadSms = granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;

        return hasReceiveSms && hasReadSms;
    } catch (error) {
        console.error('Error requesting SMS permissions:', error);
        return false;
    }
}

/**
 * Check if a message hash has been processed (in database)
 */
async function isHashProcessed(hash: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM processed_sms_hashes WHERE hash = ?',
            [hash]
        );
        return (result?.count || 0) > 0;
    } catch (error) {
        console.error('Error checking hash:', error);
        return false;
    }
}

/**
 * Mark a message hash as processed (in database)
 */
async function markHashProcessed(hash: string): Promise<void> {
    try {
        const db = await getDatabase();
        await db.runAsync(
            'INSERT OR IGNORE INTO processed_sms_hashes (hash, processed_at) VALUES (?, ?)',
            [hash, new Date().toISOString()]
        );
    } catch (error) {
        console.error('Error marking hash as processed:', error);
    }
}

/**
 * Find or create account for the bank
 */
async function findOrCreateAccount(
    bank: string,
    accountLast4: string | null
): Promise<number> {
    // Create account name based on bank and account number (without Auto prefix)
    const accountName = accountLast4
        ? `${bank} *${accountLast4}`
        : bank;

    // Try to find existing account by name
    const existingAccount = await accountRepository.getByName(accountName);
    if (existingAccount) {
        return existingAccount.id;
    }

    // Also check for legacy "Auto_" prefixed accounts and return those if found
    const legacyName = accountLast4
        ? `Auto_${bank}_${accountLast4}`
        : `Auto_${bank}`;
    const legacyAccount = await accountRepository.getByName(legacyName);
    if (legacyAccount) {
        return legacyAccount.id;
    }

    // Create new account
    const bankIconKey = bank.toLowerCase().replace(' bank', '').trim();
    const accountId = await accountRepository.create(accountName, 'bank', bankIconKey);
    console.log(`Created new account: ${accountName} with id ${accountId}`);
    return accountId;
}

/**
 * Create expense from parsed transaction
 */
async function createExpenseFromTransaction(
    transaction: ParsedTransaction,
    useDbForDuplicateCheck: boolean = false
): Promise<number | null> {
    try {
        // Only create expenses for debits
        if (!transaction.isDebit) {
            console.log('Skipping non-debit transaction');
            return null;
        }

        // Check if already processed
        if (useDbForDuplicateCheck) {
            // Use database for persistent duplicate check (for inbox scanning)
            const alreadyProcessed = await isHashProcessed(transaction.messageHash);
            if (alreadyProcessed) {
                console.log('Transaction already processed (DB):', transaction.messageHash);
                return null;
            }
            // Mark as processed in database
            await markHashProcessed(transaction.messageHash);
        } else {
            // Use in-memory set for real-time incoming SMS
            if (processedHashes.has(transaction.messageHash)) {
                console.log('Transaction already processed (memory):', transaction.messageHash);
                return null;
            }
            processedHashes.add(transaction.messageHash);
            // Also mark in database for persistence
            await markHashProcessed(transaction.messageHash);
        }

        // Find or create account
        const accountId = await findOrCreateAccount(
            getBankDisplayName(transaction.bank),
            transaction.accountLast4
        );

        // Create expense with "others" category and full SMS as description
        console.log('Persisting SMS:', transaction.rawMessage);
        const expenseId = await expenseRepository.create(
            accountId,
            transaction.amount,
            'others', // Default category
            new Date(transaction.timestamp),
            transaction.rawMessage // Full SMS body as description
        );

        console.log(`Created expense id ${expenseId} for ₹${transaction.amount} from ${transaction.bank}`);
        return expenseId;
    } catch (error) {
        console.error('Error creating expense from transaction:', error);
        return null;
    }
}

/**
 * Process incoming SMS message (real-time)
 */
async function processIncomingSMS(sender: string, message: string): Promise<void> {
    console.log('Processing SMS from:', sender);
    const transaction = parseSMS(sender, message, Date.now());
    if (!transaction) {
        console.log('Not a valid transaction SMS');
        return;
    }
    console.log('Parsed transaction:', {
        bank: transaction.bank,
        amount: transaction.amount,
        account: transaction.accountLast4,
        type: transaction.transactionType,
        merchant: transaction.merchant,
    });

    const expenseId = await createExpenseFromTransaction(transaction, false);

    // Show notification if enabled and expense was created
    if (expenseId && smsSettings.showNotifications) {
        await notificationService.showLocalNotification(
            'Expense Added',
            `₹${transaction.amount.toLocaleString('en-IN')} from ${getBankDisplayName(transaction.bank)} added to expenses`
        );
    }
}

/**
 * Get SMS scan duration setting
 */
export async function getScanDuration(): Promise<SMSScanDuration> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEY_SCAN_DURATION);
        if (value && ['3months', 'thisYear', 'allTime'].includes(value)) {
            return value as SMSScanDuration;
        }
        return '3months'; // Default
    } catch (error) {
        console.error('Error getting scan duration:', error);
        return '3months';
    }
}

/**
 * Set SMS scan duration setting
 */
export async function setScanDuration(duration: SMSScanDuration): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY_SCAN_DURATION, duration);
    } catch (error) {
        console.error('Error setting scan duration:', error);
    }
}

/**
 * Calculate the start date for SMS scanning based on duration setting
 */
function calculateScanStartDate(duration: SMSScanDuration): number {
    const now = new Date();

    switch (duration) {
        case '3months':
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return threeMonthsAgo.getTime();

        case 'thisYear':
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return startOfYear.getTime();

        case 'allTime':
            return 0; // No start date filter

        default:
            const defaultThreeMonths = new Date(now);
            defaultThreeMonths.setMonth(defaultThreeMonths.getMonth() - 3);
            return defaultThreeMonths.getTime();
    }
}

/**
 * Scan SMS inbox for transaction messages
 */
export async function scanSMSInbox(): Promise<SMSScanResult> {
    if (!isSMSSupported()) {
        console.log('SMS not supported on this platform');
        return { processed: 0, skipped: 0, errors: 0 };
    }

    // Check permissions
    const permissions = await checkSMSPermissions();
    if (!permissions.hasReadSmsPermission) {
        console.log('SMS read permission not granted');
        return { processed: 0, skipped: 0, errors: 0 };
    }

    // Get scan duration setting
    const scanDuration = await getScanDuration();
    const startDate = calculateScanStartDate(scanDuration);

    console.log(`Scanning SMS inbox with duration: ${scanDuration}, startDate: ${new Date(startDate).toISOString()}`);

    return new Promise((resolve) => {
        const filter: Record<string, unknown> = {
            box: 'inbox',
        };

        // Add date filter if not "allTime"
        if (startDate > 0) {
            filter.minDate = startDate;
        }

        SmsAndroid.list(
            JSON.stringify(filter),
            (error: string) => {
                console.error('Failed to read SMS inbox:', error);
                resolve({ processed: 0, skipped: 0, errors: 1 });
            },
            async (count: number, smsList: string) => {
                console.log(`Found ${count} SMS messages to scan`);

                let processed = 0;
                let skipped = 0;
                let errors = 0;

                try {
                    const messages = JSON.parse(smsList) as Array<{
                        address: string;
                        body: string;
                        date: string;
                    }>;

                    for (const sms of messages) {
                        try {
                            const sender = sms.address || '';
                            const body = sms.body || '';
                            const timestamp = parseInt(sms.date, 10) || Date.now();

                            // Parse the SMS
                            const transaction = parseSMS(sender, body, timestamp);

                            if (!transaction) {
                                // Not a bank transaction SMS
                                continue;
                            }

                            // Try to create expense (with database duplicate check)
                            const expenseId = await createExpenseFromTransaction(transaction, true);

                            if (expenseId) {
                                processed++;
                            } else {
                                skipped++;
                            }
                        } catch (smsError) {
                            console.error('Error processing SMS:', smsError);
                            errors++;
                        }
                    }
                } catch (parseError) {
                    console.error('Error parsing SMS list:', parseError);
                    errors++;
                }

                console.log(`SMS scan complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
                resolve({ processed, skipped, errors });
            }
        );
    });
}

/**
 * Start listening for SMS messages
 */
export async function startSMSListener(): Promise<boolean> {
    if (!isSMSSupported()) {
        console.log('SMS not supported on this platform');
        return false;
    }

    // If we already registered the listener, just enable processing
    if (hasRegisteredListener) {
        console.log('SMS listener already registered, resuming processing');
        isListening = true;
        return true;
    }

    // Check permissions before starting for the first time
    const permissions = await checkSMSPermissions();
    if (!permissions.hasReceiveSmsPermission || !permissions.hasReadSmsPermission) {
        console.log('SMS permissions not granted');
        return false;
    }

    try {
        const { startReadSMS } = await import('@maniac-tech/react-native-expo-read-sms');
        startReadSMS(
            // Success callback - called when SMS is received
            (status: string, sms: string, error: string | null) => {
                // If not listening, ignore incoming messages
                if (!isListening) return;

                if (error) {
                    console.error('SMS read error:', error);
                    return;
                }
                if (status === 'success' && sms) {
                    // The sms parameter is in format [sender, message]
                    try {
                        // Parse the SMS data - library returns as string "[sender, message]"
                        const smsData = sms.replace(/^\[|\]$/g, '').split(', ');
                        if (smsData.length >= 2) {
                            const sender = smsData[0];
                            const message = smsData.slice(1).join(', '); // Join back in case message had commas
                            processIncomingSMS(sender, message);
                        }
                    } catch (parseError) {
                        console.error('Error parsing SMS data:', parseError);
                    }
                }
            },
            // Error callback
            (status: string, sms: string, error: string) => {
                console.error('SMS listener error:', status, error);
            }
        );
        hasRegisteredListener = true;
        isListening = true;
        console.log('SMS listener started');
        return true;
    } catch (error) {
        console.error('Error starting SMS listener:', error);
        return false;
    }
}

/**
 * Stop listening for SMS messages
 */
export function stopSMSListener(): void {
    // Note: The library doesn't provide a stop method,
    // but we can flag that we're no longer interested in processing
    isListening = false;
    console.log('SMS listener stopped');
}

/**
 * Get current SMS settings
 */
export function getSMSSettings(): SMSSettings {
    return { ...smsSettings };
}

/**
 * Update SMS settings
 */
// Deprecated: SMS settings are now driven by permissions only
export async function updateSMSSettings(newSettings: Partial<SMSSettings>): Promise<void> {
    smsSettings = { ...smsSettings, ...newSettings };
    // No longer toggling listener here based on enabled flag
}

/**
 * Check if SMS listener is currently active
 */
export function isSMSListenerActive(): boolean {
    return isListening;
}

/**
 * Clear processed hashes (for testing/debugging)
 */
export function clearProcessedHashes(): void {
    processedHashes.clear();
}

/**
 * Initialize SMS service on app start
 */
export async function initSMSService(): Promise<void> {
    if (!isSMSSupported()) {
        console.log('SMS service not available on this platform');
        return;
    }

    // Check permissions on init
    const permissions = await checkSMSPermissions();
    if (permissions.hasReceiveSmsPermission && permissions.hasReadSmsPermission) {
        console.log('Permissions granted on init, starting SMS listener');
        await startSMSListener();
    } else {
        console.log('Permissions not granted on init, waiting for user action');
    }
}

// Export the service object for easier access
export const smsListenerService = {
    isSMSSupported,
    checkSMSPermissions,
    requestSMSPermissions,
    startSMSListener,
    stopSMSListener,
    getSMSSettings,
    updateSMSSettings,
    isSMSListenerActive,
    clearProcessedHashes,
    initSMSService,
    scanSMSInbox,
    getScanDuration,
    setScanDuration,
};