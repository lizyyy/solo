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
exports.TransportRecord = void 0;
const typeorm_1 = require("typeorm");
const types_1 = require("../../../common/types");
let TransportRecord = class TransportRecord {
};
exports.TransportRecord = TransportRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TransportRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true, comment: '运输单号' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "transportNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', comment: '批次ID' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '批次号' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        enum: types_1.TransportStatus,
        default: types_1.TransportStatus.PENDING,
        comment: '运输状态',
    }),
    __metadata("design:type", String)
], TransportRecord.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '出发地' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "origin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '目的地' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "destination", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true, comment: '途经地点' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "route", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, comment: '运输车辆牌号' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "vehiclePlateNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '驾驶员姓名' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "driverName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, comment: '驾驶员电话' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "driverPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', comment: '发车时间' }),
    __metadata("design:type", Date)
], TransportRecord.prototype, "departureTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '预计到达时间' }),
    __metadata("design:type", Date)
], TransportRecord.prototype, "estimatedArrivalTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '实际到达时间' }),
    __metadata("design:type", Date)
], TransportRecord.prototype, "actualArrivalTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, comment: '核销时间' }),
    __metadata("design:type", Date)
], TransportRecord.prototype, "verifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '核销人ID' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "verifiedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, comment: '核销人姓名' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "verifiedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '核销备注' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "verificationRemarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: '运输中是否发现异常' }),
    __metadata("design:type", Boolean)
], TransportRecord.prototype, "hasAnomaly", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '异常描述' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "anomalyDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, comment: '扩展字段' }),
    __metadata("design:type", Object)
], TransportRecord.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '创建人ID' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, comment: '创建人姓名' }),
    __metadata("design:type", String)
], TransportRecord.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '创建时间' }),
    __metadata("design:type", Date)
], TransportRecord.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '更新时间' }),
    __metadata("design:type", Date)
], TransportRecord.prototype, "updatedAt", void 0);
exports.TransportRecord = TransportRecord = __decorate([
    (0, typeorm_1.Entity)('transport_records'),
    (0, typeorm_1.Index)(['batchId']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['vehiclePlateNumber'])
], TransportRecord);
//# sourceMappingURL=transport-record.entity.js.map