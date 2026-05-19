# 门诊陪检管理系统

专为门诊服务台设计的陪检任务管理后端工具，支持陪检员接单、取消、插队、超时处理等功能，提供完整的操作审计和数据导出能力。

## ✨ 功能特性

- 📋 **任务管理**: 创建、接单、开始、完成、取消陪检任务
- 🚦 **排队机制**: 自动排队、插队调整
- ⏱️ **超时管理**: 记录超时标记和原因记录
- 👥 **角色审计**: 所有操作记录操作人、角色、时间
- 📦 **批量操作**: 支持批量创建、接单、取消
- 🔄 **智能重试**: 批量失败可重试，不影响已成功记录
- 🔍 **多条件筛选**: 按负责人、时间、状态、异常类型筛选
- 📊 **数据导出**: CSV格式导出，支持月底复盘核对

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据

```bash
npm run import-sample
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 📖 角色说明

| 角色代码 | 角色名称 | 权限 |
|---------|---------|------|
| nurse | 护士 | 创建任务、取消任务 |
| accompanier | 陪检员 | 接单、开始、完成任务 |
| admin | 管理员 | 所有操作权限 |
| system | 系统 | 自动标记超时等 |

## 任务状态

| 状态代码 | 状态名称 | 说明 |
|---------|---------|------|
| pending | 待接单 | 任务已创建，等待陪检员接单 |
| accepted | 已接单 | 陪检员已接单，等待开始陪检 |
| in_progress | 进行中 | 陪检进行中 |
| completed | 已完成 | 陪检已完成 |
| cancelled | 已取消 | 任务已取消 |

## 🔌 API 接口

### 任务管理

#### 创建任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "patient_name": "张三",
      "patient_id": "P001",
      "department": "内科",
      "inspection_type": "CT检查",
      "estimated_time": 30
    },
    "operator": "张护士",
    "role": "nurse"
  }'
```

#### 批量创建任务

```bash
curl -X POST http://localhost:3000/api/tasks/batch \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "patient_name": "李四",
        "patient_id": "P002",
        "department": "外科",
        "inspection_type": "MRI检查",
        "estimated_time": 45
      },
      {
        "patient_name": "王五",
        "patient_id": "P003",
        "department": "儿科",
        "inspection_type": "B超检查",
        "estimated_time": 20
      }
    ],
    "operator": "张护士",
    "role": "nurse"
  }'
```

#### 接单

```bash
curl -X POST http://localhost:3000/api/tasks/{task_id}/accept \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王陪检",
    "role": "accompanier"
  }'
```

#### 开始陪检

```bash
curl -X POST http://localhost:3000/api/tasks/{task_id}/start \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王陪检",
    "role": "accompanier"
  }'
```

#### 完成陪检

```bash
curl -X POST http://localhost:3000/api/tasks/{task_id}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王陪检",
    "role": "accompanier",
    "actual_duration": 35,
    "overtime_reason": "设备临时故障"
  }'
```

#### 取消任务

```bash
curl -X POST http://localhost:3000/api/tasks/{task_id}/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "刘主任",
    "role": "admin",
    "reason": "患者放弃检查"
  }'
```

#### 插队调整

```bash
curl -X POST http://localhost:3000/api/tasks/{task_id}/jump-queue \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "刘主任",
    "role": "admin",
    "target_position": 1
  }'
```

### 查询接口

#### 查询任务列表

```bash
# 获取所有任务
curl http://localhost:3000/api/tasks

# 按状态筛选
curl "http://localhost:3000/api/tasks?status=completed

# 按陪检员筛选
curl "http://localhost:3000/api/tasks?assigned_to=王陪检"

# 按创建人筛选
curl "http://localhost:3000/api/tasks?created_by=张护士"

# 按时间范围筛选 (时间戳)
curl "http://localhost:3000/api/tasks?start_time=1700000000000&end_time=1800000000000"

# 只看超时任务
curl "http://localhost:3000/api/tasks?is_overtime=1"
```

#### 查询任务详情（含操作日志）

```bash
curl http://localhost:3000/api/tasks/{task_id}
```

#### 查询操作审计日志

```bash
# 获取所有日志
curl http://localhost:3000/api/tasks/audit

# 按操作人筛选
curl "http://localhost:3000/api/tasks/audit?operator=王陪检"

# 按异常类型筛选
curl "http://localhost:3000/api/tasks/audit?error_type=OVERTIME"

# 按操作类型筛选
curl "http://localhost:3000/api/tasks/audit?action=create"
```

#### 获取统计数据

```bash
curl http://localhost:3000/api/tasks/statistics/summary
```

### 导出接口

