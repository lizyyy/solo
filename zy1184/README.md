# ORM Query Analyzer

一个本地命令行工具，专门用于排查后端接口中的 ORM 查询慢和 N+1 问题。

## 功能特性

- **N+1 查询检测**: 识别循环查详情的典型 N+1 问题
- **重复查询检测**: 发现同一次请求中执行多次的相同查询
- **深分页检测**: 检测使用 OFFSET 分页的性能问题
- **慢查询检测**: 识别执行时间过长的查询
- **缺失预加载检测**: 发现应该使用预加载但没有使用的场景
- **无用字段选择检测**: 识别 SELECT * 或多余字段查询
- **优化模拟**: 模拟预加载、批量查询、字段裁剪、游标分页后的耗时和查询次数变化
- **多格式报告导出**: 支持 Markdown、JSON、CSV 格式导出

## 安装

```bash
npm install
npm run build
```

## 快速开始

### 1. 初始化项目

```bash
npm run cli -- init
```

这会在当前目录创建：
- `query-analyzer.config.json` - 配置文件
- `data/` 目录结构
- 示例数据（包含 N+1 查询、深分页、重复查询等问题的坏样例）

### 2. 导入数据

```bash
# 导入所有默认数据文件
npm run cli -- import

# 导入指定的 API 日志文件
npm run cli -- import --api-log ./my-api-logs.json

# 导入指定的 SQL 日志文件
npm run cli -- import --sql-log ./my-sql-logs.sql

# 导入表结构
npm run cli -- import --table-schema ./table-schemas.json

# 导入 Repository 方法配置
npm run cli -- import --repo-methods ./repository-methods.yaml
```

### 3. 分析查询问题

```bash
# 分析所有导入的数据
npm run cli -- analyze

# 指定慢查询阈值（默认 100ms）
npm run cli -- analyze --slow-threshold 200

# 指定 N+1 阈值（默认 3 次）
npm run cli -- analyze --n-plus1-threshold 5

# 只分析指定的请求
npm run cli -- analyze --request-id req_123
```

### 4. 模拟优化效果

```bash
# 模拟所有优化策略
npm run cli -- simulate

# 只模拟特定优化
npm run cli -- simulate --optimizations preload,batch
```

支持的优化类型：
- `preload` - 预加载
- `batch` - 批量查询
- `field-trim` - 字段裁剪
- `cursor` - 游标分页

### 5. 导出分析报告

```bash
# 导出所有格式
npm run cli -- export -o ./reports

# 只导出 Markdown 格式
npm run cli -- export --format markdown -o ./report.md

# 只导出 JSON 格式
npm run cli -- export --format json -o ./report.json

# 只导出 CSV 格式
npm run cli -- export --format csv -o ./report.csv

# 包含 SQL 和建议
npm run cli -- export --format markdown --include-sql --include-suggestions
```

### 6. 查看状态

```bash
npm run cli -- status
```

## 数据格式

### API 日志 (JSON)

```json
[
  {
    "requestId": "req_001",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "method": "GET",
    "path": "/api/posts",
    "statusCode": 200,
    "duration": 250,
    "queryParams": { "page": 1, "limit": 20 },
    "userId": "user_123"
  }
]
```

### SQL 日志

```json
[
  {
    "sql": "SELECT * FROM posts WHERE author_id = ?",
    "duration": 15,
    "operationType": "SELECT",
    "tableName": "posts",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_001"
  }
]
```

### 表结构

```json
[
  {
    "tableName": "posts",
    "columns": [
      { "name": "id", "type": "INTEGER", "primaryKey": true },
      { "name": "title", "type": "VARCHAR(255)", "nullable": false },
      { "name": "author_id", "type": "INTEGER", "foreignKey": true, "references": "users.id" }
    ],
    "indexes": [
      { "name": "idx_posts_author", "columns": ["author_id"], "unique": false }
    ]
  }
]
```

### Repository 方法配置 (YAML)

```yaml
methods:
  - name: findPostById
    operation: SELECT
    table: posts
    parameters: [id]
    eagerLoads: []
    potentialEagerLoads: [author, comments]
  - name: findPostsByAuthor
    operation: SELECT
    table: posts
    parameters: [authorId]
    eagerLoads: [author]
    potentialEagerLoads: [comments]
```

## 检测的问题类型

