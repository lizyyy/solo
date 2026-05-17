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
exports.Reporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Reporter {
    result;
    constructor(result) {
        this.result = result;
    }
    generateTerminalSummary() {
        const lines = [];
        const { metadata, aggregations, noiseScores, candidates, parseErrors } = this.result;
        lines.push('');
        lines.push('═'.repeat(80));
        lines.push('  Alert规则消噪报告');
        lines.push('═'.repeat(80));
        lines.push('');
        lines.push(`📊 统计摘要`);
        lines.push(`   告警总数: ${metadata.totalAlerts}`);
        lines.push(`   规则总数: ${metadata.totalRules}`);
        lines.push(`   静默规则数: ${metadata.totalSilences}`);
        lines.push(`   解析错误: ${parseErrors.length}`);
        lines.push('');
        const noisyRules = noiseScores.filter((s) => s.recommendation !== 'keep');
        const silenceRules = noiseScores.filter((s) => s.recommendation === 'silence');
        const tuneRules = noiseScores.filter((s) => s.recommendation === 'tune');
        lines.push(`🎯 消噪建议`);
        lines.push(`   建议静默: ${silenceRules.length} 个规则`);
        lines.push(`   建议优化: ${tuneRules.length} 个规则`);
        lines.push(`   需要关注: ${noisyRules.length} 个规则`);
        lines.push('');
        if (aggregations.length > 0) {
            lines.push(`📈 触发频率 Top 5 规则`);
            aggregations.slice(0, 5).forEach((agg, i) => {
                const score = noiseScores.find((s) => s.ruleId === agg.ruleId);
                const noiseScore = score?.totalScore ?? 0;
                const indicator = noiseScore >= 60 ? '🔴' : noiseScore >= 40 ? '🟡' : '🟢';
                lines.push(`   ${i + 1}. ${indicator} ${agg.ruleName.padEnd(40)} x${agg.totalCount} (${noiseScore}分)`);
            });
            lines.push('');
        }
        if (candidates.length > 0) {
            lines.push(`💡 消噪候选建议`);
            candidates.slice(0, 5).forEach((candidate, i) => {
                const impactColors = { high: '🔴', medium: '🟡', low: '🟢' };
                lines.push(`   ${i + 1}. ${impactColors[candidate.impact]} [${candidate.type.toUpperCase()}] ${candidate.suggestion}`);
                lines.push(`       原因: ${candidate.reason}`);
            });
            if (candidates.length > 5) {
                lines.push(`   ... 还有 ${candidates.length - 5} 条建议`);
            }
            lines.push('');
        }
        if (parseErrors.length > 0) {
            lines.push(`⚠️ 解析错误 (${parseErrors.length})`);
            parseErrors.slice(0, 3).forEach((error, i) => {
                const lineInfo = error.lineNumber ? `:${error.lineNumber}` : '';
                lines.push(`   ${i + 1}. ${path.basename(error.file)}${lineInfo} - ${error.error}`);
            });
            if (parseErrors.length > 3) {
                lines.push(`   ... 还有 ${parseErrors.length - 3} 个错误`);
            }
            lines.push('');
        }
        lines.push('═'.repeat(80));
        lines.push('');
        return lines.join('\n');
    }
    generateJsonReport(pretty = true) {
        return pretty ? JSON.stringify(this.result, null, 2) : JSON.stringify(this.result);
    }
    generateMarkdownReport() {
        const lines = [];
        const { metadata, aggregations, noiseScores, candidates, parseErrors, matchedSilences } = this.result;
        lines.push('# Alert规则消噪分析报告');
        lines.push('');
        lines.push(`> 生成时间: ${new Date(metadata.generatedAt).toLocaleString('zh-CN')}`);
        lines.push('');
        lines.push('## 1. 统计摘要');
        lines.push('');
        lines.push('| 指标 | 数值 |');
        lines.push('|------|------|');
        lines.push(`| 告警总数 | ${metadata.totalAlerts} |`);
        lines.push(`| 规则总数 | ${metadata.totalRules} |`);
        lines.push(`| 静默规则数 | ${metadata.totalSilences} |`);
        lines.push(`| 解析错误数 | ${parseErrors.length} |`);
        lines.push('');
        const noisyRules = noiseScores.filter((s) => s.recommendation !== 'keep');
        const silenceRules = noiseScores.filter((s) => s.recommendation === 'silence');
        const tuneRules = noiseScores.filter((s) => s.recommendation === 'tune');
        const reviewRules = noiseScores.filter((s) => s.recommendation === 'review');
        const keepRules = noiseScores.filter((s) => s.recommendation === 'keep');
        lines.push('## 2. 消噪建议统计');
        lines.push('');
        lines.push('| 建议类型 | 规则数量 | 说明 |');
        lines.push('|----------|----------|------|');
        lines.push(`| 🔴 建议静默 | ${silenceRules.length} | 噪声评分≥80 |`);
        lines.push(`| 🟡 建议优化 | ${tuneRules.length} | 噪声评分60-79 |`);
        lines.push(`| 🟠 建议关注 | ${reviewRules.length} | 噪声评分≥阈值 |`);
        lines.push(`| 🟢 保留 | ${keepRules.length} | 噪声正常 |`);
        lines.push('');
        lines.push('## 3. 噪声评分明细');
        lines.push('');
        lines.push('| 规则名称 | 触发次数 | 噪声评分 | 建议 | 置信度 |');
        lines.push('|----------|----------|----------|------|--------|');
        noiseScores
            .sort((a, b) => b.totalScore - a.totalScore)
            .forEach((score) => {
            const agg = aggregations.find((a) => a.ruleId === score.ruleId);
            const count = agg?.totalCount ?? 0;
            const recommendationLabels = {
                silence: '🔴 静默',
                tune: '🟡 优化',
                review: '🟠 关注',
                keep: '🟢 保留',
            };
            lines.push(`| ${score.ruleName} | ${count} | ${score.totalScore} | ${recommendationLabels[score.recommendation]} | ${Math.round(score.confidence * 100)}% |`);
        });
        lines.push('');
        lines.push('## 4. 消噪候选建议');
        lines.push('');
        if (candidates.length > 0) {
            lines.push('| 类型 | 规则 | 建议 | 原因 | 影响 |');
            lines.push('|------|------|------|------|------|');
            candidates.forEach((c) => {
                const typeLabels = {
                    silence: '静默',
                    rule_tune: '规则优化',
                    label_adjust: '标签调整',
                };
                const impactLabels = {
                    high: '🔴 高',
                    medium: '🟡 中',
                    low: '🟢 低',
                };
                lines.push(`| ${typeLabels[c.type]} | ${c.ruleName} | ${c.suggestion} | ${c.reason} | ${impactLabels[c.impact]} |`);
            });
        }
        else {
            lines.push('暂无消噪建议');
        }
        lines.push('');
        lines.push('## 5. 静默匹配情况');
        lines.push('');
        const matched = matchedSilences.filter((m) => m.matches.length > 0);
        if (matched.length > 0) {
            lines.push('| 规则名称 | 匹配静默数 | 匹配告警数 | 匹配标签 |');
            lines.push('|----------|------------|------------|----------|');
            matched.forEach((m) => {
                const totalMatchedAlerts = m.matches.reduce((sum, ma) => sum + ma.matchedAlertCount, 0);
                const matchDetails = m.matches.map((ma) => `${ma.silenceComment}(${ma.matchedAlertCount}条:${ma.matchedBy.join(',')})`).join('; ');
                lines.push(`| ${m.ruleName} | ${m.matches.length} | ${totalMatchedAlerts} | ${matchDetails} |`);
            });
        }
        else {
            lines.push('暂无匹配的静默规则');
        }
        lines.push('');
        if (parseErrors.length > 0) {
            lines.push('## 6. 解析错误详情');
            lines.push('');
            lines.push('| 文件 | 行号 | 错误信息 | 原始内容 |');
            lines.push('|------|------|----------|----------|');
            parseErrors.forEach((e) => {
                const lineNum = e.lineNumber ?? '-';
                const rawContent = e.rawContent ? e.rawContent.slice(0, 100) : '-';
                lines.push(`| ${path.basename(e.file)} | ${lineNum} | ${e.error} | ${rawContent} |`);
            });
            lines.push('');
        }
        lines.push('---');
        lines.push('*此报告由 alert-denoiser-cli 自动生成*');
        return lines.join('\n');
    }
    saveJsonReport(outputPath) {
        this.ensureDir(outputPath);
        fs.writeFileSync(outputPath, this.generateJsonReport(), 'utf-8');
    }
    saveMarkdownReport(outputPath) {
        this.ensureDir(outputPath);
        fs.writeFileSync(outputPath, this.generateMarkdownReport(), 'utf-8');
    }
    saveAllReports(outputDir) {
        this.ensureDir(outputDir);
        this.saveJsonReport(path.join(outputDir, 'denoise-result.json'));
        this.saveMarkdownReport(path.join(outputDir, 'denoise-report.md'));
    }
    ensureDir(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
exports.Reporter = Reporter;
