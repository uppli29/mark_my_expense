import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { localLlmService, LocalModelStatus, TokenUsage } from '../services/localLlmService';
import { chatRepository, ChatMessage } from '../database/repositories/chatRepository';

type UIMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

const toUIMessage = (msg: ChatMessage): UIMessage => ({
    id: `${msg.role}-${msg.id}`,
    role: msg.role as 'user' | 'assistant',
    text: msg.content,
});

const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
};

const MODEL_NAME = 'Qwen 2.5';
const MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf';

const WELCOME_MESSAGE: UIMessage = {
    id: 'welcome',
    role: 'assistant',
    text: 'Ask me about your spending. Everything stays on device.',
};

export const AssistantScreen: React.FC = () => {
    const { colors } = useTheme();
    const [status, setStatus] = useState<LocalModelStatus>({
        hasModel: false,
        backend: 'fallback',
    });
    const [messages, setMessages] = useState<UIMessage[]>([WELCOME_MESSAGE]);
    const [question, setQuestion] = useState('');
    const [isWorking, setIsWorking] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
    const scrollRef = useRef<ScrollView | null>(null);

    const loadStatus = useCallback(async () => {
        const next = await localLlmService.getModelStatus();
        setStatus(next);
    }, []);

    // Load or resume the latest chat session
    const loadSession = useCallback(async () => {
        const latestSession = await chatRepository.getLatestSessionId();
        if (latestSession) {
            setSessionId(latestSession);
            const dbMessages = await chatRepository.getVisibleMessages(latestSession);
            if (dbMessages.length > 0) {
                setMessages(dbMessages.map(toUIMessage));
                // Load token usage
                const usage = await localLlmService.getTokenUsage(latestSession);
                setTokenUsage(usage);
            } else {
                setMessages([WELCOME_MESSAGE]);
                setTokenUsage(null);
            }
        } else {
            // No previous session — create a fresh one
            const newId = localLlmService.createSessionId();
            setSessionId(newId);
            setMessages([WELCOME_MESSAGE]);
            setTokenUsage(null);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStatus();
            loadSession();
        }, [loadStatus, loadSession])
    );

    const backendLabel = useMemo(() => {
        if (status.backend === 'native') return 'Local model runtime ready';
        return 'Local model runtime not installed (using offline rules)';
    }, [status.backend]);

    const handleDownload = async () => {
        try {
            setDownloadProgress(0);
            await localLlmService.downloadModel(MODEL_URL, MODEL_NAME, progress => {
                if (progress.totalBytesExpectedToWrite > 0) {
                    const pct = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                    setDownloadProgress(pct);
                }
            });
            setDownloadProgress(null);
            await loadStatus();
            Alert.alert('Model ready', 'The local model was downloaded and is ready to use.');
        } catch (error: any) {
            setDownloadProgress(null);
            const errorMsg = error?.message || String(error);
            console.error('Download failed:', errorMsg);
            Alert.alert('Download failed', `Error: ${errorMsg}`);
        }
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.length) return;
            const file = result.assets[0];
            await localLlmService.importModel(file.uri, MODEL_NAME);
            await loadStatus();
            Alert.alert('Model ready', 'The local model file has been imported.');
        } catch (error) {
            Alert.alert('Import failed', 'Unable to import the model file.');
        }
    };

    const handleRemove = async () => {
        Alert.alert('Remove model', 'Delete the local model file from this device?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    await localLlmService.removeModel();
                    await loadStatus();
                },
            },
        ]);
    };

    const handleNewChat = () => {
        Alert.alert('New Chat', 'Start a fresh conversation? Current chat will be saved.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'New Chat',
                onPress: () => {
                    const newId = localLlmService.createSessionId();
                    setSessionId(newId);
                    setMessages([WELCOME_MESSAGE]);
                    setTokenUsage(null);
                },
            },
        ]);
    };

    const handleAsk = async () => {
        const trimmed = question.trim();
        if (!trimmed || isWorking || !sessionId) return;

        // Check memory-full before sending
        if (tokenUsage?.isFull) {
            Alert.alert(
                'Chat Memory Full',
                'This conversation has reached its memory limit. Please start a new chat.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'New Chat',
                        onPress: () => {
                            const newId = localLlmService.createSessionId();
                            setSessionId(newId);
                            setMessages([WELCOME_MESSAGE]);
                            setTokenUsage(null);
                        },
                    },
                ]
            );
            return;
        }

        setQuestion('');
        // Optimistically show user message
        const userMsg: UIMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: trimmed,
        };
        setMessages(prev => prev.filter(m => m.id !== 'welcome').concat(userMsg));
        setIsWorking(true);

        try {
            const { response, usage } = await localLlmService.sendMessage(sessionId, trimmed);
            const assistantMsg: UIMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                text: response,
            };
            setMessages(prev => [...prev, assistantMsg]);
            setTokenUsage(usage);
        } catch (error) {
            const errorMsg: UIMessage = {
                id: `assistant-err-${Date.now()}`,
                role: 'assistant',
                text: 'Sorry, I could not answer that right now.',
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsWorking(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    const tokenBarColor = useMemo(() => {
        if (!tokenUsage) return colors.primary;
        if (tokenUsage.isFull) return colors.error;
        if (tokenUsage.isWarning) return '#F59E0B'; // amber
        return colors.primary;
    }, [tokenUsage, colors]);

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Assistant</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                        Offline answers, no cloud calls
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleNewChat} style={styles.headerButton}>
                        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <Ionicons name="sparkles" size={24} color={colors.primary} />
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
                                <Ionicons name="cloud-offline" size={20} color={colors.primary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Local Model</Text>
                                <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                                    {status.hasModel ? `${status.modelName} (${formatSize(status.sizeBytes)})` : 'No model installed'}
                                </Text>
                                <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                                    {backendLabel}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {!status.hasModel && (
                        <View style={styles.modelActions}>
                            <Text style={[styles.helperText, { color: colors.textMuted }]}>
                                Download {MODEL_NAME} for local AI assistance.
                            </Text>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                                    onPress={handleDownload}
                                    disabled={downloadProgress !== null}
                                >
                                    {downloadProgress !== null ? (
                                        <Text style={styles.primaryButtonText}>
                                            Downloading {Math.round(downloadProgress * 100)}%
                                        </Text>
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Download</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.secondaryButton, { borderColor: colors.border }]}
                                    onPress={handleImport}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Import File</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {status.hasModel && (
                        <View style={styles.modelActions}>
                            <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: colors.error }]}
                                onPress={handleRemove}
                            >
                                <Text style={[styles.secondaryButtonText, { color: colors.error }]}>Remove Model</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Chat</Text>
                        {tokenUsage && tokenUsage.percentage > 0 && (
                            <View style={styles.tokenContainer}>
                                <View style={[styles.tokenBarBg, { backgroundColor: colors.border }]}>
                                    <View
                                        style={[
                                            styles.tokenBarFill,
                                            {
                                                backgroundColor: tokenBarColor,
                                                width: `${Math.round(tokenUsage.percentage * 100)}%`,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.tokenText, { color: colors.textMuted }]}>
                                    {Math.round(tokenUsage.percentage * 100)}%
                                </Text>
                            </View>
                        )}
                    </View>

                    {tokenUsage?.isWarning && !tokenUsage.isFull && (
                        <View style={[styles.warningBanner, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="warning-outline" size={14} color="#92400E" />
                            <Text style={styles.warningText}>
                                Chat memory is running low. Consider starting a new chat soon.
                            </Text>
                        </View>
                    )}

                    <View style={styles.chatContainer}>
                        {messages.map(message => (
                            <View
                                key={message.id}
                                style={[
                                    styles.messageBubble,
                                    message.role === 'user'
                                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                                        : [styles.assistantBubble, { backgroundColor: colors.surfaceVariant }],
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.messageText,
                                        { color: message.role === 'user' ? '#FFFFFF' : colors.text },
                                    ]}
                                >
                                    {message.text}
                                </Text>
                            </View>
                        ))}
                        {isWorking && (
                            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: colors.surfaceVariant }]}>
                                <ActivityIndicator size="small" color={colors.textMuted} />
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                    style={[styles.chatInput, { color: colors.text }]}
                    placeholder="Ask about your expenses..."
                    placeholderTextColor={colors.textMuted}
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={handleAsk}
                    returnKeyType="send"
                />
                <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: colors.primary }]}
                    onPress={handleAsk}
                    disabled={isWorking}
                >
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 4,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 140,
        gap: 16,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        gap: 12,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    tokenContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tokenBarBg: {
        width: 60,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    tokenBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    tokenText: {
        fontSize: 10,
        fontWeight: '600',
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    warningText: {
        fontSize: 11,
        color: '#92400E',
        flex: 1,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    settingText: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: 12,
    },
    modelActions: {
        gap: 10,
    },
    helperText: {
        fontSize: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    primaryButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 13,
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
    },
    secondaryButtonText: {
        fontWeight: '600',
        fontSize: 13,
    },
    chatContainer: {
        gap: 10,
    },
    messageBubble: {
        padding: 12,
        borderRadius: 14,
        maxWidth: '92%',
    },
    userBubble: {
        alignSelf: 'flex-end',
    },
    assistantBubble: {
        alignSelf: 'flex-start',
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    chatInput: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 8,
        paddingRight: 12,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
