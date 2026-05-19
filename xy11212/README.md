# 泵房巡检管理系统

小区地下泵房巡检、告警、工单管理系统，支持CSV/JSON数据导入，坏记录保留原始位置、失败原因和可修改建议，敏感字段在后端脱敏处理。

## 功能特性

- ✅ 巡检记录管理（导入、查询、复核）
- ✅ 传感器告警管理（导入、查询、处理）
- ✅ 完整工单流程：报修 → 派工 → 到场 → 复测 → 关闭
- ✅ 坏记录处理：保留原始位置、失败原因、修改建议
- ✅ 敏感字段脱敏（手机号等）
- ✅ 审计日志记录所有操作
- ✅ 数据导出（支持CSV/JSON格式）
- ✅ 角色权限控制

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建必要目录

```bash
mkdir -p data logs uploads
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务运行在：http://localhost:3001

## 数据导入

### 1. 导入巡检CSV

```bash
curl -X POST http://localhost:3001/api/import/inspection-csv \
  -F "file=@samples/sample-inspections.csv"
```

**预期结果：
- 成功导入 6 条正常记录
- 1 条坏记录（第6行）会被保留，可以在坏记录列表中查看

### 2. 导入告警JSON

```bash
curl -X POST http://localhost:3001/api/import/alarm-json \
  -H "Content-Type: application/json" \
  -d @samples/sample-alarms.json
```

**预期结果：
- 成功导入 4 条正常告警
- 1 条坏记录（第5条）会被保留

## 复核巡检记录

查询待复核的巡检记录：

```bash
curl http://localhost:3001/api/inspections?status=待复核
```

复核通过：

```bash
curl -X PUT http://localhost:3001/api/inspections/1/review \
  -H "Content-Type: application/json" \
  -d '{"status":"已通过"}'
```

## 工单流程示例

### 1. 创建工单

```bash
curl -X POST http://localhost:3001/api/work-orders \
  -H "Content-Type: application/json" \
  -d '{
    "type": "设备报修",
    "title": "P003水泵异响",
    "description": "水泵运行时有异响，温度偏高",
    "pump_room_no": "P003",
    "priority": "高",
    "reporter_name": "张主管",
    "reporter_phone": "13800138001"
  }'
```

### 2. 派工

```bash
curl -X PUT http://localhost:3001/api/work-orders/1/assign \
  -H "Content-Type: application/json" \
  -d '{"assigned_to": "eng001"}'
```

### 3. 到场签到

```bash
curl -X PUT http://localhost:3001/api/work-orders/1/arrive
```

### 4. 处理中

```bash
curl -X PUT http://localhost:3001/api/work-orders/1/process
```

### 5. 申请复测

```bash
curl -X PUT http://localhost:3001/api/work-orders/1/recheck \
  -H "Content-Type: application/json" \
  -d '{"recheck_result": "已更换轴承，运行正常"}'
```

### 6. 关闭工单

```bash
curl -X PUT http://localhost:3001/api/work-orders/1/close \
  -H "Content-Type: application/json" \
  -d '{"closing_remarks": "复测通过，工单关闭"}'
```

## 数据导出

### 导出巡检记录（CSV格式）

```bash
curl "http://localhost:3001/api/export/inspections?format=csv" -o inspections.csv
```

### 导出工单（JSON格式）

```bash
curl "http://localhost:3001/api/export/work-orders?format=json"
```

### 导出审计日志

```bash
curl "http://localhost:3001/api/export/audit-logs?format=csv" -o audit-logs.csv
```

## 查看坏记录

```bash
curl http://localhost:3001/api/import/bad-records
```

处理坏记录：

```bash
curl -X PUT http://localhost:3001/api/import/bad-records/1/handle \
  -H "Content-Type: application/json" \
  -d '{"status":"已忽略"}'
```

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/inspections | 查询巡检记录 |
| GET | /api/inspections/:id | 获取单条巡检记录 |
| POST | /api/inspections | 创建巡检记录 |
| PUT | /api/inspections/:id/review | 复核巡检记录 |
| GET | /api/alarms | 查询告警记录 |
| POST | /api/alarms | 创建告警记录 |
| PUT | /api/alarms/:id/handle | 处理告警 |
| GET | /api/work-orders | 查询工单 |
| POST | /api/work-orders | 创建工单 |
| PUT | /api/work-orders/:id/assign | 派工 |
| PUT | /api/work-orders/:id/arrive | 到场签到 |
| PUT | /api/work-orders/:id/process | 标记处理中 |
| PUT | /api/work-orders/:id/recheck | 申请复测 |
| PUT | /api/work-orders/:id/close | 关闭工单 |
| POST | /api/import/inspection-csv | 导入巡检CSV |
| POST | /api/import/alarm-json | 导入告警JSON |
| GET | /api/import/bad-records | 查询坏记录 |
| PUT | /api/import/bad-records/:id/handle | 处理坏记录 |
| GET | /api/export/inspections | 导出巡检记录 |
| GET | /api/export/alarms | 导出告警记录 |
| GET | /api/export/work-orders | 导出工单记录 |
| GET | /api/export/audit-logs | 导出审计日志 |

## 角色权限

| 角色 | 权限 |
|------|------|
| admin | 全部权限 |
| engineer | 巡检读写、告警处理、工单全部操作 |
| operator | 巡检/告警/工单读权限、创建权限 |

## 目录结构

```
├── server/
│   ├── config/          # 配置文件
│   ├── routes/          # 路由
│   ├── scripts/        # 脚本
├── samples/              # 样例数据
├── data/                 # 数据库文件
├── logs/                 # 日志文件
├── uploads/              # 上传文件
└── package.json
```

## 样例数据说明

samples/ 目录包含测试用的样例数据：

- sample-inspections.csv - 巡检记录表（含正常数据和坏数据）
- sample-alarms.json - 传感器告警数据（含正常数据和坏数据）
