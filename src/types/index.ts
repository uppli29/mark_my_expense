// Types for the Expense Tracker App

export interface Account {
    id: number;
    name: string;
    type: 'bank' | 'card';
    icon: string | null;
    created_at: string;
}

export interface Expense {
    id: number;
    account_id: number;
    amount: number;
    category: string;
    description: string | null;
    date: string;
    created_at: string;
}

export interface ExpenseWithAccount extends Expense {
    account_name: string;
}

export interface CategorySummary {
    category: string;
    total: number;
    count: number;
}

export interface AccountSummary {
    account_id: number;
    account_name: string;
    total: number;
    transaction_count: number;
    icon: string | null;
}

// Form types
export interface ExpenseFormData {
    amount: string;
    category: string;
    account_id: number | null;
    date: Date;
    description: string;
}

export interface AccountFormData {
    name: string;
    type: 'bank' | 'card';
    icon: string | null;
}
