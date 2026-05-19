# 陪检员调度系统

门诊陪检服务管理后端系统，实现陪检员接单、取消、插队、超时管理和报表导出功能。

## 功能特性

- ✅ 陪检员管理（增删改查、班表管理）
- ✅ 预约单管理（CSV导入、创建、查询）
- ✅ 任务全流程：派单 → 接单 → 开始陪检 → 完成陪检
- ✅ 特殊操作：取消任务、插队处理、超时检查
- ✅ 多维度筛选：按负责人、时间、状态、异常类型
- ✅ 报表导出：CSV格式导出查询结果
- ✅ 操作日志：完整记录任务状态变更
- ✅ 导入错误处理：坏数据保留原始位置、失败原因、修改建议

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: SQLite3（本地文件数据库）
- **数据处理**: csv-parser, json2csv, moment.js
- **API测试**: axios

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

这会创建 `data/database.db` 文件并初始化所有数据表。

### 3. 导入样例数据

#### 导入预约单（CSV）

```bash
npm run import-appointments
```

或指定CSV文件路径：

```bash
npm run import-appointments ./data/appointments.csv
```

#### 导入陪检员班表（JSON）

```bash
npm run import-schedule
```

或指定JSON文件路径：

```bash
npm run import-schedule ./data/schedule.json
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 5. 运行测试（可选）

确保服务已启动后，在新终端运行：

```bash
npm run test-sample
```

这会执行完整的业务流程测试：派单 → 接单 → 开始 → 完成 → 插队 → 取消

## 数据文件说明

### 预约单 CSV 格式

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| appointment_no | 是 | 预约单号（唯一） | A20240519001 |
| patient_name | 是 | 患者姓名 | 张三 |
| patient_id | 否 | 患者ID | P001 |
| phone | 否 | 联系电话 | 13800138001 |
| department | 否 | 科室 | 内科 |
| exam_type | 否 | 检查类型 | CT检查 |
| appointment_date | 是 | 预约日期 | 2024-05-19 |
| appointment_time | 是 | 预约时间 | 09:00 |
| priority | 否 | 优先级(0-9) | 1 |
| notes | 否 | 备注 | 加急 |

### 陪检员班表 JSON 格式

```json
[
  {
    "employee_id": "E001",
    "name": "王陪检",
    "phone": "13900139001",
    "department": "陪检一科",
    "schedules": [
      {
        "date": "2024-05-19",
        "shift_type": "早班",
        "start_time": "08:00",
        "end_time": "16:00"
      }
    ]
  }
]
```

## API 接口文档

访问 `http://localhost:3000/api/docs` 查看完整接口文档

### 任务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks | 查询任务列表（支持筛选） |
| GET | /api/tasks/:id | 查询任务详情 |
| GET | /api/tasks/:id/logs | 查询任务操作日志 |
| POST | /api/tasks/:id/assign | 派单 |
| POST | /api/tasks/:id/accept | 接单 |
| POST | /api/tasks/:id/start | 开始陪检 |
| POST | /api/tasks/:id/complete | 完成陪检 |
| POST | /api/tasks/:id/cancel | 取消任务 |
| POST | /api/tasks/:id/insert | 插队处理 |
| POST | /api/tasks/:id/check-overdue | 检查超时 |

### 陪检员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/escorts | 查询陪检员列表 |
| GET | /api/escorts/available | 查询可用陪检员 |
| GET | /api/escorts/:id | 查询陪检员详情 |
| GET | /api/escorts/:id/schedules | 查询陪检员班表 |
| POST | /api/escorts | 创建陪检员 |
| POST | /api/escorts/:id/schedules | 添加班表 |

### 预约单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/appointments | 查询预约单列表 |
| GET | /api/appointments/:id | 查询预约单详情 |
| POST | /api/appointments | 创建预约单 |

## 筛选参数说明

### 任务筛选

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| escort_id | number | 陪检员ID | 1 |
| status | string | 任务状态 | pending/assigned/accepted/in_progress/completed/cancelled |
| start_date | string | 开始日期 | 2024-05-01 |
| end_date | string | 结束日期 | 2024-05-31 |
| is_overdue | boolean | 是否超时 | true/false |
| is_inserted | boolean | 是否插队 | true/false |

示例：

```bash
# 查询王陪检的所有已完成任务
curl "http://localhost:3000/api/tasks?escort_id=1&status=completed"

# 查询5月份所有超时任务
curl "http://localhost:3000/api/tasks?start_date=2024-05-01&end_date=2024-05-31&is_overdue=true"

# 查询所有插队任务
curl "http://localhost:3000/api/tasks?is_inserted=true"
```

## 报表导出

### 命令行导出

```bash
# 导出全部
npm run export-report

# 按陪检员导出
npm run export-report -- --escort=1

# 按状态导出
npm run export-report -- --status=completed

# 按日期范围导出
npm run export-report -- --start-date=2024-05-01 --end-date=2024-05-31

# 导出超时任务
npm run export-report -- --overdue=true

# 导出来自内科的任务
npm run export-report -- --department=内科

# 指定输出文件
npm run export-report -- --output=./my-report.csv
```

### 组合筛选示例

```bash
# 导出王陪检5月份完成的所有任务
npm run export-report -- --escort=1 --status=completed --start-date=2024-05-01 --end-date=2024-05-31
```

## 任务状态说明

| 状态 | 说明 |
|------|------|
| pending | 待派单 |
| assigned | 已派单，待接单 |
| accepted | 已接单，待开始 |
| in_progress | 陪检进行中 |
| completed | 已完成 |
| cancelled | 已取消 |

## 导入错误处理

当导入数据失败时，系统会：

1. 记录原始数据
2. 保存失败原因
3. 提供修改建议
4. 记录所在行号

可以查看 `import_errors` 表获取所有导入错误记录。

## 项目结构

```
├── data/                    # 数据目录
│   ├── database.db         # SQLite数据库文件
│   ├── appointments.csv    # 预约单样例数据
│   └── schedule.json       # 陪检员班表样例数据
├── scripts/                 # 脚本目录
│   ├── init-db.js          # 数据库初始化
│   ├── import-appointments.js  # 预约单导入
│   ├── import-schedule.js  # 班表导入
│   ├── export-report.js    # 报表导出
│   └── test-sample.js      # 测试脚本
├── src/                     # 源代码
│   ├── config/
│   │   └── database.js     # 数据库配置
│   ├── models/             # 数据模型
│   │   ├── Task.js
│   │   ├── Escort.js
│   │   ├── Appointment.js
│   │   └── ImportError.js
│   ├── routes/             # 路由
│   │   ├── tasks.js
│   │   ├── escorts.js
│   │   └── appointments.js
│   └── index.js            # 主入口
├── package.json
└── README.md
```

## 常见问题

### Q: 数据库文件在哪里？

A: 数据库文件位于 `data/database.db`，是SQLite格式的文件，可以使用任何SQLite客户端打开查看。

### Q: 如何重置数据库？

A: 删除 `data/database.db` 文件，然后重新运行 `npm run init-db`。

### Q: 导入数据时失败怎么办？

A: 系统会自动记录导入错误。可以查看控制台输出的错误信息，或查询数据库 `import_errors` 表获取详细的失败原因和修改建议。

### Q: 支持哪些筛选条件？

A: 支持按陪检员、状态、日期范围、是否超时、是否插队、科室等多维度筛选。

### Q: 导出的报表是什么格式？

A: 导出为标准CSV格式，可以用Excel、Numbers或任何表格软件打开。

## 许可证

MIT
