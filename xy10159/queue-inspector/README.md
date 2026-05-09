# Queue Inspector - 消息补偿队列巡检CLI

一个可交付的消息补偿队列巡检CLI工具，解决补偿任务越积越多、重复消费和永久失败混在一起没人敢清的问题。

## 核心功能

- **队列快照导入**: 从JSON文件导入队列数据
- **重试状态机**: 指数退避重试策略，状态流转管理
- **死信归因**: 自动分类错误类型（网络/业务/权限/数据/系统等）
- **幂等键管理**: 检测重复消费，生成和验证幂等键
- **清理建议**: 智能判断哪些消息可安全删除
- **报告导出**: 支持JSON/CSV/Markdown格式

## 安装

```bash
pip install -e .
```

或者使用短命令 `qi`（需要将脚本目录添加到PATH）：

```bash
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
```

## 快速开始

### 1. 导入样例数据

```bash
# 导入正常样例
python3 -m queue_inspector.cli import examples/sample_normal.json

# 导入异常样例
python3 -m queue_inspector.cli import examples/sample_abnormal.json
```

### 2. 查看统计

```bash
python3 -m queue_inspector.cli stats
```

### 3. 查看消息列表

```bash
# 查看所有消息
python3 -m queue_inspector.cli list

# 只看死信
python3 -m queue_inspector.cli list -s dead_letter

# 按主题过滤
python3 -m queue_inspector.cli list -t order

# 最近3天的消息
python3 -m queue_inspector.cli list --days 3
```

### 4. 分析错误模式

```bash
python3 -m queue_inspector.cli analyze

# 只分析死信
python3 -m queue_inspector.cli analyze -s dead_letter
```

### 5. 检测重复幂等键

```bash
python3 -m queue_inspector.cli duplicates
```

### 6. 查看消息详情

```bash
python3 -m queue_inspector.cli show msg-dead-001
```

### 7. 重试消息

```bash
# 重试单个消息
python3 -m queue_inspector.cli retry msg-dead-001

# 重试并重置计数
python3 -m queue_inspector.cli retry msg-dead-001 --reset

# 批量重试所有死信（先预览）
python3 -m queue_inspector.cli retry-all --dry-run

# 执行批量重试
python3 -m queue_inspector.cli retry-all
```

### 8. 查看重试历史

```bash
python3 -m queue_inspector.cli history msg-dead-001
```

### 9. 获取清理建议

```bash
# 默认7天以上的消息
python3 -m queue_inspector.cli cleanup

# 调整时间阈值（24小时以上）
python3 -m queue_inspector.cli cleanup --min-age 24

# 导出建议到CSV
python3 -m queue_inspector.cli cleanup --export cleanup_suggestions.csv
```

### 10. 导出报告

```bash
# JSON格式（默认）
python3 -m queue_inspector.cli report

# Markdown格式
python3 -m queue_inspector.cli report -f md -o report.md

# CSV格式
python3 -m queue_inspector.cli report -f csv -o messages.csv
```

### 11. 删除消息

```bash
# 交互式删除（会检查是否可安全删除）
python3 -m queue_inspector.cli delete msg-success-001

# 强制删除（跳过确认）
python3 -m queue_inspector.cli delete msg-success-001 --force
```

## 工作流示例

### 场景1: 日常巡检

```bash
# 1. 导入最新队列快照
qi import queue_snapshot_20240115.json

# 2. 查看整体统计
qi stats

# 3. 分析错误分布
qi analyze

# 4. 检查重复消费
qi duplicates

# 5. 生成巡检报告
qi report -f md -o inspection_report_20240115.md
```

### 场景2: 处理死信队列

```bash
# 1. 查看所有死信
qi list -s dead_letter

# 2. 分析某条死信详情
qi show msg-dead-001

# 3. 尝试重试（网络错误类可重试）
qi retry msg-dead-001

# 4. 标记无法修复的消息
qi dead-letter msg-dead-002 -r "业务错误: 订单已取消，无法恢复"

# 5. 获取清理建议
qi cleanup --min-age 168 --export cleanup_week1.csv
```

### 场景3: 清理积压消息

```bash
# 1. 生成清理建议
qi cleanup --min-age 720

# 2. 查看可安全删除的
qi cleanup --json | jq '.[] | select(.safe_to_delete == true)'

# 3. 逐条确认删除
qi delete old-msg-001
qi delete old-msg-002
```

## 消息状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| retrying | 重试中 |
| success | 处理成功 |
| dead_letter | 死信（永久失败） |
| archived | 已归档 |

## 错误分类

| 类型 | 说明 | 可重试 |
|------|------|--------|
| network_error | 连接错误 | 是 |
| timeout | 超时错误 | 是 |
| business_error | 业务错误 | 否 |
| validation_error | 校验错误 | 否 |
| permission_error | 权限错误 | 配置修复后可重试 |
| data_error | 数据格式错误 | 否 |
| system_error | 系统错误 | 是 |
| unknown | 未知错误 | - |

## 项目结构

```
queue-inspector/
├── queue_inspector/
│   ├── __init__.py
│   ├── cli.py                 # CLI入口
│   ├── core/
│   │   ├── __init__.py
│   │   ├── models.py          # 数据模型
│   │   ├── database.py        # SQLite数据库层
│   │   ├── state_machine.py   # 重试状态机
│   │   ├── analyzer.py        # 死信归因分析
│   │   └── idempotent.py      # 幂等键管理
│   └── utils/
│       ├── __init__.py
│       └── exporter.py        # 报告导出
├── examples/
│   ├── sample_normal.json     # 正常样例
│   └── sample_abnormal.json   # 异常样例
├── tests/
│   ├── test_models.py
│   └── test_state_machine.py
├── pyproject.toml
└── README.md
```

## 测试

```bash
python3 -m pytest tests/ -v
```

## 数据存储

默认存储位置: `~/.queue_inspector/queue.db`

可以通过 `-d` 选项指定其他位置：

```bash
qi -d /path/to/custom.db stats
```
