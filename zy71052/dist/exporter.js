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
exports.exportResults = exportResults;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
const risk_assessor_1 = require("./risk-assessor");
const timezone_utils_1 = require("./timezone-utils");
function exportResults(result, options) {
    const formats = options.format;
    if (formats.includes('terminal')) {
        printTerminalSummary(result, options.verbose);
    }
    if (formats.includes('json')) {
        exportJSON(result, options.output, options.overwrite, options.append);
    }
    if (formats.includes('markdown')) {
        exportMarkdown(result, options.output, options.overwrite, options.append);
    }
}
function printTerminalSummary(result, verbose) {
    console.log('\n');
    console.log(chalk_1.default.bold.cyan('══════════════════════════════════════════════════════════════'));
    console.log(chalk_1.default.bold.cyan('              OpenAPI 退役路由巡检报告'));
    console.log(chalk_1.default.bold.cyan('══════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk_1.default.gray(`巡检时间: ${result.metadata.inspectionDate}`));
    console.log(chalk_1.default.gray(`报告 ID: ${result.metadata.reportId}`));
    console.log('');
    const summaryData = [
        [chalk_1.default.bold('指标'), chalk_1.default.bold('数值')],
        ['退役路由总数', result.summary.totalDeprecatedRoutes],
        ['活跃退役路由', chalk_1.default.yellow(result.summary.activeDeprecatedRoutes)],
        ['受影响客户端', chalk_1.default.yellow(result.summary.affectedClients)],
        ['退役请求总数', chalk_1.default.yellow(result.summary.totalDeprecatedRequests.toLocaleString())],
        ['严重风险', chalk_1.default.red(result.summary.criticalRiskClients)],
        ['高风险', chalk_1.default.hex('#FFA500')(result.summary.highRiskClients)],
        ['中风险', chalk_1.default.yellow(result.summary.mediumRiskClients)],
        ['低风险', chalk_1.default.green(result.summary.lowRiskClients)],
    ];
    console.log(chalk_1.default.bold('📊 巡检摘要'));
    console.log((0, table_1.table)(summaryData, {
        header: {
            alignment: 'center',
            content: '统计概览',
        },
    }));
    if (result.clientUsages.length > 0) {
        console.log(chalk_1.default.bold('⚠️  风险客户端排行'));
        const clientData = [
            [chalk_1.default.bold('风险'), chalk_1.default.bold('客户端'), chalk_1.default.bold('请求数'), chalk_1.default.bold('接口数'), chalk_1.default.bold('负责人')],
            ...result.clientUsages.slice(0, verbose ? undefined : 10).map(usage => [
                `${(0, risk_assessor_1.getRiskLevelEmoji)(usage.riskLevel)} ${(0, risk_assessor_1.getRiskLevelLabel)(usage.riskLevel)}`,
                usage.clientName,
                usage.totalRequests.toLocaleString(),
                usage.routes.length,
                usage.owner?.name || '-',
            ]),
        ];
        console.log((0, table_1.table)(clientData));
        if (!verbose && result.clientUsages.length > 10) {
            console.log(chalk_1.default.gray(`  ... 还有 ${result.clientUsages.length - 10} 个客户端，使用 -v 查看全部`));
        }
    }
    if (result.deprecatedRoutes.length > 0) {
        console.log(chalk_1.default.bold('🔗 活跃退役路由详情'));
        const activeRoutes = result.deprecatedRoutes.filter(route => result.clientUsages.some(cu => cu.routes.some(r => r.path === route.path && r.method === route.method)));
        const routeData = [
            [chalk_1.default.bold('方法'), chalk_1.default.bold('路径'), chalk_1.default.bold('退役日期'), chalk_1.default.bold('替换路径')],
            ...activeRoutes.slice(0, verbose ? undefined : 5).map(route => [
                route.method,
                route.path,
                route.deprecationDate || '-',
                route.replacement || '-',
            ]),
        ];
        console.log((0, table_1.table)(routeData));
        if (!verbose && activeRoutes.length > 5) {
            console.log(chalk_1.default.gray(`  ... 还有 ${activeRoutes.length - 5} 个路由，使用 -v 查看全部`));
        }
    }
    if (result.unmatchedClients.length > 0) {
        console.log(chalk_1.default.bold.yellow('⚠️  未匹配客户端'));
        console.log('  以下客户端在日志中出现但未在客户端清单中找到:');
        const displayCount = verbose ? result.unmatchedClients.length : 5;
        for (let i = 0; i < displayCount && i < result.unmatchedClients.length; i++) {
            console.log(`    - ${result.unmatchedClients[i]}`);
        }
        if (!verbose && result.unmatchedClients.length > 5) {
            console.log(chalk_1.default.gray(`    ... 还有 ${result.unmatchedClients.length - 5} 个`));
        }
        console.log('');
    }
    console.log(chalk_1.default.bold.cyan('══════════════════════════════════════════════════════════════'));
    if (result.summary.criticalRiskClients > 0) {
        console.log(chalk_1.default.red.bold(`⚠️  检测到 ${result.summary.criticalRiskClients} 个严重风险客户端，请立即处理！`));
    }
    console.log('');
}
function exportJSON(result, outputDir, overwrite, append) {
    const outputPath = path.join(outputDir, 'inspection-report.json');
    let dataToWrite = result;
    if (append && fs.existsSync(outputPath)) {
        const existingContent = fs.readFileSync(outputPath, 'utf-8');
        try {
            const existing = JSON.parse(existingContent);
            if (Array.isArray(existing)) {
                dataToWrite = [...existing, result];
            }
            else {
                dataToWrite = [existing, result];
            }
            console.log(chalk_1.default.gray(`追加 JSON 报告到: ${outputPath}`));
        }
        catch {
            dataToWrite = result;
            console.log(chalk_1.default.yellow(`无法追加，覆盖现有 JSON 文件: ${outputPath}`));
        }
    }
    else if (!overwrite && fs.existsSync(outputPath)) {
        const backupPath = path.join(outputDir, `inspection-report.${Date.now()}.json`);
        fs.renameSync(outputPath, backupPath);
        console.log(chalk_1.default.gray(`已备份旧报告到: ${backupPath}`));
    }
    fs.writeFileSync(outputPath, JSON.stringify(dataToWrite, null, 2), 'utf-8');
    console.log(chalk_1.default.green(`✓ JSON 报告已生成: ${outputPath}`));
}
function exportMarkdown(result, outputDir, overwrite, append) {
    const outputPath = path.join(outputDir, 'inspection-report.md');
    const content = generateMarkdownReport(result);
    if (append && fs.existsSync(outputPath)) {
        const existingContent = fs.readFileSync(outputPath, 'utf-8');
        const newContent = existingContent + '\n\n---\n\n' + content;
        fs.writeFileSync(outputPath, newContent, 'utf-8');
        console.log(chalk_1.default.gray(`追加 Markdown 报告到: ${outputPath}`));
    }
    else {
        if (!overwrite && fs.existsSync(outputPath)) {
            const backupPath = path.join(outputDir, `inspection-report.${Date.now()}.md`);
            fs.renameSync(outputPath, backupPath);
            console.log(chalk_1.default.gray(`已备份旧报告到: ${backupPath}`));
        }
        fs.writeFileSync(outputPath, content, 'utf-8');
        console.log(chalk_1.default.green(`✓ Markdown 报告已生成: ${outputPath}`));
    }
}
function generateMarkdownReport(result) {
    const lines = [];
    lines.push('# OpenAPI 退役路由巡检报告');
    lines.push('');
    lines.push(`**巡检时间**: ${result.metadata.inspectionDate}`);
    lines.push(`**报告 ID**: ${result.metadata.reportId}`);
    lines.push(`**时区**: ${result.metadata.timezone}`);
    lines.push('');
    lines.push('## 📊 巡检摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 退役路由总数 | ${result.summary.totalDeprecatedRoutes} |`);
    lines.push(`| 活跃退役路由 | ${result.summary.activeDeprecatedRoutes} |`);
    lines.push(`| 受影响客户端 | ${result.summary.affectedClients} |`);
    lines.push(`| 退役请求总数 | ${result.summary.totalDeprecatedRequests.toLocaleString()} |`);
    lines.push(`| 严重风险 | 🔴 ${result.summary.criticalRiskClients} |`);
    lines.push(`| 高风险 | 🟠 ${result.summary.highRiskClients} |`);
    lines.push(`| 中风险 | 🟡 ${result.summary.mediumRiskClients} |`);
    lines.push(`| 低风险 | 🟢 ${result.summary.lowRiskClients} |`);
    lines.push('');
    lines.push('## ⚠️ 风险客户端详情');
    lines.push('');
    lines.push('| 风险等级 | 客户端名称 | 请求数 | 接口数 | 版本数 | 负责人 | 联系方式 |');
    lines.push('|----------|------------|--------|--------|--------|--------|----------|');
    for (const usage of result.clientUsages) {
        const emoji = (0, risk_assessor_1.getRiskLevelEmoji)(usage.riskLevel);
        const label = (0, risk_assessor_1.getRiskLevelLabel)(usage.riskLevel);
        lines.push(`| ${emoji} ${label} | ${usage.clientName} | ${usage.totalRequests.toLocaleString()} | ${usage.routes.length} | ${Object.keys(usage.versions).length} | ${usage.owner?.name || '-'} | ${usage.owner?.email || '-'} |`);
    }
    lines.push('');
    lines.push('## 🔗 退役路由使用明细');
    lines.push('');
    lines.push('### 客户端维度');
    lines.push('');
    for (const usage of result.clientUsages) {
        lines.push(`<details>`);
        lines.push(`<summary><strong>${(0, risk_assessor_1.getRiskLevelEmoji)(usage.riskLevel)} ${usage.clientName}</strong> - ${usage.totalRequests.toLocaleString()} 次请求</summary>`);
        lines.push('');
        lines.push(`- **负责人**: ${usage.owner?.name || '未分配'}`);
        lines.push(`- **邮箱**: ${usage.owner?.email || '-'}`);
        lines.push(`- **部门**: ${usage.owner?.department || '-'}`);
        lines.push('');
        lines.push('**使用的退役接口**:');
        lines.push('');
        lines.push('| 方法 | 路径 | 请求数 | 最后使用 |');
        lines.push('|------|------|--------|----------|');
        for (const route of usage.routes) {
            lines.push(`| ${route.method} | ${route.path} | ${route.count} | ${(0, timezone_utils_1.formatDateInTimezone)(route.lastUsed, result.metadata.timezone)} |`);
        }
        lines.push('');
        lines.push('**版本分布**:');
        lines.push('');
        lines.push('| 版本 | 请求数 | 最后使用 |');
        lines.push('|------|--------|----------|');
        for (const [version, data] of Object.entries(usage.versions)) {
            lines.push(`| ${version} | ${data.count} | ${(0, timezone_utils_1.formatDateInTimezone)(data.lastUsed, result.metadata.timezone)} |`);
        }
        lines.push('');
        lines.push(`</details>`);
        lines.push('');
    }
    lines.push('### 路由维度');
    lines.push('');
    const activeRoutes = result.deprecatedRoutes.filter(route => result.clientUsages.some(cu => cu.routes.some(r => r.path === route.path && r.method === route.method)));
    for (const route of activeRoutes) {
        const usingClients = result.clientUsages.filter(cu => cu.routes.some(r => r.path === route.path && r.method === route.method));
        const totalRequests = usingClients.reduce((sum, cu) => {
            const routeData = cu.routes.find(r => r.path === route.path && r.method === route.method);
            return sum + (routeData?.count || 0);
        }, 0);
        lines.push(`<details>`);
        lines.push(`<summary><strong>${route.method} ${route.path}</strong> - ${totalRequests.toLocaleString()} 次请求</summary>`);
        lines.push('');
        if (route.deprecationDate) {
            lines.push(`- **退役日期**: ${route.deprecationDate}`);
        }
        if (route.replacement) {
            lines.push(`- **替换路径**: ${route.replacement}`);
        }
        if (route.xDeprecation?.reason) {
            lines.push(`- **退役原因**: ${route.xDeprecation.reason}`);
        }
        lines.push('');
        lines.push('**使用该接口的客户端**:');
        lines.push('');
        lines.push('| 客户端 | 请求数 | 风险等级 |');
        lines.push('|--------|--------|----------|');
        for (const client of usingClients) {
            const routeData = client.routes.find(r => r.path === route.path && r.method === route.method);
            lines.push(`| ${client.clientName} | ${routeData?.count || 0} | ${(0, risk_assessor_1.getRiskLevelEmoji)(client.riskLevel)} ${(0, risk_assessor_1.getRiskLevelLabel)(client.riskLevel)} |`);
        }
        lines.push('');
        lines.push(`</details>`);
        lines.push('');
    }
    if (result.unmatchedClients.length > 0) {
        lines.push('## ⚠️ 未匹配客户端');
        lines.push('');
        lines.push('以下客户端在日志中出现但未在客户端清单中找到:');
        lines.push('');
        for (const client of result.unmatchedClients) {
            lines.push(`- ${client}`);
        }
        lines.push('');
    }
    if (result.unmatchedRoutes.length > 0) {
        lines.push('## ❓ 未匹配路径');
        lines.push('');
        lines.push('以下路径在日志中出现但未匹配到任何退役路由:');
        lines.push('');
        lines.push('| 方法 | 路径 | 请求数 |');
        lines.push('|------|------|--------|');
        for (const route of result.unmatchedRoutes.slice(0, 20)) {
            lines.push(`| ${route.method} | ${route.path} | ${route.count} |`);
        }
        if (result.unmatchedRoutes.length > 20) {
            lines.push(`| ... | ... | ... |`);
        }
        lines.push('');
    }
    lines.push('## 📝 输入文件');
    lines.push('');
    lines.push(`- OpenAPI 规范: ${result.metadata.openapiFile}`);
    lines.push(`- 网关日志: ${result.metadata.logFile}`);
    lines.push(`- 客户端清单: ${result.metadata.clientFile}`);
    lines.push(`- 负责人表: ${result.metadata.ownerFile}`);
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=exporter.js.map