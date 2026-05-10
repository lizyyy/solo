# 公益物资箱投递核对 CLI

一个实用的公益物资投递管理工具，专门解决志愿者投递物资时经常出现的"签收照片、户主名单和剩余物资对不上"的问题。

## 核心特性

- **名单导入**: 支持 CSV/JSON 格式的户主名单批量导入
- **投递记录**: 记录志愿者投递物资的详细信息
- **签收核对**: 比对投递物资与实际收到物资，自动检测差异
- **缺件标记**: 自动识别缺件、数量不符等异常并生成异常记录
- **志愿者统计**: 跟踪每个志愿者的投递次数、异常率等指标
- **异常导出**: 支持将异常记录导出为 CSV/JSON 格式

## 业务闭环

```
名单导入 → 物资捐赠 → 志愿者投递 → 签收核对 → 异常标记 → 报告生成
     ↓                                         ↓
  户主管理                              志愿者统计
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动命令

项目使用 Node.js 开发，通过以下方式运行：

```bash
# 查看帮助
node src/index.js --help

# 或全局链接后使用
npm link
donation --help
```

## 样例数据位置

样例数据位于 `data/samples/` 目录：

- `households.csv` - 户主名单（CSV格式，包含有效数据和测试用的无效数据）
- `households.json` - 户主名单（JSON格式）
- `donations.csv` - 物资捐赠（CSV格式）
- `donations.json` - 物资捐赠（JSON格式）

**注意**：样例数据中故意包含了一些无效数据（如空姓名、空电话、家庭人数为0等），用于测试数据验证功能。

## 主流程演示

### 1. 重置数据（首次使用或重新演示时）

```bash
node src/index.js reset --yes
```

### 2. 导入户主名单

```bash
node src/index.js import:households data/samples/households.csv
```

**预期输出**：
```
正在导入户主名单: /path/to/data/samples/households.csv
解析完成，共 13 条记录

导入结果:
  ✓ 成功导入: 10 条
  ⚠ 跳过: 3 条
    第 12 行: 户主姓名不能为空
    第 13 行: 联系电话不能为空
    第 14 行: 家庭人数必须大于等于1
```

### 3. 导入物资捐赠

```bash
node src/index.js import:donations data/samples/donations.csv
```

**预期输出**：
```
正在导入物资捐赠: /path/to/data/samples/donations.csv
解析完成，共 12 条记录

导入结果:
  ✓ 成功导入: 10 条
  ⚠ 跳过: 3 条
    第 12 行: 物资名称不能为空
    第 13 行: 物资数量必须大于0
    第 14 行: 物资数量必须大于0; 物资单位不能为空
```

### 4. 注册志愿者

```bash
node src/index.js volunteer:register -n "张志愿者" -p "13900139001" -o "阳光公益团队"
node src/index.js volunteer:register -n "李志愿者" -p "13900139002" -o "爱心服务队"
node src/index.js volunteer:register -n "王志愿者" -p "13900139003" -o "社区志愿者协会"
```

### 5. 查看已导入的数据

```bash
# 查看户主列表
node src/index.js list:households

# 查看物资列表
node src/index.js list:donations

# 查看志愿者列表
node src/index.js list:volunteers
```

**注意**：记录下户主ID、物资ID和志愿者ID，后续步骤需要使用。

### 6. 创建投递记录

假设我们有以下ID（请替换为实际输出的ID）：
- 户主张三: `household_id_1`
- 户主李四: `household_id_2`
- 物资大米: `donation_id_1`
- 物资食用油: `donation_id_2`
- 物资棉被: `donation_id_3`
- 张志愿者: `volunteer_id_1`
- 李志愿者: `volunteer_id_2`

```bash
# 张志愿者投递：大米2袋，食用油1桶（完整投递）
node src/index.js delivery:create \
  -h "household_id_1" \
  -v "volunteer_id_1" \
  -i '[{"donationId":"donation_id_1","quantity":2},{"donationId":"donation_id_2","quantity":1}]'

