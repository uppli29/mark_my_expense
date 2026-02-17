/**
 * SMS Parser Service for Indian Bank Transaction Messages
 * Refactored into modular parsers following SOLID principles.
 */

import { BankType, ParsedTransaction } from './sms/types';
import { findParser } from './sms/registry';
import { generateMessageHash as utilsGenerateMessageHash } from './sms/utils';

// Re-export types for backward compatibility
export type { BankType, TransactionType, ParsedTransaction } from './sms/types';

/**
 * Generate a hash from the message for duplicate detection
 */
export function generateMessageHash(message: string): string {
    return utilsGenerateMessageHash(message);
}

/**
 * Identify the bank from sender ID
 */
export function identifyBank(sender: string): BankType {
    const parser = findParser(sender);
    return parser ? parser.bank : 'UNKNOWN';
}

/**
 * Get bank display name
 */
export function getBankDisplayName(bank: BankType): string {
    switch (bank) {
        case 'HDFC': return 'HDFC Bank';
        case 'ICICI': return 'ICICI Bank';
        case 'SBI': return 'State Bank of India';
        case 'CANARA': return 'Canara Bank';
        case 'IOB': return 'Indian Overseas Bank';
        case 'INDIANBANK': return 'Indian Bank';
        default: return 'Unknown Bank';
    }
}

/**
 * Main function to parse an SMS message
 */
export function parseSMS(sender: string, message: string, timestamp: number = Date.now()): ParsedTransaction | null {
    const parser = findParser(sender);
    if (!parser) {
        return null;
    }

    return parser.parse(sender, message, timestamp);
}

// Keep other functions if they are used elsewhere, but ideally they should be moved to utils or parsers.
// Based on smsListenerService.ts, only parseSMS, getBankDisplayName, and generateMessageHash are used.
// If extractAmount, extractAccountLast4 etc are needed, they should be exported from their respectivos parsers or utils.
