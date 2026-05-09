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
exports.ComplianceTaskController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const compliance_task_service_1 = require("./compliance-task.service");
const compliance_task_dto_1 = require("./dto/compliance-task.dto");
let ComplianceTaskController = class ComplianceTaskController {
    taskService;
    constructor(taskService) {
        this.taskService = taskService;
    }
    create(dto) {
        return this.taskService.create(dto);
    }
    createFromDetection(batchId) {
        return this.taskService.createFromMissingDetection(batchId);
    }
    findAll(filter) {
        return this.taskService.findAll(filter);
    }
    findByBatch(batchId) {
        return this.taskService.findByBatch(batchId);
    }
    getStats(batchId) {
        return this.taskService.getTaskStats(batchId);
    }
    findOne(id) {
        return this.taskService.findOne(id);
    }
    update(id, dto) {
        return this.taskService.update(id, dto);
    }
    resolve(id, body) {
        return this.taskService.resolve(id, body?.resolutionNotes);
    }
    cancel(id) {
        return this.taskService.cancel(id);
    }
};
exports.ComplianceTaskController = ComplianceTaskController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建补料任务' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [compliance_task_dto_1.CreateComplianceTaskDto]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('batch/:batchId/generate'),
    (0, swagger_1.ApiOperation)({ summary: '根据缺件检测自动生成补料任务' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "createFromDetection", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '查询补料任务列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [compliance_task_dto_1.ComplianceTaskFilterDto]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('batch/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: '查询批次补料任务' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "findByBatch", null);
__decorate([
    (0, common_1.Get)('batch/:batchId/stats'),
    (0, swagger_1.ApiOperation)({ summary: '获取批次补料任务统计' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ComplianceTaskController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '查询补料任务详情' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '更新补料任务' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, compliance_task_dto_1.UpdateComplianceTaskDto]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/resolve'),
    (0, swagger_1.ApiOperation)({ summary: '解决补料任务' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "resolve", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, swagger_1.ApiOperation)({ summary: '取消补料任务' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComplianceTaskController.prototype, "cancel", null);
exports.ComplianceTaskController = ComplianceTaskController = __decorate([
    (0, swagger_1.ApiTags)('补料任务管理'),
    (0, common_1.Controller)('compliance-tasks'),
    __metadata("design:paramtypes", [compliance_task_service_1.ComplianceTaskService])
], ComplianceTaskController);
//# sourceMappingURL=compliance-task.controller.js.map