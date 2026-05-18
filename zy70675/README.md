# 仓租阶梯免租退仓截断排查CLI

一个用于仓库租赁计费计算和异常排查的Python命令行工具。

## 功能特性

- ✅ **阶梯计费**: 按体积和占用天数进行阶梯计价
- ✅ **免租扣减**: 支持约定免租期自动扣减，含边界处理
- ✅ **退仓截断**: 12点前退仓减免1天费用
- ✅ **异常检测**: 数据验证和异常行留存
- ✅ **多格式导出**: JSON/CSV/Excel 机器可读格式 + 人类可读报告
- ✅ **控制台报告**: 美观的Rich格式控制台输出

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 生成样例数据

```bash
# 生成所有样例
python -m warehouse_rent_cli generate-samples

# 仅生成正常样例
python -m warehouse_rent_cli generate-samples -t normal

# 仅生成异常样例
python -m warehouse_rent_cli generate-samples -t abnormal
```

### 2. 执行计费计算

```bash
# 使用默认规则计算
python -m warehouse_rent_cli calculate ./samples/sample_normal.json

# 指定输出目录
python -m warehouse_rent_cli calculate ./samples/sample_normal.json -o ./my_output

# 指定输出格式
python -m warehouse_rent_cli calculate ./samples/sample_normal.json -f excel

# 不输出控制台报告
python -m warehouse_rent_cli calculate ./samples/sample_abnormal.json --no-console
```

## 计费规则说明

### 体积阶梯（默认）
- 0-50m³: 3.5元/m³/天
- 50-200m³: 3.0元/m³/天
- 200-500m³: 2.5元/m³/天
- 500m³以上: 2.0元/m³/天

### 天数折扣（默认）
- 0-7天: 无折扣 (1.0x)
- 7-30天: 95折 (0.95x)
- 30-90天: 9折 (0.9x)
- 90天以上: 85折 (0.85x)

### 退仓截断规则
- 退仓时间早于12:00: 减免1天
- 退仓时间晚于12:00: 正常计费

### 免租扣减规则
- 约定免租天数 ≤ 实际占用天数: 正常扣减
- 约定免租天数 > 实际占用天数: 仅扣减实际占用天数

## 异常检测项

1. **客户ID重复**: 检测重复的客户ID
2. **体积极值**: 体积超过1000m³的预警
3. **免租异常**: 免租期超过60天或超过实际占用天数
4. **数据格式**: 负数、空值、日期冲突等格式错误

## 项目结构

```
warehouse_rent_cli/
├── __init__.py          # 包初始化
├── __main__.py          # 入口模块
├── cli.py               # 命令行接口
├── models/
│   ├── __init__.py
│   └── schemas.py       # 数据模型和Pydantic schema
├── core/
│   ├── __init__.py
│   ├── calculator.py    # 计费核心逻辑
│   └── validator.py     # 数据验证器
├── utils/
│   ├── __init__.py
│   ├── loader.py        # 数据加载器
│   └── exporter.py      # 报告导出器
├── samples/             # 样例数据目录
├── tests/               # 测试目录
└── output/              # 报告输出目录
```

## 验收样例说明

完整覆盖4类验收场景：

### 1. 正常样例 (sample_normal.json / sample_normal.xlsx)
5条典型客户记录：
- C001: 常规客户，45天租期，120m³，7天免租，10:30退仓（截断）
- C002: VIP客户，90天租期，350m³，15天免租，15:00退仓（不截断）
- C003: 在仓客户，15天租期，45m³，3天免租
- C004: 大客户，120天租期，600m³，30天免租，08:00退仓（截断）
- C005: 短租客户，5天租期，80m³，无免租，06:00退仓（截断）

### 2. 脏数据样例 (sample_abnormal.json)
7条异常记录，含9个异常点：
- 客户ID重复 (C001出现2次)
- 免租期超长 (90天，超过预警阈值60天)
- 体积极大 (2000m³，超过预警阈值1000m³)
- 免租期超过占用天数 (20天免租，10天占用)
- 数据格式错误 (空ID、负体积、0天占用)
- 日期冲突 (退仓日期早于入仓日期)、负占用天数

### 3. 边界冲突样例 (sample_boundary.json)
10条边界测试记录：
- 体积阶梯边界：刚好50m³、200m³、500m³
- 天数折扣边界：刚好7天、30天、90天
- 退仓截断边界：12:00整、11:59
- 免租边界：免租天数刚好等于占用天数
- 极小体积边界：0.01m³

### 4. 空结果样例 (sample_empty.json / sample_empty.xlsx)
空数组输入：
- 总记录数：0
- 有效记录数：0
- 无效记录数：0
- 所有金额统计：0
- 用于验证空输入场景下系统稳定性

## 自定义计费规则

创建JSON规则文件：
```json
{
    "rule_id": "MY_RULE_001",
    "rule_name": "我的自定义规则",
    "effective_date": "2024-01-01T00:00:00",
    "volume_tiers": [
        {"min_volume": 0, "max_volume": 100, "price_per_cbm": 4.0},
        {"min_volume": 100, "max_volume": null, "price_per_cbm": 3.0}
    ],
    "days_tiers": [
        {"min_days": 0, "max_days": 30, "discount_rate": 1.0},
        {"min_days": 30, "max_days": null, "discount_rate": 0.9}
    ],
    "base_price_per_cbm_per_day": 4.0,
    "checkout_truncation_hours": 12
}
```

使用自定义规则：
```bash
python -m warehouse_rent_cli calculate input.json -r my_rule.json
```

## 支持的输入格式

- JSON
- CSV
- Excel (.xlsx, .xls)

## 输出报告说明

生成的报告包含三个部分：
1. **报告汇总**: 统计信息概览
2. **计费明细**: 每条记录的详细计算过程
3. **异常记录**: 所有检测到的数据异常

每条计费明细包含：
- 基础数据（客户ID、名称、库位、体积等）
- 天数计算（原始天数、截断天数、有效天数、免租天数、计费天数）
- 费率信息（体积单价、天数折扣率、日费率）
- 金额计算（基础金额、折扣金额、最终金额）
- 计算说明和警告信息
