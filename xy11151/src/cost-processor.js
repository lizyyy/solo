const crypto = require('crypto');

const STABLE_COLUMN_ORDER = [
  'uniqueId',
  'exhibitionName',
  'itemType',
  'itemCategory',
  'itemName',
  'supplier',
  'amount',
  'isTemporaryAdd',
  'isSupplierRefund',
  'recordDate',
  'projectManager',
  'constructionTeam',
  'paymentStatus',
  'invoiceStatus',
  'remarks',
  'sourceFile',
  'processedAt'
];

const EXHIBITION_CATEGORIES = [
  '主场搭建',
  '特装搭建',
  '电气设备',
  '灯光音响',
  '展具租赁',
  '美工制作',
  '物流运输',
  '现场服务',
  '人员费用',
  '其他费用'
];

const TEMPORARY_ADD_KEYWORDS = [
  '临时加',
  '增加',
  '补加',
  '额外',
  '追加',
  '现场加',
  '加急',
  '新增'
];

const REFUND_KEYWORDS = [
  '返款',
  '退款',
  '返利',
  '折扣',
  '优惠',
  '减免',
  '冲抵',
  '负数'
];

function generateStableId(record) {
  const keyFields = [
    record.exhibitionName || '',
    record.itemName || '',
    record.supplier || '',
    Math.abs(parseFloat(record.amount) || 0).toString(),
    record.recordDate || ''
  ].join('|');
  
  return crypto.createHash('md5').update(keyFields).digest('hex').substring(0, 12);
}

function detectTemporaryAdd(record) {
  const text = [
    record.itemName || '',
    record.remarks || '',
    record.itemCategory || ''
  ].join(' ').toLowerCase();
  
  return TEMPORARY_ADD_KEYWORDS.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
}

function detectSupplierRefund(record) {
  const amount = parseFloat(record.amount) || 0;
  const text = [
    record.itemName || '',
    record.remarks || '',
    record.itemCategory || ''
  ].join(' ').toLowerCase();
  
  const hasRefundKeyword = REFUND_KEYWORDS.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
  
  return amount < 0 || hasRefundKeyword;
}

function classifyItemCategory(itemName) {
  const name = (itemName || '').toLowerCase();
  
  if (name.includes('桁架') || name.includes('舞台') || name.includes('背板') || name.includes('搭建')) {
    return '主场搭建';
  }
  if (name.includes('特装') || name.includes('展台') || name.includes('展厅')) {
    return '特装搭建';
  }
  if (name.includes('电') || name.includes('接电') || name.includes('配电箱')) {
    return '电气设备';
  }
  if (name.includes('灯') || name.includes('音响') || name.includes('LED')) {
    return '灯光音响';
  }
  if (name.includes('桌椅') || name.includes('展具') || name.includes('柜')) {
    return '展具租赁';
  }
  if (name.includes('喷绘') || name.includes('写真') || name.includes('美工') || name.includes('画面')) {
    return '美工制作';
  }
  if (name.includes('运输') || name.includes('物流') || name.includes('货运')) {
    return '物流运输';
  }
  if (name.includes('现场') || name.includes('保洁') || name.includes('保安')) {
    return '现场服务';
  }
  if (name.includes('人工') || name.includes('工人') || name.includes('工资') || name.includes('差旅')) {
    return '人员费用';
  }
  
  return '其他费用';
}

function normalizeRecord(record, sourceFile) {
  const normalized = {};
  
  normalized.exhibitionName = record.exhibitionName || record.展会名称 || record['展会名称'] || '';
  normalized.itemName = record.itemName || record.费用项目 || record['费用项目'] || '';
  normalized.supplier = record.supplier || record.供应商 || record['供应商'] || '';
  normalized.amount = parseFloat(record.amount || record.金额 || record['金额'] || 0);
  normalized.recordDate = record.recordDate || record.日期 || record['日期'] || '';
  normalized.projectManager = record.projectManager || record.项目经理 || record['项目经理'] || '';
  normalized.constructionTeam = record.constructionTeam || record.搭建队 || record['搭建队'] || '展会搭建队';
  normalized.paymentStatus = record.paymentStatus || record.付款状态 || record['付款状态'] || '未付款';
  normalized.invoiceStatus = record.invoiceStatus || record.发票状态 || record['发票状态'] || '未开票';
  normalized.remarks = record.remarks || record.备注 || record['备注'] || '';
  
  normalized.itemCategory = record.itemCategory || record.费用类别 || record['费用类别'] || classifyItemCategory(normalized.itemName);
  normalized.itemType = normalized.amount >= 0 ? '支出' : '收入';
  normalized.isTemporaryAdd = detectTemporaryAdd({ ...record, ...normalized });
  normalized.isSupplierRefund = detectSupplierRefund({ ...record, ...normalized });
  normalized.uniqueId = generateStableId(normalized);
  normalized.sourceFile = sourceFile;
  normalized.processedAt = new Date().toISOString();
  
  return normalized;
}

function sortRecords(records) {
  return records.sort((a, b) => {
    if (a.exhibitionName !== b.exhibitionName) {
      return a.exhibitionName.localeCompare(b.exhibitionName);
    }
    if (a.recordDate !== b.recordDate) {
      return a.recordDate.localeCompare(b.recordDate);
    }
    if (a.itemCategory !== b.itemCategory) {
      return a.itemCategory.localeCompare(b.itemCategory);
    }
    return a.uniqueId.localeCompare(b.uniqueId);
  });
}

function formatForOutput(record) {
  const output = {};
  STABLE_COLUMN_ORDER.forEach(col => {
    let value = record[col];
    if (col === 'isTemporaryAdd' || col === 'isSupplierRefund') {
      value = value ? '是' : '否';
    }
    output[col] = value;
  });
  return output;
}

function deduplicateRecords(records) {
  const seen = new Map();
  records.forEach(record => {
    const existing = seen.get(record.uniqueId);
    if (!existing) {
      seen.set(record.uniqueId, record);
    }
  });
  return Array.from(seen.values());
}

module.exports = {
  STABLE_COLUMN_ORDER,
  normalizeRecord,
  sortRecords,
  formatForOutput,
  deduplicateRecords,
  generateStableId,
  detectTemporaryAdd,
  detectSupplierRefund,
  classifyItemCategory
};
