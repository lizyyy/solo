# OCR 质检工具

档案数字化后 OCR 质量检查本地工具，支持导入数据、质量分析、人工复核和结果导出。

## 功能特性

- **数据导入**: 支持导入 `batch_pages.csv`、`ocr_tokens.jsonl` 和 `template_rules.yaml`
- **质量分析**: 自动分析关键字段（姓名、日期、编号、印章等）的置信度和版式漂移
- **脏数据处理**: 自动检测旋转页、缺页、OCR token 坐标越界等问题
- **人工复核**: 提供直观的复核界面，支持保存复核结果
- **结果导出**: 导出 `review_report.md` 和 `issues.csv`

## 项目结构

```
zy8188/
├── app.py                 # Streamlit 主应用
├── requirements.txt       # Python 依赖
├── modules/               # 核心模块
│   ├── __init__.py
│   ├── data_loader.py     # 数据加载模块
│   ├── quality_analyzer.py # 质量分析模块
│   ├── data_cleaner.py    # 脏数据处理模块
│   └── exporter.py        # 结果导出模块
├── sample_data/           # 示例数据
│   ├── batch_pages.csv
│   ├── ocr_tokens.jsonl
│   └── template_rules.yaml
├── output/                # 输出目录
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
streamlit run app.py
```

应用会自动在浏览器中打开，默认地址: http://localhost:8501

### 3. 使用流程

#### 方式一: 使用示例数据

1. 点击左侧边栏的 **"加载示例数据"** 按钮
2. 点击 **"开始分析"** 运行质量检查
3. 在各页面查看分析结果
4. 在 **"人工复核"** 页面处理需要复核的页面
5. 点击 **"导出报告"** 和 **"导出问题清单"** 保存结果

#### 方式二: 使用自定义数据

1. 准备以下三个文件:
   - `batch_pages.csv`: 页面元数据
   - `ocr_tokens.jsonl`: OCR 识别结果
   - `template_rules.yaml`: 模板规则

2. 在左侧边栏分别上传三个文件
3. 点击 **"加载自定义数据"**
4. 后续步骤同方式一

## 数据格式说明

### batch_pages.csv

页面元数据，每一行代表一个扫描页。

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| archive_id | string | 案卷ID | AJ2024_001 |
| page_num | int | 页码 | 1 |
| file_path | string | 图片文件路径 | sample_pages/AJ2024_001_001.jpg |
| width | int | 图片宽度(像素) | 2480 |
| height | int | 图片高度(像素) | 3508 |
| rotation | int | 旋转角度(0/90/180/270) | 0 |
| scan_date | string | 扫描日期 | 2024-01-15 |
| status | string | 状态 | scanned |

### ocr_tokens.jsonl

OCR 识别结果，每一行是一个 JSON 对象。

```json
{
  "archive_id": "AJ2024_001",
  "page_num": 1,
  "token_id": "t001",
  "text": "姓名",
  "x1": 200,
  "y1": 300,
  "x2": 300,
  "y2": 350,
  "confidence": 0.95,
  "line_num": 1
}
```

### template_rules.yaml

模板规则，定义关键字段的预期位置和校验规则。

```yaml
template_name: "档案数字化标准模板 v1.0"
template_version: "1.0.0"
page_size:
  width: 2480
  height: 3508

key_fields:
  - field_name: "姓名"
    field_type: "text"
    priority: "high"
    expected_region:
      x1: 200
      y1: 280
      x2: 450
      y2: 370
    confidence_threshold: 0.85
    layout_tolerance: 50
    keywords: ["姓名", "名字", "申请人"]
    validation_rules:
      min_length: 2
      max_length: 10
      pattern: "^[\\u4e00-\\u9fa5]+$"
```

## 功能模块说明

### 1. 数据加载 (data_loader.py)

负责加载和解析三种数据文件，提供统一的数据访问接口。

### 2. 质量分析 (quality_analyzer.py)

- **字段置信度计算**: 基于 OCR token 的置信度，计算关键字段的整体置信度
- **版式漂移检测**: 比较识别字段位置与模板预期位置的偏差
- **自动标记需复核页面**: 置信度过低、版式漂移过大、字段缺失等情况

### 3. 脏数据处理 (data_cleaner.py)

- **旋转页检测**: 检测页面旋转角度非 0 的情况
- **缺页检测**: 检查案卷中连续页码之间是否缺失页面
- **坐标越界检测**: 检查 OCR token 坐标是否超出页面边界
- **无效数据检测**: 检测置信度为负或坐标无效的 token

### 4. 结果导出 (exporter.py)

- **review_report.md**: 完整的复核报告，包含数据概览、质量分析、案卷详情等
- **issues.csv**: 问题清单，支持 Excel 打开和后续处理

## 界面功能

### 📊 概览页面

- 数据统计（案卷数、页数、Token数）
- 质量分析结果概览
- 脏数据问题统计
- 复核进度追踪
- 案卷列表

### 📁 案卷浏览

- 按案卷/页浏览数据
- 页面信息展示（尺寸、旋转角度、Token数量）
- 字段质量分析详情
- OCR Token 列表

### ✅ 人工复核

- 需复核页面列表
- 复核进度追踪
- 问题详情展示
- 复核表单（复核人、复核结果、复核意见、字段修正）
- 支持修改已复核页面

### 🐛 问题清单

- 按问题类型分类展示
- 按严重程度分类展示
- 完整问题列表
- 支持导出 CSV

## 示例数据说明

示例数据包含以下测试场景:

### AJ2024_001 (4页)
- 第1页: 日期字段置信度低 (0.58-0.72)，印章字段置信度低 (0.45)
- 第3页: 页面旋转 90 度

### AJ2024_002 (3页，实际应为4页)
- 缺页: 缺少第 3 页
- 第4页: Token 坐标越界 (x1=-50, x2=2500>2480)

### AJ2024_003 (3页)
- 第1页: 页面旋转 180 度（倒置）
- 第3页: 页面旋转 270 度

## 输出文件说明

### review_report.md

包含以下内容:
1. 报告生成时间
2. 数据概览
3. 质检分析概览
4. 脏数据清理概览
5. 复核进度
6. 案卷详情（每页的质量状态、字段质量、脏数据问题、复核状态）
7. 附录（术语说明、复核结果说明）

### issues.csv

包含以下字段:
- archive_id: 案卷ID
- page_num: 页码
- issue_type: 问题类型
- severity: 严重程度
- description: 问题描述
- token_id: 相关Token ID（如有）
- original_value: 原始值
- suggested_fix: 建议修复方案
- needs_manual_review: 是否需要人工复核
- reviewed: 是否已复核
- review_decision: 复核结果
- comments: 复核意见

## 常见问题

### Q: 支持哪些图像格式？
A: 当前版本主要处理 OCR 识别结果数据，不直接处理图像文件。未来版本可能支持图像预览。

### Q: 如何自定义模板规则？
A: 参考 `sample_data/template_rules.yaml` 的格式，修改 `key_fields` 部分定义自己的字段规则。

### Q: 复核结果保存在哪里？
A: 复核结果在会话期间保存在内存中，导出时会包含在报告中。建议完成复核后立即导出报告。

### Q: 支持批量处理吗？
A: 是的，可以一次导入多个案卷的数据，工具会自动处理所有案卷。

## 技术栈

- **Python 3.8+**
- **Streamlit**: Web 应用框架
- **Pandas**: 数据处理
- **PyYAML**: YAML 解析
- **NumPy**: 数值计算

## 许可证

本项目仅供内部使用。