# 李志愿者投递：大米3袋，棉被1床（故意缺少部分物资用于测试）
node src/index.js delivery:create \
  -h "household_id_2" \
  -v "volunteer_id_2" \
  -i '[{"donationId":"donation_id_1","quantity":3},{"donationId":"donation_id_3","quantity":1}]'

# 查看投递记录
node src/index.js list:deliveries
```

### 7. 创建签收记录

假设投递记录ID为：
- 投递1（张志愿者）: `delivery_id_1`
- 投递2（李志愿者）: `delivery_id_2`

```bash
# 签收1：完整签收（匹配投递内容）
node src/index.js signature:create \
  -d "delivery_id_1" \
  -v "volunteer_id_1" \
  -t "photo" \
  -p "photo_001" \
  -i '[{"itemName":"大米","quantity":2,"unit":"袋"},{"itemName":"食用油","quantity":1,"unit":"桶"}]'

# 签收2：不完整签收（缺少物资，用于测试异常检测）
node src/index.js signature:create \
  -d "delivery_id_2" \
  -v "volunteer_id_2" \
  -t "signature" \
  -s "李四" \
  -i '[{"itemName":"大米","quantity":2,"unit":"袋"}]'
```

### 8. 核对投递记录

```bash
# 核对投递1（应该全部匹配）
node src/index.js verify "delivery_id_1"

# 核对投递2（应该检测到异常）
node src/index.js verify "delivery_id_2"
```

**投递2的预期输出**：
```
=== 核对结果 ===
投递ID: delivery_id_2
最终状态: mismatched

✓ 匹配物资: 1 项
  - 大米: 2 袋

✗ 缺少物资: 1 项
  - 棉被: 应发 1 床，实发 0

⚠ 数量不符: 1 项
  - 大米: 应发 3 袋，实发 2

生成异常记录: 2 条
  - [missing] 数量不符: 大米 (应发: 3 袋, 实发: 2 袋)
  - [missing] 缺少物资: 棉被 (应发: 1 床, 实发: 0)

⚠ 需要人工复核！
```

### 9. 查看统计和异常

```bash
# 查看志愿者统计
node src/index.js stats:volunteers

# 查看核对统计报告
node src/index.js stats:verification

# 查看异常记录
node src/index.js list:exceptions
```

**志愿者统计预期输出**：
```
┌──────────────┬────────────┬────────────┬────────────┬──────────┐
│ 志愿者       │ 投递次数   │ 核对次数   │ 异常次数   │ 成功率   │
├──────────────┼────────────┼────────────┼────────────┼──────────┤
│ 张志愿者     │ 1          │ 1          │ 0          │ 100.0%   │
├──────────────┼────────────┼────────────┼────────────┼──────────┤
│ 李志愿者     │ 1          │ 1          │ 2          │ 80.0%    │
└──────────────┴────────────┴────────────┴────────────┴──────────┘
```

### 10. 导出报告

```bash
# 导出异常记录为CSV
node src/index.js export:exceptions exceptions.csv

# 导出异常记录为JSON
node src/index.js export:exceptions exceptions.json

# 导出完整核对报告
node src/index.js export:report verification_report.json
```

## 异常操作演示

### 异常1：导入无效数据

```bash
# 使用包含无效数据的文件
node src/index.js import:households data/samples/households.csv
```

**关键输出**：
```
⚠ 跳过: 3 条
  第 12 行: 户主姓名不能为空
  第 13 行: 联系电话不能为空
  第 14 行: 家庭人数必须大于等于1
```

**验证点**：系统自动识别并跳过无效数据，不中断导入流程。

### 异常2：创建投递时使用不存在的ID

```bash
node src/index.js delivery:create \
  -h "non_existent_id" \
  -v "volunteer_id_1" \
  -i '[{"donationId":"donation_id_1","quantity":2}]'
```

**预期输出**：
```
✗ 创建投递记录失败:
  - 户主ID不存在
```

**验证点**：系统验证外键关系，防止无效关联。

### 异常3：投递物资超出库存

```bash
# 假设某物资只有10袋，尝试投递100袋
node src/index.js delivery:create \
  -h "household_id_1" \
  -v "volunteer_id_1" \
  -i '[{"donationId":"donation_id_1","quantity":100}]'
