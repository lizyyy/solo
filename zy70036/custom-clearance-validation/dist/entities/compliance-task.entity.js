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
exports.ComplianceTask = exports.MissingComponentType = exports.TaskStatus = exports.TaskPriority = void 0;
const typeorm_1 = require("typeorm");
const clearance_batch_entity_1 = require("./clearance-batch.entity");
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
    TaskPriority["CRITICAL"] = "critical";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["RESOLVED"] = "resolved";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var MissingComponentType;
(function (MissingComponentType) {
    MissingComponentType["HS_CODE"] = "hs_code";
    MissingComponentType["INVOICE"] = "invoice";
    MissingComponentType["PACKING_LIST"] = "packing_list";
    MissingComponentType["PRODUCT_INFO"] = "product_info";
    MissingComponentType["WEIGHT"] = "weight";
    MissingComponentType["QUANTITY"] = "quantity";
    MissingComponentType["VALUE"] = "value";
    MissingComponentType["OTHER"] = "other";
})(MissingComponentType || (exports.MissingComponentType = MissingComponentType = {}));
let ComplianceTask = class ComplianceTask {
    id;
    batch;
    batchId;
    title;
    description;
    componentType;
    priority;
    status;
    assignee;
    dueDate;
    resolvedAt;
    resolutionNotes;
    affectedItems;
    createdAt;
    updatedAt;
};
exports.ComplianceTask = ComplianceTask;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ComplianceTask.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clearance_batch_entity_1.ClearanceBatch, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'batchId' }),
    __metadata("design:type", clearance_batch_entity_1.ClearanceBatch)
], ComplianceTask.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ComplianceTask.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ComplianceTask.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ComplianceTask.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MissingComponentType,
    }),
    __metadata("design:type", String)
], ComplianceTask.prototype, "componentType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TaskPriority,
        default: TaskPriority.MEDIUM,
    }),
    __metadata("design:type", String)
], ComplianceTask.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TaskStatus,
        default: TaskStatus.PENDING,
    }),
    __metadata("design:type", String)
], ComplianceTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ComplianceTask.prototype, "assignee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ComplianceTask.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ComplianceTask.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ComplianceTask.prototype, "resolutionNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ComplianceTask.prototype, "affectedItems", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ComplianceTask.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ComplianceTask.prototype, "updatedAt", void 0);
exports.ComplianceTask = ComplianceTask = __decorate([
    (0, typeorm_1.Entity)('compliance_tasks')
], ComplianceTask);
//# sourceMappingURL=compliance-task.entity.js.map