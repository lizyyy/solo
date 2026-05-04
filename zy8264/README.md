# 高校考务流转复核工具

一个用于复核备用卷袋和答题卡袋流转闭环的 Python 命令行工具，帮助考务老师检测流转过程中的各种问题。

## 功能特性

- **重复签收检测**：检测同一袋在相同状态下被多次签收
- **越权领取检测**：检测监考老师领取非授权考场的试卷袋
- **跨校区归属检测**：检测操作人与试卷袋校区归属不一致
- **跨午夜归档错位检测**：检测跨午夜考试归档日期错误
- **缺失流转节点检测**：检测流转过程中缺失的必要状态转换
- **时间窗口违规检测**：检测操作是否在规定时间窗口内进行

## 项目结构

```
exam_flow_auditor/
├── __init__.py          # 包初始化
├── parser.py            # 解析器模块 - 解析各类输入文件
├── rules.py             # 规则模块 - 定义验证规则
├── state_machine.py     # 状态机模块 - 流转状态管理
├── reporter.py          # 报告模块 - 生成报告文件
└── cli.py               # 命令行接口
sample/
├── exam_rooms.csv       # 考场信息
├── bag_scans.jsonl      # 袋扫描记录
├── paper_manifest.yaml  # 试卷清单
├── invigilators.csv     # 监考人员信息
└── flow_rules.yaml      # 流转规则
main.py                  # 入口脚本
requirements.txt         # 依赖文件
README.md                # 本文档
```

## 安装

### 环境要求

- Python 3.8+

### 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 查看帮助

```bash
python main.py --help
```

### 2. 验证流转数据

```bash
python main.py validate \
  --rooms sample/exam_rooms.csv \
  --scans sample/bag_scans.jsonl \
  --manifest sample/paper_manifest.yaml \
  --invigilators sample/invigilators.csv \
  --rules sample/flow_rules.yaml
```

### 3. 执行完整审计（带详细输出）

```bash
python main.py audit --verbose \
  --rooms sample/exam_rooms.csv \
  --scans sample/bag_scans.jsonl \
  --manifest sample/paper_manifest.yaml \
  --invigilators sample/invigilators.csv \
  --rules sample/flow_rules.yaml
```

### 4. 导出审计报告

```bash
python main.py export \
  --rooms sample/exam_rooms.csv \
  --scans sample/bag_scans.jsonl \
  --manifest sample/paper_manifest.yaml \
  --invigilators sample/invigilators.csv \
  --rules sample/flow_rules.yaml \
  --output ./output
```

## 命令说明

### validate 命令

验证流转数据的合法性，检测各类问题并返回退出码：

- `0`: 未检测到任何问题
- `1`: 检测到中等或低危问题
- `2`: 检测到严重或高危问题

### audit 命令

执行完整审计，显示详细结果（使用 `--verbose` 参数可显示问题详情）。

### export 命令

导出审计报告文件到指定目录（默认当前目录），生成：

- `issues.csv`: 问题列表 CSV 文件
- `handover_audit.md`: 交接审计报告 Markdown 文件

## 输入文件格式

### 1. exam_rooms.csv - 考场信息

| 字段 | 说明 |
|------|------|
| room_id | 考场编号 |
| building | 教学楼 |
| floor | 楼层 |
| capacity | 容量 |
| campus | 校区 |
| exam_date | 考试日期 |
| exam_time | 考试时间 |

### 2. invigilators.csv - 监考人员信息

| 字段 | 说明 |
|------|------|
| teacher_id | 工号 |
| name | 姓名 |
| department | 部门 |
| campus | 校区 |
| role | 角色（主监考/副监考/考务） |
| authorized_rooms | 授权考场列表 |

### 3. paper_manifest.yaml - 试卷清单

```yaml
manifests:
  - bag_id: PAPER-2026-01-15-R001-01
    bag_type: 备用卷袋
    exam_date: 2026-01-15
    exam_time: 09:00-11:00
    room_id: R001
    campus: 东校区
    subject: 计算机基础
    paper_count: 40
    sealed_time: 2026-01-14T16:00:00
    initial_location: 考务中心-东校区
```

