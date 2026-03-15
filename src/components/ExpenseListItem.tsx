import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    PanResponder,
    Alert,
    Platform,
    Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ExpenseWithAccount } from '../types';
import { getCategoryById } from '../constants/categories';
import { formatCurrency, getRelativeDay } from '../utils/dateUtils';

const DELETE_BUTTON_WIDTH = 80;
const SWIPE_THRESHOLD = -50;

interface ExpenseListItemProps {
    expense: ExpenseWithAccount;
    onPress?: () => void;
    onDelete?: (id: number) => void;
    onLongPress?: () => void;
    isSelecting?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (id: number) => void;
}

const ExpenseListItemInner: React.FC<ExpenseListItemProps> = ({
    expense,
    onPress,
    onDelete,
    onLongPress,
    isSelecting = false,
    isSelected = false,
    onToggleSelect,
}) => {
    const { colors } = useTheme();
    const category = getCategoryById(expense.category);

    // Swipe animation
    const translateX = useRef(new Animated.Value(0)).current;
    const isSwipeOpen = useRef(false);
    const isSelectingRef = useRef(isSelecting);
    isSelectingRef.current = isSelecting;

    // Checkbox animation (scale + opacity)
    const checkboxAnim = useRef(new Animated.Value(isSelecting ? 1 : 0)).current;

    // Selection highlight animation
    const selectionBgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    // Press scale animation
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Animate checkbox in/out when selection mode changes
    useEffect(() => {
        Animated.spring(checkboxAnim, {
            toValue: isSelecting ? 1 : 0,
            useNativeDriver: false,
            speed: 20,
            bounciness: 8,
        }).start();

        // Close swipe when entering selection mode
        if (isSelecting && isSwipeOpen.current) {
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                speed: 20,
            }).start();
            isSwipeOpen.current = false;
        }
    }, [isSelecting]);

    // Animate selection highlight
    useEffect(() => {
        Animated.timing(selectionBgAnim, {
            toValue: isSelected ? 1 : 0,
            duration: 150,
            useNativeDriver: false,
        }).start();
    }, [isSelected]);

    const panResponder = useMemo(() =>
        PanResponder.create({
            onMoveShouldSetPanResponder: (_evt, gestureState) => {
                if (isSelectingRef.current) return false;
                return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 8;
            },
            onPanResponderGrant: () => {
                // Slight scale down for tactile feel
                Animated.timing(scaleAnim, {
                    toValue: 0.98,
                    duration: 100,
                    useNativeDriver: true,
                }).start();
            },
            onPanResponderMove: (_evt, gestureState) => {
                if (gestureState.dx < 0) {
                    translateX.setValue(Math.max(gestureState.dx, -DELETE_BUTTON_WIDTH));
                } else if (isSwipeOpen.current) {
                    translateX.setValue(Math.min(0, -DELETE_BUTTON_WIDTH + gestureState.dx));
                }
            },
            onPanResponderRelease: (_evt, gestureState) => {
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }).start();

                if (gestureState.dx < SWIPE_THRESHOLD) {
                    Animated.spring(translateX, {
                        toValue: -DELETE_BUTTON_WIDTH,
                        useNativeDriver: true,
                        speed: 24,
                        bounciness: 4,
                    }).start();
                    isSwipeOpen.current = true;
                } else {
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        speed: 24,
                        bounciness: 4,
                    }).start();
                    isSwipeOpen.current = false;
                }
            },
            onPanResponderTerminate: () => {
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }).start();
            },
        }),
    []);

    const closeSwipe = useCallback(() => {
        Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 24,
        }).start();
        isSwipeOpen.current = false;
    }, []);

    const handleDeletePress = useCallback(() => {
        Alert.alert(
            'Delete Expense',
            `Delete ${formatCurrency(expense.amount)} (${category.name})?`,
            [
                { text: 'Cancel', style: 'cancel', onPress: closeSwipe },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        closeSwipe();
                        onDelete?.(expense.id);
                    },
                },
            ]
        );
    }, [expense.id, expense.amount, category.name, onDelete, closeSwipe]);

    const handlePress = useCallback(() => {
        if (isSelecting) {
            onToggleSelect?.(expense.id);
        } else {
            onPress?.();
        }
    }, [isSelecting, expense.id, onPress, onToggleSelect]);

    const handleLongPress = useCallback(() => {
        if (!isSelecting) {
            // Haptic feedback
            if (Platform.OS === 'android') {
                Vibration.vibrate(30);
            }
            onLongPress?.();
        }
    }, [isSelecting, onLongPress]);

    const onPressIn = useCallback(() => {
        if (isSelecting) {
            Animated.spring(scaleAnim, {
                toValue: 0.96,
                useNativeDriver: true,
                speed: 50,
                bounciness: 4,
            }).start();
        }
    }, [isSelecting]);

    const onPressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 30,
            bounciness: 6,
        }).start();
    }, []);

    // Interpolations
    const checkboxScale = checkboxAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
    const checkboxWidth = checkboxAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 34],
    });
    const selectedBg = selectionBgAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', colors.primary + '12'],
    });
    const deleteOpacity = translateX.interpolate({
        inputRange: [-DELETE_BUTTON_WIDTH, -10, 0],
        outputRange: [1, 1, 0],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.outerContainer}>
            {/* Delete button behind */}
            <Animated.View style={[styles.deleteBackground, { opacity: deleteOpacity }]}>
                <Pressable
                    style={styles.deleteButton}
                    onPress={handleDeletePress}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                >
                    <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
            </Animated.View>

            {/* Foreground item */}
            <Animated.View
                style={{ 
                    transform: [{ translateX }, { scale: scaleAnim }], 
                    backgroundColor: colors.surface,
                    borderRadius: 14
                }}
                {...(isSelecting ? {} : panResponder.panHandlers)}
            >
                <Pressable
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    delayLongPress={300}
                    unstable_pressDelay={0}
                >
                    <Animated.View
                        style={[
                            styles.container,
                            {
                                backgroundColor: selectedBg,
                                borderColor: isSelected ? colors.primary + '30' : 'transparent',
                                borderWidth: 1.5,
                            },
                        ]}
                    >
                        {/* Animated Checkbox */}
                        <Animated.View
                            style={[
                                styles.checkboxContainer,
                                {
                                    width: checkboxWidth,
                                    opacity: checkboxAnim,
                                    transform: [{ scale: checkboxScale }],
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.checkbox,
                                    {
                                        borderColor: isSelected ? colors.primary : colors.textMuted + '80',
                                        backgroundColor: isSelected ? colors.primary : colors.surface,
                                    },
                                ]}
                            >
                                {isSelected && (
                                    <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" />
                                )}
                            </View>
                        </Animated.View>

                        <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
                            <Ionicons
                                name={category.icon as any}
                                size={22}
                                color={category.color}
                            />
                        </View>

                        <View style={styles.details}>
                            <Text style={[styles.categoryName, { color: colors.text }]}>
                                {category.name}
                            </Text>
                            <View style={styles.subDetails}>
                                <Text style={[styles.accountName, { color: colors.textMuted }]}>
                                    {expense.account_name}
                                </Text>
                                {expense.description && (
                                    <>
                                        <Text style={[styles.dot, { color: colors.textMuted }]}>•</Text>
                                        <Text
                                            style={[styles.description, { color: colors.textMuted }]}
                                            numberOfLines={1}
                                        >
                                            {expense.description}
                                        </Text>
                                    </>
                                )}
                            </View>
                        </View>

                        <View style={styles.rightSection}>
                            <Text style={[styles.amount, { color: colors.text }]}>
                                {formatCurrency(expense.amount)}
                            </Text>
                            <Text style={[styles.date, { color: colors.textMuted }]}>
                                {getRelativeDay(expense.date)}
                            </Text>
                        </View>
                    </Animated.View>
                </Pressable>
            </Animated.View>
        </View>
    );
};

