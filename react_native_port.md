# Porting PennyWise AI Chat to Mark My Expense (React Native)

## 1. Source Architecture (PennyWise — Native Android)

PennyWise implements a **fully on-device AI chat** using a layered MVVM architecture:

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **UI** | `ChatScreen` (Compose) + `ChatViewModel` | Renders chat bubbles, handles streaming text, manages `ChatUiState` (loading/error/idle) |
| **Repository** | `LlmRepository` | Orchestrates context injection, builds rolling chat history (User/Assistant turns), enforces token limits (1280 KV cache), persists messages via `ChatDao` |
| **Repository** | `AiContextRepository` | Gathers financial context in parallel: month summary, recent 20 txns (14 days), active subscriptions, top 5 categories, quick stats (daily avg, top merchant, largest expense) |
| **Service** | `LlmServiceImpl` | Wrapper around **MediaPipe Tasks GenAI** `LlmInference`. Handles async streaming output via Kotlin `Flow` |
| **Data** | `ChatDao` + `ChatContext` | Room DB storage of messages and aggregate financial data |

### Key Behaviours
- **System prompt**: Generated once per new chat — embeds full financial context, currency, assistant persona ("PennyWise AI")
- **Rolling memory**: Concatenates `User: … \n Assistant: …` turns; caps at ~1200 tokens out of 1280 max
- **Streaming**: Tokens emitted chunk-by-chunk; UI recomposes in real time ("typing effect")
- **Memory full**: When token limit hit, forces "Clear Chat" action
- **100% offline**: No network calls; model file stored locally

---

## 2. Current State (Mark My Expense — React Native / Expo)

### What Already Exists

| Component | File | What it does |
|-----------|------|--------------|
| **UI** | `AssistantScreen.tsx` | Chat bubble list, model download/import/remove card, text input + send button. No streaming — waits for full response |
| **LLM Service** | `localLlmService.ts` | Model lifecycle (download GGUF from HuggingFace, import, remove). **2-hop inference**: Hop 1 → generate SQL; Hop 2 → answer from DB results. Uses `NativeModules.LocalLlm` (native bridge) |
| **Insights** | `expenseInsightsService.ts` | Builds prompt context (week/month/year totals, top categories, recent 5 txns). SQL prompt builder. Rule-based fallback (`answerWithRules`) |
| **Database** | `database.ts` + `schema.ts` | expo-sqlite with tables: `accounts`, `expenses`, `budgets`, `budget_categories`, `processed_sms_hashes` |
| **Repositories** | `expenseRepository.ts`, `accountRepository.ts`, `budgetRepository.ts` | Standard CRUD + aggregation queries |

### What's Missing vs PennyWise

| Feature | PennyWise | Mark My Expense | Gap |
|---------|-----------|-----------------|-----|
| **Chat history persistence** | `ChatDao` stores all messages in Room DB | In-memory `useState` only — messages lost on navigate away | ❌ Need `chat_messages` table |
| **Streaming responses** | Token-by-token via `Flow` | Full response await (`generateAnswer`) | ❌ Need streaming support in native bridge + UI |
| **System prompt with full context** | Rich `ChatContext` (month summary, 20 recent txns, subscriptions, categories, quick stats) | Simpler context (week/month/year totals, top categories, 5 recent) | ⚠️ Partial — can enhance |
| **Rolling chat memory / token management** | Concatenates history, guards 1200/1280 token limit | No history sent to LLM — each question is independent | ❌ Need conversational memory |
| **Memory-full handling** | "Clear Chat" forced action + 80% warning | None | ❌ Need token limit UX |
| **Chat session management** | New chat = fresh system prompt | No concept of sessions | ❌ Need session lifecycle |
| **Model download UX** | Progress + graceful degradation | ✅ Already has download with progress bar | ✅ Done |
| **Offline guarantee** | 100% offline | ✅ Already offline (GGUF + NativeModules) | ✅ Done |

---

## 3. Porting Plan — What to Build

> **Principle**: Port only the AI chat feature. Do NOT modify core expense tracking, budgets, accounts, SMS parsing, or any existing functionality.

