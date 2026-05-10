import { FlowHistoryService } from '../services/flow-history.service';
import { AuditLogService } from '../services/audit-log.service';
export declare class HistoryController {
    private readonly flowHistoryService;
    private readonly auditLogService;
    constructor(flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    getFlowHistory(certificateNumber: string): Promise<{
        histories: import("../entities/flow-history.entity").FlowHistory[];
        statusChanges: Array<{
            from: string;
            to: string;
            action: string;
            operator: string;
            time: Date;
        }>;
        hasManualCorrection: boolean;
        lastManualCorrection?: import("../entities/flow-history.entity").FlowHistory;
    }>;
    getFlowHistoryById(certificateId: string): Promise<import("../entities/flow-history.entity").FlowHistory[]>;
    getManualCorrectionHistory(certificateId: string): Promise<import("../entities/flow-history.entity").FlowHistory[]>;
    getEntityAuditLog(entityType: string, entityId: string): Promise<import("../entities/audit-log.entity").AuditLog[]>;
}
