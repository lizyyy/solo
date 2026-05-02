# 抢救车封签巡检员

急诊科设备护士自动化巡检工具，用于交接班会时自动检查封签连续性、药品效期、设备借还冲突和照片时间异常。

## 功能特性

- **封签连续性检查**：检测封签编号是否断签、倒退
- **药品效期检查**：自动识别过期药品和近效期药品
- **设备借还冲突检查**：检测设备借出后巡检仍显示合格的问题
- **照片时间异常检查**：检测照片拍摄时间异常（未来时间、过久之前、重复文件）
- **复核管理**：记录处理意见和复核状态
- **多格式报告**：支持导出 Markdown、CSV、JSON 格式报告

## 快速开始

### 环境要求

- Python 3.9+
- pip 包管理器

### 安装

```bash
# 克隆项目
cd xy4189

# 以可编辑模式安装
pip install -e .

# 安装开发依赖（可选）
pip install -e ".[dev]"
```

### 项目结构

```
xy4189/
├── src/
│   └── rescue_car_inspector/
│       ├── __init__.py          # 包初始化
│       ├── cli.py               # 命令行接口
│       ├── metadata_parser.py   # 文件/照片元数据解析
│       ├── models.py            # 台账模型
│       ├── rules.py             # 规则引擎
│       ├── storage.py           # 复核存储
│       └── report.py            # 报告生成
├── examples/                     # 示例数据
│   ├── scan_records.csv         # 扫码记录示例
│   ├── medication_expiry.csv    # 药品效期表示例
│   ├── maintenance_borrow.csv   # 维修借用单示例
│   └── photos/                  # 照片目录示例
├── tests/                        # 测试文件
├── pyproject.toml                # 项目配置
└── README.md                     # 本文档
```

## 使用指南

### 临时目录验证流程

按照以下步骤在临时目录中验证工具功能：

#### 1. 创建临时工作目录

```bash
# 创建临时工作目录
mkdir -p /tmp/rescue_inspector_demo/{photos,output}
cd /tmp/rescue_inspector_demo
```

#### 2. 准备测试照片

```bash
# 创建一些测试图片（使用 Pillow 生成简单图片）
python3 << 'EOF'
from PIL import Image
import os

photos_dir = "/tmp/rescue_inspector_demo/photos"
os.makedirs(photos_dir, exist_ok=True)

# 创建测试图片
for i in range(3):
    img = Image.new('RGB', (100, 100), color=(73, 109, 137))
    img.save(f"{photos_dir}/seal_{i+1:03d}.jpg")

# 创建一张相同的图片用于测试重复检测
img.save(f"{photos_dir}/seal_duplicate.jpg")

print(f"测试照片已创建在: {photos_dir}")
EOF
```

#### 3. 扫描照片（scan 命令）

```bash
# 扫描照片目录，计算哈希和解析元数据
rescue-inspector scan \
    --photos /tmp/rescue_inspector_demo/photos \
    --output /tmp/rescue_inspector_demo/output/photos_meta.json \
    --verbose
```

输出示例：
```
正在扫描照片目录: /tmp/rescue_inspector_demo/photos
共处理 4 张照片
  - seal_001.jpg: 拍摄时间=..., 哈希=a1b2c3...
  - seal_002.jpg: 拍摄时间=..., 哈希=d4e5f6...
元数据已保存到: /tmp/rescue_inspector_demo/output/photos_meta.json
```

#### 4. 导入台账数据（import 命令）

使用项目提供的示例数据：

```bash
# 导入扫码记录、药品效期表、维修借用单
rescue-inspector import_data \
    --scan-csv /Users/mac/pro/solocoder/pro/xy4189/repo/xy4189/examples/scan_records.csv \
    --medication-csv /Users/mac/pro/solocoder/pro/xy4189/repo/xy4189/examples/medication_expiry.csv \
    --maintenance-csv /Users/mac/pro/solocoder/pro/xy4189/repo/xy4189/examples/maintenance_borrow.csv \
    --output /tmp/rescue_inspector_demo/output/ledger.json \
    --verbose
```

输出示例：
```
正在导入扫码记录: .../examples/scan_records.csv
  共导入 6 条扫码记录
正在导入药品效期表: .../examples/medication_expiry.csv
  共导入 10 条药品记录
正在导入维修借用单: .../examples/maintenance_borrow.csv
  共导入 4 条维修借用记录
台账数据已保存到: /tmp/rescue_inspector_demo/output/ledger.json
```

#### 5. 执行规则检查（check 命令）

```bash
# 执行完整的规则检查
rescue-inspector check \
    --ledger /tmp/rescue_inspector_demo/output/ledger.json \
    --photos-meta /tmp/rescue_inspector_demo/output/photos_meta.json \
    --near-expiry-days 30 \
    --output /tmp/rescue_inspector_demo/output/check_result.json \
    --verbose
```

