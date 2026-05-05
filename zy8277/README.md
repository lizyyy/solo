# 账单试算工具 (bill-calc)

一个本地命令行账单试算工具，供门店或 SaaS 计费团队在上线规则前回放样例订单。

## 功能特性

- 支持读取多种配置文件格式：`bills.yaml`、`discounts.csv`、`tax-rules.json`、`rounding-profiles.json`
- 核心计算能力：
  - 税前/税后折扣计算
  - 服务费计算
  - 免税项目处理
  - 行级与整单级取整
  - 多种取整策略（ROUND_HALF_UP、CEIL、FLOOR 等）造成的一分钱差异分析
- 完善的错误处理：
  - 账单缺字段验证
  - 折扣超过小计检测
  - 税率配置冲突检查
- 报告导出：
  - Markdown 格式差异报告
  - CSV 格式差异报告
- 包含正常和异常样例数据

## 安装

### 环境要求

- Python 3.8+
- pip 或 pip3

### 安装步骤

```bash
# 克隆或下载项目到本地
cd /path/to/bill-calc

# 以可编辑模式安装
pip3 install -e .

# 或者使用 python3 -m pip
python3 -m pip install -e .
```

**注意**：如果安装后提示 `bill-calc` 不在 PATH 中，可以使用以下方式运行：
```bash
python3 -m bill_calc.cli --help
```

## 快速开始

### 1. 初始化样例数据

```bash
# 在当前目录初始化样例数据
bill-calc init

# 或指定输出目录
bill-calc init -o ./my-data

# 强制覆盖已存在的文件
bill-calc init --force
```

### 2. 计算账单

```bash
# 使用默认文件名计算
bill-calc calc

# 显示详细计算步骤
bill-calc calc --verbose

# 指定自定义配置文件
bill-calc calc --bills custom_bills.yaml --discounts custom_discounts.csv

# 输出计算结果到文件
bill-calc calc -o result.md --format markdown
```

### 3. 导出报告

```bash
# 导出为 Markdown 格式
bill-calc export -o my-report --format markdown

# 导出为 CSV 格式
bill-calc export -o my-report --format csv

# 同时导出两种格式
bill-calc export -o my-report --format both

# 包含详细计算步骤
bill-calc export -o my-report --include-steps
```

## 配置文件格式说明

### 1. bills.yaml - 账单数据

包含要计算的账单信息。

```yaml
bills:
  - id: "bill-001"
    order_id: "order-2024-001"
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: "line-1"
        name: "智能手机"
        quantity: 1
        unit_price: 3999.00
        tax_rate: 13
        is_tax_exempt: false
        service_fee_rate: 1.5
        discounts: ["disc-new-user"]
    discounts: ["disc-member"]
    notes: "这是一个样例账单"
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 账单唯一标识 |
| order_id | string | 是 | 订单号 |
| currency | string | 否 | 货币类型，默认 CNY |
| rounding_profile_id | string | 否 | 取整配置ID，默认 default |
| lines | array | 是 | 行项目列表 |
| discounts | array | 否 | 账单级别的折扣ID列表 |
| notes | string | 否 | 备注 |

**行项目字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 行项目唯一标识 |
| name | string | 是 | 商品/服务名称 |
| quantity | integer | 是 | 数量，必须 > 0 |
| unit_price | decimal | 是 | 单价 |
| tax_rate | decimal | 是 | 税率（百分比，如 13 表示 13%） |
| is_tax_exempt | boolean | 否 | 是否免税，默认 false |
| service_fee_rate | decimal | 否 | 服务费率（百分比） |
| discounts | array | 否 | 行级别的折扣ID列表 |

### 2. discounts.csv - 折扣规则

包含折扣规则定义。

```csv
id,name,type,value,application,priority,applicable_to_all,applicable_line_ids
disc-new-user,新用户立减,FIXED_AMOUNT,100,PRE_TAX,1,true,
disc-member,会员折扣,PERCENTAGE,10,POST_TAX,2,true,
disc-seasonal,季节性折扣,PERCENTAGE,15,PRE_TAX,3,true,
disc-specific,特定商品折扣,PERCENTAGE,20,PRE_TAX,1,false,line-1,line-2
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 折扣唯一标识 |
| name | string | 是 | 折扣名称 |
| type | enum | 是 | 折扣类型：PERCENTAGE（百分比）、FIXED_AMOUNT（固定金额） |
| value | decimal | 是 | 折扣值（百分比或金额） |
| application | enum | 是 | 应用时机：PRE_TAX（税前）、POST_TAX（税后） |
| priority | integer | 否 | 优先级，数字越小优先级越高 |
| applicable_to_all | boolean | 否 | 是否适用于所有行 |
| applicable_line_ids | string | 否 | 适用的行ID列表，逗号分隔 |

