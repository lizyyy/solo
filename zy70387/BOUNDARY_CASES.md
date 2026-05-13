# 任务日志采样 API - 边界情况说明

## 一、主要边界（4 个核心边界）

### 边界 1：规则匹配优先级
**场景**：一条日志可能匹配多个采样规则（例如：既匹配 VIP 租户规则，又匹配高优先级任务规则）

**处理逻辑**：
- 规则按 `priority` 字段降序排序
- 优先匹配优先级最高的规则
- 若优先级相同，按创建顺序匹配（先创建的优先）

**关键代码**：`app/services/sampling_engine.py:42-47`
```python
self._rule_cache = (
    self.db.query(SamplingRule)
    .filter(SamplingRule.is_active == True)
    .order_by(SamplingRule.priority.desc())  # 降序排列
    .all()
)
```

**复查要点**：
- [ ] 确认规则查询时包含 `order_by(SamplingRule.priority.desc())`
- [ ] 确认遍历顺序是按优先级从高到低
- [ ] 测试场景：创建两个重叠规则，验证高优先级规则优先命中

---

### 边界 2：规则版本化与新老日志隔离
**场景**：规则更新后，已保存的老日志不应受到影响（包括采样决策、保留策略）

**处理逻辑**：
- 每条日志保存时记录 `rule_id` 和 `rule_version`
- 规则更新时 `version` 字段递增（+1）
- 老日志继续使用写入时的规则版本
- 清理服务根据日志中记录的 `rule_id` 查找对应规则的保留期

**关键代码**：
- `app/services/rule_service.py:58-59`（规则更新时版本递增）
- `app/services/log_service.py:95-97`（日志记录规则 ID 和版本）
- `app/services/cleanup_service.py:14-20`（清理时使用日志关联的规则）

**复查要点**：
- [ ] 确认规则更新时 `version += 1`
- [ ] 确认每条日志保存 `rule_id` 和 `rule_version`
- [ ] 确认清理服务使用日志记录的规则信息，而非当前活跃规则
- [ ] 测试场景：更新规则采样率，验证老日志的查询结果不变

---

### 边界 3：失败日志上下文窗口的回溯处理
**场景**：失败日志需要保留其前后的上下文日志，但这些上下文日志之前可能已被丢弃（未采样）

**当前实现限制**：
- 只能回溯**已保存**的日志作为失败上下文
- 若之前的日志因未命中采样被丢弃，则无法找回

**处理逻辑**：
- 写入失败日志时，查询同一 `task_id` 的最近成功日志
- 标记这些日志的 `is_failure_context = true`
- 关联 `context_for_failure_id` 字段

**关键代码**：`app/services/sampling_engine.py:108-128`
```python
def _get_failure_context_logs(
    self, log: TaskLogCreate, rule: SamplingRule
) -> List[TaskLog]:
    if not log.is_failure:
        return []
    
    # 只能查询已保存的日志
    recent_logs = (
        self.db.query(TaskLog)
        .filter(
            TaskLog.task_id == log.task_id,
            TaskLog.is_failure == False
        )
        .order_by(TaskLog.timestamp.desc())
        ...
    )
```

**复查要点**：
- [ ] 确认失败日志触发时查询的是已保存的日志（TaskLog 表）
- [ ] 确认上下文日志被正确标记 `is_failure_context = true`
- [ ] 确认 `context_for_failure_id` 正确关联到失败日志
- [ ] 测试场景：先写几条成功日志（确保被采样保存），再写失败日志，验证上下文被标记

---

### 边界 4：清理任务不删未过保留期的日志
**场景**：不同规则有不同的保留期（如 VIP 租户 30 天，普通租户 7 天），清理时需要精确判断

**处理逻辑**：
1. 先取所有活跃规则的最小保留期，快速筛选潜在过期日志
2. 对每条候选日志，根据其 `rule_id` 查找对应规则的实际保留期
3. 只有当日志时间 < 当前时间 - 实际保留期时才删除

**关键代码**：`app/services/cleanup_service.py:41-95`
```python
# 步骤 1：快速筛选（最小保留期）
min_retention = min([rule.retention_days for rule in rules] ...)
cutoff_date = now - timedelta(days=min_retention)
query = self._get_expired_logs_query(cutoff_date)

# 步骤 2：逐日志精确判断
for log in logs:
    retention_days = self._get_retention_days_for_log(log, rules)
    log_cutoff = now - timedelta(days=retention_days)
    
    if log.timestamp >= log_cutoff:
        stats['skipped_count'] += 1  # 跳过，未过期
        continue
    
    # 删除...
```

**复查要点**：
- [ ] 确认第一步使用**最小**保留期（min）
- [ ] 确认第二步对每条日志使用**实际**保留期
- [ ] 确认未过期日志被跳过（`skipped_count` 计数）
- [ ] 测试场景：创建两条日志，分别使用 7 天和 30 天规则，验证 8 天时只删前者

---

## 二、失败路径（1 个完整失败场景）

### 失败路径：任务执行过程 → 失败日志触发上下文保存

**完整执行流程**：

```
步骤 1: 任务开始 → 写入多条成功日志
         ↓
步骤 2: 部分日志命中采样 → 保存到 TaskLog 表（is_sampled=true）
         ↓
步骤 3: 任务出错 → 写入失败日志（is_failure=true）
         ↓
步骤 4: 采样引擎判断 → failure_always_save，必须保留
         ↓
步骤 5: 查询同一 task_id 的最近成功日志 → 作为上下文候选
         ↓
步骤 6: 标记这些日志的 is_failure_context=true
         ↓
步骤 7: 更新统计信息 → failure_context_logs +1
         ↓
步骤 8: 查询报告时 → 可看到失败日志及关联的上下文
```

**可能的故障点**：

