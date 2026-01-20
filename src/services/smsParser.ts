/**
 * SMS Parser Service for Indian Bank Transaction Messages
 * Ported from Kotlin parsers for HDFC, ICICI, and SBI banks
 */

// Types for parsed transaction data
export type BankType = 'HDFC' | 'ICICI' | 'SBI' | 'CANARA' | 'UNKNOWN';

export type TransactionType = 'EXPENSE' | 'INCOME' | 'CREDIT' | 'TRANSFER' | 'UNKNOWN';

export interface ParsedTransaction {
    bank: BankType;
    amount: number;
    accountLast4: string | null;
    transactionType: TransactionType;
    merchant: string | null;
    reference: string | null;
    balance: number | null;
    isDebit: boolean;
    rawMessage: string;
    messageHash: string;
    sender: string;
    timestamp: number;
}

// Compiled regex patterns (ported from CompiledPatterns.kt)
const Patterns = {
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

// HDFC Bank patterns
const HDFCPatterns = {
    DLT_PATTERNS: [
        /^[A-Z]{2}-HDFCBK.*$/,
        /^[A-Z]{2}-HDFC.*$/,
        /^HDFC-[A-Z]+$/,
        /^[A-Z]{2}-HDFCB.*$/,
    ],
    SENDER_IDS: ['HDFCBK', 'HDFCBANK', 'HDFC', 'HDFCB'],
    VPA_WITH_NAME: /VPA\s+[^@\s]+@[^\s]+\s*\(([^)]+)\)/i,
    VPA_PATTERN: /VPA\s+([^@\s]+)@/i,
    INFO_PATTERN: /Info:\s*(?:UPI\/)?([^\/.\n]+?)(?:\/|$)/i,
    ACCOUNT_FROM: /from\s+(?:HDFC\s+Bank\s+)?A\/c\s+(?:XX+)?(\d+)/i,
    ACCOUNT_GENERIC: /A\/c\s+(?:XX+)?(\d+)/i,
};

// ICICI Bank patterns
const ICICIPatterns = {
    SENDER_PATTERNS: [
        /^[A-Z]{2}-ICICIB-S$/,
        /^[A-Z]{2}-ICICI-S$/,
        /^[A-Z]{2}-ICICIB-[TPG]$/,
        /^[A-Z]{2}-ICICIB$/,
        /^[A-Z]{2}-ICICI$/,
    ],
    SENDER_IDS: ['ICICIB', 'ICICIBANK', 'ICICI'],
    ACCT_PATTERN: /Acct\s+([X\*]*\d+)/i,
    BANK_ACCT_PATTERN: /ICICI\s+Bank\s+Acct\s+([X\*]*\d+)/i,
    BANK_CARD_PATTERN: /ICICI\s+Bank\s+Card\s+[X\*]*(\d+)/i,
};

// SBI Bank patterns
const SBIPatterns = {
    SENDER_PATTERNS: [
        /^[A-Z]{2}-SBIBK-S$/,
        /^[A-Z]{2}-SBIBK-[TPG]$/,
        /^[A-Z]{2}-SBIBK$/,
        /^[A-Z]{2}-SBI$/,
    ],
    SENDER_IDS: ['SBI', 'SBIINB', 'SBIUPI', 'SBICRD', 'ATMSBI', 'SBIBK', 'SBIBNK'],
    DEBIT_CARD_PATTERN: /by\s+SBI\s+Debit\s+Card\s+([\w\-]+)/i,
    TRF_PATTERN: /trf\s+to\s+([^.\n]+?)(?:\s+Ref|\s+ref|$)/i,
    TRANSFER_FROM_PATTERN: /transfer\s+from\s+([^.\n]+?)(?:\s+Ref|\s+ref|$)/i,
};

