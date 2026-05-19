import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as path from 'path';
import * as fs from 'fs';
import {
  appointmentService,
  blacklistService,
  temporaryPlateService,
  verificationService
} from '../services';
import { logger, maskObject } from '../utils';

const program = new Command();

program
  .name('park-security')
  .description('园区安保管理CLI工具')
  .version('1.0.0');

function printTable(headers: string[], rows: any[][]): void {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { head: [] }
  });
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

function printSuccess(message: string, data?: any): void {
  console.log(chalk.green(`✓ ${message}`));
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function printError(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

function printInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

const appointmentCmd = program.command('appointment')
  .description('预约管理');

appointmentCmd.command('create')
  .description('创建预约')
  .requiredOption('--name <name>', '访客姓名')
  .requiredOption('--phone <phone>', '访客手机号')
  .option('--company <company>', '访客公司')
  .option('--plate <plate>', '车牌号')
  .requiredOption('--date <date>', '预约日期 (YYYY-MM-DD)')
  .requiredOption('--start <time>', '开始时间 (HH:MM)')
  .requiredOption('--end <time>', '结束时间 (HH:MM)')
  .requiredOption('--reason <reason>', '来访事由')
  .requiredOption('--host-name <name>', '接待人姓名')
  .requiredOption('--host-phone <phone>', '接待人电话')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    try {
      const result = appointmentService.create({
        visitorName: options.name,
        visitorPhone: options.phone,
        visitorCompany: options.company,
        plateNumber: options.plate,
        visitDate: options.date,
        startTime: options.start,
        endTime: options.end,
        reason: options.reason,
        hostName: options.hostName,
        hostPhone: options.hostPhone,
        operator: options.operator
      });
      printSuccess('预约创建成功', result);
    } catch (error) {
      printError(`创建失败: ${(error as Error).message}`);
    }
  });

appointmentCmd.command('list')
  .description('列出所有预约')
  .option('--date <date>', '按日期筛选 (YYYY-MM-DD)')
  .action((options) => {
    const appointments = options.date
      ? appointmentService.getByDate(options.date)
      : appointmentService.getAll();

    if (appointments.length === 0) {
      printInfo('暂无预约记录');
      return;
    }

    printTable(
      ['ID', '访客', '手机号', '车牌', '日期', '时间', '状态'],
      appointments.map(a => [
        a.id.substring(0, 8),
        a.visitorName,
        a.visitorPhone,
        a.plateNumber || '-',
        a.visitDate,
        `${a.startTime}-${a.endTime}`,
        a.status
      ])
    );
  });

appointmentCmd.command('cancel')
  .description('取消预约')
  .requiredOption('--id <id>', '预约ID')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    const success = appointmentService.cancel(options.id, options.operator);
    if (success) {
      printSuccess('预约已取消');
    } else {
      printError('预约不存在');
    }
  });

const blacklistCmd = program.command('blacklist')
  .description('黑名单管理');

blacklistCmd.command('add')
  .description('添加黑名单')
  .requiredOption('--name <name>', '姓名')
  .option('--phone <phone>', '手机号')
  .option('--idcard <idcard>', '身份证号')
  .option('--plate <plate>', '车牌号')
  .requiredOption('--reason <reason>', '拉黑原因 (security|violation|other)')
  .option('--detail <detail>', '原因详情')
  .requiredOption('--operator <operator>', '操作员')
  .option('--expires <date>', '过期时间')
  .action((options) => {
    try {
      const result = blacklistService.add({
        name: options.name,
        phone: options.phone,
        idCard: options.idcard,
        plateNumber: options.plate,
        reason: options.reason,
        reasonDetail: options.detail,
        addedBy: options.operator,
        expiresAt: options.expires
      });
      printSuccess('添加黑名单成功', result);
    } catch (error) {
      printError(`添加失败: ${(error as Error).message}`);
    }
  });

blacklistCmd.command('remove')
  .description('移除黑名单')
  .requiredOption('--id <id>', '黑名单ID')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    const success = blacklistService.remove(options.id, options.operator);
    if (success) {
      printSuccess('已从黑名单移除');
    } else {
      printError('记录不存在');
    }
  });

