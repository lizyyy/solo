# API 密钥配额服务

专注于开放平台 API 密钥的配额管理、IP 规则和封禁追踪的后端服务。

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── database.py            # 数据库连接
│   ├── models.py              # 数据模型
│   ├── main.py                # FastAPI 应用入口
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── keys.py            # 密钥管理 API
│   │   └── reports.py         # 报表 API
│   └── services/
│       ├── __init__.py
│       ├── decision_rules.py  # 核心决策规则（可测试的纯函数）
│       ├── key_service.py     # 密钥服务
│       └── report_service.py  # 报表服务
├── tests/
│   ├── __init__.py
│   └── test_decision_rules.py # 核心决策逻辑测试（30+ 测试用例）
├── requirements.txt
├── pytest.ini
└── README.md
```

## 快速开始

### 安装依赖

```bash
pip3 install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 运行测试

```bash
python3 -m pytest tests/ -v
```

---

## 核心功能

### 1. 密钥台账

管理 API 密钥的生命周期，包括：
- 密钥创建、查询、列表
- 密钥状态管理（active/inactive/suspended/banned）
- 密钥与应用、开发者的关联

### 2. 配额桶

支持多周期配额管理：
- 分钟级配额
- 小时级配额
- 天级配额
- 支持全局配额和接口级配额

### 3. IP 规则

黑白名单机制：
- IP 白名单（启用后仅白名单 IP 可访问）
- IP 黑名单（永远拒绝）
- 支持规则过期时间

### 4. 封禁与解封

- 临时封禁 (suspended)
- 永久封禁 (banned)
- 解封记录追踪
- 封禁历史可查询

### 5. 调用明细

每次成功调用都记录：
- 调用接口
- 来源 IP
- 状态码
- 响应时间
- 时间戳

### 6. 开发者报表

提供数据统计：
- 密钥概览
- 调用成功率
- 配额使用情况
- 主要拒绝原因
- 每日调用趋势
- 封禁历史

---

## 决策流程

请求评估按以下顺序执行检查：

```
┌─────────────────┐
│ 1. 密钥状态检查  │ ← 第一个检查点
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 2. IP 规则检查   │ ← 第二个检查点
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 3. 配额检查      │ ← 第三个检查点
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 4. 可疑模式检测  │ ← 第四个检查点
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│   放行请求       │
└─────────────────┘
```

---

## 处理成功条件

以下情况请求会**自动通过**并放行：

| 检查点 | 成功条件 | 测试代码 |
|--------|----------|----------|
| 密钥状态 | `status == 'active'` | `test_active_key_returns_none` |
| IP 规则 | 不在黑名单中；或启用白名单时 IP 在白名单中 | `test_no_rules_and_no_restriction_passes`, `test_whitelist_restriction_in_list_passes` |
| 配额检查 | 所有活跃配额桶的 `used < limit` | `test_under_quota_passes` |
| 可疑模式 | 5 分钟内拒绝次数 ≤ 5，且独立 IP 数 ≤ 10 | `test_normal_pattern_passes`, `test_at_limit_passes` |

**完整通过测试**: `test_normal_request_approved`

---

## 自动拒绝条件

以下情况请求会**直接拒绝**，不会进入人工复核：

| 拒绝原因 | 触发条件 | 下一步操作指引 |
|----------|----------|----------------|
| `key_inactive` | 密钥状态为 `inactive` | 请登录控制台查看密钥状态。如果是新创建的密钥，可能需要等待 1-2 分钟生效。 |
| `key_suspended` | 密钥状态为 `suspended` | 请查看封禁记录中的解封时间，或提交申诉工单。申诉时请提供业务说明。 |
| `key_banned` | 密钥状态为 `banned` | 请联系客服人员，准备完整的业务说明和调用场景描述。 |
| `ip_blocked` | IP 在黑名单中（黑名单优先级高于白名单） | 请联系管理员，确认 IP 封禁原因。可提供近 30 分钟的调用记录辅助排查。 |
| `ip_not_whitelisted` | 启用了白名单限制，但 IP 不在白名单中 | 请在密钥管理页面添加当前 IP 到白名单，或关闭 IP 白名单限制。 |
| `quota_exceeded` | 任一配额桶的 `used >= limit` | 请查看配额台账，确认当前各周期已用/总量。如需提升配额，请在控制台提交申请。 |

