const path = require('path');
const dayjs = require('dayjs');
const { readCSV, readExcel, getFileInfo } = require('../utils/fileUtils');
const {
  isValidLotNumber,
  isValidQuantity,
  isValidTemperature,
  isValidTemperatureZone,
  isValidDateTime,
  validateRow
} = require('../utils/validation');
const { DATA_SOURCES } = require('../models/types');

class ImportService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  
  getSchemaForType(type) {
    const schemas = {
      inventory: [
        { name: 'lotNumber', required: true, validator: isValidLotNumber },
        { name: 'productName', required: true },
        { name: 'zone', required: true, validator: isValidTemperatureZone },
        { name: 'quantity', required: true, validator: isValidQuantity },
        { name: 'unit', required: false },
        { name: 'entryDate', required: true, validator: isValidDateTime },
        { name: 'expiryDate', required: false }
      ],
      temperature: [
        { name: 'lotNumber', required: true, validator: isValidLotNumber },
        { name: 'zone', required: true, validator: isValidTemperatureZone },
        { name: 'temperature', required: true, validator: isValidTemperature },
        { name: 'recordTime', required: true, validator: isValidDateTime },
        { name: 'sensorId', required: false }
      ],
      manualCount: [
        { name: 'lotNumber', required: true, validator: isValidLotNumber },
        { name: 'countedQuantity', required: true, validator: isValidQuantity },
        { name: 'countedZone', required: true, validator: isValidTemperatureZone },
        { name: 'countedBy', required: true },
        { name: 'countedAt', required: true, validator: isValidDateTime }
      ]
    };
    return schemas[type] || null;
  }
  
  async readFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') {
      return await readCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return await readExcel(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
  }
  
  async importInventory(filePath, options = {}) {
    const fileInfo = getFileInfo(filePath);
    if (!fileInfo) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    const rows = await this.readFile(filePath);
    const schema = this.getSchemaForType('inventory');
    
    const result = {
      fileName: fileInfo.fileName,
      fileSize: fileInfo.size,
      fileModified: fileInfo.lastModified,
      importTime: dayjs().toISOString(),
      type: 'inventory',
      totalRows: rows.length,
      processedRows: 0,
      successCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: [],
      warnings: [],
      source: DATA_SOURCES.WMS
    };
    
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      const row = rows[i];
      const validation = validateRow(row, schema, rowIndex);
      
      if (validation.hasError) {
        result.errors.push(...validation.errors);
        continue;
      }
      
      try {
        result.processedRows++;
        
        const lotData = {
          lotNumber: String(row.lotNumber).trim(),
          productName: String(row.productName).trim(),
          zone: String(row.zone).trim(),
          quantity: Number(row.quantity),
          unit: row.unit ? String(row.unit).trim() : '件',
          entryDate: String(row.entryDate).trim(),
          expiryDate: row.expiryDate ? String(row.expiryDate).trim() : null
        };
        
        const existingLot = this.dataStore.findLotByNumber(lotData.lotNumber);
        
        if (existingLot && options.updateStrategy === 'skip') {
          result.skippedCount++;
          continue;
        }
        
        const { lot, isNew } = this.dataStore.upsertLot(lotData, result.source);
        
        if (isNew) {
          result.successCount++;
        } else {
          result.updatedCount++;
        }
        
        if (existingLot && existingLot.zone !== lot.zone) {
          this.dataStore.addCrossZoneMovement({
            lotNumber: lot.lotNumber,
            fromZone: existingLot.zone,
            toZone: lot.zone,
            movementType: 'wms_update',
            recordedAt: result.importTime,
            source: result.source
          });
        }
        
      } catch (error) {
        result.errors.push({
          row: rowIndex,
          field: 'system',
          reason: `处理失败: ${error.message}`
        });
      }
    }
    
    this.dataStore.recordImport(result);
    return result;
  }
  
  async importTemperature(filePath, options = {}) {
    const fileInfo = getFileInfo(filePath);
    if (!fileInfo) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    const rows = await this.readFile(filePath);
    const schema = this.getSchemaForType('temperature');
    
    const result = {
      fileName: fileInfo.fileName,
      fileSize: fileInfo.size,
      fileModified: fileInfo.lastModified,
      importTime: dayjs().toISOString(),
      type: 'temperature',
      totalRows: rows.length,
      processedRows: 0,
      successCount: 0,
      skippedCount: 0,
      errors: [],
      warnings: [],
      source: DATA_SOURCES.TEMPERATURE_LOG
    };
    
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      const row = rows[i];
      const validation = validateRow(row, schema, rowIndex);
      
      if (validation.hasError) {
        result.errors.push(...validation.errors);
        continue;
      }
      
      try {
        result.processedRows++;
        
        const record = {
          lotNumber: String(row.lotNumber).trim(),
          zone: String(row.zone).trim(),
          temperature: Number(row.temperature),
          recordTime: String(row.recordTime).trim(),
          sensorId: row.sensorId ? String(row.sensorId).trim() : null
        };
        
        const lot = this.dataStore.findLotByNumber(record.lotNumber);
        if (!lot) {
          result.warnings.push({
            row: rowIndex,
            lotNumber: record.lotNumber,
            reason: `温度记录对应的批号 ${record.lotNumber} 在库存中不存在`
          });
        }
        
        this.dataStore.addTemperatureRecord(record);
        result.successCount++;
        
      } catch (error) {
        result.errors.push({
          row: rowIndex,
          field: 'system',
          reason: `处理失败: ${error.message}`
        });
      }
    }
    
    this.dataStore.recordImport(result);
    return result;
  }
  
  async importManualCount(filePath, options = {}) {
    const fileInfo = getFileInfo(filePath);
    if (!fileInfo) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    const rows = await this.readFile(filePath);
    const schema = this.getSchemaForType('manualCount');
    
    const result = {
      fileName: fileInfo.fileName,
      fileSize: fileInfo.size,
      fileModified: fileInfo.lastModified,
      importTime: dayjs().toISOString(),
      type: 'manualCount',
      totalRows: rows.length,
      processedRows: 0,
      successCount: 0,
      skippedCount: 0,
      errors: [],
      warnings: [],
      source: DATA_SOURCES.MANUAL_INVENTORY
    };
    
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      const row = rows[i];
      const validation = validateRow(row, schema, rowIndex);
      
      if (validation.hasError) {
        result.errors.push(...validation.errors);
        continue;
      }
      
      try {
        result.processedRows++;
        
        const countData = {
          lotNumber: String(row.lotNumber).trim(),
          countedQuantity: Number(row.countedQuantity),
          countedZone: String(row.countedZone).trim(),
          countedBy: String(row.countedBy).trim(),
          countedAt: String(row.countedAt).trim()
        };
        
        const existingLot = this.dataStore.findLotByNumber(countData.lotNumber);
        
        if (!existingLot) {
          result.errors.push({
            row: rowIndex,
            field: 'lotNumber',
            reason: `批号 ${countData.lotNumber} 在库存中不存在，无法进行盘点`
          });
          continue;
        }
        
        const updatedLot = {
          ...existingLot,
          lastCounted: {
            quantity: countData.countedQuantity,
            zone: countData.countedZone,
            countedBy: countData.countedBy,
            countedAt: countData.countedAt,
            source: result.source
          }
        };
        
        const { isNew } = this.dataStore.upsertLot(updatedLot, result.source);
        result.successCount++;
        
      } catch (error) {
        result.errors.push({
          row: rowIndex,
          field: 'system',
          reason: `处理失败: ${error.message}`
        });
      }
    }
    
    this.dataStore.recordImport(result);
    return result;
  }
}

module.exports = ImportService;
