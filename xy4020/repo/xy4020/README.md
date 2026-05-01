# AlkCalc - 水质碱度滴定计算工具

[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

专为野外水质采样小组设计的本地命令行工具，用于碱度滴定数据的计算和质量控制分析。

## 功能特性

- **项目配置管理**: 维护采样点、瓶号、空白样、平行样和标准液浓度
- **CSV数据导入**: 支持导入样品清单和滴定读数
- **Gran法计算**: 使用Gran函数线性拟合估算滴定端点体积
- **完整质控体系**:
  - 读数数量检查
  - pH单调性检查
  - 平行样相对偏差检查
  - 标准液浓度验证
  - 样品编号匹配验证
- **数据持久化**: SQLite数据库存储计算结果
- **历史查询**: 按日期、采样点、质控状态查询历史记录
- **报告导出**: 生成Markdown报告和CSV结果表

## 安装

### 前置要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目到本地
2. 进入项目目录，安装依赖：

```bash
cd xy4020
pip install -e .
```

或者：

```bash
pip install -r requirements.txt
pip install -e .
```

### 验证安装

```bash
alkcalc --version
alkcalc --help
```

## 快速开始

### 1. 初始化项目

```bash
mkdir my_project && cd my_project
alkcalc init "2024年5月水质监测"
```

### 2. 配置项目参数

设置标准液浓度：

```bash
alkcalc config set-standard 0.01005 --name "盐酸标准溶液" --batch "20240501"
```

添加采样点：

```bash
alkcalc config add-point SP001 "河流上游" -d "距离源头500米处"
alkcalc config add-point SP002 "河流中游" -d "城镇排污口下游"
alkcalc config add-point SP003 "河流下游"
```

添加空白样：

```bash
alkcalc config add-blank BLK001 "实验室空白" -v 0.1
```

查看配置：

```bash
alkcalc config show
```

### 3. 准备数据文件

#### 样品清单CSV格式

```csv
sample_id,sampling_point,bottle_number,temperature_c,dilution_factor,is_blank,is_duplicate,parent_sample_id,notes
S001,河流上游,A-001,24.5,1.0,no,no,,正常样品
S002,河流上游,A-002,24.5,1.0,no,yes,S001,S001平行样
S003,河流中游,B-001,25.2,1.0,no,no,,正常样品
BLK001,实验室空白,BLK-001,25.0,1.0,yes,no,,空白对照
```

#### 滴定读数CSV格式

```csv
sample_id,volume_ml,ph,analyst
S001,0.00,8.32,张工
S001,1.00,8.15,张工
S001,2.00,7.98,张工
S001,3.00,7.75,张工
...
S001,14.00,3.72,张工
```

### 4. 计算碱度

```bash
alkcalc calculate samples.csv titration.csv \
  --batch-name "20240501批次" \
  --sample-volume 50 \
  --blank-sample BLK001
```

### 5. 查看历史记录

```bash
alkcalc list-batches
alkcalc history --detail
alkcalc history --sampling-point "河流上游"
alkcalc history --qc-status FAIL
alkcalc history --start-date 2024-05-01 --end-date 2024-05-31
```

### 6. 导出报告

```bash
alkcalc report 1 --output-dir ./reports
alkcalc report 1 --format markdown --output-dir ./reports
alkcalc report 1 --format csv --output-dir ./reports
```

## 完整命令参考

### 项目初始化

```bash
alkcalc init [PROJECT_NAME]
```

### 配置管理

```bash
# 显示当前配置
alkcalc config show

# 添加采样点
alkcalc config add-point <POINT_ID> <NAME> [--description <DESC>]

# 删除采样点
alkcalc config remove-point <POINT_ID>

# 添加空白样
alkcalc config add-blank <BLANK_ID> <NAME> [--expected-volume <V>]

# 删除空白样
alkcalc config remove-blank <BLANK_ID>

# 设置标准液浓度
alkcalc config set-standard <CONCENTRATION> [--name <NAME>] [--batch <BATCH>]

# 设置质控阈值
alkcalc config set-qc [--rpd-limit <LIMIT>] [--min-readings <N>]
```

### 数据导入

```bash
# 导入样品清单
alkcalc import-samples <CSV_FILE>

# 导入滴定数据
alkcalc import-titration <CSV_FILE>
```

### 计算碱度

```bash
alkcalc calculate <SAMPLES_CSV> <TITRATION_CSV> \
  [--batch-name <NAME>] \
  [--sample-volume <ML>] \
  [--blank-sample <ID>] \
  [--save/--no-save]
```

### 历史查询

```bash
# 列出所有批次
alkcalc list-batches

# 查询历史记录
alkcalc history \
  [--start-date <YYYY-MM-DD>] \
  [--end-date <YYYY-MM-DD>] \
  [--sampling-point <NAME>] \
  [--qc-status <STATUS>] \
  [--sample-id <ID>] \
  [--detail]
```

### 报告导出

```bash
alkcalc report <BATCH_ID> \
  [--output-dir <DIR>] \
  [--format <all|markdown|csv>]
```

## 质控规则说明

### 质控状态定义

| 状态 | 说明 |
|------|------|
| PASS | 通过所有检查 |
| WARNING | 存在警告（不影响计算结果） |
| FAIL | 存在失败（计算结果可能不可靠） |
| ERROR | 存在错误（无法完成计算） |

### 质控检查项

| 规则代码 | 检查内容 | 触发条件 |
|----------|----------|----------|
| MIN_READINGS | 最小读数点数 | 读数 < 配置的最小值 |
| PH_MONOTONIC | pH单调性 | 酸滴定时pH不降反升 |
| PH_RANGE | pH范围合理性 | pH超出0-14范围，或最低pH过高 |
| GRAN_FIT_QUALITY | Gran拟合质量 | R² < 0.95 或拟合点数 < 3 |
| NEGATIVE_ALKALINITY | 负碱度检查 | 计算结果为负 |
| STANDARD_CONCENTRATION | 标准液浓度 | 浓度缺失或无效 |
| SAMPLE_MISMATCH | 样品编号匹配 | 样品清单与滴定数据不匹配 |
| DUPLICATE_RPD | 平行样相对偏差 | RPD > 配置的限值 |

### 平行样相对偏差计算

```
RPD (%) = |value1 - value2| / ((value1 + value2) / 2) × 100%
```

## Gran法计算原理

### Gran函数

对于强酸滴定总碱度，在pH 3-5区域，使用Gran函数：

```
F1 = (V0 + V) × 10^(-pH)
```

其中：
- V0: 样品体积
- V: 滴定剂体积

### 线性拟合

将F1对V作图，线性外推到F1=0，得到的体积就是终点体积：

```
F1 = slope × V + intercept
V_endpoint = -intercept / slope  (当F1=0时)
```

### 总碱度计算

```
总碱度 (mg/L as CaCO3) = 
  [(V_sample - V_blank) × N × 50045] / V_sample_used × 稀释倍数
```

其中：
- V_sample: 样品的滴定终点体积 (ml)
- V_blank: 空白的滴定体积 (ml)
- N: 标准酸的当量浓度 (N) = 浓度 (mol/L)
- 50045: CaCO3的当量质量 (mg/eq)
- V_sample_used: 用于滴定的样品体积 (ml)

## 项目结构

```
xy4020/
├── alkcalc/                    # 主包
│   ├── __init__.py            # 包初始化
│   ├── cli.py                 # CLI入口
│   ├── config.py              # 配置管理
│   ├── csv_parser.py          # CSV解析
│   ├── calculator.py          # 数值计算 (Gran法)
│   ├── quality_control.py     # 质控规则
│   ├── storage.py             # 数据存储 (SQLite)
│   └── reporter.py            # 报告导出
├── examples/                   # 示例数据
│   ├── samples.csv            # 样品清单示例
│   └── titration.csv          # 滴定数据示例
├── setup.py                    # 安装脚本
├── requirements.txt            # 依赖列表
└── README.md                   # 本文档
```

## 自检步骤

以下是一组可以验证主流程的自检步骤：

### 步骤1: 安装验证

```bash
# 检查版本
alkcalc --version

# 检查帮助
alkcalc --help
alkcalc config --help
alkcalc calculate --help
```

### 步骤2: 创建测试项目

```bash
# 创建临时目录
mkdir -p /tmp/alkcalc_test && cd /tmp/alkcalc_test

# 初始化项目
alkcalc init "自检测试项目"

# 验证配置文件创建
ls -la
# 应该看到 alkcalc_config.json 和 alkcalc_data/

# 查看配置
alkcalc config show
```

### 步骤3: 配置参数

```bash
# 设置标准液浓度
alkcalc config set-standard 0.01000 --name "测试标准液" --batch "TEST-001"

# 添加采样点
alkcalc config add-point SP001 "测试采样点1"
alkcalc config add-point SP002 "测试采样点2"

# 添加空白样
alkcalc config add-blank BLK001 "测试空白" --expected-volume 0.05

# 设置质控阈值
alkcalc config set-qc --rpd-limit 10 --min-readings 5

# 验证配置
alkcalc config show
```

### 步骤4: 使用示例数据计算

```bash
# 回到项目目录，使用示例数据
cd /path/to/xy4020

# 创建测试目录
mkdir -p /tmp/alkcalc_test2 && cd /tmp/alkcalc_test2

# 初始化
alkcalc init "示例数据测试"

# 配置标准液
alkcalc config set-standard 0.01000

# 验证示例数据文件存在
ls /path/to/xy4020/examples/

# 预览数据
head /path/to/xy4020/examples/samples.csv
head /path/to/xy4020/examples/titration.csv

# 计算碱度
alkcalc calculate \
  /path/to/xy4020/examples/samples.csv \
  /path/to/xy4020/examples/titration.csv \
  --batch-name "示例数据计算" \
  --sample-volume 50 \
  --blank-sample BLK001
```

### 步骤5: 验证计算结果

```bash
# 查看批次列表
alkcalc list-batches

# 查看历史记录（详细模式）
alkcalc history --detail

# 查询特定质控状态
alkcalc history --qc-status PASS
alkcalc history --qc-status WARNING

# 查询特定采样点
alkcalc history --sampling-point "河流上游"
```

### 步骤6: 导出报告

```bash
# 获取批次ID（从list-batches或history输出中）
# 假设批次ID是1

# 导出所有格式
alkcalc report 1 --output-dir ./reports

# 验证文件生成
ls -la ./reports/

# 查看生成的文件
head ./reports/batch_1_results.csv
head ./reports/batch_1_report.md
```

### 步骤7: 验证质控功能

创建一个包含问题的数据来测试质控：

```bash
# 创建有问题的测试数据
cat > /tmp/bad_samples.csv << 'EOF'
sample_id,sampling_point,temperature_c,dilution_factor,is_blank,is_duplicate,parent_sample_id
BAD001,测试点,25.0,1.0,no,no,,
EOF

cat > /tmp/bad_titration.csv << 'EOF'
sample_id,volume_ml,ph
BAD001,0.00,7.00
BAD001,1.00,7.50
BAD001,2.00,8.00
EOF

# 计算（应该会有质控警告/失败）
cd /tmp/alkcalc_test2
alkcalc calculate /tmp/bad_samples.csv /tmp/bad_titration.csv --batch-name "质控测试"
```

### 步骤8: 清理测试数据

```bash
# 可选：删除测试目录
rm -rf /tmp/alkcalc_test
rm -rf /tmp/alkcalc_test2
```

## 常见问题

### Q1: 什么情况下会触发质控警告？

- 读数点数偏少（比最小值多但少于推荐值）
- Gran拟合R²较低但仍可计算
- 最低pH偏高但仍可拟合

### Q2: 什么情况下会触发质控失败？

- 读数点数不足
- pH不单调（酸滴定时pH升高）
- 平行样相对偏差超限
- 计算得到负碱度
- 样品缺少滴定数据

### Q3: 如何处理质控失败的样品？

1. 检查原始滴定数据是否有误
2. 检查pH电极是否工作正常
3. 检查样品清单和滴定数据的匹配关系
4. 如有必要重新滴定该样品

### Q4: 支持哪些类型的空白扣除？

- 使用指定的空白样ID（推荐）
- 手动输入空白体积（可通过修改配置实现）
- 不扣除空白（默认0）

### Q5: 数据存储在哪里？

计算结果保存在项目目录的 `alkcalc_data/alkcalc_results.db` SQLite数据库中。

## 技术栈

- **CLI框架**: Click
- **数值计算**: NumPy, SciPy
- **数据处理**: pandas (可选增强)
- **数据存储**: SQLite3 (内置)
- **配置文件**: JSON

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。

## 更新日志

### v0.1.0 (2024-05-01)

- 初始版本发布
- 实现项目配置管理
- 实现CSV数据导入
- 实现Gran法计算
- 实现完整质控体系
- 实现SQLite数据存储
- 实现历史查询和报告导出
