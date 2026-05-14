#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { db, Certificate, Whitelist, AnomalySample, BusReservation, OperationLog } from './database';
import { generateDemoData } from './demoData';

const program = new Command();

program
  .name('audit')
  .description('错误复现包命令行工具 - 审计数据管理')
  .version('1.0.0');

function printTable(headers: string[], rows: any[][]): void {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { border: ['gray'] }
  });
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN');
}

program
  .command('init-demo')
  .description('生成演示数据')
  .action(async () => {
    await generateDemoData();
    console.log(chalk.green('\n演示数据已生成，可以使用以下命令查看数据：'));
    console.log(chalk.gray('  audit list certs       - 查看离线证书'));
    console.log(chalk.gray('  audit list whitelist   - 查看白名单'));
    console.log(chalk.gray('  audit list anomalies   - 查看异常样本'));
    console.log(chalk.gray('  audit list bus         - 查看班车预约'));
    console.log(chalk.gray('  audit list logs        - 查看操作日志'));
    process.exit(0);
  });

const listCmd = program.command('list').description('查询各类数据');

listCmd
  .command('certs')
  .description('查询离线证书')
  .option('--batch <batchId>', '按批次ID筛选')
  .option('--raw', '显示原始数据JSON')
  .action(async (options) => {
    await db.waitReady();
    let certs: Certificate[];
    if (options.batch) {
      certs = await db.getCertificatesByBatch(options.batch);
    } else {
      certs = await db.getOfflineCertificates();
    }

    if (certs.length === 0) {
      console.log(chalk.yellow('未找到证书记录'));
      process.exit(0);
    }

    console.log(chalk.blue(`\n离线证书列表 (${certs.length}条)`));
    printTable(
      ['证书编号', '申请人', '部门', '签发日期', '状态', '批次'],
      certs.map(c => [
        c.certNumber,
        c.applicant,
        c.department,
        c.issueDate,
        c.status === 'issued' ? chalk.green('已签发') : c.status === 'revoked' ? chalk.red('已撤销') : chalk.yellow('已过期'),
        c.batchId
      ])
    );

    if (options.raw) {
      console.log(chalk.blue('\n原始数据详情：'));
      certs.forEach(c => {
        console.log(chalk.gray(`\n[${c.certNumber}]`));
        console.log(JSON.stringify(JSON.parse(c.originalData), null, 2));
      });
    }
    process.exit(0);
  });

listCmd
  .command('whitelist')
  .description('查询白名单')
  .option('--temp', '仅显示临时白名单')
  .option('--revoked', '仅显示已撤销')
  .option('--unrevoked', '仅显示未撤销的临时白名单（复核用）')
  .action(async (options) => {
    await db.waitReady();
    let whitelists: Whitelist[];
    
    if (options.unrevoked) {
      whitelists = await db.getUnrevokedTemporaryWhitelist();
      console.log(chalk.yellow('\n⚠️  待复核的未撤销临时白名单：'));
    } else {
      const opts: any = {};
      if (options.temp !== undefined) opts.isTemporary = true;
      if (options.revoked !== undefined) opts.isRevoked = options.revoked;
      whitelists = await db.getWhitelists(opts);
    }

    if (whitelists.length === 0) {
      console.log(chalk.yellow('未找到白名单记录'));
      process.exit(0);
    }

    printTable(
      ['员工姓名', '工号', '部门', '原因', '类型', '有效期', '状态', '操作人'],
      whitelists.map(w => [
        w.employeeName,
        w.employeeId,
        w.department,
        w.reason.substring(0, 15) + (w.reason.length > 15 ? '...' : ''),
        w.isTemporary ? chalk.yellow('临时') : chalk.blue('永久'),
        `${w.startDate} 至 ${w.endDate}`,
        w.isRevoked ? chalk.red('已撤销') : chalk.green('生效中'),
        w.operator
      ])
    );
    process.exit(0);
  });

