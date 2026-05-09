import { ClearanceBatchStatus } from '../../../entities/clearance-batch.entity';
export declare class CreateClearanceBatchDto {
    batchNumber: string;
    shipmentNumber: string;
    originCountry?: string;
    destinationCountry?: string;
    remarks?: string;
}
export declare class UpdateClearanceBatchDto {
    shipmentNumber?: string;
    originCountry?: string;
    destinationCountry?: string;
    status?: ClearanceBatchStatus;
    remarks?: string;
}
export declare class ClearanceBatchFilterDto {
    batchNumber?: string;
    shipmentNumber?: string;
    status?: ClearanceBatchStatus;
}
