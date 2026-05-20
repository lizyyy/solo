# 工厂质量对账服务

## 项目概述

本服务为工厂质量工程师提供完整的返修记录对账解决方案，将数据导入、自动比对、人工复核、重新计算和报告下载串联成完整工作流。

## 核心功能

### 1. 数据导入
- **返修记录CSV导入**：支持中英文列名，自动识别多种日期格式
- **工单JSON导入**：支持单条或数组格式

### 2. 自动比对检测
- **物料批次不匹配**：检测返修记录与工单的物料批号不一致
- **返修闭环检测**：同一产品多次经过相同工位返修
- **同批多缺陷检测**：同一物料批次发现多个缺陷产品
- **工位异常检测**：特定工位缺陷率异常偏高
- **置信度评分**：为每条比对结果计算置信度

### 3. 人工复核
- 支持修改状态和差异说明
- 自动更新汇总统计
- 保留完整复核历史记录
- 批量处理功能
- 智能差异原因解释和处理建议

### 4. 报告生成
- **Excel多sheet报告**：包含汇总表、明细表、差异分析说明表
- **CSV格式导出**
- **物料批号历史追踪**：查询物料完整追溯链、关联返修记录和工单、质量评估

### 5. 决策支持
- 为每条记录生成决策报告
- 提供放行、返工、特采、报废等处理建议
- 列出支持证据和风险等级
- 帮助质量工程师向他人说明处理理由

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装依赖
```bash
pip install -r requirements.txt
```

### 初始化数据库（导入示例数据）
```bash
python init_db.py
```

### 启动服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 访问API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 数据导入
- `POST /api/import/repair-csv` - 导入返修记录CSV
- `POST /api/import/work-order-json` - 导入工单JSON

### 自动比对
- `POST /api/comparison/run` - 运行自动比对
- `GET /api/comparison/results` - 获取比对结果
- `GET /api/comparison/summary/{batch_id}` - 获取比对汇总

### 人工复核
- `POST /api/review/submit` - 提交复核意见
- `GET /api/review/pending` - 获取待复核记录
- `GET /api/review/history/{result_id}` - 获取复核历史
- `POST /api/review/batch-resolve` - 批量处理
- `GET /api/review/explain/{result_id}` - 差异原因分析

### 报告生成
- `GET /api/report/download/{batch_id}` - 下载比对报告
- `GET /api/material/trace/{batch_no}` - 物料批号追踪
- `GET /api/decision/report/{result_id}` - 生成决策报告

## 项目结构

```
zy70894/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI主应用
│   ├── database.py             # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py           # SQLAlchemy数据模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic数据验证模型
│   └── services/
│       ├── __init__.py
│       ├── import_service.py   # 数据导入服务
│       ├── comparison_service.py # 自动比对服务
│       ├── review_service.py   # 人工复核服务
│       └── report_service.py   # 报告生成服务
├── sample_data/
│   ├── repair_records.csv      # 示例返修数据
│   └── work_orders.json        # 示例工单数据
├── init_db.py                  # 数据库初始化脚本
├── requirements.txt            # Python依赖
└── README.md                   # 项目说明
```

## 使用场景示例

### 场景1：日常对账流程
1. 导出返修记录CSV和工单JSON
2. 通过API上传导入系统
3. 运行自动比对，系统自动标记差异
4. 质量工程师对待复核记录进行人工确认
5. 导出对账报告存档

### 场景2：物料质量追溯
1. 发现某批次产品缺陷率异常
2. 通过物料批号追踪API查询完整历史
3. 查看关联的返修记录和工单
4. 评估质量等级和制定处理措施

### 场景3：向管理层汇报
1. 选择需要说明的记录
2. 调用决策报告API
3. 获取包含处理建议、支持证据、风险等级的完整说明
4. 用于跨部门沟通和决策说明

## 数据模型说明

- **RepairRecord**: 返修记录表
- **WorkOrder**: 工单表
- **MaterialBatch**: 物料批次表
- **MaterialTraceLog**: 物料追溯日志
- **ComparisonResult**: 比对结果表
- **ComparisonSummary**: 比对汇总表
- **ReviewRecord**: 复核记录表
