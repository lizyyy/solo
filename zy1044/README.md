# 🐠 鱼缸水质模拟和换水风险预演工具

一个本地可运行的命令行工具，用于模拟鱼缸水质变化，预测换水、喂食、加鱼等操作对水质的影响，帮助养鱼爱好者提前预判水质风险。

## ✨ 功能特性

- 📊 **水质模拟**：按天模拟 14-60 天的氨氮、亚硝酸盐、硝酸盐变化
- ⚠️ **风险评估**：自动评估水质风险等级（安全/偏高/危险/极危险）
- 📋 **报告生成**：支持导出 Markdown 和 HTML 格式报告（含可视化图表）
- 🔄 **方案对比**：对比两个不同换水方案的风险差异
- ✅ **数据校验**：友好的异常输入提示（缺字段、超范围等）
- 📁 **多格式支持**：支持 JSON 和 CSV 格式的场景数据

## 🛠️ 安装

```bash
# 克隆或下载项目后，安装依赖
pip3 install click jinja2 python-dateutil
```

## 🚀 快速开始

### 1. 生成示例数据

```bash
python3 aquarium_cli.py examples
```

这会在 `examples/` 目录下生成多个示例文件：
- `normal_scenario.json` - 正常维护场景
- `high_risk_scenario.json` - 高风险场景（喂食过量）
- `compare_plan_a.json` / `compare_plan_b.json` - 两个对比方案
- `invalid_ph.json` - 无效 pH 测试（会报错）
- `invalid_water_change.json` - 大比例换水测试（会警告）
- `normal_scenario.csv` - CSV 格式示例

### 2. 运行单个场景

```bash
# 基本运行
python3 aquarium_cli.py run examples/normal_scenario.json

# 详细输出 + 生成报告
python3 aquarium_cli.py run examples/normal_scenario.json -v -h report.html -m report.md
```

### 3. 对比两个方案

```bash
python3 aquarium_cli.py compare examples/compare_plan_a.json examples/compare_plan_b.json -h comparison.html
```

## 📝 场景数据格式

### JSON 格式

```json
{
  "name": "我的鱼缸场景",
  "tank_volume": 50,
  "fish": [
    {"size": "small", "quantity": 6},
    {"size": "medium", "quantity": 2}
  ],
  "filtration_level": "medium",
  "daily_feeding_amount": 2.5,
  "initial_ammonia": 0.02,
  "initial_nitrite": 0.01,
  "initial_nitrate": 25.0,
  "initial_ph": 7.2,
  "water_changes": [
    {"day": 7, "percentage": 25},
    {"day": 14, "percentage": 25}
  ],
  "add_fish": [
    {"day": 3, "quantity": 2, "size": "small"}
  ],
  "simulation_days": 14
}
```

### 字段说明

| 字段 | 说明 | 可选值/范围 |
|------|------|-------------|
| `name` | 场景名称 | 任意字符串 |
| `tank_volume` | 鱼缸体积（升） | 0.1 ~ 10000 |
| `fish` | 鱼只列表 | 数组，见下方说明 |
| `filtration_level` | 过滤等级 | `low` / `medium` / `high` |
| `daily_feeding_amount` | 每日喂食量（克） | 0 ~ 100 |
| `initial_ammonia` | 初始氨氮（mg/L） | 0 ~ 10 |
| `initial_nitrite` | 初始亚硝酸盐（mg/L） | 0 ~ 10 |
| `initial_nitrate` | 初始硝酸盐（mg/L） | 0 ~ 500 |
| `initial_ph` | 初始 pH | 0 ~ 14 |
| `water_changes` | 换水计划 | 数组，见下方说明 |
| `add_fish` | 加鱼计划 | 数组，见下方说明 |
| `simulation_days` | 模拟天数 | 1 ~ 60 |

#### 鱼只配置 (`fish`)

| 字段 | 说明 |
|------|------|
| `size` | 鱼的体型 | `small` (小型) / `medium` (中型) / `large` (大型) |
| `quantity` | 数量 | 正整数 |

#### 换水计划 (`water_changes`)

| 字段 | 说明 |
|------|------|
| `day` | 第几天换水 | 正整数 |
| `percentage` | 换水比例（%） | 0 ~ 100（建议每次不超过 30%） |

#### 加鱼计划 (`add_fish`)

| 字段 | 说明 |
|------|------|
| `day` | 第几天加鱼 | 正整数 |
| `quantity` | 加鱼数量 | 正整数 |
| `size` | 鱼的体型 | `small` / `medium` / `large` |