export const ExpenseListItem = React.memo(ExpenseListItemInner, (prev, next) => {
    return (
        prev.expense.id === next.expense.id &&
        prev.expense.amount === next.expense.amount &&
        prev.expense.category === next.expense.category &&
        prev.expense.account_name === next.expense.account_name &&
        prev.expense.description === next.expense.description &&
        prev.expense.date === next.expense.date &&
        prev.isSelecting === next.isSelecting &&
        prev.isSelected === next.isSelected &&
        prev.onPress === next.onPress &&
        prev.onDelete === next.onDelete &&
        prev.onLongPress === next.onLongPress &&
        prev.onToggleSelect === next.onToggleSelect
    );
});

const styles = StyleSheet.create({
    outerContainer: {
        marginVertical: 3,
        marginHorizontal: 16,
        borderRadius: 14,
        overflow: 'hidden',
    },
    deleteBackground: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: DELETE_BUTTON_WIDTH,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
    },
    deleteButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: DELETE_BUTTON_WIDTH,
        height: '100%',
    },
    deleteText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
    },
    checkboxContainer: {
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    details: {
        flex: 1,
        marginLeft: 12,
    },
    categoryName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    subDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accountName: {
        fontSize: 12,
    },
    dot: {
        marginHorizontal: 6,
        fontSize: 8,
    },
    description: {
        fontSize: 12,
        flex: 1,
    },
    rightSection: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    date: {
        fontSize: 11,
    },
});
