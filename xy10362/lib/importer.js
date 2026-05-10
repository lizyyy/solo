const XLSX = require('xlsx');
const { getDb } = require('./database');
const crypto = require('crypto');

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function generateReceiptNo(row, index) {
  const str = `${row.customer_name || ''}-${row.receipt_date || ''}-${row.amount || ''}-${index}`;
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 20);
}

function generateInvoiceNo(row, index) {
  if (row.invoice_no && row.invoice_no.trim()) {
    return row.invoice_no.trim();
  }
  const str = `${row.customer_name || ''}-${row.invoice_date || ''}-${row.total_amount || ''}-${index}`;
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 20);
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const match = String(dateStr).match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})日?/);
    if (match) {
      const [, y, m, d] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = Number(amount);
  return isNaN(num) ? 0 : num;
}

function importContracts(filePath) {
  const db = getDb();
  const data = parseExcel(filePath);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const insertStmt = db.prepare(`
    INSERT INTO contracts 
    (contract_no, customer_name, customer_tax_id, customer_bank_info, 
     contract_amount, contract_date, project_name, effective_date, expiry_date, status)
    VALUES (@contract_no, @customer_name, @customer_tax_id, @customer_bank_info,
            @contract_amount, @contract_date, @project_name, @effective_date, @expiry_date, @status)
  `);

  const updateStmt = db.prepare(`
    UPDATE contracts SET
      customer_name = @customer_name,
      customer_tax_id = @customer_tax_id,
      customer_bank_info = @customer_bank_info,
      contract_amount = @contract_amount,
      contract_date = @contract_date,
      project_name = @project_name,
      effective_date = @effective_date,
      expiry_date = @expiry_date,
      status = @status,
      updated_at = CURRENT_TIMESTAMP
    WHERE contract_no = @contract_no
  `);

  const findStmt = db.prepare('SELECT id FROM contracts WHERE contract_no = ?');

  const transaction = db.transaction((rows) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const contract_no = (row.contract_no || row['合同编号'] || row['合同号'] || '').toString().trim();
      
      if (!contract_no) {
        skipped++;
        continue;
      }

      const record = {
        contract_no,
        customer_name: (row.customer_name || row['客户名称'] || row['客户'] || '').toString().trim(),
        customer_tax_id: (row.customer_tax_id || row['税号'] || row['纳税人识别号'] || '').toString().trim(),
        customer_bank_info: (row.customer_bank_info || row['银行信息'] || row['开户行'] || '').toString().trim(),
        contract_amount: normalizeAmount(row.contract_amount || row['合同金额'] || row['金额']),
        contract_date: normalizeDate(row.contract_date || row['合同日期'] || row['签订日期']),
        project_name: (row.project_name || row['项目名称'] || row['项目'] || '').toString().trim(),
        effective_date: normalizeDate(row.effective_date || row['生效日期']),
        expiry_date: normalizeDate(row.expiry_date || row['到期日期']),
        status: (row.status || row['状态'] || 'active').toString().trim().toLowerCase()
      };

      const existing = findStmt.get(contract_no);
      if (existing) {
        updateStmt.run(record);
        updated++;
      } else {
        insertStmt.run(record);
        inserted++;
      }
    }
  });

  transaction(data);
  return { inserted, updated, skipped, total: data.length };
}

