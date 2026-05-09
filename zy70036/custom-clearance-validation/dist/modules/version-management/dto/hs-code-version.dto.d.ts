import { HsCodeSource } from '../../../entities/hs-code-version.entity';
declare class HsCodeItemDto {
    hsCode: string;
    description?: string;
    productName: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    totalAmount: number;
    currency?: string;
}
export declare class CreateHsCodeVersionDto {
    batchId: string;
    source: HsCodeSource;
    items: HsCodeItemDto[];
    remarks?: string;
}
export declare class HsCodeVersionFilterDto {
    batchId?: string;
    source?: HsCodeSource;
}
export {};
