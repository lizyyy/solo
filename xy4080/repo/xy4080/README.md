# 窑炉升温曲线校验员

小型陶艺工作室本地科学计算CLI工具，用于在素烧或釉烧前校验升温曲线。

## 功能特性

- **init** - 初始化工作目录和配置参数
- **import-plan** - 导入烧成计划、作品清单和探头数据CSV
- **simulate** - 基于简化热传导模型，按时间步估算坯体热惯性与内外温差
- **check** - 执行7类校验规则，标出问题：
  - 升温斜率超限（炸坯风险）
  - 保温不足（影响烧结）
  - 降温段影响釉色
  - 探头漂移（实际与计划偏差）
  - 坯体厚度冲突（厚坯需特殊处理）
  - 釉料温区不匹配
  - 热模拟内外温差
- **report** - 导出 Markdown、CSV、JSON 三种格式报告

## 安装

```bash
# 进入项目目录
cd xy4080

# 以可编辑模式安装（推荐，方便调试）
pip install -e .

# 或使用 poetry（如有）
# poetry install
```

安装后即可使用 `kiln-validator` 命令。

## 快速开始：临时目录验证全流程

按照以下步骤，使用示例数据验证完整工作流程：

### 1. 创建临时目录并初始化

```bash
# 创建临时工作目录
mkdir -p /tmp/kiln-test
cd /tmp/kiln-test

# 初始化窑炉配置
kiln-validator init \
    --max-ramp-rate 150 \
    --glaze-tolerance 15

# 查看生成的配置文件（可选）
cat .kiln-workspace/config.json
```

### 2. 导入数据

导入烧成计划和作品清单（使用随项目提供的示例数据）：

```bash
# 设置示例数据目录（根据实际项目位置调整）
EXAMPLES=/Users/mac/pro/solocoder/pro/xy4080/repo/xy4080/examples

# 方式A：导入正常曲线和普通作品（预期校验通过）
kiln-validator import-plan \
    "$EXAMPLES/firing_plan_normal.csv" \
    --workpieces "$EXAMPLES/workpieces_normal.csv"

# 方式B：导入有问题的曲线和厚坯作品（预期发现多个问题）
# kiln-validator import-plan \
#     "$EXAMPLES/firing_plan_problematic.csv" \
#     --workpieces "$EXAMPLES/workpieces_thick.csv"
```

### 3. 运行热模拟

模拟坯体在烧成过程中的热惯性和内外温差：

```bash
# 使用已导入的数据运行模拟
kiln-validator simulate

# 或手动指定厚度
# kiln-validator simulate --thickness 2.0
```

输出示例：
```
运行热模拟...
  坯体厚度: 2.0 cm
  时间步长: 1 分钟

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 热模拟结果摘要                                 ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ 指标              │ 值                        │
├───────────────────┼───────────────────────────┤
│ 总模拟步数         │ 1080                      │
│ 总模拟时长         │ 1080 分钟                │
│ 最高窑炉温度       │ 1200.0 °C                 │
│ 最大内外温差       │ 45.2 °C                   │
│ 最大温差发生时间    │ 240 分钟                 │
│ 所在段            │ 573到1200度               │
└───────────────────┴───────────────────────────┘
```

### 4. 执行校验

运行完整的规则校验：

```bash
# 执行校验（默认会同时运行热模拟）
kiln-validator check

# 或不运行模拟
# kiln-validator check --no-simulate
```

**正常曲线预期输出（示例）：**
```
校验问题统计
┏━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┓
┃ 类别              ┃ 🔴 严重            ┃ 🟡 警告              ┃ ℹ️ 信息              ┃ 合计               ┃
┡━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━┩
│ 降温速率          │ -                  │ -                    │ 1                   │ 1                  │
│ 热温差            │ -                  │ 1                    │ -                   │ 1                  │
├───────────────────┼────────────────────┼──────────────────────┼────────────────────┼────────────────────┤
│ 总计              │ 0                  │ 1                    │ 1                  │ 2                  │
└───────────────────┴────────────────────┴──────────────────────┴────────────────────┴────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🟡 发现 1 个警告，建议检查                                          │
└────────────────────────────────────────────────────────────────────┘
```

