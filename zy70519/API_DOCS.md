# 缓存预热编排API - 接口文档

## 服务信息
- **Base URL**: `http://localhost:3000/api/v1/warmup`
- **健康检查**: `http://localhost:3000/health`
- **数据库**: SQLite (`./data/cache_warmup.db`)

## 核心数据模型

### 1. 预热批次 (Batch)
- `id`: UUID
- `name`: 批次名称
- `description`: 描述
- `status`: pending / running / paused / completed / failed / partial
- `totalKeys`: 总key数
- `successKeys`: 成功数
- `failedKeys`: 失败数
- `pendingKeys`: 待处理数
- `dataSourceId`: 数据源ID
- `priority`: 优先级
- `createdBy`: 创建人

### 2. 缓存键 (CacheKey)
- `id`: UUID
- `batchId`: 批次ID
- `cacheKey`: 缓存key
- `cacheType`: 缓存类型
- `status`: pending / processing / success / failed / skipped / retrying
- `retryCount`: 已重试次数
- `maxRetries`: 最大重试次数

### 3. 失败记录 (FailureRecord)
- `id`: UUID
- `cacheKeyId`: 缓存键ID
- `batchId`: 批次ID
- `originalInput`: 原始输入
- `processingBasis`: 处理依据
- `errorMessage`: 错误信息
- `finalConclusion`: 最终结论
- `nodeId`: 执行节点ID

## API接口列表

### 批次管理

#### 创建预热批次
```http
POST /batches
Content-Type: application/json

{
  "name": "大促预热-商品数据",
  "description": "618大促前缓存预热",
  "dataSourceId": "uuid",
  "cacheKeys": [
    {"key": "product:1001", "type": "hash", "ttl": 3600, "dataQuery": "SELECT * FROM products"}
  ],
  "priority": 10,
  "maxRetries": 3,
  "createdBy": "system_admin"
}
```
- **Key去重**: 自动去重，返回`duplicateCount`

#### 查询批次列表
```http
GET /batches?limit=100&offset=0
```

#### 获取批次详情
```http
GET /batches/{batchId}
```
- 包含批次信息、所有缓存键、失败记录

#### 启动批次
```http
POST /batches/{batchId}/start
```

#### 获取批次报告
```http
GET /batches/{batchId}/report
```
- 成功率、执行时长、失败详情

#### 导出批次数据
```http
GET /batches/{batchId}/export?format=csv|json
```
- 支持JSON和CSV格式导出

### Key执行管理

#### 更新Key执行状态
```http
POST /keys/status
Content-Type: application/json

{
  "cacheKeyId": "uuid",
  "status": "success|failed|processing",
  "errorMessage": "可选",
  "processingBasis": "可选",
  "nodeId": "可选"
}
```
- 失败自动重试机制
- 自动更新批次统计

#### 查看重试记录
```http
GET /keys/{cacheKeyId}/retry-records
```

### 人工干预

#### 人工修正失败Key
```http
POST /manual-fix
Content-Type: application/json

{
  "cacheKeyId": "uuid",
  "action": "retry|skip|mark_success",
  "reason": "处理原因",
  "operator": "操作人"
}
```

### 数据源管理

#### 创建数据源
```http
POST /data-sources
Content-Type: application/json

{
  "name": "MySQL-Production",
  "type": "mysql|redis|api|file|other",
  "config": {"host": "localhost", "port": 3306}
}
```

#### 查询数据源列表
```http
GET /data-sources
```

### 执行节点管理

#### 注册节点
```http
POST /nodes
Content-Type: application/json
{
  "name": "worker-node-01",
  "ip": "192.168.1.100"
}
```

#### 节点心跳
```http
POST /nodes/{nodeId}/heartbeat
```

#### 更新节点状态
```http
PATCH /nodes/{nodeId}/status
Content-Type: application/json
{
  "status": "online|offline|busy|idle"
}
```

## 关键特性

✅ **数据一致性
- Key自动去重
- 批次统计自动计算
- 状态流转一致

✅ **失败重试**
- 可配置最大重试次数
- 完整的失败链路记录
- 失败原因留存（原始输入、处理依据、最终结论）

✅ **持久化**
- SQLite本地存储
- 重启服务数据不丢失
- 完整的历史审计

✅ **自检功能**
- `/health` 健康检查端点
- 数据库连接检测
- 表结构完整性检查

✅ **报告导出**
- JSON格式完整数据
- CSV格式支持Excel打开
- 包含完整执行明细
