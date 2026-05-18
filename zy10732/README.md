# 价目表快照门店价格生效比对 CLI

一个可配置的价格比对工具，用于比较门店实际价格与应生效版本的价格，支持多种业务规则配置。

## 功能特性

- ✅ **可配置规则**：通过配置文件修改口径，无需改源码
- ✅ **半夜生效规则**：00:00-06:00 生效的价格特殊处理
- ✅ **门店停业规则**：门店停业期间价格不校验
- ✅ **旧订单规则**：历史订单使用下单时价格版本
- ✅ **差异可追踪**：输出支持 diff 对比，规则变更影响清晰可见
- ✅ **字段映射配置**：支持自定义字段名映射

## 项目结构

```
.
├── package.json
├── README.md
├── config/
│   └── rules.json          # 规则配置文件
├── src/
│   ├── cli.js             # CLI 入口
│   └── comparator.js      # 比对核心逻辑
├── samples/
│   ├── normal/            # 正常样例文件
│   │   ├── price_snapshot_001.json
│   │   ├── price_snapshot_002_midnight.json
│   │   ├── price_snapshot_003_closed.json
│   │   └── price_snapshot_004_oldorder.json
│   ├── bad/               # 坏行样例（格式错误、不匹配）
│   │   └── bad_rows_001.json
│   └── repeat/            # 重复运行对照（相同输入）
│       ├── run_001.json
│       └── run_002_same.json
└── tests/
    └── run.js             # 自动化测试
```

## 快速开始

### 安装

```bash
npm install
```

### 运行样例

```bash
# 运行正常样例
node src/cli.js --config config/rules.json --input samples/normal --output output/normal_result.json

# 运行坏行样例
node src/cli.js --config config/rules.json --input samples/bad --output output/bad_result.json

# 查看帮助
node src/cli.js --help
```

## 配置说明

### 规则配置 (config/rules.json)

```json
{
  "rules": {
    "midnightEffective": {
      "enabled": true,
      "timeRange": { "start": "00:00", "end": "06:00" },
      "toleranceMinutes": 30
    },
    "storeClosed": {
      "enabled": true,
      "statusField": "storeStatus",
      "closedValue": "CLOSED"
    },
    "oldOrder": {
      "enabled": true,
      "orderDateField": "orderDate",
      "versionDateField": "versionEffectiveDate",
      "gracePeriodDays": 7
    },
    "priceMatch": {
      "tolerance": 0.01
    }
  },
  "fields": {
    "storeId": "storeId",
    "storeName": "storeName",
    "actualPrice": "actualPrice",
    "expectedPrice": "expectedPrice"
  }
}
```

### 输入字段说明

| 字段 | 说明 |
|------|------|
| storeId | 门店编号 |
| storeName | 门店名称 |
| itemId | 商品编号 |
| itemName | 商品名称 |
| actualPrice | 实际价格 |
| expectedPrice | 期望价格 |
| snapshotTime | 快照时间 |
| priceVersion | 价格版本 |
| storeStatus | 门店状态 (OPEN/CLOSED) |
| orderDate | 下单时间 |
| versionEffectiveDate | 版本生效时间 |

## 输出说明

### 输出格式

```json
{
  "tool": "价目表快照门店价格生效比对",
  "version": "1.0.0",
  "generatedAt": "2026-05-18T...",
  "configUsed": { ... },
  "results": [
    {
      "sourceFile": "price_snapshot_001.json",
      "totalRecords": 3,
      "matched": 3,
      "mismatched": 0,
      "matchRate": 100,
      "results": [
        {
          "recordIndex": 0,
          "storeId": "ST001",
          "storeName": "北京朝阳门店",
          "itemName": "经典美式咖啡",
          "matched": true,
          "appliedRules": [],
          "details": {}
        }
      ]
    }
  ],
  "summary": {
    "totalRecords": 10,
    "matched": 8,
    "mismatched": 2,
    "matchRate": 80,
    "breakdown": {
      "半夜生效": 2,
      "门店停业": 2,
      "旧订单": 2
    }
  }
}
```

### Diff 使用说明

规则变更后，可通过 diff 工具对比输出：

```bash
# 对比两次运行结果
diff output/old_result.json output/new_result.json
```

输出中可清晰看到：
- `appliedRules` 变化（规则启用/禁用）
- `breakdown` 统计变化
- `matched` 结果变化

## 样例说明

### 正常样例 (samples/normal/)
- `price_snapshot_001.json` - 普通正常数据
- `price_snapshot_002_midnight.json` - 半夜生效场景（02:30/04:15）
- `price_snapshot_003_closed.json` - 门店停业场景（CLOSED状态）
- `price_snapshot_004_oldorder.json` - 旧订单场景（超过7天）

### 坏行样例 (samples/bad/)
- `bad_rows_001.json` - 包含无效价格、价格不匹配等异常

### 重复对照 (samples/repeat/)
- 两份完全相同的文件，用于验证重复运行一致性

## 运行测试

```bash
npm test
```

测试内容：
1. 正常路径测试（全匹配、规则应用）
2. 异常路径测试（格式错误、价格不匹配）
3. 重复运行一致性测试
4. 规则配置切换测试

## 业务场景

### 场景1：半夜生效
- 快照时间在 00:00-06:00 之间
- 输出标记 `appliedRules: ["半夜生效"]`
- 可通过配置 `midnightEffective.enabled` 开关

### 场景2：门店停业
- 门店状态为 CLOSED
- 输出标记 `appliedRules: ["门店停业"]`
- 即使价格差异也视为匹配

### 场景3：旧订单
- 下单时间距版本生效超过7天
- 输出标记 `appliedRules: ["旧订单"]`

## 版本历史

- **1.0.0** - 初始版本，支持三大规则配置
