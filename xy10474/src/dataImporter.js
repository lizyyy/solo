const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DataImporter {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  import(type, filePath) {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(absolutePath).toLowerCase();
    
    if (ext === '.json') {
      return this.importJson(type, absolutePath);
    } else if (ext === '.csv') {
      return this.importCsv(type, absolutePath);
    } else {
      throw new Error('不支持的文件格式，请使用 CSV 或 JSON 格式');
    }
  }

  importJson(type, filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    const records = Array.isArray(data) ? data : [data];
    
    return this.saveRecords(type, records);
  }

  importCsv(type, filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          records.push(this.normalizeRecord(type, row));
        })
        .on('end', () => {
          try {
            const result = this.saveRecords(type, records);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  normalizeRecord(type, record) {
    const normalized = { ...record };
    
    if (normalized.amount !== undefined) {
      normalized.amount = parseFloat(normalized.amount) || 0;
    }
    
    if (normalized.cashAmount !== undefined) {
      normalized.cashAmount = parseFloat(normalized.cashAmount) || 0;
    }
    
    if (normalized.initialAmount !== undefined) {
      normalized.initialAmount = parseFloat(normalized.initialAmount) || 0;
    }
    
    if (normalized.finalAmount !== undefined) {
      normalized.finalAmount = parseFloat(normalized.finalAmount) || 0;
    }
    
    if (normalized.amountHandedOver !== undefined) {
      normalized.amountHandedOver = parseFloat(normalized.amountHandedOver) || 0;
    }
    
    return normalized;
  }

  saveRecords(type, records) {
    const typeMap = {
      transactions: 'transactions.json',
      refunds: 'refunds.json',
      'petty-cash': 'pettyCash.json',
      handover: 'handover.json'
    };

    const fileName = typeMap[type];
    if (!fileName) {
      throw new Error(`不支持的数据类型: ${type}`);
    }

    const filePath = path.join(this.dataDir, fileName);
    
    let existingRecords = [];
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      existingRecords = JSON.parse(content);
    }

    const newRecords = this.mergeRecords(existingRecords, records, type);
    
    fs.writeFileSync(filePath, JSON.stringify(newRecords, null, 2), 'utf8');
    
    return {
      type,
      count: records.length,
      total: newRecords.length
    };
  }

  mergeRecords(existing, newRecords, type) {
    const getKey = (record, recordType) => {
      switch (recordType) {
        case 'transactions':
          return `${record.storeId}-${record.transactionId}`;
        case 'refunds':
          return `${record.storeId}-${record.refundId}`;
        case 'petty-cash':
          return `${record.storeId}-${record.recordId}`;
        case 'handover':
          return `${record.storeId}-${record.handoverId}`;
        default:
          return JSON.stringify(record);
      }
    };

    const map = new Map();
    
    existing.forEach(record => {
      map.set(getKey(record, type), record);
    });

    newRecords.forEach(record => {
      map.set(getKey(record, type), record);
    });

    return Array.from(map.values());
  }

  load(type) {
    const typeMap = {
      transactions: 'transactions.json',
      refunds: 'refunds.json',
      'petty-cash': 'pettyCash.json',
      handover: 'handover.json'
    };

    const fileName = typeMap[type];
    const filePath = path.join(this.dataDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }
}

module.exports = DataImporter;
