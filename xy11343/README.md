# 家电售后仓乱账治理系统

## 项目概述

本系统是一个完整的后端服务，用于管理家电售后仓库的零件领用、装机记录、旧件返还、厂商索赔和坏账核销全流程。

## 核心特性

### 1. 全流程覆盖
- **零件管理**: 零件库存管理
- **工程师管理**: 工程师信息管理
- **领用**: 工程师零件领用登记
- **装机**: 装机记录关联
- **返还**: 旧件返还登记，支持状态分类
- **索赔**: 厂商索赔登记
- **核销**: 坏账核销记录

### 2. 数据安全
- **敏感字段脱敏**: 手机号、身份证、姓名、地址等敏感字段在API响应和导出文件中自动脱敏
- **审计日志**: 所有操作自动记录审计日志，可追溯

### 3. 幂等性保障
- 所有POST操作需要request_id
- 重复提交相同request_id返回缓存结果，不会产生重复数据
- 确保不会多扣、多派、多算

### 4. 本地持久化
- 使用SQLite本地数据库
- 重启服务数据不丢失
- 支持历史记录查询和导出

### 5. 导出功能
- 支持导出CSV格式
- 导出数据自动脱敏
- 支持按条件筛选导出

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务默认运行在 http://localhost:3000

### 访问API文档
```
GET http://localhost:3000/api/docs
```

### 健康检查
```
GET http://localhost:3000/api/health
```

## API接口说明

### 基础数据接口

#### 1. 创建零件
```http
POST /api/base/parts
Content-Type: application/json

{
  "request_id": "req-001",
  "part_code": "P001",
  "part_name": "压缩机",
  "stock_quantity": 100,
  "unit": "台",
  "operator": "张三"
}
```

#### 2. 查询零件列表
```http
GET /api/base/parts?part_code=P001&part_name=压缩机&limit=50
```

#### 3. 创建工程师
```http
POST /api/base/engineers
Content-Type: application/json

{
  "request_id": "req-002",
  "engineer_code": "E001",
  "engineer_name": "王师傅",
  "phone": "13800138000",
  "id_card": "110101199001011234",
  "operator": "张三"
}
```

#### 4. 查询工程师列表
```http
GET /api/base/engineers?engineer_code=E001&engineer_name=王&limit=50
```

### 业务操作接口

#### 1. 工程师领件
```http
POST /api/operations/claim
Content-Type: application/json

{
  "request_id": "claim-001",
  "engineer_code": "E001",
  "part_code": "P001",
  "quantity": 2,
  "notes": "空调维修用",
  "operator": "李四"
}
```

#### 2. 装机记录
```http
POST /api/operations/installation
Content-Type: application/json

{
  "request_id": "install-001",
  "claim_id": "<claim_id_from_claim_response>",
  "customer_name": "用户A",
  "customer_phone": "13900139000",
  "customer_address": "北京市朝阳区XX小区",
  "serial_number": "AC-2024-00123",
  "notes": "安装顺利",
  "operator": "李四"
}
```

#### 3. 旧件返还
```http
POST /api/operations/return
Content-Type: application/json

{
  "request_id": "return-001",
  "claim_id": "<claim_id>",
  "part_code": "P001",
  "quantity": 1,
  "condition": "damaged",
  "warehouse_keeper": "赵六",
  "notes": "旧件损坏无法使用",
  "operator": "李四"
}
```

condition可选值: good(完好), defective(有缺陷), damaged(损坏)

#### 4. 厂商索赔
```http
POST /api/operations/vendor-claim
Content-Type: application/json

{
  "request_id": "vendor-001",
  "return_id": "<return_id_from_return_response>",
  "vendor_name": "XX电器供应商",
  "claim_amount": 500.00,
  "notes": "质量问题索赔",
  "operator": "王五"
}
```

#### 5. 坏账核销
```http
POST /api/operations/write-off
Content-Type: application/json

{
  "request_id": "writeoff-001",
  "claim_id": "<claim_id>",
  "reason": "零件丢失无法找回",
  "amount": 800.00,
  "approved_by": "财务主管",
  "notes": "经理审批同意",
  "operator": "王五"
}
```

### 查询接口

#### 1. 查询领用记录
```http
GET /api/operations/claims?engineer_code=E001&status=approved&limit=100
```

#### 2. 查询返还记录
```http
GET /api/operations/returns?claim_id=xxx&condition=damaged&limit=100
```

#### 3. 查询厂商索赔记录
```http
GET /api/operations/vendor-claims?status=submitted&vendor_name=XX&limit=100
```

#### 4. 查询审计日志
```http
GET /api/audit-logs?action=claim&entity_type=claim&limit=100
```

### 导出接口

#### 1. 导出领用记录
```http
POST /api/export/claims
Content-Type: application/json

{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "engineer_code": "E001"
}
```

#### 2. 导出返还记录
```http
POST /api/export/returns
Content-Type: application/json

{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "condition": "damaged"
}
```

#### 3. 导出厂商索赔记录
```http
POST /api/export/vendor-claims
Content-Type: application/json

{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "status": "submitted"
}
```

#### 4. 导出审计日志
```http
POST /api/export/audit-logs
Content-Type: application/json

{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "action": "claim"
}
```

## 项目结构

```
.
├── app.js                 # 主应用入口
├── database.js            # 数据库配置和初始化
├── logger.js              # 日志配置
├── package.json           # 项目配置
├── middleware/
│   ├── dataMasking.js     # 数据脱敏中间件
│   └── idempotency.js     # 幂等性中间件
├── routes/
│   ├── base.js            # 基础数据路由
│   └── operations.js      # 业务操作路由
├── services/
│   ├── auditService.js    # 审计日志服务
│   └── exportService.js   # 数据导出服务
├── logs/                  # 日志目录 (自动生成)
├── exports/               # 导出文件目录 (自动生成)
└── warehouse.db           # SQLite数据库文件 (自动生成)
```

## 核心技术栈

- **Node.js**: 运行环境
- **Express.js**: Web框架
- **SQLite3**: 本地数据库
- **Joi**: 参数校验
- **Winston**: 日志系统
- **csv-writer**: CSV导出
- **UUID**: 唯一标识生成

## 注意事项

1. **request_id必须唯一**: 每个POST请求必须提供唯一的request_id，用于幂等性控制
2. **敏感数据自动脱敏**: 系统自动对敏感字段进行脱敏，无需前端处理
3. **数据库文件**: 数据存储在项目根目录的warehouse.db文件中，请定期备份
4. **日志文件**: 日志存储在logs目录下，包括error.log和combined.log
5. **导出文件**: 导出的CSV文件存储在exports目录下
