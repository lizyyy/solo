# Answer Sheet Checker - 答题卡回收核对自动化工具

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 项目简介

答题卡回收核对自动化工具（Answer Sheet Checker，简称 ASC）是为高校教务老师设计的纸笔考试答题卡回收核查系统。它通过自动化方式检测答题卡回收过程中的各类问题，提高工作效率，减少人工错误。

### 核心功能

- **漏扫检测**：自动找出应考但未扫描到答题卡的学生
- **重复条码检测**：检测同一条码被多次扫描的情况
- **考场混放检测**：识别是否混入其他考场的答题卡
- **缺考却有答题卡检测**：标记缺考名单中有但存在扫描文件的异常
- **页码方向异常检测**：检测图片方向不一致或横向的问题
- **人工备注管理**：支持添加人工备注，重跑后不丢失
- **多格式导出**：生成 Markdown 移交单和 JSON 审计明细
- **命令行 + 网页界面**：支持命令行一键操作和网页可视化管理

## 安装

### 环境要求

- Python 3.9+
- pip 包管理器

### 安装步骤

```bash
# 1. 克隆或下载项目
cd /path/to/answer-sheet-checker

# 2. 安装依赖
pip install -e .

# 3. 验证安装
asc --help
```

### 依赖说明

| 包名 | 用途 |
|------|------|
| flask | 网页界面框架 |
| pypdf | PDF 文件处理 |
| pillow | 图片处理 |
| pyzbar | 条形码识别 |
| python-dateutil | 日期处理 |

**注意**：`pyzbar` 在某些系统上可能需要额外安装系统依赖：

- **macOS**: `brew install zbar`
- **Ubuntu/Debian**: `sudo apt-get install libzbar0`
- **Windows**: 通常不需要额外安装

## 快速开始

### 方式一：命令行操作

```bash
# 进入工作目录
cd /path/to/your/exam/data

# 执行核查
asc check \
  --seat-table seat_table.csv \
  --sheets-folder ./scanned_sheets \
  --absent-list absent_list.csv \
  --batch batch.json \
  --output-dir ./output

# 启动网页界面查看结果
asc web --port 5000
```

### 方式二：网页界面操作

```bash
# 启动网页服务
asc web --work-dir ./exam_data --port 5000
```

然后打开浏览器访问 `http://127.0.0.1:5000`

## 输入文件格式

### 1. 考场座位表 (CSV)

```csv
student_id,name,room_number,seat_number,department,class_name
2021001001,张三,001,1,计算机学院,计科2101班
2021001002,李四,001,2,计算机学院,计科2101班
```

**必填字段**：
- `student_id`: 学生学号（作为条码）
- `name`: 学生姓名
- `room_number`: 考场号
- `seat_number`: 座位号

**可选字段**：
- `department`: 学院
- `class_name`: 班级

### 2. 缺考签名单 (CSV)

```csv
student_id,room_number,seat_number,reason
2021001003,001,3,生病请假
2021001007,001,7,未到
```

**必填字段**：
- `student_id`: 学生学号
- `room_number`: 考场号
- `seat_number`: 座位号

**可选字段**：
- `reason`: 缺考原因

### 3. 阅卷批次信息 (JSON)

```json
{
  "batch_id": "BATCH_20240615_001",
  "exam_name": "2023-2024学年第二学期期末考试",
  "exam_date": "2024-06-15",
  "course_code": "CS101",
  "course_name": "程序设计基础",
  "total_students": 16,
  "rooms": ["001", "002"]
}
```

**字段说明**：
- `batch_id`: 批次唯一标识
- `exam_name`: 考试名称
- `exam_date`: 考试日期
- `course_code`: 课程代码
- `course_name`: 课程名称
- `total_students`: 总参考人数
- `rooms`: 涉及的考场列表

### 4. 答题卡图片/PDF 文件夹

支持的文件格式：
- 图片: `.jpg`, `.jpeg`, `.png`
- 文档: `.pdf`

**文件名命名规范**（推荐）：
```
{barcode}_{page_info}.{ext}
```

