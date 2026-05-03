# 过敏原清线放行复核工具 (Allergen Release Checker)

食品厂 QA 换产前复核过敏原清线放行的本地 Python CLI 工具。

## 功能特性

- 📋 **多源数据读取**: 支持产品配方 CSV、产线批次 JSONL、清洁验证记录 CSV、规则 YAML
- 🧪 **过敏原风险分析**: 自动判断上一批过敏原残留风险
- 🧹 **清洁验证检查**: 验证清洁记录是否覆盖关键设备和 swab 点位
- 🏷️ **标签切换监控**: 检查标签切换是否滞后
- ⏰ **跨午夜处理**: 识别并高亮跨午夜换产的批次
- 🚫 **设备冲突检测**: 检测同一设备被多个批次重复占用
- 📊 **多格式输出**:
  - `release_report.md`: 详细的放行报告
  - `risks.csv`: 风险清单表格
  - `timeline.html`: 交互式时间线可视化（可直接在浏览器打开）

## 项目结构

```
allergen_release_checker/
├── __init__.py
├── cli.py              # CLI 主入口
├── parser/             # 数据解析模块
│   └── __init__.py
├── rules/              # 规则引擎模块
│   └── __init__.py
├── timeline/           # 时间线处理模块
│   └── __init__.py
├── report/             # 报告生成模块
│   └── __init__.py
└── html/               # HTML 可视化模块
    └── __init__.py

sample_data/            # 内置示例数据
├── product_formulas.csv
├── production_batches.jsonl
├── cleaning_records.csv
└── rules.yaml

pyproject.toml          # 项目配置
README.md               # 本文档
```

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或下载项目
cd zy8164

# 以可编辑模式安装（推荐开发使用）
pip install -e .

# 或者直接安装依赖
pip install pyyaml pandas jinja2
```

## 快速开始

### 使用示例数据运行（推荐首次体验）

```bash
# 使用内置的 sample 数据运行
allergen-check --sample -v
```

### 使用自定义数据运行

```bash
# 使用自己的数据文件
allergen-check \
  --formulas ./data/product_formulas.csv \
  --batches ./data/production_batches.jsonl \
  --cleaning ./data/cleaning_records.csv \
  --rules ./data/rules.yaml \
  -o ./output \
  -v
```

### 命令行参数

| 参数 | 说明 |
|------|------|
| `--formulas` | 产品配方 CSV 文件路径 |
| `--batches` | 产线批次 JSONL 文件路径 |
| `--cleaning` | 清洁验证记录 CSV 文件路径 |
| `--rules` | 规则 YAML 文件路径 |
| `--sample` | 使用内置 sample 数据运行（用于演示） |
| `-o, --output` | 输出目录（默认: ./output） |
| `-v, --verbose` | 显示详细执行信息 |
| `--list-sample` | 列出内置 sample 数据文件 |

## 数据文件格式说明

### 1. 产品配方 CSV (`product_formulas.csv`)

```csv
product_code,product_name,allergens,formula_version,description
PRD001,纯牛奶,无,V1.0,无过敏原
PRD002,花生牛奶,花生,V1.0,含花生过敏原
PRD003,核桃牛奶,坚果,V1.0,含坚果过敏原
```

**字段说明**:
- `product_code`: 产品代码（唯一标识）
- `product_name`: 产品名称
- `allergens`: 过敏原列表，用逗号分隔，"无"表示无过敏原
- `formula_version`: 配方版本号
- `description`: 产品描述

### 2. 产线批次 JSONL (`production_batches.jsonl`)

每行一个 JSON 对象：

```json
{
  "batch_id": "BATCH-001",
  "production_line": "LINE-A",
  "product_code": "PRD001",
  "product_name": "纯牛奶",
  "allergens": [],
  "start_time": "2026-05-03T08:00:00",
  "end_time": "2026-05-03T10:30:00",
  "equipment": ["MIXER-A1", "FILLER-A1", "PASTEURIZER-A1"],
  "label_switch_time": null
}
```

**字段说明**:
- `batch_id`: 批次号（唯一标识）
- `production_line`: 产线名称
- `product_code`: 产品代码
- `product_name`: 产品名称
- `allergens`: 过敏原数组（可从配方自动获取）
- `start_time`: 批次开始时间 (ISO 8601 格式)
- `end_time`: 批次结束时间 (ISO 8601 格式)
- `equipment`: 使用的设备列表
- `label_switch_time`: 标签切换时间（可选）

### 3. 清洁验证记录 CSV (`cleaning_records.csv`)

```csv
record_id,equipment,cleaning_time,swab_point,swab_result,inspector,notes
CLN-001,MIXER-A1,2026-05-03T10:45:00,SWAB-A1-01,pass,张工,批次切换清洁
CLN-002,FILLER-A1,2026-05-03T10:50:00,SWAB-A1-02,pass,张工,批次切换清洁
```

**字段说明**:
- `record_id`: 清洁记录编号
- `equipment`: 清洁的设备
- `cleaning_time`: 清洁时间 (ISO 8601 格式)
- `swab_point`: Swab 检测点位（可选，空表示未检测）
- `swab_result`: 检测结果: `pass` 通过 / `fail` 失败（可选）
- `inspector`: 检验员
- `notes`: 备注

### 4. 规则 YAML (`rules.yaml`)

```yaml
high_risk_allergens:
  - 花生
  - 坚果
  - 大豆

