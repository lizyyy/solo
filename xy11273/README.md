# 仓库夜班班长台账管理系统

CLI工具，用于管理仓库夜班的叉车电量、充电桩状态和任务安排。支持数据导入、错误记录、历史查询和数据导出。

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 查看仪表盘

```bash
ledger dashboard
```

### 2. 导入车辆数据

导入正常数据：
```bash
ledger import-vehicles samples/vehicles_normal.csv
```

导入包含错误的数据（测试错误处理）：
```bash
ledger import-vehicles samples/vehicles_with_errors.csv
```

### 3. 导入充电桩状态

```bash
ledger import-stations samples/stations_normal.json
```

### 4. 导入任务单

```bash
ledger import-tasks samples/tasks_normal.json
```

### 5. 查看数据

```bash
# 查看车辆记录
ledger list-vehicles

# 查看充电桩状态
ledger list-stations

# 查看任务单
ledger list-tasks
```

### 6. 复核错误记录

```bash
# 查看所有待处理错误
ledger errors

# 查看错误详情（包含原始数据和修改建议）
ledger show-error 1

# 标记错误为已解决
ledger resolve-error 1
```

### 7. 查看导入历史

```bash
ledger history
```

### 8. 导出所有数据

```bash
ledger export ./output
```

## 数据格式说明

### 车辆数据 CSV

| 字段 | 说明 | 示例 |
|------|------|------|
| plate_number | 车牌号（必填，至少4个字符） | 浙A12345 |
| battery_level | 电量百分比（必填，0-100） | 78.5 |
| driver_name | 司机姓名 | 张三 |
| checkin_time | 签到时间 | 2024-01-15 20:00:00 |

### 充电桩数据 JSON

```json
{
  "station_id": "CHA001",      // 必填，充电桩编号
  "is_occupied": true,         // 是否占用
  "vehicle_plate": "浙A12345", // 占用车辆
  "power_kw": 120.5,           // 功率
  "last_updated": "..."        // 更新时间
}
```

### 任务单数据 JSON

```json
{
  "task_id": "T001",           // 必填，任务编号
  "task_type": "loading",      // 必填，任务类型
  "priority": "high",          // 优先级：low/normal/high/urgent
  "description": "...",        // 任务描述
  "assignee": "张三",          // 负责人
  "scheduled_time": "..."      // 计划时间
}
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `dashboard` | 查看系统仪表盘 |
| `import-vehicles <file>` | 导入车辆CSV文件 |
| `import-stations <file>` | 导入充电桩JSON文件 |
| `import-tasks <file>` | 导入任务单JSON文件 |
| `list-vehicles` | 查看车辆记录 |
| `list-stations` | 查看充电桩状态 |
| `list-tasks` | 查看任务单 |
| `errors` | 查看错误记录 |
| `show-error <id>` | 查看错误详情 |
| `resolve-error <id>` | 标记错误为已解决 |
| `history` | 查看导入历史 |
| `export <dir>` | 导出所有数据 |
| `reset` | 重置数据库 |

## 数据持久化

所有数据存储在 `~/.night-shift-ledger/ledger.db` SQLite数据库中。重启CLI或系统后，历史数据仍然保留。

## 样例数据

`samples/` 目录包含以下测试文件：

- `vehicles_normal.csv` - 正常车辆数据
- `vehicles_with_errors.csv` - 包含错误的车辆数据（空车牌、短车牌、超出范围电量、负电量、无效格式）
- `stations_normal.json` - 正常充电桩数据
- `stations_with_errors.json` - 包含错误的充电桩数据
- `tasks_normal.json` - 正常任务单
- `tasks_with_errors.json` - 包含错误的任务单
