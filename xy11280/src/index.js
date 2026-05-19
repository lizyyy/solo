#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import importService from './services/ImportService.js';
import pharmacyService from './services/PharmacyService.js';
import exportService from './services/ExportService.js';
import storage from './services/StorageService.js';

const program = new Command();

program
  .name('vet-pharmacy')
  .description('宠物医院药房管理CLI - 处方、剂量计算、库存管理')
  .version('1.0.0');

function printError(message) {
  console.log(chalk.red(`❌ 错误: ${message}`));
}

function printSuccess(message) {
  console.log(chalk.green(`✅ ${message}`));
}

function printWarning(message) {
  console.log(chalk.yellow(`⚠️  ${message}`));
}

function printInfo(message) {
  console.log(chalk.blue(`ℹ️  ${message}`));
}

program
  .command('import-prescriptions')
  .description('从JSON文件导入处方')
  .argument('<file>', 'JSON文件路径')
  .action(async (file) => {
    try {
      const result = await importService.importPrescriptionsFromJSON(file);
      printSuccess(`导入完成: 成功 ${result.success} 条, 失败 ${result.failed} 条`);
      if (result.failed > 0) {
        printWarning(`导入错误已保存，使用 'vet-pharmacy import-errors' 查看`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('import-inventory')
  .description('从CSV文件导入库存')
  .argument('<file>', 'CSV文件路径')
  .action(async (file) => {
    try {
      const result = await importService.importInventoryFromCSV(file);
      printSuccess(`导入完成: 成功 ${result.success} 条, 失败 ${result.failed} 条`);
      if (result.failed > 0) {
        printWarning(`导入错误已保存，使用 'vet-pharmacy import-errors' 查看`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('import-rules')
  .description('从JSON文件导入剂量规则')
  .argument('<file>', 'JSON文件路径')
  .action(async (file) => {
    try {
      const result = await importService.importDosageRulesFromJSON(file);
      printSuccess(`导入完成: 成功 ${result.success} 条, 失败 ${result.failed} 条`);
      if (result.failed > 0) {
        printWarning(`导入错误已保存，使用 'vet-pharmacy import-errors' 查看`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('import-errors')
  .description('查看导入错误')
  .option('-s, --source <source>', '按数据源筛选')
  .option('-e, --export', '导出错误到CSV')
  .action(async (options) => {
    try {
      const errors = await importService.getImportErrors(options.source);
      
      if (errors.length === 0) {
        printInfo('暂无导入错误');
        return;
      }

      const table = new Table({
        head: ['行号', '数据源', '错误信息', '修改建议'],
        colWidths: [10, 15, 40, 30]
      });

      errors.forEach(error => {
        table.push([
          error.rowNumber,
          error.source,
          error.errorMessage.substring(0, 37) + (error.errorMessage.length > 37 ? '...' : ''),
          error.suggestion.substring(0, 27) + (error.suggestion.length > 27 ? '...' : '')
        ]);
      });

      console.log(table.toString());
      printInfo(`共 ${errors.length} 条错误记录`);

      if (options.export) {
        const result = await exportService.exportImportErrorsToCSV(errors);
        printSuccess(`错误记录已导出到: ${result.filePath}`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('create-prescription')
  .description('创建新处方')
  .requiredOption('--pet-name <name>', '宠物名称')
  .requiredOption('--species <species>', '宠物种类')
  .requiredOption('--weight <weight>', '体重', parseFloat)
  .option('--weight-unit <unit>', '体重单位', 'kg')
  .requiredOption('--doctor <doctor>', '医生姓名')
  .option('--diagnosis <diagnosis>', '诊断结果')
  .option('--breed <breed>', '品种')
  .option('--age <age>', '年龄')
  .action(async (options) => {
    try {
      const prescription = await pharmacyService.createPrescription({
        petName: options.petName,
        species: options.species,
        weight: options.weight,
        weightUnit: options.weightUnit,
        doctor: options.doctor,
        diagnosis: options.diagnosis,
        breed: options.breed,
        age: options.age,
        medicines: []
      });
      
      printSuccess(`处方创建成功!`);
      console.log(`处方ID: ${chalk.cyan(prescription.id)}`);
      console.log(`状态: ${chalk.yellow(prescription.status)}`);
      
      if (prescription.anomalies && prescription.anomalies.length > 0) {
        printWarning(`检测到 ${prescription.anomalies.length} 条异常:`);
        prescription.anomalies.forEach(a => {
          console.log(`  - ${a.type}: ${a.message}`);
        });
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('review-prescription')
  .description('复核处方')
  .argument('<id>', '处方ID')
  .requiredOption('--reviewer <name>', '复核人姓名')
  .option('--notes <notes>', '复核备注')
  .option('--allocate', '分配库存')
  .action(async (id, options) => {
    try {
      const prescription = await pharmacyService.reviewPrescription(
        id,
        options.reviewer,
        options.notes,
        options.allocate
      );
      
      printSuccess(`处方复核成功!`);
      console.log(`处方ID: ${chalk.cyan(prescription.id)}`);
      console.log(`状态: ${chalk.green(prescription.status)}`);
      console.log(`复核人: ${prescription.reviewedBy}`);
      console.log(`复核时间: ${prescription.reviewedAt}`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('list-prescriptions')
  .description('查询处方列表')
  .option('--doctor <doctor>', '按医生筛选')
  .option('--reviewer <reviewer>', '按复核人筛选')
  .option('--status <status>', '按状态筛选 (pending/reviewed/dispensed/cancelled)')
  .option('--start-date <date>', '开始日期')
  .option('--end-date <date>', '结束日期')
  .option('--has-anomalies', '只显示有异常的处方')
  .option('--anomaly-type <type>', '按异常类型筛选')
  .option('-e, --export', '导出查询结果')
  .action(async (options) => {
    try {
      const filters = {};
      if (options.doctor) filters.doctor = options.doctor;
      if (options.reviewer) filters.reviewer = options.reviewer;
      if (options.status) filters.status = options.status;
      if (options.startDate) filters.startDate = options.startDate;
      if (options.endDate) filters.endDate = options.endDate;
      if (options.hasAnomalies) filters.hasAnomalies = true;
      if (options.anomalyType) filters.anomalyType = options.anomalyType;

      const prescriptions = await pharmacyService.getPrescriptionHistory(filters);
      
      if (prescriptions.length === 0) {
        printInfo('暂无处方记录');
        return;
      }

      const table = new Table({
        head: ['ID', '宠物', '医生', '状态', '药品数', '异常', '创建时间'],
        colWidths: [38, 12, 10, 12, 8, 8, 25]
      });

      prescriptions.forEach(p => {
        table.push([
          p.id.substring(0, 36),
          p.petName,
          p.doctor,
          p.status,
          p.medicines.length,
          p.anomalies ? p.anomalies.length : 0,
          new Date(p.createdAt).toLocaleString('zh-CN')
        ]);
      });

      console.log(table.toString());
      printInfo(`共 ${prescriptions.length} 条记录`);

      if (options.export) {
        const result = await exportService.exportPrescriptionsToCSV(prescriptions);
        printSuccess(`查询结果已导出到: ${result.filePath}`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('show-prescription')
  .description('查看处方详情')
  .argument('<id>', '处方ID')
  .action(async (id) => {
    try {
      const prescription = await storage.getById('prescriptions', id);
      
      if (!prescription) {
        printError('处方不存在');
        process.exit(1);
      }

      console.log(chalk.cyan('\n=== 处方详情 ===\n'));
      console.log(`处方ID: ${prescription.id}`);
      console.log(`宠物: ${prescription.petName} (${prescription.species})`);
      console.log(`体重: ${prescription.weight}${prescription.weightUnit}`);
      console.log(`医生: ${prescription.doctor}`);
      console.log(`诊断: ${prescription.diagnosis || '-'}`);
      console.log(`状态: ${prescription.status}`);
      
      if (prescription.medicines.length > 0) {
        console.log(chalk.cyan('\n药品明细:'));
        prescription.medicines.forEach((m, i) => {
          console.log(`  ${i + 1}. ${m.medicineName || m.medicineId}`);
          console.log(`     剂量: ${m.dosage || '-'}${m.dosageUnit || ''}`);
          if (m.allocatedBatches) {
            console.log(`     分配批次: ${m.allocatedBatches.map(b => b.batchNumber).join(', ')}`);
          }
        });
      }

      if (prescription.anomalies && prescription.anomalies.length > 0) {
        console.log(chalk.yellow('\n异常记录:'));
        prescription.anomalies.forEach(a => {
          const severity = a.severity === 'error' ? chalk.red : chalk.yellow;
          console.log(`  ${severity(`[${a.type}]`)} ${a.message}`);
        });
      }

      if (prescription.reviewedBy) {
        console.log(chalk.green('\n复核信息:'));
        console.log(`  复核人: ${prescription.reviewedBy}`);
        console.log(`  复核时间: ${prescription.reviewedAt}`);
        if (prescription.reviewNotes) {
          console.log(`  备注: ${prescription.reviewNotes}`);
        }
      }

      console.log(`\n创建时间: ${prescription.createdAt}`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('inventory')
  .description('查看库存概况')
  .option('-e, --export', '导出库存到CSV')
  .action(async (options) => {
    try {
      const summary = await pharmacyService.getInventorySummary();
      const items = Object.values(summary);

      if (items.length === 0) {
        printInfo('暂无库存记录');
        return;
      }

      const table = new Table({
        head: ['药品名称', '总数量', '单位', '批次', '即将过期'],
        colWidths: [20, 12, 8, 8, 12]
      });

      items.forEach(item => {
        table.push([
          item.medicineName,
          item.totalQuantity,
          item.unit,
          item.batches,
          item.expiring > 0 ? chalk.yellow(item.expiring) : item.expiring
        ]);
      });

      console.log(table.toString());
      printInfo(`共 ${items.length} 种药品`);

      if (options.export) {
        const inventory = await storage.getAll('inventory');
        const result = await exportService.exportInventoryToCSV(inventory);
        printSuccess(`库存已导出到: ${result.filePath}`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('查看统计信息')
  .option('-e, --export', '导出统计到CSV')
  .action(async (options) => {
    try {
      const stats = await pharmacyService.getStatistics();

      console.log(chalk.cyan('\n=== 药房统计 ===\n'));
      console.log(`处方总数: ${stats.totalPrescriptions}`);
      console.log(`  待处理: ${stats.statusCounts.pending || 0}`);
      console.log(`  已复核: ${stats.statusCounts.reviewed || 0}`);
      console.log(`  已发药: ${stats.statusCounts.dispensed || 0}`);
      console.log(`  已取消: ${stats.statusCounts.cancelled || 0}`);
      console.log(`含异常的处方: ${stats.prescriptionsWithAnomalies}`);
      console.log(`\n药品总数: ${stats.totalMedicines}`);
      console.log(`库存批次总数: ${stats.totalInventoryItems}`);
      console.log(`即将过期的库存: ${stats.expiringInventory > 0 ? chalk.yellow(stats.expiringInventory) : stats.expiringInventory}\n`);

      if (options.export) {
        const result = await exportService.exportStatisticsToCSV(stats);
        printSuccess(`统计已导出到: ${result.filePath}`);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program
  .command('list-exports')
  .description('列出已导出的文件')
  .action(async () => {
    try {
      const files = await exportService.getExportedFiles();
      
      if (files.length === 0) {
        printInfo('暂无导出文件');
        return;
      }

      const table = new Table({
        head: ['文件名', '大小', '创建时间'],
        colWidths: [40, 12, 25]
      });

      files.forEach(file => {
        table.push([
          file.filename,
          `${(file.size / 1024).toFixed(2)} KB`,
          file.created.toLocaleString('zh-CN')
        ]);
      });

      console.log(table.toString());
      printInfo(`导出目录: ${exportService.getExportDir()}`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

program.parseAsync();
