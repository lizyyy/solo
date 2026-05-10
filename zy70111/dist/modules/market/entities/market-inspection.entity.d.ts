import { MarketInspectionResult } from '../../../common/types';
export declare class MarketInspection {
    id: string;
    certificateNumber: string;
    certificateId: string;
    transportRecordId: string;
    batchNumber: string;
    marketName: string;
    marketId: string;
    merchantName: string;
    merchantId: string;
    result: MarketInspectionResult;
    inspectedAt: Date;
    inspectorId: string;
    inspectorName: string;
    inspectedQuantity: number;
    inspectedWeight: number;
    issuesFound: string;
    measuresTaken: string;
    remarks: string;
    metadata: Record<string, any>;
    createdAt: Date;
}
