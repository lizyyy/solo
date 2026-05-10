const { run, get, all } = require('../db/database');
const dateUtils = require('../utils/dateUtils');
const receivableService = require('./receivableService');
const agingService = require('./agingService');
const collectionService = require('./collectionService');

function getAgingReportDetail(customerId = null) {
  const latestAging = agingService.getLatestAging(customerId);
  const buckets = agingService.getAgingBuckets();
  
  const report = {
    generatedAt: new Date().toISOString(),
    totalReceivable: 0,
    totalOverdue: 0,
    byBucket: {},
    byCustomer: {},
    details: []
  };
  
  for (const bucket of buckets) {
    report.byBucket[bucket.id] = {
      bucketId: bucket.id,
      bucketName: bucket.name,
      collectionLevel: bucket.collection_level,
      description: bucket.description,
      totalAmount: 0,
      invoiceCount: 0,
      customerCount: new Set()
    };
  }
  
  for (const aging of latestAging) {
    report.totalReceivable += aging.balance;
    
    if (aging.overdue_days > 0) {
      report.totalOverdue += aging.balance;
    }
    
    if (report.byBucket[aging.bucket_id]) {
      report.byBucket[aging.bucket_id].totalAmount += aging.balance;
      report.byBucket[aging.bucket_id].invoiceCount++;
      report.byBucket[aging.bucket_id].customerCount.add(aging.customer_id);
    }
    
    if (!report.byCustomer[aging.customer_id]) {
      report.byCustomer[aging.customer_id] = {
        customerId: aging.customer_id,
        customerName: aging.customer_name,
        customerCode: aging.customer_code,
        totalAmount: 0,
        invoiceCount: 0,
        byBucket: {}
      };
    }
    
    report.byCustomer[aging.customer_id].totalAmount += aging.balance;
    report.byCustomer[aging.customer_id].invoiceCount++;
    
    if (!report.byCustomer[aging.customer_id].byBucket[aging.bucket_id]) {
      report.byCustomer[aging.customer_id].byBucket[aging.bucket_id] = {
        bucketName: aging.bucket_name,
        amount: 0,
        invoiceCount: 0
      };
    }
    report.byCustomer[aging.customer_id].byBucket[aging.bucket_id].amount += aging.balance;
    report.byCustomer[aging.customer_id].byBucket[aging.bucket_id].invoiceCount++;
    
    report.details.push({
      invoiceId: aging.invoice_id,
      invoiceNo: aging.invoice_no,
      customerId: aging.customer_id,
      customerName: aging.customer_name,
      customerCode: aging.customer_code,
      invoiceDate: aging.invoice_date,
      dueDate: aging.due_date,
      invoiceAmount: aging.amount,
      balance: aging.balance,
      overdueDays: aging.overdue_days,
      bucketId: aging.bucket_id,
      bucketName: aging.bucket_name,
      collectionLevel: aging.collection_level,
      collectionLevelInfo: agingService.getCollectionLevel(aging.collection_level)
    });
  }
  
  report.byBucket = Object.values(report.byBucket).map(item => ({
    ...item,
    customerCount: item.customerCount.size
  }));
  
  report.byCustomer = Object.values(report.byCustomer).map(cust => ({
    ...cust,
    byBucket: Object.values(cust.byBucket)
  }));
  
  return report;
}

