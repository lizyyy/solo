# 油耗异常GPS里程后端API

车队油卡流水和GPS里程异常检测系统，帮助识别疑似偷油和里程录错异常。

## 功能特性

- **数据管理**：司机、车辆、油卡流水、GPS里程记录管理
- **异常检测**：基于百公里油耗和里程连续性的智能异常检测
- **异常分级**：轻微、中等、严重三级异常等级
- **多源匹配**：油卡数据与GPS里程数据关联分析
- **导出功能**：支持CSV和Markdown格式导出
- **状态管理**：待处理、复核中、已处理、已忽略四种状态

## 技术栈

- **框架**：FastAPI
- **数据库**：SQLite + SQLAlchemy ORM
- **数据导出**：CSV, Markdown

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检脚本

```bash
python test_self_check.py
```

### 3. 启动API服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问API文档

启动后访问： http://localhost:8000/docs

## API接口说明

### 基础数据管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/drivers | 创建司机 |
| POST | /api/vehicles | 创建车辆 |
| GET | /api/vehicles | 获取车辆列表 |

### 记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/fuel-records | 创建加油记录 |
| POST | /api/mileage-records | 创建里程记录 |
| GET | /api/vehicles/{id}/fuel-records | 获取车辆加油记录 |
| GET | /api/vehicles/{id}/mileage-records | 获取车辆里程记录 |

### 异常分析

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/analyze/batch | 批量分析所有车辆异常 |
| POST | /api/analyze/vehicle/{id} | 分析单辆车异常 |

### 异常报告

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/abnormal-reports | 获取异常报告列表 |
| GET | /api/abnormal-reports/{id} | 获取单份异常报告 |
| PUT | /api/abnormal-reports/{id}/status | 更新报告状态 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/fuel-records.csv | 导出加油记录CSV |
| GET | /api/export/mileage-records.csv | 导出里程记录CSV |
| GET | /api/export/abnormal-reports.csv | 导出异常报告CSV |
| GET | /api/export/abnormal-reports.md | 导出异常报告Markdown |

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/fuel-records | 导入加油记录CSV |

### 统计数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/statistics/summary | 获取统计汇总 |

## 错误响应说明

| 错误码 | 说明 | 场景 |
|--------|------|------|
| MISSING_FIELD | 字段缺失 | 必填字段未提供 |
| INVALID_VALUE | 值无效 | 数据格式或范围错误 |
| NOT_FOUND | 资源不存在 | 查询的ID不存在 |
| STATUS_NOT_ALLOWED | 状态不允许 | 设置了未定义的状态值 |
| NEEDS_MANUAL_REVIEW | 需要人工复核 | 处理报告时缺少处理人 |
| ALREADY_PROCESSED | 已处理 | 报告已处理无法再次修改 |
| DUPLICATE_ENTRY | 重复条目 | 车牌号重复创建 |

## 异常检测规则

### 疑似偷油检测
- 百公里油耗 > 标准油耗 × 120%
- 有加油记录但无对应里程记录

### 里程录错检测
- 相邻里程记录的表显里程差与记录行驶距离偏差 > 50km

## 项目文件结构

```
.
├── main.py              # FastAPI主应用
├── models.py            # 数据模型定义
├── database.py          # 数据库连接配置
├── crud.py              # 数据库操作
├── analytics.py         # 异常检测算法
├── exporter.py          # 导出功能
├── test_self_check.py   # 自检脚本
├── requirements.txt     # 依赖列表
└── README.md            # 项目说明
```

## 使用示例

### 1. 创建车辆

```bash
curl -X POST "http://localhost:8000/api/vehicles" \
  -H "Content-Type: application/json" \
  -d '{
    "plate_number": "京A12345",
    "vehicle_type": "重型卡车",
    "fuel_type": "柴油",
    "standard_fuel_consumption": 25.0
  }'
```

### 2. 导入加油记录

准备CSV文件，字段包括：车牌号、油卡号、加油日期、加油量(L)、单价(元)、总金额(元)、里程表读数、加油站

```bash
curl -X POST "http://localhost:8000/api/import/fuel-records" \
  -F "file=@fuel_records.csv"
```

### 3. 执行异常分析

```bash
curl -X POST "http://localhost:8000/api/analyze/batch"
```

### 4. 导出异常报告

```bash
curl -O "http://localhost:8000/api/export/abnormal-reports.md"
```
