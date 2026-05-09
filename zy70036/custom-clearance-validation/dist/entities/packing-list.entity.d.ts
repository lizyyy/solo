import { ClearanceBatch } from './clearance-batch.entity';
import { DocumentStatus } from './invoice.entity';
export declare class PackingList {
    id: string;
    batch: ClearanceBatch;
    batchId: string;
    packingListNumber: string;
    version: number;
    packingDate: string;
    shipperName: string;
    consigneeName: string;
    totalPackages: number;
    totalGrossWeight: number;
    totalNetWeight: number;
    totalVolume: number;
    weightUnit: string;
    volumeUnit: string;
    status: DocumentStatus;
    items: Array<{
        lineNumber: number;
        hsCode: string;
        productName: string;
        quantity: number;
        unit: string;
        packages: number;
        grossWeight: number;
        netWeight: number;
        volume: number;
    }>;
    remarks: string;
    createdAt: Date;
    updatedAt: Date;
}
