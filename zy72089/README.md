# 🎹 钢琴练习进步曲线分析系统

> 运营分析师阿乔的专用工具 —— 让每条进步曲线都能追到来源，让例外不再悄悄消失

## ✨ 核心特性

- **📊 可追溯计算**：每条数据都有完整追溯链，数据来源、转换规则、变更历史一目了然
- **⚠️ 智能边界检查**：硬边界报错、软边界提醒，异常不再悄悄消失
- **🔄 单位自动换算**：支持小时/分钟/秒时长换算，支持1-10/1-5/A-G等多种难度体系转换
- **🧠 智能难度识别**：自动检测字母难度等级（A-G），无需手动指定难度体系
- **⚖️ 权重闭合校验**：自动检查权重配置，确保权重总和正确
- **🔮 趋势预测**：基于历史数据线性回归预测，附详细预测理由说明
- **📝 备注补录差异**：支持临时补录人工备注，清晰展示补录前后差异
- **📜 旧口径回溯**：从历史样本中匹配旧口径记录，明确标注口径差异

## 📁 项目结构

```
piano_progress/
├── __init__.py          # 包初始化
├── main.py              # CLI命令行入口（analyze/diff/trace三个子命令）
├── calculator.py        # 核心计算模块 - 进步曲线加权计算、趋势预测
├── validator.py         # 验证模块 - 边界阈值、权重闭合检查
├── converter.py         # 单位换算模块 - 时长、难度系数转换
├── tracer.py            # 追溯模块 - 来源追踪、历史样本回溯
└── reporter.py          # 报告模块 - 异常清单、可读提醒、差异对比

data/
├── params.json          # 参数配置（权重、边界、归一化规则）
├── records.json         # 日常练习记录（含小时单位和字母难度）
├── sample_records.json  # 样例记录（顺利/待确认/旧口径三种）
├── history_samples.json # 历史样本库（旧口径数据）
├── legacy_mapping.json  # 旧口径记录映射配置
├── outliers.json        # 明显越界的样本
└── notes.yaml           # 人工备注和权重变更历史

tests/
└── test_calculator.py   # 单元测试（26个测试用例）

run_demo.py              # 完整演示脚本
```

## 🚀 快速开始

### 环境要求
- Python 3.8+
- 无需额外依赖（标准库即可运行）

### 安装验证

```bash
# 确认Python版本
python3 --version

# 验证模块可正常导入
python3 -c "from piano_progress import calculator, validator, converter, tracer, reporter; print('OK')"

# 运行单元测试
python3 -m unittest tests.test_calculator -v
```

### 示例命令

所有命令均在项目根目录下执行。

#### 1. 基础分析（常用）
```bash
python3 -m piano_progress.main analyze \
  -p data/params.json \
  -r data/records.json \
  --show-alerts
```

预期输出包含：
- 📊 运行汇总（总记录数8、平均进步分、整体趋势、待人工确认数、越界样本数）
- 🔮 下期预测（预测分数 + 预测理由说明）
- 📈 进步曲线明细表格（含总分、各维度分项分、状态标识）
- 🚨 异常清单（硬越界/待确认记录，附追溯信息）
- 💡 处理过程提醒（单位换算、边界检查、归一化、波动检查等）

运行此命令后，REC-003的字母难度"B"会被自动识别为8.5分（A-G体系），不会误报越界。

#### 2. 包含旧口径回溯的分析
```bash
mkdir -p report
python3 -m piano_progress.main analyze \
  -p data/params.json \
  -r data/sample_records.json \
  --history data/history_samples.json \
  --legacy-mapping data/legacy_mapping.json \
  --show-alerts \
  -o report/sample_analysis.md
```

预期输出：旧口径记录（REC-LEGACY-001/002）在进度表中标注 📜 标识，报告中记录匹配条件和口径版本。输出同时保存到 `report/sample_analysis.md`。

#### 3. 越界样本分析
```bash
python3 -m piano_progress.main analyze \
  -p data/params.json \
  -r data/outliers.json \
  --no-prediction
```

预期输出：3条越界样本全部标记为 ❌ 越界，异常清单中列出所有硬边界违规项：
- OUT-001: practice_duration=300分钟 > 上限 240分钟
- OUT-002: practice_duration=2分钟 < 下限 5分钟, mistake_count=60次 > 上限 50次, repetition_count=0次 < 下限 1次
- OUT-003: difficulty=11.0分 > 上限 10分, accuracy=105% > 上限 100%, repetition_count=25次 > 上限 20次

