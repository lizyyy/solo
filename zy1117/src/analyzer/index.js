const dayjs = require('dayjs');

/**
 * 问题严重程度等级
 */
const SEVERITY = {
  CRITICAL: 'critical',      // 需要客户确认 - 最严重
  HIGH: 'high',              // 需要内部确认 - 高优先级
  MEDIUM: 'medium',          // 建议修订 - 中优先级
  LOW: 'low'                 // 建议检查 - 低优先级
};

/**
 * 问题类型定义
 */
const ISSUE_TYPES = {
  // 产品差异
  QUOTE_ONLY_SKU: 'quote_only_sku',              // 报价有但合同没有的SKU
  CONTRACT_ONLY_SKU: 'contract_only_sku',        // 合同有但报价没有的SKU
  SKU_INACTIVE: 'sku_inactive',                   // SKU已停用
  
  // 数量差异
  QUANTITY_MISMATCH: 'quantity_mismatch',         // 数量不一致
  
  // 价格差异
  PRICE_MISMATCH: 'price_mismatch',               // 单价/总价不一致
  DISCOUNT_MISMATCH: 'discount_mismatch',         // 折扣不一致
  DISCOUNT_NOT_SYNCED: 'discount_not_synced',     // 审批有降价但报价没同步
  
  // 税率差异
  TAX_RATE_MISMATCH: 'tax_rate_mismatch',         // 税率不一致
  
  // 维保差异
  WARRANTY_MISMATCH: 'warranty_mismatch',         // 维保期限不一致
  
  // 交付问题
  DELIVERY_DATE_CONFLICT: 'delivery_date_conflict',    // 交付日期冲突
  DELIVERY_BATCH_CONFLICT: 'delivery_batch_conflict',  // 交付批次冲突
  
  // 付款问题
  PAYMENT_RATIO_SUM_ERROR: 'payment_ratio_sum_error',  // 付款比例总和不对
  FINAL_PAYMENT_MISSING: 'final_payment_missing',      // 尾款条件缺失
  PAYMENT_AMOUNT_MISMATCH: 'payment_amount_mismatch',  // 付款金额与总价不一致
  
  // 数据质量问题
  INVALID_NUMBER: 'invalid_number',                 // 无效数字
  INVALID_DATE: 'invalid_date',                     // 无效日期
  MISSING_FIELD: 'missing_field',                   // 字段缺失
  DUPLICATE_SKU: 'duplicate_sku',                   // 重复SKU
  DATA_WARNING: 'data_warning'                      // 其他数据警告
};

/**
 * 分析所有归一化数据，检测问题
 * @param {Object} normalizedData - 归一化后的数据
 * @returns {Object} 分析结果
 */
function analyzeAll(normalizedData) {
  const result = {
    summary: {
      totalIssues: 0,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byType: {},
      byCategory: {}
    },
    issues: [],
    comparisons: {
      products: [],
      deliveries: [],
      payments: []
    },
    statistics: {
      quote: null,
      contract: null,
      catalog: null,
      approval: null
    }
  };
  
  // 收集统计信息
  if (normalizedData.quote) {
    result.statistics.quote = {
      file: normalizedData.quote.fileName,
      productCount: normalizedData.quote.products.length,
      totalAmount: normalizedData.quote.summary.totalAmount
    };
  }
  
  if (normalizedData.contract) {
    result.statistics.contract = {
      file: normalizedData.contract.fileName,
      productCount: normalizedData.contract.products.length,
      deliveryCount: normalizedData.contract.deliveries.length,
      paymentCount: normalizedData.contract.payments.length,
      totalAmount: normalizedData.contract.summary.totalAmount
    };
  }
  
  if (normalizedData.catalog) {
    result.statistics.catalog = {
      file: normalizedData.catalog.fileName,
      productCount: normalizedData.catalog.products.length,
      activeCount: normalizedData.catalog.products.filter(p => p.isActive).length
    };
  }
  
  if (normalizedData.approval) {
    result.statistics.approval = {
      file: normalizedData.approval.fileName,
      approvalCount: normalizedData.approval.approvals.length,
      hasDiscountNotes: normalizedData.approval.summary.hasDiscountNotes
    };
  }
  
  // 执行各类检测
  const detectors = [
    detectProductDifferences,
    detectQuantityDifferences,
    detectPriceDifferences,
    detectInactiveSkus,
    detectApprovalDiscountSync,
    detectWarrantyDifferences,
    detectDeliveryConflicts,
    detectPaymentIssues,
    detectDataQualityIssues
  ];
  
  detectors.forEach(detector => {
    const detected = detector(normalizedData);
    result.issues = result.issues.concat(detected.issues || []);
    if (detected.comparisons) {
      result.comparisons.products = result.comparisons.products.concat(detected.comparisons.products || []);
      result.comparisons.deliveries = result.comparisons.deliveries.concat(detected.comparisons.deliveries || []);
      result.comparisons.payments = result.comparisons.payments.concat(detected.comparisons.payments || []);
    }
  });
  
  // 汇总统计
  result.issues.forEach(issue => {
    result.summary.totalIssues++;
    
    // 按严重程度统计
    if (result.summary.bySeverity[issue.severity] !== undefined) {
      result.summary.bySeverity[issue.severity]++;
    }
    
    // 按类型统计
    if (result.summary.byType[issue.type]) {
      result.summary.byType[issue.type]++;
    } else {
      result.summary.byType[issue.type] = 1;
    }
    
    // 按分类统计
    const category = getIssueCategory(issue.type);
    if (result.summary.byCategory[category]) {
      result.summary.byCategory[category]++;
    } else {
      result.summary.byCategory[category] = 1;
    }
  });
  
  // 按严重程度排序问题
  result.issues.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  return result;
}

