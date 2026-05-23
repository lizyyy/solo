# 生鲜分拣损耗重试补偿队列服务

解决生鲜分拣场景下，接口偶发失败后，坏果扣款和二次分拣损耗常被重复计算的问题。

## 核心特性

- **数据完整性**: 导入时保留来源文件、原始行号和解析后的标准值，原始证据不覆盖
- **持久化队列**: 外部回执提交、排队、限次重试、人工接管、补偿入账、关闭全部持久化
- **服务恢复**: 重启后自动恢复未完成任务，接着处理
- **状态区分**: 异步任务失败区分「等重试」、「等人工」、「永久失败」
- **去重机制**: 坏果扣款、二次分拣损耗自动检测重复计算
- **采购视角**: 按可重试分类、死信处理导出，不是一堆看不出源的汇总数

## 目录结构

```
.
├── src/
│   ├── app.js                 # 主入口
│   ├── config/                # 配置文件
│   │   ├── index.js           # 环境配置
│   │   ├── database.js        # 数据库配置
│   │   ├── queue.js           # Bull队列配置
│   │   └── logger.js          # 日志配置
│   ├── models/                # 数据模型
│   │   ├── ImportBatch.js     # 导入批次
│   │   ├── SupplierDelivery.js# 供应商送货单
│   │   ├── WeighingRecord.js  # 称重记录
│   │   ├── BasketReturn.js    # 退筐照片
│   │   ├── LossRecord.js      # 损耗记录
│   │   ├── CompensationQueue.js # 补偿队列
│   │   └── index.js           # 模型关联
│   ├── services/              # 业务服务
│   │   ├── importService.js   # 导入服务
│   │   ├── importParser.js    # 数据解析
│   │   ├── fileHashService.js # 文件哈希
│   │   ├── queueService.js    # 队列服务
│   │   ├── lossCalculationService.js # 损耗计算
│   │   └── exportService.js   # 导出服务
│   ├── controllers/           # API控制器
│   ├── routes/                # 路由
│   ├── workers/               # 队列处理器
│   └── scripts/               # 脚本
├── samples/                   # 样例数据
├── tests/                     # 测试用例
└── data/                      # 数据库文件（自动创建）
```

## 快速开始

### 1. 环境要求

- Node.js >= 16
- Redis >= 6（用于Bull队列）
- SQLite3（内置）

### 2. 安装依赖

```bash
npm install
```

### 3. 启动Redis

```bash
# macOS
brew services start redis

# 或使用Docker
docker run -d -p 6379:6379 redis
```

### 4. 初始化数据库

```bash
npm run init-db
```

### 5. 导入样例数据

```bash
npm run seed
```

### 6. 启动服务

```bash
npm start

# 开发模式
npm run dev
```

服务启动后访问: `http://localhost:3000/api/health`

## 主流程演示

### 步骤1: 健康检查

```bash
curl http://localhost:3000/api/health
```

### 步骤2: 查看样例数据

```bash
# 查看导入批次
curl http://localhost:3000/api/import/batches

# 查看送货单（在批次详情中）
curl "http://localhost:3000/api/import/batches/{batchId}"
```

### 步骤3: 处理送货单（自动计算损耗）

```bash
# 处理第一个送货单
curl -X POST http://localhost:3000/api/loss/process-delivery/DEL20240115001

# 处理第二个送货单
curl -X POST http://localhost:3000/api/loss/process-delivery/DEL20240115002
```

### 步骤4: 查看损耗记录

```bash
# 查看所有损耗记录
curl http://localhost:3000/api/loss/records

# 查看损耗汇总
curl http://localhost:3000/api/loss/summary

# 查看重复记录
curl "http://localhost:3000/api/loss/records?isDuplicate=true"
```

### 步骤5: 查看队列状态

```bash
# 队列统计
curl http://localhost:3000/api/queue/stats

# 任务列表
curl http://localhost:3000/api/queue/jobs

# 按状态筛选
curl "http://localhost:3000/api/queue/jobs?status=success"
```

