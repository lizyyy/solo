# TinyML Quantization Regression Diagnostic CLI

本地端侧算法量化回归诊断工具，用于对比 float 基线模型和 int8 量化模型的预测差异。

## 安装

```bash
pip install -r requirements.txt
```

## 目录结构

```
tinyml_diagnostic/
├── parser/          # 解析模块：JSONL/CSV/YAML
├── alignment/       # 对齐模块：按 sample_id 对齐数据
├── metrics/         # 指标模块：top1、准确率、置信度漂移、召回变化
├── reporter/        # 报告模块：生成 MD/CSV/HTML 报告
├── sample_data/     # 示例数据
├── tests/           # 最小测试
└── cli.py           # CLI 入口
```

## 输入格式

### Float 基线预测 (JSONL)
```json
{"sample_id": "img_001", "predictions": {"cat": 0.85, "dog": 0.10}}
```

### Int8 量化预测 (JSONL)
```json
{"sample_id": "img_001", "predictions": {"cat": 0.82, "dog": 0.12}}
```

### 样本标签 (CSV)
```csv
sample_id,label
img_001,cat
img_002,dog
```

### 量化阈值 (YAML)
```yaml
cat: 1.0
dog: 1.5
```

## Demo 命令

```bash
# 安装依赖
cd tinyml_diagnostic
pip install -r requirements.txt

# 运行诊断（使用示例数据）
python -m tinyml_diagnostic.cli \
  --baseline sample_data/baseline_predictions.jsonl \
  --quantized sample_data/quantized_predictions.jsonl \
  --labels sample_data/labels.csv \
  --thresholds sample_data/thresholds.yaml \
  --output-dir output

# 查看报告
cat output/drift_report.md
open output/comparison.html
```

## 输出文件

- `drift_report.md` - 量化漂移汇总报告
- `bad_cases.csv` - 问题样本列表
- `comparison.html` - 可交互的 HTML 对比页面

## 边界处理

- 缺失 sample_id：跳过并记录警告
- 类别名不一致：自动对齐，未出现的类别置信度为 0
- 缺失标签：跳过该样本的指标计算