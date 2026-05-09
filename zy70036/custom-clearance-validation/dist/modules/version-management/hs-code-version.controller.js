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
exports.HsCodeVersionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const hs_code_version_service_1 = require("./hs-code-version.service");
const hs_code_version_dto_1 = require("./dto/hs-code-version.dto");
let HsCodeVersionController = class HsCodeVersionController {
    hsCodeService;
    constructor(hsCodeService) {
        this.hsCodeService = hsCodeService;
    }
    create(dto) {
        return this.hsCodeService.create(dto);
    }
    findAll(filter) {
        return this.hsCodeService.findAll(filter);
    }
    findActiveByBatch(batchId) {
        return this.hsCodeService.findActiveByBatch(batchId);
    }
};
exports.HsCodeVersionController = HsCodeVersionController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建HS编码版本' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hs_code_version_dto_1.CreateHsCodeVersionDto]),
    __metadata("design:returntype", Promise)
], HsCodeVersionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '查询HS编码版本列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hs_code_version_dto_1.HsCodeVersionFilterDto]),
    __metadata("design:returntype", Promise)
], HsCodeVersionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('batch/:batchId/active'),
    (0, swagger_1.ApiOperation)({ summary: '查询批次活跃HS编码' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HsCodeVersionController.prototype, "findActiveByBatch", null);
exports.HsCodeVersionController = HsCodeVersionController = __decorate([
    (0, swagger_1.ApiTags)('HS编码版本管理'),
    (0, common_1.Controller)('hs-code-versions'),
    __metadata("design:paramtypes", [hs_code_version_service_1.HsCodeVersionService])
], HsCodeVersionController);
//# sourceMappingURL=hs-code-version.controller.js.map