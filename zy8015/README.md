# MCP 工具调用录制与重放调试器

一个本地 MCP (Model Context Protocol) 工具调用的录制与重放调试器，用于分析、调试和重放 AI Agent 与 MCP 服务的交互。

## 功能特性

- 📊 **轨迹分析** - 解析 JSONL 格式的调用轨迹，重建调用时间线
- 🔍 **Schema 漂移检测** - 对比新旧 Schema，检测破坏性变更
- 🔄 **重试分析** - 检测失败重试模式，分析重试成功率
- ⚠️ **非幂等风险检测** - 识别可能导致数据不一致的非幂等操作
- 📋 **Dry-run 回放计划** - 生成安全的回放计划，标注风险和跳过项
- 📝 **报告生成** - 输出 Markdown/JSON 格式的详细分析报告
- 📦 **最小复现包** - 生成可分享的最小化复现包，包含必要的 Schema 和轨迹

## 安装

```bash
npm install
```

## 快速开始

### 1. 分析轨迹

```bash
# 使用示例数据进行分析
node src/cli.js analyze --schema examples/schema.json --trace examples/trace.jsonl

# 输出到文件
node src/cli.js analyze --schema examples/schema.json --trace examples/trace.jsonl --output analysis.json

# 对比新旧 Schema 检测漂移
node src/cli.js analyze --schema examples/schema.json --old-schema examples/schema-old.json --trace examples/trace.jsonl
```

### 2. 生成回放计划

```bash
# 生成 dry-run 回放计划
node src/cli.js plan --schema examples/schema.json --trace examples/trace.jsonl

# 跳过重试调用
node src/cli.js plan --schema examples/schema.json --trace examples/trace.jsonl --no-include-retries

# 跳过非幂等调用（安全模式）
node src/cli.js plan --schema examples/schema.json --trace examples/trace.jsonl --skip-non-idempotent

# 输出到文件
node src/cli.js plan --schema examples/schema.json --trace examples/trace.jsonl --output plan.json
```

### 3. 生成报告

```bash
# 生成 Markdown 报告
node src/cli.js report --schema examples/schema.json --trace examples/trace.jsonl --output report.md

# 生成 JSON 报告
node src/cli.js report --schema examples/schema.json --trace examples/trace.jsonl --format json --output report.json

# 包含原始数据
node src/cli.js report --schema examples/schema.json --trace examples/trace.jsonl --include-raw --output report.md

# 对比新旧 Schema
node src/cli.js report --schema examples/schema.json --old-schema examples/schema-old.json --trace examples/trace.jsonl --output report.md
```

### 4. 生成最小复现包

```bash
# 生成复现包（自动选择第一个失败调用）
node src/cli.js reproduce --schema examples/schema.json --trace examples/trace.jsonl

# 指定目标调用
node src/cli.js reproduce --schema examples/schema.json --trace examples/trace.jsonl --target tc-008

# 指定输出目录
node src/cli.js reproduce --schema examples/schema.json --trace examples/trace.jsonl --output-dir ./my-reproduction
```

### 5. 验证参数兼容性

```bash
# 验证整个轨迹
node src/cli.js validate --schema examples/schema.json --trace examples/trace.jsonl

# 验证单个工具调用
node src/cli.js validate --schema examples/schema.json --tool get_user --params '{"user_id": "u-001"}'
```

## CLI 命令参考

### `analyze` - 分析轨迹

| 参数 | 说明 |
|------|------|
| `--schema <path>` | **必需** Schema 文件路径 (JSON/YAML) |
| `--trace <path>` | **必需** 轨迹文件路径 (JSONL/JSON) |
| `--old-schema <path>` | 旧 Schema 路径，用于漂移检测 |
| `--output <path>` | 输出文件路径 |
| `--format <format>` | 输出格式: `json` 或 `markdown` |

### `plan` - 生成回放计划

| 参数 | 说明 |
|------|------|
| `--schema <path>` | **必需** Schema 文件路径 |
| `--trace <path>` | **必需** 轨迹文件路径 |
| `--include-retries` | 包含重试调用 (默认: true) |
| `--skip-non-idempotent` | 跳过非幂等调用 (默认: false) |
| `--output <path>` | 输出文件路径 |

### `report` - 生成报告

| 参数 | 说明 |
|------|------|
| `--schema <path>` | **必需** Schema 文件路径 |
| `--trace <path>` | **必需** 轨迹文件路径 |
| `--old-schema <path>` | 旧 Schema 路径 |
| `--output <path>` | 输出文件路径 |
| `--format <format>` | 输出格式: `markdown` (默认) 或 `json` |
| `--include-raw` | 包含原始数据 |

### `reproduce` - 生成最小复现包

| 参数 | 说明 |
|------|------|
| `--schema <path>` | **必需** Schema 文件路径 |
| `--trace <path>` | **必需** 轨迹文件路径 |
| `--target <call_id>` | 目标 tool_call_id |
| `--output-dir <path>` | 输出目录 (默认: `./reproduction`) |
| `--no-schema` | 不包含 Schema |
| `--no-config` | 不包含配置文件 |

### `validate` - 验证参数

| 参数 | 说明 |
|------|------|
| `--schema <path>` | **必需** Schema 文件路径 |
| `--trace <path>` | 轨迹文件路径 |
| `--tool <name>` | 工具名称 |
| `--params <json>` | 参数 JSON 字符串 |

## 示例数据说明

项目包含示例数据，位于 `examples/` 目录：

