# 雨水花园渗透复核器

给海绵城市设计师用的本地科学计算 CLI 工具。

小区改造前复核雨水花园的渗透能力，避免单位换错、暴雨重现期选错或溢流风险被漏判。

## 功能特性

- **多源数据导入与校验**：自动校验时间步长一致性、单位合理性、缺失值和异常值
- **可配置入渗模型**：支持 Horton、Green-Ampt、Philip、SCS 四种经典入渗模型
- **完整水文模拟**：计算径流、入渗、蓄水、溢流和排空时间
- **多场雨型对比**：方便对比不同重现期设计雨型的结果
- **规则校验引擎**：自动标出容量不足、排空超时、土壤参数不可信、径流系数冲突等问题
- **多格式报告导出**：支持 Markdown、CSV 和 JSON 格式的复核报告包

## 安装

### 环境要求

- Python >= 3.10
- pip 或 poetry

### 使用 pip

```bash
# 克隆仓库
cd xy4128

# 以开发模式安装
pip install -e .
```

### 使用 poetry

```bash
cd xy4128
poetry install
poetry shell
```

## 快速开始：临时目录验证全流程

### 1. 创建临时目录并初始化项目

```bash
# 创建临时测试目录
mkdir -p /tmp/raingarden_test
cd /tmp/raingarden_test

# 初始化项目（自动创建示例数据）
rain-garden init "示例小区改造项目" -d "某老旧小区海绵城市改造雨水花园复核"
```

你将看到输出：

```
╭──────────────── 雨水花园渗透复核器 ────────────────╮
│ ✓ 项目初始化成功                                     │
│                                                      │
│ 项目名称: 示例小区改造项目                           │
│ 项目ID: a1b2c3d4                                    │
│ 创建示例数据: 是                                     │
╰────────────────────────────────────────────────────╯

示例数据已创建在: /tmp/raingarden_test/examples
使用 'rain-garden import --from-examples' 导入示例数据进行测试
```

### 2. 导入示例数据

```bash
# 从示例目录导入所有测试数据
rain-garden import --from-examples
```

输出：

```
✓ 已导入降雨: rainfall_10y (10.0年一遇)
✓ 已导入降雨: rainfall_5y (5.0年一遇)
✓ 已导入土壤试验数据
✓ 已导入汇水面积数据
✓ 已导入池体几何数据

共导入 5 组数据
```

### 3. 查看项目状态

```bash
rain-garden status
```

输出：

```
┌──────────────────────── 项目状态 ────────────────────────┐
│ 类别         │ 数量 │ 详情                                  │
├────────────────────────────────────────────────────────────┤
│ 降雨数据     │ 2    │ rainfall_10y(10.0y), rainfall_5y(5.0y) │
│ 土壤数据     │ 1    │ sandy_loam                            │
│ 汇水区       │ 3    │ rooftop, parking, lawn                 │
│ 池体         │ 1    │ rain_garden_1 (80.0m³)               │
└────────────────────────────────────────────────────────────┘
```

### 4. 运行水文模拟

使用 Horton 入渗模型进行模拟：

```bash
rain-garden simulate -m horton -t 5 --max-drain 72
```

输出：

```
╭──────────────── 模拟配置 ────────────────╮
│ 入渗模型: horton                          │
│ 时间步长: 5.0 min                         │
│ 最大排空时间: 72.0 小时                   │
│ 地下排水: 启用                             │
╰───────────────────────────────────────────╯

正在模拟: rainfall_5y (5.0年一遇)
┌────────── 模拟结果 - rainfall_5y ──────────┐
│ 指标           │ 数值                       │
├─────────────────────────────────────────────┤
│ 总径流量       │ 123.45 m³                  │
│ 总入渗量       │ 95.20 m³                   │
│ 总溢流量       │ 0.00 m³                    │
│ 峰值蓄水量     │ 45.60 m³                   │
│ 峰值水位       │ 45.6 cm                    │
│ 排空时间       │ 18.5 小时                  │
│ 是否溢流       │ 否                         │
└─────────────────────────────────────────────┘

正在模拟: rainfall_10y (10.0年一遇)
┌───────── 模拟结果 - rainfall_10y ──────────┐
│ 指标           │ 数值                       │
├─────────────────────────────────────────────┤
│ 总径流量       │ 198.75 m³                  │
│ 总入渗量       │ 80.00 m³                   │
│ 总溢流量       │ 28.75 m³                   │
│ 峰值蓄水量     │ 80.00 m³                   │
│ 峰值水位       │ 80.0 cm                    │
│ 排空时间       │ 36.2 小时                  │
│ 是否溢流       │ 是                         │
└─────────────────────────────────────────────┘

✓ 完成 2 场降雨模拟
结果已保存到: /tmp/raingarden_test/results
```

