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
exports.CertificateController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const certificate_service_1 = require("../services/certificate.service");
const certificate_dto_1 = require("../dto/certificate.dto");
const decorators_1 = require("../../../common/decorators");
let CertificateController = class CertificateController {
    constructor(certificateService) {
        this.certificateService = certificateService;
    }
    async create(dto, user) {
        return this.certificateService.create(dto, user);
    }
    async getDetail(certificateNumber) {
        return this.certificateService.getCertificateDetail(certificateNumber);
    }
    async getById(id) {
        return this.certificateService.findById(id);
    }
    async getByNumber(certificateNumber) {
        return this.certificateService.findByNumber(certificateNumber);
    }
    async query(query) {
        return this.certificateService.query(query);
    }
    async manualCorrection(id, dto, user) {
        return this.certificateService.manualCorrection(id, dto, user);
    }
    async getStatistics() {
        return this.certificateService.getStatistics();
    }
};
exports.CertificateController = CertificateController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: '录入检疫证（检疫证号入口）' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '录入成功', type: certificate_dto_1.ProcessingResultDto }),
    (0, swagger_1.ApiResponse)({ status: 409, description: '证号重复，需要人工复核' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [certificate_dto_1.CreateCertificateDto, Object]),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('detail/:certificateNumber'),
    (0, swagger_1.ApiOperation)({ summary: '查询检疫证详情（含重复记录和流转历史）' }),
    (0, swagger_1.ApiParam)({ name: 'certificateNumber', description: '检疫证号' }),
    __param(0, (0, common_1.Param)('certificateNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Get)('id/:id'),
    (0, swagger_1.ApiOperation)({ summary: '通过ID查询检疫证' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '检疫证ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('number/:certificateNumber'),
    (0, swagger_1.ApiOperation)({ summary: '通过证号查询所有记录' }),
    (0, swagger_1.ApiParam)({ name: 'certificateNumber', description: '检疫证号' }),
    __param(0, (0, common_1.Param)('certificateNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "getByNumber", null);
__decorate([
    (0, common_1.Get)('query'),
    (0, swagger_1.ApiOperation)({ summary: '分页查询检疫证列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [certificate_dto_1.CertificateQueryDto]),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "query", null);
__decorate([
    (0, common_1.Patch)(':id/manual-correction'),
    (0, swagger_1.ApiOperation)({ summary: '人工修正检疫证' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '检疫证ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, certificate_dto_1.ManualCorrectionDto, Object]),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "manualCorrection", null);
__decorate([
    (0, common_1.Get)('statistics'),
    (0, swagger_1.ApiOperation)({ summary: '获取检疫证统计数据' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CertificateController.prototype, "getStatistics", null);
exports.CertificateController = CertificateController = __decorate([
    (0, swagger_1.ApiTags)('检疫证管理'),
    (0, common_1.Controller)('certificates'),
    __metadata("design:paramtypes", [certificate_service_1.CertificateService])
], CertificateController);
//# sourceMappingURL=certificate.controller.js.map