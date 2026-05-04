import Papa from 'papaparse';
import DataService from './DataService';

class ImportService {
  parseCSV(csvContent) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV 解析错误: ${results.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(this.transformCSVData(results.data));
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  transformCSVData(csvData) {
    const records = [];
    const headers = Object.keys(csvData[0] || {}).map(h => h.toLowerCase());

    csvData.forEach((row, index) => {
      const rowLower = {};
      Object.keys(row).forEach(key => {
        rowLower[key.toLowerCase()] = row[key];
      });

      const record = {
        boxId: this.getValueFromRow(rowLower, ['boxid', '盒号', '底片盒', 'box', 'box_id']),
        frameNumber: this.getValueFromRow(rowLower, ['framenumber', '张号', 'frame', 'frame_number', '编号']),
        scanFile: this.getValueFromRow(rowLower, ['scanfile', '扫描文件', '文件', 'filename', 'file']),
        scanResolution: parseInt(this.getValueFromRow(rowLower, ['resolution', '分辨率', 'dpi'])) || 0,
        responsiblePerson: this.getValueFromRow(rowLower, ['responsible', '责任人', '负责人']),
        repairStatus: this.parseRepairStatus(this.getValueFromRow(rowLower, ['repairstatus', '修复状态', '状态'])),
        repairNotes: this.getValueFromRow(rowLower, ['repairnotes', '修复备注', '备注']),
        remarks: this.getValueFromRow(rowLower, ['remarks', '说明', '描述'])
      };

      if (record.boxId || record.frameNumber) {
        records.push(DataService.createRecord(record));
      }
    });

    return records;
  }

  getValueFromRow(row, possibleKeys) {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]).trim();
      }
    }
    return '';
  }

  parseRepairStatus(status) {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('已修复') || s.includes('完成') || s === 'repaired' || s === 'done') {
      return 'repaired';
    }
    if (s.includes('修复中') || s.includes('进行中') || s === 'in_progress') {
      return 'in_progress';
    }
    return 'not_repaired';
  }

  indexFiles(filesList, basePath = '') {
    const indexed = {};
    filesList.forEach(file => {
      const fileName = file.name || file;
      const lowerName = fileName.toLowerCase();
      const extension = lowerName.substring(lowerName.lastIndexOf('.'));
      
      const key = this.extractKeyFromFileName(fileName);
      if (key) {
        if (!indexed[key]) {
          indexed[key] = [];
        }
        indexed[key].push({
          name: fileName,
          path: file.path || `${basePath}/${fileName}`,
          extension: extension,
          size: file.size || 0
        });
      }
    });
    return indexed;
  }

  extractKeyFromFileName(fileName) {
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    
    const patterns = [
      /^([A-Za-z0-9]+)[_-]?(\d+)$/,
      /^([A-Za-z]+)(\d+)$/,
      /^(\d+)[_-]?([A-Za-z0-9]+)$/
    ];

    for (const pattern of patterns) {
      const match = baseName.match(pattern);
      if (match) {
        return `${match[1]}_${match[2]}`.toUpperCase();
      }
    }

    return baseName.toUpperCase();
  }

  matchRecordsWithFiles(records, indexedFiles, scanExtensions, deliveryExtensions) {
    return records.map(record => {
      const key = DataService.generateUniqueId(record.boxId, record.frameNumber);
      const matchingFiles = indexedFiles[key] || [];
      
      const scanFiles = matchingFiles.filter(f => 
        scanExtensions.includes(f.extension.toLowerCase())
      );
      
      const deliveryFiles = matchingFiles.filter(f => 
        deliveryExtensions.includes(f.extension.toLowerCase())
      );

      return {
        ...record,
        matchedScanFiles: scanFiles,
        matchedDeliveryFiles: deliveryFiles,
        scanFile: record.scanFile || (scanFiles[0]?.name || ''),
        deliveryFile: record.deliveryFile || (deliveryFiles[0]?.name || '')
      };
    });
  }
}

export default new ImportService();