**有问题的曲线预期输出（示例）：**
```
校验问题统计
┏━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┓
┃ 类别              ┃ 🔴 严重            ┃ 🟡 警告              ┃ ℹ️ 信息              ┃ 合计               ┃
┡━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━┩
│ 升温速率          │ 3                  │ -                    │ -                   │ 3                  │
│ 保温时间          │ -                  │ 1                    │ -                   │ 1                  │
│ 降温速率          │ -                  │ 1                    │ -                   │ 1                  │
│ 坯体厚度          │ 2                  │ -                    │ -                   │ 2                  │
│ 釉料匹配          │ 2                  │ -                    │ -                   │ 2                  │
│ 热温差            │ 1                  │ -                    │ -                   │ 1                  │
├───────────────────┼────────────────────┼──────────────────────┼────────────────────┼────────────────────┤
│ 总计              │ 8                  │ 2                    │ 0                  │ 10                 │
└───────────────────┴────────────────────┴──────────────────────┴────────────────────┴────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🔴 发现 8 个严重问题，必须修复后才能烧制！                           │
└────────────────────────────────────────────────────────────────────┘

🔴 升温速率超限：550.0 °C/小时，限制为 150.0 °C/小时 @ [快速升温1]
   💡 建议将升温段时间延长约 80 分钟，或分段升温
...
```

### 5. 导出报告

校验完成后，导出三种格式的报告：

```bash
# 导出所有格式到默认 reports 目录
kiln-validator report

# 或指定输出目录和文件名
kiln-validator report \
    --output /tmp/kiln-test-reports \
    --name my-validation-report \
    --format all
```

导出的文件：
- `kiln-validation-report.md` - 详细的 Markdown 格式报告
- `kiln-validation-report.csv` - CSV 格式问题列表
- `kiln-validation-report.json` - 完整结构化 JSON 数据

### 查看报告

```bash
# 查看 Markdown 报告
cat .kiln-workspace/reports/kiln-validation-report.md

# 或在浏览器中打开（如安装了 markdown 预览工具）
# open .kiln-workspace/reports/kiln-validation-report.md
```

## CSV 文件格式说明

### 1. 烧成计划 CSV

必需列：
- `segment_type` / `段类型`: ramp_up / soak / ramp_down / natural_cool
- `start_temp_c` / `起始温度`
- `end_temp_c` / `结束温度`
- `duration_min` / `时间(分钟)`

可选元数据列：
- `plan_name` / `计划名称`
- `plan_description` / `描述`
- `firing_type` / `烧成类型`

示例：
```csv
plan_name,firing_type,segment_type,name,start_temp_c,end_temp_c,duration_min
标准釉烧,釉烧,ramp_up,升温1,25,500,120
标准釉烧,釉烧,soak,保温,573,573,30
标准釉烧,釉烧,ramp_down,降温,1200,900,60
```

### 2. 作品清单 CSV

必需列：
- `id` / `编号`: 作品唯一标识
- `thickness_cm` / `厚度`: 坯体厚度（厘米）

可选列：
- `name` / `名称`
- `clay_type` / `粘土类型`
- `water_content` / `含水率`
- `glaze_outer` / `外层釉`: 格式为 "釉料名称;最低温;最高温"，如 "透明釉;1180;1240"
- `glaze_inner` / `内层釉`: 同上

示例：
```csv
id,name,thickness_cm,clay_type,glaze_outer
P001,小茶杯,0.8,瓷泥,透明釉;1180;1240
P002,花瓶,2.0,陶泥,钧釉;1220;1280
```

### 3. 探头数据 CSV

必需列：
- `time_minutes` / `时间(分钟)`
- `temperature_c` / `温度(°C)`

