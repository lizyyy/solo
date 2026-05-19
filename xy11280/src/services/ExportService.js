import fs from 'fs/promises';
import path from 'path';
import { stringify } from 'csv-stringify/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORT_DIR = path.join(__dirname, '../../data/export');

class ExportService {
  async ensureExportDir() {
    try {
      await fs.access(EXPORT_DIR);
    } catch {
      await fs.mkdir(EXPORT_DIR, { recursive: true });
    }
  }

  generateFilename(prefix, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}_${timestamp}.${extension}`;
  }

  async exportPrescriptionsToCSV(prescriptions, filename = null) {
    await this.ensureExportDir();
    
    const records = prescriptions.map(p => ({
      处方ID: p.id,
      处方编号: p.prescriptionNo || '',
      宠物名称: p.petName,
      宠物种类: p.species,
      品种: p.breed || '',
      体重: `${p.weight}${p.weightUnit}`,
      年龄: p.age || '',
      医生: p.doctor,
      诊断: p.diagnosis || '',
      药品数量: p.medicines.length,
      药品明细: p.medicines.map(m => 
        `${m.medicineName || m.medicineId}: ${m.dosage || ''}${m.dosageUnit || ''}`
      ).join('; '),
      状态: p.status,
      复核人: p.reviewedBy || '',
      复核时间: p.reviewedAt || '',
      异常数量: p.anomalies ? p.anomalies.length : 0,
      异常明细: p.anomalies ? p.anomalies.map(a => 
        `${a.type}: ${a.message}`
      ).join('; ') : '',
      创建时间: p.createdAt,
      更新时间: p.updatedAt
    }));

    const csv = stringify(records, { header: true });
    const finalFilename = filename || this.generateFilename('prescriptions', 'csv');
    const filePath = path.join(EXPORT_DIR, finalFilename);
    
    await fs.writeFile(filePath, '\ufeff' + csv, 'utf-8');
    
    return {
      filename: finalFilename,
      filePath,
      recordCount: prescriptions.length
    };
  }

  async exportPrescriptionsToJSON(prescriptions, filename = null) {
    await this.ensureExportDir();
    
    const finalFilename = filename || this.generateFilename('prescriptions', 'json');
    const filePath = path.join(EXPORT_DIR, finalFilename);
    
    await fs.writeFile(filePath, JSON.stringify(prescriptions, null, 2), 'utf-8');
    
    return {
      filename: finalFilename,
      filePath,
      recordCount: prescriptions.length
    };
  }

  async exportInventoryToCSV(inventory, filename = null) {
    await this.ensureExportDir();
    
    const records = inventory.map(item => ({
      库存ID: item.id,
      药品ID: item.medicineId,
      药品名称: item.medicineName,
      批号: item.batchNumber,
      数量: item.quantity,
      单位: item.unit,
      有效期: item.expiryDate,
      货位: item.location || '',
      供应商: item.supplier || '',
      进价: item.costPrice || 0,
      创建时间: item.createdAt
    }));

    const csv = stringify(records, { header: true });
    const finalFilename = filename || this.generateFilename('inventory', 'csv');
    const filePath = path.join(EXPORT_DIR, finalFilename);
    
    await fs.writeFile(filePath, '\ufeff' + csv, 'utf-8');
    
    return {
      filename: finalFilename,
      filePath,
      recordCount: inventory.length
    };
  }

  async exportImportErrorsToCSV(errors, filename = null) {
    await this.ensureExportDir();
    
    const records = errors.map(error => ({
      错误ID: error.id,
      数据源: error.source,
      文件路径: error.filePath,
      行号: error.rowNumber,
      错误信息: error.errorMessage,
      修改建议: error.suggestion,
      原始数据: JSON.stringify(error.originalData),
      创建时间: error.createdAt
    }));

    const csv = stringify(records, { header: true });
    const finalFilename = filename || this.generateFilename('import_errors', 'csv');
    const filePath = path.join(EXPORT_DIR, finalFilename);
    
    await fs.writeFile(filePath, '\ufeff' + csv, 'utf-8');
    
    return {
      filename: finalFilename,
      filePath,
      recordCount: errors.length
    };
  }

  async exportStatisticsToCSV(statistics, filename = null) {
    await this.ensureExportDir();
    
    const records = [
      { 指标: '处方总数', 值: statistics.totalPrescriptions },
      { 指标: '待处理处方', 值: statistics.statusCounts.pending || 0 },
      { 指标: '已复核处方', 值: statistics.statusCounts.reviewed || 0 },
      { 指标: '已发药处方', 值: statistics.statusCounts.dispensed || 0 },
      { 指标: '已取消处方', 值: statistics.statusCounts.cancelled || 0 },
      { 指标: '含异常的处方', 值: statistics.prescriptionsWithAnomalies },
      { 指标: '药品总数', 值: statistics.totalMedicines },
      { 指标: '库存批次总数', 值: statistics.totalInventoryItems },
      { 指标: '即将过期的库存', 值: statistics.expiringInventory }
    ];

    const csv = stringify(records, { header: true });
    const finalFilename = filename || this.generateFilename('statistics', 'csv');
    const filePath = path.join(EXPORT_DIR, finalFilename);
    
    await fs.writeFile(filePath, '\ufeff' + csv, 'utf-8');
    
    return {
      filename: finalFilename,
      filePath,
      recordCount: records.length
    };
  }

  async getExportedFiles() {
    await this.ensureExportDir();
    const files = await fs.readdir(EXPORT_DIR);
    
    const fileDetails = [];
    for (const file of files) {
      const filePath = path.join(EXPORT_DIR, file);
      const stats = await fs.stat(filePath);
      fileDetails.push({
        filename: file,
        filePath,
        size: stats.size,
        created: stats.birthtime
      });
    }
    
    return fileDetails.sort((a, b) => b.created - a.created);
  }

  async deleteExportedFile(filename) {
    const filePath = path.join(EXPORT_DIR, filename);
    await fs.unlink(filePath);
    return { success: true, filename };
  }

  getExportDir() {
    return EXPORT_DIR;
  }
}

export default new ExportService();
