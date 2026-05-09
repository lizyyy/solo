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
exports.PackingListController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const packing_list_service_1 = require("./packing-list.service");
const packing_list_dto_1 = require("./dto/packing-list.dto");
const invoice_entity_1 = require("../../entities/invoice.entity");
let PackingListController = class PackingListController {
    packingListService;
    constructor(packingListService) {
        this.packingListService = packingListService;
    }
    create(dto) {
        return this.packingListService.create(dto);
    }
    findAll(filter) {
        return this.packingListService.findAll(filter);
    }
    findByBatch(batchId) {
        return this.packingListService.findByBatch(batchId);
    }
    findLatestByBatch(batchId) {
        return this.packingListService.findLatestByBatch(batchId);
    }
    findOne(id) {
        return this.packingListService.findOne(id);
    }
    update(id, dto) {
        return this.packingListService.update(id, dto);
    }
    updateStatus(id, status) {
        return this.packingListService.updateStatus(id, status);
    }
    remove(id) {
        return this.packingListService.remove(id);
    }
};
exports.PackingListController = PackingListController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建箱单（新版本）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [packing_list_dto_1.CreatePackingListDto]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '查询箱单列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [packing_list_dto_1.PackingListFilterDto]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('batch/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: '按批次查询所有箱单版本' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "findByBatch", null);
__decorate([
    (0, common_1.Get)('batch/:batchId/latest'),
    (0, swagger_1.ApiOperation)({ summary: '查询批次最新箱单版本' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "findLatestByBatch", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '查询箱单详情' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '更新箱单' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, packing_list_dto_1.UpdatePackingListDto]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status/:status'),
    (0, swagger_1.ApiOperation)({ summary: '更新箱单状态' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '删除箱单' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackingListController.prototype, "remove", null);
exports.PackingListController = PackingListController = __decorate([
    (0, swagger_1.ApiTags)('箱单版本管理'),
    (0, common_1.Controller)('packing-lists'),
    __metadata("design:paramtypes", [packing_list_service_1.PackingListService])
], PackingListController);
//# sourceMappingURL=packing-list.controller.js.map