## 📊 安全阈值参考

| 指标 | 安全范围 | 偏高 | 危险 | 极危险 |
|------|---------|------|------|--------|
| 氨氮 (NH3) | ≤ 0.05 mg/L | 0.05 ~ 0.2 mg/L | 0.2 ~ 0.5 mg/L | > 0.5 mg/L |
| 亚硝酸盐 (NO2) | ≤ 0.02 mg/L | 0.02 ~ 0.1 mg/L | 0.1 ~ 0.3 mg/L | > 0.3 mg/L |
| 硝酸盐 (NO3) | ≤ 20 mg/L | 20 ~ 50 mg/L | 50 ~ 80 mg/L | > 80 mg/L |
| pH | 6.5 ~ 7.5 | 6.0~6.5 或 7.5~8.0 | 5.5~6.0 或 8.0~8.5 | <5.5 或 >8.5 |

## 🎯 使用示例

### 示例 1：正常维护场景

**场景文件**：`examples/normal_scenario.json`

**运行**：
```bash
python3 aquarium_cli.py run examples/normal_scenario.json -v
```

**预期输出**：
```
==================================================
📊 模拟结果摘要 - 正常维护场景
==================================================

最高风险等级: 偏高
安全天数: 0 天
偏高天数: 15 天
危险天数: 0 天

📈 水质趋势:
  氨氮: 上升 (最高: 0.0704 mg/L)
  亚硝酸盐: 上升 (最高: 0.0808 mg/L)
  硝酸盐: 下降 (最高: 25.00 mg/L)

⚠️  高风险因素:
  - 喂食量相对鱼的数量偏高

💡 总体建议:
  - 存在一些偏高的指标，建议优化饲养习惯
  - 建议：喂食后观察 5 分钟，如有剩余饲料及时吸出
  - 建议：每周至少停喂一天，帮助消化系统清理
```

**分析**：
- 这个场景总体风险可控，但喂食量偏高
- 建议减少喂食量或每周停喂一天
- 每周换水 25% 是合理的维护频率

---

### 示例 2：高风险场景

**场景文件**：`examples/high_risk_scenario.json`

**特点**：
- 30 升小鱼缸养了 8 条中型鱼
- 过滤等级低（low）
- 喂食量过大（每天 8 克）
- 换水频率低（14 天只换一次）
- 第 3 天还打算加 4 条鱼

**运行**：
```bash
python3 aquarium_cli.py run examples/high_risk_scenario.json -v
```

**预期输出**：
```
⚠️  警告: 当前鱼的生物负载 (24.0) 相对于鱼缸体积 (30 升) 偏高，可能需要增加换水频率
⚠️  警告: 每鱼每天喂食量 (1.00 克) 偏高，过量喂食会导致水质快速恶化

==================================================
📊 模拟结果摘要 - 高风险场景 - 喂食过量
==================================================

最高风险等级: 极危险
安全天数: 0 天
偏高天数: 1 天
危险天数: 14 天
⚠️  首次危险出现在第 1 天

📈 水质趋势:
  氨氮: 上升 (最高: 0.6023 mg/L)
  亚硝酸盐: 上升 (最高: 0.6408 mg/L)
  硝酸盐: 下降 (最高: 40.00 mg/L)

⚠️  高风险因素:
  - 氨氮浓度高风险 - 可能由喂食过量或过滤不足导致
  - 亚硝酸盐高风险 - 硝化系统可能未成熟或超负荷
  - 生物负载相对鱼缸体积偏高
  - 喂食量相对鱼的数量偏高
  - 过滤能力偏低，无法有效处理当前生物负载
  - 换水频率低于建议的每周一次

💡 总体建议:
  - ⚠️ 紧急：存在极高风险天数，建议立即采取行动
  - 建议：每天换水 20-30%，连续 3-5 天，密切监测水质
  - 建议增加换水频率：模拟期 14 天内应至少换水 2 次
```

**分析**：
- 这个场景风险极高，第 1 天就进入危险状态
- 主要问题：密度过高、喂食过量、过滤不足、换水太少
- 建议：减少鱼只数量、大幅减少喂食量、升级过滤系统、增加换水频率

---

### 示例 3：对比两个换水方案

**场景文件**：
- `compare_plan_a.json`：每周换水 25%（一次）
- `compare_plan_b.json`：每 3 天换水 10%（多次少量）

**运行**：
```bash
python3 aquarium_cli.py compare examples/compare_plan_a.json examples/compare_plan_b.json
```

