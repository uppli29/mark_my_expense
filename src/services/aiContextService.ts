import { expenseRepository } from '../database/repositories/expenseRepository';
import { CATEGORIES } from '../constants/categories';
import { formatCurrency, formatDate, getStartOfMonth, getStartOfWeek, getStartOfYear, getToday } from '../utils/dateUtils';

const formatCategoryName = (id: string) => {
    const match = CATEGORIES.find(cat => cat.id === id);
    return match ? match.name : id;
};

export type ChatContext = {
    monthSummary: { totalExpense: number; transactionCount: number };
    recentTransactions: string[];
    topCategories: { name: string; total: number; percentage: number }[];
    quickStats: { dailyAvg: number; largestExpense: number };
};

export const aiContextService = {
    /**
     * Gathers comprehensive financial context in parallel (mirrors PennyWise's AiContextRepository).
     */
    async gatherContext(): Promise<ChatContext> {
        const now = new Date();
        const monthStart = getStartOfMonth();
        const monthEnd = getToday();

        // 14-day window for recent transactions
        const recentStart = new Date(now);
        recentStart.setDate(recentStart.getDate() - 14);
        recentStart.setHours(0, 0, 0, 0);

        const [monthTotal, categorySummary, recentExpenses, largestExpense] = await Promise.all([
            expenseRepository.getTotalSpend(monthStart, monthEnd),
            expenseRepository.getCategorySummary(monthStart, monthEnd),
            expenseRepository.getRecent(20),
            this._getLargestExpense(monthStart, monthEnd),
        ]);

        // Transaction count this month
        const transactionCount = categorySummary.reduce((sum, cat) => sum + cat.count, 0);

        // Top 5 categories with percentage
        const topCategories = categorySummary.slice(0, 5).map(cat => ({
            name: formatCategoryName(cat.category),
            total: cat.total,
            percentage: monthTotal > 0 ? Math.round((cat.total / monthTotal) * 100) : 0,
        }));

        // Daily average
        const dayOfMonth = now.getDate();
        const dailyAvg = dayOfMonth > 0 ? monthTotal / dayOfMonth : 0;

        // Recent transactions formatted
        const recentTransactions = recentExpenses.map(item => {
            const categoryName = formatCategoryName(item.category);
            const label = item.description ? `${categoryName} - ${item.description}` : categoryName;
            return `${formatDate(item.date)}: ${label} ${formatCurrency(item.amount)} (${item.account_name})`;
        });

        return {
            monthSummary: { totalExpense: monthTotal, transactionCount },
            recentTransactions,
            topCategories,
            quickStats: { dailyAvg, largestExpense },
        };
    },

    /**
     * Build the full system prompt that gets injected at the start of a new chat session.
     */
    buildSystemPrompt(context: ChatContext): string {
        const { monthSummary, recentTransactions, topCategories, quickStats } = context;

        const catLines = topCategories.length
            ? topCategories.map(c => `  - ${c.name}: ${formatCurrency(c.total)} (${c.percentage}%)`).join('\n')
            : '  No expenses recorded this month.';

        const recentLines = recentTransactions.length
            ? recentTransactions.slice(0, 10).map(t => `  - ${t}`).join('\n')
            : '  No recent transactions.';

        return [
            'You are a friendly, helpful financial assistant for the Mark My Expense app.',
            'You help users understand and manage their personal spending.',
            'Keep responses concise, conversational, and easy to read.',
            'Do NOT use markdown formatting like headers, bold, or bullet points — use plain text.',
            'If the user asks something outside of finance, politely redirect them.',
            '',
            '--- FINANCIAL CONTEXT (current month) ---',
            `Total spent this month: ${formatCurrency(monthSummary.totalExpense)}`,
            `Number of transactions: ${monthSummary.transactionCount}`,
            `Daily average spending: ${formatCurrency(Math.round(quickStats.dailyAvg))}`,
            `Largest single expense: ${formatCurrency(quickStats.largestExpense)}`,
            '',
            'Top categories:',
            catLines,
            '',
            'Recent transactions:',
            recentLines,
            '--- END CONTEXT ---',
        ].join('\n');
    },

    /** Helper: get the largest single expense amount in a date range */
    async _getLargestExpense(start: Date, end: Date): Promise<number> {
        try {
            const results = await expenseRepository.executeRawQuery(
                `SELECT COALESCE(MAX(amount), 0) as max_amount FROM expenses WHERE date >= '${start.toISOString().split('T')[0]}' AND date <= '${end.toISOString().split('T')[0]}'`
            );
            return results?.[0]?.max_amount ?? 0;
        } catch {
            return 0;
        }
    },
};
