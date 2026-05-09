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
exports.HsCodeVersionFilterDto = exports.CreateHsCodeVersionDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const hs_code_version_entity_1 = require("../../../entities/hs-code-version.entity");
class HsCodeItemDto {
    hsCode;
    description;
    productName;
    quantity;
    unit;
    unitPrice;
    totalAmount;
    currency;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], HsCodeItemDto.prototype, "hsCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HsCodeItemDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HsCodeItemDto.prototype, "productName", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], HsCodeItemDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HsCodeItemDto.prototype, "unit", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], HsCodeItemDto.prototype, "unitPrice", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], HsCodeItemDto.prototype, "totalAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HsCodeItemDto.prototype, "currency", void 0);
class CreateHsCodeVersionDto {
    batchId;
    source;
    items;
    remarks;
}
exports.CreateHsCodeVersionDto = CreateHsCodeVersionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHsCodeVersionDto.prototype, "batchId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(hs_code_version_entity_1.HsCodeSource),
    __metadata("design:type", String)
], CreateHsCodeVersionDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => HsCodeItemDto),
    __metadata("design:type", Array)
], CreateHsCodeVersionDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHsCodeVersionDto.prototype, "remarks", void 0);
class HsCodeVersionFilterDto {
    batchId;
    source;
}
exports.HsCodeVersionFilterDto = HsCodeVersionFilterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HsCodeVersionFilterDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: hs_code_version_entity_1.HsCodeSource }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(hs_code_version_entity_1.HsCodeSource),
    __metadata("design:type", String)
], HsCodeVersionFilterDto.prototype, "source", void 0);
//# sourceMappingURL=hs-code-version.dto.js.map