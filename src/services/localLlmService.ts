import { NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { expenseInsightsService } from './expenseInsightsService';
import { aiContextService } from './aiContextService';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { chatRepository, ChatMessage } from '../database/repositories/chatRepository';

type ModelMeta = {
    name: string;
    path: string;
    sizeBytes?: number;
};

export type LocalModelStatus = {
    hasModel: boolean;
    modelName?: string;
    modelPath?: string;
    sizeBytes?: number;
    backend: 'native' | 'fallback';
};

type DownloadProgress = {
    totalBytesWritten: number;
    totalBytesExpectedToWrite: number;
};

export type TokenUsage = {
    usedTokens: number;
    maxTokens: number;
    percentage: number;
    isWarning: boolean;
    isFull: boolean;
};

const STORAGE_KEY = '@local_llm_model';
const MODEL_DIR = `${FileSystem.documentDirectory}local-llm`;

// Qwen 2.5 with KV cache size 4096
const KV_CACHE_SIZE = 4096;
const TOKEN_WARNING_THRESHOLD = 0.80;  // 80% = show warning
const TOKEN_MAX_THRESHOLD = 0.95;       // 95% = memory full
const MAX_USABLE_TOKENS = Math.floor(KV_CACHE_SIZE * TOKEN_MAX_THRESHOLD);

let loadedModelPath: string | null = null;

const sanitizeFileName = (name: string) =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_');

const ensureModelExtension = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.gguf') || lower.endsWith('.task') || lower.endsWith('.bin')) return name;
    return `${name}.task`;
};

const getLocalModule = () => {
    const mod = NativeModules?.LocalLlm;
    if (!mod?.loadModel || !mod?.generate) return null;
    return mod as {
        loadModel: (path: string) => Promise<void>;
        generate: (prompt: string, options?: { maxTokens?: number; temperature?: number }) => Promise<string>;
        unloadModel?: () => Promise<void>;
    };
};

const ensureModelDir = async () => {
    const info = await FileSystem.getInfoAsync(MODEL_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
    }
};

const readMeta = async (): Promise<ModelMeta | null> => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as ModelMeta;
    } catch {
        return null;
    }
};

const writeMeta = async (meta: ModelMeta) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
};

const clearMeta = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
};

const ensureLoaded = async (path: string) => {
    const native = getLocalModule();
    if (!native) return;
    if (loadedModelPath === path) return;
    await native.loadModel(path);
    loadedModelPath = path;
};

/**
 * Approximate token count using chars/4 heuristic.
 * This is a rough estimate suitable for guard rails.
 */
const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
};

/**
 * Build the rolling chat prompt from persisted messages.
 * Returns the full concatenated prompt and token usage info.
 */
const buildChatPrompt = (messages: ChatMessage[]): { prompt: string; usage: TokenUsage } => {
    let prompt = '';

    // System prompt is always first
    const systemMsg = messages.find(m => m.is_system_prompt === 1);
    if (systemMsg) {
        prompt = systemMsg.content + '\n\n';
    }

    // Build rolling User/Assistant turns (skip system prompt)
    const turns = messages.filter(m => m.is_system_prompt === 0);
    const turnLines: string[] = [];
    for (const msg of turns) {
        if (msg.role === 'user') {
            turnLines.push(`User: ${msg.content}`);
        } else if (msg.role === 'assistant') {
            turnLines.push(`Assistant: ${msg.content}`);
        }
    }

    prompt += turnLines.join('\n');

    const usedTokens = estimateTokens(prompt);
    const percentage = usedTokens / KV_CACHE_SIZE;

    return {
        prompt,
        usage: {
            usedTokens,
            maxTokens: KV_CACHE_SIZE,
            percentage: Math.min(percentage, 1),
            isWarning: percentage >= TOKEN_WARNING_THRESHOLD,
            isFull: usedTokens >= MAX_USABLE_TOKENS,
        },
    };
};

