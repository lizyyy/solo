#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const store_1 = require("../store");
const filterEngine_1 = require("../engine/filterEngine");
const counterExampleGenerator_1 = require("../engine/counterExampleGenerator");
const data_1 = require("../demo/data");
const program = new commander_1.Command();
program
    .name('mif')
    .description('互信息特征筛选系统 - 命令行工具')
    .version('1.0.0');
program
    .command('demo')
    .description('初始化演示数据')
    .action(() => {
    (0, data_1.initDemoData)();
    console.log('✅ 演示数据已初始化');
    (0, data_1.printDemoSummary)();
});
program
    .command('run-demo')
    .description('运行完整演示流程')
    .action(() => {
    (0, data_1.initDemoData)();
    (0, data_1.runDemoWorkflow)();
    (0, data_1.printDemoSummary)();
});
program
    .command('filter')
    .description('运行互信息特征筛选')
    .option('-t, --triggered-by <name>', '触发人名称', '小穆')
    .option('--threshold <value>', '自定义阈值', parseFloat)
    .option('--no-use-boundary', '不使用边界值说明')
    .action((options) => {
    const configOverrides = {};
    if (options.threshold) {
        configOverrides.threshold = options.threshold;
    }
    const surveyRows = store_1.store.getSurveyRows();
    let boundaryNoteIds;
    if (options.noUseBoundary === false) {
        boundaryNoteIds = store_1.store.getBoundaryNotes().map(n => n.id);
    }
    console.log(`🔍 运行互信息特征筛选...`);
    console.log(`   触发人: ${options.triggeredBy}`);
    console.log(`   问卷行数: ${surveyRows.length}`);
    if (boundaryNoteIds) {
        console.log(`   边界值说明: ${boundaryNoteIds.length} 条`);
    }
    else {
        console.log(`   边界值说明: 不使用`);
    }
    console.log();
    const result = (0, filterEngine_1.runFilter)({
        triggeredBy: options.triggeredBy,
        configOverrides,
        boundaryNoteIds,
    });
    (0, counterExampleGenerator_1.generateCounterExamplesForRun)(result.run.id, result.results);
    console.log(`✅ 筛选完成！`);
    console.log();
    console.log(`📊 结果统计:`);
    console.log(`   总数: ${result.summary.total}`);
    console.log(`   🟢 正常: ${result.summary.normal}`);
    console.log(`   🟡 待复核: ${result.summary.pendingReview}`);
    console.log(`   🔴 异常: ${result.summary.anomaly}`);
    console.log(`   ⚠️  边界值等于阈值: ${result.summary.atThreshold} 条（需任课老师复核）`);
    console.log();
    console.log(`📈 证据来源:`);
    console.log(`   双边证据: ${result.summary.withBothEvidence}`);
    console.log(`   仅主流程: ${result.summary.withMainProcessOnly}`);
    console.log(`   仅现场说法: ${result.summary.withFieldStatementOnly}`);
    console.log();
    console.log(`🔖 运行ID: ${result.run.id}`);
});
program
    .command('rerun <runId>')
    .description('重新运行筛选')
    .option('-t, --triggered-by <name>', '触发人名称', '小穆')
    .action((runId, options) => {
    console.log(`🔄 重新运行筛选 ${runId}...`);
    console.log(`   触发人: ${options.triggeredBy}`);
    console.log();
    const result = (0, filterEngine_1.reRunFilter)(runId, {
        triggeredBy: options.triggeredBy,
    });
    (0, counterExampleGenerator_1.generateCounterExamplesForRun)(result.run.id, result.results);
    console.log(`✅ 重跑完成！`);
    console.log(`   新运行ID: ${result.run.id}`);
    console.log(`   总数: ${result.summary.total}`);
    console.log(`   正常: ${result.summary.normal}`);
    console.log(`   待复核: ${result.summary.pendingReview}`);
    console.log(`   异常: ${result.summary.anomaly}`);
});
program
    .command('decide <resultId>')
    .description('人工决策筛选结果')
    .requiredOption('-d, --decision <type>', '决策类型: approve_normal | approve_anomaly | escalate')
    .requiredOption('-b, --by <name>', '决策人')
    .requiredOption('-n, --note <text>', '决策说明')
    .action((resultId, options) => {
    console.log(`📝 处理决策...`);
    console.log(`   结果ID: ${resultId}`);
    console.log(`   决策: ${options.decision}`);
    console.log(`   决策人: ${options.by}`);
    console.log(`   说明: ${options.note}`);
    console.log();
    const result = (0, filterEngine_1.decideResult)(resultId, options.decision, options.by, options.note);
    if (!result) {
        console.log(`❌ 未找到结果 ${resultId}`);
        process.exit(1);
    }
    console.log(`✅ 决策已记录！`);
    console.log(`   新状态: ${result.status}`);
    console.log(`   决策备注: ${result.decisionNote}`);
});
program
    .command('add-note')
    .description('补录边界值说明')
    .requiredOption('-q, --question <id>', '问题ID')
    .requiredOption('-s, --statement <text>', '现场说法')
    .requiredOption('--threshold <value>', '阈值', parseFloat)
    .option('-r, --respondent <id>', '针对特定学生')
    .option('-o, --operator <op>', '操作符', '>=')
    .option('-b, --by <name>', '记录人', '小穆')
    .option('--supplementary <text>', '补充说明')
    .action((options) => {
    console.log(`🎤 补录边界值说明...`);
    console.log(`   问题ID: ${options.question}`);
    console.log(`   现场说法: ${options.statement}`);
    console.log(`   阈值: ${options.threshold} ${options.operator}`);
    if (options.respondent)
        console.log(`   针对学生: ${options.respondent}`);
    console.log(`   记录人: ${options.by}`);
    if (options.supplementary)
        console.log(`   补充: ${options.supplementary}`);
    console.log();
    const note = store_1.store.addBoundaryNote({
        questionId: options.question,
        respondentId: options.respondent,
        fieldStatement: options.statement,
        threshold: options.threshold,
        operator: options.operator,
        notedBy: options.by,
        notedAt: new Date().toISOString(),
        supplementary: options.supplementary,
    });
    store_1.store.addAuditLog({
        entityType: 'boundary_note',
        entityId: note.id,
        action: 'create',
        actor: options.by,
        actorRole: options.by === '小穆' ? 'assistant' : 'teacher',
        changeDescription: `补录边界值说明 - ${options.statement.slice(0, 30)}...`,
        newValue: note,
        reason: 'CLI补录现场观察记录',
        timestamp: new Date().toISOString(),
    });
    const regenResult = (0, counterExampleGenerator_1.regenerateCounterExamplesForNote)(note.id, options.by);
    console.log(`✅ 边界值说明已添加！`);
    console.log(`   反例列表更新: ${regenResult.updated.length} 条更新, ${regenResult.added.length} 条新增`);
    console.log(`   笔记ID: ${note.id}`);
});
program
    .command('counter-examples')
    .description('查看反例列表')
    .option('-s, --status <status>', '按状态过滤: open | in_progress | resolved')
    .option('--handler <name>', '按处理人过滤')
    .action((options) => {
    let examples;
    if (options.status) {
        examples = store_1.store.getCounterExamplesByStatus(options.status);
    }
    else if (options.handler) {
        examples = store_1.store.getCounterExamplesByHandler(options.handler);
    }
    else {
        examples = store_1.store.getCounterExamples();
    }
    console.log(`⚠️  反例列表 (${examples.length} 条)`);
    console.log();
    examples.forEach((ex, idx) => {
        const statusLabel = ex.status === 'open' ? '🔴 待处理' :
            ex.status === 'in_progress' ? '🟡 处理中' : '🟢 已解决';
        const actionIcon = ex.nextAction === 'contact_teacher' ? '👨‍🏫' :
            ex.nextAction === 'contact_assistant' ? '👩‍💼' :
                ex.nextAction === 'collect_more' ? '📋' : '✅';
        const actionText = ex.nextAction === 'contact_teacher' ? '找任课老师' :
            ex.nextAction === 'contact_assistant' ? '找实验助理小穆' :
                ex.nextAction === 'collect_more' ? '补充材料' : '已解决';
        console.log(`${idx + 1}. ${statusLabel} ${ex.respondentName} (${ex.questionId})`);
        console.log(`   ID: ${ex.id}`);
        console.log(`   ❓ 原因: ${ex.reasonKept}`);
        if (ex.missingMaterials.length > 0) {
            console.log(`   📭 缺材料: ${ex.missingMaterials.join('、')}`);
        }
        console.log(`   ➡️  下一步: ${actionIcon} ${actionText} → ${ex.nextHandler}`);
        console.log(`   📅 更新: ${new Date(ex.updatedAt).toLocaleString('zh-CN')}`);
        console.log();
    });
});
program
    .command('resolve <counterExampleId>')
    .description('标记反例为已解决')
    .requiredOption('-n, --note <text>', '处理说明')
    .option('-b, --by <name>', '处理人', '小穆')
    .action((counterExampleId, options) => {
    console.log(`✅ 标记反例已解决...`);
    console.log(`   反例ID: ${counterExampleId}`);
    console.log(`   处理人: ${options.by}`);
    console.log(`   说明: ${options.note}`);
    console.log();
    const result = (0, counterExampleGenerator_1.updateCounterExampleStatus)(counterExampleId, 'resolved', options.by, options.note);
    if (!result) {
        console.log(`❌ 未找到反例 ${counterExampleId}`);
        process.exit(1);
    }
    console.log(`✅ 反例已标记为已解决！`);
});
program
    .command('audit')
    .description('查看审计日志')
    .option('-l, --limit <n>', '显示条数', (v) => parseInt(v, 10), 20)
    .option('--actor <name>', '按操作人过滤')
    .action((options) => {
    let logs = store_1.store.getAuditLogs();
    if (options.actor) {
        logs = store_1.store.getAuditLogsByActor(options.actor);
    }
    logs = logs.slice(0, options.limit);
    console.log(`📜 审计日志 (最近 ${logs.length} 条)`);
    console.log();
    logs.forEach((log, idx) => {
        const actorEmoji = log.actorRole === 'teacher' ? '👨‍🏫' :
            log.actorRole === 'assistant' ? '👩‍💼' : '👤';
        const actionColor = log.action === 'import' ? '📥' :
            log.action === 'create' ? '➕' :
                log.action === 'update' ? '✏️' :
                    log.action === 'decide' ? '⚖️' :
                        log.action === 're_run' ? '🔄' : '❌';
        console.log(`${idx + 1}. ${actorEmoji} ${log.actor} ${actionColor} ${log.action}`);
        console.log(`   ${log.changeDescription}`);
        console.log(`   原因: ${log.reason}`);
        console.log(`   时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`);
        if (log.impactResults && log.impactResults.length > 0) {
            console.log(`   影响: ${log.impactResults.length} 条结果`);
        }
        console.log();
    });
});
program
    .command('stats')
    .description('查看统计信息')
    .action(() => {
    const results = store_1.store.getFilterResults();
    const counterExamples = store_1.store.getCounterExamples();
    const surveyRows = store_1.store.getSurveyRows();
    const boundaryNotes = store_1.store.getBoundaryNotes();
    const filterRuns = store_1.store.getFilterRuns();
    console.log(`📊 系统统计`);
    console.log();
    console.log(`📋 问卷原始行: ${surveyRows.length} 条`);
    console.log(`🎤 边界值说明: ${boundaryNotes.length} 条`);
    console.log(`🔬 筛选运行: ${filterRuns.length} 次`);
    console.log();
    console.log(`🔍 筛选结果 (${results.length} 条):`);
    console.log(`   🟢 正常: ${results.filter(r => r.status === 'normal').length}`);
    console.log(`   🟡 待复核: ${results.filter(r => r.status === 'pending_review').length}`);
    console.log(`   🔴 异常: ${results.filter(r => r.status === 'anomaly').length}`);
    console.log(`   🟣 已处理: ${results.filter(r => r.status === 'resolved').length}`);
    console.log();
    console.log(`⚠️  边界值恰好等于阈值: ${results.filter(r => r.isAtThreshold).length} 条`);
    console.log(`   (按规则留给任课老师复核, 不自动归类)`);
    console.log();
    console.log(`📈 证据来源分布:`);
    console.log(`   双边证据: ${results.filter(r => r.evidenceType === 'both').length}`);
    console.log(`   仅主流程: ${results.filter(r => r.evidenceType === 'main_process').length}`);
    console.log(`   仅现场说法: ${results.filter(r => r.evidenceType === 'field_statement').length}`);
    console.log();
    console.log(`⚠️  反例列表 (${counterExamples.length} 条):`);
    console.log(`   🔴 待处理: ${counterExamples.filter(c => c.status === 'open').length}`);
    console.log(`   🟡 处理中: ${counterExamples.filter(c => c.status === 'in_progress').length}`);
    console.log(`   🟢 已解决: ${counterExamples.filter(c => c.status === 'resolved').length}`);
    console.log();
    console.log(`👥 待办分配:`);
    console.log(`   👨‍🏫 待任课老师处理: ${counterExamples.filter(c => c.status !== 'resolved' && c.nextHandler !== '小穆').length}`);
    console.log(`   👩‍💼 待小穆处理: ${counterExamples.filter(c => c.status !== 'resolved' && c.nextHandler === '小穆').length}`);
    console.log();
});
program
    .command('report')
    .description('导出筛选报告')
    .option('-o, --output <path>', '输出文件路径')
    .action((options) => {
    const data = (0, data_1.exportDemoData)();
    const report = {
        generatedAt: new Date().toISOString(),
        title: '互信息特征筛选报告',
        summary: {
            totalSurveyRows: data.surveyRows.length,
            totalBoundaryNotes: data.boundaryNotes.length,
            totalFilterRuns: data.filterRuns.length,
            totalResults: data.results.length,
            totalCounterExamples: data.counterExamples.length,
            byStatus: {
                normal: data.results.filter(r => r.status === 'normal').length,
                pending_review: data.results.filter(r => r.status === 'pending_review').length,
                anomaly: data.results.filter(r => r.status === 'anomaly').length,
                resolved: data.results.filter(r => r.status === 'resolved').length,
            },
            atThreshold: data.results.filter(r => r.isAtThreshold).length,
        },
        counterExamples: data.counterExamples.map(ex => ({
            respondentName: ex.respondentName,
            questionId: ex.questionId,
            reasonKept: ex.reasonKept,
            missingMaterials: ex.missingMaterials,
            nextAction: ex.nextAction,
            nextHandler: ex.nextHandler,
            status: ex.status,
        })),
    };
    if (options.output) {
        const fs = require('fs');
        const path = require('path');
        const outPath = path.resolve(options.output);
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
        console.log(`📄 报告已导出到: ${outPath}`);
    }
    else {
        console.log(JSON.stringify(report, null, 2));
    }
});
program
    .command('reset')
    .description('重置所有数据')
    .option('-y, --yes', '确认重置', false)
    .action((options) => {
    if (!options.yes) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('⚠️  确定要重置所有数据吗？此操作不可撤销。(yes/N): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
                store_1.store.reset();
                console.log('✅ 数据已重置');
            }
            else {
                console.log('❌ 已取消');
            }
        });
    }
    else {
        store_1.store.reset();
        console.log('✅ 数据已重置');
    }
});
program
    .command('api')
    .description('启动API服务器')
    .option('-p, --port <port>', '端口号', '3001')
    .action((options) => {
    process.env.PORT = options.port;
    require('../api/index');
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map