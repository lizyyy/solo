export type TicketType = 'paid' | 'complimentary';
export type AuthStatus = 'pending' | 'needs_review' | 'audio_verified' | 'approved' | 'rejected';
export type ReviewRole = 'recording_engineer' | 'copyright_operations';
export interface TicketRecord {
    id?: number;
    batchId: string;
    ticketNo: string;
    ticketType: TicketType;
    attendeeName: string;
    price: number;
    purchaseDate: string;
    audioFileId?: string;
    audioRemark?: string;
    authStatus: AuthStatus;
    createdAt: string;
    updatedAt: string;
}
export interface TicketBatch {
    id?: number;
    batchId: string;
    totalCount: number;
    paidCount: number;
    complimentaryCount: number;
    hasMixedTypes: boolean;
    importDate: string;
    reviewStatus: 'new' | 'in_review' | 'reviewed';
    reviewedBy?: ReviewRole;
    reviewedAt?: string;
}
export interface AuthReminder {
    id?: number;
    ticketId: number;
    ticketNo: string;
    batchId: string;
    status: AuthStatus;
    reason: string;
    missingMaterials: string[];
    nextStep: string;
    assignee: ReviewRole;
    isRead: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface AudioFile {
    id?: number;
    fileId: string;
    fileName: string;
    ticketNo: string;
    batchId: string;
    remark?: string;
    uploadedBy?: string;
    uploadedAt: string;
    verifiedAt?: string;
    verifiedBy?: ReviewRole;
}
export interface ImportResult {
    success: boolean;
    totalRecords: number;
    batchesCreated: string[];
    mixedBatches: string[];
    errors: string[];
}
export interface ReviewAction {
    ticketId: number;
    action: 'approve' | 'reject' | 'request_info' | 'mark_audio_checked';
    remark?: string;
    operator: ReviewRole;
}
