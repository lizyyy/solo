# Hydroponic CLI - 水培营养液调配工具

一个本地命令行小工具，帮助阳台水培爱好者在换液前精确计算营养液调配方案。告别手算，避免 EC、ppm、升和毫升搞混。

## 功能特性

- **数据校验 (validate)**: 检查缺字段、无效单位、读数超范围等问题
- **模拟计算 (simulate)**: 根据目标 EC/pH、当前状态生成补水、加液、换液方案
- **策略比较 (compare)**: 对比"省营养液"和"稳 EC"两套策略的成本和风险
- **报告导出 (export)**: 导出 Markdown、HTML、JSON 格式的详细报告

## 项目结构

```
hydroponic_cli/
├── __init__.py      # 包初始化
├── cli.py           # CLI 入口和命令定义
├── models.py        # 数据模型定义
├── units.py         # 单位换算 (EC/ppm/体积)
├── parser.py        # 数据文件解析器
├── validator.py     # 数据校验器
├── simulator.py     # 模拟计算引擎
├── strategy.py      # 策略比较器
└── exporter.py      # 报告导出器

data/examples/
├── valid/           # 正常示例数据
│   ├── reservoirs.json   # 储液桶配置
│   ├── crops.csv         # 作物目标参数
│   ├── recipes.json      # 营养液配方
│   ├── readings.csv      # 历史读数
│   └── inventory.json    # 营养液库存
└── invalid/         # 有问题的示例数据（用于测试 validate）
    ├── reservoirs.json
    ├── crops.csv
    ├── recipes.json
    ├── readings.csv
    └── inventory.json

requirements.txt     # 依赖列表
setup.py             # 安装配置
```

## 安装

### 方式一：本地开发安装

```bash
cd /path/to/project
pip install -e .
```

### 方式二：直接运行

```bash
cd /path/to/project
pip install -r requirements.txt
python -m hydroponic_cli.cli --help
```

安装完成后，可以使用 `hydroponic` 命令：

```bash
hydroponic --help
```

## 示例数据说明

### 正常示例数据 (`data/examples/valid/`)

包含 3 个水培桶的完整配置：

| 储液桶 | 容量 | 种植作物 | 最新 EC | 最新 pH |
|--------|------|----------|---------|---------|
| bucket-01 | 20L | 生菜 | 1.6 mS/cm | 6.2 |
| bucket-02 | 15L | 薄荷 | 1.2 mS/cm | 6.0 |
| bucket-03 | 25L | 番茄 | 2.8 mS/cm | 6.5 |

**作物目标参数：**
- 生菜：EC 1.0-2.0 mS/cm，pH 5.5-6.5
- 薄荷：EC 0.8-1.5 mS/cm，pH 5.5-6.5  
- 番茄：EC 1.2-3.5 mS/cm（结果期更高），pH 5.5-6.5

**库存状态：**
- 通用配方 A/B 液：充足 (500/480 mL)
- 叶菜配方 A/B 液：充足 (250/230 mL)
- 果菜配方 A/B 液：**低于阈值** (80/75 mL，阈值 100 mL)
- 香草配方 A/B 液：充足 (350/340 mL)

### 有问题的示例数据 (`data/examples/invalid/`)

包含各种故意制造的错误，用于测试 `validate` 命令：

- **reservoirs.json**: 负容量、无效单位、空 ID、重复 ID
- **crops.csv**: EC 最小值 > 最大值、pH 范围反向、无效单位、值超范围
- **recipes.json**: 负浓度、零混合比例、缺少必需字段
- **readings.csv**: 无效时间戳、不存在的桶 ID、重复读数
- **inventory.json**: 过期库存、负体积、无效单位、引用不存在配方

## 命令使用说明

### 1. validate - 数据校验

校验数据文件的完整性和有效性。

**命令格式：**
```bash
hydroponic validate [OPTIONS]

选项:
  -r, --reservoirs PATH   reservoirs.json 路径
  -c, --crops PATH        crops.csv 路径
  -p, --recipes PATH      recipes.json 路径
  -d, --readings PATH     readings.csv 路径
  -i, --inventory PATH    inventory.json 路径
  -D, --data-dir PATH     数据目录（自动查找各数据文件）
  -h, --help              显示帮助
```

