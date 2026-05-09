const fs = require('fs');
const path = require('path');
const { createObjectCsvStringifier } = require('csv-writer');
const { BillService } = require('./billService');
const UserService = require('./userService');
const db = require('../config/database');
const logger = require('../utils/logger');
const taskQueue = require('../utils/taskQueue');

const reportsDir = path.join(__dirname, '..', 'data', 'reports');

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

class ReportService {
  static generateBillsCsv(bills) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'bill_id', title: '账单ID' },
        { id: 'description', title: '描述' },
        { id: 'total_amount', title: '总金额' },
        { id: 'payer_name', title: '付款人' },
        { id: 'created_at', title: '创建时间' },
        { id: 'split_details', title: '分摊详情' }
      ]
    });

    const users = db.prepare('SELECT id, name FROM users').all();
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const records = bills.map(bill => ({
      bill_id: bill.id,
      description: bill.description,
      total_amount: bill.total_amount.toFixed(2),
      payer_name: userMap.get(bill.payer_id) || bill.payer_id,
      created_at: new Date(bill.created_at).toLocaleString('zh-CN'),
      split_details: bill.splits
        .map(s => `${userMap.get(s.user_id) || s.user_id}: ¥${s.amount.toFixed(2)}`)
        .join('; ')
    }));

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  static generateBalancesCsv(balances) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'user_name', title: '用户' },
        { id: 'paid', title: '已支付' },
        { id: 'owed', title: '应支付' },
        { id: 'balance', title: '净额' }
      ]
    });

    const records = balances.map(b => ({
      user_name: b.userName,
      paid: b.paid.toFixed(2),
      owed: b.owed.toFixed(2),
      balance: b.balance.toFixed(2)
    }));

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  static generateSettlementsCsv(settlements) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'from', title: '付款人' },
        { id: 'to', title: '收款人' },
        { id: 'amount', title: '金额' }
      ]
    });

    const records = settlements.map(s => ({
      from: s.from.userName,
      to: s.to.userName,
      amount: s.amount.toFixed(2)
    }));

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  static generateFullReport() {
    try {
      const bills = BillService.getAllBills(10000, 0);
      const { balances, settlements } = BillService.calculateSettlement();
      const users = UserService.getAllUsers();

      const billsCsv = this.generateBillsCsv(bills);
      const balancesCsv = this.generateBalancesCsv(balances);
      const settlementsCsv = this.generateSettlementsCsv(settlements);

      const summary = {
        generatedAt: new Date().toISOString(),
        totalUsers: users.length,
        totalBills: bills.length,
        totalAmount: bills.reduce((sum, b) => sum + b.total_amount, 0),
        balances,
        settlements
      };

      return {
        billsCsv,
        balancesCsv,
        settlementsCsv,
        summary,
        bills,
        users
      };
    } catch (error) {
      logger.error('Failed to generate full report', { error: error.message });
      throw error;
    }
  }

  static generateDateRangeReport(startDate, endDate) {
    try {
      const startMs = startDate ? new Date(startDate).getTime() : null;
      const endMs = endDate ? new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1) : null;
      
      const bills = BillService.getBillsByDateRange(startMs, endMs);
      const { balances, settlements } = BillService.calculateSettlement();
      const users = UserService.getAllUsers();

      const billsCsv = this.generateBillsCsv(bills);
      const balancesCsv = this.generateBalancesCsv(balances);
      const settlementsCsv = this.generateSettlementsCsv(settlements);

      const summary = {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: startDate,
          end: endDate
        },
        totalUsers: users.length,
        totalBills: bills.length,
        totalAmount: bills.reduce((sum, b) => sum + b.total_amount, 0)
      };

      return {
        billsCsv,
        balancesCsv,
        settlementsCsv,
        summary,
        bills,
        users
      };
    } catch (error) {
      logger.error('Failed to generate date range report', { error: error.message });
      throw error;
    }
  }

  static generateUserReport(userId) {
    try {
      const user = UserService.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const paidBills = db.prepare(`
        SELECT * FROM bills 
        WHERE payer_id = ? AND is_deleted = 0
        ORDER BY created_at DESC
      `).all(userId);

      const involvedBills = db.prepare(`
        SELECT b.*, bs.amount as my_share
        FROM bills b
        JOIN bill_splits bs ON b.id = bs.bill_id
        WHERE bs.user_id = ? AND b.is_deleted = 0
        ORDER BY b.created_at DESC
      `).all(userId);

      const summary = UserService.getUserSummary(userId);

      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'date', title: '日期' },
          { id: 'description', title: '描述' },
          { id: 'type', title: '类型' },
          { id: 'total_amount', title: '总金额' },
          { id: 'my_amount', title: '我的金额' }
        ]
      });

      const records = [];
      
      paidBills.forEach(bill => {
        records.push({
          date: new Date(bill.created_at).toLocaleString('zh-CN'),
          description: bill.description,
          type: '付款',
          total_amount: bill.total_amount.toFixed(2),
          my_amount: '-'
        });
      });

      involvedBills.forEach(bill => {
        records.push({
          date: new Date(bill.created_at).toLocaleString('zh-CN'),
          description: bill.description,
          type: '分摊',
          total_amount: bill.total_amount.toFixed(2),
          my_amount: bill.my_share.toFixed(2)
        });
      });

      records.sort((a, b) => new Date(b.date) - new Date(a.date));

      const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

      return {
        user,
        summary,
        paidBills,
        involvedBills,
        csv,
        records
      };
    } catch (error) {
      logger.error('Failed to generate user report', { error: error.message, userId });
      throw error;
    }
  }

  static saveReportToFile(reportType, content, extension = 'csv') {
    const timestamp = Date.now();
    const filename = `${reportType}_${timestamp}.${extension}`;
    const filepath = path.join(reportsDir, filename);
    
    fs.writeFileSync(filepath, content, 'utf-8');
    
    return {
      filename,
      filepath,
      timestamp
    };
  }

  static async generateAsyncReport(reportType, options = {}) {
    const taskId = taskQueue.createTask(
      taskQueue.TASK_TYPES.GENERATE_REPORT,
      { reportType, options },
      1,
      3
    );
    
    return taskId;
  }
}

taskQueue.registerHandler(taskQueue.TASK_TYPES.GENERATE_REPORT, async (payload) => {
  const { reportType, options } = payload;
  logger.info('Processing async report', { reportType, options });
  
  switch (reportType) {
    case 'full': {
      const report = ReportService.generateFullReport();
      const fullCsv = report.billsCsv + '\n\n--- 余额 ---\n\n' + report.balancesCsv + '\n\n--- 结算建议 ---\n\n' + report.settlementsCsv;
      ReportService.saveReportToFile('full_report', fullCsv);
      break;
    }
    case 'dateRange': {
      const report = ReportService.generateDateRangeReport(options.startDate, options.endDate);
      ReportService.saveReportToFile('date_range_report', report.billsCsv);
      break;
    }
    case 'user': {
      const report = ReportService.generateUserReport(options.userId);
      ReportService.saveReportToFile(`user_${options.userId}_report`, report.csv);
      break;
    }
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
  
  logger.info('Async report generated successfully', { reportType });
});

module.exports = ReportService;