required_swab_points:
  - SWAB-A1-01
  - SWAB-A1-02
  - SWAB-A1-03

swab_validity_hours: 24
max_label_lag_minutes: 30

critical_equipment:
  - MIXER-A1
  - FILLER-A1
  - PASTEURIZER-A1
```

**配置项说明**:
- `high_risk_allergens`: 高风险过敏原列表
- `required_swab_points`: 必需的 swab 检测点位
- `swab_validity_hours`: Swab 检测结果有效期（小时）
- `max_label_lag_minutes`: 标签切换最大允许滞后时间（分钟）
- `critical_equipment`: 关键设备列表（必须覆盖清洁）

## 风险检测规则

### 1. 过敏原残留风险

当上一批次含有过敏原，而当前批次不含该过敏原时，触发风险预警。

**风险等级**:
- 🔴 **高风险**: 上一批含高风险过敏原（花生、坚果、大豆等）
- 🟡 **中风险**: 上一批含普通过敏原
- 🟢 **低风险/无**: 过敏原无变化

### 2. 清洁验证覆盖检查

检查换产期间的清洁记录是否覆盖：

- ✅ 关键设备全部覆盖
- ✅ 必需的 swab 点位全部检测
- ✅ Swab 结果在有效期内

### 3. 标签切换滞后

检查标签切换时间是否在允许的时间范围内：

- 默认最大滞后: 30 分钟
- 超过时间触发警告

### 4. 特殊情况检测

#### 跨午夜换产

当批次跨越午夜 00:00 时，会在报告中高亮显示：

- 提示换班交接风险
- 建议确认清洁记录完整性
- 在 timeline.html 中用虚线标记午夜线

#### 设备冲突

当同一设备被多个批次同时占用时：

- 🔴 严重错误，需要立即修正生产排程
- 在 timeline.html 中用紫色闪烁块标记

#### 缺少 Swab 点位

当换产期间缺少必需的 swab 检测点位时：

- 🟡 触发警告
- 列出具体缺失的点位

## 输出文件说明

### 1. release_report.md

详细的 Markdown 格式放行报告，包含：

- **执行摘要**: 整体状态统计
- **各产线详情**: 每个产线的批次列表和换产评估
- **特殊情况**: 跨午夜批次、设备冲突、缺失 swab 点位
- **放行建议**: 基于规则的放行决策

### 2. risks.csv

CSV 格式的风险清单，方便导入其他系统：

| 列名 | 说明 |
|------|------|
| production_line | 产线名称 |
| prev_batch | 上一批次号 |
| next_batch | 当前批次号 |
| risk_type | 风险类型 |
| severity | 严重程度 (critical/high/medium/low) |
| message | 风险描述 |
| recommendation | 处理建议 |

### 3. timeline.html

交互式时间线可视化，可直接在浏览器中打开：

**功能**:
- 📅 按产线显示时间轴
- 🎨 不同颜色区分批次类型：
  - 绿色: 无过敏原批次
  - 黄色: 含过敏原批次
  - 红色: 高风险过敏原批次
  - 紫色闪烁: 设备冲突
- 🔵 蓝色圆点: 清洁记录
- 🟢 绿色圆点: 清洁验证通过
- 🔴 红色圆点: 清洁验证失败
- ⏰ 虚线标记: 午夜分界线
- 🔍 鼠标悬停显示详细信息
- 🎛️ 可筛选产线和调整时间范围

## 演示示例

### 示例 1: 基本使用

```bash
# 使用 sample 数据运行
allergen-check --sample -o ./demo_output -v
```

**预期输出**:
```
📁 加载数据文件...
   - 产品配方: .../sample_data/product_formulas.csv
   - 产线批次: .../sample_data/production_batches.jsonl
   - 清洁记录: .../sample_data/cleaning_records.csv
   - 规则配置: .../sample_data/rules.yaml
✅ 数据加载完成:
   - 配方数量: 8
   - 批次数量: 11
   - 清洁记录数量: 24
