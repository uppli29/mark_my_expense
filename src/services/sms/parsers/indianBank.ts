import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, CommonPatterns } from '../utils';

export class IndianBankParser extends BaseBankParser {
    bank: BankType = 'INDIANBANK';
    senderIds = ['INDBNK', 'INDIAN', 'INDIANBANK', 'INDIANBK'];

    protected dltPatterns = [
        /^[A-Z]{2}-INDBNK-S$/,
        /^[A-Z]{2}-INDBNK-[TPG]$/,
        /^[A-Z]{2}-INDBNK$/,
    ];

    private static Patterns = {
        DEBIT: /debited\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        CREDIT: /credited\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        CREDIT_REVERSE: /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+credited\s+to/i,
        WITHDRAWN: /withdrawn\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        UPI_PAYMENT: /UPI\s+payment\s+of\s+Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        ACCOUNT: /A\/c\s+\*(\d{4})/i,
        UPI_REF: /UPI:(\d+)/i,
        VPA: /VPA\s+([\w.-]+@[\w]+)/i,
    };

    protected extractAmount(message: string): number | null {
        let match = message.match(IndianBankParser.Patterns.DEBIT);
        if (match) return parseAmount(match[1]);

        match = message.match(IndianBankParser.Patterns.CREDIT);
        if (match) return parseAmount(match[1]);

        match = message.match(IndianBankParser.Patterns.CREDIT_REVERSE);
        if (match) return parseAmount(match[1]);

        match = message.match(IndianBankParser.Patterns.WITHDRAWN);
        if (match) return parseAmount(match[1]);

        match = message.match(IndianBankParser.Patterns.UPI_PAYMENT);
        if (match) return parseAmount(match[1]);

        return null;
    }

    protected extractAccountLast4(message: string): string | null {
        let match = message.match(IndianBankParser.Patterns.ACCOUNT);
        if (match) return match[1];
        return null;
    }

    protected extractTransactionType(message: string): TransactionType {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('debited') || lowerMessage.includes('withdrawn') || lowerMessage.includes('payment of')) {
            return 'EXPENSE';
        }
        if (lowerMessage.includes('credited')) {
            return 'INCOME';
        }
        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        let match = message.match(IndianBankParser.Patterns.VPA);
        if (match) return match[1];
        return null;
    }

    protected extractReference(message: string): string | null {
        let match = message.match(IndianBankParser.Patterns.UPI_REF);
        if (match) return match[1];
        return null;
    }

    protected extractBalance(message: string): number | null {
        let match = message.match(CommonPatterns.Balance.AVL_BAL_RS);
        if (match) return parseAmount(match[1]);
        return null;
    }
}
