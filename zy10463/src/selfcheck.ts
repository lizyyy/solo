import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { SampleGenerator } from './generators';
import { Reporter } from './reporters';
import { ensureDir, writeJsonFile } from './utils/helpers';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  duration: number;
  details?: Record<string, unknown>;
}

export class SelfChecker {
  private outputDir: string;
  private quickMode: boolean;

  constructor(outputDir: string, quickMode: boolean) {
    this.outputDir = outputDir;
    this.quickMode = quickMode;
    ensureDir(outputDir);
  }

  async run(): Promise<TestResult[]> {
    const results: TestResult[] = [];

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

  private async testBasicSchema(): Promise<TestResult> {
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
      writeJsonFile(schemaPath, schema);

      const generator = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '基础 Schema 测试',
        category: '核心功能',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testComplexSchema(): Promise<TestResult> {
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
      writeJsonFile(schemaPath, schema);

      const generator = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '复杂 Schema 测试',
        category: '核心功能',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testArraySchema(): Promise<TestResult> {
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
      writeJsonFile(schemaPath, schema);

      const generator = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '数组类型 Schema 测试',
        category: '类型支持',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testNestedSchema(): Promise<TestResult> {
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
      writeJsonFile(schemaPath, schema);

      const generator = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '深层嵌套 Schema 测试',
        category: '类型支持',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testBoundaryConditions(): Promise<TestResult> {
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
      writeJsonFile(schemaPath, schema);

      const generator = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '边界样本生成测试',
        category: '高级功能',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testInvalidSampleGeneration(): Promise<TestResult> {
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
      writeJsonFile(schemaPath, schema);

      const generator = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '非法样本有效性测试',
        category: '高级功能',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testReportGeneration(): Promise<TestResult> {
    const start = Date.now();
    try {
      const schemaPath = path.join(this.outputDir, 'test-report-schema.json');
      const schema = {
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      };
      writeJsonFile(schemaPath, schema);

      const outputDir = path.join(this.outputDir, 'report-test');
      const generator = new SampleGenerator({
        schemaPath,
        outputDir,
        sampleTypes: ['valid'],
        countPerType: 1,
        seed: 55555
      });

      const summary = await generator.generate();
      const reporter = new Reporter(
        summary,
        generator.getSamples(),
        generator.getSchema(),
        generator['options']
      );

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
    } catch (error) {
      return {
        name: '报告生成测试',
        category: '输出功能',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  private async testSeedReproducibility(): Promise<TestResult> {
    const start = Date.now();
    try {
      const schemaPath = path.join(this.outputDir, 'test-seed-schema.json');
      const schema = {
        type: 'object',
        properties: {
          value: { type: 'integer', minimum: 1, maximum: 100 }
        }
      };
      writeJsonFile(schemaPath, schema);

      const seed = 99999;

      const gen1 = new SampleGenerator({
        schemaPath,
        outputDir: path.join(this.outputDir, 'seed1'),
        sampleTypes: ['valid'],
        countPerType: 1,
        seed
      });
      await gen1.generate();
      const sample1 = gen1.getSamples()[0];

      const gen2 = new SampleGenerator({
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
    } catch (error) {
      return {
        name: '种子可复现性测试',
        category: '稳定性',
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      };
    }
  }

  printResults(results: TestResult[]): void {
    const categories = [...new Set(results.map(r => r.category))];

    for (const category of categories) {
      const categoryResults = results.filter(r => r.category === category);
      
      console.log(chalk.yellow.bold(`\n📋 ${category}`));
      console.log(chalk.gray('────────────────────────────────────────────────────'));

      const table = new Table({
        head: [chalk.white('测试名称'), chalk.white('状态'), chalk.white('耗时')],
        colWidths: [35, 10, 10]
      });

      for (const result of categoryResults) {
        const status = result.passed 
          ? chalk.green('✅ 通过') 
          : chalk.red('❌ 失败');
        table.push([result.name, status, `${result.duration}ms`]);
      }

      console.log(table.toString());

      const failed = categoryResults.filter(r => !r.passed);
      for (const fail of failed) {
        if (fail.error) {
          console.log(chalk.red(`\n  ❌ ${fail.name} 错误详情:`));
          console.log(chalk.red(`     ${fail.error}`));
        }
        if (fail.details) {
          console.log(chalk.gray(`     详情: ${JSON.stringify(fail.details, null, 2)}`));
        }
      }
    }

    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / total);

    console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('                      测试总结'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════'));
    console.log(`\n  总计: ${total} 个测试`);
    console.log(chalk.green(`  ✅ 通过: ${passed}`));
    console.log(chalk.red(`  ❌ 失败: ${failed}`));
    console.log(`  ⏱  平均耗时: ${avgDuration}ms`);
    console.log(`  📁 测试输出: ${this.outputDir}\n`);

    if (failed === 0) {
      console.log(chalk.green.bold('🎉 所有测试通过！\n'));
    } else {
      console.log(chalk.yellow.bold(`⚠  有 ${failed} 个测试失败，请检查详情\n`));
    }
  }
}
