# PDF 表单套打校准器

一个本地命令行工具，用于预览和校准PDF表单套打。运营同事可以先离线预览每个字段是否压线、越界、遮住二维码，再导出校准后的PDF和问题报告。

## 功能特性

- ✅ **多种输入格式支持**：支持JSON模板配置和CSV坐标文件
- ✅ **单位自动转换**：支持mm（毫米）和pt（点）两种坐标单位
- ✅ **页面尺寸处理**：支持A4和Letter两种页面尺寸，纵向/横向
- ✅ **问题自动检测**：
  - 字段越界检测
  - 字段重叠检测
  - 二维码/条形码遮挡检测
  - 太靠近边缘检测
  - 必填字段缺失检测
  - 空值字段提示
- ✅ **多种渲染模式**：
  - 生产模式：只渲染内容
  - 预览模式：显示字段边框和标签
  - 调试模式：显示详细坐标信息
- ✅ **问题报告生成**：生成Markdown格式的审核报告

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目
2. 安装依赖：

```bash
pip install -r requirements.txt
```

或者以开发模式安装：

```bash
pip install -e .
```

## 快速开始

### 运行演示示例

项目内置了演示数据，可以直接运行：

```bash
# 运行演示（使用内置示例数据）
python -m pdf_aligner demo

# 或者安装后使用
pdf-aligner demo

# 指定输出目录
pdf-aligner demo --output-dir ./my_output

# 显示报告内容
pdf-aligner demo --show-report
```

演示会生成：
- `demo_preview.pdf` - 带字段边框的预览PDF
- `review_report.md` - 问题审核报告

### 基本使用流程

1. **准备输入文件**
   - 模板配置JSON（可选）或字段坐标CSV
   - 业务数据JSON或CSV

2. **预览检查**
```bash
pdf-aligner preview \
  --template-config ./template_config.json \
  --business-data ./business_data.json \
  --output ./preview.pdf \
  --report ./review_report.md
```

3. **检查问题**
```bash
pdf-aligner check \
  --template-config ./template_config.json \
  --business-data ./business_data.json \
  --output ./review_report.md
```

4. **生产输出**（确认无误后）
```bash
pdf-aligner render \
  --template-config ./template_config.json \
  --business-data ./business_data.json \
  --output ./final_output.pdf
```

## 命令详解

### `preview` - 预览模式

生成带字段边框的预览PDF，并执行问题检查。

```bash
pdf-aligner preview [OPTIONS]

选项：
  -t, --template-config PATH  模板配置JSON文件路径
  -c, --coordinates-csv PATH  字段坐标CSV文件路径
  -d, --business-data PATH    业务数据文件路径（JSON或CSV）[必填]
  -o, --output PATH           输出PDF文件路径
  -p, --page-size [A4|Letter] 页面尺寸（仅使用CSV时有效）
  -m, --mode [production|preview|debug]  渲染模式
  -s, --coordinate-system [pdf|top_left]  坐标系类型
  -r, --report PATH           问题报告输出路径（Markdown）
  --margin-threshold FLOAT    边缘检测阈值（pt），默认20
  --skip-check                跳过问题检查
  --help                      显示帮助信息
```

**示例：**
```bash
# 使用JSON模板
pdf-aligner preview \
  -t samples/template_config.json \
  -d samples/business_data.json \
  -o output/preview.pdf \
  -r output/review_report.md \
  -m preview

# 使用CSV坐标（无JSON模板时）
pdf-aligner preview \
  -c samples/field_coordinates.csv \
  -d samples/business_data.json \
  -o output/preview.pdf \
  -p A4
```

### `render` - 生产模式

执行问题检查后，生成不带边框的最终PDF。默认情况下，如果存在严重问题会阻止生成。

```bash
pdf-aligner render [OPTIONS]

选项：
  -t, --template-config PATH  模板配置JSON文件路径
  -c, --coordinates-csv PATH  字段坐标CSV文件路径
  -d, --business-data PATH    业务数据文件路径 [必填]
  -o, --output PATH           输出PDF文件路径
  -p, --page-size [A4|Letter] 页面尺寸
  -s, --coordinate-system [pdf|top_left]  坐标系类型
  -f, --force                 即使存在严重问题也强制生成
  --help                      显示帮助信息
```

**示例：**
```bash
# 正常渲染（有严重问题会阻止）
pdf-aligner render \
  -t samples/template_config.json \
  -d samples/business_data.json \
  -o output/final.pdf

# 强制生成（忽略严重问题）
pdf-aligner render \
  -t samples/template_config.json \
  -d samples/business_data.json \
  -o output/final.pdf \
  --force
```

### `check` - 问题检查

只执行问题检查，不生成PDF。

```bash
pdf-aligner check [OPTIONS]

选项：
  -t, --template-config PATH  模板配置JSON文件路径
  -c, --coordinates-csv PATH  字段坐标CSV文件路径
  -d, --business-data PATH    业务数据文件路径
  -o, --output PATH           问题报告输出路径
  -p, --page-size [A4|Letter] 页面尺寸
  -s, --coordinate-system [pdf|top_left]  坐标系类型
  --margin-threshold FLOAT    边缘检测阈值
  --json                      输出JSON格式
  --help                      显示帮助信息
```

