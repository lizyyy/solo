export declare class Batch {
    id: string;
    batchNumber: string;
    batchName: string;
    status: string;
    certificateCount: number;
    totalAnimals: number;
    totalWeight: number;
    destination: string;
    scheduledTransportDate: Date;
    vehiclePlateNumber: string;
    driverName: string;
    driverPhone: string;
    hasDuplicateCertificates: boolean;
    remarks: string;
    metadata: Record<string, any>;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
}
