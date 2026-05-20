import moment from 'moment';
import { KeyBorrowRecord, VehicleInfo, ViolationRecord, Discrepancy } from '../types';
import { store } from '../models/Store';

export class ReconciliationEngine {
  private periodStart: Date;
  private periodEnd: Date;

  constructor(periodStart: Date, periodEnd: Date) {
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
  }

  async runFullReconciliation(): Promise<{
    discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[];
    summary: any;
  }> {
    const discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[] = [];

    const overdueDiscrepancies = await this.detectOverdueReturns();
    discrepancies.push(...overdueDiscrepancies);

    const fuelDiscrepancies = await this.detectFuelCardAbnormalities();
    discrepancies.push(...fuelDiscrepancies);

    const violationDiscrepancies = await this.detectViolationOwnershipIssues();
    discrepancies.push(...violationDiscrepancies);

    const mileageDiscrepancies = await this.detectMileageAbnormalities();
    discrepancies.push(...mileageDiscrepancies);

    const summary = this.generateSummary(discrepancies);

    return { discrepancies, summary };
  }

  async detectOverdueReturns(): Promise<Omit<Discrepancy, 'id' | 'detectedAt'>[]> {
    const discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[] = [];
    const borrowRecords = store.getAllBorrowRecords().filter(r =>
      r.borrowTime >= this.periodStart && r.borrowTime <= this.periodEnd
    );

    for (const record of borrowRecords) {
      if (!record.actualReturnTime) {
        const now = new Date();
        const overdueHours = moment(now).diff(moment(record.expectedReturnTime), 'hours');
        
        if (overdueHours > 0) {
          discrepancies.push({
            type: 'overdue_return',
            severity: overdueHours > 24 ? 'high' : overdueHours > 12 ? 'medium' : 'low',
            description: `车辆 ${record.vehiclePlate} 超时未归还，已逾期 ${overdueHours} 小时，借用人: ${record.borrower}`,
            sourceRecordId: record.id,
            sourceRecordType: 'borrow',
            relatedRecordIds: [record.vehicleId],
            status: 'open',
            evidence: [
              {
                field: 'expectedReturnTime',
                expected: record.expectedReturnTime.toISOString(),
                actual: null,
                difference: `${overdueHours}小时`
              }
            ]
          });
        }
      } else {
        const actualReturnTime = moment(record.actualReturnTime);
        const expectedReturnTime = moment(record.expectedReturnTime);
        
        if (actualReturnTime.isAfter(expectedReturnTime)) {
          const overdueHours = actualReturnTime.diff(expectedReturnTime, 'hours');
          
          discrepancies.push({
            type: 'overdue_return',
            severity: overdueHours > 24 ? 'high' : overdueHours > 12 ? 'medium' : 'low',
            description: `车辆 ${record.vehiclePlate} 归还超时 ${overdueHours} 小时，借用人: ${record.borrower}`,
            sourceRecordId: record.id,
            sourceRecordType: 'borrow',
            relatedRecordIds: [record.vehicleId],
            status: 'open',
            evidence: [
              {
                field: 'actualReturnTime',
                expected: record.expectedReturnTime.toISOString(),
                actual: record.actualReturnTime.toISOString(),
                difference: `${overdueHours}小时`
              }
            ]
          });
        }
      }
    }

    return discrepancies;
  }

  async detectFuelCardAbnormalities(): Promise<Omit<Discrepancy, 'id' | 'detectedAt'>[]> {
    const discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[] = [];
    const vehicles = store.getAllVehicles();
    const borrowRecords = store.getAllBorrowRecords().filter(r =>
      r.borrowTime >= this.periodStart && r.borrowTime <= this.periodEnd
    );

    for (const vehicle of vehicles) {
      const vehicleBorrowRecords = borrowRecords.filter(
        r => r.vehiclePlate === vehicle.plateNumber && r.fuelBalanceAfter !== undefined
      );

      if (vehicleBorrowRecords.length > 0) {
        const lastRecord = vehicleBorrowRecords.sort(
          (a, b) => new Date(b.borrowTime).getTime() - new Date(a.borrowTime).getTime()
        )[0];

        const expectedBalance = lastRecord.fuelBalanceAfter || 0;
        const actualBalance = vehicle.fuelCardBalance;
        const balanceDiff = actualBalance - expectedBalance;

        if (Math.abs(balanceDiff) > 50) {
          discrepancies.push({
            type: 'fuel_card_balance',
            severity: Math.abs(balanceDiff) > 200 ? 'high' : Math.abs(balanceDiff) > 100 ? 'medium' : 'low',
            description: `车辆 ${vehicle.plateNumber} 油卡余额异常，差异 ${balanceDiff > 0 ? '+' : ''}${balanceDiff} 元`,
            sourceRecordId: vehicle.id,
            sourceRecordType: 'vehicle',
            relatedRecordIds: [lastRecord.id],
            status: 'open',
            evidence: [
              {
                field: 'fuelCardBalance',
                expected: expectedBalance,
                actual: actualBalance,
                difference: balanceDiff
              }
            ]
          });
        }
      }

      if (vehicle.fuelCardBalance < 100) {
        discrepancies.push({
          type: 'fuel_card_balance',
          severity: vehicle.fuelCardBalance < 50 ? 'high' : 'low',
          description: `车辆 ${vehicle.plateNumber} 油卡余额不足，当前余额: ${vehicle.fuelCardBalance} 元`,
          sourceRecordId: vehicle.id,
          sourceRecordType: 'vehicle',
          relatedRecordIds: [],
          status: 'open',
          evidence: [
            {
              field: 'fuelCardBalance',
              expected: '>= 100',
              actual: vehicle.fuelCardBalance,
              difference: vehicle.fuelCardBalance - 100
            }
          ]
        });
      }
    }

    return discrepancies;
  }

