import { Repository } from 'typeorm';
import { ReviewTask } from '../entities/review-task.entity';
import { ProcessingResult, UserContext, PaginatedResult } from '../../../common/types';
import { CreateReviewTaskDto, ResolveReviewTaskDto, ReviewQueryDto } from '../dto/review.dto';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
export declare class ReviewService {
    private readonly reviewRepository;
    private readonly flowHistoryService;
    private readonly auditLogService;
    private readonly logger;
    constructor(reviewRepository: Repository<ReviewTask>, flowHistoryService: FlowHistoryService, auditLogService: AuditLogService);
    createTask(dto: CreateReviewTaskDto, user: UserContext): Promise<ProcessingResult<ReviewTask>>;
    resolveTask(dto: ResolveReviewTaskDto, user: UserContext): Promise<ProcessingResult<ReviewTask>>;
    findById(id: string): Promise<ReviewTask>;
    query(query: ReviewQueryDto): Promise<PaginatedResult<ReviewTask>>;
    getStatistics(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
        byReason: Record<string, number>;
    }>;
    resolveDuplicateConflict(taskId: string, user: UserContext): Promise<ProcessingResult<ReviewTask>>;
}