#### 4. 补录备注并对比差异
```bash
python3 -m piano_progress.main diff \
  -p data/params.json \
  -r data/records.json \
  --record-id REC-006 \
  --note "已与学员确认，当天确实只有10分钟练习时间，属真实情况，无需修正" \
  -o report/diff_report.md
```

预期输出：显示补录前后的差异对比和追溯链完整性验证。备注补充不影响计算结果（仅作记录），但追溯链会记录备注内容。

#### 5. 查看单条记录追溯链
```bash
python3 -m piano_progress.main trace \
  -p data/params.json \
  -r data/records.json \
  --record-id REC-003
```

预期输出：REC-003的完整追溯链，包含：
- 时长换算：1.5小时 → 90.00分钟
- 智能识别：检测到字母难度等级 'B'，自动使用A-G体系转换
- 难度换算：难度等级 B(A-G) → 8.5分(1-10)
- 边界检查：所有字段在允许范围内
- 归一化：各维度归一化结果
- 波动警告：环比上升31.3%
- 数据哈希：用于防篡改校验

### 完整演示
```bash
python3 run_demo.py
```

运行后会在 `report/` 目录下生成4份分析报告（Markdown格式）。

## 📝 输入格式说明

### 1. 参数配置文件 (params.json)

```json
{
  "fields": {
    "practice_duration": {"unit": "duration", "description": "每日练习时长"},
    "difficulty": {"scale": "1-10", "description": "练习难度"},
    "accuracy": {"description": "演奏准确率(%)"},
    "mistake_count": {"description": "错误次数"},
    "repetition_count": {"description": "重复练习次数"}
  },
  "weights": {
    "main": {
      "practice_duration": 30,
      "difficulty": 25,
      "accuracy": 25,
      "mistake_count": 10,
      "repetition_count": 10
    }
  },
  "boundaries": {
    "practice_duration": {
      "min": 5, "max": 240,
      "soft_min": 15, "soft_max": 180,
      "unit": "分钟"
    }
  },
  "normalization": {
    "practice_duration": {
      "method": "linear",
      "min": 0, "max": 180,
      "inverse": false
    }
  },
  "analysis": {
    "max_fluctuation_pct": 25
  }
}
```

**字段说明：**
- `fields.*.unit`：字段单位类型，`duration` 表示时长类字段（支持对象格式输入）
- `fields.*.scale`：难度体系，当值为字母等级（A-G）时系统自动识别，不受此配置限制
- `weights.main`：各指标权重，总和应为100（百分比模式）或1.0（小数模式）
- `boundaries.*.min/max`：硬边界，超出直接报错（❌ 越界）
- `boundaries.*.soft_min/soft_max`：软边界，超出提醒人工确认（⚠️ 待确认）
- `normalization.*.method`：归一化方法，支持 `linear`（线性）和 `log`（对数）
- `normalization.*.inverse`：是否反向归一化（如错误次数越少分越高）
- `analysis.max_fluctuation_pct`：环比波动阈值，超过则警告

### 2. 练习记录格式

```json
{
  "records": [
    {
      "record_id": "REC-001",
      "date": "2026-05-20",
      "practice_duration": 60,
      "difficulty": 5,
      "accuracy": 85,
      "mistake_count": 8,
      "repetition_count": 5,
      "_source_type": "manual",
      "_notes": ["备注内容"]
    }
  ]
}
```

**特殊字段：**
- `practice_duration` 支持对象格式：`{"value": 1.5, "unit": "hours"}`（自动换算为分钟）
- `difficulty` 支持字母等级：`"A"`, `"B"`, `"C"` 等（系统自动识别并使用A-G体系转换）
- `_source_type`：数据来源类型
  - `manual`：人工录入 👤
  - `imported`：系统导入 📥
  - `legacy`：旧口径补录 📜
  - `calculated`：计算生成 🧮
- `_notes`：人工备注列表

## 🚨 如何查看异常清单

### 异常分类

| 类型 | 标识 | 说明 | 处理建议 |
|------|------|------|----------|
| 硬越界错误 | ❌ 越界 | 超出硬边界阈值 | 必须修正数据 |
| 待人工确认 | ⚠️ 待确认 | 超出软边界或波动过大 | 人工核实后补录备注 |
| 旧口径记录 | 📜 | 从历史样本补录（无异常时不在异常清单中） | 注意口径差异 |

