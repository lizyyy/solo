#!/usr/bin/env node
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
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const projectService_1 = require("./services/projectService");
const history_1 = require("./utils/history");
const types_1 = require("./types");
const program = new commander_1.Command();
program
    .name('sq')
    .description('调查问卷配额管理 CLI 工具')
    .version('1.0.0');
program
    .command('init')
    .description('初始化项目')
    .option('-s, --sample', '使用内置样例配置')
    .option('-c, --config <path>', '使用自定义配置文件路径')
    .action(async (options) => {
    try {
        console.log(chalk_1.default.blue('\n=== 项目初始化 ===\n'));
        if (options.sample) {
            const state = projectService_1.ProjectService.initializeWithSamples();
            console.log(chalk_1.default.green(`✓ 项目创建成功: ${state.config.name}`));
            console.log(chalk_1.default.cyan(`  渠道数量: ${state.config.channels.length}`));
            console.log(chalk_1.default.cyan(`  配额规则: ${state.config.quotaRules.length} 条`));
            console.log(chalk_1.default.cyan(`  质量规则: ${state.config.qualityRules.length} 条`));
            console.log(chalk_1.default.gray('\n  提示: 使用 "sq load-samples" 加载样例数据'));
        }
        else if (options.config) {
            const configData = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
            const state = projectService_1.ProjectService.initializeCustom(configData);
            console.log(chalk_1.default.green(`✓ 项目创建成功: ${state.config.name}`));
        }
        else {
            const state = projectService_1.ProjectService.initializeWithSamples();
            console.log(chalk_1.default.green(`✓ 已使用样例配置创建项目: ${state.config.name}`));
            console.log(chalk_1.default.gray('\n  提示: 使用 "sq load-samples" 加载样例数据'));
        }
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('load-samples')
    .description('加载内置样例问卷数据')
    .action(async () => {
    try {
        console.log(chalk_1.default.blue('\n=== 加载样例数据 ===\n'));
        const result = projectService_1.ProjectService.loadSampleData();
        console.log(chalk_1.default.green(`✓ 数据导入完成`));
        console.log(chalk_1.default.cyan(`  总数: ${result.total}`));
        console.log(chalk_1.default.cyan(`  新增: ${result.imported}`));
        console.log(chalk_1.default.cyan(`  更新: ${result.updated}`));
        console.log(chalk_1.default.cyan(`  跳过: ${result.skipped}`));
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow(`  错误: ${result.errors.length}`));
            result.errors.forEach(err => {
                console.log(chalk_1.default.yellow(`    - ${err.sourceId}: ${err.error}`));
            });
        }
        console.log(chalk_1.default.gray('\n  提示: 使用 "sq check" 执行质量和配额检查'));
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('import <file>')
    .description('从JSON文件导入问卷数据')
    .action(async (filePath) => {
    try {
        console.log(chalk_1.default.blue('\n=== 导入问卷数据 ===\n'));
        const surveys = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const result = projectService_1.ProjectService.importSurveys(surveys);
        console.log(chalk_1.default.green(`✓ 数据导入完成`));
        console.log(chalk_1.default.cyan(`  文件: ${filePath}`));
        console.log(chalk_1.default.cyan(`  总数: ${result.total}`));
        console.log(chalk_1.default.cyan(`  新增: ${result.imported}`));
        console.log(chalk_1.default.cyan(`  更新: ${result.updated}`));
        console.log(chalk_1.default.cyan(`  跳过: ${result.skipped}`));
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow(`  错误: ${result.errors.length}`));
            result.errors.forEach(err => {
                console.log(chalk_1.default.yellow(`    - ${err.sourceId}: ${err.error}`));
            });
        }
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('check')
    .description('执行质量检查和配额控制')
    .option('-v, --verbose', '显示详细信息')
    .action(async (options) => {
    try {
        console.log(chalk_1.default.blue('\n=== 质量与配额检查 ===\n'));
        const result = projectService_1.ProjectService.checkAll();
        console.log(chalk_1.default.green(`✓ 检查完成`));
        console.log('');
        console.log(chalk_1.default.bold('📊 统计结果:'));
        console.log(chalk_1.default.cyan(`  总数: ${result.total}`));
        console.log(chalk_1.default.green(`  ✅ 有效: ${result.valid}`));
        console.log(chalk_1.default.red(`  ❌ 剔除: ${result.rejected}`));
        console.log(chalk_1.default.yellow(`  ⚠️  超配额: ${result.overQuota}`));
        console.log(chalk_1.default.magenta(`  📋 待审核: ${result.needsReview}`));
        console.log(chalk_1.default.gray(`  处理中: ${result.processed} / 跳过: ${result.skipped}`));
        console.log('');
        if (options.verbose) {
            console.log(chalk_1.default.bold('📋 详细列表:'));
            result.details.forEach((d, i) => {
                const statusColor = d.status === types_1.SurveyStatus.VALID ? chalk_1.default.green :
                    d.status === types_1.SurveyStatus.REJECTED ? chalk_1.default.red :
                        d.status === types_1.SurveyStatus.OVER_QUOTA ? chalk_1.default.yellow :
                            d.status === types_1.SurveyStatus.MANUALLY_RESERVED ? chalk_1.default.blue :
                                d.status === types_1.SurveyStatus.MANUALLY_REJECTED ? chalk_1.default.magenta :
                                    chalk_1.default.gray;
                const newMark = d.isNew ? chalk_1.default.cyan('[新]') : '';
                console.log(`  ${i + 1}. ${newMark} ${d.phone} - ${d.city}/${d.ageGroup}/${d.channel} - ${statusColor(d.status)}`);
                if (d.reasons.length > 0) {
                    console.log(`     原因: ${d.reasons.join(', ')}`);
                }
            });
            console.log('');
        }
        console.log(chalk_1.default.gray('  提示: 使用 "sq report" 查看完整报告'));
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('detail <id>')
    .description('查看问卷详情和历史记录')
    .action(async (id) => {
    try {
        console.log(chalk_1.default.blue('\n=== 问卷详情 ===\n'));
        const survey = projectService_1.ProjectService.getSurveyDetail(id);
        if (!survey) {
            console.error(chalk_1.default.red(`✗ 问卷不存在: ${id}`));
            process.exit(1);
        }
        const statusColor = survey.status === types_1.SurveyStatus.VALID ? chalk_1.default.green :
            survey.status === types_1.SurveyStatus.REJECTED ? chalk_1.default.red :
                survey.status === types_1.SurveyStatus.OVER_QUOTA ? chalk_1.default.yellow :
                    survey.status === types_1.SurveyStatus.MANUALLY_RESERVED ? chalk_1.default.blue :
                        survey.status === types_1.SurveyStatus.MANUALLY_REJECTED ? chalk_1.default.magenta :
                            chalk_1.default.gray;
        console.log(chalk_1.default.bold('📋 基本信息:'));
        console.log(chalk_1.default.cyan(`  ID: ${survey.id}`));
        console.log(chalk_1.default.cyan(`  手机号: ${survey.phone}`));
        console.log(chalk_1.default.cyan(`  渠道: ${survey.channel}`));
        console.log(chalk_1.default.cyan(`  城市: ${survey.city}`));
        console.log(chalk_1.default.cyan(`  年龄段: ${survey.ageGroup}`));
        console.log(chalk_1.default.cyan(`  答题时长: ${survey.duration} 秒`));
        console.log(chalk_1.default.cyan(`  状态: ${statusColor(survey.status)}`));
        console.log('');
        console.log(chalk_1.default.bold('📝 回答内容:'));
        Object.entries(survey.answers).forEach(([q, a]) => {
            console.log(`  ${q}: ${a}`);
        });
        console.log('');
        console.log(chalk_1.default.bold('📜 历史记录:'));
        const historyLines = history_1.HistoryManager.formatHistory(survey.history);
        historyLines.forEach((line, i) => {
            console.log(`  ${i + 1}. ${line}`);
        });
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('report')
    .description('生成配额报告')
    .action(async () => {
    try {
        console.log(chalk_1.default.blue('\n=== 配额报告 ===\n'));
        const report = projectService_1.ProjectService.generateReport();
        console.log(chalk_1.default.bold(`📊 ${report.projectInfo.name}`));
        console.log(chalk_1.default.gray(`  更新时间: ${new Date(report.projectInfo.lastUpdatedAt).toLocaleString('zh-CN')}`));
        console.log(chalk_1.default.gray(`  版本: v${report.projectInfo.processVersion}`));
        console.log('');
        console.log(chalk_1.default.bold('📈 总体统计:'));
        console.log(chalk_1.default.cyan(`  总数: ${report.summary.total}`));
        console.log(chalk_1.default.green(`  ✅ 有效样本: ${report.summary.valid}`));
        console.log(chalk_1.default.red(`  ❌ 剔除样本: ${report.summary.rejected}`));
        console.log(chalk_1.default.yellow(`  ⚠️  超配额样本: ${report.summary.overQuota}`));
        console.log(chalk_1.default.magenta(`  📋 待审核: ${report.summary.needsReview}`));
        console.log(chalk_1.default.gray(`  待处理: ${report.summary.pending}`));
        console.log('');
        console.log(chalk_1.default.bold('📦 配额使用情况:'));
        report.quotaUsage.forEach(q => {
            const percent = Math.round((q.used / q.limit) * 100);
            const barLength = Math.min(30, Math.round(percent / 3.33));
            const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
            const color = q.remaining > 0 ? chalk_1.default.green : chalk_1.default.red;
            console.log(`  ${color(q.ruleName)}:`);
            console.log(`    ${color(bar)} ${color(percent + '%')}`);
            console.log(`    已用: ${q.used}/${q.limit} | 剩余: ${q.remaining} | 超限: ${q.overQuota}`);
        });
        console.log('');
        if (report.needToFill.length > 0) {
            console.log(chalk_1.default.bold.yellow('⚠️  待补充样本:'));
            report.needToFill.forEach(n => {
                console.log(`  - ${n.rule}: 还需 ${chalk_1.default.yellow(n.need)} 份`);
                console.log(`    条件: ${JSON.stringify(n.criteria)}`);
            });
            console.log('');
        }
        console.log(chalk_1.default.bold('📊 渠道分布:'));
        Object.entries(report.channelStats).forEach(([channel, stats]) => {
            const rate = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
            console.log(`  ${channel}: 总数 ${stats.total} | 有效 ${stats.valid} (${rate}%)`);
        });
        console.log('');
        console.log(chalk_1.default.bold('📍 城市分布:'));
        Object.entries(report.cityStats).forEach(([city, stats]) => {
            const rate = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
            console.log(`  ${city}: 总数 ${stats.total} | 有效 ${stats.valid} (${rate}%)`);
        });
        console.log('');
        console.log(chalk_1.default.bold('🎂 年龄分布:'));
        Object.entries(report.ageStats).forEach(([age, stats]) => {
            const rate = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
            console.log(`  ${age}岁: 总数 ${stats.total} | 有效 ${stats.valid} (${rate}%)`);
        });
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('reserve <id>')
    .description('人工保留问卷')
    .requiredOption('-o, --operator <name>', '操作者姓名')
    .requiredOption('-r, --reason <text>', '保留原因')
    .action(async (id, options) => {
    try {
        console.log(chalk_1.default.blue('\n=== 人工保留 ===\n'));
        const updated = projectService_1.ProjectService.manuallyReserve(id, options.operator, options.reason);
        console.log(chalk_1.default.green(`✓ 问卷已保留`));
        console.log(chalk_1.default.cyan(`  ID: ${updated.id}`));
        console.log(chalk_1.default.cyan(`  操作者: ${options.operator}`));
        console.log(chalk_1.default.cyan(`  原因: ${options.reason}`));
        const lastEntry = updated.history[updated.history.length - 1];
        if (lastEntry?.details) {
            console.log(chalk_1.default.gray(`  状态变更: ${lastEntry.details.beforeStatus} → ${lastEntry.details.afterStatus}`));
        }
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('reject <id>')
    .description('人工驳回问卷')
    .requiredOption('-o, --operator <name>', '操作者姓名')
    .requiredOption('-r, --reason <text>', '驳回原因')
    .action(async (id, options) => {
    try {
        console.log(chalk_1.default.blue('\n=== 人工驳回 ===\n'));
        const updated = projectService_1.ProjectService.manuallyReject(id, options.operator, options.reason);
        console.log(chalk_1.default.green(`✓ 问卷已驳回`));
        console.log(chalk_1.default.cyan(`  ID: ${updated.id}`));
        console.log(chalk_1.default.cyan(`  操作者: ${options.operator}`));
        console.log(chalk_1.default.cyan(`  原因: ${options.reason}`));
        const lastEntry = updated.history[updated.history.length - 1];
        if (lastEntry?.details) {
            console.log(chalk_1.default.gray(`  状态变更: ${lastEntry.details.beforeStatus} → ${lastEntry.details.afterStatus}`));
        }
        console.log('');
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program
    .command('clear')
    .description('清除所有数据（慎用）')
    .option('-f, --force', '强制清除，无需确认')
    .action(async (options) => {
    try {
        if (!options.force) {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            const answer = await new Promise((resolve) => {
                rl.question(chalk_1.default.yellow('⚠️  此操作将清除所有数据，确定要继续吗？(yes/no): '), resolve);
            });
            rl.close();
            if (answer.toLowerCase() !== 'yes') {
                console.log(chalk_1.default.gray('已取消操作'));
                return;
            }
        }
        projectService_1.ProjectService.clearData();
        console.log(chalk_1.default.green('\n✓ 所有数据已清除\n'));
    }
    catch (e) {
        console.error(chalk_1.default.red(`✗ 错误: ${e.message}`));
        process.exit(1);
    }
});
program.parseAsync(process.argv);
