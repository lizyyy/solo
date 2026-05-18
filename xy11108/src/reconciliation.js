const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const REQUIRED_COLUMNS = [
  '材料编码',
  '材料名称',
  '采购数量',
  '采购单位',
  '单价',
  '金额',
  '供应商',
  '采购日期'
];

function detectEncoding(buffer) {
  const len = buffer.length;
  if (len >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return 'utf16le';
  }
  if (len >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return 'utf16be';
  }
  if (len >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf8';
  }
  return 'utf8';
}

function readFileWithEncoding(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, buffer) => {
      if (err) {
        reject(err);
        return;
      }
      const encoding = detectEncoding(buffer);
      let content = buffer.toString(encoding);
      content = content.replace(/^\uFEFF/, '');
      resolve(content);
    });
  });
}

function parseCsvContent(content) {
  return new Promise((resolve, reject) => {
    const results = [];
    const lines = content.split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
      resolve([]);
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',');
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ? values[idx].trim() : '';
      });
      results.push(row);
    }
    resolve(results);
  });
}

function validateColumns(headers) {
  const missing = [];
  const normalizedHeaders = headers.map(h => h.trim());
  REQUIRED_COLUMNS.forEach(col => {
    if (!normalizedHeaders.includes(col)) {
      missing.push(col);
    }
  });
  return missing;
}

function normalizeUnit(unit, quantity) {
  const unitLower = unit.toLowerCase().trim();
  const qty = parseFloat(quantity) || 0;
  
  if (unitLower === '斤' || unitLower === 'jin') {
    return { quantity: qty, unit: '斤' };
  }
  if (unitLower === '支' || unitLower === '枝' || unitLower === 'zhi') {
    return { quantity: qty, unit: '支' };
  }
  if (unitLower === '束' || unitLower === 'shu') {
    return { quantity: qty, unit: '束' };
  }
  if (unitLower === '盆' || unitLower === 'pen') {
    return { quantity: qty, unit: '盆' };
  }
  return { quantity: qty, unit: unit };
}

function generateRowKey(row) {
  const code = (row['材料编码'] || '').trim();
  const name = (row['材料名称'] || '').trim();
  const date = (row['采购日期'] || '').trim();
  const supplier = (row['供应商'] || '').trim();
  return `${code}-${name}-${date}-${supplier}`;
}

function isGiftRow(row) {
  const name = (row['材料名称'] || '').toLowerCase();
  const amount = parseFloat(row['金额']) || 0;
  return name.includes('赠品') || name.includes('赠送') || amount === 0;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateA = a['采购日期'] || '';
    const dateB = b['采购日期'] || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    
    const codeA = a['材料编码'] || '';
    const codeB = b['材料编码'] || '';
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    
    const nameA = a['材料名称'] || '';
    const nameB = b['材料名称'] || '';
    return nameA.localeCompare(nameB);
  });
}