/**
 * 获取问题分类
 */
function getIssueCategory(type) {
  const categories = {
    product: ['quote_only_sku', 'contract_only_sku', 'sku_inactive', 'duplicate_sku'],
    quantity: ['quantity_mismatch'],
    price: ['price_mismatch', 'discount_mismatch', 'discount_not_synced'],
    tax: ['tax_rate_mismatch'],
    warranty: ['warranty_mismatch'],
    delivery: ['delivery_date_conflict', 'delivery_batch_conflict'],
    payment: ['payment_ratio_sum_error', 'final_payment_missing', 'payment_amount_mismatch'],
    data: ['invalid_number', 'invalid_date', 'missing_field', 'data_warning']
  };
  
  for (const [category, types] of Object.entries(categories)) {
    if (types.includes(type)) {
      return category;
    }
  }
  return 'other';
}

/**
 * 检测产品差异
 */
function detectProductDifferences(normalizedData) {
  const issues = [];
  const comparisons = { products: [] };
  
  const quoteProducts = normalizedData.quote?.products || [];
  const contractProducts = normalizedData.contract?.products || [];
  
  // 构建SKU映射
  const quoteSkuMap = new Map();
  const contractSkuMap = new Map();
  
  quoteProducts.forEach(p => {
    if (p.sku) {
      quoteSkuMap.set(p.sku.toLowerCase(), p);
    }
  });
  
  contractProducts.forEach(p => {
    if (p.sku) {
      contractSkuMap.set(p.sku.toLowerCase(), p);
    }
  });
  
  // 检查报价有但合同没有的SKU
  quoteSkuMap.forEach((product, skuLower) => {
    if (!contractSkuMap.has(skuLower)) {
      issues.push({
        type: ISSUE_TYPES.QUOTE_ONLY_SKU,
        severity: SEVERITY.HIGH,
        title: '报价单有但合同遗漏的产品',
        message: `报价单中的SKU [${product.sku}] ${product.productName || ''} 在合同中未找到`,
        source: {
          file: product._fileName,
          line: product._lineNumber,
          field: 'SKU'
        },
        details: {
          sku: product.sku,
          productName: product.productName,
          quantity: product.quantityNum,
          unitPrice: product.unitPriceNum,
          totalPrice: product.totalPriceNum
        },
        suggestion: '请确认该产品是否应包含在合同中，或是否已在报价阶段取消'
      });
    } else {
      // 两边都有，记录对比信息
      const contractProduct = contractSkuMap.get(skuLower);
      comparisons.products.push({
        sku: product.sku,
        productName: product.productName,
        quote: {
          quantity: product.quantityNum,
          unitPrice: product.unitPriceNum,
          totalPrice: product.totalPriceNum,
          discount: product.discountNum,
          taxRate: product.taxRateNum,
          warranty: product.warranty
        },
        contract: {
          quantity: contractProduct.quantityNum,
          unitPrice: contractProduct.unitPriceNum,
          totalPrice: contractProduct.totalPriceNum,
          discount: contractProduct.discountNum,
          taxRate: contractProduct.taxRateNum,
          warranty: contractProduct.warranty
        }
      });
    }
  });
  
  // 检查合同有但报价没有的SKU
  contractSkuMap.forEach((product, skuLower) => {
    if (!quoteSkuMap.has(skuLower)) {
      issues.push({
        type: ISSUE_TYPES.CONTRACT_ONLY_SKU,
        severity: SEVERITY.CRITICAL,
        title: '合同多承诺但报价未覆盖的产品',
        message: `合同中的SKU [${product.sku}] ${product.productName || ''} 在报价单中未找到，这意味着可能需要额外成本`,
        source: {
          file: product._fileName,
          line: product._lineNumber,
          field: 'SKU'
        },
        details: {
          sku: product.sku,
          productName: product.productName,
          quantity: product.quantityNum,
          unitPrice: product.unitPriceNum,
          totalPrice: product.totalPriceNum
        },
        suggestion: '这是高风险问题！请立即确认：1) 该产品是否应免费赠送 2) 是否需要增补报价 3) 是否从合同中移除'
      });
    }
  });
  
  return { issues, comparisons };
}

