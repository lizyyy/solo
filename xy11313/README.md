# 校车调度异常事件管理系统

解决校车调度员面临的痛点：家长申诉、GPS轨迹、司机打卡三方数据核对困难，人工判断迟到责任效率低下。

## 功能特性

- ✅ **数据导入**: 支持站点时刻表CSV、GPS JSON、申诉单导入
- ✅ **错误处理**: 坏记录保留原始位置、失败原因和修改建议，不直接丢弃
- ✅ **异常检测**: 自动检测迟到、漏站、GPS不匹配等异常
- ✅ **责任判定**: 基于规则引擎自动判定责任方（司机/交通/其他）
- ✅ **复核流程**: 支持人工复核，记录复核意见
- ✅ **多维筛选**: 按负责人、时间、状态、异常类型等筛选
- ✅ **报告导出**: 导出Excel/CSV报告，含统计摘要

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行系统

```bash
python main.py
```

### 3. 逐步操作指南

#### 步骤一：导入站点时刻表

```python
from main import BusDispatchSystem
system = BusDispatchSystem()

# 导入正常数据
system.import_schedule('sample_data/schedule_normal.csv')

# 导入含错误的数据（查看错误处理效果）
system.import_schedule('sample_data/schedule_with_errors.csv')
```

#### 步骤二：导入GPS轨迹数据

```python
system.import_gps('sample_data/gps_data.json')
```

#### 步骤三：导入家长申诉单

```python
system.import_appeals('sample_data/appeals.json')
```

#### 步骤四：自动检测异常

```python
# 检测指定日期的异常
system.detect_anomalies('2024-05-20')
```

#### 步骤五：人工复核

```python
# 查询待复核事件
result = system.query_incidents({'status': 'pending'})

# 复核指定事件
system.review_incident(
    incident_id=1,
    reviewer='调度员张三',
    responsibility='traffic',  # driver(司机)/traffic(交通)/school(学校)/parent(家长)/other(其他)
    notes='早高峰交通拥堵导致晚点'
)
```

#### 步骤六：多维度筛选查询

```python
# 按责任方筛选
system.query_incidents({'responsibility': 'driver'})

# 按异常类型筛选
system.query_incidents({'anomaly_type': 'late_arrival'})

# 按时间范围筛选
from datetime import datetime
system.query_incidents({
    'start_date': datetime(2024, 5, 1),
    'end_date': datetime(2024, 5, 31)
})

# 组合筛选
system.query_incidents({
    'responsibility': 'traffic',
    'status': 'reviewed',
    'anomaly_type': 'late_arrival'
})
```

#### 步骤七：导出报告

```python
# 导出全部事件到Excel
system.export_report('reports/full_report.xlsx')

# 按筛选条件导出
system.export_report('reports/driver_incidents.xlsx', filters={
    'responsibility': 'driver',
    'status': 'reviewed'
})

# 导出CSV格式
system.export_report('reports/incidents.csv')
```

## 数据文件格式说明

### 站点时刻表 (CSV)

必需字段：
- `route_code`: 线路编号
- `route_name`: 线路名称
- `stop_name`: 站点名称
- `stop_order`: 站点顺序（数字）
- `scheduled_arrival`: 计划到达时间（HH:MM）
- `scheduled_departure`: 计划发车时间（HH:MM）

可选字段：
- `latitude`, `longitude`: 经纬度
- `address`: 地址
- `direction`: 方向（morning/afternoon）

示例：
```csv
route_code,route_name,stop_name,stop_order,scheduled_arrival,scheduled_departure,latitude,longitude
R001,阳光小区线,阳光小区正门,1,07:00,07:02,31.2304,121.4737
```

### GPS数据 (JSON)

必需字段：
- `bus_number`: 车牌号
- `timestamp`: 时间戳（ISO格式）
- `latitude`: 纬度
- `longitude`: 经度

示例：
```json
[
    {
        "bus_number": "B001",
        "timestamp": "2024-05-20T07:00:30+08:00",
        "latitude": 31.2304,
        "longitude": 121.4737,
        "speed": 0
    }
]
```

