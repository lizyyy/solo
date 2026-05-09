const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`读取 JSON 文件失败: ${filePath}, 原因: ${error.message}`);
  }
}

function writeJSON(filePath, data, indent = 2) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, indent), 'utf8');
}

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`文件不存在: ${filePath}`));
    }
    fs.createReadStream(filePath, 'utf8')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(new Error(`读取 CSV 失败: ${error.message}`)));
  });
}

async function readExcel(filePath, sheetIndex = 0) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[sheetIndex];
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const header = worksheet.getRow(1).getCell(colNumber).value?.toString() || `col_${colNumber}`;
      obj[header] = cell.value;
    });
    rows.push(obj);
  });
  return rows;
}

function getFileInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const stats = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    size: stats.size,
    lastModified: stats.mtime.toISOString()
  };
}

function appendJSONLine(filePath, data) {
  ensureDir(path.dirname(filePath));
  const line = JSON.stringify(data) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
}

module.exports = {
  ensureDir,
  readJSON,
  writeJSON,
  readCSV,
  readExcel,
  getFileInfo,
  appendJSONLine
};