| 步骤 | 可能问题 | 检查点 |
|------|----------|--------|
| 2 | 日志都未被采样 → 失败时无上下文可回溯 | 提高采样率或使用 100% 采样 |
| 5 | task_id 不匹配 → 找不到上下文日志 | 确认同一任务使用相同 task_id |
| 6 | 日志已被其他进程修改 → 并发问题 | 考虑加锁或事务隔离 |

**关键代码路径**：
- 入口：`app/api/routes.py:17-23` → `write_log`
- 核心：`app/services/log_service.py:90-184` → `write_log` 方法
- 失败检测：`app/services/sampling_engine.py:152-160`
- 上下文处理：`app/services/log_service.py:154-173`

**复查要点**：
- [ ] 写入失败日志后，检查数据库中 `is_failure=true` 的记录
- [ ] 检查该失败日志的 `context_for_failure_id` 关联
- [ ] 检查报告中的 `failure_context_logs` 计数
- [ ] 调用 `/api/v1/logs/failure-context/{id}` 验证上下文查询

---

## 三、重复执行路径（1 个完整去重场景）

### 重复执行路径：相同任务重复运行 → 相同日志被去重

**完整执行流程**：

```
场景：任务周期性运行，每次产生相同的警告日志（如"内存超过80%"）

步骤 1: 第 1 次写入 → content_hash = H(tenant_id:task_type:message:log_level)
         ↓
步骤 2: 检查去重窗口（default 300秒）内是否有相同 hash
         ↓
步骤 3: 无重复 → 保存日志，记录 content_hash
         ↓
步骤 4: 1 分钟后（在去重窗口内）第 2 次写入相同内容
         ↓
步骤 5: 计算相同的 content_hash
         ↓
步骤 6: 查询发现 300 秒内已有相同 hash
         ↓
步骤 7: 丢弃日志，reason = "duplicate_log"
         ↓
步骤 8: 记录到 DroppedLog 表，drop_reason = "duplicate_log"
         ↓
步骤 9: 统计信息中 duplicate_logs +1
         ↓
步骤 10: 6 分钟后（超过去重窗口）第 3 次写入相同内容
         ↓
步骤 11: 超出 300 秒窗口 → 视为新日志，可能被采样保存
```

**去重算法细节**：

Hash 计算（`app/services/sampling_engine.py:79-81`）：
```python
def _calculate_hash(self, log: TaskLogCreate) -> str:
    content = f"{log.tenant_id}:{log.task_type}:{log.message}:{log.log_level}"
    return hashlib.sha256(content.encode()).hexdigest()
```

去重判断（`app/services/sampling_engine.py:83-103`）：
```python
window_start = datetime.utcnow() - timedelta(
    seconds=rule.dedup_window_seconds  # 默认为 300 秒
)

existing = (
    self.db.query(TaskLog)
    .filter(
        TaskLog.task_id == log.task_id,      # 同一任务
        TaskLog.content_hash == content_hash, # 相同内容
        TaskLog.timestamp >= window_start     # 在窗口内
    )
    .first()
)
```

**关键代码路径**：
- Hash 计算：`app/services/sampling_engine.py:79-81`
- 去重检查：`app/services/sampling_engine.py:83-103`
- 去重决策：`app/services/sampling_engine.py:162-171`
- 丢弃记录：`app/services/log_service.py:112-119`

**复查要点**：
- [ ] 确认去重基于 `task_id + content_hash + 时间窗口`
- [ ] 确认去重窗口可配置（`dedup_window_seconds`）
- [ ] 确认去重可关闭（`dedup_enabled = false`）
- [ ] 测试场景 1：300 秒内写入相同内容 → 第 2 条被丢弃
- [ ] 测试场景 2：超过 300 秒写入相同内容 → 视为新日志
- [ ] 测试场景 3：不同 task_id 相同内容 → 不触发去重
- [ ] 检查 DroppedLog 表中 `drop_reason = 'duplicate_log'` 的记录
- [ ] 检查报告中 `duplicate_logs` 计数和 top_dropped_reasons

---

## 四、快速复查清单

运行以下命令/查询进行快速验证：

### 1. 规则验证
```bash
# 查看所有规则及其优先级
curl http://localhost:8000/api/v1/rules
```

### 2. 日志写入验证
```bash
# 写入一条失败日志
curl -X POST http://localhost:8000/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{"task_id":"test_fail_001","tenant_id":"t1","task_type":"sync","message":"测试失败","is_failure":true}'

# 验证保存
curl "http://localhost:8000/api/v1/logs?is_failure=true"
```

### 3. 报告验证
```bash
# 查看报告
curl http://localhost:8000/api/v1/reports
```

### 4. 数据库查询（如果使用 SQLite）
```bash
sqlite3 task_logs.db "SELECT * FROM task_logs LIMIT 5;"
sqlite3 task_logs.db "SELECT drop_reason, COUNT(*) FROM dropped_logs GROUP BY drop_reason;"
```

---

## 五、配置项速查

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DEFAULT_SAMPLE_RATE` | 0.1 | 默认采样率 10% |
| `DEFAULT_RETENTION_DAYS` | 7 | 默认保留 7 天 |
| `FAILURE_CONTEXT_WINDOW` | 3 | 默认失败上下文窗口 |
| `sample_rate` (规则级别) | 0.1 | 可覆盖默认值 |
| `dedup_window_seconds` | 300 | 去重窗口 5 分钟 |
| `dedup_enabled` | true | 是否启用去重 |
| `context_window_before` | 3 | 失败前保留 3 条 |
| `context_window_after` | 1 | 失败后保留 1 条 |
| `retention_days` | 7 | 规则级别保留期 |

---

*文档版本：v1.0*
*最后更新：2026-05-13*
