# 语音转写错词归因系统

## 系统概述

本系统用于语音转写（ASR）错误的归因分析，支持版本管理、冲突检测和人工审核。系统确保：
- 模型版本变更后旧报告不会被无声覆盖
- 阈值、证据和人工改判可追溯
- 原始来源和处理时间完整保留
- 空值、重复项和边界记录妥善处理

## 快速开始

### 1. 安装依赖

```bash
cd asr_error_attribution
pip install -r requirements.txt
```

### 2. 放置样本数据

将以下文件放入 `data/raw/` 目录：
- **评测日志**: `evaluation_logs.csv` - 包含ASR输出和参考文本
- **标注表**: `annotations.csv` - 包含错误词标注和人工标注

文件格式要求参见 [数据格式说明](#数据格式说明)。

### 3. 运行归因处理

```bash
# 基本用法
python main.py process --annotations annotations.csv --model-version whisper_v1

# 完整用法（含评测日志和阈值配置）
python main.py process \
  --eval-log evaluation_logs.csv \
  --annotations annotations.csv \
  --threshold threshold_v1.json \
  --model-version whisper_v1 \
  --description "第一轮评测" \
  --created-by "小孟"
```

### 4. 查看结果

```bash
# 列出所有版本
python main.py list-versions

# 查看版本详情
python main.py show-version v1.0.0

# 查看版本统计
python main.py summary v1.0.0
```

### 5. 处理冲突

```bash
# 列出冲突
python main.py list-conflicts v1.0.0

# 列出未解决的冲突
python main.py list-conflicts v1.0.0 --unresolved-only

# 人工审核冲突
python main.py review v1.0.0 \
  --conflict-id <conflict_id> \
  --reviewer "小孟" \
  --action revise \
  --final-type homophone \
  --notes "确认是同音词错误"
```

### 6. 导出报告

```bash
# 导出CSV
python main.py export v1.0.0 --format csv

# 导出JSON
python main.py export v1.0.0 --format json

# 导出自定义文件名
python main.py export v1.0.0 --format xlsx --output my_report.xlsx
```

## 项目结构

```
asr_error_attribution/
├── data/
│   ├── raw/              # 原始输入数据
│   │   ├── evaluation_logs.csv    # 评测日志
│   │   └── annotations.csv        # 标注表
│   ├── processed/        # 中间处理结果
│   ├── versions/         # 版本化报告（永不覆盖）
│   │   ├── v1.0.0/
│   │   ├── v1.0.1/
│   │   └── manifest.json
│   ├── thresholds/       # 阈值配置
│   └── homophones.json   # 同音词表
├── src/
│   ├── models.py         # 数据模型定义
│   ├── attribution.py    # 归因处理逻辑
│   ├── conflict_manager.py  # 冲突检测与管理
│   ├── version_manager.py   # 版本管理
│   └── cli.py            # 命令行界面
├── main.py               # 入口脚本
├── config.yaml           # 系统配置
└── README.md
```

## 数据格式说明

### 评测日志 (evaluation_logs.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| log_id | string | 是 | 日志唯一标识 |
| audio_id | string | 否 | 音频ID |
| reference_text | string | 是 | 参考文本 |
| asr_output | string | 是 | ASR输出 |
| model_version | string | 是 | 模型版本 |
| wer | float | 否 | 词错误率 |
| cer | float | 否 | 字错误率 |
| created_at | string | 否 | 创建时间 (ISO格式) |

### 标注表 (annotations.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| annotation_id | string | 是 | 标注唯一标识 |
| log_id | string | 是 | 关联的日志ID |
| error_word | string | 是 | 错误词 |
| correct_word | string | 是 | 正确词 |
| error_type | string | 否 | 人工标注的错误类型 |
| confidence | float | 否 | 标注置信度 |
| annotated_by | string | 否 | 标注人 |
| annotated_at | string | 否 | 标注时间 |
| notes | string | 否 | 备注 |
| is_valid | bool | 否 | 是否有效 |

### 阈值配置 (thresholds/*.json)

```json
{
  "version": "threshold_v1",
  "confidence_high": 0.9,
  "confidence_medium": 0.7,
  "confidence_low": 0.5,
  "created_at": "2024-01-01T00:00:00",
  "created_by": "小孟",
  "description": "初始阈值配置"
}
```

## 错误类型说明

| 类型 | 说明 |
|------|------|
| homophone | 同音词错误 |
| acronym | 缩写识别错误 |
| proper_noun | 专有名词错误 |
| background_noise | 背景噪音干扰 |
| accent | 口音影响 |
| unknown | 未知错误 |

## 版本管理

### 版本命名规则

版本采用语义化版本号 `v{major}.{minor}.{patch}`，如 `v1.0.0`、`v1.0.1`。

每次运行 `process` 命令会自动创建新版本，补丁版本号自动递增。

### 模型版本切换

当模型版本变更时，只需在 `process` 命令中指定新的 `--model-version` 参数：

```bash
# 使用新模型版本处理
python main.py process \
  --annotations new_annotations.csv \
  --model-version whisper_v2 \
  --description "Whisper v2 评测"
```

旧版本报告保留在 `data/versions/` 目录下，不会被覆盖。

### 继续处理旧版本

如需在旧版本基础上追加数据，使用版本目录下的 `append_to_version_data` 接口（Python API）。

## 冲突清单查看

### 冲突类型

| 冲突类型 | 说明 |
|----------|------|
| type_mismatch | 自动归因类型与人工标注类型不一致 |
| confidence_mismatch | 自动归因置信度与标注置信度差异显著 |
| missing_data | 标注数据存在空值 |

### 查看冲突的完整信息

```bash
# 查看冲突列表，获取conflict_id
python main.py list-conflicts v1.0.0

# 查看版本详情，了解整体情况
python main.py show-version v1.0.0
```

## 边界情况处理

系统已针对以下边界情况做了特殊处理：

1. **空值处理**: 空的错误词或正确词会标记为 `unknown` 类型，证据中明确记录"空值"
2. **重复项去重**: 相同(log_id, error_word, correct_word)的重复标注自动去重
3. **低置信度处理**: 置信度低于阈值的归因标记为待人工审核
4. **无匹配类型**: 无法匹配任何错误类型时标记为 `unknown`

## 交接说明（致模型评测同事小孟）

### 接手时需要了解的关键点

1. **数据来源追溯**: 每条归因结果都包含：
   - `source_file`: 原始数据文件名
   - `created_at`: 处理时间
   - `model_version`: 处理时使用的模型版本
   - `threshold_version`: 处理时使用的阈值版本
   - `evidence`: 归因判断依据

2. **历史版本查看**:
   ```bash
   # 查看所有版本及其描述
   python main.py list-versions
   ```

3. **为什么这么判**:
   - 查看单条记录的 `evidence` 字段了解判断依据
   - 如有 `review_notes` 字段，包含人工审核意见

### 常见问题

**Q: 如何确认某条记录的处理时间和处理人？**
A: 在 `data/versions/{version}/meta.json` 中查看版本的创建时间和创建人。单条记录的 `created_at` 是处理时间，`reviewed_by` 是审核人。

**Q: 模型升级后旧报告还在吗？**
A: 是的，所有版本数据都永久保存在 `data/versions/` 目录下，永不覆盖。

**Q: 如何区分自动归因和人工审核的结果？**
A: `status` 字段：
  - `auto_attributed`: 自动归因
  - `manual_reviewed`: 已人工审核
  - `pending`: 待处理
  - `final_error_type` 字段为最终结果（如有）

**Q: 如何批量导出数据给下游？**
A: 使用 `export` 命令导出 CSV/JSON/XLSX 格式。

## 命令参考

```bash
python main.py --help
python main.py process --help
python main.py list-versions --help
python main.py show-version --help
python main.py list-conflicts --help
python main.py review --help
python main.py export --help
python main.py summary --help
```

## 示例数据

系统自带示例数据位于 `data/raw/` 目录，包含：
- 10条评测日志
- 12条标注（含空值、重复项、冲突案例）

可直接运行以下命令体验完整流程：

```bash
python main.py process \
  --eval-log evaluation_logs.csv \
  --annotations annotations.csv \
  --threshold threshold_v1.json \
  --model-version whisper_v1 \
  --description "示例数据测试"
```