**预期输出**：
```
============================================================
📊 方案对比结果
============================================================

指标              方案 A                      方案 B                     
------------------------------------------------------------
场景名称            方案 A - 每周换水 25%           方案 B - 每3天换水 10%         
最高风险            偏高                        偏高                       
安全天数            0 天                       0 天                      
危险天数            0 天                       0 天                      
最大氨氮            0.0606 mg/L                     0.0595 mg/L                    
最大亚硝酸盐          0.0697 mg/L                     0.0669 mg/L                    
最大硝酸盐           30.00 mg/L                     30.00 mg/L                    

------------------------------------------------------------
⚖️  两个方案风险相当，可根据实际情况选择。
```

**分析**：
- 两个方案风险相当
- 方案 B（多次少量换水）的水质波动更小
- 实际选择取决于个人时间安排

---

### 示例 4：异常输入处理

#### 场景 4a：无效 pH 值

**场景文件**：`examples/invalid_ph.json`（pH = 15.0，超出有效范围）

**运行**：
```bash
python3 aquarium_cli.py run examples/invalid_ph.json
```

**预期输出**：
```
🔄 加载场景: examples/invalid_ph.json
❌ 错误: pH 值必须在 0.0 到 14.0 之间
```

#### 场景 4b：大比例换水

**场景文件**：`examples/invalid_water_change.json`（一次换水 80%）

**运行**：
```bash
python3 aquarium_cli.py run examples/invalid_water_change.json
```

**预期输出**：
```
🔄 加载场景: examples/invalid_water_change.json
⚠️  警告: 第 1 次换水比例 80.0% 过大，建议分多次换水，每次不超过 30%
```

**说明**：
- 警告不会阻止运行，但会提示潜在风险
- 大比例换水可能导致水质急剧波动，对鱼造成应激

## 📁 项目结构

```
zy1044/
├── aquarium_sim/
│   ├── __init__.py          # 包初始化
│   ├── models.py            # 数据模型定义
│   ├── parser.py            # JSON/CSV 数据解析
│   ├── validator.py         # 规则校验
│   ├── simulator.py         # 水质模拟引擎
│   ├── risk_assessor.py     # 风险评估和解释
│   └── reporter.py          # 报告生成（Markdown/HTML）
├── aquarium_cli.py          # CLI 入口
├── requirements.txt         # 依赖文件
├── README.md               # 本文档
├── examples/               # 示例数据（运行 examples 命令后生成）
│   ├── normal_scenario.json
│   ├── high_risk_scenario.json
│   ├── compare_plan_a.json
│   ├── compare_plan_b.json
│   ├── invalid_ph.json
│   ├── invalid_water_change.json
│   └── normal_scenario.csv
├── report.html             # 生成的 HTML 报告
└── report.md               # 生成的 Markdown 报告
```

## 🔧 模块说明

| 模块 | 功能 |
|------|------|
| `models.py` | 定义数据类（Scenario、WaterQuality、RiskAssessment 等） |
| `parser.py` | 解析 JSON 和 CSV 格式的场景数据 |
| `validator.py` | 校验输入数据的合理性（范围、逻辑等） |
| `simulator.py` | 核心模拟引擎，基于硝化循环模型模拟水质变化 |
| `risk_assessor.py` | 评估风险等级，生成原因解释和建议 |
| `reporter.py` | 生成 Markdown 和 HTML 格式报告 |

## 🧪 模拟模型说明

本工具基于简化的硝化循环模型模拟水质变化：

1. **氨氮产生**：鱼的代谢 + 未被食用的食物分解
2. **硝化作用**：氨氮 → 亚硝酸盐 → 硝酸盐（受过滤效率影响）
3. **换水影响**：按比例降低所有污染物浓度
4. **加鱼影响**：增加生物负载，产生更多代谢废物

模型参数经过校准，确保在合理的饲养条件下水质稳定。

## ⚠️ 免责声明

- 本工具基于简化模型生成，仅供参考
- 实际水质受多种因素影响（温度、光照、有益菌活性等）
- 建议配合专业水质检测试剂使用
- 如发现鱼只异常行为，请及时咨询专业人士

## 📄 许可证

MIT License

---

**养鱼小贴士**：
- 建立硝化系统需要时间，新缸建议养水 2-4 周
- 少量多次换水比一次大量换水更安全
- 喂食后观察 5 分钟，如有剩余饲料及时吸出
- 每周至少停喂一天，帮助鱼的消化系统清理
- 新鱼入缸建议过水，减少应激反应
