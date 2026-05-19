# 分支保护例外恢复审计排查CLI

一个用于审计分支保护例外申请和恢复动作的命令行工具。

## 功能特性

- **多格式支持**: 支持 JSON、CSV、Excel 格式的输入文件
- **核心规则**:
  - 例外审批校验 (R001): 检查已批准例外是否有审批人
  - 放开窗口到期校验 (R002): 检查窗口是否已到期但仍处于活动状态
  - 恢复动作校验 (R003): 检查每个窗口是否有对应的恢复记录
  - 重复申请幂等校验 (R004): 检查是否存在重复申请和重叠窗口
- **来源追踪**: 问题记录保留原文件位置信息
- **报告生成**: 支持 JSON、CSV、TEXT 三种输出格式
- **结果稳定**: 对记录进行排序，重复运行结果一致

## 安装

```bash
pip install -e .
```

## 使用方法

### 1. 执行审计

```bash
bpaudit audit examples/sample_data.json
```

指定输出目录和格式：

```bash
bpaudit audit examples/sample_data.json -o ./my_output -f json
```

同时审计多个文件：

```bash
bpaudit audit examples/sample_data.json examples/sample_exceptions.csv
```

### 2. 检查文件内容

```bash
bpaudit inspect examples/sample_data.json
```

### 3. 查看所有审计规则

```bash
bpaudit rules
```

### 4. 查看版本信息

```bash
bpaudit version
```

## 输入数据格式

### JSON 格式

```json
{
  "repositories": [
    {
      "id": "repo-001",
      "name": "frontend-app",
      "url": "https://github.com/org/frontend-app"
    }
  ],
  "exceptions": [
    {
      "id": "exc-001",
      "repository_id": "repo-001",
      "branch_pattern": "main",
      "applicant": "张三",
      "approver": "李四",
      "reason": "紧急热修复",
      "requested_at": "2024-01-15 09:00:00",
      "status": "APPROVED"
    }
  ],
  "windows": [
    {
      "id": "win-001",
      "exception_id": "exc-001",
      "start_time": "2024-01-15 09:30:00",
      "end_time": "2024-01-15 11:30:00",
      "actual_end_time": "2024-01-15 11:25:00",
      "is_active": false
    }
  ],
  "recoveries": [
    {
      "id": "rec-001",
      "window_id": "win-001",
      "recovered_by": "李四",
      "recovered_at": "2024-01-15 11:25:00",
      "recovery_method": "手动恢复",
      "is_successful": true
    }
  ]
}
```

### CSV 格式

```csv
record_type,id,repository_id,branch_pattern,applicant,approver,reason,requested_at,status
EXCEPTION,exc-001,repo-001,main,张三,李四,紧急Bug修复,2024-02-01 10:00:00,APPROVED
```

### Excel 格式

支持多个工作表，分别命名为：仓库、分支规则、例外申请、放开窗口、恢复动作，或者使用英文名称。

## 项目结构

```
branch_protection_audit/
├── models/              # 数据模型
│   └── schemas.py   # Pydantic 模型定义
├── parser/            # 数据解析模块
│   ├── base_parser.py
│   ├── csv_parser.py
│   ├── excel_parser.py
│   ├── json_parser.py
│   └── parser_factory.py
├── rules/             # 规则引擎
│   ├── base_rule.py
│   ├── approval_rule.py
│   ├── window_expiry_rule.py
│   ├── recovery_validation_rule.py
│   ├── duplicate_application_rule.py
│   └── rule_engine.py
├── tracker/           # 来源追踪
│   └── source_tracker.py
├── reporter/          # 报告生成
│   └── report_generator.py
└── cli/               # 命令行入口
    └── main.py
```

## 审计规则说明

### R001 - 例外审批校验
- **目的**: 确保所有已批准的例外申请都有对应的审批人
- **严重级别**: ERROR
- **触发条件**: 状态为 APPROVED 但 approver 字段为空

### R002 - 放开窗口到期校验
- **目的**: 防止放开窗口到期后应关闭，窗口应及时恢复分支保护
- **严重级别**: ERROR (到期未关闭) / WARNING (其他
- **触发条件**: is_active=true 且当前时间 > end_time

### R003 - 恢复动作校验
- **目的**: 确保每个关闭的窗口都有对应的恢复记录
- **严重级别**: ERROR (无恢复记录) / WARNING (恢复延迟)
- **触发条件**: 窗口已关闭但无恢复记录，或恢复时间晚于窗口结束时间

### R004 - 重复申请幂等校验
- **目的**: 防止同一时间同一分支重复申请例外，避免重叠窗口
- **严重级别**: ERROR (重叠窗口) / WARNING (重复申请模式)
- **触发条件**: 检测到时间重叠的窗口或重复的申请模式

## 输出报告

审计完成后会在输出目录生成报告，包含：
- JSON格式的完整审计报告
- CSV格式的审计记录清单
- TEXT格式的人类可读报告

所有问题记录都会包含原始文件的位置信息，方便追溯。
