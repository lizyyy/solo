# 团长运营生鲜缺货对账系统

一个用于处理生鲜商品缺货后退款、换货、补券的全流程对账系统。

## 功能特性

- **数据导入**: 支持从订单CSV、缺货清单Excel、补偿规则JSON导入数据
- **数据校验**: 自动校验导入数据，坏记录不会直接丢弃，会保留原始位置、失败原因和修改建议
- **批量处理**: 自动根据缺货情况和补偿规则生成补偿方案
- **状态管理**: 支持待审核、已审核、已执行等状态变更
- **失败重试**: 批量操作失败时，不会破坏已成功的记录，可单独重试失败项
- **报告生成**: 支持导出补偿记录、问题记录、完整对账报告

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成样例数据

```bash
# 生成缺货清单Excel
node examples/generate_shortage_excel.js
```

### 3. 导入数据

```bash
# 导入订单
node src/cli.js import-orders examples/orders_normal.csv

# 导入缺货清单
node src/cli.js import-shortage examples/shortage_list.xlsx

# 导入补偿规则
node src/cli.js import-rules examples/compensation_rules.json
```

### 4. 批量处理补偿

```bash
node src/cli.js process
```

### 5. 查看待审核记录

```bash
node src/cli.js review

# 查看特定状态
node src/cli.js review --status pending
node src/cli.js review --status approved
node src/cli.js review --status executed
```

### 6. 审核并执行

```bash
# 审核通过
node src/cli.js approve <补偿记录ID> [操作人]

# 执行补偿
node src/cli.js execute <补偿记录ID>
```

### 7. 查看问题记录

```bash
# 查看未解决的问题记录
node src/cli.js bad-records

# 查看所有问题记录
node src/cli.js bad-records --status all

# 标记问题记录为已解决
node src/cli.js resolve-bad-record <记录ID> "手动修正完成" [处理人]
```

### 8. 生成报告

```bash
# 查看统计报告
node src/cli.js report

# 导出补偿记录
node src/cli.js export-compensations output/compensations.xlsx

# 导出问题记录
node src/cli.js export-bad-records output/bad_records.xlsx

# 导出完整对账报告
node src/cli.js export-reconciliation output/reconciliation.xlsx
```

## 命令详解

### 数据导入

| 命令 | 说明 | 参数 |
|------|------|------|
| `import-orders <file>` | 导入订单CSV | file: CSV文件路径 |
| `import-shortage <file>` | 导入缺货清单Excel | file: Excel文件路径 |
| `import-rules <file>` | 导入补偿规则JSON | file: JSON文件路径 |

### 数据处理

| 命令 | 说明 | 参数 |
|------|------|------|
| `process` | 批量处理缺货补偿 | - |
| `retry` | 重试失败的补偿记录 | - |

### 审核管理

| 命令 | 说明 | 参数 |
|------|------|------|
| `review` | 查看补偿记录 | --status: 筛选状态 |
| `approve <id> [operator]` | 审核通过补偿 | id: 补偿记录ID, operator: 操作人 |
| `execute <id>` | 执行补偿 | id: 补偿记录ID |

### 问题记录管理

| 命令 | 说明 | 参数 |
|------|------|------|
| `bad-records` | 查看问题记录 | --status: 筛选状态 |
| `resolve-bad-record <id> <note> [resolver]` | 标记问题为已解决 | id: 记录ID, note: 处理备注 |

### 报告导出

| 命令 | 说明 | 参数 |
|------|------|------|
| `report` | 查看统计报告 | - |
| `export-compensations <file>` | 导出补偿记录 | file: 输出文件路径 |
| `export-bad-records <file>` | 导出问题记录 | file: 输出文件路径 |
| `export-reconciliation <file>` | 导出完整对账报告 | file: 输出文件路径 |

## 数据格式说明

### 订单CSV格式

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| orderNo | 是 | 字符串 | 订单编号 |
| userId | 是 | 字符串 | 用户ID |
| userName | 是 | 字符串 | 用户名称 |
| phone | 是 | 手机号 | 联系电话 |
| groupLeaderId | 否 | 字符串 | 团长ID |
| groupLeaderName | 否 | 字符串 | 团长名称 |
| productId | 是 | 字符串 | 商品ID |
| productName | 是 | 字符串 | 商品名称 |
| quantity | 是 | 整数 | 购买数量 |
| unitPrice | 是 | 数字 | 单价 |
| totalAmount | 是 | 数字 | 总金额 |
| paymentTime | 否 | 日期 | 付款时间 |

