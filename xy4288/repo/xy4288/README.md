# 镀镍槽补加推演器

给五金电镀小厂化验员用的本地科学计算工具。

## 功能特性

- **数据导入**: 支持滴定化验 CSV、槽液体积/温度记录、生产面积记录、药剂库存
- **浓度换算**: 从滴定数据自动计算硫酸镍、氯化镍、硼酸浓度
- **补加计算**: 自动计算补加量，考虑药剂纯度
- **pH调整**: 智能计算酸碱调整量，考虑硼酸缓冲特性
- **模拟预测**: 模拟补加后的槽液区间和范围检查
- **冲突检测**: 检测pH调整冲突（如同时需要酸碱、pH过低仍加酸）
- **库存检查**: 自动检查库存是否足够，防止库存不够仍开线
- **风险评估**: 综合评估浓度、补加量、模拟结果、库存风险
- **方案对比**: 支持两套方案对比分析
- **放行记录**: 人工放行/拒绝记录，支持实际添加量记录
- **报告导出**: 导出 Markdown 作业单、CSV 批次表、JSON 审计包

## 安装

### 环境要求

- Python 3.8 或更高版本

### 安装步骤

1. 克隆或下载项目代码

2. 以开发模式安装：

```bash
cd /path/to/xy4288
pip install -e .
```

或直接运行：

```bash
python -m nickel_plating_calculator --help
```

## 快速开始

### 1. 准备数据文件

项目提供了示例数据文件在 `examples/` 目录下：

- `titration_sample.csv` - 滴定化验数据
- `tank_record_sample.csv` - 槽液记录
- `production_sample.csv` - 生产记录
- `inventory_sample.csv` - 库存数据

### 2. 导入数据

```bash
# 导入滴定数据
nickel-plating-calc import --titration examples/titration_sample.csv

# 导入槽液记录
nickel-plating-calc import --tank examples/tank_record_sample.csv

# 导入库存数据
nickel-plating-calc import --inventory examples/inventory_sample.csv

# 一次导入多个文件
nickel-plating-calc import \
    --titration examples/titration_sample.csv \
    --tank examples/tank_record_sample.csv \
    --inventory examples/inventory_sample.csv
```

### 3. 计算补加量

```bash
# 使用默认目标浓度计算
nickel-plating-calc calculate --batch-id BATCH_20260503_001

# 使用自定义目标浓度
nickel-plating-calc calculate \
    --batch-id BATCH_20260503_001 \
    --target-ns 250 \
    --target-nc 45 \
    --target-ba 40 \
    --target-ph 4.2 \
    --plan-name "标准方案"
```

### 4. 创建对比方案

```bash
# 创建保守方案（目标浓度稍低）
nickel-plating-calc calculate \
    --batch-id BATCH_20260503_001 \
    --target-ns 240 \
    --target-nc 42 \
    --plan-name "保守方案"
```

### 5. 对比两套方案

```bash
nickel-plating-calc compare \
    --batch-id BATCH_20260503_001 \
    --plan-a "标准方案" \
    --plan-b "保守方案"
```

### 6. 人工放行

```bash
# 放行
nickel-plating-calc approve \
    --batch-id BATCH_20260503_001 \
    --plan-id <方案ID> \
    --operator "张三" \
    --reviewer "李四" \
    --notes "同意按标准方案执行"

# 或拒绝
nickel-plating-calc approve \
    --batch-id BATCH_20260503_001 \
    --plan-id <方案ID> \
    --operator "张三" \
    --reviewer "李四" \
    --reject \
    --notes "库存不足，需要先采购"
```

### 7. 导出报告

```bash
# 导出所有格式
nickel-plating-calc export \
    --batch-id BATCH_20260503_001 \
    --output-dir ./output \
    --format all

# 仅导出 Markdown 作业单
nickel-plating-calc export \
    --batch-id BATCH_20260503_001 \
    --output-dir ./output \
    --format md \
    --plan-id <方案ID>
```

### 8. 查看和管理批次

```bash
# 列出所有批次
nickel-plating-calc list

# 查看批次详情
nickel-plating-calc show --batch-id BATCH_20260503_001

# 查看配置
nickel-plating-calc config --show

# 重置配置为默认值
nickel-plating-calc config --reset
```

