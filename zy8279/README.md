# Wave Rule Validator

仓库订单分拣波次规则优先级冲突校验 CLI 工具。

## 功能特性

- **配置校验**：校验规则、区域容量、订单数据的语法和逻辑正确性
- **规则模拟**：模拟一批订单的规则命中链路，追踪每条订单的匹配过程
- **冲突检测**：自动检测以下类型的冲突：
  - 同优先级多规则冲突
  - 区域容量边界冲突
  - 互斥标签冲突
  - 冷链标签冲突
  - 大件标签冲突
  - 默认兜底分配
- **报告导出**：生成详细的 Markdown 冲突报告和 CSV 冲突案例文件

## 安装

```bash
npm install
npm run build
```

安装依赖并编译 TypeScript 代码。

## 快速开始

### 使用内置样本数据

项目内置了样本数据，位于 `samples/` 目录，可以直接使用：

```bash
# 校验配置
npm run start -- validate --samples

# 模拟运行
npm run start -- simulate --samples

# 导出报告
npm run start -- export --samples
```

### 使用自定义数据

准备以下 4 个文件：

| 文件名 | 格式 | 说明 |
|--------|------|------|
| orders.csv | CSV | 订单数据 |
| sku_tags.csv | CSV | SKU 标签数据 |
| zone_capacity.yaml | YAML | 区域容量配置 |
| rules.json | JSON | 分拣规则配置 |

将这些文件放在当前目录，然后运行：

```bash
# 校验配置
npm run start -- validate

# 模拟运行
npm run start -- simulate

# 导出报告
npm run start -- export
```

或者指定文件路径：

```bash
npm run start -- validate \
  --orders ./data/my_orders.csv \
  --sku-tags ./data/my_tags.csv \
  --zone-capacity ./data/my_zones.yaml \
  --rules ./data/my_rules.json
```

## CLI 命令详解

### validate 命令

校验配置文件的语法和逻辑正确性。

**参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--orders <path>` | orders.csv | 订单 CSV 文件路径 |
| `--sku-tags <path>` | sku_tags.csv | SKU 标签 CSV 文件路径 |
| `--zone-capacity <path>` | zone_capacity.yaml | 区域容量 YAML 文件路径 |
| `--rules <path>` | rules.json | 规则 JSON 文件路径 |
| `--samples` | - | 使用内置样本数据 |
| `-v, --verbose` | - | 显示详细信息 |

**示例：**

```bash
npm run start -- validate --samples -v
```

**输出示例：**

```
🔍 波次规则配置校验

📂 正在加载配置文件...
   - 订单文件: /path/to/samples/orders.csv
   - SKU标签: /path/to/samples/sku_tags.csv
   - 区域容量: /path/to/samples/zone_capacity.yaml
   - 规则配置: /path/to/samples/rules.json

✅ 数据加载完成
   - 订单数: 20
   - SKU数: 17
   - 区域数: 6
   - 规则数: 8

📋 正在执行配置校验...

=== 校验结果 ===

状态: ✅ 通过
错误数: 0
警告数: 0
提示数: 2

ℹ️ 提示:
   • [rules] 优先级 1 存在 3 条规则: RULE_VIP_PRIORITY, RULE_ELECTRONICS_HOT, RULE_EXPRESS_SHIP
   • [rules] 优先级 2 存在 2 条规则: RULE_COLD_CHAIN, RULE_B2B_LARGE

✅ 配置校验通过！
```

### simulate 命令

模拟一批订单的命中链路，分析冲突。

**参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--orders <path>` | orders.csv | 订单 CSV 文件路径 |
| `--sku-tags <path>` | sku_tags.csv | SKU 标签 CSV 文件路径 |
| `--zone-capacity <path>` | zone_capacity.yaml | 区域容量 YAML 文件路径 |
| `--rules <path>` | rules.json | 规则 JSON 文件路径 |
| `--samples` | - | 使用内置样本数据 |
| `-v, --verbose` | - | 显示详细信息 |

