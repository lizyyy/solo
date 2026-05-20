# 法务合同盖章排队 API 服务

## 项目简介

这是一个为公司法务助理使用的合同盖章排队管理系统 API 服务，支持材料提交、去重检测、状态管理、审计追溯和权限控制。

## 技术栈

- Node.js + Express + SQLite

## 核心功能

### 1. 材料提交与去重检测
- 支持批量提交合同材料
- 基于内容哈希去重，同一批材料重复提交时自动识别并返回已有记录

### 2. 字段校验与错误定位
- 必填字段验证
- 日期格式与逻辑校验
- 合同编号重复检测
- 错误明细精确定位到具体材料和字段

### 3. 任务状态管理
- pending: 待处理
- processing: 处理中
- failed: 处理失败
- manual_confirm: 人工确认
- exported: 已导出

### 4. 审计日志
- 记录所有修改操作
- 记录修改人、修改原因、修改前后值
- 支持按任务和材料查询历史

### 5. 数据追溯
- 从原始输入到最终报告的完整链路
- 保留原始提交数据JSON存储
- 完整的操作历史记录

### 6. 盖章类型与权限控制
- authorized: 授权盖章
- attachment: 补盖附件
- resubmit: 撤回重提
- 越权申请无法进入快递寄出环节

## 安装与运行

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

初始化后会创建以下默认用户:
- assistant1 (法务助理, ID: 1)
- reviewer1 (审核员, ID: 2)
- admin1 (管理员, ID: 3)
- courier1 (快递员, ID: 4)

### 3. 启动服务

```bash
npm start
```

开发模式 (自动重启):
```bash
npm run dev
```

服务运行在: http://localhost:3000

## API 文档

### 任务管理

#### 提交任务
```
POST /api/tasks
Content-Type: application/json

{
  "submitter_id": 1,
  "stamp_type": "authorized",
  "materials": [
    {
      "contract_no": "HT2024001",
      "contract_name": "采购合同",
      "party_a": "甲方公司",
      "party_b": "乙方公司",
      "sign_date": "2024-01-15",
      "amount": 100000.00,
      "page_count": 10,
      "is_authorized": true
    }
  ]
}
```

#### 获取任务列表
```
GET /api/tasks?status=processing&page=1&page_size=20
```

查询参数:
- status: 任务状态
- stamp_type: 盖章类型
- submitter_id: 提交人ID
- page: 页码
- page_size: 每页数量

#### 获取单个任务详情
```
GET /api/tasks/:taskId
```

#### 更新任务状态
```
PUT /api/tasks/:taskId/status
Content-Type: application/json

{
  "status": "exported",
  "operator_id": 2,
  "reason": "审核通过，已导出"
}
```

#### 发送到快递
```
POST /api/tasks/:taskId/courier
Content-Type: application/json

{
  "operator_id": 4
}
```

### 材料管理

#### 获取任务所有材料
```
GET /api/materials/task/:taskId
```

#### 获取单个材料详情
```
GET /api/materials/:materialId
```

#### 更新材料
```
PUT /api/materials/:materialId
Content-Type: application/json

{
  "updates": {
    "contract_name": "新合同名称",
    "status": "valid"
  },
  "operator_id": 2,
  "reason": "修正合同名称"
}
```

#### 获取验证摘要
```
GET /api/materials/task/:taskId/validation
```

#### 重新验证材料
```
POST /api/materials/:materialId/revalidate
Content-Type: application/json

{
  "operator_id": 2,
  "reason": "重新验证"
}
```

### 审计日志

#### 获取审计日志列表
```
GET /api/audit?task_id=1&page=1&page_size=20
```

查询参数:
- task_id: 任务ID
- material_id: 材料ID
- operator_id: 操作人ID
- action: 操作类型
- page: 页码
- page_size: 每页数量

#### 获取任务审计日志
```
GET /api/audit/task/:taskId
```

#### 获取材料审计日志
```
GET /api/audit/material/:materialId
```

#### 获取材料修改历史
```
GET /api/audit/material/:materialId/history
```

## 数据库结构

### users 表
用户信息

### tasks 表
任务信息，包含任务编号、批量哈希、提交人、状态、盖章类型等

### materials 表
合同材料信息，关联任务ID、材料索引、合同信息、原始数据JSON、验证错误等

### audit_logs 表
审计日志，记录所有操作

### permissions 表
权限配置表

## 项目结构

```
.
├── src/
│   ├── app.js              # 主应用入口
│   ├── database/
│   │   ├── index.js        # 数据库连接
│   │   ├── init.js         # 数据库初始化脚本
│   │   └── schema.js       # 数据库Schema
│   ├── models/
│   │   ├── Task.js         # 任务模型
│   │   ├── Material.js     # 材料模型
│   │   ├── AuditLog.js     # 审计日志模型
│   │   └── Permission.js   # 权限模型
│   ├── controllers/
│   │   ├── taskController.js
│   │   ├── materialController.js
│   │   └── auditController.js
│   └── routes/
│       ├── taskRoutes.js
│       ├── materialRoutes.js
│       └── auditRoutes.js
├── data/                   # SQLite数据库文件目录
├── package.json
└── README.md
```

## 注意事项

1. 所有状态变更都会记录到审计日志
2. 越权操作会被拦截并返回403错误
3. 重复提交的材料不会生成新记录
4. 原始数据会完整保留，支持后续审计追溯
5. 错误信息会精确定位到具体材料索引和字段
