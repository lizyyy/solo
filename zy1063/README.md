# 🔥 香薰蜡烛配方预演工具

一个本地运行的香薰蜡烛配方分析工具，帮助你在实际制作前预演配方效果、评估成本、检测安全风险。

## ✨ 功能特性

- **成本估算**：自动计算单杯成本、总成本、成本明细占比
- **香精负载分析**：计算香精相对于蜡基的负载比例
- **挥发模拟**：基于半衰期模拟前中后调的强度随时间衰减
- **留香评分**：综合评估配方的留香表现（0-100分）
- **风险检测**：
  - 香精比例超过建议最大值
  - 闪点过低（安全风险）
  - 过敏原标签检测
  - 容器容量不足
  - 后调断层风险
  - 成本超出目标
- **多配方对比**：一次对比 2-3 个配方方案
- **报告导出**：支持 Markdown 和 HTML 格式报告

## 📦 安装

本工具使用纯 Python 开发，无需外部服务。

### 环境要求

- Python 3.7+

### 安装步骤

```bash
# 克隆或下载项目
cd zy1063

# 无需额外依赖，直接运行
python candle_sim.py --help
```

## 🚀 快速开始

### 1. 分析单个配方

```bash
# 使用示例数据运行
python candle_sim.py \
  -i examples/ingredients.json \
  -r examples/recipe_1_lavender.json
```

运行后会自动生成 `report_recipe_1_lavender.md` 和 `report_recipe_1_lavender.html` 两个报告文件。

### 2. 对比多个配方

```bash
# 对比 3 个不同配方
python candle_sim.py \
  -i examples/ingredients.json \
  -r examples/recipe_1_lavender.json \
     examples/recipe_2_rose.json \
     examples/recipe_3_mint.json \
  -o report_comparison.md \
  --html report_comparison.html
```

### 3. 指定输出文件

```bash
# 只生成 HTML 报告
python candle_sim.py \
  -i examples/ingredients.json \
  -r examples/recipe_1_lavender.json \
  --html output/my_report.html
```

## 📖 使用说明

### 命令行参数

```bash
python candle_sim.py [选项]

选项：
  -i, --ingredients    原料库文件路径 (JSON/CSV) [必需]
  -r, --recipes        配方文件路径 (JSON/CSV)，可指定多个 [必需]
  -o, --markdown       输出 Markdown 报告路径
  --html               输出 HTML 报告路径
  -q, --quiet          静默模式，减少输出
  -v, --version        显示版本信息
  -h, --help           显示帮助信息
```

### 查看生成的报告

工具会生成两种格式的报告：

1. **Markdown 报告** (`.md`)：适合在编辑器中查看、编辑或分享
2. **HTML 报告** (`.html`)：适合在浏览器中打开，有更好的视觉效果

查看 HTML 报告：

```bash
# macOS
open report_recipe_1_lavender.html

# 或直接在浏览器中打开文件
```

## 📁 文件格式说明

### 原料库格式 (ingredients.json)

