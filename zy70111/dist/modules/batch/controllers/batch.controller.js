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
exports.BatchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const batch_service_1 = require("../services/batch.service");
const batch_dto_1 = require("../dto/batch.dto");
const decorators_1 = require("../../../common/decorators");
let BatchController = class BatchController {
    constructor(batchService) {
        this.batchService = batchService;
    }
    async create(dto, user) {
        return this.batchService.create(dto, user);
    }
    async bindCertificates(dto, user) {
        return this.batchService.bindCertificates(dto, user);
    }
    async unbindCertificates(dto, user) {
        return this.batchService.unbindCertificates(dto, user);
    }
    async getDetail(batchId) {
        return this.batchService.getBatchDetail(batchId);
    }
    async getById(id) {
        return this.batchService.findById(id);
    }
    async query(query) {
        return this.batchService.query(query);
    }
    async updateStatus(id, body, user) {
        return this.batchService.updateBatchStatus(id, body.status, user, body.reason);
    }
};
exports.BatchController = BatchController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建运输批次' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_dto_1.CreateBatchDto, Object]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bind'),
    (0, swagger_1.ApiOperation)({ summary: '绑定检疫证到批次' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_dto_1.BindCertificatesDto, Object]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "bindCertificates", null);
__decorate([
    (0, common_1.Post)('unbind'),
    (0, swagger_1.ApiOperation)({ summary: '从批次解绑检疫证' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_dto_1.UnbindCertificatesDto, Object]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "unbindCertificates", null);
__decorate([
    (0, common_1.Get)('detail/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: '查询批次详情（含绑定的检疫证）' }),
    (0, swagger_1.ApiParam)({ name: 'batchId', description: '批次ID' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Get)('id/:id'),
    (0, swagger_1.ApiOperation)({ summary: '通过ID查询批次' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '批次ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('query'),
    (0, swagger_1.ApiOperation)({ summary: '分页查询批次列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_dto_1.BatchQueryDto]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "query", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, swagger_1.ApiOperation)({ summary: '更新批次状态' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '批次ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], BatchController.prototype, "updateStatus", null);
exports.BatchController = BatchController = __decorate([
    (0, swagger_1.ApiTags)('批次管理'),
    (0, common_1.Controller)('batches'),
    __metadata("design:paramtypes", [batch_service_1.BatchService])
], BatchController);
//# sourceMappingURL=batch.controller.js.map