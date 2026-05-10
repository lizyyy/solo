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
exports.StatusLog = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const types_1 = require("../types");
let StatusLog = class StatusLog {
};
exports.StatusLog = StatusLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StatusLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StatusLog.prototype, "vulnerabilityId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        enum: types_1.VulnerabilityStatus
    }),
    __metadata("design:type", String)
], StatusLog.prototype, "fromStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        enum: types_1.VulnerabilityStatus
    }),
    __metadata("design:type", String)
], StatusLog.prototype, "toStatus", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StatusLog.prototype, "operatorId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StatusLog.prototype, "operatorName", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], StatusLog.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], StatusLog.prototype, "isManualOverride", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], StatusLog.prototype, "createdAt", void 0);
exports.StatusLog = StatusLog = __decorate([
    (0, typeorm_1.Entity)()
], StatusLog);
//# sourceMappingURL=StatusLog.js.map