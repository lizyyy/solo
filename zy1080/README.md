# 🌱 阳台种菜浇水预演工具 (Garden Watering Simulator)

一个本地科学计算 CLI 工具，帮助阳台种菜的人预演浇水计划，避免凭感觉浇水导致的缺水、积水、烂根或徒长问题。

## ✨ 功能特性

- **科学模拟**：基于 Penman-Monteith 公式计算蒸散量，真实模拟土壤含水量变化
- **风险评估**：识别缺水、积水、烂根、徒长、肥害等风险
- **多格式输出**：支持终端摘要、Markdown、HTML、JSON 多种报告格式
- **方案对比**：对比多套浇水方案，找出最稳定的计划
- **全面验证**：完善的输入数据验证，准确指出哪一行哪一项有问题

## 📦 安装

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

```bash
# 克隆项目
cd zy1080

# 安装依赖
npm install

# 构建项目
npm run build
```

## 🚀 快速开始

使用示例数据快速体验：

```bash
# 进入示例数据目录
cd data

# 验证数据
npx ts-node ../src/cli/index.ts validate -d .

# 运行模拟
npx ts-node ../src/cli/index.ts simulate -d .

# 对比两个浇水计划
npx ts-node ../src/cli/index.ts compare -d .

# 导出报告
npx ts-node ../src/cli/index.ts export -d . -o ../output
```

## 📝 命令说明

### 1. validate - 验证输入数据

验证所有输入文件的格式、类型和逻辑关系。

```bash
garden-sim validate [options]
```

**选项**：
- `-p, --plants <path>`：植物数据文件路径 (默认: `plants.csv`)
- `-o, --pots <path>`：花盆数据文件路径 (默认: `pots.json`)
- `-w, --weather <path>`：天气数据文件路径 (默认: `weather.csv`)
- `-r, --watering-plan <path>`：浇水计划文件路径 (默认: `watering-plan.json`)
- `-d, --workdir <path>`：工作目录 (默认: 当前目录)

**示例**：
```bash
garden-sim validate -p my-plants.csv -w my-weather.csv
```

### 2. simulate - 运行浇水计划模拟

运行完整的模拟流程，包括数据验证、模拟计算、风险评估和报告输出。

```bash
garden-sim simulate [options]
```

**选项**：
- `-p, --plants <path>`：植物数据文件路径
- `-o, --pots <path>`：花盆数据文件路径
- `-w, --weather <path>`：天气数据文件路径
- `-r, --watering-plan <path>`：浇水计划文件路径
- `-d, --workdir <path>`：工作目录
- `-s, --start <date>`：模拟开始日期 (YYYY-MM-DD)
- `-e, --end <date>`：模拟结束日期 (YYYY-MM-DD)
- `--no-validate`：跳过数据验证

**示例**：
```bash
# 模拟指定日期范围
garden-sim simulate -s 2024-06-01 -e 2024-06-14

# 使用自定义工作目录
garden-sim simulate -d ./my-garden
```

### 3. compare - 对比多个浇水计划

对比多套浇水方案，给出稳定性排名和风险分析。

```bash
garden-sim compare [options]
```

**选项**：
- `-p, --plants <path>`：植物数据文件路径
- `-o, --pots <path>`：花盆数据文件路径
- `-w, --weather <path>`：天气数据文件路径
- `--plans <paths...>`：浇水计划文件路径列表
- `-d, --workdir <path>`：工作目录
- `-s, --start <date>`：模拟开始日期
- `-e, --end <date>`：模拟结束日期

**示例**：
```bash
# 对比多个浇水计划
garden-sim compare --plans plan1.json plan2.json plan3.json

# 使用默认对比计划
garden-sim compare
```

### 4. export - 导出模拟结果

将模拟结果导出为多种格式的报告。

```bash
garden-sim export [options]
```

