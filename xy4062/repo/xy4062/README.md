# 预冷装车热负荷校验器

> 冷链仓配工程师的本地科学计算 CLI 工具

## 项目简介

每次水果装车前，工程师要根据货品初温、目标温度、箱体体积、开门时长、风机能力和车辆制冷量估算能不能在发车前降到安全区间。传统方式靠 Excel 很容易漏算开门热侵入和批次混装。

本工具提供了一套完整的热负荷仿真与风险检测系统，帮助工程师：
- 📊 精确计算开门热侵入、箱体热传导、呼吸热等热负荷组件
- ⏱️ 按时间步仿真各批次温度变化
- 🚨 自动检测预冷不足、制冷量不够、开门过久等风险
- 📋 导出专业的分析报告

## 功能特性

| 功能 | 描述 |
|------|------|
| **init** | 初始化/管理货品热参数和车辆配置 |
| **import-plan** | 导入装车计划 CSV 文件 |
| **simulate** | 按时间步计算各批次温度变化和冷量平衡 |
| **check** | 检测预冷不足、制冷量不够、开门过久、目标温度冲突、批次超时风险 |
| **report** | 导出 Markdown 和 CSV 格式报告 |

## 热负荷计算模型

### 开门热侵入

```
开门热侵入 = 门面积 × 空气置换系数 × √温差 × 时长 × 空气密度 × 空气比热容
```

考虑风速影响的修正系数。

### 箱体热传导

```
箱体热侵入 = 表面积 × 隔热系数 × 温差 × 时长
```

### 呼吸热（Q10 模型）

```
呼吸热 = 质量 × 基准呼吸速率 × Q10^((温度-基准温度)/10) × 时长
```

Q10 系数默认取 2.0，表示温度每升高 10°C，呼吸速率翻倍。

### 货品冷却需冷量

```
需冷量 = 质量 × 比热容 × 温差
```

## 风险检测规则

| 风险类型 | 触发条件 | 建议措施 |
|----------|----------|----------|
| **预冷不足** | 预冷时间结束时未达到目标温度 | 延长预冷时间、检查制冷系统 |
| **制冷量不够** | 总供冷量 < 总需冷量 | 使用更大制冷量车辆、分批运输 |
| **开门过久** | 开门时长 > 车辆允许最大时长 | 优化装车流程、减少开门次数 |
| **目标温度冲突** | 不同批次目标温差 > 5°C | 分车运输、使用独立保温箱 |
| **批次超时** | 未在截止时间前完成预冷 | 优先预冷有截止时间的批次 |

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或解压项目到本地
cd pre-cool-validator

# 以可编辑模式安装（方便开发）
pip install -e .

# 或直接安装
pip install .

# 验证安装
pre-cool --version
pre-cool --help
```

### 开发环境安装

```bash
# 安装开发依赖
pip install -e ".[dev]"
```

## 快速开始：临时目录验证全流程

### 步骤 1：初始化配置

使用示例数据初始化货品参数和车辆配置：

```bash
# 进入项目目录
cd /path/to/pre-cool-validator

# 导入示例货品参数和车辆配置
pre-cool init \
  --products examples/products.csv \
  --vehicles examples/vehicles.csv

# 查看当前配置
pre-cool list-config
```

### 步骤 2：导入装车计划

选择一个装车计划示例：

```bash
# 导入正常场景（应该能通过检测）
pre-cool import-plan examples/loading_plan_normal.csv

# 或导入高风险场景（用于测试风险检测）
# pre-cool import-plan examples/loading_plan_risky.csv

# 或导入混装场景（目标温度冲突）
# pre-cool import-plan examples/loading_plan_mixed.csv
```

### 步骤 3：执行时间步仿真

```bash
# 执行仿真，默认时间步长 1 分钟
pre-cool simulate

# 或指定时间步长（例如 5 分钟）
# pre-cool simulate --time-step 5
```

仿真结果会保存到 `pre_cool_work/simulation_result.json`。

### 步骤 4：执行风险检测

```bash
pre-cool check
```

系统会自动检测以下风险：
- 预冷不足
- 制冷量不够
- 开门过久
- 目标温度冲突
- 批次超时

风险报告保存到 `pre_cool_work/risk_report.json`。

### 步骤 5：导出报告

```bash
# 导出所有格式的报告
pre-cool report

# 报告保存在 pre_cool_work/ 目录下：
# - PLAN_NORMAL_001_report.md (Markdown 报告)
# - PLAN_NORMAL_001_batch_results.csv (批次结果)
# - PLAN_NORMAL_001_energy_balance.csv (能量平衡)
# - PLAN_NORMAL_001_time_series.csv (时间序列)
# - PLAN_NORMAL_001_risks.csv (风险评估)
```

### 查看生成的文件

```bash
# 查看工作目录结构
ls -la pre_cool_work/

