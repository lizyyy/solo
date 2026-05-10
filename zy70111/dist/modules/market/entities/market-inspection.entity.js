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
exports.MarketInspection = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
let MarketInspection = class MarketInspection {
};
exports.MarketInspection = MarketInspection;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MarketInspection.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '检疫证号' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "certificateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '检疫证ID' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "certificateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, comment: '运输记录ID' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "transportRecordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '批次号' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '验收市场名称' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "marketName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '验收市场ID' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "marketId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '经营户名称' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "merchantName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '经营户ID' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "merchantId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.MarketInspectionResult,
        comment: '验收结果',
    }),
    __metadata("design:type", String)
], MarketInspection.prototype, "result", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', comment: '验收时间' }),
    __metadata("design:type", Date)
], MarketInspection.prototype, "inspectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '验收人ID' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "inspectorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '验收人姓名' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "inspectorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', comment: '验收动物数量' }),
    __metadata("design:type", Number)
], MarketInspection.prototype, "inspectedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '验收重量' }),
    __metadata("design:type", Number)
], MarketInspection.prototype, "inspectedWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '验收发现的问题' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "issuesFound", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '处理措施' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "measuresTaken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", String)
], MarketInspection.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '扩展字段' }),
    __metadata("design:type", Object)
], MarketInspection.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '创建时间' }),
    __metadata("design:type", Date)
], MarketInspection.prototype, "createdAt", void 0);
exports.MarketInspection = MarketInspection = __decorate([
    (0, typeorm_1.Entity)('market_inspections'),
    (0, typeorm_1.Index)(['certificateNumber']),
    (0, typeorm_1.Index)(['result']),
    (0, typeorm_1.Index)(['inspectedAt'])
], MarketInspection);
//# sourceMappingURL=market-inspection.entity.js.map