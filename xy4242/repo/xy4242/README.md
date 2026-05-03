# 流量配平小助手 (Flow Balancer)

微流控芯片调试专用本地 Python CLI，帮助生物实验室在实验前校验芯片设计、泵程序和试剂参数，预测压降、死体积和混合比例偏差。

## 功能特性

- ✅ **init** - 生成完整示例项目（拓扑 JSON、泵程序 CSV、黏度 YAML、目标比例）
- ✅ **check** - 校验拓扑结构、泵程序、黏度参数的一致性和语法
- ✅ **simulate** - 计算各时间段：
  - 各通道流量与压降
  - 死体积残留
  - 混合比例偏差
- ✅ **report** - 导出：
  - Markdown 分析报告
  - CSV 风险表
  - JSON 审计包

## 项目结构

```
flow_balancer/
├── flow_balancer/
│   ├── __init__.py
│   ├── cli.py                    # CLI 入口
│   ├── core/
│   │   ├── __init__.py
│   │   ├── units.py              # 单位换算
│   │   ├── fluidics.py           # 流体力学计算
│   │   ├── rules.py              # 规则引擎
│   │   ├── parsers/
│   │   │   ├── __init__.py
│   │   │   ├── topology.py       # 拓扑解析
│   │   │   ├── pump_program.py   # 泵程序解析
│   │   │   ├── viscosity.py      # 黏度解析
│   │   │   └── mix_target.py     # 混合目标解析
│   │   └── validators/
│   │       ├── __init__.py
│   │       ├── topology_validator.py
│   │       ├── pump_validator.py
│   │       ├── viscosity_validator.py
│   │       └── mix_target_validator.py
│   ├── exporters/
│   │   ├── __init__.py
│   │   ├── markdown_exporter.py  # Markdown 报告导出
│   │   ├── csv_exporter.py       # CSV 风险表导出
│   │   └── json_exporter.py      # JSON 审计包导出
│   └── samples/
│       ├── __init__.py
│       ├── topology.json
│       ├── pump_program.csv
│       ├── viscosity.yaml
│       └── mix_target.json
├── tests/
│   ├── test_units.py
│   ├── test_fluidics.py
│   ├── test_rules.py
│   ├── test_parsers.py
│   └── test_exporters.py
├── pyproject.toml
└── README.md
```

## 快速开始

### 安装

```bash
pip install -e .
```

### 验证流程

#### 1. 初始化示例项目

```bash
flow-balancer init ./my-experiment
```

生成文件：
- `topology.json` - 芯片通道拓扑
- `pump_program.csv` - 注射泵程序
- `viscosity.yaml` - 试剂黏度参数
- `mix_target.json` - 目标混合比例

#### 2. 校验输入文件

```bash
cd ./my-experiment
flow-balancer check
```

或者指定文件路径：

```bash
flow-balancer check \
  --topology ./my-experiment/topology.json \
  --pump ./my-experiment/pump_program.csv \
  --viscosity ./my-experiment/viscosity.yaml \
  --mix-target ./my-experiment/mix_target.json
```

#### 3. 运行流体仿真

```bash
flow-balancer simulate --output ./output
```

输出目录包含：
- 仿真结果摘要
- 各时间段流量和压降

#### 4. 生成完整报告

```bash
flow-balancer report --output ./output
```

生成文件：
- `report.md` - Markdown 分析报告
- `risk_table.csv` - 风险评估表
- `audit.json` - 完整审计数据

## 输入文件格式说明

### 1. 芯片拓扑 (topology.json)

```json
{
  "name": "示例微流控芯片",
  "nodes": [
    {
      "id": "in1",
      "type": "inlet",
      "name": "入口A",
      "x": 0,
      "y": 5
    },
    {
      "id": "out1",
      "type": "outlet",
      "name": "出口1",
      "x": 40,
      "y": 5
    }
  ],
  "channels": [
    {
      "id": "ch1",
      "name": "主通道",
      "channel_type": "rectangular",
      "from_node": "in1",
      "to_node": "mix1",
      "width": 100,
      "width_unit": "μm",
      "height": 50,
      "height_unit": "μm",
      "length": 10,
      "length_unit": "mm"
    }
  ],
  "mixers": [
    {
      "id": "mix1",
      "name": "混合器1",
      "type": "Y型",
      "position": {
        "x": 20,
        "y": 5
      },
      "inlet_nodes": ["in1", "in2"],
      "outlet_channels": ["ch3"]
    }
  ]
}
```

### 2. 泵程序 (pump_program.csv)

```csv
segment,start_time,end_time,start_time_unit,end_time_unit,in1_flow_rate,in1_unit,in1_reagent,in2_flow_rate,in2_unit,in2_reagent
1,0,30,s,s,2.0,μL/min,试剂A,1.0,μL/min,试剂B
2,30,60,s,s,3.0,μL/min,试剂A,1.0,μL/min,试剂B
```

### 3. 试剂黏度 (viscosity.yaml)

```yaml
reagents:
  - id: reagent_A
    name: 试剂A
    viscosity_cp: 1.0
    density_g_per_cm3: 1.0
  
  - id: reagent_B
    name: 试剂B
    viscosity_cp: 1.2
    density_g_per_cm3: 1.0
```

### 4. 混合目标 (mix_target.json)

```json
{
  "mixers": [
    {
      "mixer_id": "mix1",
      "mixer_name": "混合器1",
      "target_ratios": [
        {
          "reagent_id": "reagent_A",
          "reagent_name": "试剂A",
          "ratio": 0.6667
        },
        {
          "reagent_id": "reagent_B",
          "reagent_name": "试剂B",
          "ratio": 0.3333
        }
      ]
    }
  ]
}
```

