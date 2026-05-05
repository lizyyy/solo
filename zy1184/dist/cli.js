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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk = __importStar(require("chalk"));
const table_1 = require("table");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const parsers_1 = require("./parsers");
const analyzers_1 = require("./analyzers");
const simulators_1 = require("./simulators");
const exporters_1 = require("./exporters");
const utils_1 = require("./utils");
const models_1 = require("./models");
const program = new commander_1.Command();
const state = {
    apiLogs: [],
    sqlQueries: [],
    tableStructures: [],
    repositoryMethods: null,
    requestGroups: [],
    analysisResults: [],
    simulationResults: [],
};
function printBanner() {
    console.log(chalk.blueBright(`
╔══════════════════════════════════════════════════════════════╗
║                    ORM Query Analyzer                          ║
║              后端接口 ORM 查询性能分析工具                      ║
╚══════════════════════════════════════════════════════════════╝
  `));
}
function printSuccess(message) {
    console.log(chalk.green(`✓ ${message}`));
}
function printError(message) {
    console.log(chalk.red(`✗ ${message}`));
}
function printWarning(message) {
    console.log(chalk.yellow(`⚠ ${message}`));
}
function printInfo(message) {
    console.log(chalk.blue(`ℹ ${message}`));
}
function getSeverityColor(severity) {
    switch (severity) {
        case 'CRITICAL':
            return chalk.red;
        case 'HIGH':
            return chalk.magenta;
        case 'MEDIUM':
            return chalk.yellow;
        case 'LOW':
            return chalk.gray;
        default:
            return chalk.white;
    }
}
function getIssueTypeLabel(type) {
    const labels = {
        N_PLUS_1: 'N+1 查询',
        DUPLICATE_QUERY: '重复查询',
        DEEP_PAGINATION: '深分页',
        MISSING_PRELOAD: '缺失预加载',
        UNUSED_FIELDS: '无用字段',
        LARGE_RESULT_SET: '大结果集',
        MISSING_INDEX: '缺失索引',
        SLOW_QUERY: '慢查询',
    };
    return labels[type] || type;
}
program
    .name('orm-analyzer')
    .description('后端接口 ORM 查询性能分析工具')
    .version('1.0.0')
    .option('-v, --verbose', '显示详细输出')
    .hook('preAction', () => {
    printBanner();
});
program
    .command('init')
    .description('初始化项目，创建示例数据和配置文件')
    .option('-d, --dir <directory>', '目标目录', '.')
    .option('--force', '覆盖已存在的文件')
    .action((options) => {
    const targetDir = path.resolve(options.dir);
    const force = options.force || false;
    printInfo(`初始化项目到: ${targetDir}`);
    (0, utils_1.ensureDir)(targetDir);
    const configDir = path.join(targetDir, 'config');
    const dataDir = path.join(targetDir, 'data');
    const logsDir = path.join(targetDir, 'logs');
    const outputDir = path.join(targetDir, 'output');
    [configDir, dataDir, logsDir, outputDir].forEach(dir => (0, utils_1.ensureDir)(dir));
    const configContent = `# ORM Query Analyzer 配置文件

analysis:
  slowQueryThresholdMs: 100
  deepPaginationThreshold: 1000
  duplicateQueryTimeWindowMs: 1000
  nPlus1Threshold: 3
  checkNPlus1: true
  checkDuplicateQueries: true
  checkDeepPagination: true
  checkMissingPreload: true
  checkUnusedFields: true
  checkLargeResultSets: true
  checkMissingIndexes: true

simulation:
  simulatePreload: true
  simulateBatchQuery: true
  simulateFieldTrimming: true
  simulateCursorPagination: true
  simulateIndexOptimization: true
  batchSize: 100
  estimatedQueryTimePerRowMs: 0.1
  estimatedDataTransferPerRowBytes: 200

export:
  formats:
    - markdown
    - json
    - csv
  outputDir: ./output
`;
    const exampleApiLog = `[
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "method": "GET",
    "path": "/api/users/1/posts",
    "statusCode": 200,
    "duration": 250,
    "userId": "user_123",
    "queryParams": { "page": "1", "limit": "10" }
  },
  {
    "requestId": "req_002",
    "timestamp": "2024-01-15T10:00:01.000Z",
    "method": "GET",
    "path": "/api/posts",
    "statusCode": 200,
    "duration": 500,
    "userId": "user_456",
    "queryParams": { "page": "100", "limit": "20" }
  }
]`;
    const exampleSqlLog = `[
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.100Z",
    "sql": "SELECT * FROM users WHERE id = 1",
    "duration": 5,
    "rowsAffected": 1,
    "tableName": "users",
    "operationType": "SELECT"
  },
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.110Z",
    "sql": "SELECT * FROM posts WHERE author_id = 1 LIMIT 10 OFFSET 0",
    "duration": 15,
    "rowsAffected": 10,
    "tableName": "posts",
    "operationType": "SELECT"
  },
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.130Z",
    "sql": "SELECT * FROM users WHERE id = 1",
    "duration": 3,
    "rowsAffected": 1,
    "tableName": "users",
    "operationType": "SELECT"
  },
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.140Z",
    "sql": "SELECT * FROM comments WHERE post_id = 1",
    "duration": 8,
    "rowsAffected": 5,
    "tableName": "comments",
    "operationType": "SELECT"
  },
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.150Z",
    "sql": "SELECT * FROM comments WHERE post_id = 2",
    "duration": 6,
    "rowsAffected": 3,
    "tableName": "comments",
    "operationType": "SELECT"
  },
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:00:00.160Z",
    "sql": "SELECT * FROM comments WHERE post_id = 3",
    "duration": 7,
    "rowsAffected": 8,
    "tableName": "comments",
    "operationType": "SELECT"
  },
  {
    "requestId": "req_002",
    "timestamp": "2024-01-15T10:00:01.100Z",
    "sql": "SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 1980",
    "duration": 150,
    "rowsAffected": 20,
    "tableName": "posts",
    "operationType": "SELECT"
  }
]`;
    const exampleTableStructure = `[
  {
    "tableName": "users",
    "columns": [
      { "name": "id", "dataType": "BIGINT", "nullable": false, "isPrimaryKey": true, "isAutoIncrement": true },
      { "name": "username", "dataType": "VARCHAR(255)", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "email", "dataType": "VARCHAR(255)", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "created_at", "dataType": "DATETIME", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "updated_at", "dataType": "DATETIME", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false }
    ],
    "primaryKey": { "columns": ["id"] },
    "indexes": [
      { "name": "PRIMARY", "columns": ["id"], "isUnique": true, "isPrimary": true },
      { "name": "idx_users_email", "columns": ["email"], "isUnique": true, "isPrimary": false }
    ],
    "foreignKeys": [],
    "estimatedRowCount": 10000
  },
  {
    "tableName": "posts",
    "columns": [
      { "name": "id", "dataType": "BIGINT", "nullable": false, "isPrimaryKey": true, "isAutoIncrement": true },
      { "name": "title", "dataType": "VARCHAR(255)", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "content", "dataType": "TEXT", "nullable": true, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "author_id", "dataType": "BIGINT", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "created_at", "dataType": "DATETIME", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "updated_at", "dataType": "DATETIME", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false }
    ],
    "primaryKey": { "columns": ["id"] },
    "indexes": [
      { "name": "PRIMARY", "columns": ["id"], "isUnique": true, "isPrimary": true },
      { "name": "idx_posts_author_id", "columns": ["author_id"], "isUnique": false, "isPrimary": false }
    ],
    "foreignKeys": [
      { "columnName": "author_id", "referencedTableName": "users", "referencedColumnName": "id" }
    ],
    "estimatedRowCount": 50000
  },
  {
    "tableName": "comments",
    "columns": [
      { "name": "id", "dataType": "BIGINT", "nullable": false, "isPrimaryKey": true, "isAutoIncrement": true },
      { "name": "content", "dataType": "TEXT", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "post_id", "dataType": "BIGINT", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "user_id", "dataType": "BIGINT", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false },
      { "name": "created_at", "dataType": "DATETIME", "nullable": false, "isPrimaryKey": false, "isAutoIncrement": false }
    ],
    "primaryKey": { "columns": ["id"] },
    "indexes": [
      { "name": "PRIMARY", "columns": ["id"], "isUnique": true, "isPrimary": true },
      { "name": "idx_comments_post_id", "columns": ["post_id"], "isUnique": false, "isPrimary": false }
    ],
    "foreignKeys": [
      { "columnName": "post_id", "referencedTableName": "posts", "referencedColumnName": "id" },
      { "columnName": "user_id", "referencedTableName": "users", "referencedColumnName": "id" }
    ],
    "estimatedRowCount": 200000
  }
]`;
    const exampleRepositoryMethods = `version: "1.0"
repositories:
  - name: UserRepository
    tableName: users
    methods:
      - methodName: findById
        description: 根据 ID 查找用户
        operationType: SELECT
        tableName: users
        expectedParameters:
          - name: id
            type: number
            required: true
        whereConditions:
          - column: id
            operator: "="
            parameterName: id
      
      - methodName: findAll
        description: 查找所有用户
        operationType: SELECT
        tableName: users
        expectedParameters: []

  - name: PostRepository
    tableName: posts
    methods:
      - methodName: findByAuthorId
        description: 根据作者 ID 查找文章
        operationType: SELECT
        tableName: posts
        expectedParameters:
          - name: authorId
            type: number
            required: true
        whereConditions:
          - column: author_id
            operator: "="
            parameterName: authorId
        pagination:
          type: offset
          defaultLimit: 10
      
      - methodName: findAllWithPagination
        description: 分页查找所有文章
        operationType: SELECT
        tableName: posts
        expectedParameters:
          - name: page
            type: number
            required: false
          - name: limit
            type: number
            required: false
        orderBy:
          - column: created_at
            direction: DESC
        pagination:
          type: offset
          defaultLimit: 20
          maxLimit: 100

  - name: CommentRepository
    tableName: comments
    methods:
      - methodName: findByPostId
        description: 根据文章 ID 查找评论
        operationType: SELECT
        tableName: comments
        expectedParameters:
          - name: postId
            type: number
            required: true
        whereConditions:
          - column: post_id
            operator: "="
            parameterName: postId
`;
    const files = [
        { path: path.join(configDir, 'config.yaml'), content: configContent },
        { path: path.join(dataDir, 'api-log.json'), content: exampleApiLog },
        { path: path.join(dataDir, 'sql-log.json'), content: exampleSqlLog },
        { path: path.join(dataDir, 'table-structures.json'), content: exampleTableStructure },
        { path: path.join(dataDir, 'repository-methods.yaml'), content: exampleRepositoryMethods },
    ];
    let createdCount = 0;
    let skippedCount = 0;
    for (const file of files) {
        if ((0, utils_1.fileExists)(file.path) && !force) {
            printWarning(`跳过已存在的文件: ${file.path}`);
            skippedCount++;
        }
        else {
            (0, utils_1.writeFile)(file.path, file.content);
            printSuccess(`创建文件: ${file.path}`);
            createdCount++;
        }
    }
    console.log('');
    printSuccess(`初始化完成！创建了 ${createdCount} 个文件，跳过了 ${skippedCount} 个文件。`);
    printInfo('下一步可以运行:');
    printInfo('  orm-analyzer import --api-log data/api-log.json --sql-log data/sql-log.json');
    printInfo('  orm-analyzer analyze');
    printInfo('  orm-analyzer simulate');
    printInfo('  orm-analyzer export --format markdown');
});
program
    .command('import')
    .description('导入日志和数据文件')
    .option('--api-log <path>', 'API 调用日志文件路径')
    .option('--sql-log <path>', 'SQL 日志文件路径')
    .option('--table-structure <path>', '表结构文件路径')
    .option('--repository-methods <path>', 'repository-methods.yaml 路径')
    .option('--sql-format <format>', 'SQL 日志格式: json, plain, mysql, postgresql', 'json')
    .option('--api-format <format>', 'API 日志格式: json, csv', 'json')
    .action((options) => {
    printInfo('开始导入数据...');
    if (options.apiLog) {
        try {
            const content = (0, utils_1.readFile)(options.apiLog);
            const logs = (0, parsers_1.parseApiLog)(content, { format: options.apiFormat });
            state.apiLogs.push(...logs);
            printSuccess(`导入 API 日志: ${logs.length} 条记录`);
        }
        catch (error) {
            printError(`导入 API 日志失败: ${error.message}`);
        }
    }
    if (options.sqlLog) {
        try {
            const content = (0, utils_1.readFile)(options.sqlLog);
            const queries = (0, parsers_1.parseSqlLog)(content, {
                format: options.sqlFormat,
                normalizeSql: true
            });
            state.sqlQueries.push(...queries);
            printSuccess(`导入 SQL 日志: ${queries.length} 条查询`);
        }
        catch (error) {
            printError(`导入 SQL 日志失败: ${error.message}`);
        }
    }
    if (options.tableStructure) {
        try {
            const content = (0, utils_1.readFile)(options.tableStructure);
            const structures = (0, parsers_1.parseTableStructure)(content, { format: 'json' });
            state.tableStructures = structures;
            printSuccess(`导入表结构: ${structures.length} 张表`);
        }
        catch (error) {
            printError(`导入表结构失败: ${error.message}`);
        }
    }
    if (options.repositoryMethods) {
        try {
            const content = (0, utils_1.readFile)(options.repositoryMethods);
            const config = (0, parsers_1.parseRepositoryMethods)(content);
            state.repositoryMethods = config;
            printSuccess(`导入 Repository 方法配置: ${config.repositories.length} 个 repository`);
        }
        catch (error) {
            printError(`导入 Repository 方法配置失败: ${error.message}`);
        }
    }
    if (state.apiLogs.length > 0 || state.sqlQueries.length > 0) {
        printInfo('正在分组请求...');
        const grouper = new parsers_1.RequestGrouper();
        grouper.addApiLogs(state.apiLogs);
        grouper.addSqlQueries(state.sqlQueries);
        state.requestGroups = grouper.group();
        printSuccess(`分组完成: ${state.requestGroups.length} 个请求组`);
    }
    console.log('');
    printInfo('导入状态:');
    printInfo(`  API 日志: ${state.apiLogs.length} 条`);
    printInfo(`  SQL 查询: ${state.sqlQueries.length} 条`);
    printInfo(`  表结构: ${state.tableStructures.length} 张`);
    printInfo(`  请求组: ${state.requestGroups.length} 个`);
});
program
    .command('analyze')
    .description('分析查询性能问题')
    .option('--request-id <id>', '只分析指定的请求 ID')
    .option('--slow-threshold <ms>', '慢查询阈值 (毫秒)', '100')
    .option('--n-plus1-threshold <count>', 'N+1 阈值', '3')
    .option('--deep-pagination-threshold <offset>', '深分页阈值', '1000')
    .option('--no-n-plus1', '不检查 N+1 问题')
    .option('--no-duplicates', '不检查重复查询')
    .option('--no-deep-pagination', '不检查深分页')
    .option('--no-missing-preload', '不检查缺失预加载')
    .option('--no-unused-fields', '不检查无用字段')
    .action((options) => {
    if (state.requestGroups.length === 0) {
        printError('没有可分析的数据。请先运行 import 命令导入数据。');
        process.exit(1);
    }
    printInfo('开始分析查询性能问题...');
    const analysisOptions = {
        ...models_1.DEFAULT_ANALYSIS_OPTIONS,
        slowQueryThresholdMs: parseInt(options.slowThreshold),
        nPlus1Threshold: parseInt(options.nPlus1Threshold),
        deepPaginationThreshold: parseInt(options.deepPaginationThreshold),
        checkNPlus1: options.nPlus1 !== false,
        checkDuplicateQueries: options.duplicates !== false,
        checkDeepPagination: options.deepPagination !== false,
        checkMissingPreload: options.missingPreload !== false,
        checkUnusedFields: options.unusedFields !== false,
    };
    let groupsToAnalyze = state.requestGroups;
    if (options.requestId) {
        groupsToAnalyze = groupsToAnalyze.filter(g => g.requestId === options.requestId);
        if (groupsToAnalyze.length === 0) {
            printError(`未找到请求 ID: ${options.requestId}`);
            process.exit(1);
        }
    }
    const analyzer = new analyzers_1.QueryAnalyzer(analysisOptions, state.tableStructures, state.repositoryMethods || undefined);
    state.analysisResults = analyzer.analyzeBatch(groupsToAnalyze);
    const totalIssues = state.analysisResults.reduce((sum, r) => sum + r.issues.length, 0);
    console.log('');
    printSuccess(`分析完成！`);
    printInfo(`  分析请求: ${state.analysisResults.length} 个`);
    printInfo(`  发现问题: ${totalIssues} 个`);
    if (totalIssues > 0) {
        console.log('');
        console.log(chalk.bold('问题统计:'));
        const issuesByType = {};
        const issuesBySeverity = {};
        for (const result of state.analysisResults) {
            for (const issue of result.issues) {
                issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
                issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
            }
        }
        console.log('');
        console.log(chalk.underline('按类型分类:'));
        for (const [type, count] of Object.entries(issuesByType)) {
            console.log(`  ${getIssueTypeLabel(type)}: ${count} 个`);
        }
        console.log('');
        console.log(chalk.underline('按严重程度分类:'));
        for (const [severity, count] of Object.entries(issuesBySeverity)) {
            const colorFn = getSeverityColor(severity);
            console.log(`  ${colorFn(severity)}: ${count} 个`);
        }
        console.log('');
        console.log(chalk.bold('Top 问题详情:'));
        const allIssues = [];
        for (const result of state.analysisResults) {
            allIssues.push(...result.issues);
        }
        const sortedIssues = allIssues.sort((a, b) => {
            const severityOrder = {
                CRITICAL: 4,
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1,
            };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
        const topIssues = sortedIssues.slice(0, 5);
        for (const [index, issue] of topIssues.entries()) {
            const colorFn = getSeverityColor(issue.severity);
            console.log('');
            console.log(colorFn(`[${index + 1}] ${issue.title}`));
            console.log(`  类型: ${getIssueTypeLabel(issue.type)}`);
            console.log(`  严重程度: ${colorFn(issue.severity)}`);
            console.log(`  请求 ID: ${issue.requestId}`);
            console.log(`  描述: ${issue.description}`);
            console.log(`  建议: ${issue.suggestion.title}`);
            if (issue.impact.queryCountIncrease > 0) {
                console.log(`  影响: 增加了 ${issue.impact.queryCountIncrease} 次查询，额外耗时 ${issue.impact.durationIncreaseMs.toFixed(2)}ms`);
            }
        }
    }
});
program
    .command('simulate')
    .description('模拟优化效果')
    .option('--request-id <id>', '只模拟指定的请求 ID')
    .option('--no-preload', '不模拟预加载优化')
    .option('--no-batch', '不模拟批量查询优化')
    .option('--no-field-trim', '不模拟字段裁剪优化')
    .option('--no-cursor', '不模拟游标分页优化')
    .option('--batch-size <size>', '批量查询大小', '100')
    .action((options) => {
    if (state.analysisResults.length === 0) {
        printError('没有可模拟的分析结果。请先运行 analyze 命令。');
        process.exit(1);
    }
    printInfo('开始模拟优化效果...');
    const simulationOptions = {
        ...models_1.DEFAULT_SIMULATION_OPTIONS,
        simulatePreload: options.preload !== false,
        simulateBatchQuery: options.batch !== false,
        simulateFieldTrimming: options.fieldTrim !== false,
        simulateCursorPagination: options.cursor !== false,
        batchSize: parseInt(options.batchSize),
    };
    const issuesMap = new Map();
    for (const result of state.analysisResults) {
        issuesMap.set(result.requestId, result.issues);
    }
    let groupsToSimulate = state.requestGroups;
    if (options.requestId) {
        groupsToSimulate = groupsToSimulate.filter(g => g.requestId === options.requestId);
    }
    const simulator = new simulators_1.QuerySimulator(simulationOptions, state.tableStructures, state.repositoryMethods || undefined);
    state.simulationResults = simulator.simulateBatch(groupsToSimulate, issuesMap);
    console.log('');
    printSuccess(`模拟完成！`);
    printInfo(`  模拟请求: ${state.simulationResults.length} 个`);
    let totalQueryReduction = 0;
    let totalDurationReduction = 0;
    let totalDataReduction = 0;
    for (const result of state.simulationResults) {
        totalQueryReduction += result.comparison.improvement.queryCountReduction;
        totalDurationReduction += result.comparison.improvement.durationReductionMs;
        totalDataReduction += result.comparison.improvement.dataTransferReductionBytes;
    }
    console.log('');
    console.log(chalk.bold('优化效果预估:'));
    console.log(`  查询次数减少: ${totalQueryReduction} 次`);
    console.log(`  耗时减少: ${totalDurationReduction.toFixed(2)}ms`);
    console.log(`  数据传输减少: ${(totalDataReduction / 1024).toFixed(2)}KB`);
    console.log('');
    console.log(chalk.bold('详细对比:'));
    const tableData = [
        ['指标', '优化前', '优化后', '提升'],
    ];
    for (const result of state.simulationResults.slice(0, 5)) {
        const { original, optimized, improvement } = result.comparison;
        tableData.push([
            `请求 ${result.requestId.substring(0, 8)}...`,
            '',
            '',
            '',
        ]);
        tableData.push([
            '查询次数',
            String(original.totalQueries),
            String(optimized.totalQueries),
            `${improvement.queryCountReductionPercent}%`,
        ]);
        tableData.push([
            '耗时 (ms)',
            original.totalDurationMs.toFixed(2),
            optimized.totalDurationMs.toFixed(2),
            `${improvement.durationReductionPercent}%`,
        ]);
        tableData.push([
            '数据传输 (KB)',
            (original.totalDataTransferBytes / 1024).toFixed(2),
            (optimized.totalDataTransferBytes / 1024).toFixed(2),
            `${improvement.dataTransferReductionPercent}%`,
        ]);
    }
    console.log((0, table_1.table)(tableData));
});
program
    .command('export')
    .description('导出分析报告')
    .option('-f, --format <format>', '导出格式: markdown, json, csv', 'markdown')
    .option('-o, --output <path>', '输出文件路径')
    .option('--request-id <id>', '只导出指定的请求 ID')
    .option('--include-sql', '包含原始 SQL 语句')
    .option('--include-suggestions', '包含优化建议')
    .action((options) => {
    if (state.analysisResults.length === 0) {
        printError('没有可导出的分析结果。请先运行 analyze 命令。');
        process.exit(1);
    }
    printInfo(`开始导出报告 (格式: ${options.format})...`);
    let resultsToExport = state.analysisResults;
    if (options.requestId) {
        resultsToExport = resultsToExport.filter(r => r.requestId === options.requestId);
        if (resultsToExport.length === 0) {
            printError(`未找到请求 ID: ${options.requestId}`);
            process.exit(1);
        }
    }
    let outputPath = options.output;
    if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = options.format === 'markdown' ? 'md' : options.format;
        outputPath = `analysis-report-${timestamp}.${ext}`;
    }
    try {
        let content = '';
        const exportOptions = {
            includeSql: options.includeSql || false,
            includeSuggestions: options.includeSuggestions !== false,
        };
        switch (options.format) {
            case 'markdown':
                content = (0, exporters_1.exportMarkdown)(resultsToExport, state.simulationResults, exportOptions);
                break;
            case 'json':
                content = (0, exporters_1.exportJson)(resultsToExport, state.simulationResults, exportOptions);
                break;
            case 'csv':
                content = (0, exporters_1.exportCsv)(resultsToExport, exportOptions);
                break;
            default:
                printError(`不支持的导出格式: ${options.format}`);
                process.exit(1);
        }
        (0, utils_1.writeFile)(outputPath, content);
        printSuccess(`报告已导出到: ${outputPath}`);
        const stats = fs.statSync(outputPath);
        printInfo(`文件大小: ${(stats.size / 1024).toFixed(2)}KB`);
    }
    catch (error) {
        printError(`导出失败: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('status')
    .description('显示当前状态')
    .action(() => {
    printInfo('当前状态:');
    console.log('');
    const statusTable = [
        ['项目', '数量', '状态'],
        ['API 日志', String(state.apiLogs.length), state.apiLogs.length > 0 ? chalk.green('已导入') : chalk.yellow('未导入')],
        ['SQL 查询', String(state.sqlQueries.length), state.sqlQueries.length > 0 ? chalk.green('已导入') : chalk.yellow('未导入')],
        ['表结构', String(state.tableStructures.length), state.tableStructures.length > 0 ? chalk.green('已导入') : chalk.yellow('未导入')],
        ['请求组', String(state.requestGroups.length), state.requestGroups.length > 0 ? chalk.green('已分组') : chalk.yellow('未分组')],
        ['分析结果', String(state.analysisResults.length), state.analysisResults.length > 0 ? chalk.green('已分析') : chalk.yellow('未分析')],
        ['模拟结果', String(state.simulationResults.length), state.simulationResults.length > 0 ? chalk.green('已模拟') : chalk.yellow('未模拟')],
    ];
    console.log((0, table_1.table)(statusTable));
    console.log('');
    if (state.analysisResults.length > 0) {
        const totalIssues = state.analysisResults.reduce((sum, r) => sum + r.issues.length, 0);
        printInfo(`发现 ${totalIssues} 个性能问题`);
    }
    if (state.requestGroups.length > 0 && state.analysisResults.length === 0) {
        printInfo('提示: 运行 "orm-analyzer analyze" 进行性能分析');
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map