**拒绝时的返回结构**:
```json
{
  "approved": false,
  "decision": {
    "result": "rejected",
    "reason": "quota_exceeded",
    "details": "minute 配额已满 (已用 100/100)，将在 30 秒后重置",
    "next_step": "请查看配额台账..."
  },
  "current_checkpoint": "配额检查",
  "previous_decision": {
    "id": 1,
    "request_id": "xxx",
    "result": "approved",
    "reason": "normal",
    "details": "请求通过所有检查",
    "created_at": "2024-01-01T10:00:00Z"
  },
  "decision_log_id": 2
}
```

---

## 人工复核触发条件

以下情况请求会**进入人工复核**，不会立即拒绝：

| 原因 | 触发条件 | 说明 |
|------|----------|------|
| `suspicious_pattern` | 5 分钟内拒绝次数 > 5 | 短时间内多次被拒绝，可能是配置问题或异常调用 |
| `suspicious_pattern` | 单一密钥 5 分钟内从 > 10 个独立 IP 访问 | 可能是密钥泄露或分布式攻击 |

**人工复核时的返回结构**:
```json
{
  "approved": false,
  "decision": {
    "result": "pending_review",
    "reason": "suspicious_pattern",
    "details": "短时间内被拒绝 10 次，超过自动审批阈值 5",
    "next_step": "系统已创建人工复核工单，请等待管理员审核"
  },
  "current_checkpoint": "可疑模式检测",
  "previous_decision": { ... },
  "decision_log_id": 5
}
```

**系统行为**:
1. 自动创建 `ManualReview` 工单
2. 状态为 `pending`
3. 等待管理员审核通过或拒绝

---

## 排查指南

当请求被拒绝时，按以下步骤排查：

### 第一步：查看当前卡点

检查返回的 `current_checkpoint` 字段，确定在哪个检查点被拒绝：

| current_checkpoint | 排查方向 |
|-------------------|----------|
| 密钥状态检查 | 查看密钥是否激活、是否被封禁 |
| IP 规则检查 | 检查 IP 黑白名单配置 |
| 配额检查 | 查看各周期配额使用情况 |
| 可疑模式检测 | 查看是否触发异常模式，需要人工复核 |
| 正常通过 | 请求已放行 |

### 第二步：查看前一次决策记录

检查返回的 `previous_decision` 字段，可以了解：
- 上一次请求是通过还是拒绝
- 上一次拒绝的原因
- 是否存在持续的问题

**查看完整历史**: 调用 `GET /api/v1/keys/{key_value}/decision-history`

### 第三步：按检查点顺序排查

```
遇到拒绝 → 查看 current_checkpoint → 按对应方向排查

例如：
current_checkpoint = "配额检查"
  → 查看配额台账 (GET /api/v1/reports/dashboard/{developer_id})
  → 确认哪个周期的配额已满
  → 等待重置或申请提升配额
```

### 第四步：查看详细数据

| 问题 | 查看接口 |
|------|----------|
| 密钥状态 | `GET /api/v1/keys/{key_value}` |
| 配额使用 | `GET /api/v1/reports/dashboard/{developer_id}` |
| 调用明细 | 查看 `CallLog` 表（可扩展 API） |
| 决策历史 | `GET /api/v1/keys/{key_value}/decision-history` |
| 封禁历史 | `GET /api/v1/reports/suspensions/{developer_id}` |

---

## 决策追踪机制

每次请求都会记录决策日志，包含：

| 字段 | 说明 |
|------|------|
| `request_id` | 请求唯一标识 |
| `result` | 决策结果 (approved/rejected/pending_review) |
| `reason` | 决策原因 |
| `details` | 详细说明 |
| `ip_address` | 来源 IP |
| `api_endpoint` | 调用接口 |
| `previous_decision_id` | 指向上一次决策 |
| `is_latest` | 是否为最新决策 |

**链表结构**: 每次决策都通过 `previous_decision_id` 指向上一次，形成完整的决策链条。

---

## 核心 API 接口

### 密钥管理

```bash
# 创建密钥
POST /api/v1/keys
{
  "app_id": "my-app",
  "developer_id": "dev-123",
  "description": "测试密钥",
  "is_ip_restricted": false,
  "minute_limit": 100,
  "hour_limit": 1000,
  "day_limit": 10000
}

# 查询密钥
GET /api/v1/keys/{key_value}

# 列出开发者密钥
GET /api/v1/keys/developer/{developer_id}

# 更新密钥状态（封禁/解封）
POST /api/v1/keys/{key_value}/status
{
  "status": "suspended",
  "reason": "异常调用模式",
  "operator": "admin"
}
```

### IP 规则

