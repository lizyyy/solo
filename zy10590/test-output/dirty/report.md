# JSONL 乱序修复报告

生成时间: 2026/5/17 23:46:47
输入路径: test-data/dirty.jsonl
会话字段: sessionId
时间字段: timestamp
缺口阈值: 5000ms

## 📊 概览统计

| 指标 | 数值 |
|------|------|
| 处理文件数 | 1 (目录时为多个) |
| 总行数 | 7 |
| 有效行数 | 3 |
| 坏行数 | 4 |
| 会话数 | 2 |
| 缺口数 | 0 |

## ❌ 坏行详情

### 按错误类型统计

| 错误类型 | 数量 |
|----------|------|
| Unexpected token '这', "这不是 JSON" is not valid JSON | 1 |
| 事件时间格式无效: invalid-time | 1 |
| 缺少会话键字段: sessionId | 1 |
| 缺少事件时间字段: timestamp | 1 |

### 坏行样本（前 10 条）

| 文件 | 行号 | 错误原因 | 原始内容 |
|------|------|----------|----------|
| dirty.jsonl | 3 | Unexpected token '这', "这不是 JSON" is not valid JSON | 这不是 JSON |
| dirty.jsonl | 4 | 事件时间格式无效: invalid-time | {"sessionId": "sess-001", "timestamp": "invalid-ti... |
| dirty.jsonl | 5 | 缺少会话键字段: sessionId | {"missingSession": true, "timestamp": 171500000400... |
| dirty.jsonl | 6 | 缺少事件时间字段: timestamp | {"sessionId": "sess-002"} |

## 📁 输出文件

本工具生成以下文件：
- `*-sorted.jsonl`: 按时间排序后的有效数据
- `*-bad-rows.jsonl`: 所有坏行，包含原始位置和错误原因
- `*-result.json`: 机器可读的完整处理结果
- `*-report.md`: 本报告文件