**选项**：
- `-p, --plants <path>`：植物数据文件路径
- `-o, --pots <path>`：花盆数据文件路径
- `-w, --weather <path>`：天气数据文件路径
- `-r, --watering-plan <path>`：浇水计划文件路径
- `-d, --workdir <path>`：工作目录
- `-s, --start <date>`：模拟开始日期
- `-e, --end <date>`：模拟结束日期
- `-f, --format <format>`：导出格式 (可选: `all`, `terminal`, `markdown`, `html`, `json`) (默认: `all`)
- `-o, --output <path>`：输出目录 (默认: `./output`)

**示例**：
```bash
# 导出所有格式
garden-sim export -f all -o ./reports

# 只导出 JSON 格式
garden-sim export -f json -o ./data

# 导出 HTML 可视化报告
garden-sim export -f html -o ./public
```

## 📁 输入文件格式

### 1. plants.csv - 植物数据

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | string | 植物唯一ID | P001 |
| name | string | 植物名称 | 番茄 |
| variety | string | 品种 | 樱桃番茄 |
| growthStage | string | 生长期 | vegetative |
| minMoisture | number | 最小含水量 (%) | 40 |
| maxMoisture | number | 最大含水量 (%) | 80 |
| optimalMoisture | number | 最佳含水量 (%) | 60 |
| waterNeedCoefficient | number | 需水系数 (0.1-2.0) | 1.1 |
| lightNeed | number | 光照需求 (0-10) | 8 |

**生长期有效值**：
- `seedling` - 幼苗期
- `vegetative` - 营养生长期
- `flowering` - 开花期
- `fruiting` - 结果期
- `mature` - 成熟期

### 2. pots.json - 花盆数据

```json
{
  "pots": [
    {
      "id": "PO001",
      "name": "大陶盆1号",
      "plantId": "P001",
      "volume": 15.0,
      "drainHoles": 4,
      "drainageRate": 15.0,
      "surfaceArea": 314.16,
      "soilType": "园土+泥炭+珍珠岩",
      "soilWaterRetention": 0.65,
      "soilFieldCapacity": 85.0,
      "soilPermanentWiltingPoint": 15.0
    }
  ]
}
```

**字段说明**：
- `volume`: 花盆体积 (升)
- `drainHoles`: 排水孔数量
- `drainageRate`: 排水速率 (mm/小时)
- `surfaceArea`: 表面积 (cm²)
- `soilType`: 土壤类型描述
- `soilWaterRetention`: 土壤保水率 (0-1)
- `soilFieldCapacity`: 田间持水量 (%)
- `soilPermanentWiltingPoint`: 永久萎蔫点 (%)

### 3. weather.csv - 天气数据

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| date | string | 日期 (YYYY-MM-DD) | 2024-06-01 |
| temperature | number | 平均气温 (°C) | 25 |
| humidity | number | 相对湿度 (%) | 65 |
| solarRadiation | number | 太阳辐射 (MJ/m²/天) | 20.5 |
| windSpeed | number | 风速 (m/s) | 2.5 |
| precipitation | number | 降水量 (mm) | 0 |

### 4. watering-plan.json - 浇水计划

```json
{
  "planId": "PLAN001",
  "planName": "标准浇水计划",
  "description": "根据天气情况制定的标准浇水计划",
  "wateringEvents": [
    {
      "date": "2024-06-02",
      "time": "morning",
      "amount": 25,
      "fertilizerAmount": 0,
      "fertilizerType": ""
    }
  ]
}
```

**字段说明**：
- `time`: 浇水时间 (可选: `morning`, `afternoon`, `evening`)
- `amount`: 浇水量 (mm)
- `fertilizerAmount`: 施肥量 (任意单位)
- `fertilizerType`: 肥料类型

## 🧪 示例数据

项目包含完整的示例数据，位于 `data/` 目录：

- `plants.csv` - 3种植物（番茄、生菜、薄荷）
- `pots.json` - 3个花盆配置
- `weather.csv` - 14天天气数据（包含晴天、雨天、高温等场景）
- `watering-plan.json` - 标准浇水计划（2天浇一次）
- `watering-plan-alternative.json` - 省事浇水计划（每周只浇两次大水）

