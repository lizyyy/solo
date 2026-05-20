export interface Student {
    id: string;
    studentId: string;
    name: string;
    className: string;
    grade: string;
    parentPhone?: string;
}
export interface HealthCheckRecord {
    id: string;
    studentId: string;
    studentName: string;
    checkDate: string;
    temperature: number;
    hasSymptoms: boolean;
    symptoms?: string[];
    isIsolated: boolean;
    checker: string;
    notes?: string;
    source: 'csv' | 'manual';
}
export type MedicationCategory = '退烧药' | '感冒药' | '肠胃药' | '抗过敏药' | '外用药' | '其他';
export interface MedicationAuthorization {
    id: string;
    studentId: string;
    studentName: string;
    medicationName: string;
    category: MedicationCategory;
    dosage: string;
    frequency: string;
    expirationDate: string;
    parentConfirmed: boolean;
    confirmedDate?: string;
    authorizedBy: string;
    effectiveDate: string;
    expiryDate: string;
}
export type DiscrepancyType = 'FEVER_DETECTED' | 'OVERDUE_MEDICATION' | 'PARENT_NOT_CONFIRMED' | 'STUDENT_NOT_IN_CLASS' | 'MEDICATION_NOT_RECORDED' | 'SYMPTOMS_UNCHECKED' | 'DATA_MISMATCH';
export type RecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO';
export interface Discrepancy {
    id: string;
    type: DiscrepancyType;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    explanation: string;
    relatedRecordId?: string;
    relatedRecordType?: 'healthCheck' | 'medication' | 'student';
}
export interface ReconciliationResult {
    id: string;
    reconciliationDate: string;
    studentId: string;
    studentName: string;
    className: string;
    healthCheck?: HealthCheckRecord;
    medication?: MedicationAuthorization;
    student: Student;
    discrepancies: Discrepancy[];
    status: RecordStatus;
    reviewNotes?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    version: number;
}
export interface ReviewAction {
    resultId: string;
    action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'MODIFY';
    reviewer: string;
    notes?: string;
    modifications?: {
        field: string;
        oldValue: any;
        newValue: any;
        reason: string;
    }[];
}
export interface SummaryStatistics {
    totalStudents: number;
    totalChecked: number;
    pending: number;
    approved: number;
    rejected: number;
    needsMoreInfo: number;
    feverCases: number;
    overdueMedications: number;
    unconfirmedMedications: number;
    discrepanciesByType: Record<DiscrepancyType, number>;
}
export interface ExportReport {
    summary: SummaryStatistics;
    results: ReconciliationResult[];
    generatedAt: string;
    generatedBy: string;
}
