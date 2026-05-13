# Order Sharding Router API

订单数据分库分表路由 API 服务，支持：
- 订单写入路由和查询路由
- 租户和月份分片规则配置
- 迁移期间的双写和双读策略
- 跨月查询计划自动拆分
- 补偿写入和冲突解决
- 完整的路由解释和审计记录

## 技术栈
- Node.js >= 16.0.0
- Express.js
- TypeScript
- uuid

## 项目结构
```
.
├── src/
│   ├── config/
│   │   └── defaults.ts          # 默认配置（租户、分片、规则映射）
│   ├── middleware/
│   │   └── errorHandler.ts      # 错误处理中间件
│   ├── routes/
│   │   └── api.ts               # HTTP API 路由定义
│   ├── services/
│   │   ├── configService.ts     # 配置管理服务
│   │   ├── routingEngine.ts     # 核心路由引擎
│   │   ├── routingExplainer.ts  # 路由解释器
│   │   └── compensationService.ts # 补偿服务
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   ├── utils/
│   │   └── audit.ts             # 审计服务
│   └── index.ts                 # 应用入口
├── examples/
│   └── curl-examples.sh         # curl 示例脚本
├── BOUNDARIES.md                # 边界说明文档
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```
服务将在 http://localhost:3000 启动

### 3. 运行类型检查
```bash
npm run lint
```

### 4. 构建生产版本
```bash
npm run build
npm start
```

## API 端点

### 健康检查
- `GET /api/health` - 服务健康状态检查

### 路由相关
- `POST /api/route/write` - 计算写入路由
- `POST /api/route/query` - 计算查询路由
- `POST /api/route/explain` - 获取路由决策详细解释

### 查询计划
- `POST /api/query/plan` - 生成跨月查询计划

### 补偿机制
- `POST /api/compensation/create` - 创建补偿请求
- `POST /api/compensation/process` - 处理补偿请求
- `GET /api/compensation/pending/:tenantId` - 查看待处理补偿

### 冲突解决
- `POST /api/dualread/resolve` - 解决双读数据冲突

### 配置查询
- `GET /api/config/tenant/:tenantId` - 查看租户配置
- `GET /api/config/shards` - 查看所有分片配置

### 审计
- `GET /api/audit/recent` - 查看近期审计记录

## 使用示例

运行 curl 示例脚本：
```bash
chmod +x examples/curl-examples.sh
./examples/curl-examples.sh
```

### 1. 新订单写入
```bash
curl -X POST http://localhost:3000/api/route/write \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10002",
    "orderId": "ORD-2026-001",
    "createdAt": "2026-02-15T10:30:00Z"
  }'
```

### 2. 历史订单查询
```bash
curl -X POST http://localhost:3000/api/route/query \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10002",
    "createdAt": "2025-02-15T10:30:00Z"
  }'
```

### 3. 迁移中双读
```bash
curl -X POST http://localhost:3000/api/route/query \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10001",
    "orderId": "ORD-MIGRATING-001"
  }'
```

### 4. 跨月查询计划
```bash
curl -X POST http://localhost:3000/api/query/plan \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10002",
    "fromDate": "2025-01-01T00:00:00Z",
    "toDate": "2025-06-30T23:59:59Z"
  }'
```

### 5. 补偿写入
```bash
# 创建补偿请求
curl -X POST http://localhost:3000/api/compensation/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-COMP-001",
    "tenantId": "10001",
    "failedShardId": "tenant_10001_old",
    "originalWriteTimestamp": "2025-04-15T10:30:00Z",
    "operation": "update",
    "data": { "status": "shipped" }
  }'

# 处理补偿
curl -X POST http://localhost:3000/api/compensation/process \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-COMP-001",
    "tenantId": "10001",
    "failedShardId": "tenant_10001_old"
  }'
```

## 核心功能说明

### 1. 分片规则
支持两种分片规则：
- **月度分片（monthly）**：根据订单创建时间按季度分表
- **租户哈希（tenant_hash）**：根据租户ID固定路由到特定分片

### 2. 迁移策略
- **迁移状态**：not_started / in_progress / completed / rolling_back
- **写入策略**：
  - NEW_ONLY：只写入新分片
  - DUAL_WRITE：同时写入新旧分片（迁移中）
  - OLD_ONLY：只写入旧分片（回滚时）
- **读取策略**：
  - NEW_ONLY：只读取新分片
  - DUAL_READ：同时读取新旧分片（迁移中）
  - OLD_ONLY：只读取旧分片（回滚时）

### 3. 双读冲突处理
当双读返回的数据不一致时：
- 迁移进行中：默认进入 pending 状态，不自动选择
- 迁移已完成：默认使用新分片数据
- 所有冲突字段都会被详细记录

### 4. 补偿机制
- 双写任一分片失败时，创建补偿请求
- 补偿请求最多重试 3 次
- 超过重试次数需要人工干预
- 所有补偿操作都有审计记录

### 5. 查询计划
- 自动识别跨月查询涉及的所有分片
- 生成分步骤执行计划
- 支持并行执行和顺序执行策略
- 超过建议时间范围时给出警告

## 响应结构说明

所有路由 API 返回的结果都包含：
- **primaryTarget**：主目标分片（最可能的位置）
- **alternativeTargets**：备选分片列表
- **routingKeyAnalysis**：路由键质量分析
- **auditRecords**：审计记录
- **warnings** / **errors**：警告和错误信息
- **conflictResolution**：冲突解决策略（迁移中时）

## 重要边界

详细的边界说明、失败路径分析和重复执行路径请查看 [BOUNDARIES.md](./BOUNDARIES.md)

### 主要边界总结
1. 租户配置必须存在
2. 月度分片需要提供时间戳
3. 双写双读依赖迁移状态配置
4. 跨月查询有时间范围限制
5. 补偿重试有上限（3 次）
6. 双读冲突默认进入待处理状态

## 配置说明

默认配置位于 `src/config/defaults.ts`，包含：

### 预置租户
- **10001**：示例电商平台（迁移中，双写双读）
- **10002**：测试租户（月度分片，无迁移）
- **10003**：已迁移完成租户（仅新分片）

### 预置分片
- **季度分片**：按季度分表的历史和当前分片
- **租户分片**：租户专属的新旧分片（用于迁移）

### 修改配置
可以在 `src/config/defaults.ts` 中添加或修改：
- `tenantConfigs`：租户配置
- `shardConfigs`：分片配置
- `monthlyShardMappings`：月度分片映射
- `shardRuleConfigs`：分片规则配置

## 注意事项

1. **路由引擎不执行实际数据库操作**：只负责计算路由目标，实际读写由调用方执行
2. **幂等性**：写入操作不是幂等的，重复写入需要调用方自己处理（建议数据库添加唯一约束）
3. **双读冲突**：迁移中的冲突需要人工或业务规则处理，API 不会自动选择
4. **补偿机制**：需要调用方在写入失败时显式创建补偿请求
5. **查询范围**：跨月查询超过 3 个月会有警告，超过 36 个月直接拒绝
