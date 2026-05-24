import * as fs from 'fs';
import * as path from 'path';
const chalk = require('chalk');
import { buildSchema } from 'graphql';
import { ExitCode } from './types';
import {
  parseSchema,
  extractAllFields,
  compareSchemas,
  detectNestedNullDrift,
} from './schema-diff';
import {
  parseQueryDocument,
  analyzeQueryImpact,
} from './query-analyzer';
import {
  NULLABILITY_RULES,
  generateFailurePaths,
  analyzeRiskLevel,
  shouldFailBuild,
  formatTypeChange,
} from './nullability-rules';
import {
  generateReport,
  writeJsonReport,
  writeMarkdownReport,
  printTerminalReport,
} from './report-generator';
import {
  parseFieldType,
  hashString,
  ensureDir,
  writeFile,
} from './utils';

interface TestCase {
  name: string;
  description: string;
  run: () => boolean;
  category: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  category: string;
}

export async function runSelfTest(outputDir: string): Promise<number> {
  console.log(chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('  GraphQL 空值漂移 CLI - 自检程序'));
  console.log(chalk.bold.blue('='.repeat(60)) + '\n');

  ensureDir(outputDir);
  const testDataDir = path.join(outputDir, 'test-data');
  ensureDir(testDataDir);

  const testCases = createTestCases(testDataDir);
  const results: TestResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  console.log(chalk.bold(`运行 ${testCases.length} 个测试用例...\n`));

  for (const testCase of testCases) {
    process.stdout.write(`  ${chalk.gray('[ ]')} ${testCase.category}: ${testCase.name}...`);

    try {
      const passed = testCase.run();
      if (passed) {
        passedCount++;
        process.stdout.write(`\r  ${chalk.green('[✓]')} ${testCase.category}: ${testCase.name}\n`);
        results.push({ name: testCase.name, passed: true, category: testCase.category });
      } else {
        failedCount++;
        process.stdout.write(`\r  ${chalk.red('[✗]')} ${testCase.category}: ${testCase.name}\n`);
        results.push({ name: testCase.name, passed: false, category: testCase.category });
      }
    } catch (error) {
      failedCount++;
      process.stdout.write(`\r  ${chalk.red('[✗]')} ${testCase.category}: ${testCase.name}\n`);
      console.log(`     ${chalk.red('错误:')} ${(error as Error).message}`);
      results.push({
        name: testCase.name,
        passed: false,
        category: testCase.category,
        error: (error as Error).message,
      });
    }
  }

  console.log();
  console.log(chalk.bold('测试结果摘要:'));
  console.log(`  通过: ${chalk.green(passedCount.toString())}`);
  console.log(`  失败: ${chalk.red(failedCount.toString())}`);
  console.log(`  总计: ${testCases.length}`);
  console.log();

  const passedCategories = new Set(results.filter((r) => r.passed).map((r) => r.category));
  console.log(chalk.bold('功能模块验证:'));
  for (const category of Array.from(new Set(results.map((r) => r.category)))) {
    const categoryResults = results.filter((r) => r.category === category);
    const categoryPassed = categoryResults.filter((r) => r.passed).length;
    const status = categoryPassed === categoryResults.length ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${status} ${category}: ${categoryPassed}/${categoryResults.length}`);
  }
  console.log();

  const reportPath = generateSelfTestReport(results, outputDir);
  console.log(`测试报告已保存: ${chalk.cyan(reportPath)}`);
  console.log();

  if (failedCount === 0) {
    console.log(chalk.green.bold('✅ 所有自检通过! 工具功能完整。\n'));
    return ExitCode.SUCCESS;
  } else {
    console.log(chalk.red.bold('❌ 部分自检失败，请检查工具安装。\n'));
    return ExitCode.SELF_TEST_FAILED;
  }
}

function createTestCases(testDataDir: string): TestCase[] {
  return [
    {
      name: '字段类型解析 - 基本类型',
      category: '类型解析',
      description: '验证基本类型的非空/可空解析',
      run: () => {
        const type1 = parseFieldType('String!');
        assert(type1.isNonNull === true, 'String! 应该是非空');
        assert(type1.isList === false, 'String! 不是列表');
        assert(type1.innerType === 'String', '内部类型应该是String');

        const type2 = parseFieldType('Int');
        assert(type2.isNonNull === false, 'Int 应该是可空');
        return true;
      },
    },
    {
      name: '字段类型解析 - 列表类型',
      category: '类型解析',
      description: '验证列表类型的各种组合解析',
      run: () => {
        const type1 = parseFieldType('[String!]!');
        assert(type1.isNonNull === true, '外层应该是非空');
        assert(type1.isList === true, '应该是列表');
        assert(type1.listInnerNonNull === true, '列表元素应该是非空');
        assert(type1.innerType === 'String', '内部类型应该是String');

        const type2 = parseFieldType('[Int]');
        assert(type2.isNonNull === false, '外层应该是可空');
        assert(type2.isList === true, '应该是列表');
        assert(type2.listInnerNonNull === false, '列表元素应该是可空');
        return true;
      },
    },
    {
      name: 'Schema解析 - SDL格式',
      category: 'Schema解析',
      description: '验证SDL格式的Schema能正确解析',
      run: () => {
        const sdl = `
          type Query {
            user: User!
            posts: [Post!]!
          }
          type User {
            id: ID!
            name: String!
          }
          type Post {
            id: ID!
            title: String!
          }
        `;
        const schema = parseSchema(sdl);
        assert(schema !== null, 'Schema解析失败');
        const fields = extractAllFields(schema);
        assert(fields.length > 0, '应该能提取字段');
        return true;
      },
    },
    {
      name: 'Schema Diff - 非空变可空',
      category: 'Schema对比',
      description: '验证能检测到字段从非空变为可空',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User
          }
          type User {
            id: ID!
            name: String
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);
        const nonNullChanges = changes.filter((c) => c.changeType === 'NON_NULL_TO_NULLABLE');
        assert(nonNullChanges.length >= 2, '应该检测到至少2个非空变可空');
        return true;
      },
    },
    {
      name: 'Schema Diff - 列表外层非空变可空',
      category: 'Schema对比',
      description: '验证能检测列表外层非空保证丢失',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            posts: [Post!]!
          }
          type Post {
            id: ID!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            posts: [Post!]
          }
          type Post {
            id: ID!
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);
        const listChanges = changes.filter((c) => c.changeType === 'LIST_WRAPPER_NON_NULL_TO_NULLABLE');
        assert(listChanges.length === 1, '应该检测到列表外层非空变可空');
        return true;
      },
    },
    {
      name: 'Schema Diff - 列表元素非空变可空',
      category: 'Schema对比',
      description: '验证能检测列表元素非空保证丢失',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            posts: [Post!]!
          }
          type Post {
            id: ID!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            posts: [Post]!
          }
          type Post {
            id: ID!
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);
        const listChanges = changes.filter((c) => c.changeType === 'LIST_INNER_NON_NULL_TO_NULLABLE');
        assert(listChanges.length === 1, '应该检测到列表元素非空变可空');
        return true;
      },
    },
    {
      name: 'Schema Diff - 字段移除检测',
      category: 'Schema对比',
      description: '验证能检测到字段被移除',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
            email: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);
        const removedChanges = changes.filter((c) => c.changeType === 'FIELD_REMOVED');
        assert(removedChanges.length === 1, '应该检测到1个字段被移除');
        return true;
      },
    },
    {
      name: '嵌套字段漂移检测',
      category: '嵌套检测',
      description: '验证能检测嵌套路径中的空值漂移',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            profile: Profile!
          }
          type Profile {
            address: Address!
          }
          type Address {
            city: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            profile: Profile
          }
          type Profile {
            address: Address
          }
          type Address {
            city: String
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);
        assert(changes.length >= 3, '应该检测到至少3处嵌套变更');
        return true;
      },
    },
    {
      name: '查询文档解析',
      category: '查询分析',
      description: '验证能正确解析GraphQL查询文档',
      run: () => {
        const query = `
          query GetUser($id: ID!) {
            user(id: $id) {
              id
              name
              posts {
                title
              }
            }
          }
        `;
        const doc = parseQueryDocument('test.graphql', query);
        assert(doc.operations.length === 1, '应该解析到1个操作');
        assert(doc.operations[0].name === 'GetUser', '操作名称应该是GetUser');
        assert(doc.operations[0].type === 'query', '操作类型应该是query');
        return true;
      },
    },
    {
      name: '查询影响分析',
      category: '查询分析',
      description: '验证能正确分析查询受影响的字段',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user(id: ID!): User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user(id: ID!): User
          }
          type User {
            id: ID!
            name: String
          }
        `);
        const { changes, newFields } = compareSchemas(oldSchema, newSchema);

        const query = `
          query GetUser($id: ID!) {
            user(id: $id) {
              id
              name
            }
          }
        `;
        const doc = parseQueryDocument('test.graphql', query);
        const affected = analyzeQueryImpact([doc], changes, newFields);

        assert(affected.length === 1, '应该有1个受影响的查询');
        assert(affected[0].affectedFields.length >= 1, '应该至少有1个受影响的字段');
        return true;
      },
    },
    {
      name: '规则引擎 - 严重程度排序',
      category: '规则引擎',
      description: '验证规则严重程度分级正确',
      run: () => {
        assert(NULLABILITY_RULES.FIELD_REMOVED.severity === 'CRITICAL', '字段移除应该是CRITICAL');
        assert(NULLABILITY_RULES.NON_NULL_TO_NULLABLE.severity === 'HIGH', '非空变可空应该是HIGH');
        assert(NULLABILITY_RULES.LIST_INNER_NON_NULL_TO_NULLABLE.severity === 'HIGH', '列表元素变化应该是HIGH');
        return true;
      },
    },
    {
      name: '规则引擎 - 失败路径生成',
      category: '规则引擎',
      description: '验证能正确生成失败路径',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User
          }
          type User {
            id: ID!
            name: String
          }
        `);
        const { changes, newFields } = compareSchemas(oldSchema, newSchema);

        const query = `
          query GetUser {
            user {
              name
            }
          }
        `;
        const doc = parseQueryDocument('test.graphql', query);
        const affected = analyzeQueryImpact([doc], changes, newFields);
        const failurePaths = generateFailurePaths(changes, affected);

        assert(failurePaths.length > 0, '应该生成失败路径');
        assert(failurePaths[0].queryOperations.length > 0, '失败路径应该关联查询');
        return true;
      },
    },
    {
      name: '风险等级分析',
      category: '规则引擎',
      description: '验证风险等级计算正确',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User
          }
          type User {
            id: ID!
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);
        const risk = analyzeRiskLevel(changes);

        assert(risk.level === 'HIGH', '风险等级应该是HIGH');
        assert(risk.score > 0, '风险分数应该大于0');
        return true;
      },
    },
    {
      name: '构建失败判断',
      category: '规则引擎',
      description: '验证构建失败阈值判断正确',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User
          }
          type User {
            id: ID!
          }
        `);
        const { changes } = compareSchemas(oldSchema, newSchema);

        assert(shouldFailBuild(changes, 'high') === true, 'HIGH阈值应该失败');
        assert(shouldFailBuild(changes, 'critical') === false, 'CRITICAL阈值不应该失败');
        assert(shouldFailBuild(changes, 'none') === false, 'NONE阈值不应该失败');
        return true;
      },
    },
    {
      name: '报告生成 - JSON格式',
      category: '报告生成',
      description: '验证能生成JSON格式报告',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User
          }
          type User {
            id: ID!
            name: String
          }
        `);
        const { changes, newFields, summary } = compareSchemas(oldSchema, newSchema);

        const query = `query GetUser { user { name } }`;
        const doc = parseQueryDocument('test.graphql', query);
        const affected = analyzeQueryImpact([doc], changes, newFields);
        const failurePaths = generateFailurePaths(changes, affected);

        const report = generateReport(changes, affected, failurePaths, {
          oldSchemaHash: hashString('old'),
          newSchemaHash: hashString('new'),
          queriesScanned: 1,
          fieldsScanned: summary.totalFieldsChecked,
        });

        const reportPath = writeJsonReport(report, testDataDir);
        assert(fs.existsSync(reportPath), 'JSON报告文件应该存在');

        const content = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        assert(content.nullabilityChanges.length > 0, '报告应该包含变更');
        return true;
      },
    },
    {
      name: '报告生成 - Markdown格式',
      category: '报告生成',
      description: '验证能生成Markdown格式报告',
      run: () => {
        const oldSchema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const newSchema = buildSchema(`
          type Query {
            user: User
          }
          type User {
            id: ID!
            name: String
          }
        `);
        const { changes, newFields, summary } = compareSchemas(oldSchema, newSchema);

        const query = `query GetUser { user { name } }`;
        const doc = parseQueryDocument('test.graphql', query);
        const affected = analyzeQueryImpact([doc], changes, newFields);
        const failurePaths = generateFailurePaths(changes, affected);

        const report = generateReport(changes, affected, failurePaths, {
          oldSchemaHash: hashString('old'),
          newSchemaHash: hashString('new'),
          queriesScanned: 1,
          fieldsScanned: summary.totalFieldsChecked,
        });

        const reportPath = writeMarkdownReport(report, testDataDir);
        assert(fs.existsSync(reportPath), 'Markdown报告文件应该存在');

        const content = fs.readFileSync(reportPath, 'utf-8');
        assert(content.includes('# GraphQL 空值漂移检测报告'), 'Markdown报告应该包含标题');
        return true;
      },
    },
    {
      name: '工具函数 - 哈希计算',
      category: '工具函数',
      description: '验证字符串哈希计算',
      run: () => {
        const hash1 = hashString('test');
        const hash2 = hashString('test');
        const hash3 = hashString('different');

        assert(hash1 === hash2, '相同输入应该产生相同哈希');
        assert(hash1 !== hash3, '不同输入应该产生不同哈希');
        assert(hash1.length === 16, '哈希应该是16字符');
        return true;
      },
    },
    {
      name: '工具函数 - 类型格式化',
      category: '工具函数',
      description: '验证类型信息格式化',
      run: () => {
        const oldType = parseFieldType('String!');
        const newType = parseFieldType('String');
        const formatted = formatTypeChange(oldType, newType);

        assert(formatted.includes('→'), '格式化结果应该包含箭头');
        assert(formatted.includes('String!'), '应该包含旧类型');
        return true;
      },
    },
    {
      name: '退出码定义完整性',
      category: '边界验证',
      description: '验证所有退出码都有明确定义',
      run: () => {
        assert(ExitCode.SUCCESS === 0, '成功应该是0');
        assert(ExitCode.CRITICAL_ISSUES === 1, '严重问题应该是1');
        assert(ExitCode.HIGH_ISSUES === 2, '高危问题应该是2');
        assert(ExitCode.INPUT_ERROR === 3, '输入错误应该是3');
        assert(ExitCode.SCHEMA_PARSE_ERROR === 4, 'Schema解析错误应该是4');
        assert(ExitCode.QUERY_PARSE_ERROR === 5, '查询解析错误应该是5');
        assert(ExitCode.MISSING_HISTORY === 6, '缺少历史应该是6');
        assert(ExitCode.SELF_TEST_FAILED === 7, '自检失败应该是7');
        return true;
      },
    },
    {
      name: '边界情况 - 无变更Schema',
      category: '边界验证',
      description: '验证完全相同的Schema不会报告错误',
      run: () => {
        const schema = buildSchema(`
          type Query {
            user: User!
          }
          type User {
            id: ID!
            name: String!
          }
        `);
        const { changes } = compareSchemas(schema, schema);
        assert(changes.length === 0, '相同Schema不应该有变更');
        return true;
      },
    },
  ];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function generateSelfTestReport(results: TestResult[], outputDir: string): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  const lines: string[] = [];
  lines.push('# GraphQL 空值漂移 CLI - 自检报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## 测试摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总测试数 | ${results.length} |`);
  lines.push(`| 通过 | ${passed} |`);
  lines.push(`| 失败 | ${failed} |`);
  lines.push(`| 通过率 | ${((passed / results.length) * 100).toFixed(1)}% |`);
  lines.push('');

  const categories = Array.from(new Set(results.map((r) => r.category)));
  for (const category of categories) {
    lines.push(`## ${category}`);
    lines.push('');
    lines.push('| 测试名称 | 状态 |');
    lines.push('|----------|------|');
    for (const result of results.filter((r) => r.category === category)) {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      lines.push(`| ${result.name} | ${status} |`);
    }
    lines.push('');
  }

  const failedTests = results.filter((r) => !r.passed);
  if (failedTests.length > 0) {
    lines.push('## 失败详情');
    lines.push('');
    for (const result of failedTests) {
      lines.push(`### ${result.category}: ${result.name}`);
      lines.push('');
      if (result.error) {
        lines.push(`\`\`\`\n${result.error}\n\`\`\``);
      }
      lines.push('');
    }
  }

  lines.push('## 功能模块覆盖');
  lines.push('');
  for (const category of categories) {
    const categoryResults = results.filter((r) => r.category === category);
    const categoryPassed = categoryResults.filter((r) => r.passed).length;
    const status = categoryPassed === categoryResults.length ? '✅' : '❌';
    lines.push(`- ${status} **${category}**: ${categoryPassed}/${categoryResults.length}`);
  }
  lines.push('');

  const reportPath = path.join(outputDir, 'self-test-report.md');
  writeFile(reportPath, lines.join('\n'));
  return reportPath;
}
