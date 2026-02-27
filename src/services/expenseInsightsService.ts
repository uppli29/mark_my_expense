import { expenseRepository } from '../database/repositories/expenseRepository';
import { CATEGORIES } from '../constants/categories';
import { formatCurrency, formatDate, getStartOfMonth, getStartOfWeek, getStartOfYear, getToday } from '../utils/dateUtils';

type TimeRangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'year' | 'last7Days';

type DateRange = {
    key: TimeRangeKey;
    label: string;
    start: Date;
    end: Date;
};

const getStartOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getEndOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

const schema = [
    {
        "tableName": "accounts",
        "description": "Stores user financial accounts. Used as the primary source for expense tracking.",
        "columns": [
            { "name": "id", "type": "INTEGER", "description": "Primary key, auto-incrementing identifier." },
            { "name": "name", "type": "TEXT", "description": "The name of the bank or card." },
            { "name": "type", "type": "TEXT", "description": "Constraint: Must be 'bank' or 'card'. Defaults to 'bank'." },
            { "name": "icon", "type": "TEXT", "description": "String identifier for UI icons. Nullable." },
            { "name": "created_at", "type": "DATETIME", "description": "Automated timestamp of record creation." }
        ],
        "relationships": []
    },
    {
        "tableName": "expenses",
        "description": "Records transaction data. Indexed by date, account, and category for performance.",
        "columns": [
            { "name": "id", "type": "INTEGER", "description": "Primary key, auto-incrementing identifier." },
            { "name": "account_id", "type": "INTEGER", "description": "Foreign key linking to accounts.id. Deletes on cascade." },
            { "name": "amount", "type": "REAL", "description": "The numeric cost of the expense." },
            { "name": "category", "type": "TEXT", "description": "The classification string (e.g., 'Food', 'Transport')." },
            { "name": "description", "type": "TEXT", "description": "User notes about the transaction." },
            { "name": "date", "type": "DATE", "description": "The calendar date of the transaction." },
            { "name": "created_at", "type": "DATETIME", "description": "Automated timestamp." }
        ],
        "relationships": [
            {
                "columnName": "account_id",
                "relationshipTable": "accounts",
                "relationshipColumn": "id"
            }
        ]
    },
    {
        "tableName": "budgets",
        "description": "High-level budget containers defining timeframes.",
        "columns": [
            { "name": "id", "type": "INTEGER", "description": "Primary key, auto-incrementing identifier." },
            { "name": "title", "type": "TEXT", "description": "The display name of the budget." },
            { "name": "type", "type": "TEXT", "description": "Constraint: Must be 'monthly', 'yearly', or 'one_time'." },
            { "name": "reference_month", "type": "TEXT", "description": "Optional string for month-specific filtering (e.g., '2024-05')." },
            { "name": "created_at", "type": "DATETIME", "description": "Automated timestamp." }
        ],
        "relationships": []
    },
    {
        "tableName": "budget_categories",
        "description": "Specific spending limits tied to a budget and a category name.",
        "columns": [
            { "name": "id", "type": "INTEGER", "description": "Primary key, auto-incrementing identifier." },
            { "name": "budget_id", "type": "INTEGER", "description": "Foreign key linking to budgets.id. Deletes on cascade." },
            { "name": "category", "type": "TEXT", "description": "The category name this limit applies to." },
            { "name": "budget_limit", "type": "REAL", "description": "The maximum allowed spend for this category." }
        ],
        "relationships": [
            {
                "columnName": "budget_id",
                "relationshipTable": "budgets",
                "relationshipColumn": "id"
            }
        ]
    }
]

const getLastMonthRange = (): { start: Date; end: Date } => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const getRangeByKey = (key: TimeRangeKey): DateRange => {
    const today = new Date();
    const end = getToday();

    switch (key) {
        case 'today':
            return { key, label: 'today', start: getStartOfDay(today), end: getEndOfDay(today) };
        case 'yesterday': {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            return { key, label: 'yesterday', start: getStartOfDay(y), end: getEndOfDay(y) };
        }
        case 'week':
            return { key, label: 'this week', start: getStartOfWeek(), end };
        case 'month':
            return { key, label: 'this month', start: getStartOfMonth(), end };
        case 'lastMonth': {
            const { start, end: lastEnd } = getLastMonthRange();
            return { key, label: 'last month', start, end: lastEnd };
        }
        case 'year':
            return { key, label: 'this year', start: getStartOfYear(), end };
        case 'last7Days': {
            const start = new Date();
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            return { key, label: 'last 7 days', start, end };
        }
        default:
            return { key: 'month', label: 'this month', start: getStartOfMonth(), end };
    }
};

const detectRangeFromQuestion = (question: string): DateRange => {
    const q = question.toLowerCase();

    if (q.includes('today')) return getRangeByKey('today');
    if (q.includes('yesterday')) return getRangeByKey('yesterday');
    if (q.includes('last 7') || q.includes('last seven')) return getRangeByKey('last7Days');
    if (q.includes('last month') || q.includes('previous month')) return getRangeByKey('lastMonth');
    if (q.includes('this month') || q.includes('month')) return getRangeByKey('month');
    if (q.includes('this week') || q.includes('week')) return getRangeByKey('week');
    if (q.includes('this year') || q.includes('year')) return getRangeByKey('year');

    return getRangeByKey('month');
};

const detectCategoryFromQuestion = (question: string) => {
    const q = question.toLowerCase();
    const category = CATEGORIES.find(cat => q.includes(cat.name.toLowerCase()) || q.includes(cat.id));
    return category || null;
};

