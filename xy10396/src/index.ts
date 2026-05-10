#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  DeliveryOrder,
  ElevatorInfo,
  InstallationRecord,
  MissingPartRecord,
  RescheduleRecord,
  DamageCompensation,
  DamageType,
  DamageSeverity
} from './types';
import { DataStore } from './services/dataStore';
import { AbnormalityChecker } from './services/abnormalityChecker';
import { CompensationCalculator } from './services/compensationCalculator';
import { ReportGenerator } from './services/reportGenerator';

const program = new Command();
const dataStore = new DataStore('./data');
const abnormalityChecker = new AbnormalityChecker();
const compensationCalculator = new CompensationCalculator();
const reportGenerator = new ReportGenerator(dataStore);

program
  .name('furniture-cli')
  .description('家具送装异常CLI工具')
  .version('1.0.0');

program
  .command('import')
  .description('导入数据')
  .option('-t, --type <type>', '数据类型: orders, elevators, installations, missingParts, reschedules, compensations')
  .option('-f, --file <file>', 'JSON文件路径')
  .option('-d, --data <data>', 'JSON字符串数据')
  .action(async (options) => {
    try {
      let data: any[];
      
      if (options.data) {
        data = JSON.parse(options.data);
      } else if (options.file) {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
          console.error(`文件不存在: ${filePath}`);
          process.exit(1);
        }
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(fileContent);
      } else {
        console.error('请提供 --file 或 --data 参数');
        process.exit(1);
      }

      if (!Array.isArray(data)) {
        data = [data];
      }

      let imported = 0;
      let errors: string[] = [];

      switch (options.type) {
        case 'orders':
          const orderResult = dataStore.importOrders(data as DeliveryOrder[]);
          imported = orderResult.imported;
          errors = orderResult.errors;
          break;
        case 'elevators':
          for (const item of data as ElevatorInfo[]) {
            try {
              dataStore.importElevator(item);
              imported++;
            } catch (e: any) {
              errors.push(e.message);
            }
          }
          break;
        case 'installations':
          for (const item of data as InstallationRecord[]) {
            try {
              dataStore.importInstallation(item);
              imported++;
            } catch (e: any) {
              errors.push(e.message);
            }
          }
          break;
        case 'missingParts':
          for (const item of data as MissingPartRecord[]) {
            try {
              dataStore.importMissingPart(item);
              imported++;
            } catch (e: any) {
              errors.push(e.message);
            }
          }
          break;
        case 'reschedules':
          for (const item of data as RescheduleRecord[]) {
            try {
              dataStore.importReschedule(item);
              imported++;
            } catch (e: any) {
              errors.push(e.message);
            }
          }
          break;
        case 'compensations':
          for (const item of data as DamageCompensation[]) {
            try {
              dataStore.importCompensation(item);
              imported++;
            } catch (e: any) {
              errors.push(e.message);
            }
          }
          break;
        default:
          console.error('未知的数据类型，请使用: orders, elevators, installations, missingParts, reschedules, compensations');
          process.exit(1);
      }

      console.log(`成功导入 ${imported} 条记录`);
      if (errors.length > 0) {
        console.log(`导入失败 ${errors.length} 条记录:`);
        errors.forEach(err => console.log(`  - ${err}`));
      }
    } catch (e: any) {
      console.error(`导入失败: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('检查异常')
  .option('--order-id <orderId>', '指定订单ID检查')
  .option('--all', '检查所有订单')
  .action(async (options) => {
    try {
      const orders = options.orderId 
        ? [dataStore.getOrder(options.orderId)].filter((o): o is DeliveryOrder => o !== undefined) 
        : dataStore.getAllOrders();

      if (orders.length === 0) {
        console.log('没有找到订单');
        return;
      }

      let totalAbnormalities = 0;
      let abnormalOrders = 0;

      for (const order of orders) {
        const elevator = dataStore.getElevator(order.orderId);
        const installations = dataStore.getInstallations(order.orderId);
        const missingParts = dataStore.getMissingParts(order.orderId);
        const reschedules = dataStore.getReschedules(order.orderId);
        const compensations = dataStore.getCompensations(order.orderId);

        const result = abnormalityChecker.checkAllAbnormalities(
          order,
          elevator,
          installations,
          missingParts,
          reschedules,
          compensations
        );

        if (result.hasAbnormality) {
          abnormalOrders++;
          totalAbnormalities += result.abnormalities.length;

          console.log(`\n订单 ${order.orderId} (${order.customerName}) 存在异常:`);
          for (const ab of result.abnormalities) {
            console.log(`  - 类型: ${ab.type}`);
            console.log(`    严重程度: ${ab.severity}`);
            console.log(`    原因: ${ab.description}`);
            console.log(`    责任方: ${ab.responsibleParty}`);
            console.log(`    状态: ${ab.status}`);
          }
        } else {
          console.log(`订单 ${order.orderId} 正常`);
        }
      }

      console.log(`\n=== 检查摘要 ===`);
      console.log(`检查订单数: ${orders.length}`);
      console.log(`异常订单数: ${abnormalOrders}`);
      console.log(`异常总数: ${totalAbnormalities}`);
    } catch (e: any) {
      console.error(`检查失败: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('register')
  .description('登记处理')
  .option('--order-id <orderId>', '订单ID')
  .option('--type <type>', '异常类型')
  .option('--resolution <resolution>', '解决方案')
  .action(async (options) => {
    try {
      if (!options.orderId || !options.type || !options.resolution) {
        console.error('请提供 --order-id, --type, --resolution 参数');
        process.exit(1);
      }

      const order = dataStore.getOrder(options.orderId);
      if (!order) {
        console.error(`订单 ${options.orderId} 不存在`);
        process.exit(1);
      }

      dataStore.updateAbnormalityResolution(options.orderId, options.type, options.resolution);
      console.log(`已登记订单 ${options.orderId} 的异常处理: ${options.resolution}`);
    } catch (e: any) {
      console.error(`登记失败: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('calculate')
  .description('计算赔付')
  .option('--order-id <orderId>', '订单ID')
  .option('--item-id <itemId>', '商品ID')
  .option('--damage-type <type>', '损坏类型: product_damage, installation_damage, delivery_damage, assembly_issue')
  .option('--severity <severity>', '严重程度: minor, moderate, severe')
  .option('--description <description>', '损坏描述')
  .option('--auto', '根据已有的损坏记录自动计算')
  .action(async (options) => {
    try {
      if (options.auto) {
        const allCompensations = dataStore.getAllCompensations();
        const summary = compensationCalculator.generateCompensationSummary(allCompensations);
        
        console.log('=== 赔付汇总 ===');
        console.log(`总赔付金额: ¥${summary.total.toFixed(2)}`);
        console.log('\n按损坏类型:');
        for (const [type, amount] of Object.entries(summary.byType)) {
          if (amount > 0) {
            console.log(`  ${type}: ¥${amount.toFixed(2)}`);
          }
        }
        console.log('\n按责任方:');
        for (const [party, amount] of Object.entries(summary.byParty)) {
          if (amount > 0) {
            console.log(`  ${party}: ¥${amount.toFixed(2)}`);
          }
        }
        return;
      }

      if (!options.orderId || !options.itemId || !options.damageType || !options.severity) {
        console.error('请提供 --order-id, --item-id, --damage-type, --severity 参数，或使用 --auto');
        process.exit(1);
      }

      const order = dataStore.getOrder(options.orderId);
      if (!order) {
        console.error(`订单 ${options.orderId} 不存在`);
        process.exit(1);
      }

      const compensation = compensationCalculator.calculateCompensation(
        order,
        options.itemId,
        options.damageType as DamageType,
        options.severity as DamageSeverity,
        options.description || '自动计算的赔付'
      );

      console.log('=== 计算结果 ===');
      console.log(`订单ID: ${compensation.orderId}`);
      console.log(`商品ID: ${compensation.itemId}`);
      console.log(`损坏类型: ${compensation.damageType}`);
      console.log(`严重程度: ${compensation.damageSeverity}`);
      console.log(`赔付金额: ¥${compensation.compensationAmount.toFixed(2)}`);
      console.log(`责任方: ${compensation.responsibleParty}`);
      console.log(`描述: ${compensation.description}`);

      console.log('\n是否要登记此赔付？(y/n)');
      
      dataStore.importCompensation(compensation);
      console.log(`\n赔付已登记，赔付ID: ${compensation.compensationId}`);
    } catch (e: any) {
      console.error(`计算失败: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出报告')
  .option('-o, --output <path>', '输出文件路径')
  .option('-f, --format <format>', '输出格式: json, text (默认: text)')
  .action(async (options) => {
    try {
      const report = reportGenerator.generateReport();
      const format = options.format || 'text';

      if (options.output) {
        const outputPath = path.resolve(options.output);
        if (format === 'json') {
          reportGenerator.exportReportToJson(report, outputPath);
          console.log(`报告已导出到: ${outputPath}`);
        } else {
          reportGenerator.exportReportToText(report, outputPath);
          console.log(`报告已导出到: ${outputPath}`);
        }
      } else {
        reportGenerator.printReport(report);
      }
    } catch (e: any) {
      console.error(`导出失败: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('运行演示：导入样例数据并生成报告')
  .action(async () => {
    console.log('=== 家具送装异常CLI演示 ===\n');
    
    const demoDataPath = path.join(__dirname, '../samples');
    if (!fs.existsSync(demoDataPath)) {
      console.error('样例数据目录不存在，请先创建 samples 目录');
      process.exit(1);
    }

    console.log('1. 清空现有数据...');
    const dataFiles = ['orders.json', 'elevators.json', 'installations.json', 'missingParts.json', 'reschedules.json', 'compensations.json'];
    for (const file of dataFiles) {
      const filePath = path.join('./data', file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const newDataStore = new DataStore('./data');

    console.log('\n2. 导入样例订单数据...');
    const ordersFile = path.join(demoDataPath, 'orders.json');
    if (fs.existsSync(ordersFile)) {
      const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
      orders.forEach((order: DeliveryOrder) => newDataStore.importOrder(order));
      console.log(`  导入了 ${orders.length} 个订单`);
    }

    console.log('\n3. 导入楼层电梯信息...');
    const elevatorsFile = path.join(demoDataPath, 'elevators.json');
    if (fs.existsSync(elevatorsFile)) {
      const elevators = JSON.parse(fs.readFileSync(elevatorsFile, 'utf-8'));
      elevators.forEach((elevator: ElevatorInfo) => newDataStore.importElevator(elevator));
      console.log(`  导入了 ${elevators.length} 条电梯信息`);
    }

    console.log('\n4. 导入安装记录...');
    const installationsFile = path.join(demoDataPath, 'installations.json');
    if (fs.existsSync(installationsFile)) {
      const installations = JSON.parse(fs.readFileSync(installationsFile, 'utf-8'));
      installations.forEach((inst: InstallationRecord) => newDataStore.importInstallation(inst));
      console.log(`  导入了 ${installations.length} 条安装记录`);
    }

    console.log('\n5. 导入缺件登记...');
    const missingPartsFile = path.join(demoDataPath, 'missingParts.json');
    if (fs.existsSync(missingPartsFile)) {
      const missingParts = JSON.parse(fs.readFileSync(missingPartsFile, 'utf-8'));
      missingParts.forEach((mp: MissingPartRecord) => newDataStore.importMissingPart(mp));
      console.log(`  导入了 ${missingParts.length} 条缺件登记`);
    }

    console.log('\n6. 导入改期记录...');
    const reschedulesFile = path.join(demoDataPath, 'reschedules.json');
    if (fs.existsSync(reschedulesFile)) {
      const reschedules = JSON.parse(fs.readFileSync(reschedulesFile, 'utf-8'));
      reschedules.forEach((rs: RescheduleRecord) => newDataStore.importReschedule(rs));
      console.log(`  导入了 ${reschedules.length} 条改期记录`);
    }

    console.log('\n7. 导入损坏赔付记录...');
    const compensationsFile = path.join(demoDataPath, 'compensations.json');
    if (fs.existsSync(compensationsFile)) {
      const compensations = JSON.parse(fs.readFileSync(compensationsFile, 'utf-8'));
      compensations.forEach((comp: DamageCompensation) => {
        try {
          newDataStore.importCompensation(comp);
        } catch (e: any) {
          console.log(`  跳过: ${e.message}`);
        }
      });
      console.log(`  导入了 ${compensations.length} 条赔付记录`);
    }

    console.log('\n8. 检查异常...');
    const checker = new AbnormalityChecker();
    let abnormalCount = 0;
    for (const order of newDataStore.getAllOrders()) {
      const elevator = newDataStore.getElevator(order.orderId);
      const installations = newDataStore.getInstallations(order.orderId);
      const missingParts = newDataStore.getMissingParts(order.orderId);
      const reschedules = newDataStore.getReschedules(order.orderId);
      const compensations = newDataStore.getCompensations(order.orderId);

      const result = checker.checkAllAbnormalities(
        order,
        elevator,
        installations,
        missingParts,
        reschedules,
        compensations
      );

      if (result.hasAbnormality) {
        abnormalCount++;
        console.log(`  订单 ${order.orderId} 存在 ${result.abnormalities.length} 个异常`);
      }
    }
    console.log(`  共发现 ${abnormalCount} 个异常订单`);

    console.log('\n9. 生成售后复盘报告...');
    const generator = new ReportGenerator(newDataStore);
    const report = generator.generateReport();
    
    const outputDir = path.resolve('./output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const reportPath = path.join(outputDir, 'report.txt');
    generator.exportReportToText(report, reportPath);
    
    const jsonReportPath = path.join(outputDir, 'report.json');
    generator.exportReportToJson(report, jsonReportPath);

    console.log(`  文本报告: ${reportPath}`);
    console.log(`  JSON报告: ${jsonReportPath}`);

    console.log('\n=== 演示完成 ===\n');
    generator.printReport(report);
  });

program.parse(process.argv);
