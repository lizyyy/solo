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
exports.SelfChecker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const generators_1 = require("./generators");
const reporters_1 = require("./reporters");
const helpers_1 = require("./utils/helpers");
class SelfChecker {
    constructor(outputDir, quickMode) {
        this.outputDir = outputDir;
        this.quickMode = quickMode;
        (0, helpers_1.ensureDir)(outputDir);
    }
    async run() {
        const results = [];
        results.push(await this.testBasicSchema());
        results.push(await this.testComplexSchema());
        results.push(await this.testArraySchema());
        results.push(await this.testNestedSchema());
        if (!this.quickMode) {
            results.push(await this.testBoundaryConditions());
            results.push(await this.testInvalidSampleGeneration());
            results.push(await this.testReportGeneration());
            results.push(await this.testSeedReproducibility());
        }
        return results;
    }
    async testBasicSchema() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-basic-schema.json');
            const schema = {
                type: 'object',
                required: ['name', 'age'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    age: { type: 'integer', minimum: 0, maximum: 150 },
                    email: { type: 'string', format: 'email' }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'basic'),
                sampleTypes: ['valid', 'boundary', 'invalid'],
                countPerType: 2,
                seed: 12345
            });
            const summary = await generator.generate();
            const samples = generator.getSamples();
            const validSamples = samples.filter(s => s.metadata.type === 'valid');
            const allValidPass = validSamples.every(s => s.validationResult.isValid);
            const invalidSamples = samples.filter(s => s.metadata.type === 'invalid');
            const invalidFailRate = invalidSamples.filter(s => !s.validationResult.isValid).length / invalidSamples.length;
            const passed = summary.totalSamples === 6 &&
                validSamples.length === 2 &&
                allValidPass &&
                invalidFailRate >= 0.5;
            return {
                name: '基础 Schema 测试',
                category: '核心功能',
                passed,
                duration: Date.now() - start,
                details: {
                    totalSamples: summary.totalSamples,
                    validSamplesPass: allValidPass,
                    invalidFailRate: invalidFailRate.toFixed(2)
                }
            };
        }
        catch (error) {
            return {
                name: '基础 Schema 测试',
                category: '核心功能',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testComplexSchema() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-complex-schema.json');
            const schema = {
                type: 'object',
                required: ['id', 'items'],
                properties: {
                    id: { type: 'string', pattern: '^[A-Z0-9]{8}$' },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 10,
                        items: {
                            type: 'object',
                            required: ['sku', 'quantity'],
                            properties: {
                                sku: { type: 'string' },
                                quantity: { type: 'integer', minimum: 1 },
                                price: { type: 'number', minimum: 0 }
                            }
                        }
                    },
                    status: { type: 'string', enum: ['pending', 'paid', 'shipped'] }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'complex'),
                sampleTypes: ['valid', 'invalid'],
                countPerType: 3,
                seed: 67890
            });
            const summary = await generator.generate();
            const passed = summary.totalSamples === 6 && summary.errors.length === 0;
            return {
                name: '复杂 Schema 测试',
                category: '核心功能',
                passed,
                duration: Date.now() - start,
                details: {
                    totalSamples: summary.totalSamples,
                    errors: summary.errors.length
                }
            };
        }
        catch (error) {
            return {
                name: '复杂 Schema 测试',
                category: '核心功能',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testArraySchema() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-array-schema.json');
            const schema = {
                type: 'array',
                minItems: 2,
                maxItems: 5,
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        value: { type: 'number' }
                    }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'array'),
                sampleTypes: ['valid'],
                countPerType: 2,
                seed: 11111
            });
            const summary = await generator.generate();
            const samples = generator.getSamples();
            const allArrays = samples.every(s => Array.isArray(s.data));
            const passed = summary.totalSamples === 2 && allArrays;
            return {
                name: '数组类型 Schema 测试',
                category: '类型支持',
                passed,
                duration: Date.now() - start,
                details: {
                    totalSamples: summary.totalSamples,
                    allArrays
                }
            };
        }
        catch (error) {
            return {
                name: '数组类型 Schema 测试',
                category: '类型支持',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testNestedSchema() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-nested-schema.json');
            const schema = {
                type: 'object',
                properties: {
                    level1: {
                        type: 'object',
                        properties: {
                            level2: {
                                type: 'object',
                                properties: {
                                    level3: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'nested'),
                sampleTypes: ['valid'],
                countPerType: 1,
                seed: 22222
            });
            const summary = await generator.generate();
            const passed = summary.totalSamples === 1 && summary.errors.length === 0;
            return {
                name: '深层嵌套 Schema 测试',
                category: '类型支持',
                passed,
                duration: Date.now() - start,
                details: {
                    totalSamples: summary.totalSamples
                }
            };
        }
        catch (error) {
            return {
                name: '深层嵌套 Schema 测试',
                category: '类型支持',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testBoundaryConditions() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-boundary-schema.json');
            const schema = {
                type: 'object',
                properties: {
                    count: { type: 'integer', minimum: 0, maximum: 100 },
                    name: { type: 'string', minLength: 2, maxLength: 10 },
                    tags: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'boundary'),
                sampleTypes: ['boundary'],
                countPerType: 5,
                seed: 33333
            });
            const summary = await generator.generate();
            const passed = summary.totalSamples === 5;
            return {
                name: '边界样本生成测试',
                category: '高级功能',
                passed,
                duration: Date.now() - start,
                details: {
                    totalSamples: summary.totalSamples
                }
            };
        }
        catch (error) {
            return {
                name: '边界样本生成测试',
                category: '高级功能',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testInvalidSampleGeneration() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-invalid-schema.json');
            const schema = {
                type: 'object',
                required: ['requiredField'],
                properties: {
                    requiredField: { type: 'string' },
                    numberField: { type: 'number', minimum: 10 },
                    enumField: { type: 'string', enum: ['a', 'b', 'c'] }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'invalid-test'),
                sampleTypes: ['invalid'],
                countPerType: 5,
                seed: 44444
            });
            const summary = await generator.generate();
            const samples = generator.getSamples();
            const validationFailCount = samples.filter(s => !s.validationResult.isValid).length;
            const failRate = validationFailCount / samples.length;
            const passed = failRate >= 0.6;
            return {
                name: '非法样本有效性测试',
                category: '高级功能',
                passed,
                duration: Date.now() - start,
                details: {
                    totalSamples: samples.length,
                    validationFailCount,
                    failRate: failRate.toFixed(2)
                }
            };
        }
        catch (error) {
            return {
                name: '非法样本有效性测试',
                category: '高级功能',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testReportGeneration() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-report-schema.json');
            const schema = {
                type: 'object',
                properties: {
                    test: { type: 'string' }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const outputDir = path.join(this.outputDir, 'report-test');
            const generator = new generators_1.SampleGenerator({
                schemaPath,
                outputDir,
                sampleTypes: ['valid'],
                countPerType: 1,
                seed: 55555
            });
            const summary = await generator.generate();
            const reporter = new reporters_1.Reporter(summary, generator.getSamples(), generator.getSchema(), generator['options']);
            const jsonReportPath = reporter.exportJsonReport();
            const htmlReportPath = reporter.exportHtmlReport();
            await new Promise(resolve => setTimeout(resolve, 100));
            const jsonExists = fs.existsSync(jsonReportPath);
            const htmlExists = fs.existsSync(htmlReportPath);
            const indexExists = fs.existsSync(path.join(outputDir, 'index.json'));
            const passed = jsonExists && htmlExists && indexExists;
            return {
                name: '报告生成测试',
                category: '输出功能',
                passed,
                duration: Date.now() - start,
                details: {
                    jsonReportExists: jsonExists,
                    htmlReportExists: htmlExists,
                    indexExists
                }
            };
        }
        catch (error) {
            return {
                name: '报告生成测试',
                category: '输出功能',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    async testSeedReproducibility() {
        const start = Date.now();
        try {
            const schemaPath = path.join(this.outputDir, 'test-seed-schema.json');
            const schema = {
                type: 'object',
                properties: {
                    value: { type: 'integer', minimum: 1, maximum: 100 }
                }
            };
            (0, helpers_1.writeJsonFile)(schemaPath, schema);
            const seed = 99999;
            const gen1 = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'seed1'),
                sampleTypes: ['valid'],
                countPerType: 1,
                seed
            });
            await gen1.generate();
            const sample1 = gen1.getSamples()[0];
            const gen2 = new generators_1.SampleGenerator({
                schemaPath,
                outputDir: path.join(this.outputDir, 'seed2'),
                sampleTypes: ['valid'],
                countPerType: 1,
                seed
            });
            await gen2.generate();
            const sample2 = gen2.getSamples()[0];
            const data1 = JSON.stringify(sample1.data);
            const data2 = JSON.stringify(sample2.data);
            const passed = data1 === data2;
            return {
                name: '种子可复现性测试',
                category: '稳定性',
                passed,
                duration: Date.now() - start,
                details: {
                    sameSeed: seed,
                    dataMatches: passed,
                    sample1: data1,
                    sample2: data2
                }
            };
        }
        catch (error) {
            return {
                name: '种子可复现性测试',
                category: '稳定性',
                passed: false,
                error: error.message,
                duration: Date.now() - start
            };
        }
    }
    printResults(results) {
        const categories = [...new Set(results.map(r => r.category))];
        for (const category of categories) {
            const categoryResults = results.filter(r => r.category === category);
            console.log(chalk_1.default.yellow.bold(`\n📋 ${category}`));
            console.log(chalk_1.default.gray('────────────────────────────────────────────────────'));
            const table = new cli_table3_1.default({
                head: [chalk_1.default.white('测试名称'), chalk_1.default.white('状态'), chalk_1.default.white('耗时')],
                colWidths: [35, 10, 10]
            });
            for (const result of categoryResults) {
                const status = result.passed
                    ? chalk_1.default.green('✅ 通过')
                    : chalk_1.default.red('❌ 失败');
                table.push([result.name, status, `${result.duration}ms`]);
            }
            console.log(table.toString());
            const failed = categoryResults.filter(r => !r.passed);
            for (const fail of failed) {
                if (fail.error) {
                    console.log(chalk_1.default.red(`\n  ❌ ${fail.name} 错误详情:`));
                    console.log(chalk_1.default.red(`     ${fail.error}`));
                }
                if (fail.details) {
                    console.log(chalk_1.default.gray(`     详情: ${JSON.stringify(fail.details, null, 2)}`));
                }
            }
        }
        const total = results.length;
        const passed = results.filter(r => r.passed).length;
        const failed = total - passed;
        const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / total);
        console.log(chalk_1.default.cyan.bold('\n═══════════════════════════════════════════════════'));
        console.log(chalk_1.default.cyan.bold('                      测试总结'));
        console.log(chalk_1.default.cyan.bold('═══════════════════════════════════════════════════'));
        console.log(`\n  总计: ${total} 个测试`);
        console.log(chalk_1.default.green(`  ✅ 通过: ${passed}`));
        console.log(chalk_1.default.red(`  ❌ 失败: ${failed}`));
        console.log(`  ⏱  平均耗时: ${avgDuration}ms`);
        console.log(`  📁 测试输出: ${this.outputDir}\n`);
        if (failed === 0) {
            console.log(chalk_1.default.green.bold('🎉 所有测试通过！\n'));
        }
        else {
            console.log(chalk_1.default.yellow.bold(`⚠  有 ${failed} 个测试失败，请检查详情\n`));
        }
    }
}
exports.SelfChecker = SelfChecker;
//# sourceMappingURL=selfcheck.js.map