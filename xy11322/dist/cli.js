#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const importService_1 = require("./services/importService");
const billingService_1 = require("./services/billingService");
const queryService_1 = require("./services/queryService");
const store_1 = require("./store");
const OPERATOR = process.env.AGRI_OPERATOR || 'system';
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .command('import <file>', '导入CSV作业记录', (y) => y
    .positional('file', { type: 'string', demandOption: true, describe: 'CSV文件路径' })
    .option('skip-duplicates', { type: 'boolean', default: true, describe: '跳过重复记录' })
    .option('validate-only', { type: 'boolean', default: false, describe: '仅验证不导入' })
    .option('operator', { type: 'string', default: OPERATOR, describe: '操作人' }), async (argv) => {
    try {
        const result = await importService_1.importService.importCSV({
            filePath: argv.file,
            operator: argv.operator,
            skipDuplicates: argv['skip-duplicates'],
            validateOnly: argv['validate-only'],
        });
        console.log('导入结果:');
        console.log(`  总计: ${result.total}`);
        console.log(`  成功: ${result.success}`);
        console.log(`  失败: ${result.failed}`);
        console.log(`  重复: ${result.duplicates}`);
        if (result.errors.length > 0) {
            console.log('\n错误详情:');
            result.errors.forEach((e) => {
                console.log(`  第${e.row}行 (${e.recordNo || '无编号'}): ${e.errors.join(', ')}`);
            });
        }
    }
    catch (error) {
        console.error('导入失败:', error.message);
        process.exit(1);
    }
})
    .command('calculate [recordId]', '计算计费', (y) => y
    .positional('recordId', { type: 'string', describe: '记录ID' })
    .option('all-pending', { type: 'boolean', default: false, describe: '计算所有待处理记录' })
    .option('operator', { type: 'string', default: OPERATOR, describe: '操作人' }), async (argv) => {
    try {
        if (argv['all-pending']) {
            const results = billingService_1.billingService.calculateAllPending(argv.operator);
            console.log(`已计算 ${results.length} 条记录:`);
            results.forEach((r) => {
                console.log(`  ${r.recordNo}: ${r.status} - ¥${r.finalAmount}`);
                if (r.exceptions.length > 0) {
                    r.exceptions.forEach((e) => {
                        console.log(`    [${e.severity}] ${e.message}`);
                    });
                }
            });
        }
        else if (argv.recordId) {
            const result = billingService_1.billingService.calculateAndUpdateRecord(argv.recordId, argv.operator);
            if (result) {
                console.log(`记录 ${result.recordNo} 计算结果:`);
                console.log(`  状态: ${result.status}`);
                console.log(`  计算金额: ¥${result.calculatedAmount}`);
                console.log(`  最终金额: ¥${result.finalAmount}`);
                if (result.adjustments.length > 0) {
                    console.log('  调整项:');
                    result.adjustments.forEach((a) => {
                        console.log(`    ${a.type}: ${a.reason} (+¥${a.amount})`);
                    });
                }
                if (result.exceptions.length > 0) {
                    console.log('  异常:');
                    result.exceptions.forEach((e) => {
                        console.log(`    [${e.severity}] ${e.message}`);
                    });
                }
            }
            else {
                console.error('未找到该记录');
                process.exit(1);
            }
        }
        else {
            console.error('请提供 recordId 或使用 --all-pending');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('计算失败:', error.message);
        process.exit(1);
    }
})
    .command('bill [recordId]', '结算账单', (y) => y
    .positional('recordId', { type: 'string', describe: '记录ID' })
    .option('all-valid', { type: 'boolean', default: false, describe: '结算所有有效记录' })
    .option('operator', { type: 'string', default: OPERATOR, describe: '操作人' }), async (argv) => {
    try {
        let result;
        if (argv['all-valid']) {
            result = billingService_1.billingService.billAllValid(argv.operator);
        }
        else if (argv.recordId) {
            result = billingService_1.billingService.billRecords([argv.recordId], argv.operator);
        }
        else {
            console.error('请提供 recordId 或使用 --all-valid');
            process.exit(1);
            return;
        }
        console.log(`结算结果:`);
        console.log(`  成功: ${result.success.length}`);
        console.log(`  失败: ${result.failed.length}`);
    }
    catch (error) {
        console.error('结算失败:', error.message);
        process.exit(1);
    }
})
    .command('review <recordId> <notes>', '复核记录', (y) => y
    .positional('recordId', { type: 'string', demandOption: true, describe: '记录ID' })
    .positional('notes', { type: 'string', demandOption: true, describe: '复核意见' })
    .option('approve', { type: 'boolean', default: true, describe: '是否批准' })
    .option('operator', { type: 'string', default: OPERATOR, describe: '操作人' }), async (argv) => {
    try {
        const result = billingService_1.billingService.reviewRecord(argv.recordId, argv.operator, argv.notes, argv.approve);
        if (result) {
            console.log(`复核完成: ${result.recordNo} - ${result.status}`);
        }
        else {
            console.error('未找到该记录');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('复核失败:', error.message);
        process.exit(1);
    }
})
    .command('list', '查询记录列表', (y) => y
    .option('status', { type: 'string', describe: '状态过滤: pending, valid, invalid, billed, reviewed' })
    .option('operator', { type: 'string', describe: '操作人过滤' })
    .option('tractor', { type: 'string', describe: '拖拉机号过滤' })
    .option('billed', { type: 'boolean', describe: '是否已结算' })
    .option('start-date', { type: 'string', describe: '开始日期 (YYYY-MM-DD)' })
    .option('end-date', { type: 'string', describe: '结束日期 (YYYY-MM-DD)' }), async (argv) => {
    try {
        const filter = {};
        if (argv.status)
            filter.status = [argv.status];
        if (argv.operator)
            filter.operator = argv.operator;
        if (argv.tractor)
            filter.tractorNo = argv.tractor;
        if (argv.billed !== undefined)
            filter.isBilled = argv.billed;
        if (argv['start-date'])
            filter.startDate = new Date(argv['start-date']);
        if (argv['end-date'])
            filter.endDate = new Date(argv['end-date']);
        const records = queryService_1.queryService.queryRecords(filter);
        console.log(`找到 ${records.length} 条记录:\n`);
        records.forEach((r) => {
            console.log(`ID: ${r.id}`);
            console.log(`  编号: ${r.recordNo}`);
            console.log(`  机手: ${r.operatorName} (${r.tractorNo})`);
            console.log(`  时间: ${r.startTime.toLocaleString()} - ${r.endTime.toLocaleString()}`);
            console.log(`  计费: ${r.billingType} - ¥${r.finalAmount}`);
            console.log(`  状态: ${r.status}${r.isBilled ? ' (已结算)' : ''}`);
            if (r.exceptions.length > 0) {
                console.log(`  异常: ${r.exceptions.length} 个`);
            }
            console.log('');
        });
    }
    catch (error) {
        console.error('查询失败:', error.message);
        process.exit(1);
    }
})
    .command('show <recordId>', '显示记录详情', (y) => y.positional('recordId', { type: 'string', demandOption: true, describe: '记录ID' }), async (argv) => {
    try {
        const record = queryService_1.queryService.getRecordById(argv.recordId);
        if (!record) {
            console.error('未找到该记录');
            process.exit(1);
            return;
        }
        console.log('记录详情:');
        console.log(JSON.stringify(record, null, 2));
    }
    catch (error) {
        console.error('查询失败:', error.message);
        process.exit(1);
    }
})
    .command('report', '生成报告', (y) => y
    .option('output', { type: 'string', describe: '输出文件路径 (JSON或CSV)' })
    .option('format', { type: 'string', choices: ['json', 'csv'], default: 'json', describe: '输出格式' })
    .option('status', { type: 'string', describe: '状态过滤' })
    .option('operator', { type: 'string', describe: '操作人过滤' })
    .option('start-date', { type: 'string', describe: '开始日期' })
    .option('end-date', { type: 'string', describe: '结束日期' })
    .option('by-operator', { type: 'string', describe: '操作人' }), async (argv) => {
    try {
        const filter = {};
        if (argv.status)
            filter.status = [argv.status];
        if (argv.operator)
            filter.operator = argv.operator;
        if (argv['start-date'])
            filter.startDate = new Date(argv['start-date']);
        if (argv['end-date'])
            filter.endDate = new Date(argv['end-date']);
        const report = queryService_1.queryService.generateReport(filter, argv['by-operator'] || OPERATOR);
        console.log('报告摘要:');
        console.log(`  总记录数: ${report.summary.totalRecords}`);
        console.log(`  总金额: ¥${report.summary.totalAmount}`);
        console.log(`  有效记录: ${report.summary.validRecords}`);
        console.log(`  无效记录: ${report.summary.invalidRecords}`);
        console.log(`  已结算: ${report.summary.billedRecords}`);
        console.log(`  待处理: ${report.summary.pendingRecords}`);
        console.log(`  异常总数: ${report.summary.totalExceptions}`);
        if (argv.output) {
            if (argv.format === 'csv') {
                queryService_1.queryService.exportToCSV(report, argv.output);
                console.log(`\nCSV报告已导出到: ${argv.output}`);
            }
            else {
                queryService_1.queryService.exportToJSON(report, argv.output);
                console.log(`\nJSON报告已导出到: ${argv.output}`);
            }
        }
    }
    catch (error) {
        console.error('生成报告失败:', error.message);
        process.exit(1);
    }
})
    .command('audit', '查看审计日志', (y) => y
    .option('action', { type: 'string', describe: '操作类型过滤' })
    .option('record-id', { type: 'string', describe: '记录ID过滤' })
    .option('operator', { type: 'string', describe: '操作人过滤' })
    .option('limit', { type: 'number', default: 50, describe: '显示数量限制' }), async (argv) => {
    try {
        const filter = {};
        if (argv.action)
            filter.action = argv.action;
        if (argv['record-id'])
            filter.recordId = argv['record-id'];
        if (argv.operator)
            filter.operator = argv.operator;
        const logs = billingService_1.billingService.getAuditLogs(filter).slice(0, argv.limit);
        console.log(`找到 ${logs.length} 条审计日志:\n`);
        logs.forEach((log) => {
            console.log(`[${log.timestamp.toLocaleString()}] ${log.operator} - ${log.action}`);
        });
    }
    catch (error) {
        console.error('查询审计日志失败:', error.message);
        process.exit(1);
    }
})
    .command('config', '查看或更新配置', (y) => y
    .option('hourly-rate', { type: 'number', describe: '设置小时单价' })
    .option('area-rate', { type: 'number', describe: '设置面积单价' })
    .option('fuel-rate', { type: 'number', describe: '设置燃油单价' })
    .option('minimum-charge', { type: 'number', describe: '设置最低收费' })
    .option('operator', { type: 'string', default: OPERATOR, describe: '操作人' }), async (argv) => {
    try {
        const updates = {};
        if (argv['hourly-rate'] !== undefined)
            updates.defaultHourlyRate = argv['hourly-rate'];
        if (argv['area-rate'] !== undefined)
            updates.defaultAreaRate = argv['area-rate'];
        if (argv['fuel-rate'] !== undefined)
            updates.defaultFuelRate = argv['fuel-rate'];
        if (argv['minimum-charge'] !== undefined)
            updates.defaultMinimumCharge = argv['minimum-charge'];
        if (Object.keys(updates).length > 0) {
            const config = store_1.dataStore.updateConfig(updates, argv.operator);
            console.log('配置已更新:');
            console.log(JSON.stringify(config, null, 2));
        }
        else {
            const config = store_1.dataStore.getConfig();
            console.log('当前配置:');
            console.log(JSON.stringify(config, null, 2));
        }
    }
    catch (error) {
        console.error('配置操作失败:', error.message);
        process.exit(1);
    }
})
    .command('stats', '查看统计信息', (y) => y
    .option('start-date', { type: 'string', describe: '开始日期' })
    .option('end-date', { type: 'string', describe: '结束日期' }), async (argv) => {
    try {
        const filter = {};
        if (argv['start-date'])
            filter.startDate = new Date(argv['start-date']);
        if (argv['end-date'])
            filter.endDate = new Date(argv['end-date']);
        const stats = queryService_1.queryService.getStatistics(filter);
        console.log('统计信息:');
        console.log(JSON.stringify(stats, null, 2));
    }
    catch (error) {
        console.error('获取统计信息失败:', error.message);
        process.exit(1);
    }
})
    .demandCommand(1, '请指定一个命令')
    .help()
    .epilogue('农机合作社计费系统 - 帮助信息').argv;
