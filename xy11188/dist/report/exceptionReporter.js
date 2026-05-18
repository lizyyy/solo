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
exports.ExceptionReporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class ExceptionReporter {
    generateReport(parseResults, estimationResults) {
        const fileReports = [];
        for (let i = 0; i < parseResults.length; i++) {
            const parseResult = parseResults[i];
            const estimationResult = estimationResults[i];
            const successfulItems = parseResult.items.filter(item => item.data !== null).length;
            const failedItems = parseResult.items.filter(item => item.data === null).length;
            let status = 'success';
            if (failedItems > 0 && successfulItems > 0) {
                status = 'partial';
            }
            else if (failedItems === parseResult.items.length && parseResult.items.length > 0) {
                status = 'failed';
            }
            fileReports.push({
                fileName: parseResult.fileName,
                status,
                totalItems: parseResult.items.length,
                successfulItems,
                failedItems,
                errors: parseResult.errors,
                specialCases: estimationResult?.specialCases || []
            });
        }
        const totalErrors = fileReports.reduce((sum, fr) => sum + fr.errors.length, 0);
        const totalSpecialCases = fileReports.reduce((sum, fr) => sum + fr.specialCases.length, 0);
        const errorByType = {};
        const specialCasesByType = {};
        for (const fr of fileReports) {
            for (const error of fr.errors) {
                errorByType[error.errorType] = (errorByType[error.errorType] || 0) + 1;
            }
            for (const sc of fr.specialCases) {
                specialCasesByType[sc.caseType] = (specialCasesByType[sc.caseType] || 0) + 1;
            }
        }
        const successfulFiles = fileReports.filter(fr => fr.status === 'success').length;
        const failedFiles = fileReports.filter(fr => fr.status === 'failed').length;
        return {
            totalFiles: parseResults.length,
            successfulFiles,
            failedFiles,
            fileReports,
            summary: {
                totalErrors,
                errorByType,
                totalSpecialCases,
                specialCasesByType
            }
        };
    }
    printConsoleReport(report) {
        console.log('\n' + chalk_1.default.bold.blue('='.repeat(80)));
        console.log(chalk_1.default.bold.blue('搬家调度队 - 装车估算异常报告'));
        console.log(chalk_1.default.bold.blue('='.repeat(80)) + '\n');
        console.log(chalk_1.default.bold('概览:'));
        console.log(`  总文件数: ${report.totalFiles}`);
        console.log(`  成功文件: ${chalk_1.default.green(report.successfulFiles)}`);
        console.log(`  失败文件: ${chalk_1.default.red(report.failedFiles)}`);
        console.log(`  总错误数: ${chalk_1.default.yellow(report.summary.totalErrors)}`);
        console.log(`  特殊情况: ${chalk_1.default.cyan(report.summary.totalSpecialCases)}\n`);
        if (Object.keys(report.summary.errorByType).length > 0) {
            console.log(chalk_1.default.bold('错误类型统计:'));
            for (const [type, count] of Object.entries(report.summary.errorByType)) {
                console.log(`  ${type}: ${chalk_1.default.yellow(count)}`);
            }
            console.log('');
        }
        if (Object.keys(report.summary.specialCasesByType).length > 0) {
            console.log(chalk_1.default.bold('特殊情况统计:'));
            for (const [type, count] of Object.entries(report.summary.specialCasesByType)) {
                const typeName = type === 'nonDisassemblable' ? '大件不可拆' :
                    type === 'noElevator' ? '无电梯' :
                        type === 'reRunable' ? '可复跑' : type;
                console.log(`  ${typeName}: ${chalk_1.default.cyan(count)}`);
            }
            console.log('');
        }
        console.log(chalk_1.default.bold('详细文件报告:'));
        for (const fileReport of report.fileReports) {
            const statusColor = fileReport.status === 'success' ? chalk_1.default.green :
                fileReport.status === 'partial' ? chalk_1.default.yellow :
                    chalk_1.default.red;
            console.log(`\n  文件: ${chalk_1.default.bold(fileReport.fileName)}`);
            console.log(`  状态: ${statusColor(fileReport.status.toUpperCase())}`);
            console.log(`  总计: ${fileReport.totalItems} | 成功: ${chalk_1.default.green(fileReport.successfulItems)} | 失败: ${chalk_1.default.red(fileReport.failedItems)}`);
            if (fileReport.errors.length > 0) {
                console.log(chalk_1.default.bold('\n    错误详情:'));
                for (const error of fileReport.errors) {
                    console.log(`      [行 ${error.lineNumber}] ${chalk_1.default.red(error.errorType)}: ${error.message}`);
                    if (error.rawContent) {
                        console.log(`        原始内容: ${error.rawContent}`);
                    }
                }
            }
            if (fileReport.specialCases.length > 0) {
                console.log(chalk_1.default.bold('\n    特殊情况:'));
                for (const sc of fileReport.specialCases) {
                    const caseColor = sc.caseType === 'nonDisassemblable' ? chalk_1.default.magenta :
                        sc.caseType === 'noElevator' ? chalk_1.default.yellow :
                            chalk_1.default.cyan;
                    console.log(`      ${caseColor(sc.caseType.toUpperCase())}: ${sc.itemName}`);
                    console.log(`        描述: ${sc.description}`);
                    console.log(`        影响: ${sc.impact}`);
                }
            }
        }
        console.log('\n' + chalk_1.default.bold.blue('='.repeat(80)) + '\n');
    }
    saveJsonReport(report, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(chalk_1.default.green(`报告已保存至: ${outputPath}`));
    }
    saveTextReport(report, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        let text = '';
        text += '='.repeat(80) + '\n';
        text += '搬家调度队 - 装车估算异常报告\n';
        text += '='.repeat(80) + '\n\n';
        text += '概览:\n';
        text += `  总文件数: ${report.totalFiles}\n`;
        text += `  成功文件: ${report.successfulFiles}\n`;
        text += `  失败文件: ${report.failedFiles}\n`;
        text += `  总错误数: ${report.summary.totalErrors}\n`;
        text += `  特殊情况: ${report.summary.totalSpecialCases}\n\n`;
        if (Object.keys(report.summary.errorByType).length > 0) {
            text += '错误类型统计:\n';
            for (const [type, count] of Object.entries(report.summary.errorByType)) {
                text += `  ${type}: ${count}\n`;
            }
            text += '\n';
        }
        if (Object.keys(report.summary.specialCasesByType).length > 0) {
            text += '特殊情况统计:\n';
            for (const [type, count] of Object.entries(report.summary.specialCasesByType)) {
                const typeName = type === 'nonDisassemblable' ? '大件不可拆' :
                    type === 'noElevator' ? '无电梯' :
                        type === 'reRunable' ? '可复跑' : type;
                text += `  ${typeName}: ${count}\n`;
            }
            text += '\n';
        }
        text += '详细文件报告:\n';
        for (const fileReport of report.fileReports) {
            text += `\n  文件: ${fileReport.fileName}\n`;
            text += `  状态: ${fileReport.status.toUpperCase()}\n`;
            text += `  总计: ${fileReport.totalItems} | 成功: ${fileReport.successfulItems} | 失败: ${fileReport.failedItems}\n`;
            if (fileReport.errors.length > 0) {
                text += '\n    错误详情:\n';
                for (const error of fileReport.errors) {
                    text += `      [行 ${error.lineNumber}] ${error.errorType}: ${error.message}\n`;
                    if (error.rawContent) {
                        text += `        原始内容: ${error.rawContent}\n`;
                    }
                }
            }
            if (fileReport.specialCases.length > 0) {
                text += '\n    特殊情况:\n';
                for (const sc of fileReport.specialCases) {
                    text += `      ${sc.caseType.toUpperCase()}: ${sc.itemName}\n`;
                    text += `        描述: ${sc.description}\n`;
                    text += `        影响: ${sc.impact}\n`;
                }
            }
        }
        text += '\n' + '='.repeat(80) + '\n';
        fs.writeFileSync(outputPath, text, 'utf8');
        console.log(chalk_1.default.green(`报告已保存至: ${outputPath}`));
    }
}
exports.ExceptionReporter = ExceptionReporter;
