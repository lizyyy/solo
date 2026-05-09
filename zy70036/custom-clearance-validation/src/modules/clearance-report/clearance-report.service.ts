import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClearanceReport,
  ReportStatus,
  OverallStatus,
} from '../../entities/clearance-report.entity';
import { HsCodeVerificationStatus } from '../../entities/hs-code-version.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import { VersionManagementService } from '../version-management/version-management.service';
import { HsCodeValidationService } from '../hs-code-validation/hs-code-validation.service';
import { PackingListComparisonService } from '../packing-list-comparison/packing-list-comparison.service';
import { MissingComponentService } from '../missing-component/missing-component.service';
import { ComplianceTaskService } from '../compliance-task/compliance-task.service';
import { InvoiceService } from '../version-management/invoice.service';
import { PackingListService } from '../version-management/packing-list.service';
import { HsCodeVersionService } from '../version-management/hs-code-version.service';

@Injectable()
export class ClearanceReportService {
  constructor(
    @InjectRepository(ClearanceReport)
    private readonly reportRepository: Repository<ClearanceReport>,
    private readonly batchService: ClearanceBatchService,
    private readonly versionService: VersionManagementService,
    private readonly hsCodeValidationService: HsCodeValidationService,
    private readonly packingListComparisonService: PackingListComparisonService,
    private readonly missingComponentService: MissingComponentService,
    private readonly complianceTaskService: ComplianceTaskService,
    private readonly invoiceService: InvoiceService,
    private readonly packingListService: PackingListService,
    private readonly hsCodeVersionService: HsCodeVersionService,
  ) {}

  async generateReport(batchId: string): Promise<ClearanceReport> {
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
      status: ReportStatus.GENERATING,
    });
    report = await this.reportRepository.save(report);

    try {
      const [
        versionConsistency,
        hsCodeValidation,
        packingComparison,
        missingComponents,
        taskStats,
        invoice,
        packingList,
        activeHsCodes,
      ] = await Promise.all([
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
      report.status = ReportStatus.COMPLETED;
      report.generatedAt = new Date();

      return this.reportRepository.save(report);
    } catch (error) {
      report.status = ReportStatus.FAILED;
      await this.reportRepository.save(report);
      throw error;
    }
  }

  private calculateOverallStatus(report: ClearanceReport): OverallStatus {
    if (
      report.missingComponents?.isBlocked ||
      report.hsCodeValidation?.invalidCodes && report.hsCodeValidation.invalidCodes > 0 ||
      report.complianceTasks?.criticalTasks && report.complianceTasks.criticalTasks > 0
    ) {
      return OverallStatus.BLOCKED;
    }

    if (
      report.versionSummary?.isVersionConsistent === false ||
      report.packingListComparison?.isConsistent === false ||
      report.hsCodeValidation?.pendingCodes && report.hsCodeValidation.pendingCodes > 0 ||
      report.complianceTasks?.pendingTasks && report.complianceTasks.pendingTasks > 0
    ) {
      return OverallStatus.WARNING;
    }

    return OverallStatus.PASSED;
  }

  private generateRecommendations(report: ClearanceReport): string {
    const recommendations: string[] = [];

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

  async findAll(batchId?: string): Promise<ClearanceReport[]> {
    const queryBuilder = this.reportRepository.createQueryBuilder('report');

    if (batchId) {
      queryBuilder.where('report.batchId = :batchId', { batchId });
    }

    queryBuilder.orderBy('report.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<ClearanceReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException(`清关报告 ${id} 不存在`);
    }
    return report;
  }

  async findLatestByBatch(batchId: string): Promise<ClearanceReport | null> {
    const reports = await this.reportRepository.find({
      where: { batchId },
      order: { version: 'DESC' },
      take: 1,
    });
    return reports.length > 0 ? reports[0] : null;
  }

  async findByBatch(batchId: string): Promise<ClearanceReport[]> {
    return this.reportRepository.find({
      where: { batchId },
      order: { version: 'DESC' },
    });
  }
}
