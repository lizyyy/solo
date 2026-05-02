# Dataset Audit Tool

工业视觉团队训练缺陷分类模型前的数据集预检工具。

## 功能

- **类别映射检查**: 验证标注中的类别是否在定义中存在
- **标注框验证**: 检查标注框越界、空标注、无效标注
- **重复检测**: 使用 pHash 检测相似图片，使用文件哈希检测完全相同图片
- **类别均衡分析**: 检测类别极度不均衡问题
- **文件缺失检测**: 检查图片文件是否存在

## 输出

- `dataset_audit.md`: 完整的审计报告
- `issues.csv`: 问题清单（便于进一步处理）
- `sample_gallery.html`: 可视化图库（可直接在浏览器打开）

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
python -m zy8093.cli \
    --manifest sample_data/images_manifest.csv \
    --labels sample_data/labels.jsonl \
    --split sample_data/split.yaml \
    --output audit_output \
    --base-path sample_data
```

### 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --manifest | -m | images_manifest.csv 路径 | 必填 |
| --labels | -l | labels.jsonl 路径 | 必填 |
| --split | -s | split.yaml 路径 | 必填 |
| --output | -o | 输出目录 | audit_output |
| --base-path | -b | 图片文件基础路径 | . |
| --imbalance-threshold | - | 类别不平衡阈值 | 10.0 |
| --min-samples | - | 最小样本数阈值 | 5 |

## Demo

使用示例数据运行：

```bash
python -m zy8093.cli \
    -m sample_data/images_manifest.csv \
    -l sample_data/labels.jsonl \
    -s sample_data/split.yaml \
    -o sample_output \
    -b sample_data
```

然后打开 `sample_output/sample_gallery.html` 查看结果。

## 数据格式

### images_manifest.csv

```csv
image_id,file_path,width,height
img_001,images/img_001.jpg,640,480
img_002,images/img_002.jpg,640,480
```

### labels.jsonl

```json
{"annotation_id": "ann_001", "image_id": "img_001", "category_id": "scratch", "bbox": [10, 20, 100, 80]}
{"annotation_id": "ann_002", "image_id": "img_002", "category_id": "dent", "bbox": [50, 50, 80, 80]}
```

### split.yaml

```yaml
train:
  - img_001
  - img_002
val:
  - img_003
test:
  - img_004
```

## 项目结构

```
zy8093/
├── cli.py              # 命令行接口
├── parsers/            # 数据解析模块
│   ├── manifest.py     # 解析 images_manifest.csv
│   ├── labels.py       # 解析 labels.jsonl
│   └── split.py        # 解析 split.yaml
├── rules/              # 规则检查模块
│   ├── category_mapping.py  # 类别映射检查
│   ├── bbox_validation.py   # 标注框验证
│   ├── duplicate_detection.py # 重复检测
│   └── class_balance.py     # 类别均衡分析
├── reports/            # 报告生成模块
│   ├── markdown_report.py   # 生成 dataset_audit.md
│   ├── csv_report.py        # 生成 issues.csv
│   └── html_gallery.py      # 生成 sample_gallery.html
├── sample_data/        # 示例数据
└── tests/              # 测试用例
```

## 测试

运行测试：

```bash
pytest tests/
```

## 问题类型

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| UNKNOWN_CATEGORY | warning | 类别未在定义中 |
| MISSING_IN_MANIFEST | error | 图片在标注中但不在 manifest |
| MISSING_ANNOTATIONS | error | 图片在 split 中但无标注 |
| EMPTY_ANNOTATION | warning | 空标注框 |
| BBOX_NEGATIVE | error | 标注框坐标为负 |
| BBOX_OUT_OF_BOUNDS | error | 标注框越界 |
| BBOX_INVALID | error | 标注框尺寸无效 |
| FILE_MISSING | error | 图片文件不存在 |
| DUPLICATE_ACROSS_SPLITS | error | 训练/验证集存在重复图片(pHash) |
| IDENTICAL_ACROSS_SPLITS | error | 训练/验证集存在完全相同图片 |
| EXCESSIVE_DUPLICATES | warning | 存在大量重复图片 |
| SEVERE_CLASS_IMBALANCE | warning | 类别严重不平衡 |
| LOW_SAMPLE_COUNT | warning | 某类别样本数过少 |
| MISSING_CATEGORY_IN_SPLIT | error | 某类别在某 split 中无样本 |