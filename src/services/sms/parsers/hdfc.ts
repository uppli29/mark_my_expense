import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, cleanMerchantName, CommonPatterns } from '../utils';

export class HDFCParser extends BaseBankParser {
    bank: BankType = 'HDFC';
    senderIds = ['HDFCBK', 'HDFCBANK', 'HDFC', 'HDFCB'];

    protected dltPatterns = [
        /^[A-Z]{2}-HDFCBK.*$/,
        /^[A-Z]{2}-HDFC.*$/,
        /^HDFC-[A-Z]+$/,
        /^[A-Z]{2}-HDFCB.*$/,
    ];

    private static Patterns = {
        VPA_WITH_NAME: /VPA\s+[^@\s]+@[^\s]+\s*\(([^)]+)\)/i,
        VPA_PATTERN: /VPA\s+([^@\s]+)@/i,
        INFO_PATTERN: /Info:\s*(?:UPI\/)?([^\/.\n]+?)(?:\/|$)/i,
        ACCOUNT_FROM: /from\s+(?:HDFC\s+Bank\s+)?A\/c\s+(?:XX+)?(\d+)/i,
        ACCOUNT_GENERIC: /A\/c\s+(?:XX+)?(\d+)/i,
        CARD_PATTERN: /Card\s+x(\d{4})/i,
        BLOCK_DC_PATTERN: /BLOCK\s+DC\s+(\d{4})/i,
        HDFC_BANK_GENERIC: /HDFC\s+Bank\s+([X\*]*\d+)/i,
    };

    protected extractAmount(message: string): number | null {
        // Generic amount patterns work for HDFC
        let match = message.match(CommonPatterns.Amount.RS_PATTERN);
        if (match) return parseAmount(match[1]);

        match = message.match(CommonPatterns.Amount.INR_PATTERN);
        if (match) return parseAmount(match[1]);

        return null;
    }

    protected extractAccountLast4(message: string): string | null {
        let match = message.match(HDFCParser.Patterns.CARD_PATTERN);
        if (match) return match[1];

        match = message.match(HDFCParser.Patterns.BLOCK_DC_PATTERN);
        if (match) return match[1];

        match = message.match(HDFCParser.Patterns.HDFC_BANK_GENERIC);
        if (match) {
            const digits = match[1].replace(/[^\d]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : digits;
        }

        match = message.match(HDFCParser.Patterns.ACCOUNT_FROM);
        if (match) {
            const accountStr = match[1];
            return accountStr.length >= 4 ? accountStr.slice(-4) : accountStr;
        }

        match = message.match(HDFCParser.Patterns.ACCOUNT_GENERIC);
        if (match) {
            const accountStr = match[1];
            return accountStr.length >= 4 ? accountStr.slice(-4) : accountStr;
        }

        return null;
    }

    protected extractTransactionType(message: string): TransactionType {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('block cc') || lowerMessage.includes('block pcc')) {
            return 'CREDIT';
        }
        if (lowerMessage.includes('spent on card') && !lowerMessage.includes('block dc')) {
            return 'CREDIT';
        }

        if (lowerMessage.includes('debited') || lowerMessage.includes('withdrawn')) {
            return 'EXPENSE';
        }
        if (lowerMessage.includes('credited')) {
            return 'INCOME';
        }

        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('from hdfc bank card') &&
            lowerMsg.includes(' at ') &&
            lowerMsg.includes(' on ')) {
            const atIndex = lowerMsg.indexOf(' at ');
            const onIndex = lowerMsg.indexOf(' on ');
            if (atIndex !== -1 && onIndex !== -1 && onIndex > atIndex) {
                const merchant = message.substring(atIndex + 4, onIndex).trim();
                if (merchant) return cleanMerchantName(merchant);
            }
        }

        if (lowerMsg.includes('withdrawn')) {
            return 'ATM';
        }

        let match = message.match(HDFCParser.Patterns.VPA_WITH_NAME);
        if (match) return cleanMerchantName(match[1]);

        match = message.match(HDFCParser.Patterns.VPA_PATTERN);
        if (match) {
            const vpaName = match[1].trim();
            if (vpaName.length > 3 && !/^\d+$/.test(vpaName)) {
                return cleanMerchantName(vpaName);
            }
        }

        match = message.match(HDFCParser.Patterns.INFO_PATTERN);
        if (match && match[1].toLowerCase() !== 'upi') {
            return cleanMerchantName(match[1]);
        }

        return null;
    }

    protected extractReference(message: string): string | null {
        let match = message.match(CommonPatterns.Reference.GENERIC_REF);
        if (match) return match[1];
        return null;
    }

    protected extractBalance(message: string): number | null {
        let match = message.match(CommonPatterns.Balance.AVL_BAL_RS);
        if (match) return parseAmount(match[1]);
        return null;
    }
}