## CSV 文件格式

### 滴定化验数据 (titration.csv)

| 列名 | 必需 | 说明 | 示例 |
|------|------|------|------|
| batch_id | 是 | 批次ID | BATCH_20260503_001 |
| timestamp | 是 | 时间戳 | 2026-05-03 08:30:00 |
| operator | 是 | 操作员 | 张三 |
| nickel_sulfate_edta_ml | 是 | 硫酸镍滴定EDTA体积(mL) | 18.5 |
| nickel_chloride_edta_ml | 是 | 氯化镍滴定EDTA体积(mL) | 12.3 |
| boric_titrant_ml | 是 | 硼酸滴定剂体积(mL) | 8.7 |
| ph_value | 是 | pH值 | 4.3 |
| sample_volume_ml | 否 | 样品体积(mL)，默认2.0 | 2.0 |
| edta_concentration_mol_l | 否 | EDTA浓度(mol/L)，默认0.05 | 0.05 |
| naoh_concentration_mol_l | 否 | NaOH浓度(mol/L)，默认0.1 | 0.1 |

支持的时间戳格式：
- `2026-05-03 08:30:00`
- `2026-05-03 08:30`
- `2026/05/03 08:30:00`
- `20260503083000`
- `20260503`

### 槽液记录 (tank_record.csv)

| 列名 | 必需 | 说明 | 示例 |
|------|------|------|------|
| tank_id | 是 | 槽号 | TANK_A |
| batch_id | 是 | 批次ID | BATCH_20260503_001 |
| timestamp | 是 | 时间戳 | 2026-05-03 08:35:00 |
| operator | 是 | 操作员 | 李四 |
| volume_liters | 是 | 槽液体积(L) | 1500 |
| temperature_celsius | 是 | 温度(°C) | 48.5 |
| current_ph | 是 | 当前pH | 4.3 |
| notes | 否 | 备注 | 正常生产状态 |

### 生产记录 (production.csv)

| 列名 | 必需 | 说明 | 示例 |
|------|------|------|------|
| batch_id | 是 | 批次ID | BATCH_20260503_001 |
| timestamp | 是 | 时间戳 | 2026-05-03 07:00:00 |
| operator | 是 | 操作员 | 王五 |
| total_area_dm2 | 是 | 生产面积(dm²) | 1250.5 |
| parts_count | 是 | 工件数量 | 250 |
| plating_time_minutes | 是 | 电镀时间(分钟) | 30 |
| estimated_nickel_consumption_g | 否 | 估算镍消耗量(g) | 85.2 |
| estimated_acid_consumption_ml | 否 | 估算酸消耗量(mL) | - |

### 库存数据 (inventory.csv)

支持多行数据，每行一个药剂。

| 列名 | 必需 | 说明 | 示例 |
|------|------|------|------|
| chemical_name | 是 | 药剂名称 | 硫酸镍 |
| batch_id | 是 | 批次ID | BATCH_20260503_001 |
| timestamp | 是 | 时间戳 | 2026-05-03 08:00:00 |
| operator | 是 | 操作员 | 赵六 |
| current_quantity_kg | 是 | 当前库存(kg) | 120.5 |
| minimum_stock_kg | 是 | 最低库存(kg) | 50.0 |
| unit_price_per_kg | 否 | 单价(元/kg) | 25.5 |
| supplier | 否 | 供应商 | 某化工 |
| lot_number | 否 | 批号 | NS20260401 |

支持的药剂名称（中英文）：
- 硫酸镍 / nickel sulfate / nickel_sulfate
- 氯化镍 / nickel chloride / nickel_chloride
- 硼酸 / boric acid / boric_acid

## 验证流程

### 完整工作流验证

1. **导入示例数据**

```bash
nickel-plating-calc import \
    --titration examples/titration_sample.csv \
    --tank examples/tank_record_sample.csv \
    --inventory examples/inventory_sample.csv
```

预期输出：
```
导入滴定数据: examples/titration_sample.csv
滴定数据导入成功: BATCH_20260503_001_20260503_083000
导入槽液记录: examples/tank_record_sample.csv
槽液记录导入成功: 槽号 TANK_A, 体积 1500L
导入库存数据: examples/inventory_sample.csv
库存数据导入成功: 3 条记录

批次数据已保存: BATCH_20260503_001
```

