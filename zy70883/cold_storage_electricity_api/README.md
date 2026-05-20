# 冷库租户电费分摊API服务

## 项目概述

这是一个用于冷库园区电费分摊管理的API服务，支持批次管理、原始材料上传、数据自动分类、归档流程、处理轨迹追踪和审计日志功能。

## 功能特性

### 1. 数据分类
- **正常(normal)**: 数据校验通过，可正常处理
- **待补充(pending_supplement)**: 数据部分缺失，需要补充信息
- **已拦截(blocked)**: 数据严重错误，无法继续处理

### 2. 核心功能
- 批次管理：创建、查询、归档电费批次
- 原始材料上传：支持文件上传和内容登记
- 电费明细管理：单条创建和批量导入
- 数据自动分类：系统自动校验数据并分类
- 处理轨迹追踪：记录每条明细的所有操作历史
- 审计日志：记录字段修改，支持复盘追查
- Excel导出：导出电费明细，包含温区、用电倍率、人工分摊等信息
- 统计信息：按分类统计数量和金额

## 技术栈

- Python 3.9+
- FastAPI: Web框架
- SQLAlchemy: ORM框架
- SQLite: 数据库（可替换为MySQL/PostgreSQL）
- Pandas + openpyxl: Excel导出
- Pydantic: 数据验证

## 快速开始

### 1. 安装依赖

```bash
cd cold_storage_electricity_api
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 3. 启动服务

```bash
python main.py
```

或使用uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/ | 创建批次 |
| GET | /api/batches/ | 获取批次列表 |
| GET | /api/batches/{batch_id} | 获取单个批次 |
| GET | /api/batches/{batch_id}/details | 获取批次及明细统计 |

### 原始材料管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/source-materials/ | 上传原始材料（支持文件） |
| GET | /api/batches/{batch_id}/source-materials | 获取批次的原始材料 |

### 电费明细管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/electricity-details/ | 创建单条明细 |
| POST | /api/electricity-details/bulk/{batch_id} | 批量导入明细 |
| GET | /api/electricity-details/{detail_id} | 获取单条明细 |
| PUT | /api/electricity-details/{detail_id} | 更新明细 |
| POST | /api/electricity-details/{detail_id}/modify-conclusion | 修改分类结论 |

### 归档流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/{batch_id}/archive | 归档批次 |

### 处理轨迹与审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/electricity-details/{detail_id}/traces | 获取处理轨迹 |
| GET | /api/electricity-details/{detail_id}/audit-logs | 获取审计日志 |

### 导出与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/export/excel | 导出Excel文件 |
| GET | /api/statistics/{batch_id} | 获取批次统计 |

## 数据校验规则

自动分类校验条件：

1. **已拦截(blocked)**:
   - 租户编号或名称为空
   - 电表结束读数小于开始读数

2. **待补充(pending_supplement)**:
   - 缺少温区信息
   - 用电倍率异常(<=0)
   - 电表读数不完整
   - 基础电费异常(<0)
   - 有加班时长但加班电费异常

3. **正常(normal)**:
   - 所有必填字段完整且数据合理

## 使用示例

### 1. 创建批次

```bash
curl -X POST "http://localhost:8000/api/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年1月电费",
    "billing_month": "2024-01",
    "created_by": "张会计"
  }'
```

### 2. 批量导入电费明细

```bash
curl -X POST "http://localhost:8000/api/electricity-details/bulk/1" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "tenant_code": "T001",
      "tenant_name": "冷链物流A",
      "temperature_zone": "冷冻区-18℃",
      "electricity_rate": 1.2,
      "meter_reading_start": 10000,
      "meter_reading_end": 12500,
      "basic_electricity": 3000,
      "overtime_hours": 8,
      "overtime_electricity": 200,
      "manual_allocation": 100
    }
  ]'
```

### 3. 修改分类结论

```bash
curl -X POST "http://localhost:8000/api/electricity-details/1/modify-conclusion" \
  -H "Content-Type: application/json" \
  -d '{
    "new_category": "normal",
    "category_reason": "已补充缺失数据，人工审核通过",
    "modified_by": "李主管",
    "change_reason": "租户补充了加班电费凭证"
  }'
```

### 4. 归档批次

```bash
curl -X POST "http://localhost:8000/api/batches/1/archive" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王经理"
  }'
```

## 数据库模型

主要数据表：

1. **batches**: 批次表
2. **source_materials**: 原始材料表
3. **electricity_details**: 电费明细表
4. **processing_traces**: 处理轨迹表
5. **audit_logs**: 审计日志表

## 后续扩展建议

1. 添加用户认证与权限管理
2. 支持更复杂的电费计算公式
3. 添加邮件通知功能（待补充数据通知）
4. 支持更多导入格式（CSV、Excel直接解析）
5. 添加数据可视化报表
6. 实现定时任务自动归档

## 项目结构

```
cold_storage_electricity_api/
├── main.py              # FastAPI主应用
├── models.py            # 数据库模型
├── schemas.py           # Pydantic数据模型
├── crud.py              # 数据库操作
├── database.py          # 数据库连接配置
├── requirements.txt     # 依赖列表
├── .env.example         # 环境变量示例
└── README.md            # 项目文档
```
