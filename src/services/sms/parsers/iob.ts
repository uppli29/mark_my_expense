import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, CommonPatterns } from '../utils';

export class IOBParser extends BaseBankParser {
    bank: BankType = 'IOB';
    senderIds = ['IOB', 'IOBCHN'];

    protected dltPatterns = [
        /^[A-Z]{2}-IOBCHN.*$/,
        /^[A-Z]{2}-IOB.*$/,
    ];

    private static Patterns = {
        AMOUNT_CREDITED: /credited\s+by\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
        AMOUNT_DEBITED: /debited\s+by\s+Rs\.?\s*([0-9,]+(?:\.\d{2})?)/i,
        ACCOUNT: /a\/c\s+no\.\s+[X]*(\d{2,4})/i,
        UPI_REF: /\(UPI\s+Ref\s+no\s+(\d+)\)/i,
        UPI_PAYER: /from\s+([^(]+?)(?:\(UPI|$)/i,
    };

    protected extractAmount(message: string): number | null {
        let match = message.match(IOBParser.Patterns.AMOUNT_CREDITED);
        if (match) return parseAmount(match[1]);

        match = message.match(IOBParser.Patterns.AMOUNT_DEBITED);
        if (match) return parseAmount(match[1]);

        return null;
    }

    protected extractAccountLast4(message: string): string | null {
        let match = message.match(IOBParser.Patterns.ACCOUNT);
        if (match) return match[1];
        return null;
    }

    protected extractTransactionType(message: string): TransactionType {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('debited')) {
            return 'EXPENSE';
        }
        if (lowerMessage.includes('credited')) {
            return 'INCOME';
        }
        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        let match = message.match(IOBParser.Patterns.UPI_PAYER);
        if (match) return match[1].trim();
        return null;
    }

    protected extractReference(message: string): string | null {
        let match = message.match(IOBParser.Patterns.UPI_REF);
        if (match) return match[1];
        return null;
    }

    protected extractBalance(message: string): number | null {
        let match = message.match(CommonPatterns.Balance.AVL_BAL_RS);
        if (match) return parseAmount(match[1]);
        return null;
    }
}
