# 艺术品寄存库保险估值 CLI 工具

一个专为艺术品寄存库设计的保险估值命令行工具，支持多币种转换、临时出库估值调整、断点续跑等功能。

## 功能特性

- ✅ **多币种支持**：支持 CNY、USD、EUR、JPY 四种币种自动转换
- ✅ **临时出库调整**：根据出库天数自动调整保险估值
- ✅ **断点续跑**：支持从上次中断处继续处理，避免重复计算
- ✅ **自动去重**：自动处理重复的艺术品编号记录
- ✅ **错误跳过**：单条记录失败不影响整体处理
- ✅ **详细报告**：生成估值汇总、币种分布、对比分析报告
- ✅ **格式灵活**：支持 Excel (xlsx) 和 CSV 格式输出
- ✅ **配置化**：可通过配置文件自定义汇率、折扣率等参数

## 快速开始

### 环境要求

- Python 3.8 或更高版本
- pip 包管理器

### 安装方式

#### 方式一：可编辑安装（推荐，用于开发和测试）

```bash
# 进入项目目录
cd /path/to/art-valuation-cli

# 安装依赖
pip install -r requirements.txt

# 以可编辑模式安装
pip install -e .
```

#### 方式二：直接运行（无需安装）

```bash
# 使用 Python 模块方式运行
python -m art_valuation.cli --help
```

### 验证安装

```bash
# 查看版本
art-valuation --version

# 查看帮助
art-valuation --help
```

## 快速上手

### 1. 生成示例输入文件

```bash
# 生成示例文件
art-valuation generate-sample -o my_artworks.csv
```

### 2. 验证输入数据

```bash
# 验证数据格式
art-valuation validate my_artworks.csv
```

### 3. 执行估值计算

```bash
# 执行估值并输出结果
art-valuation run my_artworks.csv -o valuation_result.xlsx
```

## 使用指南

### 命令列表

| 命令 | 说明 |
|------|------|
| `run` | 执行艺术品保险估值计算 |
| `validate` | 验证输入数据格式 |
| `generate-sample` | 生成示例输入文件 |
| `show-config` | 显示默认配置信息 |
| `clear-progress` | 清除处理进度文件 |

### 命令详解

#### run - 执行估值

```bash
art-valuation run [OPTIONS] INPUT_FILE
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `INPUT_FILE` | 输入的艺术品数据文件路径（必填） | - |
| `-o, --output` | 输出文件路径 | `valuation_result.xlsx` |
| `-c, --config` | 配置文件路径 | 使用默认配置 |
| `-r, --resume` | 断点续跑模式，跳过已处理记录 | False |
| `-f, --format` | 输出格式，可选 `xlsx` 或 `csv` | `xlsx` |
| `--log-level` | 日志级别，可选 `DEBUG/INFO/WARNING/ERROR` | `INFO` |

**示例：**

```bash
# 基础使用
art-valuation run examples/sample_artworks.csv

# 指定输出文件和格式
art-valuation run examples/sample_artworks.csv -o result.xlsx -f xlsx

# 使用自定义配置
art-valuation run examples/sample_artworks.csv -c config/my_config.yaml

# 断点续跑（适用于处理大文件中断后恢复）
art-valuation run examples/sample_artworks.csv -r
```

#### validate - 验证输入数据

```bash
art-valuation validate INPUT_FILE
```

**示例：**

```bash
art-valuation validate examples/sample_artworks.csv
```

输出示例：
```
✓ 数据格式验证通过

数据行数: 8
数据列数: 14

✓ 无重复记录
```

#### show-config - 查看配置

```bash
art-valuation show-config
```

显示所有默认配置项，包括汇率、折扣率、保险费率等。

#### clear-progress - 清除进度

```bash
art-valuation clear-progress
```

清除进度文件，下次运行将从头开始处理。

## 输入文件格式

### 必需列

| 列名 | 说明 | 示例 |
|------|------|------|
| 艺术品编号 | 唯一标识，不能重复 | `ART-001` |
| 艺术品名称 | 艺术品名称 | `《千里江山图》临摹` |
| 估值基数(CNY) | 基础估值金额 | `500000` |
| 临时出库 | 是否临时出库，值为 `是` 或 `否` | `否` |
| 临时出库天数 | 临时出库天数，数值型 | `0` |
| 币种 | 估值币种，可选 `CNY/USD/EUR/JPY` | `CNY` |

### 可选列

艺术家、创作年份、类别、材质、尺寸、寄存位置、入库日期、备注等。

### 示例输入

```csv
艺术品编号,艺术品名称,艺术家,创作年份,类别,材质,尺寸(cm),寄存位置,入库日期,估值基数(CNY),临时出库,临时出库天数,币种,备注
ART-001,《千里江山图》临摹,王希孟传人,2020,国画,绢本设色,120x60,A区-01-01,2023-01-15,500000,否,0,CNY,国家级临摹作品
ART-002,青铜鼎仿古器,张氏铸造,2019,雕塑,青铜,40x30x50,B区-02-03,2023-02-20,150000,是,15,CNY,博物馆级仿古
```

## 输出文件说明

### Excel 输出（推荐）

Excel 文件包含以下工作表：

1. **估值汇总**：整体统计信息
2. **币种分布**：按币种分类的统计
3. **估值成功明细**：所有成功处理的艺术品详情
4. **估值失败明细**：处理失败的艺术品及错误原因（如有）
5. **对比分析报告**：币种转换和临时出库调整的对比数据

### 估值计算公式

1. **币种转换**：
   ```
   币种转换后估值(CNY) = 原始估值 × 汇率
   ```

2. **临时出库调整**：
   ```
   调整率 = 0.85 + (1 - 0.85) × (30 - 出库天数) / 30  （出库天数 ≤ 30天）
   调整率 = 0.85  （出库天数 > 30天）
   
   调整后估值 = 币种转换后估值 × 调整率
   ```

3. **保险保费**：
   ```
   保险保费 = 调整后估值 × 0.5%
   ```

## 配置说明

### 默认配置

配置文件使用 YAML 格式，默认值如下：

```yaml
valuation:
  default_currency: "CNY"
  supported_currencies:
    - "CNY"
    - "USD"
    - "EUR"
    - "JPY"
  
  exchange_rates:
    USD_to_CNY: 7.25
    EUR_to_CNY: 7.85
    JPY_to_CNY: 0.048

  temporary_out_adjustment:
    discount_rate: 0.85
    max_days: 30

  valuation_rules:
    base_value_multiplier: 1.0
    insurance_premium_rate: 0.005

