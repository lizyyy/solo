const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const REQUIRED_FIELDS = ['recordId', 'shootTime', 'location', 'diseaseType', 'severity'];

function generateRowHash(row) {
  const shootTime = row.shootTime || '';
  const location = row.location || '';
  const diseaseType = row.diseaseType || '';
  return (shootTime + '_' + location + '_' + diseaseType).replace(/\s/g, '');
}

function validateRow(row, rowIndex, seenHashes) {
  const errors = [];
  
  const missingFields = REQUIRED_FIELDS.filter(field => !row[field] || String(row[field]).trim() === '');
  
  if (missingFields.length > 0) {
    if (missingFields.includes('location')) {
      errors.push({ type: '位置缺失', message: '缺失字段: ' + missingFields.join(', ') });
    } else {
      errors.push({ type: '字段缺失', message: '缺失字段: ' + missingFields.join(', ') });
    }
  }
  
  if (row.location && String(row.location).trim() !== '') {
    const hash = generateRowHash(row);
    if (seenHashes.has(hash)) {
      errors.push({ type: '重复拍摄', message: '重复记录: 相同时间-位置-病害类型组合重复' });
    }
    seenHashes.add(hash);
  }
  
  if (row.severity) {
    const severity = parseInt(row.severity);
    if (isNaN(severity) || severity < 1 || severity > 5) {
      errors.push({ type: '数据异常', message: '严重程度应为1-5之间的整数' });
    }
  }
  
  return errors;
}

async function processFile(filePath, seenHashes) {
  const results = {
    valid: [],
    invalid: [],
    stats: { total: 0, valid: 0, invalid: 0, duplicates: 0, missingLocation: 0 }
  };

  return new Promise((resolve, reject) => {
    const fileResults = { valid: [], invalid: [] };
    let rowIndex = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        const missingHeaders = REQUIRED_FIELDS.filter(f => !headers.includes(f));
        if (missingHeaders.length > 0) {
          results.invalid.push({
            fileName: path.basename(filePath),
            rowIndex: 'N/A',
            rowData: JSON.stringify(headers),
            errorType: '文件格式错误',
            errorMessage: '缺少必需列: ' + missingHeaders.join(', ')
          });
        }
      })
      .on('data', (row) => {
        rowIndex++;
        results.stats.total++;
        
        const errors = validateRow(row, rowIndex, seenHashes);
        
        if (errors.length > 0) {
          errors.forEach(error => {
            results.invalid.push({
              fileName: path.basename(filePath),
              rowIndex,
              rowData: JSON.stringify(row),
              errorType: error.type,
              errorMessage: error.message
            });
            results.stats.invalid++;
            
            if (error.type === '重复拍摄') results.stats.duplicates++;
            if (error.type === '位置缺失') results.stats.missingLocation++;
          });
        } else {
          results.valid.push({
            fileName: path.basename(filePath),
            ...row
          });
          results.stats.valid++;
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        results.invalid.push({
          fileName: path.basename(filePath),
          rowIndex: 'N/A',
          rowData: '',
          errorType: '文件读取错误',
          errorMessage: error.message
        });
        resolve(results);
      });
  });
}

async function processDirectory(inputDir, outputDir, isPreview = false) {
  const seenHashes = new Set();
  const hashFile = path.join(outputDir, '.processed-hashes.json');
  
  if (await fs.existsSync(hashFile)) {
    const existingHashes = await fs.readJson(hashFile);
    existingHashes.forEach(h => seenHashes.add(h));
  }
  
  await fs.ensureDir(outputDir);
  
  const files = await fs.readdir(inputDir);
  const csvFiles = files.filter(f => f.endsWith('.csv'));
  
  if (csvFiles.length === 0) {
    return {
      valid: [],
      invalid: [{
        fileName: 'N/A',
        rowIndex: 'N/A',
        rowData: '',
        errorType: '空目录',
        errorMessage: '输入目录中没有找到CSV文件'
      }],
      stats: { total: 0, valid: 0, invalid: 1, duplicates: 0, missingLocation: 0, emptyDir: true }
    };
  }
  
  let allValid = [];
  let allInvalid = [];
  let allStats = { total: 0, valid: 0, invalid: 0, duplicates: 0, missingLocation: 0 };
  
  for (const file of csvFiles) {
    const filePath = path.join(inputDir, file);
    const result = await processFile(filePath, seenHashes);
    
    allValid = allValid.concat(result.valid);
    allInvalid = allInvalid.concat(result.invalid);
    allStats.total += result.stats.total;
    allStats.valid += result.stats.valid;
    allStats.invalid += result.stats.invalid;
    allStats.duplicates += result.stats.duplicates;
    allStats.missingLocation += result.stats.missingLocation;
  }
  
  if (!isPreview) {
    const validCsvWriter = createCsvWriter({
      path: path.join(outputDir, 'valid-records.csv'),
      header: [
        { id: 'fileName', title: '来源文件' },
        { id: 'recordId', title: '记录ID' },
        { id: 'shootTime', title: '拍摄时间' },
        { id: 'location', title: '位置' },
        { id: 'diseaseType', title: '病害类型' },
        { id: 'severity', title: '严重程度' },
        { id: 'notes', title: '备注' }
      ]
    });
    
    const invalidCsvWriter = createCsvWriter({
      path: path.join(outputDir, 'invalid-records.csv'),
      header: [
        { id: 'fileName', title: '来源文件' },
        { id: 'rowIndex', title: '行号' },
        { id: 'rowData', title: '行数据' },
        { id: 'errorType', title: '错误类型' },
        { id: 'errorMessage', title: '错误详情' }
      ]
    });
    
    await validCsvWriter.writeRecords(allValid);
    await invalidCsvWriter.writeRecords(allInvalid);
    
    await fs.writeJson(hashFile, Array.from(seenHashes));
    
    const report = {
      processedAt: new Date().toISOString(),
      inputDir,
      outputDir,
      stats: allStats,
      filesProcessed: csvFiles.length
    };
    await fs.writeJson(path.join(outputDir, 'report.json'), report);
  }
  
  return {
    valid: allValid,
    invalid: allInvalid,
    stats: allStats,
    filesProcessed: csvFiles.length
  };
}

async function readReport(outputDir) {
  const reportPath = path.join(outputDir, 'report.json');
  if (!await fs.exists(reportPath)) {
    return null;
  }
  return await fs.readJson(reportPath);
}

module.exports = {
  processDirectory,
  readReport,
  validateRow,
  generateRowHash
};
