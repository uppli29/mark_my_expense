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
    if (!csvContent.trim()) {
        throw new Error('CSV file is empty');
    }

    const rows: CSVExpenseRow[] = [];
    const result: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvContent.length) {
        const char = csvContent[i];
        const nextChar = csvContent[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (!inQuotes) {
            if (char === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentField.trim());
                if (currentRow.length > 0) {
                    result.push(currentRow);
                }
                currentRow = [];
                currentField = '';
                if (char === '\r') i++; // Skip \r in \r\n
            } else {
                currentField += char;
            }
        } else {
            currentField += char;
        }
        i++;
    }

    // Push the last field/row if any
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        result.push(currentRow);
    }

    if (result.length < 2) {
        throw new Error('CSV file has no data rows');
    }

    // Validate header
    const header = result[0].map(h => h.toLowerCase().replace(/"/g, '').trim()).join(',');
    const expectedHeader = 'account,category,amount,date,description';
    if (header !== expectedHeader) {
        throw new Error(`Invalid CSV header. Expected: ${expectedHeader}`);
    }

    for (let j = 1; j < result.length; j++) {
        const row = result[j];
        if (row.length === 1 && row[0] === '') continue; // Skip empty lines

        if (row.length < 5) {
            throw new Error(`Line ${j + 1}: Missing columns (Expected 5, got ${row.length})`);
        }

        const amount = parseFloat(row[2]);
        if (isNaN(amount) || amount < 0) {
            throw new Error(`Line ${j + 1}: Invalid amount "${row[2]}"`);
        }

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row[3])) {
            throw new Error(`Line ${j + 1}: Invalid date format "${row[3]}". Expected YYYY-MM-DD`);
        }

        rows.push({
            account: row[0],
            category: row[1],
            amount,
            date: row[3],
            description: row[4] || ''
        });
    }

    if (rows.length === 0) {
        throw new Error('No valid expense rows found in CSV');
    }

    return rows;
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