/**
 * 检测数量差异
 */
function detectQuantityDifferences(normalizedData) {
  const issues = [];
  
  const quoteProducts = normalizedData.quote?.products || [];
  const contractProducts = normalizedData.contract?.products || [];
  
  const quoteSkuMap = new Map();
  const contractSkuMap = new Map();
  
  quoteProducts.forEach(p => {
    if (p.sku) quoteSkuMap.set(p.sku.toLowerCase(), p);
  });
  
  contractProducts.forEach(p => {
    if (p.sku) contractSkuMap.set(p.sku.toLowerCase(), p);
  });
  
  quoteSkuMap.forEach((quoteProduct, skuLower) => {
    const contractProduct = contractSkuMap.get(skuLower);
    if (!contractProduct) return;
    
    if (quoteProduct.quantityNum !== undefined && 
        contractProduct.quantityNum !== undefined &&
        quoteProduct.quantityNum !== contractProduct.quantityNum) {
      issues.push({
        type: ISSUE_TYPES.QUANTITY_MISMATCH,
        severity: SEVERITY.HIGH,
        title: '产品数量不一致',
        message: `SKU [${quoteProduct.sku}] ${quoteProduct.productName || ''} 数量不一致：报价 ${quoteProduct.quantityNum}，合同 ${contractProduct.quantityNum}`,
        source: {
          quote: {
            file: quoteProduct._fileName,
            line: quoteProduct._lineNumber,
            field: '数量',
            value: quoteProduct.quantity
          },
          contract: {
            file: contractProduct._fileName,
            line: contractProduct._lineNumber,
            field: '数量',
            value: contractProduct.quantity
          }
        },
        details: {
          sku: quoteProduct.sku,
          productName: quoteProduct.productName,
          quoteQuantity: quoteProduct.quantityNum,
          contractQuantity: contractProduct.quantityNum,
          difference: contractProduct.quantityNum - quoteProduct.quantityNum
        },
        suggestion: contractProduct.quantityNum > quoteProduct.quantityNum 
          ? '合同数量大于报价数量，需要确认是否需要增补报价或客户多采购'
          : '合同数量小于报价数量，需要确认是否减配或客户减少采购'
      });
    }
  });
  
  return { issues };
}

/**
 * 检测价格差异
 */