function getCollectionPerformanceReport(startDate, endDate) {
  const start = startDate || dateUtils.startOfMonth(dateUtils.getToday());
  const end = endDate || dateUtils.getToday();
  
  const allTasks = all(`
    SELECT ct.*, c.name as customer_name, i.invoice_no
    FROM collection_tasks ct
    LEFT JOIN customers c ON ct.customer_id = c.id
    LEFT JOIN invoices i ON ct.invoice_id = i.id
    ORDER BY ct.created_at DESC
  `);
  
  const tasks = allTasks.filter(t => {
    const taskDate = t.created_at ? t.created_at.substring(0, 10) : null;
    return taskDate && taskDate >= start && taskDate <= end;
  });
  
  const allPromises = all(`
    SELECT pp.*, c.name as customer_name, ct.task_code
    FROM payment_promises pp
    LEFT JOIN customers c ON pp.customer_id = c.id
    LEFT JOIN collection_tasks ct ON pp.task_id = ct.id
    ORDER BY pp.created_at DESC
  `);
  
  const promises = allPromises.filter(p => {
    const promiseDate = p.created_at ? p.created_at.substring(0, 10) : null;
    return promiseDate && promiseDate >= start && promiseDate <= end;
  });
  
  const allPayments = all(`
    SELECT p.*, c.name as customer_name
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    ORDER BY p.payment_date DESC
  `);
  
  const payments = allPayments.filter(p => p.payment_date >= start && p.payment_date <= end);
  
  let totalTaskAmount = 0;
  let completedTaskAmount = 0;
  let totalPromisedAmount = 0;
  let fulfilledPromisedAmount = 0;
  let totalPaymentAmount = 0;
  
  const levelStats = {};
  
  for (const task of tasks) {
    totalTaskAmount += task.expected_amount || 0;
    if (task.current_status === 'completed') {
      completedTaskAmount += task.expected_amount || 0;
    }
    
    if (!levelStats[task.collection_level]) {
      levelStats[task.collection_level] = {
        level: task.collection_level,
        levelInfo: agingService.getCollectionLevel(task.collection_level),
        totalCount: 0,
        completedCount: 0,
        rejectedCount: 0,
        totalAmount: 0
      };
    }
    levelStats[task.collection_level].totalCount++;
    levelStats[task.collection_level].totalAmount += task.expected_amount || 0;
    if (task.current_status === 'completed') levelStats[task.collection_level].completedCount++;
    if (task.current_status === 'rejected') levelStats[task.collection_level].rejectedCount++;
  }
  
  for (const promise of promises) {
    totalPromisedAmount += promise.promised_amount;
    if (promise.is_fulfilled) {
      fulfilledPromisedAmount += promise.promised_amount;
    }
  }
  
  for (const payment of payments) {
    totalPaymentAmount += payment.amount;
  }
  
  return {
    period: { startDate: start, endDate: end },
    summary: {
      taskCount: tasks.length,
      completedTaskCount: tasks.filter(t => t.current_status === 'completed').length,
      rejectedTaskCount: tasks.filter(t => t.current_status === 'rejected').length,
      totalTaskAmount,
      completedTaskAmount,
      promiseCount: promises.length,
      fulfilledPromiseCount: promises.filter(p => p.is_fulfilled).length,
      totalPromisedAmount,
      fulfilledPromisedAmount,
      paymentCount: payments.length,
      totalPaymentAmount,
      collectionRate: totalTaskAmount > 0 ? (completedTaskAmount / totalTaskAmount * 100).toFixed(2) + '%' : '0%',
      promiseFulfillmentRate: totalPromisedAmount > 0 ? (fulfilledPromisedAmount / totalPromisedAmount * 100).toFixed(2) + '%' : '0%'
    },
    byCollectionLevel: Object.values(levelStats),
    tasks,
    promises,
    payments
  };
}

function getCustomer360View(customerId) {
  const customer = get('SELECT * FROM customers WHERE id = ?', customerId);
  if (!customer) return null;
  
  const summary = receivableService.getCustomerReceivableSummary(customerId);
  const contracts = receivableService.getContracts(customerId);
  const invoices = receivableService.getInvoices(customerId);
  const payments = receivableService.getPayments(customerId);
  const ledger = receivableService.getReceivableLedger(customerId);
  const aging = agingService.getLatestAging(customerId);
  const tasks = collectionService.getCollectionTasks(null, customerId);
  const promises = collectionService.getPaymentPromises(null, customerId);
  const badDebts = all(`
    SELECT bdr.*, i.invoice_no
    FROM bad_debt_records bdr
    LEFT JOIN invoices i ON bdr.invoice_id = i.id
    WHERE bdr.customer_id = ?
    ORDER BY bdr.created_at DESC
  `, customerId);
  
  const invoiceDetails = invoices.map(inv => ({
    ...inv,
    balance: receivableService.getInvoiceBalance(inv.id),
    agingInfo: aging.find(a => a.invoice_id === inv.id)
  }));
  
  return {
    customer,
    summary,
    contracts,
    invoices: invoiceDetails,
    payments,
    ledger,
    aging,
    tasks,
    promises,
    badDebts,
    reportTimestamp: new Date().toISOString()
  };
}

