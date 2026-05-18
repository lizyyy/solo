const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');

class FileHandler {
  loadRules(rulesPath) {
    const content = fs.readFileSync(rulesPath, 'utf-8');
    return JSON.parse(content);
  }

  async loadQuoteFiles(inputDir) {
    const files = fs.readdirSync(inputDir);
    const oldFiles = files.filter(f => f.includes('old') || f.includes('旧') || f.includes('v1'));
    const newFiles = files.filter(f => f.includes('new') || f.includes('新') || f.includes('v2'));
    
    if (oldFiles.length === 0) {
      throw new Error(`未找到旧报价文件，文件名需包含 'old'、'旧' 或 'v1'`);
    }
    if (newFiles.length === 0) {
      throw new Error(`未找到新报价文件，文件名需包含 'new'、'新' 或 'v2'`);
    }
    
    const oldQuotes = await this.loadQuoteFile(path.join(inputDir, oldFiles[0]));
    const newQuotes = await this.loadQuoteFile(path.join(inputDir, newFiles[0]));
    
    return { oldQuotes, newQuotes };
  }

  async loadQuoteFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return this.loadCsvFile(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return this.loadExcelFile(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
  }

  loadCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  loadExcelFile(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
  }
}

module.exports = FileHandler;