// Canara Bank patterns
const CanaraBankPatterns = {
    SENDER_IDS: ['CANBNK', 'CANARA'],
    UPI_AMOUNT_PATTERN: /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+paid/i,
    DEBIT_PATTERN: /INR\s+([\d,]+(?:\.\d{2})?)\s+has\s+been\s+DEBITED/i,
    UPI_MERCHANT_PATTERN: /\sto\s+([^,]+?)(?:,\s*UPI|\.|-Canara)/i,
    ACCOUNT_PATTERN: /(?:account|A\/C)\s+(?:XX|X\*+)?(\d{3,4})/i,
    BALANCE_PATTERN: /(?:Total\s+)?Avail\.?bal\s+INR\s+([\d,]+(?:\.\d{2})?)/i,
    UPI_REF_PATTERN: /UPI\s+Ref\s+(\d+)/i,
};


/**
 * Generate a hash from the message for duplicate detection
 */
export function generateMessageHash(message: string): string {
    // Simple hash function for message deduplication
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
 * Identify the bank from sender ID
 */
export function identifyBank(sender: string): BankType {
    const upperSender = sender.toUpperCase();

    // Check HDFC
    if (HDFCPatterns.SENDER_IDS.some(id => upperSender.includes(id)) ||
        HDFCPatterns.DLT_PATTERNS.some(pattern => pattern.test(upperSender))) {
        return 'HDFC';
    }

    // Check ICICI
    if (ICICIPatterns.SENDER_IDS.some(id => upperSender.includes(id)) ||
        ICICIPatterns.SENDER_PATTERNS.some(pattern => pattern.test(upperSender))) {
        return 'ICICI';
    }

    // Check SBI
    if (SBIPatterns.SENDER_IDS.some(id => upperSender.includes(id)) ||
        SBIPatterns.SENDER_PATTERNS.some(pattern => pattern.test(upperSender))) {
        return 'SBI';
    }

    // Check Canara Bank
    if (CanaraBankPatterns.SENDER_IDS.some(id => upperSender.includes(id))) {
        return 'CANARA';
    }

    return 'UNKNOWN';

}

/**
 * Check if an SMS is a transactional message (not promotional/OTP)
 */
export function isTransactionalSMS(sender: string, message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Skip OTP and promotional messages
    const skipKeywords = [
        'otp', 'one time password', 'verification code',
        'offer', 'discount', 'cashback offer', 'win ',
        'apply now', 'get up to', 'earn rewards',
        'e-statement', 'is due for', 'sbi card application',
        'bill alert', 'is due on', 'has requested',
        'payment request', 'collect request', 'ignore if already paid',
        'will be debited', // Future debit notifications
        'failed due to', // Canara Bank failed transactions
    ];


    if (skipKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return false;
    }

    // Skip E-Mandate/UPI-Mandate notifications
    if (lowerMessage.includes('e-mandate') ||
        lowerMessage.includes('upi-mandate') ||
        (lowerMessage.includes('mandate') && lowerMessage.includes('created'))) {
        return false;
    }

    // Transaction keywords that indicate an actual transaction
    const transactionKeywords = [
        'debited', 'credited', 'withdrawn', 'deposited',
        'spent', 'received', 'transferred', 'paid',
        'sent', 'deducted', 'txn',
        'paid thru', // Canara Bank UPI
        'has been debited', // Canara Bank debit
        'has been credited', // Canara Bank credit
    ];

    return transactionKeywords.some(keyword => lowerMessage.includes(keyword));

}

/**
 * Extract amount from SMS message
 */
export function extractAmount(message: string, bank: BankType): number | null {
    // Try bank-specific patterns first
    let match: RegExpMatchArray | null = null;

    if (bank === 'SBI') {
        // SBI specific patterns
        // Pattern: "debited by 20.0" (UPI format)
        const upiDebitPattern = /debited\s+by\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i;
        match = message.match(upiDebitPattern);
        if (match) return parseAmount(match[1]);

        // Pattern: "credited by Rs.500"
        const upiCreditPattern = /credited\s+by\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i;
        match = message.match(upiCreditPattern);
        if (match) return parseAmount(match[1]);
    }

    if (bank === 'CANARA') {
        // Canara Bank specific patterns
        // Pattern: "Rs.23.00 paid thru"
        match = message.match(CanaraBankPatterns.UPI_AMOUNT_PATTERN);
        if (match) return parseAmount(match[1]);

        // Pattern: "INR 50.00 has been DEBITED"
        match = message.match(CanaraBankPatterns.DEBIT_PATTERN);
        if (match) return parseAmount(match[1]);
    }


    if (bank === 'ICICI') {
        // ICICI multi-currency: "USD 11.80 spent"
        const multiCurrencyPattern = /[A-Z]{3}\s+([0-9,]+(?:\.\d{2})?)\s+spent/i;
        match = message.match(multiCurrencyPattern);
        if (match) return parseAmount(match[1]);

        // "debited with Rs xxx.00"
        const debitWithPattern = /debited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;
        match = message.match(debitWithPattern);
        if (match) return parseAmount(match[1]);

        // "debited for Rs xxx.00"
        const debitForPattern = /debited\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;
        match = message.match(debitForPattern);
        if (match) return parseAmount(match[1]);
    }

    // Generic amount patterns
    // Rs.500 spent
    const spentPattern = /Rs\.?\s*([0-9,]+(?:\.\d{2})?)\s+spent/i;
    match = message.match(spentPattern);
    if (match) return parseAmount(match[1]);

    // Rs 500 debited
    const rsDebitPattern = /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:has\s+been\s+)?debited/i;
    match = message.match(rsDebitPattern);
    if (match) return parseAmount(match[1]);

    // Rs 500 credited
    const rsCreditPattern = /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:has\s+been\s+)?credited/i;
    match = message.match(rsCreditPattern);
    if (match) return parseAmount(match[1]);

    // INR 500 debited/credited/spent
    const inrPattern = /INR\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s+(?:has\s+been\s+)?(?:debited|credited|spent)/i;
    match = message.match(inrPattern);
    if (match) return parseAmount(match[1]);

    // Try generic Rs pattern
    match = message.match(Patterns.Amount.RS_PATTERN);
    if (match) return parseAmount(match[1]);

    // Try INR pattern
    match = message.match(Patterns.Amount.INR_PATTERN);
    if (match) return parseAmount(match[1]);

    // Try rupee symbol
    match = message.match(Patterns.Amount.RUPEE_SYMBOL_PATTERN);
    if (match) return parseAmount(match[1]);

    return null;
}

