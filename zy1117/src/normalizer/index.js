const dayjs = require('dayjs');

/**
 * 归一化配置
 */
const NORMALIZATION_CONFIG = {
  // 标准字段名映射
  standardFields: {
    sku: ['SKU', 'sku', '产品编码', '商品编码', '型号', '规格', '货号', '编号', 'code'],
    productName: ['产品名称', '名称', '品名', '商品名称', '产品', '描述', 'Description', 'name'],
    quantity: ['数量', 'Qty', '个数', '台数', '套数', 'Amount', 'quantity'],
    unitPrice: ['单价', '价格', '单位价格', 'Unit Price', 'price', 'unitPrice'],
    totalPrice: ['金额', '总价', '小计', '合计', 'Total', 'Amount', 'total', 'totalPrice'],
    discount: ['折扣', '优惠', 'Discount', '折扣率', 'discount'],
    taxRate: ['税率', '税点', 'Tax', 'VAT', 'tax', 'taxRate'],
    warranty: ['维保期限', '保修期', '质保', '保修', '维护', 'Warranty', 'warranty'],
    deliveryDate: ['交付日期', '日期', '交货日期', '时间', 'Date', 'Delivery Date', 'deliveryDate'],
    deliveryBatch: ['批次', 'Batch', '交付批次', '批次号', 'batch'],
    paymentNode: ['节点', '阶段', 'Phase', '付款节点', 'Stage', 'node'],
    paymentRatio: ['比例', '百分比', '%', 'ratio'],
    paymentCondition: ['条件', '触发条件', '付款条件', 'Condition', '验收条件', 'condition']
  },
  
  // 默认值
  defaults: {
    taxRate: 0.13,
    discount: 1.0,
    warranty: '1年',
    quantity: 1
  }
};

/**
 * 归一化所有数据源
 * @param {Object} sources - 包含所有数据源的对象
 * @returns {Object} 归一化后的数据
 */
function normalizeAll(sources) {
  const normalized = {
    quote: null,
    contract: null,
    catalog: null,
    approval: null,
    warnings: []
  };
  
  // 归一化报价单
  if (sources.quote) {
    normalized.quote = normalizeQuote(sources.quote);
    normalized.warnings = [...normalized.warnings, ...(sources.quote.warnings || [])];
  }
  
  // 归一化合同
  if (sources.contract) {
    normalized.contract = normalizeContract(sources.contract);
    normalized.warnings = [...normalized.warnings, ...(sources.contract.warnings || [])];
  }
  
  // 归一化产品目录
  if (sources.catalog) {
    normalized.catalog = normalizeCatalog(sources.catalog);
    normalized.warnings = [...normalized.warnings, ...(sources.catalog.warnings || [])];
  }
  
  // 归一化审批备注
  if (sources.approval) {
    normalized.approval = normalizeApproval(sources.approval);
    normalized.warnings = [...normalized.warnings, ...(sources.approval.warnings || [])];
  }
  
  return normalized;
}

/**
 * 归一化报价单数据
 */
function normalizeQuote(quoteData) {
  const normalized = {
    source: quoteData,
    fileName: quoteData.fileName,
    format: quoteData.format,
    metadata: {},
    products: [],
    summary: {}
  };
  
  const rawData = quoteData.data;
  
  // 如果是数组（CSV/XLSX的行数据）
  if (Array.isArray(rawData)) {
    rawData.forEach((row, index) => {
      const product = normalizeProductRow(row, index + 2, quoteData.fileName);
      if (product.sku || product.productName) {
        normalized.products.push(product);
      }
    });
  }
  
  // 计算汇总
  normalized.summary = calculateSummary(normalized.products);
  
  return normalized;
}

/**
 * 归一化合同数据
 */
function normalizeContract(contractData) {
  const normalized = {
    source: contractData,
    fileName: contractData.fileName,
    format: contractData.format,
    metadata: {},
    products: [],
    deliveries: [],
    payments: [],
    summary: {}
  };
  
  const rawData = contractData.data;
  
  // 提取元数据
  normalized.metadata = {
    customer: rawData.metadata?.客户,
    contractNo: rawData.metadata?.合同编号,
    signDate: rawData.metadata?.签署日期,
    totalAmount: rawData.metadata?.总金额,
    totalAmountNum: rawData.metadata?.总金额_num
  };
  
  // 归一化产品
  if (rawData.products && Array.isArray(rawData.products)) {
    rawData.products.forEach((product, index) => {
      const normalizedProduct = normalizeProductRow(
        product, 
        product._lineNumber || index + 1, 
        contractData.fileName
      );
      normalized.products.push(normalizedProduct);
    });
  }
  
  // 归一化交付信息
  if (rawData.delivery && Array.isArray(rawData.delivery)) {
    rawData.delivery.forEach((delivery, index) => {
      const normalizedDelivery = normalizeDeliveryRow(
        delivery,
        delivery._lineNumber || index + 1,
        contractData.fileName
      );
      normalized.deliveries.push(normalizedDelivery);
    });
  }
  
  // 归一化付款信息
  if (rawData.payment && Array.isArray(rawData.payment)) {
    rawData.payment.forEach((payment, index) => {
      const normalizedPayment = normalizePaymentRow(
        payment,
        payment._lineNumber || index + 1,
        contractData.fileName
      );
      normalized.payments.push(normalizedPayment);
    });
  }
  
  // 计算汇总
  normalized.summary = calculateContractSummary(normalized);
  
  return normalized;
}

