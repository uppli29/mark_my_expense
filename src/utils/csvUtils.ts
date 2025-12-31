import { ExpenseWithAccount } from '../types';
import { CATEGORIES } from '../constants/categories';

export interface CSVExpenseRow {
    account: string;
    category: string;
    amount: number;
    date: string;
    description: string;
}

/**
 * Generate CSV string from expenses
 * @param expenses Array of expenses with account name
 * @returns CSV string with headers
 */
export const exportToCSV = (expenses: ExpenseWithAccount[]): string => {
    const headers = 'Account,Category,Amount,Date,Description';

    const rows = expenses.map(expense => {
        const category = CATEGORIES.find(c => c.id === expense.category)?.name || expense.category;
        // Escape double quotes and wrap fields that may contain commas
        const escapedDescription = (expense.description || '').replace(/"/g, '""');

        return [
            `"${expense.account_name}"`,
            `"${category}"`,
            expense.amount.toFixed(2),
            expense.date,
            `"${escapedDescription}"`
        ].join(',');
    });

    return [headers, ...rows].join('\n');
};

/**
 * Parse CSV content into expense rows
 * @param csvContent Raw CSV string
 * @returns Array of parsed expense rows
 * @throws Error if CSV format is invalid
 */
export const parseCSV = (csvContent: string): CSVExpenseRow[] => {
    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
    }

    // Validate header
    const header = lines[0].toLowerCase().replace(/"/g, '').trim();
    const expectedHeader = 'account,category,amount,date,description';
    if (header !== expectedHeader) {
        throw new Error(`Invalid CSV header. Expected: ${expectedHeader}`);
    }

    const rows: CSVExpenseRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const row = parseCSVLine(line);
            if (row.length < 5) {
                throw new Error(`Line ${i + 1}: Missing columns`);
            }

            const amount = parseFloat(row[2]);
            if (isNaN(amount) || amount < 0) {
                throw new Error(`Line ${i + 1}: Invalid amount "${row[2]}"`);
            }

            // Validate date format (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(row[3])) {
                throw new Error(`Line ${i + 1}: Invalid date format "${row[3]}". Expected YYYY-MM-DD`);
            }

            rows.push({
                account: row[0],
                category: row[1],
                amount,
                date: row[3],
                description: row[4] || ''
            });
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Line ${i + 1}: Parse error`);
        }
    }

    if (rows.length === 0) {
        throw new Error('No valid expense rows found in CSV');
    }

    return rows;
};

/**
 * Parse a single CSV line handling quoted fields
 */
const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
};

/**
 * Map category name from CSV to category ID
 * @param categoryName Display name from CSV
 * @returns Category ID or 'others' if not found
 */
export const mapCategoryNameToId = (categoryName: string): string => {
    const normalized = categoryName.toLowerCase().trim();

    // First try exact match by name
    const exactMatch = CATEGORIES.find(
        c => c.name.toLowerCase() === normalized
    );
    if (exactMatch) return exactMatch.id;

    // Then try by ID
    const idMatch = CATEGORIES.find(
        c => c.id.toLowerCase() === normalized
    );
    if (idMatch) return idMatch.id;

    // Default to 'others'
    return 'others';
};
