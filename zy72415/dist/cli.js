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
const readline = __importStar(require("readline"));
const api_1 = require("./api");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
function question(q) {
    return new Promise((resolve) => rl.question(q, resolve));
}
function printMenu() {
    console.log('\n========================================');
    console.log('  🎸 耳返频段冲突记录 - 命令行交互');
    console.log('========================================');
    console.log('');
    console.log('  1. 演示：授权期限页第一次导入（含双名歌曲）');
    console.log('  2. 查看所有记录');
    console.log('  3. 补看调音师留言');
    console.log('  4. 修改处理状态');
    console.log('  5. 生成给店长的周报');
    console.log('  6. 撤回上一版周报');
    console.log('  7. 查看导入批次历史（可回滚）');
    console.log('  8. 导出 CSV 明细');
    console.log('  9. 三处同源验证（页面/接口/导出）');
    console.log('  0. 退出');
    console.log('');
}
function printRecords(records) {
    if (records.length === 0) {
        console.log('  （暂无记录）');
        return;
    }
    console.log('');
    console.log('  ID' + ' '.repeat(10) + '| 行号 | 歌曲' + ' '.repeat(20) + '| 双名 | 状态');
    console.log('  ' + '-'.repeat(80));
    for (const r of records) {
        const songName = r.song.liveName + (r.song.liveName !== r.song.copyrightName ? ` / ${r.song.copyrightName}` : '');
        const dual = r.song.hasDualNames ? '是' : '否';
        const rolled = r.isRolledBack ? ' [已撤回]' : '';
        console.log(`  ${r.id.padEnd(12)} | ${String(r.originalRowNumber).padEnd(4)} | ${songName.padEnd(28)} | ${dual.padEnd(4)} | ${r.processingStatus}${rolled}`);
    }
    console.log('');
}
const demoRows = () => [
    { originalRowNumber: 1, liveName: '青花瓷', copyrightName: '青花瓷', band: 'CH01', conflictDescription: '无线话筒 CH01 轻微干扰' },
    { originalRowNumber: 2, liveName: '青花瓷(即兴版)', copyrightName: '青花瓷', band: 'CH02', conflictDescription: '同曲异名，频段与贝斯 CH17 冲突' },
    { originalRowNumber: 3, liveName: '晴天', copyrightName: '晴天', band: 'CH05', conflictDescription: '无冲突' },
    { originalRowNumber: 4, liveName: '七里香(现场版)', copyrightName: '七里香', band: 'CH08', conflictDescription: '耳返左右声道串频' },
    { originalRowNumber: 5, liveName: '稻香', copyrightName: '稻香', band: 'CH12', conflictDescription: '与对讲机频段重叠' },
];
async function doDemoImport() {
    console.log('\n  📥 开始：授权期限页第一次导入（含双名歌曲）...');
    const result = api_1.api.importRecords(demoRows(), '琴行店长老周', '授权期限页');
    console.log(`  ✓ 导入完成：批次 ${result.batch.id}，共 ${result.records.length} 条记录`);
    const dual = result.records.filter((r) => r.song.hasDualNames);
    if (dual.length) {
        console.log(`  ⚠ 自动检测到 ${dual.length} 首双名歌曲，已标记「待音乐老师复核」：`);
        dual.forEach((d) => console.log(`     · ${d.song.liveName} / ${d.song.copyrightName}（记录ID: ${d.id}）`));
    }
    console.log('  提示：别急着归正常，双名歌曲留给音乐老师复核。');
}
async function doVerifyThreeSources() {
    console.log('\n  🔍 开始三处同源验证...');
    const pageRecords = api_1.api.getRecords();
    const apiRecords = api_1.api.getRecordsForApi();
    const exportText = api_1.api.getRecordsForExport();
    const exportLines = exportText.split('\n').slice(1).filter((l) => l.trim());
    let ok = true;
    if (pageRecords.length !== apiRecords.length) {
        console.log(`  ✗ 页面记录数(${pageRecords.length}) ≠ API记录数(${apiRecords.length})`);
        ok = false;
    }
    else {
        console.log(`  ✓ 页面与 API 记录数一致：${pageRecords.length} 条`);
    }
    if (pageRecords.length !== exportLines.length) {
        console.log(`  ✗ 页面记录数(${pageRecords.length}) ≠ 导出CSV行数(${exportLines.length})`);
        ok = false;
    }
    else {
        console.log(`  ✓ 页面与导出 CSV 记录数一致：${pageRecords.length} 条`);
    }
    const exportIds = exportLines.map((l) => l.split(',')[0]);
    let idMatch = 0;
    for (const r of pageRecords) {
        if (exportIds.includes(r.id) && apiRecords.find((a) => a.id === r.id))
            idMatch++;
    }
    if (idMatch === pageRecords.length) {
        console.log(`  ✓ 所有 ${idMatch} 条记录的 ID 在页面、API、导出 CSV 中完全对应！`);
    }
    else {
        console.log(`  ✗ 仅 ${idMatch}/${pageRecords.length} 条 ID 能对应上`);
        ok = false;
    }
    const sampleDual = pageRecords.find((r) => r.song.hasDualNames);
    if (sampleDual) {
        const apiDual = apiRecords.find((a) => a.id === sampleDual.id);
        const exportLine = exportLines.find((l) => l.startsWith(sampleDual.id));
        const exportCols = exportLine ? exportLine.split(',') : [];
        console.log(`  📌 抽样检查双名歌曲「${sampleDual.song.liveName}/${sampleDual.song.copyrightName}」：`);
        console.log(`     页面: 状态=${sampleDual.processingStatus}, 是否双名=是`);
        if (apiDual)
            console.log(`     API : 状态=${apiDual.processingStatus}, 是否双名=${apiDual.song.hasDualNames ? '是' : '否'}`);
        if (exportCols[5] === '是')
            console.log(`     导出: 是否双名=是, 状态=${exportCols[7]}`);
        const allMatch = apiDual && apiDual.processingStatus === sampleDual.processingStatus && exportCols[5] === '是';
        if (allMatch)
            console.log('     ✓ 三处数据完全一致！');
        else {
            console.log('     ✗ 数据不一致！');
            ok = false;
        }
    }
    console.log(ok ? '\n  ✅ 验证通过！三处数据源完全同源。' : '\n  ❌ 验证失败，存在数据不一致。');
}
async function main() {
    while (true) {
        printMenu();
        const choice = await question('  请选择操作：');
        switch (choice.trim()) {
            case '1':
                await doDemoImport();
                break;
            case '2':
                printRecords(api_1.api.getRecords());
                break;
            case '3': {
                printRecords(api_1.api.getRecords());
                const id = await question('  输入记录ID：');
                const msg = await question('  调音师留言内容：');
                const res = api_1.api.addEngineerMessage(id.trim(), msg.trim(), '琴行店长老周');
                if (res)
                    console.log('  ✓ 留言已保存');
                else
                    console.log('  ✗ 记录不存在');
                break;
            }
            case '4': {
                printRecords(api_1.api.getRecords());
                const id = await question('  输入记录ID：');
                console.log('  可选状态: pending_review | normal | abnormal | needs_teacher_review');
                const status = await question('  新状态：');
                const reason = await question('  修改原因：');
                try {
                    const res = api_1.api.updateRecordStatus(id.trim(), status, '琴行店长老周', reason.trim());
                    if (res)
                        console.log('  ✓ 状态已更新');
                    else
                        console.log('  ✗ 记录不存在');
                }
                catch (e) {
                    console.log('  ✗ ' + e.message);
                }
                break;
            }
            case '5': {
                const report = api_1.api.createWeeklyReport('琴行店长老周');
                console.log(`  ✓ 周报已生成：${report.summary}`);
                break;
            }
            case '6': {
                try {
                    const prev = api_1.api.rollbackToPreviousReport();
                    console.log(`  ✓ 已撤回到上一版周报`);
                }
                catch (e) {
                    console.log('  ✗ ' + e.message);
                }
                break;
            }
            case '7': {
                const batches = api_1.api.getImportBatches();
                if (batches.length === 0) {
                    console.log('  暂无导入批次');
                    break;
                }
                batches.forEach((b) => {
                    const rolled = b.isRolledBack ? ` [已撤回·${b.rolledBackBy}·${b.rollbackReason}]` : '';
                    console.log(`  ${b.id} · ${b.source} · ${b.importedBy} · ${b.recordIds.length}条${rolled}`);
                });
                const id = await question('  输入批次ID撤回（回车跳过）：');
                if (id.trim()) {
                    const reason = await question('  撤回原因：');
                    try {
                        api_1.api.rollbackImportBatch(id.trim(), '琴行店长老周', reason.trim());
                        console.log('  ✓ 批次已撤回');
                    }
                    catch (e) {
                        console.log('  ✗ ' + e.message);
                    }
                }
                break;
            }
            case '8': {
                const csv = api_1.api.getRecordsForExport();
                console.log('\n  📤 CSV 导出内容（与页面、API 同源）：\n');
                console.log(csv);
                break;
            }
            case '9':
                await doVerifyThreeSources();
                break;
            case '0':
                console.log('  再见！');
                rl.close();
                return;
            default:
                console.log('  无效选择');
        }
    }
}
main().catch(console.error);