- `schema.json` - 当前版本的 Schema (v2.0.0)
- `schema-old.json` - 旧版本 Schema (v1.0.0)，用于演示漂移检测
- `trace.jsonl` - 示例调用轨迹，包含以下场景：

| 场景 | 说明 | 示例调用 |
|------|------|----------|
| 正常调用 | 标准的工具调用 | `list_users`, `get_user` |
| 写入操作 | 非幂等的创建/更新/删除 | `create_user`, `update_user`, `delete_user` |
| 重复调用 | 同一 tool_call_id 多次出现 | `tc-008` (第 8、9 行) |
| 失败重试 | 先失败后成功的调用 | `search_files` (tc-009 失败, tc-010 成功) |
| 非幂等结果 | 相同参数不同结果 | `get_user(u-004)` (status 从 pending 变 active) |

### Schema 漂移示例

新旧 Schema 的主要差异：

| 变更类型 | 工具 | 说明 |
|----------|------|------|
| 新增工具 | `delete_user`, `search_files` | v2.0.0 新增 |
| 参数新增 | `create_user` | 新增必需参数 `password` |
| 参数改名 | `update_user` | `display_name` 改名为 `name` |
| 参数移除 | `update_user` | `display_name` 不再是必需参数 |
| 类型变更 | `list_users` | `page` 从 `number` 改为 `integer` |
| 参数新增 | `list_users` | 新增 `limit`、`status` 参数 |

## 边界情况处理

### 1. 同一 tool_call_id 重复

工具会自动检测重复的 tool_call_id，并根据策略处理：

- **重试检测**: 如果前一次失败后成功，标记为"重试成功"
- **非幂等检测**: 如果相同参数不同结果，标记为"非幂等风险"
- **配置选项**: 通过 `--handle-duplicates` 配置策略 (warn/keep_first/keep_last/keep_all)

### 2. Schema 字段改名

通过新旧 Schema 对比，可以检测到：

- 参数类型变更 (如 `number` → `integer`)
- 参数名称变更 (如 `display_name` → `name`)
- 参数必需性变更 (必需 → 可选 或 反之)
- 枚举值变更

### 3. 非幂等操作

自动检测以下非幂等风险：

- **写入操作**: 工具名包含 `create`, `update`, `delete`, `set` 等关键词
- **相同参数不同结果**: 多次调用返回不同数据
- **状态变更**: 如用户状态从 `pending` 变为 `active`

## API 参考

### SchemaParser

```javascript
const SchemaParser = require('./src/schema-parser');
const parser = new SchemaParser({ strict: true });

// 解析 Schema
const schema = parser.parse('schema.json');

// 验证工具调用
const result = parser.validateToolCall('get_user', { user_id: 'u-001' }, schema);
console.log(result.valid); // true/false

// 检测 Schema 漂移
const oldSchema = parser.parse('schema-old.json');
const drift = parser.detectSchemaDrift(oldSchema, schema);
console.log(drift.hasBreakingChanges); // true/false
```

### TraceParser

```javascript
const TraceParser = require('./src/trace-parser');
const parser = new TraceParser({ handleDuplicates: 'keep_all' });

// 解析轨迹
const trace = await parser.parse('trace.jsonl');
console.log(trace.totalEntries); // 条目数量
console.log(trace.duplicates); // 重复调用列表
```

### TimelineBuilder

```javascript
const TimelineBuilder = require('./src/timeline-builder');
const builder = new TimelineBuilder({ retryWindowMs: 30000 });

// 构建时间线
const timeline = builder.build(trace);
console.log(timeline.retries); // 重试列表
console.log(timeline.nonIdempotentRisks); // 非幂等风险
console.log(timeline.statistics); // 统计信息
```

### ReplayPlanner

```javascript
const ReplayPlanner = require('./src/replay-planner');
const planner = new ReplayPlanner();

// 生成回放计划
const plan = planner.generate(timeline, schema, {
  includeRetries: true,
  skipNonIdempotent: false
});

// Dry-run 摘要
const dryRun = planner.generateDryRunSummary(plan);
console.log(dryRun.canExecute); // 是否可执行
```

### Reporter

```javascript
const Reporter = require('./src/reporter');
const reporter = new Reporter({ outputFormat: 'markdown' });

// 生成报告
const report = reporter.generateReport({
  trace,
  timeline,
  schema,
  plan,
  drift
});

// 保存报告
reporter.saveReport(report, 'report.md');
```

### Reproducer

```javascript
const Reproducer = require('./src/reproducer');
const reproducer = new Reproducer({ outputDir: './reproduction' });

// 生成复现包
const reproduction = reproducer.generate({
  trace,
  timeline,
  schema,
  plan
}, 'target-call-id');

// 保存复现包
reproducer.savePackage(reproduction);
```

## 运行测试

```bash
npm test
```

## 项目结构

```
mcp-replay-debugger/
├── src/
│   ├── cli.js              # CLI 入口
│   ├── schema-parser.js    # Schema 解析器
│   ├── trace-parser.js     # 轨迹解析器
│   ├── timeline-builder.js # 时间线构建器
│   ├── replay-planner.js   # 回放计划生成器
│   ├── reporter.js         # 报告生成器
│   └── reproducer.js       # 复现包生成器
├── examples/
│   ├── schema.json         # 当前 Schema
│   ├── schema-old.json     # 旧版 Schema
│   └── trace.jsonl         # 示例轨迹
├── tests/                  # 测试文件
├── package.json
└── README.md
```

## 许可证

MIT