### 申诉单 (JSON/CSV)

必需字段：
- `appeal_number`: 申诉编号
- `student_name`: 学生姓名
- `incident_date`: 事件日期
- `incident_type`: 事件类型

示例：
```json
[
    {
        "appeal_number": "A20240520001",
        "student_name": "张明",
        "parent_name": "张强",
        "incident_date": "2024-05-20",
        "incident_type": "late_arrival",
        "description": "校车晚点15分钟"
    }
]
```

## 错误处理机制

系统导入数据时遇到坏记录会：
1. 保留原始记录内容
2. 记录所在行号/位置
3. 说明失败原因（如："stop_order必须是数字"）
4. 提供修改建议

查看坏记录：
```python
bad_records = system.importer.get_bad_records(import_file_id=1)
for br in bad_records:
    print(f"行{br.line_number}: {br.failure_reason}")
    print(f"建议: {br.correction_suggestion}")
```

## 异常类型说明

| 类型码 | 中文名称 | 说明 |
|--------|----------|------|
| `late_arrival` | 晚点到达 | 实际到达时间晚于计划5分钟以上 |
| `early_departure` | 提前发车 | 实际发车时间早于计划 |
| `missing_stop` | 漏站 | GPS轨迹未在站点停留 |
| `speeding` | 超速 | 行驶速度超过限速 |
| `route_deviation` | 路线偏离 | GPS轨迹偏离预定路线 |
| `gps_mismatch` | GPS数据不符 | 申诉时间与GPS实际时间不一致 |

## 责任类型说明

| 类型码 | 中文名称 | 说明 |
|--------|----------|------|
| `unassigned` | 未分配 | 待人工复核 |
| `driver` | 司机责任 | 司机迟到、操作不当等 |
| `traffic` | 交通原因 | 道路拥堵、交通事故等 |
| `school` | 学校原因 | 学校安排调整 |
| `parent` | 家长原因 | 家长迟到、信息错误等 |
| `weather` | 天气原因 | 恶劣天气影响 |
| `other` | 其他原因 | 其他不可抗力 |

## 项目结构

```
.
├── main.py                  # 主程序入口
├── requirements.txt         # 依赖列表
├── models/                  # 数据模型层
│   ├── __init__.py
│   └── database.py         # 数据库模型定义
├── services/                # 业务逻辑层
│   ├── __init__.py
│   ├── data_import.py      # 数据导入模块
│   ├── business_logic.py   # 异常检测&责任判定
│   └── report_export.py    # 查询&导出模块
├── sample_data/             # 样例数据
│   ├── schedule_normal.csv    # 正常时刻表
│   ├── schedule_with_errors.csv  # 含错误时刻表
│   ├── gps_data.json        # GPS数据
│   └── appeals.json         # 申诉单数据
└── bus_scheduling.db       # SQLite数据库（自动生成）
```

## 数据库表说明

主要数据表：
- `routes`: 线路信息
- `route_stops`: 站点信息
- `route_schedules`: 站点时刻表
- `buses`: 车辆信息
- `drivers`: 司机信息
- `gps_records`: GPS轨迹记录
- `student_appeals`: 家长申诉单
- `incidents`: 异常事件
- `incident_evidence`: 事件证据链

导入相关表：
- `import_files`: 导入文件记录
- `raw_records`: 原始数据记录
- `bad_records`: 坏记录（含失败原因和建议）

## 常见问题

### Q: 导入的数据在哪里查看？
A: 数据保存在SQLite数据库 `bus_scheduling.db` 中，可使用SQLite客户端工具打开查看。

### Q: 如何添加新的异常检测规则？
A: 在 `services/business_logic.py` 的 `AnomalyDetector` 类中添加新的检测方法。

### Q: 报告导出支持哪些格式？
A: 支持Excel (.xlsx) 和 CSV 格式。Excel报告包含"事件明细"和"统计摘要"两个工作表。

### Q: 如何自定义责任判定规则？
A: 修改 `services/business_logic.py` 中 `ResponsibilityJudge` 类的判定逻辑。

## 更新日志

- v1.0.0: 初始版本，实现核心功能
