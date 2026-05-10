import { MarketService } from '../services/market.service';
import { MarketInspectionDto, MarketQueryDto } from '../dto/market.dto';
import { UserContext } from '../../../common/types';
export declare class MarketController {
    private readonly marketService;
    constructor(marketService: MarketService);
    inspect(dto: MarketInspectionDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<{
        inspection: import("../entities/market-inspection.entity").MarketInspection;
        certificate?: import("../../certificate/entities/certificate.entity").Certificate;
        warnings: string[];
    }>>;
    getById(id: string): Promise<import("../entities/market-inspection.entity").MarketInspection>;
    query(query: MarketQueryDto): Promise<import("../../../common/types").PaginatedResult<import("../entities/market-inspection.entity").MarketInspection>>;
}
