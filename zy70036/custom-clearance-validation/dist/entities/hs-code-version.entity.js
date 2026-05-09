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
exports.HsCodeVersion = exports.HsCodeVerificationStatus = exports.HsCodeSource = void 0;
const typeorm_1 = require("typeorm");
const clearance_batch_entity_1 = require("./clearance-batch.entity");
var HsCodeSource;
(function (HsCodeSource) {
    HsCodeSource["INVOICE"] = "invoice";
    HsCodeSource["PACKING_LIST"] = "packing_list";
    HsCodeSource["DECLARATION"] = "declaration";
})(HsCodeSource || (exports.HsCodeSource = HsCodeSource = {}));
var HsCodeVerificationStatus;
(function (HsCodeVerificationStatus) {
    HsCodeVerificationStatus["PENDING"] = "pending";
    HsCodeVerificationStatus["VALID"] = "valid";
    HsCodeVerificationStatus["INVALID"] = "invalid";
    HsCodeVerificationStatus["MISMATCH"] = "mismatch";
})(HsCodeVerificationStatus || (exports.HsCodeVerificationStatus = HsCodeVerificationStatus = {}));
let HsCodeVersion = class HsCodeVersion {
    id;
    batch;
    batchId;
    version;
    hsCode;
    description;
    productName;
    quantity;
    unit;
    unitPrice;
    totalAmount;
    currency;
    source;
    verificationStatus;
    verificationMessage;
    isActive;
    createdAt;
    updatedAt;
};
exports.HsCodeVersion = HsCodeVersion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clearance_batch_entity_1.ClearanceBatch, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'batchId' }),
    __metadata("design:type", clearance_batch_entity_1.ClearanceBatch)
], HsCodeVersion.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HsCodeVersion.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "hsCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "productName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], HsCodeVersion.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "unit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], HsCodeVersion.prototype, "unitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], HsCodeVersion.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: HsCodeSource,
    }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: HsCodeVerificationStatus,
        default: HsCodeVerificationStatus.PENDING,
    }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "verificationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], HsCodeVersion.prototype, "verificationMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], HsCodeVersion.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], HsCodeVersion.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], HsCodeVersion.prototype, "updatedAt", void 0);
exports.HsCodeVersion = HsCodeVersion = __decorate([
    (0, typeorm_1.Entity)('hs_code_versions')
], HsCodeVersion);
//# sourceMappingURL=hs-code-version.entity.js.map