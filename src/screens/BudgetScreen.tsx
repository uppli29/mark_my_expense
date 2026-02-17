import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Budget, BudgetCategory } from '../types';
import { budgetRepository } from '../database/repositories/budgetRepository';
import { BudgetCard } from '../components/BudgetCard';
import { BudgetDetailModal } from '../components/BudgetDetailModal';
import { AddBudgetModal } from '../components/AddBudgetModal';

export const BudgetScreen: React.FC = () => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [budgets, setBudgets] = useState<Budget[]>([]);

    // Modal states
    const [showAddBudget, setShowAddBudget] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [editingLimits, setEditingLimits] = useState<BudgetCategory[]>([]);

    const loadBudgets = useCallback(async () => {
        try {
            const data = await budgetRepository.getAll();
            setBudgets(data);
        } catch (error) {
            console.error('Failed to load budgets:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadBudgets();
        }, [loadBudgets])
    );

    const handleCreateBudget = async (data: {
        title: string;
        type: 'monthly' | 'yearly';
        categories: { category: string; limit: number }[];
    }) => {
        await budgetRepository.create(data.title, data.type, data.categories);
        loadBudgets();
    };

    const handleUpdateBudget = async (data: {
        title: string;
        type: 'monthly' | 'yearly';
        categories: { category: string; limit: number }[];
    }) => {
        if (editingBudget) {
            await budgetRepository.update(
                editingBudget.id,
                data.title,
                data.type,
                data.categories
            );
            // Refresh detail if it's open
            if (selectedBudget && selectedBudget.id === editingBudget.id) {
                const updated = await budgetRepository.getById(editingBudget.id);
                setSelectedBudget(updated);
            }
            loadBudgets();
        }
    };

    const handleDeleteBudget = async () => {
        if (editingBudget) {
            await budgetRepository.delete(editingBudget.id);
            setShowDetail(false);
            setSelectedBudget(null);
            loadBudgets();
        }
    };

    const handleBudgetPress = (budget: Budget) => {
        setSelectedBudget(budget);
        setShowDetail(true);
    };

    const handleEditFromDetail = async () => {
        if (selectedBudget) {
            const limits = await budgetRepository.getCategoryLimits(selectedBudget.id);
            setEditingBudget(selectedBudget);
            setEditingLimits(limits);
            setShowAddBudget(true);
        }
    };

    const handleNewBudget = () => {
        setEditingBudget(null);
        setEditingLimits([]);
        setShowAddBudget(true);
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Budgets</Text>
            </View>

            {budgets.length === 0 ? (
                <View style={styles.emptyState}>
                    <View
                        style={[
                            styles.emptyIconContainer,
                            { backgroundColor: colors.primary + '15' },
                        ]}
                    >
                        <Ionicons name="pie-chart-outline" size={48} color={colors.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        No Budgets Yet
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                        Create a budget to track your spending{'\n'}against category limits
                    </Text>
                    <TouchableOpacity
                        style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                        onPress={handleNewBudget}
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.emptyButtonText}>Create Budget</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ height: 16 }} />
                    {budgets.map((budget) => (
                        <BudgetCard
                            key={budget.id}
                            budget={budget}
                            onPress={() => handleBudgetPress(budget)}
                        />
                    ))}
                    <View style={{ height: 120 }} />
                </ScrollView>
            )}

            {/* FAB */}
            {budgets.length > 0 && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={handleNewBudget}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            {/* Add/Edit Budget Modal */}
            <AddBudgetModal
                visible={showAddBudget}
                onClose={() => {
                    setShowAddBudget(false);
                    setEditingBudget(null);
                    setEditingLimits([]);
                }}
                onSubmit={editingBudget ? handleUpdateBudget : handleCreateBudget}
                onDelete={editingBudget ? handleDeleteBudget : undefined}
                budget={editingBudget}
                existingLimits={editingLimits}
            />

            {/* Budget Detail Modal */}
            <BudgetDetailModal
                visible={showDetail}
                onClose={() => {
                    setShowDetail(false);
                    setSelectedBudget(null);
                }}
                budget={selectedBudget}
                onEdit={handleEditFromDetail}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    emptyButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 100,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 999,
    },
});