### 4. bag_scans.jsonl - 袋扫描记录

每行一个 JSON 对象：

```json
{"scan_id": "SCAN001", "bag_id": "PAPER-2026-01-15-R001-01", "teacher_id": "T001", "action": "领取", "timestamp": "2026-01-15T08:30:00", "location": "考务中心-东校区", "notes": "考前领取备用卷袋"}
```

### 5. flow_rules.yaml - 流转规则

定义流转状态、转换规则和验证规则。

## 检测规则说明

| 规则ID | 名称 | 严重程度 | 说明 |
|--------|------|----------|------|
| duplicate_signature | 重复签收检测 | HIGH | 同一袋不允许在相同状态下被多次签收 |
| unauthorized_access | 越权领取检测 | CRITICAL | 监考老师只能领取其授权考场的试卷袋 |
| cross_campus | 跨校区归属检测 | HIGH | 试卷袋流转操作人必须与袋所属校区一致 |
| midnight_exam_archive | 跨午夜归档错位检测 | MEDIUM | 跨午夜考试的归档日期应使用考试结束日期 |
| missing_transition | 缺失流转节点检测 | HIGH | 检测流转过程中缺失的必要状态转换 |
| time_violation | 时间窗口违规检测 | MEDIUM | 检测操作是否在规定的时间窗口内进行 |

## 流转流程

### 备用卷袋流转流程

```
SEALED(已封存) → RECEIVED(已领取) → IN_USE(考试中) → RETURNED(已归还) → ARCHIVED(已归档)
```

### 答题卡袋流转流程

```
SEALED(已封存) → DISTRIBUTED(已发放) → COLLECTED(已收齐) → VERIFIED(已核验) → ARCHIVED(已归档)
```

## 输出文件说明

### issues.csv

包含所有检测到的问题，字段包括：
- 问题ID
- 规则ID
- 规则名称
- 严重程度
- 试卷袋ID
- 扫描ID
- 操作人ID
- 问题描述
- 检测时间
- 各详情字段

### handover_audit.md

完整的交接审计报告，包含：
1. 问题总览
2. 按严重程度分类
3. 流转状态概览
4. 问题详情
5. 交接审计追踪
6. 统计数据
7. 建议措施

## 可复现 Demo

使用 sample 目录中的测试数据，其中包含 4 个故意设置的问题：

1. **重复签收** (SCAN003): PAPER-2026-01-15-R001-01 被重复领取
2. **越权领取** (SCAN004): T001(东校区) 领取西校区 R003 的试卷
3. **跨校区归属** (SCAN005): T003(西校区) 领取东校区 R002 的试卷
4. **跨午夜归档错位** (SCAN013): 归档日期应为 2026-01-17 但记录为 2026-01-16

### 运行 Demo

```bash
# 安装依赖
pip install -r requirements.txt

# 执行审计
python main.py audit --verbose \
  --rooms sample/exam_rooms.csv \
  --scans sample/bag_scans.jsonl \
  --manifest sample/paper_manifest.yaml \
  --invigilators sample/invigilators.csv \
  --rules sample/flow_rules.yaml

# 导出报告
python main.py export \
  --rooms sample/exam_rooms.csv \
  --scans sample/bag_scans.jsonl \
  --manifest sample/paper_manifest.yaml \
  --invigilators sample/invigilators.csv \
  --rules sample/flow_rules.yaml \
  --output ./output

# 查看生成的报告
ls -la output/
cat output/handover_audit.md
```

### 预期输出

执行审计后，应该能检测到以下问题：

- 1 个 CRITICAL 问题（越权领取）
- 多个 HIGH 问题（重复签收、跨校区归属、缺失流转节点）
- 多个 MEDIUM 问题（跨午夜归档错位、时间窗口违规）

## 许可证

MIT License