/**
 * 归一化产品目录
 */
function normalizeCatalog(catalogData) {
  const normalized = {
    source: catalogData,
    fileName: catalogData.fileName,
    format: catalogData.format,
    products: [],
    skuMap: new Map()
  };
  
  const rawData = catalogData.data;
  
  if (rawData.products && Array.isArray(rawData.products)) {
    rawData.products.forEach((product, index) => {
      const normalizedProduct = normalizeCatalogProduct(product, index);
      normalized.products.push(normalizedProduct);
      
      if (normalizedProduct.sku) {
        normalized.skuMap.set(normalizedProduct.sku.toLowerCase(), normalizedProduct);
      }
    });
  }
  
  return normalized;
}

/**
 * 归一化审批备注
 */
function normalizeApproval(approvalData) {
  const normalized = {
    source: approvalData,
    fileName: approvalData.fileName,
    format: approvalData.format,
    approvals: [],
    discountNotes: [],
    summary: {
      totalApprovals: 0,
      hasDiscountNotes: false
    }
  };
  
  const rawData = approvalData.data;
  
  if (rawData.approvals && Array.isArray(rawData.approvals)) {
    rawData.approvals.forEach((approval, index) => {
      const normalizedApproval = normalizeApprovalItem(approval, index);
      normalized.approvals.push(normalizedApproval);
      
      // 收集折扣相关备注
      if (normalizedApproval.hasDiscountKeyword || normalizedApproval.discount) {
        normalized.discountNotes.push(normalizedApproval);
        normalized.summary.hasDiscountNotes = true;
      }
    });
  }
  
  normalized.summary.totalApprovals = normalized.approvals.length;
  
  return normalized;
}

/**
 * 归一化产品行（报价单/合同用）
 */
function normalizeProductRow(row, lineNumber, fileName) {
  const normalized = {
    _source: row,
    _lineNumber: lineNumber,
    _fileName: fileName,
    _warnings: []
  };
  
  // 标准化字段
  Object.keys(NORMALIZATION_CONFIG.standardFields).forEach(standardField => {
    const possibleFields = NORMALIZATION_CONFIG.standardFields[standardField];
    
    for (const possibleField of possibleFields) {
      // 精确匹配
      if (row[possibleField] !== undefined && row[possibleField] !== null) {
        normalized[standardField] = row[possibleField];
        break;
      }
      // 大小写不敏感匹配
      const lowerPossible = possibleField.toLowerCase();
      for (const key in row) {
        if (key.toLowerCase() === lowerPossible && row[key] !== undefined && row[key] !== null) {
          normalized[standardField] = row[key];
          break;
        }
      }
    }
  });
  
  // 清洗和转换数值字段
  cleanNumericFields(normalized, row);
  
  // 计算衍生字段
  calculateDerivedFields(normalized);
  
  return normalized;
}

/**
 * 清洗数值字段
 */
