# SaaS 客户续费风险排查 API

一个用于帮助小型 SaaS 团队排查客户续费风险的 REST API，基于 Flask + SQLAlchemy + SQLite 构建。

## 功能特性

- **数据模型**: 租户、联系人、合同、使用量快照、跟进记录、审计日志
- **风险评估**: 基于合同到期时间、使用量下降、活跃用户数等多维度评估续费风险
- **N+1 优化**: 使用 `selectinload`、子查询、批量获取等策略避免 N+1 查询问题
- **事务保护**: 跟进记录创建时使用事务保证原子性，同时写入审计日志
- **SQL 统计**: 查询接口返回实际触发的 SQL 次数及优化解释

## 项目结构

```
.
├── app.py              # Flask 应用入口和路由
├── models.py           # SQLAlchemy 数据模型
├── services.py         # 业务逻辑服务层
├── config.py           # 配置文件
├── session_tracker.py  # SQL 查询统计器
├── requirements.txt    # Python 依赖
├── sample_data.json    # 样例数据
└── README.md
```

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 健康检查

```bash
curl http://localhost:5000/health
```

预期响应：
```json
{
  "status": "ok",
  "message": "SaaS Renewal Risk API is running"
}
```

## API 接口说明

### 1. 导入样例数据

```bash
curl -X POST http://localhost:5000/api/import \
  -H "Content-Type: application/json" \
  -d @sample_data.json
```

或者使用内联 JSON：

```bash
curl -X POST http://localhost:5000/api/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的 SaaS 团队",
    "contacts": [
      {
        "import_key": "contact_1",
        "name": "张三",
        "email": "zhangsan@example.com",
        "phone": "13800138000",
        "role": "CTO"
      }
    ],
    "contracts": [
      {
        "import_key": "contract_1",
        "contact_import_key": "contact_1",
        "contract_number": "CN-2026-001",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "value": 50000.00,
        "status": "active"
      }
    ]
  }'
```

**请求体字段说明**:
- `name`: 租户名称（使用本系统的 SaaS 团队）
- `contacts`: 客户联系人列表
  - `import_key`: 用于关联合同的唯一标识
  - `name`: 联系人姓名
  - `email/phone/role`: 可选字段
- `contracts`: 客户合同列表
  - `contact_import_key`: 关联的联系人 import_key
  - `contract_number`: 合同编号（唯一）
  - `start_date/end_date`: 合同起止日期
  - `value`: 合同金额
- `usage_snapshots`: 使用量快照列表（可选）

**返回示例**:
```json
{
  "success": true,
  "message": "数据导入成功",
  "data": {
    "tenant_id": 1,
    "tenant_name": "SaaS 小团队",
    "contacts_imported": 3,
    "contracts_imported": 3
  }
}
```

### 2. 查询风险列表

```bash
# 查询所有风险
curl "http://localhost:5000/api/tenants/1/risks"

# 按风险等级筛选
curl "http://localhost:5000/api/tenants/1/risks?risk_level=high"

# 分页查询
curl "http://localhost:5000/api/tenants/1/risks?page=1&page_size=10"
```

**查询参数**:
- `risk_level`: 风险等级筛选
  - `low/medium/high/critical`: 按风险等级
  - `expiring`: 30 天内到期
  - `expired`: 已过期
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 20，最大 100）

**返回示例**:
```json
{
  "success": true,
  "data": [
    {
      "contract": {...},
      "contact": {...},
      "risk_info": {
        "risk_score": 90,
        "risk_level": "critical",
        "risks": [
          {"type": "expired", "message": "合同已过期 120 天"},
          {"type": "no_usage", "message": "当前无活跃用户"}
        ],
        "days_until_expiry": -120,
        "latest_usage": {...}
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 3,
    "total_pages": 1
  },
  "sql_stats": {
    "query_count": 8,
    "explanation": "本查询使用以下优化策略避免 N+1 问题：..."
  }
}
```

**关于 N+1 优化**:
返回的 `sql_stats.query_count` 显示本次查询实际执行的 SQL 次数。如果使用普通的循环访问关联对象方式（如 `contract.primary_contact`），查询次数将是 `2N+1`（N 为返回的合同数量）。本实现使用：
- `selectinload`: 预加载关联数据
- `IN` 查询: 批量获取所有关联记录
- 子查询: 获取最新使用量快照日期

### 3. 查询客户详情

```bash
# 注意：将 contact_id 替换为实际的联系人 ID
curl "http://localhost:5000/api/tenants/1/contacts/1"
```