## 制造异常场景

### 场景1: 模拟外部系统异常触发重试

```bash
# 先找到一条退筐记录ID
curl http://localhost:3000/api/import/batches

# 找到 basketReturns 的ID，然后调用:
curl -X POST http://localhost:3000/api/loss/bad-fruit \
  -H "Content-Type: application/json" \
  -d '{"basketReturnId": "{basketReturnId}", "simulateError": true}'
```

预期行为:
1. 创建损耗记录
2. 创建坏果扣款队列任务
3. 任务因模拟异常失败
4. 状态变为 `waiting_retry`（等重试）
5. 30秒后自动重试
6. 重试3次后变为 `permanent_failed`（永久失败）

### 场景2: 人工接管永久失败任务

```bash
# 找到永久失败的任务ID
curl "http://localhost:3000/api/queue/jobs?status=permanent_failed"

# 人工重试
curl -X POST "http://localhost:3000/api/queue/jobs/{queueId}/manual-handle" \
  -H "Content-Type: application/json" \
  -d '{"action": "retry", "handledBy": "采购经理", "handleNote": "已确认外部系统恢复"}'

# 或人工关闭
curl -X POST "http://localhost:3000/api/queue/jobs/{queueId}/manual-handle" \
  -H "Content-Type: application/json" \
  -d '{"action": "close", "handledBy": "采购经理", "handleNote": "金额过小，放弃补偿"}'

# 或直接人工补偿
curl -X POST "http://localhost:3000/api/queue/jobs/{queueId}/manual-handle" \
  -H "Content-Type: application/json" \
  -d '{"action": "compensate", "handledBy": "采购经理", "handleNote": "已人工打款"}'
```

### 场景3: 重复计算测试

```bash
# 对同一条称重记录计算两次
curl -X POST http://localhost:3000/api/loss/secondary-sorting \
  -H "Content-Type: application/json" \
  -d '{"weighingRecordId": "{weighingRecordId}"}'

# 再算一次
curl -X POST http://localhost:3000/api/loss/secondary-sorting \
  -H "Content-Type: application/json" \
  -d '{"weighingRecordId": "{weighingRecordId}"}'

# 查看重复标记
curl "http://localhost:3000/api/loss/records?isDuplicate=true"
```

## 导入文件API

### 导入供应商送货单

```bash
curl -X POST http://localhost:3000/api/import/upload \
  -F "file=@samples/供应商送货单_样例.csv" \
  -F "fileType=delivery_note" \
  -F "importedBy=admin"
```

### 导入称重记录

```bash
curl -X POST http://localhost:3000/api/import/upload \
  -F "file=@samples/称重记录_样例.csv" \
  -F "fileType=weighing_record" \
  -F "importedBy=admin"
```

### 导入退筐记录

```bash
curl -X POST http://localhost:3000/api/import/upload \
  -F "file=@samples/退筐照片记录_样例.csv" \
  -F "fileType=basket_return" \
  -F "importedBy=admin"
```

## 导出功能（采购经理视角）

### 导出可重试任务

```bash
curl http://localhost:3000/api/export/retryable
```

返回: 文件名、记录数。可通过下载接口获取文件。

### 导出死信任务（永久失败+等人工）

```bash
curl http://localhost:3000/api/export/dead-letter
```

### 按状态导出队列

```bash
curl http://localhost:3000/api/export/queue/waiting_retry
curl http://localhost:3000/api/export/queue/permanent_failed
curl http://localhost:3000/api/export/queue/success
```

### 导出损耗记录

```bash
# 全部
curl http://localhost:3000/api/export/loss-records

# 按类型筛选
curl "http://localhost:3000/api/export/loss-records?lossType=bad_fruit"

# 只看重复记录
curl "http://localhost:3000/api/export/loss-records?isDuplicate=true"
```

### 下载导出文件

```bash
curl -O "http://localhost:3000/api/export/download/{fileName}"
```

