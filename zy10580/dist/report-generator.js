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
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class ReportGenerator {
    async generateConsoleSummary(auditResult) {
        const { summary, results, parseErrors } = auditResult;
        console.log('\n' + chalk_1.default.bold.blue('='.repeat(60)));
        console.log(chalk_1.default.bold.blue('           SITEMAP 链接巡检报告'));
        console.log(chalk_1.default.bold.blue('='.repeat(60)));
        console.log('\n' + chalk_1.default.bold('📅 巡检时间:'));
        console.log(`   开始: ${auditResult.startedAt}`);
        console.log(`   结束: ${auditResult.finishedAt}`);
        console.log(`   总耗时: ${(summary.totalTime / 1000).toFixed(2)} 秒`);
        console.log('\n' + chalk_1.default.bold('📁 源文件:'));
        auditResult.sourceFiles.forEach(file => {
            console.log(`   - ${file}`);
        });
        console.log('\n' + chalk_1.default.bold('📊 统计摘要:'));
        console.log(`   总链接数: ${summary.totalUrls}`);
        console.log(`   平均响应时间: ${summary.avgResponseTime.toFixed(0)} ms`);
        console.log('\n' + chalk_1.default.bold('✅ 正常链接:'));
        console.log(chalk_1.default.green(`   ${summary.successful} 个 (${((summary.successful / summary.totalUrls) * 100).toFixed(1)}%)`));
        console.log('\n' + chalk_1.default.bold('❌ 异常链接:'));
        console.log(chalk_1.default.red(`   总计: ${summary.failed} 个 (${((summary.failed / summary.totalUrls) * 100).toFixed(1)}%)`));
        console.log(chalk_1.default.yellow(`   - 404 不存在: ${summary.notFound} 个`));
        console.log(chalk_1.default.magenta(`   - 跳转链接: ${summary.redirected} 个`));
        console.log(chalk_1.default.red(`   - 服务端错误 (5xx): ${summary.serverErrors} 个`));
        console.log(chalk_1.default.red(`   - 客户端错误 (4xx): ${summary.clientErrors} 个`));
        if (parseErrors.length > 0) {
            console.log('\n' + chalk_1.default.bold.red('⚠️  解析错误:'));
            console.log(`   ${parseErrors.length} 个解析错误`);
        }
        console.log('\n' + chalk_1.default.bold('📋 问题链接详情:'));
        const errorResults = results.filter(r => !r.ok || r.is404 || r.isRedirect);
        if (errorResults.length === 0) {
            console.log(chalk_1.default.green('   没有发现问题链接！'));
        }
        else {
            errorResults.slice(0, 20).forEach((result, index) => {
                this.printUrlResult(result, index);
            });
            if (errorResults.length > 20) {
                console.log(chalk_1.default.gray(`   ... 还有 ${errorResults.length - 20} 个问题链接，请查看详细报告`));
            }
        }
        if (parseErrors.length > 0) {
            console.log('\n' + chalk_1.default.bold.red('⚠️  解析错误详情:'));
            parseErrors.forEach((error, index) => {
                this.printParseError(error, index);
            });
        }
        console.log('\n' + chalk_1.default.bold.blue('='.repeat(60)) + '\n');
    }
    printUrlResult(result, index) {
        const prefix = `   ${index + 1}. `;
        let statusColor = chalk_1.default.gray;
        if (result.status >= 500)
            statusColor = chalk_1.default.red;
        else if (result.status >= 400)
            statusColor = chalk_1.default.red;
        else if (result.status >= 300)
            statusColor = chalk_1.default.yellow;
        else if (result.status >= 200)
            statusColor = chalk_1.default.green;
        console.log(prefix + statusColor(`[${result.status}] ${result.originalUrl}`));
        if (result.lineNumber) {
            console.log(`       ${chalk_1.default.gray(`位置: ${result.sourceFile}:${result.lineNumber}`)}`);
        }
        if (result.isRedirect && result.redirectCount > 0) {
            console.log(`       ${chalk_1.default.magenta(`跳转 ${result.redirectCount} 次 → ${result.finalUrl}`)}`);
        }
        if (result.error) {
            console.log(`       ${chalk_1.default.red(`错误: ${result.error}`)}`);
        }
        if (result.title) {
            console.log(`       ${chalk_1.default.gray(`标题: ${result.title}`)}`);
        }
    }
    printParseError(error, index) {
        const prefix = `   ${index + 1}. `;
        console.log(prefix + chalk_1.default.red(error.sourceFile + (error.lineNumber ? `:${error.lineNumber}` : '')));
        console.log(`       ${chalk_1.default.red(`错误: ${error.error}`)}`);
    }
    async exportJson(auditResult, outputPath) {
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(outputPath, JSON.stringify(auditResult, null, 2), 'utf-8');
        console.log(chalk_1.default.green(`✅ JSON 报告已导出: ${outputPath}`));
    }
    async exportHtml(auditResult, outputPath) {
        const html = this.generateHtmlReport(auditResult);
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(outputPath, html, 'utf-8');
        console.log(chalk_1.default.green(`✅ HTML 报告已导出: ${outputPath}`));
    }
    generateHtmlReport(auditResult) {
        const { summary, results, parseErrors } = auditResult;
        const errorResults = results.filter(r => !r.ok || r.is404 || r.isRedirect);
        const okResults = results.filter(r => r.ok && !r.is404);
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sitemap 链接巡检报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .time { opacity: 0.9; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
        .stat-card .number { font-size: 32px; font-weight: bold; margin-bottom: 5px; }
        .stat-card .label { color: #666; font-size: 14px; }
        .stat-card.ok .number { color: #10b981; }
        .stat-card.error .number { color: #ef4444; }
        .stat-card.warn .number { color: #f59e0b; }
        .stat-card.redirect .number { color: #8b5cf6; }
        .section { background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .section h2 { font-size: 20px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
        .source-files { display: flex; flex-wrap: wrap; gap: 10px; }
        .source-tag { background: #e0e7ff; color: #4338ca; padding: 5px 12px; border-radius: 20px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8fafc; font-weight: 600; }
        tr:hover { background: #f8fafc; }
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .status-200 { background: #dcfce7; color: #166534; }
        .status-300 { background: #fef3c7; color: #92400e; }
        .status-400 { background: #fee2e2; color: #991b1b; }
        .status-500 { background: #fecaca; color: #7f1d1d; }
        .status-0 { background: #f3f4f6; color: #4b5563; }
        .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .error-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
        .error-box .file { font-weight: 600; color: #991b1b; }
        .error-box .message { color: #7f1d1d; margin-top: 5px; }
        .redirect-chain { font-size: 12px; color: #666; margin-top: 5px; }
        .redirect-step { display: flex; align-items: center; gap: 8px; }
        .arrow { color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Sitemap 链接巡检报告</h1>
            <div class="time">开始时间: ${auditResult.startedAt}</div>
            <div class="time">结束时间: ${auditResult.finishedAt}</div>
            <div class="time">总耗时: ${(summary.totalTime / 1000).toFixed(2)} 秒</div>
        </div>

        <div class="section">
            <h2>📁 源文件</h2>
            <div class="source-files">
                ${auditResult.sourceFiles.map(f => `<span class="source-tag">${f}</span>`).join('')}
            </div>
        </div>

        <div class="stats">
            <div class="stat-card ok">
                <div class="number">${summary.successful}</div>
                <div class="label">正常链接</div>
            </div>
            <div class="stat-card error">
                <div class="number">${summary.notFound}</div>
                <div class="label">404 不存在</div>
            </div>
            <div class="stat-card redirect">
                <div class="number">${summary.redirected}</div>
                <div class="label">跳转链接</div>
            </div>
            <div class="stat-card error">
                <div class="number">${summary.serverErrors}</div>
                <div class="label">服务端错误</div>
            </div>
            <div class="stat-card error">
                <div class="number">${summary.clientErrors}</div>
                <div class="label">客户端错误</div>
            </div>
            <div class="stat-card">
                <div class="number">${summary.totalUrls}</div>
                <div class="label">总计</div>
            </div>
        </div>

        ${parseErrors.length > 0 ? `
        <div class="section">
            <h2>⚠️ 解析错误 (${parseErrors.length} 个)</h2>
            ${parseErrors.map(error => `
                <div class="error-box">
                    <div class="file">${error.sourceFile}${error.lineNumber ? `:${error.lineNumber}` : ''}</div>
                    <div class="message">${error.error}</div>
                    ${error.rawContent ? `<div style="font-size: 12px; color: #666; margin-top: 8px; font-family: monospace;">${error.rawContent}</div>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${errorResults.length > 0 ? `
        <div class="section">
            <h2>❌ 问题链接 (${errorResults.length} 个)</h2>
            <table>
                <thead>
                    <tr>
                        <th>状态</th>
                        <th>原始URL</th>
                        <th>最终URL</th>
                        <th>跳转</th>
                        <th>标题</th>
                        <th>响应时间</th>
                        <th>来源</th>
                    </tr>
                </thead>
                <tbody>
                    ${errorResults.map(r => `
                        <tr>
                            <td><span class="status-badge status-${this.getStatusClass(r.status)}">${r.status}</span></td>
                            <td class="url-cell" title="${r.originalUrl}"><a href="${r.originalUrl}" target="_blank">${r.originalUrl}</a></td>
                            <td class="url-cell" title="${r.finalUrl}">${r.finalUrl !== r.originalUrl ? `<a href="${r.finalUrl}" target="_blank">${r.finalUrl}</a>` : '-'}</td>
                            <td>${r.redirectCount > 0 ? `${r.redirectCount} 次` : '-'}</td>
                            <td>${r.title || '-'}</td>
                            <td>${r.responseTime}ms</td>
                            <td class="url-cell" title="${r.sourceFile}${r.lineNumber ? `:${r.lineNumber}` : ''}">${path.basename(r.sourceFile)}${r.lineNumber ? `:${r.lineNumber}` : ''}</td>
                        </tr>
                        ${r.redirectChain.length > 1 ? `
                        <tr>
                            <td colspan="7">
                                <div class="redirect-chain">
                                    跳转链:
                                    ${r.redirectChain.map((step, i) => `
                                        <span class="redirect-step">
                                            <span class="status-badge status-${this.getStatusClass(step.status)}">${step.status}</span>
                                            <span>${step.url}</span>
                                            ${i < r.redirectChain.length - 1 ? '<span class="arrow">→</span>' : ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </td>
                        </tr>
                        ` : ''}
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="section">
            <h2>✅ 正常链接 (${okResults.length} 个)</h2>
            <table>
                <thead>
                    <tr>
                        <th>状态</th>
                        <th>URL</th>
                        <th>标题</th>
                        <th>响应时间</th>
                        <th>来源</th>
                    </tr>
                </thead>
                <tbody>
                    ${okResults.slice(0, 100).map(r => `
                        <tr>
                            <td><span class="status-badge status-200">${r.status}</span></td>
                            <td class="url-cell" title="${r.originalUrl}"><a href="${r.originalUrl}" target="_blank">${r.originalUrl}</a></td>
                            <td>${r.title || '-'}</td>
                            <td>${r.responseTime}ms</td>
                            <td class="url-cell" title="${r.sourceFile}${r.lineNumber ? `:${r.lineNumber}` : ''}">${path.basename(r.sourceFile)}${r.lineNumber ? `:${r.lineNumber}` : ''}</td>
                        </tr>
                    `).join('')}
                    ${okResults.length > 100 ? `<tr><td colspan="5" style="text-align: center; color: #666;">... 还有 ${okResults.length - 100} 个正常链接，请查看 JSON 报告</td></tr>` : ''}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
    }
    getStatusClass(status) {
        if (status >= 500)
            return '500';
        if (status >= 400)
            return '400';
        if (status >= 300)
            return '300';
        if (status >= 200)
            return '200';
        return '0';
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=report-generator.js.map