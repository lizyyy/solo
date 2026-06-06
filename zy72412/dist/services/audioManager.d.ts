import { AudioFile, ReviewRole } from '../types';
export declare function addAudioFile(fileId: string, fileName: string, ticketNo: string, batchId: string, uploadedBy?: string): AudioFile | null;
export declare function updateAudioRemark(ticketId: number, remark: string, operator?: ReviewRole): boolean;
export declare function getAudioFileById(fileId: string): AudioFile | null;
export declare function getAudioFilesByBatch(batchId: string): AudioFile[];
export declare function getAudioFilesByTicket(ticketNo: string): AudioFile | null;
export declare function getAllAudioFiles(): AudioFile[];