### 异常清单内容

每次运行分析报告都会包含完整的异常清单，内容包括：

1. **异常编号**：按出现顺序编号
2. **记录信息**：记录ID、日期
3. **硬越界错误详情**：具体哪些字段超出硬边界
4. **待人工确认详情**：哪些字段触发软边界或波动警告
5. **数据来源追溯**：
   - 追溯ID（格式：TRACE-{record_id}-{timestamp}）
   - 来源文件
   - 来源类型
   - 转换规则
6. **异常分类统计**：
   - 硬越界错误数量
   - 待人工确认数量
   - 旧口径记录数量

### 关键：异常不会悄悄消失

- 越界样本（超出硬边界）标记为 ❌，**不会被归一化截断后静默处理**
- 软边界触发标记为 ⚠️，**必须在异常清单中可见**
- 每个处理步骤都有可读提醒，所有提醒按类型分组显示（使用 `--show-alerts` 参数）

## 📊 进步曲线计算逻辑

### 总分计算公式
```
总分 = Σ(归一化分 × 权重 / 100)
```

当前权重配置（v2.0，自2026-05-15生效）：
| 维度 | 权重 | 归一化方法 |
|------|------|-----------|
| practice_duration（练习时长） | 30% | 线性，0-180分钟 |
| difficulty（难度） | 25% | 线性，1-10分 |
| accuracy（准确率） | 25% | 线性，60-100% |
| mistake_count（错误次数） | 10% | 对数，0-30次，反向 |
| repetition_count（重复次数） | 10% | 线性，1-10次 |

### 归一化方法

1. **线性归一化**（默认）
   ```
   归一化分 = (原始值 - min) / (max - min) × 100
   ```

2. **对数归一化**（适合错误次数等指标）
   ```
   归一化分 = (ln(原始值+1) - ln(min+1)) / (ln(max+1) - ln(min+1)) × 100
   ```

3. **反向归一化**（错误次数越少分越高）
   ```
   归一化分 = 100 - 正向归一化分
   ```

### 预测算法

当历史记录 ≥3 条时，使用**线性回归趋势预测**：
- 计算最近N条记录的线性回归斜率
- 预测下一期：`y = intercept + slope × n`
- 自动给出趋势判断（上升/下降/平稳）
- 附详细预测理由说明（不是只吐一个数字）

当历史记录 <3 条时，使用**简单移动平均**预测。

### 智能难度识别

当 `difficulty` 字段值为字母（A-G）时，系统自动识别并使用A-G难度体系转换，无需手动配置scale。

字母等级对应分值：
| 等级 | A | B | C | D | E | F | G |
|------|---|---|---|---|---|---|---|
| 分值 | 10 | 8.5 | 7 | 5.5 | 4 | 2.5 | 1 |

## 🔍 追溯链说明

每条记录都会生成完整的追溯链，包含：

| 字段 | 说明 |
|------|------|
| trace_id | 追溯唯一标识，格式：TRACE-{record_id}-{timestamp} |
| source_type | 数据来源类型（manual/imported/legacy/calculated） |
| source_file | 来源文件路径 |
| original_value | 原始输入值 |
| converted_value | 转换/计算后的值 |
| conversion_rule | 处理规则说明 |
| notes | 处理过程中的所有提醒信息（含单位换算、智能识别、边界检查等） |
| data_hash | 数据哈希校验，防止篡改 |

追溯链中的备注会记录完整的处理过程，包括：
- 单位换算详情（原值→目标值，换算系数）
- 智能识别日志（检测到字母难度等级，自动选择体系）
- 边界检查结果（正常/越界/警告）
- 归一化计算过程（原始值→归一化分，方法和范围）
- 波动检查结果（环比变化百分比，是否超过阈值）

## 📋 典型工作流（阿乔的日常）

### 工作流1：日常分析
1. 运行 `analyze` 命令分析本周记录
2. 查看**异常清单**，找出需要确认的记录
3. 与相关人员核实异常情况
4. 对确认无误的记录，用 `diff` 命令补录备注
5. 保存报告用于月底复盘

