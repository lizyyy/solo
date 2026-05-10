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
exports.ReviewTask = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
let ReviewTask = class ReviewTask {
};
exports.ReviewTask = ReviewTask;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReviewTask.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '任务编号' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "taskNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '关联检疫证号' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "certificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '关联检疫证ID' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "certificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '关联批次号' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '关联批次ID' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '关联运输单号' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "transportNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '关联运输ID' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "transportId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.ReviewStatus,
        default: types_1.ReviewStatus.PENDING,
        comment: '任务状态',
    }),
    __metadata("design:type", String)
], ReviewTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        enum: types_1.ReviewPriority,
        default: types_1.ReviewPriority.MEDIUM,
        comment: '优先级',
    }),
    __metadata("design:type", String)
], ReviewTask.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '复核原因代码' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "reasonCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', comment: '复核原因描述' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "reasonDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '相关数据上下文' }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "contextData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '复核结论' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "conclusion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '处理措施' }),
    __metadata("design:type", Object)
], ReviewTask.prototype, "resolutionActions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '处理人ID' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "assigneeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '处理人姓名' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "assigneeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '分配时间' }),
    __metadata("design:type", Date)
], ReviewTask.prototype, "assignedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '处理时间' }),
    __metadata("design:type", Date)
], ReviewTask.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '创建人ID' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '创建人姓名' }),
    __metadata("design:type", String)
], ReviewTask.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '创建时间' }),
    __metadata("design:type", Date)
], ReviewTask.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '更新时间' }),
    __metadata("design:type", Date)
], ReviewTask.prototype, "updatedAt", void 0);
exports.ReviewTask = ReviewTask = __decorate([
    (0, typeorm_1.Entity)('review_tasks'),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['priority']),
    (0, typeorm_1.Index)(['certificateNumber']),
    (0, typeorm_1.Index)(['createdAt'])
], ReviewTask);
//# sourceMappingURL=review-task.entity.js.map