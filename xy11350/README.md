# 印刷车间品控系统

一个完整的印刷车间品质管理后端系统，整合了Lab颜色数据、订单信息、纸张批次和返工记录的管理。

## 功能特点

- 数据导入：支持CSV（Lab数据）、JSON（订单）、文本文件（返工记录）
- 错误记录：坏数据不会被丢弃，保留原始位置、失败原因和修改建议
- 本地持久化：SQLite数据库存储，重启服务数据不丢失
- 敏感字段：后端级别的数据脱敏，不同角色看到不同数据
- 历史追踪：记录所有数据修改历史，可追溯变更来源
- 数据导出：支持CSV和JSON格式导出

## 技术栈

- FastAPI - REST API框架
- SQLAlchemy - ORM数据库操作
- SQLite - 本地数据库
- Pandas - CSV数据处理
- JWT - 身份认证

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python -c "from app.utils.init_db import init_db; init_db()"
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问接口文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 默认账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 完整权限，看到所有敏感字段 |
| quality | quality123 | 品控人员 | 读写权限，部分敏感字段脱敏 |
| operator | operator123 | 操作员 | 基础权限，敏感字段完全脱敏 |

## API接口概览

### 认证接口
- `POST /api/v1/auth/login` - 用户登录获取Token
- `POST /api/v1/auth/register` - 注册新用户
- `GET /api/v1/auth/me` - 获取当前用户信息

### 批次管理
- `GET /api/v1/batches` - 获取批次列表
- `POST /api/v1/batches` - 创建新批次
- `GET /api/v1/batches/{batch_id}` - 获取批次详情
- `PUT /api/v1/batches/{batch_id}` - 更新批次信息
- `GET /api/v1/batches/{batch_id}/history` - 获取批次修改历史

### Lab数据管理
- `GET /api/v1/lab-data` - 获取Lab数据列表
- `POST /api/v1/lab-data` - 手动创建Lab数据
- `POST /api/v1/lab-data/import/csv` - 批量导入CSV格式Lab数据

### 订单管理
- `GET /api/v1/orders` - 获取订单列表
- `POST /api/v1/orders` - 手动创建订单
- `POST /api/v1/orders/import/json` - 批量导入JSON格式订单

### 返工记录
- `GET /api/v1/rework` - 获取返工记录列表
- `POST /api/v1/rework` - 手动创建返工记录
- `POST /api/v1/rework/import/text` - 批量导入文本格式返工记录

### 错误记录
- `GET /api/v1/errors` - 获取导入错误记录
- `PUT /api/v1/errors/{error_id}` - 标记错误处理状态
- `DELETE /api/v1/errors/{error_id}` - 删除错误记录

### 数据导出
- `GET /api/v1/export/batches` - 导出批次数据CSV
- `GET /api/v1/export/lab-data` - 导出Lab数据CSV
- `GET /api/v1/export/orders` - 导出订单数据CSV
- `GET /api/v1/export/rework` - 导出返工记录CSV
- `GET /api/v1/export/import-records` - 导出导入历史JSON

## 数据导入示例

示例数据文件在 `sample_data/` 目录下：

### 导入Lab数据CSV

```bash
curl -X POST "http://localhost:8000/api/v1/lab-data/import/csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@sample_data/lab_data.csv"
```

### 导入订单JSON

```bash
curl -X POST "http://localhost:8000/api/v1/orders/import/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@sample_data/orders.json"
```

### 导入返工记录文本

```bash
curl -X POST "http://localhost:8000/api/v1/rework/import/text" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@sample_data/rework.txt"
```

## 错误处理机制

系统会捕获导入过程中的所有错误，包括：
- 数据类型错误（如非数字的Lab值）
- 必填字段缺失（如批次号为空）
- 重复数据（如重复订单号）
- 关联数据不存在（如引用不存在的批次）

每条错误记录包含：
- 源文件名和行号
- 原始数据内容
- 错误类型和具体错误信息
- 系统自动生成的修改建议
- 处理状态和处理人记录

## 敏感字段处理

系统会根据用户角色对以下字段进行脱敏：
- `customer_info` - 客户信息
- `operator_id` - 操作员ID
- `cost_details` - 成本详情

脱敏规则（非管理员用户）：
- 保留前2位和后2位字符，中间用*替代
- 邮箱地址只保留用户名前2位和完整域名
- 导出文件和API响应都会应用相同脱敏规则
