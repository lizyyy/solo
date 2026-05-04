const fs = require('fs');
const path = require('path');

/**
 * 读取JSON文件
 * @param {string} filePath - JSON文件路径
 * @param {string} expectedType - 预期的JSON类型: 'catalog' | 'approval' | 'generic'
 * @returns {Promise<Object>} 包含数据和警告的对象
 */
async function readJson(filePath, expectedType = 'generic') {
  const warnings = [];
  const fileName = path.basename(filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data;
    
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      throw {
        file: fileName,
        error: `JSON解析失败: ${parseError.message}`,
        type: 'parse_error',
        line: estimateLineNumber(content, parseError)
      };
    }
    
    // 根据类型进行验证和清洗
    if (expectedType === 'catalog') {
      return validateAndCleanCatalog(data, warnings, fileName);
    } else if (expectedType === 'approval') {
      return validateAndCleanApproval(data, warnings, fileName);
    }
    
    return {
      data,
      warnings,
      format: 'json',
      fileName,
      type: expectedType
    };
    
  } catch (error) {
    if (error.type) {
      throw error;
    }
    throw {
      file: fileName,
      error: error.message,
      type: 'read_error'
    };
  }
}

/**
 * 验证和清洗产品目录数据
 */
function validateAndCleanCatalog(data, warnings, fileName) {
  const cleaned = {
    products: [],
    categories: data.categories || [],
    metadata: data.metadata || {}
  };
  
  let products = [];
  
  // 支持不同的产品目录结构
  if (data.products && Array.isArray(data.products)) {
    products = data.products;
  } else if (data.items && Array.isArray(data.items)) {
    products = data.items;
  } else if (Array.isArray(data)) {
    products = data;
  } else {
    warnings.push({
      file: fileName,
      type: 'structure_warning',
      message: '产品目录结构不标准，未找到 products/items 数组或根数组',
      severity: 'high'
    });
  }
  
  const skuMap = new Map();
  
  products.forEach((product, index) => {
    const cleanedProduct = {
      ...product,
      _sourceIndex: index
    };
    
    // 标准化字段名
    if (product.sku) cleanedProduct.SKU = product.sku;
    if (product.code) cleanedProduct.SKU = cleanedProduct.SKU || product.code;
    if (product.name) cleanedProduct.产品名称 = cleanedProduct.产品名称 || product.name;
    if (product.status) cleanedProduct.状态 = cleanedProduct.状态 || product.status;
    if (product.active !== undefined) cleanedProduct.状态 = product.active ? 'active' : 'inactive';
    
    const sku = cleanedProduct.SKU || product.SKU || product.sku || product.code;
    
    if (sku) {
      if (skuMap.has(sku)) {
        warnings.push({
          file: fileName,
          type: 'duplicate_sku',
          message: `产品目录中SKU [${sku}] 重复出现，索引: ${skuMap.get(sku)} 和 ${index}`,
          index,
          severity: 'high',
          field: 'SKU'
        });
      } else {
        skuMap.set(sku, index);
      }
    } else {
      warnings.push({
        file: fileName,
        type: 'missing_sku',
        message: `产品目录中第 ${index} 个产品缺少SKU字段`,
        index,
        severity: 'medium'
      });
    }
    
    // 检查状态字段
    const status = cleanedProduct.状态 || product.status;
    if (status) {
      const validStatuses = ['active', 'inactive', '停用', '启用', '在售', '下架', '1', '0', 1, 0];
      const statusLower = String(status).toLowerCase();
      if (!validStatuses.some(s => String(s).toLowerCase() === statusLower)) {
        warnings.push({
          file: fileName,
          type: 'unknown_status',
          message: `SKU [${sku || '未知'}] 的状态 [${status}] 不标准，建议使用 active/inactive 或 启用/停用`,
          index,
          severity: 'low'
        });
      }
    }
    
    cleaned.products.push(cleanedProduct);
  });
  
  return {
    data: cleaned,
    warnings,
    format: 'json',
    fileName,
    type: 'catalog',
    stats: {
      totalProducts: products.length,
      uniqueSkus: skuMap.size
    }
  };
}

