// Date utility functions

export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

export const formatDateShort = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });
};

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const toSQLDate = (date: Date): string => {
    // Use local date parts instead of UTC to avoid timezone discrepancies
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const fromSQLDate = (dateStr: string): Date => {
    return new Date(dateStr);
};

export const getStartOfWeek = (): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

export const getStartOfMonth = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getStartOfYear = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
};

export const getEndOfMonth = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

export const getLast7Days = (): Date => {
    const now = new Date();
    now.setDate(now.getDate() - 7);
    now.setHours(0, 0, 0, 0);
    return now;
};

export const subMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d;
};

export const getToday = (): Date => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now;
};

export const isToday = (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return d.toDateString() === today.toDateString();
};

export const isYesterday = (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return d.toDateString() === yesterday.toDateString();
};

export const getRelativeDay = (date: Date | string): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return formatDateShort(date);
};