function detectPriceDifferences(normalizedData) {
  const issues = [];
  
  const quoteProducts = normalizedData.quote?.products || [];
  const contractProducts = normalizedData.contract?.products || [];
  
  const quoteSkuMap = new Map();
  const contractSkuMap = new Map();
  
  quoteProducts.forEach(p => {
    if (p.sku) quoteSkuMap.set(p.sku.toLowerCase(), p);
  });
  
  contractProducts.forEach(p => {
    if (p.sku) contractSkuMap.set(p.sku.toLowerCase(), p);
  });
  
  const EPSILON = 0.01; // 允许的微小差异
  
  quoteSkuMap.forEach((quoteProduct, skuLower) => {
    const contractProduct = contractSkuMap.get(skuLower);
    if (!contractProduct) return;
    
    // 检查单价差异
    if (quoteProduct.unitPriceNum !== undefined && 
        contractProduct.unitPriceNum !== undefined &&
        Math.abs(quoteProduct.unitPriceNum - contractProduct.unitPriceNum) > EPSILON) {
      issues.push({
        type: ISSUE_TYPES.PRICE_MISMATCH,
        severity: SEVERITY.CRITICAL,
        title: '产品单价不一致',
        message: `SKU [${quoteProduct.sku}] ${quoteProduct.productName || ''} 单价不一致：报价 ${quoteProduct.unitPriceNum}，合同 ${contractProduct.unitPriceNum}`,
        source: {
          quote: {
            file: quoteProduct._fileName,
            line: quoteProduct._lineNumber,
            field: '单价',
            value: quoteProduct.unitPrice
          },
          contract: {
            file: contractProduct._fileName,
            line: contractProduct._lineNumber,
            field: '单价',
            value: contractProduct.unitPrice
          }
        },
        details: {
          sku: quoteProduct.sku,
          productName: quoteProduct.productName,
          quotePrice: quoteProduct.unitPriceNum,
          contractPrice: contractProduct.unitPriceNum,
          difference: contractProduct.unitPriceNum - quoteProduct.unitPriceNum,
          differencePercent: ((contractProduct.unitPriceNum - quoteProduct.unitPriceNum) / quoteProduct.unitPriceNum * 100).toFixed(2)
        },
        suggestion: contractProduct.unitPriceNum < quoteProduct.unitPriceNum
          ? '合同单价低于报价单价，需要确认是否有未记录的折扣或降价审批'
          : '合同单价高于报价单价，需要确认是否升级配置或价格调整未同步到报价'
      });
    }
    
    // 检查折扣差异
    if (quoteProduct.discountNum !== undefined && 
        contractProduct.discountNum !== undefined &&
        Math.abs(quoteProduct.discountNum - contractProduct.discountNum) > EPSILON) {
      issues.push({
        type: ISSUE_TYPES.DISCOUNT_MISMATCH,
        severity: SEVERITY.HIGH,
        title: '产品折扣不一致',
        message: `SKU [${quoteProduct.sku}] ${quoteProduct.productName || ''} 折扣不一致：报价 ${(quoteProduct.discountNum * 100).toFixed(0)}%，合同 ${(contractProduct.discountNum * 100).toFixed(0)}%`,
        source: {
          quote: {
            file: quoteProduct._fileName,
            line: quoteProduct._lineNumber,
            field: '折扣',
            value: quoteProduct.discount
          },
          contract: {
            file: contractProduct._fileName,
            line: contractProduct._lineNumber,
            field: '折扣',
            value: contractProduct.discount
          }
        },
        details: {
          sku: quoteProduct.sku,
          productName: quoteProduct.productName,
          quoteDiscount: quoteProduct.discountNum,
          contractDiscount: contractProduct.discountNum
        },
        suggestion: '请确认哪个折扣是正确的，是否有审批记录支持该折扣'
      });
    }
    
    // 检查税率差异
    if (quoteProduct.taxRateNum !== undefined && 
        contractProduct.taxRateNum !== undefined &&
        Math.abs(quoteProduct.taxRateNum - contractProduct.taxRateNum) > EPSILON) {
      issues.push({
        type: ISSUE_TYPES.TAX_RATE_MISMATCH,
        severity: SEVERITY.MEDIUM,
        title: '税率不一致',
        message: `SKU [${quoteProduct.sku}] ${quoteProduct.productName || ''} 税率不一致：报价 ${(quoteProduct.taxRateNum * 100).toFixed(0)}%，合同 ${(contractProduct.taxRateNum * 100).toFixed(0)}%`,
        source: {
          quote: {
            file: quoteProduct._fileName,
            line: quoteProduct._lineNumber,
            field: '税率',
            value: quoteProduct.taxRate
          },
          contract: {
            file: contractProduct._fileName,
            line: contractProduct._lineNumber,
            field: '税率',
            value: contractProduct.taxRate
          }
        },
        details: {
          sku: quoteProduct.sku,
          productName: quoteProduct.productName,
          quoteTaxRate: quoteProduct.taxRateNum,
          contractTaxRate: contractProduct.taxRateNum
        },
        suggestion: '请确认适用的税率，是否涉及不同类别的产品或不同的纳税主体'
      });
    }
  });
  
  return { issues };
}

/**
 * 检测停用SKU
 */
