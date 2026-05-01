(function(global) {
  'use strict';

  const { Item, formatDate } = global.Models || {};
  const Storage = global.Storage;
  const Validation = global.Validation;

  // CSV处理工具类
  class CSVProcessor {
    constructor() {
      this.storage = Storage;
      this.validation = Validation;
    }

    // ===== 导出CSV =====

    exportBorrowRecords(records, filename = null) {
      if (!records || records.length === 0) {
        return { success: false, message: '没有可导出的数据' };
      }

      const headers = [
        '物料名称',
        '分类',
        '借出数量',
        '项目',
        '借用人',
        '借出时间',
        '预计归还',
        '实际归还',
        '状态',
        '备注'
      ];

      const rows = records.map(record => {
        const item = this.storage.getItemById(record.itemId);
        const category = item ? item.category : '';
        const status = record.currentStatus;
        const statusText = {
          'borrowed': '借出中',
          'overdue': '已逾期',
          'returned': '已归还'
        }[status] || status;

        return [
          this.escapeCSV(record.itemName),
          this.escapeCSV(category),
          record.quantity,
          this.escapeCSV(record.project),
          this.escapeCSV(record.person),
          formatDate(record.borrowedAt, 'long'),
          formatDate(record.expectedReturnAt),
          record.returnedAt ? formatDate(record.returnedAt, 'long') : '',
          statusText,
          this.escapeCSV(record.notes || '')
        ];
      });

      const csvContent = this.buildCSV(headers, rows);
      const downloadFilename = filename || `借还记录_${this.getDateString()}.csv`;
      
      return {
        success: true,
        csvContent,
        filename: downloadFilename
      };
    }

    exportAllBorrowRecords(filename = null) {
      const records = this.storage.getBorrowRecords();
      return this.exportBorrowRecords(records, filename);
    }

    exportActiveBorrowRecords(filename = null) {
      const records = this.storage.getActiveBorrowRecords();
      return this.exportBorrowRecords(records, filename);
    }

    exportItems(items = null, filename = null) {
      const itemList = items || this.storage.getItems();
      
      if (itemList.length === 0) {
        return { success: false, message: '没有可导出的物料数据' };
      }

      const headers = [
        '物料名称',
        '分类',
        '总库存',
        '已借出',
        '可用数量',
        '状态',
        '描述'
      ];

      const rows = itemList.map(item => {
        const statusText = {
          'available': '正常',
          'low': '库存低',
          'unavailable': '无库存'
        }[item.status] || '正常';

        return [
          this.escapeCSV(item.name),
          this.escapeCSV(item.category || '未分类'),
          item.totalQuantity,
          item.borrowedQuantity,
          item.availableQuantity,
          statusText,
          this.escapeCSV(item.description || '')
        ];
      });

      const csvContent = this.buildCSV(headers, rows);
      const downloadFilename = filename || `物料清单_${this.getDateString()}.csv`;
      
      return {
        success: true,
        csvContent,
        filename: downloadFilename
      };
    }

    // ===== 导入CSV =====

    async importItemsFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          resolve({ success: false, message: '请选择文件' });
          return;
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
          resolve({ success: false, message: '请上传CSV格式的文件' });
          return;
        }

        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const content = e.target.result;
            const result = this.parseAndImportItems(content);
            resolve(result);
          } catch (error) {
            resolve({ 
              success: false, 
              message: '解析CSV文件失败: ' + error.message 
            });
          }
        };

        reader.onerror = () => {
          resolve({ success: false, message: '读取文件失败' });
        };

        reader.readAsText(file, 'UTF-8');
      });
    }

    parseAndImportItems(content) {
      const lines = content.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        return { success: false, message: 'CSV文件格式错误，至少需要包含表头和一行数据' };
      }

      const headers = this.parseCSVLine(lines[0]);
      const headerMap = this.mapHeaders(headers);

      if (!headerMap.name) {
        return { success: false, message: 'CSV文件必须包含"物料名称"列' };
      }

      const errors = [];
      const warnings = [];
      const imported = [];
      const skipped = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = this.parseCSVLine(line);
        const rowData = this.mapRowData(values, headerMap);

        const validation = this.validation.validateCSVRow(rowData, i);
        
        if (validation.warnings.length > 0) {
          warnings.push(...validation.warnings);
        }

        if (!validation.valid) {
          errors.push(...validation.errors);
          skipped.push({ row: i + 1, reason: validation.errors.join('；') });
          continue;
        }

        const existingItem = this.storage.getItems().find(
          item => item.name.toLowerCase() === validation.data.name.toLowerCase()
        );

        if (existingItem) {
          warnings.push(`第 ${i + 1} 行：物料 "${validation.data.name}" 已存在，跳过`);
          skipped.push({ row: i + 1, reason: `物料 "${validation.data.name}" 已存在` });
          continue;
        }

        const newItem = new Item({
          name: validation.data.name,
          category: validation.data.category,
          totalQuantity: validation.data.totalQuantity,
          description: validation.data.description
        });

        this.storage.saveItem(newItem);
        imported.push(newItem);
      }

      const message = [];
      if (imported.length > 0) {
        message.push(`成功导入 ${imported.length} 个物料`);
      }
      if (skipped.length > 0) {
        message.push(`跳过 ${skipped.length} 条记录`);
      }
      if (warnings.length > 0) {
        message.push(`警告: ${warnings.length} 条`);
      }

      return {
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        warnings: warnings.length,
        errors: errors,
        message: message.join('，'),
        items: imported
      };
    }

    // ===== 辅助方法 =====

    parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
          if (char === '"' && nextChar === '"') {
            current += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            current += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
      }
      
      result.push(current.trim());
      return result;
    }

    mapHeaders(headers) {
      const map = {};
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase().trim();
        
        if (header.includes('名称') || header === 'name' || header === '物料名称') {
          map.name = i;
        } else if (header.includes('分类') || header === 'category') {
          map.category = i;
        } else if (header.includes('数量') || header.includes('库存') || header === 'quantity' || header === 'total') {
          map.quantity = i;
        } else if (header.includes('描述') || header.includes('说明') || header === 'description' || header === 'desc') {
          map.description = i;
        }
      }
      
      return map;
    }

    mapRowData(values, headerMap) {
      return {
        name: headerMap.name !== undefined ? values[headerMap.name] : '',
        category: headerMap.category !== undefined ? values[headerMap.category] : '',
        quantity: headerMap.quantity !== undefined ? values[headerMap.quantity] : '',
        description: headerMap.description !== undefined ? values[headerMap.description] : ''
      };
    }

    buildCSV(headers, rows) {
      const allRows = [headers, ...rows];
      const lines = allRows.map(row => 
        row.map(cell => this.escapeCSV(String(cell))).join(',')
      );
      return '\uFEFF' + lines.join('\n');
    }

    escapeCSV(value) {
      if (value === null || value === undefined) {
        return '';
      }
      
      const str = String(value);
      
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      
      return str;
    }

    getDateString() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    }

    // ===== 下载CSV =====

    downloadCSV(csvContent, filename) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    }
  }

  // 创建单例
  const CSV = new CSVProcessor();

  // 导出到全局
  global.CSV = CSV;
  global.CSVProcessor = CSVProcessor;

})(window);
