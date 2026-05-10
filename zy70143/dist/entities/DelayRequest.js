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
exports.DelayRequest = exports.DelayRequestStatus = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
var DelayRequestStatus;
(function (DelayRequestStatus) {
    DelayRequestStatus["PENDING"] = "PENDING";
    DelayRequestStatus["APPROVED"] = "APPROVED";
    DelayRequestStatus["REJECTED"] = "REJECTED";
})(DelayRequestStatus || (exports.DelayRequestStatus = DelayRequestStatus = {}));
let DelayRequest = class DelayRequest {
};
exports.DelayRequest = DelayRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DelayRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DelayRequest.prototype, "vulnerabilityId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DelayRequest.prototype, "requesterId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DelayRequest.prototype, "requesterName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], DelayRequest.prototype, "originalDueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], DelayRequest.prototype, "newDueDate", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], DelayRequest.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], DelayRequest.prototype, "riskMitigation", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        enum: DelayRequestStatus,
        default: DelayRequestStatus.PENDING
    }),
    __metadata("design:type", String)
], DelayRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DelayRequest.prototype, "approverId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DelayRequest.prototype, "approverName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], DelayRequest.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], DelayRequest.prototype, "approvalComment", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DelayRequest.prototype, "createdAt", void 0);
exports.DelayRequest = DelayRequest = __decorate([
    (0, typeorm_1.Entity)()
], DelayRequest);
//# sourceMappingURL=DelayRequest.js.map