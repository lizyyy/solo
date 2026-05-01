# 菜谱步骤结构化抽取模型评估工具

用于评估 LLM/ML 模型输出的菜谱结构化抽取质量，校验食材、用量、步骤顺序和火候标签。

## 项目结构

```
.
├── evaluate.py           # CLI 入口
├── schema.yaml           # 菜谱数据结构定义
├── parsers/              # CSV/JSONL/YAML 解析模块
├── validators/           # 规则校验逻辑
├── metrics/              # 指标统计
├── reports/              # MD/CSV/HTML 报告渲染
└── sample_data/          # 示例数据
    ├── recipes.csv
    ├── golden.jsonl
    └── model_outputs.jsonl
```

## 输入文件格式

### recipes.csv
```csv
recipe_id,recipe_name,raw_text
recipe_001,番茄炒蛋,"番茄炒蛋制作步骤..."
```

### golden.jsonl / model_outputs.jsonl
```json
{"recipe_id": "recipe_001", "recipe_name": "番茄炒蛋", "ingredients": [{"name": "番茄", "quantity": "2个", "unit": "个"}], "steps": [{"step_number": 1, "instruction": "切块", "heat_level": "low"}]}
```

### schema.yaml
定义字段类型、必填项、火候允许值和校验规则。

## 快速开始

### 安装依赖
```bash
pip install pyyaml
```

### 运行 Demo
```bash
python evaluate.py \
  --recipes sample_data/recipes.csv \
  --golden sample_data/golden.jsonl \
  --model-outputs sample_data/model_outputs.jsonl \
  --schema schema.yaml \
  --output-dir output
```

### 查看输出
- `output/summary.md` - 评估摘要报告
- `output/errors.csv` - 错误明细 CSV
- `output/comparison.html` - 可浏览的对比页面

## 评估指标

- **字段级准确率**: 食材、火候等字段的正确率
- **常见混淆**: 错误类型分布、Top 食材/火候混淆
- **步骤顺序统计**: 编号乱序问题统计
- **缺字段统计**: 缺失字段分布