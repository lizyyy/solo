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
exports.MissingComponentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const missing_component_service_1 = require("./missing-component.service");
let MissingComponentController = class MissingComponentController {
    missingComponentService;
    constructor(missingComponentService) {
        this.missingComponentService = missingComponentService;
    }
    detect(batchId) {
        return this.missingComponentService.detectMissingComponents(batchId);
    }
    getResult(batchId) {
        return this.missingComponentService.detectMissingComponents(batchId);
    }
};
exports.MissingComponentController = MissingComponentController;
__decorate([
    (0, common_1.Post)('batch/:batchId/detect'),
    (0, swagger_1.ApiOperation)({ summary: '检测批次缺件' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MissingComponentController.prototype, "detect", null);
__decorate([
    (0, common_1.Get)('batch/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: '获取批次缺件检测结果' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MissingComponentController.prototype, "getResult", null);
exports.MissingComponentController = MissingComponentController = __decorate([
    (0, swagger_1.ApiTags)('缺件拦截检测'),
    (0, common_1.Controller)('missing-components'),
    __metadata("design:paramtypes", [missing_component_service_1.MissingComponentService])
], MissingComponentController);
//# sourceMappingURL=missing-component.controller.js.map