# 水分活度配方校算器 (Water Activity Calculator)

为小型食品实验室设计的本地配方计算工具，用于新品打样时的水分活度计算、烘烤损耗分析和配方校验。

## 功能特性

- **init**: 初始化项目，生成原料库模板和配方模板
- **check**: 校验配方问题（单位混用、数据缺失、目标不可达等）
- **calc**: 执行计算（干基/湿基换算、烘烤损耗、补水量推算）
- **report**: 导出Markdown、CSV和JSON格式的审计报告

## 安装

### 环境要求

- Python 3.10+
- pip 或 uv

### 安装步骤

```bash
# 使用 pip 安装（开发模式）
pip install -e .

# 或使用 uv
uv pip install -e .
```

### 安装开发依赖（可选）

```bash
pip install -e ".[dev]"
# 或
uv pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化项目

```bash
# 在当前目录初始化
wacalc init

# 或指定输出目录
wacalc init -o ./my_project
```

这会创建两个文件：
- `ingredients.yaml`: 原料库模板（包含常见烘焙原料）
- `recipe.yaml`: 配方模板（经典黄油曲奇示例）

### 2. 查看并编辑原料库

`ingredients.yaml` 包含了原料的定义：

```yaml
ingredients:
  - name: 高筋面粉
    moisture_content_wet: 0.12    # 湿基含水率 12%
    aw: 0.55                       # 水分活度
    notes: 市售面包粉
```

添加您自己的原料，或修改现有数据。

### 3. 查看并编辑配方

`recipe.yaml` 定义了产品配方：

```yaml
name: 经典黄油曲奇
version: "1.0"
batch_size: 1.0
batch_unit: kg

# 目标水分活度
target:
  target_aw: 0.65
  safety_margin_aw: 0.02

# 烘烤工艺
baking_profile:
  loss_percentage: 0.08   # 8% 损耗
  loss_is_water_only: true

# 原料列表
ingredients:
  - name: 低筋面粉
    amount: 250
    unit: g
```

### 4. 校验配方

```bash
wacalc check recipe.yaml
```

示例输出：
```
✓ 已加载原料库: ingredients.yaml (14 种原料)
✓ 已加载配方: 经典黄油曲奇

============================================================
校验结果: ✅ 通过
总计: 0 个问题
  错误: 0 个
  警告: 0 个
============================================================
```

### 5. 执行计算

```bash
wacalc calc recipe.yaml
```

示例输出：
```
============================================================
配方: 经典黄油曲奇
计算时间: 2026-05-02T10:30:00.123456
============================================================

【一、输入概览】
  总投料量: 602.00 g
  总干固物: 501.40 g
  总水分: 100.60 g
  初始含水率: 16.71% (湿基)
                20.06% (干基)
  估算初始aw: 0.6500

【二、烘烤损耗】
  总损耗: 48.16 g
  - 水分损耗: 48.16 g
  - 干物质损耗: 0.00 g

  烘烤后剩余水分: 52.44 g
  烘烤后总重: 553.84 g
  烘烤后含水率: 9.47% (湿基)

【三、目标参数】
  目标aw: 0.6500
  目标含水率: 13.71% (湿基)
               15.89% (干基)

【四、调整建议】
  💧 需要补水: 32.50 g

【五、最终预测】
  预期成品重量: 586.34 g
  预期含水率: 13.71% (湿基)
  预期最终aw: 0.6500

提示: 使用 'wacalc report' 导出完整审计报告
```

### 6. 导出报告

```bash
wacalc report recipe.yaml -o ./reports -n cookie_v1
```

这会生成三个文件：
- `reports/cookie_v1.md`: Markdown格式报告
- `reports/cookie_v1.csv`: CSV格式数据
- `reports/cookie_v1.json`: JSON格式数据

## 核心概念

### 干基 vs 湿基 含水率

| 类型 | 公式 | 说明 |
|------|------|------|
| **湿基 (Wet Basis)** | 水分 / 总重量 | 最常用，食品成分表中通常指湿基 |
| **干基 (Dry Basis)** | 水分 / 干固物重量 | 科学研究中常用，数值大于湿基 |

**换算公式：**
```
干基 = 湿基 / (1 - 湿基)
湿基 = 干基 / (1 + 干基)
```

### 水分活度 (Water Activity, aw)

水分活度是衡量食品中水分可利用性的指标，范围 0-1：

| aw范围 | 说明 |
|---------|------|
| 0.95-1.00 | 新鲜食品，适合大多数微生物生长 |
| 0.85-0.95 | 易腐食品，需冷藏 |
| 0.60-0.85 | 中等水分食品，货架期较长 |
| < 0.60 | 低水分食品，非常稳定 |

### GAB 模型

本工具使用 **Guggenheim-Anderson-de Boer (GAB)** 模型来估算水分活度与含水率之间的关系：

```
aw → 目标含水率 → 需调整水量
```

## CLI 命令详解

### init

初始化项目，生成原料库和配方模板。

```bash
wacalc init [OPTIONS]

选项:
  -o, --output PATH  输出目录（默认当前目录）
  -f, --force        覆盖已存在的文件
```

### check

校验配方的完整性和一致性。

```bash
wacalc check [OPTIONS] RECIPE

参数:
  RECIPE  配方文件路径（YAML/CSV）

选项:
  -i, --ingredients PATH  原料库文件（默认 ingredients.yaml）
  --json                  以JSON格式输出