**使用正常数据 - 预期输出：**
```bash
hydroponic validate -D data/examples/valid
```

输出示例：
```
============================================================
水培营养液调配工具 - 数据校验
============================================================

📊 数据统计:
  储液桶数量: 3
  作物种类: 3
  配方数量: 4
  读数记录: 8
  库存项数: 8

⚠️ 发现 3 个警告:
  1. [ec_trend]: 储液桶 '阳台水培桶 3 号' 的 EC 上升速度较快 (0.10 mS/cm/天)，建议增加检测频率 [readings.csv]
  2. [current_volume]: 库存项 'inv-005' (配方 recipe-fruiting A) 已接近或低于最低库存阈值 [inventory.json]
  3. [current_volume]: 库存项 'inv-006' (配方 recipe-fruiting B) 已接近或低于最低库存阈值 [inventory.json]

ℹ️ 其他信息:
  - 配方 '通用水培营养液' 有混配禁忌说明: A液和B液请分开添加...

✅ 数据校验通过！
```

**使用有问题数据 - 预期输出：**
```bash
hydroponic validate -D data/examples/invalid
```

输出示例：
```
============================================================
水培营养液调配工具 - 数据校验
============================================================

📊 数据统计:
  储液桶数量: 3
  作物种类: 5
  配方数量: 2
  读数记录: 5
  库存项数: 3

❌ 发现 8 个错误:
  1. [name]: 储液桶 '' 名称不能为空 [reservoirs.json]
  2. [max_capacity]: 储液桶 'bucket-01' 容量必须大于 0 [reservoirs.json]
  3. [capacity_unit]: 储液桶 'bucket-01' 容量单位 'INVALID_UNIT' 无效... [reservoirs.json]
  4. [ec_max]: 作物 '番茄' 阶段 'vegetative' 的 EC 最大值 (2.0) 小于最小值 (3.0) [crops.csv]
  5. [ph_max]: 作物 '番茄' 阶段 'vegetative' 的 pH 最大值 (5.0) 小于最小值 (7.0) [crops.csv]
  6. [ph_min]: 作物 '薄荷' 阶段 'invalid_stage': pH 值 -1.0 超出有效范围 (0.0-14.0) [crops.csv]
  7. [expiration_date]: 库存项 'inv-bad-001' 已过期 1280 天 [inventory.json]
  8. [current_volume]: 库存项 'inv-bad-001' 的当前体积不能为负 [inventory.json]

⚠️ 发现 N 个警告:
  ...

❌ 数据校验失败，共 8 个错误
```

### 2. simulate - 模拟计算

根据当前状态和目标参数，生成未来几天的操作方案。

**命令格式：**
```bash
hydroponic simulate [OPTIONS]

必需选项:
  -R, --reservoir TEXT      储液桶 ID [必需]

其他选项:
  -n, --days INTEGER        模拟天数 (默认: 7)
  -c, --crop TEXT           作物 ID
  -s, --stage TEXT          作物阶段 (seedling/vegetative/flowering/fruiting)
  -p, --recipe TEXT         配方 ID
  -S, --strategy [stable|save]  策略: stable (稳 EC) 或 save (省营养液)
  -D, --data-dir PATH       数据目录
  -d, --detail              显示详细每日操作
  -h, --help                显示帮助
```

**模拟生菜桶（稳 EC 策略）- 预期输出：**
```bash
hydroponic simulate -R bucket-01 -n 7 -c lettuce -s vegetative -S stable -D data/examples/valid -d
```

