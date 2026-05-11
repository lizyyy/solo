const store = require('../models/store');

function detectIssues(data) {
  const issues = [];

  for (const payment of data.payments) {
    if (!payment.orderId || payment.orderId.trim() === '') {
      issues.push({
        type: 'MISSING_ORDER_ID',
        severity: 'high',
        category: '收款',
        record: payment,
        message: `收款记录缺少订单号: 收款号=${payment.paymentId || '无'}, 客户=${payment.customer}, 金额=${payment.amount}`,
        key: `payment-missing-${payment.paymentId}-${payment.paymentDate}-${payment.amount}`
      });
    }
  }

  for (const invoice of data.invoices) {
    if (!invoice.orderId || invoice.orderId.trim() === '') {
      issues.push({
        type: 'MISSING_ORDER_ID',
        severity: 'high',
        category: '发票',
        record: invoice,
        message: `发票记录缺少订单号: 发票号=${invoice.invoiceId}, 客户=${invoice.customer}, 金额=${invoice.amount}`,
        key: `invoice-missing-${invoice.invoiceId}`
      });
    }
  }

  const orderMap = new Map();
  for (const order of data.orders) {
    if (order.orderId) {
      orderMap.set(order.orderId, order);
    }
  }

  const paymentsByOrder = new Map();
  for (const payment of data.payments) {
    if (payment.orderId) {
      const existing = paymentsByOrder.get(payment.orderId) || [];
      existing.push(payment);
      paymentsByOrder.set(payment.orderId, existing);
    }
  }

  const invoicesByOrder = new Map();
  for (const invoice of data.invoices) {
    if (invoice.orderId) {
      const existing = invoicesByOrder.get(invoice.orderId) || [];
      existing.push(invoice);
      invoicesByOrder.set(invoice.orderId, existing);
    }
  }

  for (const [orderId, invoices] of invoicesByOrder.entries()) {
    const payments = paymentsByOrder.get(orderId) || [];
    const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
    const positiveInvoices = invoices.filter(i => i.amount > 0);
    const totalPositiveInvoice = positiveInvoices.reduce((sum, i) => sum + i.amount, 0);

    if (totalPositiveInvoice > totalPayment && totalPayment > 0) {
      issues.push({
        type: 'INVOICE_EXCEEDS_PAYMENT',
        severity: 'high',
        category: '发票',
        orderId,
        totalPayment,
        totalInvoice: totalPositiveInvoice,
        excess: totalPositiveInvoice - totalPayment,
        message: `订单 ${orderId} 开票金额(${totalPositiveInvoice.toFixed(2)}) 大于收款金额(${totalPayment.toFixed(2)})，超额 ${(totalPositiveInvoice - totalPayment).toFixed(2)}`,
        key: `invoice-exceeds-${orderId}`
      });
    }
  }

  const invoiceMap = new Map();
  for (const invoice of data.invoices) {
    if (invoice.invoiceId) {
      invoiceMap.set(invoice.invoiceId, invoice);
    }
  }

  for (const invoice of data.invoices) {
    if (invoice.isRed && invoice.originalInvoiceId) {
      if (!invoiceMap.has(invoice.originalInvoiceId)) {
        issues.push({
          type: 'RED_INVOICE_NO_ORIGINAL',
          severity: 'medium',
          category: '红冲',
          invoice,
          message: `红冲发票 ${invoice.invoiceId} 找不到原发票 ${invoice.originalInvoiceId}`,
          key: `red-no-original-${invoice.invoiceId}`
        });
      }
    }
  }

  for (const payment of data.payments) {
    if (payment.orderId && !orderMap.has(payment.orderId)) {
      issues.push({
        type: 'ORDER_NOT_FOUND',
        severity: 'medium',
        category: '订单',
        record: payment,
        message: `收款记录关联的订单 ${payment.orderId} 在订单表中不存在`,
        key: `order-not-found-${payment.orderId}-payment`
      });
    }
  }

  for (const invoice of data.invoices) {
    if (invoice.orderId && !orderMap.has(invoice.orderId)) {
      issues.push({
        type: 'ORDER_NOT_FOUND',
        severity: 'medium',
        category: '订单',
        record: invoice,
        message: `发票记录关联的订单 ${invoice.orderId} 在订单表中不存在`,
        key: `order-not-found-${invoice.orderId}-invoice`
      });
    }
  }

  return issues;
}

