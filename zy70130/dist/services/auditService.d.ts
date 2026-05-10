import { AuditLog, FreezeRecord, FreezeType } from '../types';
export declare class AuditService {
    logAudit(action: string, actorId: string, actorType: AuditLog['actorType'], targetType: string, targetId: string, beforeState: string, afterState: string, requestId: string): AuditLog;
    getAuditLogsByTarget(targetType: string, targetId: string): AuditLog[];
    getAuditLogsByActor(actorId: string): AuditLog[];
    getAuditLogsByAction(action: string): AuditLog[];
    freezeTarget(targetType: FreezeType, targetId: string, reason: string, operatorId: string): FreezeRecord;
    unfreezeTarget(targetType: FreezeType, targetId: string, operatorId: string): FreezeRecord;
    isTargetFrozen(targetType: FreezeType, targetId: string): boolean;
    getActiveFreeze(targetType: FreezeType, targetId: string): FreezeRecord | null;
    getFreezeHistory(targetType: FreezeType, targetId: string): FreezeRecord[];
}
export declare const auditService: AuditService;
