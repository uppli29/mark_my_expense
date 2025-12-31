import { getDatabase } from '../database';
import { Account, AccountSummary } from '../../types';
import { toSQLDate, getStartOfMonth, getEndOfMonth } from '../../utils/dateUtils';

export const accountRepository = {
    // Get all accounts
    async getAll(): Promise<Account[]> {
        const db = await getDatabase();
        const result = await db.getAllAsync<Account>(
            'SELECT * FROM accounts ORDER BY created_at DESC'
        );
        return result;
    },

    // Get account by ID
    async getById(id: number): Promise<Account | null> {
        const db = await getDatabase();
        const result = await db.getFirstAsync<Account>(
            'SELECT * FROM accounts WHERE id = ?',
            [id]
        );
        return result || null;
    },

    // Create new account
    async create(name: string, type: 'bank' | 'card' = 'bank'): Promise<number> {
        const db = await getDatabase();
        const result = await db.runAsync(
            'INSERT INTO accounts (name, type) VALUES (?, ?)',
            [name, type]
        );
        return result.lastInsertRowId;
    },

    // Update account
    async update(id: number, name: string, type: 'bank' | 'card'): Promise<void> {
        const db = await getDatabase();
        await db.runAsync(
            'UPDATE accounts SET name = ?, type = ? WHERE id = ?',
            [name, type, id]
        );
    },

    // Delete account
    async delete(id: number): Promise<void> {
        const db = await getDatabase();
        await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
    },

    // Get accounts with current month spend
    async getWithMonthlySpend(): Promise<AccountSummary[]> {
        const db = await getDatabase();
        const startDate = toSQLDate(getStartOfMonth());
        const endDate = toSQLDate(getEndOfMonth());

        const result = await db.getAllAsync<AccountSummary>(`
      SELECT 
        a.id as account_id,
        a.name as account_name,
        COALESCE(SUM(e.amount), 0) as total
      FROM accounts a
      LEFT JOIN expenses e ON a.id = e.account_id 
        AND e.date >= ? AND e.date <= ?
      GROUP BY a.id, a.name
      ORDER BY a.created_at DESC
    `, [startDate, endDate]);

        return result;
    },

    // Get account by name (case-insensitive)
    async getByName(name: string): Promise<Account | null> {
        const db = await getDatabase();
        const result = await db.getFirstAsync<Account>(
            'SELECT * FROM accounts WHERE LOWER(name) = LOWER(?)',
            [name]
        );
        return result || null;
    },
};