listCmd
  .command('anomalies')
  .description('查询异常样本')
  .option('--risk <type>', '按风险类型筛选')
  .option('--status <status>', '按状态筛选 (pending/reviewed/resolved)')
  .option('--raw', '显示原始数据JSON')
  .action(async (options) => {
    await db.waitReady();
    const opts: any = {};
    if (options.risk) opts.riskType = options.risk;
    if (options.status) opts.status = options.status;

    const anomalies = await db.getAnomalySamples(opts);

    if (anomalies.length === 0) {
      console.log(chalk.yellow('未找到异常样本'));
      process.exit(0);
    }

    console.log(chalk.blue(`\n异常样本列表 (${anomalies.length}条)`));
    printTable(
      ['样本ID', '风险类型', '描述', '来源', '状态', '发现人'],
      anomalies.map(a => [
        a.sampleId,
        chalk.red(a.riskType),
        a.description.substring(0, 25) + (a.description.length > 25 ? '...' : ''),
        a.source,
        a.status === 'pending' ? chalk.yellow('待处理') : a.status === 'reviewed' ? chalk.blue('已复核') : chalk.green('已解决'),
        a.discoveredBy
      ])
    );

    if (options.raw) {
      console.log(chalk.blue('\n原始数据详情：'));
      anomalies.forEach(a => {
        console.log(chalk.gray(`\n[${a.sampleId}]`));
        console.log(JSON.stringify(JSON.parse(a.originalData), null, 2));
      });
    }
    process.exit(0);
  });

listCmd
  .command('bus')
  .description('查询班车预约')
  .option('--batch <batchId>', '按批次ID筛选')
  .option('--with-notes', '仅显示带备注的记录')
  .action(async (options) => {
    await db.waitReady();
    let reservations: BusReservation[];
    
    if (options.batch) {
      reservations = await db.getBusReservationsByBatch(options.batch);
    } else {
      const allBatches = await db.getOperationLogs({ operationType: '导入班车预约' });
      if (allBatches.length > 0) {
        reservations = await db.getBusReservationsByBatch(allBatches[0].batchId);
      } else {
        reservations = [];
      }
    }

    if (options.withNotes) {
      reservations = reservations.filter(r => r.manualNote && r.manualNote.trim());
    }

    if (reservations.length === 0) {
      console.log(chalk.yellow('未找到班车预约记录'));
      process.exit(0);
    }

    console.log(chalk.blue(`\n班车预约列表 (${reservations.length}条)`));
    printTable(
      ['行号', '姓名', '工号', '部门', '线路', '预约日期', '人工备注'],
      reservations.map(r => [
        chalk.gray(r.rowNumber.toString()),
        r.employeeName,
        r.employeeId,
        r.department,
        r.route,
        r.reservationDate,
        r.manualNote ? chalk.magenta(r.manualNote) : '-'
      ])
    );

    console.log(chalk.gray(`\n💡 提示：按原始行号可追溯到原始Excel文件中的对应行`));
    process.exit(0);
  });

listCmd
  .command('logs')
  .description('查询操作日志')
  .option('--batch <batchId>', '按批次ID筛选')
  .option('--operator <name>', '按操作人筛选')
  .option('--type <type>', '按操作类型筛选')
  .action(async (options) => {
    await db.waitReady();
    const opts: any = {};
    if (options.batch) opts.batchId = options.batch;
    if (options.operator) opts.operator = options.operator;
    if (options.type) opts.operationType = options.type;

    const logs = await db.getOperationLogs(opts);

    if (logs.length === 0) {
      console.log(chalk.yellow('未找到操作日志'));
      process.exit(0);
    }

    console.log(chalk.blue(`\n操作日志列表 (${logs.length}条)`));
    printTable(
      ['操作类型', '操作人', '批次ID', '影响数量', '描述', '执行时间'],
      logs.map(l => [
        l.operationType,
        l.operator,
        l.batchId,
        l.affectedCount,
        l.description.substring(0, 20) + (l.description.length > 20 ? '...' : ''),
        formatDate(l.executedAt)
      ])
    );
    process.exit(0);
  });

