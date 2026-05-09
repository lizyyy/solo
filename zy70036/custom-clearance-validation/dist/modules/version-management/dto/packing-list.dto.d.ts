import { DocumentStatus } from '../../../entities/invoice.entity';
declare class PackingListItemDto {
    lineNumber: number;
    hsCode: string;
    productName: string;
    quantity: number;
    unit?: string;
    packages?: number;
    grossWeight?: number;
    netWeight?: number;
    volume?: number;
}
export declare class CreatePackingListDto {
    packingListNumber: string;
    batchId: string;
    packingDate?: string;
    shipperName?: string;
    consigneeName?: string;
    totalPackages: number;
    totalGrossWeight: number;
    totalNetWeight: number;
    totalVolume: number;
    weightUnit?: string;
    volumeUnit?: string;
    status?: DocumentStatus;
    items: PackingListItemDto[];
    remarks?: string;
}
export declare class UpdatePackingListDto {
    packingDate?: string;
    shipperName?: string;
    consigneeName?: string;
    totalPackages?: number;
    totalGrossWeight?: number;
    totalNetWeight?: number;
    totalVolume?: number;
    weightUnit?: string;
    volumeUnit?: string;
    status?: DocumentStatus;
    items?: PackingListItemDto[];
    remarks?: string;
}
export declare class PackingListFilterDto {
    batchId?: string;
    packingListNumber?: string;
    status?: DocumentStatus;
}
export {};
