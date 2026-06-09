export type EquipmentIdStatus = 'canonical' | 'normalized' | 'ambiguous' | 'duplicate' | 'unknown';
export interface EquipmentIdMapping {
    canonicalId: string;
    aliases: string[];
    projectId: string;
    description?: string;
}
export interface NormalizedEquipmentId {
    raw: string;
    canonical: string | null;
    status: EquipmentIdStatus;
    candidates: string[];
    confidence: number;
}
export interface InspectionRecord {
    id: string;
    inspectionDate: string;
    rawEquipmentId: string;
    inspector: string;
    itemName: string;
    measuredValue: number;
    unit: string;
    remark?: string;
    createdAt: string;
}
export type WarningLevel = 'normal' | 'attention' | 'warning' | 'critical';
export interface ThresholdRule {
    itemName: string;
    unit: string;
    thresholds: {
        attention?: number;
        warning?: number;
        critical?: number;
    };
    direction: 'upper' | 'lower' | 'both';
    description: string;
}
export interface WarningDetail {
    recordId: string;
    inspectionDate: string;
    equipmentId: string;
    rawEquipmentId: string;
    itemName: string;
    measuredValue: number;
    unit: string;
    level: WarningLevel;
    thresholdBreached: {
        ruleName: string;
        limit: number;
        direction: 'above' | 'below';
    } | null;
    evidenceGap: EvidenceGap[];
}
export interface EvidenceGap {
    type: 'no_previous_record' | 'equipment_not_confirmed' | 'threshold_not_defined' | 'inspection_remark_missing' | 'followup_needed';
    description: string;
    priority: 'high' | 'medium' | 'low';
}
export interface WarningResultSet {
    generatedAt: string;
    filterCriteria: FilterCriteria;
    statistics: WarningStatistics;
    details: WarningDetail[];
    anomalyQueue: AnomalyQueueItem[];
    judgmentChanges: JudgmentChange[];
}
export interface FilterCriteria {
    dateRange: {
        start: string;
        end: string;
    } | null;
    projectId: string | null;
    equipmentIds: string[] | null;
    warningLevels: WarningLevel[] | null;
    includeSuspended: boolean;
}
export interface WarningStatistics {
    totalInspections: number;
    totalEquipments: number;
    byLevel: Record<WarningLevel, number>;
    suspendedCount: number;
    evidenceGapCount: number;
    byEquipment: Record<string, number>;
}
export type AnomalyStatus = 'pending_confirmation' | 'confirmed_warning' | 'false_alarm' | 'resolved' | 'transferred';
export interface AnomalyQueueItem {
    id: string;
    warningDetailId: string;
    equipmentId: string;
    rawEquipmentIds: string[];
    level: WarningLevel;
    status: AnomalyStatus;
    suspensionReason?: 'duplicate_equipment' | 'ambiguous_equipment' | 'judgment_change_review';
    assignedTo: 'project_manager' | 'assistant_xiaolin' | 'developer';
    createdAt: string;
    updatedAt: string;
    history: AnomalyStatusLog[];
}
export interface AnomalyStatusLog {
    timestamp: string;
    from: AnomalyStatus | null;
    to: AnomalyStatus;
    operator: string;
    comment?: string;
}
export interface JudgmentChange {
    id: string;
    equipmentId: string;
    itemName: string;
    previousJudgment: {
        level: WarningLevel;
        conclusion: string;
        basis: string;
    } | null;
    currentJudgment: {
        level: WarningLevel;
        conclusion: string;
        basis: string;
    };
    changeReason: 'equipment_id_unified' | 'threshold_updated' | 'new_evidence' | 'false_stability_removed';
    affectedRecordIds: string[];
    remarkForReview?: string;
}
export interface ManagerDashboardView {
    overview: WarningStatistics;
    summaryBreakdown: {
        level: WarningLevel;
        count: number;
        equipmentCount: number;
        evidenceGapSummary: {
            type: EvidenceGap['type'];
            count: number;
        }[];
        drillDownFilter: Partial<FilterCriteria>;
    }[];
    pendingConfirmations: {
        queueId: string;
        rawEquipmentIds: string[];
        candidateCanonicalIds: string[];
        affectedWarningCount: number;
        riskOfFalseStability: string;
    }[];
    outstandingEvidenceGaps: {
        gapType: EvidenceGap['type'];
        count: number;
        relatedEquipments: string[];
        suggestedAction: string;
    }[];
}
export interface HandoverChecklistItem {
    step: number;
    description: string;
    completed: boolean;
    relatedInspectionRecordIds: string[];
    relatedAnomalyQueueIds: string[];
    evidence?: string;
}
export interface HandoverPackage {
    generatedAt: string;
    generatedFor: 'assistant_xiaolin';
    checklist: HandoverChecklistItem[];
    inspectionIndex: {
        inspectionRecordId: string;
        rawEquipmentId: string;
        canonicalEquipmentId: string | null;
        anomalyQueueIds: string[];
        judgmentChangeIds: string[];
    }[];
    pendingActionCount: number;
    completedActionCount: number;
}
