/**
 * SMS Sync Service
 * Handles SMS permissions and scanning SMS inbox for transaction messages.
 * Note: Real-time SMS listening has been removed to ensure build stability.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SmsAndroid from 'react-native-get-sms-android';
import { parseSMS, ParsedTransaction, getBankDisplayName } from './smsParser';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { accountRepository } from '../database/repositories/accountRepository';
import { getDatabase } from '../database/database';

// Storage keys
const STORAGE_KEY_SCAN_DURATION = '@sms_scan_duration';
const STORAGE_KEY_LAST_AUTO_SCAN = '@sms_last_auto_scan';

// SMS Permission status
export interface SMSPermissionStatus {
    hasReadSmsPermission: boolean;
}

// Settings for SMS feature
export interface SMSSettings {
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
        return { hasReadSmsPermission: false };
    }
    try {
        const hasReadSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);

        return {
            hasReadSmsPermission: hasReadSms,
        };
    } catch (error) {
        console.error('Error checking SMS permissions:', error);
        return { hasReadSmsPermission: false };
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
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
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
    // Create account name based on bank and account number
    const accountName = accountLast4
        ? `${bank} *${accountLast4}`
        : bank;

    // Try to find existing account by name
    const existingAccount = await accountRepository.getByName(accountName);
    if (existingAccount) {
        return existingAccount.id;
    }

    // Also check for legacy "Auto_" prefixed accounts
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
    transaction: ParsedTransaction
): Promise<number | null> {
    try {
        // Only create expenses for debits
        if (!transaction.isDebit) {
            return null;
        }

        // Persistent duplicate check
        const alreadyProcessed = await isHashProcessed(transaction.messageHash);
        if (alreadyProcessed) {
            return null;
        }

        // Find or create account
        const accountId = await findOrCreateAccount(
            getBankDisplayName(transaction.bank),
            transaction.accountLast4
        );

        // Create expense with "others" category and full SMS as description
        const expenseId = await expenseRepository.create(
            accountId,
            transaction.amount,
            'others', // Default category
            new Date(transaction.timestamp),
            transaction.rawMessage // Full SMS body as description
        );

        // Mark as processed in database
        await markHashProcessed(transaction.messageHash);

        console.log(`Created expense id ${expenseId} for ₹${transaction.amount} from ${transaction.bank}`);
        return expenseId;
    } catch (error) {
        console.error('Error creating expense from transaction:', error);
        return null;
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

                            // Try to create expense
                            const expenseId = await createExpenseFromTransaction(transaction);

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
 * [Deprecated] Real-time SMS listener is no longer supported
 */
export async function startSMSListener(): Promise<boolean> {
    console.log('startSMSListener is deprecated and does nothing.');
    return false;
}

/**
 * [Deprecated] Real-time SMS listener is no longer supported
 */
export function stopSMSListener(): void {
    console.log('stopSMSListener is deprecated and does nothing.');
}

/**
 * [Deprecated] Listener active check
 */
export function isSMSListenerActive(): boolean {
    return false;
}

/**
 * Get current SMS settings
 */
export function getSMSSettings(): SMSSettings {
    return { showNotifications: true };
}

/**
 * Initialize SMS service on app start
 */
export async function initSMSService(): Promise<void> {
    console.log('SMS service initialized (manual scan mode).');
}

// Export the service object for easier access
export const smsListenerService = {
    isSMSSupported,
    checkSMSPermissions,
    requestSMSPermissions,
    startSMSListener,
    stopSMSListener,
    getSMSSettings,
    isSMSListenerActive,
    initSMSService,
    scanSMSInbox,
    getScanDuration,
    setScanDuration,
    scanSMSForToday,
    autoScanAndNotify,
    shouldPerformAutoScan,
};

/**
 * Scan SMS inbox for today's transaction messages
 */
export async function scanSMSForToday(): Promise<SMSScanResult> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

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

    console.log(`Scanning SMS inbox for today: ${new Date(startOfToday).toISOString()}`);

    return new Promise((resolve) => {
        const filter = {
            box: 'inbox',
            minDate: startOfToday,
        };

        SmsAndroid.list(
            JSON.stringify(filter),
            (error: string) => {
                console.error('Failed to read SMS inbox:', error);
                resolve({ processed: 0, skipped: 0, errors: 1 });
            },
            async (count: number, smsList: string) => {
                console.log(`Found ${count} SMS messages for today`);

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

                            const transaction = parseSMS(sender, body, timestamp);
                            if (!transaction) continue;

                            const expenseId = await createExpenseFromTransaction(transaction);
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

                resolve({ processed, skipped, errors });
            }
        );
    });
}

/**
 * Perform auto-scan and notify user
 */
export async function autoScanAndNotify(): Promise<void> {
    // Import notificationService dynamically to avoid circular dependency
    const { notificationService } = require('./notificationService');

    const permissions = await checkSMSPermissions();

    if (!permissions.hasReadSmsPermission) {
        await notificationService.showLocalNotification(
            '💰 Track Your Expenses',
            "Don't forget to log today's expenses! Stay on top of your finances."
        );
        return;
    }

    const result = await scanSMSForToday();

    if (result.processed > 0) {
        await notificationService.showLocalNotification(
            '✅ Expenses Added Automatically',
            `Scanned your messages and added ${result.processed} new ${result.processed === 1 ? 'expense' : 'expenses'} for today. Tap to review!`
        );
    } else {
        await notificationService.showLocalNotification(
            '💰 Track Your Expenses',
            "Don't forget to log today's expenses! Stay on top of your finances."
        );
    }

    // Mark as scanned for today
    try {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_AUTO_SCAN, new Date().toDateString());
    } catch (error) {
        console.error('Error saving last auto scan date:', error);
    }
}

/**
 * Check if auto-scan should be performed (after 9 PM and not yet scanned today)
 */
export async function shouldPerformAutoScan(): Promise<boolean> {
    try {
        const now = new Date();
        const currentHour = now.getHours();

        // Only scan after 9 PM
        if (currentHour < 21) {
            return false;
        }

        const lastScanDate = await AsyncStorage.getItem(STORAGE_KEY_LAST_AUTO_SCAN);
        const todayStr = now.toDateString();

        return lastScanDate !== todayStr;
    } catch (error) {
        return false;
    }
}
