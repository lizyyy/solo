const fs = require('fs');
const path = require('path');

/**
 * 读取并解析Markdown合同文件
 * @param {string} filePath - Markdown文件路径
 * @returns {Promise<Object>} 包含解析后数据和警告的对象
 */
async function readMarkdown(filePath) {
  const warnings = [];
  const fileName = path.basename(filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const parsed = {
      metadata: {},
      sections: [],
      products: [],
      delivery: [],
      payment: [],
      rawContent: content,
      _lineMap: []
    };
    
    let currentSection = null;
    let inTable = false;
    let tableLines = [];
    let tableStartLine = 0;
    
    lines.forEach((line, lineIndex) => {
      const actualLineNum = lineIndex + 1;
      const trimmed = line.trim();
      
      // 记录行映射
      parsed._lineMap.push({
        lineNumber: actualLineNum,
        content: line,
        trimmed
      });
      
      // 识别标题
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // 如果之前有未处理的表格，先处理
        if (inTable && tableLines.length > 0) {
          const tableData = parseTable(tableLines, tableStartLine, warnings, fileName);
          if (tableData.length > 0) {
            classifyTableData(tableData, parsed, currentSection);
          }
          inTable = false;
          tableLines = [];
        }
        
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        
        currentSection = {
          level,
          title,
          content: [],
          lineNumber: actualLineNum
        };
        
        parsed.sections.push(currentSection);
        return;
      }
      
      // 识别表格
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableStartLine = actualLineNum;
        }
        tableLines.push({ line: trimmed, lineNumber: actualLineNum });
        return;
      }
      
      // 表格结束（遇到空行或非表格内容）
      if (inTable && (trimmed === '' || !trimmed.startsWith('|'))) {
        if (tableLines.length > 0) {
          const tableData = parseTable(tableLines, tableStartLine, warnings, fileName);
          if (tableData.length > 0) {
            classifyTableData(tableData, parsed, currentSection);
          }
        }
        inTable = false;
        tableLines = [];
      }
      
      // 收集段落内容
      if (currentSection && trimmed !== '' && !inTable) {
        currentSection.content.push({
          text: trimmed,
          lineNumber: actualLineNum
        });
        
        // 尝试从文本中提取关键信息
        extractFromText(trimmed, actualLineNum, parsed, warnings, fileName);
      }
    });
    
    // 处理文件末尾的表格
    if (inTable && tableLines.length > 0) {
      const tableData = parseTable(tableLines, tableStartLine, warnings, fileName);
      if (tableData.length > 0) {
        classifyTableData(tableData, parsed, currentSection);
      }
    }
    
    // 提取元数据
    extractMetadata(parsed, content, lines);
    
    return {
      data: parsed,
      warnings,
      format: 'markdown',
      fileName,
      stats: {
        totalSections: parsed.sections.length,
        totalProducts: parsed.products.length,
        totalDeliveries: parsed.delivery.length,
        totalPayments: parsed.payment.length
      }
    };
    
  } catch (error) {
    throw {
      file: fileName,
      error: error.message,
      type: 'read_error'
    };
  }
}

/**
 * 解析表格
 */
function parseTable(tableLines, startLine, warnings, fileName) {
  if (tableLines.length < 2) {
    // 至少需要表头和分隔行
    return [];
  }
  
  const rows = [];
  let headers = [];
  
  tableLines.forEach((item, index) => {
    const { line, lineNumber } = item;
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    
    // 第一行是表头
    if (index === 0) {
      headers = cells;
      return;
    }
    
    // 第二行如果是分隔符（包含 --- 或 ===），跳过
    if (index === 1 && cells.every(c => /^[-=:]+$/.test(c))) {
      return;
    }
    
    // 数据行
    const row = {};
    cells.forEach((cell, cellIndex) => {
      if (cellIndex < headers.length) {
        row[headers[cellIndex]] = cell;
      } else {
        row[`extra_${cellIndex}`] = cell;
        warnings.push({
          file: fileName,
          type: 'table_warning',
          message: `表格行 ${lineNumber} 的列数超过表头`,
          line: lineNumber,
          severity: 'low'
        });
      }
    });
    
    row._lineNumber = lineNumber;
    rows.push(row);
  });
  
  return rows;
}

/**
 * 分类表格数据
 */
