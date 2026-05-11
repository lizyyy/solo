const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const reconciliation = require('./reconciliation');
const store = require('../models/store');

function exportJson(outputPath) {
  const summary = reconciliation.getSummary();
  const notes = reconciliation.getNotes();
  
  const exportData = {
    exportDate: new Date().toISOString(),
    summary: {
      orderCount: summary.totals.orderCount,
      paymentCount: summary.totals.paymentCount,
      invoiceCount: summary.totals.invoiceCount,
      orderAmount: summary.totals.orderAmount,
      paymentAmount: summary.totals.paymentAmount,
      invoiceAmount: summary.totals.invoiceAmount,
      redInvoiceAmount: summary.totals.redInvoiceAmount,
      netInvoiceAmount: summary.totals.netInvoiceAmount,
      unopenedAmount: summary.totals.unopenedAmount,
      issueCount: summary.totals.issueCount
    },
    customers: summary.customers.map(c => ({
      customer: c.customer,
      orderCount: c.orderCount,
      orderAmount: c.orderAmount,
      paymentAmount: c.paymentAmount,
      invoiceAmount: c.invoiceAmount,
      redInvoiceAmount: c.redInvoiceAmount,
      netInvoiceAmount: c.netInvoiceAmount,
      unopenedAmount: c.unopenedAmount,
      hasIssue: c.hasIssue,
      orders: c.orders.map(o => ({
        orderId: o.orderId,
        orderDate: o.orderDate,
        orderAmount: o.orderAmount,
        paymentAmount: o.paymentAmount,
        invoiceAmount: o.invoiceAmount,
        redInvoiceAmount: o.redInvoiceAmount,
        netInvoiceAmount: o.netInvoiceAmount,
        unopenedAmount: o.unopenedAmount,
        hasIssue: o.hasIssue
      }))
    })),
    issues: summary.issues.map(i => ({
      type: i.type,
      severity: i.severity,
      category: i.category,
      message: i.message,
      key: i.key
    })),
    notes,
    importedFiles: summary.importedFiles
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
  return outputPath;
}

function exportCsvSummary(outputPath) {
  const summary = reconciliation.getSummary();
  
  const summaryFields = [
    { label: '客户', value: 'customer' },
    { label: '订单数', value: 'orderCount' },
    { label: '订单金额', value: 'orderAmount' },
    { label: '收款金额', value: 'paymentAmount' },
    { label: '已开票金额', value: 'invoiceAmount' },
    { label: '红冲金额', value: 'redInvoiceAmount' },
    { label: '净开票金额', value: 'netInvoiceAmount' },
    { label: '未开票金额', value: 'unopenedAmount' },
    { label: '是否有问题', value: (row) => row.hasIssue ? '是' : '否' }
  ];

  const parser = new Parser({ fields: summaryFields });
  const csv = parser.parse(summary.customers);
  fs.writeFileSync(outputPath, '\ufeff' + csv, 'utf-8');
  return outputPath;
}

function exportCsvOrders(outputPath) {
  const summary = reconciliation.getSummary();
  
  const orderRows = [];
  for (const customer of summary.customers) {
    for (const order of customer.orders) {
      orderRows.push({
        customer: customer.customer,
        orderId: order.orderId,
        orderDate: order.orderDate,
        orderAmount: order.orderAmount,
        paymentAmount: order.paymentAmount,
        invoiceAmount: order.invoiceAmount,
        redInvoiceAmount: order.redInvoiceAmount,
        netInvoiceAmount: order.netInvoiceAmount,
        unopenedAmount: order.unopenedAmount,
        hasIssue: order.hasIssue ? '是' : '否'
      });
    }
  }

  const fields = [
    { label: '客户', value: 'customer' },
    { label: '订单号', value: 'orderId' },
    { label: '订单日期', value: 'orderDate' },
    { label: '订单金额', value: 'orderAmount' },
    { label: '收款金额', value: 'paymentAmount' },
    { label: '已开票金额', value: 'invoiceAmount' },
    { label: '红冲金额', value: 'redInvoiceAmount' },
    { label: '净开票金额', value: 'netInvoiceAmount' },
    { label: '未开票金额', value: 'unopenedAmount' },
    { label: '是否有问题', value: 'hasIssue' }
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(orderRows);
  fs.writeFileSync(outputPath, '\ufeff' + csv, 'utf-8');
  return outputPath;
}

function exportCsvIssues(outputPath) {
  const summary = reconciliation.getSummary();
  const notes = reconciliation.getNotes();

  const issueRows = summary.issues.map(issue => {
    const note = notes[issue.key];
    return {
      type: issue.type,
      severity: issue.severity,
      category: issue.category,
      message: issue.message,
      key: issue.key,
      note: note ? note.text : '',
      noteDate: note ? note.createdAt : ''
    };
  });

  const fields = [
    { label: '问题类型', value: 'type' },
    { label: '严重程度', value: 'severity' },
    { label: '类别', value: 'category' },
    { label: '问题描述', value: 'message' },
    { label: '问题标识', value: 'key' },
    { label: '人工说明', value: 'note' },
    { label: '说明日期', value: 'noteDate' }
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(issueRows);
  fs.writeFileSync(outputPath, '\ufeff' + csv, 'utf-8');
  return outputPath;
}

function exportReport(outputDir, format = 'all') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const results = [];

  if (format === 'all' || format === 'json') {
    const jsonPath = path.join(outputDir, `monthly-report-${timestamp}.json`);
    exportJson(jsonPath);
    results.push({ type: 'json', path: jsonPath });
  }

  if (format === 'all' || format === 'csv') {
    const summaryPath = path.join(outputDir, `monthly-summary-${timestamp}.csv`);
    exportCsvSummary(summaryPath);
    results.push({ type: 'csv-summary', path: summaryPath });

    const ordersPath = path.join(outputDir, `monthly-orders-${timestamp}.csv`);
    exportCsvOrders(ordersPath);
    results.push({ type: 'csv-orders', path: ordersPath });

    const issuesPath = path.join(outputDir, `monthly-issues-${timestamp}.csv`);
    exportCsvIssues(issuesPath);
    results.push({ type: 'csv-issues', path: issuesPath });
  }

  return results;
}

module.exports = {
  exportJson,
  exportCsvSummary,
  exportCsvOrders,
  exportCsvIssues,
  exportReport
};