输出示例：
```
============================================================
水培营养液调配工具 - 模拟计算
============================================================

📊 数据统计:
  储液桶数量: 3
  ...

✅ 数据校验通过！

📋 模拟参数:
  储液桶: bucket-01
  模拟天数: 7
  策略: 稳 EC 策略
  作物: lettuce
  阶段: vegetative

📊 模拟摘要 (2026-05-04 - 2026-05-10):

  资源消耗:
    补水总量: X.XX L
    A 液总量: XX.X mL
    B 液总量: XX.X mL
    酸液总量: X.X mL
    碱液总量: X.X mL
    排液总量: X.XX L

  状态变化:
    平均 EC: X.XXX mS/cm
    平均 pH: X.XX
    最终 EC: X.XXX mS/cm
    最终 pH: X.XX
    最终体积: XX.XX L

  风险指标:
    需要换液次数: X
    EC 超出范围天数: X
    pH 超出范围天数: X

📅 每日操作详情:
--------------------------------------------------------------------------------

第 1 天 (2026-05-04):
  操作: 补充水分至目标液位, 补充营养液
  补水: X.XX L | A液: XX.X mL | B液: XX.X mL
  预计 EC: X.XXX mS/cm | 预计 pH: X.XX
  说明:
    - 预计蒸发损失: X.XX L
    - 补水后 EC 预计从 X.XX 降至 X.XX mS/cm
    - 添加 A 液: XX.X mL, B 液: XX.X mL (目标 EC: X.XX mS/cm)
    - 混配禁忌: A液和B液请分开添加...
  警告:
    - 库存预警: 配方 XXX A液 使用后将低于最低阈值...

第 2 天 (2026-05-05):
  ...
```

**模拟番茄桶（省营养液策略）- 预期输出：**
```bash
hydroponic simulate -R bucket-03 -n 7 -c tomato -s fruiting -S save -D data/examples/valid
```

番茄当前 EC 2.8 mS/cm（目标 2.5-3.5），省营养液策略会尽量通过补水稀释而非排液。

### 3. compare - 策略比较

对比"稳 EC"和"省营养液"两种策略的成本和风险。

**命令格式：**
```bash
hydroponic compare [OPTIONS]

必需选项:
  -R, --reservoir TEXT      储液桶 ID [必需]

其他选项:
  -n, --days INTEGER        模拟天数 (默认: 7)
  -c, --crop TEXT           作物 ID
  -s, --stage TEXT          作物阶段
  -p, --recipe TEXT         配方 ID
  -D, --data-dir PATH       数据目录
  -h, --help                显示帮助
```

**比较生菜桶两种策略 - 预期输出：**
```bash
hydroponic compare -R bucket-01 -n 7 -c lettuce -s vegetative -D data/examples/valid
```

输出示例：
```
============================================================
水培营养液调配工具 - 策略比较
============================================================

📋 比较参数:
  储液桶: bucket-01
  模拟天数: 7

📊 策略对比:
------------------------------------------------------------
指标            | 稳 EC 策略       | 省营养液策略
------------------------------------------------------------
补水总量        |         X.XX L |         X.XX L
营养液总量      |        XXX.X mL |        XXX.X mL
酸/碱总量       |         XX.X mL |         XX.X mL
换液次数        |             X |             X
估算成本        |         ¥X.XX |         ¥X.XX
风险评分        |        X.X/10 |        X.X/10
------------------------------------------------------------

📌 稳 EC 策略:
  描述: 优先保持 EC 稳定，必要时排液换液

  优势:
    ✅ EC 稳定性更好，作物生长环境更一致
    ✅ 减少盐类积累风险
    ✅ pH 调整需求可能更少

  风险:
    ⚠️ 营养液消耗较多（约 XXX mL）
    ⚠️ 存在库存不足风险

📌 省营养液策略:
  描述: 优先保留营养液，通过补水稀释高 EC

  优势:
    ✅ 营养液消耗更少，更经济
    ✅ 排液量少，更环保

  风险:
    ⚠️ 有 X 天 EC 可能超出目标范围
    ⚠️ 省营养液策略可能导致 EC 长期偏高

💡 建议: 两种策略各有优劣，请根据实际情况选择
```

**策略说明：**

| 策略 | 原理 | 适用场景 |
|------|------|----------|
| 稳 EC | EC 过高时排液稀释，再补水加液 | 对 EC 敏感的作物、苗期 |
| 省营养液 | EC 过高时只补水稀释，不排液 | 成熟作物、想节省成本 |

### 4. export - 导出报告

生成 Markdown、HTML、JSON 格式的详细报告。

