# SaaS 计费后台演练系统

这是一个用于演练"配置变更后哪些缓存该失效、哪些客户结果要重算"的本地 REST API 服务。

## 功能特性

- **套餐配置管理**：管理不同级别的套餐（基础版、专业版、企业版等）
- **折扣规则管理**：支持百分比折扣、固定金额折扣等多种规则
- **客户用量追踪**：记录每个客户的月度使用情况
- **账单计算**：基于套餐和折扣规则计算客户账单
- **配置版本管理**：追踪所有配置变更，支持版本回滚
- **缓存失效管理**：智能识别配置变更后需要失效的缓存
- **受影响客户分析**：找出哪些客户会受到配置变更的影响
- **异步/批量重算**：支持异步重算受影响客户的账单
- **任务进度追踪**：实时查看重算任务的进度
- **报告导出**：导出 Markdown 变更影响报告和 JSON 审计明细

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5001` 启动。

### 3. 导入示例数据

```bash
curl -X POST http://localhost:5001/api/import/sample-data
```

## 完整 API 链路演练

以下是一个完整的演练流程，展示配置变更如何影响缓存和账单计算。

### 步骤 1: 健康检查

```bash
curl http://localhost:5001/api/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

### 步骤 2: 查看现有套餐

```bash
curl http://localhost:5001/api/plans
```

### 步骤 3: 查看现有折扣规则

```bash
curl http://localhost:5001/api/discounts
```

### 步骤 4: 查看缓存键

```bash
curl http://localhost:5001/api/cache/keys
```

### 步骤 5: 查看某个客户的账单结果

```bash
curl http://localhost:5001/api/billing-results/1001
```

### 步骤 6: 发布新配置（修改套餐价格）

假设我们要将基础版（ID=1）的月费从 99 元提高到 129 元：

```bash
curl -X POST http://localhost:5001/api/config/publish \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "plans": [
        {
          "id": 1,
          "action": "update",
          "fields": ["monthly_cost"],
          "old_value": 99.0,
          "new_value": 129.0
        }
      ]
    },
    "author": "admin",
    "description": "基础版月费从 99 元调整为 129 元"
  }'
```

预期响应示例：
```json
{
  "config_version_id": 1,
  "version": "v20240101120000_abc123",
  "affected_entities": {
    "plans": [1],
    "discount_rules": [],
    "config_settings": []
  },
  "affected_customers_count": 3,
  "affected_customers": [1001, 1005, ...]
}
```

### 步骤 7: 查找受影响的客户

```bash
curl -X POST http://localhost:5001/api/impact/affected-customers \
  -H "Content-Type: application/json" \
  -d '{
    "config_version_id": 1
  }'
```

### 步骤 8: 失效相关缓存

```bash
curl -X POST http://localhost:5001/api/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": [1001, 1005]
  }'
```

或者按缓存键失效：

```bash
curl -X POST http://localhost:5001/api/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{
    "cache_keys": ["plan:1", "billing:1001:2024-01"]
  }'
```

### 步骤 9: 启动异步重算任务

```bash
curl -X POST http://localhost:5001/api/recalc/start \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": [1001, 1005],
    "config_version_id": 1
  }'
```

预期响应：
```json
{
  "id": 1,
  "task_type": "specific",
  "config_version_id": 1,
  "customer_ids": [1001, 1005],
  "status": "pending",
  "progress": 0,
  "total_items": 2,
  "processed_items": 0,
  ...
}
```

### 步骤 10: 查询重算任务进度

```bash
# 查询所有任务
curl http://localhost:5001/api/recalc/tasks

# 查询特定任务
curl http://localhost:5001/api/recalc/tasks/1
```

### 步骤 11: 导出 Markdown 变更影响报告

```bash
curl http://localhost:5001/api/reports/markdown/1
```

预期响应包含完整的 Markdown 格式报告，包括：
- 基本信息（版本号、发布者、时间）
- 变更内容明细
- 影响分析（受影响客户数、需失效缓存）
- 重算任务状态
- 账单变更明细

### 步骤 12: 导出 JSON 审计明细

