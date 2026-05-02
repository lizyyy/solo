# 🌱 补光灯方案模拟器 (Grow Light Simulator)

**房间补光灯摆放和用电模拟器** - 为育苗、养香草或多肉的人设计，帮助你在买灯、挪架子、安排开灯时间之前，先粗略知道哪个方案比较靠谱。

## ✨ 功能特性

- **光照覆盖计算**：基于光束角和距离衰减模型，计算每个植物点位的估算照度
- **费用预算**：计算每日耗电和电费，检查是否超出预算
- **风险评估**：检测暗区、灯具重叠浪费、温升风险、时段冲突、预算超限
- **方案评分**：按「覆盖率、费用效率、温升风险、排程」给方案打分（S/A+/A/A-/B+/B/B-/C+/C/C-/D/F）
- **报告导出**：支持 HTML 和 Markdown 格式的可视化报告
- **多方案对比**：同时评估多个方案，找出最优解

## 📦 安装

```bash
# 克隆或下载项目后
npm install
```

## 🚀 快速开始

### 1. 校验场景文件

```bash
# 校验场景 JSON 文件是否正确
npm run dev -- validate examples/scenario-good.json
```

### 2. 评估单个方案

```bash
# 评估方案并在终端显示结果
npm run dev -- evaluate examples/scenario-good.json

# 评估并导出报告到指定目录
npm run dev -- evaluate examples/scenario-good.json -o ./reports -f both
```

### 3. 对比多个方案

```bash
# 对比多个方案
npm run dev -- compare examples/scenario-good.json examples/scenario-medium.json examples/scenario-problematic.json

# 对比并导出对比报告
npm run dev -- compare examples/*.json -o ./reports
```

### 4. 导出报告

```bash
# 导出单个方案的报告（默认同时导出 HTML 和 Markdown）
npm run dev -- export examples/scenario-good.json ./reports

# 仅导出 HTML
npm run dev -- export examples/scenario-good.json ./reports -f html

# 仅导出 Markdown
npm run dev -- export examples/scenario-good.json ./reports -f md
```

### 5. JSON 输出

所有命令都支持 `-j/--json` 参数输出 JSON 格式结果：

```bash
npm run dev -- evaluate examples/scenario-good.json -j
```

## 📝 场景 JSON 格式说明

### 完整示例

```json
{
  "id": "my-scenario-001",
  "name": "我的多肉方案",
  "description": "阳台种植区方案",
  
  "room": {
    "width": 3.0,
    "depth": 2.0,
    "height": 2.4,
    "name": "阳台种植区"
  },

  "plantTrays": [
    {
      "id": "tray-1",
      "name": "多肉托盘",
      "position": {
        "x": 0.3,
        "y": 0.3,
        "width": 1.2,
        "depth": 0.8
      },
      "height": 0.8,
      "minLuxRequired": 8000,
      "plantType": "多肉植物"
    }
  ],

  "lightModels": [
    {
      "id": "model-led-s",
      "name": "全光谱 LED 补光灯",
      "power": 50,
      "beamAngle": 120,
      "baseLux": 15000,
      "heatLevel": "low",
      "description": "低发热 LED 灯"
    }
  ],

  "fixtures": [
    {
      "id": "light-1",
      "name": "主灯",
      "modelId": "model-led-s",
      "position": {
        "x": 0.9,
        "y": 0.7,
        "z": 2.0
      },
      "timeSlots": [
        { "startHour": 8, "endHour": 18 }
      ]
    }
  ],

  "electricity": {
    "pricePerKwh": 0.6,
    "dailyBudget": 1.5
  }
}
```

### 字段说明

#### 房间 (room)
| 字段 | 类型 | 说明 | 单位 |
|------|------|------|------|
| width | number | 房间宽度 | 米 (m) |
| depth | number | 房间深度 | 米 (m) |
| height | number | 房间高度 | 米 (m) |
| name | string | 房间名称（可选） | - |

#### 植物托盘 (plantTrays)
| 字段 | 类型 | 说明 | 单位 |
|------|------|------|------|
| id | string | 唯一标识 | - |
| name | string | 托盘名称（可选） | - |
| position.x | number | 托盘左上角 X 坐标 | 米 (m) |
| position.y | number | 托盘左上角 Y 坐标 | 米 (m) |
| position.width | number | 托盘宽度 | 米 (m) |
| position.depth | number | 托盘深度 | 米 (m) |
| height | number | 托盘安装高度 | 米 (m) |
| minLuxRequired | number | 最低光照需求 | 勒克斯 (lux) |
| plantType | string | 植物类型（可选） | - |

#### 灯具型号 (lightModels)
| 字段 | 类型 | 说明 | 单位 |
|------|------|------|------|
| id | string | 唯一标识 | - |
| name | string | 型号名称 | - |
| power | number | 额定功率 | 瓦 (W) |
| beamAngle | number | 光束角（半功率角） | 度 (°) |
| baseLux | number | 参考距离下的基准照度 | 勒克斯 (lux) |
| heatLevel | string | 发热等级：`low` / `medium` / `high` | - |