/**
 * Helper to parse amount string to number
 */
function parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract account last 4 digits from SMS
 */
export function extractAccountLast4(message: string, bank: BankType): string | null {
    let match: RegExpMatchArray | null = null;

    if (bank === 'HDFC') {
        // Card x#### format
        const cardPattern = /Card\s+x(\d{4})/i;
        match = message.match(cardPattern);
        if (match) return match[1];

        // BLOCK DC ####
        const blockDCPattern = /BLOCK\s+DC\s+(\d{4})/i;
        match = message.match(blockDCPattern);
        if (match) return match[1];

        // HDFC Bank XXNNNN format
        const hdfcBankPattern = /HDFC\s+Bank\s+([X\*]*\d+)/i;
        match = message.match(hdfcBankPattern);
        if (match) {
            const digits = match[1].replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : digits;
        }

        // A/c patterns
        match = message.match(HDFCPatterns.ACCOUNT_FROM);
        if (match) {
            const accountStr = match[1];
            return accountStr.length >= 4 ? accountStr.slice(-4) : accountStr;
        }

        match = message.match(HDFCPatterns.ACCOUNT_GENERIC);
        if (match) {
            const accountStr = match[1];
            return accountStr.length >= 4 ? accountStr.slice(-4) : accountStr;
        }
    }

    if (bank === 'ICICI') {
        // ICICI Bank Card XXNNNN
        match = message.match(ICICIPatterns.BANK_CARD_PATTERN);
        if (match) {
            const cardNumber = match[1];
            return cardNumber.length >= 4 ? cardNumber.slice(-4) : cardNumber;
        }

        // ICICI Bank Acct XXNNNN
        match = message.match(ICICIPatterns.BANK_ACCT_PATTERN);
        if (match) {
            const digits = match[1].replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : digits;
        }

        // Acct XXNNNN
        match = message.match(ICICIPatterns.ACCT_PATTERN);
        if (match) {
            const digits = match[1].replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : digits;
        }
    }

    if (bank === 'SBI') {
        // by SBI Debit Card ####
        match = message.match(SBIPatterns.DEBIT_CARD_PATTERN);
        if (match) {
            const cardInfo = match[1];
            if (/^\d{4}$/.test(cardInfo)) return cardInfo;
            const digits = cardInfo.replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : cardInfo;
        }
    }

    if (bank === 'CANARA') {
        // Canara Bank account pattern: A/C XX1234
        match = message.match(CanaraBankPatterns.ACCOUNT_PATTERN);
        if (match) return match[1];
    }


    // Generic patterns
    match = message.match(Patterns.Account.AC_WITH_MASK);
    if (match) return match[1];

    match = message.match(Patterns.Account.CARD_WITH_MASK);
    if (match) return match[1];

    match = message.match(Patterns.Account.GENERIC_ACCOUNT);
    if (match) return match[1];

    return null;
}

