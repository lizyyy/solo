# 镜头瑕疵分拣台

> 二手相机检测师专用本地 AI/ML 工具 - Lens Defect Sorting Station

![Python Version](https://img.shields.io/badge/python-3.8%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 项目简介

每天收到一批镜头测试图、检测员备注 CSV 和机身/镜头编号时，人工找霉斑、暗角、偏心、坏点很慢。

**镜头瑕疵分拣台** 是一个本地 AI/ML 工具，帮助检测师：
- 自动提取图像特征（清晰度、暗角、色偏、坏点热区等）
- 按镜头生成异常评分
- 对相似缺陷进行聚类分组
- 支持人工确认并保存检测状态
- 导出多种格式的检测报告

## 功能特性

### 图像特征提取
- **清晰度检测**: 基于 Laplacian 方差检测图像锐度
- **暗角检测**: 分析四角亮度与中心的差异
- **色偏检测**: 检测 RGB 三通道的颜色不平衡
- **坏点/热点检测**: 识别孤立的异常像素点
- **噪点评估**: 分析图像噪点水平
- **对比度/亮度分析**: 基础图像质量评估

### 异常评分与聚类
- **多维度加权评分**: 综合各维度特征计算异常分数
- **K-Means 聚类**: 自动对相似缺陷镜头进行分组
- **相似缺陷查找**: 查找具有相同问题类型的镜头

### 人工确认与状态管理
- **会话持久化**: 所有检测状态保存到本地
- **人工确认**: 支持检测师手动确认结果
- **复检标记**: 可标记需要重新检查的镜头
- **历史记录**: 保留所有检测会话的历史

### 报告导出
- **Markdown 检测报告**: 详细的检测报告，适合人工查看
- **CSV 问题清单**: 结构化数据，适合导入其他系统
- **JSON 审计包**: 完整的会话数据，用于存档和审计

## 项目结构

```
lens_inspector/
├── __init__.py           # 包初始化
├── models.py             # 数据模型定义
├── validator.py          # 数据校验模块
├── image_features.py     # 图像特征提取
├── clustering.py         # 聚类评分模块
├── storage.py            # 状态存储模块
├── reporter.py           # 报告生成模块
└── cli.py                # 命令行主程序

examples/
├── notes.csv             # 示例备注CSV
└── generate_test_images.py  # 生成测试图像

tests/
├── __init__.py
├── test_models.py
├── test_validator.py
├── test_image_features.py
├── test_clustering.py
└── test_storage.py

requirements.txt
pyproject.toml
README.md
```

## 安装

### 环境要求
- Python 3.8+
- pip

### 安装依赖

```bash
# 克隆项目
cd xy4155

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

## 快速开始

### 使用示例数据验证（临时目录流程）

这是一个完整的验证流程，使用临时目录和合成测试图像。

#### 1. 创建临时工作目录

```bash
# 创建临时目录
mkdir -p /tmp/lens_inspector_test/images
cd /tmp/lens_inspector_test
```

#### 2. 生成测试图像

```bash
# 运行图像生成脚本（需要先将 examples 目录下的脚本复制到临时目录）
python /path/to/xy4155/examples/generate_test_images.py images
```

或者手动创建简单的测试图像：

```bash
cd images
python3 << 'EOF'
import numpy as np
from PIL import Image

# 正常图像
img1 = np.random.randint(100, 200, (600, 800, 3), dtype=np.uint8)
Image.fromarray(img1).save("LENS-001_1.png")
Image.fromarray(img1 + 10).save("LENS-001_2.png")

# 带暗角的图像（创建渐变亮度）
x = np.linspace(0.3, 1.0, 800)
y = np.linspace(0.3, 1.0, 600)
xv, yv = np.meshgrid(x, y)
brightness = xv * yv
img2 = (np.random.randint(100, 200, (600, 800, 3)) * brightness[:, :, None]).astype(np.uint8)
Image.fromarray(img2).save("LENS-002_1.png")

# 色偏图像（红色通道增强）
img3 = np.random.randint(100, 200, (600, 800, 3), dtype=np.uint8)
img3[:, :, 0] = np.clip(img3[:, :, 0] * 1.5, 0, 255).astype(np.uint8)
Image.fromarray(img3).save("LENS-003_1.png")

print("测试图像生成完成")
EOF
cd ..
```

#### 3. 创建备注 CSV

创建 `notes.csv` 文件：

```csv
lens_id,body_id,notes,inspector,received_date
LENS-001,BODY-A01,"正常镜头，状态良好",张工,2026-04-28
LENS-002,BODY-A02,"边角有暗角，需要确认",李工,2026-04-29
LENS-003,BODY-A03,"颜色偏红，怀疑色偏",王工,2026-04-30
```

#### 4. 导入数据创建会话

```bash
# 切换到项目目录
cd /Users/mac/pro/solocoder/pro/xy4155/repo/xy4155

# 导入数据
python -m lens_inspector.cli import \
    --images /tmp/lens_inspector_test/images \
    --notes /tmp/lens_inspector_test/notes.csv
```

你会看到类似这样的输出：

```
╔══════════════════════════════════════════════════════════════╗
║                    镜头瑕疵分拣台                              ║
║         LENS DEFECT SORTING STATION - v0.1.0                 ║
╠══════════════════════════════════════════════════════════════╣
║  二手相机检测师专用AI工具                                       ║
║  支持: 清晰度/暗角/色偏/坏点检测 + 缺陷聚类 + 人工确认         ║
╚══════════════════════════════════════════════════════════════╝


正在导入数据...
  图片目录: /tmp/lens_inspector_test/images
  备注CSV: /tmp/lens_inspector_test/notes.csv

✓ 数据验证通过
  发现 3 个镜头组:
    - LENS-001: 2 张图片
    - LENS-002: 1 张图片
    - LENS-003: 1 张图片

✓ 会话创建成功
  会话ID: abc123def456
  保存位置: .lens_inspector/session_abc123def456.json
```

**记下你的会话ID**，后面的命令都需要用到它。

#### 5. 查看会话列表

```bash
python -m lens_inspector.cli list
```

#### 6. 运行图像分析

```bash
# 使用你的会话ID替换下面的 SESSION_ID
python -m lens_inspector.cli analyze --session YOUR_SESSION_ID
```

分析过程会：
- 提取每张图片的特征
- 计算每个镜头的异常评分
- 运行缺陷聚类

#### 7. 查看检测状态

```bash
# 查看所有镜头的状态摘要（默认只显示异常镜头）
python -m lens_inspector.cli status --session YOUR_SESSION_ID

# 查看所有镜头（包括正常的）
python -m lens_inspector.cli status --session YOUR_SESSION_ID --show-all

# 查看某个具体镜头的详情
python -m lens_inspector.cli status --session YOUR_SESSION_ID --lens LENS-001
```

#### 8. 人工确认检测结果

```bash
# 进入交互式确认模式
python -m lens_inspector.cli confirm --session YOUR_SESSION_ID

# 或者直接确认单个镜头
python -m lens_inspector.cli confirm --session YOUR_SESSION_ID \
    --lens LENS-001 \
    --notes "经人工确认，该镜头状态正常"

# 标记镜头需要复检
python -m lens_inspector.cli confirm --session YOUR_SESSION_ID \
    --lens LENS-002 \
    --flag \
    --notes "暗角情况需要进一步检测"
```

#### 9. 导出检测报告

```bash
# 创建输出目录
mkdir -p /tmp/lens_inspector_test/reports

# 导出所有格式的报告
python -m lens_inspector.cli export \
    --session YOUR_SESSION_ID \
    --format all \
    --output /tmp/lens_inspector_test/reports

# 只导出特定格式
python -m lens_inspector.cli export \
    --session YOUR_SESSION_ID \
    --format markdown \
    --output /tmp/lens_inspector_test/reports

# 包含所有镜头（包括正常的）
python -m lens_inspector.cli export \
    --session YOUR_SESSION_ID \
    --format all \
    --output /tmp/lens_inspector_test/reports \
    --include-all
```

导出的文件包括：
- `inspection_report_YYYYMMDD_HHMMSS.md` - Markdown 格式报告
- `inspection_summary_YYYYMMDD_HHMMSS.csv` - 镜头级摘要
- `defect_details_YYYYMMDD_HHMMSS.csv` - 缺陷级明细
- `audit_package_YYYYMMDD_HHMMSS.json` - 完整审计包

#### 10. 清理临时会话（可选）

```bash
# 删除测试会话
python -m lens_inspector.cli delete --session YOUR_SESSION_ID

# 或者直接删除整个存储目录
rm -rf .lens_inspector
```

## 命令行参考

### 全局选项

```bash
lens-inspector --help
lens-inspector --version
```

### import - 导入数据

```bash
lens-inspector import [OPTIONS]

选项:
  --images, -i PATH  图片目录路径 [必需]
  --notes, -n PATH   备注CSV文件路径
  --session, -s TEXT 指定会话ID（可选，自动生成）
  --help             显示帮助信息
```

### analyze - 运行分析

```bash
lens-inspector analyze [OPTIONS]

选项:
  --session, -s TEXT  会话ID [必需]
  --resize, -r INTEGER  图像最大尺寸(像素)，默认1024
  --parallel, -p      并行处理(实验性功能)
  --help              显示帮助信息
```

### list - 列出会话

```bash
lens-inspector list [OPTIONS]

选项:
  --help  显示帮助信息
```

### status - 查看状态

```bash
lens-inspector status [OPTIONS]

选项:
  --session, -s TEXT   会话ID [必需]
  --lens, -l TEXT      指定镜头ID查看详情
  --show-all, -a       显示所有镜头（包括正常的）
  --help               显示帮助信息
```

### confirm - 人工确认

```bash
lens-inspector confirm [OPTIONS]

选项:
  --session, -s TEXT  会话ID [必需]
  --lens, -l TEXT     指定镜头ID
  --notes, -n TEXT    人工备注
  --flag, -f          标记为需要复检
  --help              显示帮助信息
```

### export - 导出报告

```bash
lens-inspector export [OPTIONS]

选项:
  --session, -s TEXT  会话ID [必需]
  --format, -f [markdown|csv|json|all]  导出格式 [默认: all]
  --output, -o PATH   输出目录路径 [必需]
  --include-all, -a   包含所有镜头（包括正常的）
  --help              显示帮助信息
```

### delete - 删除会话

```bash
lens-inspector delete [OPTIONS]

选项:
  --session, -s TEXT  会话ID [必需]
  --yes, -y           跳过确认
  --help              显示帮助信息
```

## 数据格式说明

### 备注 CSV 格式

CSV 文件必须包含 `lens_id` 列，其他列为可选：

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lens_id | string | 是 | 镜头编号 |
| body_id | string | 否 | 机身编号 |
| notes | string | 否 | 检测员备注 |
| inspector | string | 否 | 检测员姓名 |
| received_date | date | 否 | 接收日期 |

### 图像文件名格式

建议的图像文件命名格式：
- `LENS-001_1.jpg`
- `LENS-001_2.jpg`
- `LENS-002_front.png`

系统会自动从文件名中提取镜头编号（支持多种格式）。

## 异常评分说明

### 评分维度权重

| 维度 | 权重 | 说明 |
|------|------|------|
| 清晰度 | 30% | 对焦/偏心问题 |
| 暗角 | 20% | 边角亮度不均 |
| 色偏 | 20% | RGB 通道不平衡 |
| 坏点 | 15% | 持续暗的像素 |
| 热点 | 10% | 持续亮的像素 |
| 噪点 | 5% | 整体噪点水平 |

### 评分等级

| 分数范围 | 等级 | 建议动作 |
|----------|------|----------|
| 0.0 - 0.1 | 🟢 正常 | 无需关注 |
| 0.1 - 0.4 | 🟡 轻微 | 建议检查 |
| 0.4 - 0.7 | 🟡 中等 | 需要人工确认 |
| 0.7 - 1.0 | 🔴 严重 | 必须人工确认 |

### 聚类类型

| 聚类ID | 标签 | 说明 |
|--------|------|------|
| 0 | 清晰度问题 | 模糊、偏心等 |
| 1 | 暗角问题 | 边角亮度低 |
| 2 | 色偏问题 | 颜色不平衡 |
| 3 | 坏点/热点问题 | 像素缺陷 |
| 4 | 综合问题 | 多种问题 |
| 5 | 正常/无问题 | 状态良好 |

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_models.py -v
pytest tests/test_validator.py -v

# 生成覆盖率报告
pytest tests/ -v --cov=lens_inspector
```

## 开发说明

### 添加新的缺陷类型

在 `lens_inspector/models.py` 中的 `DefectType` 枚举添加新类型：

```python
class DefectType(Enum):
    # ... 现有类型
    NEW_DEFECT = "新缺陷描述"
```

### 调整评分权重

在 `lens_inspector/clustering.py` 中修改 `AnomalyScorer` 的权重：

```python
class AnomalyScorer:
    SHARPNESS_WEIGHT = 0.3    # 清晰度权重
    DARK_CORNER_WEIGHT = 0.2   # 暗角权重
    # ...
```

### 自定义特征提取

继承 `ImageFeatureExtractor` 类添加新的特征：

```python
class CustomExtractor(ImageFeatureExtractor):
    def extract_custom_feature(self, gray: np.ndarray) -> float:
        # 实现自定义特征提取
        pass
```

## 常见问题

### Q: 支持哪些图像格式？

A: 支持 JPG、PNG、TIFF、BMP 等常见格式。完整列表：
- `.jpg`, `.jpeg`
- `.png`
- `.tiff`, `.tif`
- `.bmp`

### Q: 会话数据保存在哪里？

A: 默认保存在当前目录的 `.lens_inspector/` 文件夹中。可以通过设置环境变量 `LENS_INSPECTOR_STORAGE` 来自定义存储位置。

### Q: 如何处理大尺寸图像？

A: 默认会将图像缩放到最大边长 1024 像素以提高处理速度。可以通过 `--resize` 参数调整（如 `--resize 2048`）。

### Q: 聚类数量可以调整吗？

A: 是的，修改 `ClusteringPipeline` 初始化时的 `n_clusters` 参数。默认为 6 个聚类。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
