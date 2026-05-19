# 地下泵房巡检管理系统

## 功能概述

为小区工程主管设计的后端服务，用于管理地下泵房巡检记录，支持数据导入、查询筛选、导出报告和错误记录追踪。

## 核心特性

- **本地持久化存储**: SQLite数据库，重启服务数据不丢失
- **CSV巡检表导入**: 支持标准巡检表导入，正常和异常记录自动分流
- **JSON传感器告警导入**: 支持传感器告警数据批量导入
- **坏记录处理**: 导入失败的记录保留原始位置、错误原因和修改建议
- **多维度筛选**: 按负责人、时间、状态、异常类型筛选
- **报告导出**: 支持导出CSV格式报告
- **错误追踪**: 专门的导入错误记录表，便于追溯和修正

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 3. API文档

启动后访问 http://localhost:8000/docs 查看交互式API文档

## API接口说明

### 数据导入

- `POST /import/inspection/csv` - 导入巡检表CSV
- `POST /import/sensor/json` - 导入传感器告警JSON

### 数据查询

- `GET /records/inspection` - 查询巡检记录
  - 参数: inspector, start_time, end_time, status, abnormal_type
- `GET /records/abnormal` - 查询异常记录
  - 参数: responsible_person, start_time, end_time, status, abnormal_type
- `GET /records/import-errors` - 查询导入错误记录
  - 参数: import_type

### 数据导出

- `GET /export/inspection` - 导出巡检记录CSV
- `GET /export/abnormal` - 导出异常记录CSV

### 系统摘要

- `GET /summary` - 获取系统统计摘要

## 数据格式说明

### 巡检表CSV字段

| 字段 | 必填 | 说明 |
|------|------|------|
| 巡检时间 | 是 | 格式: YYYY-MM-DD HH:MM:SS |
| 位置 | 是 | 泵房位置 |
| 巡检人 | 是 | 负责人姓名 |
| 设备名称 | 是 | 设备名称 |
| 状态 | 否 | 正常/异常，默认正常 |
| 异常类型 | 否 | 异常分类 |
| 严重程度 | 否 | 高/中等/低 |
| 描述 | 否 | 详细描述 |
| 备注 | 否 | 其他信息 |

### 传感器JSON字段

```json
[
  {
    "timestamp": "2024-05-15 10:00:00",
    "location": "地下泵房1号",
    "sensor_name": "温度传感器A1",
    "alarm_type": "超温告警",
    "severity": "高",
    "value": "92℃",
    "description": "水泵电机温度超过阈值",
    "responsible_person": "张工"
  }
]
```

## 测试流程

### 方法一：使用测试脚本

```bash
chmod +x test.sh
./test.sh
```

### 方法二：手动测试

```bash
# 1. 导入巡检表
curl -X POST http://localhost:8000/import/inspection/csv -F "file=@test_inspection.csv"

# 2. 导入传感器告警
curl -X POST http://localhost:8000/import/sensor/json -F "file=@test_sensor.json"

# 3. 查看系统摘要
curl http://localhost:8000/summary

# 4. 查询异常记录
curl http://localhost:8000/records/abnormal

# 5. 按负责人筛选
curl "http://localhost:8000/records/inspection?inspector=张工"

# 6. 导出报告
curl http://localhost:8000/export/abnormal -o abnormal_report.csv
```

## 数据库表结构

- `inspection_records` - 巡检记录表
- `abnormal_records` - 异常记录表（异常和正常记录分流到不同表）
- `import_error_records` - 导入错误记录表

## 关键设计说明

1. **异常记录分流**: CSV导入时，状态为"异常"或有异常类型的记录会同时写入异常表，确保异常被重点关注

2. **坏记录不丢失**: 所有导入失败的记录都会存入错误表，包含：
   - 原始位置（行号/索引）
   - 原始数据内容
   - 具体错误原因
   - 修改建议

3. **本地持久化**: 使用SQLite文件数据库，服务重启后数据完整保留

4. **筛选与导出一致**: 导出接口使用与查询接口相同的筛选参数，确保导出数据与查询结果一致