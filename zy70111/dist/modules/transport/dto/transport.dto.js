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
exports.TransportQueryDto = exports.VerifyTransportDto = exports.CreateTransportDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateTransportDto {
}
exports.CreateTransportDto = CreateTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输单号', example: 'YS20240116001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "transportNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '出发地', example: '和平屠宰场' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "origin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '目的地', example: '北京新发地农产品批发市场' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "destination", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '途经地点', example: '石家庄服务区', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "route", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输车辆牌号', example: '京A12345' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "vehiclePlateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '驾驶员姓名', example: '李四' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "driverName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '驾驶员电话', example: '13800138000' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "driverPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '发车时间', example: '2024-01-16T08:00:00Z' }),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], CreateTransportDto.prototype, "departureTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '预计到达时间', example: '2024-01-16T20:00:00Z', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], CreateTransportDto.prototype, "estimatedArrivalTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "remarks", void 0);
class VerifyTransportDto {
}
exports.VerifyTransportDto = VerifyTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输记录ID', example: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VerifyTransportDto.prototype, "transportId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '实际到达时间', example: '2024-01-16T19:30:00Z', required: false }),
    (0, class_validator_1.IsDate)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], VerifyTransportDto.prototype, "actualArrivalTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '核销备注', example: '运输正常，无异常', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VerifyTransportDto.prototype, "verificationRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否发现异常', required: false, default: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], VerifyTransportDto.prototype, "hasAnomaly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '异常描述', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VerifyTransportDto.prototype, "anomalyDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '要核销的检疫证ID列表（可选，不传则核销批次全部）', required: false }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], VerifyTransportDto.prototype, "certificateIds", void 0);
class TransportQueryDto {
}
exports.TransportQueryDto = TransportQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输单号（支持模糊查询）', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransportQueryDto.prototype, "transportNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '批次号（支持模糊查询）', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransportQueryDto.prototype, "batchNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '运输状态', required: false, isArray: true }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], TransportQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '车辆牌号', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransportQueryDto.prototype, "vehiclePlateNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否有异常', required: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], TransportQueryDto.prototype, "hasAnomaly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '页码', default: 1, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], TransportQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '每页数量', default: 20, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], TransportQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=transport.dto.js.map