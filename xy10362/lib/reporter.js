const XLSX = require('xlsx');
const { getSummary, analyzeAllContracts } = require('./analyzer');
const { getDb } = require('./database');

function exportCollectionReport(outputPath, options = {}) {
  const summary = getSummary();
  let analyses = analyzeAllContracts(options);
  
  if (options.needCollection) {
    analyses = analyses.filter(a => 
      a.status === 'no_invoice' || a.status === 'partial_invoice'
    );
  }

  const summaryData = [
    ['发票催收汇总报告'],
    ['生成时间', new Date().toLocaleString('zh-CN')],
    [''],
    ['一、总体统计'],
    ['合同总数', summary.totalContracts],
    ['合同总金额', `¥${summary.totalContractAmount.toFixed(2)}`],
    ['累计收款净额', `¥${summary.totalNetReceipt.toFixed(2)}`],
    ['累计已开票', `¥${summary.totalInvoiced.toFixed(2)}`],
    ['累计待开票', `¥${summary.totalNeedInvoice.toFixed(2)}`],
    [''],
    ['二、分类统计'],
    ['已全额开票', `${summary.fullyInvoicedCount} 份, 金额 ¥${summary.fullyInvoicedAmount.toFixed(2)}`],
    ['已收款未开票', `${summary.noInvoiceCount} 份, 金额 ¥${summary.noInvoiceAmount.toFixed(2)}`],
    ['已收款开票不足', `${summary.partialInvoiceCount} 份, 金额 ¥${summary.partialInvoiceAmount.toFixed(2)}`],
    ['发票抬头异常', `${summary.titleMismatchCount} 份`],
    [''],
    ['三、催收统计'],
    ['待催收客户数', summary.needCollectionCount],
    ['待催收金额', `¥${summary.needCollectionAmount.toFixed(2)}`],
    ['已标记催收', `${summary.followedUpCount} 份`],
    ['未标记催收', `${summary.notFollowedUpCount} 份`],
    ['有承诺开票日期', `${summary.withPromiseCount} 份`],
  ];

  const listData = [
    ['序号', '合同编号', '客户名称', '项目名称', '合同金额', 
     '累计收款', '累计开票', '待开票金额', '状态', '是否已催', 
     '承诺日期', '最近催收日期', '备注']
  ];

  analyses.forEach((a, idx) => {
    listData.push([
      idx + 1,
      a.contract.contract_no,
      a.contract.customer_name,
      a.contract.project_name || '',
      a.contract.contract_amount,
      a.netReceipt,
      a.invoiceTotal,
      a.needInvoice,
      a.statusText,
      a.collectionRecord?.is_followed_up ? '已催' : '未催',
      a.collectionRecord?.promise_date || '',
      a.collectionRecord?.follow_up_date || '',
      a.collectionRecord?.follow_up_remark || ''
    ]);
  });

  const detailData = [
    ['客户名称', '合同编号', '问题类型', '问题描述', '涉及金额', 
     '收款记录', '开票记录', '催收状态', '承诺日期']
  ];

  analyses.forEach((a) => {
    if (a.issues.length === 0 && a.status !== 'fully_invoiced') {
      detailData.push([
        a.contract.customer_name,
        a.contract.contract_no,
        a.statusText,
        `待开票 ¥${a.needInvoice.toFixed(2)}`,
        a.needInvoice,
        a.receipts.map(r => `${r.receipt_date}: ¥${r.amount.toFixed(2)}`).join('; '),
        a.invoices.map(i => `${i.invoice_no}: ¥${i.total_amount.toFixed(2)}`).join('; '),
        a.collectionRecord?.is_followed_up ? '已催' : '未催',
        a.collectionRecord?.promise_date || ''
      ]);
    }
    
    a.issues.forEach((issue) => {
      detailData.push([
        a.contract.customer_name,
        a.contract.contract_no,
        getIssueTypeText(issue.type),
        issue.message,
        issue.amount || a.needInvoice || 0,
        a.receipts.map(r => `${r.receipt_date}: ¥${r.amount.toFixed(2)}`).join('; '),
        a.invoices.map(i => `${i.invoice_no}: ¥${i.total_amount.toFixed(2)}`).join('; '),
        a.collectionRecord?.is_followed_up ? '已催' : '未催',
        a.collectionRecord?.promise_date || ''
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '汇总');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(listData), '催收清单');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), '问题明细');

  const receiptsData = exportReceipts();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(receiptsData), '收款明细');

  const invoicesData = exportInvoices();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invoicesData), '发票明细');

  XLSX.writeFile(wb, outputPath);
  return outputPath;
}

function getIssueTypeText(type) {
  const map = {
    no_invoice: '已收款未开票',
    partial_invoice: '已收款开票不足',
    title_mismatch: '发票抬头不一致'
  };
  return map[type] || type;
}

function exportReceipts() {
  const db = getDb();
  const receipts = db.prepare(`
    SELECT r.*, c.contract_no 
    FROM receipts r 
    LEFT JOIN contracts c ON r.matched_contract_id = c.id
    ORDER BY r.receipt_date DESC
  `).all();

  const header = ['流水号', '客户名称', '金额', '收款日期', '银行', '账号', 
                  '支付方式', '用途', '是否冲销', '关联合同'];
  
  const data = [header];
  receipts.forEach(r => {
    data.push([
      r.receipt_no,
      r.customer_name,
      r.amount,
      r.receipt_date,
      r.bank_name || '',
      r.bank_account || '',
      r.payment_method || '',
      r.purpose || '',
      r.is_negative ? '是(冲销)' : '否',
      r.contract_no || ''
    ]);
  });

  return data;
}

function exportInvoices() {
  const db = getDb();
  const invoices = db.prepare(`
    SELECT i.*, c.contract_no 
    FROM invoices i 
    LEFT JOIN contracts c ON i.matched_contract_id = c.id
    ORDER BY i.invoice_date DESC
  `).all();

  const header = ['发票号', '发票类型', '开票日期', '客户名称', '税号',
                  '金额', '税额', '价税合计', '状态', '关联合同'];
  
  const data = [header];
  invoices.forEach(i => {
    data.push([
      i.invoice_no,
      i.invoice_type,
      i.invoice_date,
      i.customer_name,
      i.customer_tax_id || '',
      i.amount,
      i.tax_amount || 0,
      i.total_amount,
      i.status,
      i.contract_no || ''
    ]);
  });

  return data;
}

module.exports = {
  exportCollectionReport,
  exportReceipts,
  exportInvoices
};