| 问题类型 | 描述 | 严重程度 |
|---------|------|---------|
| N+1 查询 | 循环中执行多次相同结构的查询 | HIGH/CRITICAL |
| 重复查询 | 同一请求中执行完全相同的查询 | MEDIUM/HIGH |
| 深分页 | 使用大 OFFSET 的分页查询 | MEDIUM/HIGH/CRITICAL |
| 慢查询 | 执行时间超过阈值的查询 | MEDIUM/HIGH |
| 缺失预加载 | 应该使用预加载但没有使用 | HIGH |
| 无用字段 | SELECT * 或查询多余字段 | LOW/MEDIUM |
| 大结果集 | 返回大量数据的查询 | MEDIUM/HIGH |
| 缺失索引 | 缺少必要索引的查询 | HIGH |

## 命令行参数

### init
- `-o, --output <path>` - 输出目录（默认当前目录）
- `--no-seed` - 不生成示例数据
- `--with-config` - 生成完整配置文件

### import
- `--api-log <file>` - API 日志文件
- `--sql-log <file>` - SQL 日志文件
- `--table-schema <file>` - 表结构文件
- `--repo-methods <file>` - Repository 方法配置
- `--format <json|csv|plain>` - 日志格式
- `--state-file <file>` - 状态文件路径

### analyze
- `--request-id <id>` - 只分析指定请求
- `--slow-threshold <ms>` - 慢查询阈值（默认 100ms）
- `--n-plus1-threshold <count>` - N+1 阈值（默认 3）
- `--deep-pagination-threshold <offset>` - 深分页阈值（默认 1000）
- `--state-file <file>` - 状态文件路径

### simulate
- `--request-id <id>` - 只模拟指定请求
- `--optimizations <types>` - 要模拟的优化类型（逗号分隔）
- `--state-file <file>` - 状态文件路径

### export
- `-o, --output <path>` - 输出路径
- `--format <markdown|json|csv|all>` - 导出格式
- `--include-sql` - 包含 SQL 语句
- `--include-suggestions` - 包含优化建议
- `--state-file <file>` - 状态文件路径

### status
- `--state-file <file>` - 状态文件路径
- `--json` - 以 JSON 格式输出

## 示例工作流

```bash
# 1. 初始化项目并生成示例数据
npm run cli -- init

# 2. 导入你自己的数据
npm run cli -- import --api-log ./production/api.log --sql-log ./production/sql.log

# 3. 分析问题
npm run cli -- analyze --slow-threshold 150

# 4. 模拟优化效果
npm run cli -- simulate

# 5. 导出报告
npm run cli -- export -o ./analysis-report --include-sql --include-suggestions
```

## 项目结构

```
.
├── src/
│   ├── analyzers/          # 分析器
│   │   ├── index.ts
│   │   ├── query-analyzer.ts
│   │   ├── n-plus-one-detector.ts
│   │   ├── duplicate-query-detector.ts
│   │   ├── deep-pagination-detector.ts
│   │   ├── slow-query-detector.ts
│   │   └── ...
│   ├── parsers/            # 解析器
│   │   ├── index.ts
│   │   ├── sql-log-parser.ts
│   │   ├── api-log-parser.ts
│   │   ├── request-grouper.ts
│   │   └── ...
│   ├── simulators/         # 模拟器
│   │   ├── index.ts
│   │   ├── query-simulator.ts
│   │   ├── preload-simulator.ts
│   │   └── ...
│   ├── exporters/          # 导出器
│   │   ├── index.ts
│   │   ├── report-exporter.ts
│   │   ├── markdown-exporter.ts
│   │   ├── json-exporter.ts
│   │   └── csv-exporter.ts
│   ├── models/             # 数据模型
│   ├── utils/              # 工具函数
│   └── cli.ts              # CLI 入口
├── tests/                  # 测试文件
│   ├── utils.test.ts
│   ├── parsers.test.ts
│   ├── analyzers.test.ts
│   └── exporters.test.ts
├── data/                   # 数据目录（运行 init 后生成）
│   ├── api-logs/
│   ├── sql-logs/
│   ├── table-schemas/
│   └── repo-methods/
├── reports/                # 报告输出目录
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 测试

```bash
# 运行所有测试
npm run test

# 运行特定测试
npm run test -- --testPathPattern=analyzers

# 覆盖率报告
npm run test -- --coverage
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
