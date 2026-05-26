# 设备租赁客服后端服务

## 项目简介

设备租赁客服后端服务，用于处理租赁 CSV、维修 JSON、押金规则数据，生成可追踪的租赁记录。支持新增批次、标记处理、退回修改、导出明细等功能，并能自动检测逾期租金、维修责任、重复扣款等异常情况。

## 核心功能

- **批次管理**: 创建租赁批次，批量导入数据
- **数据导入**: 支持租赁 CSV、维修 JSON、押金规则导入
- **异常检测**: 自动识别逾期租金、客户责任维修、重复扣款
- **记录处理**: 标记处理通过、退回修改
- **操作追踪**: 记录所有操作的原因、处理人和时间
- **多条件查询**: 按设备序列号、租期、押金流水查询历史记录
- **数据导出**: 导出查询结果为 CSV，数量与查询一致

## 技术栈

- Node.js + Express
- SQLite3 数据库
- csv-parser / json2csv 数据处理
- multer 文件上传

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 加载样例数据

```bash
npm run sample
```

### 4. 启动服务

```bash
npm start
```

服务运行在: http://localhost:3000

健康检查: http://localhost:3000/health

### 5. 运行 API 测试

```bash
node src/scripts/test-api.js
```

## API 接口文档

### 批次管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/rentals/batches | 创建新批次 |
| GET | /api/rentals/batches | 获取所有批次 |
| GET | /api/rentals/batches/:batch_id | 获取批次详情 |

**创建批次请求体:**
```json
{
  "batch_name": "2024年5月结算批次",
  "total_count": 100,
  "operator": "张三"
}
```

### 数据导入

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/rentals/import/rental-csv | 导入租赁 CSV 文件 |
| POST | /api/rentals/import/repair-json | 导入维修 JSON 数据 |
| POST | /api/rentals/import/deposit-rules | 导入押金规则 |

**导入租赁 CSV (multipart/form-data):**
- file: CSV 文件
- batch_id: 批次 ID
- operator: 操作人

CSV 格式:
```csv
device_serial,device_name,customer_name,customer_phone,rental_start_date,rental_end_date,daily_rate,deposit_amount,deposit_flow_id,total_rental_fee,actual_payment,actual_return_date
EQ-2024-001,高空作业车-20米,张三,13800138001,2024-05-01,2024-05-10,500.00,5000.00,DEP-001,5000.00,5000.00,2024-05-10
```

**导入维修 JSON 请求体:**
```json
{
  "repairs": [
    {
      "device_serial": "EQ-2024-001",
      "repair_type": "机械故障",
      "repair_description": "液压油管破裂",
      "repair_cost": 1500.00,
      "is_customer_fault": true,
      "fault_reason": "客户操作不当",
      "report_date": "2024-05-16",
      "repair_date": "2024-05-17"
    }
  ]
}
```

**导入押金规则请求体:**
```json
{
  "rules": [
    {
      "device_type": "高空作业车",
      "device_model": "20米",
      "deposit_amount": 5000.00,
      "overdue_rate": 0.1
    }
  ]
}
```

### 记录处理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/rentals/:id/process | 标记处理 |
| POST | /api/rentals/:id/return | 退回修改 |
| GET | /api/rentals/:id/details | 获取记录详情 |

**标记处理请求体:**
```json
{
  "operator": "李审核员",
  "reason": "租期正常，费用无误",
  "status": "approved"
}
```

**退回修改请求体:**
```json
{
  "operator": "李主管",
  "reason": "存在客户责任维修费用，需要客户确认"
}
```

### 查询与导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/rentals/search | 多条件查询 |
| GET | /api/rentals/export | 导出为 CSV |
| GET | /api/rentals/device/:serial | 按设备序列号查询 |
| GET | /api/rentals/deposit-flow/:flow_id | 按押金流水查询 |

**查询参数:**
- device_serial: 设备序列号（模糊匹配）
- customer_name: 客户名称（模糊匹配）
- status: 状态 (pending/approved/returned)
- batch_id: 批次 ID
- rental_start_date: 起租日期（>=）
- rental_end_date: 到期日期（<=）

### 异常管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/rentals/exceptions/unresolved | 获取未解决异常 |
| POST | /api/rentals/exceptions/:id/resolve | 解决异常 |

**解决异常请求体:**
```json
{
  "operator": "王主管",
  "resolution_note": "已与客户确认，从押金中扣除维修费用"
}
```

### 基础数据

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/rentals/deposit-rules | 获取押金规则 |
| GET | /api/rentals/repairs | 获取维修记录 |
| GET | /api/rentals/operation-logs | 获取操作日志 |

## 样例数据说明

运行 `npm run sample` 后会创建以下测试数据：

- **10 条租赁记录**: 包含正常、逾期、重复扣款等场景
- **3 条维修记录**: 其中 2 条为客户责任
- **9 条押金规则**: 覆盖常见设备类型
- **操作日志**: EQ-2024-001 已通过，EQ-2024-002 已退回

### 典型场景示例

**EQ-2024-002 (挖掘机-PC200)**:
- 租期: 2024-05-05 至 2024-05-15
- 实际归还: 2024-05-18（逾期 3 天）
- 异常: 客户责任维修 ¥1500，逾期费用 ¥2400
- 状态: 退回修改（需要客户确认维修费用）

**EQ-2024-003 (压路机-20吨)**:
- 异常: 重复扣款 ¥500（实收 ¥6500，应收 ¥6000）
- 状态: 待处理

**EQ-2024-006 (高空作业车-20米)**:
- 租期: 2024-05-18 至 2024-05-28
- 实际归还: 2024-05-30（逾期 2 天）
- 异常: 客户责任维修 ¥600，逾期费用 ¥1000

## 目录结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── controllers/
│   │   └── RentalController.js # 控制器
│   ├── models/                # 数据模型
│   │   ├── RentalModel.js
│   │   ├── RepairModel.js
│   │   ├── DepositRuleModel.js
│   │   ├── OperationLogModel.js
│   │   ├── BatchModel.js
│   │   └── ExceptionModel.js
│   ├── routes/
│   │   └── rental.js          # 路由定义
│   ├── services/
│   │   └── RentalService.js   # 业务逻辑
│   └── scripts/
│       ├── init-db.js         # 数据库初始化
│       ├── load-sample.js     # 加载样例数据
│       └── test-api.js        # API 测试脚本
├── sample-data/               # 样例数据文件
│   ├── rental_sample.csv
│   ├── repair_sample.json
│   └── deposit_rules.json
├── data/                      # SQLite 数据库目录
├── uploads/                   # 上传文件目录
└── package.json
```

## 数据库表结构

### rental_records (租赁记录表)
存储租赁基本信息，包括设备、客户、租期、费用、状态等。

### repair_records (维修记录表)
存储设备维修信息，关联租赁记录，标记客户责任。

### deposit_rules (押金规则表)
存储不同设备类型的押金标准和逾期费率。

### operation_logs (操作日志表)
记录所有状态变更，包括操作类型、操作人、原因、时间。

### batches (批次表)
管理数据导入批次，跟踪处理进度。

### exceptions (异常表)
存储检测到的异常（逾期、维修责任、重复扣款）及处理状态。
