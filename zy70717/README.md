# 日志留存冻结释放审计报告排查CLI工具

本地命令行工具，用于审计涉及投诉的日志留存冻结释放记录，确保合规性。

## 功能特性

- **多格式支持**: 支持CSV和JSON格式输入文件
- **核心规则校验**:
  - 重复申请幂等性检测
  - 时间范围合并与重叠检测
  - 释放审批状态校验
- **来源追踪**: 坏行保留原始文件位置和内容
- **稳定输出**: 所有报告结果稳定排序，重复运行结果一致
- **多格式报告**: 生成JSON、CSV和文本格式报告

## 安装依赖

```bash
pip3 install -r requirements.txt
```

## 使用方法

### 1. 生成示例数据模板

```bash
python3 main.py template
```

生成CSV和JSON格式的示例数据文件到 `examples/` 目录。

### 2. 验证文件格式

```bash
python3 main.py validate <文件路径>
```

验证单个文件的格式是否正确，并显示解析错误详情。

### 3. 执行审计并生成报告

```bash
python3 main.py audit <文件1> <文件2> ... [选项]
```

选项:
- `--output, -o`: 报告输出目录 (默认: `./output`)
- `--name, -n`: 报告文件名前缀 (默认: `audit_report`)
- `--verbose, -v`: 显示详细输出信息

示例:
```bash
# 审计单个文件
python3 main.py audit examples/audit_data.csv -v

# 审计多个文件并指定输出目录
python3 main.py audit data/*.csv data/*.json -o ./reports -n monthly_audit
```

## 输入字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 否 | 记录唯一标识，自动生成 |
| operation_type | string | 是 | 操作类型: freeze(冻结) / release(释放) |
| log_topic | string | 是 | 日志主题 |
| start_time | datetime | 是 | 开始时间 |
| end_time | datetime | 是 | 结束时间 |
| freeze_reason | string | 是 | 冻结原因: complaint(投诉), audit(审计), legal(法务), security(安全), other(其他) |
| applicant | string | 是 | 申请人 |
| release_condition | string | 否 | 释放条件 |
| release_status | string | 否 | 释放状态: pending(待审批), approved(已批准), rejected(已拒绝) |
| approval_time | datetime | 否 | 审批时间 |
| approver | string | 否 | 审批人 |

## 时间格式支持

- ISO格式: `2024-01-01T00:00:00`
- 标准格式: `2024-01-01 00:00:00`
- 日期格式: `2024-01-01`
- 斜杠格式: `2024/01/01 00:00:00`

## 输出报告

审计完成后会生成以下报告文件:

1. **JSON报告**: 完整的结构化数据，包含所有记录和分析结果
2. **CSV摘要**: 有效记录的表格化摘要
3. **CSV错误**: 解析错误详情，包含原始文件位置
4. **文本报告**: 人类可读的完整审计报告

## 退出码

- `0`: 成功，无错误和警告
- `1`: 参数错误或文件不存在
- `2`: 存在解析错误、重复申请、时间重叠或待审批释放

## 项目结构

```
.
├── main.py                    # 主入口
├── requirements.txt           # 依赖
├── log_freeze_audit/
│   ├── __init__.py
│   ├── models.py             # 数据模型
│   ├── parser.py             # 文件解析器
│   ├── rules.py              # 规则引擎
│   ├── reporter.py           # 报告生成器
│   └── cli.py                # CLI命令
├── examples/                 # 示例数据
└── output/                   # 报告输出目录
```