blacklistCmd.command('list')
  .description('列出黑名单')
  .action(() => {
    const entries = blacklistService.getAll();
    if (entries.length === 0) {
      printInfo('暂无黑名单记录');
      return;
    }

    printTable(
      ['ID', '姓名', '手机号', '车牌', '原因', '添加时间'],
      entries.map(e => [
        e.id.substring(0, 8),
        e.name,
        e.phone || '-',
        e.plateNumber || '-',
        e.reason,
        e.addedAt.substring(0, 10)
      ])
    );
  });

blacklistCmd.command('verify')
  .description('核验黑名单')
  .option('--phone <phone>', '手机号')
  .option('--plate <plate>', '车牌号')
  .option('--idcard <idcard>', '身份证号')
  .action((options) => {
    const result = blacklistService.verify(options.phone, options.plate, options.idcard);
    if (result.blocked) {
      printError(result.reason);
    } else {
      printSuccess(result.reason);
    }
  });

const plateCmd = program.command('plate')
  .description('临时车牌管理');

plateCmd.command('create')
  .description('创建临时车牌')
  .requiredOption('--plate <plate>', '车牌号')
  .requiredOption('--name <name>', '访客姓名')
  .requiredOption('--phone <phone>', '访客手机号')
  .requiredOption('--valid-from <datetime>', '生效时间 (ISO格式)')
  .requiredOption('--valid-to <datetime>', '失效时间 (ISO格式)')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    try {
      const result = temporaryPlateService.create({
        plateNumber: options.plate,
        visitorName: options.name,
        visitorPhone: options.phone,
        validFrom: options.validFrom,
        validTo: options.validTo,
        operator: options.operator
      });
      printSuccess('临时车牌创建成功', result);
    } catch (error) {
      printError(`创建失败: ${(error as Error).message}`);
    }
  });

plateCmd.command('list')
  .description('列出临时车牌')
  .action(() => {
    const plates = temporaryPlateService.getAll();
    if (plates.length === 0) {
      printInfo('暂无临时车牌记录');
      return;
    }

    printTable(
      ['ID', '车牌号', '访客', '手机号', '有效期'],
      plates.map(p => [
        p.id.substring(0, 8),
        p.plateNumber,
        p.visitorName,
        p.visitorPhone,
        `${p.validFrom.substring(0, 10)} 至 ${p.validTo.substring(0, 10)}`
      ])
    );
  });

plateCmd.command('deactivate')
  .description('注销临时车牌')
  .requiredOption('--id <id>', '临时车牌ID')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    const success = temporaryPlateService.deactivate(options.id, options.operator);
    if (success) {
      printSuccess('临时车牌已注销');
    } else {
      printError('记录不存在');
    }
  });

const verifyCmd = program.command('verify')
  .description('核验放行');

verifyCmd.command('entry')
  .description('入场核验')
  .requiredOption('--name <name>', '访客姓名')
  .requiredOption('--phone <phone>', '访客手机号')
  .option('--plate <plate>', '车牌号')
  .requiredOption('--gate <gate>', '门岗编号')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    const result = verificationService.verify({
      visitorName: options.name,
      visitorPhone: options.phone,
      plateNumber: options.plate,
      type: 'entry',
      gate: options.gate,
      operator: options.operator
    });

    if (result.allowed) {
      printSuccess(result.reason);
    } else {
      printError(result.reason);
    }

    console.log('\n核验详情:');
    console.log(`  黑名单检查: ${result.details.blacklistCheck.passed ? chalk.green('通过') : chalk.red('未通过')} - ${result.details.blacklistCheck.reason || 'OK'}`);
    console.log(`  预约检查: ${result.details.appointmentCheck.passed ? chalk.green('通过') : chalk.red('未通过')} - ${result.details.appointmentCheck.reason || 'OK'}`);
    if (result.details.plateCheck) {
      console.log(`  车牌检查: ${result.details.plateCheck.passed ? chalk.green('通过') : chalk.red('未通过')} - ${result.details.plateCheck.reason || 'OK'}`);
    }
  });

verifyCmd.command('exit')
  .description('出场核验')
  .requiredOption('--name <name>', '访客姓名')
  .requiredOption('--phone <phone>', '访客手机号')
  .option('--plate <plate>', '车牌号')
  .requiredOption('--gate <gate>', '门岗编号')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    const result = verificationService.verify({
      visitorName: options.name,
      visitorPhone: options.phone,
      plateNumber: options.plate,
      type: 'exit',
      gate: options.gate,
      operator: options.operator
    });

    if (result.allowed) {
      printSuccess(result.reason);
    } else {
      printError(result.reason);
    }
  });

