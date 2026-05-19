# 代理规则影子测试样本回放后端

基于 FastAPI + SQLite 实现的代理规则影子测试平台，用于网关代理规则上线前的验证，避免误伤已有路径。

## 功能特性

- **代理规则管理**：支持创建、查询、更新、删除代理规则，支持通配符和正则匹配
- **样本请求管理**：管理生产环境采集的真实请求样本
- **规则匹配引擎**：支持路径匹配、方法匹配、优先级排序
- **影子批次执行**：批量执行规则匹配，生成测试结果
- **差异归因分析**：自动分析期望结果与实际结果的差异
- **人工修正功能**：支持标记误报、人工确认差异
- **批次状态管理**：支持执行、关闭、撤回等状态
- **测试报告导出**：生成完整的测试报告JSON
- **异常记录追踪**：记录处理异常、原始输入、处理人信息

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 造数脚本

以下是快速创建测试数据的 curl 命令：

### 1. 创建代理规则

```bash
# 创建用户服务代理规则
curl -X POST "http://localhost:8000/api/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户服务-v1",
    "path_pattern": "/api/v1/users/*",
    "method": "*",
    "target_url": "http://user-service-v1",
    "rewrite_path": "/api/v2/users/",
    "is_active": true,
    "priority": 100,
    "created_by": "devops",
    "description": "用户服务v1版本路由规则"
  }'

# 创建订单服务代理规则
curl -X POST "http://localhost:8000/api/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单服务-v2",
    "path_pattern": "/api/v2/orders/*",
    "method": "POST",
    "target_url": "http://order-service-v2",
    "is_active": true,
    "priority": 90,
    "created_by": "devops",
    "description": "订单服务v2版本POST请求规则"
  }'

# 创建冲突测试规则
curl -X POST "http://localhost:8000/api/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "冲突测试规则",
    "path_pattern": "/api/*",
    "method": "*",
    "target_url": "http://default-service",
    "is_active": true,
    "priority": 1,
    "created_by": "tester",
    "description": "低优先级默认规则"
  }'
```

### 2. 创建样本请求

```bash
# 创建正常样本
curl -X POST "http://localhost:8000/api/samples/" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/users/123",
    "method": "GET",
    "headers": {"Content-Type": "application/json", "Authorization": "Bearer xxx"},
    "query_params": {"fields": "id,name,email"},
    "source": "production_log_202401",
    "expected_status": 200,
    "expected_response": "{\"id\": 123, \"name\": \"test_user\", \"email\": \"test@example.com\"}"
  }'

# 创建POST样本
curl -X POST "http://localhost:8000/api/samples/" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v2/orders/",
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "body": "{\"product_id\": 456, \"quantity\": 2}",
    "source": "production_log_202401",
    "expected_status": 201,
    "expected_response": "{\"order_id\": 789, \"status\": \"created\"}"
  }'

# 创建无预期结果样本
curl -X POST "http://localhost:8000/api/samples/" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/health",
    "method": "GET",
    "source": "production_log_202401"
  }'
```

### 3. 创建影子测试批次

```bash
curl -X POST "http://localhost:8000/api/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "20240115-代理规则变更验证",
    "created_by": "qa_engineer",
    "rule_ids": [1, 2, 3],
    "description": "验证用户服务和订单服务新规则是否误伤现有路径"
  }'
```

## 主流程 CURL 示例

### 1. 启动批次执行

```bash
curl -X POST "http://localhost:8000/api/batches/1/execute/"
```

### 2. 查询批次执行状态

```bash
curl -X GET "http://localhost:8000/api/batches/1/status/"
```

### 3. 查看命中结果

```bash
# 查看所有命中结果
curl -X GET "http://localhost:8000/api/hits/?batch_id=1"

# 只查看有差异的结果
curl -X GET "http://localhost:8000/api/hits/?batch_id=1&has_diff=true"
```

### 4. 查看差异详情

```bash
curl -X GET "http://localhost:8000/api/diffs/?hit_result_id=1"
```

### 5. 人工修正（标记误报）

