# 社区药房冷链药品管理系统

## 系统概述

这是一个专为社区药房设计的冷链药品管理系统，用于管理疫苗和胰岛素等需要严格温度控制的药品到货流程。系统提供完整的数据模型、校验机制、状态变更管理和报告导出功能。

## 核心功能

### 1. 到货单管理
- 支持从CSV文件批量导入到货单
- 完整的到货单状态流转（待处理 → 进行中 → 已签收 → 已检验 → 已完成）
- 供应商信息和配送日期管理

### 2. 温度记录管理
- 支持从JSON文件导入温度记录
- 自动检测温度异常（超出预设范围）
- 记录湿度、设备ID、位置等附加信息

### 3. 异常追踪
- 支持多种异常类型（温度过高、温度过低、包装破损、缺失物品、过期等）
- 异常状态管理（开放 → 已解决）
- 支持上传异常照片证据

### 4. 检验流程
- 逐件药品检验
- 批量检验功能
- 检验结果记录和备注

### 5. 坏记录处理
- 导入失败的记录不会被丢弃
- 保存原始数据、错误信息和修改建议
- 支持标记为已解决

### 6. 查询筛选
- 按负责人筛选
- 按时间范围筛选
- 按状态筛选
- 按异常类型筛选
- 按供应商筛选

### 7. 报告导出
- 导出Excel报告（包含多个工作表）
- 导出CSV报告
- 生成温度统计报告
- 生成整体统计报告

## 技术架构

- **后端框架**: FastAPI
- **数据库**: SQLite (可扩展到PostgreSQL/MySQL)
- **ORM**: SQLAlchemy
- **数据处理**: Pandas
- **报告生成**: OpenPyXL

## 快速开始

### 1. 启动服务

```bash
chmod +x start.sh
./start.sh
```

或者手动执行：

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate    # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 访问API文档

启动后访问以下地址查看完整的API文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 示例数据

系统提供了示例数据文件用于测试：

- `data/sample_delivery.csv` - 到货单示例数据
- `data/sample_temperature.json` - 温度记录示例数据

## API接口列表

### 到货单管理
- `GET /api/v1/delivery/{order_id}` - 获取单个到货单
- `POST /api/v1/delivery/query` - 查询到货单（支持分页和筛选）
- `PATCH /api/v1/delivery/{order_id}/status/{status}` - 更新到货单状态
- `POST /api/v1/delivery/batch/status/{status}` - 批量更新状态
- `POST /api/v1/delivery/{order_id}/receive` - 签收到货单
- `POST /api/v1/delivery/{order_id}/complete` - 完成到货单
- `POST /api/v1/delivery/{order_id}/reject` - 拒收到货单

### 物品管理
- `GET /api/v1/delivery/{order_id}/items` - 获取到货单物品列表
- `POST /api/v1/delivery/items/{item_id}/inspect` - 检验单个物品
- `POST /api/v1/delivery/batch/inspect` - 批量检验物品

### 温度记录
- `GET /api/v1/delivery/{order_id}/temperature` - 获取温度记录

### 异常管理
- `GET /api/v1/delivery/{order_id}/anomalies` - 获取异常列表
- `POST /api/v1/delivery/{order_id}/anomalies` - 添加异常记录
- `PATCH /api/v1/delivery/anomalies/{anomaly_id}/resolve` - 解决异常

### 数据导入
- `POST /api/v1/delivery/import/csv` - 导入到货单CSV
- `POST /api/v1/delivery/import/temperature` - 导入温度记录JSON
- `GET /api/v1/delivery/bad-records` - 获取坏记录列表
- `PATCH /api/v1/delivery/bad-records/{record_id}/resolve` - 标记坏记录为已解决

### 报告导出
- `POST /api/v1/delivery/report/export/excel` - 导出Excel报告
- `POST /api/v1/delivery/report/export/csv` - 导出CSV报告
- `GET /api/v1/delivery/report/statistics` - 生成统计报告
- `GET /api/v1/delivery/report/temperature/{order_id}` - 生成温度报告
- `GET /api/v1/delivery/exports` - 列出所有导出文件

### 统计信息
- `GET /api/v1/delivery/statistics` - 获取系统统计数据
- `GET /api/v1/delivery/{order_id}/summary` - 获取到货单摘要

## 数据模型

### 到货单状态
- `pending` - 待处理
- `in_progress` - 进行中
- `received` - 已签收
- `inspected` - 已检验
- `completed` - 已完成
- `rejected` - 已拒收

### 异常类型
- `temperature_high` - 温度过高
- `temperature_low` - 温度过低
- `package_damaged` - 包装破损
- `missing_items` - 缺失物品
- `expired` - 已过期
- `wrong_product` - 货品错误
- `documentation_missing` - 文件缺失
- `other` - 其他

## 目录结构

```
pharmacy-cold-chain/
├── app/
│   ├── __init__.py
│   ├── main.py              # 主应用入口
│   ├── database.py          # 数据库配置
│   ├── models/              # 数据模型
│   │   └── __init__.py
│   ├── schemas/             # Pydantic schemas
│   │   └── __init__.py
│   ├── services/            # 业务逻辑
│   │   ├── delivery_service.py
│   │   ├── import_service.py
│   │   └── report_service.py
│   ├── api/                 # API路由
│   │   └── delivery.py
│   └── utils/               # 工具类
│       └── validators.py
├── data/
│   ├── sample_delivery.csv  # 示例数据
│   ├── sample_temperature.json
│   ├── uploads/             # 上传文件目录
│   └── exports/             # 导出文件目录
├── requirements.txt
├── start.sh
└── README.md
```

## 注意事项

1. 系统默认使用SQLite数据库，文件名为 `pharmacy_cold_chain.db`
2. 所有上传的文件保存在 `data/uploads/` 目录
3. 导出的报告保存在 `data/exports/` 目录
4. 坏记录会被保存，不会自动删除，需要手动标记为已解决
5. 批量操作会分别记录成功和失败的条目，失败不会影响已成功的记录
