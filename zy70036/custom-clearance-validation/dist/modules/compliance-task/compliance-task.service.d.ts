import { Repository } from 'typeorm';
import { ComplianceTask } from '../../entities/compliance-task.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import { CreateComplianceTaskDto, UpdateComplianceTaskDto, ComplianceTaskFilterDto } from './dto/compliance-task.dto';
import { MissingComponentService } from '../missing-component/missing-component.service';
export declare class ComplianceTaskService {
    private readonly taskRepository;
    private readonly batchService;
    private readonly missingComponentService;
    constructor(taskRepository: Repository<ComplianceTask>, batchService: ClearanceBatchService, missingComponentService: MissingComponentService);
    create(dto: CreateComplianceTaskDto): Promise<ComplianceTask>;
    createFromMissingDetection(batchId: string): Promise<ComplianceTask[]>;
    private getPriorityOrder;
    private getComponentTypeLabel;
    findAll(filter: ComplianceTaskFilterDto): Promise<ComplianceTask[]>;
    findOne(id: string): Promise<ComplianceTask>;
    findByBatch(batchId: string): Promise<ComplianceTask[]>;
    update(id: string, dto: UpdateComplianceTaskDto): Promise<ComplianceTask>;
    resolve(id: string, resolutionNotes?: string): Promise<ComplianceTask>;
    cancel(id: string): Promise<ComplianceTask>;
    getTaskStats(batchId: string): Promise<{
        total: number;
        pending: number;
        inProgress: number;
        resolved: number;
        cancelled: number;
        critical: number;
    }>;
}
