# 机器人足球战术 - 战报结算一致性核查工具

## 项目简介

"机器人足球战术"是一个帮助策划、数值、测试同学在版本提测前快速核查战报和结算一致性的工具。它解决了以下痛点：

1. **错误提示像人话** - 不再只吐内部字段名或堆栈，用策划能听懂的语言说明问题
2. **区分补材料 vs 改结论** - 明确哪些变更是补材料（不影响结论），哪些真的改了结论
3. **旧版本不静默覆盖** - 补传旧版本时明确提醒哪里变了，保留完整历史
4. **复盘报告可追溯** - 下一班同事看报告就够，不用再翻聊天记录

## 项目结构

```
robot_football_tactics/
├── __init__.py
├── __main__.py          # 模块入口
├── cli.py               # 命令行接口
├── main.py              # 主类
├── models/              # 数据模型
│   ├── base.py          # 基础模型（版本信息、变更记录）
│   ├── unit_table.py    # 单位表
│   ├── terrain_rules.py # 地形规则
│   ├── battle_report.py # 战报
│   └── battle_settlement.py  # 结算
├── parsers/             # 解析器
│   ├── unit_table_parser.py
│   ├── terrain_parser.py
│   ├── battle_report_parser.py
│   └── settlement_parser.py
├── errors/              # 错误处理
│   └── friendly_errors.py  # 人话错误系统
├── versioning/          # 版本追踪
│   └── version_tracker.py
├── comparison/          # 比对引擎
│   └── comparison_engine.py
└── exporter/            # 导出模块
    └── review_exporter.py

sample_data/             # 示例数据
tests/                   # 测试脚本
```

## 快速开始

### 方式一：运行演示场景

```bash
python3 -m robot_football_tactics.cli demo
```

这个演示会模拟完整的提测场景：
1. 第一天早上：数值提交单位表 v1（早到）
2. 第一天下午：策划提交不完整的地形规则 v1
3. 第一天晚上：测试提交战报 v1 和结算 v1，第一次比对
4. 第二天早上：策划补充地形规则 v2（标记为补材料）
5. 第二天中午：策划补传旧版本地形规则 v0（时间更早，触发提醒）
6. 第二天下午：数值调整 B001 攻击力（改结论）
7. 第二天晚上：测试手工修改战报 v2（检测到手工改动）
8. 第三天早上：导出完整复盘报告

### 方式二：命令行比对

```bash
# 简单比对
python3 -m robot_football_tactics.cli compare \
  --report sample_data/battle_report_v1.txt \
  --settlement sample_data/battle_settlement_v1.txt

# 带完整材料比对并导出报告
python3 -m robot_football_tactics.cli compare \
  --report sample_data/battle_report_v1.txt \
  --settlement sample_data/battle_settlement_v1.txt \
  --unit-table sample_data/unit_table_v1.csv \
  --terrain sample_data/terrain_rules_v2_complete.txt \
  --export --title "半决赛复盘"
```

### 方式三：作为 Python 库使用

```python
from datetime import datetime
from robot_football_tactics.main import FootballTactics

app = FootballTactics()

# 加载材料
unit_table, warnings = app.load_unit_table(
    "sample_data/unit_table_v1.csv",
    submitted_by="数值-小王",
    comment="初始版本"
)

terrain, warnings = app.load_terrain_rules(
    "sample_data/terrain_rules_v2_complete.txt",
    submitted_by="策划-小李",
    comment="补全效果",
    is_material_only=True  # 标记为补材料
)

# 加载战报和结算
report, _ = app.load_battle_report("sample_data/battle_report_v1.txt")
settlement, _ = app.load_settlement("sample_data/battle_settlement_v1.txt")

# 比对
result = app.compare()
print(result.to_human_string())

# 导出复盘报告
text_path, json_path = app.export_review_report(
    title="半决赛复盘",
    comparison_report=result,
    output_dir="./output"
)
```

## 核心特性详解

### 1. 人话错误提示

