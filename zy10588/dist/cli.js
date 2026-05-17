#!/usr/bin/env node
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
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const schema_parser_1 = require("./schema-parser");
const query_scanner_1 = require("./query-scanner");
const analyzer_1 = require("./analyzer");
const reporter_1 = require("./reporter");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
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
function runSelfTest() {
    console.log(chalk_1.default.bold.blue('🧪 运行自检...\n'));
    const tempDir = path.join(process.cwd(), '.temp-test');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    const schemaPath = path.join(tempDir, 'schema.graphql');
    const queriesPath = path.join(tempDir, 'queries.graphql');
    const outputPath = path.join(tempDir, 'report');
    fs.writeFileSync(schemaPath, TEST_SCHEMA);
    fs.writeFileSync(queriesPath, TEST_QUERIES);
    console.log(chalk_1.default.gray('  ✓ 创建临时测试文件'));
    try {
        const schema = (0, schema_parser_1.parseSchema)(schemaPath);
        console.log(chalk_1.default.gray('  ✓ Schema 解析成功'));
        const { queries, errors: parseErrors } = (0, query_scanner_1.parseQueriesFile)(queriesPath, '#\\s*client:\\s*(\\S+)');
        console.log(chalk_1.default.gray(`  ✓ 解析到 ${queries.length} 个查询`));
        const result = (0, analyzer_1.analyzeQueries)(queries, schema, parseErrors);
        console.log(chalk_1.default.gray(`  ✓ 分析完成: ${result.successfulQueries} 成功, ${result.failedQueries} 失败`));
        if (result.fieldUsage.length === 0) {
            throw new Error('字段用量为空');
        }
        console.log(chalk_1.default.gray(`  ✓ 检测到 ${result.fieldUsage.length} 个字段使用`));
        (0, reporter_1.printTerminalSummary)(result);
        (0, reporter_1.exportReports)(result, outputPath, 'both', schemaPath, queriesPath);
        if (!fs.existsSync(`${outputPath}.json`) || !fs.existsSync(`${outputPath}.md`)) {
            throw new Error('报告文件未生成');
        }
        console.log(chalk_1.default.gray('  ✓ 报告导出成功\n'));
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(chalk_1.default.bold.green('✅ 自检全部通过! 工具可以正常使用。\n'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 自检失败: ${error.message}`));
        process.exit(1);
    }
}
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
        .argv;
    if (argv.selfTest || argv._.includes('self-test')) {
        runSelfTest();
        return;
    }
    if (!argv.schema || !argv.queries) {
        console.log(chalk_1.default.yellow('请提供 --schema 和 --queries 参数，或使用 --help 查看帮助'));
        console.log(chalk_1.default.gray('首次使用建议先运行: graphql-field-usage self-test'));
        process.exit(1);
    }
    try {
        const schema = (0, schema_parser_1.parseSchema)(argv.schema);
        const { queries, errors: parseErrors } = (0, query_scanner_1.parseQueriesFile)(argv.queries, argv.clientTagPattern);
        const result = (0, analyzer_1.analyzeQueries)(queries, schema, parseErrors);
        (0, reporter_1.printTerminalSummary)(result);
        if (argv.output) {
            (0, reporter_1.exportReports)(result, argv.output, argv.format, argv.schema, argv.queries);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
}
main();