program
  .command('revoke-whitelist')
  .description('批量撤销白名单（带预览）')
  .option('--all-temp', '撤销所有临时白名单')
  .option('--ids <ids>', '指定ID列表，逗号分隔')
  .action(async (options) => {
    await db.waitReady();
    let candidates: Whitelist[] = [];

    if (options.allTemp) {
      candidates = await db.getWhitelists({ isTemporary: true, isRevoked: false });
    } else if (options.ids) {
      const ids = options.ids.split(',').map((id: string) => parseInt(id.trim()));
      const all = await db.getWhitelists();
      candidates = all.filter(w => ids.includes(w.id!));
    }

    if (candidates.length === 0) {
      console.log(chalk.yellow('没有可撤销的白名单记录'));
      process.exit(0);
    }

    console.log(chalk.yellow('\n📋 候选撤销清单（请确认）：'));
    printTable(
      ['ID', '员工姓名', '部门', '原因', '类型', '有效期'],
      candidates.map(w => [
        w.id,
        w.employeeName,
        w.department,
        w.reason.substring(0, 20) + (w.reason.length > 20 ? '...' : ''),
        w.isTemporary ? '临时' : '永久',
        `${w.startDate} 至 ${w.endDate}`
      ])
    );

    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `确认撤销以上 ${candidates.length} 条白名单吗？`,
      default: false
    }]);

    if (!answer.confirm) {
      console.log(chalk.gray('已取消操作'));
      process.exit(0);
    }

    const batchId = candidates[0].batchId;
    for (const w of candidates) {
      await db.revokeWhitelistById(w.id!);
    }
    
    const logId = await db.insertOperationLog({
      operationType: '撤销白名单',
      operator: '当前用户',
      batchId: batchId,
      affectedCount: candidates.length,
      description: `批量撤销${candidates.length}条白名单`,
      executedAt: new Date().toISOString(),
      isRollback: false
    });

    console.log(chalk.green(`\n✅ 成功撤销 ${candidates.length} 条白名单！`));
    console.log(chalk.gray(`操作日志ID: ${logId}`));
    process.exit(0);
  });

program
  .command('cleanup')
  .description('清理数据（生成候选清单）')
  .option('--batch <batchId>', '清理指定批次的证书')
  .option('--preview', '仅预览不执行')
  .action(async (options) => {
    await db.waitReady();
    if (!options.batch) {
      console.log(chalk.red('请指定 --batch 参数'));
      process.exit(1);
    }

    const certs = await db.getCertificatesByBatch(options.batch);

    if (certs.length === 0) {
      console.log(chalk.yellow('该批次没有证书记录'));
      process.exit(0);
    }

    console.log(chalk.yellow('\n📋 候选清理清单：'));
    printTable(
      ['证书编号', '申请人', '部门', '签发日期', '状态'],
      certs.map(c => [
        c.certNumber,
        c.applicant,
        c.department,
        c.issueDate,
        c.status
      ])
    );

    if (options.preview) {
      console.log(chalk.gray('\n预览模式，未执行实际删除'));
      process.exit(0);
    }

    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: chalk.red(`⚠️  确认删除以上 ${certs.length} 条证书吗？此操作不可直接恢复！`),
      default: false
    }]);

    if (!answer.confirm) {
      console.log(chalk.gray('已取消操作'));
      process.exit(0);
    }

    const deleted = await db.deleteCertificatesByBatch(options.batch);
    console.log(chalk.green(`\n✅ 已删除 ${deleted} 条证书记录`));
    console.log(chalk.yellow('💡 提示：如需恢复，请联系数据库管理员从备份恢复'));
    process.exit(0);
  });

program
  .command('review')
  .description('复核待处理事项')
  .action(async () => {
    await db.waitReady();
    const tempWhitelist = await db.getUnrevokedTemporaryWhitelist();
    const pendingAnomalies = await db.getAnomalySamples({ status: 'pending' });

    console.log(chalk.blue('\n========== 复核清单 =========='));

    if (tempWhitelist.length > 0) {
      console.log(chalk.yellow(`\n⚠️  待撤销临时白名单 (${tempWhitelist.length}条):`));
      tempWhitelist.forEach((w, i) => {
        console.log(`  ${i + 1}. ${w.employeeName} (${w.department}) - ${w.reason}`);
      });

      const answer = await inquirer.prompt([{
        type: 'confirm',
        name: 'revoke',
        message: '是否立即撤销这些临时白名单？',
        default: true
      }]);

      if (answer.revoke) {
        for (const w of tempWhitelist) {
          await db.revokeWhitelistById(w.id!);
        }
        console.log(chalk.green(`✅ 已撤销 ${tempWhitelist.length} 条临时白名单`));
      }
    }

    if (pendingAnomalies.length > 0) {
      console.log(chalk.yellow(`\n⚠️  待处理异常样本 (${pendingAnomalies.length}条):`));
      pendingAnomalies.forEach((a, i) => {
        console.log(`  ${i + 1}. [${a.riskType}] ${a.description.substring(0, 30)}...`);
      });
    }

    if (tempWhitelist.length === 0 && pendingAnomalies.length === 0) {
      console.log(chalk.green('\n✅ 没有待复核事项'));
    }
    process.exit(0);
  });

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('执行出错:'), err);
  process.exit(1);
});
