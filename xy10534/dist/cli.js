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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI = void 0;
const chalk = require("chalk");
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const storage_1 = require("./storage");
const rules_1 = require("./rules");
const samples_1 = require("./samples");
class CLI {
    constructor(dataDir) {
        this.storage = new storage_1.Storage(dataDir);
    }
    init(releasePlanId, releaseName, options) {
        console.log(chalk.blue('\n═══ 发版依赖窗口 CLI - 初始化 ═══\n'));
        if (this.storage.exists() && !options.sample && !options.successSample) {
            console.log(chalk.yellow('⚠ 数据文件已存在'));
            console.log(chalk.gray(`  位置: ${this.storage.getDataFile()}`));
            console.log(chalk.gray('\n  如需重新初始化，请先删除该文件或使用 --sample 加载样例数据'));
            return;
        }
        let data;
        if (options.successSample) {
            console.log(chalk.green('✓ 使用成功通过样例数据初始化'));
            data = (0, samples_1.createSuccessSampleData)(releasePlanId, releaseName);
        }
        else if (options.sample) {
            console.log(chalk.green('✓ 使用内置样例数据初始化（包含多种问题场景）'));
            data = (0, samples_1.createSampleData)(releasePlanId, releaseName);
        }
        else {
            console.log(chalk.green('✓ 创建空白发版计划'));
            data = this.storage.initialize(releasePlanId, releaseName);
        }
        this.storage.save(data);
        console.log(chalk.gray(`\n  发版计划ID: ${data.releasePlanId}`));
        console.log(chalk.gray(`  发版计划名称: ${data.releaseName}`));
        console.log(chalk.gray(`  数据文件: ${this.storage.getDataFile()}`));
        if (options.sample || options.successSample) {
            console.log(chalk.cyan('\n已加载样例数据：'));
            console.log(chalk.gray(`  服务: ${data.services.length} 个（订单、支付、库存、通知）`));
            console.log(chalk.gray(`  依赖关系: ${data.dependencies.length} 条`));
            console.log(chalk.gray(`  数据库迁移: ${data.migrations.length} 个`));
            console.log(chalk.gray(`  配置开关: ${data.switches.length} 个`));
            console.log(chalk.gray(`  回滚联系人: ${data.contacts.length} 人`));
        }
        console.log(chalk.green('\n✓ 初始化完成'));
    }
    import(filePath, options) {
        console.log(chalk.blue('\n═══ 发版依赖窗口 CLI - 导入数据 ═══\n'));
        if (!this.storage.exists()) {
            throw new Error('发版数据不存在，请先运行 init 命令初始化');
        }
        if (!fs.existsSync(filePath)) {
            throw new Error(`导入文件不存在: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const importData = JSON.parse(content);
        const data = this.storage.load();
        this.storage.backup();
        const type = options.type || 'auto';
        if (type === 'auto' || type === 'services') {
            if (importData.services && Array.isArray(importData.services)) {
                const before = data.services.length;
                this.storage.addServices(data, importData.services);
                console.log(chalk.green(`✓ 导入服务: ${data.services.length - before} 个`));
            }
        }
        if (type === 'auto' || type === 'dependencies') {
            if (importData.dependencies && Array.isArray(importData.dependencies)) {
                const before = data.dependencies.length;
                this.storage.addDependencies(data, importData.dependencies);
                console.log(chalk.green(`✓ 导入依赖: ${data.dependencies.length - before} 条`));
            }
        }
        if (type === 'auto' || type === 'migrations') {
            if (importData.migrations && Array.isArray(importData.migrations)) {
                const before = data.migrations.length;
                this.storage.addMigrations(data, importData.migrations);
                console.log(chalk.green(`✓ 导入迁移: ${data.migrations.length - before} 个`));
            }
        }
        if (type === 'auto' || type === 'switches') {
            if (importData.switches && Array.isArray(importData.switches)) {
                const before = data.switches.length;
                this.storage.addSwitches(data, importData.switches);
                console.log(chalk.green(`✓ 导入开关: ${data.switches.length - before} 个`));
            }
        }
        if (type === 'auto' || type === 'contacts') {
            if (importData.contacts && Array.isArray(importData.contacts)) {
                const before = data.contacts.length;
                this.storage.addContacts(data, importData.contacts);
                console.log(chalk.green(`✓ 导入联系人: ${data.contacts.length - before} 人`));
            }
        }
        if (type === 'auto' || type === 'waivers') {
            if (importData.waivers && Array.isArray(importData.waivers)) {
                for (const waiver of importData.waivers) {
                    this.storage.addWaiver(data, waiver);
                }
                console.log(chalk.green(`✓ 导入豁免: ${importData.waivers.length} 条`));
            }
        }
        this.storage.save(data);
        console.log(chalk.green('\n✓ 导入完成'));
    }
    check(options) {
        console.log(chalk.blue('\n═══ 发版依赖窗口 CLI - 执行检查 ═══\n'));
        if (!this.storage.exists()) {
            throw new Error('发版数据不存在，请先运行 init 命令初始化');
        }
        const data = this.storage.load();
        const { results, summary } = (0, rules_1.runAllChecks)(data);
        const operator = options.operator || process.env.USER || 'unknown';
        const history = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            results,
            summary,
            executedBy: operator
        };
        this.storage.addCheckHistory(data, history);
        this.storage.save(data);
        this.printCheckSummary(summary);
        console.log('');
        this.printCheckResults(results);
        console.log('\n' + chalk.gray(`检查记录ID: ${history.id}`));
        console.log(chalk.gray(`执行时间: ${history.timestamp}`));
        console.log(chalk.gray(`操作人: ${history.executedBy}`));
        if (summary.canRelease) {
            console.log(chalk.green('\n✓ 全部阻断项已清除，可以发布'));
        }
        else {
            console.log(chalk.red(`\n✗ 存在 ${summary.blocking} 个阻断项，请先处理后再发布`));
        }
    }
    detail(options) {
        console.log(chalk.blue('\n═══ 发版依赖窗口 CLI - 详细信息 ═══\n'));
        if (!this.storage.exists()) {
            throw new Error('发版数据不存在，请先运行 init 命令初始化');
        }
        const data = this.storage.load();
        if (options.history) {
            this.printCheckHistory(data);
            return;
        }
        if (options.checkHistoryId) {
            this.printSpecificHistory(data, options.checkHistoryId);
            return;
        }
        if (options.service) {
            this.printServiceDetail(data, options.service);
            return;
        }
        this.printOverview(data);
    }
    report(options) {
        console.log(chalk.blue('\n═══ 发版依赖窗口 CLI - 生成报告 ═══\n'));
        if (!this.storage.exists()) {
            throw new Error('发版数据不存在，请先运行 init 命令初始化');
        }
        const data = this.storage.load();
        if (data.checkHistory.length === 0) {
            console.log(chalk.yellow('⚠ 尚未执行过检查，请先运行 check 命令'));
            return;
        }
        const lastCheck = data.checkHistory[data.checkHistory.length - 1];
        const format = options.format || 'text';
        let reportContent;
        if (format === 'json') {
            reportContent = this.generateJsonReport(data, lastCheck);
        }
        else {
            reportContent = this.generateTextReport(data, lastCheck);
        }
        if (options.output) {
            fs.writeFileSync(options.output, reportContent, 'utf-8');
            console.log(chalk.green(`✓ 报告已保存到: ${options.output}`));
        }
        else {
            console.log(reportContent);
        }
    }
    printCheckSummary(summary) {
        const status = summary.canRelease ? chalk.green('✓ 可放行') : chalk.red('✗ 阻断');
        console.log(chalk.bold('检查摘要:'));
        console.log(`  总检查项: ${summary.total}`);
        console.log(`  ${chalk.red('阻断项')}: ${summary.blocking}`);
        console.log(`  ${chalk.yellow('警告项')}: ${summary.warning}`);
        console.log(`  ${chalk.green('通过项')}: ${summary.passed}`);
        console.log(`  ${chalk.cyan('豁免项')}: ${summary.waived}`);
        console.log(`  发布状态: ${status}`);
        if (summary.recommendedOrder.length > 0) {
            console.log(`\n${chalk.bold('推荐发布顺序:')}`);
            summary.recommendedOrder.forEach((service, index) => {
                console.log(`  ${index + 1}. ${service}`);
            });
        }
    }
    printCheckResults(results) {
        const blocking = results.filter(r => r.status === 'blocking');
        const warning = results.filter(r => r.status === 'warning');
        const passed = results.filter(r => r.status === 'passed');
        const waived = results.filter(r => r.status === 'waived');
        const printResultsByStatus = (items, status) => {
            if (items.length === 0)
                return;
            const statusLabels = {
                blocking: { label: '阻断项', color: chalk.red },
                warning: { label: '警告项', color: chalk.yellow },
                passed: { label: '通过项', color: chalk.green },
                waived: { label: '豁免项', color: chalk.cyan }
            };
            const { label, color } = statusLabels[status];
            console.log(color(`\n━━━ ${label} (${items.length}) ━━━`));
            items.forEach((result, index) => {
                console.log(color(`\n[${index + 1}] ${result.message}`));
                console.log(chalk.gray(`  类型: ${result.checkType}`));
                console.log(chalk.gray(`  详情: ${result.detail}`));
                if (result.action) {
                    console.log(chalk.blue(`  建议: ${result.action}`));
                }
                if (result.waiverId) {
                    console.log(chalk.cyan(`  豁免ID: ${result.waiverId}`));
                }
            });
        };
        printResultsByStatus(blocking, 'blocking');
        printResultsByStatus(warning, 'warning');
        printResultsByStatus(passed, 'passed');
        printResultsByStatus(waived, 'waived');
    }
    printOverview(data) {
        console.log(chalk.bold('发版计划概览:'));
        console.log(chalk.gray(`  ID: ${data.releasePlanId}`));
        console.log(chalk.gray(`  名称: ${data.releaseName}`));
        console.log(chalk.gray(`  创建时间: ${data.createdAt}`));
        console.log(chalk.gray(`  更新时间: ${data.updatedAt}`));
        console.log(`\n${chalk.bold('服务列表:')}`);
        data.services.forEach((service, index) => {
            const statusColor = service.status === 'completed' ? chalk.green :
                service.status === 'in-progress' ? chalk.yellow :
                    service.status === 'failed' ? chalk.red : chalk.gray;
            console.log(`  ${index + 1}. ${service.name} (${service.version})`);
            console.log(chalk.gray(`     状态: ${statusColor(service.status)}`));
            console.log(chalk.gray(`     窗口: ${service.windowStart} ~ ${service.windowEnd}`));
        });
        console.log(`\n${chalk.bold('统计信息:')}`);
        console.log(`  依赖关系: ${data.dependencies.length} 条`);
        console.log(`  数据库迁移: ${data.migrations.length} 个`);
        console.log(`  配置开关: ${data.switches.length} 个`);
        console.log(`  回滚联系人: ${data.contacts.length} 人`);
        console.log(`  检查历史: ${data.checkHistory.length} 次`);
        console.log(`  人工修正: ${data.corrections.length} 条`);
        if (data.checkHistory.length > 0) {
            const lastCheck = data.checkHistory[data.checkHistory.length - 1];
            const status = lastCheck.summary.canRelease ? chalk.green('可放行') : chalk.red('阻断');
            console.log(`\n${chalk.bold('最新检查状态:')} ${status}`);
            console.log(chalk.gray(`  执行时间: ${lastCheck.timestamp}`));
            console.log(chalk.gray(`  阻断: ${lastCheck.summary.blocking} | 警告: ${lastCheck.summary.warning} | 通过: ${lastCheck.summary.passed}`));
        }
    }
    printServiceDetail(data, serviceIdOrName) {
        const service = data.services.find(s => s.id === serviceIdOrName || s.name === serviceIdOrName);
        if (!service) {
            console.log(chalk.red(`✗ 未找到服务: ${serviceIdOrName}`));
            return;
        }
        console.log(chalk.bold(`服务详情: ${service.name}`));
        console.log(chalk.gray(`  ID: ${service.id}`));
        console.log(chalk.gray(`  版本: ${service.version}`));
        console.log(chalk.gray(`  环境: ${service.environment}`));
        console.log(chalk.gray(`  状态: ${service.status}`));
        console.log(chalk.gray(`  计划时间: ${service.plannedTime}`));
        console.log(chalk.gray(`  发布窗口: ${service.windowStart} ~ ${service.windowEnd}`));
        if (service.notes) {
            console.log(chalk.gray(`  备注: ${service.notes}`));
        }
        const deps = data.dependencies.filter(d => d.callerServiceId === service.id || d.calleeServiceId === service.id);
        if (deps.length > 0) {
            console.log(`\n${chalk.bold('依赖关系:')}`);
            deps.forEach((dep, index) => {
                const isCaller = dep.callerServiceId === service.id;
                const otherId = isCaller ? dep.calleeServiceId : dep.callerServiceId;
                const otherService = data.services.find(s => s.id === otherId);
                const otherName = otherService ? otherService.name : otherId;
                const type = dep.dependencyType === 'hard' ? '强依赖' : '弱依赖';
                console.log(`  ${index + 1}. ${isCaller ? '依赖' : '被依赖'}: ${otherName} (${type})`);
                if (dep.description) {
                    console.log(chalk.gray(`     ${dep.description}`));
                }
            });
        }
        const migrations = data.migrations.filter(m => m.serviceId === service.id);
        if (migrations.length > 0) {
            console.log(`\n${chalk.bold('数据库迁移:')}`);
            migrations.forEach((m, index) => {
                const hasRollback = m.hasRollback ? chalk.green('✓') : chalk.red('✗');
                const executed = m.executed ? chalk.green('已执行') : chalk.yellow('未执行');
                console.log(`  ${index + 1}. ${m.scriptName}`);
                console.log(chalk.gray(`     版本: ${m.version} | 类型: ${m.migrationType}`));
                console.log(chalk.gray(`     回滚脚本: ${hasRollback} | 状态: ${executed}`));
            });
        }
        const switches = data.switches.filter(s => s.serviceId === service.id);
        if (switches.length > 0) {
            console.log(`\n${chalk.bold('配置开关:')}`);
            switches.forEach((sw, index) => {
                const preConfigured = sw.preConfigured ? chalk.green('✓') : chalk.red('✗');
                console.log(`  ${index + 1}. ${sw.key}`);
                console.log(chalk.gray(`     目标值: ${sw.targetValue} | 当前值: ${sw.currentValue || '未知'}`));
                console.log(chalk.gray(`     已预置: ${preConfigured} | 顺序: ${sw.switchOrder}`));
            });
        }
        const contacts = data.contacts.filter(c => c.serviceId === service.id);
        if (contacts.length > 0) {
            console.log(`\n${chalk.bold('回滚联系人:')}`);
            contacts.forEach((contact, index) => {
                const primary = contact.isPrimary ? chalk.green('[主要]') : '';
                const available = contact.available ? chalk.green('可用') : chalk.red('不可用');
                console.log(`  ${index + 1}. ${contact.name} ${primary}`);
                console.log(chalk.gray(`     角色: ${contact.role}`));
                console.log(chalk.gray(`     电话: ${contact.phone} | 邮箱: ${contact.email}`));
                console.log(chalk.gray(`     状态: ${available}`));
            });
        }
        const corrections = data.corrections.filter(c => c.entityType === 'service' && c.entityId === service.id);
        if (corrections.length > 0) {
            console.log(`\n${chalk.bold('人工修正记录:')}`);
            corrections.forEach((corr, index) => {
                console.log(`  ${index + 1}. ${corr.timestamp}`);
                console.log(chalk.gray(`     字段: ${corr.fieldName}`));
                console.log(chalk.gray(`     变更: ${corr.beforeValue} → ${corr.afterValue}`));
                console.log(chalk.gray(`     操作人: ${corr.operator} | 原因: ${corr.reason}`));
            });
        }
    }
    printCheckHistory(data) {
        if (data.checkHistory.length === 0) {
            console.log(chalk.yellow('⚠ 暂无检查历史记录'));
            return;
        }
        console.log(chalk.bold('检查历史记录:'));
        console.log('');
        data.checkHistory.forEach((history, index) => {
            const status = history.summary.canRelease ? chalk.green('✓ 可放行') : chalk.red('✗ 阻断');
            const number = data.checkHistory.length - index;
            console.log(`${chalk.bold(`[${number}]`)} ${history.timestamp}`);
            console.log(`    操作人: ${history.executedBy}`);
            console.log(`    状态: ${status}`);
            console.log(`    阻断: ${chalk.red(history.summary.blocking)} | 警告: ${chalk.yellow(history.summary.warning)} | 通过: ${chalk.green(history.summary.passed)} | 豁免: ${chalk.cyan(history.summary.waived)}`);
            console.log(chalk.gray(`    检查ID: ${history.id}`));
            console.log('');
        });
        console.log(chalk.gray('使用 detail --history-id <id> 查看某次检查的详细结果'));
    }
    printSpecificHistory(data, historyId) {
        const history = data.checkHistory.find(h => h.id === historyId);
        if (!history) {
            console.log(chalk.red(`✗ 未找到检查记录: ${historyId}`));
            return;
        }
        console.log(chalk.bold('检查详情:'));
        console.log(chalk.gray(`  ID: ${history.id}`));
        console.log(chalk.gray(`  时间: ${history.timestamp}`));
        console.log(chalk.gray(`  操作人: ${history.executedBy}`));
        console.log('');
        this.printCheckSummary(history.summary);
        console.log('');
        this.printCheckResults(history.results);
    }
    generateTextReport(data, lastCheck) {
        const lines = [];
        lines.push('════════════════════════════════════════════════════════════');
        lines.push('              发版依赖窗口检查报告');
        lines.push('════════════════════════════════════════════════════════════');
        lines.push('');
        lines.push(`发版计划: ${data.releaseName}`);
        lines.push(`计划ID: ${data.releasePlanId}`);
        lines.push(`报告生成时间: ${new Date().toISOString()}`);
        lines.push(`检查执行时间: ${lastCheck.timestamp}`);
        lines.push(`检查执行操作人: ${lastCheck.executedBy}`);
        lines.push('');
        lines.push('────────────────────────────────────────────────────────────');
        lines.push('检查摘要');
        lines.push('────────────────────────────────────────────────────────────');
        lines.push(`总检查项: ${lastCheck.summary.total}`);
        lines.push(`阻断项: ${lastCheck.summary.blocking}`);
        lines.push(`警告项: ${lastCheck.summary.warning}`);
        lines.push(`通过项: ${lastCheck.summary.passed}`);
        lines.push(`豁免项: ${lastCheck.summary.waived}`);
        lines.push(`发布状态: ${lastCheck.summary.canRelease ? '可放行' : '阻断'}`);
        lines.push('');
        if (lastCheck.summary.recommendedOrder.length > 0) {
            lines.push('推荐发布顺序:');
            lastCheck.summary.recommendedOrder.forEach((service, index) => {
                lines.push(`  ${index + 1}. ${service}`);
            });
            lines.push('');
        }
        const blocking = lastCheck.results.filter(r => r.status === 'blocking');
        const warning = lastCheck.results.filter(r => r.status === 'warning');
        if (blocking.length > 0) {
            lines.push('────────────────────────────────────────────────────────────');
            lines.push('阻断项详情');
            lines.push('────────────────────────────────────────────────────────────');
            blocking.forEach((result, index) => {
                lines.push(`[${index + 1}] ${result.message}`);
                lines.push(`  类型: ${result.checkType}`);
                lines.push(`  详情: ${result.detail}`);
                if (result.action) {
                    lines.push(`  建议: ${result.action}`);
                }
                lines.push('');
            });
        }
        if (warning.length > 0) {
            lines.push('────────────────────────────────────────────────────────────');
            lines.push('警告项详情');
            lines.push('────────────────────────────────────────────────────────────');
            warning.forEach((result, index) => {
                lines.push(`[${index + 1}] ${result.message}`);
                lines.push(`  类型: ${result.checkType}`);
                lines.push(`  详情: ${result.detail}`);
                if (result.action) {
                    lines.push(`  建议: ${result.action}`);
                }
                lines.push('');
            });
        }
        lines.push('────────────────────────────────────────────────────────────');
        lines.push('服务发布计划');
        lines.push('────────────────────────────────────────────────────────────');
        data.services.forEach((service, index) => {
            lines.push(`${index + 1}. ${service.name} (${service.version})`);
            lines.push(`   状态: ${service.status}`);
            lines.push(`   环境: ${service.environment}`);
            lines.push(`   发布窗口: ${service.windowStart} ~ ${service.windowEnd}`);
            if (service.notes) {
                lines.push(`   备注: ${service.notes}`);
            }
            lines.push('');
        });
        lines.push('────────────────────────────────────────────────────────────');
        lines.push('回滚联系人清单');
        lines.push('────────────────────────────────────────────────────────────');
        data.services.forEach(service => {
            const contacts = data.contacts.filter(c => c.serviceId === service.id);
            lines.push(`\n${service.name}:`);
            if (contacts.length === 0) {
                lines.push('  未配置联系人');
            }
            else {
                contacts.forEach(contact => {
                    const primary = contact.isPrimary ? '[主要]' : '';
                    const available = contact.available ? '可用' : '不可用';
                    lines.push(`  - ${contact.name} ${primary}`);
                    lines.push(`    角色: ${contact.role}`);
                    lines.push(`    电话: ${contact.phone}`);
                    lines.push(`    邮箱: ${contact.email}`);
                    lines.push(`    状态: ${available}`);
                });
            }
        });
        lines.push('');
        lines.push('════════════════════════════════════════════════════════════');
        return lines.join('\n');
    }
    generateJsonReport(data, lastCheck) {
        const report = {
            releasePlan: {
                id: data.releasePlanId,
                name: data.releaseName,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            },
            reportGeneratedAt: new Date().toISOString(),
            lastCheck: {
                id: lastCheck.id,
                timestamp: lastCheck.timestamp,
                executedBy: lastCheck.executedBy,
                summary: lastCheck.summary,
                results: lastCheck.results
            },
            services: data.services,
            dependencies: data.dependencies,
            migrations: data.migrations,
            switches: data.switches,
            contacts: data.contacts,
            waivers: data.waivers
        };
        return JSON.stringify(report, null, 2);
    }
}
exports.CLI = CLI;
//# sourceMappingURL=cli.js.map