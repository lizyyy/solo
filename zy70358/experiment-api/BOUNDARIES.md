# 服务端实验分桶 API - 边界与复查指南

## 一、主要边界条件

### 1.1 实验状态机边界
- **状态流转**: draft → running → paused → running → stopped
- **不可跨越**: draft 不能直接到 stopped；stopped 不能恢复；paused 只能回 running
- **关键约束**:
  - 只有 `draft` 状态可以启动
  - 只有 `running` 状态可以暂停、调整流量、停止
  - 只有 `paused` 状态可以恢复
  - `stopped` 是终态，不可逆

### 1.2 流量比例边界
- **有效范围**: 0 ≤ traffic_ratio ≤ 100
- **版本控制**: 每次调整 traffic_ratio_version 自增
- **特殊语义**:
  - traffic_ratio = 0: 不分配任何用户（但可以创建实验）
  - 启动时必须 traffic_ratio > 0
  - 运行中可以调到 0（相当于暂停分配但实验状态仍为 running）

### 1.3 互斥组边界
- **互斥范围**: 同一 mutex_group 下的所有 running 实验互斥
- **冲突判定**:
  - 冲突检查只针对当前 running 的实验
  - 已 stopped 或 paused 的实验不参与互斥判定
  - 互斥组为 null 的实验不参与任何互斥
- **记录策略**:
  - 互斥冲突会记录一条 UserAssignment，group_name = null，mutex_conflict = true
  - 这样可以统计有多少用户因为互斥被排除

### 1.4 分桶稳定边界
- **核心机制**: 用户ID + 实验ID → 固定哈希桶 (0-9999)
- **分桶公式**:
  ```python
  hash(MD5(user_id + ":" + experiment_id)) % 10000 → bucket
  threshold = (traffic_ratio / 100) * 10000
  if bucket < threshold: 进入实验
  ```
- **稳定保证**:
  - 同一用户同一实验始终哈希到同一个 bucket
  - 已分配的用户再次请求直接返回历史记录，不重新计算
  - 流量比例从 50% 调到 80%：
    - bucket < 5000 的用户：保持原有分组（不跳组）
    - bucket 在 5000-8000 的用户：新加入实验
    - bucket ≥ 8000 的用户：仍不参与

### 1.5 指标上报边界
- **幂等键**: (user_id, experiment_id, metric_name)
- **约束**:
  - 必须先有有效的 UserAssignment（group_name 不为 null）
  - 同一用户同一实验同一指标只能上报一次
  - 后续重复上报返回第一次的值，忽略新值

### 1.6 停止后的边界
- **新用户**: 不再分配，返回 reason="experiment_stopped"
- **历史用户**: 可以查询，返回原有分组（is_new=false）
- **指标上报**: 理论上仍可上报（取决于业务需求，当前实现允许）
- **结果查询**: 完整保留所有历史数据

---

## 二、一个失败路径分析

### 场景：用户同时请求两个互斥实验

**路径步骤**:
1. 实验 A (mutex_group="price_page") 已运行
2. 实验 B (mutex_group="price_page") 已运行
3. 用户 user_001 先请求实验 A
   → 分配成功，记录 UserAssignment(A, group="control", mutex_conflict=false)
4. 用户 user_001 再请求实验 B
   → 检查互斥：发现同一 mutex_group 下有其他 running 实验
   → 记录 UserAssignment(B, group=null, mutex_conflict=true)
   → 返回 reason="mutex_conflict"

**失败点检查清单**:
- [ ] 是否正确检查了其他 running 状态的实验？
- [ ] 是否排除了 stopped/paused 的实验？
- [ ] 是否记录了冲突（便于统计被排除的用户数）？
- [ ] 第二次请求是否正确返回冲突，而不是随机分配？
- [ ] 第一次的分配记录是否保持不变？

**验证 curl**:
```bash
# 先分配到A
curl -X POST "http://localhost:5000/experiments/A/assign" -d '{"user_id":"user_001"}'

# 再分配到B（应该冲突）
curl -X POST "http://localhost:5000/experiments/B/assign" -d '{"user_id":"user_001"}'
# 期望: group_name=null, reason="mutex_conflict", mutex_conflict=true
```

