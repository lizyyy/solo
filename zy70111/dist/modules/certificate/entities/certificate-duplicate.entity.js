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
exports.CertificateDuplicate = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
const certificate_entity_1 = require("./certificate.entity");
let CertificateDuplicate = class CertificateDuplicate {
};
exports.CertificateDuplicate = CertificateDuplicate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '重复的证号' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "certificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', comment: '检疫证ID（冲突方之一）' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "certificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', comment: '冲突的另一个检疫证ID' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "conflictingCertificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.ReviewStatus,
        default: types_1.ReviewStatus.PENDING,
        comment: '处理状态',
    }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        enum: types_1.ReviewPriority,
        default: types_1.ReviewPriority.HIGH,
        comment: '优先级',
    }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', comment: '检测到的冲突原因' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "conflictReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '冲突详情对比' }),
    __metadata("design:type", Object)
], CertificateDuplicate.prototype, "conflictDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: false,
        comment: '是否为首次检测到的记录',
    }),
    __metadata("design:type", Boolean)
], CertificateDuplicate.prototype, "isPrimary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '处理方案' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '处理人ID' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '处理人姓名' }),
    __metadata("design:type", String)
], CertificateDuplicate.prototype, "resolvedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '处理时间' }),
    __metadata("design:type", Date)
], CertificateDuplicate.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => certificate_entity_1.Certificate, (cert) => cert.duplicates),
    (0, typeorm_1.JoinColumn)({ name: 'certificateId' }),
    __metadata("design:type", certificate_entity_1.Certificate)
], CertificateDuplicate.prototype, "certificate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '检测时间' }),
    __metadata("design:type", Date)
], CertificateDuplicate.prototype, "createdAt", void 0);
exports.CertificateDuplicate = CertificateDuplicate = __decorate([
    (0, typeorm_1.Entity)('certificate_duplicates'),
    (0, typeorm_1.Index)(['certificateNumber']),
    (0, typeorm_1.Index)(['status'])
], CertificateDuplicate);
//# sourceMappingURL=certificate-duplicate.entity.js.map