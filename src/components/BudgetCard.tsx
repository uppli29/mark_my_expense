import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Budget } from '../types';
import { budgetRepository } from '../database/repositories/budgetRepository';
import { formatCurrency } from '../utils/dateUtils';

interface Props {
    budget: Budget;
    onPress: () => void;
}

export const BudgetCard: React.FC<Props> = ({ budget, onPress }) => {
    const { colors } = useTheme();
    const [totalLimit, setTotalLimit] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);

    useEffect(() => {
        loadProgress();
    }, [budget.id]);

    const loadProgress = async () => {
        try {
            const progress = await budgetRepository.getTotalProgress(budget.id);
            setTotalLimit(progress.totalLimit);
            setTotalSpent(progress.totalSpent);
        } catch (error) {
            console.error('Failed to load budget progress:', error);
        }
    };

    const progressPercent = totalLimit > 0 ? Math.min(totalSpent / totalLimit, 1.5) : 0;
    const displayPercent = Math.min(progressPercent, 1);
    const progressColor =
        progressPercent > 1 ? colors.error : progressPercent > 0.75 ? colors.warning : colors.success;

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <View style={styles.headerRow}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="pie-chart" size={22} color={colors.primary} />
                </View>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {budget.title}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: colors.primaryLight + '20' }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>
                            {budget.type === 'monthly' ? 'Monthly' : 'Yearly'}
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                backgroundColor: progressColor,
                                width: `${displayPercent * 100}%`,
                            },
                        ]}
                    />
                </View>
                <View style={styles.amountsRow}>
                    <Text style={[styles.spentText, { color: progressColor }]}>
                        {formatCurrency(totalSpent)} spent
                    </Text>
                    <Text style={[styles.limitText, { color: colors.textMuted }]}>
                        of {formatCurrency(totalLimit)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    badge: {
        alignSelf: 'flex-start',
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
    progressSection: {
        gap: 8,
    },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    amountsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    spentText: {
        fontSize: 13,
        fontWeight: '600',
    },
    limitText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
