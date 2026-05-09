import { ComplianceTaskService } from './compliance-task.service';
import { CreateComplianceTaskDto, UpdateComplianceTaskDto, ComplianceTaskFilterDto } from './dto/compliance-task.dto';
import { ComplianceTask } from '../../entities/compliance-task.entity';
export declare class ComplianceTaskController {
    private readonly taskService;
    constructor(taskService: ComplianceTaskService);
    create(dto: CreateComplianceTaskDto): Promise<ComplianceTask>;
    createFromDetection(batchId: string): Promise<ComplianceTask[]>;
    findAll(filter: ComplianceTaskFilterDto): Promise<ComplianceTask[]>;
    findByBatch(batchId: string): Promise<ComplianceTask[]>;
    getStats(batchId: string): Promise<{
        total: number;
        pending: number;
        inProgress: number;
        resolved: number;
        cancelled: number;
        critical: number;
    }>;
    findOne(id: string): Promise<ComplianceTask>;
    update(id: string, dto: UpdateComplianceTaskDto): Promise<ComplianceTask>;
    resolve(id: string, body?: {
        resolutionNotes?: string;
    }): Promise<ComplianceTask>;
    cancel(id: string): Promise<ComplianceTask>;
}
