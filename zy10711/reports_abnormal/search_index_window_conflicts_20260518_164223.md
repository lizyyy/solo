# 搜索索引任务 - 窗口冲突详情报告

> 生成时间: 2026-05-18 16:42:23

## 冲突列表 (共 10 项)


### 冲突 #1

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-101
- 索引名称: product_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 02:00:00 ~ 2026-05-18 05:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:45`

**任务 2**:
- 任务ID: TASK-102
- 索引名称: order_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 04:00:00 ~ 2026-05-18 07:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:52`

**描述**: 任务 product_search_v3 与任务 order_search_v3 时间窗口重叠

---

### 冲突 #2

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-101
- 索引名称: product_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 02:00:00 ~ 2026-05-18 05:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:45`

**任务 2**:
- 任务ID: TASK-103
- 索引名称: user_fulltext_index
- 分片ID: 0
- 时间窗口: 2026-05-17 22:00:00 ~ 2026-05-18 06:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:59`

**描述**: 任务 product_search_v3 与任务 user_fulltext_index 时间窗口重叠

---

### 冲突 #3

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-101
- 索引名称: product_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 02:00:00 ~ 2026-05-18 05:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:45`

**任务 2**:
- 任务ID: TASK-104
- 索引名称: behavior_log_full
- 分片ID: 0
- 时间窗口: 2026-05-18 00:00:00 ~ 2026-05-18 08:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:66`

**描述**: 任务 product_search_v3 与任务 behavior_log_full 时间窗口重叠

---

### 冲突 #4

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-101
- 索引名称: product_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 02:00:00 ~ 2026-05-18 05:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:45`

**任务 2**:
- 任务ID: TASK-106
- 索引名称: transaction_history
- 分片ID: 0
- 时间窗口: 2026-05-18 03:00:00 ~ 2026-05-18 06:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:80`

**描述**: 任务 product_search_v3 与任务 transaction_history 时间窗口重叠

---

### 冲突 #5

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-102
- 索引名称: order_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 04:00:00 ~ 2026-05-18 07:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:52`

**任务 2**:
- 任务ID: TASK-103
- 索引名称: user_fulltext_index
- 分片ID: 0
- 时间窗口: 2026-05-17 22:00:00 ~ 2026-05-18 06:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:59`

**描述**: 任务 order_search_v3 与任务 user_fulltext_index 时间窗口重叠

---

### 冲突 #6

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-102
- 索引名称: order_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 04:00:00 ~ 2026-05-18 07:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:52`

**任务 2**:
- 任务ID: TASK-104
- 索引名称: behavior_log_full
- 分片ID: 0
- 时间窗口: 2026-05-18 00:00:00 ~ 2026-05-18 08:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:66`

**描述**: 任务 order_search_v3 与任务 behavior_log_full 时间窗口重叠

---

### 冲突 #7

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-102
- 索引名称: order_search_v3
- 分片ID: 0
- 时间窗口: 2026-05-18 04:00:00 ~ 2026-05-18 07:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:52`

**任务 2**:
- 任务ID: TASK-106
- 索引名称: transaction_history
- 分片ID: 0
- 时间窗口: 2026-05-18 03:00:00 ~ 2026-05-18 06:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:80`

**描述**: 任务 order_search_v3 与任务 transaction_history 时间窗口重叠

---

### 冲突 #8

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-103
- 索引名称: user_fulltext_index
- 分片ID: 0
- 时间窗口: 2026-05-17 22:00:00 ~ 2026-05-18 06:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:59`

**任务 2**:
- 任务ID: TASK-104
- 索引名称: behavior_log_full
- 分片ID: 0
- 时间窗口: 2026-05-18 00:00:00 ~ 2026-05-18 08:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:66`

**描述**: 任务 user_fulltext_index 与任务 behavior_log_full 时间窗口重叠

---

### 冲突 #9

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-103
- 索引名称: user_fulltext_index
- 分片ID: 0
- 时间窗口: 2026-05-17 22:00:00 ~ 2026-05-18 06:00:00
- 状态: running
- 原始位置: `search_index_prod.conf:59`

**任务 2**:
- 任务ID: TASK-106
- 索引名称: transaction_history
- 分片ID: 0
- 时间窗口: 2026-05-18 03:00:00 ~ 2026-05-18 06:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:80`

**描述**: 任务 user_fulltext_index 与任务 transaction_history 时间窗口重叠

---

### 冲突 #10

**冲突类型**: 时间窗口重叠

**任务 1**:
- 任务ID: TASK-104
- 索引名称: behavior_log_full
- 分片ID: 0
- 时间窗口: 2026-05-18 00:00:00 ~ 2026-05-18 08:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:66`

**任务 2**:
- 任务ID: TASK-106
- 索引名称: transaction_history
- 分片ID: 0
- 时间窗口: 2026-05-18 03:00:00 ~ 2026-05-18 06:00:00
- 状态: retrying
- 原始位置: `search_index_prod.conf:80`

**描述**: 任务 behavior_log_full 与任务 transaction_history 时间窗口重叠

---


---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
