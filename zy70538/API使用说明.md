# API结果缓存解释API - 使用说明

## 项目概述
内部工具API，用于解释缓存命中来源、失效时间等信息，帮助客服人员理解为什么看到的是旧数据。

## 核心特性

### 数据模型字段
- **接口路径** (`apiPath`): 命中缓存的API地址
- **缓存键** (`cacheKey`): 实际使用的缓存键
- **缓存键计算** (`cacheKeyCalculation`): 算法、因子、原始值
- **命中规则** (`matchedRule`): 规则ID、名称、TTL、优先级、条件
- **生成时间** (`generatedAt`): 缓存解释生成时间
- **失效条件** (`expiration`): 失效时间、TTL、失效条件列表
- **解释报告** (`explanationReport`): 摘要、详情、建议
- **命中历史** (`hitHistory`): 每次命中的时间、请求ID、客户端IP
- **失败详情** (`failureDetails`): 原始输入、处理依据、最终结论

### 状态枚举 (5种明确状态)
- `pending`: 待处理 - 新创建的记录
- `confirmed`: 已确认 - 已验证正确
- `blocked`: 被拦截 - 处理失败被拦截
- `revoked`: 已撤销 - 被强制刷新或手动撤销
- `compensated`: 已补偿 - 已修正并补偿

## 快速启动

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 生产构建
npm run build

# 运行测试
npm test
```

服务默认端口: `3000`
健康检查: `GET http://localhost:3000/health`

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/cache-explanations` | 创建缓存解释记录 |
| GET | `/api/v1/cache-explanations` | 查询缓存解释列表 |
| GET | `/api/v1/cache-explanations/:id` | 根据ID获取详情 |
| GET | `/api/v1/cache-explanations/cache-key/:cacheKey` | 根据缓存键查询 |
| GET | `/api/v1/cache-explanations/:id/report` | 获取详细解释报告 |
| GET | `/api/v1/cache-explanations/:id/hit-history` | 获取命中历史 |
| PATCH | `/api/v1/cache-explanations/:id/status` | 更新状态 |
| POST | `/api/v1/cache-explanations/manual-correction` | 人工修正 |
| POST | `/api/v1/cache-explanations/record-hit` | 记录缓存命中 |
| POST | `/api/v1/cache-explanations/force-refresh` | 强制刷新缓存 |
| POST | `/api/v1/cache-explanations/record-failure` | 记录失败详情 |
| GET | `/api/v1/cache-explanations/export/csv` | 导出CSV |
| GET | `/api/v1/cache-explanations/export/json` | 导出JSON |

## 使用示例

### 1. 创建缓存解释
```bash
curl -X POST http://localhost:3000/api/v1/cache-explanations \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/users/profile",
    "cacheKey": "users:profile:12345",
    "cacheKeyCalculation": {
      "algorithm": "MD5",
      "factors": ["userId", "tenantId", "locale"],
      "rawValue": "12345:tenant1:zh-CN"
    },
    "matchedRule": {
      "id": "rule-profile-001",
      "name": "用户资料缓存",
      "description": "用户个人资料缓存1小时",
      "ttl": 3600,
      "priority": 5,
      "conditions": [
        {"field": "path", "operator": "startsWith", "value": "/api/v1/users"}
      ]
    },
    "ttlSeconds": 3600,
    "expirationConditions": ["用户更新资料", "管理员强制刷新"],
    "explanationReport": {
      "summary": "命中用户资料缓存规则",
      "details": [
        "缓存键由用户ID、租户ID、语言计算得出",
        "将在1小时后自动失效",
        "数据来源: Redis集群节点A"
      ],
      "recommendations": "如需最新数据请联系管理员强制刷新"
    },
    "createdBy": "cache-service"
  }'
```

### 2. 查询缓存解释
```bash
# 分页查询
curl "http://localhost:3000/api/v1/cache-explanations?page=1&pageSize=20"

# 按状态筛选
curl "http://localhost:3000/api/v1/cache-explanations?status=pending"

# 按缓存键查询
curl "http://localhost:3000/api/v1/cache-explanations/cache-key/users:profile:12345"
```

### 3. 记录命中
```bash
curl -X POST http://localhost:3000/api/v1/cache-explanations/record-hit \
  -H "Content-Type: application/json" \
  -d '{
    "cacheKey": "users:profile:12345",
    "requestId": "req-abc-123",
    "clientIp": "192.168.1.100"
  }'
```

### 4. 强制刷新
```bash
curl -X POST http://localhost:3000/api/v1/cache-explanations/force-refresh \
  -H "Content-Type: application/json" \
  -d '{
    "cacheKey": "users:profile:12345",
    "reason": "用户资料已更新",
    "refreshedBy": "admin-001"
  }'
```

### 5. 人工修正
```bash
curl -X POST http://localhost:3000/api/v1/cache-explanations/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "explanationId": "uuid-here",
    "newStatus": "compensated",
    "reason": "TTL设置错误，已修正",
    "correctedBy": "operator-001",
    "overrideTtl": 7200
  }'
```

### 6. 记录失败
```bash
curl -X POST http://localhost:3000/api/v1/cache-explanations/record-failure \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uuid-here",
    "rawInput": {"cacheKey": "invalid-key", "path": "/api/test"},
    "processingBasis": ["规则校验不通过", "参数格式错误"],
    "finalConclusion": "缓存键格式不符合规范",
    "errorStack": "Error: Invalid cache key format\n    at validate..."
  }'
```

### 7. 导出数据
```bash
# 导出CSV
curl http://localhost:3000/api/v1/cache-explanations/export/csv

# 导出JSON
curl http://localhost:3000/api/v1/cache-explanations/export/json
```

## 项目结构
```
.
├── src/
│   ├── app.ts                    # 应用入口
│   ├── types.ts                  # 类型定义
│   ├── controllers/
│   │   └── cacheExplanationController.ts
│   ├── store/
│   │   ├── cacheExplanationStore.ts
│   │   └── cacheExplanationStore.test.ts
│   ├── services/
│   │   └── exportService.ts      # 导出服务
│   ├── middleware/
│   │   ├── validation.ts         # 参数验证
│   │   └── errorHandler.ts       # 错误处理
│   └── routes/
│       └── cacheExplanationRoutes.ts
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 注意事项
1. 当前使用内存存储，生产环境建议替换为Redis或数据库
2. 导出文件默认保存在 `exports/` 目录
3. 所有时间字段均使用ISO 8601格式
4. 建议在生产环境添加身份认证中间件
