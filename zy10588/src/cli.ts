#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseSchema } from './schema-parser';
import { parseQueriesFile } from './query-scanner';
import { analyzeQueries } from './analyzer';
import { printTerminalSummary, exportReports } from './reporter';
import { CLIOptions } from './types';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const TEST_SCHEMA = `
type Query {
  user(id: ID!): User
  users: [User!]!
  post(id: ID!): Post
  posts: [Post!]!
}

type User {
  id: ID!
  name: String!
  email: String!
  age: Int
  address: Address
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: String!
  views: Int
}

type Address {
  street: String!
  city: String!
  country: String!
  zipCode: String
}
`;

const TEST_QUERIES = `
# client: web-app
query GetUser {
  user(id: "1") {
    id
    name
    email
    posts {
      title
      createdAt
    }
  }
}

# client: mobile-app
query GetPosts {
  posts {
    id
    title
    author {
      name
    }
  }
}

# client: web-app
mutation CreatePost {
  createPost(input: { title: "Test", content: "Content" }) {
    id
    title
  }
}

# 这是一个无效查询，用于测试错误处理
query InvalidQuery {
  user(id: "1") {
    nonExistentField
  }

# 未闭合的查询 - 这将触发错误
query UnclosedQuery {
  user {
    id
`;

function runSelfTest(): void {
  console.log(chalk.bold.blue('🧪 运行自检...\n'));

  const tempDir = path.join(process.cwd(), '.temp-test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const schemaPath = path.join(tempDir, 'schema.graphql');
  const queriesPath = path.join(tempDir, 'queries.graphql');
  const outputPath = path.join(tempDir, 'report');

  fs.writeFileSync(schemaPath, TEST_SCHEMA);
  fs.writeFileSync(queriesPath, TEST_QUERIES);

  console.log(chalk.gray('  ✓ 创建临时测试文件'));

  try {
    const schema = parseSchema(schemaPath);
    console.log(chalk.gray('  ✓ Schema 解析成功'));

    const { queries, errors: parseErrors } = parseQueriesFile(queriesPath, '#\\s*client:\\s*(\\S+)');
    console.log(chalk.gray(`  ✓ 解析到 ${queries.length} 个查询`));

    const result = analyzeQueries(queries, schema, parseErrors);
    console.log(chalk.gray(`  ✓ 分析完成: ${result.successfulQueries} 成功, ${result.failedQueries} 失败`));

    if (result.fieldUsage.length === 0) {
      throw new Error('字段用量为空');
    }
    console.log(chalk.gray(`  ✓ 检测到 ${result.fieldUsage.length} 个字段使用`));

    printTerminalSummary(result);

    exportReports(result, outputPath, 'both', schemaPath, queriesPath);

    if (!fs.existsSync(`${outputPath}.json`) || !fs.existsSync(`${outputPath}.md`)) {
      throw new Error('报告文件未生成');
    }
    console.log(chalk.gray('  ✓ 报告导出成功\n'));

    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log(chalk.bold.green('✅ 自检全部通过! 工具可以正常使用。\n'));
  } catch (error) {
    console.error(chalk.red(`❌ 自检失败: ${(error as Error).message}`));
    process.exit(1);
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command('self-test', '运行自检，验证工具功能正常')
    .option('schema', {
      type: 'string',
      description: 'GraphQL Schema 文件路径 (.graphql)',
      demandOption: false
    })
    .option('queries', {
      type: 'string',
      description: '查询样本文件路径',
      demandOption: false
    })
    .option('output', {
      type: 'string',
      description: '输出报告路径（不含扩展名）',
      alias: 'o'
    })
    .option('format', {
      type: 'string',
      description: '输出格式: json, markdown, both',
      choices: ['json', 'markdown', 'both'],
      default: 'both'
    })
    .option('client-tag-pattern', {
      type: 'string',
      description: '识别客户端标签的正则表达式，例如: #\\s*client:\\s*(\\S+)'
    })
    .example('$0 self-test', '运行自检')
    .example('$0 --schema ./schema.graphql --queries ./queries.txt', '基本分析')
    .example('$0 -s schema.gql -q queries.gql -o ./report --format markdown', '导出Markdown报告')
    .help()
    .argv as any;

  if (argv.selfTest || argv._.includes('self-test')) {
    runSelfTest();
    return;
  }

  if (!argv.schema || !argv.queries) {
    console.log(chalk.yellow('请提供 --schema 和 --queries 参数，或使用 --help 查看帮助'));
    console.log(chalk.gray('首次使用建议先运行: graphql-field-usage self-test'));
    process.exit(1);
  }

  try {
    const schema = parseSchema(argv.schema);
    const { queries, errors: parseErrors } = parseQueriesFile(
      argv.queries,
      argv.clientTagPattern
    );

    const result = analyzeQueries(queries, schema, parseErrors);
    printTerminalSummary(result);

    if (argv.output) {
      exportReports(
        result,
        argv.output,
        argv.format as 'json' | 'markdown' | 'both',
        argv.schema,
        argv.queries
      );
    }
  } catch (error) {
    console.error(chalk.red(`错误: ${(error as Error).message}`));
    process.exit(1);
  }
}

main();