**返回示例**:
```json
{
  "success": true,
  "data": {
    "contact": {...},
    "contracts": [...],
    "latest_risk_info": {...},
    "usage_trend": [
      {
        "date": "2026-03-01",
        "total_active_users": 120,
        "total_api_calls": 45000,
        "total_storage": 250.5
      }
    ],
    "recent_follow_ups": [...],
    "sql_stats": {"query_count": 4}
  }
}
```

### 4. 创建跟进记录

```bash
# 注意：将 contact_id 替换为实际的联系人 ID
curl -X POST "http://localhost:5000/api/tenants/1/contacts/1/follow-ups" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "phone",
    "content": "与客户张三沟通了续费事宜，客户表示预算紧张，需要重新评估。已承诺给出优惠方案。",
    "operator": "销售小王",
    "follow_up_date": "2026-05-05 14:30:00",
    "next_follow_up_at": "2026-05-10 10:00:00",
    "risk_level": "high"
  }'
```

**请求体字段**:
- `channel`: 跟进渠道（phone/email/meeting/other）
- `content`: 跟进内容（必填）
- `operator`: 操作人姓名
- `follow_up_date`: 跟进时间（格式：YYYY-MM-DD HH:MM:SS）
- `next_follow_up_at`: 下次跟进时间
- `risk_level`: 本次评估的风险等级

**事务保证**:
跟进记录和审计日志在同一个数据库事务中写入：
- ✅ 两者都成功 → 提交事务
- ❌ 任一失败 → 回滚事务，不会留下半截数据

**返回示例**:
```json
{
  "success": true,
  "message": "跟进记录创建成功",
  "data": {
    "follow_up": {...},
    "audit_log": {...}
  }
}
```

## 基础测试

### 测试 1：事务回滚验证

我们提供了一个测试接口来验证事务回滚机制：

```bash
# 测试事务回滚（simulate_error=true 时会模拟失败）
curl -X POST http://localhost:5000/api/test/transaction-rollback \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 1,
    "contact_id": 1,
    "simulate_error": true
  }'
```

**预期行为**:
1. API 尝试创建跟进记录
2. 在写入审计日志前抛出模拟异常
3. 数据库事务回滚
4. 跟进记录**不会**被保存

验证方法：
```bash
# 查询跟进记录数量，应该没有新增
# 可以通过客户详情接口查看 recent_follow_ups 是否为空
curl "http://localhost:5000/api/tenants/1/contacts/1"
```

### 测试 2：SQL 统计验证

```bash
# 先导入数据
curl -X POST http://localhost:5000/api/import \
  -H "Content-Type: application/json" \
  -d @sample_data.json

# 查询风险列表，观察 sql_stats.query_count
curl "http://localhost:5000/api/tenants/1/risks"
```

**注意**: 返回的 `sql_stats.explanation` 字段详细解释了如何避免 N+1 问题。

## 数据模型说明

| 模型 | 说明 |
|------|------|
| Tenant | 使用本系统的 SaaS 团队（租户） |
| Contact | 客户联系人 |
| Contract | 客户合同，关联到联系人 |
| UsageSnapshot | 产品使用量快照，用于风险分析 |
| FollowUp | 销售跟进记录 |
| AuditLog | 审计日志，记录关键操作 |

## 风险评估规则

风险评估基于以下维度：

| 维度 | 触发条件 | 风险分数 |
|------|----------|----------|
| 合同过期 | end_date < today | +100 |
| 即将到期 | 30 天内到期 | +50 |
| 无活跃用户 | active_users = 0 | +40 |
| 使用量下降 | 活跃用户下降 >= 30% | +30 |

风险等级：
- `critical`: 分数 >= 80
- `high`: 50 <= 分数 < 80
- `medium`: 20 <= 分数 < 50
- `low`: 分数 < 20

## 配置说明

环境变量：
- `DATABASE_URL`: 数据库连接（默认 `sqlite:///saas_renewal_risk.db`）
- `SECRET_KEY`: Flask 密钥
- `SQL_ECHO`: 设置为 `true` 可在控制台打印所有 SQL 语句

## 常见问题

**Q: 为什么查询返回的 SQL 次数有时会变化？**

A: 取决于数据量和是否存在关联数据。例如：
- 如果合同没有使用量快照，相关查询不会执行
- 如果使用了 `risk_level` 筛选，可能会有额外的过滤逻辑

**Q: 如何查看实际执行的 SQL 语句？**

```bash
# 启动时开启 SQL 日志
SQL_ECHO=true python app.py
```

**Q: 数据存在哪里？**

默认存储在当前目录的 `saas_renewal_risk.db` SQLite 文件中，可以删除后重启应用重置。

## 许可证

MIT License