**命令格式：**
```bash
hydroponic export [OPTIONS]

必需选项:
  -o, --output PATH         输出文件路径 [必需]

其他选项:
  -f, --format [markdown|html|json]  输出格式 (默认: markdown)
  -R, --reservoir TEXT      储液桶 ID（用于模拟和比较）
  -n, --days INTEGER        模拟天数 (默认: 7)
  -c, --crop TEXT           作物 ID
  -s, --stage TEXT          作物阶段
  -p, --recipe TEXT         配方 ID
  -C, --compare             包含策略比较
  -D, --data-dir PATH       数据目录
  -t, --title TEXT          报告标题
  -h, --help                显示帮助
```

**导出 Markdown 报告 - 预期输出：**
```bash
hydroponic export -o report.md -f markdown -R bucket-01 -n 7 -c lettuce -s vegetative -C -D data/examples/valid -t "5月第一周水培管理报告"
```

生成的 `report.md` 包含：

1. **数据校验结果** - 错误/警告/信息
2. **模拟结果** - 储液桶信息、模拟周期
   - 资源消耗摘要表格
   - 操作统计表格
   - 每日操作详情表格
   - 每日操作备注（计算过程、风险原因）
3. **策略比较** - 对比概览表格
   - 每种策略的优势和风险
   - 建议
4. **注意事项** - pH 调整、EC 单位换算、库存检查、混配禁忌等

**导出 HTML 报告：**
```bash
hydroponic export -o report.html -f html -R bucket-01 -n 7 -c lettuce -s vegetative -C -D data/examples/valid
```

HTML 报告带有 CSS 样式，可以在浏览器中打开查看。

**导出 JSON 报告：**
```bash
hydroponic export -o report.json -f json -R bucket-01 -n 7 -c lettuce -s vegetative -C -D data/examples/valid
```

JSON 格式便于程序进一步处理。

## 核心模块说明

### 1. units.py - 单位换算

支持的 EC 单位：
- mS/cm (毫西门子/厘米) - 标准单位
- dS/m (分西门子/米) - 等同于 mS/cm
- μS/cm (微西门子/厘米) - 1 mS/cm = 1000 μS/cm
- ppm (百万分比) - 近似换算: 1 mS/cm = 500 ppm

支持的体积单位：
- L (升)
- mL (毫升)
- m³ (立方米)
- gal (加仑)
- qt (夸脱)

### 2. validator.py - 数据校验

校验项包括：
- 必填字段检查
- 单位有效性验证
- 数值范围检查 (EC 0-20 mS/cm, pH 0-14)
- 逻辑一致性检查 (EC min <= EC max, pH min <= pH max)
- 跨引用检查 (读数引用的桶是否存在)
- 库存检查 (是否过期、是否低于阈值)

### 3. simulator.py - 模拟计算

模拟流程：
1. 获取初始状态（从最新读数推断）
2. 每日迭代：
   - 计算蒸发损失
   - 检查 EC 是否在目标范围
   - EC 过低：计算需要补充的 A/B 液量
   - EC 过高：根据策略决定是排液还是补水稀释
   - 检查 pH，估算酸/碱调整量
   - 检查库存是否充足
3. 生成操作摘要

**关键公式：**

EC 稀释（补水）：
```
目标体积 = (当前 EC × 当前体积) / 目标 EC
补水量 = 目标体积 - 当前体积
```

营养液添加（按 1:1 比例）：
```
EC 增量 = 目标 EC - 当前 EC
每毫升 A+B 贡献 = A液EC贡献 + B液EC贡献
需要的 A/B 液量 = (EC 增量 × 当前体积) / (A液EC贡献 + B液EC贡献)
```

### 4. strategy.py - 策略比较

成本估算：
- 营养液：¥0.05/mL
- 水：¥0.002/L
- 酸/碱：¥0.02/mL

风险评分（0-10，越低越安全）：
- EC 超出范围天数占比 > 30%：+2 分
- pH 超出范围天数占比 > 30%：+1.5 分
- 每次换液：+1 分
- 省营养液策略：+1 分（潜在风险）
- 库存不足：+0.5 分

### 5. exporter.py - 报告导出

