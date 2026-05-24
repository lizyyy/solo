"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReports = generateReports;
exports.generateBriefSummary = generateBriefSummary;
const fs_1 = require("fs");
const path_1 = require("path");
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
const zoneParser_1 = require("../parsers/zoneParser");
const cnameAnalyzer_1 = require("../analyzers/cnameAnalyzer");
async function generateReports(result, options, outputDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = `${result.zone.name}-${timestamp}`;
    for (const format of options.format) {
        switch (format.toLowerCase()) {
            case 'json':
                generateJSONReport(result, outputDir, baseName);
                break;
            case 'markdown':
            case 'md':
                generateMarkdownReport(result, outputDir, baseName);
                break;
            case 'terminal':
            case 'console':
                generateTerminalReport(result, options.verbose);
                break;
        }
    }
}
function generateJSONReport(result, outputDir, baseName) {
    const filePath = (0, path_1.join)(outputDir, `${baseName}.json`);
    (0, fs_1.writeFileSync)(filePath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(chalk_1.default.green(`✓ JSON 报告已生成: ${filePath}`));
}
function generateMarkdownReport(result, outputDir, baseName) {
    const filePath = (0, path_1.join)(outputDir, `${baseName}.md`);
    const content = buildMarkdownContent(result);
    (0, fs_1.writeFileSync)(filePath, content, 'utf-8');
    console.log(chalk_1.default.green(`✓ Markdown 报告已生成: ${filePath}`));
}
function buildMarkdownContent(result) {
    const lines = [];
    const { summary, zone, ttlAnalysis, environmentAnalysis, cnameChains, missingRecords } = result;
    lines.push(`# Route53 TTL 分析报告 - ${zone.name}`);
    lines.push('');
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`**总记录数**: ${summary.totalRecords}`);
    lines.push(`**平均 TTL**: ${(0, zoneParser_1.formatTTL)(summary.averageTTL)}`);
    lines.push(`**最大 TTL**: ${(0, zoneParser_1.formatTTL)(summary.maxTTL)}`);
    lines.push(`**最小 TTL**: ${(0, zoneParser_1.formatTTL)(summary.minTTL)}`);
    lines.push('');
    lines.push('## 摘要');
    lines.push('');
    lines.push(`- ⚠️ **需调整记录**: ${summary.needsAdjustment} 条`);
    lines.push(`- 🔗 **CNAME 链路**: ${summary.cnameChainsCount} 条`);
    lines.push(`- ❓ **缺失记录**: ${summary.missingRecordsCount} 条`);
    lines.push('');
    lines.push('## TTL 分级统计');
    lines.push('');
    lines.push('| 级别 | 记录数 | 描述 |');
    lines.push('|------|--------|------|');
    for (const [tier, count] of Object.entries(summary.byTier)) {
        const tierInfo = ttlAnalysis.find(a => a.tier === tier)?.tierInfo;
        lines.push(`| **${tier}** | ${count} | ${tierInfo?.description || ''} |`);
    }
    lines.push('');
    lines.push('## 需调整记录详情');
    lines.push('');
    const needsAdjustment = ttlAnalysis.filter(a => a.needsAdjustment);
    if (needsAdjustment.length > 0) {
        lines.push('| 域名 | 类型 | 当前 TTL | 推荐 TTL | 原因 |');
        lines.push('|------|------|----------|----------|------|');
        for (const item of needsAdjustment.slice(0, 50)) {
            lines.push(`| ${item.record.name} | ${item.record.type} | ${(0, zoneParser_1.formatTTL)(item.record.ttl)} | ${(0, zoneParser_1.formatTTL)(item.recommendedTTL)} | ${item.reason} |`);
        }
        if (needsAdjustment.length > 50) {
            lines.push(`| ... | ... | ... | ... | 还有 ${needsAdjustment.length - 50} 条记录 |`);
        }
    }
    else {
        lines.push('✅ 所有记录 TTL 配置合理');
    }
    lines.push('');
    lines.push('## 环境分布');
    lines.push('');
    lines.push('| 环境 | 记录数 |');
    lines.push('|------|--------|');
    for (const [env, count] of Object.entries(summary.byEnvironment)) {
        lines.push(`| ${env} | ${count} |`);
    }
    lines.push('');
    lines.push('## CNAME 链路分析');
    lines.push('');
    if (cnameChains.length > 0) {
        lines.push('### 链路统计');
        lines.push('');
        lines.push(`- 总链路数: ${cnameChains.length}`);
        lines.push(`- 平均深度: ${(cnameChains.reduce((a, b) => a + b.depth, 0) / cnameChains.length).toFixed(1)}`);
        lines.push(`- 最大深度: ${Math.max(...cnameChains.map(c => c.depth))}`);
        lines.push(`- 循环引用: ${cnameChains.filter(c => c.isCircular).length} 条`);
        lines.push(`- 未解析: ${cnameChains.filter(c => c.unresolved.length > 0).length} 条`);
        lines.push('');
        lines.push('### 链路详情');
        lines.push('');
        for (const chain of cnameChains.slice(0, 20)) {
            lines.push(`#### ${chain.domain}`);
            lines.push('');
            lines.push('```');
            lines.push((0, cnameAnalyzer_1.formatChainAsTree)(chain));
            lines.push('```');
            lines.push('');
            lines.push(`- 深度: ${chain.depth}`);
            lines.push(`- 最大 TTL: ${(0, zoneParser_1.formatTTL)(chain.maxTTL)}`);
            lines.push(`- 平均 TTL: ${(0, zoneParser_1.formatTTL)(chain.averageTTL)}`);
            if (chain.isCircular)
                lines.push('- ⚠️ 循环引用');
            if (chain.unresolved.length > 0)
                lines.push(`- ⚠️ 未解析: ${chain.unresolved.join(', ')}`);
            lines.push('');
        }
        if (cnameChains.length > 20) {
            lines.push(`> 还有 ${cnameChains.length - 20} 条链路未显示`);
            lines.push('');
        }
    }
    else {
        lines.push('无 CNAME 记录');
        lines.push('');
    }
    lines.push('## 缺失记录');
    lines.push('');
    if (missingRecords.length > 0) {
        lines.push('| 环境 | 记录名 | 类型 | 存在于 |');
        lines.push('|------|--------|------|--------|');
        for (const missing of missingRecords) {
            lines.push(`| ${missing.environment} | ${missing.recordName} | ${missing.type} | ${missing.foundInEnvironments.join(', ')} |`);
        }
    }
    else {
        lines.push('✅ 各环境记录完整');
    }
    lines.push('');
    lines.push('## 记录类型分布');
    lines.push('');
    lines.push('| 类型 | 数量 |');
    lines.push('|------|------|');
    for (const [type, count] of Object.entries(summary.byType)) {
        lines.push(`| ${type} | ${count} |`);
    }
    lines.push('');
    lines.push('## 附录');
    lines.push('');
    lines.push('### TTL 分级规则');
    lines.push('');
    const uniqueTiers = [...new Set(ttlAnalysis.map(a => a.tier))];
    for (const tier of uniqueTiers) {
        const tierInfo = ttlAnalysis.find(a => a.tier === tier)?.tierInfo;
        if (tierInfo) {
            lines.push(`- **${tier}**: ${tierInfo.min}s - ${tierInfo.max === Infinity ? '∞' : tierInfo.max + 's'} (${tierInfo.description})`);
        }
    }
    return lines.join('\n');
}
function generateTerminalReport(result, verbose) {
    const { summary, zone, ttlAnalysis, cnameChains, missingRecords } = result;
    console.log('');
    console.log(chalk_1.default.cyan.bold('════════════════════════════════════════════════════════════'));
    console.log(chalk_1.default.cyan.bold(`           Route53 TTL 分析报告 - ${zone.name}`));
    console.log(chalk_1.default.cyan.bold('════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk_1.default.white.bold('📊 基本统计'));
    console.log(chalk_1.default.gray('────────────────────────────────────────────────────────────'));
    const statsData = [
        ['总记录数', summary.totalRecords],
        ['平均 TTL', (0, zoneParser_1.formatTTL)(summary.averageTTL)],
        ['最大 TTL', (0, zoneParser_1.formatTTL)(summary.maxTTL)],
        ['最小 TTL', (0, zoneParser_1.formatTTL)(summary.minTTL)]
    ];
    console.log((0, table_1.table)(statsData, {
        header: undefined,
        columns: [{ width: 20 }, { width: 30 }]
    }));
    console.log(chalk_1.default.white.bold('🎯 TTL 分级分布'));
    console.log(chalk_1.default.gray('────────────────────────────────────────────────────────────'));
    const tierData = [['级别', '数量', '占比']];
    const colorMap = {
        red: chalk_1.default.red,
        orange: chalk_1.default.yellow,
        yellow: chalk_1.default.yellowBright,
        green: chalk_1.default.green,
        blue: chalk_1.default.blue,
        cyan: chalk_1.default.cyan,
        magenta: chalk_1.default.magenta,
        white: chalk_1.default.white
    };
    for (const [tier, count] of Object.entries(summary.byTier)) {
        const percentage = ((count / summary.totalRecords) * 100).toFixed(1) + '%';
        const tierInfo = ttlAnalysis.find(a => a.tier === tier)?.tierInfo;
        const colorFn = colorMap[tierInfo?.color || 'white'] || chalk_1.default.white;
        tierData.push([colorFn(tier), count.toString(), percentage]);
    }
    console.log((0, table_1.table)(tierData));
    console.log(chalk_1.default.white.bold('⚠️ 需调整记录'));
    console.log(chalk_1.default.gray('────────────────────────────────────────────────────────────'));
    const needsAdjustment = ttlAnalysis.filter(a => a.needsAdjustment);
    if (needsAdjustment.length > 0) {
        console.log(chalk_1.default.yellow(`发现 ${needsAdjustment.length} 条记录需要调整 TTL`));
        console.log('');
        const adjData = [['域名', '类型', '当前 TTL', '推荐 TTL']];
        for (const item of needsAdjustment.slice(0, 10)) {
            adjData.push([
                item.record.name,
                item.record.type,
                (0, zoneParser_1.formatTTL)(item.record.ttl),
                (0, zoneParser_1.formatTTL)(item.recommendedTTL)
            ]);
        }
        console.log((0, table_1.table)(adjData));
        if (needsAdjustment.length > 10) {
            console.log(chalk_1.default.gray(`  ... 还有 ${needsAdjustment.length - 10} 条记录需调整`));
        }
        console.log('');
    }
    else {
        console.log(chalk_1.default.green('✅ 所有记录 TTL 配置合理'));
        console.log('');
    }
    if (missingRecords.length > 0) {
        console.log(chalk_1.default.white.bold('❓ 缺失记录'));
        console.log(chalk_1.default.gray('────────────────────────────────────────────────────────────'));
        console.log(chalk_1.default.red(`发现 ${missingRecords.length} 条环境缺失记录`));
        console.log('');
        const missData = [['环境', '记录名', '类型']];
        for (const item of missingRecords.slice(0, 10)) {
            missData.push([item.environment, item.recordName, item.type]);
        }
        console.log((0, table_1.table)(missData));
        if (missingRecords.length > 10) {
            console.log(chalk_1.default.gray(`  ... 还有 ${missingRecords.length - 10} 条缺失记录`));
        }
        console.log('');
    }
    if (cnameChains.length > 0) {
        console.log(chalk_1.default.white.bold('🔗 CNAME 链路'));
        console.log(chalk_1.default.gray('────────────────────────────────────────────────────────────'));
        console.log(`共 ${cnameChains.length} 条 CNAME 链路`);
        console.log('');
        const circularChains = cnameChains.filter(c => c.isCircular);
        const unresolvedChains = cnameChains.filter(c => c.unresolved.length > 0);
        const longChains = cnameChains.filter(c => c.depth >= 3);
        if (circularChains.length > 0) {
            console.log(chalk_1.default.red(`⚠️  ${circularChains.length} 条循环引用链路`));
        }
        if (unresolvedChains.length > 0) {
            console.log(chalk_1.default.yellow(`⚠️  ${unresolvedChains.length} 条未完全解析链路`));
        }
        if (longChains.length > 0) {
            console.log(chalk_1.default.blue(`ℹ️  ${longChains.length} 条深度 >= 3 的链路`));
        }
        if (verbose) {
            console.log('');
            for (const chain of cnameChains.slice(0, 5)) {
                console.log(chalk_1.default.cyan(chain.domain));
                console.log(chalk_1.default.gray((0, cnameAnalyzer_1.formatChainAsTree)(chain).split('\n').slice(1).join('\n')));
                console.log('');
            }
        }
    }
    console.log(chalk_1.default.cyan.bold('════════════════════════════════════════════════════════════'));
}
function generateBriefSummary(result) {
    const { summary } = result;
    return [
        `总记录: ${summary.totalRecords}`,
        `需调整: ${summary.needsAdjustment}`,
        `CNAME链路: ${summary.cnameChainsCount}`,
        `缺失记录: ${summary.missingRecordsCount}`
    ].join(' | ');
}
//# sourceMappingURL=generator.js.map