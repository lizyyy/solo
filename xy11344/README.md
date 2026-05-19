# 印刷车间品控管理系统

基于 FastAPI + SQLAlchemy + SQLite 的印刷车间品控管理系统，用于管理 Lab 数值、纸张批次和返工记录。

## 功能特性

### 1. 数据管理
- **纸张批次管理**: 记录纸张批次信息（供应商、克重、厚度等）
- **Lab 品控记录**: 记录印刷品的 Lab 颜色数值，自动计算色差 ΔE 并判断是否合格
- **返工记录**: 关联品控记录，记录返工原因、类型、操作人及结果

### 2. 数据导入
- **测色 CSV 导入**: 支持从 CSV 文件批量导入测色数据
- **订单 JSON 导入**: 支持从 JSON 文件导入/更新订单信息
- **返工备注导入**: 支持导入返工记录
- **错误处理**: 坏数据不会吞掉，保留原始数据、失败原因和修改建议

### 3. 查询与筛选
- 按负责人（质检员）筛选
- 按时间范围筛选
- 按合格状态筛选
- 按返工类型筛选
- 按批次号、订单号模糊搜索

### 4. 导出功能
- 支持导出为 Excel (xlsx) 或 CSV 格式
- 导出内容与查询筛选结果一致

### 5. 历史记录
- 所有操作日志（创建、更新）
- 导入错误日志，支持标记已解决

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 访问接口文档

启动后访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口概览

### 纸张批次
- `POST /api/paper-batches/` - 创建纸张批次
- `GET /api/paper-batches/` - 列出所有纸张批次
- `GET /api/paper-batches/{id}` - 获取单个批次详情
- `PUT /api/paper-batches/{id}` - 更新批次信息

### 品控记录
- `POST /api/quality-records/` - 创建品控记录
- `GET /api/quality-records/` - 查询品控记录（支持筛选）
- `GET /api/quality-records/{id}` - 获取单个记录详情
- `PUT /api/quality-records/{id}` - 更新品控记录

### 返工记录
- `POST /api/rework-records/` - 创建返工记录
- `GET /api/rework-records/` - 查询返工记录

### 数据导入
- `POST /api/import/lab-csv/` - 导入测色 CSV 文件
- `POST /api/import/order-json/` - 导入订单 JSON 文件
- `POST /api/import/rework-notes/` - 导入返工备注文件

### 错误日志
- `GET /api/import-errors/` - 列出导入错误
- `PUT /api/import-errors/{id}` - 标记错误已解决

### 导出
- `GET /api/export/quality-records/` - 导出品控记录（xlsx/csv）

### 统计
- `GET /api/statistics/` - 获取统计概览

### 操作日志
- `GET /api/operation-logs/` - 查看操作日志

## 数据格式说明

### 测色 CSV 格式
```csv
batch_id,order_number,sample_point,lab_l,lab_a,lab_b,standard_l,standard_a,standard_b,inspector,inspection_time,notes,paper_batch
BATCH001,ORD2024001,左上角,92.5,-1.2,3.8,92.0,-1.0,4.0,张三,2024-01-15 09:30:00,备注,PAPER001
```

必填字段: `batch_id`, `lab_l`, `lab_a`, `lab_b`

### 订单 JSON 格式
```json
[
  {
    "batch_id": "BATCH001",
    "order_number": "ORD2024001",
    "lab_l": 92.5,
    "lab_a": -1.2,
    "lab_b": 3.8,
    "inspector": "张三",
    "notes": "备注"
  }
]
```

### 返工 JSON 格式
```json
[
  {
    "batch_id": "BATCH001",
    "rework_reason": "色差超标",
    "rework_type": "颜色调整",
    "rework_operator": "返工员A"
  }
]
```

## 业务规则

- 色差 ΔE ≤ 2.0 判断为合格
- 数据持久化在本地 SQLite 数据库 (`print_quality_control.db`)
- 重启服务不丢失数据
- 导入失败的记录会保留原始数据和错误原因，方便排查和修正

## 测试数据

`test_data/` 目录下提供了测试数据文件，可以用于验证导入功能：
- `lab_test.csv` - 测色测试数据（包含正常和错误记录）
- `orders.json` - 订单测试数据
- `rework.json` - 返工测试数据

## 项目结构

```
.
├── main.py              # 主应用，包含所有 API 路由
├── database.py          # 数据库模型和连接配置
├── schemas.py           # Pydantic 数据模型
├── data_import.py       # 数据导入逻辑
├── requirements.txt     # 依赖列表
├── print_quality_control.db  # SQLite 数据库（运行后自动生成）
├── temp_uploads/        # 临时上传目录
├── exports/             # 导出文件目录
└── test_data/           # 测试数据
```
