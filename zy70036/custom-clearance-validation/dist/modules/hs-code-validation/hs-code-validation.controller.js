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
exports.HsCodeValidationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const hs_code_validation_service_1 = require("./hs-code-validation.service");
let HsCodeValidationController = class HsCodeValidationController {
    validationService;
    constructor(validationService) {
        this.validationService = validationService;
    }
    validateHsCode(hsCode) {
        return this.validationService.validateHsCodeFormat(hsCode);
    }
    validateBatch(batchId) {
        return this.validationService.validateBatchHsCodes(batchId);
    }
};
exports.HsCodeValidationController = HsCodeValidationController;
__decorate([
    (0, common_1.Get)('validate/:hsCode'),
    (0, swagger_1.ApiOperation)({ summary: '校验单个HS编码格式' }),
    __param(0, (0, common_1.Param)('hsCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HsCodeValidationController.prototype, "validateHsCode", null);
__decorate([
    (0, common_1.Post)('batch/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: '校验批次所有HS编码' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HsCodeValidationController.prototype, "validateBatch", null);
exports.HsCodeValidationController = HsCodeValidationController = __decorate([
    (0, swagger_1.ApiTags)('HS编码规则校验'),
    (0, common_1.Controller)('hs-code-validation'),
    __metadata("design:paramtypes", [hs_code_validation_service_1.HsCodeValidationService])
], HsCodeValidationController);
//# sourceMappingURL=hs-code-validation.controller.js.map