import { TicketRecord, TicketBatch, AuthReminder, AudioFile } from '../types';
interface DatabaseData {
    ticketBatches: TicketBatch[];
    tickets: TicketRecord[];
    audioFiles: AudioFile[];
    authReminders: AuthReminder[];
    auditLogs: any[];
}
export declare function getDb(): DatabaseData;
export declare function saveDb(): void;
export declare function closeDb(): void;
export declare function getNextTicketId(): number;
export declare function getNextReminderId(): number;
export declare function getNextAudioId(): number;
export declare function resetDb(): void;
export {};
