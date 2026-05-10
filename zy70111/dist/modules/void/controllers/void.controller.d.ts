import { VoidService } from '../services/void.service';
import { VoidCertificateDto, ReissueCertificateDto } from '../dto/void.dto';
import { UserContext } from '../../../common/types';
export declare class VoidController {
    private readonly voidService;
    constructor(voidService: VoidService);
    voidCertificate(dto: VoidCertificateDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        voidRecord: import("../entities/void-record.entity").VoidRecord;
        certificate: import("../../certificate/entities/certificate.entity").Certificate;
        reissuedCertificate?: import("../../certificate/entities/certificate.entity").Certificate;
    }>>;
    reissueCertificate(dto: ReissueCertificateDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        originalCertificate: import("../../certificate/entities/certificate.entity").Certificate;
        newCertificate: import("../../certificate/entities/certificate.entity").Certificate;
    }>>;
    getByCertificateId(certificateId: string): Promise<import("../entities/void-record.entity").VoidRecord[]>;
    getByCertificateNumber(certificateNumber: string): Promise<import("../entities/void-record.entity").VoidRecord[]>;
}
