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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearanceReportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clearance_report_entity_1 = require("../../entities/clearance-report.entity");
const clearance_batch_service_1 = require("../clearance-batch/clearance-batch.service");
const version_management_service_1 = require("../version-management/version-management.service");
const hs_code_validation_service_1 = require("../hs-code-validation/hs-code-validation.service");
const packing_list_comparison_service_1 = require("../packing-list-comparison/packing-list-comparison.service");
const missing_component_service_1 = require("../missing-component/missing-component.service");
const compliance_task_service_1 = require("../compliance-task/compliance-task.service");
const invoice_service_1 = require("../version-management/invoice.service");
const packing_list_service_1 = require("../version-management/packing-list.service");
const hs_code_version_service_1 = require("../version-management/hs-code-version.service");
let ClearanceReportService = class ClearanceReportService {
    reportRepository;
    batchService;
    versionService;
    hsCodeValidationService;
    packingListComparisonService;
    missingComponentService;
    complianceTaskService;
    invoiceService;
    packingListService;
    hsCodeVersionService;
    constructor(reportRepository, batchService, versionService, hsCodeValidationService, packingListComparisonService, missingComponentService, complianceTaskService, invoiceService, packingListService, hsCodeVersionService) {
        this.reportRepository = reportRepository;
        this.batchService = batchService;
        this.versionService = versionService;
        this.hsCodeValidationService = hsCodeValidationService;
        this.packingListComparisonService = packingListComparisonService;
        this.missingComponentService = missingComponentService;
        this.complianceTaskService = complianceTaskService;
        this.invoiceService = invoiceService;
        this.packingListService = packingListService;
        this.hsCodeVersionService = hsCodeVersionService;
    }
    async generateReport(batchId) {
        await this.batchService.findOne(batchId);
        const existingReport = await this.reportRepository.findOne({
            where: { batchId },
            order: { version: 'DESC' },
        });
        const newVersion = existingReport ? existingReport.version + 1 : 1;
        let report = this.reportRepository.create({
            batchId,
            reportNumber: `CR-${Date.now()}`,
            version: newVersion,
            status: clearance_report_entity_1.ReportStatus.GENERATING,
        });
        report = await this.reportRepository.save(report);
        try {
            const [versionConsistency, hsCodeValidation, packingComparison, missingComponents, taskStats, invoice, packingList, activeHsCodes,] = await Promise.all([
                this.versionService.getVersionConsistency(batchId),
                this.hsCodeValidationService.validateBatchHsCodes(batchId),
                this.packingListComparisonService.compareBatch(batchId),
                this.missingComponentService.detectMissingComponents(batchId),
                this.complianceTaskService.getTaskStats(batchId),
                this.invoiceService.findLatestByBatch(batchId),
                this.packingListService.findLatestByBatch(batchId),
                this.hsCodeVersionService.findActiveByBatch(batchId),
            ]);
            report.versionSummary = {
                hsCodeVersions: versionConsistency.hsCodeVersions,
                invoiceVersions: versionConsistency.invoiceVersions,
                packingListVersions: versionConsistency.packingListVersions,
                isVersionConsistent: versionConsistency.isConsistent,
            };
            report.hsCodeValidation = {
                totalItems: hsCodeValidation.totalCodes,
                validCodes: hsCodeValidation.validCodes,
                invalidCodes: hsCodeValidation.invalidCodes,
                mismatchedCodes: hsCodeValidation.mismatchedCodes,
                pendingCodes: hsCodeValidation.pendingCodes,
                details: hsCodeValidation.details.map(d => ({
                    hsCode: d.hsCode,
                    productName: d.productName,
                    status: d.status,
                    message: d.messages.join('; '),
                })),
            };
            report.packingListComparison = {
                isConsistent: packingComparison.isConsistent,
                invoiceVsPackingList: {
                    quantityMatch: packingComparison.quantityComparison.quantityDifference === 0,
                    quantityDifference: packingComparison.quantityComparison.quantityDifference,
                    itemCountMatch: invoice?.itemCount === packingList?.items?.length,
                    mismatchedItems: packingComparison.quantityComparison.quantityMismatches.map(m => ({
                        hsCode: m.hsCode,
                        productName: m.productName,
                        invoiceQuantity: m.invoiceQuantity,
                        packingListQuantity: m.packingListQuantity,
                        difference: m.difference,
                    })),
                },
                weightSummary: {
                    totalGrossWeight: packingList?.totalGrossWeight ?? 0,
                    totalNetWeight: packingList?.totalNetWeight ?? 0,
                    unit: packingList?.weightUnit ?? 'KG',
                },
            };
            report.missingComponents = {
                isBlocked: missingComponents.isBlocked,
                missingCount: missingComponents.totalMissingCount,
                criticalMissing: missingComponents.criticalMissingCount,
                details: missingComponents.itemLevelMissing.map(m => ({
                    componentType: m.componentType,
                    lineNumber: m.lineNumber ?? 0,
                    hsCode: m.hsCode ?? '',
                    productName: m.productName ?? '',
                    issue: m.issue,
                    priority: m.priority,
                })),
            };
            report.complianceTasks = {
                totalTasks: taskStats.total,
                pendingTasks: taskStats.pending + taskStats.inProgress,
                inProgressTasks: taskStats.inProgress,
                resolvedTasks: taskStats.resolved,
                criticalTasks: taskStats.critical,
            };
            report.overallStatus = this.calculateOverallStatus(report);
            report.recommendations = this.generateRecommendations(report);
            report.status = clearance_report_entity_1.ReportStatus.COMPLETED;
            report.generatedAt = new Date();
            return this.reportRepository.save(report);
        }
        catch (error) {
            report.status = clearance_report_entity_1.ReportStatus.FAILED;
            await this.reportRepository.save(report);
            throw error;
        }
    }
    calculateOverallStatus(report) {
        if (report.missingComponents?.isBlocked ||
            report.hsCodeValidation?.invalidCodes && report.hsCodeValidation.invalidCodes > 0 ||
            report.complianceTasks?.criticalTasks && report.complianceTasks.criticalTasks > 0) {
            return clearance_report_entity_1.OverallStatus.BLOCKED;
        }
        if (report.versionSummary?.isVersionConsistent === false ||
            report.packingListComparison?.isConsistent === false ||
            report.hsCodeValidation?.pendingCodes && report.hsCodeValidation.pendingCodes > 0 ||
            report.complianceTasks?.pendingTasks && report.complianceTasks.pendingTasks > 0) {
            return clearance_report_entity_1.OverallStatus.WARNING;
        }
        return clearance_report_entity_1.OverallStatus.PASSED;
    }
    generateRecommendations(report) {
        const recommendations = [];
        if (!report.versionSummary?.isVersionConsistent) {
            recommendations.push('资料版本不一致，请确保发票、箱单和HS编码使用同一版本');
        }
        if (report.hsCodeValidation && report.hsCodeValidation.invalidCodes > 0) {
            recommendations.push(`发现 ${report.hsCodeValidation.invalidCodes} 个无效HS编码，请修正后重新提交`);
        }
        if (report.hsCodeValidation && report.hsCodeValidation.mismatchedCodes > 0) {
            recommendations.push(`发现 ${report.hsCodeValidation.mismatchedCodes} 个HS编码数量在发票和箱单中不一致，请核对`);
        }
        if (report.packingListComparison && !report.packingListComparison.isConsistent) {
            recommendations.push('发票与箱单内容不一致，请核对商品数量和重量信息');
        }
        if (report.missingComponents && report.missingComponents.isBlocked) {
            recommendations.push('存在严重缺件问题，清关流程被拦截，请优先处理');
        }
        if (report.complianceTasks && report.complianceTasks.criticalTasks > 0) {
            recommendations.push(`存在 ${report.complianceTasks.criticalTasks} 个高优先级补料任务待处理`);
        }
        if (recommendations.length === 0) {
            recommendations.push('所有校验通过，资料完整，可以提交清关');
        }
        return recommendations.join('\n');
    }
    async findAll(batchId) {
        const queryBuilder = this.reportRepository.createQueryBuilder('report');
        if (batchId) {
            queryBuilder.where('report.batchId = :batchId', { batchId });
        }
        queryBuilder.orderBy('report.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findOne(id) {
        const report = await this.reportRepository.findOne({ where: { id } });
        if (!report) {
            throw new common_1.NotFoundException(`清关报告 ${id} 不存在`);
        }
        return report;
    }
    async findLatestByBatch(batchId) {
        const reports = await this.reportRepository.find({
            where: { batchId },
            order: { version: 'DESC' },
            take: 1,
        });
        return reports.length > 0 ? reports[0] : null;
    }
    async findByBatch(batchId) {
        return this.reportRepository.find({
            where: { batchId },
            order: { version: 'DESC' },
        });
    }
};
exports.ClearanceReportService = ClearanceReportService;
exports.ClearanceReportService = ClearanceReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clearance_report_entity_1.ClearanceReport)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        clearance_batch_service_1.ClearanceBatchService,
        version_management_service_1.VersionManagementService,
        hs_code_validation_service_1.HsCodeValidationService,
        packing_list_comparison_service_1.PackingListComparisonService,
        missing_component_service_1.MissingComponentService,
        compliance_task_service_1.ComplianceTaskService,
        invoice_service_1.InvoiceService,
        packing_list_service_1.PackingListService,
        hs_code_version_service_1.HsCodeVersionService])
], ClearanceReportService);
//# sourceMappingURL=clearance-report.service.js.map