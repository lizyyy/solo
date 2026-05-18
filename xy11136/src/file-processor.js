const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { desensitizeRow, detectFieldMapping } = require('./desensitize');

const EXIT_CODES = {
  SUCCESS: 0,
  PARTIAL_SUCCESS: 1,
  ALL_FAILED: 2
};

function validateCsvHeaders(headers) {
  const requiredFields = ['来访者姓名', '姓名', '学生姓名', '预约人', '来访人'];
  const hasNameField = headers.some(h => 
    requiredFields.some(rf => h.toLowerCase().includes(rf.toLowerCase()))
  );
  return hasNameField;
}

function checkDuplicateRows(rows, keyField) {
  const seen = new Set();
  const duplicates = [];
  rows.forEach((row, index) => {
    const key = keyField ? row[keyField] : JSON.stringify(row);
    if (seen.has(key)) {
      duplicates.push(index);
    } else {
      seen.add(key);
    }
  });
  return duplicates;
}

async function processSingleFile(inputPath, outputPath, options = {}) {
  const result = {
    inputPath,
    outputPath,
    success: false,
    error: null,
    totalRows: 0,
    processedRows: 0,
    skippedRows: 0,
    duplicateRows: 0,
    hasMinor: false,
    hasFreeText: false,
    hasRepeatable: false,
    missingColumns: [],
    headers: []
  };

  try {
    if (!fs.existsSync(inputPath)) {
      result.error = '文件不存在';
      return result;
    }

    const stats = fs.statSync(inputPath);
    if (stats.size === 0) {
      result.error = '空文件';
      result.totalRows = 0;
      return result;
    }

    const rows = [];
    let headers = null;

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(inputPath, 'utf8')
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim()
        }));

      stream.on('headers', (headerList) => {
        headers = headerList;
        result.headers = headers;
        
        if (!validateCsvHeaders(headers)) {
          result.missingColumns.push('未找到姓名字段');
        }
      });

      stream.on('data', (data) => {
        rows.push(data);
      });

      stream.on('end', resolve);
      stream.on('error', reject);
    });

    result.totalRows = rows.length;

    if (rows.length === 0) {
      result.error = '文件无数据行';
      return result;
    }

    const fieldMapping = detectFieldMapping(headers);
    
    const duplicateIndices = checkDuplicateRows(rows, fieldMapping.appointmentTime || headers[0]);
    result.duplicateRows = duplicateIndices.length;

    const processedRows = [];
    rows.forEach((row, index) => {
      try {
        if (duplicateIndices.includes(index) && !options.keepDuplicates) {
          result.skippedRows++;
          return;
        }

        const { row: desensitizedRow, flags } = desensitizeRow(row, fieldMapping);
        processedRows.push(desensitizedRow);
        result.processedRows++;
        
        if (flags.hasMinor) result.hasMinor = true;
        if (flags.hasFreeText) result.hasFreeText = true;
        if (flags.hasRepeatable) result.hasRepeatable = true;
      } catch (e) {
        result.skippedRows++;
      }
    });

    if (processedRows.length === 0) {
      result.error = '无有效数据行可处理';
      return result;
    }

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: headers.map(h => ({ id: h, title: h }))
    });

    await csvWriter.writeRecords(processedRows);
    result.success = true;

  } catch (error) {
    result.error = error.message || '处理失败';
  }

  return result;
}

async function processFiles(inputFiles, outputDir, options = {}) {
  const results = [];
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const inputFile of inputFiles) {
    const fileName = path.basename(inputFile);
    const outputFileName = `desensitized_${fileName}`;
    const outputPath = path.join(outputDir, outputFileName);
    
    const fileResult = await processSingleFile(inputFile, outputPath, options);
    results.push(fileResult);
  }

  return results;
}

function calculateExitCode(results) {
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (successCount === 0) return EXIT_CODES.ALL_FAILED;
  if (successCount < totalCount) return EXIT_CODES.PARTIAL_SUCCESS;
  
  const hasPartialSuccess = results.some(r => 
    r.success && (r.hasMinor || r.hasFreeText || r.hasRepeatable || r.skippedRows > 0)
  );
  
  if (hasPartialSuccess) return EXIT_CODES.PARTIAL_SUCCESS;
  return EXIT_CODES.SUCCESS;
}

function generateSummaryReport(results) {
  const totalFiles = results.length;
  const successfulFiles = results.filter(r => r.success).length;
  const failedFiles = results.filter(r => !r.success).length;
  const totalRows = results.reduce((sum, r) => sum + r.totalRows, 0);
  const processedRows = results.reduce((sum, r) => sum + r.processedRows, 0);
  const skippedRows = results.reduce((sum, r) => sum + r.skippedRows, 0);
  const duplicateRows = results.reduce((sum, r) => sum + r.duplicateRows, 0);
  
  const hasMinorData = results.some(r => r.hasMinor);
  const hasFreeText = results.some(r => r.hasFreeText);
  const hasRepeatable = results.some(r => r.hasRepeatable);

  return {
    totalFiles,
    successfulFiles,
    failedFiles,
    totalRows,
    processedRows,
    skippedRows,
    duplicateRows,
    hasMinorData,
    hasFreeText,
    hasRepeatable,
    exitCode: calculateExitCode(results)
  };
}

module.exports = {
  processSingleFile,
  processFiles,
  calculateExitCode,
  generateSummaryReport,
  EXIT_CODES,
  validateCsvHeaders,
  checkDuplicateRows
};