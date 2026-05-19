"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCLI = runCLI;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const storage_1 = require("./storage");
const rules_1 = require("./rules");
const types_1 = require("./types");
const exporter_1 = require("./exporter");
const program = new commander_1.Command();
program
    .name('bso')
    .description('换电运营值班员台账管理CLI工具')
    .version('1.0.0');
program
    .command('stats')
    .description('查看系统统计信息')
    .action(() => {
    const stats = storage_1.storage.getStatistics();
    console.log(chalk_1.default.bold('\n📊 系统统计信息'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`总记录数: ${chalk_1.default.cyan(stats.totalRecords)}`);
    console.log(`待处理记录: ${chalk_1.default.yellow(stats.pendingRecords)}`);
    console.log(`已解决记录: ${chalk_1.default.green(stats.resolvedRecords)}`);
    console.log(`离线柜子数: ${chalk_1.default.red(stats.offlineCabinets)}`);
    console.log(`批量操作数: ${chalk_1.default.magenta(stats.totalBatches)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
program
    .command('add')
    .description('添加故障记录')
    .requiredOption('-c, --cabinet <id>', '柜子ID')
    .requiredOption('-t, --type <type>', `故障类型: ${Object.values(types_1.FaultType).join(' | ')}`)
    .requiredOption('-d, --desc <description>', '故障描述')
    .requiredOption('-r, --reporter <name>', '上报人')
    .option('-h, --handler <name>', '处理人')
    .action((options) => {
    if (!Object.values(types_1.FaultType).includes(options.type)) {
        console.log(chalk_1.default.red(`❌ 无效的故障类型。可选值: ${Object.values(types_1.FaultType).join(', ')}`));
        return;
    }
    const record = storage_1.storage.addRecord({
        cabinetId: options.cabinet,
        faultType: options.type,
        description: options.desc,
        reporter: options.reporter,
        handler: options.handler,
        status: types_1.RecordStatus.PENDING,
        isOffline: storage_1.storage.isCabinetOffline(options.cabinet)
    });
    const result = rules_1.ruleEngine.processRecord(record);
    console.log(chalk_1.default.bold('\n📝 处理结果'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`记录ID: ${chalk_1.default.cyan(result.record.id.slice(0, 8))}`);
    console.log(`柜子: ${chalk_1.default.cyan(result.record.cabinetId)}`);
    console.log(`故障类型: ${chalk_1.default.yellow(result.record.faultType)}`);
    console.log(`处理结果: ${result.overallResult === types_1.ProcessingResult.ALLOWED ? chalk_1.default.green(result.overallResult) : chalk_1.default.red(result.overallResult)}`);
    console.log(`原因: ${chalk_1.default.gray(result.reason)}`);
    if (result.mergedTo) {
        console.log(`合并到: ${chalk_1.default.magenta(result.mergedTo.slice(0, 8))}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
program
    .command('list')
    .description('列出故障记录')
    .option('-h, --handler <name>', '按处理人筛选')
    .option('-c, --cabinet <id>', '按柜子ID筛选')
    .option('-s, --status <status>', `按状态筛选: ${Object.values(types_1.RecordStatus).join(' | ')}`)
    .option('-t, --type <type>', `按故障类型筛选: ${Object.values(types_1.FaultType).join(' | ')}`)
    .option('--start <date>', '开始日期 (YYYY-MM-DD)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD)')
    .option('-l, --limit <number>', '显示数量限制', '20')
    .action((options) => {
    const filter = {};
    if (options.handler)
        filter.handler = options.handler;
    if (options.cabinet)
        filter.cabinetId = options.cabinet;
    if (options.status)
        filter.status = options.status;
    if (options.type)
        filter.faultType = options.type;
    if (options.start)
        filter.startDate = options.start;
    if (options.end)
        filter.endDate = options.end;
    let records = storage_1.storage.getRecords(filter);
    const limit = parseInt(options.limit);
    if (limit > 0 && records.length > limit) {
        records = records.slice(0, limit);
    }
    const table = new cli_table3_1.default({
        head: ['ID', '柜子', '故障类型', '状态', '上报人', '处理人', '处理结果', '创建时间'],
        colWidths: [12, 10, 14, 10, 10, 10, 10, 20]
    });
    records.forEach(r => {
        const resultColor = r.processingResult === types_1.ProcessingResult.ALLOWED ? chalk_1.default.green : chalk_1.default.red;
        table.push([
            r.id.slice(0, 8),
            r.cabinetId,
            r.faultType,
            r.status,
            r.reporter,
            r.handler || '-',
            r.processingResult ? resultColor(r.processingResult) : '-',
            new Date(r.createdAt).toLocaleString('zh-CN')
        ]);
    });
    console.log(chalk_1.default.bold(`\n📋 故障记录列表 (共 ${storage_1.storage.getRecords(filter).length} 条)`));
    console.log(table.toString());
    console.log();
});
program
    .command('view <id>')
    .description('查看记录详情')
    .action((id) => {
    const record = storage_1.storage.getRecord(id);
    if (!record) {
        console.log(chalk_1.default.red(`❌ 未找到记录: ${id}`));
        return;
    }
    console.log(chalk_1.default.bold('\n📋 记录详情'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`记录ID: ${chalk_1.default.cyan(record.id)}`);
    console.log(`柜子ID: ${chalk_1.default.cyan(record.cabinetId)}`);
    console.log(`故障类型: ${chalk_1.default.yellow(record.faultType)}`);
    console.log(`故障描述: ${chalk_1.default.gray(record.description)}`);
    console.log(`上报人: ${chalk_1.default.magenta(record.reporter)}`);
    console.log(`处理人: ${chalk_1.default.magenta(record.handler || '-')}`);
    console.log(`状态: ${chalk_1.default.blue(record.status)}`);
    console.log(`柜子状态: ${record.isOffline ? chalk_1.default.red('离线') : chalk_1.default.green('在线')}`);
    console.log(`处理结果: ${record.processingResult ? (record.processingResult === types_1.ProcessingResult.ALLOWED ? chalk_1.default.green(record.processingResult) : chalk_1.default.red(record.processingResult)) : '-'}`);
    console.log(`处理原因: ${chalk_1.default.gray(record.processingReason || '-')}`);
    console.log(`创建时间: ${new Date(record.createdAt).toLocaleString('zh-CN')}`);
    console.log(`更新时间: ${new Date(record.updatedAt).toLocaleString('zh-CN')}`);
    if (record.mergedFrom && record.mergedFrom.length > 0) {
        console.log(`合并自: ${chalk_1.default.magenta(record.mergedFrom.map(id => id.slice(0, 8)).join(', '))}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
program
    .command('resolve <id>')
    .description('标记记录为已解决')
    .requiredOption('-h, --handler <name>', '处理人')
    .action((id, options) => {
    const record = storage_1.storage.getRecord(id);
    if (!record) {
        console.log(chalk_1.default.red(`❌ 未找到记录: ${id}`));
        return;
    }
    const updated = storage_1.storage.updateRecord(id, {
        status: types_1.RecordStatus.RESOLVED,
        handler: options.handler,
        resolvedAt: new Date().toISOString()
    });
    if (updated) {
        console.log(chalk_1.default.green(`✅ 记录 ${id.slice(0, 8)} 已标记为已解决`));
    }
});
program
    .command('cabinet')
    .description('柜子管理')
    .command('offline <id>')
    .description('标记柜子为离线')
    .action((id) => {
    storage_1.storage.setCabinetOffline(id, true);
    console.log(chalk_1.default.red(`🔴 柜子 ${id} 已标记为离线`));
});
program
    .command('cabinet')
    .command('online <id>')
    .description('标记柜子为在线')
    .action((id) => {
    storage_1.storage.setCabinetOffline(id, false);
    console.log(chalk_1.default.green(`🟢 柜子 ${id} 已标记为在线`));
});
program
    .command('import')
    .description('批量导入JSON文件')
    .requiredOption('-f, --file <path>', 'JSON文件路径')
    .option('--retry <batchId>', '重试失败的记录')
    .action(async (options) => {
    const { batchImport, retryFailed } = await Promise.resolve().then(() => __importStar(require('./batch')));
    if (options.retry) {
        const result = retryFailed(options.retry);
        printBatchResult(result);
    }
    else {
        const result = batchImport(options.file);
        printBatchResult(result);
    }
});
function printBatchResult(result) {
    console.log(chalk_1.default.bold('\n📦 批量操作结果'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`批次ID: ${chalk_1.default.cyan(result.batchId.slice(0, 8))}`);
    console.log(`总数: ${chalk_1.default.gray(result.total)}`);
    console.log(`成功: ${chalk_1.default.green(result.successCount)}`);
    console.log(`失败: ${chalk_1.default.red(result.failureCount)}`);
    if (result.successes.length > 0) {
        console.log(`成功记录: ${chalk_1.default.green(result.successes.map((id) => id.slice(0, 8)).join(', '))}`);
    }
    if (result.failures.length > 0) {
        console.log('\n失败详情:');
        result.failures.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.recordId ? `记录 ${f.recordId.slice(0, 8)}: ` : ''}${chalk_1.default.red(f.error)}`);
        });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
program
    .command('export')
    .description('导出报告')
    .requiredOption('-f, --file <path>', '输出文件路径 (CSV)')
    .option('-h, --handler <name>', '按处理人筛选')
    .option('-c, --cabinet <id>', '按柜子ID筛选')
    .option('-s, --status <status>', `按状态筛选: ${Object.values(types_1.RecordStatus).join(' | ')}`)
    .option('-t, --type <type>', `按故障类型筛选: ${Object.values(types_1.FaultType).join(' | ')}`)
    .option('--start <date>', '开始日期 (YYYY-MM-DD)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD)')
    .action(async (options) => {
    const filter = {};
    if (options.handler)
        filter.handler = options.handler;
    if (options.cabinet)
        filter.cabinetId = options.cabinet;
    if (options.status)
        filter.status = options.status;
    if (options.type)
        filter.faultType = options.type;
    if (options.start)
        filter.startDate = options.start;
    if (options.end)
        filter.endDate = options.end;
    const records = storage_1.storage.getRecords(filter);
    await (0, exporter_1.exportReport)(records, options.file);
    console.log(chalk_1.default.green(`✅ 报告已导出到 ${options.file} (共 ${records.length} 条记录)`));
});
program
    .command('batch <id>')
    .description('查看批量操作结果')
    .action((id) => {
    const batch = storage_1.storage.getBatchResult(id);
    if (!batch) {
        console.log(chalk_1.default.red(`❌ 未找到批次: ${id}`));
        return;
    }
    printBatchResult(batch);
});
function runCLI() {
    program.parse();
}