### 5. 对比不同重现期雨型

```bash
rain-garden compare -a 5y -b 10y
```

输出：

```
┌──────────────────────── 对比结果 ────────────────────────┐
│ 指标         │ rainfall_5y    │ rainfall_10y   │ 差异     │
├───────────────────────────────────────────────────────────┤
│ 重现期       │ 5.0 年         │ 10.0 年        │ +5 年    │
│ 总径流量     │ 123.45 m³      │ 198.75 m³      │ +75.30 m³│
│ 总入渗量     │ 95.20 m³       │ 80.00 m³       │ -15.20 m³│
│ 总溢流量     │ 0.00 m³        │ 28.75 m³       │ +28.75 m³│
│ 峰值水位     │ 45.6 cm        │ 80.0 cm        │ +34.4 cm │
│ 排空时间     │ 18.5 h         │ 36.2 h         │ +17.7 h  │
│ 溢流         │ 否              │ 是              │ -        │
└───────────────────────────────────────────────────────────┘
```

### 6. 规则校验

```bash
rain-garden check --max-drain 72
```

输出：

```
╭──────────────── 校验结果 - 不通过 ─────────────────╮
│ 严重问题: 1                                           │
│ 警告: 2                                               │
│ 信息: 2                                               │
╰──────────────────────────────────────────────────────╯

详细问题列表:

🔴 [capacity_insufficient]
   池体容量不足，发生溢流。溢流量: 28.75 m³ (14.5% of 总径流)
   字段: storage_volume
   值: 80.0
   建议: 建议增大池体容量或提高入渗能力。当前容量: 80.00 m³, 峰值蓄水量: 80.00 m³

🟡 [drain_timeout]
   预计排空时间: 36.2 小时 (限值: 72.0 小时)
   字段: drain_time
   值: 36.2

🟡 [overflow_risk]
   降雨 'rainfall_10y' (10.0年一遇) 发生溢流 28.75 m³
   建议: 增大池体容量、提高入渗率或增加预处理设施

⚠️ 复核不通过，存在严重问题需要整改
```

### 7. 导出复核报告

```bash
# 导出所有格式的报告到 reports 目录
rain-garden report -o ./reports -f all
```

输出：

```
╭────────── 报告导出完成 ───────────╮
│ 共导出 7 个文件                    │
╰────────────────────────────────────╯

  ✓ Markdown: reports/report.md
  ✓ CSV汇总: reports/summary.csv
  ✓ 时序数据-rainfall_5y: reports/timeseries_rainfall_5y_5.0y.csv
  ✓ 时序数据-rainfall_10y: reports/timeseries_rainfall_10y_10.0y.csv
  ✓ 警告列表: reports/warnings.csv
  ✓ JSON: reports/report.json

报告输出目录: /tmp/raingarden_test/reports
```

### 查看生成的报告

```bash
# 查看 Markdown 报告
cat reports/report.md

# 或在浏览器中查看
# open reports/report.md  # macOS
# xdg-open reports/report.md  # Linux
```

## 完整命令参考

### init - 初始化项目

```bash
rain-garden init [项目名称] [选项]

选项:
  -d, --description TEXT  项目描述
  --no-examples           不创建示例数据
```

示例：
```bash
rain-garden init "阳光小区改造" -d "2024年老小区海绵城市改造项目"
```

### import - 导入数据