**示例：**

```bash
npm run start -- simulate --samples -v
```

**输出示例：**

```
🚀 波次规则模拟运行

📂 正在加载配置文件...
   ...

✅ 数据加载完成
   ...

⚙️ 正在执行规则模拟...

=== 模拟结果 ===

总订单数: 20
存在冲突的订单数: 15
冲突率: 75.0%

📊 冲突类型统计:

╔════════════════════╤══════╤═══════════╗
║ 冲突类型           │ 数量 │ 严重程度  ║
╠════════════════════╪══════╪═══════════╣
║ 同优先级多规则     │ 10   │ 🟡 中     ║
╟────────────────────┼──────┼───────────╢
║ 互斥标签冲突       │ 2    │ 🟢 低     ║
╟────────────────────┼──────┼───────────╢
║ 容量边界冲突       │ 3    │ 🟡 中     ║
╚════════════════════╧══════╧═══════════╝

📦 区域容量使用情况:

╔════════╤═══════╤══════╤═══════╤══════╗
║ 区域ID │ 已分配 │ 上限 │ 使用率 │ 状态 ║
╠════════╪═══════╪══════╪═══════╪══════╣
║ ZONE_A │ 8     │ 10   │ 45%   │ 🟢 正常║
╟────────┼───────┼──────┼───────┼──────╢
║ ZONE_B │ 5     │ 5    │ 100%  │ 🟡 紧张║
╚════════╧═══════╧══════╧═══════╧══════╝

⚠️ 检测到 15 个存在冲突的订单
   建议运行 export 命令导出完整的冲突报告进行分析
```

### export 命令

导出冲突报告和冲突案例 CSV。

**参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--orders <path>` | orders.csv | 订单 CSV 文件路径 |
| `--sku-tags <path>` | sku_tags.csv | SKU 标签 CSV 文件路径 |
| `--zone-capacity <path>` | zone_capacity.yaml | 区域容量 YAML 文件路径 |
| `--rules <path>` | rules.json | 规则 JSON 文件路径 |
| `--samples` | - | 使用内置样本数据 |
| `-o, --output <path>` | . | 输出目录路径 |
| `--md-name <name>` | conflict_report.md | Markdown 报告文件名 |
| `--csv-name <name>` | conflict_cases.csv | CSV 案例文件名 |

**示例：**

```bash
npm run start -- export --samples -o ./output
```

**输出示例：**

```
📤 导出冲突报告

📂 正在加载配置文件...
   ...

✅ 数据加载完成
   ...

⚙️ 正在执行规则模拟...

📝 生成冲突报告...
   ✅ /path/to/output/conflict_report.md

📊 生成冲突案例CSV...
   ✅ /path/to/output/conflict_cases.csv

✅ 导出完成！

报告文件: /path/to/output/conflict_report.md
案例文件: /path/to/output/conflict_cases.csv

📈 导出统计:
   - 总订单数: 20
   - 冲突订单数: 15
   - 冲突案例数: 22
