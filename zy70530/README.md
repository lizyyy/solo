# 数据质量例外管理API

一个本地可运行的数据质量例外管理系统，用于管理数据质量规则临时放宽的例外、命中记录和恢复流程。

## 功能特性

- **例外创建与管理**: 支持创建数据质量例外，定义规则名称、字段路径、例外条件、恢复日期
- **例外匹配**: 根据规则条件自动匹配数据记录
- **命中记录追踪**: 记录所有命中例外的数据记录
- **状态管理**: 支持例外状态推进（待处理→激活→复核中→已恢复/已拒绝）
- **人工修正**: 支持对命中记录进行人工修正
- **到期自动恢复**: 超过恢复日期的例外自动恢复
- **幂等性保证**: 关键操作支持幂等键，防止重复提交
- **处理日志**: 完整记录所有操作的原始输入、处理依据、最终结论
- **导出报告**: 支持导出Excel/CSV格式的例外清单、命中记录、处理日志

## 数据模型

### DataQualityException (例外主表)
- 规则名称 (rule_name)
- 字段路径 (field_path)
- 例外条件 (exception_condition) - JSON格式，支持多种操作符
- 恢复日期 (recovery_date)
- 状态 (status) - pending/active/reviewing/recovered/rejected
- 描述 (description)
- 创建人/创建时间/复核人/复核时间/复核备注

### ExceptionHitRecord (命中记录表)
- 关联例外ID
- 记录关键字
- 记录数据 (JSON)
- 命中时间
- 是否恢复/恢复时间

### ExceptionHandlingLog (处理日志表)
- 关联例外ID
- 操作类型
- 原始输入 (JSON)
- 处理依据
- 最终结论
- 处理结果 (success/failed/partial)
- 错误信息
- 处理人/处理时间
- 幂等键

### QualityReport (质量报告表)
- 关联例外ID
- 报告类型
- 统计数据（总命中数、已恢复数、待处理数）
- 报告摘要
- 文件路径

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置文件
│   ├── database.py        # 数据库连接
│   ├── models.py          # SQLAlchemy数据模型
│   ├── schemas.py         # Pydantic请求/响应模型
│   ├── crud.py            # 业务逻辑层
│   └── api.py             # API路由
├── exports/               # 导出文件目录
├── main.py                # 应用入口
├── test_api.py            # API测试脚本
├── requirements.txt       # 依赖包
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 运行功能测试

```bash
python test_api.py
```

## API接口列表

### 例外管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/exceptions` | 创建例外 |
| GET | `/api/v1/exceptions/{id}` | 查询单个例外 |
| GET | `/api/v1/exceptions` | 查询例外列表（支持分页和筛选） |
| POST | `/api/v1/exceptions/{id}/status` | 推进例外状态 |
| POST | `/api/v1/exceptions/match` | 匹配例外规则 |

### 命中记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/exceptions/{id}/hit-records` | 创建命中记录 |
| GET | `/api/v1/exceptions/{id}/hit-records` | 查询命中记录列表 |

### 人工修正与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/exceptions/{id}/manual-correction` | 人工修正命中记录 |
| GET | `/api/v1/exceptions/{id}/statistics` | 获取例外统计信息 |
| GET | `/api/v1/exceptions/{id}/handling-logs` | 查询处理日志 |

### 系统功能

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/exceptions/check-expired` | 检查并恢复到期例外 |
| POST | `/api/v1/exceptions/export` | 导出示例报告 |
| GET | `/api/v1/quality-reports` | 查询质量报告列表 |
| GET | `/api/v1/quality-reports/{id}` | 查询单个质量报告 |

## 例外条件操作符

支持以下操作符：

- `equals`: 等于
- `not_equals`: 不等于
- `contains`: 包含
- `greater_than`: 大于
- `less_than`: 小于
- `in`: 在列表中
- `regex`: 正则表达式匹配

示例：
```json
{
  "operator": "equals",
  "value": "test@example.com"
}
```

## 状态流转

```
pending (待处理)
    ↓
  active (激活)
    ↓
reviewing (复核中)
    ↓
recovered (已恢复) 或 rejected (已拒绝)
```

## 幂等性使用

对于创建例外、状态推进、人工修正等操作，可在请求中传入 `idempotency_key` 确保同一请求只处理一次。

```json
{
  "idempotency_key": "unique_request_id_001",
  ...
}
```

## 验收测试要点

1. **正常创建与查询**: 验证例外创建成功，可正常查询
2. **幂等性验证**: 重复提交相同请求，确认不会重复创建/推进
3. **例外匹配**: 验证数据记录能正确匹配例外条件
4. **命中统计**: 验证统计数据准确（总命中、已恢复、待处理）
5. **到期恢复**: 超过恢复日期的例外自动恢复
6. **状态复核**: 状态流转记录复核人、复核时间和备注
7. **报告导出**: 导出Excel文件包含完整信息，每条异常可追溯

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite (本地文件)
- **数据处理**: Pandas, OpenPyXL