### 缺货清单Excel格式

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| productId | 是 | 字符串 | 商品ID |
| productName | 是 | 字符串 | 商品名称 |
| shortageDate | 是 | 日期 | 缺货日期 |
| expectedQuantity | 是 | 整数 | 预期数量 |
| actualQuantity | 是 | 整数 | 实际数量 |
| shortageQuantity | 是 | 整数 | 缺货数量 |
| supplierId | 否 | 字符串 | 供应商ID |
| supplierName | 否 | 字符串 | 供应商名称 |
| reason | 否 | 字符串 | 缺货原因 |

### 补偿规则JSON格式

```json
[
  {
    "ruleType": "refund",
    "productId": "P001",
    "productCategory": "fruit",
    "minShortageQuantity": 1,
    "compensationType": "refund",
    "refundRate": 1.0,
    "priority": 10,
    "enabled": true,
    "description": "草莓缺货全额退款"
  }
]
```

补偿类型说明：
- `refund`: 退款，需要 `refundRate` 字段（退款比例）
- `coupon`: 优惠券，需要 `couponValue` 字段（优惠券面值）
- `exchange`: 换货，需要 `exchangeProductId` 和 `exchangeProductName` 字段

## 错误处理说明

系统会对导入数据进行以下校验：

1. **必填字段校验**: 检查必填字段是否为空
2. **数据类型校验**: 检查数量是否为整数、金额是否为数字、日期格式是否正确
3. **手机号校验**: 检查手机号格式是否合法
4. **业务逻辑校验**: 检查总金额是否等于数量 × 单价，缺货数量是否正确等

所有校验失败的记录都会被保存到问题记录中，包含：
- 原始数据
- 错误类型
- 错误信息
- 修改建议
- 原始行号
- 来源文件

## 项目结构

```
.
├── src/
│   ├── models/              # 数据模型
│   │   ├── Order.js         # 订单模型
│   │   ├── Shortage.js      # 缺货模型
│   │   ├── CompensationRule.js  # 补偿规则模型
│   │   ├── Compensation.js  # 补偿记录模型
│   │   └── BadRecord.js     # 问题记录模型
│   ├── importers/           # 数据导入器
│   │   ├── OrderImporter.js    # 订单导入器
│   │   ├── ShortageImporter.js # 缺货导入器
│   │   └── RuleImporter.js     # 规则导入器
│   ├── services/            # 业务服务
│   │   ├── CompensationService.js  # 补偿处理服务
│   │   └── ReportService.js        # 报告服务
│   ├── utils/               # 工具类
│   │   ├── DataStore.js     # 数据持久化
│   │   └── Validator.js     # 数据校验器
│   ├── data/                # 数据存储目录
│   └── cli.js               # 命令行入口
├── examples/                # 样例数据
│   ├── orders_normal.csv    # 正常订单样例
│   ├── orders_with_errors.csv  # 包含错误的订单样例
│   ├── compensation_rules.json  # 补偿规则样例
│   └── generate_shortage_excel.js  # 生成缺货清单脚本
├── package.json
└── README.md
```

## 完整使用示例

### 正常流程

```bash
# 1. 安装依赖
npm install

# 2. 生成缺货清单Excel
node examples/generate_shortage_excel.js

# 3. 导入数据
node src/cli.js import-orders examples/orders_normal.csv
node src/cli.js import-shortage examples/shortage_list.xlsx
node src/cli.js import-rules examples/compensation_rules.json

# 4. 批量处理
node src/cli.js process

# 5. 查看待审核记录
node src/cli.js review

# 6. 审核通过（使用实际的补偿记录ID）
# node src/cli.js approve <补偿记录ID> 管理员

# 7. 执行补偿
# node src/cli.js execute <补偿记录ID>

# 8. 生成报告
node src/cli.js report

# 9. 导出报告
mkdir -p output
node src/cli.js export-reconciliation output/reconciliation.xlsx
```

### 错误处理流程

```bash
# 1. 导入包含错误的数据
node src/cli.js import-orders examples/orders_with_errors.csv

# 2. 查看问题记录
node src/cli.js bad-records

# 3. 手动修正数据后重新导入
# （先修正CSV文件中的错误）

# 4. 标记问题记录为已解决
# node src/cli.js resolve-bad-record <记录ID> "已手动修正" 管理员
```

## 注意事项

1. 数据文件路径请使用绝对路径或相对于项目根目录的路径
2. 所有导出的Excel文件格式为xlsx格式
3. 数据保存在 `src/data/` 目录下的JSON文件中
4. 建议定期备份数据文件

## 技术栈

- Node.js
- csv-parser: CSV文件解析
- xlsx: Excel文件处理
- yargs: 命令行参数解析
- chalk: 命令行彩色输出
- cli-table3: 命令行表格输出
- uuid: 唯一ID生成