```

## 输入文件格式

### orders.csv (订单数据)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderId | string | 是 | 订单唯一标识 |
| sku | string | 是 | 商品 SKU |
| quantity | number | 是 | 数量（正整数） |
| orderTime | string | 是 | 下单时间 |
| customerType | string | 是 | 客户类型: B2C / B2B / VIP |
| shippingMethod | string | 是 | 配送方式 |
| weight | number | 是 | 重量(kg)，非负数 |
| volume | number | 是 | 体积(m³)，非负数 |

**示例：**

```csv
orderId,sku,quantity,orderTime,customerType,shippingMethod,weight,volume
ORD001,SKU_A001,2,2024-01-15T09:00:00,B2C,express,5.5,0.02
ORD002,SKU_A001,1,2024-01-15T09:05:00,VIP,express,5.5,0.02
```

### sku_tags.csv (SKU 标签数据)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sku | string | 是 | 商品 SKU |
| tags | string | 否 | 标签列表，逗号分隔 |

**示例：**

```csv
sku,tags
SKU_A001,电子产品,热销品
SKU_B002,服装,大件,易碎
SKU_C003,食品,冷链,冷藏
```

### zone_capacity.yaml (区域容量配置)

**格式：**

```yaml
zones:
  - zoneId: ZONE_A
    zoneName: 普通分拣区A
    maxOrders: 10
    maxWeight: 100
    maxVolume: 10
    supportedTags:
      - 电子产品
      - 服装
    excludedTags:
      - 冷链
      - 大件
    priority: 1
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| zoneId | string | 是 | 区域唯一标识 |
| zoneName | string | 否 | 区域名称，默认等于 zoneId |
| maxOrders | number | 否 | 最大订单数，默认 100 |
| maxWeight | number | 否 | 最大重量(kg)，默认 1000 |
| maxVolume | number | 否 | 最大体积(m³)，默认 100 |
| supportedTags | string[] | 否 | 支持的标签列表 |
| excludedTags | string[] | 否 | 排除的标签列表 |
| priority | number | 否 | 区域优先级，越小越优先 |

### rules.json (分拣规则配置)

**格式：**

```json
{
  "rules": [
    {
      "id": "RULE_001",
      "name": "VIP订单优先",
      "description": "VIP客户订单进入VIP区",
      "priority": 1,
      "conditions": [
        {
          "field": "customerType",
          "operator": "equals",
          "value": "VIP"
        }
      ],
      "conditionLogic": "AND",
      "actions": [
        {
          "type": "assignZone",
          "value": "ZONE_C"
        }
      ],
      "mutuallyExclusiveTags": [],
      "isDefault": false,
      "enabled": true
    }
  ]
}
```

**规则字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 规则唯一标识 |
| name | string | 是 | 规则名称 |
| description | string | 否 | 规则描述 |
| priority | number | 是 | 优先级，越小越优先 |
| conditions | array | 是 | 条件列表（可为空） |
| conditionLogic | string | 否 | 条件逻辑: AND / OR，默认 AND |
| actions | array | 是 | 动作列表 |
| mutuallyExclusiveTags | array | 否 | 互斥标签列表 |
| isDefault | boolean | 否 | 是否为默认兜底规则 |
| enabled | boolean | 否 | 是否启用 |

**条件操作符：**

| 操作符 | 说明 | 支持类型 |
|--------|------|----------|
| equals | 等于 | 所有 |
| notEquals | 不等于 | 所有 |
| contains | 包含 | 字符串、数组 |
| notContains | 不包含 | 字符串、数组 |
| greaterThan | 大于 | 数字 |
| lessThan | 小于 | 数字 |
| greaterThanOrEqual | 大于等于 | 数字 |
| lessThanOrEqual | 小于等于 | 数字 |
| in | 在列表中 | 所有 |
| notIn | 不在列表中 | 所有 |

**动作类型：**

| 类型 | 说明 | 值类型 |
|------|------|--------|
| assignZone | 分配区域 | string 或 string[] |
| excludeZone | 排除区域 | string 或 string[] |
| setWaveLabel | 设置波次标签 | string |
| setPriority | 设置优先级 | number |
| hold | 挂起 | boolean |

## 冲突类型

### 1. 同优先级多规则冲突 (same_priority_multiple_rules)

**场景：** 同一优先级的多条规则同时匹配同一订单。

**示例：**
- 规则 A (优先级 1): VIP 订单 → VIP 区
- 规则 B (优先级 1): 快递订单 → 普通区 A
- 订单同时是 VIP 且是快递配送

**影响：** 分配结果不稳定，取决于规则定义顺序。

**建议：** 为冲突规则设置不同的优先级，或合并逻辑相似的规则。

### 2. 容量边界冲突 (capacity_boundary)

**场景：** 分配的订单数/重量/体积超过区域容量上限。

