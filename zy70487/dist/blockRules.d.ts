import { BlockRule, MessageRecord, TempTicket } from './types';
export declare const blockRules: BlockRule[];
export declare function checkBlockRules(record: MessageRecord, ticket: TempTicket): string | null;
