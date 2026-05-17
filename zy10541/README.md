# 合同条款生效API

本地可启动的合同条款生效管理系统，专注于状态追踪、历史留存和证据导出。

## 核心特性

- **版本生效管理**：条款版本递进生效机制
- **服务范围校验**：确保服务范围的合法性与完整性
- **同步状态追踪**：业务系统同步状态与重试记录
- **异常留存机制**：异常路径保留原始输入和处理依据
- **人工修正流程**：支持人工介入修正异常状态
- **生效报告导出**：导出完整生效证据链

## 数据模型

- **合同基本信息**：合同编号、客户名称、合同类型
- **条款版本**：版本号、生效日期、价格、服务范围
- **同步记录**：同步时间、目标系统、状态、响应内容
- **生效报告**：完整证据链、导出时间、格式

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init
```

### 3. 启动服务

```bash
npm start
```

服务启动在: http://localhost:3000

## API 接口

### 创建合同条款

```bash
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "HT202405001",
    "customerName": "XX科技有限公司",
    "contractType": "SERVICE",
    "version": "v1.0",
    "effectiveDate": "2024-06-01",
    "price": 50000,
    "serviceScope": ["云服务器", "对象存储", "CDN加速"],
    "createdBy": "admin"
  }'
```

### 查询合同详情

```bash
curl http://localhost:3000/api/contracts/HT202405001
```

### 状态推进 - 提交审核

```bash
curl -X POST http://localhost:3000/api/contracts/HT202405001/status \
  -H "Content-Type: application/json" \
  -d '{
    "action": "SUBMIT",
    "operator": "manager",
    "comment": "条款核对无误，提交审核"
  }'
```

### 触发业务系统同步

```bash
curl -X POST http://localhost:3000/api/contracts/HT202405001/sync \
  -H "Content-Type: application/json" \
  -d '{
    "targetSystem": "BUSINESS_CENTER",
    "operator": "system"
  }'
```

### 人工修正异常

```bash
curl -X POST http://localhost:3000/api/contracts/HT202405001/correct \
  -H "Content-Type: application/json" \
  -d '{
    "correctionType": "PRICE_ADJUST",
    "oldValue": 50000,
    "newValue": 55000,
    "reason": "补充条款确认价格上调5%",
    "operator": "finance_manager",
    "approvalDoc": "审批单号:SP202405012"
  }'
```

### 导出生效报告

```bash
# JSON格式
curl http://localhost:3000/api/contracts/HT202405001/export?format=json

# CSV格式
curl http://localhost:3000/api/contracts/HT202405001/export?format=csv -o report.csv
```

### 查询合同列表

```bash
curl http://localhost:3000/api/contracts
```

## 异常路径示例

### 被拦截的异常：服务范围不匹配

当服务范围包含不合法项时，系统会拦截并留存完整异常记录：

```bash
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "HT202405999",
    "customerName": "测试公司",
    "version": "v1.0",
    "effectiveDate": "2024-06-01",
    "price": -1000,
    "serviceScope": ["非法服务"],
    "createdBy": "test"
  }'
```

**异常记录留存内容**：
- 原始请求输入完整保留
- 校验失败具体原因
- 处理依据（业务规则编号）
- 异常时间戳与请求ID
- 可通过 `/api/exceptions` 查询

### 查询异常记录

```bash
curl http://localhost:3000/api/exceptions
```

## 状态流转

```
DRAFT(草稿) → SUBMITTED(已提交) → REVIEWED(已审核) → SYNCING(同步中) → EFFECTIVE(已生效)
                              ↓
                          EXCEPTION(异常) → CORRECTED(已修正)
```

## 目录结构

```
├── src/
│   ├── server.js          # 服务入口
│   ├── models/            # 数据模型
│   ├── services/          # 业务逻辑
│   ├── routes/            # API路由
│   └── utils/             # 工具函数
├── data/                  # 数据存储
├── scripts/               # 初始化脚本
└── README.md
```