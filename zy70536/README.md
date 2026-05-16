# SQL 变更审核 API

替代聊天和表格流程的SQL变更审核服务，DBA可直观查看影响行数、锁风险和回滚脚本完整性。

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问: http://localhost:8000/docs 查看API文档

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/change-orders | 创建变更单 |
| GET | /api/change-orders | 查询变更单列表 |
| GET | /api/change-orders/{id} | 查询单个变更单 |
| PATCH | /api/change-orders/{id}/status | 推进状态 |
| POST | /api/change-orders/{id}/correct | 人工修正 |
| GET | /api/change-orders/{id}/export | 导出审核报告 |
| GET | /api/health | 健康检查 |

## CURL 调用示例

### 1. 创建变更单 - 低风险自动通过

```bash
curl -X POST http://localhost:8000/api/change-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "用户表新增列",
    "description": "为用户表添加手机号字段",
    "creator": "developer_01",
    "sql_contents": [
      "UPDATE users SET phone = '' WHERE id = 123"
    ],
    "rollback_scripts": [
      "UPDATE users SET phone = NULL WHERE id = 123"
    ],
    "tags": ["user", "hotfix"]
  }'
```

**预期结果**: 低风险，状态为 `auto_approved`

### 2. 创建变更单 - 高风险拦截

```bash
curl -X POST http://localhost:8000/api/change-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "订单表结构变更",
    "description": "为百万级订单表添加新字段",
    "creator": "developer_02",
    "sql_contents": [
      "ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2)"
    ],
    "rollback_scripts": [
      "ALTER TABLE orders DROP COLUMN discount_amount"
    ],
    "tags": ["orders", "ddl"]
  }'
```

**预期结果**: 高风险(ALTER操作+大表)，状态为 `manual_review_required`，需要DBA人工审核

### 3. 查询变更单列表

```bash
# 查询所有
curl http://localhost:8000/api/change-orders

# 按状态过滤
curl "http://localhost:8000/api/change-orders?status=manual_review_required"

# 按创建人过滤
curl "http://localhost:8000/api/change-orders?creator=developer_01"
```

### 4. 推进状态 - DBA审核通过

```bash
# 先用上面的查询获取 {order_id}，然后执行:
curl -X PATCH http://localhost:8000/api/change-orders/{order_id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "operator": "dba_admin",
    "comments": "已审核，建议在低峰期执行，注意备份",
    "manual_override": false
  }'
```

### 5. 人工修正SQL

```bash
# 先查看变更单详情获取 {snippet_id}
curl http://localhost:8000/api/change-orders/{order_id}

# 修正SQL
curl -X POST http://localhost:8000/api/change-orders/{order_id}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "snippet_id": "abc12345",
    "corrected_sql": "UPDATE users SET phone = '' WHERE id = 123 LIMIT 1",
    "corrected_rollback": "UPDATE users SET phone = NULL WHERE id = 123 LIMIT 1",
    "corrector": "developer_01",
    "reason": "添加LIMIT限制，防止误操作"
  }'
```

### 6. 导出审核报告

```bash
# JSON格式
curl -o report.json http://localhost:8000/api/change-orders/{order_id}/export?format=json

# 文本格式
curl -o report.txt http://localhost:8000/api/change-orders/{order_id}/export?format=text
```

## ❌ 被规则拦住的路径示例

以下场景会触发审核失败或拦截：

### 1. 缺少WHERE子句 - 全表更新风险

```bash
curl -X POST http://localhost:8000/api/change-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "危险操作-全表更新",
    "creator": "dev_test",
    "sql_contents": [
      "UPDATE users SET status = 'active'"
    ]
  }'
```

**拦截原因**:
- `缺少WHERE子句，可能导致全表操作`
- 状态: `pending_review` (需要人工确认)

### 2. 回滚脚本类型不匹配

```bash
curl -X POST http://localhost:8000/api/change-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "回滚脚本错误",
    "creator": "dev_test",
    "sql_contents": [
      "INSERT INTO users (name) VALUES ('test')"
    ],
    "rollback_scripts": [
      "UPDATE users SET name = NULL WHERE name = 'test'"
    ]
  }'
```

**拦截原因**:
- `回滚脚本类型不匹配: insert -> update`
- 状态: `failed`

### 3. DROP 高危操作

```bash
curl -X POST http://localhost:8000/api/change-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "删除整表",
    "creator": "dev_test",
    "sql_contents": ["DROP TABLE logs"]
  }'
```

**拦截原因**:
- `DROP操作风险极高，会删除整个表`
- 锁风险评分: 80
- 状态: `manual_review_required` (必须人工审核)

### 4. SQL语法错误

```bash
curl -X POST http://localhost:8000/api/change-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "语法错误",
    "creator": "dev_test",
    "sql_contents": ["UPDATE users WHERE id = 1"]
  }'
```

**拦截原因**:
- `SQL解析失败: Expected expression`
- 状态: `failed`

## 错误响应格式

所有接口错误返回统一格式，方便理解：

```json
{
  "error_code": "INVALID_STATUS_TRANSITION",
  "error_message": "不允许从 created 变更到 executed",
  "details": {
    "current_status": "created",
    "requested_status": "executed"
  },
  "suggestion": "有效的目标状态: pending_review, failed"
}
```

## 核心审核规则

| 规则 | 检查点 |
|------|--------|
| SQL 解析 | 语法正确性 |
| 影响预估 | 基于表大小和WHERE条件估算影响行数 |
| 锁风险 | ALTER/大表UPDATE/DROP/TRUNCATE 等高危操作 |
| 回滚校验 | 回滚脚本类型是否匹配，语法是否正确 |
| 全表操作 | 缺少WHERE或1=1恒真条件 |

## 风险等级

| 等级 | 分数 | 处理方式 |
|------|------|----------|
| LOW | < 30 | 自动通过 |
| MEDIUM | 30-49 | 待审核 |
| HIGH | 50-69 | 需人工审核 |
| CRITICAL | >= 70 | 必须人工审核 |

## 状态流转

```
created → pending_review → manual_review_required
                                              ↓
                                    approved → executed → rollback_required
                                              ↓
                                          rejected
                                            ↓
                                        failed
```
