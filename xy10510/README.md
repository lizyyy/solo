# 合同里程碑回款 CLI (CMP)

一个本地可运行的合同里程碑回款管理CLI工具，帮助项目助理月底核对合同回款，围绕项目合同按里程碑回款，处理交付证明、验收单和开票状态不一致时的核对问题。

## 功能特性

- 🌱 **初始化** - 快速创建本地数据库
- 📥 **数据导入** - 支持合同、里程碑、交付证明、验收单、发票、收款流水的JSON导入
- ✅ **一致性检查** - 自动检测业务规则冲突和数据异常
- 📋 **合同详情** - 查看合同里程碑状态、历史记录和问题
- 📊 **汇总报告** - 展示应收、已开票、已回款、缺口和下一步跟进动作
- 🎯 **内置演示** - 包含多种场景的示例数据

## 核心业务规则

### 数据校验规则

1. **重复导入检测**
   - 收款流水号重复时自动跳过
   - 发票号、验收单号、交付证明号重复时自动跳过
   - 保持幂等性，重复执行不产生副作用

2. **日期校验**
   - 验收日期必须晚于或等于交付日期
   - 超期未收检测（验收后30天未收款）

3. **金额校验**
   - 发票金额不得超过里程碑金额
   - 验收金额不得超过里程碑金额
   - 部分验收需要特别标注

4. **状态一致性**
   - 有验收单必须先有交付证明
   - 收款流水必须匹配到发票或里程碑

### 里程碑状态流转

```
not_started → delivered → accepted → invoiced → paid
                                    ↓
                             partially_paid
                                    ↓
                                 overdue (超期30天)
```

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装

```bash
npm install
npm run build
```

### 运行演示

```bash
# 运行内置演示数据（包含各种场景）
node dist/index.js demo --force
```

### 手动初始化

```bash
# 初始化数据库
node dist/index.js init

# 强制覆盖已存在的数据库
node dist/index.js init --force
```

## 命令说明

### 1. init - 初始化数据库

```bash
node dist/index.js init [options]

Options:
  -d, --data-dir <dir>  数据目录 (默认: .cmp-data)
  -f, --force           强制覆盖已存在的数据库
```

### 2. import - 导入数据

```bash
node dist/index.js import <type> <file> [options]

Types:
  contract    导入合同数据
  milestone   导入里程碑数据
  delivery    导入交付证明数据
  acceptance  导入验收单数据
  invoice     导入发票数据
  payment     导入收款流水数据

Options:
  -d, --data-dir <dir>    数据目录 (默认: .cmp-data)
  -o, --operator <name>   操作者 (默认: system)
```

### 3. check - 检查数据一致性

```bash
node dist/index.js check [options]

Options:
  -d, --data-dir <dir>   数据目录 (默认: .cmp-data)
  -m, --milestone <no>   指定里程碑编号检查
```

### 4. detail - 查看合同详情

```bash
node dist/index.js detail <contractNo> [options]

Options:
  -d, --data-dir <dir>   数据目录 (默认: .cmp-data)
  --history              显示历史记录
  --issues               显示问题
```

### 5. report - 生成汇总报告

```bash
node dist/index.js report [options]

Options:
  -d, --data-dir <dir>   数据目录 (默认: .cmp-data)
  -f, --format <format>  输出格式: table|json (默认: table)
```

### 6. demo - 运行内置演示

```bash
node dist/index.js demo [options]

Options:
  -d, --data-dir <dir>   数据目录 (默认: .cmp-data)
  -f, --force            强制覆盖已存在的数据库
```

## 数据格式

### 合同数据 (contract)

```json
[
  {
    "contractNo": "HT-2026-001",
    "name": "智能客服系统开发项目",
    "client": "科技股份有限公司",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "totalAmount": 1000000,
    "status": "active"
  }
]
```

### 里程碑数据 (milestone)

```json
[
  {
    "milestoneNo": "MS-001-01",
    "contractNo": "HT-2026-001",
    "name": "需求分析与设计",
    "amount": 200000,
    "expectedDeliveryDate": "2026-02-28",
    "description": "完成需求调研、原型设计和技术方案"
  }
]
```

### 交付证明 (delivery)

```json
[
  {
    "proofNo": "DP-001-01",
    "milestoneNo": "MS-001-01",
    "deliveryDate": "2026-02-25",
    "description": "需求规格说明书、技术方案文档",
    "status": "approved"
  }
]
```

### 验收单 (acceptance)

```json
[
  {
    "formNo": "AC-001-01",
    "milestoneNo": "MS-001-01",
    "acceptanceDate": "2026-03-05",
    "acceptedAmount": 200000,
    "description": "需求分析阶段验收",
    "status": "signed"
  }
]
```

### 发票 (invoice)

```json
[
  {
    "invoiceNo": "INV-2026-0001",
    "milestoneNo": "MS-001-01",
    "invoiceDate": "2026-03-10",
    "amount": 200000,
    "taxRate": 0.06,
    "status": "issued"
  }
]
```

### 收款流水 (payment)

```json
[
  {
    "paymentNo": "PAY-2026-0001",
    "invoiceNo": "INV-2026-0001",
    "paymentDate": "2026-03-25",
    "amount": 200000,
    "payer": "科技股份有限公司",
    "remark": "第一期付款"
  }
]
```

## 内置演示场景

运行 `node dist/index.js demo --force` 可体验以下场景：

