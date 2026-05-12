# 分布式锁泄漏排查 CLI (lock-leak-detector)

用于分析和排查分布式锁泄漏问题的命令行工具。适用于当运维发现定时任务一天没跑，怀疑是分布式锁卡住时的快速排查和处理。

## 功能特性

- **scan**: 扫描所有锁，快速识别哪些锁疑似泄漏、哪些只是长任务正常持有
- **explain**: 详细分析指定锁，展示持有者信息、心跳、执行日志、匹配策略
- **release**: 安全释放锁，支持多级安全检查和人工确认码机制
- **history**: 查看锁释放历史，避免重复操作
- **report**: 汇总异常报告，包括检查失败、策略不匹配等情况

## 核心设计理念

### 泄漏 vs 长任务区分

工具通过以下维度区分正常长任务和疑似泄漏：

| 维度 | 正常长任务 | 疑似泄漏 |
|------|-----------|---------|
| 心跳 | 持续活跃（在策略超时时间内） | 心跳超时或无心跳 |
| 执行日志 | 有 progress/step 等更新 | 只有 started，无后续更新 |
| 持有时间 | 超过策略但心跳正常 | 超过策略且无心跳 |

### 安全释放保护机制

`release` 命令执行前会逐条展示以下检查项，任何一项不通过都会阻止释放：

1. **持有者心跳检查** - 若心跳仍在策略超时范围内，说明进程可能还在运行
2. **锁持有时间检查** - 若仍在策略最大执行时间内，建议等待自然结束
3. **任务状态检查** - 检查执行日志中的最后状态（started/completed/failed）
4. **锁策略匹配检查** - 确保锁配置正确
5. **锁过期时间检查** - 确认锁是否已过期但仍存在

## 安装

```bash
# 进入项目目录
cd lock-leak-detector

# 以开发模式安装（可直接修改代码）
pip install -e .

# 或者直接作为模块运行
python3 -m lock_leak_detector.cli --help
```

## 快速开始

### 1. 生成样例数据

```bash
lock-leak samples

# 或者
python3 -m lock_leak_detector.cli samples
```

这会在 `./data` 目录生成 5 种典型场景的测试数据：

| 锁名 | 场景 | 预期分析结果 |
|------|------|-------------|
| `lock:etl:daily:20240115` | 正常运行中（30分钟） | 正常 |
| `lock:report:monthly:202401` | 长任务（12小时，心跳活跃） | 正常（超预期但心跳正常） |
| `lock:etl:daily:20240114` | 进程崩溃遗留（26小时，心跳超时） | 疑似泄漏 |
| `lock:cleanup:temp_files` | 心跳延迟（3分钟前） | 可疑 |
| `lock:unknown:orphan_key` | 无策略无心跳孤儿锁 | 高风险泄漏 |

### 2. 扫描所有锁

```bash
# 扫描全部
lock-leak scan

# 只看疑似泄漏的
lock-leak scan --filter leak

# 只看风险等级 >=2 的
lock-leak scan --min-risk 2
```

### 3. 查看锁详情

```bash
lock-leak explain lock:etl:daily:20240114
```

输出包含：
- 锁持有者信息（ID、IP、PID）
- 匹配的锁策略
- 最后心跳时间
- 最后执行日志
- 分析原因和建议

### 4. 安全释放锁

```bash
lock-leak release lock:etl:daily:20240114
```

执行流程：
1. 检查是否已有释放记录（避免重复操作）
2. 逐条展示 5 项安全检查结果
3. 生成 8 位确认码（基于锁键+持有者+当前时间哈希）
4. 要求用户输入确认码确认
5. 执行释放（实际环境需对接 Redis/数据库）
6. 记录释放历史

#### 强制释放（紧急情况）

```bash
# 跳过安全检查但仍需输入确认码
lock-leak release lock:etl:daily:20240114 --force

# 完全自动（高危，仅限脚本调用）
lock-leak release lock:etl:daily:20240114 --force --yes
```

### 5. 查看释放历史

```bash
# 全部历史
lock-leak history

# 指定锁的历史
lock-leak history lock:etl:daily:20240114
```

### 6. 查看异常报告

```bash
lock-leak report
```

异常类型包括：
- `release_check_failed`: 释放检查未通过（通常是心跳活跃）
- `policy_mismatch`: 未找到匹配的锁策略
- `heartbeat_missing`: 无心跳数据
- `task_not_recovered`: 释放后任务仍未恢复（需手动标记）

## 数据格式

工具从 `./data` 目录读取以下 JSON 文件：

### lock_snapshots.json - 锁快照

```json
[
  {
    "lock_key": "lock:etl:daily:20240115",
    "lock_value": "uuid-001",
    "holder_id": "etl-worker-01",
    "holder_name": "ETL Worker Node 1",
    "holder_ip": "192.168.1.10",
    "holder_pid": 12345,
    "acquired_at": "2024-01-15T02:00:00",
    "expire_at": "2024-01-15T03:00:00",
    "last_heartbeat_at": "2024-01-15T02:30:00",
    "metadata": {"task_version": "v2.1.0"}
  }
]
```

