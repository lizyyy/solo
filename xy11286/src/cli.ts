#!/usr/bin/env node
import { Command } from 'commander';
import { initDatabase } from './db/database';
import { medicineModel } from './models/Medicine';
import { inventoryModel } from './models/Inventory';
import { badRecordModel } from './models/BadRecord';
import { importSessionModel } from './models/ImportSession';
import { auditLogModel } from './models/AuditLog';
import { InventoryImporter } from './importers/InventoryImporter';
import { PrescriptionImporter } from './importers/PrescriptionImporter';
import { prescriptionService } from './services/PrescriptionService';
import { PrescriptionStatus } from './types';

const program = new Command();

initDatabase();

program
  .name('pharmacy')
  .description('宠物医院药房管理系统CLI')
  .version('1.0.0');

program
  .command('medicine:create')
  .description('创建药品')
  .requiredOption('-c, --code <code>', '药品编码')
  .requiredOption('-n, --name <name>', '药品名称')
  .option('-g, --generic <generic>', '通用名')
  .requiredOption('--category <category>', '分类')
  .requiredOption('--unit <unit>', '单位')
  .requiredOption('--manufacturer <manufacturer>', '生产厂家')
  .option('--controlled', '是否管制药品', false)
  .option('--prescription', '是否需要处方', true)
  .action((options) => {
    try {
      const medicine = medicineModel.create({
        code: options.code,
        name: options.name,
        genericName: options.generic,
        category: options.category,
        unit: options.unit,
        manufacturer: options.manufacturer,
        isControlled: options.controlled,
        requiresPrescription: options.prescription,
      });
      console.log('药品创建成功:', JSON.stringify(medicine, null, 2));
    } catch (error: any) {
      console.error('创建失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('medicine:list')
  .description('列出所有药品')
  .action(() => {
    const medicines = medicineModel.findAll();
    console.table(medicines.map(m => ({
      id: m.id,
      code: m.code,
      name: m.name,
      category: m.category,
      unit: m.unit,
      manufacturer: m.manufacturer,
    })));
  });

program
  .command('medicine:search')
  .description('搜索药品')
  .argument('<keyword>', '搜索关键词')
  .action((keyword) => {
    const medicines = medicineModel.search(keyword);
    console.table(medicines.map(m => ({
      code: m.code,
      name: m.name,
      category: m.category,
      unit: m.unit,
    })));
  });

program
  .command('inventory:import')
  .description('导入库存CSV文件')
  .requiredOption('-f, --file <file>', 'CSV文件路径')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .action((options) => {
    try {
      const importer = new InventoryImporter(options.file, options.operatorId, options.operatorName);
      const result = importer.import();
      console.log(`导入完成: 成功${result.successCount}条, 失败${result.failureCount}条`);
      if (result.badRecords.length > 0) {
        console.log('\n坏记录详情:');
        console.table(result.badRecords.map(r => ({
          行号: r.rowNumber,
          字段: r.columnName,
          失败原因: r.failureReason,
          建议: r.suggestedFix,
        })));
      }
    } catch (error: any) {
      console.error('导入失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('inventory:list')
  .description('列出库存')
  .option('-m, --medicine <code>', '药品编码')
  .action((options) => {
    let inventories;
    if (options.medicine) {
      const medicine = medicineModel.findByCode(options.medicine);
      if (!medicine) {
        console.error('药品不存在');
        process.exit(1);
      }
      inventories = inventoryModel.findByMedicineId(medicine.id);
    } else {
      inventories = inventoryModel.findAll();
    }
    console.table(inventories.map(i => ({
      batchNumber: i.batchNumber,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      expiryDate: i.expiryDate,
      status: i.status,
    })));
  });

program
  .command('prescription:import')
  .description('导入处方JSON文件')
  .requiredOption('-f, --file <file>', 'JSON文件路径')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .action((options) => {
    try {
      const importer = new PrescriptionImporter(options.file, options.operatorId, options.operatorName);
      const result = importer.import();
      console.log(`导入完成: 成功${result.successCount}条, 失败${result.failureCount}条`);
      if (result.badRecords.length > 0) {
        console.log('\n坏记录详情:');
        console.table(result.badRecords.map(r => ({
          行号: r.rowNumber,
          字段: r.columnName,
          失败原因: r.failureReason,
          建议: r.suggestedFix,
        })));
      }
    } catch (error: any) {
      console.error('导入失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:submit')
  .description('提交处方')
  .requiredOption('-i, --id <id>', '处方ID')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .action((options) => {
    try {
      const prescription = prescriptionService.submitPrescription(options.id, options.operatorId, options.operatorName);
      console.log('处方已提交:', prescription.prescriptionNumber);
    } catch (error: any) {
      console.error('提交失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:approve')
  .description('审核通过处方')
  .requiredOption('-i, --id <id>', '处方ID')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .option('-n, --notes <notes>', '备注')
  .action((options) => {
    try {
      const prescription = prescriptionService.approvePrescription(options.id, options.operatorId, options.operatorName, options.notes);
      console.log('处方已审核通过:', prescription.prescriptionNumber);
    } catch (error: any) {
      console.error('审核失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:reject')
  .description('驳回处方')
  .requiredOption('-i, --id <id>', '处方ID')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .requiredOption('-r, --reason <reason>', '驳回原因')
  .action((options) => {
    try {
      const prescription = prescriptionService.rejectPrescription(options.id, options.operatorId, options.operatorName, options.reason);
      console.log('处方已驳回:', prescription.prescriptionNumber);
    } catch (error: any) {
      console.error('驳回失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:block')
  .description('拦截处方')
  .requiredOption('-i, --id <id>', '处方ID')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .requiredOption('-r, --reason <reason>', '拦截原因')
  .action((options) => {
    try {
      const prescription = prescriptionService.blockPrescription(options.id, options.operatorId, options.operatorName, options.reason);
      console.log('处方已拦截:', prescription.prescriptionNumber);
    } catch (error: any) {
      console.error('拦截失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:dispense')
  .description('发药')
  .requiredOption('-i, --id <id>', '处方ID')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .requiredOption('--operator-name <name>', '操作人姓名')
  .action((options) => {
    try {
      const prescription = prescriptionService.dispensePrescription(options.id, options.operatorId, options.operatorName);
      console.log('发药完成:', prescription.prescriptionNumber);
    } catch (error: any) {
      console.error('发药失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:show')
  .description('查看处方详情')
  .option('-n, --number <number>', '处方号')
  .option('-i, --id <id>', '处方ID')
  .action((options) => {
    try {
      let prescription;
      if (options.number) {
        prescription = prescriptionService.getPrescriptionByNumber(options.number);
      } else if (options.id) {
        prescription = prescriptionService.getPrescriptionByNumber(options.id);
      } else {
        console.error('请提供处方号或处方ID');
        process.exit(1);
      }

      if (!prescription) {
        console.error('处方不存在');
        process.exit(1);
      }

      console.log('处方详情:');
      console.log('处方号:', prescription.prescriptionNumber);
      console.log('状态:', prescription.status);
      console.log('医生:', prescription.doctorName);
      console.log('宠物:', prescription.petName, prescription.petSpecies, prescription.petWeight + prescription.petWeightUnit);
      console.log('诊断:', prescription.diagnosis);
      console.log('\n药品列表:');
      console.table(prescription.items.map(i => ({
        药品: i.medicineName,
        数量: i.requestedQuantity,
        单位: i.unit,
        用法: i.dosage,
        已发: i.dispensedQuantity,
      })));
    } catch (error: any) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('prescription:list')
  .description('列出处方')
  .option('-s, --status <status>', '状态: draft|submitted|approved|rejected|blocked|dispensed')
  .option('-d, --doctor <id>', '医生ID')
  .option('-p, --pet <id>', '宠物ID')
  .action((options) => {
    let prescriptions;
    if (options.status) {
      prescriptions = prescriptionService.getPrescriptionsByStatus(options.status as PrescriptionStatus);
    } else if (options.doctor) {
      prescriptions = prescriptionService.getPrescriptionsByDoctor(options.doctor);
    } else if (options.pet) {
      prescriptions = prescriptionService.getPrescriptionsByPet(options.pet);
    } else {
      prescriptions = prescriptionService.getPrescriptionsByStatus(PrescriptionStatus.DRAFT);
    }

    console.table(prescriptions.map(p => ({
      处方号: p.prescriptionNumber,
      状态: p.status,
      医生: p.doctorName,
      宠物: p.petName,
      诊断: p.diagnosis,
      创建时间: new Date(p.createdAt).toLocaleString(),
    })));
  });

program
  .command('prescription:audit')
  .description('查看处方审计轨迹')
  .requiredOption('-i, --id <id>', '处方ID')
  .action((options) => {
    const logs = prescriptionService.getPrescriptionAuditTrail(options.id);
    console.table(logs.map(l => ({
      时间: new Date(l.timestamp).toLocaleString(),
      操作: l.action,
      操作人: l.operatorName,
      旧值: l.oldValue,
      新值: l.newValue,
      备注: l.notes,
    })));
  });

program
  .command('badrecords:list')
  .description('列出未解决的坏记录')
  .option('-t, --type <type>', '类型: prescription|inventory')
  .action((options) => {
    const records = badRecordModel.findUnresolved(options.type);
    if (records.length === 0) {
      console.log('没有未解决的坏记录');
      return;
    }
    console.table(records.map(r => ({
      ID: r.id,
      源文件: r.sourceFile,
      行号: r.rowNumber,
      字段: r.columnName,
      失败原因: r.failureReason,
      创建时间: new Date(r.createdAt).toLocaleString(),
    })));
  });

program
  .command('badrecords:resolve')
  .description('标记坏记录为已解决')
  .requiredOption('-i, --id <id>', '坏记录ID')
  .requiredOption('-o, --operator-id <id>', '操作人ID')
  .action((options) => {
    const success = badRecordModel.resolve(options.id, options.operatorId);
    if (success) {
      console.log('坏记录已标记为已解决');
    } else {
      console.error('标记失败');
      process.exit(1);
    }
  });

program
  .command('audit:recent')
  .description('查看最近审计日志')
  .option('-l, --limit <limit>', '数量', '50')
  .action((options) => {
    const logs = auditLogModel.findRecent(parseInt(options.limit));
    console.table(logs.map(l => ({
      时间: new Date(l.timestamp).toLocaleString(),
      实体类型: l.entityType,
      操作: l.action,
      操作人: l.operatorName,
      备注: l.notes,
    })));
  });

program
  .command('imports:list')
  .description('列出导入会话')
  .option('-l, --limit <limit>', '数量', '10')
  .action((options) => {
    const sessions = importSessionModel.findRecent(parseInt(options.limit));
    console.table(sessions.map(s => ({
      类型: s.importType,
      文件: s.sourceFile,
      状态: s.status,
      总数: s.totalRecords,
      成功: s.successCount,
      失败: s.failureCount,
      操作人: s.operatorName,
      时间: new Date(s.startedAt).toLocaleString(),
    })));
  });

program.parse();