function detectInactiveSkus(normalizedData) {
  const issues = [];
  
  if (!normalizedData.catalog) {
    return { issues };
  }
  
  const catalogSkus = normalizedData.catalog.skuMap;
  const quoteProducts = normalizedData.quote?.products || [];
  const contractProducts = normalizedData.contract?.products || [];
  
  // 检查报价单中的停用SKU
  quoteProducts.forEach(product => {
    if (!product.sku) return;
    const catalogProduct = catalogSkus.get(product.sku.toLowerCase());
    if (catalogProduct && !catalogProduct.isActive) {
      issues.push({
        type: ISSUE_TYPES.SKU_INACTIVE,
        severity: SEVERITY.HIGH,
        title: '报价单中使用了已停用的SKU',
        message: `报价单中的SKU [${product.sku}] ${product.productName || ''} 在产品目录中已停用`,
        source: {
          file: product._fileName,
          line: product._lineNumber,
          field: 'SKU'
        },
        catalogSource: {
          file: normalizedData.catalog.fileName,
          status: catalogProduct.status
        },
        details: {
          sku: product.sku,
          productName: product.productName,
          catalogStatus: catalogProduct.status,
          quantity: product.quantityNum
        },
        suggestion: '请确认：1) 是否需要替换为新产品 2) 该SKU是否真的可以供应 3) 是否需要更新产品目录状态'
      });
    }
  });
  
  // 检查合同中的停用SKU
  contractProducts.forEach(product => {
    if (!product.sku) return;
    const catalogProduct = catalogSkus.get(product.sku.toLowerCase());
    if (catalogProduct && !catalogProduct.isActive) {
      issues.push({
        type: ISSUE_TYPES.SKU_INACTIVE,
        severity: SEVERITY.CRITICAL,
        title: '合同中承诺了已停用的SKU',
        message: `合同中的SKU [${product.sku}] ${product.productName || ''} 在产品目录中已停用，这是高风险问题！`,
        source: {
          file: product._fileName,
          line: product._lineNumber,
          field: 'SKU'
        },
        catalogSource: {
          file: normalizedData.catalog.fileName,
          status: catalogProduct.status
        },
        details: {
          sku: product.sku,
          productName: product.productName,
          catalogStatus: catalogProduct.status,
          quantity: product.quantityNum
        },
        suggestion: '紧急！请立即确认该产品是否可以交付，是否需要：1) 找替代产品 2) 与客户协商更换 3) 特殊申请继续供应'
      });
    }
  });
  
  return { issues };
}

/**
 * 检测审批折扣同步问题
 */
function detectApprovalDiscountSync(normalizedData) {
  const issues = [];
  
  if (!normalizedData.approval || !normalizedData.approval.summary.hasDiscountNotes) {
    return { issues };
  }
  
  const discountNotes = normalizedData.approval.discountNotes;
  const quoteProducts = normalizedData.quote?.products || [];
  
  // 检查报价单中是否应用了折扣
  const hasAnyDiscountInQuote = quoteProducts.some(p => p.discountNum < 1.0);
  
  // 如果审批有折扣相关备注，但报价单中没有任何折扣
  if (!hasAnyDiscountInQuote && discountNotes.length > 0) {
    discountNotes.forEach(note => {
      issues.push({
        type: ISSUE_TYPES.DISCOUNT_NOT_SYNCED,
        severity: SEVERITY.HIGH,
        title: '审批备注有降价但报价未同步',
        message: `审批人 ${note.approver || '未知'} 在 ${note.date || '未知日期'} 的审批中提到了折扣/降价，但报价单中未找到相应的折扣`,
        source: {
          file: normalizedData.approval.fileName,
          index: note._index,
          field: '内容'
        },
        details: {
          approver: note.approver,
          date: note.date,
          content: note.content,
          extractedDiscount: note.extractedDiscount
        },
        suggestion: '请确认审批中的折扣是否已正确应用到报价单，或者是否遗漏了某产品的折扣'
      });
    });
  }
  
  return { issues };
}

/**
 * 检测维保期限差异
 */
