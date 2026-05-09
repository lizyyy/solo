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
exports.PackingList = void 0;
const typeorm_1 = require("typeorm");
const clearance_batch_entity_1 = require("./clearance-batch.entity");
const invoice_entity_1 = require("./invoice.entity");
let PackingList = class PackingList {
    id;
    batch;
    batchId;
    packingListNumber;
    version;
    packingDate;
    shipperName;
    consigneeName;
    totalPackages;
    totalGrossWeight;
    totalNetWeight;
    totalVolume;
    weightUnit;
    volumeUnit;
    status;
    items;
    remarks;
    createdAt;
    updatedAt;
};
exports.PackingList = PackingList;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PackingList.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clearance_batch_entity_1.ClearanceBatch, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'batchId' }),
    __metadata("design:type", clearance_batch_entity_1.ClearanceBatch)
], PackingList.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PackingList.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], PackingList.prototype, "packingListNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], PackingList.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], PackingList.prototype, "packingDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PackingList.prototype, "shipperName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PackingList.prototype, "consigneeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PackingList.prototype, "totalPackages", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], PackingList.prototype, "totalGrossWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], PackingList.prototype, "totalNetWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], PackingList.prototype, "totalVolume", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PackingList.prototype, "weightUnit", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PackingList.prototype, "volumeUnit", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: invoice_entity_1.DocumentStatus,
        default: invoice_entity_1.DocumentStatus.DRAFT,
    }),
    __metadata("design:type", String)
], PackingList.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], PackingList.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], PackingList.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PackingList.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PackingList.prototype, "updatedAt", void 0);
exports.PackingList = PackingList = __decorate([
    (0, typeorm_1.Entity)('packing_lists')
], PackingList);
//# sourceMappingURL=packing-list.entity.js.map