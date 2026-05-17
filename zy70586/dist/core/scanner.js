"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagScanner = void 0;
const path_1 = __importDefault(require("path"));
const flag_loader_1 = require("./flag-loader");
const code_scanner_1 = require("./code-scanner");
const reporter_1 = require("../reporter/reporter");
class FeatureFlagScanner {
    constructor() {
        this.flagLoader = new flag_loader_1.FlagLoader();
        this.codeScanner = new code_scanner_1.CodeScanner();
        this.reporter = new reporter_1.Reporter();
    }
    async scan(options) {
        const startTime = new Date().toISOString();
        const allBadSamples = [];
        const { flags, badSamples: flagBadSamples } = await this.flagLoader.loadFlags(options.flagsFile, options.flags);
        allBadSamples.push(...flagBadSamples);
        if (flags.length === 0) {
            throw new Error('未找到有效的 Feature Flag，请检查开关清单文件格式');
        }
        const { references, deadBranches, badSamples: codeBadSamples, filesScanned } = await this.codeScanner.scanDirectory(options.sourceDir, flags, options.filePatterns, options.excludePatterns);
        allBadSamples.push(...codeBadSamples);
        const referencesByFile = this.groupBy(references, 'filePath');
        const referencesByFlag = this.groupBy(references, 'flagName');
        const deadBranchesByFile = this.groupBy(deadBranches, 'filePath');
        const deadBranchesByFlag = this.groupBy(deadBranches, 'flagName');
        const flagsWithDeadBranches = new Set(deadBranches.map(b => b.flagName)).size;
        const endTime = new Date().toISOString();
        const result = {
            flags: {
                total: flags.length,
                analyzed: flags.length,
                withDeadBranches: flagsWithDeadBranches,
                list: flags
            },
            references: {
                total: references.length,
                byFile: referencesByFile,
                byFlag: referencesByFlag,
                list: references
            },
            deadBranches: {
                total: deadBranches.length,
                byFile: deadBranchesByFile,
                byFlag: deadBranchesByFlag,
                list: deadBranches
            },
            badSamples: allBadSamples,
            scanInfo: {
                startTime,
                endTime,
                sourceDir: options.sourceDir,
                filesScanned,
                flagsSource: options.flagsFile || 'inline'
            }
        };
        this.reporter.generateConsoleSummary(result);
        const outputDir = options.outputDir || './reports';
        await this.reporter.generateJsonReport(result, path_1.default.join(outputDir, 'scan-result.json'));
        if (options.generateMarkdown !== false) {
            await this.reporter.generateMarkdownReport(result, path_1.default.join(outputDir, 'scan-report.md'));
        }
        if (options.generateHtml) {
            await this.reporter.generateHtmlReport(result, path_1.default.join(outputDir, 'scan-report.html'));
        }
        return result;
    }
    groupBy(items, key) {
        return items.reduce((acc, item) => {
            const k = String(item[key]);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
    }
}
exports.FeatureFlagScanner = FeatureFlagScanner;
//# sourceMappingURL=scanner.js.map