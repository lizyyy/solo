# GraphQL Cache Replay Tool

本地 GraphQL BFF 缓存失效回放工具，用于前端平台同学在改缓存策略前离线复盘。

## 功能特性

- 📊 **时间线回放** - 按时间顺序重放查询和变更操作
- 🔍 **问题检测** - 自动检测以下问题：
  - `stale_data` - 过期数据问题
  - `over_invalidation` - 过度清缓存
  - `missing_key` - 缺 key 问题
  - `out_of_order_mutation` - 乱序 mutation
  - `circular_dependency` - 循环依赖
  - `ttl_expired` - TTL 过期
- 📈 **可视化报表** - 生成可打开的 preview.html
- 📋 **导出功能** - 导出 issues.csv 和 cache_report.md
- 🧪 **边界情况测试** - 覆盖循环依赖和乱序事件

## 安装

```bash
npm install
```

## 快速开始

### 使用示例数据运行 Demo

```bash
# 运行完整 demo
npm run demo

# 或者直接使用 CLI
npx ts-node src/cli.ts demo
```

### 手动运行回放分析

```bash
# 使用默认文件路径
npx ts-node src/cli.ts replay

# 指定自定义文件路径
npx ts-node src/cli.ts replay \
  --schema ./schema.graphql \
  --operations ./operations.jsonl \
  --policy ./cache-policy.yaml \
  --mutations ./mutation-events.jsonl \
  --output-dir ./output
```

### 启动预览服务器

```bash
# 在默认端口 3000 启动
npx ts-node src/cli.ts serve

# 指定端口和目录
npx ts-node src/cli.ts serve --port 8080 --dir ./output
```

然后访问 http://localhost:3000 查看可视化报表。

## 输入文件格式

### 1. schema.graphql

标准 GraphQL Schema 文件，定义所有类型和操作。

```graphql
type Query {
  user(id: ID!): User
  posts: [Post!]!
}

type User {
  id: ID!
  name: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  author: User!
}
```

### 2. operations.jsonl

查询操作日志，每行一个 JSON 对象：

```jsonl
{"timestamp": 1735800000000, "operationName": "GetUser", "query": "query GetUser($id: ID!) { user(id: $id) { id name } }", "variables": {"id": "user-1"}, "result": {"data": {"user": {"id": "user-1", "name": "Alice"}}}}
{"timestamp": 1735800010000, "operationName": "ListPosts", "query": "query ListPosts { posts { id title } }", "variables": {}, "result": {"data": {"posts": [{"id": "post-1", "title": "Hello"}]}}}
```

### 3. cache-policy.yaml

缓存策略配置文件：

```yaml
defaultTTL: 3600

entities:
  User:
    name: User
    ttl: 7200
    tags:
      - "users"
    keyFields:
      - id
    dependencies:
      - Profile

  Post:
    name: Post
    ttl: 1800
    tags:
      - "posts"
      - "content"
    keyFields:
      - id
    dependencies:
      - User

tagRules:
  - tag: "content"
    invalidates:
      - Post
      - Comment

  - tag: "users"
    invalidates:
      - User
      - Profile

queryOverrides:
  GetUserWithPosts:
    ttl: 86400
    tags:
      - "users"
      - "posts"
```

### 4. mutation-events.jsonl

变更事件日志，每行一个 JSON 对象：

```jsonl
{"timestamp": 1735800060000, "operationName": "UpdateUser", "mutation": "mutation UpdateUser($id: ID!) { updateUser(id: $id) { id name } }", "variables": {"id": "user-1"}, "result": {"data": {"updateUser": {"id": "user-1"}}}, "affectedEntities": [{"entityType": "User", "entityId": "user-1", "action": "update"}]}
```

## 输出文件

### preview.html

可视化报表页面，包含：
- 概览指标（查询数、变更数、命中率等）
- 时间线事件流
- 问题清单（按严重程度分类）
- 优化建议
- 实体依赖图
- 当前缓存状态

### issues.csv

问题列表 CSV 文件，可导入 Excel 或数据分析工具：

| ID | Type | Severity | Timestamp | Operation Name | Message | Details JSON |
|----|------|----------|-----------|----------------|---------|---------------|
| issue-1 | out_of_order_mutation | high | 2025-01-01 10:00:00 | UpdateUser | 乱序 mutation 检测 | {...} |

### cache_report.md

详细的 Markdown 格式报告：

- Summary 汇总
- Issues by Type 按类型统计
- Issues by Severity 按严重程度统计
- High Severity Issues 高严重度问题详情
- Recommendations 优化建议
- Timeline Events 时间线事件
- Entity Dependencies 实体依赖
- Current Cache State 缓存状态

