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
exports.ClearanceBatchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const clearance_batch_service_1 = require("./clearance-batch.service");
const clearance_batch_dto_1 = require("./dto/clearance-batch.dto");
let ClearanceBatchController = class ClearanceBatchController {
    batchService;
    constructor(batchService) {
        this.batchService = batchService;
    }
    create(dto) {
        return this.batchService.create(dto);
    }
    findAll(filter) {
        return this.batchService.findAll(filter);
    }
    findOne(id) {
        return this.batchService.findOne(id);
    }
    update(id, dto) {
        return this.batchService.update(id, dto);
    }
    remove(id) {
        return this.batchService.remove(id);
    }
};
exports.ClearanceBatchController = ClearanceBatchController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建清关批次' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [clearance_batch_dto_1.CreateClearanceBatchDto]),
    __metadata("design:returntype", Promise)
], ClearanceBatchController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '查询清关批次列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [clearance_batch_dto_1.ClearanceBatchFilterDto]),
    __metadata("design:returntype", Promise)
], ClearanceBatchController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '查询清关批次详情' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClearanceBatchController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '更新清关批次' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, clearance_batch_dto_1.UpdateClearanceBatchDto]),
    __metadata("design:returntype", Promise)
], ClearanceBatchController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '删除清关批次' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClearanceBatchController.prototype, "remove", null);
exports.ClearanceBatchController = ClearanceBatchController = __decorate([
    (0, swagger_1.ApiTags)('清关批次管理'),
    (0, common_1.Controller)('batches'),
    __metadata("design:paramtypes", [clearance_batch_service_1.ClearanceBatchService])
], ClearanceBatchController);
//# sourceMappingURL=clearance-batch.controller.js.map