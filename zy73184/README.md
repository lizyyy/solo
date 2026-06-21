# 约束规划参数回放工具

用于约束规划参数的回放计算、来源追踪、单位换算、排序稳定性检测和一页式复核报告生成。

## 目录结构

```
.
├── constraint_param_replay/    # 工具源码
│   ├── cli.py                  # 命令行入口
│   ├── engine.py               # 核心引擎
│   ├── models.py               # 数据模型
│   ├── report.py               # 报告生成
│   └── data_loader.py          # 数据加载
├── data/                       # 数据材料（项目经理看这里）
│   ├── formulas/               # 公式定义
│   │   └── formulas.json
│   ├── unit_conversions.json   # 单位换算规则
│   ├── history/                # 历史答案
│   │   ├── latest_answers.json # 最新版历史答案
│   │   └── old_answers.json    # 旧版历史答案
│   ├── attachments/            # 晚到附件
│   │   └── late_data.json
│   └── notes/                  # 口头备注
│       ├── verbal_note_01.txt
│       └── verbal_note_02.txt
├── examples/                   # 示例输入
│   ├── input_sample.json       # 示例输入数据
│   └── sort_reference.json     # 排序参考
├── output/                     # 输出结果
│   └── *.txt / *.json          # 生成的报告
└── run_demo.sh                 # 一键演示脚本
```

## 快速开始

### 方式一：一键演示（推荐项目经理用）

```bash
bash run_demo.sh
```

### 方式二：手动跑示例

```bash
# 基础回放（带排序检测和来源追踪）
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version v1.0_demo \
  --sort-reference examples/sort_reference.json

# 指定目标单位（比如都换成万元）
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version v1.0_wan \
  --target-unit 万元
```

## 常用命令

### 1. 回放计算

```bash
python3 -m constraint_param_replay replay -i <输入文件> [选项]
```

常用选项：
- `--param-version`：参数版本号，会显示在报告里
- `--target-unit`：目标单位，所有结果会换算到这个单位
- `--sort-reference`：排序参考文件，用于检测排序不稳定
- `--data-dir`：数据目录（默认 data/）
- `--attach-dir`：附件目录（默认 data/attachments/）
- `--notes-dir`：备注目录（默认 data/notes/）
- `--output-dir`：输出目录（默认 output/）

### 2. 记录判断调整

```bash
python3 -m constraint_param_replay judge \
  --row-id A003 \
  --old "合格" \
  --new "需复核" \
  --reason "数值异常" \
  --operator "小孟"
```

### 3. 列出所有判断调整记录

```bash
python3 -m constraint_param_replay list
```

### 4. 查看帮助

```bash
python3 -m constraint_param_replay help
```

## 材料说明（哪些材料影响结论）

### 影响计算结果的材料

| 材料类型 | 存放位置 | 影响方式 | 示例记录 |
|---------|---------|---------|---------|
| 最新历史答案 | data/history/latest_answers.json | 作为基准值 | A001, A004, A005 |
| 旧版历史答案 | data/history/old_answers.json | 覆盖基准值（标记 from_history_old 的行） | A002, B001 |
| 晚到附件 | data/attachments/ | 覆盖基准值（标记 from_attachment_late 的行） | A003, A006, B001 |
| 公式 | data/formulas/formulas.json | 计算基准值（有 formula_name 的行） | A003, A004, UNIT_001 |
| 单位换算规则 | data/unit_conversions.json | 单位换算时使用 | 元↔万元, 个↔千个 |

### 不影响计算但影响判断的材料

| 材料类型 | 存放位置 | 影响方式 | 示例记录 |
|---------|---------|---------|---------|
| 口头备注 | data/notes/ | 添加说明，可能标记为改判断或仅说明 | A005（改判断）, A006（仅说明） |

### 结果中的来源标记

每条受影响的记录会显示：
- **来源类型**：晚到附件 / 口头备注 / 历史旧版答案
- **来源文件**：具体哪个文件
- **内容摘要**：文件内容概要
- **影响类型**：改值 / 改判断 / 仅说明
- **影响说明**：变化前后对比
- **参数版本**：对应的版本号

## 输出说明

### CLI 输出包含

