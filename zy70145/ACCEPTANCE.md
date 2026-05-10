# 慢查询认领 API 验收点

## 一、主流程验收

### 1. 慢查询采集与指纹归并
**验收点**：连续发送两条结构相同、参数不同的 SQL，应归并到同一个指纹。

**操作步骤**：
1. 发送 SQL1: `SELECT * FROM users WHERE id = 1` (execution_time=2000)
2. 发送 SQL2: `SELECT * FROM users WHERE id = 999` (execution_time=3500)
3. 查询指纹列表

**预期结果**：
- 返回的 fingerprintId 相同
- total_count = 2
- avg_execution_time = 2750
- max_execution_time = 3500

---

### 2. 负责人认领流程
**验收点**：未认领的指纹可以被负责人认领，状态正确流转。

**操作步骤**：
1. 创建负责人 "zhangsan"
2. 发送一条慢查询
3. 用 zhangsan 的 id 认领该指纹
4. 查询指纹详情

**预期结果**：
- 认领前 status = "pending", owner_id = null
- 认领后 status = "claimed", owner_id = zhangsan.id
- status_history 中存在一条 pending → claimed 的记录

---

### 3. 优化与复测闭环
**验收点**：优化记录提交后，复测通过自动更新状态为 verified。

**操作步骤**：
1. 认领一个指纹
2. 创建优化记录（before_sql, after_sql, description）
3. 提交复测结果（before_time=2000, after_time=200）
4. 查询指纹状态和历史

**预期结果**：
- 优化创建后：status = "in_progress"
- 复测有改善后：status = "verified"
- improvement_percent = 90%
- 状态历史完整记录：pending → claimed → in_progress → verified

---

### 4. 周报数据一致性
**验收点**：周报统计数字与实际数据一致。

**操作步骤**：
1. 在本周内发送 5 条慢查询（2 个指纹）
2. 完成 1 个指纹的完整优化闭环
3. 生成无效数据触发 1 条异常
4. 调用 /api/reports/weekly

**预期结果**：
- summary.totalSlowQueries = 5
- summary.newFingerprints = 2
- summary.verifiedImprovements = 1
- summary.unresolvedExceptions = 1
- summary.pendingTasks >= 1（新指纹会触发分析任务）

---

## 二、异常处理验收

### 5. 边界数据不静默丢失
**验收点**：无效输入数据应记录到异常表，可查询。

**操作步骤**：
1. 发送空 SQL: `{ sql: "", execution_time: 1000 }`
2. 发送负执行时间: `{ sql: "SELECT 1", execution_time: -1 }`
3. 发送缺少字段: `{ sql: "SELECT 1" }`
4. 调用 /api/operations/exceptions/unresolved

**预期结果**：
- 每个无效请求返回 400 状态码
- 异常表中存在 3 条记录（type = validation_error）
- 每条异常记录包含：source、raw_data（原始数据）、error_message

---

### 6. 指纹生成失败的降级处理
**验收点**：指纹生成失败时，原始查询仍被保存（fingerprint_id = null）。

**操作步骤**：
1. 发送极短 SQL: `{ sql: "a", execution_time: 1000 }`
2. 检查异常记录
3. 直接查询 slow_queries 表（或通过后续扩展的 API）

**预期结果**：
- 异常记录 type = fingerprint_failed
- slow_queries 中存在该记录，fingerprint_id = null
- 原始 SQL 完整保存，未丢失

---

### 7. 无效关联引用的防护
**验收点**：认领不存在的指纹或负责人应返回明确错误。

**操作步骤**：
1. 认领不存在的指纹: POST /api/fingerprints/99999/claim
2. 用不存在的负责人认领: POST /api/fingerprints/1/claim { owner_id: 99999 }

**预期结果**：
- 返回 404 或 400 状态码
- error 字段包含明确的 "not found" 提示信息
- 数据库状态未被意外修改

---

## 三、数据一致性验收

### 8. 状态变更历史可追溯
**验收点**：每次状态变更都有历史记录，可审计。

**操作步骤**：
1. 完成一个指纹的完整生命周期：pending → claimed → in_progress → verified
2. 查询指纹详情的 history 字段

**预期结果**：
- history 至少包含 3 条记录
- 每条记录包含: from_status, to_status, changed_by, created_at
- 时间戳递增，状态流转合理

---

### 9. 统计指标原子更新
**验收点**：批量采集时，指纹的统计数据（count, avg, max）计算正确。

**操作步骤**：
1. 批量发送 3 条同类 SQL，执行时间分别为 1000, 2000, 3000
2. 查询该指纹的统计数据

**预期结果**：
- total_count = 3
- avg_execution_time = 2000 (精确或可接受的浮点精度)
- max_execution_time = 3000
- 不会出现并发更新导致的数据丢失

---

### 10. 复测结果影响优化状态
**验收点**：复测改善/恶化正确反映到状态。

**操作步骤**：
1. 创建优化记录 A
2. 提交复测 A1: before=2000, after=500 (改善 75%)
3. 创建另一个优化记录 B
4. 提交复测 B1: before=2000, after=3000 (恶化 50%)

**预期结果**：
- A 的 rerun status = "improved", 优化状态 = "verified"
- B 的 rerun status = "regressed", 优化状态保持 "in_progress"
- B 不会错误地标记为 verified

---

## 四、日志与可观测性验收

### 11. 关键操作有日志输出
**验收点**：无需读源码，通过控制台日志可追踪关键事件。

**操作步骤**：
1. 启动服务
2. 执行一次完整的采集→认领→优化→复测流程
3. 观察控制台输出

**预期看到的日志关键字**：
- "Slow Query Tracker API running on"
- "POST /api/slow-queries/ingest 200"
- "New fingerprint created"
- "Task queued: fingerprint_analysis"
- "Fingerprint claimed"
- "Optimization created"
- "Rerun recorded"
- "Status change: fingerprint#X pending -> claimed"

**不应需要**：
- 无需阅读 source code 才能了解发生了什么
- 关键状态变更应有明确的 INFO 级别日志
