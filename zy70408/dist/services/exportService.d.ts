import { AttachmentRevision, ApprovalNode } from '../types';
export declare class ExportService {
    createAttachmentRevision(recordId: string, detailItemId: string, attachmentName: string, beforeValue: string, afterValue: string, modifiedBy: string, approvalNodeId?: string | null): Promise<string>;
    getAttachmentRevisions(recordId: string): Promise<AttachmentRevision[]>;
    createApprovalNode(recordId: string, nodeName: string, nodeOrder: number, approver: string): Promise<string>;
    approveNode(nodeId: string, approver: string, comment: string): Promise<void>;
    getApprovalNodes(recordId: string): Promise<ApprovalNode[]>;
    exportInitRecord(recordId: string): Promise<string>;
    exportDeviceLedger(tenantId: string): Promise<string>;
}
export declare const exportService: ExportService;
