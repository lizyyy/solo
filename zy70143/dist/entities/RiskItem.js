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
exports.RiskItem = exports.RiskStatus = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const types_1 = require("../types");
var RiskStatus;
(function (RiskStatus) {
    RiskStatus["OPEN"] = "OPEN";
    RiskStatus["MITIGATED"] = "MITIGATED";
    RiskStatus["ACCEPTED"] = "ACCEPTED";
    RiskStatus["CLOSED"] = "CLOSED";
})(RiskStatus || (exports.RiskStatus = RiskStatus = {}));
let RiskItem = class RiskItem {
};
exports.RiskItem = RiskItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RiskItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RiskItem.prototype, "vulnerabilityId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RiskItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], RiskItem.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        enum: types_1.RiskLevel
    }),
    __metadata("design:type", String)
], RiskItem.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        enum: RiskStatus,
        default: RiskStatus.OPEN
    }),
    __metadata("design:type", String)
], RiskItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], RiskItem.prototype, "mitigationPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RiskItem.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RiskItem.prototype, "ownerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], RiskItem.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], RiskItem.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], RiskItem.prototype, "resolutionNote", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RiskItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RiskItem.prototype, "updatedAt", void 0);
exports.RiskItem = RiskItem = __decorate([
    (0, typeorm_1.Entity)()
], RiskItem);
//# sourceMappingURL=RiskItem.js.map