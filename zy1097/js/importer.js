import { Warehouse } from './models.js';
import { DataValidator } from './validator.js';

export class DataImporter {
  static async importWarehouseFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const validation = DataValidator.validateWarehouse(data);
          
          if (!validation.valid) {
            reject({
              type: 'validation',
              errors: validation.errors,
              warnings: validation.warnings
            });
            return;
          }

          const warehouse = new Warehouse(data);
          resolve({
            warehouse,
            warnings: validation.warnings
          });
        } catch (err) {
          reject({
            type: 'parse',
            message: 'JSON 解析失败: ' + err.message
          });
        }
      };
      reader.onerror = () => {
        reject({
          type: 'file',
          message: '文件读取失败'
        });
      };
      reader.readAsText(file);
    });
  }

  static async importCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvData = e.target.result;
          const data = this.parseCSV(csvData);
          resolve(data);
        } catch (err) {
          reject({
            type: 'parse',
            message: 'CSV 解析失败: ' + err.message
          });
        }
      };
      reader.onerror = () => {
        reject({
          type: 'file',
          message: '文件读取失败'
        });
      };
      reader.readAsText(file);
    });
  }

  static async importExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          if (jsonData.length < 2) {
            reject({
              type: 'validation',
              message: 'Excel 文件数据不足'
            });
            return;
          }

          const headers = jsonData[0].map(h => String(h).trim());
          const rows = jsonData.slice(1);
          
          const result = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          });

          resolve(result);
        } catch (err) {
          reject({
            type: 'parse',
            message: 'Excel 解析失败: ' + err.message
          });
        }
      };
      reader.onerror = () => {
        reject({
          type: 'file',
          message: '文件读取失败'
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  static parseCSV(csvData) {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error('CSV 文件数据不足');
    }

    const headers = this.parseCSVLine(lines[0]);
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index] !== undefined ? values[index].trim() : '';
      });
      result.push(obj);
    }

    return result;
  }

  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  static getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
  }

  static async importFromFile(file, type) {
    const ext = this.getFileExtension(file.name);
    
    try {
      let data;
      
      if (type === 'warehouse') {
        if (ext !== 'json') {
          throw { type: 'validation', message: '仓库布局文件必须是 JSON 格式' };
        }
        return this.importWarehouseFromJSON(file);
      } else if (type === 'sku' || type === 'orders') {
        if (ext === 'csv') {
          data = await this.importCSV(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
          if (typeof XLSX === 'undefined') {
            throw { type: 'validation', message: '需要加载 XLSX 库才能解析 Excel 文件' };
          }
          data = await this.importExcel(file);
        } else {
          throw { type: 'validation', message: '不支持的文件格式: ' + ext };
        }

        if (type === 'sku') {
          const validation = DataValidator.validateSKUData(data);
          if (!validation.valid) {
            throw {
              type: 'validation',
              errors: validation.errors,
              warnings: validation.warnings
            };
          }
          return {
            skus: validation.validatedData,
            warnings: validation.warnings
          };
        } else {
          const validation = DataValidator.validateOrderData(data);
          if (!validation.valid) {
            throw {
              type: 'validation',
              errors: validation.errors,
              warnings: validation.warnings
            };
          }
          return {
            orders: validation.validatedData,
            warnings: validation.warnings
          };
        }
      }
    } catch (err) {
      throw err;
    }
  }

  static async fetchSampleData(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      if (url.endsWith('.json')) {
        return await response.json();
      } else if (url.endsWith('.csv')) {
        const text = await response.text();
        return this.parseCSV(text);
      }
    } catch (err) {
      throw err;
    }
  }
}
