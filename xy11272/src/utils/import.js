const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class ImportService {
  constructor() {
    this.importDir = path.join(__dirname, '../../data');
  }

  async importFromCsv(filePath) {
    const results = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          resolve({
            success: true,
            data: results,
            count: results.length
          });
        })
        .on('error', (err) => {
          reject({
            success: false,
            error: err.message
          });
        });
    });
  }

  importFromJson(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return {
        success: true,
        data,
        count: Array.isArray(data) ? data.length : 1
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = ImportService;
