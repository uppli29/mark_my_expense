import * as SQLite from 'expo-sqlite';
import { CREATE_ACCOUNTS_TABLE, CREATE_EXPENSES_TABLE, CREATE_INDEXES, CREATE_BUDGETS_TABLE, CREATE_BUDGET_CATEGORIES_TABLE } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    if (db) return db;

    db = await SQLite.openDatabaseAsync('expense_tracker.db');
    return db;
};

export const initDatabase = async (): Promise<void> => {
    const database = await getDatabase();

    // Enable foreign keys
    await database.execAsync('PRAGMA foreign_keys = ON;');

    // Create tables
    await database.execAsync(CREATE_ACCOUNTS_TABLE);
    await database.execAsync(CREATE_EXPENSES_TABLE);

    // Create indexes (split into individual statements)
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);');

    // Migration: Add icon column if it doesn't exist
    try {
        await database.execAsync('ALTER TABLE accounts ADD COLUMN icon TEXT DEFAULT NULL;');
    } catch {
        // Column already exists, ignore error
    }

    // Create processed SMS hashes table for duplicate prevention
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS processed_sms_hashes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL UNIQUE,
            processed_at TEXT NOT NULL
        );
    `);
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_sms_hash ON processed_sms_hashes(hash);');

    // Create budget tables
    await database.execAsync(CREATE_BUDGETS_TABLE);
    await database.execAsync(CREATE_BUDGET_CATEGORIES_TABLE);

    console.log('Database initialized successfully');
};

export const clearAllData = async (): Promise<void> => {
    const database = await getDatabase();

    // Delete all data from tables (order matters due to foreign keys)
    await database.execAsync('DELETE FROM budget_categories;');
    await database.execAsync('DELETE FROM budgets;');
    await database.execAsync('DELETE FROM expenses;');
    await database.execAsync('DELETE FROM accounts;');
    await database.execAsync('DELETE FROM processed_sms_hashes;');

    // Reset auto-increment counters
    await database.execAsync("DELETE FROM sqlite_sequence WHERE name='expenses';");
    await database.execAsync("DELETE FROM sqlite_sequence WHERE name='accounts';");
    await database.execAsync("DELETE FROM sqlite_sequence WHERE name='processed_sms_hashes';");
    await database.execAsync("DELETE FROM sqlite_sequence WHERE name='budgets';");
    await database.execAsync("DELETE FROM sqlite_sequence WHERE name='budget_categories';");

    console.log('All data cleared successfully');
};

export const closeDatabase = async (): Promise<void> => {
    if (db) {
        await db.closeAsync();
        db = null;
    }
};