```
【处理统计】     总数、已处理、坏行、跳过行、排序不稳定（各算各的，不混）
【影响统计】     受晚到附件影响、受口头备注影响、受旧版答案影响、有单位换算
【按来源分布】   各来源分别有多少行
【坏行】         为什么是坏行
【跳过行】       为什么跳过
【排序不稳定】   单独拎出，不混入已处理
【单位换算提示】 哪些行做了单位换算、哪些失败
【判断调整记录】 历次判断变更
【受影响记录明细】 每条受影响记录的详情（来源、变化、说明）
```

### 生成的报告

- **文本报告**（.txt）：一页式复核，打印就能看
- **JSON 报告**（.json）：结构化数据，可用于二次开发

报告里每条记录可查：
- 基准值 vs 最终值
- 公式名和参数版本
- 单位换算依据
- 所有来源详情（类型、文件、是否改值/改判断）
- 解释说明
- 判断调整历史

## 验证命令（可重复运行）

### 验证 1：晚到附件会改变对应记录并留下痕迹

```bash
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version test_attachment \
  --sort-reference examples/sort_reference.json \
  | grep -A5 "受晚到附件影响"

# 预期：A003 的值从 20000 变为 25000（+25%），来源是 late_data.json
```

### 验证 2：口头备注能进入解释但不影响无关结果

```bash
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version test_note \
  | grep -A4 "受口头备注影响"

# 预期：A005 标记为"改判断"，A006 标记为"仅说明"
# 预期：A001、A004 等不受备注影响
```

### 验证 3：单位变化导致的偏差能定位到公式和参数版本

```bash
# 先以元为单位
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version test_unit_yuan

# 再以万元为单位
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version test_unit_wan \
  --target-unit 万元

# 对比两个报告，A003、UNIT_001 等数值差 10000 倍，
# 但单位换算依据和公式版本都能在报告里查到
```

### 验证 4：排序不稳定单独列出

```bash
python3 -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version test_sort \
  --sort-reference examples/sort_reference.json \
  | grep -A2 "排序不稳定"

# 预期：A003 被单独列出，不混入"已处理"统计
```

## 示例数据场景说明

示例输入（examples/input_sample.json）覆盖以下场景：

| 记录 | 场景 | 预期结果 |
|-----|------|---------|
| A001 | 仅最新历史答案（对照组） | 不受影响，基准值来自最新历史 |
| A002 | 使用旧版历史答案 | 受旧版答案影响，单位从元变万元，值不变 |
| A003 | 公式计算 + 晚到附件 + 排序不稳定 | 受附件影响（+25%），排序单独拎出 |
| A004 | 公式计算（对照组） | 不受影响，纯公式计算 |
| A005 | 最新历史 + 口头备注（含"调整"） | 受备注影响，标记为"改判断" |
| A006 | 晚到附件 + 口头备注（仅说明） | 受附件影响（-5%），备注仅作说明 |
| B001 | 旧版答案 + 晚到附件 | 受两者叠加影响 |
| BAD_001 | 坏行（无有效值） | 标记为坏行 |
| 空ID行 | 坏行（缺少 ID） | 标记为坏行 |
| SKIP_001 | 跳过行（待确认） | 标记为跳过 |
| SKIP_002 | 跳过行（草稿） | 标记为跳过 |
| UNIT_001 | 单位换算测试 | 用 --target-unit 可验证换算 |

## 常见问题

**Q: 材料文件放哪里？**
A: 都在 data/ 目录下。附件放 data/attachments/，备注放 data/notes/，历史答案放 data/history/。

**Q: 怎么知道哪些记录被附件改了？**
A: CLI 输出【影响统计】里有"受晚到附件影响"的数量，【受影响记录明细】里有每条的详情。报告里也能查到。

**Q: 备注会不会乱改结果？**
A: 不会。备注分三类：改值、改判断、仅说明。只有明确标注数值调整的备注才会被认为可能影响判断，但不会自动改数值。

**Q: 排序不稳定的记录去哪了？**
A: 单独拎出来了，不在"已处理"统计里，避免混入正常结果影响统计。

**Q: 判断调整记录存在哪？**
A: output/judgment_changes.jsonl，每次回放会自动加载。
