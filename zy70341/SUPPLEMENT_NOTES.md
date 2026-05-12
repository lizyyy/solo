# 交易风控灰名单 API - 补充说明

## 一、主要边界条件

### 1. 用户状态层级边界
```
正常用户
    ↓
灰名单（临时限额、观察期）
    ↓
黑名单（永久禁止）
```
- **边界规则**：
  - 已在黑名单中的用户无法再加入灰名单（返回错误码 `ALREADY_BLACKLISTED`）
  - 已在灰名单中的用户再次触发风险时，只会收紧限额（取最小值），不会新增灰名单记录
  - 灰名单状态只能通过「人工复核」或「自动过期」解除，风险事件不会被删除

### 2. 限额叠加边界
- **单一风险**：按风险类型配置的默认限额
- **多风险叠加**：取所有有效限额的最小值（更严格）
- **配置优先级**：人工配置的限额 > 风险类型默认限额

### 3. 自动过期边界
- 自动过期只改变**当前限制状态**（表现为过期），**不删除**任何风险事件或灰名单历史记录
- 自动过期的灰名单记录在查询时会显示 `status: "expired"`，但仍保留在数据库中
- 自动过期触发时机：需要调用 `/api/v1/auto-expire/check` 接口（可定时任务触发）

### 4. 复核决策边界
| 决策 | 效果 | 数据保留 |
|------|------|----------|
| `approve`（通过） | 灰名单状态改为 `reviewed_removed`，限制解除 | 保留所有风险事件 + 复核记录+解除依据 |
| `escalate`（升级） | 灰名单状态改为 `escalated_to_blacklist`，同时创建黑名单记录 | 保留所有历史 + 升级证据 |
| `reject`（拒绝） | 维持当前限制 | 新增一条拒绝复核记录 |

### 5. 幂等边界
- 风险事件通过 `event_id` 保证幂等
- 同一 `event_id` 重复写入时返回 `is_duplicate: true`，不会重复创建记录
- 灰名单同一用户同一状态下重复添加只会更新限额，不会创建新记录

---

## 二、一个失败路径：黑名单用户尝试加灰名单

### 路径描述
用户已经被升级到黑名单，风控系统再次尝试将该用户加入灰名单。

### 执行步骤
1. **前置状态**：用户 `user_999` 已在黑名单中（通过 `escalate` 决策升级）
2. **触发操作**：调用 `/api/v1/graylist` 接口，传入 `user_id: "user_999"`
3. **系统检查**：`add_to_graylist()` 函数首先查询 `BlacklistEntry`
4. **失败结果**：返回 `success: false`，错误码 `ALREADY_BLACKLISTED`

### 关键代码位置
`services.py:50-53`
```python
def add_to_graylist(user_id, trigger_event_id=None, reason=None, custom_config=None):
    blacklisted = BlacklistEntry.query.filter_by(user_id=user_id).first()
    if blacklisted:
        return {'success': False, 'error': '用户已在黑名单中', 'code': 'ALREADY_BLACKLISTED'}
```

### 影响
- 黑名单是最终状态，优先级最高
- 任何针对黑名单用户的灰名单操作都会被拒绝
- 风控效果统计中不会计入此次尝试

### 排查要点
- 检查用户当前是否已在黑名单：`/api/v1/users/<user_id>/risk-timeline`
- 查看黑名单加入原因：`is_blacklisted: true` 字段
- 如需恢复，需要额外的黑名单移除机制（当前版本未实现）

---

## 三、一次重复执行路径：重复写入同一条风险事件

### 路径描述
由于网络重试或消息队列重复消费，同一条风险事件被写入多次。

### 执行步骤

#### 第一次执行（正常写入）
1. **请求**：`POST /api/v1/risk-events`，`event_id: "evt_retry_001"`
2. **系统检查**：`create_risk_event()` 查询 `RiskEvent` 表
3. **结果**：未找到记录，创建新的风险事件
4. **返回**：`success: true, is_duplicate: false`，HTTP 状态码 201
5. **统计**：`DailyRiskStats.total_events` += 1

#### 第二次执行（重复写入）
1. **请求**：相同的 `event_id: "evt_retry_001"`
2. **系统检查**：`create_risk_event()` 再次查询，发现记录已存在
3. **结果**：直接返回现有记录，不创建新记录
4. **返回**：`success: true, is_duplicate: true`，HTTP 状态码 200
5. **统计**：`DailyRiskStats.total_events` **不增加**

### 关键代码位置
`services.py:28-31`
```python
def create_risk_event(data):
    existing = RiskEvent.query.filter_by(event_id=data['event_id']).first()
    if existing:
        return {'success': True, 'data': existing.to_dict(), 'is_duplicate': True}
```

### 幂等保障要点
- `event_id` 字段有 `unique=True` 数据库约束
- 应用层先查询后插入，依赖唯一索引兜底
- 重复请求返回相同数据，但 `is_duplicate` 标识可用于调用方判断
- 统计指标只在首次写入时更新，避免重复计数

### 调用方处理建议
```python
result = call_risk_event_api(event_data)
if result['is_duplicate']:
    logger.info(f"事件 {event_id} 已存在，跳过处理")
else:
    logger.info(f"新事件 {event_id} 创建成功")
```

---

## 四、API 接口速查

| 接口 | 方法 | 功能 | 幂等 |
|------|------|------|------|
| `/api/v1/risk-events` | POST | 写入风险事件 | ✅（按 event_id）|
| `/api/v1/graylist` | POST | 加入灰名单/更新限额 | ✅（同用户只更新）|
| `/api/v1/transactions/evaluate` | POST | 交易试算 | ✅（只读查询）|
| `/api/v1/users/<id>/review` | POST | 人工复核 | ❌（每次都创建记录）|
| `/api/v1/users/<id>/risk-timeline` | GET | 查询风险时间线 | ✅ |
| `/api/v1/graylist/<id>` | GET | 查询灰名单详情 | ✅ |
| `/api/v1/stats/daily` | GET | 每日风控效果 | ✅ |
| `/api/v1/auto-expire/check` | POST | 检查自动过期 | ❌（触发统计更新）|
