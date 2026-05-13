# 多租户任务隔离 CLI - 补充说明文档

## 一、主要边界条件

### 1.1 租户配额边界

**边界定义**：
- 每个租户有 `concurrency_quota`（并发配额），限制同时运行的任务数
- 大租户 A 配额=4，权重=3；小租户 C 配额=2，权重=1
- 有效配额 = 基准配额 × (1 - 配额减少比例)，最少为 1

**关键代码位置**：
- `src/mt_scheduler/scheduler.py:30-41` - `get_effective_quota()` 方法
- `src/mt_scheduler/scheduler.py:158-180` - `start_task()` 中检查配额

**复查要点**：
1. 当租户运行任务数达到有效配额时，新任务必须等待
2. 大租户任务再多，也不能占用超过自己的配额
3. 小租户始终有自己的配额槽位（不会被完全饿死）

**测试验证**：
```bash
# 提交 15 个大租户任务，观察运行数不会超过 4
mt-scheduler status
# 查看 "运行中" 列 <= "有效配额" 列
```

---

### 1.2 任务队列大小边界

**边界定义**：
- 每个租户有 `max_queue_size` 限制
- 大租户 A=200，中租户 B=100，小租户 C=50
- 超过时拒绝提交

**关键代码位置**：
- `src/mt_scheduler/scheduler.py:69-74` - `submit_task()` 中检查队列大小

**复查要点**：
1. 统计租户 PENDING 状态任务数
2. 等于 max_queue_size 时返回错误
3. 其他租户不受影响

---

### 1.3 优先级与权重边界

**边界定义**：
- 优先级顺序：URGENT > HIGH > NORMAL > LOW
- 相同优先级内按租户权重轮询
- 紧急任务提升后会有 `is_urgent_promotion=True` 标记

**关键代码位置**：
- `src/mt_scheduler/scheduler.py:113-127` - 优先级排序
- `src/mt_scheduler/scheduler.py:139-156` - 按租户轮询分配

**复查要点**：
1. 紧急任务必须排在最前面
2. 轮询算法确保各租户都有机会
3. 不能让高权重租户独占所有槽位

---

### 1.4 租户禁用边界

**边界定义**：
- 租户 `is_active=False` 时：
  - 不能提交新任务
  - 已有 PENDING 任务不会被调度
  - 已 RUNNING 的任务不受影响

**关键代码位置**：
- `src/mt_scheduler/scheduler.py:62-63` - 提交时检查
- `src/mt_scheduler/scheduler.py:102-104` - 调度时检查

---

## 二、失败路径（完整流程）

### 2.1 失败场景描述

**场景**：小租户 C 的任务连续失败，触发失败隔离

**路径步骤**：

```
步骤 1: 提交任务 (realtime-c-006)
        ↓
步骤 2: 第一次执行 → 失败
        - retry_count 从 0 → 1
        - consecutive_failures 从 0 → 1
        - 状态变回 PENDING（因为 retry_count < max_retries）
        ↓
步骤 3: 第二次执行 → 又失败
        - retry_count 从 1 → 2
        - consecutive_failures 从 1 → 2
        - 达到 max_retries=2 → 状态变为 FAILED
        - total_failed +1
        ↓
步骤 4: 检查失败阈值
        - consecutive_failures(2) >= failure_threshold(2)
        - quota_reduction_percent 增加 30%
        - 有效配额 = 2 × (1-30%) = 1
        ↓
步骤 5: 后续任务
        - 租户 C 只能同时运行 1 个任务（原先是 2）
        - 其他租户配额不变
        ↓
步骤 6: 恢复机制
        - 有任务成功时，consecutive_failures 清零
        - quota_reduction_percent 逐步减少（每次 -10%）
        - rebalance 命令可加速恢复（每次 -20%）
```

### 2.2 关键代码路径

**失败处理**：
- 文件：`src/mt_scheduler/scheduler.py`
- 方法：`fail_task()` (行 214-262)

**惩罚逻辑**：
```python
# 行 256-261
if config and runtime:
    if runtime.consecutive_failures >= config.failure_threshold:
        runtime.quota_reduction_percent = min(
            80,  # 上限 80%
            runtime.quota_reduction_percent + config.failure_penalty_percent
        )
```

**成功恢复**：
- 文件：`src/mt_scheduler/scheduler.py`
- 方法：`complete_task()` (行 182-212)
- 行 206-208：quota_reduction_percent 每次成功减少 10%

### 2.3 复查验证清单

| 步骤 | 操作命令 | 预期结果 |
|------|----------|----------|
| 提交 | `submit realtime-c-006 tenant-c ... --retries 1` | 状态 PENDING |
| 失败1 | `run --tenant-fail tenant-c --max-tasks 1` | 显示"将重试 (第1/2次)" |
| 状态 | `status` | 任务仍 PENDING，retry_count=1 |
| 失败2 | `run --tenant-fail tenant-c --max-tasks 1` | 显示"已耗尽重试次数" |
| 状态 | `status` | 任务 FAILED，配额减少=30%，有效配额=1 |
| 恢复 | `run` (让其他租户任务成功) | 租户 C 的连续失败不变 |
| 成功 | 让租户 C 有一个任务成功 | 连续失败清零，配额减少开始恢复 |
| 再平衡 | `rebalance` | 配额减少再降 20% |