## 问题类型说明

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| `stale_data` | high | 过期数据 - TTL 已过期但可能被使用 |
| `out_of_order_mutation` | high | 乱序变更 - 同一实体的多个变更时间戳相同 |
| `circular_dependency` | high | 循环依赖 - 实体依赖形成循环 |
| `over_invalidation` | medium | 过度清缓存 - 标签规则导致不必要的失效 |
| `missing_key` | medium | 缺 key - 查询结果无法提取实体标识 |
| `ttl_expired` | low | TTL 过期 - 缓存条目已过期 |
| `cache_miss` | low | 缓存未命中 - 首次访问或已失效 |

## 边界情况测试

### 循环依赖检测

项目包含一个用于测试循环依赖检测的样本策略：

```bash
# 运行循环依赖测试
npx ts-node src/cli.ts test-circular
```

测试用的策略文件 (`samples/circular-deps-policy.yaml`) 包含以下循环：
```
User → Post → Comment → User
```

### 乱序 Mutation 测试

样本数据包含两个相同时间戳的 mutation 事件，用于测试乱序检测：

```jsonl
{"timestamp": 1735800100000, "operationName": "OutOfOrderMutation_1", ..., "affectedEntities": [{"entityType": "User", "entityId": "user-1", "action": "update"}]}
{"timestamp": 1735800100000, "operationName": "OutOfOrderMutation_2", ..., "affectedEntities": [{"entityType": "User", "entityId": "user-1", "action": "update"}]}
```

## 项目结构

```
├── src/
│   ├── cli.ts              # CLI 入口文件
│   ├── types.ts            # TypeScript 类型定义
│   ├── parser.ts           # 文件解析器
│   ├── cache-engine.ts     # 缓存引擎
│   ├── timeline-replay.ts  # 时间线回放引擎
│   ├── exporter.ts         # 导出模块 (CSV/MD)
│   └── preview-generator.ts # 预览页面生成器
├── samples/
│   ├── schema.graphql              # 示例 Schema
│   ├── operations.jsonl            # 示例查询日志
│   ├── cache-policy.yaml           # 示例缓存策略
│   ├── mutation-events.jsonl       # 示例变更日志
│   └── circular-deps-policy.yaml   # 循环依赖测试策略
├── package.json
├── tsconfig.json
└── README.md
```

## CLI 命令参考

### replay

执行缓存回放分析。

```bash
npx ts-node src/cli.ts replay [options]

Options:
  -s, --schema <path>       Schema 文件路径 (默认: schema.graphql)
  -o, --operations <path>   操作日志路径 (默认: operations.jsonl)
  -p, --policy <path>       缓存策略路径 (默认: cache-policy.yaml)
  -m, --mutations <path>    变更日志路径 (默认: mutation-events.jsonl)
  -d, --output-dir <path>   输出目录 (默认: .)
  --no-preview              不生成 preview.html
  --no-csv                  不生成 issues.csv
  --no-md                   不生成 cache_report.md
```

### serve

启动本地服务器查看预览页面。

```bash
npx ts-node src/cli.ts serve [options]

Options:
  -p, --port <number>   监听端口 (默认: 3000)
  -d, --dir <path>      预览文件目录 (默认: .)
```

### demo

使用样本数据运行完整演示。

```bash
npx ts-node src/cli.ts demo [options]

Options:
  -d, --output-dir <path>   输出目录 (默认: ./demo-output)
```

### test-circular

测试循环依赖检测功能。

```bash
npx ts-node src/cli.ts test-circular [options]

Options:
  -d, --output-dir <path>   输出目录 (默认: ./circular-test)
```

## 示例工作流

1. **准备数据**：从生产环境导出以下文件
   - GraphQL Schema (`schema.graphql`)
   - 查询操作日志 (`operations.jsonl`)
   - 缓存策略配置 (`cache-policy.yaml`)
   - 变更事件日志 (`mutation-events.jsonl`)

2. **运行回放分析**
   ```bash
   npx ts-node src/cli.ts replay \
     --schema ./data/schema.graphql \
     --operations ./data/operations.jsonl \
     --policy ./data/cache-policy.yaml \
     --mutations ./data/mutation-events.jsonl \
     --output-dir ./analysis
   ```

3. **查看结果**
   - 启动预览服务器：`npx ts-node src/cli.ts serve --dir ./analysis`
   - 访问 http://localhost:3000
   - 或直接打开 `./analysis/preview.html`

4. **分析问题**
   - 检查高严重度问题
   - 查看时间线事件流
   - 阅读优化建议

5. **修改策略**
   - 根据分析结果调整 `cache-policy.yaml`
   - 重新运行回放验证效果

## License

MIT
