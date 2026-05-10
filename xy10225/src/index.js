#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const path = require('path');

const { resetStore } = require('./storage/dataStore');
const householdService = require('./services/householdService');
const volunteerService = require('./services/volunteerService');
const donationService = require('./services/donationService');
const deliveryService = require('./services/deliveryService');
const verificationService = require('./services/verificationService');
const importExportService = require('./services/importExportService');

const program = new Command();

program
  .name('donation')
  .description('公益物资箱投递核对 CLI')
  .version('1.0.0');

program
  .command('reset')
  .description('重置所有数据')
  .option('-y, --yes', '确认重置，跳过确认')
  .action(async (options) => {
    if (!options.yes) {
      console.log(chalk.yellow('警告: 这将删除所有数据！'));
      console.log(chalk.yellow('如果确认，请使用 --yes 参数'));
      return;
    }
    
    resetStore();
    console.log(chalk.green('✓ 所有数据已重置'));
  });

program
  .command('import:households')
  .description('从文件导入户主名单')
  .argument('<file>', 'CSV 或 JSON 文件路径')
  .action(async (file) => {
    const fullPath = path.resolve(file);
    console.log(chalk.cyan(`正在导入户主名单: ${fullPath}`));
    
    const importResult = await importExportService.importFromFile(fullPath, 'households');
    
    if (!importResult.success) {
      console.log(chalk.red('✗ 导入失败:'));
      importResult.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      return;
    }

    console.log(chalk.cyan(`解析完成，共 ${importResult.data.length} 条记录`));

    const result = householdService.importHouseholds(importResult.data);
    
    console.log(chalk.green(`\n导入结果:`));
    console.log(chalk.green(`  ✓ 成功导入: ${result.success.length} 条`));
    
    if (result.skipped.length > 0) {
      console.log(chalk.yellow(`  ⚠ 跳过: ${result.skipped.length} 条`));
      result.skipped.forEach(s => {
        console.log(chalk.yellow(`    第 ${s.row} 行: ${s.reason}`));
      });
    }
  });

program
  .command('import:donations')
  .description('从文件导入物资捐赠')
  .argument('<file>', 'CSV 或 JSON 文件路径')
  .action(async (file) => {
    const fullPath = path.resolve(file);
    console.log(chalk.cyan(`正在导入物资捐赠: ${fullPath}`));
    
    const importResult = await importExportService.importFromFile(fullPath, 'donations');
    
    if (!importResult.success) {
      console.log(chalk.red('✗ 导入失败:'));
      importResult.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      return;
    }

    console.log(chalk.cyan(`解析完成，共 ${importResult.data.length} 条记录`));

    const result = donationService.importDonations(importResult.data);
    
    console.log(chalk.green(`\n导入结果:`));
    console.log(chalk.green(`  ✓ 成功导入: ${result.success.length} 条`));
    
    if (result.skipped.length > 0) {
      console.log(chalk.yellow(`  ⚠ 跳过: ${result.skipped.length} 条`));
      result.skipped.forEach(s => {
        console.log(chalk.yellow(`    第 ${s.row} 行: ${s.reason}`));
      });
    }
  });

