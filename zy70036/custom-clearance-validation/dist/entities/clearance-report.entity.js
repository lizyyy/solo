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
exports.ClearanceReport = exports.OverallStatus = exports.ReportStatus = void 0;
const typeorm_1 = require("typeorm");
const clearance_batch_entity_1 = require("./clearance-batch.entity");
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["DRAFT"] = "draft";
    ReportStatus["GENERATING"] = "generating";
    ReportStatus["COMPLETED"] = "completed";
    ReportStatus["FAILED"] = "failed";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
var OverallStatus;
(function (OverallStatus) {
    OverallStatus["PASSED"] = "passed";
    OverallStatus["WARNING"] = "warning";
    OverallStatus["BLOCKED"] = "blocked";
})(OverallStatus || (exports.OverallStatus = OverallStatus = {}));
let ClearanceReport = class ClearanceReport {
    id;
    batch;
    batchId;
    reportNumber;
    version;
    status;
    overallStatus;
    versionSummary;
    hsCodeValidation;
    packingListComparison;
    missingComponents;
    complianceTasks;
    recommendations;
    generatedAt;
    createdAt;
    updatedAt;
};
exports.ClearanceReport = ClearanceReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ClearanceReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => clearance_batch_entity_1.ClearanceBatch, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'batchId' }),
    __metadata("design:type", clearance_batch_entity_1.ClearanceBatch)
], ClearanceReport.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ClearanceReport.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ClearanceReport.prototype, "reportNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], ClearanceReport.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ReportStatus,
        default: ReportStatus.DRAFT,
    }),
    __metadata("design:type", String)
], ClearanceReport.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OverallStatus,
        default: OverallStatus.WARNING,
    }),
    __metadata("design:type", String)
], ClearanceReport.prototype, "overallStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ClearanceReport.prototype, "versionSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ClearanceReport.prototype, "hsCodeValidation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ClearanceReport.prototype, "packingListComparison", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ClearanceReport.prototype, "missingComponents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ClearanceReport.prototype, "complianceTasks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClearanceReport.prototype, "recommendations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ClearanceReport.prototype, "generatedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ClearanceReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ClearanceReport.prototype, "updatedAt", void 0);
exports.ClearanceReport = ClearanceReport = __decorate([
    (0, typeorm_1.Entity)('clearance_reports')
], ClearanceReport);
//# sourceMappingURL=clearance-report.entity.js.map