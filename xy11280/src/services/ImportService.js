import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import storage from './StorageService.js';
import Prescription from '../models/Prescription.js';
import Medicine from '../models/Medicine.js';
import Inventory from '../models/Inventory.js';
import DosageRule from '../models/DosageRule.js';

class ImportService {
  async importPrescriptionsFromJSON(filePath) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      const prescriptions = Array.isArray(data) ? data : [data];

      for (let i = 0; i < prescriptions.length; i++) {
        try {
          const prescriptionData = prescriptions[i];
          const prescription = new Prescription(prescriptionData);
          const validationErrors = prescription.validate();
          
          if (validationErrors.length > 0) {
            throw new Error(validationErrors.join('; '));
          }

          await storage.create('prescriptions', prescription.toJSON());
          results.success++;
        } catch (error) {
          results.failed++;
          await storage.saveImportError({
            source: 'prescriptions',
            filePath,
            rowNumber: i + 1,
            originalData: prescriptions[i],
            errorMessage: error.message,
            suggestion: this.getSuggestion(error.message)
          });
        }
      }
    } catch (error) {
      throw new Error(`文件读取失败: ${error.message}`);
    }

    return results;
  }

  async importInventoryFromCSV(filePath) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          const medicine = await this.findOrCreateMedicine(record);
          const inventory = await this.createInventory(record, medicine);
          
          const validationErrors = inventory.validate();
          if (validationErrors.length > 0) {
            throw new Error(validationErrors.join('; '));
          }

          await storage.create('inventory', inventory.toJSON());
          results.success++;
        } catch (error) {
          results.failed++;
          await storage.saveImportError({
            source: 'inventory',
            filePath,
            rowNumber: i + 1,
            originalData: records[i],
            errorMessage: error.message,
            suggestion: this.getSuggestion(error.message)
          });
        }
      }
    } catch (error) {
      throw new Error(`CSV文件解析失败: ${error.message}`);
    }

    return results;
  }

  async importDosageRulesFromJSON(filePath) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      const rules = Array.isArray(data) ? data : [data];

      for (let i = 0; i < rules.length; i++) {
        try {
          const ruleData = rules[i];
          
          const medicine = await this.findOrCreateMedicine(ruleData);
          ruleData.medicineId = medicine.id;
          
          const rule = new DosageRule(ruleData);
          const validationErrors = rule.validate();
          
          if (validationErrors.length > 0) {
            throw new Error(validationErrors.join('; '));
          }

          await storage.create('dosageRules', rule.toJSON());
          results.success++;
        } catch (error) {
          results.failed++;
          await storage.saveImportError({
            source: 'dosageRules',
            filePath,
            rowNumber: i + 1,
            originalData: rules[i],
            errorMessage: error.message,
            suggestion: this.getSuggestion(error.message)
          });
        }
      }
    } catch (error) {
      throw new Error(`文件读取失败: ${error.message}`);
    }

    return results;
  }

  async findOrCreateMedicine(record) {
    const medicineName = record.medicineName || record.name || record['药品名称'];
    if (!medicineName) {
      throw new Error('药品名称不能为空');
    }

    let medicine = await storage.findOne('medicines', m => m.name === medicineName);
    
    if (!medicine) {
      const medicineData = new Medicine({
        name: medicineName,
        genericName: record.genericName || record['通用名'] || '',
        category: record.category || record['分类'] || '',
        unit: record.unit || record['单位'] || 'mg',
        specification: record.specification || record['规格'] || '',
        manufacturer: record.manufacturer || record['生产厂家'] || ''
      });
      medicine = await storage.create('medicines', medicineData.toJSON());
    }

    return medicine;
  }

  async createInventory(record, medicine) {
    return new Inventory({
      medicineId: medicine.id,
      medicineName: medicine.name,
      batchNumber: record.batchNumber || record批号 || '',
      quantity: parseFloat(record.quantity || record数量 || 0),
      unit: record.unit || record单位 || medicine.unit || 'mg',
      expiryDate: record.expiryDate || record有效期 || '',
      location: record.location || record货位 || '',
      supplier: record.supplier || record供应商 || '',
      costPrice: parseFloat(record.costPrice || record进价 || 0)
    });
  }

  getSuggestion(errorMessage) {
    if (errorMessage.includes('名称不能为空')) {
      return '请填写药品名称或宠物名称字段';
    }
    if (errorMessage.includes('批号不能为空')) {
      return '请填写药品批号字段';
    }
    if (errorMessage.includes('体重必须大于0')) {
      return '请检查宠物体重字段，确保值大于0';
    }
    if (errorMessage.includes('库存数量不能为负数')) {
      return '请检查库存数量字段，确保值不为负';
    }
    if (errorMessage.includes('每公斤剂量必须大于0')) {
      return '请检查dosagePerKg字段，确保值大于0';
    }
    if (errorMessage.includes('处方至少包含一种药品')) {
      return '请在medicines字段中添加至少一种药品';
    }
    return '请检查必填字段是否完整，数据格式是否正确';
  }

  async getImportErrors(source = null) {
    let errors = await storage.getImportErrors();
    if (source) {
      errors = errors.filter(e => e.source === source);
    }
    return errors;
  }

  async clearImportErrors() {
    await storage.clear('importErrors');
  }
}

export default new ImportService();