```bash
rain-garden import [选项]

选项:
  -r, --rainfall PATH     降雨过程 CSV 文件
  --rainfall-name TEXT    降雨名称 (默认: design_rain)
  -rp, --return-period FLOAT  暴雨重现期（年）(默认: 5.0)
  -s, --soil PATH         土壤入渗试验 CSV
  --soil-id TEXT          土壤试验 ID
  -c, --catchment PATH    汇水面积 CSV
  -p, --pond PATH         池体几何参数 CSV
  --from-examples         从示例目录导入所有数据
  --time-unit [s|min|h|day]  时间单位 (默认: min)
  --intensity-unit [mm|cm|m]  降雨强度单位 (默认: mm)
```

示例：
```bash
# 分别导入各数据文件
rain-garden import -r ./data/rain_chicago.csv -rp 10 --rainfall-name "芝加哥10年一遇"
rain-garden import -s ./data/soil_test.csv --soil-id "双环试验01"
rain-garden import -c ./data/catchment.csv
rain-garden import -p ./data/pond.csv
```

### simulate - 运行模拟

```bash
rain-garden simulate [选项]

选项:
  -m, --model [horton|green-ampt|philip|scs]  入渗模型 (默认: horton)
  -t, --time-step FLOAT   模拟时间步长 (默认: 5.0)
  --time-unit [s|min|h|day]  时间单位 (默认: min)
  --max-drain FLOAT       最大排空时间（小时）(默认: 72.0)
  --no-underdrain         禁用地下排水
```

示例：
```bash
# 使用 Green-Ampt 模型，时间步长 1 分钟
rain-garden simulate -m green-ampt -t 1

# 禁用地下排水
rain-garden simulate --no-underdrain
```

### compare - 对比雨型

```bash
rain-garden compare [选项]

选项:
  -a, --rainfall-a TEXT   第一场降雨名称 (必需)
  -b, --rainfall-b TEXT   第二场降雨名称 (必需)
```

示例：
```bash
# 对比 5 年和 10 年一遇的结果
rain-garden compare -a rainfall_5y -b rainfall_10y
```

### check - 规则校验

```bash
rain-garden check [选项]

选项:
  --max-drain FLOAT       最大排空时间限值（小时）(默认: 72.0)
```

示例：
```bash
# 使用更严格的 48 小时排空限值
rain-garden check --max-drain 48
```

### report - 导出报告

```bash
rain-garden report [选项]

选项:
  -o, --output PATH       输出目录 (默认: ./reports)
  -f, --format [all|markdown|csv|json]  输出格式 (默认: all)
  -p, --prefix TEXT       输出文件名前缀
```

示例：
```bash
# 仅导出 JSON
rain-garden report -f json

# 带前缀的报告
rain-garden report -p "final_" -o ./final_reports
```

### status - 查看项目状态

```bash
rain-garden status [选项]

选项:
  -a, --all               显示所有信息
```

## 数据格式说明

### 降雨过程 CSV

```csv
time,intensity
0,0
5,2
10,5
15,12
20,18
25,25
30,28
35,25
40,20
45,15
50,10
55,6
60,3
65,1
70,0
```

| 字段 | 说明 | 单位 |
|------|------|------|
| time | 时间点 | min (可配置) |
| intensity | 降雨强度 | mm (可配置) |

### 土壤入渗试验 CSV

```csv
soil_type,saturated_hydraulic_conductivity,initial_moisture,saturated_moisture,suction_head,horton_f0,horton_fc,horton_k
sandy_loam,15,0.2,0.45,10,30,15,0.5
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| soil_type | 土壤类型 | - |
| saturated_hydraulic_conductivity | 饱和导水率 | - |
| initial_moisture | 初始含水量 | 0.2 |
| saturated_moisture | 饱和含水量 | 0.45 |
| suction_head | 吸力水头 (Green-Ampt 模型用) | 10 cm |
| horton_f0 | Horton 模型 f0 (初始入渗率) | Ks * 2 |
| horton_fc | Horton 模型 fc (稳定入渗率) | Ks |
| horton_k | Horton 模型 k (衰减系数) | 0.5 |

### 汇水面积 CSV

```csv
name,area,runoff_coefficient,land_use_type,impervious_ratio
rooftop,500,0.85,building,0.95
parking,800,0.8,pavement,0.9
lawn,1200,0.3,grass,0.1
```

| 字段 | 说明 |
|------|------|
| name | 汇水区名称 |
| area | 面积 (m²) |
| runoff_coefficient | 径流系数 (0-1) |
| land_use_type | 土地利用类型 |
| impervious_ratio | 不透水率 (0-1)，用于校验径流系数合理性 |

### 池体几何参数 CSV

```csv
name,surface_area,depth,underdrain_rate,shape_type,bottom_area,side_slope
rain_garden_1,100,0.8,30,rectangular,,
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| name | 池体名称 | - |
| surface_area | 表面积 (m²) | - |
| depth | 深度 (m) | - |
| underdrain_rate | 排水速率 (mm/h) | 0 |
| shape_type | 形状类型 | rectangular |
| bottom_area | 底部面积 (m²)，梯形/楔形池用 | - |
| side_slope | 边坡比，梯形池用 | - |

