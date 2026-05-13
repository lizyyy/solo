#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const storage_1 = require("./storage");
const checker_1 = require("./checker");
const reporter_1 = require("./reporter");
const utils_1 = require("./utils");
const ui_1 = require("./ui");
const errors_1 = require("./errors");
const program = new commander_1.Command();
const storage = new storage_1.Storage();
const checker = new checker_1.Checker(storage);
const reporter = new reporter_1.Reporter();
program
    .name('env-drift')
    .description('多环境配置漂移巡检 CLI - 检测测试、预发、生产环境配置差异')
    .version('1.0.0');
async function handleError(fn) {
    try {
        await fn();
    }
    catch (error) {
        if (error instanceof errors_1.CLIError) {
            (0, ui_1.printError)(error.message);
            process.exit(error.exitCode);
        }
        else {
            (0, ui_1.printError)(error.message || '发生未知错误');
            process.exit(1);
        }
    }
}
program
    .command('init')
    .description('初始化配置漂移巡检项目')
    .option('-f, --force', '强制重新初始化（会清除现有数据）')
    .action(async (options) => {
    await handleError(async () => {
        if (options.force) {
            await storage.clear();
            (0, ui_1.printInfo)('已清除现有数据');
        }
        const config = await storage.initialize();
        (0, ui_1.printSuccess)(`项目初始化成功！`);
        console.log(ui_1.colors.gray(`  数据目录: ${config.dataDir}`));
        console.log(ui_1.colors.gray(`  初始化时间: ${(0, utils_1.formatTimestamp)(config.initializedAt)}`));
        console.log('');
        console.log('接下来可以运行以下命令：');
        console.log(ui_1.colors.cyan('  env-drift env add <name>       '), ui_1.colors.dim('添加环境'));
        console.log(ui_1.colors.cyan('  env-drift import <file> --env <name>  '), ui_1.colors.dim('导入配置文件'));
        console.log(ui_1.colors.cyan('  env-drift diff <envA> <envB>  '), ui_1.colors.dim('对比两个环境'));
    });
});
const envCmd = program.command('env').description('环境管理');
envCmd
    .command('list')
    .description('列出所有环境')
    .action(async () => {
    await handleError(async () => {
        const envs = await storage.listEnvironments();
        if (envs.length === 0) {
            (0, ui_1.printWarning)('尚未添加任何环境');
            console.log(ui_1.colors.gray('使用 env-drift env add <name> 添加环境'));
            return;
        }
        (0, ui_1.printHeader)(`环境列表 (${envs.length} 个)`);
        const rows = envs.map(env => [
            env.name,
            env.description || '-',
            (0, utils_1.formatTimestamp)(env.createdAt),
            (0, utils_1.formatTimestamp)(env.updatedAt)
        ]);
        (0, ui_1.printTable)(rows, ['名称', '描述', '创建时间', '更新时间']);
    });
});
envCmd
    .command('add')
    .description('添加新环境')
    .argument('<name>', '环境名称（如: test, staging, production）')
    .option('-d, --description <desc>', '环境描述')
    .action(async (name, options) => {
    await handleError(async () => {
        const now = new Date().toISOString();
        const env = {
            name,
            description: options.description,
            createdAt: now,
            updatedAt: now
        };
        await storage.addEnvironment(env);
        (0, ui_1.printSuccess)(`环境 "${name}" 添加成功！`);
        console.log(ui_1.colors.gray(`使用 env-drift import <file> --env ${name} 导入配置文件`));
    });
});
envCmd
    .command('show')
    .description('显示环境当前配置')
    .argument('<name>', '环境名称')
    .action(async (name) => {
    await handleError(async () => {
        const env = await storage.getEnvironment(name);
        if (!env) {
            (0, errors_1.exitWithError)(`环境 "${name}" 不存在`);
        }
        const data = await storage.getEnvData(name);
        (0, ui_1.printHeader)(`环境: ${name}`);
        console.log(ui_1.colors.gray(`描述: ${env.description || '无'}`));
        console.log(ui_1.colors.gray(`更新时间: ${(0, utils_1.formatTimestamp)(env.updatedAt)}`));
        const keys = Object.keys(data).sort();
        if (keys.length === 0) {
            (0, ui_1.printWarning)('该环境暂无配置数据');
            return;
        }
        const rows = keys.map(key => [key, (0, utils_1.formatValue)(data[key])]);
        (0, ui_1.printTable)(rows, ['配置项', '值']);
    });
});
program
    .command('import')
    .description('从文件导入环境配置')
    .argument('<file>', '配置文件路径（支持 .env, .json, .yaml/.yml）')
    .requiredOption('-e, --env <name>', '目标环境名称')
    .option('-c, --comment <text>', '快照备注')
    .action(async (file, options) => {
    await handleError(async () => {
        const envName = options.env;
        const env = await storage.getEnvironment(envName);
        if (!env) {
            (0, errors_1.exitWithError)(`环境 "${envName}" 不存在，请先使用 env-drift env add ${envName} 创建`);
        }
        const newData = await (0, utils_1.parseConfigFile)(file);
        const oldData = await storage.getEnvData(envName);
        const changes = (0, utils_1.computeChanges)(oldData, newData);
        if (changes.length === 0) {
            (0, ui_1.printInfo)('配置无变化，跳过导入');
            return;
        }
        await storage.saveEnvData(envName, newData);
        const snapshot = {
            id: (0, utils_1.generateId)(),
            environment: envName,
            data: newData,
            createdAt: new Date().toISOString(),
            comment: options.comment
        };
        await storage.createSnapshot(snapshot);
        const timestamp = new Date().toISOString();
        for (const change of changes) {
            const record = {
                id: (0, utils_1.generateId)(),
                environment: envName,
                action: change.action,
                key: change.key,
                oldValue: change.oldValue,
                newValue: change.newValue,
                timestamp,
                snapshotId: snapshot.id
            };
            await storage.addChangeRecord(record);
        }
        (0, ui_1.printSuccess)(`已导入 ${file} 到环境 "${envName}"`);
        console.log(ui_1.colors.cyan(`检测到 ${changes.length} 项变更:`));
        const rows = changes.map(c => {
            const actionLabel = c.action === 'add' ? ui_1.colors.green('新增') :
                c.action === 'delete' ? ui_1.colors.red('删除') :
                    ui_1.colors.yellow('修改');
            return [
                actionLabel,
                c.key,
                c.oldValue ? (0, utils_1.formatValue)(c.oldValue) : '-',
                c.newValue ? (0, utils_1.formatValue)(c.newValue) : '-'
            ];
        });
        (0, ui_1.printTable)(rows, ['操作', '配置项', '原值', '新值']);
    });
});
program
    .command('snapshot')
    .description('创建或查看环境快照')
    .argument('[envName]', '环境名称（可选，不传则查看所有快照）')
    .option('-c, --comment <text>', '快照备注')
    .option('-s, --show <snapshotId>', '查看指定快照详情')
    .action(async (envName, options) => {
    await handleError(async () => {
        if (options.show && envName) {
            const snapshot = await storage.getSnapshot(envName, options.show);
            if (!snapshot) {
                (0, errors_1.exitWithError)(`快照 ${options.show} 在环境 ${envName} 中不存在`);
            }
            (0, ui_1.printHeader)(`快照详情`);
            console.log(ui_1.colors.gray(`快照 ID: ${snapshot.id}`));
            console.log(ui_1.colors.gray(`环境: ${snapshot.environment}`));
            console.log(ui_1.colors.gray(`创建时间: ${(0, utils_1.formatTimestamp)(snapshot.createdAt)}`));
            if (snapshot.comment) {
                console.log(ui_1.colors.gray(`备注: ${snapshot.comment}`));
            }
            const rows = Object.keys(snapshot.data)
                .sort()
                .map(key => [key, (0, utils_1.formatValue)(snapshot.data[key])]);
            (0, ui_1.printTable)(rows, ['配置项', '值']);
            return;
        }
        if (!envName) {
            const envs = await storage.listEnvironments();
            (0, ui_1.printHeader)('所有快照');
            for (const env of envs) {
                const snapshots = await storage.listSnapshots(env.name);
                if (snapshots.length > 0) {
                    console.log(`\n${ui_1.colors.bold(env.name)} (${snapshots.length} 个快照)`);
                    const rows = snapshots.map(s => [
                        s.id.substring(0, 16) + '...',
                        (0, utils_1.formatTimestamp)(s.createdAt),
                        s.comment || '-'
                    ]);
                    (0, ui_1.printTable)(rows, ['快照 ID', '创建时间', '备注']);
                }
            }
            return;
        }
        const env = await storage.getEnvironment(envName);
        if (!env) {
            (0, errors_1.exitWithError)(`环境 "${envName}" 不存在`);
        }
        const currentData = await storage.getEnvData(envName);
        const snapshot = {
            id: (0, utils_1.generateId)(),
            environment: envName,
            data: currentData,
            createdAt: new Date().toISOString(),
            comment: options.comment
        };
        await storage.createSnapshot(snapshot);
        (0, ui_1.printSuccess)(`已为环境 "${envName}" 创建快照`);
        console.log(ui_1.colors.gray(`快照 ID: ${snapshot.id}`));
    });
});
program
    .command('diff')
    .description('对比两个环境的配置差异')
    .argument('<envA>', '第一个环境名称')
    .argument('<envB>', '第二个环境名称')
    .option('-a, --all', '显示所有配置项（包括未变更的）')
    .action(async (envA, envB, options) => {
    await handleError(async () => {
        const [dataA, dataB] = await Promise.all([
            storage.getEnvData(envA),
            storage.getEnvData(envB)
        ]);
        const diffs = (0, utils_1.compareConfigs)(dataA, dataB, envA, envB);
        const changedDiffs = diffs.filter(d => d.type !== 'unchanged');
        (0, ui_1.printHeader)(`${envA} vs ${envB}`);
        if (changedDiffs.length === 0) {
            (0, ui_1.printSuccess)('两个环境配置完全一致！✅');
            return;
        }
        console.log(ui_1.colors.yellow(`发现 ${changedDiffs.length} 项差异`));
        const displayDiffs = options.all ? diffs : changedDiffs;
        const rows = displayDiffs.map(d => [
            (0, ui_1.getDiffTypeLabel)(d.type),
            d.key,
            (0, utils_1.formatValue)(d.envA),
            (0, utils_1.formatValue)(d.envB)
        ]);
        (0, ui_1.printTable)(rows, ['状态', '配置项', envA, envB]);
    });
});
program
    .command('check')
    .description('运行风险规则检查')
    .option('-s, --strict', '遇到 Critical 级别问题时退出码为 1')
    .action(async (options) => {
    await handleError(async () => {
        const envs = await storage.listEnvironments();
        if (envs.length < 2) {
            (0, ui_1.printWarning)('至少需要 2 个环境才能进行有效检查');
        }
        (0, ui_1.printHeader)('风险规则检查');
        const issues = await checker.runChecks();
        if (issues.length === 0) {
            (0, ui_1.printSuccess)('未发现风险问题 ✅');
            return;
        }
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const highCount = issues.filter(i => i.severity === 'high').length;
        const mediumCount = issues.filter(i => i.severity === 'medium').length;
        const lowCount = issues.filter(i => i.severity === 'low').length;
        console.log(`\n${ui_1.colors.bold('问题统计:')}`);
        if (criticalCount > 0)
            console.log(`  ${ui_1.colors.red(`Critical: ${criticalCount}`)}`);
        if (highCount > 0)
            console.log(`  ${ui_1.colors.yellow(`High: ${highCount}`)}`);
        if (mediumCount > 0)
            console.log(`  ${ui_1.colors.magenta(`Medium: ${mediumCount}`)}`);
        if (lowCount > 0)
            console.log(`  ${ui_1.colors.blue(`Low: ${lowCount}`)}`);
        console.log('');
        const rows = issues.map(i => {
            const colorFn = (0, ui_1.getSeverityColor)(i.severity);
            return [
                colorFn(i.severity.toUpperCase()),
                i.ruleName,
                i.environment || (i.affectedEnvironments?.join(', ') || '-'),
                i.key || '-',
                i.message
            ];
        });
        (0, ui_1.printTable)(rows, ['级别', '规则', '环境', '配置项', '问题描述']);
        if (options.strict && criticalCount > 0) {
            process.exit(1);
        }
    });
});
const rulesCmd = program.command('rules').description('风险规则管理');
rulesCmd
    .command('list')
    .description('列出所有风险规则')
    .action(async () => {
    await handleError(async () => {
        const config = await storage.getConfig();
        (0, ui_1.printHeader)(`风险规则列表 (${config.rules.length} 条)`);
        const rows = config.rules.map(r => [
            r.id,
            r.enabled ? ui_1.colors.green('启用') : ui_1.colors.gray('禁用'),
            r.type,
            (0, ui_1.getSeverityColor)(r.severity)(r.severity),
            r.name
        ]);
        (0, ui_1.printTable)(rows, ['ID', '状态', '类型', '级别', '名称']);
    });
});
rulesCmd
    .command('toggle')
    .description('启用/禁用规则')
    .argument('<ruleId>', '规则 ID')
    .action(async (ruleId) => {
    await handleError(async () => {
        const config = await storage.getConfig();
        const rule = config.rules.find(r => r.id === ruleId);
        if (!rule) {
            (0, errors_1.exitWithError)(`规则 "${ruleId}" 不存在`);
        }
        rule.enabled = !rule.enabled;
        await storage.saveRules(config.rules);
        (0, ui_1.printSuccess)(`规则 "${rule.name}" 已${rule.enabled ? '启用' : '禁用'}`);
    });
});
rulesCmd
    .command('add')
    .description('添加自定义规则')
    .requiredOption('-n, --name <name>', '规则名称')
    .requiredOption('-t, --type <type>', '规则类型: value-mismatch|missing-key|extra-key|critical-key')
    .requiredOption('-s, --severity <level>', '严重级别: critical|high|medium|low')
    .option('-k, --key-pattern <pattern>', '键名正则模式（用于 value-mismatch）')
    .option('-v, --expected-value <value>', '期望值（用于 value-mismatch）')
    .option('-m, --must-exist <keys>', '必须存在的键（逗号分隔，用于 missing-key/critical-key）')
    .option('-e, --environments <envs>', '适用环境（逗号分隔）')
    .option('-d, --description <desc>', '规则描述')
    .action(async (options) => {
    await handleError(async () => {
        const config = await storage.getConfig();
        const newRule = {
            id: `rule-${Date.now()}`,
            name: options.name,
            type: options.type,
            severity: options.severity,
            description: options.description || options.name,
            enabled: true,
            config: {
                keyPattern: options.keyPattern,
                expectedValue: options.expectedValue,
                mustExist: options.mustExist ? options.mustExist.split(',') : undefined,
                environments: options.environments ? options.environments.split(',') : undefined
            }
        };
        config.rules.push(newRule);
        await storage.saveRules(config.rules);
        (0, ui_1.printSuccess)(`规则 "${newRule.name}" 已添加`);
    });
});
program
    .command('history')
    .description('查看变更历史')
    .option('-e, --env <name>', '指定环境')
    .option('--start <date>', '开始日期 (YYYY-MM-DD)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD)')
    .option('-l, --limit <number>', '显示条数限制', '50')
    .action(async (options) => {
    await handleError(async () => {
        const records = await storage.getHistory(options.start, options.end, options.env);
        let limit;
        try {
            limit = (0, utils_1.parseNonNegativeInteger)(options.limit);
        }
        catch (e) {
            (0, errors_1.exitWithError)(`无效的 limit 参数: "${options.limit}"，${e.message}`);
        }
        const displayRecords = records.slice(0, limit);
        (0, ui_1.printHeader)(`变更历史 (${displayRecords.length}/${records.length} 条)`);
        if (records.length === 0) {
            (0, ui_1.printInfo)('暂无变更记录');
            return;
        }
        const rows = displayRecords.map(r => {
            const actionLabel = r.action === 'add' ? ui_1.colors.green('新增') :
                r.action === 'delete' ? ui_1.colors.red('删除') :
                    ui_1.colors.yellow('修改');
            let changeStr = '';
            if (r.action === 'add')
                changeStr = `→ ${(0, utils_1.formatValue)(r.newValue)}`;
            else if (r.action === 'delete')
                changeStr = `${(0, utils_1.formatValue)(r.oldValue)} →`;
            else
                changeStr = `${(0, utils_1.formatValue)(r.oldValue)} → ${(0, utils_1.formatValue)(r.newValue)}`;
            return [
                (0, utils_1.formatTimestamp)(r.timestamp),
                r.environment,
                actionLabel,
                r.key,
                changeStr
            ];
        });
        (0, ui_1.printTable)(rows, ['时间', '环境', '操作', '配置项', '变更']);
    });
});
program
    .command('report')
    .description('生成巡检报告')
    .option('-f, --format <format>', '报告格式: html|markdown|both', 'both')
    .option('-o, --output <dir>', '输出目录', '.')
    .option('--diff-all', '包含所有环境两两对比')
    .action(async (options) => {
    await handleError(async () => {
        const environments = await storage.listEnvironments();
        const issues = await checker.runChecks();
        const history = await storage.getHistory();
        const latestSnapshots = {};
        for (const env of environments) {
            const snapshots = await storage.listSnapshots(env.name);
            latestSnapshots[env.name] = snapshots[0];
        }
        const diffs = [];
        if (options.diffAll && environments.length >= 2) {
            for (let i = 0; i < environments.length; i++) {
                for (let j = i + 1; j < environments.length; j++) {
                    const dataA = await storage.getEnvData(environments[i].name);
                    const dataB = await storage.getEnvData(environments[j].name);
                    diffs.push({
                        envA: environments[i].name,
                        envB: environments[j].name,
                        items: (0, utils_1.compareConfigs)(dataA, dataB, environments[i].name, environments[j].name)
                    });
                }
            }
        }
        const context = {
            generatedAt: new Date().toISOString(),
            environments,
            latestSnapshots,
            issues,
            diffs,
            recentHistory: history.slice(0, 50)
        };
        const customReporter = new reporter_1.Reporter(options.output);
        if (options.format === 'html' || options.format === 'both') {
            const htmlPath = await customReporter.generateHTML(context);
            (0, ui_1.printSuccess)(`HTML 报告已生成: ${htmlPath}`);
        }
        if (options.format === 'markdown' || options.format === 'both') {
            const mdPath = await customReporter.generateMarkdown(context);
            (0, ui_1.printSuccess)(`Markdown 报告已生成: ${mdPath}`);
        }
    });
});
const cacheCmd = program.command('cache').description('缓存管理（失效、清理、配置）');
cacheCmd
    .command('info')
    .description('查看缓存统计信息')
    .action(async () => {
    await handleError(async () => {
        const config = await storage.getConfig();
        const info = await storage.getCacheInfo();
        (0, ui_1.printHeader)('缓存统计信息');
        console.log(ui_1.colors.bold('\n📸 快照缓存:'));
        console.log(`  总数: ${info.snapshots.total}`);
        console.log(`  已过期: ${info.snapshots.expired > 0 ? ui_1.colors.yellow(info.snapshots.expired.toString()) : ui_1.colors.green('0')}`);
        console.log(`  保留期限: ${config.cacheConfig.snapshotRetentionDays} 天`);
        const envSnapshots = Object.entries(info.snapshots.byEnvironment);
        if (envSnapshots.length > 0) {
            console.log(ui_1.colors.gray(`  按环境分布:`));
            for (const [env, count] of envSnapshots) {
                console.log(ui_1.colors.gray(`    - ${env}: ${count} 个`));
            }
        }
        console.log(ui_1.colors.bold('\n📜 历史记录缓存:'));
        console.log(`  总数: ${info.history.total}`);
        console.log(`  已过期: ${info.history.expired > 0 ? ui_1.colors.yellow(info.history.expired.toString()) : ui_1.colors.green('0')}`);
        console.log(`  保留期限: ${config.cacheConfig.historyRetentionDays} 天`);
        const envHistory = Object.entries(info.history.byEnvironment);
        if (envHistory.length > 0) {
            console.log(ui_1.colors.gray(`  按环境分布:`));
            for (const [env, count] of envHistory) {
                console.log(ui_1.colors.gray(`    - ${env}: ${count} 条`));
            }
        }
        console.log(ui_1.colors.bold('\n💾 存储占用:'));
        console.log(`  总大小: ${(0, utils_1.formatBytes)(info.storageSize)}`);
        console.log(`  自动失效: ${config.cacheConfig.autoInvalidationEnabled ? ui_1.colors.green('已启用') : ui_1.colors.gray('未启用')}`);
    });
});
cacheCmd
    .command('invalidate')
    .description('清理过期缓存')
    .option('-t, --type <type>', '清理类型: snapshots|history|all', 'all')
    .option('-d, --days <number>', '自定义保留天数（覆盖默认配置）')
    .option('-y, --yes', '跳过确认直接执行')
    .action(async (options) => {
    await handleError(async () => {
        const type = options.type;
        const validTypes = ['snapshots', 'history', 'all'];
        if (!validTypes.includes(type)) {
            (0, errors_1.exitWithError)(`无效的清理类型: "${type}"，必须是: ${validTypes.join(', ')}`);
        }
        let days;
        if (options.days !== undefined) {
            try {
                days = (0, utils_1.parseNonNegativeInteger)(options.days);
            }
            catch (e) {
                (0, errors_1.exitWithError)(`无效的天数: "${options.days}"，${e.message}`);
            }
        }
        const config = await storage.getConfig();
        const info = await storage.getCacheInfo();
        const actualRetentionDays = days ?? (type === 'snapshots' ? config.cacheConfig.snapshotRetentionDays :
            type === 'history' ? config.cacheConfig.historyRetentionDays :
                Math.min(config.cacheConfig.snapshotRetentionDays, config.cacheConfig.historyRetentionDays));
        if (days !== undefined) {
            (0, ui_1.printInfo)(`使用自定义保留天数: ${days} 天`);
        }
        else {
            (0, ui_1.printInfo)(`使用默认保留天数: ${actualRetentionDays} 天`);
        }
        if (type === 'snapshots' || type === 'all') {
            const deleted = await storage.invalidateExpiredSnapshots(days);
            if (deleted > 0) {
                (0, ui_1.printSuccess)(`已清理 ${deleted} 个过期快照`);
            }
            else {
                (0, ui_1.printInfo)('没有过期的快照需要清理');
            }
        }
        if (type === 'history' || type === 'all') {
            const deleted = await storage.invalidateExpiredHistory(days);
            if (deleted > 0) {
                (0, ui_1.printSuccess)(`已清理 ${deleted} 条过期历史记录`);
            }
            else {
                (0, ui_1.printInfo)('没有过期的历史记录需要清理');
            }
        }
    });
});
cacheCmd
    .command('clear')
    .description('强制清理缓存（慎用！）')
    .option('-t, --type <type>', '清理类型: snapshots|history|all', 'all')
    .option('-e, --env <name>', '仅清理指定环境的缓存')
    .option('-s, --snapshot-id <id>', '仅删除指定快照（需配合 --env 使用）')
    .option('-f, --force', '强制清理，跳过警告')
    .action(async (options) => {
    await handleError(async () => {
        const type = options.type;
        const validTypes = ['snapshots', 'history', 'all'];
        if (!validTypes.includes(type)) {
            (0, errors_1.exitWithError)(`无效的清理类型: "${type}"，必须是: ${validTypes.join(', ')}`);
        }
        if (!options.force && !options.snapshotId) {
            (0, ui_1.printWarning)('此操作将永久删除缓存数据，无法恢复！');
            (0, ui_1.printInfo)('使用 --force 跳过此警告');
            (0, errors_1.exitWithError)('操作已取消，请添加 --force 参数确认执行');
        }
        if (options.snapshotId) {
            if (!options.env) {
                (0, errors_1.exitWithError)('删除指定快照必须同时指定 --env 参数');
            }
            const deleted = await storage.deleteSnapshot(options.env, options.snapshotId);
            if (deleted) {
                (0, ui_1.printSuccess)(`已删除快照: ${options.snapshotId}`);
            }
            else {
                (0, errors_1.exitWithError)(`快照 ${options.snapshotId} 在环境 ${options.env} 中不存在`);
            }
            return;
        }
        if (options.env) {
            const env = await storage.getEnvironment(options.env);
            if (!env) {
                (0, errors_1.exitWithError)(`环境 "${options.env}" 不存在`);
            }
        }
        if (type === 'snapshots' || type === 'all') {
            const deleted = await storage.clearAllSnapshots(options.env);
            if (options.env) {
                (0, ui_1.printSuccess)(`已清理环境 "${options.env}" 的所有 ${deleted} 个快照`);
            }
            else {
                (0, ui_1.printSuccess)(`已清理所有环境的 ${deleted} 个快照`);
            }
        }
        if (type === 'history' || type === 'all') {
            const deleted = await storage.clearAllHistory(options.env);
            if (options.env) {
                (0, ui_1.printSuccess)(`已清理环境 "${options.env}" 的所有 ${deleted} 条历史记录`);
            }
            else {
                (0, ui_1.printSuccess)(`已清理所有环境的 ${deleted} 条历史记录`);
            }
        }
    });
});
cacheCmd
    .command('config')
    .description('查看或更新缓存配置')
    .option('--snapshot-retention <days>', '设置快照保留天数')
    .option('--history-retention <days>', '设置历史记录保留天数')
    .option('--auto-invalidate <bool>', '启用/禁用自动失效（true/false）')
    .action(async (options) => {
    await handleError(async () => {
        const config = await storage.getConfig();
        const hasUpdates = options.snapshotRetention !== undefined ||
            options.historyRetention !== undefined ||
            options.autoInvalidate !== undefined;
        if (!hasUpdates) {
            (0, ui_1.printHeader)('当前缓存配置');
            const rows = [
                ['快照保留天数', config.cacheConfig.snapshotRetentionDays.toString()],
                ['历史记录保留天数', config.cacheConfig.historyRetentionDays.toString()],
                ['自动失效', config.cacheConfig.autoInvalidationEnabled ? '已启用' : '未启用']
            ];
            (0, ui_1.printTable)(rows, ['配置项', '值']);
            return;
        }
        const updates = {};
        if (options.snapshotRetention !== undefined) {
            try {
                updates.snapshotRetentionDays = (0, utils_1.parseNonNegativeInteger)(options.snapshotRetention);
            }
            catch (e) {
                (0, errors_1.exitWithError)(`无效的快照保留天数: "${options.snapshotRetention}"，${e.message}`);
            }
        }
        if (options.historyRetention !== undefined) {
            try {
                updates.historyRetentionDays = (0, utils_1.parseNonNegativeInteger)(options.historyRetention);
            }
            catch (e) {
                (0, errors_1.exitWithError)(`无效的历史记录保留天数: "${options.historyRetention}"，${e.message}`);
            }
        }
        if (options.autoInvalidate !== undefined) {
            const value = options.autoInvalidate.toLowerCase();
            if (value !== 'true' && value !== 'false') {
                (0, errors_1.exitWithError)('自动失效必须是 true 或 false');
            }
            updates.autoInvalidationEnabled = value === 'true';
        }
        await storage.updateCacheConfig(updates);
        (0, ui_1.printSuccess)('缓存配置已更新');
    });
});
program.parseAsync(process.argv).catch((err) => {
    (0, ui_1.printError)(err.message);
    process.exit(1);
});
