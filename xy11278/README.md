# 仓库夜班排班系统

解决仓库夜班排班中的叉车电量、充电桩占用和任务冲突问题，实现数据导入、智能排班、异常处理和报告导出的完整流程。

## 功能特性

- **数据导入**: 支持CSV格式叉车数据、JSON格式充电桩数据、CSV格式任务数据
- **异常检测**: 坏数据不丢弃，保留原始位置、失败原因和修改建议
- **智能排班**: 自动检测电量不足、充电桩占用、任务冲突等异常
- **复核流程**: 支持排班审核和任务状态更新
- **多条件查询**: 按负责人、时间、状态、异常类型筛选
- **报告导出**: 支持CSV和Excel格式，包含汇总和明细数据
- **操作日志**: 完整记录所有数据变更操作

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行演示脚本

```bash
python demo.py
```

演示脚本将依次执行以下步骤:
1. 导入叉车数据（包含正常和异常数据）
2. 导入充电桩数据
3. 导入任务数据
4. 查看导入失败记录
5. 自动生成夜班排班
6. 检测并显示排班冲突
7. 复核排班
8. 更新任务状态（开始执行、异常、完成）
9. 按负责人筛选查询任务
10. 导出Excel报告和失败记录

### 3. 查看导出结果

导出文件位于 `data/exports/` 目录:
- `demo_report.xlsx`: 任务报告（包含汇总和明细两个工作表）
- `失败记录_*.csv`: 导入失败的记录详情

## 数据格式说明

### 叉车数据 (CSV)

| 字段 | 说明 | 必填 |
|------|------|------|
| id | 叉车唯一编号 | 是 |
| name | 叉车名称 | 是 |
| battery_level | 电量(0-100) | 是 |
| status | 状态(available/charging/out_of_service) | 是 |
| last_maintenance | 最后维护日期 | 否 |
| current_operator | 当前操作员 | 否 |
| current_station | 当前所在充电桩 | 否 |

### 充电桩数据 (JSON)

```json
{
  "stations": [
    {
      "id": "CS001",
      "name": "1号充电桩",
      "status": "occupied",
      "occupied_by": "FL002",
      "occupied_since": "2024-01-15T22:00:00",
      "expected_free_time": "2024-01-16T00:30:00"
    }
  ]
}
```

### 任务数据 (CSV)

| 字段 | 说明 | 必填 |
|------|------|------|
| id | 任务唯一编号 | 是 |
| title | 任务标题 | 是 |
| description | 任务描述 | 否 |
| priority | 优先级(1-5, 5最高) | 是 |
| assigned_forklift | 分配的叉车 | 否 |
| assigned_operator | 负责人 | 否 |
| scheduled_date | 计划日期 | 否 |
| shift | 班次(day/night) | 否 |
| estimated_duration | 预计时长(分钟) | 否 |

## 核心API使用

### 导入数据

```python
from warehouse_nightshift import Database, UnitOfWork, ImportService

db = Database()
uow = UnitOfWork(db)
import_service = ImportService(uow)

# 导入叉车
result = import_service.import_forklifts_from_csv('data/forklifts.csv', '张班长')
print(f"成功: {result.success_count}, 失败: {result.failed_count}")

# 导入充电桩
result = import_service.import_charging_stations_from_json('data/stations.json', '张班长')

# 导入任务
result = import_service.import_tasks_from_csv('data/tasks.csv', '张班长')
```

### 生成排班

```python
from datetime import date
from warehouse_nightshift import ScheduleService

schedule_service = ScheduleService(uow)

# 生成排班并检测冲突
schedule, conflicts = schedule_service.generate_schedule(
    schedule_date=date(2024, 1, 15),
    shift="night",
    operator="张班长"
)

# 显示冲突
for conflict in conflicts:
    print(f"[{conflict.conflict_type.value}] {conflict.message}")

# 复核排班
schedule_service.review_schedule(schedule.id, '李主管', '已审核')
```

### 任务状态管理

```python
from warehouse_nightshift import TaskStatus, ExceptionType

# 开始任务
schedule_service.update_task_status('T001', TaskStatus.IN_PROGRESS, '张班长')

# 任务异常
schedule_service.update_task_status(
    'T002', TaskStatus.EXCEPTION, '张班长',
    ExceptionType.LOW_BATTERY, '电量不足需要充电'
)

# 任务完成
schedule_service.update_task_status('T003', TaskStatus.COMPLETED, '张班长')
```

### 查询筛选和导出

```python
from datetime import date
from warehouse_nightshift import ExportService, QueryFilter, TaskStatus

export_service = ExportService(uow)

# 多条件查询
query_filter = QueryFilter(
    operator="张三",
    start_date=date(2024, 1, 1),
    end_date=date(2024, 1, 31),
    status=TaskStatus.COMPLETED,
    shift="night"
)

tasks = export_service.query_tasks(query_filter)
summary = export_service.get_summary(query_filter)

# 导出Excel
excel_path = export_service.export_to_excel(query_filter, 'report.xlsx')

# 导出月度复盘报告
monthly_path = export_service.export_monthly_report(2024, 1)

# 导出失败记录
failed_path = export_service.export_failed_records()
```

## 异常类型说明

| 异常类型 | 说明 |
|----------|------|
| LOW_BATTERY | 叉车电量不足 |
| CHARGING_STATION_OCCUPIED | 充电桩被占用 |
| TASK_CONFLICT | 任务分配冲突 |
| INVALID_DATA | 导入数据格式错误 |
| FORKLIFT_UNAVAILABLE | 叉车不可用 |
| OPERATOR_ABSENT | 操作员缺勤 |

## 目录结构

```
.
├── warehouse_nightshift/
│   ├── __init__.py
│   ├── config.py              # 配置文件
│   ├── models/                # 数据模型
│   │   └── __init__.py
│   ├── storage/               # 存储层
│   │   ├── __init__.py
│   │   └── database.py
│   └── business/              # 业务层
│       ├── __init__.py
│       ├── import_service.py  # 导入服务
│       ├── schedule_service.py # 排班服务
│       └── export_service.py  # 导出服务
├── data/
│   ├── sample_forklifts.csv   # 样例叉车数据
│   ├── sample_stations.json   # 样例充电桩数据
│   ├── sample_tasks.csv       # 样例任务数据
│   ├── exports/               # 导出文件目录
│   └── warehouse_nightshift.db # SQLite数据库
├── demo.py                    # 演示脚本
├── requirements.txt           # 依赖列表
└── README.md                  # 本文档
```

## 月底复盘使用指南

1. **导出月度报告**
```python
export_service.export_monthly_report(2024, 1)
```

2. **核对关键指标**
   - 任务完成率
   - 异常发生次数及类型分布
   - 各操作员工作量统计
   - 班次工作量对比

3. **查看异常详情**
   - 按异常类型筛选任务
   - 导出异常记录进行分析
   - 查看操作日志追踪问题原因

4. **导入失败处理**
   - 定期查看未解决的失败记录
   - 根据建议修正源数据
   - 标记已处理记录
