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
exports.VersionManagementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const version_management_service_1 = require("./version-management.service");
let VersionManagementController = class VersionManagementController {
    versionService;
    constructor(versionService) {
        this.versionService = versionService;
    }
    checkConsistency(batchId) {
        return this.versionService.getVersionConsistency(batchId);
    }
    checkVersions(batchId) {
        return this.versionService.checkVersions(batchId);
    }
};
exports.VersionManagementController = VersionManagementController;
__decorate([
    (0, common_1.Get)('batch/:batchId/consistency'),
    (0, swagger_1.ApiOperation)({ summary: '检查批次资料版本一致性' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VersionManagementController.prototype, "checkConsistency", null);
__decorate([
    (0, common_1.Get)('batch/:batchId/summary'),
    (0, swagger_1.ApiOperation)({ summary: '获取批次资料版本摘要' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VersionManagementController.prototype, "checkVersions", null);
exports.VersionManagementController = VersionManagementController = __decorate([
    (0, swagger_1.ApiTags)('资料版本一致性校验'),
    (0, common_1.Controller)('version-management'),
    __metadata("design:paramtypes", [version_management_service_1.VersionManagementService])
], VersionManagementController);
//# sourceMappingURL=version-management.controller.js.map