支持多探头（多温度列）：
```csv
time_minutes,probe_main,probe_upper,probe_lower
0,25,25,25
30,500,490,480
```

## 项目结构

```
kiln_validator/
├── __init__.py
├── cli.py                    # CLI 入口
├── models/                   # 数据模型
│   ├── __init__.py
│   ├── config.py             # KilnConfig 窑炉配置
│   ├── plan.py               # FiringPlan 烧成计划
│   ├── workpiece.py          # Workpiece/GlazeInfo 作品和釉料
│   ├── thermo.py             # ThermoSimulationResult 热模拟结果
│   └── validation.py         # ValidationResult 校验结果
├── parsers/                  # CSV 解析器
│   ├── __init__.py
│   ├── plan_parser.py        # 烧成计划解析
│   ├── workpiece_parser.py   # 作品清单解析
│   └── probe_parser.py       # 探头数据解析
├── thermo/                   # 热计算模块
│   ├── __init__.py
│   └── simulator.py          # 热传导模拟引擎
├── rules/                    # 规则引擎
│   ├── __init__.py
│   └── engine.py             # 7 类校验规则
└── reports/                  # 报告生成
    ├── __init__.py
    └── generator.py          # Markdown/CSV/JSON 导出

examples/                     # 示例数据
├── firing_plan_normal.csv
├── firing_plan_problematic.csv
├── workpieces_normal.csv
├── workpieces_thick.csv
└── probe_data_normal.csv

tests/                        # 单元测试
├── __init__.py
├── test_models.py
└── test_parsers.py
```

## 配置参数说明

工作目录中的 `config.json` 可手动编辑调整：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_ramp_rate_c_per_hour` | 150 | 最大允许升温速率 (°C/小时) |
| `glaze_temperature_tolerance` | 15 | 釉料温区容差 (°C) |
| `thermal_conductivity_clay` | 0.8 | 粘土热传导系数 (W/m·K) |
| `thickness_warning_threshold_cm` | 2.5 | 厚度警告阈值 (cm) |
| `thickness_critical_threshold_cm` | 4.0 | 厚度临界阈值 (cm) |
| `probe_drift_threshold_c` | 20 | 探头漂移阈值 (°C) |
| `time_step_minutes` | 1 | 热模拟时间步长 (分钟) |

## 运行测试

```bash
# 运行单元测试
pytest -v

# 带覆盖率
pytest --cov=kiln_validator -v
```

## 命令参考

```
kiln-validator [命令] [选项]

命令:
  init           初始化工作目录和配置
  import-plan    导入烧成计划、作品清单、探头数据
  simulate       运行热模拟
  check          执行完整校验
  report         导出报告
  --help, -h     显示帮助
  --version, -v  显示版本
```

### 各命令详细帮助

```bash
kiln-validator init --help
kiln-validator import-plan --help
kiln-validator simulate --help
kiln-validator check --help
kiln-validator report --help
```

## 工作原理

### 热模型

热模拟使用简化的双层模型（表面 + 中心）：

1. **热时间常数** - 与厚度平方成正比（傅里叶热传导）
2. **指数温度响应** - 每层温度遵循牛顿加热/冷却定律
3. **内外温差** - 表面温度与中心温度差值（炸坯风险指标）

### 校验规则

| 规则 | 触发条件 | 建议 |
|------|----------|------|
| 升温速率超限 | 超过 `max_ramp_rate` | 延长升温时间或分段 |
| 保温不足 | 高温保温时间过短 | 延长保温时间 |
| 厚坯警告 | 超过厚度阈值 | 单独烧制或降速 |
| 釉料不匹配 | 峰值温度不在釉料温区 | 调整温度或换釉 |
| 热温差过大 | 内外温差 > 80°C | 降速+增加保温 |
| 探头漂移 | 实际与计划偏差 > 20°C | 校准或更换探头 |

## License

MIT
