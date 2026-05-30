import dayjs from 'dayjs';
import {
  SettlementApplication,
  OverdueRecord,
  AnomalyMarker,
  ReasonDetail,
  Currency,
} from '../types/models';

export class AnomalyDetector {
  private createReason(
    code: string,
    message: string,
    source: string,
    operator?: string,
  ): ReasonDetail {
    return {
      code,
      message,
      source,
      timestamp: dayjs().toISOString(),
      operator,
    };
  }

  private createAnomaly(
    type: AnomalyMarker['type'],
    severity: 'HIGH' | 'MEDIUM' | 'LOW',
    message: string,
  ): AnomalyMarker {
    return {
      type,
      severity,
      message,
      resolved: false,
    };
  }

  detectServiceFeeMissingRefund(
    application: SettlementApplication,
  ): { anomaly?: AnomalyMarker; reason?: ReasonDetail } {
    const refundable = application.refundableServiceFee.final;
    const remaining = application.remainingServiceFee.final;

    if (remaining > 0 && refundable <= 0) {
      const anomaly = this.createAnomaly(
        'SERVICE_FEE_MISSING_REFUND',
        'HIGH',
        `存在剩余服务费${remaining}元但未计算可退金额，请核查`,
      );
      const reason = this.createReason(
        'SERVICE_FEE_MISSING_REFUND',
        `服务费退款检测异常：剩余服务费${remaining}元，但可退服务费为${refundable}元，可能存在漏退`,
        'AnomalyDetector.detectServiceFeeMissingRefund',
      );
      return { anomaly, reason };
    }

    if (refundable > 0 && refundable < remaining * 0.3) {
      const refundRatio = (refundable / remaining * 100).toFixed(1);
      const anomaly = this.createAnomaly(
        'SERVICE_FEE_MISSING_REFUND',
        'MEDIUM',
        `可退服务费${refundable}元占比较低（${refundRatio}%），建议核查`,
      );
      const reason = this.createReason(
        'SERVICE_FEE_LOW_REFUND',
        `可退服务费占比偏低：${refundRatio}%`,
        'AnomalyDetector.detectServiceFeeMissingRefund',
      );
      return { anomaly, reason };
    }

    return {};
  }

  detectOverdueNotSettled(
    overdueRecords: OverdueRecord[],
  ): { anomalies: AnomalyMarker[]; reasons: ReasonDetail[] } {
    const anomalies: AnomalyMarker[] = [];
    const reasons: ReasonDetail[] = [];

    const activeOverdue = overdueRecords.filter((o) => o.status === 'ACTIVE');
    if (activeOverdue.length > 0) {
      const totalOverdueAmount = activeOverdue.reduce(
        (sum, o) => sum + o.overdueAmount.final,
        0,
      );
      const totalPenalty = activeOverdue.reduce(
        (sum, o) => sum + o.penaltyAmount.final,
        0,
      );

      const anomaly = this.createAnomaly(
        'OVERDUE_NOT_SETTLED',
        'HIGH',
        `存在${activeOverdue.length}条未结清逾期记录，涉及逾期金额${totalOverdueAmount}元，罚息${totalPenalty}元`,
      );
      const reason = this.createReason(
        'OVERDUE_NOT_SETTLED',
        `检测到未结清逾期：${activeOverdue.length}条，逾期金额${totalOverdueAmount}元，罚息${totalPenalty}元`,
        'AnomalyDetector.detectOverdueNotSettled',
      );

      anomalies.push(anomaly);
      reasons.push(reason);
    }

    activeOverdue.forEach((record) => {
      if (record.overdueDays.final > 30) {
        const anomaly = this.createAnomaly(
          'OVERDUE_NOT_SETTLED',
          'HIGH',
          `第${record.termNo}期逾期${record.overdueDays.final}天，超过30天`,
        );
        anomalies.push(anomaly);
      }
    });

    return { anomalies, reasons };
  }

  detectDuplicateApplication(
    contractNo: string,
    applicationDate: string,
    existingApplications: SettlementApplication[],
    currentApplicationId?: string,
  ): { anomaly?: AnomalyMarker; reason?: ReasonDetail } {
    const thirtyDaysAgo = dayjs(applicationDate).subtract(30, 'day').toISOString();

    const duplicates = existingApplications.filter(
      (app) =>
        app.contractNo === contractNo &&
        app.id !== currentApplicationId &&
        app.createdAt >= thirtyDaysAgo &&
        ['DRAFT', 'PENDING_REVIEW', 'REVIEWED', 'APPROVED', 'EXECUTED'].includes(app.status),
    );

    if (duplicates.length > 0) {
      const anomaly = this.createAnomaly(
        'DUPLICATE_APPLICATION',
        'HIGH',
        `30天内存在${duplicates.length}条同类申请：${duplicates.map((d) => d.applicationNo).join(',')}`,
      );
      const reason = this.createReason(
        'DUPLICATE_APPLICATION',
        `检测到重复申请：30天内已有${duplicates.length}条结清申请`,
        'AnomalyDetector.detectDuplicateApplication',
      );
      return { anomaly, reason };
    }

    return {};
  }

  detectAll(
    application: SettlementApplication,
    overdueRecords: OverdueRecord[],
    existingApplications: SettlementApplication[],
  ): {
    anomalies: AnomalyMarker[];
    reasons: ReasonDetail[];
  } {
    const allAnomalies: AnomalyMarker[] = [];
    const allReasons: ReasonDetail[] = [];

    const feeResult = this.detectServiceFeeMissingRefund(application);
    if (feeResult.anomaly) {
      allAnomalies.push(feeResult.anomaly);
    }
    if (feeResult.reason) {
      allReasons.push(feeResult.reason);
    }

    const overdueResult = this.detectOverdueNotSettled(overdueRecords);
    allAnomalies.push(...overdueResult.anomalies);
    allReasons.push(...overdueResult.reasons);

    const duplicateResult = this.detectDuplicateApplication(
      application.contractNo,
      application.applicationDate,
      existingApplications,
      application.id,
    );
    if (duplicateResult.anomaly) {
      allAnomalies.push(duplicateResult.anomaly);
    }
    if (duplicateResult.reason) {
      allReasons.push(duplicateResult.reason);
    }

    return {
      anomalies: allAnomalies,
      reasons: allReasons,
    };
  }

  resolveAnomaly(
    application: SettlementApplication,
    anomalyType: string,
    resolvedBy: string,
    resolveReason: string,
  ): SettlementApplication {
    return {
      ...application,
      anomalies: application.anomalies.map((a) =>
        a.type === anomalyType
          ? {
              ...a,
              resolved: true,
              resolvedAt: dayjs().toISOString(),
              resolvedBy,
            }
          : a,
      ),
      updatedAt: dayjs().toISOString(),
      updatedBy: resolvedBy,
    };
  }
}
