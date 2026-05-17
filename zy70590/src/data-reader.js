const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DataReader {
  constructor(options = {}) {
    this.encoding = options.encoding || 'utf8';
    this.delimiter = options.delimiter || ',';
  }

  async readFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return this.readCSV(filePath);
    } else if (ext === '.json') {
      return this.readJSON(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}，仅支持 .csv 和 .json`);
    }
  }

  async readDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    const results = [];

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isFile()) {
        try {
          const data = await this.readFile(fullPath);
          results.push({
            file,
            filePath: fullPath,
            ...data
          });
        } catch (e) {
          results.push({
            file,
            filePath: fullPath,
            success: false,
            error: e.message,
            rows: []
          });
        }
      }
    }

    return results;
  }

  async readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const rows = [];
      const errors = [];
      let headers = [];

      fs.createReadStream(filePath, { encoding: this.encoding })
        .pipe(csv({ separator: this.delimiter }))
        .on('headers', (headerList) => {
          headers = headerList;
        })
        .on('data', (data) => {
          rows.push(data);
        })
        .on('error', (error) => {
          reject({
            success: false,
            error: error.message,
            rows: [],
            headers: []
          });
        })
        .on('end', () => {
          resolve({
            success: true,
            format: 'csv',
            filePath,
            headers,
            rows,
            rowCount: rows.length,
            errors
          });
        });
    });
  }

  async readJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, this.encoding);
      const data = JSON.parse(content);
      
      let rows = [];
      let headers = [];

      if (Array.isArray(data)) {
        rows = data;
        if (rows.length > 0 && typeof rows[0] === 'object') {
          headers = Object.keys(rows[0]);
        }
      } else if (typeof data === 'object') {
        if (data.rows && Array.isArray(data.rows)) {
          rows = data.rows;
          headers = data.headers || (rows.length > 0 ? Object.keys(rows[0]) : []);
        } else {
          rows = [data];
          headers = Object.keys(data);
        }
      } else {
        throw new Error('JSON格式不支持，需要是数组或包含rows字段的对象');
      }

      return {
        success: true,
        format: 'json',
        filePath,
        headers,
        rows,
        rowCount: rows.length,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        format: 'json',
        filePath,
        error: error.message,
        rows: [],
        headers: []
      };
    }
  }

  getInputType(inputPath) {
    if (!fs.existsSync(inputPath)) {
      return 'not_exists';
    }
    
    const stat = fs.statSync(inputPath);
    if (stat.isDirectory()) {
      return 'directory';
    } else if (stat.isFile()) {
      return 'file';
    }
    return 'unknown';
  }

  async readInput(inputPath) {
    const inputType = this.getInputType(inputPath);
    
    if (inputType === 'not_exists') {
      throw new Error(`路径不存在: ${inputPath}`);
    }

    if (inputType === 'directory') {
      return {
        type: 'directory',
        path: inputPath,
        files: await this.readDirectory(inputPath)
      };
    }

    const fileData = await this.readFile(inputPath);
    return {
      type: 'file',
      path: inputPath,
      ...fileData
    };
  }
}

module.exports = DataReader;