import { RuleVersion, RuleVersionStatus } from '../types';
export interface CreateRuleVersionRequest {
    ruleId: string;
    ruleName: string;
    content: string;
    description?: string;
    createdBy: string;
}
export interface UpdateRuleVersionRequest {
    ruleName?: string;
    content?: string;
    description?: string;
    updatedBy: string;
}
export interface SubmitApprovalRequest {
    operator: string;
    comment?: string;
}
export interface ApproveRequest {
    operator: string;
    comment?: string;
}
export interface RejectRequest {
    operator: string;
    reason: string;
}
export interface PublishRequest {
    operator: string;
    comment?: string;
}
export interface ArchiveRequest {
    operator: string;
    reason?: string;
}
export declare function createRuleVersion(request: CreateRuleVersionRequest): Promise<RuleVersion>;
export declare function getRuleVersionById(id: string): Promise<RuleVersion | null>;
export declare function getLatestRuleVersion(ruleId: string): Promise<RuleVersion | null>;
export declare function listRuleVersions(ruleId?: string, options?: {
    page?: number;
    pageSize?: number;
    status?: RuleVersionStatus;
}): Promise<{
    versions: RuleVersion[];
    total: number;
}>;
export declare function updateRuleVersion(id: string, request: UpdateRuleVersionRequest): Promise<RuleVersion>;
export declare function submitForApproval(id: string, request: SubmitApprovalRequest): Promise<RuleVersion>;
export declare function approveRuleVersion(id: string, request: ApproveRequest): Promise<RuleVersion>;
export declare function rejectRuleVersion(id: string, request: RejectRequest): Promise<RuleVersion>;
export declare function publishRuleVersion(id: string, request: PublishRequest): Promise<RuleVersion>;
export declare function archiveRuleVersion(id: string, request: ArchiveRequest): Promise<RuleVersion>;
export declare function getRuleVersionStatusInfo(status: RuleVersionStatus): {
    status: RuleVersionStatus;
    description: string;
    allowedTransitions: {
        status: RuleVersionStatus;
        description: string;
    }[];
};
//# sourceMappingURL=ruleVersionService.d.ts.map