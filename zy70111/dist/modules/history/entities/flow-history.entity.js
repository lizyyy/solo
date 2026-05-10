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
exports.FlowHistory = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
let FlowHistory = class FlowHistory {
};
exports.FlowHistory = FlowHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FlowHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '检疫证号' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "certificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', comment: '检疫证ID' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "certificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.FlowAction,
        comment: '流转操作类型',
    }),
    __metadata("design:type", String)
], FlowHistory.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '操作描述' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        nullable: true,
        enum: types_1.CertificateStatus,
        comment: '操作前状态',
    }),
    __metadata("design:type", String)
], FlowHistory.prototype, "previousStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        nullable: true,
        enum: types_1.CertificateStatus,
        comment: '操作后状态',
    }),
    __metadata("design:type", String)
], FlowHistory.prototype, "newStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '操作人ID' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "operatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '操作人姓名' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "operatorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '操作来源系统' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "sourceSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '详细变更内容（JSON格式说明）' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "changes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '原始数据快照（关键信息）' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "snapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '关联业务ID（如批次、运输、验收等）' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "relatedEntityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true, comment: '关联实体类型' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "relatedEntityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: '是否为人工修正操作' }),
    __metadata("design:type", Boolean)
], FlowHistory.prototype, "isManualCorrection", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '人工修正说明' }),
    __metadata("design:type", String)
], FlowHistory.prototype, "correctionReason", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => certificate_entity_1.Certificate, (cert) => cert.flowHistories),
    (0, typeorm_1.JoinColumn)({ name: 'certificateId' }),
    __metadata("design:type", certificate_entity_1.Certificate)
], FlowHistory.prototype, "certificate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '操作时间' }),
    __metadata("design:type", Date)
], FlowHistory.prototype, "createdAt", void 0);
exports.FlowHistory = FlowHistory = __decorate([
    (0, typeorm_1.Entity)('flow_histories'),
    (0, typeorm_1.Index)(['certificateNumber']),
    (0, typeorm_1.Index)(['action']),
    (0, typeorm_1.Index)(['createdAt'])
], FlowHistory);
//# sourceMappingURL=flow-history.entity.js.map