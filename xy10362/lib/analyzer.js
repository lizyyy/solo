const { getDb } = require('./database');

const TOLERANCE = 0.01;

function round(num) {
  return Math.round(num * 100) / 100;
}

function isApproxEqual(a, b) {
  return Math.abs(a - b) < TOLERANCE;
}

function normalizeName(name) {
  if (!name) return '';
  return name.toString().trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '');
}

function isSameName(a, b) {
  return normalizeName(a) === normalizeName(b);
}

function findRelatedInvoices(contract) {
  const db = getDb();
  
  const invoices = [];
  const seenIds = new Set();
  
  const byExactName = db.prepare(`
    SELECT * FROM invoices 
    WHERE customer_name = ? AND status = 'valid'
  `).all(contract.customer_name);
  
  byExactName.forEach(inv => {
    if (!seenIds.has(inv.id)) {
      inv.matchType = 'exact_name';
      invoices.push(inv);
      seenIds.add(inv.id);
    }
  });
  
  if (contract.customer_tax_id) {
    const byTaxId = db.prepare(`
      SELECT * FROM invoices 
      WHERE customer_tax_id = ? AND status = 'valid'
    `).all(contract.customer_tax_id);
    
    byTaxId.forEach(inv => {
      if (!seenIds.has(inv.id)) {
        inv.matchType = 'tax_id';
        inv.possibleMismatch = true;
        invoices.push(inv);
        seenIds.add(inv.id);
      }
    });
  }
  
  const contractNorm = normalizeName(contract.customer_name);
  const allInvoices = db.prepare(`SELECT * FROM invoices WHERE status = 'valid'`).all();
  
  for (const inv of allInvoices) {
    if (seenIds.has(inv.id)) continue;
    
    const invNorm = normalizeName(inv.customer_name);
    if (contractNorm && invNorm && (contractNorm.includes(invNorm) || invNorm.includes(contractNorm))) {
      const similarity = calculateSimilarity(contractNorm, invNorm);
      if (similarity > 0.5) {
        inv.matchType = 'fuzzy';
        inv.possibleMismatch = true;
        inv.similarity = similarity;
        invoices.push(inv);
        seenIds.add(inv.id);
      }
    }
  }
  
  return invoices;
}

function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.indexOf(shorter[i]) !== -1) {
      matches++;
    }
  }
  
  return matches / longer.length;
}

function getContractStats(contractId) {
  const db = getDb();
  
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
  if (!contract) return null;

  const receipts = db.prepare(`
    SELECT * FROM receipts 
    WHERE customer_name = ? AND is_negative = 0
  `).all(contract.customer_name);

  const negativeReceipts = db.prepare(`
    SELECT * FROM receipts 
    WHERE customer_name = ? AND is_negative = 1
  `).all(contract.customer_name);

  const invoices = findRelatedInvoices(contract);

  const grossReceipt = receipts.reduce((sum, r) => sum + r.amount, 0);
  const negativeAmount = negativeReceipts.reduce((sum, r) => sum + r.amount, 0);
  const netReceipt = round(grossReceipt - negativeAmount);

  const invoiceTotal = invoices.reduce((sum, i) => sum + i.total_amount, 0);

  let collectionRecord = null;
  const latestCollection = db.prepare(`
    SELECT * FROM collection_records 
    WHERE contract_id = ? 
    ORDER BY follow_up_date DESC, created_at DESC 
    LIMIT 1
  `).get(contractId);

  const allCollections = db.prepare(`
    SELECT * FROM collection_records 
    WHERE contract_id = ? 
    ORDER BY follow_up_date DESC, created_at DESC
  `).all(contractId);

  if (latestCollection) {
    collectionRecord = {
      is_followed_up: latestCollection.is_followed_up === 1,
      promise_date: latestCollection.promise_date,
      follow_up_remark: latestCollection.follow_up_remark,
      follow_up_date: latestCollection.follow_up_date,
      total_follow_ups: allCollections.length,
      follow_ups: allCollections
    };
  }

  return {
    contract,
    receipts,
    negativeReceipts,
    invoices,
    grossReceipt,
    negativeAmount,
    netReceipt,
    invoiceTotal,
    collectionRecord
  };
}

function analyzeContract(contractId) {
  const stats = getContractStats(contractId);
  if (!stats) return null;

  const { contract, netReceipt, invoiceTotal, invoices, receipts } = stats;

  const issues = [];

  const needInvoice = round(netReceipt - invoiceTotal);

  if (isApproxEqual(netReceipt, 0) && receipts.length === 0) {
    return {
      ...stats,
      status: 'no_receipt',
      issues: [],
      needInvoice: 0,
      statusText: '无收款记录'
    };
  }

  const headIssues = checkInvoiceTitles(contract.customer_name, invoices);
  issues.push(...headIssues);

  if (needInvoice > TOLERANCE) {
    if (isApproxEqual(invoiceTotal, 0)) {
      issues.push({
        type: 'no_invoice',
        message: `已收款 ¥${netReceipt.toFixed(2)}，尚未开票`,
        amount: needInvoice
      });
    } else {
      issues.push({
        type: 'partial_invoice',
        message: `已收款 ¥${netReceipt.toFixed(2)}，已开票 ¥${invoiceTotal.toFixed(2)}，还差 ¥${needInvoice.toFixed(2)}`,
        amount: needInvoice
      });
    }
  }

  let status;
  if (needInvoice > TOLERANCE) {
    status = issues.some(i => i.type === 'no_invoice') ? 'no_invoice' : 'partial_invoice';
  } else if (headIssues.length > 0) {
    status = 'title_mismatch';
  } else {
    status = 'fully_invoiced';
  }

  const statusTexts = {
    no_invoice: '已收款未开票',
    partial_invoice: '已收款开票不足',
    title_mismatch: '发票抬头异常',
    fully_invoiced: '已全额开票'
  };

  return {
    ...stats,
    status,
    issues,
    needInvoice: Math.max(0, needInvoice),
    statusText: statusTexts[status] || '未知状态'
  };
}