/**
 * 验证和清洗审批备注数据
 */
function validateAndCleanApproval(data, warnings, fileName) {
  const cleaned = {
    approvals: [],
    notes: [],
    metadata: data.metadata || {}
  };
  
  let items = [];
  
  // 支持不同的审批备注结构
  if (data.approvals && Array.isArray(data.approvals)) {
    items = data.approvals;
  } else if (data.notes && Array.isArray(data.notes)) {
    items = data.notes;
  } else if (data.comments && Array.isArray(data.comments)) {
    items = data.comments;
  } else if (Array.isArray(data)) {
    items = data;
  } else {
    warnings.push({
      file: fileName,
      type: 'structure_warning',
      message: '审批备注结构不标准，未找到 approvals/notes/comments 数组或根数组',
      severity: 'high'
    });
  }
  
  items.forEach((item, index) => {
    const cleanedItem = {
      ...item,
      _sourceIndex: index
    };
    
    // 标准化字段名
    if (item.approver) cleanedItem.审批人 = cleanedItem.审批人 || item.approver;
    if (item.date) cleanedItem.日期 = cleanedItem.日期 || item.date;
    if (item.time) cleanedItem.时间 = cleanedItem.时间 || item.time;
    if (item.content) cleanedItem.内容 = cleanedItem.内容 || item.content;
    if (item.comment) cleanedItem.内容 = cleanedItem.内容 || item.comment;
    if (item.decision) cleanedItem.决策 = cleanedItem.决策 || item.decision;
    if (item.discount) cleanedItem.折扣 = cleanedItem.折扣 || item.discount;
    if (item.price_adjustment) cleanedItem.价格调整 = cleanedItem.价格调整 || item.price_adjustment;
    
    // 检查日期格式
    const date = cleanedItem.日期 || item.date;
    if (date && !isValidDateFormat(date)) {
      warnings.push({
        file: fileName,
        type: 'date_format_warning',
        message: `第 ${index} 条审批的日期格式 [${date}] 不标准，建议使用 YYYY-MM-DD`,
        index,
        severity: 'low',
        field: '日期',
        value: date
      });
    }
    
    // 检查是否包含价格/折扣相关关键词
    const content = String(cleanedItem.内容 || item.content || item.comment || '');
    const discountKeywords = ['折扣', '降价', '优惠', '减价', '便宜', 'discount', 'price cut', '优惠价'];
    const hasDiscountKeyword = discountKeywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()));
    
    if (hasDiscountKeyword) {
      cleanedItem._hasDiscountKeyword = true;
      
      // 尝试提取折扣金额或比例
      const amountMatch = content.match(/(\d+\.?\d*)\s*(%|折|元|￥|\$)/);
      if (amountMatch) {
        cleanedItem._extractedDiscount = {
          value: parseFloat(amountMatch[1]),
          unit: amountMatch[2]
        };
      }
    }
    
    cleaned.approvals.push(cleanedItem);
  });
  
  return {
    data: cleaned,
    warnings,
    format: 'json',
    fileName,
    type: 'approval',
    stats: {
      totalApprovals: items.length
    }
  };
}

/**
 * 检查日期格式是否有效
 */
function isValidDateFormat(dateStr) {
  // 支持的格式: YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
  const patterns = [
    /^\d{4}-\d{1,2}-\d{1,2}$/,
    /^\d{4}\/\d{1,2}\/\d{1,2}$/,
    /^\d{4}年\d{1,2}月\d{1,2}日$/
  ];
  return patterns.some(p => p.test(dateStr));
}

/**
 * 估算JSON解析错误的行号
 */
function estimateLineNumber(content, parseError) {
  // 简单的错误位置估算
  const match = parseError.message.match(/position (\d+)/);
  if (match) {
    const position = parseInt(match[1]);
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }
  return null;
}

module.exports = { readJson };
