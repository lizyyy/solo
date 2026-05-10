import { TransportService } from '../services/transport.service';
import { CreateTransportDto, VerifyTransportDto, TransportQueryDto } from '../dto/transport.dto';
import { UserContext } from '../../../common/types';
export declare class TransportController {
    private readonly transportService;
    constructor(transportService: TransportService);
    create(dto: CreateTransportDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        transport: import("../entities/transport-record.entity").TransportRecord;
        certificates: import("../../certificate/entities/certificate.entity").Certificate[];
        hasDuplicates: boolean;
        duplicateCertificates: string[];
    }>>;
    verify(dto: VerifyTransportDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        transport: import("../entities/transport-record.entity").TransportRecord;
        verifiedCount: number;
        warnings: string[];
    }>>;
    getDetail(transportId: string): Promise<import("../../../common/types").ProcessingResult<{
        transport: import("../entities/transport-record.entity").TransportRecord;
        certificates: import("../../certificate/entities/certificate.entity").Certificate[];
        hasDuplicates: boolean;
        duplicateCertificates: string[];
    }>>;
    getById(id: string): Promise<import("../entities/transport-record.entity").TransportRecord>;
    query(query: TransportQueryDto): Promise<import("../../../common/types").PaginatedResult<import("../entities/transport-record.entity").TransportRecord>>;
}