### lock_policies.json - 锁策略配置

```json
[
  {
    "task_name": "daily_etl_job",
    "lock_key_pattern": "lock:etl:daily:*",
    "max_execution_time": 3600,
    "heartbeat_interval": 60,
    "heartbeat_timeout": 300,
    "allowed_holders": ["etl-worker-01", "etl-worker-02"],
    "description": "每日 ETL 任务"
  }
]
```

字段说明：
- `max_execution_time`: 任务最大执行时间（秒），超过会预警
- `heartbeat_interval`: 心跳上报间隔（秒）
- `heartbeat_timeout`: 心跳超时时间（秒），超过认为进程已死

### heartbeats.json - 心跳数据

```json
[
  {
    "holder_id": "etl-worker-01",
    "timestamp": "2024-01-15T02:30:00",
    "status": "alive",
    "load": 0.8,
    "memory_usage": 45
  }
]
```

### execution_logs.json - 执行日志

```json
[
  {
    "lock_key": "lock:etl:daily:20240115",
    "holder_id": "etl-worker-01",
    "event": "task_started",
    "timestamp": "2024-01-15T02:00:05",
    "details": {"batch_id": "batch-001"}
  }
]
```

事件类型建议：`task_started`、`progress`、`task_completed`、`task_failed`

### 自动生成的文件

- `release_history.json`: 释放操作历史
- `abnormal_reports.json`: 异常报告记录

## 典型排查流程

### 场景 1: 定时任务一天没跑

```bash
# 步骤 1: 扫描所有锁
lock-leak scan

# 发现锁 lock:etl:daily:20240114 状态为"疑似泄漏"

# 步骤 2: 查看详情
lock-leak explain lock:etl:daily:20240114

# 输出显示：
# - 持有 26 小时（策略 1 小时）
# - 最后心跳 23.5 小时前（策略超时 5 分钟）
# - 建议: 确认无误后 release

# 步骤 3: 安全释放
lock-leak release lock:etl:daily:20240114

# 检查清单通过后，输入确认码
# 确认码: 8A3F2C1D
# 请输入确认码: 8A3F2C1D

# 步骤 4: 确认任务恢复
# 观察下一次定时任务是否正常启动
# 若仍未恢复，运行 lock-leak report 查看异常报告
```

### 场景 2: 误释放风险（心跳活跃）

```bash
lock-leak release lock:report:monthly:202401

# 检查清单会显示：
# ✗ 持有者心跳检查: 心跳活跃（54秒前），持有者可能仍在运行
#   ⚠️ 高风险！释放正在运行的任务可能导致数据不一致

# ❌ 检查未通过，存在阻塞项
# 确认码: 5E8F1A2B
# 如果你确认进程已死、需要强制释放：
#   lock-leak release lock:report:monthly:202401 --force
```

### 场景 3: 心跳延迟但未超时

```bash
lock-leak explain lock:cleanup:temp_files

# 分析原因:
# 1. 心跳延迟: 最后心跳距现在 3 分
# 2. 疑似锁泄漏: 已持有 8 分，超过策略最大执行时间 5 分

# 建议:
# 1. 持续监控，关注心跳恢复情况

# 此时不要着急释放，先观察几分钟看心跳是否恢复
```

## 命令速查

```bash
lock-leak --help
lock-leak scan [--filter all|suspicious|leak|normal] [--min-risk 0-3]
lock-leak explain <lock-key>
lock-leak release <lock-key> [--force] [--yes]
lock-leak history [lock-key]
lock-leak report
lock-leak samples
```

## 与实际环境集成

要在生产环境使用，需要：

1. **对接真实数据源** - 修改 `loader.py` 中的 `DataLoader` 类，从 Redis、数据库或监控系统读取数据
2. **实现真实释放逻辑** - 在 `cli.py` 的 `release` 命令中，将模拟释放替换为实际的 Redis DEL / SETNX 原子操作
3. **配置锁策略** - 为每个定时任务配置合理的 `max_execution_time` 和 `heartbeat_timeout`

## 安全最佳实践

1. **永远先 explain，再 release** - 了解详情后再决策
2. **不要盲目 --force** - 只有当确认进程已死、通过其他手段验证过才用
3. **保留确认文本** - 释放历史中保存了用户输入的确认码，用于事后审计
4. **释放后验证** - 锁释放后要确认任务是否恢复，若未恢复可能不是锁的问题
5. **配置策略** - 没有策略配置的锁会被标记为高风险

## 项目结构

```
lock_leak_detector/
├── __init__.py      # 版本信息
├── models.py        # 数据模型定义
├── loader.py        # 数据加载器
├── analyzer.py      # 锁分析逻辑
├── releaser.py      # 释放检查机制
└── cli.py           # CLI 入口
```