2. **计算补加量**

```bash
nickel-plating-calc calculate --batch-id BATCH_20260503_001
```

预期输出包含：
- 浓度计算结果
- 补加量计算
- 模拟补加结果
- 库存检查
- 风险评估

3. **查看批次详情**

```bash
nickel-plating-calc show --batch-id BATCH_20260503_001
```

4. **导出报告**

```bash
nickel-plating-calc export --batch-id BATCH_20260503_001 --output-dir ./output
```

检查输出目录下的三个文件：
- `BATCH_20260503_001_*_作业单.md`
- `BATCH_20260503_001_*_批次表.csv`
- `BATCH_20260503_001_*_审计包.json`

### 运行单元测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 或单独运行
python -m pytest tests/test_models.py -v
python -m pytest tests/test_calculator.py -v
```

## 项目结构

```
xy4288/
├── nickel_plating_calculator/    # 主包
│   ├── __init__.py              # 版本信息
│   ├── __main__.py              # 入口
│   ├── cli.py                   # CLI主程序
│   ├── models/                  # 数据模型
│   │   ├── __init__.py
│   │   ├── data_models.py       # 数据类定义
│   │   └── config.py            # 配置管理
│   ├── parser/                  # 解析校验
│   │   ├── __init__.py
│   │   ├── csv_parser.py        # CSV解析器
│   │   └── validator.py         # 数据验证器
│   ├── chemistry/               # 化学计算
│   │   ├── __init__.py
│   │   └── calculator.py        # 浓度/补加计算
│   ├── rules/                   # 规则引擎
│   │   ├── __init__.py
│   │   └── engine.py            # 风险/库存/冲突检测
│   ├── storage/                 # 存储模块
│   │   ├── __init__.py
│   │   └── store.py             # 数据持久化/审计日志
│   └── reporting/               # 报告模块
│       ├── __init__.py
│       └── reporter.py          # Markdown/CSV/JSON导出
├── examples/                    # 示例数据
│   ├── titration_sample.csv
│   ├── tank_record_sample.csv
│   ├── production_sample.csv
│   └── inventory_sample.csv
├── tests/                       # 测试用例
│   ├── test_models.py
│   └── test_calculator.py
├── setup.py                     # 安装配置
└── README.md                    # 本文档
```

## 模块说明

### 1. 数据模型 (models/)

- `data_models.py`: 定义所有数据类（dataclass）
  - `TitrationData`: 滴定化验数据
  - `TankRecord`: 槽液记录
  - `ProductionRecord`: 生产记录
  - `ChemicalInventory`: 库存数据
  - `CalculatedConcentrations`: 计算浓度
  - `DosageResult`: 补加量结果
  - `SimulatedResult`: 模拟结果
  - `RiskItem`/`RiskAssessment`: 风险评估
  - `InventoryCheck`: 库存检查
  - `SolutionPlan`: 补加方案
  - `ApprovalRecord`: 放行记录
  - `BatchContext`: 批次上下文（整合所有数据）

- `config.py`: 配置管理
  - `ConfigManager`: 配置管理器，支持默认配置和自定义配置
  - 默认配置文件位置：`~/.nickel_plating_calculator/config.json`

### 2. 解析校验 (parser/)

- `csv_parser.py`: CSV解析器
  - `TitrationCSVParser`: 滴定数据解析
  - `TankRecordCSVParser`: 槽液记录解析
  - `ProductionRecordCSVParser`: 生产记录解析
  - `InventoryCSVParser`: 库存数据解析（支持多行）

- `validator.py`: 数据验证器
  - `TitrationValidator`: 滴定数据验证
  - `TankRecordValidator`: 槽液记录验证
  - `ProductionRecordValidator`: 生产记录验证
  - `InventoryValidator`: 库存数据验证

### 3. 化学计算 (chemistry/)

- `calculator.py`: `ChemistryCalculator` 类
  - `calculate_concentrations()`: 从滴定数据计算浓度
  - `calculate_dosage()`: 计算补加量
  - `simulate_dosage()`: 模拟补加结果
  - `_calculate_ph_adjustment()`: 计算pH调整量（考虑硼酸缓冲）

**浓度计算公式**：
```
镍盐浓度(g/L) = (EDTA浓度 × EDTA体积 × 摩尔质量) / 样品体积 × 1000
硼酸浓度(g/L) = (NaOH浓度 × NaOH体积 × 硼酸摩尔质量) / 样品体积 × 1000
```

**补加量计算公式**：
```
补加量(kg) = (目标浓度 - 当前浓度) × 槽体积(L) / 纯度 / 1000
```

### 4. 规则引擎 (rules/)

- `engine.py`: `RuleEngine` 类
  - `check_inventory()`: 检查库存是否足够
  - `detect_ph_conflict()`: 检测pH调整冲突
  - `assess_risk()`: 综合风险评估
  - `compare_plans()`: 对比两套方案

**冲突检测规则**：
1. 同时计算出需要酸和碱 → 严重冲突
2. 当前pH已低于下限仍建议加酸 → 严重冲突
3. 当前pH已高于上限仍建议加碱 → 严重冲突

**风险等级**：
- 低 (LOW): 正常范围
- 中 (MEDIUM): 需要关注
- 高 (HIGH): 需要处理
- 严重 (CRITICAL): 禁止执行

### 5. 存储 (storage/)

- `store.py`: 数据持久化
  - `DataStore`: 批次数据存储（JSON格式）
    - 存储位置：`~/.nickel_plating_calculator/data/batches/`
  - `AuditLogger`: 审计日志（JSONL格式，按日存储）
    - 存储位置：`~/.nickel_plating_calculator/audit/`

### 6. 报告 (reporting/)

- `reporter.py`: 报告生成器
  - `MarkdownReporter`: 生成Markdown作业单
    - 包含基本信息、浓度分析、补加方案、风险评估、库存检查
  - `CSVReporter`: 生成CSV批次表
    - 可追加到现有文件
  - `JSONAuditor`: 生成JSON审计包
    - 包含所有数据、配置、方案、放行记录、审计日志

## 配置说明

默认工艺参数：

| 参数 | 默认值 | 范围 |
|------|--------|------|
| 硫酸镍目标浓度 | 250 g/L | 220-280 g/L |
| 氯化镍目标浓度 | 45 g/L | 35-55 g/L |
| 硼酸目标浓度 | 40 g/L | 30-50 g/L |
| pH目标值 | 4.2 | 4.0-4.5 |
| 温度目标值 | 50°C | 45-55°C |
| 硫酸镍纯度 | 98% | - |
| 氯化镍纯度 | 97% | - |
| 硼酸纯度 | 99% | - |

风险阈值：

| 参数 | 默认警告值 | 默认严重值 |
|------|------------|------------|
| 硫酸镍偏离 | 10% | 20% |
| 氯化镍偏离 | 15% | 25% |
| 硼酸偏离 | 20% | 35% |
| pH偏离 | 0.3 单位 | 0.5 单位 |

## 常见问题

### Q: 如何修改工艺参数？

A: 首次运行后，配置文件会生成在 `~/.nickel_plating_calculator/config.json`，可以直接编辑该文件，或使用命令：

```bash
# 查看当前配置
nickel-plating-calc config --show

# 重置为默认配置
nickel-plating-calc config --reset
```

### Q: 为什么pH调整量只是估算？

A: pH调整受多种因素影响：
- 硼酸缓冲体系的复杂特性
- 槽液中其他成分的影响
- 实际操作中的混合效果

建议：先添加计算量的1/2，复测后再调整剩余量。

### Q: 数据存储在哪里？

A: 所有数据都存储在本地用户目录：
- 配置：`~/.nickel_plating_calculator/config.json`
- 批次数据：`~/.nickel_plating_calculator/data/batches/`
- 审计日志：`~/.nickel_plating_calculator/audit/`

这是本地工具，所有数据不会上传到任何服务器。

### Q: 如何查看审计日志？

A: 审计日志按日存储在 JSONL 格式文件中，每行一个JSON对象。可以用工具查看或直接导出为JSON审计包。

## 许可证

本项目仅供内部使用。

## 更新日志

### v1.0.0 (2026-05-03)

- 初始版本
- 完整的CLI命令集
- 数据导入、计算、模拟、风险评估
- 方案对比、放行记录
- Markdown/CSV/JSON报告导出
- 单元测试
- 示例数据