### ✅ 正常回款 (HT-2026-001, MS-001-01)
- 需求分析阶段
- 交付证明已批准
- 验收单已签署
- 发票已开具
- 收款已到账
- **状态: 已回款 (paid)**

### ⚠️ 部分验收 (HT-2026-001, MS-001-02)
- 核心功能开发阶段
- 里程碑金额 40万，仅验收 35万
- 客户提出性能优化需求
- **状态: 部分回款 (partially_paid)**
- **问题: 部分验收，后续需要补充验收**

### 📄 发票未开 (HT-2026-003, MS-003-01)
- UI界面重构阶段
- 交付证明已批准
- 验收单已签署 (但日期早于交付日期)
- **未开具发票**
- 收款已到账但未匹配
- **状态: 已超期 (overdue)**
- **问题: 验收日期早于交付日期，需要开票**

### 💰 金额超额 (HT-2026-002, MS-002-02)
- 数据治理平台阶段
- 里程碑金额 30万
- 发票开具 35万
- **状态: 已超期 (overdue)**
- **问题: 发票金额超过里程碑金额**

### 🔄 重复流水
- 同一收款流水号 PAY-2026-0001 重复导入
- **系统自动跳过重复数据**

## 主要演示路径

### 路径1: 正常回款流程

```bash
# 1. 初始化
node dist/index.js init --force

# 2. 导入合同
node dist/index.js import contract contracts.json

# 3. 导入里程碑
node dist/index.js import milestone milestones.json

# 4. 导入交付证明
node dist/index.js import delivery deliveries.json

# 5. 导入验收单
node dist/index.js import acceptance acceptances.json

# 6. 导入发票
node dist/index.js import invoice invoices.json

# 7. 导入收款流水
node dist/index.js import payment payments.json

# 8. 检查一致性
node dist/index.js check

# 9. 查看合同详情
node dist/index.js detail HT-2026-001 --history --issues

# 10. 查看汇总报告
node dist/index.js report
```

### 路径2: 失败路径 (演示问题检测)

```bash
# 使用内置演示数据
node dist/index.js demo --force

# 查看检测到的问题
node dist/index.js check

# 查看具体合同的问题
node dist/index.js detail HT-2026-002 --issues

# 查看JSON格式报告
node dist/index.js report --format json
```

## 报告解读

运行 `node dist/index.js report` 后，报告包含以下关键指标：

### 全局汇总

| 指标 | 说明 |
|------|------|
| 合同总数 | 当前数据库中的合同数量 |
| 合同总金额 | 所有合同的总金额 |
| 已交付金额 | 有已批准交付证明的里程碑金额 |
| 已验收金额 | 有已签署验收单的金额 |
| 已开票金额 | 已开具发票的金额 |
| 已回款金额 | 已匹配收款的金额 |
| 待回款金额 | 合同总金额 - 已回款金额 |
| 超期未收 | 验收后30天未收的里程碑数量和金额 |
| 未匹配收款 | 无法匹配到发票/里程碑的收款 |

### 里程碑状态分布

- **未开始**: 没有任何交付证明
- **已交付**: 有已批准的交付证明
- **已验收**: 有已签署的验收单
- **已开票**: 有已开具的发票
- **已回款**: 已全额收到款项
- **部分回款**: 收到部分款项
- **已超期**: 验收后30天未收

### 问题级别

| 级别 | 颜色 | 说明 |
|------|------|------|
| 严重 | 红色粗体 | 需要立即处理的重大问题 |
| 高 | 红色 | 重要问题，需要尽快处理 |
| 中 | 黄色 | 中等问题，需要关注 |
| 低 | 青色 | 轻微问题，可延后处理 |

## 下一步跟进动作

报告末尾会根据当前数据状态生成建议的跟进动作，包括：

1. **紧急问题处理** - 严重级别的问题
2. **超期收款跟进** - 已超期未收的里程碑
3. **待匹配收款处理** - 未匹配的收款流水
4. **高优先级问题** - 高优先级的其他问题

## 项目结构

```
.
├── src/
│   ├── models/           # 数据模型
│   │   ├── types.ts      # 类型定义
│   │   └── schemas.ts    # 数据库模式
│   ├── storage/          # 数据存储
│   │   └── store.ts      # 数据存储管理器
│   ├── engine/           # 业务规则引擎
│   │   └── rules.ts      # 业务规则校验
│   ├── commands/         # CLI命令
│   │   ├── init.ts       # 初始化命令
│   │   ├── import.ts     # 导入命令
│   │   ├── check.ts      # 检查命令
│   │   ├── detail.ts     # 详情命令
│   │   └── report.ts     # 报告命令
│   ├── scripts/          # 脚本
│   │   └── run-demo.ts   # 演示脚本
│   ├── utils/            # 工具函数
│   │   └── importer.ts   # 数据导入器
│   └── index.ts          # 主入口
├── .cmp-data/            # 数据目录（运行时生成）
│   └── database.json     # 数据库文件
├── package.json
├── tsconfig.json
└── README.md
```

## 数据存储

所有数据存储在本地JSON文件中：

- **位置**: `.cmp-data/database.json`
- **格式**: JSON
- **可移植**: 可直接复制备份或迁移

## 幂等性保证

系统确保重复执行不会产生副作用：

1. 导入操作检查编号唯一性，重复数据自动跳过
2. 状态更新基于当前状态，重复更新产生相同结果
3. 操作历史记录每次动作，便于追溯
4. 人工修正必须记录前后差异和操作者

## License

MIT
