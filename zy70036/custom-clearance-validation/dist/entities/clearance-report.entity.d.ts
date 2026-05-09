import { ClearanceBatch } from './clearance-batch.entity';
export declare enum ReportStatus {
    DRAFT = "draft",
    GENERATING = "generating",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare enum OverallStatus {
    PASSED = "passed",
    WARNING = "warning",
    BLOCKED = "blocked"
}
export declare class ClearanceReport {
    id: string;
    batch: ClearanceBatch;
    batchId: string;
    reportNumber: string;
    version: number;
    status: ReportStatus;
    overallStatus: OverallStatus;
    versionSummary: {
        hsCodeVersions: number;
        invoiceVersions: number;
        packingListVersions: number;
        isVersionConsistent: boolean;
    };
    hsCodeValidation: {
        totalItems: number;
        validCodes: number;
        invalidCodes: number;
        mismatchedCodes: number;
        pendingCodes: number;
        details: Array<{
            hsCode: string;
            productName: string;
            status: string;
            message: string;
        }>;
    };
    packingListComparison: {
        isConsistent: boolean;
        invoiceVsPackingList: {
            quantityMatch: boolean;
            quantityDifference: number;
            itemCountMatch: boolean;
            mismatchedItems: Array<{
                hsCode: string;
                productName: string;
                invoiceQuantity: number;
                packingListQuantity: number;
                difference: number;
            }>;
        };
        weightSummary: {
            totalGrossWeight: number;
            totalNetWeight: number;
            unit: string;
        };
    };
    missingComponents: {
        isBlocked: boolean;
        missingCount: number;
        criticalMissing: number;
        details: Array<{
            componentType: string;
            lineNumber: number;
            hsCode: string;
            productName: string;
            issue: string;
            priority: string;
        }>;
    };
    complianceTasks: {
        totalTasks: number;
        pendingTasks: number;
        inProgressTasks: number;
        resolvedTasks: number;
        criticalTasks: number;
    };
    recommendations: string;
    generatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
