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
exports.VoidController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const void_service_1 = require("../services/void.service");
const void_dto_1 = require("../dto/void.dto");
const decorators_1 = require("../../../common/decorators");
let VoidController = class VoidController {
    constructor(voidService) {
        this.voidService = voidService;
    }
    async voidCertificate(dto, user) {
        return this.voidService.voidCertificate(dto, user);
    }
    async reissueCertificate(dto, user) {
        return this.voidService.reissueCertificate(dto, user);
    }
    async getByCertificateId(certificateId) {
        return this.voidService.findByCertificateId(certificateId);
    }
    async getByCertificateNumber(certificateNumber) {
        return this.voidService.findByCertificateNumber(certificateNumber);
    }
};
exports.VoidController = VoidController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '作废检疫证（支持同时重新开具新证）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [void_dto_1.VoidCertificateDto, Object]),
    __metadata("design:returntype", Promise)
], VoidController.prototype, "voidCertificate", null);
__decorate([
    (0, common_1.Post)('reissue'),
    (0, swagger_1.ApiOperation)({ summary: '重新开具检疫证（单独重开接口）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [void_dto_1.ReissueCertificateDto, Object]),
    __metadata("design:returntype", Promise)
], VoidController.prototype, "reissueCertificate", null);
__decorate([
    (0, common_1.Get)('certificate/:certificateId'),
    (0, swagger_1.ApiOperation)({ summary: '查询检疫证的作废记录' }),
    (0, swagger_1.ApiParam)({ name: 'certificateId', description: '检疫证ID' }),
    __param(0, (0, common_1.Param)('certificateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VoidController.prototype, "getByCertificateId", null);
__decorate([
    (0, common_1.Get)('number/:certificateNumber'),
    (0, swagger_1.ApiOperation)({ summary: '通过证号查询作废记录' }),
    (0, swagger_1.ApiParam)({ name: 'certificateNumber', description: '检疫证号' }),
    __param(0, (0, common_1.Param)('certificateNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VoidController.prototype, "getByCertificateNumber", null);
exports.VoidController = VoidController = __decorate([
    (0, swagger_1.ApiTags)('作废重开'),
    (0, common_1.Controller)('void'),
    __metadata("design:paramtypes", [void_service_1.VoidService])
], VoidController);
//# sourceMappingURL=void.controller.js.map