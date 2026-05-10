import { BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
export declare class CertificateNotFoundException extends NotFoundException {
    constructor(certificateNumber: string);
}
export declare class DuplicateCertificateException extends ConflictException {
    constructor(certificateNumber: string, existingCount: number);
}
export declare class InvalidStatusTransitionException extends BadRequestException {
    constructor(from: string, to: string, reason?: string);
}
export declare class BatchAlreadyBoundException extends ConflictException {
    constructor(certificateNumber: string, batchId: string);
}
export declare class BatchNotFoundException extends NotFoundException {
    constructor(batchId: string);
}
export declare class TransportNotFoundException extends NotFoundException {
    constructor(transportId: string);
}
export declare class CertificateAlreadyVoidedException extends BadRequestException {
    constructor(certificateNumber: string);
}
export declare class ManualCorrectionConflictException extends ConflictException {
    constructor(certificateNumber: string);
}
export declare class ProcessingException extends InternalServerErrorException {
    constructor(message: string, context?: any);
}