function importReceipts(filePath) {
  const db = getDb();
  const data = parseExcel(filePath);
  let inserted = 0;
  let skipped = 0;
  let negatives = 0;
  let duplicates = 0;

  const insertStmt = db.prepare(`
    INSERT INTO receipts 
    (receipt_no, customer_name, amount, receipt_date, bank_name, 
     bank_account, payment_method, purpose, is_negative)
    VALUES (@receipt_no, @customer_name, @amount, @receipt_date, @bank_name,
            @bank_account, @payment_method, @purpose, @is_negative)
  `);

  const findStmt = db.prepare('SELECT id FROM receipts WHERE receipt_no = ?');

  const transaction = db.transaction((rows) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const customer_name = (row.customer_name || row['客户名称'] || row['客户'] || row['付款方'] || '').toString().trim();
      const receipt_date = normalizeDate(row.receipt_date || row['收款日期'] || row['日期']);
      let amount = normalizeAmount(row.amount || row['金额'] || row['收款金额']);

      if (!customer_name || !receipt_date || amount === 0) {
        skipped++;
        continue;
      }

      const is_negative = amount < 0 ? 1 : 0;
      if (is_negative) {
        negatives++;
      }

      const receipt_no = (row.receipt_no || row['流水号'] || row['银行流水号'] || 
                         generateReceiptNo({ customer_name, receipt_date, amount: Math.abs(amount) }, i));

      const existing = findStmt.get(receipt_no);
      if (existing) {
        duplicates++;
        continue;
      }

      const record = {
        receipt_no,
        customer_name,
        amount: Math.abs(amount),
        receipt_date,
        bank_name: (row.bank_name || row['银行'] || row['开户行'] || '').toString().trim(),
        bank_account: (row.bank_account || row['账号'] || row['银行账号'] || '').toString().trim(),
        payment_method: (row.payment_method || row['付款方式'] || row['支付方式'] || '').toString().trim(),
        purpose: (row.purpose || row['用途'] || row['备注'] || '').toString().trim(),
        is_negative
      };

      insertStmt.run(record);
      inserted++;
    }
  });

  transaction(data);
  return { inserted, skipped, duplicates, negatives, total: data.length };
}

function importInvoices(filePath) {
  const db = getDb();
  const data = parseExcel(filePath);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let duplicates = 0;

  const insertStmt = db.prepare(`
    INSERT INTO invoices 
    (invoice_no, invoice_type, invoice_date, customer_name, customer_tax_id,
     amount, tax_amount, total_amount, status)
    VALUES (@invoice_no, @invoice_type, @invoice_date, @customer_name, @customer_tax_id,
            @amount, @tax_amount, @total_amount, @status)
  `);

  const findStmt = db.prepare('SELECT id FROM invoices WHERE invoice_no = ?');

  const transaction = db.transaction((rows) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const invoice_no = (row.invoice_no || row['发票号'] || row['发票号码'] || '').toString().trim();
      const customer_name = (row.customer_name || row['客户名称'] || row['客户'] || row['购买方'] || '').toString().trim();
      const invoice_date = normalizeDate(row.invoice_date || row['开票日期'] || row['日期']);

      if (!customer_name || !invoice_date) {
        skipped++;
        continue;
      }

      const finalInvoiceNo = invoice_no || generateInvoiceNo({ customer_name, invoice_date, total_amount: normalizeAmount(row.total_amount || row['价税合计']) }, i);

      const amount = normalizeAmount(row.amount || row['金额'] || row['不含税金额']);
      const tax_amount = normalizeAmount(row.tax_amount || row['税额'] || row['税金']);
      const total_amount = normalizeAmount(row.total_amount || row['价税合计'] || row['总金额']) || amount + tax_amount;

      const existing = findStmt.get(finalInvoiceNo);
      if (existing) {
        duplicates++;
        continue;
      }

      const record = {
        invoice_no: finalInvoiceNo,
        invoice_type: (row.invoice_type || row['发票类型'] || row['类型'] || '增值税普通发票').toString().trim(),
        invoice_date,
        customer_name,
        customer_tax_id: (row.customer_tax_id || row['税号'] || row['纳税人识别号'] || '').toString().trim(),
        amount,
        tax_amount,
        total_amount,
        status: 'valid'
      };

      insertStmt.run(record);
      inserted++;
    }
  });

  transaction(data);
  return { inserted, updated, skipped, duplicates, total: data.length };
}

module.exports = {
  parseExcel,
  importContracts,
  importReceipts,
  importInvoices,
  normalizeDate,
  normalizeAmount
};
