import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, cleanMerchantName, isValidMerchantName, CommonPatterns } from '../utils';

export class ICICIParser extends BaseBankParser {
    bank: BankType = 'ICICI';
    senderIds = ['ICICIB', 'ICICIBANK', 'ICICI'];

    protected dltPatterns = [
        /^[A-Z]{2}-ICICIB-S$/,
        /^[A-Z]{2}-ICICI-S$/,
        /^[A-Z]{2}-ICICIB-[TPG]$/,
        /^[A-Z]{2}-ICICIB$/,
        /^[A-Z]{2}-ICICI$/,
    ];

    private static Patterns = {
        ACCT_PATTERN: /Acct\s+([X\*]*\d+)/i,
        BANK_ACCT_PATTERN: /ICICI\s+Bank\s+Acct\s+([X\*]*\d+)/i,
        BANK_CARD_PATTERN: /ICICI\s+Bank\s+Card\s+[X\*]*(\d+)/i,
        MULTI_CURRENCY: /[A-Z]{3}\s+([0-9,]+(?:\.\d{2})?)\s+spent/i,
        DEBIT_WITH: /debited\s+with\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
        DEBIT_FOR: /debited\s+for\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
        CARD_MERCHANT: /on\s+\d{1,2}-\w{3}-\d{2}\s+(?:at|on)\s+([^.]+?)(?:\.|\s+Avl|$)/i,
        SALARY: /Info\s+INF\*[^*]+\*[^*]*SAL[^.]*/i,
    };

    protected extractAmount(message: string): number | null {
        let match = message.match(ICICIParser.Patterns.MULTI_CURRENCY);
        if (match) return parseAmount(match[1]);

        match = message.match(ICICIParser.Patterns.DEBIT_WITH);
        if (match) return parseAmount(match[1]);

        match = message.match(ICICIParser.Patterns.DEBIT_FOR);
        if (match) return parseAmount(match[1]);

        match = message.match(CommonPatterns.Amount.RS_PATTERN);
        if (match) return parseAmount(match[1]);

        return null;
    }

    protected extractAccountLast4(message: string): string | null {
        let match = message.match(ICICIParser.Patterns.BANK_CARD_PATTERN);
        if (match) {
            const cardNumber = match[1];
            return cardNumber.length >= 4 ? cardNumber.slice(-4) : cardNumber;
        }

        match = message.match(ICICIParser.Patterns.BANK_ACCT_PATTERN);
        if (match) {
            const digits = match[1].replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : digits;
        }

        match = message.match(ICICIParser.Patterns.ACCT_PATTERN);
        if (match) {
            const digits = match[1].replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : digits;
        }

        return null;
    }

    protected extractTransactionType(message: string): TransactionType {
        const lowerMessage = message.toLowerCase();
        if ((lowerMessage.includes('icici bank credit card') ||
            (lowerMessage.includes('icici bank card') && lowerMessage.includes('spent'))) &&
            (lowerMessage.includes('spent') || lowerMessage.includes('debited'))) {
            return 'CREDIT';
        }

        if (lowerMessage.includes('debited') || lowerMessage.includes('spent')) {
            return 'EXPENSE';
        }
        if (lowerMessage.includes('credited')) {
            return 'INCOME';
        }

        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        if (ICICIParser.Patterns.SALARY.test(message)) {
            return 'Salary';
        }

        let match = message.match(ICICIParser.Patterns.CARD_MERCHANT);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('autopay')) {
            if (lowerMsg.includes('google play')) return 'Google Play Store';
            if (lowerMsg.includes('netflix')) return 'Netflix';
            if (lowerMsg.includes('spotify')) return 'Spotify';
            if (lowerMsg.includes('amazon prime')) return 'Amazon Prime';
            if (lowerMsg.includes('disney') || lowerMsg.includes('hotstar')) return 'Disney+ Hotstar';
            if (lowerMsg.includes('youtube')) return 'YouTube Premium';
            return 'AutoPay Subscription';
        }

        if (lowerMsg.includes('info by cash')) {
            return 'Cash Deposit';
        }

        return null;
    }

    protected extractReference(message: string): string | null {
        let match = message.match(CommonPatterns.Reference.GENERIC_REF);
        if (match) return match[1];
        return null;
    }

    protected extractBalance(message: string): number | null {
        let match = message.match(CommonPatterns.Balance.AVL_BAL_INR);
        if (match) return parseAmount(match[1]);
        return null;
    }
}
