const { run, get, all, transaction } = require('../db/database');
const dateUtils = require('../utils/dateUtils');

function getInvoiceBalance(invoiceId) {
  const invoice = get('SELECT amount FROM invoices WHERE id = ?', invoiceId);
  if (!invoice) return 0;
  
  const allocations = get(`
    SELECT SUM(allocated_amount) as total FROM payment_allocations WHERE invoice_id = ?
  `, invoiceId);
  
  const allocated = allocations?.total || 0;
  return invoice.amount - allocated;
}

function addReceivableLedgerEntry(entry) {
  const { customerId, contractId, invoiceId, ledgerType, amount, balance, dueDate, transactionDate, referenceNo, remark } = entry;
  
  return run(`
    INSERT INTO receivable_ledger 
    (customer_id, contract_id, invoice_id, ledger_type, amount, balance, due_date, transaction_date, reference_no, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, customerId, contractId || null, invoiceId || null, ledgerType, amount, balance, dueDate || null, transactionDate, referenceNo || null, remark || null);
}

function createCustomer(data) {
  return run(`
    INSERT INTO customers (name, code, contact_person, phone, credit_rating)
    VALUES (?, ?, ?, ?, ?)
  `, data.name, data.code, data.contactPerson || null, data.phone || null, data.creditRating || 'normal');
}

function getCustomers() {
  return all('SELECT * FROM customers ORDER BY created_at DESC');
}

function createContract(data) {
  const result = run(`
    INSERT INTO contracts (customer_id, contract_no, contract_name, total_amount, signed_date, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, data.customerId, data.contractNo, data.contractName, data.totalAmount, data.signedDate || null, data.startDate || null, data.endDate || null, data.status || 'active');
  
  addReceivableLedgerEntry({
    customerId: data.customerId,
    contractId: result.lastInsertRowid,
    invoiceId: null,
    ledgerType: 'contract',
    amount: data.totalAmount,
    balance: data.totalAmount,
    dueDate: null,
    transactionDate: data.signedDate || dateUtils.getToday(),
    referenceNo: data.contractNo,
    remark: '合同签订'
  });
  
  return result;
}

function getContracts(customerId = null) {
  if (customerId) {
    return all('SELECT * FROM contracts WHERE customer_id = ? ORDER BY created_at DESC', customerId);
  }
  return all('SELECT * FROM contracts ORDER BY created_at DESC');
}

function createInvoice(data) {
  const result = run(`
    INSERT INTO invoices (contract_id, customer_id, invoice_no, invoice_date, due_date, amount, tax_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, data.contractId || null, data.customerId, data.invoiceNo, data.invoiceDate, data.dueDate, data.amount, data.taxAmount || 0, 'unpaid');
  
  addReceivableLedgerEntry({
    customerId: data.customerId,
    contractId: data.contractId || null,
    invoiceId: result.lastInsertRowid,
    ledgerType: 'invoice',
    amount: data.amount,
    balance: data.amount,
    dueDate: data.dueDate,
    transactionDate: data.invoiceDate,
    referenceNo: data.invoiceNo,
    remark: '发票开具'
  });
  
  return result;
}

function getInvoices(customerId = null) {
  const query = `
    SELECT i.*, c.name as customer_name, ct.contract_no, ct.contract_name
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN contracts ct ON i.contract_id = ct.id
  `;
  
  if (customerId) {
    return all(query + ' WHERE i.customer_id = ? ORDER BY i.due_date DESC', customerId);
  }
  return all(query + ' ORDER BY i.due_date DESC');
}

function getInvoiceDetail(invoiceId) {
  const invoice = get(`
    SELECT i.*, c.name as customer_name, c.code as customer_code, ct.contract_no, ct.contract_name
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN contracts ct ON i.contract_id = ct.id
    WHERE i.id = ?
  `, invoiceId);
  
  if (!invoice) return null;
  
  const balance = getInvoiceBalance(invoiceId);
  
  const allocations = all(`
    SELECT pa.*, p.payment_no, p.payment_date, p.payment_method
    FROM payment_allocations pa
    LEFT JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = ?
    ORDER BY pa.allocated_at DESC
  `, invoiceId);
  
  return { ...invoice, balance, allocations };
}

function recordPayment(data) {
  const paymentResult = run(`
    INSERT INTO payments (customer_id, payment_no, payment_date, amount, payment_method, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `, data.customerId, data.paymentNo, data.paymentDate, data.amount, data.paymentMethod || null, data.remark || null);
  
  const paymentId = paymentResult.lastInsertRowid;
  
  if (data.allocations && data.allocations.length > 0) {
    for (const alloc of data.allocations) {
      run(`
        INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
        VALUES (?, ?, ?)
      `, paymentId, alloc.invoiceId, alloc.amount);
      
      const balance = getInvoiceBalance(alloc.invoiceId);
      
      addReceivableLedgerEntry({
        customerId: data.customerId,
        contractId: null,
        invoiceId: alloc.invoiceId,
        ledgerType: 'payment',
        amount: -alloc.amount,
        balance: balance,
        dueDate: null,
        transactionDate: data.paymentDate,
        referenceNo: data.paymentNo,
        remark: '回款核销'
      });
      
      if (balance <= 0) {
        run('UPDATE invoices SET status = ? WHERE id = ?', 'paid', alloc.invoiceId);
      }
    }
  }
  
  return paymentResult;
}

function getPayments(customerId = null) {
  const query = `
    SELECT p.*, c.name as customer_name
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
  `;
  
  if (customerId) {
    return all(query + ' WHERE p.customer_id = ? ORDER BY p.payment_date DESC', customerId);
  }
  return all(query + ' ORDER BY p.payment_date DESC');
}

function getReceivableLedger(customerId = null) {
  const query = `
    SELECT rl.*, c.name as customer_name, c.code as customer_code,
           ct.contract_no, i.invoice_no
    FROM receivable_ledger rl
    LEFT JOIN customers c ON rl.customer_id = c.id
    LEFT JOIN contracts ct ON rl.contract_id = ct.id
    LEFT JOIN invoices i ON rl.invoice_id = i.id
  `;
  
  if (customerId) {
    return all(query + ' WHERE rl.customer_id = ? ORDER BY rl.transaction_date DESC', customerId);
  }
  return all(query + ' ORDER BY rl.transaction_date DESC');
}

function getCustomerReceivableSummary(customerId) {
  const invoices = all(`
    SELECT * FROM invoices WHERE customer_id = ?
  `, customerId);
  
  let totalReceivable = 0;
  let totalOverdue = 0;
  let totalPaid = 0;
  
  for (const inv of invoices) {
    const balance = getInvoiceBalance(inv.id);
    totalReceivable += balance;
    
    const overdueDays = dateUtils.getOverdueDays(inv.due_date);
    if (overdueDays > 0) {
      totalOverdue += balance;
    }
    
    totalPaid += (inv.amount - balance);
  }
  
  return {
    customerId,
    totalReceivable,
    totalOverdue,
    totalPaid,
    invoiceCount: invoices.length
  };
}

module.exports = {
  createCustomer,
  getCustomers,
  createContract,
  getContracts,
  createInvoice,
  getInvoices,
  getInvoiceDetail,
  getInvoiceBalance,
  recordPayment,
  getPayments,
  getReceivableLedger,
  getCustomerReceivableSummary,
  addReceivableLedgerEntry
};
