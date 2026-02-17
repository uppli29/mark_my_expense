export type BankType = 'HDFC' | 'ICICI' | 'SBI' | 'CANARA' | 'IOB' | 'INDIANBANK' | 'UNKNOWN';

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