📅 构建产线时间线...
✅ 时间线构建完成，共 3 条产线
   - LINE-A: 5 批次, 16 清洁记录
   - LINE-B: 3 批次, 6 清洁记录
   - LINE-C: 3 批次, 6 清洁记录
🔍 执行规则分析...
✅ 分析完成:
   - 总换产次数: 8
   - 通过: 2
   - 警告: 4
   - 未通过: 2

⚠️  检测到 1 个跨午夜批次:
   - 产线 LINE-B: 批次 BATCH-004 (2026-05-03 22:00:00 至 2026-05-04 00:30:00)

❌ 检测到 1 个设备冲突:
   - 设备 'MIXER-C1' 冲突: 批次 BATCH-007 与批次 BATCH-008 重叠 15.0 分钟

📄 生成报告到 ./demo_output...
✅ release_report.md 和 risks.csv 已生成
✅ timeline.html 已生成

==================================================
⚠️  检测到 7 个问题，请检查报告
==================================================
```

### 示例 2: 查看生成的文件

```bash
# 查看输出目录
ls -la ./demo_output/

# 用浏览器打开时间线
open ./demo_output/timeline.html

# 查看风险清单
cat ./demo_output/risks.csv
```

### 示例 3: 准备自己的数据

1. 参考 sample_data 目录下的文件格式
2. 准备以下 4 个文件：
   - `product_formulas.csv`: 产品配方
   - `production_batches.jsonl`: 生产批次
   - `cleaning_records.csv`: 清洁记录
   - `rules.yaml`: 业务规则

3. 运行检查：

```bash
allergen-check \
  --formulas ./my_data/formulas.csv \
  --batches ./my_data/batches.jsonl \
  --cleaning ./my_data/cleaning.csv \
  --rules ./my_data/rules.yaml \
  -o ./my_report
```

## 模块架构

### 1. Parser 模块 (`parser/__init__.py`)

- `read_csv()`: 读取 CSV 文件
- `read_jsonl()`: 读取 JSONL 文件
- `read_yaml()`: 读取 YAML 文件
- `parse_formulas()`: 解析产品配方
- `parse_production_batches()`: 解析生产批次
- `load_all_data()`: 加载所有数据文件

### 2. Rules 模块 (`rules/__init__.py`)

- `AllergenRiskRules`: 过敏原风险判断规则
- `CleaningVerificationRules`: 清洁验证规则
- `LabelSwitchRules`: 标签切换规则
- `ConflictRules`: 设备冲突规则
- `RulesEngine`: 规则引擎入口

### 3. Timeline 模块 (`timeline/__init__.py`)

- `Batch`: 批次数据类
- `CleaningRecord`: 清洁记录数据类
- `ProductionTimeline`: 产线时间线管理
- `build_timelines()`: 构建所有产线时间线

### 4. Report 模块 (`report/__init__.py`)

- `ReportGenerator`: 报告生成器
  - `generate_release_report()`: 生成 release_report.md
  - `generate_risks_csv()`: 生成 risks.csv
- `analyze_timelines()`: 分析所有时间线

### 5. HTML 模块 (`html/__init__.py`)

- `TimelineHTMLGenerator`: 时间线 HTML 生成器
  - `generate()`: 生成 timeline.html

## 常见问题

### Q1: 如何处理跨午夜的批次？

A: 工具会自动检测跨越午夜的批次，并在报告中高亮显示。建议：
- 确认换班交接时的清洁记录完整性
- 检查是否有遗漏的 swab 检测
- 确认标签切换时间正确

### Q2: 设备冲突如何处理？

A: 设备冲突表示生产排程存在问题，建议：
- 立即修正生产排程
- 检查批次的开始/结束时间是否正确
- 确认设备分配是否合理

### Q3: Swab 点位缺失如何处理？

A: 如果缺少必需的 swab 点位：
- 检查清洁记录是否完整
- 确认是否在换产期间完成了所有必要的检测
- 补充缺失的检测记录后重新运行

### Q4: 如何自定义规则？

A: 修改 `rules.yaml` 文件中的配置项：
- 调整 `high_risk_allergens` 定义高风险过敏原
- 调整 `required_swab_points` 定义必需的检测点位
- 调整 `swab_validity_hours` 更改检测有效期
- 调整 `max_label_lag_minutes` 更改标签切换允许滞后时间

## 版本历史

### v0.1.0 (2026-05-03)
- 初始版本发布
- 支持多源数据读取
- 实现过敏原风险分析
- 实现清洁验证检查
- 实现标签切换监控
- 实现跨午夜批次检测
- 实现设备冲突检测
- 生成 Markdown 报告、CSV 风险清单、HTML 时间线
- 内置 sample 数据

## 许可证

本工具仅供内部 QA 使用。

---

**如有问题或建议，请联系开发团队。**
