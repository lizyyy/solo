const dayjs = require('dayjs');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { INVOICE_STATUSES, EXCEPTION_TYPES } = require('../database');

const SAMPLE_VENDORS = [
  '北京科技有限公司',
  '上海贸易发展公司',
  '深圳电子科技有限公司',
  '广州办公用品有限公司',
  '杭州软件服务有限公司',
  '南京咨询服务中心',
  '成都交通出行公司',
  '武汉餐饮管理有限公司',
  '天津住宿酒店',
  '重庆物流配送中心'
];

function getRandomVendor() {
  return SAMPLE_VENDORS[Math.floor(Math.random() * SAMPLE_VENDORS.length)];
}

function generateTaxNumber() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * 10));
  }
  return result;
}

function isValidTaxNumber(tax) {
  if (!tax) return false;
  const valid = /^[0-9A-Z]{15,20}$/i;
  return valid.test(tax);
}

function detectExceptions(invoice) {
  const exceptions = [];

  if (invoice.approval_amount && invoice.amount !== invoice.approval_amount) {
    exceptions.push({
      type: EXCEPTION_TYPES.AMOUNT_MISMATCH,
      field: 'amount',
      expected_value: invoice.approval_amount?.toString(),
      actual_value: invoice.amount?.toString(),
      description: `票据金额(¥${invoice.amount})与审批金额(¥${invoice.approval_amount})不一致`
    });
  }

  if (invoice.tax_number && !isValidTaxNumber(invoice.tax_number)) {
    exceptions.push({
      type: EXCEPTION_TYPES.TAX_NUMBER_INVALID,
      field: 'tax_number',
      expected_value: '15-20位字母数字',
      actual_value: invoice.tax_number,
      description: `税号格式无效: ${invoice.tax_number}`
    });
  }

  if (invoice.vendor_tax_number && !isValidTaxNumber(invoice.vendor_tax_number)) {
    exceptions.push({
      type: EXCEPTION_TYPES.TAX_NUMBER_INVALID,
      field: 'vendor_tax_number',
      expected_value: '15-20位字母数字',
      actual_value: invoice.vendor_tax_number,
      description: `供应商税号格式无效: ${invoice.vendor_tax_number}`
    });
  }

  if (!invoice.approver_name) {
    exceptions.push({
      type: EXCEPTION_TYPES.APPROVAL_MISSING,
      field: 'approver_name',
      expected_value: '审批人姓名',
      actual_value: '(空)',
      description: '审批人信息缺失'
    });
  }

  return exceptions;
}

async function seed() {
  await db.init();

  console.log('开始生成样本数据...');

  const now = dayjs();
  const invoices = [];
  const statuses = Object.values(INVOICE_STATUSES);

  for (let i = 0; i < 25; i++) {
    const vendor = getRandomVendor();
    const amount = Math.round((Math.random() * 10000 + 100) * 100) / 100;
    const taxAmount = Math.round(amount * 0.13 * 100) / 100;

    const invoice = {
      invoice_number: `INV${String(100000 + i).padStart(6, '0')}`,
      invoice_date: now
        .subtract(Math.floor(Math.random() * 30), 'day')
        .format('YYYY-MM-DD'),
      amount,
      tax_amount: taxAmount,
      tax_number: generateTaxNumber(),
      vendor_name: vendor,
      vendor_tax_number: generateTaxNumber(),
      approval_amount: Math.random() > 0.3 ? amount : amount + 100,
      approver_name: Math.random() > 0.3 ? '张三' : '',
      approval_date: Math.random() > 0.4
        ? now.subtract(Math.floor(Math.random() * 25), 'day').format('YYYY-MM-DD')
        : null,
      approval_comments: Math.random() > 0.4 ? '同意报销' : '',
      status: statuses[Math.floor(Math.random() * statuses.length)],
      created_at: now
        .subtract(Math.floor(Math.random() * 30), 'day')
        .format('YYYY-MM-DD HH:mm:ss')
    };

    const detectedExceptions = detectExceptions(invoice);
    invoice.exception_count = detectedExceptions.length;
    invoice._exceptions = detectedExceptions;

    if (invoice.exception_count > 0) {
      invoice.status = INVOICE_STATUSES.EXCEPTION;
    }

    invoice.id = uuidv4();
    invoice.updated_at = invoice.created_at;
    invoices.push(invoice);
  }

  for (const inv of invoices) {
    await db.run(
      `INSERT INTO invoices (
        id, invoice_number, invoice_date, amount, tax_amount, tax_number,
        vendor_name, vendor_tax_number, approval_amount, approver_name,
        approval_date, approval_comments, status, created_at, updated_at, exception_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id,
        inv.invoice_number,
        inv.invoice_date,
        inv.amount,
        inv.tax_amount,
        inv.tax_number,
        inv.vendor_name,
        inv.vendor_tax_number,
        inv.approval_amount,
        inv.approver_name,
        inv.approval_date,
        inv.approval_comments,
        inv.status,
        inv.created_at,
        inv.updated_at,
        inv.exception_count
      ]
    );

    await db.run(
      `INSERT INTO invoice_history (id, invoice_id, action, old_values, new_values, operator, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        inv.id,
        'create',
        '{}',
        JSON.stringify(inv),
        'sample',
        '样本数据导入',
        inv.created_at
      ]
    );

    for (const ex of inv._exceptions) {
      await db.run(
        `INSERT INTO exceptions (
          id, invoice_id, type, field, expected_value, actual_value,
          description, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          inv.id,
          ex.type,
          ex.field,
          ex.expected_value || null,
          ex.actual_value || null,
          ex.description,
          'open',
          inv.created_at
        ]
      );
    }
  }

  const totalExceptions = invoices.reduce((sum, inv) => sum + inv._exceptions.length, 0);
  console.log(`已插入 ${invoices.length} 条样本票据数据`);
  console.log(`已插入 ${totalExceptions} 条异常记录`);
  console.log(`样本数据生成完成！`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('种子数据生成失败:', err);
  process.exit(1);
});
