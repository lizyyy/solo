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
exports.Batch = void 0;
const typeorm_1 = require("typeorm");
let Batch = class Batch {
};
exports.Batch = Batch;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Batch.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true, comment: '批次号' }),
    __metadata("design:type", String)
], Batch.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '批次名称' }),
    __metadata("design:type", String)
], Batch.prototype, "batchName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, comment: '批次状态' }),
    __metadata("design:type", String)
], Batch.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '绑定的检疫证数量' }),
    __metadata("design:type", Number)
], Batch.prototype, "certificateCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '批次内动物总数' }),
    __metadata("design:type", Number)
], Batch.prototype, "totalAnimals", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0, comment: '批次总重量' }),
    __metadata("design:type", Number)
], Batch.prototype, "totalWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '目的地' }),
    __metadata("design:type", String)
], Batch.prototype, "destination", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', comment: '计划运输日期' }),
    __metadata("design:type", Date)
], Batch.prototype, "scheduledTransportDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true, comment: '运输车辆牌号' }),
    __metadata("design:type", String)
], Batch.prototype, "vehiclePlateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '驾驶员姓名' }),
    __metadata("design:type", String)
], Batch.prototype, "driverName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true, comment: '驾驶员电话' }),
    __metadata("design:type", String)
], Batch.prototype, "driverPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: '是否包含重复证号' }),
    __metadata("design:type", Boolean)
], Batch.prototype, "hasDuplicateCertificates", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", String)
], Batch.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '扩展字段' }),
    __metadata("design:type", Object)
], Batch.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '创建人ID' }),
    __metadata("design:type", String)
], Batch.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '创建人姓名' }),
    __metadata("design:type", String)
], Batch.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '创建时间' }),
    __metadata("design:type", Date)
], Batch.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '更新时间' }),
    __metadata("design:type", Date)
], Batch.prototype, "updatedAt", void 0);
exports.Batch = Batch = __decorate([
    (0, typeorm_1.Entity)('batches'),
    (0, typeorm_1.Index)(['batchNumber'], { unique: true }),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['createdBy'])
], Batch);
//# sourceMappingURL=batch.entity.js.map