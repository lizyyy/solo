# 社区团购缺货补偿 API

一个完整的社区团购缺货补偿管理系统，提供 REST API、本地持久化和完整的业务流程。

## 功能特性

### 核心数据模型
- **团购批次 (GroupBuyBatch)**: 管理团购活动批次
- **订单明细 (OrderItem)**: 用户订单记录
- **缺货商品 (OutOfStockItem)**: 缺货商品登记和状态管理
- **补偿方案 (CompensationPlan)**: 三种补偿方式：退款、换货、积分补偿
- **用户确认 (UserConfirmation)**: 用户确认记录，支持幂等性
- **状态历史 (StatusHistory)**: 完整的状态变更记录
- **异常日志 (ExceptionLog)**: 异常拦截和原始请求存储
- **结算报告 (SettlementReport)**: CSV 导出和统计汇总
- **库存日志 (InventoryLog)**: 库存回写和变更记录

### 核心业务规则
1. **缺货分摊算法**: 按订单比例自动分摊缺货数量
2. **状态机流转**: pending → allocating → user_confirming → confirmed → completed
3. **用户确认幂等性**: 使用 idempotencyKey 保证重复提交安全
4. **状态自动推进**: 所有用户确认完成后自动推进到 confirmed 状态
5. **人工修正功能**: 支持管理员人工修改缺货数据
6. **异常拦截记录**: 所有异常自动记录原始请求和处理结论
7. **库存回写**: 标记完成时自动回写可用库存
8. **结算报告导出**: 自动生成 CSV 格式结算报表

## 快速开始

### 安装依赖
```bash
npm install
```

### 初始化测试数据
```bash
npm run seed
```

### 运行综合测试
```bash
npm run test
```

### 启动开发服务器
```bash
npm run dev
```

### 启动生产服务器
```bash
npm run build && npm start
```

## API 接口文档

### 基础信息
- **Base URL**: `http://localhost:3000`
- **Health Check**: `GET /health`

### 缺货商品管理

#### 创建缺货商品
```bash
POST /api/out-of-stock/items
Content-Type: application/json

{
  "productId": "P001",
  "productName": "有机蔬菜套餐",
  "orderedQuantity": 6,
  "availableQuantity": 2,
  "unitPrice": 99.0,
  "batchId": "批次-UUID",
  "remark": "供应商缺货"
}
```

#### 获取缺货商品列表
```bash
GET /api/out-of-stock/items?batchId={batchId}
```

#### 获取缺货商品详情
```bash
GET /api/out-of-stock/items/{id}
```

#### 启动缺货分摊
```bash
POST /api/out-of-stock/items/{id}/allocate
```

#### 人工修改缺货商品
```bash
PUT /api/out-of-stock/items/{id}/manual
Content-Type: application/json

{
  "updates": {
    "availableQuantity": 3,
    "remark": "补货完成"
  },
  "operatorId": "ADMIN001",
  "operatorName": "系统管理员"
}
```

#### 标记完成
```bash
POST /api/out-of-stock/items/{id}/complete
Content-Type: application/json

{
  "operatorId": "ADMIN001",
  "operatorName": "系统管理员"
}
```

#### 取消缺货商品
```bash
POST /api/out-of-stock/items/{id}/cancel
Content-Type: application/json

{
  "reason": "用户取消订单",
  "operatorId": "ADMIN001",
  "operatorName": "系统管理员"
}
```

### 补偿方案管理

#### 获取补偿方案列表
```bash
GET /api/out-of-stock/items/{outOfStockItemId}/plans
```

#### 修改补偿类型
```bash
PUT /api/out-of-stock/plans/{planId}/type
Content-Type: application/json

{
  "compensationType": "refund",  // refund | exchange | points
  "exchangeDetails": {           // 换货时需要
    "productId": "P003",
    "productName": "替代商品",
    "quantity": 1,
    "price": 89.0
  },
  "pointsAmount": 1000           // 积分补偿时需要
}
```

