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
exports.MarketQueryDto = exports.MarketInspectionDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const types_1 = require("../../../common/types");
class MarketInspectionDto {
}
exports.MarketInspectionDto = MarketInspectionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫证号', example: 'QZ2024010100001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "certificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫证ID（可选，有证号可自动关联）', required: false }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "certificateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输记录ID（可选）', required: false }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "transportRecordId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收市场名称', example: '北京新发地农产品批发市场' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "marketName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收市场ID', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "marketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '经营户名称', example: '王五猪肉经营部' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "merchantName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '经营户ID', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '验收结果',
        enum: types_1.MarketInspectionResult,
        example: types_1.MarketInspectionResult.ACCEPTED,
    }),
    (0, class_validator_1.IsEnum)(types_1.MarketInspectionResult),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "result", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收时间', example: '2024-01-17T09:00:00Z' }),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], MarketInspectionDto.prototype, "inspectedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收动物数量', example: 100 }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MarketInspectionDto.prototype, "inspectedQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收重量', example: 10000.5, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], MarketInspectionDto.prototype, "inspectedWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收发现的问题', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "issuesFound", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '处理措施', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "measuresTaken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketInspectionDto.prototype, "remarks", void 0);
class MarketQueryDto {
}
exports.MarketQueryDto = MarketQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '检疫证号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketQueryDto.prototype, "certificateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '验收结果', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], MarketQueryDto.prototype, "result", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '市场名称', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketQueryDto.prototype, "marketName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '经营户名称', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketQueryDto.prototype, "merchantName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '开始日期', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], MarketQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '结束日期', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], MarketQueryDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '页码', default: 1, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], MarketQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '每页数量', default: 20, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], MarketQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=market.dto.js.map