**示例：**
- 区域 A 最大订单数: 10
- 当前已分配: 10
- 新订单尝试分配到区域 A

**影响：** 订单无法正常分配，需要人工处理或等待下一波次。

**建议：** 增加区域容量，或增加更多分拣区域，或调整规则分流。

### 3. 互斥标签冲突 (mutually_exclusive_tags)

**场景：** 订单包含互斥标签，同时匹配了多条带互斥约束的规则。

**示例：**
- 规则 A (互斥标签: 易碎): 服装 → 区 B
- 规则 B (互斥标签: 易碎): 大件 → 区 E
- 订单同时是服装、大件、易碎

**影响：** 无法确定正确的分配区域。

**建议：** 检查带互斥标签的规则逻辑，确保同一订单不会同时触发多条互斥规则。

### 4. 冷链标签冲突 (cold_chain_conflict)

**场景：** 订单包含冷链标签，但没有配置支持冷链的分拣区域。

**示例：**
- 订单 SKU 标签: 食品, 冷链
- 所有区域的 excludedTags 都包含"冷链"

**影响：** 冷链商品无法正确分配。

**建议：** 配置支持冷链标签的分拣区域。

### 5. 大件标签冲突 (large_item_conflict)

**场景：** 订单是大件商品（重量>50kg 或体积>0.5m³ 或标签包含"大件"），但没有配置支持大件的分拣区域。

**示例：**
- 订单重量: 60kg
- 所有区域的 excludedTags 都包含"大件"

**影响：** 大件商品无法正确分配。

**建议：** 配置支持大件标签的分拣区域。

### 6. 默认兜底分配 (default_fallback)

**场景：** 订单未匹配任何业务规则，使用默认兜底规则分配。

**示例：**
- 订单不满足任何规则的条件
- 只有默认规则（conditions 为空）匹配

**影响：** 可能表示规则覆盖不完整。

**建议：** 检查规则是否覆盖了所有业务场景，或调整规则条件以匹配更多订单。

## 输出文件说明

### conflict_report.md (冲突报告)

包含以下章节：

1. **执行概览**：总订单数、冲突订单数、冲突率
2. **冲突类型统计**：各类型冲突的数量统计
3. **区域容量使用情况**：各区域的容量使用率和溢出状态
4. **配置验证结果**：配置文件的语法和逻辑检查结果
5. **冲突订单详情**：每个冲突订单的详细信息，包括：
   - 匹配的规则列表
   - 冲突详情
   - 最终分配决策
6. **建议**：基于冲突分析的优化建议

### conflict_cases.csv (冲突案例)

包含以下字段：

| 字段 | 说明 |
|------|------|
| orderId | 订单ID |
| conflictType | 冲突类型 |
| rules | 涉及的规则ID |
| zones | 涉及的区域ID |
| description | 冲突描述 |
| severity | 严重程度 (high/medium/low) |
| resolvedBy | 裁决方式 |
| resolutionReason | 裁决原因 |
| finalZone | 最终分配区域 |
| finalRule | 最终使用规则 |

## 项目结构

```
.
├── src/
│   ├── index.ts           # CLI 入口文件
│   ├── types/
│   │   └── index.ts       # TypeScript 类型定义
│   ├── parsers/
│   │   └── index.ts       # 文件解析器 (CSV/YAML/JSON)
│   ├── engine/
│   │   └── index.ts       # 规则引擎
│   └── simulator/
│       └── index.ts       # 模拟器和报告生成器
├── samples/
│   ├── orders.csv         # 样本订单数据
│   ├── sku_tags.csv       # 样本 SKU 标签
│   ├── zone_capacity.yaml # 样本区域容量配置
│   └── rules.json         # 样本规则配置
├── dist/                   # 编译输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

### 编译

```bash
npm run build
```

### 测试

```bash
# 使用样本数据测试
npm test

# 或手动运行
npm run start -- validate --samples
```

## License

MIT