processing:
  remove_duplicates: true
  skip_errors: true
  save_progress: true
  progress_file: ".valuation_progress.json"

output:
  format: "xlsx"
  include_summary: true
  include_details: true
  comparison_report: true
  timestamp_filename: false
```

### 自定义配置

1. 复制默认配置文件：
```bash
cp config/default.yaml config/my_config.yaml
```

2. 编辑配置文件，修改相应参数

3. 使用自定义配置运行：
```bash
art-valuation run input.csv -c config/my_config.yaml
```

## 业务场景示例

### 场景一：常规艺术品保险估值

```bash
# 处理一批常规存管的艺术品
art-valuation run warehouse_q1_2024.csv -o q1_valuation.xlsx
```

### 场景二：含临时出库展品的估值

输入文件中标记了部分艺术品正在展出（临时出库），系统会根据出库天数自动调整估值。

### 场景三：多币种艺术品估值

一批来自海外艺术家的作品以 USD 计价，系统自动转换为 CNY 后计算保费。

### 场景四：大文件断点续跑

```bash
# 首次处理（中途中断）
art-valuation run large_dataset.csv -o result.xlsx

# 从断点继续处理
art-valuation run large_dataset.csv -o result.xlsx -r
```

## 测试

项目包含完整的测试用例，覆盖以下场景：

- ✅ 输入数据验证（缺列、空文件）
- ✅ 重复记录处理
- ✅ 多币种转换
- ✅ 临时出库调整
- ✅ 断点续跑功能
- ✅ 错误处理和跳过
- ✅ 配置文件加载
- ✅ 输出文件生成

### 运行测试

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_valuation.py::TestInputValidation -v
```

## 常见问题

### Q: 如何更新汇率？

A: 创建自定义配置文件，修改 `exchange_rates` 部分的汇率值。

### Q: 处理过程中程序崩溃了，怎么办？

A: 使用断点续跑功能：`art-valuation run input.csv -r`，程序会跳过已处理的记录。

### Q: 如何查看哪些记录处理失败了？

A: 输出的 Excel 文件中包含「估值失败明细」工作表，列出所有失败记录及错误原因。

### Q: 可以只处理部分艺术品吗？

A: 可以在输入文件中筛选需要处理的记录，或者使用断点续跑功能。

## 错误处理

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| 缺少必需列 | 输入文件缺少必要的列 | 检查输入文件，确保包含所有必需列 |
| 输入文件为空 | 文件没有数据行 | 添加艺术品数据 |
| 不支持的币种汇率 | 使用了未配置的币种 | 在配置文件中添加相应汇率，或修改币种 |
| 无法转换为数值 | 估值基数不是有效数字 | 检查并修正数据 |

## 项目结构

```
art-valuation-cli/
├── art_valuation/
│   ├── __init__.py
│   ├── cli.py              # CLI 入口和命令处理
│   └── valuation_engine.py # 核心估值逻辑
├── config/
│   └── default.yaml        # 默认配置文件
├── examples/
│   └── sample_artworks.csv # 示例数据
├── tests/
│   └── test_valuation.py   # 测试用例
├── setup.py                # 安装配置
├── requirements.txt        # 依赖列表
└── README.md               # 本文档
```

## 技术栈

- **Click**: 命令行界面框架
- **Pandas**: 数据处理和分析
- **NumPy**: 数值计算
- **PyYAML**: 配置文件解析
- **OpenPyXL**: Excel 文件读写
- **Pytest**: 测试框架

## 许可证

本项目仅供内部使用。

## 更新日志

### v1.0.0 (2024)
- 初始版本发布
- 支持多币种转换
- 支持临时出库估值调整
- 支持断点续跑
- 支持配置化
- 完整的测试覆盖