示例：
- `2021001001_1of2.jpg` - 第1页/共2页
- `2021001001_2of2.jpg` - 第2页/共2页
- `2021001002_p1.jpg` - 第1页
- `2021001002.jpg` - 单页

**条码识别方式**：
1. **从文件名提取**：优先查找文件名中 10 位以上的连续数字
2. **从图片识别**：使用 pyzbar 检测图片中的条形码

## 检测功能说明

### 1. 漏扫检测 (🔴 严重)

**检测逻辑**：
- 学生在座位表中
- 学生不在缺考名单中
- 但没有扫描到对应的答题卡

**处理建议**：
- 检查是否漏扫
- 确认学生是否实际缺考
- 检查答题卡是否放错文件夹

### 2. 重复条码检测 (🔴 严重)

**检测逻辑**：
- 同一条码（学号）出现在多个文件中

**处理建议**：
- 检查是否重复扫描
- 删除重复文件
- 确认是否有多份答题卡

### 3. 考场混放检测 (🟠 重要)

**检测逻辑**：
- 条码对应的考场号与预期不符
- 从文件名提取的考场号与座位表不符

**处理建议**：
- 检查该考场是否混入其他考场的答题卡
- 确认条码是否识别错误

### 4. 缺考却有答题卡 (🔴 严重)

**检测逻辑**：
- 学生在缺考名单中
- 但存在该学生的扫描文件

**处理建议**：
- 核实学生是否实际缺考
- 确认签到是否有误
- 检查答题卡是否为其他学生的

### 5. 页码方向异常 (🟡 轻微/🟠 重要)

**检测逻辑**：
- 图片为横向（landscape）
- 同一学生的多页方向不一致

**处理建议**：
- 确认方向是否正确
- 必要时旋转图片
- 统一所有页面方向

### 6. 额外答题卡检测 (🟠 重要)

**检测逻辑**：
- 扫描到的条码不在学生名单中
- 文件名无法识别有效条码

**处理建议**：
- 手动识别答题卡对应的学生
- 确认是否为多余文件
- 检查是否属于其他考试批次

## 人工备注

### 功能说明

系统支持添加人工备注，用于记录：
- 特殊情况说明
- 问题处理进展
- 其他需要记录的信息

### 特点

- 备注持久化存储（保存在 `.remarks.json`）
- 重跑核查时自动保留
- 支持在网页界面添加/编辑/删除
- 导出时包含在 Markdown 和 JSON 中

## 导出格式

### Markdown 移交单

生成的 Markdown 文件包含：
- 批次基本信息
- 核查统计（按考场）
- 问题汇总和详情
- 人工备注
- 移交确认签字栏

### JSON 审计明细

生成的 JSON 文件包含完整的核查数据：
```json
{
  "batch_info": { ... },
  "generated_at": "2024-06-15T10:30:00",
  "statistics": {
    "001": { ... },
    "002": { ... }
  },
  "issues": {
    "critical": [ ... ],
    "major": [ ... ],
    "minor": [ ... ]
  },
  "student_roster": { ... },
  "absent_records": { ... },
  "remarks": { ... }
}
```

## 命令行参考

### 全局选项

```bash
asc --help          # 显示帮助信息
asc --version       # 显示版本号
```

### check 命令

```bash
asc check [选项]

选项：
  -w, --work-dir DIR      工作目录（默认：当前目录）
  -s, --seat-table FILE   座位表 CSV 文件路径（必需）
  -f, --sheets-folder DIR 答题卡文件夹路径（必需）
  -a, --absent-list FILE  缺考签名单 CSV 文件路径（必需）
  -b, --batch FILE        阅卷批次 JSON 文件路径（必需）
  --no-remarks            不保留之前的备注
  -o, --output-dir DIR    输出目录（默认：work_dir/output）
```

### web 命令

```bash
asc web [选项]

选项：
  -w, --work-dir DIR      工作目录（默认：当前目录）
  -p, --port PORT         端口号（默认：5000）
  --host HOST             监听地址（默认：127.0.0.1）
```

### export 命令

