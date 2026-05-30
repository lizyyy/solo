#!/usr/bin/env node
import { Command } from 'commander';
import { parseFiles } from './parser.js';
import { cleanLibrary } from './cleaner.js';
import { generateReport, formatReportText } from './reporter.js';
import { exportAll, exportCSV, exportJSON, exportReport } from './exporter.js';
import { getHistory, getChangeLogForTrack, applyManualConfirmation } from './history.js';
import { normalizeKey } from './key-normalizer.js';
import { detectBpmFix } from './bpm-fixer.js';
import fs from 'fs';
import path from 'path';
const program = new Command();
program
    .name('dj-clean')
    .description('DJ曲库调性清洗CLI - BPM/调性/能量值清洗、去重、历史追踪')
    .version('1.0.0');
program
    .command('clean')
    .description('清洗曲库文件(支持CSV/JSON)，输出清洗结果和报告')
    .argument('<files...>', '输入文件路径(支持多个)')
    .option('-o, --output <dir>', '输出目录', './output')
    .option('--base <path>', '历史记录存储基准路径(默认当前目录)', process.cwd())
    .option('--format <type>', '输出格式: all, csv, json, report', 'all')
    .option('--no-dedup', '跳过去重处理')
    .action((files, opts) => {
    console.log('🎵 DJ曲库调性清洗CLI');
    console.log(`📂 输入文件: ${files.join(', ')}`);
    const parseResult = parseFiles(files);
    console.log(`📊 解析结果: 总${parseResult.totalRows}行 / 成功${parseResult.successfulRows}行 / 警告${parseResult.warnings.length}条`);
    if (parseResult.warnings.length > 0) {
        const errors = parseResult.warnings.filter(w => w.severity === 'error');
        if (errors.length > 0) {
            console.log(`\n⚠️  解析错误 (${errors.length}条):`);
            for (const e of errors.slice(0, 5)) {
                console.log(`   行${e.rowIndex}: ${e.message}`);
            }
            if (errors.length > 5)
                console.log(`   ... 还有${errors.length - 5}条`);
        }
    }
    if (parseResult.successfulRows === 0) {
        console.log('❌ 没有成功解析的行，退出');
        process.exit(1);
    }
    const session = cleanLibrary(parseResult, opts.base, files);
    console.log('\n✅ 清洗完成');
    console.log(`   BPM修正: ${session.stats.bpmFixed} (半速:${session.stats.bpmHalfSpeed})`);
    console.log(`   调性标准化: ${session.stats.keysNormalized} / 识别失败: ${session.stats.keysFailed}`);
    console.log(`   能量值解析: ${session.stats.energyParsed} / 失败: ${session.stats.energyFailed}`);
    console.log(`   重复曲目: ${session.stats.duplicatesFound} (合并补字段:${session.stats.fieldsFilledFromMerge})`);
    console.log(`   人工确认保护: ${session.stats.manualConfirmed}`);
    const outputDir = path.resolve(opts.output);
    switch (opts.format) {
        case 'csv':
            exportCSV(session, path.join(outputDir, `dj-clean-${session.id}.csv`));
            console.log(`\n📄 已导出CSV: ${outputDir}`);
            break;
        case 'json':
            exportJSON(session, path.join(outputDir, `dj-clean-${session.id}.json`));
            console.log(`\n📄 已导出JSON: ${outputDir}`);
            break;
        case 'report':
            exportReport(session, path.join(outputDir, `dj-clean-${session.id}-report.txt`));
            console.log(`\n📄 已导出报告: ${outputDir}`);
            break;
        default: {
            const exported = exportAll(session, outputDir);
            console.log(`\n📄 已导出:`);
            for (const f of exported) {
                console.log(`   ${f}`);
            }
        }
    }
    const report = generateReport(session);
    console.log('\n' + formatReportText(report));
});
program
    .command('report')
    .description('查看历史清洗会话报告')
    .argument('<session-json>', '清洗结果JSON文件路径')
    .action((sessionJson) => {
    if (!fs.existsSync(sessionJson)) {
        console.log(`❌ 文件不存在: ${sessionJson}`);
        process.exit(1);
    }
    const session = JSON.parse(fs.readFileSync(sessionJson, 'utf-8'));
    const report = generateReport(session);
    console.log(formatReportText(report));
});
program
    .command('history')
    .description('查看变更历史')
    .option('--base <path>', '历史记录存储基准路径', process.cwd())
    .option('--track <id>', '查看特定曲目的变更历史')
    .action((opts) => {
    if (opts.track) {
        const changes = getChangeLogForTrack(opts.base, opts.track);
        if (changes.length === 0) {
            console.log(`曲目 ${opts.track} 无变更历史`);
            return;
        }
        console.log(`📋 曲目 ${opts.track} 变更历史 (${changes.length}条):`);
        for (const c of changes) {
            const icon = c.source === 'manual' ? '👤' : '🤖';
            const status = c.superseded ? '[已覆盖]' : '[有效]';
            console.log(`  ${icon} ${status} ${c.timestamp}`);
            console.log(`     ${c.field}: ${c.oldValue} → ${c.newValue}`);
            console.log(`     ${c.reason}`);
        }
    }
    else {
        const history = getHistory(opts.base);
        if (history.length === 0) {
            console.log('无历史记录');
            return;
        }
        console.log(`📋 清洗历史 (${history.length}次):`);
        for (const entry of history) {
            console.log(`  ${entry.sessionId} | ${entry.timestamp}`);
            console.log(`    输入: ${entry.inputFiles.join(', ')}`);
            console.log(`    BPM修正:${entry.summary.bpmFixed} 调性标准化:${entry.summary.keysNormalized} 去重:${entry.summary.duplicatesMerged}`);
        }
    }
});
program
    .command('confirm')
    .description('人工确认/覆盖某曲目的字段值(防止后续自动清洗覆盖)')
    .argument('<trackId>', '曲目ID')
    .argument('<field>', '字段名 (bpm/key/energy)')
    .argument('<value>', '确认的值')
    .option('--base <path>', '历史记录存储基准路径', process.cwd())
    .option('--reason <reason>', '确认原因', '人工确认')
    .action((trackId, field, value, opts) => {
    const validFields = ['bpm', 'key', 'energy'];
    if (!validFields.includes(field)) {
        console.log(`❌ 无效字段: ${field}，支持: ${validFields.join(', ')}`);
        process.exit(1);
    }
    const record = applyManualConfirmation(opts.base, trackId, '', '', field, value, opts.reason);
    console.log(`✅ 已记录人工确认:`);
    console.log(`   曲目: ${trackId}`);
    console.log(`   字段: ${field} = ${value}`);
    console.log(`   原因: ${opts.reason}`);
    console.log(`   ⚠️ 后续自动清洗将不会覆盖此值`);
});
program
    .command('key-convert')
    .description('调性格式转换工具')
    .argument('<key>', '调性值 (如: 8A, Am, A minor, 6d)')
    .action((key) => {
    const result = normalizeKey(key);
    if (result.camelot) {
        console.log(`Camelot: ${result.camelot}`);
        console.log(`Musical: ${result.musical}`);
        console.log(`原始:    ${result.original}`);
        console.log(`变更:    ${result.changed ? '是' : '否'}`);
        console.log(`原因:    ${result.reason}`);
    }
    else {
        console.log(`❌ 无法识别调性: "${key}"`);
        console.log(`   支持格式: Camelot(8A/8B), Open Key(6d/6m), 音乐记号(Am/C major)`);
    }
});
program
    .command('bpm-check')
    .description('BPM半速检测工具')
    .argument('<bpm>', 'BPM值')
    .option('--genre <genre>', '曲风(影响半速判断)')
    .action((bpm, opts) => {
    const result = detectBpmFix(parseFloat(bpm), undefined, opts.genre);
    console.log(`原始BPM:  ${result.originalBpm}`);
    console.log(`修正BPM:  ${result.fixedBpm}`);
    console.log(`半速:     ${result.isHalfSpeed ? '是' : '否'}`);
    console.log(`四舍五入: ${result.wasRounded ? '是' : '否'}`);
    console.log(`原因:     ${result.reason}`);
});
program.parse();
//# sourceMappingURL=index.js.map