/**
 * Extract transaction type from SMS
 */
export function extractTransactionType(message: string, bank: BankType): TransactionType {
    const lowerMessage = message.toLowerCase();

    // Credit card transactions
    if (bank === 'HDFC') {
        if (lowerMessage.includes('block cc') || lowerMessage.includes('block pcc')) {
            return 'CREDIT';
        }
        if (lowerMessage.includes('spent on card') && !lowerMessage.includes('block dc')) {
            return 'CREDIT';
        }
    }

    if (bank === 'ICICI') {
        if ((lowerMessage.includes('icici bank credit card') ||
            (lowerMessage.includes('icici bank card') && lowerMessage.includes('spent'))) &&
            (lowerMessage.includes('spent') || lowerMessage.includes('debited'))) {
            return 'CREDIT';
        }
    }

    if (bank === 'SBI') {
        if (lowerMessage.includes('sbi credit card') && lowerMessage.includes('spent')) {
            return 'CREDIT';
        }
    }

    // Expense keywords
    const expenseKeywords = [
        'debited', 'withdrawn', 'spent', 'charged',
        'paid', 'purchase', 'sent', 'deducted', 'transferred',
    ];
    if (expenseKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'EXPENSE';
    }

    // Income keywords
    const incomeKeywords = [
        'credited', 'deposited', 'received', 'refund', 'cashback',
    ];
    if (incomeKeywords.some(keyword => lowerMessage.includes(keyword))) {
        // Make sure it's not "earn cashback" which is promotional
        if (lowerMessage.includes('cashback') && lowerMessage.includes('earn cashback')) {
            return 'UNKNOWN';
        }
        return 'INCOME';
    }

    return 'UNKNOWN';
}

/**
 * Extract merchant name from SMS
 */
