"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalOutput = void 0;
exports.printTerminalSummary = printTerminalSummary;
const chalk_1 = __importDefault(require("chalk"));
class TerminalOutput {
    printSummary(result) {
        const { metadata, summary, recommendations } = result;
        console.log('\n');
        this.printHeader('CI 缓存命中分析报告');
        console.log(`\n${chalk_1.default.bold('📁 输入文件:')} ${metadata.inputFile}`);
        console.log(`${chalk_1.default.bold('📅 生成时间:')} ${new Date(metadata.generatedAt).toLocaleString()}`);
        console.log(`${chalk_1.default.bold('📊 解析统计:')} ${metadata.parsedLines}/${metadata.totalLines} 行解析成功, ${metadata.badLines} 行异常`);
        console.log('\n');
        this.printSubHeader('📈 总体摘要');
        console.log(`${chalk_1.default.bold('总阶段数:')} ${summary.totalStages}`);
        console.log(`${chalk_1.default.bold('缓存命中:')} ${chalk_1.default.green(summary.totalCacheHits)} 次`);
        console.log(`${chalk_1.default.bold('缓存未命中:')} ${chalk_1.default.red(summary.totalCacheMisses)} 次`);
        console.log(`${chalk_1.default.bold('命中率:')} ${this.formatHitRate(summary.hitRate)}`);
        console.log(`${chalk_1.default.bold('总耗时:')} ${this.formatDuration(summary.totalDurationMs)}`);
        console.log(`${chalk_1.default.bold('缓存未命中额外耗时:')} ${chalk_1.default.yellow(this.formatDuration(summary.cacheMissOverheadMs))}`);
        if (recommendations.length > 0) {
            console.log('\n');
            this.printSubHeader('💡 优化建议');
            recommendations.forEach((rec, i) => {
                console.log(`  ${i + 1}. ${rec}`);
            });
        }
        console.log('\n');
        this.printSubHeader('📋 各阶段详情');
        this.printStageTable(result.stages);
        if (result.badLines.length > 0) {
            console.log('\n');
            this.printSubHeader('⚠️  异常日志行');
            this.printBadLines(result.badLines);
        }
        console.log('\n');
    }
    printHeader(text) {
        const width = Math.min(80, text.length + 10);
        const border = '='.repeat(width);
        console.log(chalk_1.default.cyan(border));
        console.log(chalk_1.default.cyan.bold(`  ${text}  `));
        console.log(chalk_1.default.cyan(border));
    }
    printSubHeader(text) {
        console.log(chalk_1.default.magenta.bold(`--- ${text} ---`));
    }
    formatHitRate(hitRate) {
        const percentage = hitRate * 100;
        const color = percentage >= 70 ? chalk_1.default.green : percentage >= 40 ? chalk_1.default.yellow : chalk_1.default.red;
        return color(`${percentage.toFixed(2)}%`);
    }
    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        if (ms < 60000) {
            return `${(ms / 1000).toFixed(2)}s`;
        }
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(1);
        return `${minutes}m ${seconds}s`;
    }
    printStageTable(stages) {
        const maxNameLen = Math.max(...stages.map(s => s.name.length), 12);
        const header = `${'阶段'.padEnd(maxNameLen)}  ${'命中'.padStart(6)}  ${'未命中'.padStart(6)}  ${'命中率'.padStart(8)}  ${'总耗时'.padStart(10)}  ${'平均耗时'.padStart(10)}`;
        console.log(chalk_1.default.gray(header));
        console.log(chalk_1.default.gray('-'.repeat(header.length)));
        for (const stage of stages) {
            const totalChecks = stage.hitCount + stage.missCount;
            const hitRate = totalChecks > 0 ? stage.hitCount / totalChecks : 1;
            const name = stage.name.padEnd(maxNameLen);
            const hits = chalk_1.default.green(String(stage.hitCount).padStart(6));
            const misses = chalk_1.default.red(String(stage.missCount).padStart(6));
            const rate = this.formatHitRate(hitRate).padStart(10);
            const totalTime = this.formatDuration(stage.totalDurationMs).padStart(10);
            const avgTime = this.formatDuration(stage.avgDurationMs).padStart(10);
            console.log(`${name}  ${hits}  ${misses}  ${rate}  ${totalTime}  ${avgTime}`);
        }
    }
    printBadLines(badLines) {
        const showCount = Math.min(badLines.length, 5);
        for (let i = 0; i < showCount; i++) {
            const line = badLines[i];
            console.log(`  行 ${line.lineNumber}: ${chalk_1.default.yellow(line.reason)}`);
            console.log(`    ${chalk_1.default.gray(line.raw.substring(0, 100))}${line.raw.length > 100 ? '...' : ''}`);
        }
        if (badLines.length > 5) {
            console.log(`  ... 还有 ${badLines.length - 5} 个异常行，请查看完整输出报告`);
        }
    }
}
exports.TerminalOutput = TerminalOutput;
function printTerminalSummary(result) {
    const output = new TerminalOutput();
    output.printSummary(result);
}
