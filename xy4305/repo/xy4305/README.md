# 离心机转子配平助手

一个给实验室轮值学生使用的本地科学计算工具，用于离心机转子配平计算和管理。

## 功能特性

- **转子管理**：维护多种转子信息（孔位数、半径、最大转速、使用次数）
- **管型管理**：维护离心管信息（自重、最大容量、材质）
- **配平计算**：导入CSV配样数据，自动计算质量矩和不平衡量
- **智能建议**：给出补液/换位调整建议
- **错误校验**：检测转速超限、缺孔、管型不匹配、体积超限等问题
- **历史记录**：本地保存计算历史，可追溯和统计
- **报告导出**：支持导出Markdown报告和CSV配平方案

## 项目结构

```
xy4305/
├── centrifuge_balance/          # 主包目录
│   ├── __init__.py              # 包初始化
│   ├── models.py                # 数据模型定义
│   ├── calculator.py            # 配平计算引擎
│   ├── csv_handler.py           # CSV导入导出
│   ├── storage.py               # 本地数据存储
│   └── report_exporter.py       # Markdown报告导出
├── examples/                     # 示例数据
│   ├── samples_balanced.csv     # 已配平示例
│   ├── samples_imbalanced.csv   # 未配平示例
│   ├── samples_with_errors.csv  # 包含错误的示例
│   └── samples_template.csv     # CSV模板
├── tests/                        # 单元测试
│   ├── __init__.py
│   ├── test_models.py           # 模型测试
│   └── test_calculator.py       # 计算器测试
├── cli.py                        # 命令行入口
├── requirements.txt              # 依赖列表
└── README.md                     # 本文档
```

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

1. 进入项目目录：
```bash
cd xy4305
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 初始化默认数据：
```bash
python cli.py init
```

## 使用方法

### 查看帮助

```bash
python cli.py --help
```

### 查看工具信息

```bash
python cli.py info
```

### 转子管理

**列出所有转子：**
```bash
python cli.py rotor list
```

**添加新转子：**
```bash
python cli.py rotor add \
  --id "rotor_custom" \
  --name "自定义转子" \
  --holes 8 \
  --radius 12.5 \
  --max-rpm 10000 \
  --description "8孔自定义转子"
```

**删除转子：**
```bash
python cli.py rotor delete rotor_custom
```

### 管型管理

**列出所有管型：**
```bash
python cli.py tube list
```

**添加新管型：**
```bash
python cli.py tube add \
  --id "tube_10ml_custom" \
  --name "10ml定制离心管" \
  --weight 1.2 \
  --max-volume 10.0 \
  --description "定制10ml离心管"
```

**删除管型：**
```bash
python cli.py tube delete tube_10ml_custom
```

### 配平计算

**基本配平计算：**
```bash
python cli.py calculate examples/samples_balanced.csv \
  --rotor "rotor_12_10cm" \
  --rpm 10000
```

**带导出功能的计算：**
```bash
python cli.py calculate examples/samples_imbalanced.csv \
  --rotor "rotor_12_10cm" \
  --rpm 8000 \
  --notes "样品A配平测试" \
  --export-md output/report.md \
  --export-csv output/solution.csv
```

**不保存历史记录：**
```bash
python cli.py calculate examples/samples_balanced.csv \
  --rotor "rotor_12_10cm" \
  --rpm 10000 \
  --no-save-history
```

### 历史记录管理

**列出历史记录：**
```bash
python cli.py history list
```

**限制显示数量：**
```bash
python cli.py history list --limit 10
```

**查看历史记录详情：**
```bash
python cli.py history view 20240115_103000
```

**删除历史记录：**
```bash
python cli.py history delete 20240115_103000
```

## CSV配样文件格式

### 必需列

| 列名 | 类型 | 说明 |
|------|------|------|
| hole_position | 整数 | 孔位编号（从1开始） |
| tube_type_id | 字符串 | 管型ID |
| sample_volume_ml | 浮点数 | 样品体积(ml) |

### 可选列

| 列名 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| sample_density_gml | 浮点数 | 样品密度(g/ml) | 1.0 |
| label | 字符串 | 样品标签 | 空 |

### 示例文件内容

```csv
hole_position,tube_type_id,sample_volume_ml,sample_density_gml,label
1,tube_15ml_pp,10.0,1.0,样本A1
7,tube_15ml_pp,10.0,1.0,样本A2
2,tube_15ml_pp,8.0,1.05,样本B1
8,tube_15ml_pp,8.4,1.0,样本B2
```

## 计算原理

### 质量计算

```
总质量 = 管型自重 + (样品体积 × 样品密度)
```

### 质量矩计算

```
质量矩 = 总质量 × 转子半径
```

### 配平规则

1. **对称孔位配对**：孔位1和孔位(1+孔位数/2)为一对
   - 12孔转子：(1,7), (2,8), (3,9), (4,10), (5,11), (6,12)
   - 6孔转子：(1,4), (2,5), (3,6)

2. **不平衡量阈值**（可配置）
   - 质量差阈值：默认 0.1 g
   - 力矩差阈值：默认 0.5 g·cm

3. **默认不允许部分装载**：对称孔位对必须同时有样品或同时为空

## 验证流程

### 1. 环境验证

```bash
# 检查Python版本
python --version

