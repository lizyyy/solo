import { MissingComponentService, MissingComponentResult } from './missing-component.service';
export declare class MissingComponentController {
    private readonly missingComponentService;
    constructor(missingComponentService: MissingComponentService);
    detect(batchId: string): Promise<MissingComponentResult>;
    getResult(batchId: string): Promise<MissingComponentResult>;
}
