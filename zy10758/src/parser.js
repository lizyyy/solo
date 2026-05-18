const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const METRIC_TYPES = {
  BASE: '基础指标',
  DERIVED: '派生指标',
  FORMULA: '公式指标'
};

function parseMetricLine(line, lineNumber) {
  const errors = [];
  const warnings = [];
  
  if (!line || typeof line !== 'object') {
    return {
      data: null,
      errors: [`第${lineNumber}行: 无效的行格式`],
      warnings: []
    };
  }

  const metricId = line.指标ID || line.metric_id || line.id;
  const metricName = line.指标名称 || line.metric_name || line.name;
  const formula = line.计算公式 || line.formula || '';
  const alias = line.别名 || line.alias || '';
  const snapshot = line.历史快照 || line.snapshot || '';

  if (!metricId) {
    errors.push(`第${lineNumber}行: 缺少指标ID`);
  }
  if (!metricName) {
    errors.push(`第${lineNumber}行: 缺少指标名称`);
  }

  if (alias) {
    warnings.push(`第${lineNumber}行: 发现指标别名 "${alias}"，继续处理`);
  }
  if (snapshot) {
    warnings.push(`第${lineNumber}行: 发现历史快照配置 "${snapshot}"，继续处理`);
  }

  const formulaNestingLevel = calculateFormulaNesting(formula);
  if (formulaNestingLevel > 2) {
    warnings.push(`第${lineNumber}行: 公式嵌套层级过深 (${formulaNestingLevel}层)，继续处理`);
  }

  return {
    data: {
      metricId: String(metricId || ''),
      metricName: String(metricName || ''),
      type: detectMetricType(formula, line),
      formula: String(formula),
      alias: String(alias),
      snapshot: String(snapshot),
      formulaNestingLevel,
      dependencies: extractDependencies(formula),
      owner: line.负责人 || line.owner || '',
      department: line.所属部门 || line.department || '',
      businessDomain: line.业务域 || line.business_domain || '',
      lineNumber
    },
    errors,
    warnings
  };
}

function detectMetricType(formula, line) {
  if (line.类型 || line.type) {
    return line.类型 || line.type;
  }
  if (!formula || formula.trim() === '') {
    return METRIC_TYPES.BASE;
  }
  if (formula.includes('SUM') || formula.includes('COUNT') || formula.includes('AVG')) {
    return METRIC_TYPES.DERIVED;
  }
  return METRIC_TYPES.FORMULA;
}

function calculateFormulaNesting(formula) {
  if (!formula) return 0;
  let maxLevel = 0;
  let currentLevel = 0;
  for (const char of formula) {
    if (char === '(') {
      currentLevel++;
      maxLevel = Math.max(maxLevel, currentLevel);
    } else if (char === ')') {
      currentLevel--;
    }
  }
  return maxLevel;
}

function extractDependencies(formula) {
  if (!formula) return [];
  const matches = formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  return [...new Set(matches.filter(m => m.length > 2 && !['SUM', 'COUNT', 'AVG', 'MAX', 'MIN', 'IF', 'AND', 'OR'].includes(m.toUpperCase())))];
}

async function parseCSVFile(filePath) {
  const results = [];
  const allErrors = [];
  const allWarnings = [];

  return new Promise((resolve, reject) => {
    let lineNumber = 1;
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', () => {
        lineNumber = 2;
      })
      .on('data', (data) => {
        const parsed = parseMetricLine(data, lineNumber);
        if (parsed.data && parsed.data.metricId) {
          results.push(parsed.data);
        }
        allErrors.push(...parsed.errors);
        allWarnings.push(...parsed.warnings);
        lineNumber++;
      })
      .on('end', () => {
        resolve({
          fileName: path.basename(filePath),
          filePath,
          metrics: results,
          errors: allErrors,
          warnings: allWarnings,
          totalLines: lineNumber - 1
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

async function parseDirectory(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
  const results = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const result = await parseCSVFile(filePath);
      results.push(result);
    } catch (err) {
      results.push({
        fileName: file,
        filePath,
        metrics: [],
        errors: [`文件解析失败: ${err.message}`],
        warnings: [],
        totalLines: 0
      });
    }
  }

  return results;
}

module.exports = {
  parseMetricLine,
  parseCSVFile,
  parseDirectory,
  METRIC_TYPES,
  calculateFormulaNesting,
  extractDependencies
};
