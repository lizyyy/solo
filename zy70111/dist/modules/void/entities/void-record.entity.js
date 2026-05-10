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
exports.VoidRecord = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
let VoidRecord = class VoidRecord {
};
exports.VoidRecord = VoidRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VoidRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '被作废的证号' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "certificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', comment: '被作废的检疫证ID' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "certificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.VoidReason,
        comment: '作废原因',
    }),
    __metadata("design:type", String)
], VoidRecord.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', comment: '作废详细说明' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "reasonDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: false,
        comment: '是否重新开具新证',
    }),
    __metadata("design:type", Boolean)
], VoidRecord.prototype, "isReissued", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '重新开具的新证ID' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "reissuedCertificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '新证号' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "reissuedCertificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '作废申请人ID' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '作废申请人姓名' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "requestedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '审批人ID' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '审批人姓名' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "approvedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '审批时间' }),
    __metadata("design:type", Date)
], VoidRecord.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", String)
], VoidRecord.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '扩展字段' }),
    __metadata("design:type", Object)
], VoidRecord.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '作废时间' }),
    __metadata("design:type", Date)
], VoidRecord.prototype, "createdAt", void 0);
exports.VoidRecord = VoidRecord = __decorate([
    (0, typeorm_1.Entity)('void_records'),
    (0, typeorm_1.Index)(['certificateNumber']),
    (0, typeorm_1.Index)(['reason']),
    (0, typeorm_1.Index)(['createdAt'])
], VoidRecord);
//# sourceMappingURL=void-record.entity.js.map