```json
[
  {
    "name": "大豆蜡 464",
    "type": "蜡基",
    "unit_price": 45.0,
    "unit": "kg",
    "max_ratio": null,
    "flash_point": 300.0,
    "allergen_tags": [],
    "note_type": null,
    "half_life": null,
    "volatility_coefficient": null,
    "notes": "优质大豆蜡，熔点约 52°C"
  }
]
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 原料名称，唯一标识 |
| type | string | 是 | 类型：蜡基/香精/助剂/容器 |
| unit_price | float | 是 | 单价 |
| unit | string | 是 | 单位：g/kg/mg/ml/l/oz/lb/pcs |
| max_ratio | float | 否 | 建议最大添加比例(%)，仅香精有效 |
| flash_point | float | 否 | 闪点(°C)，用于安全检测 |
| allergen_tags | array | 否 | 过敏原标签列表 |
| note_type | string | 否 | 香调分类：前调/中调/后调 |
| half_life | float | 否 | 挥发半衰期(小时) |
| volatility_coefficient | float | 否 | 挥发系数，与半衰期二选一 |
| notes | string | 否 | 备注说明 |

#### 原料类型说明

- **蜡基 (wax)**：蜡烛基础原料，如大豆蜡、石蜡、蜂蜡
- **香精 (fragrance)**：提供香味，需要指定香调和半衰期
- **助剂 (additive)**：硬脂酸、Vybar、灯芯等辅助材料
- **容器 (container)**：玻璃杯、锡杯等包装容器

#### 香调与挥发模拟

香精需要指定 `note_type`（前调/中调/后调）和 `half_life`（半衰期，单位：小时）：

- **前调 (Top)**：初始闻到的香味，半衰期建议 1-4 小时
- **中调 (Middle)**：核心香味，半衰期建议 6-12 小时
- **后调 (Base)**：持久留香，半衰期建议 18-48 小时

如果不指定半衰期，工具会使用默认值：
- 前调：2.0 小时
- 中调：8.0 小时
- 后调：24.0 小时

### 配方文件格式 (recipe.json)

```json
{
  "name": "薰衣草助眠蜡烛",
  "description": "经典薰衣草香型，适合卧室使用",
  "total_batch_size": 500,
  "total_batch_unit": "g",
  "target_per_cup_capacity": 100,
  "target_per_cup_unit": "g",
  "container_count": 5,
  "target_per_cup_cost": 15.0,
  "notes": "使用大豆蜡为主",
  "ingredients": [
    {
      "name": "大豆蜡 464",
      "amount": 440,
      "unit": "g"
    },
    {
      "name": "薰衣草香精",
      "amount": 35,
      "unit": "g"
    }
  ]
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 配方名称 |
| description | string | 否 | 配方描述 |
| total_batch_size | float | 是 | 总批量大小 |
| total_batch_unit | string | 是 | 总批量单位 |
| target_per_cup_capacity | float | 是 | 目标单杯容量 |
| target_per_cup_unit | string | 是 | 单杯容量单位 |
| container_count | int | 是 | 容器数量 |
| target_per_cup_cost | float | 否 | 目标单杯成本 |
| notes | string | 否 | 备注 |
| ingredients | array | 是 | 原料列表 |

#### 原料列表格式

每个原料包含：
- `name`：原料名称（必须与原料库中一致）
- `amount`：用量数值
- `unit`：用量单位

### 支持的单位

| 单位类型 | 支持单位 |
|----------|----------|
| 质量 | g, kg, mg, oz, lb |
| 体积 | ml, l |
| 数量 | pcs, unit |

单位会自动归一化到克进行计算。

## 📊 报告内容说明

生成的报告包含以下部分：

### 1. 配方概览（多配方对比时）

| 配方名称 | 总批量 | 单杯容量 | 容器数量 | 单杯成本 | 香精负载 | 留香评分 | 高风险 | 中风险 |
|----------|--------|----------|----------|----------|----------|----------|--------|--------|

### 2. 基本信息

- 总批量
- 目标单杯容量
- 容器数量
- 目标单杯成本

### 3. 原料清单

列出所有使用的原料及其类型、用量、单价。

### 4. 成本分析

- 总成本
- 单杯成本
- 单位成本（每克）
- 成本明细（饼图展示）

### 5. 负载比例分析

- 香精总重量
- 蜡基总重量
- 香精负载比例（香精/蜡基）
- 香调分布（条形图）

### 6. 挥发模拟与留香分析

- 留香评分（0-100分）
- 整体留香时间
- 各香调持续时间
- 关键时间点强度变化表

### 7. 风险检测

按严重程度分类显示：

- **🔴 高风险**：需要立即关注的问题
  - 香精比例严重超标
  - 闪点过低（<60°C）
  - 容器容量不足导致溢出

- **🟡 中风险**：建议改进的问题
  - 香精负载偏高（>8%）
  - 闪点偏低（<90°C）
  - 香调断层风险
  - 成本超出目标 20% 以内
  - 常见过敏原

- **🟢 低风险/提示**：可优化的点
  - 后调持续时间偏短
  - 整体留香偏短
  - 单位使用不统一

## 🛠️ 项目结构

```
zy1063/
├── candle_sim.py              # CLI 入口文件
├── candle_simulator/          # 核心模块
│   ├── __init__.py           # 版本和导出
│   ├── models.py             # 数据模型定义
│   ├── validators.py         # 数据验证器
│   ├── parsers.py            # JSON/CSV 文件解析
│   ├── calculator.py         # 成本和负载计算
│   ├── volatilization.py     # 挥发模拟计算
│   ├── risk_detector.py      # 风险检测逻辑
│   └── reporter.py           # 报告生成器
├── examples/                  # 示例数据
│   ├── ingredients.json      # 原料库示例
│   ├── recipe_1_lavender.json  # 配方1：薰衣草
│   ├── recipe_2_rose.json       # 配方2：玫瑰
│   └── recipe_3_mint.json       # 配方3：薄荷（含风险）
└── README.md                 # 本文件
```

## 🧪 示例配方说明

项目提供了 3 个示例配方用于测试：

### 配方 1：薰衣草助眠蜡烛

- **特点**：配方均衡，前中后调完整
- **香调组合**：柠檬(前调) + 薰衣草(中调) + 香草(后调)
- **预期效果**：留香时间长，风险低

### 配方 2：玫瑰花园蜡烛

- **特点**：高端配方，使用蜂蜡和 Vybar
- **香调组合**：橙花(前调) + 玫瑰+茉莉(中调) + [缺少明显后调]
- **预期效果**：成本较高，后调偏短

### 配方 3：清凉薄荷蜡烛

- **特点**：展示风险检测的"问题配方"
- **香调组合**：薄荷+柠檬(都是前调) + [无中调后调]
- **预期效果**：会检测出香调断层、留香短等风险

## ❌ 常见错误处理

工具会对以下异常输入提供友好的错误提示：

| 错误类型 | 示例 |
|----------|------|
| 缺少必填字段 | 原料缺少 `name` 或 `unit_price` |
| 单位不认识 | 使用了 `xyz` 这样的无效单位 |
| 数值无效 | 半衰期为负数、单价为负数 |
| 原料不存在 | 配方中引用了原料库中没有的原料 |
| 百分比异常 | 最大添加比例超过 100% |
| 文件格式错误 | JSON 语法错误、CSV 缺少必要列 |

## 📝 自定义建议

### 添加自己的原料

1. 复制 `examples/ingredients.json` 格式
2. 为每种香精指定：
   - `note_type`: 前调/中调/后调
   - `half_life`: 根据实际挥发特性估算
   - `max_ratio`: 供应商建议的最大添加比例
   - `flash_point`: 安全信息
   - `allergen_tags`: MSDS 中的过敏原信息

### 调香建议

一个均衡的配方通常包含：

```
前调：15-25% （快速释放，第一印象）
中调：40-60% （核心香味，持续最久）
后调：20-35% （持久留香，基底）
```

### 安全建议

- 香精负载比例建议控制在 6-8%
- 闪点低于 60°C 的香精需要特别注意加热温度
- 建议保留原料的 MSDS 文档

## 📄 许可证

MIT License - 可自由使用和修改。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受你的香薰蜡烛制作之旅！** 🕯️✨
