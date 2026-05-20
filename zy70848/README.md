# 理赔内勤后端服务

## 项目简介

这是一个理赔内勤后端服务，用于处理材料清单CSV、保单JSON和规则表，生成可追踪的理赔记录。支持新增批次、标记处理、退回修改和导出明细功能。

## 核心功能

### 1. 数据导入
- 支持材料清单CSV导入
- 支持保单信息JSON导入
- 批次管理

### 2. 规则引擎自动审核
- **缺发票检测**: hasInvoice = 否
- **金额超限检测**: 金额 > 50000元
- **重复报案检测**: 同一案件号重复出现

### 3. 人工处理
- 批准通过
- 退回修改
- 要求补充材料
- 记录处理人和处理时间

### 4. 查询和导出
- 按案件号查询历史
- 按材料版本查询
- 按复核意见查询
- 导出CSV明细

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
npm run load-sample
```

### 4. 启动服务

```bash
npm start
```

开发模式（自动重启）:
```bash
npm run dev
```

## API 接口文档

### 批次管理

#### 创建批次
```
POST /api/batches
Content-Type: application/json

{
  "batchName": "2024年5月第一批次",
  "materialVersion": "v2024.05",
  "handler": "理赔内勤-李主管"
}
```

#### 导入数据
```
POST /api/batches/{batchId}/import
Content-Type: multipart/form-data

materialCSV: 材料清单CSV文件
policyJSON: 保单JSON文件
```

#### 执行规则审核
```
POST /api/batches/{batchId}/process
Content-Type: application/json

{
  "handler": "理赔内勤-李主管"
}
```

#### 查询所有批次
```
GET /api/batches
```

### 案件处理

#### 查询案件记录
```
GET /api/claims?caseNo=&materialVersion=&reviewOpinion=&status=&batchId=
```

参数说明：
- caseNo: 案件号（模糊匹配）
- materialVersion: 材料版本（模糊匹配）
- reviewOpinion: 复核意见（模糊匹配）
- status: 状态（精确匹配）
- batchId: 批次ID

#### 导出CSV
```
GET /api/claims/export/csv?caseNo=&materialVersion=&reviewOpinion=&status=&batchId=
```

#### 查看处理日志
```
GET /api/claims/{recordId}/logs
```

#### 批准通过
```
POST /api/claims/{recordId}/approve
Content-Type: application/json

{
  "handler": "复核专员-王经理",
  "reviewOpinion": "人工审核通过"
}
```

#### 退回修改
```
POST /api/claims/{recordId}/return
Content-Type: application/json

{
  "handler": "复核专员-王经理",
  "reviewOpinion": "材料不完整，退回补充"
}
```

#### 要求补充材料
```
POST /api/claims/{recordId}/request-materials
Content-Type: application/json

{
  "handler": "复核专员-王经理",
  "reviewOpinion": "缺少医疗发票原件"
}
```

#### 统计汇总
```
GET /api/claims/statistics/summary
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| auto_approved | 自动审核通过 |
| needs_manual_review | 需要人工复核 |
| approved | 人工审核通过 |
| returned | 退回修改 |
| needs_materials | 需补充材料 |

## 项目结构

```
.
├── src/
│   ├── app.js              # 主应用入口
│   ├── models/
│   │   └── database.js     # 数据库连接
│   ├── routes/
│   │   ├── batches.js      # 批次管理路由
│   │   └── claims.js       # 案件处理路由
│   └── services/
│       ├── importService.js  # 数据导入服务
│       ├── ruleEngine.js   # 规则引擎服务
│       └── claimService.js # 案件处理服务
├── data/
│   ├── sample_materials.csv  # 样例材料清单
│   └── sample_policies.json  # 样例保单数据
├── uploads/              # 文件上传目录
├── scripts/
│   ├── init-db.js         # 数据库初始化脚本
│   └── load-sample-data.js # 样例数据加载脚本
└── package.json
```

## 样例数据说明

样例数据包含6条记录，涵盖各种异常情况：

| 案件号 | 异常类型 | 说明 |
|--------|----------|------|
| CASE-2024-001 | 重复报案 | 同一案件号出现2次 |
| CASE-2024-002 | 金额超限 | 65000元 > 50000元限额 |
| CASE-2024-003 | 缺少发票 | hasInvoice = 否 |
| CASE-2024-004 | - | 自动通过 |
| CASE-2024-005 | 金额超限 | 85000元 > 50000元限额 |
| CASE-2024-001 | 重复报案 | 第2次报案记录 |

## 技术栈

- Node.js + Express
- SQLite 数据库
- CSV/JSON 解析
- RESTful API

## 注意事项

1. 数据库文件保存在 `data/claims.db`
2. 重启服务后数据不会丢失
3. 所有处理操作都会记录处理人、时间和原因
4. 导出数量与查询结果数量一致
