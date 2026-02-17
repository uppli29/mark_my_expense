import { getDatabase } from '../database';
import { Budget, BudgetCategory, BudgetCategoryProgress } from '../../types';
import { toSQLDate, getStartOfMonth, getStartOfYear, getToday } from '../../utils/dateUtils';

export const budgetRepository = {
    // Get all budgets
    async getAll(): Promise<Budget[]> {
        const db = await getDatabase();
        return db.getAllAsync<Budget>(
            'SELECT * FROM budgets ORDER BY created_at DESC'
        );
    },

    // Get budget by ID
    async getById(id: number): Promise<Budget | null> {
        const db = await getDatabase();
        const result = await db.getFirstAsync<Budget>(
            'SELECT * FROM budgets WHERE id = ?',
            [id]
        );
        return result || null;
    },

    // Create a new budget with its category limits
    async create(
        title: string,
        type: 'monthly' | 'yearly',
        categories: { category: string; limit: number }[]
    ): Promise<number> {
        const db = await getDatabase();

        const result = await db.runAsync(
            'INSERT INTO budgets (title, type) VALUES (?, ?)',
            [title, type]
        );
        const budgetId = result.lastInsertRowId;

        for (const cat of categories) {
            await db.runAsync(
                'INSERT INTO budget_categories (budget_id, category, budget_limit) VALUES (?, ?, ?)',
                [budgetId, cat.category, cat.limit]
            );
        }

        return budgetId;
    },

    // Update a budget and replace its category limits
    async update(
        id: number,
        title: string,
        type: 'monthly' | 'yearly',
        categories: { category: string; limit: number }[]
    ): Promise<void> {
        const db = await getDatabase();

        await db.runAsync(
            'UPDATE budgets SET title = ?, type = ? WHERE id = ?',
            [title, type, id]
        );

        // Replace all category limits
        await db.runAsync(
            'DELETE FROM budget_categories WHERE budget_id = ?',
            [id]
        );

        for (const cat of categories) {
            await db.runAsync(
                'INSERT INTO budget_categories (budget_id, category, budget_limit) VALUES (?, ?, ?)',
                [id, cat.category, cat.limit]
            );
        }
    },

    // Delete a budget (cascade deletes categories)
    async delete(id: number): Promise<void> {
        const db = await getDatabase();
        await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
    },

    // Get category limits for a budget
    async getCategoryLimits(budgetId: number): Promise<BudgetCategory[]> {
        const db = await getDatabase();
        return db.getAllAsync<BudgetCategory>(
            'SELECT * FROM budget_categories WHERE budget_id = ? ORDER BY category',
            [budgetId]
        );
    },

    // Get per-category progress (spent vs limit)
    async getProgress(budgetId: number): Promise<BudgetCategoryProgress[]> {
        const db = await getDatabase();

        // Get the budget to determine type
        const budget = await db.getFirstAsync<Budget>(
            'SELECT * FROM budgets WHERE id = ?',
            [budgetId]
        );
        if (!budget) return [];

        const startDate = budget.type === 'monthly'
            ? toSQLDate(getStartOfMonth())
            : toSQLDate(getStartOfYear());
        const endDate = toSQLDate(getToday());

        const result = await db.getAllAsync<BudgetCategoryProgress>(
            `SELECT 
                bc.category,
                bc.budget_limit,
                COALESCE(SUM(e.amount), 0) as spent
            FROM budget_categories bc
            LEFT JOIN expenses e 
                ON e.category = bc.category 
                AND e.date >= ? 
                AND e.date <= ?
            WHERE bc.budget_id = ?
            GROUP BY bc.category, bc.budget_limit
            ORDER BY bc.category`,
            [startDate, endDate, budgetId]
        );

        return result;
    },

    // Get total progress for a budget
    async getTotalProgress(budgetId: number): Promise<{ totalLimit: number; totalSpent: number }> {
        const db = await getDatabase();

        const budget = await db.getFirstAsync<Budget>(
            'SELECT * FROM budgets WHERE id = ?',
            [budgetId]
        );
        if (!budget) return { totalLimit: 0, totalSpent: 0 };

        const startDate = budget.type === 'monthly'
            ? toSQLDate(getStartOfMonth())
            : toSQLDate(getStartOfYear());
        const endDate = toSQLDate(getToday());

        const result = await db.getFirstAsync<{ totalLimit: number; totalSpent: number }>(
            `SELECT 
                COALESCE(SUM(bc.budget_limit), 0) as totalLimit,
                COALESCE(SUM(spent_amounts.spent), 0) as totalSpent
            FROM budget_categories bc
            LEFT JOIN (
                SELECT category, SUM(amount) as spent
                FROM expenses
                WHERE date >= ? AND date <= ?
                GROUP BY category
            ) spent_amounts ON spent_amounts.category = bc.category
            WHERE bc.budget_id = ?`,
            [startDate, endDate, budgetId]
        );

        return result || { totalLimit: 0, totalSpent: 0 };
    },
};