function generateExportData(reportType, params = {}) {
  let data = [];
  let headers = [];
  
  switch (reportType) {
    case 'aging-detail':
      const agingReport = getAgingReportDetail(params.customerId);
      headers = [
        '客户编码', '客户名称', '发票编号', '开票日期', '到期日期',
        '发票金额', '逾期金额', '逾期天数', '账龄分段', '催收等级', '催收等级说明'
      ];
      data = agingReport.details.map(item => ({
        '客户编码': item.customerCode,
        '客户名称': item.customerName,
        '发票编号': item.invoiceNo,
        '开票日期': item.invoiceDate,
        '到期日期': item.dueDate,
        '发票金额': item.invoiceAmount,
        '逾期金额': item.balance,
        '逾期天数': item.overdueDays,
        '账龄分段': item.bucketName,
        '催收等级': item.collectionLevelInfo?.label,
        '催收等级说明': item.collectionLevelInfo?.description
      }));
      break;
      
    case 'tasks-detail':
      const tasks = collectionService.getTasksWithBlockPoints();
      headers = [
        '任务编号', '客户名称', '发票编号', '催收等级',
        '当前状态', '当前步骤', '被拒次数', '最后拒绝原因',
        '卡点步骤', '卡点操作人', '卡点时间'
      ];
      data = tasks.map(item => ({
        '任务编号': item.taskCode,
        '客户名称': item.customerName,
        '发票编号': item.invoiceNo,
        '催收等级': agingService.getCollectionLevel(item.collectionLevel)?.label,
        '当前状态': item.currentStatus,
        '当前步骤': agingService.getWorkflowStep(item.currentStep)?.name,
        '被拒次数': item.rejectCount,
        '最后拒绝原因': item.lastRejectReason || '',
        '卡点步骤': item.blockPoint?.stepName ? agingService.getWorkflowStep(item.blockPoint.stepName)?.name : '',
        '卡点操作人': item.blockPoint?.operator || '',
        '卡点时间': item.blockPoint?.rejectedAt || ''
      }));
      break;
      
    case 'ledger-detail':
      const ledger = receivableService.getReceivableLedger(params.customerId);
      const typeNames = {
        contract: '合同签订',
        invoice: '发票开具',
        payment: '回款核销',
        bad_debt: '坏账核销'
      };
      headers = [
        '客户编码', '客户名称', '交易类型', '合同编号', '发票编号',
        '金额', '余额', '到期日期', '交易日期', '参考编号', '备注'
      ];
      data = ledger.map(item => ({
        '客户编码': item.customer_code,
        '客户名称': item.customer_name,
        '交易类型': typeNames[item.ledger_type] || item.ledger_type,
        '合同编号': item.contract_no || '',
        '发票编号': item.invoice_no || '',
        '金额': item.amount,
        '余额': item.balance,
        '到期日期': item.due_date || '',
        '交易日期': item.transaction_date,
        '参考编号': item.reference_no || '',
        '备注': item.remark || ''
      }));
      break;
      
    case 'customer-summary':
      const customers = receivableService.getCustomers();
      headers = [
        '客户编码', '客户名称', '联系人', '联系电话', '信用等级',
        '发票数', '应收总额', '逾期总额', '已回款总额'
      ];
      data = customers.map(cust => {
        const summary = receivableService.getCustomerReceivableSummary(cust.id);
        return {
          '客户编码': cust.code,
          '客户名称': cust.name,
          '联系人': cust.contact_person || '',
          '联系电话': cust.phone || '',
          '信用等级': cust.credit_rating,
          '发票数': summary.invoiceCount,
          '应收总额': summary.totalReceivable,
          '逾期总额': summary.totalOverdue,
          '已回款总额': summary.totalPaid
        };
      });
      break;
      
    default:
      throw new Error('未知的报表类型');
  }
  
  return { headers, data, reportType, generatedAt: new Date().toISOString() };
}

module.exports = {
  getAgingReportDetail,
  getCollectionPerformanceReport,
  getCustomer360View,
  generateExportData
};