const recordsCmd = program.command('records')
  .description('核验记录');

recordsCmd.command('list')
  .description('列出核验记录')
  .option('--result <result>', '筛选结果 (allowed|denied)')
  .option('--gate <gate>', '筛选门岗')
  .option('--limit <number>', '返回数量', '50')
  .action((options) => {
    const records = verificationService.getRecords(
      {
        result: options.result as 'allowed' | 'denied',
        gate: options.gate
      },
      parseInt(options.limit)
    );

    if (records.length === 0) {
      printInfo('暂无核验记录');
      return;
    }

    printTable(
      ['时间', '类型', '访客', '手机号', '车牌', '门岗', '结果', '原因'],
      records.map(r => [
        r.timestamp.substring(0, 19).replace('T', ' '),
        r.type === 'entry' ? '入场' : '出场',
        r.visitorName,
        r.visitorPhone,
        r.plateNumber || '-',
        r.gate,
        r.result === 'allowed' ? chalk.green('放行') : chalk.red('拒绝'),
        r.reason.substring(0, 20)
      ])
    );
  });

recordsCmd.command('stats')
  .description('统计数据')
  .action(() => {
    const stats = verificationService.getStats();
    console.log('\n核验统计:');
    console.log(`  总核验次数: ${stats.total}`);
    console.log(`  放行次数: ${chalk.green(stats.allowed.toString())}`);
    console.log(`  拒绝次数: ${chalk.red(stats.denied.toString())}`);
    console.log(`  放行率: ${chalk.cyan(stats.allowedRate)}\n`);
  });

recordsCmd.command('export')
  .description('导出核验记录')
  .requiredOption('--output <path>', '输出文件路径')
  .option('--limit <number>', '导出数量', '1000')
  .action((options) => {
    const data = verificationService.exportRecords({}, parseInt(options.limit));
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, data, 'utf8');
    printSuccess(`已导出到 ${outputPath}`);
  });

const logsCmd = program.command('logs')
  .description('查看日志');

logsCmd.command('list')
  .description('列出日志')
  .option('--limit <number>', '返回数量', '50')
  .action((options) => {
    const logs = logger.readLogs(parseInt(options.limit));
    if (logs.length === 0) {
      printInfo('暂无日志记录');
      return;
    }

    printTable(
      ['时间', '级别', '消息'],
      logs.map((l: any) => [
        l.timestamp.substring(0, 19).replace('T', ' '),
        l.level,
        l.message
      ])
    );
  });

const importCmd = program.command('import')
  .description('批量导入');

importCmd.command('appointments')
  .description('批量导入预约')
  .requiredOption('--file <path>', 'JSON文件路径')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    try {
      const filePath = path.resolve(options.file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = appointmentService.importBatch(data, options.operator);
      printSuccess(`导入完成: 总计${result.total}条, 新增${result.created}条, 跳过${result.skipped}条`);
    } catch (error) {
      printError(`导入失败: ${(error as Error).message}`);
    }
  });

importCmd.command('blacklist')
  .description('批量导入黑名单')
  .requiredOption('--file <path>', 'JSON文件路径')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    try {
      const filePath = path.resolve(options.file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = blacklistService.importBatch(data, options.operator);
      printSuccess(`导入完成: 总计${result.total}条, 新增${result.added}条, 跳过${result.skipped}条`);
    } catch (error) {
      printError(`导入失败: ${(error as Error).message}`);
    }
  });

importCmd.command('plates')
  .description('批量导入临时车牌')
  .requiredOption('--file <path>', 'JSON文件路径')
  .requiredOption('--operator <operator>', '操作员')
  .action((options) => {
    try {
      const filePath = path.resolve(options.file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = temporaryPlateService.importBatch(data, options.operator);
      printSuccess(`导入完成: 总计${result.total}条, 新增${result.added}条, 跳过${result.skipped}条`);
    } catch (error) {
      printError(`导入失败: ${(error as Error).message}`);
    }
  });

export { program };
