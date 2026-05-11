const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const store = require('../models/store');

function parseJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    let content = '';
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    
    stream.on('data', (chunk) => {
      content += chunk;
    });
    
    stream.on('end', () => {
      content = stripBOM(content);
      const lines = content.split(/\r?\n/);
      if (lines.length === 0) {
        resolve([]);
        return;
      }
      
      const headers = parseCsvLine(lines[0]);
      const results = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const values = parseCsvLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] || '';
        }
        results.push(row);
      }
      
      resolve(results);
    });
    
    stream.on('error', reject);
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function detectDataType(rows, filename) {
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow).map(k => k.toLowerCase());
  const rawKeys = Object.keys(firstRow);

  if (rawKeys.some(k => k.includes('invoice') || k.includes('发票') || k.includes('Invoice')) ||
      rawKeys.some(k => k.includes('invoiceid') || k.includes('invoice_id') || 
                      k.includes('invoiceno') || k.includes('发票号'))) {
    return 'invoice';
  }

  if (rawKeys.some(k => k.includes('paymentid') || k.includes('payment_id') || 
                      k.includes('paymentno') || k.includes('收款号') ||
                      k.includes('paymentdate') || k.includes('payment_date') ||
                      k.includes('收款日期'))) {
    return 'payment';
  }

  if (rawKeys.some(k => k.includes('orderid') || k.includes('order_id') || 
                      k.includes('orderno') || k.includes('订单号') ||
                      k.includes('orderdate') || k.includes('order_date') ||
                      k.includes('订单日期'))) {
    return 'order';
  }

  const lowerName = filename.toLowerCase();
  if (lowerName.includes('invoice') || lowerName.includes('发票')) return 'invoice';
  if (lowerName.includes('payment') || lowerName.includes('收款')) return 'payment';
  if (lowerName.includes('order') || lowerName.includes('订单')) return 'order';

  return null;
}

function normalizeOrder(row) {
  const get = (keys) => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
      const lowerKey = key.toLowerCase();
      for (const k of Object.keys(row)) {
        if (k.toLowerCase() === lowerKey) return row[k];
      }
    }
    return undefined;
  };

  const amount = parseFloat(get(['amount', '订单金额', '金额', 'orderAmount', 'order_amount'])) || 0;
  
  return {
    orderId: get(['orderId', 'order_id', '订单号', 'orderNo', 'order_no']) || '',
    customer: get(['customer', '客户', 'customerName', '客户名称']) || '',
    amount: amount,
    orderDate: get(['orderDate', 'order_date', '订单日期', 'date']) || '',
    remark: get(['remark', '备注', 'description', '说明']) || ''
  };
}

function normalizePayment(row) {
  const get = (keys) => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
      const lowerKey = key.toLowerCase();
      for (const k of Object.keys(row)) {
        if (k.toLowerCase() === lowerKey) return row[k];
      }
    }
    return undefined;
  };

  const amount = parseFloat(get(['amount', '收款金额', '金额', 'paymentAmount', 'payment_amount'])) || 0;
  
  return {
    paymentId: get(['paymentId', 'payment_id', '收款号', 'paymentNo', 'payment_no']) || '',
    orderId: get(['orderId', 'order_id', '订单号', 'orderNo', 'order_no']) || '',
    customer: get(['customer', '客户', 'customerName', '客户名称']) || '',
    amount: amount,
    paymentDate: get(['paymentDate', 'payment_date', '收款日期', 'date']) || '',
    remark: get(['remark', '备注', 'description', '说明']) || ''
  };
}

function normalizeInvoice(row) {
  const get = (keys) => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
      const lowerKey = key.toLowerCase();
      for (const k of Object.keys(row)) {
        if (k.toLowerCase() === lowerKey) return row[k];
      }
    }
    return undefined;
  };

  let amount = parseFloat(get(['amount', '发票金额', '金额', 'invoiceAmount', 'invoice_amount'])) || 0;
  const isRedValue = get(['isRed', 'is_red', '红冲', '红冲发票', 'isNegative', 'is_negative']);
  const isRed = 
    isRedValue === true ||
    isRedValue === '1' ||
    isRedValue === 'true' ||
    String(isRedValue).toLowerCase() === 'y' ||
    String(isRedValue).toLowerCase() === 'yes' ||
    amount < 0;

  if (isRed && amount > 0) {
    amount = -amount;
  }

  return {
    invoiceId: get(['invoiceId', 'invoice_id', '发票号', 'invoiceNo', 'invoice_no']) || '',
    originalInvoiceId: get(['originalInvoiceId', 'original_invoice_id', '原发票号', 'originalInvoiceNo', 'original_invoice_no']) || '',
    orderId: get(['orderId', 'order_id', '订单号', 'orderNo', 'order_no']) || '',
    customer: get(['customer', '客户', 'customerName', '客户名称']) || '',
    amount: amount,
    isRed: isRed,
    invoiceDate: get(['invoiceDate', 'invoice_date', '开票日期', 'date']) || '',
    remark: get(['remark', '备注', 'description', '说明']) || ''
  };
}

async function importFile(filePath, dataType = null) {
  if (store.isFileAlreadyImported(filePath)) {
    return {
      success: false,
      message: `文件已导入过: ${path.basename(filePath)}`,
      skipped: true
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  let rows;

  if (ext === '.json') {
    rows = parseJson(filePath);
    if (!Array.isArray(rows)) {
      rows = [rows];
    }
  } else if (ext === '.csv') {
    rows = await parseCsv(filePath);
  } else {
    return {
      success: false,
      message: '只支持 CSV 和 JSON 格式'
    };
  }

  if (rows.length === 0) {
    return {
      success: false,
      message: '文件为空'
    };
  }

  const detectedType = dataType || detectDataType(rows, path.basename(filePath));
  
  if (!detectedType) {
    return {
      success: false,
      message: '无法自动识别数据类型，请使用 --type 参数指定 (order|payment|invoice)'
    };
  }

  const data = store.loadData();
  let records = [];

  switch (detectedType) {
    case 'order':
      records = rows.map(normalizeOrder);
      records = records.filter(r => r.orderId);
      const existingOrderIds = new Set(data.orders.map(o => o.orderId));
      records = records.filter(r => !existingOrderIds.has(r.orderId));
      data.orders.push(...records);
      break;
    case 'payment':
      records = rows.map(normalizePayment);
      records = records.filter(r => r.paymentId || (r.orderId && r.paymentDate));
      const existingPayments = new Set(data.payments.map(p => 
        `${p.paymentId}-${p.orderId}-${p.paymentDate}-${p.amount}`
      ));
      records = records.filter(r => 
        !existingPayments.has(`${r.paymentId}-${r.orderId}-${r.paymentDate}-${r.amount}`)
      );
      data.payments.push(...records);
      break;
    case 'invoice':
      records = rows.map(normalizeInvoice);
      records = records.filter(r => r.invoiceId);
      const existingInvoiceIds = new Set(data.invoices.map(i => i.invoiceId));
      records = records.filter(r => !existingInvoiceIds.has(r.invoiceId));
      data.invoices.push(...records);
      break;
  }

  store.saveData(data);
  store.markFileImported(filePath);

  return {
    success: true,
    message: `成功导入 ${records.length} 条 ${detectedType} 记录`,
    count: records.length,
    type: detectedType
  };
}

module.exports = {
  importFile,
  normalizeOrder,
  normalizePayment,
  normalizeInvoice
};
