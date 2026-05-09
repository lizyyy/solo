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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceTaskService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const compliance_task_entity_1 = require("../../entities/compliance-task.entity");
const clearance_batch_service_1 = require("../clearance-batch/clearance-batch.service");
const missing_component_service_1 = require("../missing-component/missing-component.service");
let ComplianceTaskService = class ComplianceTaskService {
    taskRepository;
    batchService;
    missingComponentService;
    constructor(taskRepository, batchService, missingComponentService) {
        this.taskRepository = taskRepository;
        this.batchService = batchService;
        this.missingComponentService = missingComponentService;
    }
    async create(dto) {
        await this.batchService.findOne(dto.batchId);
        const task = this.taskRepository.create({
            ...dto,
            status: compliance_task_entity_1.TaskStatus.PENDING,
            priority: dto.priority || compliance_task_entity_1.TaskPriority.MEDIUM,
        });
        return this.taskRepository.save(task);
    }
    async createFromMissingDetection(batchId) {
        const missingResult = await this.missingComponentService.detectMissingComponents(batchId);
        const createdTasks = [];
        const groupedMissing = new Map();
        missingResult.itemLevelMissing.forEach(item => {
            const key = item.componentType;
            if (!groupedMissing.has(key)) {
                groupedMissing.set(key, []);
            }
            groupedMissing.get(key).push(item);
        });
        if (missingResult.documentLevelMissing.missingInvoice) {
            const task = this.taskRepository.create({
                batchId,
                title: '缺少发票',
                description: '批次缺少发票，请补充发票资料',
                componentType: compliance_task_entity_1.MissingComponentType.INVOICE,
                priority: compliance_task_entity_1.TaskPriority.CRITICAL,
                status: compliance_task_entity_1.TaskStatus.PENDING,
            });
            createdTasks.push(await this.taskRepository.save(task));
        }
        if (missingResult.documentLevelMissing.missingPackingList) {
            const task = this.taskRepository.create({
                batchId,
                title: '缺少箱单',
                description: '批次缺少箱单，请补充箱单资料',
                componentType: compliance_task_entity_1.MissingComponentType.PACKING_LIST,
                priority: compliance_task_entity_1.TaskPriority.CRITICAL,
                status: compliance_task_entity_1.TaskStatus.PENDING,
            });
            createdTasks.push(await this.taskRepository.save(task));
        }
        for (const [componentType, items] of groupedMissing.entries()) {
            if (items.length > 0) {
                const highestPriority = items.reduce((max, item) => (this.getPriorityOrder(item.priority) > this.getPriorityOrder(max) ? item.priority : max), items[0].priority);
                const task = this.taskRepository.create({
                    batchId,
                    title: `补充${this.getComponentTypeLabel(componentType)}资料`,
                    description: `发现 ${items.length} 项${this.getComponentTypeLabel(componentType)}资料缺失或不完整`,
                    componentType: componentType,
                    priority: highestPriority,
                    status: compliance_task_entity_1.TaskStatus.PENDING,
                    affectedItems: items.map(item => ({
                        lineNumber: item.lineNumber || 0,
                        hsCode: item.hsCode || '',
                        productName: item.productName || '',
                        issue: item.issue,
                    })),
                });
                createdTasks.push(await this.taskRepository.save(task));
            }
        }
        return createdTasks;
    }
    getPriorityOrder(priority) {
        const order = {
            [compliance_task_entity_1.TaskPriority.LOW]: 1,
            [compliance_task_entity_1.TaskPriority.MEDIUM]: 2,
            [compliance_task_entity_1.TaskPriority.HIGH]: 3,
            [compliance_task_entity_1.TaskPriority.CRITICAL]: 4,
        };
        return order[priority] || 0;
    }
    getComponentTypeLabel(type) {
        const labels = {
            [compliance_task_entity_1.MissingComponentType.HS_CODE]: 'HS编码',
            [compliance_task_entity_1.MissingComponentType.INVOICE]: '发票',
            [compliance_task_entity_1.MissingComponentType.PACKING_LIST]: '箱单',
            [compliance_task_entity_1.MissingComponentType.PRODUCT_INFO]: '商品信息',
            [compliance_task_entity_1.MissingComponentType.WEIGHT]: '重量',
            [compliance_task_entity_1.MissingComponentType.QUANTITY]: '数量',
            [compliance_task_entity_1.MissingComponentType.VALUE]: '价值',
            [compliance_task_entity_1.MissingComponentType.OTHER]: '其他',
        };
        return labels[type] || type;
    }
    async findAll(filter) {
        const queryBuilder = this.taskRepository.createQueryBuilder('task');
        if (filter.batchId) {
            queryBuilder.andWhere('task.batchId = :batchId', { batchId: filter.batchId });
        }
        if (filter.status) {
            queryBuilder.andWhere('task.status = :status', { status: filter.status });
        }
        if (filter.priority) {
            queryBuilder.andWhere('task.priority = :priority', { priority: filter.priority });
        }
        if (filter.componentType) {
            queryBuilder.andWhere('task.componentType = :componentType', { componentType: filter.componentType });
        }
        if (filter.assignee) {
            queryBuilder.andWhere('task.assignee = :assignee', { assignee: filter.assignee });
        }
        queryBuilder.orderBy('task.priority', 'DESC');
        queryBuilder.addOrderBy('task.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findOne(id) {
        const task = await this.taskRepository.findOne({ where: { id } });
        if (!task) {
            throw new common_1.NotFoundException(`补料任务 ${id} 不存在`);
        }
        return task;
    }
    async findByBatch(batchId) {
        return this.taskRepository.find({
            where: { batchId },
            order: { priority: 'DESC', createdAt: 'DESC' },
        });
    }
    async update(id, dto) {
        const task = await this.findOne(id);
        Object.assign(task, dto);
        return this.taskRepository.save(task);
    }
    async resolve(id, resolutionNotes) {
        const task = await this.findOne(id);
        task.status = compliance_task_entity_1.TaskStatus.RESOLVED;
        task.resolvedAt = new Date();
        if (resolutionNotes) {
            task.resolutionNotes = resolutionNotes;
        }
        return this.taskRepository.save(task);
    }
    async cancel(id) {
        const task = await this.findOne(id);
        task.status = compliance_task_entity_1.TaskStatus.CANCELLED;
        return this.taskRepository.save(task);
    }
    async getTaskStats(batchId) {
        const tasks = await this.findByBatch(batchId);
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === compliance_task_entity_1.TaskStatus.PENDING).length,
            inProgress: tasks.filter(t => t.status === compliance_task_entity_1.TaskStatus.IN_PROGRESS).length,
            resolved: tasks.filter(t => t.status === compliance_task_entity_1.TaskStatus.RESOLVED).length,
            cancelled: tasks.filter(t => t.status === compliance_task_entity_1.TaskStatus.CANCELLED).length,
            critical: tasks.filter(t => t.priority === compliance_task_entity_1.TaskPriority.CRITICAL || t.priority === compliance_task_entity_1.TaskPriority.HIGH).length,
        };
    }
};
exports.ComplianceTaskService = ComplianceTaskService;
exports.ComplianceTaskService = ComplianceTaskService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(compliance_task_entity_1.ComplianceTask)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        clearance_batch_service_1.ClearanceBatchService,
        missing_component_service_1.MissingComponentService])
], ComplianceTaskService);
//# sourceMappingURL=compliance-task.service.js.map