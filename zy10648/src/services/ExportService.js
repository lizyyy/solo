const fs = require('fs');
const path = require('path');
const db = require('../database/memoryDB');

class ExportService {
  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportBorrowRecords(format = 'json', filters = {}) {
    const records = db.getAllBorrowRecords(filters);
    const data = records.map(r => ({
      ...r.toJSON(),
      asset: db.getAsset(r.assetId)?.toJSON(),
      user: db.getUser(r.userId)?.toJSON(),
      reminders: db.getRemindersByBorrowId(r.id).map(rem => rem.toJSON())
    }));

    let filePath;
    let contentType;

    switch (format.toLowerCase()) {
      case 'csv':
        filePath = await this.exportToCSV(data, 'borrow_records');
        contentType = 'text/csv';
        break;
      case 'json':
      default:
        filePath = await this.exportToJSON(data, 'borrow_records');
        contentType = 'application/json';
    }

    return {
      success: true,
      data: {
        filePath,
        fileName: path.basename(filePath),
        contentType,
        recordCount: data.length
      }
    };
  }

  async exportReminderHistory(format = 'json') {
    const reminders = db.getAllReminderRecords();
    const data = reminders.map(r => {
      const borrow = db.getBorrowRecord(r.borrowRecordId);
      return {
        ...r.toJSON(),
        borrowRecord: borrow?.toJSON(),
        asset: borrow ? db.getAsset(borrow.assetId)?.toJSON() : null
      };
    });

    let filePath;
    let contentType;

    switch (format.toLowerCase()) {
      case 'csv':
        filePath = await this.exportToCSV(data, 'reminder_history');
        contentType = 'text/csv';
        break;
      case 'json':
      default:
        filePath = await this.exportToJSON(data, 'reminder_history');
        contentType = 'application/json';
    }

    return {
      success: true,
      data: {
        filePath,
        fileName: path.basename(filePath),
        contentType,
        recordCount: data.length
      }
    };
  }

  async exportToJSON(data, prefix) {
    const fileName = `${prefix}_${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = path.join(this.exportDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  async exportToCSV(data, prefix) {
    const fileName = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    const filePath = path.join(this.exportDir, fileName);
    
    if (data.length === 0) {
      fs.writeFileSync(filePath, '', 'utf8');
      return filePath;
    }

    const flattenObject = (obj, prefix = '') => {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, flattenObject(value, newKey));
        } else if (Array.isArray(value)) {
          result[newKey] = value.length;
        } else {
          result[newKey] = value;
        }
      }
      return result;
    };

    const flattenedData = data.map(item => flattenObject(item));
    const headers = Object.keys(flattenedData[0]);
    
    const csvContent = [
      headers.join(','),
      ...flattenedData.map(row => 
        headers.map(h => {
          const value = row[h];
          if (value === null || value === undefined) return '';
          const str = String(value);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      )
    ].join('\n');

    fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');
    return filePath;
  }

  async getExportFiles() {
    const files = fs.readdirSync(this.exportDir)
      .filter(f => f.endsWith('.json') || f.endsWith('.csv'))
      .map(f => {
        const stats = fs.statSync(path.join(this.exportDir, f));
        return {
          fileName: f,
          filePath: path.join(this.exportDir, f),
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return { success: true, data: files };
  }
}

module.exports = new ExportService();