```bash
asc export [选项]

选项：
  -r, --result FILE       检查结果 JSON 文件路径（必需）
  -o, --output-dir DIR    输出目录（默认：./output）
  -n, --base-name NAME    输出文件基础名称（可选）
```

## 示例数据

项目包含示例数据，位于 `samples/` 目录：

```
samples/
├── seat_table.csv      # 示例座位表（16名学生，2个考场）
├── absent_list.csv     # 示例缺考名单（3名缺考）
├── batch.json          # 示例阅卷批次信息
└── sheets/             # 示例答题卡文件夹
    └── README.md       # 命名规范说明
```

### 测试示例数据

```bash
# 1. 进入项目目录
cd /path/to/answer-sheet-checker

# 2. 创建一些模拟图片文件（用于测试）
mkdir -p test_sheets
cd test_sheets
touch 2021001001_1of2.jpg
touch 2021001001_2of2.jpg
touch 2021001002_p1.jpg
touch 2021001003_absent.jpg      # 缺考但有文件
touch 2021001004_1.jpg
touch 2021001005_dup1.jpg       # 重复1
touch 2021001005_dup2.jpg       # 重复2
touch 2021001007_notexist.jpg   # 不在座位表
touch 9999999999_extra.jpg      # 额外
touch unknown_sheet.jpg          # 无法识别
cd ..

# 3. 执行核查
asc check \
  --seat-table samples/seat_table.csv \
  --sheets-folder test_sheets \
  --absent-list samples/absent_list.csv \
  --batch samples/batch.json \
  --output-dir output

# 4. 查看结果
ls -la output/
```

## 项目结构

```
answer-sheet-checker/
├── answer_sheet_checker/
│   ├── __init__.py       # 包初始化
│   ├── models.py         # 数据模型定义
│   ├── loader.py         # 数据加载器
│   ├── recognizer.py     # 答题卡识别器
│   ├── checker.py        # 问题检测器
│   ├── engine.py         # 核心引擎
│   ├── cli.py            # 命令行工具
│   ├── web.py            # 网页界面
│   └── exporter.py       # 导出模块
├── samples/              # 示例数据
│   ├── seat_table.csv
│   ├── absent_list.csv
│   ├── batch.json
│   └── sheets/
├── pyproject.toml        # 项目配置
└── README.md             # 本文档
```

## 常见问题

### Q1: 条码识别不准确怎么办？

**答**：系统提供两种识别方式：
1. 从文件名提取（推荐，最可靠）
2. 从图片识别（依赖 pyzbar）

确保文件名包含完整的学号（10位以上数字）是最可靠的方式。

### Q2: 如何处理多页答题卡？

**答**：系统支持多页答题卡，通过文件名中的页码信息关联：
- 格式：`{barcode}_1of2.jpg`、`{barcode}_2of2.jpg`
- 或：`{barcode}_p1.jpg`、`{barcode}_p2.jpg`

同一学生的多页会被自动归为一组。

### Q3: 重跑核查时备注会丢失吗？

**答**：不会。默认情况下，系统会保留之前的备注。如果需要清空备注，可以使用 `--no-remarks` 选项：

```bash
asc check ... --no-remarks
```

### Q4: 支持哪些图片格式？

**答**：支持：
- JPEG: `.jpg`, `.jpeg`
- PNG: `.png`
- PDF: `.pdf`

PDF 文件会被当作单个处理单元，条码从文件名提取。

### Q5: 网页界面只能本地访问吗？

**答**：默认是的（监听 `127.0.0.1`）。如果需要局域网访问，可以指定 `--host 0.0.0.0`：

```bash
asc web --host 0.0.0.0 --port 5000
```

**注意**：此选项会让服务暴露在网络上，请确保在安全环境下使用。

## 更新日志

### v1.0.0 (2024-06-15)

- 初始版本发布
- 实现 6 类问题检测
- 命令行工具（asc）
- Flask 网页界面
- Markdown 和 JSON 导出
- 人工备注持久化

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示**：使用示例数据测试时，请确保 `test_sheets` 文件夹中存在实际的图片文件（即使是空文件也可以用于测试文件名解析功能）。
