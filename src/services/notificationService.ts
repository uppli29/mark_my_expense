import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { formatCurrency } from '../utils/dateUtils';
// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});
// Notification identifiers for cancellation
const DAILY_REMINDER_ID = 'daily-expense-reminder';
const WEEKLY_SUMMARY_ID = 'weekly-expense-summary';
export const notificationService = {
    /**
     * Request notification permissions
     */
    async requestPermissions(): Promise<boolean> {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Notification permissions not granted');
            return false;
        }
        // Required for Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366F1',
            });
            await Notifications.setNotificationChannelAsync('reminders', {
                name: 'Expense Reminders',
                description: 'Daily and weekly expense tracking reminders',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366F1',
            });
        }
        return true;
    },
    /**
     * Schedule daily reminder at 9 PM
     */
    async scheduleDailyReminder(): Promise<string | null> {
        try {
            // Cancel existing daily reminder
            await this.cancelNotification(DAILY_REMINDER_ID);
            const identifier = await Notifications.scheduleNotificationAsync({
                identifier: DAILY_REMINDER_ID,
                content: {
                    title: '💰 Track Your Expenses',
                    body: "Don't forget to log today's expenses! Stay on top of your finances.",
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: 21, // 9 PM
                    minute: 0,
                },
            });
            console.log('Daily reminder scheduled:', identifier);
            return identifier;
        } catch (error) {
            console.error('Failed to schedule daily reminder:', error);
            return null;
        }
    },
    /**
     * Schedule weekly summary at Sunday 9 PM
     */
    async scheduleWeeklySummary(): Promise<string | null> {
        try {
            // Cancel existing weekly summary
            await this.cancelNotification(WEEKLY_SUMMARY_ID);
            const identifier = await Notifications.scheduleNotificationAsync({
                identifier: WEEKLY_SUMMARY_ID,
                content: {
                    title: '📊 Weekly Expense Summary',
                    body: 'Tap to see how much you spent this week!',
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday: 1, // Sunday (1 = Sunday in Expo)
                    hour: 21, // 9 PM
                    minute: 0,
                },
            });
            console.log('Weekly summary scheduled:', identifier);
            return identifier;
        } catch (error) {
            console.error('Failed to schedule weekly summary:', error);
            return null;
        }
    },
    /**
     * Schedule all notifications
     */
    async scheduleAllNotifications(): Promise<void> {
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
            console.log('Cannot schedule notifications - no permission');
            return;
        }
        await this.scheduleDailyReminder();
        await this.scheduleWeeklySummary();
        console.log('All notifications scheduled');
    },
    /**
     * Cancel a specific notification
     */
    async cancelNotification(identifier: string): Promise<void> {
        try {
            await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (error) {
            // Notification might not exist, ignore
        }
    },
    /**
     * Cancel all scheduled notifications
     */
    async cancelAllNotifications(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('All notifications cancelled');
    },
    /**
     * Get all scheduled notifications (for debugging)
     */
    async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
        return await Notifications.getAllScheduledNotificationsAsync();
    },
    /**
     * Send an immediate test notification
     * Also triggers the SMS scan logic to verify functionality
     */
    async sendTestNotification(): Promise<void> {
        const { smsListenerService } = require('./smsListenerService');
        await smsListenerService.autoScanAndNotify();
    },
    /**
     * Get weekly spending for notification content
     */
    async getWeeklySpending(): Promise<{ total: number; count: number }> {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        const total = await expenseRepository.getTotalSpend(weekAgo, today);
        const expenses = await expenseRepository.getByDateRange(weekAgo, today);
        return { total, count: expenses.length };
    },
    /**
     * Send weekly summary notification with actual data
     * This should be called by a background task or when app opens on Sunday
     */
    async sendWeeklySummaryWithData(): Promise<void> {
        try {
            const { total, count } = await this.getWeeklySpending();
            const formattedTotal = formatCurrency(total);
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '📊 Your Weekly Summary',
                    body: `You spent ${formattedTotal} across ${count} expenses this week. Tap to see details!`,
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null, // Immediate
            });
        } catch (error) {
            console.error('Failed to send weekly summary:', error);
        }
    },
    /**
     * Show an immediate local notification
     */
    async showLocalNotification(title: string, body: string): Promise<void> {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null, // Immediate
            });
        } catch (error) {
            console.error('Failed to show local notification:', error);
        }
    },
};