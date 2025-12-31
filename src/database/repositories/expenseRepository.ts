import { getDatabase } from '../database';
import { Expense, ExpenseWithAccount, CategorySummary } from '../../types';
import { toSQLDate } from '../../utils/dateUtils';

export const expenseRepository = {
    // Get all expenses with account name
    async getAll(): Promise<ExpenseWithAccount[]> {
        const db = await getDatabase();
        const result = await db.getAllAsync<ExpenseWithAccount>(`
      SELECT e.*, a.name as account_name
      FROM expenses e
      JOIN accounts a ON e.account_id = a.id
      ORDER BY e.date DESC, e.created_at DESC
    `);
        return result;
    },

    // Get expenses by date range
    async getByDateRange(
        startDate: Date,
        endDate: Date,
        accountId?: number
    ): Promise<ExpenseWithAccount[]> {
        const db = await getDatabase();
        const start = toSQLDate(startDate);
        const end = toSQLDate(endDate);

        let query = `
      SELECT e.*, a.name as account_name
      FROM expenses e
      JOIN accounts a ON e.account_id = a.id
      WHERE e.date >= ? AND e.date <= ?
    `;
        const params: (string | number)[] = [start, end];

        if (accountId) {
            query += ' AND e.account_id = ?';
            params.push(accountId);
        }

        query += ' ORDER BY e.date DESC, e.created_at DESC';

        const result = await db.getAllAsync<ExpenseWithAccount>(query, params);
        return result;
    },

    // Get expense by ID
    async getById(id: number): Promise<ExpenseWithAccount | null> {
        const db = await getDatabase();
        const result = await db.getFirstAsync<ExpenseWithAccount>(`
      SELECT e.*, a.name as account_name
      FROM expenses e
      JOIN accounts a ON e.account_id = a.id
      WHERE e.id = ?
    `, [id]);
        return result || null;
    },

    // Create new expense
    async create(
        accountId: number,
        amount: number,
        category: string,
        date: Date,
        description?: string
    ): Promise<number> {
        const db = await getDatabase();
        const result = await db.runAsync(
            `INSERT INTO expenses (account_id, amount, category, date, description) 
       VALUES (?, ?, ?, ?, ?)`,
            [accountId, amount, category, toSQLDate(date), description || null]
        );
        return result.lastInsertRowId;
    },

    // Update expense
    async update(
        id: number,
        accountId: number,
        amount: number,
        category: string,
        date: Date,
        description?: string
    ): Promise<void> {
        const db = await getDatabase();
        await db.runAsync(
            `UPDATE expenses 
       SET account_id = ?, amount = ?, category = ?, date = ?, description = ?
       WHERE id = ?`,
            [accountId, amount, category, toSQLDate(date), description || null, id]
        );
    },

    // Delete expense
    async delete(id: number): Promise<void> {
        const db = await getDatabase();
        await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    },

    // Get category summary for date range
    async getCategorySummary(
        startDate: Date,
        endDate: Date,
        accountId?: number
    ): Promise<CategorySummary[]> {
        const db = await getDatabase();
        const start = toSQLDate(startDate);
        const end = toSQLDate(endDate);

        let query = `
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses
      WHERE date >= ? AND date <= ?
    `;
        const params: (string | number)[] = [start, end];

        if (accountId) {
            query += ' AND account_id = ?';
            params.push(accountId);
        }

        query += ' GROUP BY category ORDER BY total DESC';

        const result = await db.getAllAsync<CategorySummary>(query, params);
        return result;
    },

    // Get total spend for date range
    async getTotalSpend(
        startDate: Date,
        endDate: Date,
        accountId?: number
    ): Promise<number> {
        const db = await getDatabase();
        const start = toSQLDate(startDate);
        const end = toSQLDate(endDate);

        let query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date >= ? AND date <= ?
    `;
        const params: (string | number)[] = [start, end];

        if (accountId) {
            query += ' AND account_id = ?';
            params.push(accountId);
        }

        const result = await db.getFirstAsync<{ total: number }>(query, params);
        return result?.total || 0;
    },

    // Get recent expenses (last n)
    async getRecent(limit: number = 10): Promise<ExpenseWithAccount[]> {
        const db = await getDatabase();
        const result = await db.getAllAsync<ExpenseWithAccount>(`
      SELECT e.*, a.name as account_name
      FROM expenses e
      JOIN accounts a ON e.account_id = a.id
      ORDER BY e.date DESC, e.created_at DESC
      LIMIT ?
    `, [limit]);
        return result;
    },

    // Bulk create expenses (for CSV import)
    async bulkCreate(
        expenses: Array<{
            accountId: number;
            amount: number;
            category: string;
            date: string; // Already in SQL format YYYY-MM-DD
            description?: string;
        }>
    ): Promise<number> {
        const db = await getDatabase();
        let insertedCount = 0;

        for (const expense of expenses) {
            await db.runAsync(
                `INSERT INTO expenses (account_id, amount, category, date, description) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    expense.accountId,
                    expense.amount,
                    expense.category,
                    expense.date,
                    expense.description || null
                ]
            );
            insertedCount++;
        }

        return insertedCount;
    },
};