function detectWarrantyDifferences(normalizedData) {
  const issues = [];
  
  const quoteProducts = normalizedData.quote?.products || [];
  const contractProducts = normalizedData.contract?.products || [];
  
  const quoteSkuMap = new Map();
  const contractSkuMap = new Map();
  
  quoteProducts.forEach(p => {
    if (p.sku) quoteSkuMap.set(p.sku.toLowerCase(), p);
  });
  
  contractProducts.forEach(p => {
    if (p.sku) contractSkuMap.set(p.sku.toLowerCase(), p);
  });
  
  quoteSkuMap.forEach((quoteProduct, skuLower) => {
    const contractProduct = contractSkuMap.get(skuLower);
    if (!contractProduct) return;
    
    const quoteWarranty = normalizeWarranty(quoteProduct.warranty);
    const contractWarranty = normalizeWarranty(contractProduct.warranty);
    
    if (quoteWarranty !== null && contractWarranty !== null) {
      if (contractWarranty > quoteWarranty) {
        issues.push({
          type: ISSUE_TYPES.WARRANTY_MISMATCH,
          severity: SEVERITY.HIGH,
          title: '合同维保期限长于报价',
          message: `SKU [${quoteProduct.sku}] ${quoteProduct.productName || ''} 维保期限不一致：报价 ${quoteProduct.warranty || '默认'}，合同 ${contractProduct.warranty || '默认'}`,
          source: {
            quote: {
              file: quoteProduct._fileName,
              line: quoteProduct._lineNumber,
              field: '维保期限',
              value: quoteProduct.warranty
            },
            contract: {
              file: contractProduct._fileName,
              line: contractProduct._lineNumber,
              field: '维保期限',
              value: contractProduct.warranty
            }
          },
          details: {
            sku: quoteProduct.sku,
            productName: quoteProduct.productName,
            quoteWarranty: quoteProduct.warranty,
            quoteWarrantyMonths: quoteWarranty,
            contractWarranty: contractProduct.warranty,
            contractWarrantyMonths: contractWarranty
          },
          suggestion: '合同维保期限比报价长，这会增加售后成本，请确认是否有相应的费用增加或是否是笔误'
        });
      } else if (contractWarranty < quoteWarranty) {
        issues.push({
          type: ISSUE_TYPES.WARRANTY_MISMATCH,
          severity: SEVERITY.MEDIUM,
          title: '合同维保期限短于报价',
          message: `SKU [${quoteProduct.sku}] ${quoteProduct.productName || ''} 维保期限不一致：报价 ${quoteProduct.warranty || '默认'}，合同 ${contractProduct.warranty || '默认'}`,
          source: {
            quote: {
              file: quoteProduct._fileName,
              line: quoteProduct._lineNumber,
              field: '维保期限',
              value: quoteProduct.warranty
            },
            contract: {
              file: contractProduct._fileName,
              line: contractProduct._lineNumber,
              field: '维保期限',
              value: contractProduct.warranty
            }
          },
          details: {
            sku: quoteProduct.sku,
            productName: quoteProduct.productName,
            quoteWarranty: quoteProduct.warranty,
            contractWarranty: contractProduct.warranty
          },
          suggestion: '合同维保期限比报价短，建议确认客户是否接受，或者是否是笔误'
        });
      }
    }
  });
  
  return { issues };
}

/**
 * 标准化维保期限（转换为月数）
 */
function normalizeWarranty(warrantyStr) {
  if (!warrantyStr) return null;
  
  const lower = warrantyStr.toLowerCase();
  
  // 匹配年
  const yearMatch = lower.match(/(\d+)\s*(年|year|y)/);
  if (yearMatch) {
    return parseInt(yearMatch[1]) * 12;
  }
  
  // 匹配月
  const monthMatch = lower.match(/(\d+)\s*(月|month|m)/);
  if (monthMatch) {
    return parseInt(monthMatch[1]);
  }
  
  // 默认1年
  if (lower.includes('一年') || lower.includes('1年') || lower.includes('one year')) {
    return 12;
  }
  if (lower.includes('两年') || lower.includes('2年') || lower.includes('two year')) {
    return 24;
  }
  if (lower.includes('三年') || lower.includes('3年') || lower.includes('three year')) {
    return 36;
  }
  
  return null;
}

/**
 * 检测交付冲突
 */
