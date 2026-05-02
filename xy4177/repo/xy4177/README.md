# 热敏标签排版预检台

一款用于仓库打包台的本地桌面GUI工具，用于标签预览、数据校验和排版检查。

## 功能特性

### 核心功能
- **CSV数据导入** - 支持WMS导出的SKU CSV文件
- **模板解析** - 支持ZPL和JSON两种标签模板格式
- **标签预览** - 使用PIL/Pillow本地渲染标签预览
- **数据校验** - 多维度数据校验

### 校验项目
| 校验类型 | 说明 |
|---------|------|
| 条码校验 | 支持CODE128、CODE39、EAN13、EAN8、UPCA、UPCE、QRCODE、DataMatrix、PDF417、ITF14 |
| 必填字段 | 检查模板定义的必填字段是否缺失 |
| 效期校验 | 识别多种日期格式，检查是否过期 |
| 重复箱号 | 检测同一箱号是否重复出现 |
| 版面检查 | 检查元素是否越界、是否超出安全边距 |
| 字段匹配 | 检查CSV字段与模板字段是否匹配 |

### 导出功能
- **PDF预览** - 批量导出标签预览到PDF
- **PNG图片** - 单张或批量导出PNG图片
- **CSV问题清单** - 导出校验错误清单
- **JSON审计包** - 导出完整的审计信息包

## 项目结构

```
xy4177/
├── main.py                    # 程序入口
├── requirements.txt           # 依赖列表
├── README.md                  # 本文档
├── core/                      # 核心模块
│   ├── __init__.py
│   ├── constants.py           # 常量定义（条码类型、DPI等）
│   ├── models.py              # 数据模型（SKU、模板、校验结果等）
│   ├── validator.py           # 数据校验器（条码、日期、业务逻辑）
│   ├── layout.py              # 版面计算（尺寸、越界检测）
│   └── renderer.py            # 预览渲染（PIL渲染）
├── gui/                       # GUI界面
│   ├── __init__.py
│   └── main_window.py         # 主窗口
├── io/                        # 导入导出
│   ├── __init__.py
│   ├── csv_reader.py          # CSV读取器
│   ├── template_parser.py     # 模板解析器（ZPL/JSON）
│   ├── pdf_exporter.py        # PDF导出器
│   ├── png_exporter.py        # PNG导出器
│   └── json_auditor.py        # JSON审计包导出器
├── persistence/               # 持久化
│   ├── __init__.py
│   └── storage.py             # 项目存储
├── samples/                   # 示例数据
│   ├── __init__.py
│   └── sample_data.py         # 示例数据生成器
└── tests/                     # 测试
    ├── __init__.py
    └── test_validator.py      # 校验器测试
```

## 快速开始

### 环境要求
- Python 3.8+
- PyQt6
- Pillow
- ReportLab

### 安装步骤

1. **安装依赖**
```bash
cd /Users/mac/pro/solocoder/pro/xy4177/repo/xy4177
pip install -r requirements.txt
```

2. **运行程序**
```bash
python main.py
```

## 使用指南

### 验证流程

#### 1. 加载示例数据（快速测试）

程序内置了示例数据，可以快速验证功能：

1. 点击菜单栏 **示例 → 加载示例数据**
   - 这会加载5条测试数据，包含各种问题场景：
     - 正常数据
     - 重复箱号（BOX-2026-001出现2次）
     - 缺失批次号
     - 已过期效期
     - 缺失箱号

2. 点击菜单栏 **示例 → 加载示例ZPL模板**
   - 加载预定义的ZPL标签模板

3. 点击工具栏 **校验** 按钮（或按F5）
   - 程序会自动检测所有问题
   - 数据表格中，错误行显示红色，警告行显示黄色
   - 切换到 **错误列表** 标签页查看详细问题

4. 选择一行数据，点击工具栏 **预览** 按钮（或按F6）
   - 在右侧 **标签预览** 标签页查看渲染效果
   - 下方显示当前数据的详细信息和校验状态

#### 2. 使用真实数据

1. **准备CSV文件**
   
   CSV文件应包含以下列（列名支持中英文）：
   ```csv
   sku,box_number,batch_number,expiry_date,product_name,quantity
   SKU001,BOX-001,BATCH-001,2027-05-01,矿泉水 500ml,24
   ```
   
   支持的列名别名：
   | 标准列名 | 别名 |
   |---------|------|
   | sku | SKU, sku_code |
   | box_number | boxNo, 箱号 |
   | batch_number | batchNo, 批号 |
   | expiry_date | expiryDate, 效期, 有效期 |
   | product_name | productName, 品名 |
   | quantity | 数量 |

