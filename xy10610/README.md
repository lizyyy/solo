# 跨境包裹清关异常管理系统

全栈 Web 应用，用于管理跨境包裹清关流程，包含申报品类、税费试算、海关回调、补资料工单、退单重报等功能。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + React Router
- **数据导出**: CSV/JSON
- **特性**: 幂等性处理、事件时间线、批量导入

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 生成演示数据

系统内置四条演示路径：

```bash
npm run seed
```

演示路径说明：
- **清关成功**: DEMO-SUCCESS-001，包含税费计算和海关成功回调
- **清关拦截**: DEMO-BLOCKED-001，需要补资料，生成工单
- **人工修正**: DEMO-CORRECT-001，退单重提，等待审核
- **重复提交**: DEMO-DUPLICATE-001，幂等性演示

### 4. 启动应用

#### 开发模式（前后端同时启动）

```bash
npm run dev
```

#### 生产模式

```bash
# 先构建前端
cd client
npm run build
cd ..

# 启动后端
npm start
```

### 5. 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:3001

## 功能模块

### 1. 包裹管理

- 包裹列表查询（支持状态、运单号筛选）
- 包裹详情查看
- 申报品类管理
- 数据导出（CSV/JSON）

### 2. 税费试算

- 根据商品品类自动计算税费
- 支持品类：一般商品、电子产品、奢侈品、食品、化妆品
- 税率规则：关税 + 增值税 + 消费税

### 3. 海关回调

- 多种回调类型：清关成功、清关失败、需补资料、税费调整、需查验、已退单
- 自动更新包裹状态
- 自动触发后续流程（生成工单、生成重提申请）

### 4. 补资料工单

- 工单列表查询
- 工单状态更新
- 工单优先级升级
- 操作日志记录

### 5. 退单重提

- 重提申请列表
- 审核流程（通过/拒绝）
- 审核后自动更新包裹状态

### 6. 批量导入

- CSV 文件导入
- 下载导入模板
- 导入结果统计和错误详情

### 7. 幂等性处理

- 支持 `X-Idempotency-Key` 请求头
- 相同请求内容重复提交返回缓存结果
- 请求内容不一致时返回冲突错误

## API 接口文档

### 包裹接口

#### 获取包裹列表
```
GET /api/packages?status=&tracking_number=&page=1&limit=10
```

#### 获取包裹详情
```
GET /api/packages/:id
```

#### 创建包裹
```
POST /api/packages
Content-Type: application/json

{
  "tracking_number": "TEST001",
  "sender_name": "Zhang Wei",
  "sender_country": "China",
  "receiver_name": "John Smith",
  "receiver_address": "123 Main St",
  "weight": 2.5,
  "declared_value": 150.00,
  "currency": "USD",
  "declaration_items": [...]
}
```

#### 更新包裹状态
```
PUT /api/packages/:id/status
Content-Type: application/json

{
  "status": "cleared",
  "operator": "admin",
  "reason": "清关完成"
}
```

### 税费接口

#### 计算税费
```
POST /api/tax/calculate/:packageId
Content-Type: application/json

{
  "category": "electronics",
  "operator": "system"
}
```

### 海关回调接口

#### 发送海关回调
```
POST /api/customs/callback/:packageId
Content-Type: application/json

{
  "callback_type": "document_required",
  "status": "blocked",
  "message": "需要补充商业发票",
  "customs_reference": "CUS-REF-001",
  "callback_data": {
    "required_docs": ["商业发票", "原产地证明"],
    "failure_reason": "INCOMPLETE_DOCUMENTS"
  }
}
```

#### 获取回调类型列表
```
GET /api/customs/types
```

### 工单接口

#### 获取工单列表
```
GET /api/tickets?status=&priority=&page=1&limit=10
```

#### 更新工单状态
```
PUT /api/tickets/:id/status
Content-Type: application/json

{
  "status": "resolved",
  "operator": "admin",
  "notes": "资料已补充"
}
```

#### 升级工单优先级
```
POST /api/tickets/:id/escalate
Content-Type: application/json

{
  "operator": "admin",
  "reason": "客户紧急"
}
```

