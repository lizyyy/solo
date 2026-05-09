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
exports.ClearanceBatchFilterDto = exports.UpdateClearanceBatchDto = exports.CreateClearanceBatchDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const clearance_batch_entity_1 = require("../../../entities/clearance-batch.entity");
class CreateClearanceBatchDto {
    batchNumber;
    shipmentNumber;
    originCountry;
    destinationCountry;
    remarks;
}
exports.CreateClearanceBatchDto = CreateClearanceBatchDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateClearanceBatchDto.prototype, "batchNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateClearanceBatchDto.prototype, "shipmentNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateClearanceBatchDto.prototype, "originCountry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateClearanceBatchDto.prototype, "destinationCountry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClearanceBatchDto.prototype, "remarks", void 0);
class UpdateClearanceBatchDto {
    shipmentNumber;
    originCountry;
    destinationCountry;
    status;
    remarks;
}
exports.UpdateClearanceBatchDto = UpdateClearanceBatchDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpdateClearanceBatchDto.prototype, "shipmentNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateClearanceBatchDto.prototype, "originCountry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateClearanceBatchDto.prototype, "destinationCountry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(clearance_batch_entity_1.ClearanceBatchStatus),
    __metadata("design:type", String)
], UpdateClearanceBatchDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateClearanceBatchDto.prototype, "remarks", void 0);
class ClearanceBatchFilterDto {
    batchNumber;
    shipmentNumber;
    status;
}
exports.ClearanceBatchFilterDto = ClearanceBatchFilterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ClearanceBatchFilterDto.prototype, "batchNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ClearanceBatchFilterDto.prototype, "shipmentNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: clearance_batch_entity_1.ClearanceBatchStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(clearance_batch_entity_1.ClearanceBatchStatus),
    __metadata("design:type", String)
], ClearanceBatchFilterDto.prototype, "status", void 0);
//# sourceMappingURL=clearance-batch.dto.js.map