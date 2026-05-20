# 公司法务合同印章管理系统

基于 Node.js + Express + SQLite 的合同印章管理追踪系统，支持批量导入、状态管理、操作审计和数据导出。

## 功能特性

### 核心功能
- **批次管理**：创建合同批次，批量导入CSV合同数据
- **合同管理**：支持按印章类型、授权人、快递单号查询
- **状态流转**：标记处理、退回修改、审批等状态
- **审计日志**：完整记录所有操作，包括：
  - 越权盖章记录
  - 补盖附件记录
  - 撤回重提记录
  - 操作原因、处理人、时间戳

### 查询与追溯
- 按印章类型查询历史
- 按授权人查询历史
- 按快递单号追溯合同来源

### 数据导出
- 支持导出明细数据
- 导出数量与查询结果一致
- CSV格式导出

## 技术栈

- **后端框架**: Express.js
- **数据库**: SQLite3
- **文件处理**: Multer
- **CSV解析**: csv-parser, json2csv

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 启动服务
```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## API 接口文档

### 健康检查
```
GET /api/health
```

### 批次管理

**创建批次**
```
POST /api/batches
Content-Type: application/json

{
  "name": "2024年第一批次合同",
  "applicant": "张三",
  "department": "法务部",
  "apply_date": "2024-01-15"
}
```

**获取所有批次**
```
GET /api/batches
```

**获取批次详情**
```
GET /api/batches/:id
```

**导入合同CSV**
```
POST /api/batches/:id/import-csv
Content-Type: multipart/form-data

csv: 文件
```

**更新批次状态**
```
PUT /api/batches/:id/status
Content-Type: application/json

{
  "status": "approved",
  "reason": "审核通过"
}
```

**退回修改**
```
POST /api/batches/:id/return
Content-Type: application/json

{
  "reason": "需要补充材料"
}
```

**导出批次数据**
```
GET /api/batches/:id/export
```

### 合同管理

**查询合同**
```
GET /api/contracts?seal_type=公章&authorizer=李四&express_no=SF123456789
```

**按快递单号追溯**
```
GET /api/contracts/trace?express_no=SF123456789
```

**获取合同详情**
```
GET /api/contracts/:id
```

**标记处理**
```
PUT /api/contracts/:id/process
Content-Type: application/json

{
  "remark": "已审核通过"
}
```

**退回修改**
```
POST /api/contracts/:id/return
Content-Type: application/json

{
  "reason": "合同条款需要修改"
}
```

**记录越权盖章**
```
POST /api/contracts/:id/unauthorized-seal
Content-Type: application/json

{
  "reason": "未经授权使用公章"
}
```

**记录补盖附件**
```
POST /api/contracts/:id/attachment-supplement
Content-Type: application/json

{
  "reason": "补充盖章附件"
}
```

**记录撤回重提**
```
POST /api/contracts/:id/withdraw-resubmit
Content-Type: application/json

{
  "reason": "内容有误，撤回修改后重新提交"
}
```

**导出明细**
```
GET /api/contracts/export/detail?seal_type=公章
```

### 印章规则

**创建印章规则**
```
POST /api/seal-rules
Content-Type: application/json

{
  "seal_type": "公章",
  "description": "公司公章使用规则",
  "authorized_persons": ["张三", "李四"],
  "max_amount": 1000000,
  "requires_attachment": true
}
```

**获取所有印章规则**
```
GET /api/seal-rules
```

**检查授权**
```
POST /api/seal-rules/check-authorization
Content-Type: application/json

{
  "seal_type": "公章",
  "authorizer": "张三",
  "amount": 500000
}
```

### 审计日志

**获取所有日志**
```
GET /api/audit-logs
```

**按合同ID获取日志**
```
GET /api/audit-logs/contract/:contractId
```

**按批次ID获取日志**
```
GET /api/audit-logs/batch/:batchId
```

**按操作类型获取日志**
```
GET /api/audit-logs/action/:actionType
```

## 数据模型

### batches (批次表)
- id: 主键
- batch_no: 批次编号
- name: 批次名称
- applicant: 申请人
- department: 部门
- apply_date: 申请日期
- status: 状态
- created_at, updated_at: 时间戳

### contracts (合同表)
- id: 主键
- batch_id: 批次ID
- contract_no: 合同编号
- contract_name: 合同名称
- party_a: 甲方
- party_b: 乙方
- amount: 金额
- seal_type: 印章类型
- authorizer: 授权人
- express_no: 快递单号
- metadata: 元数据(JSON)
- status: 状态
- remark: 备注
- created_at, updated_at: 时间戳

### seal_rules (印章规则表)
- id: 主键
- seal_type: 印章类型
- description: 描述
- authorized_persons: 授权人员(JSON)
- max_amount: 最大授权金额
- requires_attachment: 是否需要附件
- created_at: 时间戳

### audit_logs (审计日志表)
- id: 主键
- contract_id: 合同ID
- batch_id: 批次ID
- action_type: 操作类型
- action_reason: 操作原因
- handler: 处理人
- old_status: 旧状态
- new_status: 新状态
- created_at: 时间戳

## 请求头说明

所有接口支持通过 `x-handler` 请求头指定操作人，默认为 `system`。

```
x-handler: 张三
```

## 项目结构

```
zy70884/
├── src/
│   ├── app.js              # 主应用入口
│   ├── database/
│   │   ├── db.js           # 数据库连接
│   │   └── init.js         # 数据库初始化
│   ├── routes/
│   │   ├── batches.js      # 批次路由
│   │   ├── contracts.js    # 合同路由
│   │   ├── sealRules.js    # 印章规则路由
│   │   └── auditLogs.js    # 审计日志路由
│   └── services/
│       ├── batchService.js    # 批次服务
│       ├── contractService.js # 合同服务
│       ├── sealRuleService.js # 印章规则服务
│       ├── auditService.js    # 审计服务
│       ├── importService.js   # 导入服务
│       └── exportService.js   # 导出服务
├── data/                    # 数据库文件目录
├── uploads/                 # 上传文件临时目录
├── package.json
└── README.md
```

## 操作说明

### 完整流程示例

1. **创建印章规则**
   ```bash
   curl -X POST http://localhost:3000/api/seal-rules \
     -H "Content-Type: application/json" \
     -d '{
       "seal_type": "合同专用章",
       "description": "合同专用章使用规则",
       "authorized_persons": ["法务专员"],
       "max_amount": 500000,
       "requires_attachment": true
     }'
   ```

2. **创建批次**
   ```bash
   curl -X POST http://localhost:3000/api/batches \
     -H "Content-Type: application/json" \
     -H "x-handler: 法务助理" \
     -d '{
       "name": "2024年第一季度合同",
       "applicant": "张三",
       "department": "市场部",
       "apply_date": "2024-03-01"
     }'
   ```

3. **导入合同CSV**
   ```bash
   curl -X POST http://localhost:3000/api/batches/1/import-csv \
     -F "csv=@contracts.csv"
   ```

4. **标记处理**
   ```bash
   curl -X PUT http://localhost:3000/api/contracts/1/process \
     -H "Content-Type: application/json" \
     -H "x-handler: 法务经理" \
     -d '{"remark": "已审核，符合规定"}'
   ```

5. **查询追溯**
   ```bash
   curl "http://localhost:3000/api/contracts/trace?express_no=SF123456789"
   ```

6. **导出明细**
   ```bash
   curl "http://localhost:3000/api/contracts/export/detail?seal_type=合同专用章"
   ```
