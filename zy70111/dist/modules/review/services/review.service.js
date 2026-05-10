"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReviewService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const review_task_entity_1 = require("../entities/review-task.entity");
const types_1 = require("../../../common/types");
const flow_history_service_1 = require("../../history/services/flow-history.service");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let ReviewService = ReviewService_1 = class ReviewService {
    constructor(reviewRepository, flowHistoryService, auditLogService) {
        this.reviewRepository = reviewRepository;
        this.flowHistoryService = flowHistoryService;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(ReviewService_1.name);
    }
    async createTask(dto, user) {
        const task = this.reviewRepository.create({
            ...dto,
            taskNumber: `REV-${Date.now()}`,
            status: types_1.ReviewStatus.PENDING,
            priority: dto.priority || types_1.ReviewPriority.MEDIUM,
            createdBy: user.userId,
            createdByName: user.userName,
        });
        const savedTask = await this.reviewRepository.save(task);
        await this.auditLogService.log({
            entityType: types_1.EntityType.REVIEW_TASK,
            entityId: savedTask.id,
            entityNumber: savedTask.taskNumber,
            action: 'CREATE',
            description: `创建复核任务: ${dto.reasonCode}`,
            user,
            afterData: { ...savedTask },
        });
        return {
            success: true,
            data: savedTask,
            needsReview: true,
            reviewReason: dto.reasonCode,
            reviewPriority: savedTask.priority,
            message: `复核任务已创建，需要人工处理`,
        };
    }
    async resolveTask(dto, user) {
        const task = await this.reviewRepository.findOne({
            where: { id: dto.taskId },
        });
        if (!task) {
            throw new Error('复核任务不存在');
        }
        const beforeData = { ...task };
        task.status = dto.status || types_1.ReviewStatus.RESOLVED;
        task.conclusion = dto.conclusion;
        task.resolutionActions = dto.resolutionActions;
        task.assigneeId = user.userId;
        task.assigneeName = user.userName;
        task.assignedAt = new Date();
        task.resolvedAt = new Date();
        task.remarks = dto.remarks;
        const savedTask = await this.reviewRepository.save(task);
        await this.auditLogService.log({
            entityType: types_1.EntityType.REVIEW_TASK,
            entityId: savedTask.id,
            entityNumber: savedTask.taskNumber,
            action: 'RESOLVE',
            description: `复核任务处理完成: ${dto.conclusion}`,
            user,
            beforeData,
            afterData: { ...savedTask },
            requestData: dto,
        });
        return {
            success: true,
            data: savedTask,
            needsReview: false,
            message: '复核任务已处理完成',
        };
    }
    async findById(id) {
        const task = await this.reviewRepository.findOne({ where: { id } });
        if (!task) {
            throw new Error('复核任务不存在');
        }
        return task;
    }
    async query(query) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const qb = this.reviewRepository.createQueryBuilder('task');
        if (query.status?.length) {
            qb.andWhere('task.status IN (:...status)', { status: query.status });
        }
        if (query.priority?.length) {
            qb.andWhere('task.priority IN (:...priority)', { priority: query.priority });
        }
        if (query.reasonCode) {
            qb.andWhere('task.reasonCode = :reasonCode', { reasonCode: query.reasonCode });
        }
        if (query.certificateNumber) {
            qb.andWhere('task.certificateNumber LIKE :certNumber', {
                certNumber: `%${query.certificateNumber}%`,
            });
        }
        if (query.assigneeId) {
            qb.andWhere('task.assigneeId = :assigneeId', { assigneeId: query.assigneeId });
        }
        const [items, total] = await qb
            .orderBy('task.priority', 'DESC')
            .addOrderBy('task.createdAt', 'DESC')
            .skip(skip)
            .take(pageSize)
            .getManyAndCount();
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async getStatistics() {
        const [total, statusStats, priorityStats, reasonStats] = await Promise.all([
            this.reviewRepository.count(),
            this.reviewRepository
                .createQueryBuilder('task')
                .select('task.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('task.status')
                .getRawMany(),
            this.reviewRepository
                .createQueryBuilder('task')
                .select('task.priority', 'priority')
                .addSelect('COUNT(*)', 'count')
                .groupBy('task.priority')
                .getRawMany(),
            this.reviewRepository
                .createQueryBuilder('task')
                .select('task.reasonCode', 'reasonCode')
                .addSelect('COUNT(*)', 'count')
                .groupBy('task.reasonCode')
                .getRawMany(),
        ]);
        return {
            total,
            byStatus: statusStats.reduce((acc, item) => ({ ...acc, [item.status]: Number(item.count) }), {}),
            byPriority: priorityStats.reduce((acc, item) => ({ ...acc, [item.priority]: Number(item.count) }), {}),
            byReason: reasonStats.reduce((acc, item) => ({ ...acc, [item.reasonCode]: Number(item.count) }), {}),
        };
    }
    async resolveDuplicateConflict(taskId, user) {
        const task = await this.findById(taskId);
        const resolution = {
            ...task,
        };
        return this.resolveTask({
            taskId,
            conclusion: '已人工确认',
            status: types_1.ReviewStatus.RESOLVED,
        }, user);
    }
};
exports.ReviewService = ReviewService;
exports.ReviewService = ReviewService = ReviewService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(review_task_entity_1.ReviewTask)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        flow_history_service_1.FlowHistoryService,
        audit_log_service_1.AuditLogService])
], ReviewService);
//# sourceMappingURL=review.service.js.map