报告内容不仅是输入表格的转换，还包含：
- **关键计算过程**：补水后 EC 变化、营养液添加量计算依据
- **风险原因**：为什么需要换液、为什么库存预警
- **库存提醒**：哪些配方即将用完
- **混配禁忌**：配方的特殊混合要求

## 数据文件格式说明

### reservoirs.json - 储液桶配置

```json
[
  {
    "id": "bucket-01",
    "name": "阳台水培桶 1 号",
    "max_capacity": 20,
    "capacity_unit": "L",
    "description": "可选描述",
    "metadata": {
      "location": "阳台东侧",
      "system_type": "DFT"
    }
  }
]
```

### crops.csv - 作物目标参数

```csv
crop_id,name,common_name,stage,ec_min,ec_max,ec_unit,ph_min,ph_max,recommended_recipe,notes
lettuce,生菜,Leaf Lettuce,seedling,1.0,1.5,mS/cm,5.5,6.0,recipe-general,"幼苗期"
lettuce,生菜,Leaf Lettuce,vegetative,1.5,2.0,mS/cm,5.5,6.5,recipe-leafy,"生长期"
```

**stage 可选值：** seedling, vegetative, flowering, fruiting, mature

### recipes.json - 营养液配方

```json
[
  {
    "id": "recipe-general",
    "name": "通用水培营养液",
    "type": "general",
    "mixing_ratio": 1.0,
    "a_solution": {
      "name": "A液",
      "concentration_per_ml": 1.0,
      "ec_per_ml_per_liter": 0.12,
      "npk_ratio": "7-11-27",
      "key_elements": ["钙", "氮", "钾"]
    },
    "b_solution": {
      "name": "B液",
      "concentration_per_ml": 1.0,
      "ec_per_ml_per_liter": 0.10,
      "npk_ratio": "15-5-15",
      "key_elements": ["镁", "磷"]
    },
    "incompatibility_notes": "A液和B液请分开添加..."
  }
]
```

**type 可选值：** general, leafy_green, fruiting, herb

**关键参数：**
- `ec_per_ml_per_liter`: 每毫升该溶液加入 1 升水中增加的 EC 值
- `incompatibility_notes`: 混配禁忌，会在报告中提醒

### readings.csv - 历史读数

```csv
id,reservoir_id,timestamp,ec_value,ec_unit,ph_value,volume,volume_unit,temperature,notes,source
rd_001,bucket-01,2026-05-01 08:30:00,1.6,mS/cm,6.2,16,L,24.5,"状态良好",manual
```

**timestamp 支持格式：**
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DD HH:MM`
- `YYYY-MM-DD`
- `YYYY/MM/DD ...`

### inventory.json - 营养液库存

```json
[
  {
    "id": "inv-001",
    "recipe_id": "recipe-general",
    "solution_type": "A",
    "current_volume": 500,
    "volume_unit": "mL",
    "minimum_threshold": 100,
    "expiration_date": "2027-03-15",
    "batch_number": "BATCH-2026-001"
  }
]
```

**solution_type:** A 或 B

**校验触发：**
- `current_volume` < 0：错误
- `current_volume` <= `minimum_threshold`：警告
- `expiration_date` < 今天：错误
- `expiration_date` < 今天 + 30 天：警告

## 常见问题

**Q: EC 和 ppm 如何换算？**

A: 本工具使用近似换算：1 mS/cm = 500 ppm。不同配方实际换算系数可能略有差异，建议以 mS/cm 为标准单位。

**Q: pH 调整量为什么是估算值？**

A: 实际 pH 调整受营养液缓冲能力影响很大。工具给出的是粗略估算，实际操作中应少量多次添加，每次测试。

**Q: 为什么有些配方显示库存不足？**

A: 当模拟计算所需量超过库存时会提示。此外，库存低于 `minimum_threshold` 也会预警。

**Q: 稳 EC 和省营养液策略有什么区别？**

A: 当 EC 偏高时：
- 稳 EC：排出部分高浓度溶液，再补水加液调整到目标 EC
- 省营养液：只补水稀释，不排液（可能 EC 仍偏高）

## 版本历史

- 0.1.0: 初始版本，支持 validate、simulate、compare、export 命令

## 许可证

MIT License
