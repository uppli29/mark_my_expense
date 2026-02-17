# Developer Guide: SMS Parser Module

This guide explains the architecture of the refactored SMS parser module and provides instructions on how to add support for new banks.

## Architecture Overview

The module follows SOLID principles to ensure maintainability and extensibility. It uses a **Registry Pattern** to decouple the core identification logic from specific parser implementations.

### Directory Structure
```text
src/services/sms/
├── types.ts           # Shared data structures (BankType, ParsedTransaction, etc.)
├── utils.ts           # Reusable regex patterns and helper functions
├── base.ts            # Base classes and interfaces for parsers
├── registry.ts        # Central lookup for matching senders to parsers
└── parsers/           # Directory containing specific bank implementations
    ├── hdfc.ts
    ├── icici.ts
    └── ...
```

## Core Components

### 1. `IBankParser` & `BaseBankParser` (`base.ts`)
Defines the contract for all parsers. `BaseBankParser` provides a default implementation for `identify()` (using sender IDs or DLT patterns) and a template method for `parse()`.

### 2. `ParserRegistry` (`registry.ts`)
A centralized list of all active parsers. When an SMS arrives, the system iterates through this registry to find a parser that "claims" the message.

### 3. `CommonPatterns` (`utils.ts`)
Contains regex fragments common across multiple banks (e.g., standard currency formats, account masking). Use these to avoid duplication.

---

## How to Add a New Bank Parser

Follow these steps to add support for a new bank (e.g., "XYZ Bank"):

### Step 1: Update Types
Add the new bank to `BankType` in `src/services/sms/types.ts`.
```typescript
export type BankType = 'HDFC' | 'ICICI' | ... | 'XYZ_BANK' | 'UNKNOWN';
```

### Step 2: Create the Parser Class
Create a new file `src/services/sms/parsers/xyzBank.ts`. Inherit from `BaseBankParser`.

```typescript
import { BankType, TransactionType } from '../types';
import { BaseBankParser } from '../base';
import { parseAmount, CommonPatterns } from '../utils';

export class XYZBankParser extends BaseBankParser {
    bank: BankType = 'XYZ_BANK';
    senderIds = ['XYZBNK', 'XYZAPP']; // Common SMS sender IDs for this bank
    
    // Optional: DLT (Headers) patterns if simple sender IDs aren't enough
    protected dltPatterns = [/^[A-Z]{2}-XYZBNK$/];

    protected extractAmount(message: string): number | null {
        // Use CommonPatterns or custom regex
        const match = message.match(CommonPatterns.Amount.RS_PATTERN);
        return match ? parseAmount(match[1]) : null;
    }

    protected extractAccountLast4(message: string): string | null {
        // Logic to extract last 4 digits (e.g., from "A/c XX1234")
        return null; 
    }

    protected extractTransactionType(message: string): TransactionType {
        const lower = message.toLowerCase();
        if (lower.includes('debited')) return 'EXPENSE';
        if (lower.includes('credited')) return 'INCOME';
        return 'UNKNOWN';
    }

    protected extractMerchant(message: string): string | null {
        // Custom logic to find where the money went
        return null;
    }

    protected extractReference(message: string): string | null {
        return null;
    }

    protected extractBalance(message: string): number | null {
        return null;
    }
}
```

### Step 3: Register the Parser
Add your new parser to the `ParserRegistry` in `src/services/sms/registry.ts`.

```typescript
import { XYZBankParser } from './parsers/xyzBank';

export const ParserRegistry: IBankParser[] = [
    // ... existing parsers
    new XYZBankParser(),
];
```

### Step 4: Add Display Name (Optional)
If you want a pretty name in the UI, update `getBankDisplayName` in `src/services/smsParser.ts`.

---

## Testing Your Parser
Create a temporary script to test your logic before deployment:
1. Import `parseSMS` from `src/services/smsParser`.
2. Call it with a sample SMS string and the sender ID.
3. Verify the `ParsedTransaction` object contains the expected values.