export const localLlmService = {
    async getModelStatus(): Promise<LocalModelStatus> {
        const meta = await readMeta();
        const native = getLocalModule();

        if (!meta) {
            return { hasModel: false, backend: native ? 'native' : 'fallback' };
        }

        const info = await FileSystem.getInfoAsync(meta.path);
        if (!info.exists) {
            await clearMeta();
            return { hasModel: false, backend: native ? 'native' : 'fallback' };
        }

        return {
            hasModel: true,
            modelName: meta.name,
            modelPath: meta.path,
            sizeBytes: meta.sizeBytes ?? (info.exists ? info.size : undefined),
            backend: native ? 'native' : 'fallback',
        };
    },

    async downloadModel(
        url: string,
        name: string,
        onProgress?: (progress: DownloadProgress) => void
    ) {
        await ensureModelDir();
        const fileName = sanitizeFileName(ensureModelExtension(name || 'local-model'));
        const targetPath = `${MODEL_DIR}/${fileName}`;

        const downloadResumable = FileSystem.createDownloadResumable(
            url,
            targetPath,
            {},
            onProgress ? progress => onProgress(progress) : undefined
        );

        const result = await downloadResumable.downloadAsync();
        if (!result?.uri) {
            throw new Error('Download failed');
        }

        const info = await FileSystem.getInfoAsync(result.uri);
        await writeMeta({
            name: name || fileName,
            path: result.uri,
            sizeBytes: info.exists ? info.size : undefined,
        });

        loadedModelPath = null;
        return result.uri;
    },

    async importModel(uri: string, name: string) {
        await ensureModelDir();
        const fileName = sanitizeFileName(ensureModelExtension(name || 'local-model'));
        const targetPath = `${MODEL_DIR}/${fileName}`;

        await FileSystem.copyAsync({ from: uri, to: targetPath });
        const info = await FileSystem.getInfoAsync(targetPath);
        await writeMeta({
            name: name || fileName,
            path: targetPath,
            sizeBytes: info.exists ? info.size : undefined,
        });

        loadedModelPath = null;
        return targetPath;
    },

    async removeModel() {
        const meta = await readMeta();
        if (meta?.path) {
            await FileSystem.deleteAsync(meta.path, { idempotent: true });
        }
        await clearMeta();
        loadedModelPath = null;
    },

    /**
     * Generate a new session ID.
     */
    createSessionId(): string {
        return `chat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    },

    /**
     * Get token usage for a given session without sending a message.
     */
    async getTokenUsage(sessionId: string): Promise<TokenUsage> {
        const messages = await chatRepository.getMessagesBySession(sessionId);
        if (messages.length === 0) {
            return { usedTokens: 0, maxTokens: KV_CACHE_SIZE, percentage: 0, isWarning: false, isFull: false };
        }
        const { usage } = buildChatPrompt(messages);
        return usage;
    },

    /**
     * Session-aware message sending with rolling memory.
     * 1. If new session (no messages yet), gathers financial context and injects system prompt.
     * 2. Persists user message to DB.
     * 3. Builds rolling prompt from full history.
     * 4. Checks token limits.
     * 5. Runs LLM inference (2-hop SQL or direct).
     * 6. Persists assistant response to DB.
     * Returns the assistant's response text and updated token usage.
     */
    async sendMessage(
        sessionId: string,
        userMessage: string
    ): Promise<{ response: string; usage: TokenUsage }> {
        // Check if this is a new session (no messages yet)
        const existingCount = await chatRepository.getMessageCountForSession(sessionId);

        if (existingCount === 0) {
            // New session — gather context and inject system prompt
            const context = await aiContextService.gatherContext();
            const systemPrompt = aiContextService.buildSystemPrompt(context);
            await chatRepository.insertMessage(sessionId, 'system', systemPrompt, true);
        }

        // Persist user message
        await chatRepository.insertMessage(sessionId, 'user', userMessage);

        // Build rolling prompt from all messages
        const allMessages = await chatRepository.getMessagesBySession(sessionId);
        const { prompt, usage } = buildChatPrompt(allMessages);

        // Check token limits
        if (usage.isFull) {
            const fullMsg = 'Chat memory is full. Please start a new chat to continue.';
            await chatRepository.insertMessage(sessionId, 'assistant', fullMsg);
            return { response: fullMsg, usage };
        }

        // Try LLM inference
        const status = await this.getModelStatus();
        let response: string;

        if (status.hasModel && status.backend === 'native' && status.modelPath) {
            try {
                const native = getLocalModule();
                if (native) {
                    await ensureLoaded(status.modelPath);

                    // Attempt 2-hop SQL approach first
                    const sqlResponse = await this._trySqlHop(native, userMessage);
                    if (sqlResponse) {
                        response = sqlResponse;
                    } else {
                        // Direct generation with full context
                        const directPrompt = prompt + '\nAssistant:';
                        const result = await native.generate(directPrompt, {
                            maxTokens: 512,
                            temperature: 0.3,
                        });
                        response = result?.trim() || 'I could not generate a response.';
                    }
                } else {
                    response = await expenseInsightsService.answerWithRules(userMessage);
                }
            } catch (error) {
                console.warn('Local model failed, falling back to rules.', error);
                response = await expenseInsightsService.answerWithRules(userMessage);
            }
        } else {
            response = await expenseInsightsService.answerWithRules(userMessage);
        }

        // Persist assistant response
        await chatRepository.insertMessage(sessionId, 'assistant', response);

        // Recompute token usage after adding assistant response
        const updatedMessages = await chatRepository.getMessagesBySession(sessionId);
        const { usage: updatedUsage } = buildChatPrompt(updatedMessages);

        return { response, usage: updatedUsage };
    },

    /**
     * Internal: Try the 2-hop SQL generation approach.
     * Returns the answer string if successful, null if SQL extraction failed.
     */
    async _trySqlHop(
        native: { generate: (prompt: string, options?: { maxTokens?: number; temperature?: number }) => Promise<string> },
        question: string
    ): Promise<string | null> {
        try {
            // Hop 1: Generate SQL
            const sqlPrompt = expenseInsightsService.generateSqlPrompt(question);
            const sqlResponse = await native.generate(sqlPrompt, {
                maxTokens: 128,
                temperature: 0.1,
            });

            let sqlQuery = '';
            const sqlMatch = sqlResponse?.match(/```sql\s*([\s\S]*?)\s*```/);
            if (sqlMatch && sqlMatch[1]) {
                sqlQuery = sqlMatch[1].trim();
            } else if (sqlResponse && sqlResponse.toLowerCase().includes('select ')) {
                const selectIndex = sqlResponse.toLowerCase().indexOf('select ');
                sqlQuery = sqlResponse.substring(selectIndex).trim();
            }

            if (!sqlQuery) {
                console.warn('No valid SQL extracted from Hop 1 response:', sqlResponse);
                return null;
            }

            // Execute SQL
            const dbResults = await expenseRepository.executeRawQuery(sqlQuery);
            const dbResultsContext = dbResults.length
                ? JSON.stringify(dbResults)
                : 'No results found for this query.';

            // Hop 2: Generate answer from results
            const answerPrompt = expenseInsightsService.generateAnswerPrompt(question, dbResultsContext);
            const answerResponse = await native.generate(answerPrompt, {
                maxTokens: 512,
                temperature: 0.3,
            });

            if (answerResponse?.trim()) return answerResponse.trim();
            return null;
        } catch (error) {
            console.warn('SQL hop failed:', error);
            return null;
        }
    },

    /**
     * Legacy: standalone question answering (no session/memory).
     * Kept for backward compatibility.
     */
    async generateAnswer(question: string): Promise<string> {
        const status = await this.getModelStatus();

        if (status.hasModel && status.backend === 'native' && status.modelPath) {
            try {
                const native = getLocalModule();
                if (native) {
                    await ensureLoaded(status.modelPath);

                    // Hop 1: Generate SQL
                    const sqlPrompt = expenseInsightsService.generateSqlPrompt(question);
                    const sqlResponse = await native.generate(sqlPrompt, {
                        maxTokens: 128,
                        temperature: 0.1,
                    });

                    let sqlQuery = '';
                    const sqlMatch = sqlResponse?.match(/```sql\s*([\s\S]*?)\s*```/);
                    if (sqlMatch && sqlMatch[1]) {
                        sqlQuery = sqlMatch[1].trim();
                    } else if (sqlResponse && sqlResponse.toLowerCase().includes('select ')) {
                        const selectIndex = sqlResponse.toLowerCase().indexOf('select ');
                        sqlQuery = sqlResponse.substring(selectIndex).trim();
                    }

                    if (sqlQuery) {
                        try {
                            const dbResults = await expenseRepository.executeRawQuery(sqlQuery);
                            const dbResultsContext = dbResults.length
                                ? JSON.stringify(dbResults)
                                : "No results found for this query.";

                            // Hop 2: Generate Answer
                            const answerPrompt = expenseInsightsService.generateAnswerPrompt(question, dbResultsContext);
                            const answerResponse = await native.generate(answerPrompt, {
                                maxTokens: 512,
                                temperature: 0.3,
                            });

                            if (answerResponse?.trim()) return answerResponse.trim();
                        } catch (dbError) {
                            console.warn('Raw SQL execution failed.', dbError);
                        }
                    } else {
                        console.warn('No valid SQL extracted from Hop 1 response:', sqlResponse);
                    }
                }
            } catch (error) {
                console.warn('Local model loop failed, falling back to rules.', error);
            }
        }

        return expenseInsightsService.answerWithRules(question);
    },
};
