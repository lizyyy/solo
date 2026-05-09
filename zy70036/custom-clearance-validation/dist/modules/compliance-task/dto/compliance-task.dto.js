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
exports.ComplianceTaskFilterDto = exports.UpdateComplianceTaskDto = exports.CreateComplianceTaskDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const compliance_task_entity_1 = require("../../../entities/compliance-task.entity");
class AffectedItemDto {
    lineNumber;
    hsCode;
    productName;
    issue;
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AffectedItemDto.prototype, "lineNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AffectedItemDto.prototype, "hsCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AffectedItemDto.prototype, "productName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AffectedItemDto.prototype, "issue", void 0);
class CreateComplianceTaskDto {
    batchId;
    title;
    description;
    componentType;
    priority;
    assignee;
    dueDate;
    affectedItems;
}
exports.CreateComplianceTaskDto = CreateComplianceTaskDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "batchId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.MissingComponentType),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "componentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.TaskPriority),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "assignee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateComplianceTaskDto.prototype, "dueDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AffectedItemDto),
    __metadata("design:type", Array)
], CreateComplianceTaskDto.prototype, "affectedItems", void 0);
class UpdateComplianceTaskDto {
    title;
    description;
    componentType;
    priority;
    status;
    assignee;
    dueDate;
    resolutionNotes;
    affectedItems;
}
exports.UpdateComplianceTaskDto = UpdateComplianceTaskDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.MissingComponentType),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "componentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.TaskPriority),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.TaskStatus),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "assignee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "dueDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateComplianceTaskDto.prototype, "resolutionNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AffectedItemDto),
    __metadata("design:type", Array)
], UpdateComplianceTaskDto.prototype, "affectedItems", void 0);
class ComplianceTaskFilterDto {
    batchId;
    status;
    priority;
    componentType;
    assignee;
}
exports.ComplianceTaskFilterDto = ComplianceTaskFilterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ComplianceTaskFilterDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: compliance_task_entity_1.TaskStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.TaskStatus),
    __metadata("design:type", String)
], ComplianceTaskFilterDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: compliance_task_entity_1.TaskPriority }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.TaskPriority),
    __metadata("design:type", String)
], ComplianceTaskFilterDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: compliance_task_entity_1.MissingComponentType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(compliance_task_entity_1.MissingComponentType),
    __metadata("design:type", String)
], ComplianceTaskFilterDto.prototype, "componentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ComplianceTaskFilterDto.prototype, "assignee", void 0);
//# sourceMappingURL=compliance-task.dto.js.map