function classifyTableData(rows, parsed, currentSection) {
  if (rows.length === 0) return;
  
  const firstRow = rows[0];
  const headerKeys = Object.keys(firstRow).filter(k => !k.startsWith('_'));
  
  // 判断表格类型
  const productKeywords = ['SKU', '产品', '商品', '名称', '型号', '规格', '数量', '单价', '价格', '金额'];
  const deliveryKeywords = ['交付', '交货', '批次', '日期', '时间', '地点'];
  const paymentKeywords = ['付款', '支付', '节点', '比例', '金额', '条件', '验收'];
  
  let productScore = 0;
  let deliveryScore = 0;
  let paymentScore = 0;
  
  headerKeys.forEach(key => {
    const lowerKey = key.toLowerCase();
    productKeywords.forEach(kw => {
      if (lowerKey.includes(kw.toLowerCase())) productScore++;
    });
    deliveryKeywords.forEach(kw => {
      if (lowerKey.includes(kw.toLowerCase())) deliveryScore++;
    });
    paymentKeywords.forEach(kw => {
      if (lowerKey.includes(kw.toLowerCase())) paymentScore++;
    });
  });
  
  // 还可以通过当前section标题判断
  if (currentSection) {
    const sectionTitle = currentSection.title.toLowerCase();
    if (sectionTitle.includes('产品') || sectionTitle.includes('清单') || sectionTitle.includes('报价')) {
      productScore += 5;
    }
    if (sectionTitle.includes('交付') || sectionTitle.includes('交货') || sectionTitle.includes('时间')) {
      deliveryScore += 5;
    }
    if (sectionTitle.includes('付款') || sectionTitle.includes('支付')) {
      paymentScore += 5;
    }
  }
  
  // 分类处理
  if (productScore >= deliveryScore && productScore >= paymentScore) {
    // 产品表格
    rows.forEach(row => {
      const product = normalizeProductRow(row);
      if (product.SKU || product.产品名称) {
        parsed.products.push(product);
      }
    });
  } else if (deliveryScore >= productScore && deliveryScore >= paymentScore) {
    // 交付表格
    rows.forEach(row => {
      const delivery = normalizeDeliveryRow(row);
      parsed.delivery.push(delivery);
    });
  } else if (paymentScore >= productScore && paymentScore >= deliveryScore) {
    // 付款表格
    rows.forEach(row => {
      const payment = normalizePaymentRow(row);
      parsed.payment.push(payment);
    });
  } else {
    // 默认按产品处理，但添加警告
    rows.forEach(row => {
      const product = normalizeProductRow(row);
      if (product.SKU || product.产品名称) {
        parsed.products.push(product);
      }
    });
  }
}

/**
 * 标准化产品行
 */
function normalizeProductRow(row) {
  const normalized = {
    _lineNumber: row._lineNumber,
    _raw: { ...row }
  };
  
  // 标准化字段名
  const fieldMappings = {
    'SKU': ['SKU', 'sku', '产品编码', '商品编码', '型号', '规格', '货号', '编号'],
    '产品名称': ['产品名称', '名称', '品名', '商品名称', '产品', '描述', 'Description'],
    '数量': ['数量', 'Qty', '数量', '个数', '台数', '套数', 'Amount'],
    '单价': ['单价', '价格', '单价', '单位价格', 'Unit Price'],
    '金额': ['金额', '总价', '小计', '合计', '金额', 'Total', 'Amount'],
    '折扣': ['折扣', '优惠', 'Discount', '折扣率'],
    '税率': ['税率', '税点', 'Tax', 'VAT'],
    '维保期限': ['维保期限', '保修期', '质保', '保修', '维护', 'Warranty'],
    '品牌': ['品牌', 'Brand', '厂商'],
    '单位': ['单位', 'Unit', '计量单位']
  };
  
  Object.keys(fieldMappings).forEach(targetField => {
    const possibleFields = fieldMappings[targetField];
    for (const possibleField of possibleFields) {
      if (row[possibleField] !== undefined) {
        normalized[targetField] = row[possibleField];
        break;
      }
      // 大小写不敏感匹配
      const lowerPossible = possibleField.toLowerCase();
      for (const key in row) {
        if (key.toLowerCase() === lowerPossible) {
          normalized[targetField] = row[key];
          break;
        }
      }
    }
  });
  
  // 清洗数字字段
  ['数量', '单价', '金额', '折扣', '税率'].forEach(field => {
    if (normalized[field]) {
      const cleaned = String(normalized[field]).replace(/[,￥$%元台套个]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        normalized[field + '_num'] = num;
      }
    }
  });
  
  return normalized;
}

/**
 * 标准化交付行
 */
