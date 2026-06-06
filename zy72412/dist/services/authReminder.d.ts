import { AuthReminder, ReviewRole } from '../types';
export declare function detectMixedBatches(): string[];
export declare function generateInitialRemindersForBatch(batchId: string): AuthReminder[];
export declare function updateReminderAfterAudioRemark(ticketId: number, audioRemark: string): AuthReminder | null;
export declare function recordingEngineerReview(ticketId: number, approve: boolean, remark: string): AuthReminder | null;
export declare function getReminderByTicketId(ticketId: number): AuthReminder | null;
export declare function getRemindersByAssignee(assignee: ReviewRole): AuthReminder[];
export declare function getAllReminders(): AuthReminder[];
export declare function markReminderRead(reminderId: number): boolean;
