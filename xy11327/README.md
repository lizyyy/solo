# 农机合作社财务管理 CLI 工具

## 项目简介

这是一个专为农机合作社设计的财务管理CLI工具，支持按小时、亩数和油费的混合计费模式，提供导入、计费、复核、生成账单、历史查询等完整功能。

## 核心特性

- ✅ **混合计费模式**: 支持按小时、亩数、油费单独计费，或任意组合的混合计费
- ✅ **幂等性保证**: 重复提交或导入不会产生重复计费，结果稳定可预测
- ✅ **批量操作**: 批量导入、批量计费、批量复核，失败不影响已成功的记录
- ✅ **错误报告**: 批量操作失败时提供详细的错误列表和索引位置
- ✅ **敏感数据保护**: 身份证号、手机号等敏感字段在显示和日志中自动脱敏
- ✅ **持久化存储**: 使用SQLite数据库，命令间共享历史数据
- ✅ **完整工作流**: 导入 → 计费 → 复核 → 生成账单 → 签发 → 支付

## 安装

```bash
npm install
npm run build
npm link  # 全局安装命令
```

## 使用方法

### 1. 导入作业记录

```bash
# 从CSV文件导入
farm-coop-finance import examples/sample_records.csv
```

CSV文件支持中英文头：
- 记录编号/recordNo
- 拖拉机编号/tractorNo
- 机手姓名/operatorName
- 身份证号/operatorIdCard
- 电话/operatorPhone
- 作业日期/workDate
- 作业类型/workType
- 计费方式/billingType: hourly/小时, acreage/亩, fuel/油, mixed/混合
- 小时数/hours
- 亩数/acreage
- 油量/fuelUsed
- 油价/fuelPrice
- 小时单价/hourlyRate
- 亩单价/acreageRate
- 备注/remarks

### 2. 计费操作

```bash
# 对所有待计费记录进行计费
farm-coop-finance bill --all

# 对指定ID的记录进行计费
farm-coop-finance bill --id <记录ID>
```

### 3. 复核操作

```bash
# 查看待复核记录
farm-coop-finance review

# 复核通过所有待复核记录
farm-coop-finance review --all

# 复核通过指定记录
farm-coop-finance review --id <记录ID>

# 拒绝复核
farm-coop-finance review --id <记录ID> --reject
```

### 4. 生成账单

```bash
# 为指定机手生成指定期间的账单
farm-coop-finance generate-bill --start 2024-05-01 --end 2024-05-31 --operator 张三

# 为所有有机手生成指定期间的账单
farm-coop-finance generate-bill --start 2024-05-01 --end 2024-05-31
```

### 5. 查询历史记录

```bash
# 查询所有作业记录
farm-coop-finance history

# 按状态过滤
farm-coop-finance history --status reviewed

# 按机手过滤
farm-coop-finance history --operator 张三

# 查询账单列表
farm-coop-finance history --bills
```

### 6. 账单管理

```bash
# 签发账单
farm-coop-finance issue-bill <账单ID>

# 标记账单已支付
farm-coop-finance pay-bill <账单ID>
```

## 计费规则说明

### 默认单价
- 小时单价: 80元/小时
- 亩单价: 50元/亩
- 油价: 7.5元/升

### 计费方式
1. **按时计费 (hourly)**: 小时数 × 小时单价
2. **按亩计费 (acreage)**: 亩数 × 亩单价
3. **按油计费 (fuel)**: 耗油量 × 油价
4. **混合计费 (mixed)**: 以上三项之和

记录中可指定单价，未指定时使用默认值。

## 数据存储

数据存储在 `data/farm_coop.db` (SQLite数据库)

包含以下表:
- `work_records`: 作业记录表
- `billing_results`: 计费结果表
- `bills`: 账单表
- `bill_items`: 账单明细表
- `import_batches`: 导入批次记录

## 敏感数据处理

系统自动对以下敏感字段进行脱敏处理（显示4位掩码）：
- 身份证号 (operatorIdCard)
- 手机号 (operatorPhone)

脱敏规则: 前4位 + **** + 后4位，中间部分用*号替代。

## 目录结构

```
.
├── src/
│   ├── cli/           # CLI命令实现
│   ├── database/      # 数据库管理
│   ├── repositories/  # 数据访问层
│   ├── services/      # 业务逻辑层
│   ├── types/         # 类型定义
│   ├── utils/         # 工具函数
│   └── index.ts       # 入口文件
├── examples/          # 示例数据
├── data/              # 数据库文件
├── logs/              # 日志文件
├── package.json
└── tsconfig.json
```

## 开发命令

```bash
# 构建
npm run build

# 开发运行
npm run dev -- <命令>

# 代码检查
npm run lint
```

## 许可证

MIT