async function processSingleFile(filePath) {
  const logs = [];
  const warnings = [];
  
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    logs.push(`读取文件失败: ${path.basename(filePath)} - ${err.message}`);
    return {
      success: false,
      data: [],
      logs,
      warnings,
      fileName: path.basename(filePath),
      error: err.message
    };
  }
  
  if (stats.size === 0) {
    logs.push(`文件为空: ${path.basename(filePath)}`);
    return {
      success: true,
      data: [],
      logs,
      warnings,
      fileName: path.basename(filePath)
    };
  }
  
  let content;
  try {
    content = await readFileWithEncoding(filePath);
  } catch (err) {
    logs.push(`读取文件失败: ${path.basename(filePath)} - ${err.message}`);
    return {
      success: false,
      data: [],
      logs,
      warnings,
      fileName: path.basename(filePath),
      error: err.message
    };
  }
  
  let rows;
  try {
    rows = await parseCsvContent(content);
  } catch (err) {
    logs.push(`解析CSV失败: ${path.basename(filePath)} - ${err.message}`);
    return {
      success: false,
      data: [],
      logs,
      warnings,
      fileName: path.basename(filePath),
      error: err.message
    };
  }
  
  if (rows.length === 0) {
    logs.push(`文件无数据行: ${path.basename(filePath)}`);
    return {
      success: true,
      data: [],
      logs,
      warnings,
      fileName: path.basename(filePath)
    };
  }
  
  const headers = Object.keys(rows[0]);
  const missingColumns = validateColumns(headers);
  if (missingColumns.length > 0) {
    warnings.push(`文件缺少列: ${path.basename(filePath)} - ${missingColumns.join(', ')}`);
  }
  
  const seenKeys = new Set();
  const duplicateRows = [];
  const processedRows = [];
  
  rows.forEach((row, index) => {
    const key = generateRowKey(row);
    
    if (isGiftRow(row)) {
      warnings.push(`发现赠品行: ${path.basename(filePath)} - 行 ${index + 2} - ${row['材料名称'] || '未知'}`);
    }
    
    if (seenKeys.has(key)) {
      duplicateRows.push(index + 2);
      warnings.push(`发现重复行: ${path.basename(filePath)} - 行 ${index + 2} - ${row['材料名称'] || '未知'}`);
      return;
    }
    seenKeys.add(key);
    
    const unit = row['采购单位'] || '';
    const quantity = row['采购数量'] || '0';
    const normalized = normalizeUnit(unit, quantity);
    row['采购数量'] = normalized.quantity.toString();
    row['采购单位'] = normalized.unit;
    
    if (unit !== normalized.unit) {
      warnings.push(`单位规范化: ${path.basename(filePath)} - 行 ${index + 2} - ${unit} -> ${normalized.unit}`);
    }
    
    processedRows.push(row);
  });
  
  logs.push(`处理完成: ${path.basename(filePath)} - ${processedRows.length} 条有效记录, ${duplicateRows.length} 条重复`);
  
  return {
    success: true,
    data: processedRows,
    logs,
    warnings,
    fileName: path.basename(filePath)
  };
}

async function processFiles(filePaths, outputDir) {
  const allResults = [];
  const allLogs = [];
  const allWarnings = [];
  const failedFiles = [];
  
  for (const filePath of filePaths) {
    const result = await processSingleFile(filePath);
    allLogs.push(...result.logs);
    allWarnings.push(...result.warnings);
    
    if (result.success) {
      allResults.push(...result.data.map(row => ({
        ...row,
        _sourceFile: result.fileName
      })));
    } else {
      failedFiles.push(result.fileName);
      allLogs.push(`继续处理剩余文件 - 失败文件: ${result.fileName}`);
    }
  }
  
  const sortedResults = sortRows(allResults);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'reconciliation_result.csv');
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: '材料编码', title: '材料编码' },
      { id: '材料名称', title: '材料名称' },
      { id: '采购数量', title: '采购数量' },
      { id: '采购单位', title: '采购单位' },
      { id: '单价', title: '单价' },
      { id: '金额', title: '金额' },
      { id: '供应商', title: '供应商' },
      { id: '采购日期', title: '采购日期' },
      { id: '_sourceFile', title: '来源文件' }
    ]
  });
  
  await csvWriter.writeRecords(sortedResults);
  
  const logPath = path.join(outputDir, 'processing_log.txt');
  const logContent = [
    '=== 处理日志 ===',
    ...allLogs,
    '',
    '=== 警告信息 ===',
    ...allWarnings,
    '',
    '=== 处理汇总 ===',
    `成功处理: ${filePaths.length - failedFiles.length} 个文件`,
    `失败文件: ${failedFiles.length} 个`,
    failedFiles.length > 0 ? `失败列表: ${failedFiles.join(', ')}` : '',
    `输出记录: ${sortedResults.length} 条`
  ].filter(Boolean).join('\n');
  
  fs.writeFileSync(logPath, logContent, 'utf8');
  
  return {
    outputPath,
    logPath,
    totalRecords: sortedResults.length,
    failedFiles,
    logs: allLogs,
    warnings: allWarnings
  };
}

module.exports = {
  REQUIRED_COLUMNS,
  detectEncoding,
  validateColumns,
  normalizeUnit,
  generateRowKey,
  isGiftRow,
  sortRows,
  processSingleFile,
  processFiles
};
