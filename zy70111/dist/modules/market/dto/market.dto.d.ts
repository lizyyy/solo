import { MarketInspectionResult } from '../../../common/types';
export declare class MarketInspectionDto {
    certificateNumber: string;
    certificateId?: string;
    transportRecordId?: string;
    marketName: string;
    marketId?: string;
    merchantName: string;
    merchantId?: string;
    result: MarketInspectionResult;
    inspectedAt: Date;
    inspectedQuantity: number;
    inspectedWeight?: number;
    issuesFound?: string;
    measuresTaken?: string;
    remarks?: string;
}
export declare class MarketQueryDto {
    certificateNumber?: string;
    result?: string[];
    marketName?: string;
    merchantName?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
}
