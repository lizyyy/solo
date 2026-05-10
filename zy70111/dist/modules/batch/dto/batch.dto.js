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
exports.BatchQueryDto = exports.UnbindCertificatesDto = exports.BindCertificatesDto = exports.CreateBatchDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateBatchDto {
}
exports.CreateBatchDto = CreateBatchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次号', example: 'PC20240101001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "batchNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次名称', example: '2024年1月15日运输批次' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "batchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '目的地', example: '北京新发地农产品批发市场' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "destination", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '计划运输日期', example: '2024-01-16' }),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], CreateBatchDto.prototype, "scheduledTransportDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输车辆牌号', example: '京A12345', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "vehiclePlateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '驾驶员姓名', example: '李四', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "driverName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '驾驶员电话', example: '13800138000', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "driverPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBatchDto.prototype, "remarks", void 0);
class BindCertificatesDto {
}
exports.BindCertificatesDto = BindCertificatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BindCertificatesDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '要绑定的检疫证ID列表', example: ['uuid1', 'uuid2'] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], BindCertificatesDto.prototype, "certificateIds", void 0);
class UnbindCertificatesDto {
}
exports.UnbindCertificatesDto = UnbindCertificatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UnbindCertificatesDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '要解绑的检疫证ID列表', example: ['uuid1', 'uuid2'] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], UnbindCertificatesDto.prototype, "certificateIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '解绑原因', example: '该批次已拆分运输' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UnbindCertificatesDto.prototype, "reason", void 0);
class BatchQueryDto {
}
exports.BatchQueryDto = BatchQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次号（支持模糊查询）', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BatchQueryDto.prototype, "batchNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次状态', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], BatchQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '目的地', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BatchQueryDto.prototype, "destination", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否包含重复证号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], BatchQueryDto.prototype, "hasDuplicateCertificates", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '页码', default: 1, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], BatchQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '每页数量', default: 20, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], BatchQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=batch.dto.js.map