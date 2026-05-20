# 档案室管理系统后端服务

## 功能概述

档案室管理系统，支持借阅CSV、案件JSON、人员权限表导入生成可追踪记录。提供新增批次、标记处理、退回修改、导出明细等接口。超期催还、涉密案件、续借上限等边界情况自动记录原因、处理人和时间。重启服务后支持按案件密级、借阅人、审批意见查询历史，导出数量与查询结果一致。

## 技术栈

- **运行环境**: Node.js 16+
- **Web框架**: Express.js
- **数据库**: MongoDB
- **数据格式**: CSV、JSON
- **核心依赖**: mongoose, multer, csv-parser, json2csv, dotenv, moment

## 快速开始

### 环境要求

- Node.js 16.0+
- MongoDB 4.0+

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

配置项说明：
- `PORT`: 服务端口，默认 3000
- `MONGODB_URI`: MongoDB连接地址
- `NODE_ENV`: 运行环境 development/production
- `MAX_RENEW_TIMES`: 最大续借次数
- `OVERDUE_DAYS`: 超期天数阈值

### 启动MongoDB

确保MongoDB服务已启动：

```bash
# macOS (使用Homebrew)
brew services start mongodb-community

# 或使用Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 启动服务

```bash
# 开发模式 (需要nodemon)
npm run dev

# 生产模式
npm start
```

服务启动后访问: `http://localhost:3000/api/health`

## 项目结构

```
archive-management-system/
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库连接配置
│   ├── models/                # 数据模型
│   │   ├── BorrowRecord.js    # 借阅记录模型（核心）
│   │   ├── Batch.js           # 批次模型
│   │   ├── Case.js            # 案件信息模型
│   │   └── UserPermission.js  # 人员权限模型
│   ├── controllers/           # 业务控制器
│   │   ├── borrowController.js # 借阅管理控制器
│   │   ├── importController.js # 数据导入控制器
│   │   └── queryController.js  # 查询统计控制器
│   ├── routes/                # 路由
│   │   └── index.js           # 主路由
│   └── utils/                 # 工具函数
│       └── helpers.js         # 辅助函数
├── examples/                  # 示例数据
│   ├── cases.json             # 案件示例数据
│   ├── borrow.csv             # 借阅示例数据
│   └── permissions.csv        # 权限示例数据
├── uploads/                   # 文件上传目录（自动创建）
├── .env                       # 环境变量
├── .env.example               # 环境变量示例
├── package.json               # 项目配置
└── README.md                  # 项目说明
```

## API接口说明

### 1. 健康检查

```
GET /api/health
```

### 2. 数据导入接口

#### 2.1 导入借阅CSV

```
POST /api/import/borrow-csv
Content-Type: multipart/form-data
Body: file=xxx.csv, operator=管理员姓名
```

#### 2.2 导入案件JSON

```
POST /api/import/case-json
Content-Type: multipart/form-data
Body: file=xxx.json
```

#### 2.3 导入人员权限CSV

```
POST /api/import/permission-csv
Content-Type: multipart/form-data
Body: file=xxx.csv
```

### 3. 批次管理接口

#### 3.1 创建批次

```
POST /api/batch/create
Content-Type: application/json
{
  "batchName": "批次名称",
  "batchType": "借阅申请",
  "description": "批次描述",
  "recordIds": ["REC_xxx", "REC_yyy"],
  "operator": "管理员"
}
```

#### 3.2 查询批次列表

```
GET /api/batch/list?status=处理中&page=1&limit=20
```

### 4. 借阅管理接口

#### 4.1 标记处理完成

```
POST /api/borrow/mark-processed
Content-Type: application/json
{
  "recordId": "REC_xxx",
  "operator": "管理员",
  "operatorId": "ADMIN001",
  "comment": "材料齐全，予以借出"
}
```

#### 4.2 退回修改/要求补材料

```
POST /api/borrow/return-modify
Content-Type: application/json
{
  "recordId": "REC_xxx",
  "operator": "管理员",
  "operatorId": "ADMIN001",
  "reason": "借阅申请表缺失签字",
  "readableReason": "借阅申请表需要借阅人签字确认",
  "requireMaterials": true
}
```

#### 4.3 审批放行（涉密案件）

```
POST /api/borrow/approve-release
Content-Type: application/json
{
  "recordId": "REC_xxx",
  "operator": "审批人",
  "operatorId": "ADMIN001",
  "comment": "经审批符合借阅条件"
}
```

#### 4.4 发送超期催还

```
POST /api/borrow/overdue-reminder
Content-Type: application/json
{
  "recordId": "REC_xxx",
  "operator": "管理员"
}
```

#### 4.5 办理续借

```
POST /api/borrow/renew
Content-Type: application/json
{
  "recordId": "REC_xxx",
  "operator": "管理员",
  "renewDays": 30
}
```

#### 4.6 查询记录详情