```bash
curl -X POST "http://localhost:8000/api/manual-correction/" \
  -H "Content-Type: application/json" \
  -d '{
    "hit_result_id": 1,
    "is_false_positive": true,
    "correction_note": "此字段差异是预期内的，属于版本升级正常变更",
    "corrected_by": "qa_lead"
  }'
```

### 6. 生成测试报告

```bash
curl -X POST "http://localhost:8000/api/batches/1/generate-report/" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 7. 查看测试报告

```bash
curl -X GET "http://localhost:8000/api/reports/1"
```

### 8. 关闭批次

```bash
curl -X POST "http://localhost:8000/api/batches/1/close/?closed_by=qa_manager"
```

## 冲突路径测试场景

### 场景1：多规则匹配同一请求

```bash
# 先创建高优先级和低优先级规则
curl -X POST "http://localhost:8000/api/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "高优先级-精确匹配",
    "path_pattern": "/api/v1/users/123",
    "method": "GET",
    "priority": 200,
    "is_active": true
  }'

curl -X POST "http://localhost:8000/api/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "低优先级-通配匹配",
    "path_pattern": "/api/v1/users/*",
    "method": "GET",
    "priority": 100,
    "is_active": true
  }'

# 测试匹配（应该命中高优先级规则）
curl -X POST "http://localhost:8000/api/rules/match/" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/users/123",
    "method": "GET"
  }'
```

### 场景2：规则变更前验证

```bash
# 1. 保留旧规则
# 2. 创建新规则（设置为非激活状态）
curl -X POST "http://localhost:8000/api/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新用户服务规则",
    "path_pattern": "/api/v1/users/*",
    "method": "*",
    "target_url": "http://new-user-service",
    "is_active": false,
    "priority": 150,
    "created_by": "devops"
  }'

# 3. 创建包含新规则的测试批次
# 4. 执行测试验证没有路径误伤
```

### 场景3：撤回有问题的批次

```bash
# 发现测试结果有问题，撤回批次
curl -X POST "http://localhost:8000/api/batches/1/withdraw/"
```

## 运行 pytest 测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_api.py -v

# 运行特定测试用例
pytest tests/test_api.py::test_create_proxy_rule -v

# 生成测试覆盖率报告
pytest tests/ --cov=app --cov-report=html
```

## 主要 API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/rules/ | 创建代理规则 |
| GET | /api/rules/ | 查询规则列表 |
| GET | /api/rules/{id} | 查询单个规则 |
| PUT | /api/rules/{id} | 更新规则 |
| DELETE | /api/rules/{id} | 删除规则 |
| POST | /api/rules/match/ | 测试规则匹配 |
| POST | /api/samples/ | 创建样本请求 |
| GET | /api/samples/ | 查询样本列表 |
| POST | /api/batches/ | 创建测试批次 |
| GET | /api/batches/ | 查询批次列表 |
| POST | /api/batches/{id}/execute/ | 启动批次执行 |
| GET | /api/batches/{id}/status/ | 查询批次状态 |
| POST | /api/batches/{id}/close/ | 关闭批次 |
| POST | /api/batches/{id}/withdraw/ | 撤回批次 |
| POST | /api/batches/{id}/generate-report/ | 生成测试报告 |
| GET | /api/hits/ | 查询命中结果 |
| GET | /api/diffs/ | 查询差异记录 |
| POST | /api/diffs/{id}/false-positive/ | 标记误报 |
| POST | /api/manual-correction/ | 人工修正 |
| GET | /api/reports/ | 查询报告列表 |
| GET | /api/exceptions/ | 查询异常记录 |
| POST | /api/exceptions/{id}/handle/ | 处理异常 |

## 数据库表结构

- **proxy_rules**: 代理规则表
- **sample_requests**: 样本请求表
- **shadow_batches**: 影子测试批次表
- **hit_results**: 命中结果表
- **diff_reasons**: 差异原因表
- **test_reports**: 测试报告表
- **exception_records**: 异常记录表

## 状态流转

### 批次状态

```
pending (待执行) → running (执行中) → completed (已完成) → closed (已关闭)
                          ↓                    ↓
                        failed (失败)      withdrawn (已撤回)
```

### 命中结果状态

```
pending (待处理) → completed (执行完成)
                   failed (执行失败)
```
