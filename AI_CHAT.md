# PennyWise AI Chat Feature Documentation

The AI Chat feature in PennyWise is a robust, privacy-first, on-device assistant that leverages local Large Language Models (LLMs) to provide users with personal financial insights. 

Below is the detailed documentation outlining the architecture, data flow, context gathering, and user interface.

## 1. High-Level Architecture
The AI feature is built using a clean, layered architecture leveraging Android's recommended MVVM pattern and coroutines for asynchronous operations.

- **UI Layer ([ChatScreen](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/ui/screens/chat/ChatScreen.kt#38-420) & [ChatViewModel](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/ui/screens/chat/ChatViewModel.kt#25-214))**: Manages the user interface, displays chat messages, and handles the continuous stream of responses.
- **Repository Layer ([LlmRepository](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/repository/LlmRepository.kt#21-299), [AiContextRepository](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/repository/AiContextRepository.kt#21-218), `ModelRepository`)**: Coordinates between local data sources (Room DB), user preferences, and the LLM execution service. It orchestrates context building and memory management.
- **Service Layer ([LlmServiceImpl](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/service/LlmServiceImpl.kt#16-81))**: A wrapper around [Google's MediaPipe Tasks GenAI API](https://developers.google.com/mediapipe/solutions/genai/llm_inference/android). It performs the actual inference using a locally downloaded model file (specifically **Qwen 2.5**).
- **Data Layer ([ChatDao](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/database/dao/ChatDao.kt#7-37), [ChatContext](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/model/ChatContext.kt#11-19))**: Manages the storage of message history and aggregate financial data passed to the model.

## 2. Core Components & Responsibilities

### 2.1 MediaPipe LLM Inference
The core LLM inference is completely local, ensuring maximum privacy for financial data.
- **Service implementation**: [LlmServiceImpl](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/service/LlmServiceImpl.kt#16-81) uses `LlmInference` from the MediaPipe SDK.
- **Configuration**: The model is initialized with a max token context size of `1280` (KV cache size).
- **Execution**: Supports asynchronous streaming output (`generateResponseAsync`) mapping to Kotlin `Flow`.

### 2.2 AiContextRepository
This repository's sole purpose is to gather comprehensive financial context so the LLM knows the user's current standing. It queries the local Room database using Kotlin coroutines (`async`) in parallel for high performance.
The data gathered ([ChatContext.kt](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/model/ChatContext.kt)) includes:
- **Month Summary**: Total income, expense, and transaction count.
- **Recent Transactions**: Up to the 20 most recent transactions over the last 14 days.
- **Active Subscriptions**: Due dates and amounts.
- **Top Categories**: Top 5 spending categories by percentage.
- **Quick Stats**: Daily average spending, most frequent merchant, and the largest single expense.

### 2.3 LlmRepository
This acts as the brain piece where context, message history, and LLM execution intersect.
- **Context Injection**: For a new chat, it generates a "System Prompt" based on [ChatContext](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/model/ChatContext.kt#11-19) formatted text. The LLM is instructed to act as a friendly financial assistant (PennyWise AI), avoid markdown syntax, and use specific currency variables based on the user's data. 
- **Chat Window/Memory**: It builds a rolling summary of `User:` and `Assistant:` interactions. It guards the prompt length roughly preventing the token count from exceeding 1200 out of the maximum 1280 allowed.
- **Saving Messages**: Persists user and generated assistant messages back to the [ChatDao](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/database/dao/ChatDao.kt#7-37).

### 2.4 ChatViewModel & ChatScreen
- **ViewModel**: Gathers data flows, maintains [ChatUiState](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/ui/screens/chat/ChatViewModel.kt#215-219) (loading, error states), and handles the streaming payload, appending chunked text to `currentResponse` as the LLM generates output. It observes device state, calculating developer statistics (Token counts, usage percentages).
- **Screen UI**: A Jetpack Compose screen that gracefully degrades if the model isn't downloaded yet (showing a Download prompt). It auto-scrolls when dealing with newly streamed messages, implements an interactive empty state, and handles context token limit warnings dynamically.

## 3. Data Flow: How a Query works

When a user typed *"What did I spend on food this month?"* and hits Send:

1. **User Action:** [ChatScreen](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/ui/screens/chat/ChatScreen.kt#38-420) receives input and calls `ChatViewModel.sendMessage(message)`.
2. **ViewModel Validation:** Sets UI state to loading and maps to `LlmRepository.sendMessageStream(message)`.
3. **Repository Interception:** 
   - [LlmRepository](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/repository/LlmRepository.kt#21-299) inserts the user's raw message into [ChatDao](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/database/dao/ChatDao.kt#7-37).
   - Checks if it's a completely *New Chat*. If yes, it fetches [ChatContext](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/model/ChatContext.kt#11-19) from [AiContextRepository](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/repository/AiContextRepository.kt#21-218), builds the massive System Prompt embedding the user's real finances, and saves it as a hidden `isSystemPrompt=true` message.
   - All previous chat history is retrieved and concatenated into a raw String block (`User: ... \n Assistant: ...`).
   - Token constraint buffers are checked. If it goes over limits, throws a "Memory Full" UI Error. 
4. **Inference Execution:** Passes the concatenated context to `LlmServiceImpl.generateResponseStream`. MediaPipe starts on-device local inference.
5. **Streaming Output:** As tokens are generated, [LlmServiceImpl](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/service/LlmServiceImpl.kt#16-81) emits chunks over the Kotlin Flow.
6. **UI Update:** The repository intercepts the flow, appends to a local `StringBuilder`, and pushes the partial chunks back to [ChatViewModel](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/ui/screens/chat/ChatViewModel.kt#25-214). The [ChatScreen](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/ui/screens/chat/ChatScreen.kt#38-420) recomposes continuously, showing a typing effect for the message payload.
7. **Finalization:** When [LlmServiceImpl](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/service/LlmServiceImpl.kt#16-81) signals `done=true`, the [LlmRepository](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/repository/LlmRepository.kt#21-299) takes the completed `StringBuilder` payload and uses [ChatDao](file:///e:/Learnings/pennywiseai-tracker/app/src/main/java/com/pennywiseai/tracker/data/database/dao/ChatDao.kt#7-37) to insert the final complete Application response into the DB. The stream is closed, UI resets to idle.

## 4. Key Security & Operational Highlights
- **100% Offline**: User transactional data never leaves the device. The prompt is assembled and executed directly locally using MediaPipe.
- **Token Management**: The Token limits (1280 KV cache) exist intrinsically because local mobile LLMs demand small footprints. A system prompt reserves the bulk, with only a small sliding window afforded for direct Q&A. The app intentionally alerts the user when they hit 80%+ limits or forces a "Clear Chat" when maxed out.
- **Error Handling**: Graceful routing for explicit errors like "memory full", "model downloading", or "model missing".

*End of Document*