**示例：**
```bash
# 检查并生成报告
pdf-aligner check \
  -t samples/template_config.json \
  -d samples/business_data.json \
  -o output/check_report.md

# 输出JSON格式
pdf-aligner check \
  -t samples/template_config.json \
  --json
```

### `demo` - 演示模式

使用内置的示例数据生成预览PDF和问题报告。

```bash
pdf-aligner demo [OPTIONS]

选项：
  -o, --output-dir PATH  输出目录
  --show-report          显示报告内容
  --help                 显示帮助信息
```

## 输入文件格式

### 1. 模板配置JSON (`template_config.json`)

```json
{
  "name": "销售合同模板",
  "page_size": "A4",
  "orientation": "portrait",
  "margins": {
    "top": 30,
    "bottom": 30,
    "left": 30,
    "right": 30
  },
  "fields": [
    {
      "name": "contract_no",
      "description": "合同编号",
      "x": 400,
      "y": 50,
      "width": 150,
      "height": 20,
      "unit": "pt",
      "font_size": 12,
      "required": true
    },
    {
      "name": "qr_code",
      "description": "二维码",
      "x": 450,
      "y": 500,
      "width": 100,
      "height": 100,
      "unit": "pt",
      "is_qr_code": true,
      "required": true
    }
  ]
}
```

**字段属性说明：**

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 字段名称（用于匹配业务数据） |
| description | string | 否 | 字段描述 |
| x | number | 是 | X坐标 |
| y | number | 是 | Y坐标 |
| width | number | 是 | 宽度 |
| height | number | 是 | 高度 |
| unit | string | 否 | 单位："pt"（默认）或 "mm" |
| font_size | number | 否 | 字体大小 |
| font_name | string | 否 | 字体名称 |
| required | boolean | 否 | 是否必填，默认false |
| is_qr_code | boolean | 否 | 是否为二维码，默认false |
| is_barcode | boolean | 否 | 是否为条形码，默认false |
| is_image | boolean | 否 | 是否为图片，默认false |

### 2. 字段坐标CSV (`field_coordinates.csv`)

如果没有JSON模板，可以使用CSV格式定义字段坐标：

```csv
name,x,y,width,height,unit,font_size,required,is_qr_code,description
contract_no,400,50,150,20,pt,12,true,false,合同编号
buyer_name,100,150,400,25,pt,14,true,false,买方名称
qr_code,450,500,100,100,pt,,true,true,二维码
mm_field,50,100,100,30,mm,12,false,false,毫米单位示例
```

**支持的列名变体：**
- 名称：`name`, `field_name`, `字段名`
- X坐标：`x`, `x1`, `left`, `X`
- Y坐标：`y`, `y1`, `top`, `Y`
- 宽度：`width`, `w`, `宽度`
- 高度：`height`, `h`, `高度`
- 单位：`unit`, `单位`

### 3. 业务数据JSON (`business_data.json`)

```json
[
  {
    "id": "CONTRACT-2026-001",
    "fields": {
      "contract_no": "HT-2026-0001",
      "contract_date": "2026-05-03",
      "buyer_name": "北京科技有限公司",
      "total_amount": "¥128,500.00",
      "qr_code": "https://example.com/contract/HT-2026-0001"
    }
  }
]
```

### 4. 业务数据CSV (`business_data.csv`)

```csv
id,contract_no,contract_date,buyer_name,total_amount
CONTRACT-2026-001,HT-2026-0001,2026-05-03,北京科技有限公司,¥128,500.00
CONTRACT-2026-002,HT-2026-0002,2026-05-04,广州电子科技有限公司,¥56,800.00
```

## 坐标系说明

### 两种坐标系

工具支持两种坐标系：

1. **TOP_LEFT（默认）**：左上角为原点(0,0)，Y轴向下
   - 这是大多数设计软件（如Photoshop、Figma）使用的坐标系
   - 推荐使用此坐标系

2. **PDF**：左下角为原点(0,0)，Y轴向上
   - 这是PDF原生坐标系
   - 如果坐标数据来自PDF解析工具，使用此坐标系

### 坐标单位转换

- **1英寸 = 72点 (pt)**
- **1毫米 = 72/25.4 ≈ 2.8346点 (pt)**
- **A4尺寸**: 210mm x 297mm = 595.28pt x 841.89pt
- **Letter尺寸**: 8.5in x 11in = 612pt x 792pt

## 问题检测规则

### 严重问题 (CRITICAL)

必须修复，否则会影响套打质量：

