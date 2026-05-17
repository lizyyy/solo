# 事件缝合报告

## 执行摘要

| 指标 | 数值 |
|------|------|
| 执行时间 | 3ms |
| 输入文件数 | 2 |
| 输入总大小 | 3.64 KB |
| 总行数 | 34 |
| 有效事件 | 30 |
| 无效事件 | 4 |
| 用户数 | 3 |
| 原始会话数 | 6 |
| 缝合后会话数 | 3 |
| 合并会话数 | 3 |
| 检测到的缺口数 | 0 |

---

## 文件详情


### shard1.jsonl

- 路径: `/Users/lzy/pro/solo/workspaces/zy10493/test-output/test-data/shard1.jsonl`
- 文件大小: 2.2 KB
- 总行数: 21
- 有效事件: 18
- 无效事件: 3

### shard2.jsonl

- 路径: `/Users/lzy/pro/solo/workspaces/zy10493/test-output/test-data/shard2.jsonl`
- 文件大小: 1.44 KB
- 总行数: 13
- 有效事件: 12
- 无效事件: 1


---

## 会话统计

- 最小会话时长: 30.7min
- 最大会话时长: 30.7min
- 平均会话时长: 30.7min
- 最小事件数: 10
- 最大事件数: 10
- 平均事件数: 10.0

---

## 缺口详情 (Top 10)

无缺口

---

## 无效事件详情 (Top 20)


| # | 文件 | 行号 | 错误 |
|---|------|------|------|
| 1 | shard1.jsonl | 19 | 缺少用户标识字段: user_id; 缺少会话标识字段: session_id; 缺少时间字段: timestamp |
| 2 | shard1.jsonl | 20 | 缺少用户标识字段: user_id; 缺少会话标识字段: session_id; 缺少时间字段: timestamp |
| 3 | shard1.jsonl | 21 | 缺少用户标识字段: user_id; 缺少会话标识字段: session_id; 缺少时间字段: timestamp |
| 4 | shard2.jsonl | 13 | 缺少用户标识字段: user_id; 缺少会话标识字段: session_id; 缺少时间字段: timestamp |

> 共 4 个无效事件，完整列表见 errors.ndjson


---

## 配置参数

- 用户标识字段: `user_id`
- 会话标识字段: `session_id`
- 时间字段: `timestamp`
- 缺口阈值: 30.0min

---

*报告生成时间: 2026-05-16T21:37:06.817Z*
