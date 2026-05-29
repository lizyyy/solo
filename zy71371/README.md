# 摄影选片去重CLI

一个用于婚礼摄影师批量筛选照片的命令行工具，支持图片去重、人脸分组、评分筛选、人工确认和报告导出。

## 功能特点

- 📷 **图片去重**: 基于感知哈希算法检测重复照片和连拍照片
- 👤 **人脸分析**: 自动识别人脸并分组，支持重点人物标记
- 😊 **闭眼检测**: 自动检测闭眼照片并标记
- ⭐ **智能评分**: 基于人物、构图、质量等多维度评分
- 👆 **人工审核**: 交互式人工确认流程
- 📊 **报告导出**: 生成摘要报告、详细明细、CSV/JSON导出

## 安装

```bash
# 使用 pip 安装
pip install -e .

# 或使用 poetry
poetry install
```

## 快速开始

### 演示模式（无需真实照片）

```bash
# 使用模拟数据演示完整流程
photo-curator demo --count 100 --key-persons 新郎 --key-persons 新娘 --auto-confirm

# 查看生成的报告
ls output/
```

### 真实照片处理

```bash
# 完整选片流程
photo-curator curate ./photos --key-persons 新郎 --key-persons 新娘

# 自动确认模式（跳过人工审核）
photo-curator curate ./photos --key-persons 新郎 --auto-confirm

# 仅去重检测
photo-curator dedupe ./photos

# 仅人脸分析
photo-curator faces ./photos --key-persons 新郎

# 仅评分
photo-curator score ./photos --min-score 60

# 列出并筛选照片
photo-curator list ./photos --status keep --min-score 80
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `curate` | 执行完整的选片流程 |
| `dedupe` | 仅执行去重检测 |
| `faces` | 仅执行人脸分析 |
| `score` | 仅执行评分 |
| `demo` | 使用模拟数据演示 |
| `list` | 列出并筛选照片 |

## 输出文件

运行后会在输出目录生成以下文件：

- `summary_*.md`: 选片摘要报告
- `details_*.csv`: 详细明细CSV
- `details_*.json`: 详细明细JSON
- `duplicates_*.md`: 重复照片组明细
- `keypersons_*.md`: 重点人物照片明细

## 评分规则

照片评分基于以下因素：

- 重点人物: +20分/人
- 人脸数量: +5分/人（最多5人）
- 高分辨率: +10分
- 中高分辨率: +5分
- 文件大小正常: +3分

## 状态说明

- `keep`: 保留
- `remove_duplicate`: 重复照片
- `remove_closed_eyes`: 闭眼照片
- `remove_low_score`: 低评分
- `remove_manual`: 手动删除
- `pending`: 待审核

## 项目结构

```
photo_curator/
├── __init__.py          # 包初始化
├── models.py            # 数据模型定义
├── cli.py               # CLI入口
├── duplicate_detector.py # 去重检测模块
├── face_analyzer.py     # 人脸分析模块
├── scorer.py            # 评分和筛选模块
├── manual_review.py     # 人工审核模块
├── report_exporter.py   # 报告导出模块
└── simulator.py         # 模拟数据生成器
```

## 注意事项

1. 首次运行人脸分析可能较慢，取决于照片数量和硬件性能
2. face_recognition 库需要额外安装 dlib，如无法安装将使用模拟模式
3. 建议在正式处理前先使用 `demo` 命令熟悉流程
