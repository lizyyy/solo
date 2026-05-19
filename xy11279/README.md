# 仓库夜班管理系统 (Warehouse Night Shift)

一个基于 CLI 的仓库夜班管理工具，用于管理车辆、充电桩、任务排班和异常处理。

## 功能特性

### 数据导入
- **车辆数据**: 从 CSV 导入车辆信息（车牌号、电量、状态）
- **充电桩数据**: 从 JSON 导入充电桩信息（名称、状态、功率、位置）
- **任务数据**: 从 CSV 导入任务信息（订单号、描述、优先级、预计时长、所需电量）

### 核心业务
- **排班管理**: 创建夜班/白班排班，自动分配车辆和预约充电桩
- **锁定/释放**: 车辆和充电桩的锁定与释放管理
- **异常处理**: 报告和处理各种异常（低电量、充电桩冲突、车辆故障等）
- **班次管理**: 开始和结束班次

### 日报导出
- 支持 JSON 和 CSV 格式导出
- 包含任务完成统计、异常统计、资源使用情况
- 敏感字段自动脱敏

### 数据安全
- 手机号、员工ID等敏感字段自动脱敏
- 日志自动脱敏敏感信息
- 所有导出文件自动处理敏感字段

### 幂等性保证
- 重复导入相同文件不会产生重复数据
- 同一日期同一班次只能创建一次
- 所有操作结果稳定可预测

## 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 导入示例数据

```bash
# 导入车辆数据
node dist/cli.js import:vehicles examples/vehicles.csv

# 导入充电桩数据
node dist/cli.js import:chargers examples/chargers.json

# 导入任务数据
node dist/cli.js import:tasks examples/tasks.csv
```

### 创建排班

```bash
node dist/cli.js schedule:create -d 2024-01-01 -t night --start 22:00 --end 06:00
```

### 查看数据

```bash
# 查看所有车辆
node dist/cli.js list:vehicles

# 查看所有充电桩
node dist/cli.js list:chargers

# 查看所有任务
node dist/cli.js list:tasks

# 查看所有班次
node dist/cli.js list:shifts
```

### 生成日报

```bash
# 控制台输出
node dist/cli.js report:daily 2024-01-01

# 导出为 JSON
node dist/cli.js report:daily 2024-01-01 -f json -o ./reports

# 导出为 CSV
node dist/cli.js report:daily 2024-01-01 -f csv -o ./reports
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `import:vehicles <file>` | 从 CSV 导入车辆数据 |
| `import:chargers <file>` | 从 JSON 导入充电桩数据 |
| `import:tasks <file>` | 从 CSV 导入任务数据 |
| `schedule:create` | 创建班次排班 |
| `shift:start <shiftId>` | 开始班次 |
| `shift:complete <shiftId>` | 结束班次 |
| `vehicle:lock <vehicleId> <taskId>` | 锁定车辆 |
| `vehicle:release <vehicleId>` | 释放车辆 |
| `charger:lock <chargerId> <vehicleId>` | 锁定充电桩 |
| `charger:release <chargerId>` | 释放充电桩 |
| `exception:report` | 报告异常 |
| `report:daily <date>` | 生成日报 |
| `list:vehicles` | 列出所有车辆 |
| `list:chargers` | 列出所有充电桩 |
| `list:tasks` | 列出所有任务 |
| `list:shifts` | 列出所有班次 |

## 数据文件格式

### vehicles.csv
```csv
plateNumber,batteryLevel,status
京A12345,85,available
```

状态值: `available`, `in_use`, `charging`, `maintenance`

### chargers.json
```json
[
  {
    "name": "CHARGER-01",
    "status": "available",
    "power": 100,
    "location": "A区-01号位"
  }
]
```

状态值: `available`, `occupied`, `maintenance`

### tasks.csv
```csv
orderNumber,description,priority,estimatedDuration,requiredBattery,status
ORD-20240101-001,运输货物A到B区,5,60,30,pending
```

状态值: `pending`, `assigned`, `in_progress`, `completed`, `cancelled`, `exception`

## 项目结构

```
.
├── src/
│   ├── __tests__/          # 测试文件
│   ├── db/                 # 数据库层
│   ├── import/             # 数据导入模块
│   ├── services/           # 业务逻辑层
│   ├── utils/              # 工具函数
│   ├── cli.ts              # CLI 入口
│   └── types.ts            # 类型定义
├── examples/               # 示例数据
├── data/                   # 数据存储目录 (自动创建)
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 运行测试

```bash
npm test
```

## 技术栈

- **TypeScript**: 类型安全
- **lowdb**: 轻量级 JSON 数据库
- **commander.js**: CLI 框架
- **cli-table3**: 表格输出
- **chalk**: 终端颜色输出
- **Jest**: 测试框架