program
  .command('volunteer:register')
  .description('注册志愿者')
  .requiredOption('-n, --name <name>', '志愿者姓名')
  .requiredOption('-p, --phone <phone>', '联系电话')
  .option('-o, --organization <org>', '所属组织')
  .action((options) => {
    const result = volunteerService.registerVolunteer(options);
    
    if (!result.success) {
      console.log(chalk.red('✗ 注册失败:'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      return;
    }

    console.log(chalk.green('✓ 志愿者注册成功'));
    console.log(chalk.cyan(`  ID: ${result.volunteer.id}`));
    console.log(chalk.cyan(`  姓名: ${result.volunteer.name}`));
    console.log(chalk.cyan(`  电话: ${result.volunteer.phone}`));
    console.log(chalk.cyan(`  组织: ${result.volunteer.organization}`));
  });

program
  .command('list:households')
  .description('列出所有户主')
  .action(() => {
    const households = householdService.listHouseholds();
    
    if (households.length === 0) {
      console.log(chalk.yellow('暂无户主数据'));
      return;
    }

    const table = new Table({
      head: ['ID', '姓名', '电话', '住址', '家庭人数', '备注'],
      colWidths: [38, 12, 15, 25, 10, 15]
    });

    households.forEach(h => {
      table.push([
        h.id.substring(0, 8) + '...',
        h.name,
        h.phone,
        h.address,
        h.familyMembers,
        h.notes || ''
      ]);
    });

    console.log(table.toString());
    console.log(chalk.cyan(`共 ${households.length} 户`));
  });

program
  .command('list:donations')
  .description('列出所有物资捐赠')
  .option('-a, --available', '只显示可用物资')
  .action((options) => {
    const donations = donationService.listDonations({
      availableOnly: options.available
    });
    
    if (donations.length === 0) {
      console.log(chalk.yellow('暂无物资数据'));
      return;
    }

    const table = new Table({
      head: ['ID', '物资名称', '总数', '剩余', '单位', '捐赠来源', '类别'],
      colWidths: [38, 15, 8, 8, 6, 15, 12]
    });

    donations.forEach(d => {
      table.push([
        d.id.substring(0, 8) + '...',
        d.itemName,
        d.quantity,
        d.remainingQuantity,
        d.unit,
        d.donor,
        d.category
      ]);
    });

    console.log(table.toString());
    console.log(chalk.cyan(`共 ${donations.length} 项物资`));
  });

program
  .command('list:volunteers')
  .description('列出所有志愿者')
  .action(() => {
    const volunteers = volunteerService.listVolunteers();
    
    if (volunteers.length === 0) {
      console.log(chalk.yellow('暂无志愿者数据'));
      return;
    }

    const table = new Table({
      head: ['ID', '姓名', '电话', '组织'],
      colWidths: [38, 12, 15, 20]
    });

    volunteers.forEach(v => {
      table.push([
        v.id.substring(0, 8) + '...',
        v.name,
        v.phone,
        v.organization
      ]);
    });

    console.log(table.toString());
    console.log(chalk.cyan(`共 ${volunteers.length} 名志愿者`));
  });

program
  .command('delivery:create')
  .description('创建投递记录')
  .requiredOption('-h, --household <id>', '户主ID')
  .requiredOption('-v, --volunteer <id>', '志愿者ID')
  .requiredOption('-i, --items <json>', '物资列表 JSON 字符串')
  .option('-n, --notes <notes>', '备注')
  .action((options) => {
    let items;
    try {
      items = JSON.parse(options.items);
    } catch (error) {
      console.log(chalk.red('✗ 物资列表格式错误，必须是有效的 JSON 数组'));
      console.log(chalk.red(`  示例: '[{"donationId":"xxx","quantity":2}]'`));
      return;
    }

    const result = deliveryService.createDelivery({
      householdId: options.household,
      volunteerId: options.volunteer,
      items: items,
      notes: options.notes
    });

    if (!result.success) {
      console.log(chalk.red('✗ 创建投递记录失败:'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      return;
    }

    console.log(chalk.green('✓ 投递记录创建成功'));
    console.log(chalk.cyan(`  ID: ${result.delivery.id}`));
    console.log(chalk.cyan(`  户主: ${result.delivery.householdName}`));
    console.log(chalk.cyan(`  志愿者: ${result.delivery.volunteerName}`));
    console.log(chalk.cyan(`  状态: ${result.delivery.status}`));
  });

program
  .command('list:deliveries')
  .description('列出投递记录')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    const deliveries = deliveryService.listDeliveries({
      status: options.status
    });
    
    if (deliveries.length === 0) {
      console.log(chalk.yellow('暂无投递记录'));
      return;
    }

    const table = new Table({
      head: ['ID', '户主', '志愿者', '物资数量', '状态', '投递日期'],
      colWidths: [38, 12, 12, 10, 20, 25]
    });

    deliveries.forEach(d => {
      table.push([
        d.id.substring(0, 8) + '...',
        d.householdName,
        d.volunteerName,
        d.items.length,
        d.status,
        new Date(d.deliveryDate).toLocaleString('zh-CN')
      ]);
    });

    console.log(table.toString());
    console.log(chalk.cyan(`共 ${deliveries.length} 条投递记录`));
  });

program
  .command('signature:create')
  .description('创建签收记录')
  .requiredOption('-d, --delivery <id>', '投递记录ID')
  .requiredOption('-v, --verified <id>', '核对人ID')
  .requiredOption('-t, --type <type>', '签收类型: photo, signature, witness, none')
  .requiredOption('-i, --items <json>', '实际收到的物资列表 JSON 字符串')
  .option('-p, --photo <id>', '照片证据ID (photo类型必填')
  .option('-w, --witness <name>', '见证人姓名 (witness类型)')
  .option('-s, --signature <text>', '签名内容 (signature类型)')
  .option('-n, --notes <notes>', '备注')
  .action((options) => {
    let receivedItems;
    try {
      receivedItems = JSON.parse(options.items);
    } catch (error) {
      console.log(chalk.red('✗ 物资列表格式错误，必须是有效的 JSON 数组'));
      return;
    }

    const result = verificationService.createSignature({
      deliveryId: options.delivery,
      verifiedBy: options.verified,
      signatureType: options.type,
      photoEvidence: options.photo,
      witnessName: options.witness,
      signatureText: options.signature,
      notes: options.notes,
      receivedItems: receivedItems
    });

    if (!result.success) {
      console.log(chalk.red('✗ 创建签收记录失败:'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      return;
    }

    console.log(chalk.green('✓ 签收记录创建成功'));
    console.log(chalk.cyan(`  ID: ${result.signature.id}`));
    console.log(chalk.cyan(`  签收类型: ${result.signature.signatureType}`));
    console.log(chalk.cyan(`  核对人: ${result.signature.verifiedByName}`));
  });

program
  .command('verify')
  .description('核对投递记录')
  .argument('<deliveryId>', '投递记录ID')
  .action((deliveryId) => {
    const result = verificationService.verifyDelivery(deliveryId);

    if (!result.success) {
      console.log(chalk.red('✗ 核对失败:'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      return;
    }

    console.log(chalk.green(`\n=== 核对结果 ===`));
    console.log(chalk.cyan(`投递ID: ${result.deliveryId}`));
    console.log(chalk.cyan(`最终状态: ${result.status}`));

    const v = result.verificationResult;
    
    console.log(chalk.green(`\n✓ 匹配物资: ${v.matchedItems.length} 项`));
    v.matchedItems.forEach(item => {
      console.log(chalk.green(`  - ${item.itemName}: ${item.quantity} ${item.unit}`));
    });

    if (v.missingItems.length > 0) {
      console.log(chalk.red(`\n✗ 缺少物资: ${v.missingItems.length} 项`));
      v.missingItems.forEach(item => {
        console.log(chalk.red(`  - ${item.itemName}: 应发 ${item.quantity} ${item.unit}，实发 0`));
      });
    }

    if (v.quantityMismatch.length > 0) {
      console.log(chalk.yellow(`\n⚠ 数量不符: ${v.quantityMismatch.length} 项`));
      v.quantityMismatch.forEach(item => {
        console.log(chalk.yellow(`  - ${item.itemName}: 应发 ${item.expected} ${item.unit}，实发 ${item.received}`));
      });
    }

    if (v.extraItems.length > 0) {
      console.log(chalk.yellow(`\n⚠ 额外物资: ${v.extraItems.length} 项`));
      v.extraItems.forEach(item => {
        console.log(chalk.yellow(`  - ${item.itemName}: ${item.quantity} ${item.unit}`));
      });
    }

    if (result.exceptions.length > 0) {
      console.log(chalk.red(`\n生成异常记录: ${result.exceptions.length} 条`));
      result.exceptions.forEach(e => {
        console.log(chalk.red(`  - [${e.type}] ${e.description}`));
      });
    }

    if (result.needsManualReview) {
      console.log(chalk.yellow.bold(`\n⚠ 需要人工复核！`));
    }
  });

program
  .command('list:exceptions')
  .description('列出异常记录')
  .option('-s, --status <status>', '按状态筛选')
  .option('-t, --type <type>', '按类型筛选')
  .action((options) => {
    const exceptions = verificationService.listExceptions({
      status: options.status,
      type: options.type
    });
    
    if (exceptions.length === 0) {
      console.log(chalk.green('暂无异常记录'));
      return;
    }

    const table = new Table({
      head: ['ID', '类型', '状态', '描述', '创建时间'],
      colWidths: [38, 15, 10, 50, 25]
    });

    exceptions.forEach(e => {
      table.push([
        e.id.substring(0, 8) + '...',
        e.type,
        e.status,
        e.description.substring(0, 45),
        new Date(e.createdAt).toLocaleString('zh-CN')
      ]);
    });

    console.log(table.toString());
    console.log(chalk.yellow(`共 ${exceptions.length} 条异常记录`));
  });

program
  .command('stats:volunteers')
  .description('志愿者统计')
  .action(() => {
    const stats = volunteerService.getVolunteerStats();
    
    if (stats.length === 0) {
      console.log(chalk.yellow('暂无志愿者数据'));
      return;
    }

    const table = new Table({
      head: ['志愿者', '投递次数', '核对次数', '异常次数', '成功率'],
      colWidths: [15, 12, 12, 12, 10]
    });

    stats.forEach(s => {
      table.push([
        s.volunteerName,
        s.totalDeliveries,
        s.totalSignatures,
        s.exceptionCount,
        `${s.successRate}%`
      ]);
    });

    console.log(table.toString());
  });

program
  .command('stats:verification')
  .description('核对统计报告')
  .action(() => {
    const report = verificationService.getVerificationReport();
    const s = report.summary;

    console.log(chalk.green(`\n=== 核对统计报告 ===`));
    console.log(chalk.cyan(`总投递数: ${s.totalDeliveries}`));
    console.log(chalk.green(`✓ 已完成: ${s.completed}`));
    console.log(chalk.blue(`⏳ 待核对: ${s.pending}`));
    console.log(chalk.blue(`🔍 核对中: ${s.verifying}`));
    console.log(chalk.red(`✗ 异常: ${s.exception}`));
    console.log(chalk.yellow(`⚠ 需复核: ${s.needsReview}`));
    
    console.log(chalk.cyan(`\n异常统计:`));
    console.log(chalk.cyan(`总异常数: ${s.totalExceptions}`));
    console.log(chalk.red(`待处理: ${s.openExceptions}`));
    console.log(chalk.green(`已解决: ${s.resolvedExceptions}`));

    if (report.needsManualReview.length > 0) {
      console.log(chalk.yellow.bold(`\n⚠ 需要人工复核的记录:`));
      report.needsManualReview.forEach(d => {
        console.log(chalk.yellow(`  - ${d.householdName} (志愿者: ${d.volunteerName}) - ${d.status} (${d.exceptionCount}个异常)`));
      });
    }
  });

program
  .command('export:exceptions')
  .description('导出异常记录')
  .argument('<output>', '输出文件路径 (.csv 或 .json)')
  .option('-s, --status <status>', '按状态筛选')
  .option('-t, --type <type>', '按类型筛选')
  .action((output, options) => {
    const exportData = importExportService.exportExceptions({
      status: options.status,
      type: options.type
    });

    if (exportData.length === 0) {
      console.log(chalk.yellow('没有数据可导出'));
      return;
    }

    const ext = path.extname(output).toLowerCase();
    let result;

    if (ext === '.csv') {
      result = importExportService.exportToCSV(exportData, path.resolve(output));
    } else if (ext === '.json') {
      result = importExportService.exportToJSON(exportData, path.resolve(output));
    } else {
      console.log(chalk.red('✗ 不支持的导出格式，使用 .csv 或 .json'));
      return;
    }

    if (result.success) {
      console.log(chalk.green(`✓ 导出成功: ${result.filePath}`));
      console.log(chalk.cyan(`共 ${ext === '.csv' ? result.rowCount : result.itemCount} 条记录`));
    } else {
      console.log(chalk.red('✗ 导出失败:'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
    }
  });

program
  .command('export:report')
  .description('导出完整核对报告')
  .argument('<output>', '输出文件路径')
  .action((output) => {
    const report = importExportService.exportVerificationReport();
    const result = importExportService.exportToJSON(report, path.resolve(output));

    if (result.success) {
      console.log(chalk.green(`✓ 报告导出成功: ${result.filePath}`));
      const s = report.summary;
      console.log(chalk.cyan(`报告摘要:`));
      console.log(chalk.cyan(`  户主: ${s.totalHouseholds} 户`));
      console.log(chalk.cyan(`  志愿者: ${s.totalVolunteers} 人`));
      console.log(chalk.cyan(`  物资: ${s.totalDonations} 项`));
      console.log(chalk.cyan(`  投递: ${s.totalDeliveries} 次`));
      console.log(chalk.cyan(`  异常: ${s.totalExceptions} 条`));
    } else {
      console.log(chalk.red('✗ 导出失败:'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
    }
  });

program.parse(process.argv);