  async detectViolationOwnershipIssues(): Promise<Omit<Discrepancy, 'id' | 'detectedAt'>[]> {
    const discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[] = [];
    const violations = store.getAllViolations().filter(v =>
      v.violationTime >= this.periodStart && v.violationTime <= this.periodEnd && v.status === 'unprocessed'
    );
    const borrowRecords = store.getAllBorrowRecords();

    for (const violation of violations) {
      const relatedBorrows = borrowRecords.filter(r => {
        if (r.vehiclePlate !== violation.vehiclePlate) return false;
        const borrowTime = moment(r.borrowTime);
        const returnTime = r.actualReturnTime ? moment(r.actualReturnTime) : moment();
        const violationTime = moment(violation.violationTime);
        return violationTime.isBetween(borrowTime, returnTime, null, '[]');
      });

      if (relatedBorrows.length === 0) {
        discrepancies.push({
          type: 'violation_ownership',
          severity: 'high',
          description: `违章 ${violation.violationId} 无法找到对应借用人，车牌号: ${violation.vehiclePlate}`,
          sourceRecordId: violation.id,
          sourceRecordType: 'violation',
          relatedRecordIds: [],
          status: 'open',
          evidence: [
            {
              field: 'violationOwnership',
              expected: '找到对应借用人',
              actual: '无匹配借还记录',
              difference: null
            }
          ]
        });
      } else if (!violation.driverName) {
        const likelyBorrower = relatedBorrows[0];
        discrepancies.push({
          type: 'violation_ownership',
          severity: 'medium',
          description: `违章 ${violation.violationId} 未指定驾驶人，疑似借用人: ${likelyBorrower.borrower}`,
          sourceRecordId: violation.id,
          sourceRecordType: 'violation',
          relatedRecordIds: relatedBorrows.map(r => r.id),
          status: 'open',
          evidence: [
            {
              field: 'driverName',
              expected: likelyBorrower.borrower,
              actual: null,
              difference: null
            }
          ]
        });
      } else {
        const hasMatchingDriver = relatedBorrows.some(r => r.borrower === violation.driverName);
        if (!hasMatchingDriver && relatedBorrows.length > 0) {
          discrepancies.push({
            type: 'violation_ownership',
            severity: 'medium',
            description: `违章 ${violation.violationId} 驾驶人 ${violation.driverName} 与借车记录不匹配`,
            sourceRecordId: violation.id,
            sourceRecordType: 'violation',
            relatedRecordIds: relatedBorrows.map(r => r.id),
            status: 'open',
            evidence: [
              {
                field: 'driverName',
                expected: relatedBorrows.map(r => r.borrower).join(' 或 '),
                actual: violation.driverName,
                difference: null
              }
            ]
          });
        }
      }
    }

    return discrepancies;
  }

  async detectMileageAbnormalities(): Promise<Omit<Discrepancy, 'id' | 'detectedAt'>[]> {
    const discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[] = [];
    const borrowRecords = store.getAllBorrowRecords().filter(r =>
      r.borrowTime >= this.periodStart && r.borrowTime <= this.periodEnd && r.returnMileage !== undefined
    );

    for (const record of borrowRecords) {
      const mileageDiff = record.returnMileage! - record.borrowMileage;

      if (mileageDiff < 0) {
        discrepancies.push({
          type: 'mileage_abnormal',
          severity: 'high',
          description: `车辆 ${record.vehiclePlate} 里程异常，归还里程小于借出里程`,
          sourceRecordId: record.id,
          sourceRecordType: 'borrow',
          relatedRecordIds: [],
          status: 'open',
          evidence: [
            {
              field: 'mileage',
              expected: `>= ${record.borrowMileage}`,
              actual: record.returnMileage,
              difference: mileageDiff
            }
          ]
        });
      } else if (mileageDiff > 500) {
        discrepancies.push({
          type: 'mileage_abnormal',
          severity: mileageDiff > 1000 ? 'high' : 'medium',
          description: `车辆 ${record.vehiclePlate} 单次试驾里程过长，行驶 ${mileageDiff} 公里`,
          sourceRecordId: record.id,
          sourceRecordType: 'borrow',
          relatedRecordIds: [],
          status: 'open',
          evidence: [
            {
              field: 'mileageDiff',
              expected: '<= 500',
              actual: mileageDiff,
              difference: mileageDiff - 500
            }
          ]
        });
      }
    }

    return discrepancies;
  }

  private generateSummary(discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[]): any {
    const byType = discrepancies.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = discrepancies.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalDiscrepancies: discrepancies.length,
      byType,
      bySeverity,
      period: {
        start: this.periodStart,
        end: this.periodEnd
      }
    };
  }
}
