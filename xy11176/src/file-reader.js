const fs = require('fs');
const csv = require('csv-parser');

class FileReader {
  static async readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];

      fs.createReadStream(filePath, 'utf-8')
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', () => resolve(records))
        .on('error', (error) => reject(error));
    });
  }

  static async readJSON(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  static async readFile(filePath) {
    if (filePath.endsWith('.csv')) {
      return this.readCSV(filePath);
    } else if (filePath.endsWith('.json')) {
      return this.readJSON(filePath);
    }
    throw new Error('不支持的文件格式，请使用CSV或JSON');
  }
}

module.exports = FileReader;
