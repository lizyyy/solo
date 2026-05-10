import { ReviewService } from '../services/review.service';
import { CreateReviewTaskDto, ResolveReviewTaskDto, ReviewQueryDto } from '../dto/review.dto';
import { UserContext } from '../../../common/types';
export declare class ReviewController {
    private readonly reviewService;
    constructor(reviewService: ReviewService);
    createTask(dto: CreateReviewTaskDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/review-task.entity").ReviewTask>>;
    resolveTask(dto: ResolveReviewTaskDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/review-task.entity").ReviewTask>>;
    getById(id: string): Promise<import("../entities/review-task.entity").ReviewTask>;
    query(query: ReviewQueryDto): Promise<import("../../../common/types").PaginatedResult<import("../entities/review-task.entity").ReviewTask>>;
    getStatistics(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
        byReason: Record<string, number>;
    }>;
}
