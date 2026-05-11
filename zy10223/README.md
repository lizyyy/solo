# 训练营作业催交通知 CLI

一个帮助训练营助教管理作业催交、追踪证书资格的命令行工具。

## 核心功能

- **学员管理**: 支持多账号识别（学员ID、邮箱、别名）
- **作业轮次**: 管理多轮作业，记录截止时间
- **提交记录**: 去重导入、自动识别重交、标记迟交
- **证书规则**: 可配置的资格判定规则
- **异常报告**: 清晰说明每条数据异常的原因
- **催交名单**: 按分组输出未提交/待批改学员
- **风险名单**: 列出可能拿不到证书的学员及原因
- **作业历史**: 查看单个或全体学员的提交记录

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 准备数据文件

参考 `examples/` 目录下的示例文件，准备你的数据：

- `students.json` - 学员名单
- `assignments.json` - 作业轮次
- `submissions_batch_01.json` - 提交记录（可多次导入）

### 3. 导入数据

```bash
python training-notifier.py import students examples/students.json
python training-notifier.py import assignments examples/assignments.json
python training-notifier.py import submissions examples/submissions_batch_01.json
```

### 4. 一键生成报告（最常用）

```bash
python training-notifier.py run
```

或者在导入新数据后立即生成报告：

```bash
python training-notifier.py run -i submissions_new.json -o reports/report_2026-05-11.txt
```

## 可复跑命令

以下是日常使用的标准操作流程：

```bash
# 第一次设置（导入基础数据）
python training-notifier.py import students data_input/students.json
python training-notifier.py import assignments data_input/assignments.json

# 每次拿到新的提交记录后运行
python training-notifier.py run -i data_input/submissions_latest.json -o reports/$(date +%Y%m%d)_report.txt

# 查看特定学员的历史
python training-notifier.py report history -s 张三

# 仅查看催交名单
python training-notifier.py report reminder -a round_03

# 仅查看证书风险
python training-notifier.py report risk

# 查看异常记录
python training-notifier.py anomalies -s error
```

## 数据格式说明

### 学员名单 (students.json)

```json
[
  {
    "id": "S001",
    "name": "张三",
    "group": "一组",
    "emails": ["zhangsan@example.com"],
    "aliases": ["小张", "zs"],
    "notes": "留级生，需重点关注"
  }
]
```

字段说明：
- `id`: 唯一标识，必填
- `name`: 姓名，必填
- `group`: 分组名称，用于按组输出催交名单
- `emails`: 邮箱列表，用于匹配多账号提交
- `aliases`: 别名/昵称列表，用于匹配多账号提交
- `notes`: 备注信息

### 作业轮次 (assignments.json)

```json
[
  {
    "id": "round_01",
    "name": "环境搭建",
    "round_num": 1,
    "deadline": "2026-05-05T23:59:59",
    "required": true,
    "description": "完成开发环境配置"
  }
]
```

字段说明：
- `id`: 唯一标识，必填
- `name`: 作业名称
- `round_num`: 第几轮
- `deadline`: 截止时间（ISO 格式）
- `required`: 是否为必修（影响证书资格）
- `description`: 作业描述

### 提交记录 (submissions.json)

```json
[
  {
    "student_identifier": "zhangsan@example.com",
    "assignment_id": "round_01",
    "submitted_at": "2026-05-05T18:30:00",
    "score": 85.0,
    "resubmit_reason": "",
    "grader_notes": "完成度很好"
  }
]
```

字段说明：
- `student_identifier`: 学员标识（可以是 id、邮箱、别名）
- `assignment_id`: 作业 ID
- `submitted_at`: 提交时间（ISO 格式）
- `score`: 分数（可选，未批改则留空）
- `resubmit_reason`: 补交说明
- `grader_notes`: 批改备注

### 证书规则 (rules.json, 可选)

```json
{
  "min_required_assignments": 3,
  "max_late_submissions": 1,
  "allow_late_for_cert": false,
  "require_all_graded": true,
  "min_avg_score": 60.0,
  "exclude_rounds": []
}
```

使用自定义规则：
```bash
python training-notifier.py -r rules.json run
```

## 异常类型说明

工具会自动检测以下异常并在报告中详细说明：