function cleanNumericFields(normalized, rawRow) {
  // 处理数量
  if (normalized.quantity !== undefined) {
    const cleaned = String(normalized.quantity).replace(/[,，台套个]/g, '');
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num >= 0) {
      normalized.quantityNum = num;
    } else {
      normalized._warnings.push({
        type: 'invalid_quantity',
        message: `数量 [${normalized.quantity}] 不是有效的正整数`,
        field: 'quantity',
        value: normalized.quantity
      });
      normalized.quantityNum = NORMALIZATION_CONFIG.defaults.quantity;
    }
  } else {
    normalized.quantityNum = NORMALIZATION_CONFIG.defaults.quantity;
  }
  
  // 处理单价
  if (normalized.unitPrice !== undefined) {
    const cleaned = String(normalized.unitPrice).replace(/[,，￥$元]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      normalized.unitPriceNum = num;
    } else {
      normalized._warnings.push({
        type: 'invalid_unit_price',
        message: `单价 [${normalized.unitPrice}] 不是有效的数字`,
        field: 'unitPrice',
        value: normalized.unitPrice
      });
    }
  }
  
  // 处理总价
  if (normalized.totalPrice !== undefined) {
    const cleaned = String(normalized.totalPrice).replace(/[,，￥$元万]/g, '');
    let num = parseFloat(cleaned);
    // 处理"万"单位
    if (String(normalized.totalPrice).includes('万')) {
      num *= 10000;
    }
    if (!isNaN(num) && num >= 0) {
      normalized.totalPriceNum = num;
    } else {
      normalized._warnings.push({
        type: 'invalid_total_price',
        message: `总价 [${normalized.totalPrice}] 不是有效的数字`,
        field: 'totalPrice',
        value: normalized.totalPrice
      });
    }
  }
  
  // 处理折扣
  if (normalized.discount !== undefined) {
    let discountValue = normalized.discount;
    let isPercentage = false;
    let isFold = false;

    const discountStr = String(discountValue);

    if (discountStr.includes('%')) {
      isPercentage = true;
      discountValue = discountStr.replace(/%/g, '');
    } else if (discountStr.includes('折')) {
      isFold = true;
      discountValue = discountStr.replace(/折/g, '');
    }

    const num = parseFloat(discountValue);

    if (!isNaN(num)) {
      if (isPercentage) {
        // 百分比：如 10% 折扣 = 0.9 系数
        normalized.discountNum = (100 - num) / 100;
      } else if (isFold) {
        // 折：智能处理
        // - "9折" = 90% = 0.9 系数 → 9 / 10
        // - "95折" = 95% = 0.95 系数 → 95 / 100
        // - "9.5折" = 95% = 0.95 系数 → 9.5 / 10
        if (num >= 10) {
          // 95折 这种表达方式
          normalized.discountNum = num / 100;
        } else {
          // 9折 或 9.5折 这种表达方式
          normalized.discountNum = num / 10;
        }
      } else {
        // 直接是系数：如 0.9
        normalized.discountNum = num;
      }
    } else {
      normalized._warnings.push({
        type: 'invalid_discount',
        message: `折扣 [${normalized.discount}] 格式不明确`,
        field: 'discount',
        value: normalized.discount
      });
      normalized.discountNum = NORMALIZATION_CONFIG.defaults.discount;
    }
  } else {
    normalized.discountNum = NORMALIZATION_CONFIG.defaults.discount;
  }
  
  // 处理税率
  if (normalized.taxRate !== undefined) {
    let taxValue = normalized.taxRate;
    let isPercentage = false;
    
    const taxStr = String(taxValue);
    
    if (taxStr.includes('%')) {
      isPercentage = true;
      taxValue = taxStr.replace(/%/g, '');
    }
    
    const num = parseFloat(taxValue);
    
    if (!isNaN(num)) {
      if (isPercentage) {
        normalized.taxRateNum = num / 100;
      } else if (num > 1) {
        // 大于1的数字可能是百分比值，如 13 = 13%
        normalized.taxRateNum = num / 100;
      } else {
        normalized.taxRateNum = num;
      }
    } else {
      normalized._warnings.push({
        type: 'invalid_tax_rate',
        message: `税率 [${normalized.taxRate}] 不是有效的数字`,
        field: 'taxRate',
        value: normalized.taxRate
      });
      normalized.taxRateNum = NORMALIZATION_CONFIG.defaults.taxRate;
    }
  } else {
    normalized.taxRateNum = NORMALIZATION_CONFIG.defaults.taxRate;
  }
  
  return normalized;
}

/**
 * 计算衍生字段
 */
function calculateDerivedFields(normalized) {
  // 如果没有总价，但有单价和数量，计算总价
  if (normalized.totalPriceNum === undefined && 
      normalized.unitPriceNum !== undefined && 
      normalized.quantityNum !== undefined) {
    normalized.calculatedTotalPrice = normalized.unitPriceNum * normalized.quantityNum;
    normalized.totalPriceNum = normalized.calculatedTotalPrice;
    normalized._isCalculatedTotal = true;
  }
  
  // 计算折扣后价格
  if (normalized.totalPriceNum !== undefined && normalized.discountNum !== undefined) {
    normalized.discountedPrice = normalized.totalPriceNum * normalized.discountNum;
  }
  
  // 计算税额和含税总价
  if (normalized.discountedPrice !== undefined && normalized.taxRateNum !== undefined) {
    normalized.taxAmount = normalized.discountedPrice * normalized.taxRateNum;
    normalized.totalWithTax = normalized.discountedPrice + normalized.taxAmount;
  } else if (normalized.totalPriceNum !== undefined && normalized.taxRateNum !== undefined) {
    normalized.taxAmount = normalized.totalPriceNum * normalized.taxRateNum;
    normalized.totalWithTax = normalized.totalPriceNum + normalized.taxAmount;
  }
  
  return normalized;
}