function checkInvoiceTitles(contractCustomer, invoices) {
  const issues = [];
  const contractName = normalizeName(contractCustomer);

  for (const inv of invoices) {
    const invName = normalizeName(inv.customer_name);
    if (invName && contractName && invName !== contractName) {
      issues.push({
        type: 'title_mismatch',
        message: `发票 ${inv.invoice_no} (¥${inv.total_amount.toFixed(2)}) 抬头为「${inv.customer_name}」，与合同客户「${contractCustomer}」不一致`,
        invoiceNo: inv.invoice_no,
        invoiceAmount: inv.total_amount,
        contractTitle: contractCustomer,
        invoiceTitle: inv.customer_name
      });
    }
  }

  return issues;
}

function analyzeAllContracts(options = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM contracts WHERE 1=1';
  const params = [];

  if (options.customer) {
    sql += ' AND customer_name LIKE ?';
    params.push(`%${options.customer}%`);
  }
  if (options.contractNo) {
    sql += ' AND contract_no LIKE ?';
    params.push(`%${options.contractNo}%`);
  }
  if (options.project) {
    sql += ' AND project_name LIKE ?';
    params.push(`%${options.project}%`);
  }
  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY contract_date DESC, id DESC';

  const contracts = db.prepare(sql).all(...params);
  
  const results = [];
  for (const c of contracts) {
    const analysis = analyzeContract(c.id);
    if (analysis) {
      if (options.filterStatus && options.filterStatus !== 'all') {
        if (analysis.status !== options.filterStatus) continue;
      }
      if (options.needCollection) {
        if (analysis.status === 'fully_invoiced' || analysis.status === 'no_receipt') {
          continue;
        }
      }
      results.push(analysis);
    }
  }

  return results;
}

function getSummary() {
  const db = getDb();
  
  const contracts = db.prepare('SELECT * FROM contracts').all();
  const analyses = contracts.map(c => analyzeContract(c.id)).filter(Boolean);

  const totalContractAmount = analyses.reduce((s, a) => s + a.contract.contract_amount, 0);
  const totalNetReceipt = analyses.reduce((s, a) => s + a.netReceipt, 0);
  const totalInvoiced = analyses.reduce((s, a) => s + a.invoiceTotal, 0);
  const totalNeedInvoice = analyses.reduce((s, a) => s + a.needInvoice, 0);

  const grouped = {
    fully_invoiced: [],
    no_invoice: [],
    partial_invoice: [],
    title_mismatch: [],
    no_receipt: []
  };

  for (const a of analyses) {
    if (grouped[a.status]) grouped[a.status].push(a);
  }

  const needCollection = analyses.filter(a => 
    a.status === 'no_invoice' || a.status === 'partial_invoice'
  );

  const followedUp = needCollection.filter(a => 
    a.collectionRecord && a.collectionRecord.is_followed_up
  );
  const notFollowedUp = needCollection.filter(a => 
    !a.collectionRecord || !a.collectionRecord.is_followed_up
  );

  const withPromise = needCollection.filter(a => 
    a.collectionRecord && a.collectionRecord.promise_date
  );

  return {
    totalContracts: contracts.length,
    totalContractAmount: round(totalContractAmount),
    totalNetReceipt: round(totalNetReceipt),
    totalInvoiced: round(totalInvoiced),
    totalNeedInvoice: round(totalNeedInvoice),
    
    fullyInvoicedCount: grouped.fully_invoiced.length,
    fullyInvoicedAmount: round(grouped.fully_invoiced.reduce((s, a) => s + a.netReceipt, 0)),
    
    noInvoiceCount: grouped.no_invoice.length,
    noInvoiceAmount: round(grouped.no_invoice.reduce((s, a) => s + a.needInvoice, 0)),
    
    partialInvoiceCount: grouped.partial_invoice.length,
    partialInvoiceAmount: round(grouped.partial_invoice.reduce((s, a) => s + a.needInvoice, 0)),
    
    titleMismatchCount: grouped.title_mismatch.length,
    
    needCollectionCount: needCollection.length,
    needCollectionAmount: round(totalNeedInvoice),
    
    followedUpCount: followedUp.length,
    notFollowedUpCount: notFollowedUp.length,
    withPromiseCount: withPromise.length,
    
    analyses
  };
}

function markFollowedUp(contractId, remark = '') {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  
  db.prepare(`
    INSERT INTO collection_records 
    (contract_id, follow_up_date, is_followed_up, follow_up_remark)
    VALUES (?, ?, 1, ?)
  `).run(contractId, today, remark);

  return true;
}

function setPromiseDate(contractId, promiseDate, remark = '') {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  
  db.prepare(`
    INSERT INTO collection_records 
    (contract_id, follow_up_date, is_followed_up, promise_date, follow_up_remark)
    VALUES (?, ?, 1, ?, ?)
  `).run(contractId, today, promiseDate, remark);

  return true;
}

function getCollectionHistory(contractId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM collection_records 
    WHERE contract_id = ? 
    ORDER BY follow_up_date DESC, created_at DESC
  `).all(contractId);
}

module.exports = {
  getContractStats,
  analyzeContract,
  analyzeAllContracts,
  getSummary,
  markFollowedUp,
  setPromiseDate,
  getCollectionHistory,
  normalizeName,
  isSameName
};