```bash
curl http://localhost:5001/api/reports/json/1
```

预期响应示例：
```json
{
  "config_version": {
    "id": 1,
    "version": "v20240101120000_abc123",
    "author": "admin",
    "description": "基础版月费从 99 元调整为 129 元",
    "created_at": "2024-01-01T12:00:00"
  },
  "changes": {
    "plans": [
      {
        "id": 1,
        "action": "update",
        "fields": ["monthly_cost"],
        "old_value": 99.0,
        "new_value": 129.0
      }
    ]
  },
  "impact_analysis": {
    "affected_entities": {...},
    "affected_customers_count": 3,
    "affected_customers": [1001, 1005, 1006],
    "invalidated_caches_count": 5,
    "invalidated_caches": [...]
  },
  "recalc_tasks": [...],
  "billing_changes": [
    {
      "customer_id": 1001,
      "billing_month": "2024-01",
      "final_cost": 129.0,
      "base_cost": 129.0,
      "discount_amount": 0.0
    }
  ],
  "generated_at": "2024-01-01T12:05:00"
}
```

## 更多 API 端点

### 套餐管理

```bash
# 获取所有套餐
curl http://localhost:5001/api/plans

# 获取单个套餐
curl http://localhost:5001/api/plans/1

# 创建新套餐
curl -X POST http://localhost:5001/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新套餐",
    "description": "新套餐描述",
    "monthly_cost": 199.0,
    "features": ["功能1", "功能2"],
    "is_active": true
  }'
```

### 折扣规则管理

```bash
# 获取所有折扣规则
curl http://localhost:5001/api/discounts

# 创建新折扣规则
curl -X POST http://localhost:5001/api/discounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新客户折扣",
    "rule_type": "percentage",
    "conditions": {"customer_type": "new"},
    "discount_value": 20.0,
    "is_active": true
  }'
```

### 客户用量

```bash
# 获取客户用量
curl http://localhost:5001/api/customers/1001/usage

# 创建客户用量记录
curl -X POST http://localhost:5001/api/customers/1001/usage \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": 1,
    "usage_month": "2024-04",
    "usage_data": {
      "storage_used": 5.2,
      "api_calls": 2000,
      "active_users": 3
    }
  }'
```

### 配置版本

```bash
# 获取所有配置版本
curl http://localhost:5001/api/config/versions
```

## 数据库模型

系统使用 SQLite 数据库，包含以下表：

- `plans` - 套餐配置
- `discount_rules` - 折扣规则
- `customer_usages` - 客户用量记录
- `billing_results` - 账单计算结果
- `config_versions` - 配置版本历史
- `cache_keys` - 缓存键管理
- `dependencies` - 依赖关系追踪
- `recalc_tasks` - 重算任务记录

## 演练场景建议

### 场景 1: 套餐价格调整
- 修改某个套餐的月费
- 分析哪些客户使用了该套餐
- 失效相关缓存
- 重算受影响客户的账单

### 场景 2: 新增折扣规则
- 创建新的折扣规则
- 分析哪些客户符合折扣条件
- 重算相关账单

### 场景 3: 折扣规则变更
- 修改现有折扣规则的折扣比例
- 找出使用该折扣的客户
- 失效缓存并重算

### 场景 4: 套餐功能变更
- 修改套餐包含的功能列表
- 分析是否影响账单计算
- 决定是否需要重算

## 注意事项

1. 这是一个演练/演示系统，不适合直接用于生产环境
2. 重算任务使用简单的线程实现，生产环境建议使用 Celery 或其他任务队列
3. 缓存管理是模拟实现，生产环境建议使用 Redis 等专业缓存服务
4. 数据库使用 SQLite，生产环境建议使用 PostgreSQL 或 MySQL

## 故障排查

### 服务无法启动
- 检查是否安装了所有依赖：`pip install -r requirements.txt`
- 检查端口 5000 是否被占用

### 示例数据导入失败
- 检查数据库文件权限
- 删除 `billing.db` 后重新启动服务

### API 返回 500 错误
- 查看服务控制台的错误日志
- 检查请求的 JSON 格式是否正确
