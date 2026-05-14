const db = require('./database');
const services = require('./services');
const stateMachine = require('./stateMachine');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

async function initData() {
  const count = await db.get('SELECT COUNT(*) as count FROM invoices');
  if (count && count.count > 0) return;

  console.log('初始化演示数据...');
  
  const statuses = ['review_pending', 'export_ready', 'exported', 'ocr_failed', 'duplicate_found'];
  
  for (let i = 0; i < 15; i++) {
    const invoiceId = uuidv4();
    const status = statuses[i % statuses.length];
    const amount = parseFloat((Math.random() * 5000 + 200).toFixed(2));
    const date = moment().subtract(Math.floor(Math.random() * 10), 'days').format('YYYY-MM-DD');
    
    await db.run(
      `INSERT INTO invoices 
       (id, invoice_number, invoice_code, tax_number, amount, invoice_date, 
        seller_name, buyer_name, confidence, status, retry_count, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        `FP${(10000000 + i).toString()}`,
        `CODE${(202400 + i).toString()}`,
        i === 3 ? 'INVALID' : '91310101MA1G8K2P6R',
        amount,
        date,
        ['科技有限公司', '贸易有限公司', '服务中心'][i % 3],
        '采购企业集团',
        0.75 + Math.random() * 0.24,
        status,
        status === 'ocr_failed' ? 2 : 0,
        null
      ]
    );

    await db.run(
      `INSERT INTO audit_logs (invoice_id, action, status_from, status_to, operator, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceId, 'status_change', 'pending', status, 'system', '演示数据初始化']
    );

    if (i === 5) {
      const dupId = uuidv4();
      await db.run(
        `INSERT INTO invoices 
         (id, invoice_number, invoice_code, tax_number, amount, invoice_date, 
          seller_name, buyer_name, confidence, status, retry_count, image_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dupId, `FP${(10000000 + i).toString()}`, `CODE${(202400 + i).toString()}`, '91310101MA1G8K2P6R', 
         amount + 100, date, '科技有限公司', '采购企业集团', 0.88, 'duplicate_found', 0, null]
      );
      
      await db.run(
        'INSERT INTO duplicates (invoice_id, duplicate_with, reason) VALUES (?, ?, ?)',
        [dupId, invoiceId, `发票代码 CODE${(202400 + i).toString()} 号码 FP${(10000000 + i).toString()} 已存在`]
      );
    }
  }

  console.log('演示数据初始化完成');
}

module.exports = { initData };
