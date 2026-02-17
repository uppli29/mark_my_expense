import { BankType, TransactionType, ParsedTransaction } from './types';
import { generateMessageHash, isTransactionalSMS } from './utils';

export interface IBankParser {
    bank: BankType;
    senderIds: string[];
    identify(sender: string): boolean;
    parse(sender: string, message: string, timestamp: number): ParsedTransaction | null;
}

export abstract class BaseBankParser implements IBankParser {
    abstract bank: BankType;
    abstract senderIds: string[];

    // Optional: DLT patterns for more robust identification
    protected dltPatterns: RegExp[] = [];

    identify(sender: string): boolean {
        const upperSender = sender.toUpperCase();
        return this.senderIds.some(id => upperSender.includes(id)) ||
            this.dltPatterns.some(pattern => pattern.test(upperSender));
    }

    parse(sender: string, message: string, timestamp: number): ParsedTransaction | null {
        if (!isTransactionalSMS(message)) {
            return null;
        }

        const amount = this.extractAmount(message);
        if (amount === null) return null;

        const transactionType = this.extractTransactionType(message);
        const isDebit = transactionType === 'EXPENSE' || transactionType === 'CREDIT';

        return {
            bank: this.bank,
            amount,
            accountLast4: this.extractAccountLast4(message),
            transactionType,
            merchant: this.extractMerchant(message),
            reference: this.extractReference(message),
            balance: this.extractBalance(message),
            isDebit,
            rawMessage: message,
            messageHash: generateMessageHash(message),
            sender,
            timestamp,
        };
    }

    protected abstract extractAmount(message: string): number | null;
    protected abstract extractAccountLast4(message: string): string | null;
    protected abstract extractTransactionType(message: string): TransactionType;
    protected abstract extractMerchant(message: string): string | null;
    protected abstract extractReference(message: string): string | null;
    protected abstract extractBalance(message: string): number | null;
}
