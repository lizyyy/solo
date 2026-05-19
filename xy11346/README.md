# 印刷车间品控管理系统

基于 FastAPI 的印刷车间品质控制管理系统，整合 Lab 色彩数值、纸张批次管理、返工记录追踪，支持阈值判定、多测点分析、异常留样管理。

## 功能特性

- ✅ **Lab 色彩数值管理** - 支持多测点测量数据录入，自动计算色差 ΔE
- ✅ **智能阈值判定** - 基于预设阈值自动判定合格/不合格，支持边界值处理
- ✅ **多测点分析** - 单批次支持多测点，异常测点自动标记和统计
- ✅ **异常留样管理** - 异常批次自动标记需留样，记录留样原因
- ✅ **纸张批次追踪** - 关联纸张批次信息，实现原材料溯源
- ✅ **返工记录管理** - 记录返工类型、原因、操作人员和结果
- ✅ **多维度筛选** - 按检验员、时间、状态、异常类型筛选
- ✅ **Excel 报告导出** - 导出包含汇总、测量数据、返工记录的完整报告

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 方式1：直接启动
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# 方式2：后台运行
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 &
```

服务启动后访问：
- API 文档：http://localhost:8001/docs
- 健康检查：http://localhost:8001/api/health/

### 3. 初始化数据

```bash
# 运行初始化脚本，创建默认阈值和纸张批次
python scripts/init_data.py
```

### 4. 运行主流程测试

```bash
# 确保服务已启动后运行测试脚本
python scripts/test_flow.py
```

## 使用指南

### 创建纸张批次

```bash
curl -X POST "http://localhost:8001/api/paper-batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "PAPER-2024-001",
    "paper_type": "铜版纸157g",
    "supplier": "供应商A",
    "notes": "常规生产批次"
  }'
```

### 设置品控阈值

```bash
curl -X POST "http://localhost:8001/api/quality-thresholds/" \
  -H "Content-Type: application/json" \
  -d '{
    "product_type": "包装彩盒",
    "color_name": "default",
    "l_min": 35.0,
    "l_max": 45.0,
    "a_min": 55.0,
    "a_max": 65.0,
    "b_min": 45.0,
    "b_max": 55.0,
    "delta_e_max": 2.0
  }'
```

### 提交品控记录

```bash
curl -X POST "http://localhost:8001/api/quality-records/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "PRINT-2024-001",
    "product_type": "包装彩盒",
    "paper_batch_id": 1,
    "inspector": "张三",
    "status": "已完成",
    "notes": "常规检验",
    "lab_measurements": [
      {"measurement_point": "左上", "l_value": 40.0, "a_value": 60.0, "b_value": 50.0},
      {"measurement_point": "右上", "l_value": 40.5, "a_value": 59.5, "b_value": 50.5},
      {"measurement_point": "左下", "l_value": 39.5, "a_value": 60.5, "b_value": 49.5},
      {"measurement_point": "右下", "l_value": 40.2, "a_value": 59.8, "b_value": 50.2},
      {"measurement_point": "中心", "l_value": 40.1, "a_value": 60.0, "b_value": 50.0}
    ]
  }'
```

### 查询品控记录

```bash
# 按检验员筛选
curl "http://localhost:8001/api/quality-records/?inspector=张三"

# 按时间范围筛选
curl "http://localhost:8001/api/quality-records/?start_time=2024-01-01T00:00:00&end_time=2024-12-31T23:59:59"

# 按异常类型筛选
curl "http://localhost:8001/api/quality-records/?anomaly_type=严重异常"

# 按批次号模糊查询
curl "http://localhost:8001/api/quality-records/?batch_number=PRINT-2024"
```

### 查看统计数据

```bash
curl "http://localhost:8001/api/statistics/"
```

### 导出 Excel 报告

```bash
# 导出全部记录
curl -X POST "http://localhost:8001/api/export/" \
  -H "Content-Type: application/json" \
  -d "{}" \
  -o quality_report.xlsx

# 按条件导出
curl -X POST "http://localhost:8001/api/export/" \
  -H "Content-Type: application/json" \
  -d '{"inspector": "张三", "status": "已完成"}' \
  -o zhangsan_report.xlsx