```

**预期输出**：
```
✗ 创建投递记录失败:
  - 物资 大米 库存不足 (剩余: 10, 需要: 100)
```

**验证点**：系统检查库存，防止超量投递。

### 异常4：核对时发现缺件

如主流程演示中的步骤8，系统会：
- 标记状态为 `mismatched` 或 `needs_review`
- 自动创建异常记录
- 在命令输出中高亮显示需要人工复核

### 异常5：无有效签收证据

```bash
# 使用 none 类型创建签收
node src/index.js signature:create \
  -d "delivery_id_1" \
  -v "volunteer_id_1" \
  -t "none" \
  -i '[{"itemName":"大米","quantity":2,"unit":"袋"}]'

# 然后核对
node src/index.js verify "delivery_id_1"
```

**预期输出**：
```
生成异常记录: 1 条
  - [signature_issue] 无有效签收证据

⚠ 需要人工复核！
```

**验证点**：即使物资数量匹配，无有效签收证据也会被标记为异常。

## 关键判断依据

本系统的关键判断不仅在文档中声明，更在以下位置体现：

### 1. 测试用例（`tests/` 目录）

- `verification.test.js` - 物资核对逻辑测试
- `validation.test.js` - 数据验证测试

运行测试：
```bash
npm test
```

### 2. 命令输出

- 导入命令显示成功/跳过行数及原因
- 核对命令显示匹配/缺件/数量不符的详细信息
- 统计命令显示需要人工复核的记录

### 3. 服务层逻辑

- `verificationService.js:91-194` - 核对逻辑，包含状态判断
- `verificationService.js:196-264` - 物资比对算法
- `deliveryService.js:7-38` - 投递验证逻辑

## 签收类型说明

| 类型 | 说明 | 要求 |
|------|------|------|
| `photo` | 照片签收 | 必须提供照片证据ID |
| `signature` | 签字签收 | 必须提供签名内容 |
| `witness` | 见证人签收 | 必须提供见证人姓名 |
| `none` | 无有效签收 | 无要求，但会触发异常 |

## 异常类型说明

| 类型 | 说明 |
|------|------|
| `missing` | 缺件/数量不足 |
| `damaged` | 物资损坏 |
| `wrong_item` | 物资错误 |
| `extra` | 额外物资 |
| `signature_issue` | 签收问题 |
| `other` | 其他问题 |

## 投递状态说明

| 状态 | 说明 |
|------|------|
| `pending_verification` | 待核对 |
| `verifying` | 核对中（已签收） |
| `completed` | 已完成（完全匹配） |
| `completed_with_notes` | 已完成（有备注） |
| `exception` | 异常（缺件等） |
| `needs_review` | 需要人工复核 |

## 项目结构

```
.
├── src/
│   ├── index.js                 # CLI 主入口
│   ├── storage/
│   │   └── dataStore.js         # 数据存储
│   └── services/
│       ├── householdService.js  # 户主管理
│       ├── volunteerService.js  # 志愿者管理
│       ├── donationService.js   # 物资捐赠
│       ├── deliveryService.js   # 投递管理
│       ├── verificationService.js # 签收核对
│       └── importExportService.js # 导入导出
├── data/
│   ├── samples/                 # 样例数据
│   │   ├── households.csv
│   │   ├── households.json
│   │   ├── donations.csv
│   │   └── donations.json
│   └── store.json               # 运行时数据（自动生成）
├── tests/                       # 测试用例
│   ├── verification.test.js
│   └── validation.test.js
├── package.json
└── README.md
```

## 常见问题

**Q: 数据存储在哪里？**
A: 数据存储在 `data/store.json` 文件中，首次运行时自动创建。

**Q: 如何重置所有数据？**
A: 运行 `node src/index.js reset --yes`。

**Q: 支持哪些数据格式？**
A: 导入支持 CSV 和 JSON 格式，导出支持 CSV 和 JSON 格式。

**Q: 如何查看所有可用命令？**
A: 运行 `node src/index.js --help` 或 `node src/index.js [command] --help` 查看具体命令的帮助。

## 许可证

MIT License
