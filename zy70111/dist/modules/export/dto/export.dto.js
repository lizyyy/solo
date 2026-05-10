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
exports.ExportQueryDto = exports.CreateExportTaskDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const types_1 = require("../../../common/types");
class CreateExportTaskDto {
}
exports.CreateExportTaskDto = CreateExportTaskDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '导出类型', enum: types_1.ExportType, example: types_1.ExportType.DUPLICATE_ANALYSIS }),
    (0, class_validator_1.IsEnum)(types_1.ExportType),
    __metadata("design:type", String)
], CreateExportTaskDto.prototype, "exportType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '导出名称', example: '2024年1月证号重复分析报告' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExportTaskDto.prototype, "exportName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '开始日期', example: '2024-01-01', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], CreateExportTaskDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '结束日期', example: '2024-01-31', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], CreateExportTaskDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '扩展筛选条件', required: false }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateExportTaskDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateExportTaskDto.prototype, "remarks", void 0);
class ExportQueryDto {
}
exports.ExportQueryDto = ExportQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '导出类型', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], ExportQueryDto.prototype, "exportType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '状态', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], ExportQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '页码', default: 1, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ExportQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '每页数量', default: 20, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ExportQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=export.dto.js.map