## 运行测试

```bash
# 运行全部测试
npm test

# 运行队列状态测试
npm test -- tests/queueService.test.js

# 运行损耗计算测试
npm test -- tests/lossCalculation.test.js

# 监听模式
npm run test:watch
```

### 测试重点

1. **状态变化**: `pending` → `processing` → `waiting_retry` → `permanent_failed` / `success`
2. **幂等性**: 重复导入、重复计算、重复调用不会产生脏数据
3. **错误历史**: 每次失败都有完整记录
4. **重复检测**: 同一来源数据不会被重复计算损耗

## 数据模型说明

### 状态机 - 补偿队列

```
pending (待处理)
    ↓
processing (处理中)
    ↓
    ├─→ success (成功) → closed
    └─→ 失败
          ↓
    可重试? ──否──→ permanent_failed (永久失败)
       │是
       ↓
    已达最大重试? ──是──→ permanent_failed
       │否
       ↓
    waiting_retry (等重试)
       ↓  (自动重试)
    back to processing

permanent_failed / waiting_retry
    ↓  (人工处理)
    ├─→ retry → pending
    ├─→ compensate → success
    └─→ close → closed
```

### 损耗类型

- `bad_fruit`: 坏果扣款（来自退筐记录）
- `secondary_sorting`: 二次分拣损耗（送货量-称重净重）
- `other`: 其他

### 文件类型

- `delivery_note`: 供应商送货单
- `weighing_record`: 称重记录
- `basket_return`: 退筐照片

## 常见问题

### Q: 服务重启后任务会丢失吗？

不会。所有任务状态都持久化在数据库，服务启动时会自动扫描 `pending`、`processing`、`waiting_retry` 状态的任务并恢复。

### Q: 如何保证原始数据不被修改？

所有导入数据的 `originalData` 字段保存原始行数据，`originalRowNumber` 保存原始行号，这些字段永不更新。后续改判只会更新衍生字段。

### Q: 重复计算是如何检测的？

- 二次分拣损耗：按 `sourceId` 或 `deliveryNo` 检测
- 坏果扣款：按 `sourceId` 或 (送货单+商品+日期) 组合检测

### Q: 外部回执如何提交？

```bash
curl -X POST "http://localhost:3000/api/queue/jobs/{queueId}/submit-receipt" \
  -H "Content-Type: application/json" \
  -d '{"receiptId": "PAY-20240115-001", "receiptData": {"amount": 17.5, "paidAt": "2024-01-15T10:30:00Z"}}'
```

## API 总览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/import/upload | 导入文件 |
| GET | /api/import/batches | 导入批次列表 |
| GET | /api/import/batches/:id | 批次详情 |
| POST | /api/loss/bad-fruit | 计算坏果损耗 |
| POST | /api/loss/secondary-sorting | 计算二次分拣损耗 |
| POST | /api/loss/process-delivery/:no | 处理送货单（自动全部） |
| GET | /api/loss/records | 损耗记录列表 |
| GET | /api/loss/records/:id | 损耗记录详情 |
| GET | /api/loss/summary | 损耗汇总 |
| POST | /api/queue/jobs | 添加队列任务 |
| GET | /api/queue/jobs | 任务列表 |
| GET | /api/queue/jobs/:id | 任务详情 |
| GET | /api/queue/stats | 队列统计 |
| POST | /api/queue/jobs/:id/manual-handle | 人工处理 |
| POST | /api/queue/jobs/:id/submit-receipt | 提交外部回执 |
| POST | /api/queue/jobs/:id/mark-waiting-manual | 标记待人工 |
| GET | /api/export/retryable | 导出可重试任务 |
| GET | /api/export/dead-letter | 导出死信任务 |
| GET | /api/export/queue/:status | 按状态导出队列 |
| GET | /api/export/loss-records | 导出损耗记录 |
| GET | /api/export/import-batches | 导出导入批次 |
| GET | /api/export/download/:fileName | 下载文件 |