# 检查依赖安装
pip list | grep -E "click|pandas|numpy|pytest|tabulate"
```

### 2. 初始化验证

```bash
# 初始化默认数据
python cli.py init

# 查看信息确认初始化成功
python cli.py info

# 确认转子已加载
python cli.py rotor list

# 确认管型已加载
python cli.py tube list
```

### 3. 配平计算验证

**测试已配平的样品：**
```bash
python cli.py calculate examples/samples_balanced.csv \
  --rotor "rotor_12_10cm" \
  --rpm 10000
```
预期输出：配平状态显示"已配平"

**测试未配平的样品：**
```bash
python cli.py calculate examples/samples_imbalanced.csv \
  --rotor "rotor_12_10cm" \
  --rpm 8000
```
预期输出：配平状态显示"未配平"，并显示调整建议

**测试包含错误的样品：**
```bash
python cli.py calculate examples/samples_with_errors.csv \
  --rotor "rotor_12_10cm" \
  --rpm 10000
```
预期输出：显示详细的校验错误信息

### 4. 导出功能验证

```bash
# 创建输出目录
mkdir -p output

# 计算并导出报告
python cli.py calculate examples/samples_balanced.csv \
  --rotor "rotor_12_10cm" \
  --rpm 10000 \
  --export-md output/test_report.md \
  --export-csv output/test_solution.csv

# 验证文件是否生成
ls -la output/
```

### 5. 历史记录验证

```bash
# 列出历史记录
python cli.py history list

# 查看最新记录的详情（替换为实际的history_id）
python cli.py history view <history_id>
```

### 6. 单元测试验证

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试文件
python -m pytest tests/test_models.py -v
python -m pytest tests/test_calculator.py -v

# 生成覆盖率报告
python -m pytest tests/ -v --cov=centrifuge_balance
```

## 数据存储位置

所有数据默认存储在用户主目录下：

```
~/.centrifuge_balance/
├── config.json          # 配置文件
├── rotors/              # 转子数据
│   ├── rotor_12_10cm.json
│   ├── rotor_24_8cm.json
│   └── rotor_6_15cm.json
├── tube_types/          # 管型数据
│   ├── tube_15ml_pp.json
│   ├── tube_50ml_pp.json
│   ├── tube_1.5ml_micro.json
│   └── tube_2ml_micro.json
└── history/             # 历史记录
    ├── 20240115_103000.json
    └── ...
```

## 配置说明

配置文件 `~/.centrifuge_balance/config.json` 包含以下可配置项：

```json
{
  "mass_imbalance_threshold_g": 0.1,
  "moment_imbalance_threshold_gcm": 0.5,
  "default_sample_density_gml": 1.0,
  "allow_partial_loading": false
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| mass_imbalance_threshold_g | float | 0.1 | 质量不平衡阈值(g) |
| moment_imbalance_threshold_gcm | float | 0.5 | 力矩不平衡阈值(g·cm) |
| default_sample_density_gml | float | 1.0 | 默认样品密度(g/ml) |
| allow_partial_loading | bool | false | 是否允许部分装载 |

## 错误类型说明

| 错误类型 | 说明 |
|----------|------|
| 转速超限 | 设定转速超过转子最大转速 |
| 转速无效 | 转速小于等于0 |
| 孔位重复 | 同一孔位被多次使用 |
| 孔位无效 | 孔位编号超出范围 |
| 管型不存在 | 使用了未定义的管型ID |
| 体积无效 | 样品体积为负数 |
| 体积超限 | 样品体积超过管型最大容量 |
| 密度无效 | 样品密度小于等于0 |
| 缺孔 | 对称孔位对不完整 |

## 常见问题

**Q: 为什么提示"缺孔"错误？**

A: 默认配置下，对称孔位必须同时有样品。比如使用了孔位1，必须同时使用孔位7（12孔转子）。如果需要允许部分装载，可以修改配置文件中的 `allow_partial_loading` 为 `true`。

**Q: 如何添加新的转子或管型？**

A: 使用 `rotor add` 和 `tube add` 命令添加，或者直接修改 `~/.centrifuge_balance/` 目录下的JSON文件。

**Q: 历史记录保存在哪里？可以删除吗？**

A: 历史记录保存在 `~/.centrifuge_balance/history/` 目录下。可以使用 `history delete` 命令删除，也可以直接删除对应的JSON文件。

**Q: 如何修改不平衡阈值？**

A: 编辑 `~/.centrifuge_balance/config.json` 文件，修改 `mass_imbalance_threshold_g` 和 `moment_imbalance_threshold_gcm` 的值。

## 许可证

本项目仅供实验室内部使用。

## 贡献

欢迎提交问题和改进建议。
