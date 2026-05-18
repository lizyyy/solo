# 蔬菜配送站蔬菜称重对账 CLI

一个专业的蔬菜配送站称重对账工具，支持整筐扣重、单位换算、价格计算等功能，输出结果可复现、可对比。

## 文件用途说明

| 文件路径 | 用途 |
|---------|------|
| [package.json](file:///Users/mac/pro/solo/workspaces/xy11160/package.json) | 项目配置和依赖管理 |
| [config/default.json](file:///Users/mac/pro/solo/workspaces/xy11160/config/default.json) | 规则配置文件，包含默认对账口径 |
| [src/reconciler.js](file:///Users/mac/pro/solo/workspaces/xy11160/src/reconciler.js) | 核心对账逻辑模块 |
| [src/cli.js](file:///Users/mac/pro/solo/workspaces/xy11160/src/cli.js) | CLI 入口文件，提供命令行接口 |
| [data/sample-input.json](file:///Users/mac/pro/solo/workspaces/xy11160/data/sample-input.json) | 蔬菜配送站业务样例数据 |
| [output/](file:///Users/mac/pro/solo/workspaces/xy11160/output/) | 对账结果输出目录（自动创建） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行样例对账

```bash
npm run sample
```

或直接运行：

```bash
node src/cli.js
```

### 3. 自定义参数

```bash
# 使用自定义配置和输入文件
node src/cli.js --config config/my-rules.json --input data/my-delivery.json --output output/my-result.json

# 静默模式（适合 CI/定时任务）
node src/cli.js --quiet

# 不保存输出文件，只在控制台显示
node src/cli.js --no-save
```

## 退出码说明

| 退出码 | 含义 |
|-------|------|
| 0 | 对账成功，所有商品在容差范围内 |
| 1 | 配置文件加载错误 |
| 2 | 输入数据格式错误 |
| 3 | 计算过程错误 |
| 4 | 输出文件保存错误 |
| 5 | 对账完成，但存在超出容差的商品 |

## 规则配置说明

配置文件位于 `config/default.json`，可根据实际业务调整规则。

### 1. 单位换算 (unitConversion)

```json
{
  "enabled": true,
  "baseUnit": "kg",
  "rates": {
    "g": 0.001,
    "斤": 0.5,
    "kg": 1,
    "公斤": 1
  }
}
```

支持的单位：g, jin, 斤, kg, 公斤, lb

### 2. 整筐扣重 (basketDeduction)

```json
{
  "enabled": true,
  "defaultBasketWeightKg": 2.5,
  "basketTypes": {
    "塑料筐": 2.5,
    "竹筐": 1.8,
    "纸箱": 0.8,
    "泡沫箱": 0.5,
    "保温箱": 3.2
  },
  "deductionPerBasket": true
}
```

- 按筐数量扣重：每筐扣重 × 筐数
- 未知筐类型使用默认扣重值

### 3. 对账容差 (reconciliationRules)

```json
{
  "tolerancePercent": 0.5,
  "toleranceKg": 0.3,
  "useMaxTolerance": true
}
```

- 百分比容差：0.5%
- 绝对容差：0.3 kg
- `useMaxTolerance: true` 取两者较大值作为容差
- 超出容差标记为 FAIL

### 4. 价格计算 (priceCalculation)

```json
{
  "enabled": true,
  "rounding": 2,
  "taxRate": 0.09
}
```

- 单价 × 净重 = 金额
- 保留 2 位小数

## 输入数据格式

```json
{
  "deliveryId": "配送单号",
  "deliveryDate": "配送日期",
  "supplier": "供应商",
  "warehouse": "仓库",
  "items": [
    {
      "vegetableName": "蔬菜名称",
      "vegetableCode": "蔬菜编码",
      "basketType": "筐类型",
      "basketCount": 筐数量,
      "expectedWeight": 预期重量,
      "expectedWeightUnit": "预期重量单位",
      "actualWeight": 实际重量,
      "actualWeightUnit": "实际重量单位",
      "unitPrice": 单价,
      "remarks": "备注"
    }
  ]
}
```

## 输出结果格式

输出包含完整的计算过程，便于审计和追溯：

```json
{
  "deliveryId": "VEG-DEL-20260519-001",
  "items": [
    {
      "vegetableName": "西红柿",
      "expected": {
        "grossWeight": 100,
        "grossUnit": "斤",
        "grossWeightKg": 50,
        "netWeightKg": 37.5,
        "price": 131.25
      },
      "actual": {
        "grossWeight": 48.5,
        "grossUnit": "kg",
        "grossWeightKg": 48.5,
        "netWeightKg": 36,
        "price": 126
      },
      "difference": {
        "weightKg": -1.5,
        "weightPercent": 4,
        "price": -5.25,
        "toleranceKg": 0.3
      },
      "status": "FAIL",
      "calculationSteps": [...]
    }
  ],
  "summary": {...},
  "overallStatus": "FAIL"
}
```

## CI/定时任务集成示例

```bash
#!/bin/bash

# 每日对账脚本
node src/cli.js --config config/production.json --input data/daily.json --output output/daily-$(date +%Y%m%d).json --quiet

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 对账完成，所有商品正常"
elif [ $EXIT_CODE -eq 5 ]; then
  echo "⚠️ 对账完成，但存在异常商品，需要人工复核"
else
  echo "❌ 对账过程出错，退出码: $EXIT_CODE"
fi

exit $EXIT_CODE
```

## 输出可对比性说明

- **确定性输出**：相同输入始终产生相同结构的输出
- **排序输出**：商品按编码排序，便于 diff 对比
- **固定精度**：重量保留4位小数，金额保留2位小数
- **完整计算步骤**：每一步计算都有记录，便于追溯

## 接手指南

1. 先运行样例 `npm run sample` 熟悉流程
2. 查看 `config/default.json` 了解默认规则
3. 查看 `data/sample-input.json` 了解输入格式
4. 根据实际业务修改配置文件
5. 准备真实数据，替换样例输入
6. 运行对账工具验证结果

## 常见问题

**Q: 如何添加新的筐类型？**

A: 在 `config/default.json` 的 `basketDeduction.basketTypes` 中添加新类型和重量。

**Q: 单位换算可以关闭吗？**

A: 可以，将 `unitConversion.enabled` 设为 `false`，此时所有重量按原值计算。

**Q: 如何调整容差规则？**

A: 修改 `reconciliationRules` 中的 `tolerancePercent` 和 `toleranceKg`，也可以通过 `useMaxTolerance` 控制取最大值还是最小值。