function calculateByOrder(data) {
  const orderStats = new Map();

  for (const order of data.orders) {
    if (!order.orderId) continue;
    orderStats.set(order.orderId, {
      orderId: order.orderId,
      customer: order.customer,
      orderAmount: order.amount,
      orderDate: order.orderDate,
      paymentAmount: 0,
      invoiceAmount: 0,
      redInvoiceAmount: 0,
      netInvoiceAmount: 0,
      unopenedAmount: 0,
      payments: [],
      invoices: [],
      hasIssue: false
    });
  }

  for (const payment of data.payments) {
    if (!payment.orderId) continue;
    let stat = orderStats.get(payment.orderId);
    if (!stat) {
      stat = {
        orderId: payment.orderId,
        customer: payment.customer,
        orderAmount: 0,
        orderDate: '',
        paymentAmount: 0,
        invoiceAmount: 0,
        redInvoiceAmount: 0,
        netInvoiceAmount: 0,
        unopenedAmount: 0,
        payments: [],
        invoices: [],
        hasIssue: true
      };
      orderStats.set(payment.orderId, stat);
    }
    stat.paymentAmount += payment.amount;
    stat.payments.push(payment);
  }

  for (const invoice of data.invoices) {
    if (!invoice.orderId) continue;
    let stat = orderStats.get(invoice.orderId);
    if (!stat) {
      stat = {
        orderId: invoice.orderId,
        customer: invoice.customer,
        orderAmount: 0,
        orderDate: '',
        paymentAmount: 0,
        invoiceAmount: 0,
        redInvoiceAmount: 0,
        netInvoiceAmount: 0,
        unopenedAmount: 0,
        payments: [],
        invoices: [],
        hasIssue: true
      };
      orderStats.set(invoice.orderId, stat);
    }
    if (invoice.isRed || invoice.amount < 0) {
      stat.redInvoiceAmount += Math.abs(invoice.amount);
    } else {
      stat.invoiceAmount += invoice.amount;
    }
    stat.invoices.push(invoice);
  }

  for (const stat of orderStats.values()) {
    stat.netInvoiceAmount = stat.invoiceAmount - stat.redInvoiceAmount;
    const baseForUnopened = stat.paymentAmount > 0 ? stat.paymentAmount : stat.orderAmount;
    stat.unopenedAmount = baseForUnopened - stat.netInvoiceAmount;
  }

  const issues = detectIssues(data);
  const issueOrderIds = new Set();
  for (const issue of issues) {
    if (issue.orderId) {
      issueOrderIds.add(issue.orderId);
    }
  }
  for (const stat of orderStats.values()) {
    if (issueOrderIds.has(stat.orderId)) {
      stat.hasIssue = true;
    }
  }

  return {
    orders: Array.from(orderStats.values()),
    issues
  };
}

function calculateByCustomer(data) {
  const orderResult = calculateByOrder(data);
  const customerStats = new Map();

  for (const order of orderResult.orders) {
    const customer = order.customer || '未知客户';
    let stat = customerStats.get(customer);
    if (!stat) {
      stat = {
        customer,
        orderCount: 0,
        orderAmount: 0,
        paymentAmount: 0,
        invoiceAmount: 0,
        redInvoiceAmount: 0,
        netInvoiceAmount: 0,
        unopenedAmount: 0,
        orders: [],
        hasIssue: false
      };
      customerStats.set(customer, stat);
    }
    stat.orderCount++;
    stat.orderAmount += order.orderAmount;
    stat.paymentAmount += order.paymentAmount;
    stat.invoiceAmount += order.invoiceAmount;
    stat.redInvoiceAmount += order.redInvoiceAmount;
    stat.netInvoiceAmount += order.netInvoiceAmount;
    stat.unopenedAmount += order.unopenedAmount;
    stat.orders.push(order);
    if (order.hasIssue) {
      stat.hasIssue = true;
    }
  }

  return {
    customers: Array.from(customerStats.values()),
    issues: orderResult.issues,
    orders: orderResult.orders
  };
}

function getSummary() {
  const data = store.loadData();
  const result = calculateByCustomer(data);
  
  const totals = {
    orderCount: data.orders.length,
    paymentCount: data.payments.length,
    invoiceCount: data.invoices.length,
    orderAmount: result.customers.reduce((sum, c) => sum + c.orderAmount, 0),
    paymentAmount: result.customers.reduce((sum, c) => sum + c.paymentAmount, 0),
    invoiceAmount: result.customers.reduce((sum, c) => sum + c.invoiceAmount, 0),
    redInvoiceAmount: result.customers.reduce((sum, c) => sum + c.redInvoiceAmount, 0),
    netInvoiceAmount: result.customers.reduce((sum, c) => sum + c.netInvoiceAmount, 0),
    unopenedAmount: result.customers.reduce((sum, c) => sum + c.unopenedAmount, 0),
    issueCount: result.issues.length,
    customersWithIssues: result.customers.filter(c => c.hasIssue).length
  };

  return {
    totals,
    customers: result.customers,
    issues: result.issues,
    orders: result.orders,
    importedFiles: store.getImportedFiles()
  };
}

function getCustomerDetail(customerName) {
  const data = store.loadData();
  const result = calculateByCustomer(data);
  
  const customer = result.customers.find(c => 
    c.customer === customerName || 
    c.customer.includes(customerName) ||
    customerName.includes(c.customer)
  );

  if (!customer) {
    return null;
  }

  return {
    customer,
    orders: customer.orders,
    customerIssues: result.issues.filter(issue => {
      if (issue.orderId) {
        return customer.orders.some(o => o.orderId === issue.orderId);
      }
      if (issue.record) {
        return issue.record.customer === customer.customer;
      }
      return false;
    })
  };
}

function addNote(key, noteText) {
  const data = store.loadData();
  if (!data.notes) {
    data.notes = {};
  }
  data.notes[key] = {
    text: noteText,
    createdAt: new Date().toISOString()
  };
  store.saveData(data);
  return data.notes[key];
}

function getNotes() {
  const data = store.loadData();
  return data.notes || {};
}

module.exports = {
  detectIssues,
  calculateByOrder,
  calculateByCustomer,
  getSummary,
  getCustomerDetail,
  addNote,
  getNotes
};
