# 装修监理对账服务

## 项目概述

这是一个专为装修监理设计的对账后端服务，能够将分散的工程节点CSV、照片清单JSON、整改单等数据整合起来，实现自动比对、人工复核、重新计算和报告下载的全流程管理。

## 核心功能

### 1. 数据导入
- **节点CSV导入**：导入工程节点信息（节点编码、名称、类型、计划/实际日期、金额、要求照片数等）
- **照片JSON导入**：导入节点验收照片记录
- **整改单导入**：导入整改单信息（支持CSV/JSON格式）

### 2. 自动比对引擎
- **缺照片检测**：自动比对要求照片数和实际照片数，标记缺失/不全/完整
- **逾期计算**：自动计算实际完成日期与计划日期的差异，标记逾期天数
- **返工复验追踪**：识别返工整改，统计返工次数
- **差异说明生成**：自动生成每条记录的差异解释

### 3. 人工复核
- 支持放行/退回/要求补材料/调整扣款等操作
- 记录复核意见和差异来源
- 支持上传复核依据

### 4. 重新计算
- 复核后自动同步更新明细和汇总数据
- 金额、状态、统计数字实时同步

### 5. 报告生成与下载
- **Excel报告**：包含对账汇总、统计说明、对账明细、复核记录、审计轨迹5个工作表
- **CSV报告**：对账明细导出
- **审计轨迹**：支持从单条明细一路追溯到最终报告，展示完整的复核历史

## 项目结构

```
.
├── main.py                  # FastAPI主入口
├── requirements.txt         # 依赖包
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models/
│   │   └── models.py        # 数据模型定义
│   ├── schemas/
│   │   └── schemas.py       # Pydantic Schema定义
│   ├── services/
│   │   ├── import_service.py      # 数据导入服务
│   │   ├── auto_check_engine.py   # 自动比对引擎
│   │   ├── review_service.py      # 复核与重算服务
│   │   └── report_service.py      # 报告生成服务
│   ├── api/
│   │   ├── projects.py            # 项目管理API
│   │   ├── import_api.py          # 数据导入API
│   │   ├── reconciliation_api.py  # 对账管理API
│   │   └── reports_api.py         # 报告管理API
│   └── utils/
│       └── helpers.py       # 工具函数
├── data/                    # 数据与示例文件目录
│   ├── sample_nodes.csv
│   ├── sample_photos.json
│   └── sample_rectifications.csv
└── test_flow.py            # 完整流程测试脚本
```

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 运行测试

```bash
python3 test_flow.py
```

### 3. 启动服务

```bash
python3 main.py
```

服务启动后访问：http://localhost:8000/docs 查看API文档

## API接口说明

### 项目管理
- `POST /api/projects` - 创建项目
- `GET /api/projects` - 获取项目列表
- `GET /api/projects/{id}` - 获取项目详情
- `GET /api/projects/{id}/nodes` - 获取项目节点

### 数据导入
- `POST /api/import/nodes/{project_id}` - 导入节点CSV
- `POST /api/import/photos/{project_id}` - 导入照片JSON
- `POST /api/import/rectifications/{project_id}` - 导入整改单

### 对账管理
- `POST /api/reconciliation/auto-check/{project_id}` - 运行自动对账
- `GET /api/reconciliation/results` - 获取对账结果列表
- `GET /api/reconciliation/results/{id}` - 获取对账结果详情
- `GET /api/reconciliation/results/{id}/details` - 获取对账明细
- `GET /api/reconciliation/results/{id}/summary` - 获取对账汇总
- `POST /api/reconciliation/review` - 添加复核记录
- `POST /api/reconciliation/recalculate/{id}` - 重新计算
- `GET /api/reconciliation/details/{id}/reviews` - 获取明细复核历史

### 报告管理
- `POST /api/reports/download` - 下载对账报告
- `GET /api/reports/audit-trail/{detail_id}` - 获取审计轨迹

## 使用流程

1. **创建项目** - 录入工程基本信息
2. **导入数据** - 上传节点CSV、照片JSON、整改单
3. **自动对账** - 运行自动比对，生成对账结果
4. **人工复核** - 对有异议的记录进行复核，添加意见
5. **重新计算** - 复核后自动重新计算汇总
6. **下载报告** - 生成Excel/CSV报告，支持审计追溯

## 数据格式要求

### 节点CSV字段
- 节点编码 / node_code
- 节点名称 / node_name
- 节点类型 / node_type (水电/泥木/油漆/竣工验收等)
- 计划完成日期 / planned_date
- 实际完成日期 / actual_date
- 节点金额 / amount / node_amount
- 要求照片数 / required_photos

### 照片JSON字段
- 节点编码 / node_code
- 照片ID / photo_id / id
- 照片名称 / photo_name
- 照片URL / photo_url / url
- 上传时间 / upload_time
- 照片类型 / photo_type
- 上传人 / uploader

### 整改单字段 (CSV/JSON)
- 节点编码 / node_code
- 整改单号 / order_no
- 问题描述 / issue_description
- 要求完成日期 / required_completion_date
- 实际完成日期 / actual_completion_date
- 整改状态 / rectification_status
- 是否返工 / is_rework
- 返工次数 / rework_count
- 扣款金额 / fine_amount

## 可解释性设计

本服务的核心设计理念是"所有决策都可追溯、可解释"：

1. **每条明细都有差异说明** - 自动对账时生成，说明缺照片、逾期、返工等原因
2. **复核记录完整保存** - 每一次复核操作都记录操作人、时间、意见、调整内容
3. **审计轨迹一键查询** - 从单条明细可以看到从原始数据到最终状态的完整变化历史
4. **报告包含完整说明** - 下载的Excel报告包含"审计轨迹"工作表，每条记录的决策过程清晰可见

装修监理可以拿着这个报告向业主、施工方清晰地解释：为什么这条记录被放行、退回或要求补材料。