```bash
# 添加 IP 规则
POST /api/v1/keys/{key_value}/ip-rules
{
  "ip_address": "192.168.1.1",
  "action": "whitelist",  # 或 "blacklist"
  "description": "办公 IP",
  "expires_in_minutes": null  # 永久有效
}

# 删除 IP 规则
DELETE /api/v1/keys/{key_value}/ip-rules/{rule_id}
```

### 配额检查（核心网关接口）

```bash
# 检查并消耗配额
POST /api/v1/keys/check-quota
{
  "api_key": "ak-XXXXXXXX",
  "api_endpoint": "/api/v1/users",
  "ip_address": "192.168.1.1"
}
```

### 报表

```bash
# 开发者看板
GET /api/v1/reports/dashboard/{developer_id}?days=7

# 封禁历史
GET /api/v1/reports/suspensions/{developer_id}?limit=20
```

---

## 可测试的核心逻辑

所有核心判断逻辑都在 `app/services/decision_rules.py` 中，以纯函数形式实现：

| 函数 | 职责 | 测试覆盖 |
|------|------|----------|
| `check_key_status()` | 检查密钥状态 | 5 个测试用例 |
| `check_ip_rules()` | 检查 IP 规则 | 6 个测试用例 |
| `check_quota()` | 检查配额桶 | 4 个测试用例 |
| `check_suspicious_pattern()` | 检测可疑模式 | 4 个测试用例 |
| `evaluate_request()` | 完整评估流程 | 5 个测试用例 |
| `is_auto_approvable()` | 判断是否可自动通过 | - |
| `requires_manual_review()` | 判断是否需要人工复核 | - |
| `get_checkpoint_order()` | 获取检查点顺序 | - |

这些函数不依赖数据库，可以独立测试。运行 `python3 -m pytest tests/ -v` 验证所有逻辑。

---

## 数据模型

### APIKey（密钥台账）
- `id`: 主键
- `key_value`: 密钥值（唯一）
- `app_id`: 应用 ID
- `developer_id`: 开发者 ID
- `status`: 状态 (active/inactive/suspended/banned)
- `is_ip_restricted`: 是否启用 IP 白名单

### QuotaBucket（配额桶）
- `api_key_id`: 关联密钥
- `api_endpoint`: 接口（null 表示全局）
- `period`: 周期 (minute/hour/day)
- `limit`: 限额
- `used`: 已用
- `reset_at`: 重置时间

### IPRule（IP 规则）
- `api_key_id`: 关联密钥
- `ip_address`: IP 地址
- `action`: whitelist/blacklist
- `expires_at`: 过期时间

### DecisionLog（决策日志）
- `api_key_id`: 关联密钥
- `request_id`: 请求 ID
- `result`: 决策结果
- `reason`: 决策原因
- `previous_decision_id`: 上一次决策
- `is_latest`: 是否最新

### CallLog（调用明细）
- `api_key_id`: 关联密钥
- `api_endpoint`: 接口
- `ip_address`: 来源 IP
- `status_code`: 状态码
- `request_timestamp`: 时间戳

### SuspensionRecord（封禁记录）
- `api_key_id`: 关联密钥
- `suspension_type`: 封禁类型
- `reason`: 原因
- `suspended_at`: 封禁时间
- `lifted_at`: 解封时间
- `is_active`: 是否生效中

### ManualReview（人工复核）
- `api_key_id`: 关联密钥
- `decision_log_id`: 关联决策日志
- `status`: pending/approved/rejected
- `reason`: 复核原因
- `reviewed_by`: 审核人
- `reviewed_at`: 审核时间

---

## 配置说明

在 `.env` 文件中可配置：

```env
DATABASE_URL=sqlite:///./quota_service.db
DEFAULT_QUOTA_PER_MINUTE=100
DEFAULT_QUOTA_PER_HOUR=1000
DEFAULT_QUOTA_PER_DAY=10000
AUTO_APPROVE_LIMIT=5          # 自动审批拒绝次数阈值
HIGH_RISK_THRESHOLD=5.0
```

---

## 总结

本服务的设计原则：

1. **决策透明**: 每次拒绝都说明原因、卡点和下一步
2. **历史可追溯**: 通过链表结构追踪完整决策历史
3. **规则可测试**: 核心判断逻辑独立，30+ 测试用例覆盖
4. **异常可复核**: 可疑模式进入人工审核，不误伤正常业务
5. **排查有指引**: 普通用户按文档能自助定位问题

普通使用者遇到拒绝时：
1. 看 `current_checkpoint` 知道卡在哪一步
2. 看 `next_step` 知道下一步该做什么
3. 看 `previous_decision` 了解历史情况
4. 查本文档的排查指南找到对应接口