# 查看 Markdown 报告
cat pre_cool_work/PLAN_NORMAL_001_report.md

# 查看 CSV 数据（可用 Excel 打开）
open pre_cool_work/PLAN_NORMAL_001_batch_results.csv
```

## 完整工作流程示例

```bash
# === 第一次使用：初始化配置 ===

# 导入自定义的货品参数
pre-cool init --products my_products.csv --vehicles my_vehicles.csv

# === 日常使用：处理一个装车计划 ===

# 1. 导入装车计划
pre-cool import-plan loading_plan_20260501.csv

# 2. 执行仿真
pre-cool simulate

# 3. 检查风险
pre-cool check

# 4. 导出报告
pre-cool report

# === 查看结果 ===

# 查看 Markdown 报告
less pre_cool_work/PLAN_20260501_report.md

# 如果有风险，查看详情
cat pre_cool_work/risk_report.json
```

## 数据格式说明

### 货品参数 CSV (products.csv)

| 列名 | 类型 | 必需 | 说明 |
|------|------|------|------|
| product_id | string | ✓ | 货品唯一标识 |
| product_name | string | ✓ | 货品名称 |
| specific_heat | float | ✓ | 比热容 (kJ/kg·°C) |
| density | float | ✓ | 密度 (kg/m³) |
| default_target_temp | float | ✓ | 默认目标温度 (°C) |
| max_precool_time | int | ✓ | 最大预冷时间 (分钟) |
| heat_transfer_coeff | float | | 表面换热系数 (W/m²·°C)，默认 10.0 |
| respiration_rate | float | | 呼吸热 (W/kg)，默认 0.0 |
| notes | string | | 备注 |

**常见货品比热容参考值：**
- 水果/蔬菜: 3.5 ~ 4.0 kJ/kg·°C
- 肉类: 3.0 ~ 3.5 kJ/kg·°C
- 冷冻品: 2.0 ~ 2.5 kJ/kg·°C

### 车辆配置 CSV (vehicles.csv)

| 列名 | 类型 | 必需 | 说明 |
|------|------|------|------|
| vehicle_id | string | ✓ | 车辆唯一标识 |
| vehicle_name | string | ✓ | 车辆名称 |
| cargo_volume | float | ✓ | 货箱容积 (m³) |
| cargo_surface_area | float | ✓ | 货箱表面积 (m²) |
| insulation_k | float | ✓ | 箱体隔热系数 (W/m²·°C) |
| cooling_capacity | float | ✓ | 制冷量 (kW) |
| fan_airflow | float | ✓ | 风机风量 (m³/h) |
| door_area | float | ✓ | 门面积 (m²) |
| ambient_temp_standard | float | | 标准环境温度 (°C)，默认 30.0 |
| max_door_open_duration | int | | 最大允许开门时长 (分钟)，默认 30 |
| notes | string | | 备注 |

**隔热系数参考值：**
- 新冷藏车: 0.3 ~ 0.4 W/m²·°C
- 旧冷藏车: 0.4 ~ 0.6 W/m²·°C

### 装车计划 CSV (loading_plan.csv)

**注意：** 装车计划 CSV 的第一部分（计划信息）在每一行重复，批次信息逐行变化。

| 列名 | 类型 | 必需 | 说明 |
|------|------|------|------|
| plan_id | string | ✓ | 计划唯一标识 |
| plan_name | string | | 计划名称 |
| vehicle_id | string | ✓ | 使用的车辆ID |
| ambient_temp | float | ✓ | 实际环境温度 (°C) |
| total_precool_time | int | ✓ | 总预冷时间 (分钟) |
| door_open_duration | int | ✓ | 开门总时长 (分钟) |
| batch_id | string | ✓ | 批次唯一标识 |
| product_id | string | ✓ | 关联的货品ID |
| product_name | string | ✓ | 货品名称 |
| volume | float | ✓ | 体积 (m³) |
| mass | float | ✓ | 质量 (kg) |
| initial_temp | float | ✓ | 初温 (°C) |
| target_temp | float | ✓ | 目标温度 (°C) |
| arrival_time | int | | 到达时间点 (分钟，相对于预冷开始)，默认 0 |
| deadline_time | int | | 必须降到目标温度的时间点 (分钟) |
| notes | string | | 备注 |

## 多批次到达场景

支持多批次在不同时间点到达的场景，例如：

```csv
plan_id,vehicle_id,...,batch_id,product_id,...,arrival_time,deadline_time
PLAN_001,REF_001,...,B001,APPLE,...,0,60
PLAN_001,REF_001,...,B002,ORANGE,...,20,80
PLAN_001,REF_001,...,B003,STRAWBERRY,...,40,70
```

仿真时会：
- 第 0 分钟开始：批次 B001 开始预冷
- 第 20 分钟：批次 B002 到达，开始预冷
- 第 40 分钟：批次 B003 到达，开始预冷
- 第 60 分钟：批次 B001 截止时间检查
- 第 70 分钟：批次 B003 截止时间检查
- 第 80 分钟：批次 B002 截止时间检查

## 示例数据说明

| 文件 | 场景说明 | 预期结果 |
|------|----------|----------|
| `loading_plan_normal.csv` | 正常场景：3 批次水果，预冷时间充裕 | 无风险或低风险 |
| `loading_plan_risky.csv` | 高风险场景：初温高、预冷时间短、开门久 | 检测到预冷不足、开门过久 |
| `loading_plan_mixed.csv` | 混装场景：冻肉和水果混装 | 检测到目标温度冲突 |
| `loading_plan_complex.csv` | 复杂场景：5 批次不同时间到达 | 全面测试多批次仿真 |

## 测试

### 运行单元测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=pre_cool_validator

# 运行特定测试文件
pytest tests/test_heat_calculator.py -v

# 运行测试并生成 HTML 覆盖率报告
pytest --cov=pre_cool_validator --cov-report=html
```

