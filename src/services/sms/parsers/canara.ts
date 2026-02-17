import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, cleanMerchantName, isValidMerchantName, CommonPatterns } from '../utils';

export class CanaraParser extends BaseBankParser {
    bank: BankType = 'CANARA';
    senderIds = ['CANBNK', 'CANARA'];

    private static Patterns = {
        UPI_AMOUNT: /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+paid/i,
        DEBIT_PATTERN: /INR\s+([\d,]+(?:\.\d{2})?)\s+has\s+been\s+DEBITED/i,
        UPI_MERCHANT: /\sto\s+([^,]+?)(?:,\s*UPI|\.|-Canara)/i,
        ACCOUNT: /(?:account|A\/C)\s+(?:X+)(\d{3,4})(?:\s|$)/i,
        BALANCE: /(?:Total\s+)?Avail\.?bal\s+INR\s+([\d,]+(?:\.\d{2})?)/i,
        UPI_REF: /UPI\s+Ref\s+(\d+)/i,
    };

    protected extractAmount(message: string): number | null {
        let match = message.match(CanaraParser.Patterns.UPI_AMOUNT);
        if (match) return parseAmount(match[1]);

        match = message.match(CanaraParser.Patterns.DEBIT_PATTERN);
        if (match) return parseAmount(match[1]);

        match = message.match(CommonPatterns.Amount.RS_PATTERN);
        if (match) return parseAmount(match[1]);

        return null;
    }

    protected extractAccountLast4(message: string): string | null {
        let match = message.match(CanaraParser.Patterns.ACCOUNT);
        if (match) {
            const accountDigits = match[1];
            return accountDigits.length >= 4 ? accountDigits.slice(-3) : accountDigits;
        }
        return null;
    }

    protected extractTransactionType(message: string): TransactionType {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('debited') || lowerMessage.includes('paid')) {
            return 'EXPENSE';
        }
        if (lowerMessage.includes('credited')) {
            return 'INCOME';
        }
        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        let match = message.match(CanaraParser.Patterns.UPI_MERCHANT);
        if (match) {
            const merchant = cleanMerchantName(match[1].trim());
            if (isValidMerchantName(merchant)) return merchant;
        }

        if (message.toLowerCase().includes('debited')) {
            return 'Canara Bank Debit';
        }

        return null;
    }

    protected extractReference(message: string): string | null {
        let match = message.match(CanaraParser.Patterns.UPI_REF);
        if (match) return match[1];
        return null;
    }

    protected extractBalance(message: string): number | null {
        let match = message.match(CanaraParser.Patterns.BALANCE);
        if (match) return parseAmount(match[1]);
        return null;
    }
}