function detectDeliveryConflicts(normalizedData) {
  const issues = [];
  
  if (!normalizedData.contract) {
    return { issues };
  }
  
  const deliveries = normalizedData.contract.deliveries;
  
  if (deliveries.length < 2) {
    return { issues };
  }
  
  // 检查交付日期顺序
  const datedDeliveries = deliveries.filter(d => d.deliveryDateParsed);
  
  for (let i = 0; i < datedDeliveries.length - 1; i++) {
    for (let j = i + 1; j < datedDeliveries.length; j++) {
      const d1 = datedDeliveries[i];
      const d2 = datedDeliveries[j];
      
      // 检查批次号重复
      if (d1.batch && d2.batch && d1.batch === d2.batch) {
        issues.push({
          type: ISSUE_TYPES.DELIVERY_BATCH_CONFLICT,
          severity: SEVERITY.MEDIUM,
          title: '交付批次号重复',
          message: `发现重复的交付批次号 [${d1.batch}]`,
          source: [
            {
              file: d1._fileName,
              line: d1._lineNumber,
              field: '批次',
              value: d1.batch
            },
            {
              file: d2._fileName,
              line: d2._lineNumber,
              field: '批次',
              value: d2.batch
            }
          ],
          details: {
            batch1: { batch: d1.batch, date: d1.deliveryDate, content: d1.content },
            batch2: { batch: d2.batch, date: d2.deliveryDate, content: d2.content }
          },
          suggestion: '请确认批次号是否正确，或者是否需要区分不同的交付批次'
        });
      }
      
      // 检查日期顺序（如果有批次号）
      if (d1.batch && d2.batch) {
        // 尝试从批次号中提取顺序
        const batch1Match = String(d1.batch).match(/\d+/);
        const batch2Match = String(d2.batch).match(/\d+/);
        
        if (batch1Match && batch2Match) {
          const batch1Num = parseInt(batch1Match[1]);
          const batch2Num = parseInt(batch2Match[1]);
          
          // 如果批次1 > 批次2，但日期1 < 日期2，或者相反
          const date1IsBefore = d1.deliveryDateParsed.isBefore(d2.deliveryDateParsed);
          
          if (batch1Num < batch2Num && !date1IsBefore) {
            issues.push({
              type: ISSUE_TYPES.DELIVERY_DATE_CONFLICT,
              severity: SEVERITY.HIGH,
              title: '交付日期与批次顺序冲突',
              message: `批次 ${d1.batch} 的日期 [${d1.deliveryDate}] 晚于批次 ${d2.batch} 的日期 [${d2.deliveryDate}]，但批次号顺序相反`,
              source: [
                {
                  file: d1._fileName,
                  line: d1._lineNumber,
                  field: '交付日期',
                  value: d1.deliveryDate
                },
                {
                  file: d2._fileName,
                  line: d2._lineNumber,
                  field: '交付日期',
                  value: d2.deliveryDate
                }
              ],
              details: {
                delivery1: { batch: d1.batch, date: d1.deliveryDate, dateISO: d1.deliveryDateISO },
                delivery2: { batch: d2.batch, date: d2.deliveryDate, dateISO: d2.deliveryDateISO }
              },
              suggestion: '请确认交付日期和批次号的顺序是否正确，避免逻辑混乱'
            });
          }
        }
      }
    }
  }
  
  return { issues };
}

/**
 * 检测付款问题
 */
function detectPaymentIssues(normalizedData) {
  const issues = [];
  
  if (!normalizedData.contract) {
    return { issues };
  }
  
  const payments = normalizedData.contract.payments;
  const summary = normalizedData.contract.summary;
  
  // 检查付款比例总和
  if (summary.totalPaymentRatio > 0) {
    const ratioSum = summary.totalPaymentRatio;
    const EPSILON = 0.01;
    
    if (Math.abs(ratioSum - 1.0) > EPSILON) {
      issues.push({
        type: ISSUE_TYPES.PAYMENT_RATIO_SUM_ERROR,
        severity: SEVERITY.HIGH,
        title: '付款比例总和不正确',
        message: `付款比例总和为 ${(ratioSum * 100).toFixed(2)}%，不是 100%`,
        source: {
          file: normalizedData.contract.fileName,
          field: '付款比例'
        },
        details: {
          totalRatio: ratioSum,
          totalRatioPercent: (ratioSum * 100).toFixed(2),
          expectedRatio: 1.0,
          difference: Math.abs(ratioSum - 1.0)
        },
        payments: payments.map(p => ({
          node: p.node,
          ratio: p.ratio,
          ratioNum: p.ratioNum
        })),
        suggestion: ratioSum > 1.0 
          ? '付款比例超过100%，请检查是否有重复计算或比例填写错误'
          : '付款比例不足100%，请检查是否遗漏了某个付款节点'
      });
    }
  }
  
  // 检查是否有尾款条件
  if (!summary.hasFinalPayment && payments.length > 0) {
    issues.push({
      type: ISSUE_TYPES.FINAL_PAYMENT_MISSING,
      severity: SEVERITY.HIGH,
      title: '未明确发现尾款/验收款条件',
      message: `在 ${payments.length} 个付款节点中，未明确发现包含"尾款"、"验收"、"质保"等关键词的最后付款条件`,
      source: {
        file: normalizedData.contract.fileName,
        field: '付款节点'
      },
      details: {
        totalPayments: payments.length,
        payments: payments.map(p => ({
          node: p.node,
          condition: p.condition,
          ratio: p.ratio
        }))
      },
      suggestion: '建议确认：1) 是否有遗漏的尾款节点 2) 最后一笔付款是否有明确的验收/质保条件 3) 付款条件是否清晰'
    });
  }
  
  // 检查付款金额与合同总价是否匹配
  if (summary.totalPaymentAmount > 0 && summary.totalAmount > 0) {
    const EPSILON = 100; // 允许100元以内的差异
    
    if (Math.abs(summary.totalPaymentAmount - summary.totalAmount) > EPSILON) {
      issues.push({
        type: ISSUE_TYPES.PAYMENT_AMOUNT_MISMATCH,
        severity: SEVERITY.HIGH,
        title: '付款金额总和与合同总价不一致',
        message: `付款金额总和 ${summary.totalPaymentAmount} 与合同产品总价 ${summary.totalAmount} 不一致`,
        source: {
          file: normalizedData.contract.fileName,
          field: '付款金额'
        },
        details: {
          totalPaymentAmount: summary.totalPaymentAmount,
          totalContractAmount: summary.totalAmount,
          difference: summary.totalPaymentAmount - summary.totalAmount
        },
        suggestion: '请检查付款金额的计算是否正确，或者是否有其他费用（如运费、安装费等）未包含在产品总价中'
      });
    }
  }
  
  return { issues };
}

