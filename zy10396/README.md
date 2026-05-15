# API 调用成本分摊服务

一个基于 Python + FastAPI 的单体后端服务，用于管理 API 调用成本的分摊计算。

## 功能特性

### 核心数据对象
- **调用方 (Caller)** - 管理使用 API 的业务系统或团队
- **接口组 (ApiGroup)** - 对 API 进行分组，便于统一计费
- **资源单价 (ResourcePrice)** - 设置不同接口组的调用单价，支持版本管理
- **调用记录 (CallRecord)** - 批量提交调用量，支持成功/失败统计
- **分摊规则 (AllocationRule)** - 定义成本分摊计算规则，支持版本管理
- **月度结果 (MonthlyResult)** - 按月聚合调用量并计算分摊成本
- **调整记录 (AdjustmentRecord)** - 支持对分摊结果进行人工调整

### 核心功能
- ✅ **调用聚合** - 按月自动聚合调用数据
- ✅ **规则版本** - 支持多版本分摊规则，便于追溯
- ✅ **成本试算** - 预览计算结果，不生成正式数据
- ✅ **调整记录** - 完整的调整审计追踪
- ✅ **分摊导出** - 导出为 Excel 格式

### 接口能力
- ✅ **创建** - 各类数据对象的创建接口
- ✅ **校验** - 数据校验和状态流转
- ✅ **状态推进** - draft → validated → completed → adjusted → exported
- ✅ **异常返回** - 统一的错误响应格式，包含错误码和详情
- ✅ **历史查询** - 分页查询历史分摊结果，支持多条件筛选
- ✅ **幂等机制** - 关键接口支持幂等性，重复提交不产生脏数据

## 技术栈

- **Web 框架**: FastAPI 0.109.0
- **ORM**: SQLAlchemy 2.0.25
- **数据库**: SQLite (可轻松切换为其他数据库)
- **数据验证**: Pydantic 2.5.3
- **数据导出**: Pandas + OpenPyXL

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问管理面板

打开浏览器访问: `http://localhost:8000/admin`

### 4. 访问 API 文档

- Swagger UI (交互式文档): `http://localhost:8000/docs`
- ReDoc (详细文档): `http://localhost:8000/redoc`

## 完整流程测试

运行测试脚本，体验完整流程：

```bash
python test_flow.py
```

测试脚本包含以下步骤：
1. 健康检查
2. 创建调用方
3. 创建接口组
4. 设置资源单价
5. 创建分摊规则
6. 批量提交调用记录（含幂等测试）
7. 成本试算
8. 计算月度分摊（含幂等测试）
9. 查询月度分摊结果
10. 校验分摊结果
11. 调整分摊结果
12. 历史查询
13. 导出数据（含幂等测试）

## API 使用示例

### 1. 创建调用方

```bash
curl -X POST "http://localhost:8000/callers/" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CALLER001",
    "name": "电商平台",
    "description": "主站电商业务系统",
    "department": "技术部",
    "is_active": true
  }'
```

### 2. 创建接口组

```bash
curl -X POST "http://localhost:8000/api-groups/" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "APIGRP001",
    "name": "用户接口组",
    "description": "用户相关的 API 接口",
    "category": "基础服务",
    "is_active": true
  }'
```

### 3. 设置资源单价

```bash
curl -X POST "http://localhost:8000/resource-prices/" \
  -H "Content-Type: application/json" \
  -d '{
    "api_group_id": 1,
    "unit_price": 0.05,
    "currency": "CNY",
    "unit": "call",
    "effective_date": "2024-01-01T00:00:00",
    "is_active": true,
    "created_by": "admin"
  }'
```

### 4. 创建分摊规则

```bash
curl -X POST "http://localhost:8000/allocation-rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "默认分摊规则",
    "description": "按实际调用量比例分摊",
    "allocation_type": "proportional",
    "rounding_precision": 2,
    "effective_date": "2024-01-01T00:00:00",
    "is_active": true,
    "created_by": "admin"
  }'
```

### 5. 批量提交调用记录（幂等）

```bash
curl -X POST "http://localhost:8000/call-records/batch" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: batch_202401_001" \
  -d '{
    "records": [
      {
        "caller_id": 1,
        "api_group_id": 1,
        "call_date": "2024-01-15T10:30:00",
        "call_count": 10000,
        "success_count": 9800,
        "fail_count": 200
      }
    ],
    "idempotency_key": "batch_202401_001"
  }'
```

### 6. 成本试算

```bash
curl -X POST "http://localhost:8000/cost-trial" \
  -H "Content-Type: application/json" \
  -d '{
    "month": "2024-01",
    "rule_id": 1
  }'
```

### 7. 计算月度分摊（幂等）

```bash
curl -X POST "http://localhost:8000/monthly-results/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "month": "2024-01",
    "rule_id": 1,
    "idempotency_key": "calc_202401_001"
  }'
```

### 8. 历史查询

```bash
curl -X GET "http://localhost:8000/history/monthly-results?month=2024-01&page=1&page_size=50" \
  -H "accept: application/json"
```

### 9. 导出数据（幂等）

```bash
curl -X POST "http://localhost:8000/export/xlsx" \
  -H "Content-Type: application/json" \
  -d '{
    "month": "2024-01",
    "idempotency_key": "export_202401_001",
    "format": "xlsx"
  }' --output cost_allocation_202401.xlsx
```

## 状态流转

```
draft (草稿)
  ↓
validated (已校验)
  ↓
completed (已完成)
  ↓
adjusted (已调整) ←┐
  ↓                 │
exported (已导出)   │
                     │
(可随时调整返回 adjusted)
```

## 项目结构

```
api-cost-allocation/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── models.py        # SQLAlchemy 数据模型
│   ├── schemas.py       # Pydantic 数据验证
│   ├── crud.py          # 业务逻辑层
│   ├── database.py      # 数据库配置
│   └── exporter.py      # 数据导出模块
├── static/
│   └── index.html       # 管理面板
├── requirements.txt     # Python 依赖
├── pyproject.toml       # 项目配置
├── test_flow.py         # 完整流程测试脚本
└── README.md            # 项目说明文档
```

## 幂等性说明

以下接口支持幂等性：
- 批量提交调用记录 (`POST /call-records/batch`)
- 计算月度分摊 (`POST /monthly-results/calculate`)
- 导出数据 (`POST /export/xlsx`)

使用方式：
1. 在请求头中添加 `X-Idempotency-Key: <唯一键>`
2. 或在请求体中添加 `idempotency_key` 字段
3. 相同的幂等键重复提交不会产生重复数据

## 错误响应格式

```json
{
  "error": "错误描述",
  "error_code": "错误码",
  "details": "详细信息",
  "timestamp": "2024-01-15T10:30:00"
}
```

## 数据库

默认使用 SQLite 数据库，文件名为 `api_cost_allocation.db`，启动服务时自动创建。

如需切换到其他数据库（如 PostgreSQL），修改 `app/database.py` 中的连接字符串即可。

## 许可证

MIT License
