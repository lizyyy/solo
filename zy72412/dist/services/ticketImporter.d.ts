import { TicketRecord, TicketBatch, ImportResult } from '../types';
export declare function importTicketsFromCsv(filePath: string): ImportResult;
export declare function getBatchById(batchId: string): TicketBatch | null;
export declare function getTicketsByBatch(batchId: string): TicketRecord[];
export declare function getAllBatches(): TicketBatch[];
export declare function getTicketById(ticketId: number): TicketRecord | null;
