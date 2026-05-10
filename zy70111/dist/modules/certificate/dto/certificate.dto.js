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
exports.ProcessingResultDto = exports.CertificateQueryDto = exports.ManualCorrectionDto = exports.UpdateCertificateDto = exports.CreateCertificateDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const types_1 = require("../../../common/types");
class CreateCertificateDto {
}
exports.CreateCertificateDto = CreateCertificateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫证号', example: 'QZ2024010100001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "certificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '证号来源', enum: types_1.CertificateSource, example: types_1.CertificateSource.SLAUGHTERHOUSE }),
    (0, class_validator_1.IsEnum)(types_1.CertificateSource),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '养殖场名称', example: '阳光养殖场' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "farmName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '养殖场ID', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "farmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '屠宰场名称', example: '和平屠宰场' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "slaughterhouseName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '屠宰场ID', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "slaughterhouseId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '动物种类', example: '生猪' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "animalType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '动物数量', example: 100 }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateCertificateDto.prototype, "animalQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '总重量', example: 10000.5, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateCertificateDto.prototype, "totalWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '出栏日期', example: '2024-01-15' }),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], CreateCertificateDto.prototype, "slaughterDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫日期', example: '2024-01-15' }),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], CreateCertificateDto.prototype, "inspectionDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫人员姓名', example: '张三' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "inspectorName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '扩展字段', required: false }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateCertificateDto.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCertificateDto.prototype, "remarks", void 0);
class UpdateCertificateDto {
}
exports.UpdateCertificateDto = UpdateCertificateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '养殖场名称', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCertificateDto.prototype, "farmName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '屠宰场名称', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCertificateDto.prototype, "slaughterhouseName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '动物种类', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCertificateDto.prototype, "animalType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '动物数量', required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateCertificateDto.prototype, "animalQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '总重量', required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateCertificateDto.prototype, "totalWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '扩展字段', required: false }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateCertificateDto.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCertificateDto.prototype, "remarks", void 0);
class ManualCorrectionDto {
}
exports.ManualCorrectionDto = ManualCorrectionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '修正后的状态', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ManualCorrectionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '修正的字段', required: false }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], ManualCorrectionDto.prototype, "fields", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '修正原因', example: '证号重复，人工确认此证为原始证' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ManualCorrectionDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否跳过重复检查', required: false, default: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ManualCorrectionDto.prototype, "skipDuplicateCheck", void 0);
class CertificateQueryDto {
}
exports.CertificateQueryDto = CertificateQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫证号（支持模糊查询）', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CertificateQueryDto.prototype, "certificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '状态', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CertificateQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '来源', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CertificateQueryDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '养殖场名称', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CertificateQueryDto.prototype, "farmName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '屠宰场名称', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CertificateQueryDto.prototype, "slaughterhouseName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '动物种类', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CertificateQueryDto.prototype, "animalType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否有重复', required: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CertificateQueryDto.prototype, "hasDuplicate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否有过人工修正', required: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CertificateQueryDto.prototype, "hasManualCorrection", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '开始日期', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], CertificateQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '结束日期', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], CertificateQueryDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '页码', default: 1, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CertificateQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '每页数量', default: 20, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CertificateQueryDto.prototype, "pageSize", void 0);
class ProcessingResultDto {
}
exports.ProcessingResultDto = ProcessingResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否成功' }),
    __metadata("design:type", Boolean)
], ProcessingResultDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '返回数据' }),
    __metadata("design:type", Object)
], ProcessingResultDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否需要人工复核' }),
    __metadata("design:type", Boolean)
], ProcessingResultDto.prototype, "needsReview", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '复核原因' }),
    __metadata("design:type", String)
], ProcessingResultDto.prototype, "reviewReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '复核优先级' }),
    __metadata("design:type", String)
], ProcessingResultDto.prototype, "reviewPriority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '处理消息' }),
    __metadata("design:type", String)
], ProcessingResultDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '警告信息' }),
    __metadata("design:type", Array)
], ProcessingResultDto.prototype, "warnings", void 0);
//# sourceMappingURL=certificate.dto.js.map