| 类型 | 严重度 | 说明 |
|------|--------|------|
| `duplicate_student` | warning | 导入的学员与已有数据冲突（如邮箱重复） |
| `duplicate_submission` | info | 同一学员在同一时间提交了相同作业（已自动去重） |
| `resubmit_detected` | info | 检测到重交，旧分数将被新提交覆盖 |
| `unknown_student` | error | 提交记录中的学员不在学员名单中 |
| `unknown_assignment` | error | 提交记录中的作业不存在 |
| `unmatched_identifier` | warning | 无法通过标识找到学员 |
| `missing_grade` | warning | 已提交但尚未批改 |

**异常记录持久化**：所有异常都会自动保存到 `data/anomalies.json`，可以随时查看历史异常：

```bash
# 查看所有异常
python training-notifier.py anomalies

# 仅查看错误级别异常
python training-notifier.py anomalies -s error

# 导入时清空历史异常
python training-notifier.py import submissions 新文件.json --clear-anomalies
```

## 证书资格判定

证书资格分为三类：

- **✓ 已达标**: 满足所有规则要求
- **⚠ 有风险**: 存在小问题，如部分作业未批改
- **✗ 未达标**: 严重问题，如迟交次数过多、提交数量不足

判定规则（可配置）：
1. 提交数量 ≥ 最低要求（默认 3 个）
2. 迟交数量 ≤ 最大允许数（默认 1 个）
3. 迟交是否计入资格（默认不计入）
4. 所有作业是否都已批改（默认必须批改）
5. 平均分 ≥ 最低要求（默认 60 分）

## 重交处理逻辑

- 同一学员同一作业的多次提交按时间排序
- 只有最新的提交计入有效成绩
- 旧提交会保留在历史记录中（标记为已重交）
- 如果新提交没有分数但旧提交有，会继承旧分数

## 多账号处理

- 一个学员可以绑定多个邮箱和别名
- 提交记录可以使用任一个标识
- 工具会自动将多账号提交合并到同一学员

## 目录结构

```
.
├── README.md                    # 本文档
├── requirements.txt             # Python 依赖
├── training-notifier.py         # 主入口
├── training_cli/                # 源代码
│   ├── __init__.py
│   ├── models.py               # 数据模型
│   ├── data_manager.py         # 数据管理
│   ├── certification_engine.py # 证书规则引擎
│   ├── reporter.py             # 报告生成
│   └── cli.py                  # 命令行接口
├── data/                        # 数据存储（自动创建）
│   ├── students.json
│   ├── assignments.json
│   └── submissions.json
├── examples/                    # 示例数据
│   ├── students.json
│   ├── assignments.json
│   ├── submissions_batch_01.json
│   └── submissions_batch_02.json
└── reports/                     # 报告输出（自动创建）
```

## 命令参考

```bash
# 查看帮助
python training-notifier.py --help

# 数据导入
python training-notifier.py import students <文件>
python training-notifier.py import assignments <文件>
python training-notifier.py import submissions <文件> [--clear-anomalies]

# 报告生成
python training-notifier.py report reminder [-a 作业ID] [-o 输出文件]
python training-notifier.py report risk [-o 输出文件]
python training-notifier.py report history [-s 学员标识] [-o 输出文件]
python training-notifier.py report full [-a 作业ID] [-o 输出文件]

# 一键运行（默认保留历史异常）
python training-notifier.py run [-i 提交文件] [-o 输出文件] [-a 作业ID]

# 一键运行（导入前清空历史异常）
python training-notifier.py run -i 提交文件 --clear-anomalies

# 查看异常
python training-notifier.py anomalies [-s error|warning|info]
```

## 使用场景示例

### 场景 1: 日常催交

每天拿到新的提交记录文件后：

```bash
python training-notifier.py run -i 今天的提交.json -o reports/5月11日报告.txt
```

然后查看 `reports/5月11日报告.txt` 中的「分组催交名单」，发给对应助教。

### 场景 2: 学员问证书问题

学员问「我能拿到证书吗？」：

```bash
python training-notifier.py report history -s 学员邮箱
```

查看输出中的「证书状态」和「问题」列表，给学员解释。

### 场景 3: 每周汇总

```bash
python training-notifier.py report full -o reports/周报.txt
```

报告包含：
- 所有作业的催交情况
- 数据异常详情
- 证书风险名单