function normalizeDeliveryRow(row) {
  const normalized = {
    _lineNumber: row._lineNumber,
    _raw: { ...row }
  };
  
  const fieldMappings = {
    '批次': ['批次', 'Batch', '交付批次', '批次号'],
    '交付日期': ['交付日期', '日期', '交货日期', '时间', 'Date', 'Delivery Date'],
    '交付内容': ['交付内容', '内容', '产品', '物品', 'Content'],
    '数量': ['数量', 'Qty', '数量'],
    '地点': ['地点', '地址', '交付地点', 'Location'],
    '备注': ['备注', '说明', 'Note', 'Remark']
  };
  
  Object.keys(fieldMappings).forEach(targetField => {
    const possibleFields = fieldMappings[targetField];
    for (const possibleField of possibleFields) {
      if (row[possibleField] !== undefined) {
        normalized[targetField] = row[possibleField];
        break;
      }
    }
  });
  
  return normalized;
}

/**
 * 标准化付款行
 */
function normalizePaymentRow(row) {
  const normalized = {
    _lineNumber: row._lineNumber,
    _raw: { ...row }
  };
  
  const fieldMappings = {
    '节点': ['节点', '阶段', 'Phase', '付款节点', 'Stage'],
    '比例': ['比例', '百分比', '%', '比例', 'Percentage'],
    '金额': ['金额', '款项', 'Amount', '金额'],
    '条件': ['条件', '触发条件', '付款条件', 'Condition', '验收条件'],
    '日期': ['日期', '付款日期', '预计日期', 'Date'],
    '备注': ['备注', '说明', 'Note', 'Remark']
  };
  
  Object.keys(fieldMappings).forEach(targetField => {
    const possibleFields = fieldMappings[targetField];
    for (const possibleField of possibleFields) {
      if (row[possibleField] !== undefined) {
        normalized[targetField] = row[possibleField];
        break;
      }
    }
  });
  
  // 清洗比例和金额
  if (normalized.比例) {
    const cleaned = String(normalized.比例).replace(/[%]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      normalized.比例_num = num;
      if (String(normalized.比例).includes('%')) {
        normalized.比例_decimal = num / 100;
      } else {
        normalized.比例_decimal = num;
      }
    }
  }
  
  return normalized;
}

/**
 * 从文本中提取关键信息
 */
function extractFromText(text, lineNumber, parsed, warnings, fileName) {
  // 提取日期
  const datePatterns = [
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日号]?/,
    /(\d{1,2})[-/月](\d{1,2})[日号]?/
  ];
  
  // 提取金额
  const amountPattern = /[￥$]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*[元万]?/g;
  
  // 提取比例
  const percentPattern = /(\d+\.?\d*)\s*%/g;
  
  // 检查是否包含SKU格式（通常是字母数字组合）
  const skuPattern = /\b([A-Z]{2,}[-_]?\d{3,})\b/;
  const skuMatch = text.match(skuPattern);
  if (skuMatch && !parsed.products.some(p => p.SKU === skuMatch[1])) {
    // 可能是一个SKU，但需要更多上下文
    warnings.push({
      file: fileName,
      type: 'possible_sku',
      message: `在行 ${lineNumber} 中发现疑似SKU: ${skuMatch[1]}，请确认是否遗漏`,
      line: lineNumber,
      severity: 'low'
    });
  }
}

/**
 * 提取元数据
 */
function extractMetadata(parsed, content, lines) {
  // 尝试从文档开头提取元数据
  // 客户信息
  const customerPatterns = [
    /客户[：:]\s*(.+)/i,
    /甲方[：:]\s*(.+)/i,
    /需方[：:]\s*(.+)/i,
    /买方[：:]\s*(.+)/i
  ];
  
  for (const pattern of customerPatterns) {
    const match = content.match(pattern);
    if (match) {
      parsed.metadata.客户 = match[1].trim();
      break;
    }
  }
  
  // 合同编号
  const contractNoPattern = /合同编号[：:]\s*(.+)/i;
  const contractMatch = content.match(contractNoPattern);
  if (contractMatch) {
    parsed.metadata.合同编号 = contractMatch[1].trim();
  }
  
  // 签署日期
  const signDatePattern = /签署日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?)/i;
  const signMatch = content.match(signDatePattern);
  if (signMatch) {
    parsed.metadata.签署日期 = signMatch[1].trim();
  }
  
  // 总金额
  const totalPattern = /总金额[：:]\s*[￥$]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*[元万]?/i;
  const totalMatch = content.match(totalPattern);
  if (totalMatch) {
    parsed.metadata.总金额 = totalMatch[1].trim();
    const cleaned = totalMatch[1].replace(/,/g, '');
    parsed.metadata.总金额_num = parseFloat(cleaned);
  }
}

module.exports = { readMarkdown };
