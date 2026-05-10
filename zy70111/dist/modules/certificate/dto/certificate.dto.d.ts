import { CertificateSource } from '../../../common/types';
export declare class CreateCertificateDto {
    certificateNumber: string;
    source: CertificateSource;
    farmName: string;
    farmId?: string;
    slaughterhouseName: string;
    slaughterhouseId?: string;
    animalType: string;
    animalQuantity: number;
    totalWeight?: number;
    slaughterDate: Date;
    inspectionDate: Date;
    inspectorName: string;
    metadata?: Record<string, any>;
    remarks?: string;
}
export declare class UpdateCertificateDto {
    farmName?: string;
    slaughterhouseName?: string;
    animalType?: string;
    animalQuantity?: number;
    totalWeight?: number;
    metadata?: Record<string, any>;
    remarks?: string;
}
export declare class ManualCorrectionDto {
    status?: string;
    fields?: Record<string, any>;
    reason: string;
    skipDuplicateCheck?: boolean;
}
export declare class CertificateQueryDto {
    certificateNumber?: string;
    status?: string[];
    source?: string[];
    farmName?: string;
    slaughterhouseName?: string;
    animalType?: string;
    hasDuplicate?: boolean;
    hasManualCorrection?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
}
export declare class ProcessingResultDto {
    success: boolean;
    data?: any;
    needsReview: boolean;
    reviewReason?: string;
    reviewPriority?: string;
    message: string;
    warnings?: string[];
}
