import { ClearanceReportService } from './clearance-report.service';
import { ClearanceReport } from '../../entities/clearance-report.entity';
export declare class ClearanceReportController {
    private readonly reportService;
    constructor(reportService: ClearanceReportService);
    generate(batchId: string): Promise<ClearanceReport>;
    findAll(batchId?: string): Promise<ClearanceReport[]>;
    findByBatch(batchId: string): Promise<ClearanceReport[]>;
    findLatestByBatch(batchId: string): Promise<ClearanceReport | null>;
    findOne(id: string): Promise<ClearanceReport>;
}