### 工作流2：旧口径数据补录
1. 准备 `legacy_mapping.json`，指定匹配条件（日期+难度等）
2. 运行 `analyze` 时带上 `--history` 和 `--legacy-mapping` 参数
3. 系统自动从历史样本中匹配旧口径记录
4. 报告中会标注 📜 标识，明确是旧口径数据
5. 追溯链中会记录匹配条件和原口径版本

### 工作流3：月底复盘
1. 运行完整分析，生成 Markdown 报告（`-o report/xxx.md`）
2. 用报告中的**异常清单**解释特殊情况
3. 用**预测说明**给出下月改进建议
4. 用**追溯链**回答数据来源问题
5. 用 `--save-traces` 导出追溯数据存档备查

## 💡 提醒信息说明

系统会输出多种类型的可读提醒：

| 提醒类型 | 前缀 | 说明 |
|----------|------|------|
| 智能识别 | `[智能识别]` | 自动检测字母难度等级并选择转换体系 |
| 单位换算 | `[单位换算]` | 正常的单位转换记录 |
| 单位换算提醒 | `[单位换算提醒]` | 异常情况（未知单位等） |
| 边界正常 | `[边界正常]` | 字段在正常范围内 |
| 边界越界 | `[边界越界]` | 超出硬边界（❌） |
| 边界警告 | `[边界警告]` | 超出软边界，待确认（⚠️） |
| 归一化 | `[归一化]` | 正常的归一化记录 |
| 归一化提醒 | `[归一化提醒]` | 值超出归一化参考范围，已截断 |
| 权重闭合 | `[权重闭合]` | 权重配置正确 |
| 权重警告 | `[权重警告]` | 权重配置有问题 |
| 波动正常 | `[波动正常]` | 环比变化在合理范围 |
| 波动警告 | `[波动警告]` | 环比变化过大，待确认 |

## 🧪 样例记录说明

`data/sample_records.json` 中包含三类样例：

1. **✅ 顺利记录**（REC-SMOOTH-001）
   - 所有指标均在正常范围
   - 无异常提醒
   - 状态：✓ 正常

2. **⚠️ 待人工确认**（REC-CONFIRM-001）
   - 练习时长10分钟 < 软下限15分钟
   - 状态：⚠️ 待确认
   - 需要人工核实后补录备注

3. **📜 旧口径补录**（REC-LEGACY-001, REC-LEGACY-002）
   - 从 `history_samples.json` 中匹配
   - 标注旧口径版本号（v1.1）
   - 记录权重变更历史
   - 提醒口径差异

`data/records.json` 中包含8条日常记录，其中：
- REC-003 使用了对象格式的时长 `{"value": 1.5, "unit": "hours"}` 和字母难度 `"B"`，系统自动完成换算

`data/outliers.json` 中包含3条明显越界样本，用于验证边界检查功能。

## 🧪 验证命令

```bash
# 运行全部单元测试（26个用例）
python3 -m unittest tests.test_calculator -v

# 验证基础分析
python3 -m piano_progress.main analyze -p data/params.json -r data/records.json --show-alerts

# 验证字母难度换算（REC-003难度B→8.5分）
python3 -m piano_progress.main trace -p data/params.json -r data/records.json --record-id REC-003

# 验证越界检测
python3 -m piano_progress.main analyze -p data/params.json -r data/outliers.json --no-prediction

# 验证备注补录差异
python3 -m piano_progress.main diff -p data/params.json -r data/records.json --record-id REC-006 --note "测试备注"

# 完整演示
python3 run_demo.py
```

## 📚 参考文件

- `data/notes.yaml`：人工备注和权重变更历史记录（v1.0→v1.1→v2.0）
- `data/params.json`：当前生效的参数配置（v2.0权重：30/25/25/10/10）
- `report/`：生成的分析报告目录

## 📋 权重变更历史

| 版本 | 日期 | 时长 | 难度 | 准确率 | 错误 | 重复 | 变更说明 |
|------|------|------|------|--------|------|------|----------|
| v1.0 | 2026-04-01 | 40 | 20 | 20 | 10 | 10 | 初始版本 |
| v1.1 | 2026-05-01 | 35 | 25 | 20 | 10 | 10 | 提升难度权重 |
| v2.0 | 2026-05-15 | 30 | 25 | 25 | 10 | 10 | 提升准确率权重（当前版本） |

---

**月底复盘时，直接拿这份报告出来解释就行，不用再翻一堆旧记录啦！** 🎉
