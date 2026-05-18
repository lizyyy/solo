import { ProcessingOrder, ReworkReport, AxisConsistencyIssue, ReworkItem } from '../types';
import { dataStore } from '../store/dataStore';

export class AxisConsistencyChecker {
  checkAxisConsistency(
    processingOrder: ProcessingOrder,
    reworkReport: ReworkReport
  ): AxisConsistencyIssue[] {
    const issues: AxisConsistencyIssue[] = [];

    for (const item of reworkReport.reworkItems) {
      if (item.eye === 'OD' || item.eye === 'BOTH') {
        const odIssue = this.checkEyeAxis(
          processingOrder,
          reworkReport,
          'OD',
          item
        );
        if (odIssue) issues.push(odIssue);
      }

      if (item.eye === 'OS' || item.eye === 'BOTH') {
        const osIssue = this.checkEyeAxis(
          processingOrder,
          reworkReport,
          'OS',
          item
        );
        if (osIssue) issues.push(osIssue);
      }
    }

    if (reworkReport.updatedPrescription) {
      issues.push(
        ...this.checkUpdatedPrescription(processingOrder, reworkReport)
      );
    }

    return issues;
  }

  private checkEyeAxis(
    processingOrder: ProcessingOrder,
    reworkReport: ReworkReport,
    eye: 'OD' | 'OS',
    reworkItem: ReworkItem
  ): AxisConsistencyIssue | null {
    const prescription = eye === 'OD' 
      ? processingOrder.odPrescription 
      : processingOrder.osPrescription;

    if (reworkItem.correctedAxis !== undefined &&
        reworkItem.correctedAxis !== prescription.axis) {
      return {
        processingOrderId: processingOrder.id,
        reworkReportId: reworkReport.id,
        eye,
        processingOrderAxis: prescription.axis,
        reworkReportAxis: reworkItem.correctedAxis,
        issueType: 'axis_not_synced',
        detectedAt: new Date()
      };
    }

    if (reworkItem.originalAxis !== undefined &&
        reworkItem.originalAxis !== prescription.axis) {
      return {
        processingOrderId: processingOrder.id,
        reworkReportId: reworkReport.id,
        eye,
        processingOrderAxis: prescription.axis,
        reworkReportAxis: reworkItem.originalAxis,
        issueType: 'axis_mismatch',
        detectedAt: new Date()
      };
    }

    return null;
  }

  private checkUpdatedPrescription(
    processingOrder: ProcessingOrder,
    reworkReport: ReworkReport
  ): AxisConsistencyIssue[] {
    const issues: AxisConsistencyIssue[] = [];

    if (reworkReport.updatedPrescription?.od) {
      if (reworkReport.updatedPrescription.od.axis !== processingOrder.odPrescription.axis) {
        issues.push({
          processingOrderId: processingOrder.id,
          reworkReportId: reworkReport.id,
          eye: 'OD',
          processingOrderAxis: processingOrder.odPrescription.axis,
          reworkReportAxis: reworkReport.updatedPrescription.od.axis,
          issueType: 'axis_not_synced',
          detectedAt: new Date()
        });
      }
    }

    if (reworkReport.updatedPrescription?.os) {
      if (reworkReport.updatedPrescription.os.axis !== processingOrder.osPrescription.axis) {
        issues.push({
          processingOrderId: processingOrder.id,
          reworkReportId: reworkReport.id,
          eye: 'OS',
          processingOrderAxis: processingOrder.osPrescription.axis,
          reworkReportAxis: reworkReport.updatedPrescription.os.axis,
          issueType: 'axis_not_synced',
          detectedAt: new Date()
        });
      }
    }

    return issues;
  }

  syncAxisToProcessingOrder(
    processingOrderId: string,
    reworkReportId: string,
    user: string
  ): { success: boolean; message: string; issues?: AxisConsistencyIssue[] } {
    const processingOrder = dataStore.getProcessingOrder(processingOrderId);
    const reworkReport = dataStore.getReworkReport(reworkReportId);

    if (!processingOrder) {
      return { success: false, message: '加工单不存在' };
    }

    if (!reworkReport) {
      return { success: false, message: '返工报告不存在' };
    }

    let odAxisUpdated = false;
    let osAxisUpdated = false;

    for (const item of reworkReport.reworkItems) {
      if (item.correctedAxis !== undefined) {
        if (item.eye === 'OD' || item.eye === 'BOTH') {
          processingOrder.odPrescription.axis = item.correctedAxis;
          odAxisUpdated = true;
        }
        if (item.eye === 'OS' || item.eye === 'BOTH') {
          processingOrder.osPrescription.axis = item.correctedAxis;
          osAxisUpdated = true;
        }
      }
    }

    if (reworkReport.updatedPrescription?.od?.axis !== undefined) {
      processingOrder.odPrescription.axis = reworkReport.updatedPrescription.od.axis;
      odAxisUpdated = true;
    }

    if (reworkReport.updatedPrescription?.os?.axis !== undefined) {
      processingOrder.osPrescription.axis = reworkReport.updatedPrescription.os.axis;
      osAxisUpdated = true;
    }

    processingOrder.updatedAt = new Date();
    processingOrder.auditTrail.push({
      action: 'sync_axis_from_rework',
      timestamp: new Date(),
      performedBy: user,
      changes: {
        odAxisUpdated,
        osAxisUpdated
      }
    });

    dataStore.saveProcessingOrder(processingOrder);
    dataStore.clearAxisIssues(processingOrderId, reworkReportId);

    const remainingIssues = this.checkAxisConsistency(processingOrder, reworkReport);
    remainingIssues.forEach(issue => dataStore.saveAxisIssue(issue));

    return {
      success: true,
      message: `轴位同步完成。OD: ${odAxisUpdated ? '已更新' : '未变更'}, OS: ${osAxisUpdated ? '已更新' : '未变更'}`,
      issues: remainingIssues
    };
  }

  validateAxisValue(axis: number): boolean {
    return Number.isInteger(axis) && axis >= 0 && axis <= 180;
  }

  getAxisDifference(axis1: number, axis2: number): number {
    const diff = Math.abs(axis1 - axis2);
    return Math.min(diff, 180 - diff);
  }

  isSignificantAxisDifference(axis1: number, axis2: number, threshold = 5): boolean {
    return this.getAxisDifference(axis1, axis2) > threshold;
  }

  checkAndSaveIssues(processingOrderId: string, reworkReportId: string): AxisConsistencyIssue[] {
    const processingOrder = dataStore.getProcessingOrder(processingOrderId);
    const reworkReport = dataStore.getReworkReport(reworkReportId);

    if (!processingOrder || !reworkReport) {
      return [];
    }

    const issues = this.checkAxisConsistency(processingOrder, reworkReport);
    issues.forEach(issue => dataStore.saveAxisIssue(issue));

    return issues;
  }
}

export const axisConsistencyChecker = new AxisConsistencyChecker();
