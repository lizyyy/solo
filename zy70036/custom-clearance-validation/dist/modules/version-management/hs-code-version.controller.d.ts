import { HsCodeVersionService } from './hs-code-version.service';
import { CreateHsCodeVersionDto, HsCodeVersionFilterDto } from './dto/hs-code-version.dto';
import { HsCodeVersion } from '../../entities/hs-code-version.entity';
export declare class HsCodeVersionController {
    private readonly hsCodeService;
    constructor(hsCodeService: HsCodeVersionService);
    create(dto: CreateHsCodeVersionDto): Promise<HsCodeVersion[]>;
    findAll(filter: HsCodeVersionFilterDto): Promise<HsCodeVersion[]>;
    findActiveByBatch(batchId: string): Promise<HsCodeVersion[]>;
}
