const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const db = require('../models/database');

class ExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '..', '..', 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportDepositReport(params = {}) {
    const { startDate, endDate, customerId } = params;
    
    let sql = `SELECT * FROM deposit_transactions WHERE 1=1`;
    let paramsArray = [];

    if (startDate) {
      sql += ` AND created_at >= ?`;
      paramsArray.push(startDate);
    }
    if (endDate) {
      sql += ` AND created_at <= ?`;
      paramsArray.push(endDate + ' 23:59:59');
    }
    if (customerId) {
      sql += ` AND customer_id = ?`;
      paramsArray.push(customerId);
    }

    sql += ` ORDER BY created_at DESC`;

    const transactions = await db.all(sql, paramsArray);

    const summary = await db.get(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposit,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN ABS(amount) ELSE 0 END), 0) as total_refund,
        COALESCE(SUM(CASE WHEN type = 'manual_correction' THEN amount ELSE 0 END), 0) as total_correction,
        COUNT(*) as transaction_count
       FROM deposit_transactions
       WHERE 1=1
       ${startDate ? ' AND created_at >= ?' : ''}
       ${endDate ? ' AND created_at <= ?' : ''}
       ${customerId ? ' AND customer_id = ?' : ''}`,
      paramsArray
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `deposit_report_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'transaction_no', title: '交易流水号' },
        { id: 'customer_name', title: '客户名称' },
        { id: 'type', title: '交易类型' },
        { id: 'type_name', title: '类型名称' },
        { id: 'amount', title: '金额(元)' },
        { id: 'related_order_no', title: '关联单号' },
        { id: 'bucket_nos', title: '桶编号' },
        { id: 'before_balance', title: '变动前余额' },
        { id: 'after_balance', title: '变动后余额' },
        { id: 'operator', title: '操作人' },
        { id: 'remark', title: '备注' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    const typeMap = {
      'deposit': '收押金',
      'deposit_frozen': '冻结押金',
      'refund': '退押金',
      'manual_correction': '人工修正'
    };

    const records = transactions.map(t => ({
      ...t,
      type_name: typeMap[t.type] || t.type
    }));

    records.push({
      transaction_no: '=== 汇总 ===',
      customer_name: '',
      type: '',
      type_name: '',
      amount: '',
      related_order_no: '',
      bucket_nos: '',
      before_balance: '',
      after_balance: '',
      operator: '',
      remark: `总收押金: ${summary.total_deposit}元, 总退押金: ${summary.total_refund}元, 净修正: ${summary.total_correction}元, 交易笔数: ${summary.transaction_count}`,
      created_at: ''
    });

    await csvWriter.writeRecords(records);

    return {
      fileName,
      filePath,
      totalRecords: transactions.length,
      summary
    };
  }

  async exportCustomerReport() {
    const customers = await db.all(
      `SELECT * FROM customers ORDER BY created_at DESC`
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `customer_report_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: '客户名称' },
        { id: 'phone', title: '联系电话' },
        { id: 'address', title: '地址' },
        { id: 'total_deposit', title: '总押金(元)' },
        { id: 'frozen_deposit', title: '冻结押金(元)' },
        { id: 'available_deposit', title: '可用押金(元)' },
        { id: 'bucket_count', title: '在用桶数' },
        { id: 'status', title: '状态' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(customers);

    return {
      fileName,
      filePath,
      totalRecords: customers.length
    };
  }

  async exportExceptionLog() {
    const exceptions = await db.all(
      `SELECT * FROM exception_logs ORDER BY created_at DESC`
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `exception_log_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'request_id', title: '请求ID' },
        { id: 'api_path', title: 'API路径' },
        { id: 'request_data', title: '请求数据' },
        { id: 'error_type', title: '错误类型' },
        { id: 'error_message', title: '错误信息' },
        { id: 'handling_result', title: '处理结果' },
        { id: 'handled_by', title: '处理人' },
        { id: 'handled_at', title: '处理时间' },
        { id: 'status', title: '状态' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(exceptions);

    return {
      fileName,
      filePath,
      totalRecords: exceptions.length
    };
  }

  getExportedFiles() {
    const files = fs.readdirSync(this.exportDir);
    return files.map(file => ({
      fileName: file,
      filePath: path.join(this.exportDir, file),
      createTime: fs.statSync(path.join(this.exportDir, file)).mtime
    })).sort((a, b) => b.createTime - a.createTime);
  }

  getFilePath(fileName) {
    return path.join(this.exportDir, fileName);
  }
}

module.exports = new ExportService();