export function extractMerchant(message: string, bank: BankType): string | null {
    let match: RegExpMatchArray | null = null;

    if (bank === 'HDFC') {
        // Card transactions: "At MERCHANT On"
        if (message.toLowerCase().includes('from hdfc bank card') &&
            message.toLowerCase().includes(' at ') &&
            message.toLowerCase().includes(' on ')) {
            const atIndex = message.toLowerCase().indexOf(' at ');
            const onIndex = message.toLowerCase().indexOf(' on ');
            if (atIndex !== -1 && onIndex !== -1 && onIndex > atIndex) {
                const merchant = message.substring(atIndex + 4, onIndex).trim();
                if (merchant) return cleanMerchantName(merchant);
            }
        }

        // ATM withdrawals
        if (message.toLowerCase().includes('withdrawn')) {
            return 'ATM';
        }

        // VPA with name in parentheses
        match = message.match(HDFCPatterns.VPA_WITH_NAME);
        if (match) return cleanMerchantName(match[1]);

        // VPA pattern
        match = message.match(HDFCPatterns.VPA_PATTERN);
        if (match) {
            const vpaName = match[1].trim();
            if (vpaName.length > 3 && !/^\d+$/.test(vpaName)) {
                return cleanMerchantName(vpaName);
            }
        }

        // Info pattern
        match = message.match(HDFCPatterns.INFO_PATTERN);
        if (match && match[1].toLowerCase() !== 'upi') {
            return cleanMerchantName(match[1]);
        }
    }

    if (bank === 'ICICI') {
        // Salary transactions
        if (/Info\s+INF\*[^*]+\*[^*]*SAL[^.]*/i.test(message)) {
            return 'Salary';
        }

        // Card transactions: "on DD-Mon-YY at MERCHANT"
        const cardMerchantPattern = /on\s+\d{1,2}-\w{3}-\d{2}\s+(?:at|on)\s+([^.]+?)(?:\.|\s+Avl|$)/i;
        match = message.match(cardMerchantPattern);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        // AutoPay services
        if (message.toLowerCase().includes('autopay')) {
            const lowerMsg = message.toLowerCase();
            if (lowerMsg.includes('google play')) return 'Google Play Store';
            if (lowerMsg.includes('netflix')) return 'Netflix';
            if (lowerMsg.includes('spotify')) return 'Spotify';
            if (lowerMsg.includes('amazon prime')) return 'Amazon Prime';
            if (lowerMsg.includes('disney') || lowerMsg.includes('hotstar')) return 'Disney+ Hotstar';
            if (lowerMsg.includes('youtube')) return 'YouTube Premium';
            return 'AutoPay Subscription';
        }

        // Cash deposit
        if (message.toLowerCase().includes('info by cash')) {
            return 'Cash Deposit';
        }
    }

    if (bank === 'SBI') {
        // trf to Merchant
        match = message.match(SBIPatterns.TRF_PATTERN);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        // transfer from Sender
        match = message.match(SBIPatterns.TRANSFER_FROM_PATTERN);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        // UPI paid to merchant@upi
        const upiMerchantPattern = /paid\s+to\s+([\w.-]+)@[\w]+/i;
        match = message.match(upiMerchantPattern);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        // YONO Cash ATM
        const yonoAtmPattern = /w\/d@SBI\s+ATM\s+([A-Z0-9]+)/i;
        match = message.match(yonoAtmPattern);
        if (match) {
            return `YONO Cash ATM - ${match[1]}`;
        }
    }

    if (bank === 'CANARA') {
        // Canara Bank UPI merchant pattern: "paid thru A/C XX1234 on 08-8-25 16:41:00 to BMTC BUS KA57F6"
        match = message.match(CanaraBankPatterns.UPI_MERCHANT_PATTERN);
        if (match) {
            const merchant = cleanMerchantName(match[1].trim());
            if (isValidMerchantName(merchant)) {
                return merchant;
            }
        }

        // Check if it's a generic debit
        if (message.toLowerCase().includes('debited')) {
            return 'Canara Bank Debit';
        }
    }


    // Generic patterns
    match = message.match(Patterns.Merchant.TO_PATTERN);
    if (match) {
        const merchant = cleanMerchantName(match[1]);
        if (isValidMerchantName(merchant)) return merchant;
    }

    match = message.match(Patterns.Merchant.FROM_PATTERN);
    if (match) {
        const merchant = cleanMerchantName(match[1]);
        if (isValidMerchantName(merchant)) return merchant;
    }

    match = message.match(Patterns.Merchant.AT_PATTERN);
    if (match) {
        const merchant = cleanMerchantName(match[1]);
        if (isValidMerchantName(merchant)) return merchant;
    }

    return null;
}

/**
 * Extract reference number from SMS
 */
export function extractReference(message: string): string | null {
    let match: RegExpMatchArray | null = null;

    // Canara Bank UPI Ref pattern
    const canaraUpiRefPattern = /UPI\s+Ref\s+(\d+)/i;
    match = message.match(canaraUpiRefPattern);
    if (match) return match[1];

    // UPI Ref No

    const upiRefNoPattern = /UPI\s+Ref\s+No\s+(\d{12})/i;
    match = message.match(upiRefNoPattern);
    if (match) return match[1];

    // Generic ref patterns
    match = message.match(Patterns.Reference.GENERIC_REF);
    if (match) return match[1];

    match = message.match(Patterns.Reference.UPI_REF);
    if (match) return match[1];

    // Ref No. pattern
    const refNoPattern = /Ref\s+No\.?\s+([A-Z0-9]+)/i;
    match = message.match(refNoPattern);
    if (match) return match[1];

    return null;
}

/**
 * Extract available balance from SMS
 */