**折扣类型说明：**

- **PERCENTAGE**：百分比折扣，value 表示折扣比例（如 10 表示 10%）
- **FIXED_AMOUNT**：固定金额折扣，value 表示具体金额

**应用时机说明：**

- **PRE_TAX**：税前折扣，在计算税费前应用
- **POST_TAX**：税后折扣，在计算税费后应用

### 3. tax-rules.json - 税率规则

包含税率规则定义。

```json
{
    "tax_rules": [
        {
            "id": "tax-13",
            "name": "一般纳税人税率",
            "rate": 13,
            "categories": ["电子产品", "服装", "日用品"],
            "is_default": false
        },
        {
            "id": "tax-6",
            "name": "服务业税率",
            "rate": 6,
            "categories": ["服务", "咨询"],
            "is_default": false
        },
        {
            "id": "tax-0",
            "name": "零税率",
            "rate": 0,
            "categories": ["出口商品", "免税商品"],
            "is_default": false
        },
        {
            "id": "tax-default",
            "name": "默认税率",
            "rate": 13,
            "categories": [],
            "is_default": true
        }
    ]
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 税率规则唯一标识 |
| name | string | 是 | 税率规则名称 |
| rate | decimal | 是 | 税率（百分比） |
| categories | array | 否 | 适用的商品分类 |
| is_default | boolean | 否 | 是否为默认税率 |

**注意：**
- 只能有一个默认税率（is_default: true）
- 同一分类不能被多个税率规则引用

### 4. rounding-profiles.json - 取整配置

包含取整策略配置。

```json
{
    "rounding_profiles": [
        {
            "id": "standard",
            "name": "标准取整配置",
            "line_level_mode": "ROUND_HALF_UP",
            "line_level_precision": 2,
            "order_level_mode": "ROUND_HALF_UP",
            "order_level_precision": 2,
            "tax_rounding_mode": "ROUND_HALF_UP",
            "tax_rounding_precision": 2
        },
        {
            "id": "aggressive",
            "name": "进取型取整（向上取整）",
            "line_level_mode": "CEIL",
            "line_level_precision": 2,
            "order_level_mode": "CEIL",
            "order_level_precision": 2,
            "tax_rounding_mode": "CEIL",
            "tax_rounding_precision": 2
        },
        {
            "id": "conservative",
            "name": "保守型取整（向下取整）",
            "line_level_mode": "FLOOR",
            "line_level_precision": 2,
            "order_level_mode": "FLOOR",
            "order_level_precision": 2,
            "tax_rounding_mode": "FLOOR",
            "tax_rounding_precision": 2
        },
        {
            "id": "high-precision",
            "name": "高精度取整",
            "line_level_mode": "ROUND_HALF_UP",
            "line_level_precision": 4,
            "order_level_mode": "ROUND_HALF_UP",
            "order_level_precision": 4,
            "tax_rounding_mode": "ROUND_HALF_UP",
            "tax_rounding_precision": 4
        }
    ]
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 取整配置唯一标识 |
| name | string | 是 | 取整配置名称 |
| line_level_mode | enum | 否 | 行级取整模式，默认 ROUND_HALF_UP |
| line_level_precision | integer | 否 | 行级取整精度（小数位数），默认 2 |
| order_level_mode | enum | 否 | 整单级取整模式，默认 ROUND_HALF_UP |
| order_level_precision | integer | 否 | 整单级取整精度，默认 2 |
| tax_rounding_mode | enum | 否 | 税费取整模式，默认 ROUND_HALF_UP |
| tax_rounding_precision | integer | 否 | 税费取整精度，默认 2 |

**取整模式说明：**

| 模式 | 说明 | 示例（保留2位小数） |
|------|------|---------------------|
| ROUND_HALF_UP | 四舍五入 | 1.234 → 1.23, 1.235 → 1.24 |
| CEIL | 向上取整 | 1.231 → 1.24, 1.239 → 1.24 |
| FLOOR | 向下取整 | 1.231 → 1.23, 1.239 → 1.23 |
| ROUND_UP | 远离零取整 | 1.231 → 1.24, -1.231 → -1.24 |
| ROUND_DOWN | 朝向零取整 | 1.239 → 1.23, -1.239 → -1.23 |

## 核心计算逻辑

### 计算顺序

1. **计算行小计**：`quantity × unit_price`
2. **应用税前折扣**：根据折扣规则计算税前折扣金额
3. **计算税费**：`(subtotal - pre_tax_discount) × tax_rate`
   - 免税项目税费为 0
4. **应用税后折扣**：根据折扣规则计算税后折扣金额
5. **计算服务费**：`(subtotal - discount + tax) × service_fee_rate`
6. **行级取整**：对每行的折扣、税费、服务费、行总额进行取整
7. **整单汇总**：汇总所有行的金额
8. **整单级取整**：对整单汇总金额进行取整

### 折扣应用规则

- **折扣只应用于明确引用的账单/行**
- 账单级折扣应用于所有行
- 行级折扣只应用于特定行
- 税前折扣在计算税费前应用
- 税后折扣在计算税费后应用
- 固定金额折扣不能超过行小计（会自动截断）

### 取整策略差异示例

假设有以下账单：
- 商品1：数量 3，单价 10.333，税率 13%
- 商品2：数量 1，单价 1.235，税率 6%

**使用 ROUND_HALF_UP（标准取整）：**
- 总小计：32.23
- 总税费：4.10
- 最终总额：36.34

**使用 CEIL（向上取整）：**
- 总小计：32.24
- 总税费：4.11
- 最终总额：36.34

可以看到：
- 总小计差异：0.01
- 总税费差异：0.01
- 最终总额相同（行级取整后汇总的结果）

## 错误处理

工具会对以下情况进行验证并给出可读错误：

### 数据验证错误

| 错误类型 | 错误信息示例 |
|----------|--------------|
| 缺少必填字段 | 账单 bill-001 缺少必填字段: order_id |
| 数量无效 | 账单 bill-001 行 line-1 数量必须大于 0，当前值: 0 |
| 单价为负 | 账单 bill-001 行 line-1 单价不能为负数，当前值: -100.0 |
| 税率无效 | 账单 bill-001 行 line-1 税率不能超过 100%，当前值: 150 |
| 服务费率无效 | 账单 bill-001 行 line-1 服务费率不能为负数，当前值: -5 |

### 折扣验证错误

| 错误类型 | 错误信息示例 |
|----------|--------------|
| 折扣值为负 | 折扣规则 disc-001 值不能为负数，当前值: -10 |
| 百分比折扣超过100% | 折扣规则 disc-001 百分比折扣不能超过 100%，当前值: 110 |
| 折扣超过小计（警告） | 行 line-1 税后折扣超过可用金额，已截断 |

### 税率配置冲突

| 错误类型 | 错误信息示例 |
|----------|--------------|
| 多个默认税率 | 税率配置冲突: 存在多个默认税率规则: tax-13, tax-default |
| 分类冲突 | 税率配置冲突: 分类 '电子产品' 被多个税率规则引用: tax-13, tax-other |

### 运行时警告

| 警告类型 | 警告信息示例 |
|----------|--------------|
| 取整配置不存在 | 警告: 未找到取整配置 'non-existent-profile'，使用默认配置 |
| 税基为负 | 警告: 行 line-1 税基为负数，已重置为 0 |
| 折扣截断 | 警告: 行 line-1 税后折扣超过可用金额，已截断 |

## 样例数据说明

初始化时会创建以下样例数据：

### 正常样例

1. **bill-normal-001**：简单订单，购买手机和配件，包含服务费
2. **bill-normal-002**：含折扣订单，应用新用户立减折扣
3. **bill-normal-003**：包含免税商品的订单
4. **bill-rounding-test-001**：取整测试订单（使用标准取整）
5. **bill-rounding-test-002**：取整测试订单（使用向上取整）

### 异常样例

1. **bill-error-001**：缺少必填字段，用于测试数据验证
2. **bill-error-002**：折扣超过小计，用于测试折扣验证
3. **bill-error-003**：引用不存在的取整配置，用于测试配置验证

## 完整工作流示例

### 场景：上线新计费规则前的验证

```bash
# 1. 初始化工作目录
mkdir billing-test && cd billing-test
bill-calc init

# 2. 查看当前样例数据
ls -la
# bills.yaml  discounts.csv  tax-rules.json  rounding-profiles.json

# 3. 运行计算（测试当前规则）
bill-calc calc --verbose

# 4. 修改规则（例如修改取整策略）
# 编辑 rounding-profiles.json，将 standard 的取整模式改为 CEIL

# 5. 重新计算
bill-calc calc --verbose

# 6. 对比两次计算结果（手动对比或使用 export）
bill-calc export -o before-change --format markdown
# 修改规则后
bill-calc export -o after-change --format markdown

# 7. 使用 diff 工具对比
diff before-change.md after-change.md
```

### 场景：测试异常数据

```bash
# 1. 创建包含错误的账单
# 编辑 bills.yaml，添加缺少字段的账单

# 2. 运行计算，查看错误信息
bill-calc calc

# 预期输出：
# 验证问题:
#   ⚠️ 账单 bill-error-001 缺少必填字段: order_id
#   ⚠️ 账单 bill-error-001 行 line-1 数量必须大于 0，当前值: 0
```

### 场景：测试取整策略差异

```bash
# 1. 使用不同取整配置计算相同订单
# 账单 bill-rounding-test-001 使用 standard 配置（ROUND_HALF_UP）
# 账单 bill-rounding-test-002 使用 aggressive 配置（CEIL）

# 2. 运行计算
bill-calc calc --verbose

# 3. 观察输出差异：
# bill-rounding-test-001: 总小计 32.23, 总税费 4.10
# bill-rounding-test-002: 总小计 32.24, 总税费 4.11

# 4. 这展示了不同取整策略造成的一分钱差异
```

## 命令参考

### init 命令

初始化样例数据文件。

```bash
bill-calc init [OPTIONS]
```

**选项：**

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| --output | -o | . | 输出目录路径 |
| --force | -f | false | 强制覆盖已存在的文件 |

**示例：**

```bash
# 基本用法
bill-calc init

# 指定输出目录
bill-calc init -o ./data

# 强制覆盖
bill-calc init --force
```

### calc 命令

计算账单。

```bash
bill-calc calc [OPTIONS]
```

**选项：**

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| --bills | -b | bills.yaml | 账单文件路径 |
| --discounts | -d | discounts.csv | 折扣文件路径 |
| --tax-rules | -t | tax-rules.json | 税率规则文件路径 |
| --rounding-profiles | -r | rounding-profiles.json | 取整配置文件路径 |
| --verbose | -v | false | 显示详细计算步骤 |
| --output | -o | None | 输出计算结果到文件 |
| --format | -f | markdown | 输出格式（markdown/csv） |

**示例：**

```bash
# 基本用法
bill-calc calc

# 显示详细步骤
bill-calc calc --verbose

# 指定自定义文件
bill-calc calc -b my_bills.yaml -d my_discounts.csv

# 输出到文件
bill-calc calc -o result.md --format markdown
```

### compare 命令

比较预期结果和实际结果（开发中）。

```bash
bill-calc compare [OPTIONS]
```

**选项：**

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| --expected | -e | （必填） | 预期结果文件路径 |
| --actual | -a | （必填） | 实际结果文件路径 |
| --bills | -b | bills.yaml | 账单文件路径 |
| --discounts | -d | discounts.csv | 折扣文件路径 |
| --tax-rules | -t | tax-rules.json | 税率规则文件路径 |
| --rounding-profiles | -r | rounding-profiles.json | 取整配置文件路径 |
| --recalculate | -R | false | 重新计算实际结果 |
| --output | -o | None | 输出比较报告到文件 |
| --format | -f | markdown | 输出格式（markdown/csv） |

**示例：**

```bash
# 比较两个结果文件
bill-calc compare -e expected.yaml -a actual.yaml

# 重新计算实际结果并比较
bill-calc compare -e expected.yaml --recalculate
```

### export 命令

导出计算结果。

```bash
bill-calc export [OPTIONS]
```

**选项：**

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| --bills | -b | bills.yaml | 账单文件路径 |
| --discounts | -d | discounts.csv | 折扣文件路径 |
| --tax-rules | -t | tax-rules.json | 税率规则文件路径 |
| --rounding-profiles | -r | rounding-profiles.json | 取整配置文件路径 |
| --output | -o | bill-report | 输出文件路径（不含扩展名） |
| --format | -f | both | 输出格式（markdown/csv/both） |
| --include-steps | -s | false | 包含详细计算步骤 |

**示例：**

```bash
# 基本用法（导出两种格式）
bill-calc export

# 指定输出文件名
bill-calc export -o my_report

# 只导出 Markdown
bill-calc export -o report --format markdown

# 包含计算步骤
bill-calc export -o detailed_report --include-steps
```

## 常见问题

### Q1: 如何添加新的折扣规则？

编辑 `discounts.csv` 文件，添加新行：

```csv
id,name,type,value,application,priority,applicable_to_all,applicable_line_ids
disc-new,新折扣,PERCENTAGE,20,PRE_TAX,1,true,
```

然后在 `bills.yaml` 中引用该折扣：

```yaml
bills:
  - id: "bill-001"
    discounts: ["disc-new"]
    lines:
      - id: "line-1"
        discounts: ["disc-new"]
```

### Q2: 如何测试不同的取整策略？

编辑 `rounding-profiles.json`，添加或修改取整配置，然后在 `bills.yaml` 中引用：

```json
{
    "rounding_profiles": [
        {
            "id": "my-custom-mode",
            "name": "我的自定义取整",
            "line_level_mode": "FLOOR",
            "line_level_precision": 2,
            "order_level_mode": "FLOOR",
            "order_level_precision": 2,
            "tax_rounding_mode": "FLOOR",
            "tax_rounding_precision": 2
        }
    ]
}
```

```yaml
bills:
  - id: "bill-001"
    rounding_profile_id: "my-custom-mode"
```

### Q3: 如何处理一分钱差异？

一分钱差异通常由以下原因造成：

1. **行级取整 vs 整单取整**：先对每行取整再汇总，与先汇总再取整的结果可能不同
2. **不同取整策略**：ROUND_HALF_UP、CEIL、FLOOR 等策略会产生不同结果
3. **税费计算**：税费计算后的取整可能累积差异

**建议：**
- 在上线前使用本工具测试不同取整策略的影响
- 保持与生产环境一致的取整配置
- 对于关键金额，使用高精度计算（如 4 位小数）再最终取整

### Q4: 工具会修改我的原始数据吗？

不会。工具只会读取配置文件，不会修改任何原始数据。所有计算结果都会输出到控制台或新文件中。

### Q5: 如何验证我的计算规则是否正确？

1. 使用 `--verbose` 选项查看详细计算步骤
2. 对比手工计算结果与工具计算结果
3. 使用不同的取整配置测试边界情况
4. 测试异常数据（缺少字段、折扣超过小计等）

## 技术说明

### 数据类型

- 所有金额使用 Python 的 `Decimal` 类型，避免浮点数精度问题
- 税率和费率使用百分比表示（如 13 表示 13%）

### 依赖库

- **PyYAML**：解析 YAML 文件
- **Click**：命令行界面框架
- **pandas**：数据处理（可选）
- **tabulate**：表格格式化（可选）

### 项目结构

```
bill-calc/
├── bill_calc/
│   ├── __init__.py          # 包初始化
│   ├── cli.py               # 命令行界面
│   ├── models.py            # 数据模型定义
│   ├── calculator.py        # 核心计算逻辑
│   ├── data_loader.py       # 数据加载和验证
│   ├── comparator.py        # 结果比较
│   └── exporter.py          # 报告导出
├── samples/                 # 样例数据（运行 init 命令生成）
├── setup.py                 # 安装配置
└── README.md                # 本文档
```

## 版本历史

### 1.0.0 (2024)

- 初始版本发布
- 支持 init、calc、compare、export 命令
- 支持 YAML、CSV、JSON 配置文件
- 实现核心计算逻辑（折扣、税费、取整）
- 完善的错误处理和数据验证
- 支持 Markdown 和 CSV 报告导出

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**提示**：运行 `bill-calc --help` 查看完整的命令帮助信息。
