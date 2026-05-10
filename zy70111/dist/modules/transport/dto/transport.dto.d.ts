export declare class CreateTransportDto {
    transportNumber: string;
    batchId: string;
    origin: string;
    destination: string;
    route?: string;
    vehiclePlateNumber: string;
    driverName: string;
    driverPhone: string;
    departureTime: Date;
    estimatedArrivalTime?: Date;
    remarks?: string;
}
export declare class VerifyTransportDto {
    transportId: string;
    actualArrivalTime?: Date;
    verificationRemarks?: string;
    hasAnomaly?: boolean;
    anomalyDescription?: string;
    certificateIds?: string[];
}
export declare class TransportQueryDto {
    transportNumber?: string;
    batchNumber?: string;
    status?: string[];
    vehiclePlateNumber?: string;
    hasAnomaly?: boolean;
    page?: number;
    pageSize?: number;
}
