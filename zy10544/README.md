# 库存锁定释放API

解决促销活动提前锁库存、活动取消后释放动作常常漏掉部分SKU的问题。

## 项目简介

本API提供完整的库存锁定-释放流程管理，确保活动取消后所有SKU的库存都能正确释放，避免遗漏导致的超卖问题。

## 核心功能

### 1. 数据模型
- **活动库存锁定 (ActivityStockLock)**: 记录每个SKU的锁定数量、状态、释放条件
- **释放记录 (ReleaseRecord)**: 跟踪每次释放操作的详情，支持审计
- **异常明细 (ExceptionDetail)**: 记录处理过程中的异常，保留原始输入和处理依据
- **释放报告 (ReleaseReport)**: 汇总统计，便于业务人员查看

### 2. 关键规则
- **库存锁定状态机**: LOCKED → RELEASING → PARTIALLY_RELEASED → RELEASED / FAILED
- **SKU校验**: 创建锁定时验证SKU有效性和数量
- **重复释放幂等**: 通过 requestId 保证同一请求不会重复处理
- **异常保留**: 所有异常都记录原始输入和处理依据
- **业务友好导出**: 报告不是返回一堆JSON，而是业务人员能看懂的格式

### 3. API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/stock/locks | 创建库存锁定 |
| GET | /api/stock/locks | 查询库存锁定列表 |
| GET | /api/stock/locks/export | 导出库存锁定列表 |
| POST | /api/stock/locks/advance | 推进状态（释放库存） |
| POST | /api/stock/locks/correct | 人工修正 |
| GET | /api/stock/exceptions | 查询异常列表 |
| GET | /api/stock/exceptions/export | 导出异常清单 |
| POST | /api/stock/exceptions/resolve | 标记异常已解决 |
| POST | /api/stock/reports/:activityId | 生成释放报告 |
| GET | /api/stock/reports | 查询报告列表 |
| GET | /api/stock/reports/:activityId/export | 导出报告（TXT/CSV） |

## 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务将在 http://localhost:3000 启动

### 运行示例脚本
```bash
cd docs
chmod +x api-examples.sh
./api-examples.sh
```

## curl 使用示例

### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

### 2. 创建库存锁定
```bash
curl -X POST http://localhost:3000/api/stock/locks \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "PROMO_2024_001",
    "skuItems": [
      { "sku": "SKU001", "skuName": "商品A-红色XL", "quantity": 100 },
      { "sku": "SKU002", "skuName": "商品B-蓝色M", "quantity": 200 }
    ],
    "releaseCondition": "ACTIVITY_CANCEL",
    "operator": "张三"
  }'
```

### 3. 释放库存（推进状态）
```bash
curl -X POST http://localhost:3000/api/stock/locks/advance \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "PROMO_2024_001",
    "releaseCondition": "ACTIVITY_CANCEL",
    "requestId": "req_123456",
    "operator": "李四"
  }'
```

### 4. 生成并导出报告
```bash
# 生成报告
curl -X POST http://localhost:3000/api/stock/reports/PROMO_2024_001

# 导出TXT格式（业务友好）
curl http://localhost:3000/api/stock/reports/PROMO_2024_001/export -o report.txt

# 导出CSV格式
curl "http://localhost:3000/api/stock/reports/PROMO_2024_001/export?format=csv" -o report.csv
```

### 5. 人工修正
```bash
curl -X POST http://localhost:3000/api/stock/locks/correct \
  -H "Content-Type: application/json" \
  -d '{
    "lockId": "uuid-here",
    "newStatus": "RELEASED",
    "adjustQuantity": 100,
    "correctionReason": "系统漏处理，人工补释放",
    "operator": "管理员"
  }'
```

## 释放条件枚举 (ReleaseCondition)
- `ACTIVITY_CANCEL`: 活动取消
- `ACTIVITY_END`: 活动正常结束
- `MANUAL_TRIGGER`: 人工触发
- `TIMEOUT`: 超时自动释放

## 异常类型枚举 (ExceptionType)
- `SKU_NOT_FOUND`: SKU不存在
- `INSUFFICIENT_STOCK`: 库存不足
- `DUPLICATE_RELEASE`: 重复释放
- `INVALID_STATUS`: 状态无效
- `SYSTEM_ERROR`: 系统错误

## 项目结构
```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── store/
│   │   └── index.ts          # 数据存储层
│   ├── services/
│   │   ├── stockLockService.ts  # 业务逻辑
│   │   └── exportService.ts     # 导出服务
│   └── routes/
│       └── stockLock.ts      # 路由
├── docs/
│   └── api-examples.sh       # curl示例脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 注意事项

1. **幂等性**: 释放接口必须传 `requestId`，避免重复处理
2. **异常处理**: 所有异常都会记录，保留原始输入便于排查
3. **人工审计**: 人工修正操作会记录在异常表中，留下操作痕迹
4. **业务友好**: 导出的报告使用中文描述，非技术人员也能看懂

## 交接清单

- [ ] 启动服务并测试健康检查
- [ ] 运行示例脚本验证完整流程
- [ ] 查看生成的报告文件格式
- [ ] 验证幂等性是否生效
- [ ] 测试异常场景处理