2. **准备标签模板**
   
   支持两种格式：
   
   **ZPL格式示例**：
   ```zpl
   ^XA
   ^PW480
   ^LL320
   ^FO50,50^A0N,30,30^FD{sku}^FS
   ^FO50,100^BCN,80,Y,N,N^FD{box_number}^FS
   ^FO50,200^A0N,25,25^FD批次: {batch_number}^FS
   ^FO50,230^A0N,25,25^FD效期: {expiry_date}^FS
   ^XZ
   ```
   
   **JSON格式示例**：
   ```json
   {
     "name": "标准出库标签",
     "width": 60.0,
     "height": 40.0,
     "dpi": 203,
     "margin": 2.0,
     "fields": [
       {
         "name": "sku",
         "type": "text",
         "x": 5.0,
         "y": 5.0,
         "font_size": 4.0,
         "required": true
       },
       {
         "name": "box_number",
         "type": "barcode",
         "barcode_type": "CODE128",
         "x": 5.0,
         "y": 12.0,
         "height": 10.0,
         "required": true
       }
     ]
   }
   ```

3. **导入数据**
   - 点击工具栏 **导入CSV** 或通过菜单 **文件 → 导入 → 导入CSV数据**
   - 选择准备好的CSV文件

4. **加载模板**
   - 点击工具栏 **加载模板** 或通过菜单 **文件 → 导入 → 导入标签模板**
   - 选择ZPL或JSON模板文件

5. **执行校验**
   - 点击工具栏 **校验** 或按F5
   - 查看错误列表，识别问题

6. **人工修正**
   - 在数据表格中直接编辑单元格内容
   - 修正后需要重新执行校验

7. **导出结果**
   - 点击右侧 **导出** 标签页
   - 选择需要的导出方式：
     - **导出PDF预览** - 生成所有标签的PDF预览
     - **导出PNG图片** - 批量导出PNG图片
     - **导出JSON审计包** - 导出完整的审计信息
     - **全部导出** - 一次性导出所有格式

## 校验规则详解

### 条码校验规则

| 条码类型 | 最大长度 | 校验码 | 字符限制 |
|---------|---------|--------|---------|
| CODE128 | 80字符 | 否 | ASCII |
| CODE39 | 43字符 | 否 | A-Z, 0-9, 空格, .-$%+/ |
| EAN13 | 13位 | 是 | 数字 |
| EAN8 | 8位 | 是 | 数字 |
| UPCA | 12位 | 是 | 数字 |
| UPCE | 8位 | 是 | 数字 |
| QRCODE | 4296字符 | 否 | 任意 |
| DataMatrix | 2335字符 | 否 | 任意 |
| PDF417 | 1108字符 | 否 | 任意 |
| ITF14 | 14位 | 是 | 数字 |

### 效期日期格式支持

程序可自动识别以下日期格式：
- `YYYY-MM-DD` (2027-05-01)
- `YYYY/MM/DD` (2027/05/01)
- `DD-MM-YYYY` (01-05-2027)
- `DD/MM/YYYY` (01/05/2027)
- `YYYYMMDD` (20270501)

### 版面检查规则

- **安全边距**：默认2mm，可在模板中调整
- **越界检测**：检查元素是否超出标签边界
- **重叠检测**：检查元素之间是否重叠

## 测试

### 运行单元测试

```bash
cd /Users/mac/pro/solocoder/pro/xy4177/repo/xy4177
pytest tests/ -v
```

### 测试覆盖

| 测试文件 | 测试内容 |
|---------|---------|
| test_validator.py | 条码校验、日期校验、数据校验器 |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建项目 |
| Ctrl+O | 打开项目 |
| Ctrl+S | 保存项目 |
| Ctrl+Q | 退出 |
| F5 | 执行校验 |
| F6 | 预览选中 |

## 常见问题

### Q1: 为什么条码渲染效果与真实打印机有差异？

A: 本工具使用简化的条码渲染算法，主要用于预览和排版检查。真实打印效果请以实际打印机为准。如需更精确的ZPL渲染，建议使用Labelary API或专业的ZPL模拟器。

### Q2: 支持哪些条码类型？

A: 目前支持10种常见条码类型：CODE128、CODE39、EAN13、EAN8、UPCA、UPCE、QRCODE、DataMatrix、PDF417、ITF14。

### Q3: 如何批量修正数据？

A: 可以在CSV文件中修正后重新导入，或者在程序的数据表格中直接编辑。程序会保存所有的人工修正记录。

### Q4: 项目文件保存在哪里？

A: 默认保存在 `~/LabelPrecheckProjects/` 目录下，也可以在保存时选择自定义路径。项目文件格式为 `.lblproj`，本质是JSON格式。

## 技术栈

- **GUI框架**: PyQt6
- **图像处理**: Pillow (PIL)
- **PDF生成**: ReportLab
- **测试框架**: pytest

## 许可证

本项目仅供学习和内部使用。

## 更新日志

### v1.0.0
- 初始版本发布
- 实现核心数据模型
- 实现ZPL/JSON模板解析
- 实现条码、日期、业务逻辑校验
- 实现版面计算和越界检测
- 实现PIL本地预览渲染
- 实现PDF/PNG/CSV/JSON导出
- 实现项目持久化
- 实现PyQt6 GUI界面