### 手动测试流程

```bash
# 1. 清理旧数据
rm -rf pre_cool_work

# 2. 初始化配置
pre-cool init --products examples/products.csv --vehicles examples/vehicles.csv

# 3. 导入高风险计划
pre-cool import-plan examples/loading_plan_risky.csv

# 4. 执行仿真
pre-cool simulate

# 5. 检查风险（应该检测到多个风险）
pre-cool check

# 6. 导出报告
pre-cool report

# 7. 验证报告生成
ls -la pre_cool_work/
```

## 项目结构

```
pre-cool-validator/
├── pre_cool_validator/          # 主包
│   ├── __init__.py             # 包初始化
│   ├── cli.py                   # CLI 入口
│   ├── models.py                # 数据模型
│   ├── csv_parser.py            # CSV 解析器
│   ├── heat_calculator.py       # 热负荷计算器
│   ├── risk_engine.py           # 风险引擎
│   └── reporter.py              # 报告生成器
├── examples/                     # 示例数据
│   ├── products.csv             # 货品参数示例
│   ├── vehicles.csv             # 车辆配置示例
│   ├── loading_plan_normal.csv  # 正常场景
│   ├── loading_plan_risky.csv   # 高风险场景
│   ├── loading_plan_mixed.csv   # 混装场景
│   └── loading_plan_complex.csv # 复杂场景
├── tests/                        # 单元测试
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_csv_parser.py
│   ├── test_heat_calculator.py
│   └── test_risk_engine.py
├── pyproject.toml               # 项目配置
└── README.md                    # 本文档
```

## 常见问题

### Q1: 如何确定货品的比热容？

常见食材的比热容可以参考：
- 新鲜水果/蔬菜：约 3.5 ~ 4.0 kJ/kg·°C
- 肉类：约 3.0 ~ 3.5 kJ/kg·°C
- 冷冻产品：约 2.0 ~ 2.5 kJ/kg·°C

或者根据实际测量值填写。

### Q2: 制冷量 kW 和 kJ 的关系？

- 1 kW = 1 kJ/s
- 1 kW·小时 = 3600 kJ

仿真中使用的时间步是分钟，所以：
```
冷量(kJ) = 功率(kW) × 时间(分钟) × 60
```

### Q3: 如何处理多温度混装？

工具会检测到目标温度冲突风险，并建议：
1. 分车运输（推荐）
2. 使用独立保温箱
3. 设置折中的车厢温度（需评估风险）

### Q4: 呼吸热的影响有多大？

对于新鲜水果和蔬菜，呼吸热可能占总热负荷的 10% ~ 30%。工具使用 Q10 模型，考虑温度对呼吸速率的影响：
- 温度越高，呼吸热越大
- 温度每升高 10°C，呼吸速率约翻倍

### Q5: 如何获得更准确的结果？

1. 确保货品参数（比热容、密度）准确
2. 实际测量货品初温
3. 准确记录开门时长
4. 使用实际的环境温度
5. 验证车辆制冷系统的实际制冷量

## 更新日志

### v1.0.0 (2026-05-01)

- 初始版本发布
- 实现完整的 CLI 命令：init, import-plan, simulate, check, report
- 实现热负荷计算引擎
- 实现风险检测引擎
- 实现 Markdown 和 CSV 报告导出
- 提供完整的示例数据
- 完整的单元测试覆盖

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 PR。
