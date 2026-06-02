# 隐私脱敏效果评估工具

为算法工程师小乔设计的隐私脱敏效果评估小工具。核心目标：**重复评测、样本分层、导出报告**三者数据一致，避免各算各的。

## ✨ 核心特性

- **🔁 可重复评测**：同一输入多次运行结果完全一致
- **📊 多层样本分层**：按敏感类型、错误类型自动分组统计
- **📝 证据可追溯**：每条评估结果都带原始日志和标注的来源链接
- **⚔️ 冲突管理**：冲突案例独立记录，支持人工标注和解决
- **📝 备注补录**：支持临时添加评审备注，补录前后差异可追踪
- **📈 多版本对比**：不同模型版本的评估结果一键对比
- **📄 报告导出**：JSON/HTML双格式，带着原因和证据导出

## 📁 目录结构

```
.
├── main.py                    # 工具入口
├── privacy_eval/              # 核心代码
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── data_loader.py         # 数据加载器
│   ├── evaluator.py           # 评估引擎
│   ├── reporter.py            # 报告生成
│   └── cli.py                 # 命令行接口
├── samples/                   # 样本数据目录（重要！按此结构放置）
│   ├── model_logs/            # 模型输出日志（按版本分子目录）
│   │   ├── v1.0/
│   │   │   └── batch_001.jsonl
│   │   └── v2.0/
│   │       └── batch_001.jsonl
│   ├── annotations/           # 人工标注表
│   │   └── ground_truth.csv
│   ├── thresholds/            # 阈值配置
│   │   └── default.yaml
│   ├── conflicts/             # 冲突案例
│   │   └── known_conflicts.json
│   ├── notes/                 # 人工备注补录
│   │   └── additional_notes.json
│   └── README.md              # 样本格式说明
├── reports/                   # 评估报告输出目录
└── requirements.txt
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 查看可用模型版本

```bash
python3 main.py list-versions
```

输出示例：
```
📦 可用模型版本:
  - v1.0 (1 个日志文件)
  - v2.0 (1 个日志文件)
```

### 3. 执行评估

```bash
python3 main.py evaluate --model-version v1.0
```

关键参数：
- `--model-version/-v`：指定模型版本（对应 `samples/model_logs/` 下的目录名）
- `--dedup/--no-dedup`：是否对重复记录去重（默认开启）
- `--with-notes/--no-notes`：是否加载人工备注（默认开启）

### 4. 导出评估报告

```bash
# 导出HTML格式（推荐，带样式和证据链接）
python3 main.py export --model-version v1.0 --format html

