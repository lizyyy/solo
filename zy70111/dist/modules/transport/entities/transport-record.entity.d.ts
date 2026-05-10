import { TransportStatus } from '../../../common/types';
export declare class TransportRecord {
    id: string;
    transportNumber: string;
    batchId: string;
    batchNumber: string;
    status: TransportStatus;
    origin: string;
    destination: string;
    route: string;
    vehiclePlateNumber: string;
    driverName: string;
    driverPhone: string;
    departureTime: Date;
    estimatedArrivalTime: Date;
    actualArrivalTime: Date;
    verifiedAt: Date;
    verifiedBy: string;
    verifiedByName: string;
    verificationRemarks: string;
    hasAnomaly: boolean;
    anomalyDescription: string;
    remarks: string;
    metadata: Record<string, any>;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
}
