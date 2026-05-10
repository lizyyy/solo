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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReissueCertificateDto = exports.VoidCertificateDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const types_1 = require("../../../common/types");
class VoidCertificateDto {
}
exports.VoidCertificateDto = VoidCertificateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '要作废的检疫证ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VoidCertificateDto.prototype, "certificateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '作废原因', enum: types_1.VoidReason, example: types_1.VoidReason.DUPLICATE }),
    (0, class_validator_1.IsEnum)(types_1.VoidReason),
    __metadata("design:type", String)
], VoidCertificateDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '作废详细说明', example: '证号重复，与另一条记录冲突，确认此条无效' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VoidCertificateDto.prototype, "reasonDetails", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否重新开具新证', example: true, required: false, default: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], VoidCertificateDto.prototype, "shouldReissue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '新证号（如需重新开具）', example: 'QZ2024010100001-NEW', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VoidCertificateDto.prototype, "newCertificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VoidCertificateDto.prototype, "remarks", void 0);
class ReissueCertificateDto {
}
exports.ReissueCertificateDto = ReissueCertificateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '原始检疫证ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReissueCertificateDto.prototype, "originalCertificateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '新证号', example: 'QZ2024010100001-R01' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReissueCertificateDto.prototype, "newCertificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '重开原因', example: '原始证号重复，重新开具' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReissueCertificateDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReissueCertificateDto.prototype, "remarks", void 0);
//# sourceMappingURL=void.dto.js.map