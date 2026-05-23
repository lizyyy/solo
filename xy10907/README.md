# 宠物寄养喂药 API 服务

## 项目概述
本项目是一个专门为宠物店设计的后端API服务，用于管理宠物寄养期间的喂药流程，解决旺季时依赖便签记录导致的剂量变更同步问题。

## 核心特性

### 1. 数据模型
- **宠物档案**: 管理宠物基本信息
- **寄养订单**: 管理寄养入住/退房信息
- **喂药计划**: 管理药物和剂量信息，支持**版本控制**
- **班次执行**: 管理每日喂药班次，支持**确认机制**
- **变更确认**: 管理剂量变更审批流程，支持**幂等性**
- **护理报告**: 自动生成护理报告，支持**CSV导出**

### 2. 核心规则
- ✅ **剂量版本控制**: 每次剂量变更生成新版本，保留历史记录
- ✅ **班次确认机制**: 白班/晚班交接时的执行确认
- ✅ **漏喂告警系统**: 漏喂自动触发告警，支持确认和补偿
- ✅ **变更幂等性**: 通过request_id防止重复提交
- ✅ **异常处理**: 所有错误请求记录原始输入和处理结论
- ✅ **本地持久化**: SQLite数据库，重启服务数据不丢失

### 3. 接口状态
- `completed`: 成功完成
- `pending_review`: 待复核
- `rejected`: 已驳回
- `compensated`: 已补偿
- `invalid_input`: 输入无效
- `not_found`: 资源不存在
- `conflict`: 资源冲突

## 技术栈
- **框架**: Express.js
- **数据库**: SQLite
- **验证**: Joi
- **日期处理**: Moment.js
- **CSV导出**: json2csv

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 插入示例数据
```bash
npm run seed
```

### 4. 启动服务
```bash
npm start
```

服务将在 http://localhost:3000 启动

## API 接口概览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 健康检查 | GET | /health | 服务健康检查 |
| --- | --- | --- | --- |
| **宠物档案** | POST | /api/pets | 创建宠物档案 |
| | GET | /api/pets | 查询宠物列表 |
| | GET | /api/pets/:id | 查询单个宠物 |
| | PUT | /api/pets/:id | 更新宠物档案 |
| | DELETE | /api/pets/:id | 删除宠物档案 |
| --- | --- | --- | --- |
| **寄养订单** | POST | /api/orders | 创建寄养订单 |
| | GET | /api/orders | 查询订单列表 |
| | GET | /api/orders/:id | 查询单个订单 |
| | PUT | /api/orders/:id | 更新寄养订单 |
| | PATCH | /api/orders/:id/status | 更新订单状态 |
| --- | --- | --- | --- |
| **喂药计划** | POST | /api/medication-plans | 创建喂药计划（自动生成班次） |
| | GET | /api/medication-plans | 查询计划列表 |
| | GET | /api/medication-plans/:id | 查询单个计划 |
| | POST | /api/medication-plans/:id/change-request | 提交剂量变更请求（幂等） |
| | POST | /api/medication-plans/:id/versions | 创建新版本 |
| | GET | /api/medication-plans/:id/history | 查询历史版本 |
| --- | --- | --- | --- |
| **班次执行** | GET | /api/shift-executions | 查询班次列表 |
| | GET | /api/shift-executions/pending | 查询待执行班次 |
| | GET | /api/shift-executions/alarms/active | 查询活动告警 |
| | GET | /api/shift-executions/:id | 查询单个班次 |
| | PATCH | /api/shift-executions/:id/execute | 确认喂药执行 |
| | PATCH | /api/shift-executions/:id/missed | 标记漏喂（触发告警） |
| | PATCH | /api/shift-executions/:id/alarm/acknowledge | 确认告警 |
| | PATCH | /api/shift-executions/:id/correct | 人工修正（补偿状态） |
| --- | --- | --- | --- |
| **变更确认** | GET | /api/change-confirmations | 查询变更列表 |
| | GET | /api/change-confirmations/:id | 查询单个变更 |
| | PATCH | /api/change-confirmations/:id/approve | 批准变更（创建新版本） |
| | PATCH | /api/change-confirmations/:id/reject | 驳回变更 |
| --- | --- | --- | --- |
| **护理报告** | POST | /api/care-reports | 创建报告 |
| | POST | /api/care-reports/generate | 自动生成报告 |
| | GET | /api/care-reports | 查询报告列表 |
| | GET | /api/care-reports/:id | 查询单个报告 |
| | GET | /api/care-reports/export/csv | 导出CSV报告 |

## 典型工作流程

### 白班 → 晚班交接场景
1. 白班护理员执行喂药 → `PATCH /api/shift-executions/{id}/execute`
2. 主人来电要求改剂量 → `POST /api/medication-plans/{id}/change-request`
3. 店长复核变更 → `PATCH /api/change-confirmations/{id}/approve`
4. 晚班护理员看到新版本计划 → `GET /api/shift-executions/pending`
5. 漏喂触发告警 → `PATCH /api/shift-executions/{id}/missed`
6. 告警确认并补喂 → `PATCH /api/shift-executions/{id}/correct`
7. 导出护理报告 → `GET /api/care-reports/export/csv`

## 项目结构
```
.
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── middleware/
│   │   └── errorHandler.js      # 错误处理中间件
│   ├── routes/
│   │   ├── pets.js              # 宠物档案路由
│   │   ├── orders.js            # 寄养订单路由
│   │   ├── medicationPlans.js   # 喂药计划路由
│   │   ├── shiftExecutions.js   # 班次执行路由
│   │   ├── changeConfirmations.js # 变更确认路由
│   │   └── careReports.js       # 护理报告路由
│   ├── scripts/
│   │   ├── initDB.js            # 数据库初始化脚本
│   │   └── seedData.js          # 示例数据脚本
│   ├── utils/
│   │   ├── dbUtils.js           # 数据库工具类
│   │   └── response.js          # 响应工具类
│   ├── app.js                   # Express应用配置
│   └── server.js                # 服务启动文件
├── data/                        # 数据库文件目录（自动创建）
├── package.json                 # 项目配置
├── README.md                    # 项目说明
└── API_EXAMPLES.md              # API调用示例
```

## 数据库表结构

### pets (宠物档案)
- id, name, species, breed, age, weight, owner_name, owner_phone, notes, created_at, updated_at

### orders (寄养订单)
- id, pet_id, check_in_date, check_out_date, room_number, status, notes, created_at, updated_at

### medication_plans (喂药计划)
- id, order_id, pet_id, medication_name, dosage, dosage_unit, frequency, start_date, end_date, administration_method, version, is_active, created_by, notes, created_at, updated_at

### shift_executions (班次执行)
- id, medication_plan_id, scheduled_time, shift_type, actual_time, status, administered_by, actual_dosage, notes, has_alarm, alarm_acknowledged, created_at, updated_at

### change_confirmations (变更确认)
- id, request_id (唯一), resource_type, resource_id, change_type, original_data, new_data, status, requested_by, reviewed_by, reviewed_at, review_notes, compensation_notes, created_at, updated_at

### care_reports (护理报告)
- id, order_id, pet_id, report_date, content, generated_by, created_at

### exception_logs (异常日志)
- id, request_id, endpoint, method, original_input, error_message, processing_result, status, created_at

## 开发说明
- 所有异常请求都会被记录到 exception_logs 表
- 每个请求都有唯一的 request_id 用于追踪
- 数据库文件默认在 data/pet_medication.db
- 支持重启服务后数据不丢失