输出示例：
```
加载台账数据...
加载照片元数据...
加载了 4 条照片元数据
配置: 近效期阈值=30天

开始执行规则检查...

检查结果统计:
  封签连续性检查: 2 项
    - [high] 抢救车RC-001封签断签，缺失1个封签
    - [critical] 抢救车RC-002封签编号倒退
  药品效期检查: 5 项
    - [critical] 药品盐酸肾上腺素注射液已过期
    - [high] 药品阿托品注射液近效期（7天后过期）
  设备借还冲突检查: 3 项
    - [high] 设备除颤仪1号超期未还
  照片时间异常检查: 1 项
    - [high] 发现2张相同哈希的照片...

检查结果已保存到: /tmp/rescue_inspector_demo/output/check_result.json
```

#### 6. 复核管理（review 命令）

```bash
# 列出所有复核项
rescue-inspector review \
    --check-result /tmp/rescue_inspector_demo/output/check_result.json \
    --list

# 更新某个复核项的状态和意见
# 首先查看某个复核项的详细信息（使用 --list 获取 ID）
rescue-inspector review \
    --check-result /tmp/rescue_inspector_demo/output/check_result.json \
    --review-id "SEAL_20260503_0001"

# 更新复核状态
rescue-inspector review \
    --check-result /tmp/rescue_inspector_demo/output/check_result.json \
    --review-id "SEAL_20260503_0001" \
    --status "confirmed" \
    --comment "已核实，确实存在断签情况，需要追踪封签去向" \
    --output /tmp/rescue_inspector_demo/output/review_data.json \
    --verbose
```

#### 7. 生成报告（report 命令）

```bash
# 生成所有格式的报告
rescue-inspector report \
    --check-result /tmp/rescue_inspector_demo/output/check_result.json \
    --review-data /tmp/rescue_inspector_demo/output/review_data.json \
    --format all \
    --output /tmp/rescue_inspector_demo/output/report \
    --title "2026年5月3日抢救车巡检报告" \
    --verbose
```

输出示例：
```
Markdown 报告已保存到: /tmp/rescue_inspector_demo/output/report.md
CSV 报告已保存到: /tmp/rescue_inspector_demo/output/report.csv
JSON 报告已保存到: /tmp/rescue_inspector_demo/output/report.json

报告统计:
  总计检查项: 11
  封签连续性检查: 2 项
  药品效期检查: 5 项
  设备借还冲突检查: 3 项
  照片时间异常检查: 1 项
```

## 命令详解

### scan 命令

扫描照片目录，解析元数据并计算文件哈希。

```bash
rescue-inspector scan \
    --photos <照片目录> \
    [--output <输出JSON文件>] \
    [--verbose]
```

**参数说明：**
- `--photos, -p`: 封签照片目录路径（必需）
- `--output, -o`: 输出 JSON 文件路径（可选，不指定则打印到控制台）
- `--verbose, -v`: 显示详细信息

### import 命令

从 CSV 文件导入台账数据。

```bash
rescue-inspector import_data \
    [--scan-csv <扫码记录CSV>] \
    [--medication-csv <药品效期表CSV>] \
    [--maintenance-csv <维修借用单CSV>] \
    [--output <输出JSON文件>] \
    [--verbose]
```

**CSV 文件格式要求：**

**扫码记录 (scan_records.csv)：**
| 字段 | 说明 | 示例 |
|------|------|------|
| scan_id | 扫码记录ID | S001 |
| rescue_car_id | 抢救车编号 | RC-001 |
| seal_number | 封签编号 | FQ001001 |
| scan_time | 扫码时间 | 2026-05-01T08:00:00 |
| operator | 操作人 | 张护士 |
| shift | 班次（可选） | 白班 |
| location | 地点（可选） | 急诊科抢救室1号 |
| notes | 备注（可选） | 早班交接巡检 |

**药品效期表 (medication_expiry.csv)：**
| 字段 | 说明 | 示例 |
|------|------|------|
| medication_id | 药品ID | MED001 |
| name | 药品名称 | 盐酸肾上腺素注射液 |
| specification | 规格 | 1mg:1ml/支 |
| batch_number | 批号 | 20240101 |
| expiry_date | 有效期 | 2026-04-15 |
| quantity | 数量（可选） | 10 |
| rescue_car_id | 抢救车编号（可选） | RC-001 |

