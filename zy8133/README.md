# qPCR Reviewer - qPCR 96孔板结果复核工具

一个用于分子检测实验室复核 qPCR 96 孔板结果的 Python CLI 工具。

## 功能特性

- **输入解析**：支持 plate_layout.csv、ct_results.jsonl、controls.yaml 三种输入格式
- **智能分析**：
  - 计算 Ct 均值和标准差
  - 自动检测离群孔
  - 评估污染/抑制风险
  - 验证对照有效性
- **边界处理**：
  - 孔位格式验证（如 H13 无效）
  - NTC 缺失检测
  - Ct 缺失标记（不视为阴性）
- **输出报告**：
  - Markdown 格式复核报告
  - CSV 格式问题列表
  - 交互式 HTML 热图

## 安装

```bash
# 克隆项目后安装依赖
pip install -e .
```

或使用 pip 安装：

```bash
pip install pandas numpy pyyaml jinja2 click
```

## 快速开始

### 1. 准备输入文件

#### plate_layout.csv (孔板布局)

```csv
well_id,sample_id,target,sample_type
A1,PC1,ORF1ab,positive_control
A2,PC1,ORF1ab,positive_control
A5,S001,ORF1ab,unknown
A6,S001,ORF1ab,unknown
...
```

- **well_id**: 孔位ID (如 A1, H12)
- **sample_id**: 样本ID
- **target**: 靶标名称
- **sample_type**: 样本类型 (可选)

#### ct_results.jsonl (Ct 结果)

每行一个 JSON 对象：

```jsonl
{"well_id": "A1", "ct_value": 25.3}
{"well_id": "A2", "ct_value": 25.5}
{"well_id": "B1", "ct_missing": true}
{"well_id": "B2", "ct_value": "Undetermined"}
```

支持的 Ct 值表示：
- 数字：`{"ct_value": 25.3}`
- 缺失标记：`{"ct_missing": true}`
- 字符串：`{"ct_value": "Undetermined"}` 或 `{"ct_value": null}`

#### controls.yaml (对照配置)

```yaml
# 阳性对照
positive_controls:
  - PC1

# 阴性对照
negative_controls:
  - NC1

# NTC (无模板对照)
ntc_controls:
  - NTC

# Ct 阳性阈值
ct_cutoff: 38.0

# 重复孔容差 (超过此值视为离群)
replicate_tolerance: 1.0

# 最小 NTC 数量
min_ntc_count: 1
```

### 2. 运行复核

使用示例数据运行：

```bash
cd /Users/lzy/pro/solocoder/pro/zy8133/repo/zy8133

# 安装依赖
pip install -e .

# 运行复核
qpcr-reviewer \
  --plate-layout samples/plate_layout.csv \
  --ct-results samples/ct_results.jsonl \
  --controls samples/controls.yaml \
  --output-dir output \
  --verbose
```

或使用简写参数：

```bash
qpcr-reviewer \
  -p samples/plate_layout.csv \
  -c samples/ct_results.jsonl \
  -k samples/controls.yaml \
  -o output \
  -v
```

### 3. 查看输出

输出目录包含三个文件：

1. **review_report.md** - 详细的复核报告
2. **issues.csv** - 问题列表
3. **plate_heatmap.html** - 交互式热图（可直接在浏览器打开）

## 命令行参数

| 参数 | 简写 | 必需 | 说明 |
|------|------|------|------|
| `--plate-layout` | `-p` | 是 | 孔板布局 CSV 文件 |
| `--ct-results` | `-c` | 是 | Ct 结果 JSONL 文件 |
| `--controls` | `-k` | 是 | 对照配置 YAML 文件 |
| `--output-dir` | `-o` | 否 | 输出目录 (默认: 当前目录) |
| `--report-name` | | 否 | 报告文件名前缀 (默认: review_report) |
| `--verbose` | `-v` | 否 | 显示详细输出 |

## 边界情况处理

### 1. 孔位格式错误

无效孔位会触发明确的错误：

```bash
# 如果 plate_layout.csv 包含 H13
错误: 孔板布局文件错误: 无效的孔位ID: 'H13'。96孔板应为A-H行，1-12列（如A1、H12）。
```

### 2. 缺少 NTC

如果配置中定义的 NTC 不存在：

```bash
错误: 缺少必需的NTC（无模板对照）。配置中定义的NTC为: NTC。需要至少 1 个NTC孔，但只找到 0 个。
```

### 3. Ct 缺失处理

Ct 缺失不会被当成阴性：

- 所有重复孔 Ct 缺失 → 状态为 "缺失" (MISSING)
- 部分孔 Ct 缺失 → 缺失孔标记为离群，有效孔参与计算

## 示例数据说明

`samples/` 目录包含示例数据，覆盖各种场景：

| 样本 | 场景 | 说明 |
|------|------|------|
| PC1 | 阳性对照 | Ct ~25，正常阳性 |
| NC1 | 阴性对照 | Ct 缺失，正常阴性 |
| NTC | 无模板对照 | Ct 缺失，正常 |
| S001 | 强阳性 | Ct ~22 |
| S002 | 弱阳性 | Ct ~35 |
| S003 | 离群孔 | Ct 28.6 vs 30.2 (差异 >1) |
| S004 | 全部缺失 | 所有孔 Ct 缺失 |
| S005 | 临界值 | Ct 37.8-38.1 (接近阈值) |
| S006 | 离群孔 | Ct 26.4 vs 28.9 (差异 >1) |
| S007 | 阴性 | Ct ~39-40 (> 38) |
| S008 | 部分缺失 | 2个缺失，2个有效 |

## 项目结构

```
qpcr_reviewer/
├── __init__.py          # 包初始化
├── parser.py            # 解析模块 (输入文件解析)
├── rules.py             # 规则引擎 (分析逻辑)
├── reporter.py          # 报告导出 (Markdown/CSV/HTML)
└── cli.py               # CLI 入口

samples/
├── plate_layout.csv     # 示例孔板布局
├── ct_results.jsonl     # 示例 Ct 结果
└── controls.yaml        # 示例对照配置

pyproject.toml           # 项目配置
README.md                # 本文档
```

## 分析规则

### 离群孔检测

- 使用中位数偏差法
- 偏差超过 `replicate_tolerance` (默认 1.0) 的孔视为离群
- 离群孔不参与 Ct 均值计算

### 结果判定

| 条件 | 结果 |
|------|------|
| Ct 均值 ≤ ct_cutoff | 阳性 |
| Ct 均值 > ct_cutoff | 阴性 |
| 所有孔 Ct 缺失 | 缺失 |
| 数据不一致 | 不确定 |

### 风险评估

**污染风险**：
- NTC 检出阳性 → 高风险
- 阴性对照检出阳性 → 中风险

**抑制风险**：
- 阳性对照未检出 → 中风险
- 样本全部缺失 → 中风险

## 依赖

- Python ≥ 3.9
- pandas ≥ 2.0.0
- numpy ≥ 1.24.0
- pyyaml ≥ 6.0
- jinja2 ≥ 3.1.0
- click ≥ 8.0.0

## 许可证

MIT License
