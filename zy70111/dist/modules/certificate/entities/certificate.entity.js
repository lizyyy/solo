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
exports.Certificate = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
const certificate_duplicate_entity_1 = require("./certificate-duplicate.entity");
const flow_history_entity_1 = require("../../history/entities/flow-history.entity");
let Certificate = class Certificate {
};
exports.Certificate = Certificate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Certificate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '检疫证号' }),
    __metadata("design:type", String)
], Certificate.prototype, "certificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.CertificateStatus,
        default: types_1.CertificateStatus.ISSUED,
        comment: '检疫证状态',
    }),
    __metadata("design:type", String)
], Certificate.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.CertificateSource,
        comment: '证号来源',
    }),
    __metadata("design:type", String)
], Certificate.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '养殖场名称' }),
    __metadata("design:type", String)
], Certificate.prototype, "farmName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '养殖场ID' }),
    __metadata("design:type", String)
], Certificate.prototype, "farmId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '屠宰场名称' }),
    __metadata("design:type", String)
], Certificate.prototype, "slaughterhouseName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '屠宰场ID' }),
    __metadata("design:type", String)
], Certificate.prototype, "slaughterhouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '动物种类' }),
    __metadata("design:type", String)
], Certificate.prototype, "animalType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', comment: '动物数量' }),
    __metadata("design:type", Number)
], Certificate.prototype, "animalQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '总重量' }),
    __metadata("design:type", Number)
], Certificate.prototype, "totalWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', comment: '出栏日期' }),
    __metadata("design:type", Date)
], Certificate.prototype, "slaughterDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', comment: '检疫日期' }),
    __metadata("design:type", Date)
], Certificate.prototype, "inspectionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '检疫人员姓名' }),
    __metadata("design:type", String)
], Certificate.prototype, "inspectorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '开证人ID' }),
    __metadata("design:type", String)
], Certificate.prototype, "issuerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '开证人姓名' }),
    __metadata("design:type", String)
], Certificate.prototype, "issuerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '绑定的批次ID' }),
    __metadata("design:type", String)
], Certificate.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '批次号' }),
    __metadata("design:type", String)
], Certificate.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: '是否存在证号重复' }),
    __metadata("design:type", Boolean)
], Certificate.prototype, "hasDuplicate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: '是否被人工修正过' }),
    __metadata("design:type", Boolean)
], Certificate.prototype, "hasManualCorrection", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'uuid',
        nullable: true,
        comment: '如果是重开证，指向原始证ID',
    }),
    __metadata("design:type", String)
], Certificate.prototype, "originalCertificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'uuid',
        nullable: true,
        comment: '如果已作废重开，指向新证ID',
    }),
    __metadata("design:type", String)
], Certificate.prototype, "reissuedCertificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", String)
], Certificate.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'jsonb',
        nullable: true,
        comment: '扩展字段，存储各来源系统的原始数据',
    }),
    __metadata("design:type", Object)
], Certificate.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => certificate_duplicate_entity_1.CertificateDuplicate, (dup) => dup.certificate),
    __metadata("design:type", Array)
], Certificate.prototype, "duplicates", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => flow_history_entity_1.FlowHistory, (history) => history.certificate),
    __metadata("design:type", Array)
], Certificate.prototype, "flowHistories", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '创建时间' }),
    __metadata("design:type", Date)
], Certificate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '更新时间' }),
    __metadata("design:type", Date)
], Certificate.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '最后操作人ID' }),
    __metadata("design:type", String)
], Certificate.prototype, "lastOperatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '最后操作人姓名' }),
    __metadata("design:type", String)
], Certificate.prototype, "lastOperatorName", void 0);
exports.Certificate = Certificate = __decorate([
    (0, typeorm_1.Entity)('certificates'),
    (0, typeorm_1.Index)(['certificateNumber'], { unique: false }),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['source']),
    (0, typeorm_1.Index)(['issuerId'])
], Certificate);
//# sourceMappingURL=certificate.entity.js.map