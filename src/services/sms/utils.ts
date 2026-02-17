import { TransactionType } from './types';

// Compiled regex patterns (ported from CompiledPatterns.kt)
export const CommonPatterns = {
    Amount: {
        RS_PATTERN: /Rs\.?\s*([0-9,]+(?:\.\d{1,2})?)/i,
        INR_PATTERN: /INR\s*([0-9,]+(?:\.\d{1,2})?)/i,
        RUPEE_SYMBOL_PATTERN: /₹\s*([0-9,]+(?:\.\d{1,2})?)/,
    },
    Account: {
        AC_WITH_MASK: /(?:A\/c|Account|Acct)(?:\s+No)?\.?\s+(?:XX+)?(\d{4})/i,
        CARD_WITH_MASK: /Card\s+(?:XX+)?(\d{4})/i,
        GENERIC_ACCOUNT: /(?:A\/c|Account).*?(\d{4})(?:\s|$)/i,
    },
    Balance: {
        AVL_BAL_RS: /(?:Bal|Balance|Avl Bal|Available Balance)[:\s]+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
        AVL_BAL_INR: /(?:Bal|Balance|Avl Bal|Available Balance)[:\s]+INR\s*([0-9,]+(?:\.\d{2})?)/i,
    },
    Reference: {
        GENERIC_REF: /(?:Ref|Reference|Txn|Transaction)(?:\s+No)?[:\s]+([A-Z0-9]+)/i,
        UPI_REF: /UPI[:\s]+([0-9]+)/i,
    },
    Merchant: {
        TO_PATTERN: /to\s+([^.\n]+?)(?:\s+on|\s+at|\s+Ref|\s+UPI)/i,
        FROM_PATTERN: /from\s+([^.\n]+?)(?:\s+on|\s+at|\s+Ref|\s+UPI)/i,
        AT_PATTERN: /at\s+([^.\n]+?)(?:\s+on|\s+Ref)/i,
    },
};

/**
 * Generate a hash from the message for duplicate detection
 */
export function generateMessageHash(message: string): string {
    let hash = 0;
    const str = message.trim().toLowerCase();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Helper to parse amount string to number
 */
export function parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Clean merchant name by removing common suffixes and extra info
 */
export function cleanMerchantName(merchant: string): string {
    let cleaned = merchant.trim();
    cleaned = cleaned.replace(/\s*\(.*?\)\s*$/, '');
    cleaned = cleaned.replace(/\s+Ref\s+No.*/i, '');
    cleaned = cleaned.replace(/\s+on\s+\d{2}.*/i, '');
    cleaned = cleaned.replace(/\s+UPI.*/i, '');
    cleaned = cleaned.replace(/\s+PVT\.?\s*LTD\.?|\s+PRIVATE\s+LIMITED/gi, '');
    cleaned = cleaned.replace(/\s+LTD\.?|\s+LIMITED/gi, '');
    cleaned = cleaned.replace(/\s*-\s*$/, '');
    return cleaned.trim();
}

/**
 * Validate merchant name is meaningful
 */
export function isValidMerchantName(merchant: string): boolean {
    if (!merchant || merchant.length < 2) return false;
    if (/^\d+$/.test(merchant)) return false;
    const invalidNames = ['upi', 'neft', 'imps', 'rtgs', 'transfer'];
    if (invalidNames.includes(merchant.toLowerCase())) return false;
    return true;
}

/**
 * Check if an SMS is a transactional message (not promotional/OTP)
 */
export function isTransactionalSMS(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    const skipKeywords = [
        'otp', 'one time password', 'verification code',
        'offer', 'discount', 'cashback offer', 'win ',
        'apply now', 'get up to', 'earn rewards',
        'e-statement', 'is due for', 'sbi card application',
        'bill alert', 'is due on', 'has requested',
        'payment request', 'collect request', 'ignore if already paid',
        'will be debited',
        'failed due to',
    ];

    if (skipKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return false;
    }

    if (lowerMessage.includes('e-mandate') ||
        lowerMessage.includes('upi-mandate') ||
        (lowerMessage.includes('mandate') && lowerMessage.includes('created'))) {
        return false;
    }

    const transactionKeywords = [
        'debited', 'credited', 'withdrawn', 'deposited',
        'spent', 'received', 'transferred', 'paid',
        'sent', 'deducted', 'txn',
        'paid thru',
        'has been debited',
        'has been credited',
    ];

    return transactionKeywords.some(keyword => lowerMessage.includes(keyword));
}

export function genericExtractTransactionType(message: string): TransactionType {
    const lowerMessage = message.toLowerCase();

    const expenseKeywords = [
        'debited', 'withdrawn', 'spent', 'charged',
        'paid', 'purchase', 'sent', 'deducted', 'transferred',
    ];
    if (expenseKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'EXPENSE';
    }

    const incomeKeywords = [
        'credited', 'deposited', 'received', 'refund', 'cashback',
    ];
    if (incomeKeywords.some(keyword => lowerMessage.includes(keyword))) {
        if (lowerMessage.includes('cashback') && lowerMessage.includes('earn cashback')) {
            return 'UNKNOWN';
        }
        return 'INCOME';
    }

    return 'UNKNOWN';
}