export function extractBalance(message: string): number | null {
    let match: RegExpMatchArray | null = null;

    // Canara Bank balance pattern: Total Avail.bal INR 1,092.62
    const canaraBalancePattern = /(?:Total\s+)?Avail\.?bal\s+INR\s+([\d,]+(?:\.\d{2})?)/i;
    match = message.match(canaraBalancePattern);
    if (match) return parseAmount(match[1]);

    // Avl bal:INR pattern

    const avlBalINRPattern = /Avl\s+bal:?\s*INR\s*([0-9,]+(?:\.\d{2})?)/i;
    match = message.match(avlBalINRPattern);
    if (match) return parseAmount(match[1]);

    // Available Balance: Rs pattern
    const availBalRsPattern = /Available\s+Balance:?\s*Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i;
    match = message.match(availBalRsPattern);
    if (match) return parseAmount(match[1]);

    // Generic balance patterns
    match = message.match(Patterns.Balance.AVL_BAL_RS);
    if (match) return parseAmount(match[1]);

    match = message.match(Patterns.Balance.AVL_BAL_INR);
    if (match) return parseAmount(match[1]);

    return null;
}

/**
 * Clean merchant name by removing common suffixes and extra info
 */
function cleanMerchantName(merchant: string): string {
    let cleaned = merchant.trim();

    // Remove trailing parentheses content
    cleaned = cleaned.replace(/\s*\(.*?\)\s*$/, '');

    // Remove Ref No suffix
    cleaned = cleaned.replace(/\s+Ref\s+No.*/i, '');

    // Remove date suffix
    cleaned = cleaned.replace(/\s+on\s+\d{2}.*/i, '');

    // Remove UPI suffix
    cleaned = cleaned.replace(/\s+UPI.*/i, '');

    // Remove PVT LTD, PRIVATE LIMITED, LTD, LIMITED
    cleaned = cleaned.replace(/\s+PVT\.?\s*LTD\.?|\s+PRIVATE\s+LIMITED/gi, '');
    cleaned = cleaned.replace(/\s+LTD\.?|\s+LIMITED/gi, '');

    // Remove trailing dash
    cleaned = cleaned.replace(/\s*-\s*$/, '');

    return cleaned.trim();
}

/**
 * Validate merchant name is meaningful
 */
function isValidMerchantName(merchant: string): boolean {
    if (!merchant || merchant.length < 2) return false;

    // Skip if all digits
    if (/^\d+$/.test(merchant)) return false;

    // Skip common invalid values
    const invalidNames = ['upi', 'neft', 'imps', 'rtgs', 'transfer'];
    if (invalidNames.includes(merchant.toLowerCase())) return false;

    return true;
}

/**
 * Get bank display name
 */
export function getBankDisplayName(bank: BankType): string {
    switch (bank) {
        case 'HDFC': return 'HDFC Bank';
        case 'ICICI': return 'ICICI Bank';
        case 'SBI': return 'State Bank of India';
        case 'CANARA': return 'Canara Bank';
        default: return 'Unknown Bank';
    }
}


/**
 * Main function to parse an SMS message
 */
export function parseSMS(sender: string, message: string, timestamp: number = Date.now()): ParsedTransaction | null {
    // Identify bank
    const bank = identifyBank(sender);
    if (bank === 'UNKNOWN') return null;

    // Check if transactional
    if (!isTransactionalSMS(sender, message)) return null;

    // Extract amount
    const amount = extractAmount(message, bank);
    if (!amount || amount <= 0) return null;

    // Extract transaction type
    const transactionType = extractTransactionType(message, bank);
    if (transactionType === 'UNKNOWN') return null;

    // Only process expenses (debits)
    // Skip income/credits as user wants expense tracking
    const isDebit = transactionType === 'EXPENSE' || transactionType === 'CREDIT';

    return {
        bank,
        amount,
        accountLast4: extractAccountLast4(message, bank),
        transactionType,
        merchant: extractMerchant(message, bank),
        reference: extractReference(message),
        balance: extractBalance(message),
        isDebit,
        rawMessage: message,
        messageHash: generateMessageHash(message),
        sender,
        timestamp,
    };
}