### 重提接口

#### 获取重提申请列表
```
GET /api/resubmit?review_status=&page=1&limit=10
```

#### 审核重提申请
```
PUT /api/resubmit/:id/review
Content-Type: application/json

{
  "review_status": "approved",
  "reviewed_by": "admin",
  "notes": "同意重提"
}
```

### 导出接口

#### 导出包裹
```
GET /api/export/packages?status=&format=csv
```

#### 导出工单
```
GET /api/export/tickets
```

#### 获取时间线
```
GET /api/export/timeline/:packageId
```

### 导入接口

#### 批量导入包裹
```
POST /api/import/packages
Content-Type: multipart/form-data

file: <CSV文件>
```

### 健康检查

```
GET /api/health
```

## 状态流转

### 包裹状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| supplement_required | 需补资料 |
| supplement_completed | 资料已补 |
| tax_adjusted | 税费已调整 |
| cleared | 已清关 |
| returned | 已退单 |
| resubmitted | 已重提 |
| failed | 清关失败 |

### 工单状态

| 状态 | 说明 |
|------|------|
| open | 待处理 |
| resolved | 已完成 |

### 重提审核状态

| 状态 | 说明 |
|------|------|
| pending | 待审核 |
| approved | 已通过 |
| rejected | 已拒绝 |

## 数据库结构

主要数据表：

- `packages` - 包裹信息
- `declaration_items` - 申报品类明细
- `tax_calculations` - 税费计算记录
- `customs_callbacks` - 海关回调记录
- `supplement_tickets` - 补资料工单
- `re_submissions` - 退单重提申请
- `service_templates` - 客服话术模板
- `operation_logs` - 操作日志
- `idempotency_keys` - 幂等键存储

## 使用说明

### 1. 查看演示数据

1. 启动应用后，访问 http://localhost:3000
2. 在包裹列表中可以看到四条演示数据
3. 点击运单号查看详情，包含申报品类、税费、回调记录、工单、时间线等

### 2. 测试工单流程

1. 进入"补资料工单"页面
2. 可以看到 DEMO-BLOCKED-001 生成的工单
3. 点击"完成"按钮标记工单已处理
4. 查看包裹详情确认状态已更新

### 3. 测试重提审核

1. 进入"退单重提"页面
2. 可以看到 DEMO-CORRECT-001 的重提申请
3. 点击"通过"或"拒绝"进行审核
4. 查看包裹详情确认状态已更新

### 4. 测试批量导入

1. 进入"批量导入"页面
2. 点击"下载模板"获取 CSV 模板
3. 填写数据后上传文件
4. 查看导入结果和错误详情

### 5. 导出报告

1. 在包裹列表或工单列表页面
2. 点击"导出"按钮
3. 支持导出 CSV 或 JSON 格式

## 项目结构

```
.
├── package.json
├── README.md
├── server/
│   ├── index.js              # 服务入口
│   ├── db/
│   │   ├── schema.sql        # 数据库 schema
│   │   ├── database.js       # 数据库连接
│   ├── routes/               # API 路由
│   │   ├── packages.js
│   │   ├── tax.js
│   │   ├── customs.js
│   │   ├── tickets.js
│   │   ├── resubmit.js
│   │   ├── export.js
│   │   └── import.js
│   ├── middleware/
│   │   └── idempotency.js    # 幂等性中间件
│   └── scripts/
│       ├── initDB.js         # 数据库初始化
│       └── seedData.js       # 演示数据生成
└── client/
    ├── package.json
    ├── public/
    └── src/
        ├── index.js
        ├── App.js
        ├── App.css
        ├── components/
        │   └── Layout.js
        └── pages/
            ├── PackagesPage.js
            ├── PackageDetailPage.js
            ├── TicketsPage.js
            ├── ResubmitPage.js
            └── ImportPage.js
```

## 开发说明

- 数据库文件位于 `server/db/customs.db`
- 所有数据操作均有操作日志记录
- 重启应用后数据不会丢失
- 时间线功能按时间顺序展示所有相关事件

## License

MIT
