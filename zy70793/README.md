# JSONL 事件会话缝合缺口标记排查工具

用于处理从多个 shard 导出的埋点事件，重新拼接用户会话并标记缺口的 Python 命令行工具。

## 功能特性

- **流式读取**: 逐行读取大文件，内存友好
- **时间排序**: 稳定排序，重复运行结果一致
- **会话合并**: 按用户ID和会话ID合并分散在多个文件中的事件
- **缺口标记**: 检测事件间的时间缺口，分类标记
- **多格式输出**: 支持 NDJSON (JSONL) 和 CSV 格式
- **来源追踪**: 保留原始文件位置，坏行完整记录
- **详细报告**: 生成完整的缝合分析报告

## 安装

只需 Python 3.7+，无需额外依赖。

## 使用方法

### 基本使用

```bash
python stitch_sessions.py -i test_data/shard_1.jsonl test_data/shard_2.jsonl -v
```

### 完整参数说明

```
--inputs, -i        输入JSONL文件路径，支持多个文件（必需）
--user-field, -u    用户标识字段名（默认: user_id）
--session-field, -s 会话标识字段名（默认: session_id）
--time-field, -t    事件时间字段名（默认: event_time）
--time-format        时间格式（iso|timestamp_ms|timestamp_s，默认: iso）
--gap-threshold, -g  缺口阈值（秒），超过此时间视为会话缺口（默认: 1800）
--session-timeout    会话超时时间（秒）（默认: 3600）
--output-format, -f  输出格式（ndjson|csv，默认: ndjson）
--output, -o         输出文件路径（不含扩展名，默认: stitched_sessions）
--report-path, -r    缝合报告输出路径（默认: stitch_report.json）
--verbose, -v        显示详细处理信息
```

### 示例

#### 处理多个分片文件

```bash
python stitch_sessions.py \
  -i data/shard_*.jsonl \
  -g 600 \
  -f csv \
  -o output/stitched \
  -v
```

#### 自定义字段名

```bash
python stitch_sessions.py \
  -i events.jsonl \
  -u uid \
  -s sid \
  -t ts \
  --time-format timestamp_ms \
  -v
```

## 输出说明

### NDJSON 输出格式

每行一个完整会话，包含会话元数据、缺口信息和所有事件：

```json
{
  "user_id": "user_001",
  "session_id": "sess_abc",
  "start_time": "2024-01-15T10:00:00+08:00",
  "end_time": "2024-01-15T10:40:00+08:00",
  "duration_seconds": 2400,
  "event_count": 6,
  "has_gaps": true,
  "gap_count": 2,
  "total_gap_seconds": 2100,
  "max_gap_seconds": 1800,
  "sources": ["shard_1.jsonl", "shard_2.jsonl"],
  "gaps": [...],
  "events": [...]
}
```

### CSV 输出格式

生成两个文件：
- `output_sessions.csv` - 会话级别汇总
- `output_events.csv` - 所有事件明细

### 报告输出

包含完整的缝合统计：
- 输入文件、事件总数、坏行数
- 会话统计、缺口统计
- 缺口类型分布
- 各文件统计
- Top 问题会话列表
- 坏行详情（前100条）

## 缺口类型分类

| 类型 | 说明 |
|------|------|
| cross_file_shard_gap | 跨文件缺口，分片边界导致 |
| cross_file_session_timeout | 跨文件缺口，会话超时级 |
| same_file_data_missing | 同文件内数据缺失 |
| same_file_session_timeout | 同文件内会话超时级缺口 |

## 测试

使用示例数据测试：

```bash
python stitch_sessions.py -i test_data/shard_1.jsonl test_data/shard_2.jsonl -v
```

查看输出文件：
- `stitched_sessions.jsonl`
- `stitch_report.json`

## 项目结构

```
.
├── stitch_sessions.py          # 主入口脚本
├── session_stitcher/
│   ├── __init__.py
│   ├── cli.py                  # 命令行参数解析
│   ├── parser.py               # JSONL解析器
│   ├── session.py              # 会话合并逻辑
│   ├── gap_detector.py         # 缺口检测
│   ├── exporter.py             # 导出器（NDJSON/CSV）
│   └── reporter.py             # 报告生成器
└── test_data/
    ├── shard_1.jsonl
    └── shard_2.jsonl
```

## 设计原则

1. **结果稳定性**: 排序键包含时间、用户ID、会话ID、文件名、行号，确保重复运行结果完全一致
2. **来源可追溯**: 每个事件保留原始文件路径和行号
3. **坏行保留**: 解析失败的行完整记录，不丢失任何原始数据
4. **内存友好**: 流式逐行读取，适合处理GB级大文件
