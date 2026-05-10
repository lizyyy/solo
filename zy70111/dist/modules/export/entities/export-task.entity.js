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
exports.ExportTask = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
let ExportTask = class ExportTask {
};
exports.ExportTask = ExportTask;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExportTask.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true, comment: '导出任务编号' }),
    __metadata("design:type", String)
], ExportTask.prototype, "taskNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.ExportType,
        comment: '导出类型',
    }),
    __metadata("design:type", String)
], ExportTask.prototype, "exportType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '导出名称' }),
    __metadata("design:type", String)
], ExportTask.prototype, "exportName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.ExportStatus,
        default: types_1.ExportStatus.PENDING,
        comment: '任务状态',
    }),
    __metadata("design:type", String)
], ExportTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '导出筛选条件' }),
    __metadata("design:type", Object)
], ExportTask.prototype, "filters", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '导出内容描述' }),
    __metadata("design:type", String)
], ExportTask.prototype, "contentDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '导出记录总数' }),
    __metadata("design:type", Number)
], ExportTask.prototype, "recordCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, comment: '导出文件路径' }),
    __metadata("design:type", String)
], ExportTask.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true, comment: '文件名' }),
    __metadata("design:type", String)
], ExportTask.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '文件大小（字节）' }),
    __metadata("design:type", Number)
], ExportTask.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '错误信息' }),
    __metadata("design:type", String)
], ExportTask.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '申请人ID' }),
    __metadata("design:type", String)
], ExportTask.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '申请人姓名' }),
    __metadata("design:type", String)
], ExportTask.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '完成时间' }),
    __metadata("design:type", Date)
], ExportTask.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '创建时间' }),
    __metadata("design:type", Date)
], ExportTask.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '更新时间' }),
    __metadata("design:type", Date)
], ExportTask.prototype, "updatedAt", void 0);
exports.ExportTask = ExportTask = __decorate([
    (0, typeorm_1.Entity)('export_tasks'),
    (0, typeorm_1.Index)(['exportType']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['createdBy']),
    (0, typeorm_1.Index)(['createdAt'])
], ExportTask);
//# sourceMappingURL=export-task.entity.js.map