#### 灯具实例 (fixtures)
| 字段 | 类型 | 说明 | 单位 |
|------|------|------|------|
| id | string | 唯一标识 | - |
| name | string | 灯具名称（可选） | - |
| modelId | string | 引用的灯具型号 ID | - |
| position.x | number | 灯具 X 坐标 | 米 (m) |
| position.y | number | 灯具 Y 坐标 | 米 (m) |
| position.z | number | 灯具安装高度 | 米 (m) |
| timeSlots | array | 每日开灯时段，支持多个时段 | - |

#### 电费配置 (electricity)
| 字段 | 类型 | 说明 | 单位 |
|------|------|------|------|
| pricePerKwh | number | 每度电价格 | 元/kWh |
| dailyBudget | number | 每日电费预算上限 | 元/天 |

## 🌿 常见植物光照需求参考

| 植物类型 | 最低光照需求 (lux) | 说明 |
|----------|---------------------|------|
| 多肉植物 | 8,000 - 15,000 | 需要充足光照 |
| 香草（罗勒/薄荷） | 6,000 - 10,000 | 中等光照需求 |
| 迷迭香/百里香 | 8,000 - 12,000 | 需要较多光照 |
| 室内观叶植物 | 2,000 - 4,000 | 较低光照需求 |
| 育苗（发芽后） | 10,000 - 20,000 | 需要高照度 |
| 草莓/结果类 | 12,000 - 20,000 | 需要充足光照 |

## 📊 评分维度说明

总分 100 分，分为四个维度：

| 维度 | 权重 | 说明 |
|------|------|------|
| 覆盖率 | 40% | 光照覆盖比例，暗区会扣分 |
| 费用效率 | 25% | 预算内得分高，超出预算扣分 |
| 温升风险 | 20% | 低发热灯具得分高，高发热近距扣分 |
| 排程 | 15% | 时段规划合理得分高，重叠扣分 |

## 📁 项目结构

```
zy1022/
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI 入口
│   ├── models/
│   │   └── types.ts          # TypeScript 类型定义
│   └── services/
│       ├── parser.ts         # JSON 解析
│       ├── validator.ts      # 场景校验
│       ├── illuminance-calculator.ts  # 照度计算
│       ├── cost-calculator.ts         # 费用计算
│       ├── risk-assessor.ts           # 风险评估
│       ├── scorer.ts                   # 方案评分
│       ├── evaluator.ts                # 评估整合
│       └── reporter.ts                 # 报告生成
├── examples/
│   ├── scenario-good.json      # 优秀方案示例
│   ├── scenario-medium.json    # 中等方案示例
│   └── scenario-problematic.json  # 问题方案示例
├── reports/                    # 导出的报告目录
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 使用示例场景

项目附带了 3 个示例场景，位于 `examples/` 目录：

1. **scenario-good.json** - 优秀方案：全覆盖、预算内、低风险，评分 S 级
2. **scenario-medium.json** - 中等方案：覆盖率较好但电费偏高，评分 B+ 级  
3. **scenario-problematic.json** - 问题方案：存在暗区、重叠浪费、预算超限等多种问题

运行以下命令快速体验：

```bash
# 查看问题方案能检测到哪些问题
npm run dev -- evaluate examples/scenario-problematic.json

# 对比三个方案
npm run dev -- compare examples/*.json -o ./reports
```

## ⚠️ 检测的风险类型

| 风险类型 | 说明 |
|----------|------|
| 暗区警告 | 存在光照不足的区域，特别提示"灯具重叠但仍有暗区"的情况 |
| 重叠浪费 | 灯具照射范围和时段都重叠，可能造成电力浪费 |
| 温升风险 | 高发热灯具安装过低、多灯同时开启等 |
| 时段冲突 | 同一灯具的时段配置有重叠 |
| 预算超额 | 每日电费超出设定的预算上限 |

## 🤝 常见问题

**Q: baseLux 怎么填？**

A: baseLux 是灯具厂商在参考距离（通常 1 米）下给出的中心照度值。如果找不到精确数据，可以估算：
- 50W LED: ~10,000-20,000 lux @1m
- 100W LED: ~20,000-40,000 lux @1m
- 400W HPS: ~50,000-80,000 lux @1m

**Q: 采样密度是多少？**

A: 默认采样密度为 0.1 米（10 厘米），这在速度和精度之间取得了平衡。

**Q: 为什么两个灯都亮着但还提示有暗区？**

A: 这正是本工具要检测的典型问题——灯具安装位置或光束角设计不合理，导致虽然多个灯都在照射，但某些区域仍然光照不足。

## 📄 许可证

MIT License

---

**提示**: 本工具提供估算值，实际效果还需根据灯具实测数据和植物生长情况调整。
