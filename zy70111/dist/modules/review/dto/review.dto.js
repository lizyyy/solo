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
exports.ReviewQueryDto = exports.ResolveReviewTaskDto = exports.CreateReviewTaskDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const types_1 = require("../../../common/types");
class CreateReviewTaskDto {
}
exports.CreateReviewTaskDto = CreateReviewTaskDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联检疫证号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "certificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联检疫证ID', required: false }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "certificateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联批次号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "batchNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联批次ID', required: false }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联运输单号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "transportNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联运输ID', required: false }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "transportId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '复核原因代码', example: 'DUPLICATE_CERTIFICATE_NUMBER' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "reasonCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '复核原因描述', example: '证号重复，需人工确认哪条有效' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "reasonDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '优先级', enum: types_1.ReviewPriority, required: false, default: types_1.ReviewPriority.MEDIUM }),
    (0, class_validator_1.IsEnum)(types_1.ReviewPriority),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '相关数据上下文', required: false }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateReviewTaskDto.prototype, "contextData", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewTaskDto.prototype, "remarks", void 0);
class ResolveReviewTaskDto {
}
exports.ResolveReviewTaskDto = ResolveReviewTaskDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '复核任务ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResolveReviewTaskDto.prototype, "taskId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '复核结论', example: '确认此证为原始有效证，另一条为重复无效证，已作废' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResolveReviewTaskDto.prototype, "conclusion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '处理措施', required: false }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], ResolveReviewTaskDto.prototype, "resolutionActions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '处理结果状态', enum: types_1.ReviewStatus, example: types_1.ReviewStatus.RESOLVED }),
    (0, class_validator_1.IsEnum)(types_1.ReviewStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ResolveReviewTaskDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ResolveReviewTaskDto.prototype, "remarks", void 0);
class ReviewQueryDto {
}
exports.ReviewQueryDto = ReviewQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '状态', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], ReviewQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '优先级', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], ReviewQueryDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '原因代码', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewQueryDto.prototype, "reasonCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '关联检疫证号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewQueryDto.prototype, "certificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '处理人ID', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewQueryDto.prototype, "assigneeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '页码', default: 1, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ReviewQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '每页数量', default: 20, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ReviewQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=review.dto.js.map