## 📊 风险类型说明

工具会评估以下5类风险：

| 风险类型 | 英文标识 | 说明 |
|----------|----------|------|
| 缺水 | drought | 土壤含水量低于植物需求下限 |
| 积水 | waterlogging | 土壤含水量超过植物需求上限 |
| 烂根 | rootRot | 连续积水导致根系缺氧腐烂 |
| 徒长 | etiolation | 含水量过高或光照不足导致植物徒长 |
| 肥害 | fertilizerBurn | 施肥过量导致烧根 |

**风险等级**：
- 🟢 `low` - 低风险
- 🟡 `medium` - 中风险
- 🟠 `high` - 高风险
- 🔴 `critical` - 严重风险

## 🏗️ 项目结构

```
zy1080/
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI 入口
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   ├── utils/
│   │   ├── index.ts          # 工具模块导出
│   │   ├── unitConverter.ts  # 单位转换
│   │   ├── dateUtils.ts      # 日期处理
│   │   └── mathUtils.ts      # 数学计算
│   ├── input/
│   │   ├── index.ts          # 输入模块导出
│   │   └── inputParser.ts    # 输入文件解析
│   ├── validation/
│   │   ├── index.ts          # 验证模块导出
│   │   └── dataValidator.ts  # 数据验证
│   ├── simulation/
│   │   ├── index.ts          # 模拟模块导出
│   │   └── simulator.ts      # 核心模拟引擎
│   ├── risk/
│   │   ├── index.ts          # 风险模块导出
│   │   └── riskAssessor.ts   # 风险评估
│   └── report/
│       ├── index.ts          # 报告模块导出
│       └── reportGenerator.ts # 报告生成
├── data/                      # 示例数据
│   ├── plants.csv
│   ├── pots.json
│   ├── weather.csv
│   ├── watering-plan.json
│   └── watering-plan-alternative.json
├── package.json
├── tsconfig.json
└── README.md
```

## 🔬 核心算法

### 蒸散量计算

使用 Penman-Monteith 公式计算参考作物蒸散量 (ET₀)：

```
ET₀ = (0.408Δ(Rₙ - G) + γ(900/(T+273))u₂(eₛ - eₐ)) / (Δ + γ(1 + 0.34u₂))
```

其中：
- Δ: 饱和水汽压曲线斜率
- Rₙ: 净辐射
- G: 土壤热通量
- γ: 湿度常数
- T: 平均气温
- u₂: 2米高度风速
- eₛ: 饱和水汽压
- eₐ: 实际水汽压

### 土壤水平衡

```
Δ土壤含水量 = 降水 + 浇水 - 蒸散 - 排水
```

**约束条件**：
- 最小含水量 = 永久萎蔫点
- 最大含水量 = 田间持水量
- 超过田间持水量的部分通过排水孔排出

## 📝 使用建议

1. **先验证再模拟**：运行 `simulate` 命令前，先用 `validate` 命令检查数据
2. **使用真实天气数据**：天气数据对模拟结果影响很大，建议使用实际天气预报
3. **多方案对比**：使用 `compare` 命令对比不同浇水计划，选择风险最低的
4. **导出详细报告**：使用 `export` 命令导出 JSON/HTML 报告，便于深入分析

## 🐛 错误处理

工具提供详细的错误信息，包括：

- **字段缺失**：明确指出哪个文件的哪一行缺少哪个字段
- **类型错误**：指出期望的类型和实际值
- **范围错误**：指出有效值范围
- **日期不连续**：列出缺失的日期
- **引用无效**：指出哪个引用ID不存在

示例错误信息：
```
[错误] plants.csv 第 3 行: 最小含水量 150% 超出范围 (0-100)
[错误] pots.json 花盆 "大陶盆1号": 引用的植物ID "P999" 在 plants.csv 中不存在
[错误] weather.csv 日期不连续，缺失: 2024-06-08, 2024-06-09
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Happy Gardening! 🌱💧**