/**
 * 归一化交付行
 */
function normalizeDeliveryRow(row, lineNumber, fileName) {
  const normalized = {
    _source: row,
    _lineNumber: lineNumber,
    _fileName: fileName,
    batch: undefined,
    deliveryDate: undefined,
    deliveryDateParsed: undefined,
    content: undefined,
    quantity: undefined,
    location: undefined,
    notes: undefined
  };
  
  // 提取字段
  const fieldMappings = {
    batch: ['批次', 'Batch', '交付批次', '批次号'],
    deliveryDate: ['交付日期', '日期', '交货日期', '时间', 'Date'],
    content: ['交付内容', '内容', '产品', '物品', 'Content'],
    quantity: ['数量', 'Qty'],
    location: ['地点', '地址', '交付地点', 'Location'],
    notes: ['备注', '说明', 'Note', 'Remark']
  };
  
  Object.keys(fieldMappings).forEach(target => {
    const sources = fieldMappings[target];
    for (const source of sources) {
      if (row[source] !== undefined) {
        normalized[target] = row[source];
        break;
      }
    }
  });
  
  // 解析日期
  if (normalized.deliveryDate) {
    const parsed = parseDate(normalized.deliveryDate);
    if (parsed) {
      normalized.deliveryDateParsed = parsed;
      normalized.deliveryDateISO = parsed.format('YYYY-MM-DD');
    }
  }
  
  return normalized;
}

/**
 * 归一化付款行
 */
function normalizePaymentRow(row, lineNumber, fileName) {
  const normalized = {
    _source: row,
    _lineNumber: lineNumber,
    _fileName: fileName,
    node: undefined,
    ratio: undefined,
    ratioNum: undefined,
    amount: undefined,
    amountNum: undefined,
    condition: undefined,
    date: undefined,
    dateParsed: undefined,
    notes: undefined
  };
  
  const fieldMappings = {
    node: ['节点', '阶段', 'Phase', '付款节点', 'Stage'],
    ratio: ['比例', '百分比', '%', 'ratio'],
    amount: ['金额', '款项', 'Amount'],
    condition: ['条件', '触发条件', '付款条件', 'Condition', '验收条件'],
    date: ['日期', '付款日期', '预计日期', 'Date'],
    notes: ['备注', '说明', 'Note', 'Remark']
  };
  
  Object.keys(fieldMappings).forEach(target => {
    const sources = fieldMappings[target];
    for (const source of sources) {
      if (row[source] !== undefined) {
        normalized[target] = row[source];
        break;
      }
    }
  });
  
  // 清洗比例
  if (normalized.ratio !== undefined) {
    const ratioStr = String(normalized.ratio);
    const cleaned = ratioStr.replace(/[%]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      if (ratioStr.includes('%') || num > 1) {
        normalized.ratioNum = num / 100;
      } else {
        normalized.ratioNum = num;
      }
    }
  }
  
  // 清洗金额
  if (normalized.amount !== undefined) {
    const cleaned = String(normalized.amount).replace(/[,，￥$元万]/g, '');
    let num = parseFloat(cleaned);
    if (String(normalized.amount).includes('万')) {
      num *= 10000;
    }
    if (!isNaN(num)) {
      normalized.amountNum = num;
    }
  }
  
  // 解析日期
  if (normalized.date) {
    const parsed = parseDate(normalized.date);
    if (parsed) {
      normalized.dateParsed = parsed;
      normalized.dateISO = parsed.format('YYYY-MM-DD');
    }
  }
  
  return normalized;
}

/**
 * 归一化目录产品
 */
function normalizeCatalogProduct(product, index) {
  const normalized = {
    _source: product,
    _index: index,
    sku: undefined,
    productName: undefined,
    status: undefined,
    isActive: true,
    unitPrice: undefined,
    category: undefined,
    description: undefined
  };
  
  // 提取SKU
  normalized.sku = product.SKU || product.sku || product.code || product['SKU编号'] || product['产品编码'];
  
  // 提取产品名称
  normalized.productName = product.产品名称 || product.name || product['商品名称'] || product.名称;
  
  // 提取状态
  const status = product.状态 || product.status;
  if (status !== undefined) {
    normalized.status = status;
    const statusLower = String(status).toLowerCase();
    normalized.isActive = !(
      statusLower === 'inactive' ||
      statusLower === '停用' ||
      statusLower === '下架' ||
      statusLower === '0' ||
      status === 0
    );
  }
  
  // 提取其他字段
  normalized.unitPrice = product.单价 || product.price;
  normalized.category = product.分类 || product.category;
  normalized.description = product.描述 || product.description;
  
  return normalized;
}