const formatCategoryName = (id: string) => {
    const match = CATEGORIES.find(cat => cat.id === id);
    return match ? match.name : id;
};

const formatCategoryList = (items: { category: string; total: number; count: number }[]) => {
    return items
        .slice(0, 3)
        .map(item => `${formatCategoryName(item.category)} (${formatCurrency(item.total)})`)
        .join(', ');
};

export const expenseInsightsService = {
    async buildPromptContext(): Promise<string> {
        const weekRange = getRangeByKey('week');
        const monthRange = getRangeByKey('month');
        const yearRange = getRangeByKey('year');

        const [weekTotal, monthTotal, yearTotal, topCategories, recent] = await Promise.all([
            expenseRepository.getTotalSpend(weekRange.start, weekRange.end),
            expenseRepository.getTotalSpend(monthRange.start, monthRange.end),
            expenseRepository.getTotalSpend(yearRange.start, yearRange.end),
            expenseRepository.getCategorySummary(monthRange.start, monthRange.end),
            expenseRepository.getRecent(5),
        ]);

        const recentLines = recent.map(item => {
            const categoryName = formatCategoryName(item.category);
            const label = item.description ? `${categoryName} - ${item.description}` : categoryName;
            return `${formatDate(item.date)}: ${label} ${formatCurrency(item.amount)} (${item.account_name})`;
        });

        return [
            `Totals: this week ${formatCurrency(weekTotal)}, this month ${formatCurrency(monthTotal)}, this year ${formatCurrency(yearTotal)}.`,
            `Top categories this month: ${topCategories.length ? formatCategoryList(topCategories) : 'No expenses yet.'}`,
            `Recent expenses: ${recentLines.length ? recentLines.join(' | ') : 'No recent expenses.'}`,
        ].join('\n');
    },

    generateSqlPrompt(question: string): string {
        const todayStr = getToday().toISOString().split('T')[0];
        return [
            '### ROLE',
            'You are an expert SQLite developer. Your only job is to generate a valid SQLite query based on a provided schema to answer a user question.',
            '',
            '### DATABASE SCHEMA',
            'Use the following JSON schema to understand table structures, column types, and relationships:',
            JSON.stringify(schema, null, 2),
            '',
            '### GUIDELINES',
            '1. Output ONLY the SQLite query wrapped in ```sql ... ``` block.',
            '2. Do not explain your query. Output no other text.',
            '3. Assume standard SQLite functions (e.g., strftime for dates).',
            `4. Today's date is ${todayStr}. Use this for relative date queries.`,
            '',
            '### USER INPUT',
            `User question: ${question}`,
            '',
            '### RESPONSE'
        ].join('\n');
    },

    generateAnswerPrompt(question: string, dbResultsContext: string): string {
        return [
            '### ROLE',
            'You are a local, offline data assistant for an expense tracking app. You help users analyze their financial data.',
            '',
            '### GUIDELINES',
            '1. Use the provided data context (which contains results from a database query) to answer the user question.',
            '2. Provide a helpful, concise, natural language answer.',
            '3. Do not mention SQL queries, the database schema, or technical details directly in your answer.',
            '4. If no data is available in the context, inform the user properly.',
            '',
            '### DATA CONTEXT (Current Query Results)',
            dbResultsContext,
            '',
            '### USER INPUT',
            `User question: ${question}`,
            '',
            '### RESPONSE'
        ].join('\n');
    },

    async answerWithRules(question: string): Promise<string> {
        const q = question.toLowerCase();
        const range = detectRangeFromQuestion(question);
        const category = detectCategoryFromQuestion(question);

        const [total, categorySummary, recent] = await Promise.all([
            expenseRepository.getTotalSpend(range.start, range.end),
            expenseRepository.getCategorySummary(range.start, range.end),
            expenseRepository.getRecent(5),
        ]);

        if (q.includes('top') || q.includes('category')) {
            if (!categorySummary.length) {
                return `No expenses found for ${range.label}.`;
            }
            const topList = formatCategoryList(categorySummary);
            return `Top categories for ${range.label}: ${topList}.`;
        }

        if (category) {
            const match = categorySummary.find(item => item.category === category.id || item.category === category.name);
            if (!match) {
                return `No ${category.name} expenses found for ${range.label}.`;
            }
            return `${category.name} spending for ${range.label} is ${formatCurrency(match.total)} across ${match.count} expenses.`;
        }

        if (q.includes('recent') || q.includes('latest')) {
            if (!recent.length) return 'No recent expenses found.';
            const list = recent.map(item => {
                const categoryName = formatCategoryName(item.category);
                const label = item.description ? `${categoryName} - ${item.description}` : categoryName;
                return `${formatDate(item.date)}: ${label} ${formatCurrency(item.amount)}`;
            });
            return `Recent expenses: ${list.join(' | ')}.`;
        }

        if (q.includes('total') || q.includes('spent') || q.includes('spend')) {
            return `Total spending for ${range.label} is ${formatCurrency(total)}.`;
        }

        return [
            `Total spending for ${range.label} is ${formatCurrency(total)}.`,
            categorySummary.length ? `Top categories: ${formatCategoryList(categorySummary)}.` : 'No category data yet.',
            recent.length ? `Recent expenses: ${recent.map(item => `${formatCategoryName(item.category)} ${formatCurrency(item.amount)}`).join(', ')}.` : '',
        ].filter(Boolean).join(' ');
    },
};
