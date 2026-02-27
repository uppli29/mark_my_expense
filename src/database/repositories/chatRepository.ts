import { getDatabase } from '../database';

export type ChatMessage = {
    id: number;
    session_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    is_system_prompt: number;
    created_at: string;
};

export const chatRepository = {
    async insertMessage(
        sessionId: string,
        role: ChatMessage['role'],
        content: string,
        isSystemPrompt: boolean = false
    ): Promise<number> {
        const db = await getDatabase();
        const result = await db.runAsync(
            `INSERT INTO chat_messages (session_id, role, content, is_system_prompt)
             VALUES (?, ?, ?, ?)`,
            [sessionId, role, content, isSystemPrompt ? 1 : 0]
        );
        return result.lastInsertRowId;
    },

    async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
        const db = await getDatabase();
        return db.getAllAsync<ChatMessage>(
            `SELECT * FROM chat_messages
             WHERE session_id = ?
             ORDER BY created_at ASC, id ASC`,
            [sessionId]
        );
    },

    async getVisibleMessages(sessionId: string): Promise<ChatMessage[]> {
        const db = await getDatabase();
        return db.getAllAsync<ChatMessage>(
            `SELECT * FROM chat_messages
             WHERE session_id = ? AND is_system_prompt = 0
             ORDER BY created_at ASC, id ASC`,
            [sessionId]
        );
    },

    async deleteSession(sessionId: string): Promise<void> {
        const db = await getDatabase();
        await db.runAsync('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
    },

    async getLatestSessionId(): Promise<string | null> {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{ session_id: string }>(
            `SELECT session_id FROM chat_messages
             ORDER BY created_at DESC, id DESC LIMIT 1`
        );
        return result?.session_id ?? null;
    },

    async getMessageCountForSession(sessionId: string): Promise<number> {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?`,
            [sessionId]
        );
        return result?.count ?? 0;
    },

    async clearAllChats(): Promise<void> {
        const db = await getDatabase();
        await db.runAsync('DELETE FROM chat_messages');
    },
};