错误信息不会出现 `unit_id`、`field_path` 这种内部字段名，而是翻译成：

```
❌ B001 攻击力从 95 改为 100（可能影响结论）
💡 建议：请确认攻击力调整是否正确，是否需要重新计算结算
```

而不是：
```
Error: field 'units.B001.attributes.atk' changed from 95 to 100
```

### 2. 区分补材料和改结论

- **补材料**（📝）：只修改描述、名称、说明等不影响计算的字段
  - 例如：把"冲锋机器人"改名为"冲锋机器人TYPE-A"
  - 例如：补充地形规则的效果描述

- **改结论**（🔴）：修改数值、规则等会影响结算结果的字段
  - 例如：把 B001 的攻击力从 95 调到 100
  - 例如：战报中增加一个进球事件

加载时可以明确标记：
```bash
python3 -m robot_football_tactics.cli load \
  --type terrain_rules \
  --file terrain_v2.txt \
  --material-only  # 标记为补材料
```

### 3. 旧版本补传提醒

如果后来补传的版本时间戳早于当前最新版本，系统会明确提醒：

```
⚠️  检测到补传地形规则旧版本！
💡 建议：这个版本的提交时间(2024-06-09 09:00:00) 早于当前最新版本(002, 2024-06-11 09:00:00)。
   已保留历史记录，不会静默覆盖。
```

所有版本都会保留在历史中，不会被覆盖。

### 4. 战报手工改动检测

系统会自动检测战报中的手工改动痕迹：
```
⚠️  战报检测到手工改动痕迹，请特别留意改动部分是否与结算一致
💡 建议：请确认战报改动是否有相应的结算修改
```

### 5. 可追溯的复盘报告

导出的复盘报告包含：
- **时间线**：谁在什么时候提交了什么版本
- **版本变更详情**：每次改了什么，哪些是补材料，哪些改结论
- **比对结果**：战报和结算的详细比对，带计算过程
- **待办事项**：下一班需要跟进的问题
- **原始材料存档**：所有版本的原始内容，不用翻聊天记录

## 支持的文件格式

| 文档类型 | 支持格式 |
|---------|---------|
| 单位表 | CSV、JSON、纯文本 |
| 地形规则 | JSON、纯文本 |
| 战报 | JSON、纯文本 |
| 结算 | JSON、纯文本 |

### 字段同义词映射

系统支持多种字段名，例如：
- `unit_id` / `id` / `编号` / `单位id`
- `hp` / `生命值` / `血量` / `体力`
- `atk` / `攻击力` / `攻击`
- `spd` / `速度` / `移动速度`

不用纠结字段名怎么写，系统会自动识别。

## 比对维度

系统会从以下维度进行比对：
1. ✅ 基本信息一致性
2. ✅ 最终比分一致性
3. ✅ 进球事件完整性
4. ✅ MVP 合理性
5. ✅ 球员统计数据一致性
6. ✅ 事件时序合理性
7. ✅ 单位属性与结果匹配度
8. ✅ 地形效果是否生效

## 命令参考

```bash
# 运行演示
python3 -m robot_football_tactics.cli demo

# 比对战报和结算
python3 -m robot_football_tactics.cli compare --report <file> --settlement <file>

# 加载新版本
python3 -m robot_football_tactics.cli load --type <type> --file <file>

# 查看版本历史
python3 -m robot_football_tactics.cli versions

# 比较两个版本差异
python3 -m robot_football_tactics.cli diff --type <type> --old-version <v1> --new-version <v2>

# 导出复盘报告
python3 -m robot_football_tactics.cli export --title <title>
```

## 最佳实践

1. **每次提交都标注清楚**：明确标记哪些是补材料，哪些改结论
2. **保留所有历史版本**：系统会自动保存，不要手动删除
3. **导出报告给下一班**：交接时附上复盘报告，不用翻聊天记录
4. **有疑问先看报告**：所有变更都有记录，先看报告再问人
