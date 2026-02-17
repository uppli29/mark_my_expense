import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, cleanMerchantName, isValidMerchantName, CommonPatterns } from '../utils';

export class SBIParser extends BaseBankParser {
    bank: BankType = 'SBI';
    senderIds = ['SBI', 'SBIINB', 'SBIUPI', 'SBICRD', 'ATMSBI', 'SBIBK', 'SBIBNK'];

    protected dltPatterns = [
        /^[A-Z]{2}-SBIBK-S$/,
        /^[A-Z]{2}-SBIBK-[TPG]$/,
        /^[A-Z]{2}-SBIBK$/,
        /^[A-Z]{2}-SBI$/,
    ];

    private static Patterns = {
        DEBIT_CARD: /by\s+SBI\s+Debit\s+Card\s+([\w\-]+)/i,
        TRF_PATTERN: /trf\s+to\s+([^.\n]+?)(?:\s+Ref|\s+ref|$)/i,
        TRANSFER_FROM: /transfer\s+from\s+([^.\n]+?)(?:\s+Ref|\s+ref|$)/i,
        UPI_DEBIT: /debited\s+by\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i,
        UPI_CREDIT: /credited\s+by\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i,
        UPI_PAID_TO: /paid\s+to\s+([\w.-]+)@[\w]+/i,
        YONO_ATM: /w\/d@SBI\s+ATM\s+([A-Z0-9]+)/i,
    };

    protected extractAmount(message: string): number | null {
        let match = message.match(SBIParser.Patterns.UPI_DEBIT);
        if (match) return parseAmount(match[1]);

        match = message.match(SBIParser.Patterns.UPI_CREDIT);
        if (match) return parseAmount(match[1]);

        match = message.match(CommonPatterns.Amount.RS_PATTERN);
        if (match) return parseAmount(match[1]);

        return null;
    }

    protected extractAccountLast4(message: string): string | null {
        let match = message.match(SBIParser.Patterns.DEBIT_CARD);
        if (match) {
            const cardInfo = match[1];
            if (/^\d{4}$/.test(cardInfo)) return cardInfo;
            const digits = cardInfo.replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : cardInfo;
        }

        match = message.match(CommonPatterns.Account.AC_WITH_MASK);
        if (match) return match[1];

        return null;
    }

    protected extractTransactionType(message: string): TransactionType {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('sbi credit card') && lowerMessage.includes('spent')) {
            return 'CREDIT';
        }

        if (lowerMessage.includes('debited') || lowerMessage.includes('spent') || lowerMessage.includes('paid')) {
            return 'EXPENSE';
        }
        if (lowerMessage.includes('credited')) {
            return 'INCOME';
        }

        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        let match = message.match(SBIParser.Patterns.TRF_PATTERN);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        match = message.match(SBIParser.Patterns.TRANSFER_FROM);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        match = message.match(SBIParser.Patterns.UPI_PAID_TO);
        if (match) {
            const merchant = cleanMerchantName(match[1]);
            if (isValidMerchantName(merchant)) return merchant;
        }

        match = message.match(SBIParser.Patterns.YONO_ATM);
        if (match) {
            return `YONO Cash ATM - ${match[1]}`;
        }

        return null;
    }

    protected extractReference(message: string): string | null {
        let match = message.match(CommonPatterns.Reference.UPI_REF);
        if (match) return match[1];

        match = message.match(CommonPatterns.Reference.GENERIC_REF);
        if (match) return match[1];

        return null;
    }

    protected extractBalance(message: string): number | null {
        let match = message.match(CommonPatterns.Balance.AVL_BAL_RS);
        if (match) return parseAmount(match[1]);
        return null;
    }
}