/**
 * 检测数据质量问题
 */
function detectDataQualityIssues(normalizedData) {
  const issues = [];
  
  // 收集所有警告
  const allWarnings = normalizedData.warnings || [];
  
  allWarnings.forEach(warning => {
    let severity = SEVERITY.MEDIUM;
    let type = ISSUE_TYPES.DATA_WARNING;
    let title = '数据质量警告';
    
    switch (warning.type) {
      case 'duplicate_sku':
        severity = SEVERITY.HIGH;
        type = ISSUE_TYPES.DUPLICATE_SKU;
        title = '重复的SKU';
        break;
      case 'invalid_number':
        severity = SEVERITY.HIGH;
        type = ISSUE_TYPES.INVALID_NUMBER;
        title = '无效的数字格式';
        break;
      case 'missing_sku':
        severity = SEVERITY.MEDIUM;
        type = ISSUE_TYPES.MISSING_FIELD;
        title = '缺少SKU字段';
        break;
      case 'date_format_warning':
        severity = SEVERITY.LOW;
        type = ISSUE_TYPES.INVALID_DATE;
        title = '日期格式不标准';
        break;
      case 'header_warning':
        severity = SEVERITY.MEDIUM;
        type = ISSUE_TYPES.MISSING_FIELD;
        title = '表头字段可能缺失';
        break;
      case 'sheet_warning':
      case 'table_warning':
      case 'possible_sku':
      case 'unknown_status':
      case 'structure_warning':
        severity = SEVERITY.LOW;
        type = ISSUE_TYPES.DATA_WARNING;
        break;
    }
    
    issues.push({
      type,
      severity,
      title,
      message: warning.message,
      source: {
        file: warning.file,
        line: warning.line,
        sheet: warning.sheet,
        index: warning.index,
        field: warning.field,
        value: warning.value
      },
      details: {
        originalType: warning.type
      },
      suggestion: getDataQualitySuggestion(warning.type, warning)
    });
  });
  
  return { issues };
}

/**
 * 获取数据质量问题的建议
 */
function getDataQualitySuggestion(type, warning) {
  const suggestions = {
    'duplicate_sku': '请删除或合并重复的SKU，确保每个SKU只出现一次',
    'invalid_number': '请修正数字格式，支持纯数字、带千分位逗号、带货币符号（￥$）的格式',
    'missing_sku': '请为每个产品添加SKU字段，这是进行差异对比的关键标识',
    'date_format_warning': '建议使用标准日期格式：YYYY-MM-DD（如 2024-01-15）',
    'header_warning': '请检查CSV/Excel表头是否包含必要字段：SKU、产品名称、数量、单价',
    'sheet_warning': '建议将报价数据放在命名明确的工作表中，如"报价单"、"产品清单"',
    'structure_warning': '请确保JSON结构正确，产品目录应包含 products 数组',
    'possible_sku': '建议确认该字符串是否为SKU，是否需要添加到产品表格中',
    'unknown_status': '建议使用标准状态值：active/启用 或 inactive/停用',
    'table_warning': '请确保表格列数与表头一致'
  };
  
  return suggestions[type] || '请检查并修正数据格式';
}

module.exports = {
  analyzeAll,
  SEVERITY,
  ISSUE_TYPES,
  getIssueCategory
};
