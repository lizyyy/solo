export declare class CreateBatchDto {
    batchNumber: string;
    batchName: string;
    destination: string;
    scheduledTransportDate: Date;
    vehiclePlateNumber?: string;
    driverName?: string;
    driverPhone?: string;
    remarks?: string;
}
export declare class BindCertificatesDto {
    batchId: string;
    certificateIds: string[];
}
export declare class UnbindCertificatesDto {
    batchId: string;
    certificateIds: string[];
    reason: string;
}
export declare class BatchQueryDto {
    batchNumber?: string;
    status?: string[];
    destination?: string;
    hasDuplicateCertificates?: boolean;
    page?: number;
    pageSize?: number;
}
