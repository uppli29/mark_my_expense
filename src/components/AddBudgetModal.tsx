import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES } from '../constants/categories';
import { Budget, BudgetCategory } from '../types';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: {
        title: string;
        type: 'monthly' | 'yearly';
        categories: { category: string; limit: number }[];
    }) => void;
    onDelete?: () => void;
    budget?: Budget | null;
    existingLimits?: BudgetCategory[];
}

export const AddBudgetModal: React.FC<Props> = ({
    visible,
    onClose,
    onSubmit,
    onDelete,
    budget,
    existingLimits,
}) => {
    const { colors } = useTheme();
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'monthly' | 'yearly'>('monthly');
    const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({});

    useEffect(() => {
        if (budget && existingLimits) {
            setTitle(budget.title);
            setType(budget.type);
            const limits: Record<string, string> = {};
            existingLimits.forEach((cl) => {
                limits[cl.category] = cl.budget_limit.toString();
            });
            setCategoryLimits(limits);
        } else {
            setTitle('');
            setType('monthly');
            setCategoryLimits({});
        }
    }, [budget, existingLimits, visible]);

    const handleSubmit = () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a budget title.');
            return;
        }

        const categories = Object.entries(categoryLimits)
            .filter(([_, val]) => val && parseFloat(val) > 0)
            .map(([cat, val]) => ({ category: cat, limit: parseFloat(val) }));

        if (categories.length === 0) {
            Alert.alert('Error', 'Please add a limit for at least one category.');
            return;
        }

        onSubmit({ title: title.trim(), type, categories });
        onClose();
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Budget',
            'Are you sure you want to delete this budget?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        onDelete?.();
                        onClose();
                    },
                },
            ]
        );
    };

    const updateLimit = (categoryId: string, value: string) => {
        // Only allow numbers and decimal point
        const sanitized = value.replace(/[^0-9.]/g, '');
        setCategoryLimits((prev) => ({ ...prev, [categoryId]: sanitized }));
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {budget ? 'Edit Budget' : 'New Budget'}
                        </Text>
                        <TouchableOpacity onPress={handleSubmit}>
                            <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.formScroll}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Title Input */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: colors.surfaceVariant,
                                    color: colors.text,
                                    borderColor: colors.border,
                                },
                            ]}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Monthly Home Budget"
                            placeholderTextColor={colors.textMuted}
                        />

                        {/* Type Selector */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
                        <View style={styles.typeRow}>
                            {(['monthly', 'yearly'] as const).map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.typeButton,
                                        {
                                            backgroundColor:
                                                type === t ? colors.primary : colors.surfaceVariant,
                                            borderColor: type === t ? colors.primary : colors.border,
                                        },
                                    ]}
                                    onPress={() => setType(t)}
                                >
                                    <Ionicons
                                        name={t === 'monthly' ? 'calendar-outline' : 'calendar'}
                                        size={18}
                                        color={type === t ? '#FFFFFF' : colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.typeText,
                                            {
                                                color: type === t ? '#FFFFFF' : colors.textSecondary,
                                            },
                                        ]}
                                    >
                                        {t === 'monthly' ? 'Monthly' : 'Yearly'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Category Limits */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                            Category Limits
                        </Text>
                        <Text style={[styles.hint, { color: colors.textMuted }]}>
                            Set a spending limit for each category you want to track
                        </Text>

                        {CATEGORIES.map((cat) => (
                            <View
                                key={cat.id}
                                style={[
                                    styles.categoryRow,
                                    { borderBottomColor: colors.border },
                                ]}
                            >
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
                                        style={[styles.categoryName, { color: colors.text }]}
                                        numberOfLines={1}
                                    >
                                        {cat.name}
                                    </Text>
                                </View>
                                <TextInput
                                    style={[
                                        styles.limitInput,
                                        {
                                            backgroundColor: colors.surfaceVariant,
                                            color: colors.text,
                                            borderColor: categoryLimits[cat.id]
                                                ? colors.primary
                                                : colors.border,
                                        },
                                    ]}
                                    value={categoryLimits[cat.id] || ''}
                                    onChangeText={(val) => updateLimit(cat.id, val)}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                />
                            </View>
                        ))}

                        {/* Delete Button */}
                        {budget && onDelete && (
                            <TouchableOpacity
                                style={[styles.deleteButton, { borderColor: colors.error }]}
                                onPress={handleDelete}
                            >
                                <Ionicons name="trash-outline" size={18} color={colors.error} />
                                <Text style={[styles.deleteText, { color: colors.error }]}>
                                    Delete Budget
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '92%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
    },
    formScroll: {
        flex: 1,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    hint: {
        fontSize: 12,
        marginBottom: 12,
        marginTop: -4,
    },
    textInput: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    typeRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    typeText: {
        fontSize: 15,
        fontWeight: '600',
    },
    categoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
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
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    limitInput: {
        width: 100,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'right',
        borderWidth: 1,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 24,
        gap: 8,
    },
    deleteText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
