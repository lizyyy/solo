const { run, get, all, transaction } = require('../db/database');
const dateUtils = require('../utils/dateUtils');
const receivableService = require('./receivableService');

const WORKFLOW_STEPS = {
  initiate: { name: '任务发起', next: 'review', canReject: true },
  review: { name: '领导审核', next: 'execute', canReject: true },
  execute: { name: '催收执行', next: 'followup', canReject: false },
  followup: { name: '跟进反馈', next: 'close', canReject: false },
  close: { name: '任务关闭', next: null, canReject: false }
};

const COLLECTION_LEVELS = {
  none: { label: '无催收', description: '未到期或已结清' },
  level1: { label: '一级催收', description: '逾期30天内，电话提醒' },
  level2: { label: '二级催收', description: '逾期31-60天，正式催款函' },
  level3: { label: '三级催收', description: '逾期61-90天，法务介入' },
  level4: { label: '四级催收', description: '逾期90天以上，坏账评估' }
};

function getAgingBuckets() {
  return all('SELECT * FROM aging_buckets WHERE is_active = 1 ORDER BY min_days');
}

function determineBucket(overdueDays) {
  const buckets = getAgingBuckets();
  
  for (const bucket of buckets) {
    if (overdueDays === 0 && bucket.min_days === 0 && bucket.max_days === 0) {
      return bucket;
    }
    if (overdueDays >= bucket.min_days) {
      if (bucket.max_days === null || overdueDays <= bucket.max_days) {
        return bucket;
      }
    }
  }
  
  return buckets[buckets.length - 1];
}

function calculateInvoiceAging(invoiceId) {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', invoiceId);
  if (!invoice) return null;
  
  const balance = receivableService.getInvoiceBalance(invoiceId);
  
  if (balance <= 0) {
    return {
      invoiceId,
      balance: 0,
      overdueDays: 0,
      bucketName: '已结清',
      collectionLevel: 'none'
    };
  }
  
  const overdueDays = dateUtils.getOverdueDays(invoice.due_date);
  const bucket = determineBucket(overdueDays);
  
  return {
    invoiceId,
    invoiceNo: invoice.invoice_no,
    customerId: invoice.customer_id,
    balance,
    overdueDays,
    bucketId: bucket.id,
    bucketName: bucket.name,
    collectionLevel: bucket.collection_level
  };
}

function runAgingCalculation(agingDate = null) {
  const targetDate = agingDate || dateUtils.getToday();
  
  const unpaidInvoices = all(`
    SELECT i.*, c.name as customer_name, c.code as customer_code
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.status != 'paid'
  `);
  
  const results = [];
  
  for (const invoice of unpaidInvoices) {
    const aging = calculateInvoiceAging(invoice.id);
    if (aging && aging.balance > 0) {
      run(`
        INSERT INTO invoice_aging 
        (invoice_id, customer_id, bucket_id, overdue_days, balance, aging_date, collection_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        aging.invoiceId,
        invoice.customer_id,
        aging.bucketId,
        aging.overdueDays,
        aging.balance,
        targetDate,
        aging.collectionLevel
      );
      
      results.push({
        ...aging,
        customerName: invoice.customer_name,
        customerCode: invoice.customer_code,
        invoiceNo: invoice.invoice_no,
        dueDate: invoice.due_date,
        invoiceAmount: invoice.amount
      });
    }
  }
  
  return results;
}

function getLatestAging(customerId = null) {
  const allAging = all(`
    SELECT ia.*, i.invoice_no, i.invoice_date, i.due_date, i.amount,
           c.name as customer_name, c.code as customer_code,
           ab.name as bucket_name
    FROM invoice_aging ia
    LEFT JOIN invoices i ON ia.invoice_id = i.id
    LEFT JOIN customers c ON ia.customer_id = c.id
    LEFT JOIN aging_buckets ab ON ia.bucket_id = ab.id
    WHERE ia.balance > 0
    ORDER BY ia.created_at DESC
  `);
  
  const latestMap = new Map();
  for (const aging of allAging) {
    if (!latestMap.has(aging.invoice_id)) {
      latestMap.set(aging.invoice_id, aging);
    }
  }
  
  let result = Array.from(latestMap.values());
  
  if (customerId) {
    result = result.filter(a => a.customer_id === customerId);
  }
  
  return result.sort((a, b) => b.overdue_days - a.overdue_days);
}

function getAgingSummary() {
  const latestAging = getLatestAging();
  const buckets = getAgingBuckets();
  
  const summary = {};
  
  for (const bucket of buckets) {
    summary[bucket.id] = {
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
    const bucketId = aging.bucket_id;
    if (summary[bucketId]) {
      summary[bucketId].invoiceCount++;
      summary[bucketId].totalAmount += aging.balance;
      summary[bucketId].customerCount.add(aging.customer_id);
    }
  }
  
  return Object.values(summary).map(item => ({
    ...item,
    customerCount: item.customerCount.size
  }));
}

function getCollectionLevel(collectionLevel) {
  return COLLECTION_LEVELS[collectionLevel] || COLLECTION_LEVELS.none;
}

function getWorkflowStep(stepName) {
  return WORKFLOW_STEPS[stepName] || null;
}

function getAllWorkflowSteps() {
  return Object.entries(WORKFLOW_STEPS).map(([key, value]) => ({
    key,
    ...value
  }));
}

module.exports = {
  getAgingBuckets,
  determineBucket,
  calculateInvoiceAging,
  runAgingCalculation,
  getLatestAging,
  getAgingSummary,
  getCollectionLevel,
  getWorkflowStep,
  getAllWorkflowSteps,
  WORKFLOW_STEPS,
  COLLECTION_LEVELS
};