### 用户确认

#### 确认补偿方案
```bash
POST /api/out-of-stock/confirmations/confirm
Content-Type: application/json

{
  "idempotencyKey": "幂等Key",
  "userId": "U001",
  "userRemark": "同意退款"
}
```

#### 拒绝补偿方案
```bash
POST /api/out-of-stock/confirmations/reject
Content-Type: application/json

{
  "idempotencyKey": "幂等Key",
  "userId": "U001",
  "userRemark": "不同意，要求换货"
}
```

### 结算报告

#### 生成结算报告
```bash
POST /api/out-of-stock/settlement
Content-Type: application/json

{
  "batchId": "批次-UUID",
  "generatedBy": "ADMIN001"
}
```

#### 获取结算报告列表
```bash
GET /api/out-of-stock/settlement?batchId={batchId}
```

### 异常日志管理

#### 获取异常日志
```bash
GET /api/out-of-stock/exceptions?isResolved={true|false}
```

#### 标记异常已解决
```bash
PUT /api/out-of-stock/exceptions/{id}/resolve
Content-Type: application/json

{
  "resolvedBy": "ADMIN001",
  "handlingConclusion": "已联系用户解决"
}
```

## 验收测试用例

### 测试 1: 正常创建缺货商品
- 请求: POST /api/out-of-stock/items
- 预期: 返回 201，状态为 pending，缺货数量正确计算

### 测试 2: 重复提交（幂等性）
- 请求: 重复创建相同商品（相同 productId + batchId）
- 预期: 返回已存在的记录，不创建新数据

### 测试 3: 异常拦截
- 请求: 对无效 ID 调用 startAllocation
- 预期: 返回错误，异常日志自动记录原始请求

### 测试 4: 人工修正
- 请求: PUT /api/out-of-stock/items/{id}/manual
- 预期: 数据更新成功，状态历史记录操作人

### 测试 5: 完整流程 + 结算导出
- 创建缺货 → 启动分摊 → 用户确认 → 生成报告
- 预期: 状态流转正确，CSV 报告数据准确

## 项目结构

```
src/
├── config/
│   └── database.ts          # 数据库配置
├── entities/
│   ├── GroupBuyBatch.ts     # 团购批次实体
│   ├── OrderItem.ts         # 订单明细实体
│   ├── OutOfStockItem.ts    # 缺货商品实体
│   ├── CompensationPlan.ts  # 补偿方案实体
│   ├── UserConfirmation.ts  # 用户确认实体
│   ├── StatusHistory.ts     # 状态历史实体
│   ├── ExceptionLog.ts      # 异常日志实体
│   ├── SettlementReport.ts  # 结算报告实体
│   └── InventoryLog.ts      # 库存日志实体
├── services/
│   ├── StateMachineService.ts      # 状态机服务
│   ├── AllocationService.ts        # 缺货分摊服务
│   ├── UserConfirmationService.ts  # 用户确认服务
│   ├── OutOfStockService.ts        # 缺货商品服务
│   ├── SettlementService.ts        # 结算报告服务
│   ├── ExceptionLogService.ts      # 异常日志服务
│   └── InventoryService.ts         # 库存服务
├── controllers/
│   └── outOfStockController.ts     # API 控制器
├── routes/
│   └── outOfStockRoutes.ts         # 路由定义
├── middleware/
│   └── errorHandler.ts             # 错误处理中间件
├── scripts/
│   ├── seed.ts             # 数据初始化脚本
│   └── test-all.ts         # 综合测试脚本
└── index.ts                # 应用入口
```

## 技术栈

- **Node.js**: 运行环境
- **Express**: Web 框架
- **TypeScript**: 类型安全
- **TypeORM**: ORM 框架
- **SQLite**: 本地数据库
- **csv-writer**: CSV 导出

## 数据存储

- 数据库文件: `data/compensation.db`
- CSV 导出目录: `data/exports/`
