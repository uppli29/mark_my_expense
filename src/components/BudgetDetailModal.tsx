import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Budget, BudgetCategoryProgress } from '../types';
import { budgetRepository } from '../database/repositories/budgetRepository';
import { getCategoryById } from '../constants/categories';
import { formatCurrency } from '../utils/dateUtils';

interface Props {
    visible: boolean;
    onClose: () => void;
    budget: Budget | null;
    onEdit: () => void;
}

export const BudgetDetailModal: React.FC<Props> = ({
    visible,
    onClose,
    budget,
    onEdit,
}) => {
    const { colors } = useTheme();
    const [progress, setProgress] = useState<BudgetCategoryProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalLimit, setTotalLimit] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);

    useEffect(() => {
        if (visible && budget) {
            loadProgress();
        }
    }, [visible, budget]);

    const loadProgress = async () => {
        if (!budget) return;
        setLoading(true);
        try {
            const [categoryProgress, totals] = await Promise.all([
                budgetRepository.getProgress(budget.id),
                budgetRepository.getTotalProgress(budget.id),
            ]);
            setProgress(categoryProgress);
            setTotalLimit(totals.totalLimit);
            setTotalSpent(totals.totalSpent);
        } catch (error) {
            console.error('Failed to load budget detail:', error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressColor = (spent: number, limit: number) => {
        const ratio = limit > 0 ? spent / limit : 0;
        if (ratio > 1) return colors.error;
        if (ratio > 0.75) return colors.warning;
        return colors.success;
    };

    const overallPercent = totalLimit > 0 ? Math.min(totalSpent / totalLimit, 1) : 0;
    const overallColor = getProgressColor(totalSpent, totalLimit);

    if (!budget) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                            {budget.title}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: colors.primaryLight + '20' }]}>
                            <Text style={[styles.badgeText, { color: colors.primary }]}>
                                {budget.type === 'monthly' ? 'Monthly' : 'Yearly'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onEdit} style={styles.headerButton}>
                        <Ionicons name="create-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Overall Summary Card */}
                        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                                Overall Budget
                            </Text>
                            <Text style={[styles.summaryAmount, { color: overallColor }]}>
                                {formatCurrency(totalSpent)}
                            </Text>
                            <Text style={[styles.summaryLimit, { color: colors.textMuted }]}>
                                of {formatCurrency(totalLimit)}
                            </Text>
                            <View
                                style={[
                                    styles.overallProgressTrack,
                                    { backgroundColor: colors.surfaceVariant },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.overallProgressFill,
                                        {
                                            backgroundColor: overallColor,
                                            width: `${overallPercent * 100}%`,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.percentText, { color: overallColor }]}>
                                {totalLimit > 0
                                    ? `${Math.round((totalSpent / totalLimit) * 100)}%`
                                    : '0%'}{' '}
                                used
                            </Text>
                        </View>

                        {/* Category Breakdown */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            Category Breakdown
                        </Text>

                        {progress.map((item) => {
                            const cat = getCategoryById(item.category);
                            const ratio = item.budget_limit > 0
                                ? item.spent / item.budget_limit
                                : 0;
                            const barPercent = Math.min(ratio, 1);
                            const barColor = getProgressColor(item.spent, item.budget_limit);
                            const isOver = ratio > 1;

                            return (
                                <View
                                    key={item.category}
                                    style={[
                                        styles.categoryCard,
                                        { backgroundColor: colors.surface },
                                    ]}
                                >
                                    <View style={styles.categoryHeader}>
                                        <View style={styles.categoryInfo}>
                                            <View
                                                style={[
                                                    styles.categoryIcon,
                                                    { backgroundColor: cat.color + '20' },
                                                ]}
                                            >
                                                <Ionicons
                                                    name={cat.icon as any}
                                                    size={18}
                                                    color={cat.color}
                                                />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.categoryName,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                {cat.name}
                                            </Text>
                                        </View>
                                        {isOver && (
                                            <View
                                                style={[
                                                    styles.overBadge,
                                                    { backgroundColor: colors.error + '15' },
                                                ]}
                                            >
                                                <Ionicons
                                                    name="warning"
                                                    size={12}
                                                    color={colors.error}
                                                />
                                                <Text
                                                    style={[
                                                        styles.overBadgeText,
                                                        { color: colors.error },
                                                    ]}
                                                >
                                                    Over
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View
                                        style={[
                                            styles.categoryProgressTrack,
                                            { backgroundColor: colors.surfaceVariant },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.categoryProgressFill,
                                                {
                                                    backgroundColor: barColor,
                                                    width: `${barPercent * 100}%`,
                                                },
                                            ]}
                                        />
                                    </View>

                                    <View style={styles.categoryAmounts}>
                                        <Text
                                            style={[
                                                styles.categorySpent,
                                                { color: barColor },
                                            ]}
                                        >
                                            {formatCurrency(item.spent)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.categoryLimit,
                                                { color: colors.textMuted },
                                            ]}
                                        >
                                            / {formatCurrency(item.budget_limit)}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 44,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerButton: {
        padding: 8,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingTop: 16,
    },
    summaryCard: {
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    summaryAmount: {
        fontSize: 36,
        fontWeight: '700',
    },
    summaryLimit: {
        fontSize: 14,
        marginTop: 4,
        marginBottom: 16,
    },
    overallProgressTrack: {
        width: '100%',
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    overallProgressFill: {
        height: '100%',
        borderRadius: 5,
    },
    percentText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 20,
        marginBottom: 12,
    },
    categoryCard: {
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    categoryName: {
        fontSize: 15,
        fontWeight: '600',
    },
    overBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    overBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    categoryProgressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    categoryProgressFill: {
        height: '100%',
        borderRadius: 3,
    },
    categoryAmounts: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    categorySpent: {
        fontSize: 15,
        fontWeight: '700',
    },
    categoryLimit: {
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 4,
    },
});