#### 导出任务CSV

```bash
# 导出所有任务
curl -O -J http://localhost:3000/api/tasks/export/tasks

# 按条件导出
curl -O -J "http://localhost:3000/api/tasks/export/tasks?status=completed&is_overtime=1"
```

#### 导出审计日志CSV

```bash
curl -O -J http://localhost:3000/api/tasks/export/audit
```

## 📋 月底复核对账步骤

### 1. 导出本月数据

```bash
# 计算本月时间戳
# 导出本月任务
curl -O -J "http://localhost:3000/api/tasks/export/tasks?start_time={本月开始时间戳}&end_time={本月结束时间戳}"

# 导出本月审计日志
curl -O -J "http://localhost:3000/api/tasks/export/audit?start_time={本月开始时间戳}&end_time={本月结束时间戳}"
```

### 2. 核对要点

1. **任务数量核对**: 导出的任务总数与实际登记数量一致
2. **陪检员工作量核对**: 按陪检员统计任务数量、完成数量、超时数量
3. **超时原因统计**: 超时率是否在合理范围
4. **取消原因分析**: 取消任务原因统计
5. **操作日志追溯**: 关键操作都有对应操作人记录

## 📁 项目结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── db/
│   │   └── index.js     # 数据库连接
│   ├── routes/
│   │   └── tasks.js     # 任务路由
│   ├── services/
│   │   ├── taskService.js      # 任务服务
│   │   ├── batchService.js     # 批量操作服务
│   │   └── exportService.js    # 导出服务
│   ├── middleware/
│   │   └── audit.js     # 审计中间件
│   └── scripts/
│       ├── init-db.js   # 数据库初始化
│       └── import-sample.js # 样例数据导入
├── data/                 # SQLite数据库文件
├── exports/              # 导出文件目录
├── package.json
└── README.md
```

## 💡 使用样例

### 正常流程样例

```bash
# 1. 护士创建任务
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "patient_name": "张三",
      "patient_id": "P100",
      "department": "内科",
      "inspection_type": "CT检查",
      "estimated_time": 30
    },
    "operator": "张护士",
    "role": "nurse"
  }'

# 2. 陪检员接单
curl -X POST http://localhost:3000/api/tasks/{task_id}/accept \
  -H "Content-Type: application/json" \
  -d '{"operator": "王陪检", "role": "accompanier"}'

# 3. 开始陪检
curl -X POST http://localhost:3000/api/tasks/{task_id}/start \
  -H "Content-Type: application/json" \
  -d '{"operator": "王陪检", "role": "accompanier"}'

# 4. 完成陪检
curl -X POST http://localhost:3000/api/tasks/{task_id}/complete \
  -H "Content-Type: application/json" \
  -d '{"operator": "王陪检", "role": "accompanier", "actual_duration": 28}'
```

### 异常流程样例

```bash
# 1. 创建任务（正常）
# 2. 接单（正常）
# 3. 开始陪检（正常）
# 4. 完成陪检（超时）
curl -X POST http://localhost:3000/api/tasks/{task_id}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王陪检",
    "role": "accompanier",
    "actual_duration": 55,
    "overtime_reason": "患者不配合，重新排队"
  }'

# 查询超时任务
curl "http://localhost:3000/api/tasks?is_overtime=1"

# 查看该任务的操作日志
curl http://localhost:3000/api/tasks/{task_id}
```

### 批量操作样例

```bash
# 批量创建任务，包含一个有效一个无效
curl -X POST http://localhost:3000/api/tasks/batch \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "patient_name": "正常患者",
        "patient_id": "P200",
        "department": "外科",
        "inspection_type": "X光检查",
        "estimated_time": 15
      },
      {
        "patient_name": "无效任务（缺少字段）",
        "patient_id": "P201"
      }
    ],
    "operator": "张护士",
    "role": "nurse"
  }'

# 返回结果会显示成功1条，失败1条，失败原因：缺少必填字段
```

## 🔧 常用命令

```bash
# 启动服务
npm start

# 初始化数据库
npm run init-db

# 导入样例数据
npm run import-sample

# 开发模式（自动重启）
npm run dev
```

## 📝 注意事项

1. **操作人字段必填，所有操作都会记录审计日志
2. 批量操作失败时，已成功的记录不会回滚
3. 重试时只需传入失败的记录，不会影响已成功的
4. 超时标记会自动记录异常类型 OVERTIME
5. 导出的CSV文件使用UTF-8编码，可直接用Excel打开
6. 月底复盘时建议同时导出任务表和审计日志表进行交叉核对

## 🔍 健康检查

```bash
curl http://localhost:3000/api/health
```
