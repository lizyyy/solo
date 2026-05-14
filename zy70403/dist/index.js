#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const database_1 = require("./database");
const demoData_1 = require("./demoData");
const program = new commander_1.Command();
program
    .name('audit')
    .description('错误复现包命令行工具 - 审计数据管理')
    .version('1.0.0');
function printTable(headers, rows) {
    const table = new cli_table3_1.default({
        head: headers.map(h => chalk_1.default.cyan(h)),
        style: { border: ['gray'] }
    });
    rows.forEach(row => table.push(row));
    console.log(table.toString());
}
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('zh-CN');
}
program
    .command('init-demo')
    .description('生成演示数据')
    .action(async () => {
    await (0, demoData_1.generateDemoData)();
    console.log(chalk_1.default.green('\n演示数据已生成，可以使用以下命令查看数据：'));
    console.log(chalk_1.default.gray('  audit list certs       - 查看离线证书'));
    console.log(chalk_1.default.gray('  audit list whitelist   - 查看白名单'));
    console.log(chalk_1.default.gray('  audit list anomalies   - 查看异常样本'));
    console.log(chalk_1.default.gray('  audit list bus         - 查看班车预约'));
    console.log(chalk_1.default.gray('  audit list logs        - 查看操作日志'));
    process.exit(0);
});
const listCmd = program.command('list').description('查询各类数据');
listCmd
    .command('certs')
    .description('查询离线证书')
    .option('--batch <batchId>', '按批次ID筛选')
    .option('--raw', '显示原始数据JSON')
    .action(async (options) => {
    await database_1.db.waitReady();
    let certs;
    if (options.batch) {
        certs = await database_1.db.getCertificatesByBatch(options.batch);
    }
    else {
        certs = await database_1.db.getOfflineCertificates();
    }
    if (certs.length === 0) {
        console.log(chalk_1.default.yellow('未找到证书记录'));
        process.exit(0);
    }
    console.log(chalk_1.default.blue(`\n离线证书列表 (${certs.length}条)`));
    printTable(['证书编号', '申请人', '部门', '签发日期', '状态', '批次'], certs.map(c => [
        c.certNumber,
        c.applicant,
        c.department,
        c.issueDate,
        c.status === 'issued' ? chalk_1.default.green('已签发') : c.status === 'revoked' ? chalk_1.default.red('已撤销') : chalk_1.default.yellow('已过期'),
        c.batchId
    ]));
    if (options.raw) {
        console.log(chalk_1.default.blue('\n原始数据详情：'));
        certs.forEach(c => {
            console.log(chalk_1.default.gray(`\n[${c.certNumber}]`));
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
    await database_1.db.waitReady();
    let whitelists;
    if (options.unrevoked) {
        whitelists = await database_1.db.getUnrevokedTemporaryWhitelist();
        console.log(chalk_1.default.yellow('\n⚠️  待复核的未撤销临时白名单：'));
    }
    else {
        const opts = {};
        if (options.temp !== undefined)
            opts.isTemporary = true;
        if (options.revoked !== undefined)
            opts.isRevoked = options.revoked;
        whitelists = await database_1.db.getWhitelists(opts);
    }
    if (whitelists.length === 0) {
        console.log(chalk_1.default.yellow('未找到白名单记录'));
        process.exit(0);
    }
    printTable(['员工姓名', '工号', '部门', '原因', '类型', '有效期', '状态', '操作人'], whitelists.map(w => [
        w.employeeName,
        w.employeeId,
        w.department,
        w.reason.substring(0, 15) + (w.reason.length > 15 ? '...' : ''),
        w.isTemporary ? chalk_1.default.yellow('临时') : chalk_1.default.blue('永久'),
        `${w.startDate} 至 ${w.endDate}`,
        w.isRevoked ? chalk_1.default.red('已撤销') : chalk_1.default.green('生效中'),
        w.operator
    ]));
    process.exit(0);
});
listCmd
    .command('anomalies')
    .description('查询异常样本')
    .option('--risk <type>', '按风险类型筛选')
    .option('--status <status>', '按状态筛选 (pending/reviewed/resolved)')
    .option('--raw', '显示原始数据JSON')
    .action(async (options) => {
    await database_1.db.waitReady();
    const opts = {};
    if (options.risk)
        opts.riskType = options.risk;
    if (options.status)
        opts.status = options.status;
    const anomalies = await database_1.db.getAnomalySamples(opts);
    if (anomalies.length === 0) {
        console.log(chalk_1.default.yellow('未找到异常样本'));
        process.exit(0);
    }
    console.log(chalk_1.default.blue(`\n异常样本列表 (${anomalies.length}条)`));
    printTable(['样本ID', '风险类型', '描述', '来源', '状态', '发现人'], anomalies.map(a => [
        a.sampleId,
        chalk_1.default.red(a.riskType),
        a.description.substring(0, 25) + (a.description.length > 25 ? '...' : ''),
        a.source,
        a.status === 'pending' ? chalk_1.default.yellow('待处理') : a.status === 'reviewed' ? chalk_1.default.blue('已复核') : chalk_1.default.green('已解决'),
        a.discoveredBy
    ]));
    if (options.raw) {
        console.log(chalk_1.default.blue('\n原始数据详情：'));
        anomalies.forEach(a => {
            console.log(chalk_1.default.gray(`\n[${a.sampleId}]`));
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
    await database_1.db.waitReady();
    let reservations;
    if (options.batch) {
        reservations = await database_1.db.getBusReservationsByBatch(options.batch);
    }
    else {
        const allBatches = await database_1.db.getOperationLogs({ operationType: '导入班车预约' });
        if (allBatches.length > 0) {
            reservations = await database_1.db.getBusReservationsByBatch(allBatches[0].batchId);
        }
        else {
            reservations = [];
        }
    }
    if (options.withNotes) {
        reservations = reservations.filter(r => r.manualNote && r.manualNote.trim());
    }
    if (reservations.length === 0) {
        console.log(chalk_1.default.yellow('未找到班车预约记录'));
        process.exit(0);
    }
    console.log(chalk_1.default.blue(`\n班车预约列表 (${reservations.length}条)`));
    printTable(['行号', '姓名', '工号', '部门', '线路', '预约日期', '人工备注'], reservations.map(r => [
        chalk_1.default.gray(r.rowNumber.toString()),
        r.employeeName,
        r.employeeId,
        r.department,
        r.route,
        r.reservationDate,
        r.manualNote ? chalk_1.default.magenta(r.manualNote) : '-'
    ]));
    console.log(chalk_1.default.gray(`\n💡 提示：按原始行号可追溯到原始Excel文件中的对应行`));
    process.exit(0);
});
listCmd
    .command('logs')
    .description('查询操作日志')
    .option('--batch <batchId>', '按批次ID筛选')
    .option('--operator <name>', '按操作人筛选')
    .option('--type <type>', '按操作类型筛选')
    .action(async (options) => {
    await database_1.db.waitReady();
    const opts = {};
    if (options.batch)
        opts.batchId = options.batch;
    if (options.operator)
        opts.operator = options.operator;
    if (options.type)
        opts.operationType = options.type;
    const logs = await database_1.db.getOperationLogs(opts);
    if (logs.length === 0) {
        console.log(chalk_1.default.yellow('未找到操作日志'));
        process.exit(0);
    }
    console.log(chalk_1.default.blue(`\n操作日志列表 (${logs.length}条)`));
    printTable(['操作类型', '操作人', '批次ID', '影响数量', '描述', '执行时间'], logs.map(l => [
        l.operationType,
        l.operator,
        l.batchId,
        l.affectedCount,
        l.description.substring(0, 20) + (l.description.length > 20 ? '...' : ''),
        formatDate(l.executedAt)
    ]));
    process.exit(0);
});
program
    .command('revoke-whitelist')
    .description('批量撤销白名单（带预览）')
    .option('--all-temp', '撤销所有临时白名单')
    .option('--ids <ids>', '指定ID列表，逗号分隔')
    .action(async (options) => {
    await database_1.db.waitReady();
    let candidates = [];
    if (options.allTemp) {
        candidates = await database_1.db.getWhitelists({ isTemporary: true, isRevoked: false });
    }
    else if (options.ids) {
        const ids = options.ids.split(',').map((id) => parseInt(id.trim()));
        const all = await database_1.db.getWhitelists();
        candidates = all.filter(w => ids.includes(w.id));
    }
    if (candidates.length === 0) {
        console.log(chalk_1.default.yellow('没有可撤销的白名单记录'));
        process.exit(0);
    }
    console.log(chalk_1.default.yellow('\n📋 候选撤销清单（请确认）：'));
    printTable(['ID', '员工姓名', '部门', '原因', '类型', '有效期'], candidates.map(w => [
        w.id,
        w.employeeName,
        w.department,
        w.reason.substring(0, 20) + (w.reason.length > 20 ? '...' : ''),
        w.isTemporary ? '临时' : '永久',
        `${w.startDate} 至 ${w.endDate}`
    ]));
    const answer = await inquirer_1.default.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `确认撤销以上 ${candidates.length} 条白名单吗？`,
            default: false
        }]);
    if (!answer.confirm) {
        console.log(chalk_1.default.gray('已取消操作'));
        process.exit(0);
    }
    const batchId = candidates[0].batchId;
    for (const w of candidates) {
        await database_1.db.revokeWhitelistById(w.id);
    }
    const logId = await database_1.db.insertOperationLog({
        operationType: '撤销白名单',
        operator: '当前用户',
        batchId: batchId,
        affectedCount: candidates.length,
        description: `批量撤销${candidates.length}条白名单`,
        executedAt: new Date().toISOString(),
        isRollback: false
    });
    console.log(chalk_1.default.green(`\n✅ 成功撤销 ${candidates.length} 条白名单！`));
    console.log(chalk_1.default.gray(`操作日志ID: ${logId}`));
    process.exit(0);
});
program
    .command('cleanup')
    .description('清理数据（生成候选清单）')
    .option('--batch <batchId>', '清理指定批次的证书')
    .option('--preview', '仅预览不执行')
    .action(async (options) => {
    await database_1.db.waitReady();
    if (!options.batch) {
        console.log(chalk_1.default.red('请指定 --batch 参数'));
        process.exit(1);
    }
    const certs = await database_1.db.getCertificatesByBatch(options.batch);
    if (certs.length === 0) {
        console.log(chalk_1.default.yellow('该批次没有证书记录'));
        process.exit(0);
    }
    console.log(chalk_1.default.yellow('\n📋 候选清理清单：'));
    printTable(['证书编号', '申请人', '部门', '签发日期', '状态'], certs.map(c => [
        c.certNumber,
        c.applicant,
        c.department,
        c.issueDate,
        c.status
    ]));
    if (options.preview) {
        console.log(chalk_1.default.gray('\n预览模式，未执行实际删除'));
        process.exit(0);
    }
    const answer = await inquirer_1.default.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk_1.default.red(`⚠️  确认删除以上 ${certs.length} 条证书吗？此操作不可直接恢复！`),
            default: false
        }]);
    if (!answer.confirm) {
        console.log(chalk_1.default.gray('已取消操作'));
        process.exit(0);
    }
    const deleted = await database_1.db.deleteCertificatesByBatch(options.batch);
    console.log(chalk_1.default.green(`\n✅ 已删除 ${deleted} 条证书记录`));
    console.log(chalk_1.default.yellow('💡 提示：如需恢复，请联系数据库管理员从备份恢复'));
    process.exit(0);
});
program
    .command('review')
    .description('复核待处理事项')
    .action(async () => {
    await database_1.db.waitReady();
    const tempWhitelist = await database_1.db.getUnrevokedTemporaryWhitelist();
    const pendingAnomalies = await database_1.db.getAnomalySamples({ status: 'pending' });
    console.log(chalk_1.default.blue('\n========== 复核清单 =========='));
    if (tempWhitelist.length > 0) {
        console.log(chalk_1.default.yellow(`\n⚠️  待撤销临时白名单 (${tempWhitelist.length}条):`));
        tempWhitelist.forEach((w, i) => {
            console.log(`  ${i + 1}. ${w.employeeName} (${w.department}) - ${w.reason}`);
        });
        const answer = await inquirer_1.default.prompt([{
                type: 'confirm',
                name: 'revoke',
                message: '是否立即撤销这些临时白名单？',
                default: true
            }]);
        if (answer.revoke) {
            for (const w of tempWhitelist) {
                await database_1.db.revokeWhitelistById(w.id);
            }
            console.log(chalk_1.default.green(`✅ 已撤销 ${tempWhitelist.length} 条临时白名单`));
        }
    }
    if (pendingAnomalies.length > 0) {
        console.log(chalk_1.default.yellow(`\n⚠️  待处理异常样本 (${pendingAnomalies.length}条):`));
        pendingAnomalies.forEach((a, i) => {
            console.log(`  ${i + 1}. [${a.riskType}] ${a.description.substring(0, 30)}...`);
        });
    }
    if (tempWhitelist.length === 0 && pendingAnomalies.length === 0) {
        console.log(chalk_1.default.green('\n✅ 没有待复核事项'));
    }
    process.exit(0);
});
program.parseAsync(process.argv).catch(err => {
    console.error(chalk_1.default.red('执行出错:'), err);
    process.exit(1);
});
