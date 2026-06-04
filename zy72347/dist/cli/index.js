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
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const index_1 = require("../index");
function parseArgs() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        return { command: 'help', args: {} };
    }
    const command = args[0];
    const namedArgs = {};
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                namedArgs[key] = next;
                i++;
            }
            else {
                namedArgs[key] = 'true';
            }
        }
        else {
            namedArgs[i.toString()] = arg;
        }
    }
    return { command, args: namedArgs };
}
function printHelp() {
    const help = `
贝塞尔曲线路径平滑 - 数据一致性与可追溯处理系统

用法: bezier <command> [options]

命令:
  run <csv文件>    执行完整工作流（导入+批注+复核+更新）
  import           导入CSV数据
    --file <path>         CSV文件路径
    --columns <col1,col2> 数值列名，逗号分隔
    --operator <name>     操作人
    --screenshot <ref>    旧公式截图引用

  annotate         添加批注
    --id <recordId>       记录ID
    --author <name>       批注人
    --content <text>      批注内容
    --screenshot <ref>    截图引用

  review           活动负责人复核
    --id <recordId>       记录ID
    --reviewer <name>     复核人
    --decision <approve|reject|rollback>  复核决定
    --comment <text>      复核意见
    --format <decimal|percentage>  目标格式

  update           计算明细更新
    --id <recordId>       记录ID
    --operator <name>     操作人
    --values <key=val,...>  字段值
    --reason <text>       更新原因

  rollback         回滚记录
    --id <recordId>       记录ID
    --operator <name>     操作人
    --reason <text>       回滚原因

  list             列出所有记录
    --mixed               仅显示混合格式记录

  show             显示记录详情
    --id <recordId>       记录ID

  export           导出数据
    --format <json|csv|detail|summary>  导出格式
    --output <path>       输出文件路径
    --operator <name>     操作人
    --mixed               仅导出混合格式记录
    --display-format <decimal|percentage>  显示格式
    --raw                 包含原始值
    --history             包含变更历史
    --annotations         包含批注

  trace            追溯报告（找来源和下一步）
    --id <recordId>       记录ID

  audit            审计报告

  replay           复盘重跑
    --session <id>        会话ID（不传则列出会话）
    --operator <name>     操作人

  save-session     保存当前工作流为可重跑会话
    --name <description>  会话描述
    --operator <name>     操作人

  help             显示帮助

示例:
  # 导入数据
  bezier import --file examples/sample-data.csv --columns "转化率,完成率" --operator "运营规划阿岚"

  # 添加批注
  bezier annotate --id rec_xxx --author "运营规划阿岚" --content "老师批注：确认数值无误"

  # 活动负责人复核混合格式
  bezier review --id rec_xxx --reviewer "活动负责人" --decision approve --comment "混合格式确认，统一转为小数"

  # 导出明细（页面展示、导出、接口共用同一份结果）
  bezier export --format detail --output output/detail.txt --operator "运营规划阿岚"

  # 追溯来源和下一步
  bezier trace --id rec_xxx

  # 复盘重跑
  bezier replay --session session_xxx --operator "新同事"
`.trim();
    console.log(help);
}
async function main() {
    const { command, args } = parseArgs();
    try {
        switch (command) {
            case 'help':
            case '--help':
            case '-h':
                printHelp();
                return;
            case 'run': {
                const filePath = args['1'] || args.file;
                const operator = args.operator || '运营规划阿岚';
                if (!filePath) {
                    console.error('错误: 请指定CSV文件路径');
                    process.exit(1);
                }
                console.log('=== 贝塞尔曲线路径平滑 - 完整工作流 ===\n');
                console.log('📥 第一步：旧公式截图导入...');
                const importResult = (0, index_1.importCsv)({
                    filePath,
                    importedBy: operator,
                    valueColumns: args.columns ? args.columns.split(',') : ['转化率', '完成率'],
                    screenshotRef: args.screenshot,
                });
                if (!importResult.success || !importResult.data) {
                    console.error('导入失败:', importResult.errors.join('\n'));
                    process.exit(1);
                }
                console.log(`   ✅ 导入完成，共 ${importResult.data.importedCount} 条记录`);
                console.log(`      混合格式: ${importResult.data.mixedFormatCount} 条`);
                console.log(`      待复核: ${importResult.data.pendingReviewCount} 条`);
                console.log(`      自动归一化: ${importResult.data.autoNormalizedCount} 条`);
                if (importResult.data.mixedFormatCount > 0) {
                    console.log('\n⚠️  检测到百分数和小数混合格式，已自动标记待活动负责人复核');
                    console.log('   记录不会自动归正常，等待人工复核...\n');
                }
                console.log('📝 第二步：运营规划阿岚补看老师批注...');
                for (let i = 0; i < importResult.data.importedRecordIds.length; i++) {
                    const recordId = importResult.data.importedRecordIds[i];
                    const detail = (0, index_1.getRecordDetail)(recordId);
                    if (detail.data && detail.data.hasMixedFormat) {
                        (0, index_1.addAnnotation)({
                            recordId,
                            author: operator,
                            content: `运营规划阿岚补看老师批注：第${detail.data.originalRowNumber}行存在混合格式，请活动负责人复核`,
                        });
                        console.log(`   ✅ 记录 ${recordId.slice(0, 15)}... 已添加批注`);
                    }
                }
                console.log('\n⏳ 第三步：计算明细更新前等待活动负责人复核...');
                const pendingRecords = importResult.data.importedRecordIds
                    .map((id) => (0, index_1.getRecordDetail)(id).data)
                    .filter((r) => r && r.status === 'pending_review');
                if (pendingRecords.length > 0) {
                    console.log(`   以下记录待活动负责人复核:`);
                    pendingRecords.forEach((r) => {
                        if (r) {
                            console.log(`     - [行${r.originalRowNumber}] ${r.id} - 原始值: ${JSON.stringify(r.rawValues)}`);
                        }
                    });
                    console.log('\n   🎯 下一步动作:');
                    console.log(`      1. 活动负责人执行复核: bezier review --id <记录ID> --reviewer "活动负责人" --decision approve --comment "确认"`);
                    console.log(`      2. 复核通过后执行更新: bezier update --id <记录ID> --operator "运营规划阿岚"`);
                }
                const sessionCommands = (0, index_1.createWorkflowReplayCommands)({
                    filePath,
                    importedBy: operator,
                    valueColumns: args.columns ? args.columns.split(',') : ['转化率', '完成率'],
                    screenshotRef: args.screenshot,
                }, importResult.data.importedRecordIds.map((_, i) => ({
                    recordIndex: i,
                    author: operator,
                    content: '老师批注确认',
                })), [], [], importResult.data.importedRecordIds);
                const manifest = (0, index_1.createReplayManifest)(operator, `完整工作流 - ${path.basename(filePath)}`, sessionCommands);
                (0, index_1.saveReplayManifest)(manifest);
                console.log(`\n💾 已保存可重跑会话: ${manifest.sessionId}`);
                console.log(`   其他同事可执行: bezier replay --session ${manifest.sessionId} --operator "同事姓名"`);
                break;
            }
            case 'import': {
                const filePath = args.file;
                const operator = args.operator || '系统';
                const columns = args.columns ? args.columns.split(',') : ['转化率', '完成率'];
                if (!filePath) {
                    console.error('错误: 请指定--file参数');
                    process.exit(1);
                }
                const result = (0, index_1.importCsv)({
                    filePath,
                    importedBy: operator,
                    valueColumns: columns,
                    screenshotRef: args.screenshot,
                });
                if (result.success && result.data) {
                    console.log(`✅ 导入成功`);
                    console.log(`   总行数: ${result.data.totalRows}`);
                    console.log(`   导入成功: ${result.data.importedCount}`);
                    console.log(`   混合格式: ${result.data.mixedFormatCount}`);
                    console.log(`   待复核: ${result.data.pendingReviewCount}`);
                    console.log(`   自动归一化: ${result.data.autoNormalizedCount}`);
                    if (result.data.importedRecordIds.length > 0) {
                        console.log(`\n记录ID列表:`);
                        result.data.importedRecordIds.forEach((id, i) => {
                            console.log(`  ${i + 1}. ${id}`);
                        });
                    }
                }
                else {
                    console.error('❌ 导入失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'annotate': {
                const recordId = args.id;
                const author = args.author || '匿名';
                const content = args.content;
                if (!recordId || !content) {
                    console.error('错误: 请指定--id和--content参数');
                    process.exit(1);
                }
                const result = (0, index_1.addAnnotation)({
                    recordId,
                    author,
                    content,
                    screenshotRef: args.screenshot,
                });
                if (result.success) {
                    console.log('✅ 批注添加成功');
                }
                else {
                    console.error('❌ 批注添加失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'review': {
                const recordId = args.id;
                const reviewer = args.reviewer || '活动负责人';
                const decision = args.decision;
                const comment = args.comment || '';
                const format = args.format || 'decimal';
                if (!recordId || !decision) {
                    console.error('错误: 请指定--id和--decision参数');
                    process.exit(1);
                }
                if (!['approve', 'reject', 'rollback'].includes(decision)) {
                    console.error('错误: --decision必须是approve、reject或rollback');
                    process.exit(1);
                }
                const result = (0, index_1.reviewRecord)({
                    recordId,
                    reviewer,
                    decision,
                    comment,
                    targetFormat: format,
                });
                if (result.success) {
                    console.log(`✅ 复核完成: ${decision}`);
                    if (result.warnings.length > 0) {
                        console.log('⚠️  警告:');
                        result.warnings.forEach((w) => console.log(`   ${w}`));
                    }
                }
                else {
                    console.error('❌ 复核失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'update': {
                const recordId = args.id;
                const operator = args.operator || '运营规划阿岚';
                const valuesStr = args.values;
                const reason = args.reason || '计算明细更新';
                if (!recordId) {
                    console.error('错误: 请指定--id参数');
                    process.exit(1);
                }
                const fieldValues = {};
                if (valuesStr) {
                    valuesStr.split(',').forEach((pair) => {
                        const [k, v] = pair.split('=');
                        if (k && v) {
                            fieldValues[k.trim()] = v.trim();
                        }
                    });
                }
                const result = (0, index_1.updateRecord)({
                    recordId,
                    operator,
                    fieldValues,
                    reason,
                });
                if (result.success) {
                    console.log('✅ 更新完成');
                }
                else {
                    console.error('❌ 更新失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'rollback': {
                const recordId = args.id;
                const operator = args.operator || '系统';
                const reason = args.reason || '回滚';
                if (!recordId) {
                    console.error('错误: 请指定--id参数');
                    process.exit(1);
                }
                const result = (0, index_1.rollbackRecord)(recordId, operator, reason);
                if (result.success) {
                    console.log('✅ 回滚完成');
                }
                else {
                    console.error('❌ 回滚失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'list': {
                const result = (0, index_1.exportData)({
                    format: 'summary',
                    includeMixedOnly: args.mixed === 'true',
                    operator: args.operator || '系统',
                });
                if (result.success && result.data) {
                    console.log(result.data);
                }
                break;
            }
            case 'show': {
                const recordId = args.id;
                if (!recordId) {
                    console.error('错误: 请指定--id参数');
                    process.exit(1);
                }
                const result = (0, index_1.getRecordDetail)(recordId);
                if (result.success && result.data) {
                    const r = result.data;
                    console.log(`=== 记录详情 ===`);
                    console.log(`ID: ${r.id}`);
                    console.log(`原始行号: ${r.originalRowNumber} (${r.sourceFile})`);
                    console.log(`导入时间: ${r.importTime} (by ${r.importedBy})`);
                    console.log(`状态: ${r.statusText}`);
                    console.log(`工作流: ${r.workflowStatus}`);
                    console.log(`混合格式: ${r.hasMixedFormat ? '是 ⚠️' : '否'}`);
                    console.log(`检测格式: ${r.formatDetected}`);
                    console.log('');
                    console.log('--- 数值 ---');
                    Object.entries(r.values).forEach(([k, v]) => {
                        console.log(`  ${k}: ${v}`);
                    });
                    if (r.rawValues) {
                        console.log('');
                        console.log('--- 原始值 ---');
                        Object.entries(r.rawValues).forEach(([k, v]) => {
                            console.log(`  ${k}: "${v.original}" -> ${v.format} -> ${v.numericValue}`);
                        });
                    }
                    if (r.changeHistory && r.changeHistory.length > 0) {
                        console.log('');
                        console.log('--- 变更历史 ---');
                        r.changeHistory.forEach((ch, i) => {
                            console.log(`  ${i + 1}. [${ch.time}] ${ch.operator}: ${ch.field}`);
                            console.log(`     ${ch.oldValue} → ${ch.newValue}`);
                            console.log(`     原因: ${ch.reason}`);
                        });
                    }
                    if (r.annotations && r.annotations.length > 0) {
                        console.log('');
                        console.log('--- 批注 ---');
                        r.annotations.forEach((ann, i) => {
                            console.log(`  ${i + 1}. [${ann.time}] ${ann.author}: ${ann.content}`);
                            if (ann.screenshotRef) {
                                console.log(`     截图: ${ann.screenshotRef}`);
                            }
                        });
                    }
                }
                else {
                    console.error('❌ 查询失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'export': {
                const format = args.format || 'summary';
                const operator = args.operator || '系统';
                const result = (0, index_1.exportData)({
                    format,
                    outputPath: args.output,
                    includeMixedOnly: args.mixed === 'true',
                    includeRawValues: args.raw === 'true',
                    includeChangeHistory: args.history === 'true',
                    includeAnnotations: args.annotations === 'true',
                    displayFormat: args['display-format'] || 'decimal',
                    operator,
                });
                if (result.success && result.data) {
                    if (!args.output) {
                        console.log(result.data);
                    }
                    else {
                        console.log(`✅ 已导出到 ${args.output}`);
                    }
                }
                else {
                    console.error('❌ 导出失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'trace': {
                const recordId = args.id;
                if (!recordId) {
                    console.error('错误: 请指定--id参数');
                    process.exit(1);
                }
                const result = (0, index_1.getTraceabilityReport)(recordId);
                if (result.success && result.data) {
                    console.log(result.data);
                }
                else {
                    console.error('❌ 追溯失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            case 'audit': {
                const result = (0, index_1.generateAuditReport)();
                if (result.success && result.data) {
                    console.log(result.data);
                }
                break;
            }
            case 'replay': {
                const sessionId = args.session;
                const operator = args.operator || '系统';
                if (!sessionId) {
                    const listResult = (0, index_1.listReplaySessions)();
                    if (listResult.success && listResult.data) {
                        console.log('=== 可重跑会话列表 ===\n');
                        listResult.data.forEach((s, i) => {
                            console.log(`${i + 1}. ${s.sessionId}`);
                            console.log(`   创建时间: ${s.createdAt}`);
                            console.log(`   创建人: ${s.createdBy}`);
                            console.log(`   描述: ${s.description}`);
                            console.log(`   命令数: ${s.commandCount}`);
                            console.log(`   重跑: bezier replay --session ${s.sessionId} --operator <姓名>`);
                            console.log('');
                        });
                    }
                    return;
                }
                console.log(`=== 复盘重跑会话 ${sessionId} ===\n`);
                const result = await (0, index_1.executeReplay)(sessionId, operator);
                if (result.data) {
                    console.log((0, index_1.generateReplayReport)(result.data));
                }
                if (!result.success) {
                    console.error('\n❌ 重跑失败:', result.errors.join('\n'));
                    process.exit(1);
                }
                break;
            }
            default:
                console.error(`未知命令: ${command}\n`);
                printHelp();
                process.exit(1);
        }
    }
    catch (e) {
        console.error('❌ 执行出错:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}
main().catch(console.error);
//# sourceMappingURL=index.js.map