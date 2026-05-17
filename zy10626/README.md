# 医院预约接口检查单占号释放系统

基于 Express + TypeScript + SQLite 的后端服务，用于管理医院检查单的占号、释放、改约等流程。

## 功能特性

- ✅ 检查单创建与占号管理
- ✅ 状态流转：已占号 → 待释放 → 已释放 / 已改约
- ✅ 支持按日期、状态、负责人、业务对象等多维度筛选
- ✅ 批量导入功能，支持行级错误处理（不中断整批）
- ✅ CSV 数据导出，导出口径一致
- ✅ 操作历史记录追踪
- ✅ 内置验收测试

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 或构建后启动
npm run build
npm start
```

服务默认运行在 `http://localhost:3001`

### 3. 准备基础数据

先创建检查项目和号源数据：

```bash
sqlite3 data/hospital.db "INSERT INTO exam_items (id, name, code, department, price) VALUES ('exam-001', '头颅CT平扫', 'CT001', '放射科', 350);"
sqlite3 data/hospital.db "INSERT INTO time_slots (id, exam_item_id, date, start_time, end_time, total, available, occupied) VALUES ('slot-001', 'exam-001', '2026-05-20', '08:00', '08:30', 5, 5, 0);"
sqlite3 data/hospital.db "INSERT INTO time_slots (id, exam_item_id, date, start_time, end_time, total, available, occupied) VALUES ('slot-002', 'exam-001', '2026-05-21', '09:00', '09:30', 5, 5, 0);"
```

### 4. 运行验收测试

```bash
node acceptance-test.js
```

## API 接口文档

### 健康检查

```bash
curl http://localhost:3001/health
```

### 检查单管理

#### 1. 创建检查单（占号）

```bash
curl -X POST http://localhost:3001/api/checklists \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-001",
    "patientName": "张三",
    "patientIdCard": "110101199001011234",
    "patientPhone": "13800138001",
    "examItemId": "exam-001",
    "examItemName": "头颅CT平扫",
    "examItemCode": "CT001",
    "department": "放射科",
    "timeSlotId": "slot-001",
    "timeSlotDate": "2026-05-20",
    "timeSlotTime": "08:00-08:30",
    "operator": "张医生",
    "businessObject": "门诊预约系统"
  }'
```

#### 2. 查询检查单列表（支持筛选）

```bash
# 基础查询
curl http://localhost:3001/api/checklists

# 按状态筛选
curl "http://localhost:3001/api/checklists?status=已释放"

# 按日期范围筛选
curl "http://localhost:3001/api/checklists?startDate=2026-01-01&endDate=2026-12-31"

# 按操作人筛选
curl "http://localhost:3001/api/checklists?operator=张医生"

# 按业务对象筛选
curl "http://localhost:3001/api/checklists?businessObject=门诊"

# 分页查询
curl "http://localhost:3001/api/checklists?page=1&pageSize=10"

# 组合筛选
curl "http://localhost:3001/api/checklists?status=已占号&startDate=2026-01-01&operator=张医生"
```

#### 3. 查询检查单详情

```bash
curl http://localhost:3001/api/checklists/{检查单ID}
```

#### 4. 转为待释放状态

```bash
curl -X PATCH http://localhost:3001/api/checklists/{ID}/pending-release \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李护士",
    "remark": "患者申请退费"
  }'
```

#### 5. 释放检查单

```bash
curl -X PATCH http://localhost:3001/api/checklists/{ID}/release \
  -H "Content-Type: application/json" \
  -d '{
    "releaseReason": "患者退费",
    "operator": "李护士",
    "remark": "已完成退费审批"
  }'
```

**释放原因可选值**：
- 患者退费
- 患者取消
- 医生调整
- 号源过期
- 系统异常
- 其他

#### 6. 改约检查单

```bash
curl -X PATCH http://localhost:3001/api/checklists/{ID}/reschedule \
  -H "Content-Type: application/json" \
  -d '{
    "newTimeSlotId": "slot-002",
    "operator": "赵医生"
  }'
```

#### 7. 查询操作历史

```bash
curl http://localhost:3001/api/checklists/{ID}/history
```

### 批量导入

```bash
curl -X POST "http://localhost:3001/api/checklists/import?operator=系统管理员" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "patientName": "张三",
      "patientIdCard": "110101199001011234",
      "patientPhone": "13800138001",
      "examItemCode": "CT001",
      "timeSlotDate": "2026-05-20",
      "timeSlotTime": "08:00-08:30",
      "businessObject": "门诊"
    },
    {
      "patientName": "坏行示例-缺少身份证",
      "patientIdCard": "",
      "examItemCode": "CT001",
      "timeSlotDate": "2026-05-20",
      "timeSlotTime": "08:00-08:30"
    }
  ]'
```

### 数据导出

```bash
# 导出全部数据
curl -O "http://localhost:3001/api/checklists/export/data"

# 按条件筛选导出
curl -O "http://localhost:3001/api/checklists/export/data?status=已释放"
```

## 状态流转图

```
已占号
   ↓
待释放 → 已释放
   ↓
已改约
```

## 数据库结构

- `patients` - 患者表
- `exam_items` - 检查项目表
- `time_slots` - 号源表
- `checklists` - 检查表（核心业务表）
- `checklist_history` - 检查单历史表

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── database/
│   │   └── index.ts         # 数据库连接与操作
│   ├── services/
│   │   └── checklist.service.ts  # 核心业务逻辑
│   └── routes/
│       └── checklist.routes.ts   # API路由
├── data/                        # SQLite数据库文件
├── package.json
├── tsconfig.json
├── acceptance-test.js          # 验收测试脚本
└── README.md
```

## 运行测试

```bash
# 运行单元测试
npm test

# 运行验收测试
node acceptance-test.js
```

## 验收测试包含

1. ✅ 健康检查
2. ✅ 批量导入（含坏行处理）
3. ✅ 检查单列表查询
4. ✅ 完整状态流转（已占号→待释放→已释放）
5. ✅ 操作历史记录
6. ✅ 多维度筛选
7. ✅ CSV数据导出
8. ✅ 改约功能