---

## 三、重复执行路径（幂等性）

### 3.1 幂等场景描述

**场景**：同一 task_id 被多次提交

**路径步骤**：

```
第一次提交:
  task_id = "export-a-001"
  ↓
  检查 task_id 是否存在 → 不存在
  ↓
  创建新任务 → 返回 "任务提交成功"

第二次提交 (相同 task_id):
  task_id = "export-a-001"
  ↓
  检查 task_id 是否存在 → 已存在
  ↓
  返回 "任务已存在 (幂等性保证) - 当前状态: pending"
  ↓
  不创建新任务，不增加队列计数

任务执行中再次提交:
  任务状态 = RUNNING
  ↓
  返回 "任务已存在 (幂等性保证) - 当前状态: running"

任务完成后再次提交:
  任务状态 = COMPLETED
  ↓
  返回 "任务已存在 (幂等性保证) - 当前状态: completed"
```

### 3.2 关键代码路径

**幂等检查**：
- 文件：`src/mt_scheduler/scheduler.py`
- 方法：`submit_task()` (行 43-92)
- 行 65-67：

```python
if task_id in self.state.tasks:
    existing = self.state.tasks[task_id]
    return True, f"任务已存在 (幂等性保证) - 当前状态: {existing.status.value}", existing
```

**注意**：返回 `success=True` 但不创建新任务，这样调用方可以安全重试。

### 3.3 幂等边界情况

| 情况 | 行为 |
|------|------|
| 完全相同参数 | 返回已存在任务 |
| 不同参数（如不同 priority） | **忽略新参数**，返回原任务 |
| 任务已失败 | 返回已存在，状态 FAILED |
| 任务已完成 | 返回已存在，状态 COMPLETED |
| 不同租户提交相同 task_id | 返回原任务（task_id 全局唯一） |

### 3.4 复查验证清单

```bash
# 第一次提交
mt-scheduler submit test-id-001 tenant-a "测试任务" test_type
# 预期：任务提交成功

# 第二次提交（相同ID）
mt-scheduler submit test-id-001 tenant-a "测试任务" test_type
# 预期：任务已存在 (幂等性保证) - 当前状态: pending

# 执行任务
mt-scheduler run --max-tasks 1
# 预期：任务完成

# 第三次提交
mt-scheduler submit test-id-001 tenant-a "测试任务" test_type
# 预期：任务已存在 (幂等性保证) - 当前状态: completed

# 验证队列数量不变
mt-scheduler status
# 预期：test-id-001 只出现一次
```

---

## 四、快速复查脚本

```bash
#!/bin/bash
# 复查用脚本

export PYTHONPATH="$PWD/src"

echo "=== 边界条件复查 ==="
python3 -m mt_scheduler.cli reset
python3 -m mt_scheduler.cli init

echo ""
echo "1. 大租户配额边界测试"
for i in $(seq 1 10); do
    python3 -m mt_scheduler.cli submit "boundary-a-$i" tenant-a "边界测试" test --priority low > /dev/null
done
python3 -m mt_scheduler.cli status
# 检查：有效配额=4，运行中不会超过4

echo ""
echo "2. 幂等性测试"
python3 -m mt_scheduler.cli submit idempotent-001 tenant-b "幂等测试" test
python3 -m mt_scheduler.cli submit idempotent-001 tenant-b "幂等测试" test
# 第二次应显示"任务已存在"

echo ""
echo "3. 失败路径测试"
python3 -m mt_scheduler.cli submit failtest-001 tenant-c "失败测试" test --retries 1
python3 -m mt_scheduler.cli run --max-tasks 1 --tenant-fail tenant-c
python3 -m mt_scheduler.cli run --max-tasks 1 --tenant-fail tenant-c
python3 -m mt_scheduler.cli status
# 检查：配额减少=30%，有效配额=1

echo ""
echo "4. 失败隔离验证"
python3 -m mt_scheduler.cli submit other-a-001 tenant-a "其他租户" test
python3 -m mt_scheduler.cli run --max-tasks 2
python3 -m mt_scheduler.cli status
# 检查：租户 A 正常执行，不受租户 C 失败影响

echo ""
echo "=== 复查完成 ==="
```

---

## 五、数据文件位置

- 状态文件：`.mt-scheduler/scheduler_state.json`
- 可通过 `--data-dir` 指定其他目录

**关键数据结构查看**：
```json
{
  "tenant_runtime": {
    "tenant-c": {
      "consecutive_failures": 2,
      "quota_reduction_percent": 30
    }
  },
  "tasks": {
    "export-a-001": {
      "is_urgent_promotion": true,
      "promotion_reason": "CEO需要立即查看"
    }
  }
}
```