```

## 品控规则说明

### 阈值判定逻辑

系统根据每个测点的 Lab 数值与阈值比较：
- **L 值**：亮度，范围 0（黑）- 100（白）
- **a 值**：红绿色度，正值偏红，负值偏绿
- **b 值**：黄蓝色度，正值偏黄，负值偏蓝
- **ΔE**：总色差，反映整体色彩偏差

### 判定结果分类

1. **合格**：所有测点 Lab 值均在阈值范围内，ΔE 符合要求
2. **有条件放行**：异常测点比例 ≤ 30%，可根据实际情况放行，但需留样
3. **不合格**：异常测点比例 > 30%，需返工或报废，必须留样

### 异常类型

- **轻微异常**：少量测点超出阈值，在可接受范围内
- **严重异常**：多测点超出阈值，需进行返工处理

## API 接口列表

| 方法 | 路径 | 完整 URL | 说明 |
|------|------|---------|------|
| GET | `/api/health/` | http://localhost:8001/api/health/ | 健康检查 |
| POST | `/api/paper-batches/` | http://localhost:8001/api/paper-batches/ | 创建纸张批次 |
| GET | `/api/paper-batches/` | http://localhost:8001/api/paper-batches/ | 查询纸张批次列表 |
| POST | `/api/quality-thresholds/` | http://localhost:8001/api/quality-thresholds/ | 创建品控阈值 |
| GET | `/api/quality-thresholds/` | http://localhost:8001/api/quality-thresholds/ | 查询品控阈值列表 |
| POST | `/api/quality-records/` | http://localhost:8001/api/quality-records/ | 创建品控记录（自动判定） |
| GET | `/api/quality-records/{id}` | http://localhost:8001/api/quality-records/{id} | 获取单个品控记录详情 |
| GET | `/api/quality-records/` | http://localhost:8001/api/quality-records/ | 分页查询品控记录（支持筛选） |
| PUT | `/api/quality-records/{id}` | http://localhost:8001/api/quality-records/{id} | 更新品控记录 |
| GET | `/api/statistics/` | http://localhost:8001/api/statistics/ | 获取统计数据 |
| POST | `/api/export/` | http://localhost:8001/api/export/ | 导出 Excel 报告 |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主应用
│   ├── database.py          # 数据库配置
│   ├── models.py            # SQLAlchemy 数据模型
│   ├── schemas.py           # Pydantic 数据结构
│   ├── services/
│   │   ├── __init__.py
│   │   ├── crud.py          # 数据库操作
│   │   └── quality_engine.py # 品控规则引擎
│   └── utils/
│       ├── __init__.py
│       └── exporter.py      # Excel 导出工具
├── scripts/
│   ├── init_data.py         # 数据初始化脚本
│   └── test_flow.py         # 主流程测试脚本
├── requirements.txt         # 依赖列表
├── README.md               # 本文档
└── print_quality.db        # SQLite 数据库（自动生成）
```

## 数据模型

### QualityRecord (品控记录)
- 批次号、产品类型、纸张批次关联
- 检验员、检验时间、状态
- 自动判定结果（总体结果、判定原因、异常类型）
- 是否留样标识、备注

### LabMeasurement (Lab 测量数据)
- 测点名称
- L/a/b 测量值
- 标准值、差值、ΔE
- 是否异常标记、异常原因

### ReworkRecord (返工记录)
- 返工类型、原因
- 操作人员、返工时间
- 返工结果、备注

### PaperBatch (纸张批次)
- 批次号、纸张类型
- 供应商、生产日期
- 收货日期、备注

### QualityThreshold (品控阈值)
- 产品类型、颜色名称
- L/a/b 上下限
- 最大允许色差 ΔE
- 是否启用

## 常见问题

### Q: 如何修改品控阈值？
A: 直接调用创建阈值接口即可，系统会优先使用最新创建的阈值配置。

### Q: 数据库文件在哪里？
A: 默认在项目根目录生成 `print_quality.db` SQLite 数据库文件。

### Q: 如何备份数据？
A: 直接复制 `print_quality.db` 文件即可完成备份。

### Q: 导出的 Excel 包含哪些内容？
A: 包含三个工作表：检验汇总（基本信息和判定结果）、Lab 测量数据（详细测点数据）、返工记录（返工处理记录）。

## 技术栈

- **后端框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite (可扩展为 MySQL/PostgreSQL)
- **数据导出**: Pandas + OpenPyXL
- **数据验证**: Pydantic