**维修借用单 (maintenance_borrow.csv)：**
| 字段 | 说明 | 示例 |
|------|------|------|
| record_id | 记录ID | MB001 |
| device_id | 设备ID | DEV-001 |
| device_name | 设备名称 | 除颤仪1号 |
| operation_type | 操作类型 | 借用 |
| request_time | 申请时间 | 2026-04-28T09:00:00 |
| operator | 操作人 | 王医生 |
| expected_return_time | 预计归还时间（可选） | 2026-04-29T17:00:00 |
| actual_return_time | 实际归还时间（可选） | - |
| status | 状态（可选） | active |

### check 命令

执行规则检查。

```bash
rescue-inspector check \
    --ledger <台账JSON文件> \
    --photos-meta <照片元数据JSON文件> \
    [--shift <班次名称>] \
    [--near-expiry-days <天数>] \
    [--output <输出JSON文件>] \
    [--verbose]
```

**参数说明：**
- `--ledger, -l`: 台账数据文件（必需）
- `--photos-meta, -p`: 照片元数据文件（必需）
- `--shift, -s`: 班次过滤（可选）
- `--near-expiry-days, -n`: 近效期阈值天数，默认30天
- `--output, -o`: 输出文件路径

**检查规则说明：**

| 检查类别 | 规则 | 严重程度 |
|----------|------|----------|
| 封签连续性 | 封签编号倒退 | CRITICAL |
| 封签连续性 | 封签断签（编号不连续） | HIGH |
| 药品效期 | 药品已过期 | CRITICAL |
| 药品效期 | 近效期（7天内） | HIGH |
| 药品效期 | 近效期（8-30天） | MEDIUM |
| 设备借还冲突 | 设备超期未还 | HIGH |
| 设备借还冲突 | 设备借出中 | MEDIUM |
| 照片时间异常 | 照片拍摄时间为未来时间 | HIGH |
| 照片时间异常 | 照片拍摄时间过久（7天前） | MEDIUM |
| 照片时间异常 | 多张照片哈希相同 | HIGH |
| 照片时间异常 | 多张照片拍摄时间几乎相同 | MEDIUM |

### review 命令

管理复核记录。

```bash
rescue-inspector review \
    --check-result <检查结果JSON文件> \
    [--review-id <复核项ID>] \
    [--status <状态>] \
    [--comment <处理意见>] \
    [--output <输出JSON文件>] \
    [--list] \
    [--verbose]
```

**状态选项：**
- `pending`: 待处理（默认）
- `confirmed`: 已确认
- `resolved`: 已解决
- `dismissed`: 已忽略

### report 命令

生成报告。

```bash
rescue-inspector report \
    --check-result <检查结果JSON文件> \
    [--review-data <复核数据JSON文件>] \
    [--format <格式>] \
    --output <输出路径> \
    [--title <报告标题>] \
    [--verbose]
```

**格式选项：**
- `markdown`: 生成 Markdown 格式报告
- `csv`: 生成 CSV 格式报告
- `json`: 生成 JSON 格式报告
- `all`: 生成所有三种格式

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_rules.py -v

# 生成覆盖率报告
pytest tests/ -v --cov=rescue_car_inspector
```

## 常见问题

### Q1: 封签编号格式有什么要求？

A: 支持以下格式：
- 纯数字：`001001`、`12345`
- 字母前缀+数字：`FQ001001`、`SEAL-123`

规则引擎会自动提取编号中的数字部分进行连续性检查。

### Q2: 日期格式支持哪些？

A: 支持以下日期格式：
- `YYYY-MM-DD`（推荐）
- `YYYY/MM/DD`
- `YYYY年MM月DD日`
- `YYYYMMDD`

### Q3: 照片支持哪些格式？

A: 支持以下图片格式：
- JPG/JPEG
- PNG
- GIF
- BMP
- TIFF/TIF

### Q4: 如何处理没有 EXIF 数据的照片？

A: 如果照片没有 EXIF 拍摄时间，系统会使用文件的修改时间作为拍摄时间。

## 示例数据说明

`examples/` 目录中的示例数据包含以下测试场景：

**扫码记录 (scan_records.csv)：**
- RC-001：封签从 FQ001001 跳到 FQ001003（断签，缺失 FQ001002）
- RC-002：封签从 FQ002005 倒退到 FQ002004（封签倒退）
- RC-003：封签从 FQ003010 到 FQ003011（正常连续）

**药品效期表 (medication_expiry.csv)：**
- MED001：已过期（2026-04-15）
- MED002：近效期（7天后过期）
- MED003：近效期（17天后过期）
- MED005：近效期（29天后过期）
- MED006：近效期（2天后过期）
- 其他：正常有效期

**维修借用单 (maintenance_borrow.csv)：**
- MB001：除颤仪1号借出，超期未还
- MB002：心电图机1号借出，未超期
- MB003：除颤仪2号维修，已完成
- MB004：喉镜1号借出，超期未还

## 许可证

本项目仅供内部使用。