## 支持的入渗模型

| 模型 | 命令行值 | 适用场景 | 所需参数 |
|------|----------|----------|----------|
| Horton | `horton` | 设计中最常用，经验模型 | f0, fc, k |
| Green-Ampt | `green-ampt` | 物理概念模型 | Ks, θs, θi, ψf |
| Philip | `philip` | 半物理模型，入渗早期 | S (sorptivity), A |
| SCS | `scs` | 美国农业部曲线数法 | CN (曲线数) |

## 运行测试

```bash
# 使用 pytest 运行所有测试
pytest -v

# 运行特定测试模块
pytest tests/test_parsers.py -v
pytest tests/test_engine.py -v
pytest tests/test_validators.py -v

# 显示覆盖率
pytest --cov=rain_garden_checker
```

## 项目结构

```
xy4128/
├── pyproject.toml              # 项目配置和依赖
├── README.md                   # 本文档
├── rain_garden_checker/        # 主包
│   ├── __init__.py
│   ├── cli/
│   │   ├── __init__.py
│   │   └── main.py             # CLI 入口 (init/import/simulate/compare/check/report)
│   ├── models/
│   │   ├── __init__.py
│   │   └── data_models.py      # 所有数据模型定义 (Pydantic)
│   ├── parsers/
│   │   ├── __init__.py
│   │   └── csv_parser.py       # CSV 解析和数据校验
│   ├── engine/
│   │   ├── __init__.py
│   │   └── infiltration.py     # 入渗模型和水文计算引擎
│   ├── validators/
│   │   ├── __init__.py
│   │   └── rules.py            # 规则校验引擎
│   ├── storage/
│   │   ├── __init__.py
│   │   └── project.py          # 项目管理和数据持久化
│   ├── reports/
│   │   ├── __init__.py
│   │   └── exporter.py         # 报告导出 (Markdown/CSV/JSON)
│   └── utils/
│       └── __init__.py
├── tests/                      # 测试
│   ├── __init__.py
│   ├── test_parsers.py         # 解析器测试
│   ├── test_engine.py          # 计算引擎测试
│   └── test_validators.py      # 规则校验测试
└── examples/                   # 示例数据 (init 时创建)
```

## 常见问题

### Q: 如何选择合适的入渗模型？

- **Horton 模型**：最常用的经验模型，适合有长期入渗观测数据的情况
- **Green-Ampt 模型**：物理概念模型，需要土壤物理参数（导水率、含水量、吸力水头）
- **Philip 模型**：半物理模型，对入渗早期阶段模拟较好
- **建议**：如果有现场双环入渗试验数据，优先使用 Horton 或 Green-Ampt

### Q: 单位如何处理？

系统内部统一转换为标准单位：
- 长度：米 (m)
- 面积：平方米 (m²)
- 时间：小时 (h)
- 体积：立方米 (m³)

导入时可以指定原始数据单位，CLI 会自动处理转换。

### Q: 校验不通过怎么办？

根据警告信息调整设计参数：

1. **容量不足/溢流**：增大池体表面积或深度，或提高土壤入渗能力
2. **排空超时**：增大排水层厚度，选用导水性更好的介质，或增设穿孔管排水
3. **土壤参数异常**：核实现场试验数据，或进行补充试验
4. **径流系数冲突**：根据土地利用类型和不透水率调整径流系数

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**免责声明**：本工具仅供设计参考，实际工程请遵循当地规范和主管部门要求。
