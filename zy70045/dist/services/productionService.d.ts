import { ProductionRecord, WasteRecord, ProductionStatus, WasteStatus } from '../models/types';
export declare class ProductionService {
    addProduction(params: {
        shiftId: string;
        productId: string;
        productName: string;
        quantity: number;
        createdBy: string;
        timestamp?: Date;
    }): ProductionRecord;
    addWaste(params: {
        shiftId: string;
        productId: string;
        productName: string;
        quantity: number;
        reason: string;
        createdBy: string;
        timestamp?: Date;
    }): WasteRecord;
    confirmProduction(id: string): ProductionRecord;
    confirmWaste(id: string): WasteRecord;
    getShiftProductions(shiftId: string): {
        records: ProductionRecord[];
        statuses: Record<ProductionStatus, number>;
        total: number;
    };
    getShiftWastes(shiftId: string): {
        records: WasteRecord[];
        statuses: Record<WasteStatus, number>;
        total: number;
    };
    calculateShiftSummary(shiftId: string): {
        productionTotal: number;
        wasteTotal: number;
        netProduction: number;
        wasteRate: number;
    };
    getProductionRecord(id: string): ProductionRecord | undefined;
    getWasteRecord(id: string): WasteRecord | undefined;
}
export declare const productionService: ProductionService;
//# sourceMappingURL=productionService.d.ts.map