| 问题类型 | 说明 |
|----------|------|
| 越界 (OUT_OF_BOUNDS) | 字段部分或全部在页面范围外 |
| 遮挡二维码 (OVERLAP_QR) | 字段与二维码重叠超过50% |
| 遮挡条形码 (OVERLAP_BARCODE) | 字段与条形码重叠超过50% |
| 字段重叠 (OVERLAP_FIELD) | 字段之间重叠超过50% |
| 缺少必填字段 (MISSING_REQUIRED) | 必填字段缺失或为空 |

### 警告问题 (WARNING)

建议修复，可能影响打印效果：

| 问题类型 | 说明 |
|----------|------|
| 太靠近边缘 (TOO_CLOSE_TO_EDGE) | 字段距离页面边缘小于20pt（可配置） |
| 遮挡二维码/条形码 | 重叠10%-50% |
| 字段重叠 | 重叠10%-50% |

### 信息提示 (INFO)

仅供参考，不影响套打：

| 问题类型 | 说明 |
|----------|------|
| 空值 (EMPTY_VALUE) | 可选字段为空 |
| 轻微重叠 | 重叠小于10% |

## 渲染模式

### 1. 生产模式 (production)

- 只渲染字段内容
- 不显示边框和标签
- 用于最终输出

### 2. 预览模式 (preview) - 默认

- 渲染字段内容
- 显示字段边框（红色=必填，蓝色=可选）
- 显示字段名称标签（绿色）
- 用于预览和校验

### 3. 调试模式 (debug)

- 渲染字段内容
- 显示字段边框
- 显示字段名称和坐标信息
- 显示页面边界辅助线
- 用于调试坐标问题

## 项目结构

```
pdf-aligner/
├── pdf_aligner/
│   ├── __init__.py          # 包初始化
│   ├── __main__.py          # 入口模块
│   ├── cli.py               # CLI入口
│   ├── parse_validator.py   # 解析校验模块
│   ├── coordinate_transformer.py  # 坐标变换模块
│   ├── pdf_renderer.py      # PDF渲染模块
│   └── issue_rules.py       # 问题规则模块
├── samples/
│   ├── template_config.json      # 示例模板配置
│   ├── field_coordinates.csv     # 示例坐标CSV
│   └── business_data.json        # 示例业务数据
├── requirements.txt         # 依赖列表
├── pyproject.toml           # 包配置
└── README.md                # 本文档
```

## 模块说明

### 1. parse_validator.py - 解析校验模块

负责解析和验证各种输入文件：
- 解析模板配置JSON
- 解析坐标CSV
- 解析业务数据（JSON/CSV）
- 验证数据匹配性

### 2. coordinate_transformer.py - 坐标变换模块

负责单位转换和坐标计算：
- mm ↔ pt 单位转换
- TOP_LEFT ↔ PDF 坐标系转换
- 页面尺寸处理（A4/Letter，纵向/横向）
- 字段标准化

### 3. pdf_renderer.py - PDF渲染模块

负责PDF生成和字段渲染：
- 使用ReportLab生成PDF
- 渲染文本字段（自动调整字体大小）
- 渲染二维码、条形码
- 渲染图片
- 三种渲染模式支持

### 4. issue_rules.py - 问题规则模块

负责问题检测和报告生成：
- 越界检测
- 重叠检测
- 二维码/条形码遮挡检测
- 必填字段检查
- 生成Markdown报告

### 5. cli.py - CLI入口模块

提供命令行界面：
- preview: 预览模式
- render: 生产模式
- check: 问题检查
- demo: 演示模式

## 常见问题

### Q1: 如何处理不同单位的坐标？

工具会自动处理mm和pt两种单位。在模板配置中指定`"unit": "mm"`即可：

```json
{
  "name": "field_name",
  "x": 50,
  "y": 100,
  "width": 100,
  "height": 30,
  "unit": "mm"
}
```

### Q2: 如何处理A4和Letter混用？

模板配置中的`page_size`字段决定了页面尺寸：

```json
{
  "page_size": "A4",  // 或 "Letter"
  "orientation": "portrait"  // 或 "landscape"
}
```

### Q3: 字段缺值会怎样？

- **必填字段**：会产生严重问题（CRITICAL），默认阻止生产输出
- **可选字段**：会产生信息提示（INFO），不影响输出

### Q4: 如何调整边缘检测阈值？

使用`--margin-threshold`参数：

```bash
pdf-aligner preview \
  -t template.json \
  -d data.json \
  --margin-threshold 30  # 阈值改为30pt
```

### Q5: 预览PDF中的边框颜色代表什么？

- **红色边框**：必填字段
- **蓝色边框**：可选字段
- **绿色标签**：字段名称

## 依赖库

- **reportlab**: PDF生成
- **Pillow**: 图片处理
- **PyPDF2**: PDF处理
- **click**: 命令行界面
- **rich**: 美化终端输出

## 许可证

MIT License

## 版本历史

- v1.0.0 (2026-05-03)
  - 初始版本发布
  - 支持JSON/CSV输入
  - 支持mm/pt单位转换
  - 支持A4/Letter页面尺寸
  - 多种问题检测
  - 三种渲染模式
