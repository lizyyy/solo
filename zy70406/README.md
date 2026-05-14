# 响应字段裁剪器后端服务

## 项目概述

这是一个用于处理多源模型评测片段的后端服务，主要功能包括：
- 响应字段裁剪和脱敏处理
- 批次号冲突检测和管理
- 错误报告生成和导出
- 字段溯源和处理人关联查询

## 技术栈

- Python 3.8+
- FastAPI - Web框架
- SQLAlchemy - ORM
- SQLite - 数据库
- Pandas/OpenPyXL - Excel导出

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

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心功能使用流程

### 1. 加载样例数据

```bash
curl -X POST http://localhost:8000/api/v1/load-sample-data/
```

样例数据包含：
- 6条多源模型评测片段（图片审核、文本分析、语音转写等）
- 包含批次号冲突：`IMG-REVIEW-20241201-001` 在两个系统中重复出现

### 2. 检测批次号冲突

```bash
curl -X POST http://localhost:8000/api/v1/detect-conflicts/
```

系统会自动识别批次号冲突并标记相关片段为错误状态。

### 3. 查看冲突列表

```bash
curl http://localhost:8000/api/v1/conflicts/
```

### 4. 字段裁剪/脱敏

```bash
curl -X POST http://localhost:8000/api/v1/trim-fields/ \
  -H "Content-Type: application/json" \
  -d '{
    "fragment_ids": [1],
    "fields_to_trim": ["response_data.reviewer_note"],
    "trim_reason": "remove_sensitive",
    "handler": "管理员"
  }'
```

支持的裁剪原因：
- `remove_sensitive`: 移除敏感信息（手机号、邮箱、姓名等）
- `trim_whitespace`: 去除首尾空格
- `truncate_long_text`: 截断长文本

### 5. 生成错误报告

```bash
curl -X POST "http://localhost:8000/api/v1/reports/error/?generated_by=管理员"
```

报告将自动导出为Excel文件到 `data/reports/` 目录。

### 6. 导出异常样本供复核

```bash
curl -X POST http://localhost:8000/api/v1/export/error-samples/
```

导出的Excel文件包含完整的原始输入和响应数据，存放在 `data/exports/` 目录。

### 7. 根据处理人溯源查询

```bash
curl http://localhost:8000/api/v1/traceability/by-handler/张明
```

可以查询到该处理人相关的所有图片审核样本的原始输入、处理依据和操作记录。

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置文件
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic模式
│   ├── routers.py         # API路由
│   └── services.py        # 业务逻辑服务
├── data/
│   ├── samples/           # 样例数据
│   │   └── multi_source_evaluation_samples.json
│   ├── reports/           # 生成的报告
│   ├── exports/           # 导出文件
│   └── app.db             # SQLite数据库
├── main.py                # 主入口文件
├── requirements.txt       # 依赖列表
└── README.md
```

## 数据模型说明

### EvaluationFragment (评测片段)
- 批次号、来源系统、模型名称
- 原始输入(JSON)、响应数据(JSON)
- 处理人、部门、提交时间
- 错误标记、处理状态

### FieldTrace (字段溯源记录)
- 记录每次字段裁剪操作
- 保存原始值、裁剪后的值、裁剪原因
- 可完整追溯字段变更历史

### ProcessingRecord (处理记录)
- 记录所有人工操作
- 包含操作人、操作内容、结果
- 用于审计和追溯

### BatchConflict (批次冲突)
- 记录批次号冲突
- 包含冲突类型、涉及片段
- 支持标记解决状态

### Report (报告)
- 报告元数据和生成信息
- 关联报告文件路径
- 支持历史查询

## 数据持久化

所有数据存储在SQLite数据库中，本地重启后数据不会丢失。包括：
- 评测片段数据
- 处理记录和操作历史
- 字段裁剪溯源信息
- 批次冲突记录
- 报告生成记录