## 规则引擎

内置多种风险检测规则：

| 规则ID | 规则名称 | 严重程度 | 描述 |
|--------|----------|----------|------|
| HPD_001 | 高压降检测 | HIGH | 单段压降超过阈值 |
| AR_001 | 极端宽高比 | MEDIUM | 通道宽高比超出推荐范围 |
| RD_001 | 比例偏差 | MEDIUM | 实际混合比例与目标偏差过大 |
| DV_001 | 死体积警告 | MEDIUM | 系统死体积超过阈值 |
| FR_001 | 流量单位不一致 | MEDIUM | 各时间段流量单位不一致 |
| ZF_001 | 零流量超时 | LOW | 零流量状态持续过久 |

## 计算模型

### 流体力学计算

**矩形通道压降** (Hagen-Poiseuille 近似):

```
ΔP = (12 * η * L * Q) / (w * h³ * α)
```

其中 α 为宽高比修正系数:
- α ≈ 0.42 当 w/h ≈ 1 时
- α → 1.0 当 w/h >> 1 时

**剪切速率**:

```
γ_max = (6 * Q) / (w * h²)
```

**雷诺数**:

```
Re = (ρ * v * D_h) / η
```

水力直径:
```
D_h = (4 * w * h) / (2 * w + 2 * h)
```

### 混合比例计算

在混合器处，实际混合比例由各入口流量占比决定：

```
实际比例_i = 流量_i / Σ(所有入口流量)
相对偏差 = ((实际比例 - 目标比例) / 目标比例) × 100%
```

### 死体积计算

```
死体积 = Σ(每段通道体积)
通道体积 = 长度 × 宽度 × 高度
```

延迟时间估算:
```
延迟时间 = 死体积 / 总流量
```

## CLI 命令参考

### init

```bash
flow-balancer init [输出目录] [选项]
```

选项：
- `--force` - 强制覆盖已存在的文件

### check

```bash
flow-balancer check [选项]
```

选项：
- `--topology <path>` - 拓扑 JSON 文件路径
- `--pump <path>` - 泵程序 CSV 文件路径
- `--viscosity <path>` - 黏度 YAML 文件路径
- `--mix-target <path>` - 混合目标 JSON 文件路径
- `--rules <path>` - 规则配置文件（可选）
- `--verbose` - 显示详细输出

### simulate

```bash
flow-balancer simulate [选项]
```

选项：
- `--topology <path>` - 拓扑 JSON 文件路径
- `--pump <path>` - 泵程序 CSV 文件路径
- `--viscosity <path>` - 黏度 YAML 文件路径
- `--mix-target <path>` - 混合目标 JSON 文件路径
- `--rules <path>` - 规则配置文件（可选）
- `-o, --output <dir>` - 输出目录
- `--verbose` - 显示详细输出

### report

```bash
flow-balancer report [选项]
```

选项：
- `--topology <path>` - 拓扑 JSON 文件路径
- `--pump <path>` - 泵程序 CSV 文件路径
- `--viscosity <path>` - 黏度 YAML 文件路径
- `--mix-target <path>` - 混合目标 JSON 文件路径
- `--rules <path>` - 规则配置文件（可选）
- `-o, --output <dir>` - 输出目录
- `--verbose` - 显示详细输出

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_fluidics.py -v

# 生成覆盖率报告
pytest tests/ --cov=flow_balancer
```

## 单位支持

### 流量单位

- μL/min (默认)
- mL/h
- nL/s
- μL/s
- mL/min

### 长度单位

- μm (默认)
- mm
- cm
- m

### 时间单位

- s (秒, 默认)
- min (分钟)
- h (小时)

### 黏度单位

- cP (厘泊, 默认)
- mPa·s (毫帕秒)
- Pa·s (帕秒)

## 开发指南

### 添加新规则

1. 在 `flow_balancer/core/rules.py` 中继承 `Rule` 基类
2. 实现 `evaluate()` 方法
3. 调用 `register_rule()` 注册

```python
from flow_balancer.core.rules import Rule, RuleEvaluationResult, RuleViolation, RuleSeverity

class MyCustomRule(Rule):
    rule_id = "MY_001"
    rule_name = "我的自定义规则"
    description = "检查某种条件"
    severity = RuleSeverity.MEDIUM
    
    def evaluate(self, context: dict) -> RuleEvaluationResult:
        # 实现规则逻辑
        violations = []
        # ...
        return RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=len(violations) == 0,
            violations=violations
        )
```

### 自定义规则配置

创建 `rules.yaml` 配置文件:

```yaml
rules:
  - rule_id: HPD_001
    enabled: true
    params:
      threshold_bar: 0.5
  
  - rule_id: RD_001
    enabled: true
    params:
      threshold_percent: 3.0
```

然后运行:

```bash
flow-balancer check --rules rules.yaml
```

## 常见问题

### Q: 如何处理不同的通道截面形状？

当前版本支持:
- `rectangular` - 矩形通道（推荐）
- `circular` - 圆形通道

### Q: 黏度参数如何获取？

常见试剂黏度 (25°C):
- 水: ~1.0 cP
- 细胞培养基: ~1.0-1.2 cP
- 血液: ~3-4 cP
- 甘油水溶液 (50%): ~6 cP

### Q: 为什么混合比例会有偏差？

常见原因:
1. 各入口流量设定值的比例与目标比例不完全匹配
2. 通道阻力差异导致实际流量与设定值有偏差（当前版本假设泵能精确控制流量）
3. 死体积影响导致初始阶段比例不稳定

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系

如有问题或建议，请通过 Issue 联系。
