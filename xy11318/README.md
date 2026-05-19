# 校车调度异常处理系统

针对一线校车调度员的异常处理系统，用于处理家长申诉、GPS轨迹和司机打卡不匹配的问题，快速判定迟到责任。

## 功能特性

- **异常记录管理**: 单条/批量创建、查询、更新
- **多维度筛选**: 按负责人、时间、状态、异常类型筛选
- **数据摘要**: 统计总览，按类型/负责人分组统计
- **导出报告**: 支持 Excel 和 CSV 格式导出
- **批量操作容错**: 失败时返回成功/失败明细，重试不破坏已成功记录
- **事务安全**: 每条操作独立事务，失败自动回滚

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 方式一：直接运行
python main.py

# 方式二：使用 uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 备用文档: http://localhost:8000/redoc

### 3. 导入示例数据

```bash
python seed_data.py
```

示例数据包含：
- 6条真实场景的异常记录
- 3种异常类型：traffic_delay（堵车）、driver_late（司机迟到）、gps_mismatch（GPS不匹配）、breakdown（车辆故障）
- 3位负责人：李调度、王主管、张队长

### 4. 复核异常（更新状态）

```bash
# 使用 curl 更新单条记录
curl -X PUT "http://localhost:8000/api/anomalies/ANOMALY-XXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "notes": "已复核，确认为早高峰堵车导致"
  }'

# 状态可选值：pending（待处理）、processing（处理中）、resolved（已解决）
```

### 5. 筛选查询

```bash
# 按负责人筛选
curl "http://localhost:8000/api/anomalies/?responsible_person=李调度"

# 按状态筛选
curl "http://localhost:8000/api/anomalies/?status=pending"

# 按异常类型筛选
curl "http://localhost:8000/api/anomalies/?anomaly_type=traffic_delay"

# 按时间范围筛选
curl "http://localhost:8000/api/anomalies/?start_date=2024-01-01&end_date=2024-12-31"

# 组合筛选
curl "http://localhost:8000/api/anomalies/?responsible_person=李调度&status=pending"
```

### 6. 导出报告

```bash
# 导出 Excel 格式（默认）
curl -O -J "http://localhost:8000/api/export/anomalies?format=excel"

# 导出 CSV 格式
curl -O -J "http://localhost:8000/api/export/anomalies?format=csv"

# 带筛选条件导出
curl -O -J "http://localhost:8000/api/export/anomalies?status=pending&format=excel"
```

导出文件保存在 `exports/` 目录下。

### 7. 完整流程测试

```bash
python test_flow.py
```

测试脚本包含：
1. 创建单条异常记录
2. 获取数据摘要
3. 多维度筛选测试
4. 更新异常记录
5. 批量导入（含成功/失败场景）
6. 批量重试更新
7. 导出报告测试

## API 接口说明

### 异常记录接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/anomalies/` | 创建单条异常记录 |
| GET | `/api/anomalies/` | 查询异常列表（支持筛选） |
| GET | `/api/anomalies/summary` | 获取数据统计摘要 |
| GET | `/api/anomalies/{anomaly_id}` | 获取单条异常详情 |
| PUT | `/api/anomalies/{anomaly_id}` | 更新异常记录 |

### 批量操作接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/anomalies/batch/` | 批量创建异常记录 |
| PUT | `/api/anomalies/batch/retry` | 批量更新/重试 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/anomalies` | 导出异常报告（支持筛选） |

## 数据模型

### 异常记录 (ScheduleAnomaly)

| 字段 | 说明 |
|------|------|
| anomaly_id | 异常唯一标识 |
| bus_id | 车辆ID |
| driver_id | 司机ID |
| driver_name | 司机姓名 |
| route_name | 线路名称 |
| scheduled_time | 计划时间 |
| actual_time | 实际时间 |
| delay_minutes | 延误分钟（自动计算） |
| anomaly_type | 异常类型 |
| status | 状态 |
| responsible_person | 负责人 |
| gps_match | GPS轨迹是否匹配 |
| checkin_match | 司机打卡是否匹配 |
| complaint_count | 关联投诉数量 |
| notes | 备注 |

### 异常类型参考

- `traffic_delay`: 交通拥堵
- `driver_late`: 司机迟到
- `gps_mismatch`: GPS轨迹不匹配
- `breakdown`: 车辆故障
- `weather`: 天气原因
- `other`: 其他原因

## 批量操作说明

### 批量导入返回结果示例

```json
{
  "success_count": 5,
  "failure_count": 1,
  "successful_ids": ["ANOMALY-ABC12345", "..."],
  "failed_ids": ["index_2"],
  "errors": ["Item 2: 数据验证失败"]
}
```

### 批量重试机制

- 每条记录独立处理，使用独立事务
- 失败时自动回滚该条记录，不影响已成功的记录
- 返回清晰的成功/失败ID列表和错误详情
- 可针对失败的ID单独重试

## 使用 curl 的常用操作

### 创建异常记录

```bash
curl -X POST "http://localhost:8000/api/anomalies/" \
  -H "Content-Type: application/json" \
  -d '{
    "bus_id": "BUS001",
    "driver_id": "DRV001",
    "driver_name": "张三",
    "route_name": "阳光花园线",
    "scheduled_time": "2024-05-20T07:30:00",
    "actual_time": "2024-05-20T07:55:00",
    "anomaly_type": "traffic_delay",
    "responsible_person": "李调度",
    "notes": "早高峰堵车"
  }'
```

### 获取摘要

```bash
curl "http://localhost:8000/api/anomalies/summary"
```

## 项目结构

```
.
├── main.py              # 主应用入口和API接口
├── database.py          # 数据库模型和连接配置
├── seed_data.py         # 示例数据导入脚本
├── test_flow.py         # 完整流程测试脚本
├── requirements.txt     # 依赖包列表
├── bus_schedule.db      # SQLite数据库（运行后自动创建）
├── exports/             # 导出文件目录（运行后自动创建）
└── README.md            # 本文档
```

## 注意事项

1. 数据库使用 SQLite，文件为 `bus_schedule.db`
2. 导出文件保存在 `exports/` 目录
3. 批量操作时每条记录使用独立事务，保证数据一致性
4. 重试失败记录时，已成功的记录不会被重复处理