### 3.1 New Database Table: `chat_messages`

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    is_system_prompt INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
```

### 3.2 New Repository: `chatRepository.ts`

- `insertMessage(sessionId, role, content, isSystemPrompt)`
- `getMessagesBySession(sessionId)`
- `deleteSession(sessionId)`
- `getAllSessions()` — for future session list
- `getLatestSessionId()` — resume last chat

### 3.3 Enhanced Context Gathering: `aiContextService.ts`

Port PennyWise's `AiContextRepository` pattern — run queries **in parallel** to build richer context:

| Data Point | PennyWise | Current App | Action |
|-----------|-----------|-------------|--------|
| Month income/expense/count | ✅ | ✅ (totals only) | Enhance with count |
| Recent 20 txns (14 days) | ✅ | 5 recent (no date filter) | Increase to 20, add 14-day window |
| Active subscriptions | ✅ | ❌ (no subscription concept) | Skip — not applicable |
| Top 5 categories by % | ✅ | ✅ (top categories) | Add percentage calculation |
| Quick stats | ✅ | ❌ | Add daily avg, largest expense |

### 3.4 System Prompt Builder

Create a system prompt generator that mirrors PennyWise's approach:

```
You are a friendly financial assistant for Mark My Expense.
You help users understand their spending.
Avoid markdown formatting. Use plain text.
Currency: ₹ (or detected from user data).

--- FINANCIAL CONTEXT ---
[Injected context from aiContextService]
```

### 3.5 Rolling Chat Memory

Implement rolling memory in the LLM service layer:

1. On each `sendMessage()`:
   - Retrieve all messages for current session from `chatRepository`
   - Concatenate as `User: ...\nAssistant: ...` blocks
   - Count approximate tokens (chars / 4 heuristic)
   - If approaching limit (~80%), show warning in UI
   - If over limit, return "Memory Full" error → prompt user to start new chat
2. Prepend the system prompt (stored as first message with `is_system_prompt=true`)
3. Send full concatenated context to `NativeModules.LocalLlm.generate()`

### 3.6 Streaming Support (Optional — Phase 2)

The native bridge (`NativeModules.LocalLlm`) currently returns a `Promise<string>`. Streaming requires:

- **Native side**: Emit events via `NativeEventEmitter` as tokens are generated
- **React Native side**: Listen to events, append to a `currentStreamText` state
- **UI**: Show partial text growing in real time

> This is a **significant native code change** and can be deferred to Phase 2. Phase 1 can work with full-response mode (as it does today).

### 3.7 UI Enhancements to `AssistantScreen.tsx`

| Change | Description |
|--------|-------------|
| **Persist messages** | Load from `chatRepository` on mount; save on send/receive |
| **New Chat button** | Header action to start a fresh session (new `session_id`) |
| **Token usage indicator** | Small bar/text showing ~X% memory used |
| **Memory full alert** | When token limit hit, show alert with "Start New Chat" action |
| **Empty state** | Suggested questions (like PennyWise's interactive empty state) |
| **Auto-scroll** | Already partially implemented; ensure it works with persisted history |

---

## 4. Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| **MODIFY** | `src/database/database.ts` | Add `chat_messages` table creation |
| **MODIFY** | `src/database/schema.ts` | Add `CREATE_CHAT_MESSAGES_TABLE` constant |
| **NEW** | `src/database/repositories/chatRepository.ts` | Chat message CRUD |
| **NEW** | `src/services/aiContextService.ts` | Enhanced financial context builder with system prompt |
| **MODIFY** | `src/services/localLlmService.ts` | Add rolling memory, session-aware `sendMessage()`, token counting |
| **MODIFY** | `src/screens/AssistantScreen.tsx` | Persistent chat, new chat action, token indicator, memory-full UX |
| **MODIFY** | `src/services/expenseInsightsService.ts` | Add missing context queries (daily avg, largest expense, 14-day window) |

### Files NOT Modified (Core Features Protected)
- `expenseRepository.ts` — no schema changes
- `accountRepository.ts` — untouched
- `budgetRepository.ts` — untouched
- `DashboardScreen.tsx` — untouched
- `ExpensesScreen.tsx` — untouched
- `AccountsScreen.tsx` — untouched
- `BudgetScreen.tsx` — untouched
- `SettingsScreen.tsx` — untouched
- All SMS parsing services — untouched
- Navigation structure — untouched

---

## 5. Architecture Comparison Diagram

```
PennyWise (Android Native)           Mark My Expense (React Native)
━━━━━━━━━━━━━━━━━━━━━━━━━━           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                     
ChatScreen (Compose)          →      AssistantScreen.tsx
    ↓                                    ↓
ChatViewModel                 →      React useState/useCallback hooks
    ↓                                    ↓
LlmRepository                →      localLlmService.ts (enhanced)
    ├─ AiContextRepository    →          ├─ aiContextService.ts (NEW)
    ├─ ChatDao                →          ├─ chatRepository.ts (NEW)
    └─ LlmServiceImpl         →         └─ NativeModules.LocalLlm
         (MediaPipe)                          (GGUF runtime)
```

---

## 6. Implementation Priority

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | Chat persistence + rolling memory + enhanced context + system prompt + UI updates | Medium |
| **Phase 2** | Token-by-token streaming via NativeEventEmitter | High (native code) |
| **Phase 3** | Session list (view past chats), suggested questions, advanced token analytics | Low–Medium |

*End of Document*
