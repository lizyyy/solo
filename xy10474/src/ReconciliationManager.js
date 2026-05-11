const fs = require('fs');
const path = require('path');
const DataImporter = require('./dataImporter');
const AnomalyDetector = require('./anomalyDetector');

class ReconciliationManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.importer = new DataImporter(dataDir);
    this.detector = new AnomalyDetector();
  }

  importData(type, filePath) {
    return this.importer.import(type, filePath);
  }

  reconcile(date, storeId) {
    const transactions = this.importer.load('transactions');
    const refunds = this.importer.load('refunds');
    const pettyCash = this.importer.load('petty-cash');
    const handovers = this.importer.load('handover');

    const storeTransactions = this.filterByDate(transactions, date, 'timestamp');
    const storeRefunds = this.filterByDate(refunds, date, 'timestamp');
    const storePettyCash = this.filterByDate(pettyCash, date, 'timestamp');
    const storeHandover = this.filterByDate(handovers, date, 'handoverTime');

    const anomalies = this.detector.detectAll(
      { transactions: storeTransactions, refunds: storeRefunds, pettyCash: storePettyCash, handovers: storeHandover },
      storeId,
      date
    );

    const cashierReports = this.calculateCashierReports(storeTransactions, storeRefunds, storePettyCash, storeHandover);
    const totalReport = this.calculateTotalReport(cashierReports);
    const investigationNotes = this.loadNotes(date, storeId);

    const result = {
      date,
      storeId,
      generatedAt: new Date().toISOString(),
      summary: totalReport,
      cashiers: cashierReports,
      anomalies,
      investigationNotes
    };

    this.saveReport(result);
    return result;
  }

  filterByDate(records, date, dateField) {
    return records.filter(record => {
      const recordDate = new Date(record[dateField]).toISOString().split('T')[0];
      return recordDate === date;
    });
  }

  calculateCashierReports(transactions, refunds, pettyCash, handovers) {
    const cashierMap = new Map();

    const getCashierReport = (cashierId) => {
      if (!cashierMap.has(cashierId)) {
        cashierMap.set(cashierId, {
          cashierId,
          cashTransactions: 0,
          refundAmount: 0,
          pettyCashChanges: 0,
          expectedCash: 0,
          actualCash: 0,
          difference: 0,
          possibleCauses: [],
          pendingConfirmations: [],
          notes: []
        });
      }
      return cashierMap.get(cashierId);
    };

    transactions.forEach(t => {
      const report = getCashierReport(t.cashierId);
      if (t.paymentMethod === 'cash' || t.cashAmount) {
        report.cashTransactions += (t.cashAmount || t.amount);
      }
    });

    refunds.forEach(r => {
      const report = getCashierReport(r.cashierId);
      report.refundAmount += r.amount;
      if (!r.hasManagerSignature) {
        report.possibleCauses.push('退款未签字确认');
        report.pendingConfirmations.push('确认退款是否真实发生');
      }
    });

    pettyCash.forEach(pc => {
      const report = getCashierReport(pc.cashierId);
      if (pc.changeType === 'withdraw') {
        report.pettyCashChanges -= pc.amount;
      } else {
        report.pettyCashChanges += pc.amount;
      }
    });

    handovers.forEach(h => {
      const report = getCashierReport(h.outgoingCashierId);
      report.actualCash += h.amountHandedOver || 0;
    });

    cashierMap.forEach(report => {
      report.expectedCash = report.cashTransactions - report.refundAmount + report.pettyCashChanges;
      report.difference = report.actualCash - report.expectedCash;

      if (report.difference < -50) {
        report.possibleCauses.push('现金短款金额较大，可能存在现金挪用风险');
        report.pendingConfirmations.push('检查收银机现金抽屉是否遗漏');
      } else if (report.difference > 50) {
        report.possibleCauses.push('现金长款金额较大，可能存在未入账交易');
        report.pendingConfirmations.push('检查是否有未录入的现金收款');
      } else if (Math.abs(report.difference) > 10) {
        report.possibleCauses.push('零钱找零可能有误');
        report.pendingConfirmations.push('核对大额交易的找零记录');
      }

      if (report.possibleCauses.length === 0) {
        report.possibleCauses.push('暂无异常');
      }
    });

    return Array.from(cashierMap.values());
  }

  calculateTotalReport(cashierReports) {
    const total = {
      totalCashTransactions: 0,
      totalRefunds: 0,
      totalPettyCash: 0,
      totalExpected: 0,
      totalActual: 0,
      totalDifference: 0,
      cashiersWithDiscrepancy: 0,
      status: 'normal'
    };

    cashierReports.forEach(report => {
      total.totalCashTransactions += report.cashTransactions;
      total.totalRefunds += report.refundAmount;
      total.totalPettyCash += report.pettyCashChanges;
      total.totalExpected += report.expectedCash;
      total.totalActual += report.actualCash;
      total.totalDifference += report.difference;

      if (Math.abs(report.difference) > 5) {
        total.cashiersWithDiscrepancy++;
      }
    });

    if (total.totalDifference < -100) {
      total.status = 'shortage';
    } else if (total.totalDifference > 100) {
      total.status = 'overage';
    } else if (total.cashiersWithDiscrepancy > 0) {
      total.status = 'warning';
    }

    return total;
  }

  addNote(date, storeId, cashierId, note) {
    const notes = this.loadNotes(date, storeId);
    
    notes.push({
      cashierId,
      note,
      timestamp: new Date().toISOString()
    });

    this.saveNotes(date, storeId, notes);
    return true;
  }

  loadNotes(date, storeId) {
    const notesPath = path.join(this.dataDir, `notes-${date}-${storeId}.json`);
    if (!fs.existsSync(notesPath)) {
      return [];
    }
    const content = fs.readFileSync(notesPath, 'utf8');
    return JSON.parse(content);
  }

  saveNotes(date, storeId, notes) {
    const notesPath = path.join(this.dataDir, `notes-${date}-${storeId}.json`);
    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2), 'utf8');
  }

  saveReport(report) {
    const reportPath = path.join(this.dataDir, `report-${report.date}-${report.storeId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  loadReport(date, storeId) {
    const reportPath = path.join(this.dataDir, `report-${date}-${storeId}.json`);
    if (!fs.existsSync(reportPath)) {
      return null;
    }
    const content = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(content);
  }

  regenerateReport(date, storeId) {
    const existingReport = this.loadReport(date, storeId);
    if (!existingReport) {
      throw new Error(`找不到 ${date} 的报告，请先执行 reconcile 命令`);
    }

    const newReport = this.reconcile(date, storeId);
    const investigationNotes = this.loadNotes(date, storeId);
    
    newReport.investigationNotes = investigationNotes;
    
    this.saveReport(newReport);
    return newReport;
  }
}

module.exports = ReconciliationManager;