# 导出JSON格式（用于程序处理）
python3 main.py export --model-version v1.0 --format json
```

报告将保存到 `reports/` 目录。

### 5. 对比两个模型版本

```bash
python3 main.py diff --version1 v1.0 --version2 v2.0 --export
```

`--export` 选项会同时导出两个版本的详细报告。

## 📝 样本放置指南

### 模型输出日志

**位置**：`samples/model_logs/{版本号}/*.jsonl`

**格式**：每行一条JSON，支持多文件。

```json
{
  "record_id": "REC001",
  "model_version": "v1.0",
  "original_text": "原始文本",
  "masked_text": "脱敏后文本",
  "detected_entities": [
    {"type": "phone", "start": 8, "end": 19, "value": "13800138000", "level": "partial_mask"}
  ],
  "timestamp": "2026-06-01T10:00:00"
}
```

**敏感类型**：`id_card`, `phone`, `name`, `email`, `address`, `bank_card`, `other`

**脱敏级别**：`full_mask`（全脱敏）, `partial_mask`（部分脱敏）, `replacement`（替换）, `not_masked`（未脱敏）

### 标注表

**位置**：`samples/annotations/ground_truth.csv`

**格式**：CSV格式，支持多标注员。

| record_id | sensitive_type | start_pos | end_pos | original_value | expected_level | comment | source |
|-----------|----------------|-----------|---------|----------------|----------------|---------|--------|
| REC001    | phone          | 8         | 19      | 13800138000    | partial_mask   | 手机号   | annotator_A |

### 阈值配置

**位置**：`samples/thresholds/default.yaml`

**格式**：YAML，为每种敏感类型设置不同的通过阈值。

```yaml
thresholds:
  - sensitive_type: id_card
    precision_threshold: 0.98
    recall_threshold: 0.98
    f1_threshold: 0.98
    description: "身份证号要求最高，不能漏也不能错"
```

评估结果低于阈值时会自动产生告警。

## 🔄 版本切换

模型版本通过目录名区分，切换版本只需改变 `--model-version` 参数：

```bash
# 评估v1.0版本
python3 main.py evaluate -v v1.0

# 评估v2.0版本
python3 main.py evaluate -v v2.0
```

新增版本时，在 `samples/model_logs/` 下创建新目录即可：

```bash
mkdir -p samples/model_logs/v3.0
# 把新的日志文件放到 samples/model_logs/v3.0/ 下
python3 main.py list-versions  # 会自动发现新版本
```

## ⚔️ 冲突清单管理

冲突案例是指模型输出和标注不一致、且需要人工评审的边界情况。

### 查看冲突清单

```bash
# 只看未解决的
python3 main.py list-conflicts

# 看所有（包括已解决的）
python3 main.py list-conflicts --all
```

### 添加冲突案例

```bash
python3 main.py add-conflict \
  --record-id REC009 \
  --conflict-type false_negative \
  --description "座机号是否需要脱敏需要合规确认"
```

冲突类型：`false_negative`（漏检）, `false_positive`（误报）, `wrong_level`（级别错误）, `mismatch_type`（类型错误）, `conflict`（其他冲突）

### 解决冲突

```bash
python3 main.py resolve-conflict \
  --record-id REC009 \
  --resolution "合规确认：座机号不需要脱敏，标注正确"
```

## 📝 备注补录

评估过程中发现问题，可以随时添加备注，备注会自动合并到后续的评估报告中。

```bash
python3 main.py add-note \
  --record-id REC004 \
  --note "漏检原因：正则表达式缺少139号段，已在v2.0修复" \
  --author "xiaoqiao"
```

**补录后的差异**：重新评估或导出报告时，备注会自动附加到对应记录的 `note` 字段中，评审时可以看到完整的上下文。

## 🔍 评估结果解读

### 错误类型

| 错误类型 | 说明 |
|---------|------|
| `false_negative` | 漏检：应该脱敏的没有检测到 |
| `false_positive` | 误报：不该脱敏的被脱敏了 |
| `wrong_level` | 脱敏级别错误：比如应该全脱敏却只做了部分脱敏 |
| `mismatch_type` | 类型不匹配：模型识别的敏感类型和标注不一致 |
| `conflict` | 人工标记的冲突案例 |

### 评估指标

- **精确率(Precision)**：模型识别的敏感信息中，真正需要脱敏的比例
- **召回率(Recall)**：所有应该脱敏的信息中，被模型正确识别的比例
- **F1分数**：精确率和召回率的调和平均，综合指标

## 🧪 典型测试场景

工具已内置以下测试场景的样例数据：

| 场景 | 样例记录 | 说明 |
|------|---------|------|
| 空值处理 | REC007 | 原始文本为空，自动跳过 |
| 重复记录 | REC001 | 同一ID出现多次，自动去重并提示 |
| 漏检 | REC004, REC009 | 手机号、座机号漏检 |
| 误报 | REC006 | 8位数字被误识别为手机号 |
| 脱敏级别错误 | REC008 | 身份证应该全脱敏却只做了部分脱敏 |
| 边界案例 | REC009 | 座机号是否需要脱敏存在争议 |

## 🔧 常用命令速查

```bash
# 基础评估
python3 main.py evaluate -v v1.0

# 导出报告
python3 main.py export -v v1.0 -f html

# 版本对比
python3 main.py diff -v1 v1.0 -v2 v2.0 -e

# 冲突管理
python3 main.py list-conflicts
python3 main.py add-conflict -r REC009 -t false_negative -d "描述"
python3 main.py resolve-conflict -r REC009 -d "解决说明"

# 备注补录
python3 main.py add-note -r REC004 -n "备注内容" -a "xiaoqiao"

# 查看版本
python3 main.py list-versions

# 查看帮助
python3 main.py --help
python3 main.py evaluate --help
```

## 📄 报告内容说明

HTML报告包含以下部分：

1. **总体指标**：精确率、召回率、F1、正确/错误数量
2. **阈值告警**：哪些敏感类型的准确率低于预设阈值
3. **未解决冲突**：需要人工评审的冲突案例列表
4. **按敏感类型分层**：各类型的准确率和错误分布
5. **按错误类型分层**：各类错误的数量和涉及记录
6. **错误详情**：每条错误的完整信息、原因说明、证据链接

**所有结论都可追溯**：点击证据链接可以直接跳转到原始日志或标注的对应行。

---

*工具设计原则：不求大而全，但求每一步都能对上证据，每一次评测都能复现。*
