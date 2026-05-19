const fs = require('fs');
const path = require('path');
const storage = require('./storage');

class Exporter {
  exportAll(outputPath) {
    const data = storage.getAllData();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: outputPath, data };
  }

  exportApplications(outputPath) {
    const data = storage.getApplications();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: outputPath, data };
  }

  exportInventory(outputPath) {
    const data = storage.getInventory();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: outputPath, data };
  }

  exportErrors(outputPath) {
    const data = storage.getErrorRecords();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: outputPath, data };
  }

  exportReviewResults(outputPath) {
    const data = storage.getReviewResults();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: outputPath, data };
  }

  exportImportHistory(outputPath) {
    const data = storage.getImportHistory();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: outputPath, data };
  }

  exportToCSV(data, outputPath, fields) {
    const headers = fields.join(',');
    const rows = data.map(item => 
      fields.map(field => {
        const value = item[field] !== undefined ? item[field] : '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    );
    
    const csvContent = [headers, ...rows].join('\n');
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    return { success: true, filePath: outputPath };
  }
}

module.exports = new Exporter();