---

## 三、一次重复执行路径分析

### 场景：同一用户多次请求同一实验

**路径步骤**:
1. 用户 user_001 第一次请求实验 price_page_v1
   → 检查数据库：无记录
   → 计算哈希 bucket
   → 判断是否在流量中
   → 分配到 treatment 组
   → 写入 UserAssignment
   → 返回 is_new=true

2. 用户 user_001 第二次请求同一实验
   → 检查数据库：有记录
   → **直接返回历史记录**
   → 不重新计算哈希
   → 不检查互斥（历史记录有效）
   → 返回 is_new=false

**重复执行检查清单**:
- [ ] 数据库唯一约束是否生效？(unique_user_experiment)
- [ ] 第二次请求是否跳过分桶计算？
- [ ] 返回的 group_name 是否与第一次完全一致？
- [ ] assigned_at 是否保持第一次的时间戳？
- [ ] is_new 标识是否正确区分新旧用户？

**关键代码验证点** (`app.py:244-257`):
```python
existing = UserAssignment.query.filter_by(
    user_id=user_id,
    experiment_id=exp_id
).first()

if existing:
    return jsonify({
        'group_name': existing.group_name,
        'assigned_at': existing.assigned_at.isoformat(),
        'is_new': False
    }), 200
```

**验证 curl**:
```bash
# 第一次
curl -X POST "http://localhost:5000/experiments/price_page_v1/assign" \
  -d '{"user_id":"user_001"}'
# 期望: is_new=true, 记录 assigned_at

# 第二次（立即重试）
curl -X POST "http://localhost:5000/experiments/price_page_v1/assign" \
  -d '{"user_id":"user_001"}'
# 期望: is_new=false, assigned_at 与第一次相同, group_name 相同

# 第三次（流量调整后）
curl -X PUT "http://localhost:5000/experiments/price_page_v1/traffic" \
  -d '{"traffic_ratio":10}'
curl -X POST "http://localhost:5000/experiments/price_page_v1/assign" \
  -d '{"user_id":"user_001"}'
# 期望: group_name 仍与第一次相同（不跳组）
```

---

## 四、复查 Checklist

### 4.1 启动前检查
- [ ] 实验状态是 draft
- [ ] traffic_ratio > 0
- [ ] groups 比例和为 100

### 4.2 分桶时检查
- [ ] 用户是否已存在分配？
- [ ] 实验状态是否为 running？
- [ ] 是否存在互斥冲突？
- [ ] 哈希 bucket 是否在流量阈值内？
- [ ] 确定具体实验分组

### 4.3 指标上报检查
- [ ] 用户是否有有效分配（group_name 非空）？
- [ ] 该用户该指标是否已上报过？
- [ ] 数值是否为有效数字？

### 4.4 停止后检查
- [ ] 新用户是否不再分配？
- [ ] 历史用户查询是否返回旧记录？
- [ ] 结果查询是否包含完整数据？
- [ ] timeline 是否记录了 stopped 事件？

---

## 五、数据模型一致性约束

| 表 | 唯一约束 | 用途 |
|---|---------|------|
| UserAssignment | (user_id, experiment_id) | 保证同一用户同一实验只有一条记录 |
| MetricReport | (user_id, experiment_id, metric_name) | 保证指标上报幂等 |
| Experiment | id (主键) | 实验ID唯一 |

---

## 六、状态转换验证

```
                    ┌─────────┐
                    │  draft  │
                    └────┬────┘
                         │ start (traffic_ratio > 0)
                         ▼
    ┌──────────────────────────────────┐
    │            running               │◄─────────┐
    │  可以: 分配、调流量、暂停、停止   │          │
    └───────┬───────────────┬──────────┘          │
            │ pause         │ stop                │ resume
            ▼               ▼                     │
       ┌─────────┐     ┌─────────┐                │
       │ paused  │     │ stopped │                │
       └────┬────┘     └─────────┘                │
            │                                     │
            └─────────────────────────────────────┘
```