/**
 * 归一化审批项
 */
function normalizeApprovalItem(item, index) {
  const normalized = {
    _source: item,
    _index: index,
    approver: undefined,
    date: undefined,
    dateParsed: undefined,
    content: undefined,
    decision: undefined,
    discount: undefined,
    hasDiscountKeyword: false,
    extractedDiscount: undefined
  };
  
  normalized.approver = item.审批人 || item.approver;
  normalized.date = item.日期 || item.date;
  normalized.content = item.内容 || item.content || item.comment;
  normalized.decision = item.决策 || item.decision;
  normalized.discount = item.折扣 || item.discount;
  normalized.hasDiscountKeyword = item._hasDiscountKeyword || false;
  normalized.extractedDiscount = item._extractedDiscount;
  
  // 解析日期
  if (normalized.date) {
    const parsed = parseDate(normalized.date);
    if (parsed) {
      normalized.dateParsed = parsed;
      normalized.dateISO = parsed.format('YYYY-MM-DD');
    }
  }
  
  return normalized;
}

/**
 * 解析日期
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // 支持多种格式
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY年MM月DD日',
    'YYYY.MM.DD',
    'MM-DD-YYYY',
    'MM/DD/YYYY'
  ];
  
  for (const format of formats) {
    const parsed = dayjs(dateStr, format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }
  
  // 尝试宽松解析
  const looseParsed = dayjs(dateStr);
  if (looseParsed.isValid()) {
    return looseParsed;
  }
  
  return null;
}

/**
 * 计算产品汇总
 */
function calculateSummary(products) {
  const summary = {
    totalProducts: products.length,
    totalQuantity: 0,
    totalAmount: 0,
    totalDiscountedAmount: 0,
    totalTaxAmount: 0,
    totalWithTax: 0,
    skuList: [],
    skuSet: new Set()
  };
  
  products.forEach(product => {
    if (product.quantityNum !== undefined) {
      summary.totalQuantity += product.quantityNum;
    }
    
    if (product.totalPriceNum !== undefined) {
      summary.totalAmount += product.totalPriceNum;
    }
    
    if (product.discountedPrice !== undefined) {
      summary.totalDiscountedAmount += product.discountedPrice;
    }
    
    if (product.taxAmount !== undefined) {
      summary.totalTaxAmount += product.taxAmount;
    }
    
    if (product.totalWithTax !== undefined) {
      summary.totalWithTax += product.totalWithTax;
    }
    
    if (product.sku) {
      summary.skuList.push(product.sku);
      summary.skuSet.add(product.sku.toLowerCase());
    }
  });
  
  summary.uniqueSkus = summary.skuSet.size;
  
  return summary;
}

/**
 * 计算合同汇总
 */
function calculateContractSummary(contract) {
  const summary = {
    ...calculateSummary(contract.products),
    totalDeliveries: contract.deliveries.length,
    totalPayments: contract.payments.length,
    totalPaymentRatio: 0,
    totalPaymentAmount: 0,
    hasFinalPayment: false,
    finalPaymentCondition: null
  };
  
  // 检查付款信息
  contract.payments.forEach(payment => {
    if (payment.ratioNum !== undefined) {
      summary.totalPaymentRatio += payment.ratioNum;
    }
    
    if (payment.amountNum !== undefined) {
      summary.totalPaymentAmount += payment.amountNum;
    }
    
    // 检查是否有尾款相关
    const nodeLower = String(payment.node || '').toLowerCase();
    const conditionLower = String(payment.condition || '').toLowerCase();
    
    if (nodeLower.includes('尾款') || 
        nodeLower.includes('最后') || 
        nodeLower.includes('验收') ||
        conditionLower.includes('验收') ||
        conditionLower.includes('质保') ||
        conditionLower.includes('保修')) {
      summary.hasFinalPayment = true;
      summary.finalPaymentCondition = payment.condition || payment.node;
    }
  });
  
  return summary;
}

module.exports = {
  normalizeAll,
  normalizeQuote,
  normalizeContract,
  normalizeCatalog,
  normalizeApproval,
  normalizeProductRow,
  parseDate,
  NORMALIZATION_CONFIG
};