```

**校验规则：**
1. **单位混用检测** - 检查 g/kg/mg 是否混合使用
2. **原料数据缺失** - 检查原料是否在库中或是否指定了含水率
3. **目标可达性** - 检查目标aw是否在合理范围
4. **批次缩放问题** - 检查批量是否过大/过小
5. **含水率一致性** - 检查干基/湿基数值是否矛盾

### calc

执行水分活度计算。

```bash
wacalc calc [OPTIONS] RECIPE

参数:
  RECIPE  配方文件路径（YAML/CSV）

选项:
  -i, --ingredients PATH  原料库文件（默认 ingredients.yaml）
  --json                  以JSON格式输出
  --no-validate           跳过校验直接计算
```

**计算内容：**
1. **输入概览** - 总投料、干固物、水分、初始含水率
2. **烘烤损耗** - 水分损失、干物质损失、烘烤后状态
3. **目标推算** - 基于GAB模型从aw推算目标含水率
4. **调整建议** - 需要补水/排水的量
5. **最终预测** - 成品重量、最终含水率、最终aw

### report

导出审计报告。

```bash
wacalc report [OPTIONS] RECIPE

参数:
  RECIPE  配方文件路径（YAML/CSV）

选项:
  -i, --ingredients PATH  原料库文件（默认 ingredients.yaml）
  -o, --output PATH       输出目录（默认当前目录）
  -n, --name TEXT         报告文件名（不含扩展名，默认 calculation_report）
```

## 数据文件格式

### 原料库 (YAML)

```yaml
ingredients:
  - name: 原料名称
    moisture_content_wet: 0.12      # 湿基含水率（0-1）
    moisture_content_dry: 0.1364     # 干基含水率（可选，用于校验）
    aw: 0.55                          # 水分活度（可选）
    sorption_isotherm:                # 水分吸附等温线（可选）
      0.43: 0.10
      0.65: 0.15
    notes: 备注信息
```

### 配方文件 (YAML)

```yaml
name: 配方名称
version: "1.0"
batch_size: 1.0
batch_unit: kg  # kg | g | mg
notes: 备注

target:
  target_aw: 0.65           # 目标水分活度
  safety_margin_aw: 0.02    # 安全余量
  min_aw: 0.60              # 最低允许aw（可选）
  max_aw: 0.70              # 最高允许aw（可选）

baking_profile:
  loss_percentage: 0.08     # 烘烤损耗率（8% = 0.08 或 "8%"）
  loss_is_water_only: true  # 损耗是否全部为水分
  notes: 烘烤工艺备注

ingredients:
  - name: 原料名称           # 必须与原料库一致，或指定 moisture_override
    amount: 250              # 用量数值
    unit: g                   # 单位: g | kg | mg | %
    moisture_override: 0.12  # 覆盖原料库含水率（可选）
    aw_override: 0.55        # 覆盖原料库aw（可选）
```

## 临时目录验证流程

您可以使用临时目录快速验证工具功能：

```bash
# 1. 创建并进入临时目录
mkdir -p /tmp/wacalc_test && cd /tmp/wacalc_test

# 2. 初始化项目
wacalc init

# 3. 查看生成的文件
ls -la
# ingredients.yaml  recipe.yaml

# 4. 校验配方
wacalc check recipe.yaml

# 5. 执行计算
wacalc calc recipe.yaml

# 6. 导出报告
wacalc report recipe.yaml -o ./reports

# 7. 查看报告
ls -la reports/
# calculation_report.csv  calculation_report.json  calculation_report.md

# 8. 查看 Markdown 报告
cat reports/calculation_report.md

# 9. 清理（可选）
cd /tmp && rm -rf wacalc_test
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=water_activity_cli

# 运行特定测试文件
pytest tests/test_calculator.py -v
```

## 项目结构

```
water_activity_calculator/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文档
├── water_activity_cli/
│   ├── __init__.py
│   ├── version.py              # 版本信息
│   ├── models.py               # 数据模型 (Pydantic)
│   ├── parser.py               # YAML/CSV 解析器
│   ├── calculator.py           # 计算引擎
│   ├── validator.py            # 校验规则
│   ├── reporter.py             # 报告导出
│   └── cli.py                  # CLI 入口
└── tests/
    ├── __init__.py
    ├── conftest.py             # pytest fixtures
    ├── test_calculator.py      # 计算引擎测试
    ├── test_validator.py       # 校验规则测试
    ├── test_parser.py          # 解析器测试
    └── test_reporter.py        # 报告导出测试
```

## 常见问题

### Q1: 湿基和干基的区别是什么？

**湿基**：水分占总重量的比例
- 例如：100g 面粉含 12g 水 → 湿基含水率 12%

**干基**：水分占干固物重量的比例
- 相同例子：12g 水 / 88g 干固物 = 13.6% (干基)

工具会自动进行换算，您只需要在原料库中使用湿基即可。

### Q2: 为什么需要补水？

烘焙过程中水分会蒸发。如果烘烤后水分过低，需要补水以达到目标水分活度。如果水分过高，则需要延长烘烤时间。

### Q3: 如何确定烘烤损耗率？

可以通过实际试验确定：
1. 记录烘烤前总重量
2. 记录烘烤后总重量
3. 损耗率 = (烘烤前 - 烘烤后) / 烘烤前

典型饼干的损耗率约为 6-12%。

### Q4: 什么是安全余量？

安全余量用于防止实际生产中的波动。例如：
- 目标 aw = 0.65
- 安全余量 = 0.02
- 实际安全范围 = 0.63 ~ 0.67

### Q5: 可以使用 CSV 格式的配方吗？

是的，工具支持 YAML 和 CSV 两种格式。CSV 格式更适合从 Excel 导出。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
