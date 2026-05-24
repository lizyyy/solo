import * as yaml from 'js-yaml';
import { expandYaml, getValueByKeyPath, toYamlString } from './expander';
import { SelfTestResult, ExpansionResult } from './types';
import chalk from 'chalk';

const TEST_CASES = [
  {
    name: '基础 Anchor/Alias 解析',
    yaml: `
defaults: &defaults
  adapter: postgres
  host: localhost

development:
  <<: *defaults
  database: dev_db
`,
    validate: (result: ExpansionResult): boolean => {
      return (
        result.expanded &&
        result.expanded.development &&
        result.expanded.development.adapter === 'postgres' &&
        result.expanded.development.host === 'localhost' &&
        result.expanded.development.database === 'dev_db'
      );
    },
  },
  {
    name: '多 Merge Key 合并',
    yaml: `
base: &base
  a: 1
  b: 2

extra: &extra
  c: 3
  d: 4

combined:
  <<: [*base, *extra]
  e: 5
`,
    validate: (result: ExpansionResult): boolean => {
      const c = result.expanded?.combined;
      return c && c.a === 1 && c.b === 2 && c.c === 3 && c.d === 4 && c.e === 5;
    },
  },
  {
    name: '嵌套 Anchor',
    yaml: `
mysql: &mysql
  engine: mysql
  port: 3306

prod_db: &prod_db
  <<: *mysql
  host: prod.example.com

production:
  database:
    <<: *prod_db
    name: app_db
`,
    validate: (result: ExpansionResult): boolean => {
      const db = result.expanded?.production?.database;
      return (
        db &&
        db.engine === 'mysql' &&
        db.port === 3306 &&
        db.host === 'prod.example.com' &&
        db.name === 'app_db'
      );
    },
  },
  {
    name: 'Anchor 覆盖优先级',
    yaml: `
base: &base
  timeout: 30
  retries: 3

prod:
  <<: *base
  timeout: 60
`,
    validate: (result: ExpansionResult): boolean => {
      return (
        result.expanded?.prod?.timeout === 60 && result.expanded?.prod?.retries === 3
      );
    },
  },
  {
    name: '数组中的 Alias',
    yaml: `
common: &common
  name: common
  value: 100

items:
  - *common
  - name: second
    value: 200
`,
    validate: (result: ExpansionResult): boolean => {
      const items = result.expanded?.items;
      return (
        Array.isArray(items) &&
        items[0]?.name === 'common' &&
        items[0]?.value === 100 &&
        items[1]?.name === 'second'
      );
    },
  },
  {
    name: '键路径访问',
    yaml: `
a:
  b:
    c:
      d: deep_value
    arr:
      - first
      - second
`,
    validate: (result: ExpansionResult): boolean => {
      const v1 = getValueByKeyPath(result.expanded, 'a.b.c.d');
      const v2 = getValueByKeyPath(result.expanded, 'a.b.arr[1]');
      return v1.value === 'deep_value' && v2.value === 'second';
    },
  },
  {
    name: '空值和布尔值处理',
    yaml: `
settings:
  enabled: true
  disabled: false
  empty: null
  missing: ~
`,
    validate: (result: ExpansionResult): boolean => {
      const s = result.expanded?.settings;
      return s.enabled === true && s.disabled === false && s.empty === null && s.missing === null;
    },
  },
  {
    name: '复杂类型保留',
    yaml: `
numbers:
  int: 42
  float: 3.14
  hex: 0xff
strings:
  simple: hello
  quoted: "world"
  multiline: |
    line1
    line2
`,
    validate: (result: ExpansionResult): boolean => {
      const n = result.expanded?.numbers;
      const s = result.expanded?.strings;
      return (
        n.int === 42 &&
        n.float === 3.14 &&
        n.hex === 255 &&
        s.simple === 'hello' &&
        s.quoted === 'world' &&
        s.multiline.includes('line1')
      );
    },
  },
];

export function runSelfTests(): SelfTestResult[] {
  const results: SelfTestResult[] = [];

  for (const testCase of TEST_CASES) {
    try {
      const result = expandYaml(testCase.yaml);

      if (result.errors.length > 0) {
        results.push({
          name: testCase.name,
          passed: false,
          message: `解析错误: ${result.errors.join(', ')}`,
        });
        continue;
      }

      const passed = testCase.validate(result);
      results.push({
        name: testCase.name,
        passed,
        message: passed ? '通过' : '验证失败',
        details: {
          expanded: result.expanded,
          mergeKeys: result.mergeKeys.length,
          overrides: result.overrides.length,
        },
      });
    } catch (e) {
      results.push({
        name: testCase.name,
        passed: false,
        message: `异常: ${(e as Error).message}`,
      });
    }
  }

  results.push(testBoundaryCases());
  results.push(testOutputStability());

  return results;
}

function testBoundaryCases(): SelfTestResult {
  const boundaryTests = [
    {
      name: '空 YAML',
      yaml: '',
      check: (r: ExpansionResult) => r.expanded === undefined || r.expanded === null,
    },
    {
      name: '仅注释',
      yaml: '# just a comment',
      check: (r: ExpansionResult) => r.expanded === undefined || r.expanded === null,
    },
    {
      name: '简单标量',
      yaml: 'just_a_string',
      check: (r: ExpansionResult) => r.expanded === 'just_a_string',
    },
    {
      name: '空对象',
      yaml: 'empty: {}',
      check: (r: ExpansionResult) => typeof r.expanded?.empty === 'object',
    },
    {
      name: '空数组',
      yaml: 'empty: []',
      check: (r: ExpansionResult) => Array.isArray(r.expanded?.empty),
    },
  ];

  const failures: string[] = [];
  for (const bt of boundaryTests) {
    try {
      const result = expandYaml(bt.yaml);
      if (result.errors.length > 0 || !bt.check(result)) {
        failures.push(bt.name);
      }
    } catch {
      failures.push(bt.name);
    }
  }

  return {
    name: '边界情况处理',
    passed: failures.length === 0,
    message: failures.length === 0 ? '全部通过' : `失败: ${failures.join(', ')}`,
  };
}

function testOutputStability(): SelfTestResult {
  try {
    const input = `
base: &base
  x: 1
  y: 2

derived:
  <<: *base
  z: 3
`;

    const result1 = expandYaml(input);
    const result2 = expandYaml(input);

    const output1 = toYamlString(result1.expanded);
    const output2 = toYamlString(result2.expanded);

    const stable = output1 === output2;

    return {
      name: '输出稳定性',
      passed: stable,
      message: stable ? '多次展开结果一致' : '展开结果不一致',
    };
  } catch (e) {
    return {
      name: '输出稳定性',
      passed: false,
      message: `异常: ${(e as Error).message}`,
    };
  }
}

export function printSelfTestResults(results: SelfTestResult[]): { passed: number; total: number } {
  let passed = 0;
  const total = results.length;

  console.log('\n' + chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan.bold('  YAML Anchor Expander - 自检报告'));
  console.log(chalk.cyan('═'.repeat(60)) + '\n');

  for (const result of results) {
    const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
    console.log(`  ${status}  ${result.name}`);
    if (!result.passed) {
      console.log(chalk.gray(`       ${result.message}`));
    }
    if (result.passed) passed++;
  }

  console.log('');
  console.log(chalk.gray('─'.repeat(60)));
  const statusColor = passed === total ? chalk.green : chalk.yellow;
  console.log(`  结果: ${statusColor(`${passed}/${total} 测试通过`)}`);
  console.log(chalk.cyan('═'.repeat(60)) + '\n');

  return { passed, total };
}