```
GET /api/borrow/detail/:recordId
```

#### 4.7 导出明细

```
POST /api/borrow/export?format=json
Content-Type: application/json
{
  "securityLevel": "机密",
  "borrowerName": "张三",
  "status": "已借出",
  "isOverdue": true
}
```

### 5. 查询接口

#### 5.1 历史记录查询（支持多条件）

```
POST /api/query/history
Content-Type: application/json
{
  "securityLevel": ["机密", "绝密"],
  "borrowerName": "张三",
  "approvalComment": "同意",
  "status": "已借出",
  "isOverdue": true,
  "isSecretCase": true,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "page": 1,
  "limit": 20
}
```

#### 5.2 获取统计数据

```
GET /api/query/statistics
```

#### 5.3 查询操作日志

```
POST /api/query/operation-logs
Content-Type: application/json
{
  "action": "超期催还",
  "operator": "管理员",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

## 核心特性

### 1. 可追踪记录

每条借阅记录包含完整的操作历史：
- 操作类型（提交、审批通过、退回修改、借出、续借、归还、超期催还、涉密拦截、放行、要求补材料）
- 处理人
- 原因代码
- 可读说明
- 时间戳

### 2. 边界情况自动处理

- **超期催还**: 自动计算超期天数，生成可读的超期说明
- **涉密案件检查**: 自动识别涉密案件，比对借阅人权限，权限不足时标记需要特殊审批
- **续借上限控制**: 限制最大续借次数，达到上限时阻止续借并给出说明

### 3. 多维度查询

支持按以下条件查询历史记录：
- 案件密级（公开/内部/秘密/机密/绝密）
- 借阅人姓名/ID
- 审批意见关键词
- 审批人
- 状态
- 日期范围
- 是否超期
- 是否涉密案件
- 批次ID

### 4. 导出一致性

导出功能使用与查询完全相同的查询条件，确保导出数量与查询结果一致。支持JSON和CSV两种导出格式。

### 5. 数据持久化

使用MongoDB存储所有数据，服务重启后数据不丢失，支持完整的历史回溯。

## 数据模型说明

### BorrowRecord（借阅记录）

核心字段：
- `recordId`: 记录唯一ID
- `caseId`: 案件ID
- `caseTitle`: 案件标题
- `securityLevel`: 密级
- `borrowerId`: 借阅人ID
- `borrowerName`: 借阅人姓名
- `borrowDate`: 借阅日期
- `dueDate`: 应还日期
- `renewCount`: 续借次数
- `status`: 状态
- `isOverdue`: 是否超期
- `isSecretCase`: 是否涉密案件
- `operationHistory`: 操作历史数组

### 操作类型枚举

- `提交`: 记录创建时自动添加
- `审批通过`: 管理员审批通过
- `退回修改`: 申请被退回
- `借出`: 实体档案已借出
- `续借`: 办理续借
- `归还`: 档案已归还
- `超期催还`: 发送催还通知
- `涉密拦截`: 涉密案件权限不足
- `放行`: 涉密案件特殊审批通过
- `要求补材料`: 需要补充申请材料

## 示例数据

`examples/` 目录下提供了示例数据文件，可用于测试导入功能：

```bash
# 先导入案件数据
curl -X POST http://localhost:3000/api/import/case-json \
  -F "file=@examples/cases.json"

# 再导入人员权限
curl -X POST http://localhost:3000/api/import/permission-csv \
  -F "file=@examples/permissions.csv"

# 最后导入借阅记录
curl -X POST http://localhost:3000/api/import/borrow-csv \
  -F "file=@examples/borrow.csv" \
  -F "operator=系统管理员"
```

## 密级权限矩阵

| 用户权限 | 可借阅密级 |
|---------|-----------|
| 公开 | 公开 |
| 内部 | 公开、内部 |
| 秘密 | 公开、内部、秘密 |
| 机密 | 公开、内部、秘密、机密 |
| 绝密 | 所有密级 |

当用户权限低于案件密级时，系统自动触发涉密拦截流程，需要更高权限管理员审批放行。

## 注意事项

1. 确保MongoDB服务正常运行
2. 生产环境请修改默认端口和数据库密码
3. 建议定期备份MongoDB数据
4. 大文件导入时请注意调整上传大小限制
5. 涉密案件借阅请遵循相关保密规定

## 故障排查

### 问题：无法连接MongoDB

解决：
1. 检查MongoDB服务是否启动
2. 检查`.env`中的`MONGODB_URI`配置是否正确
3. 检查防火墙是否允许27017端口

### 问题：文件上传失败

解决：
1. 检查文件格式是否为CSV或JSON
2. 检查文件大小是否超过10MB限制
3. 检查`uploads/`目录是否存在并有写入权限

### 问题：查询结果为空

解决：
1. 检查查询条件是否正确
2. 确认数据是否已正确导入
3. 查看数据库中实际存储的数据格式
