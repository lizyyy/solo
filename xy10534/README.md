# 发版依赖窗口 CLI

一款用于多服务发版前检查的命令行工具，帮助发布经理在排多服务上线时，提前发现依赖服务窗口未对齐、数据库迁移缺回滚、配置开关未预置、回滚联系人缺失等问题。

## 功能特性

- 🔍 **依赖窗口检查**：自动检测依赖服务是否晚于调用方发布
- 🗄️ **数据库迁移检查**：检查迁移脚本是否有回滚脚本、前置迁移是否已执行
- ⚙️ **配置开关检查**：确认发布前配置是否已在配置中心预置
- 📞 **回滚联系人检查**：确保每个服务都有可用的回滚联系人
- 📜 **豁免管理**：支持豁免特定检查项，自动检测过期豁免
- 📊 **检查历史**：每次检查都记录历史，可追溯
- 📝 **推荐发布顺序**：基于依赖关系自动计算推荐发布顺序
- 📋 **报告生成**：支持文本和 JSON 格式报告导出

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装依赖

```bash
npm install
```

### 本地启动

```bash
# 使用 ts-node 直接运行（开发模式）
npm run cli -- <command>

# 编译后运行
npm run build
node dist/index.js <command>
```

## 主要命令

### 1. init - 初始化发版计划

```bash
# 初始化空白发版计划
npm run cli -- init release-2026-05 "5月发版计划"

# 使用内置样例数据初始化（包含多种问题场景，用于演示）
npm run cli -- init release-demo "演示发版" --sample

# 使用成功通过样例初始化（所有检查都通过）
npm run cli -- init release-success "成功样例" --success-sample

# 指定数据目录
npm run cli -- init release-001 "测试" --data-dir ./my-data
```

内置样例覆盖 **订单服务、支付服务、库存服务、通知服务** 四个核心服务。

### 2. check - 执行发版前检查

```bash
npm run cli -- check

# 指定操作人
npm run cli -- check --operator "张三"
```

检查结果会显示：
- **阻断项 (Blocking)**：必须修复才能发布
- **警告项 (Warning)**：建议修复但不强制阻断
- **通过项 (Passed)**：检查通过
- **豁免项 (Waived)**：已申请豁免的检查项
- **推荐发布顺序**：基于依赖关系的推荐顺序

### 3. detail - 查看详细信息

```bash
# 查看发版计划概览
npm run cli -- detail

# 查看指定服务详情
npm run cli -- detail --service "订单服务"
npm run cli -- detail --service "svc-order"

# 查看检查历史
npm run cli -- detail --history

# 查看某次检查的详细结果
npm run cli -- detail --check-history-id <history-id>
```

### 4. import - 导入发布数据

```bash
# 从 JSON 文件导入数据
npm run cli -- import ./sample-import.json

# 只导入特定类型的数据
npm run cli -- import ./data.json --type services
npm run cli -- import ./data.json --type dependencies
npm run cli -- import ./data.json --type migrations
npm run cli -- import ./data.json --type switches
npm run cli -- import ./data.json --type contacts
npm run cli -- import ./data.json --type waivers
```

数据格式参考 `sample-import.json`。

### 5. report - 生成检查报告

```bash
# 在控制台输出文本报告
npm run cli -- report

# 导出文本报告到文件
npm run cli -- report --output release-report.txt

# 导出 JSON 格式报告
npm run cli -- report --format json --output release-report.json
```

## 内置样例说明

### 样例服务

1. **库存服务 (svc-inventory)** v2.3.0
   - 发布窗口：20:00 - 21:00
   - 数据库迁移：无回滚脚本 ❌
   - 回滚联系人：赵六 ✓

2. **支付服务 (svc-payment)** v1.8.2
   - 发布窗口：21:00 - 22:00
   - 配置开关：未预置 ❌
   - 主要联系人：李四（不可用）❌

3. **订单服务 (svc-order)** v3.1.0
   - 发布窗口：22:00 - 23:00
   - 前置迁移：未执行 ❌
   - 强依赖：库存服务、支付服务

4. **通知服务 (svc-notification)** v1.5.0
   - 发布窗口：23:00 - 00:00
   - 弱依赖：订单服务
   - 回滚联系人：未配置 ❌

### 依赖关系图

```
库存服务 ──┐
            ├──→ 订单服务 ──→ 通知服务
支付服务 ──┘
              (强依赖)         (弱依赖)
```

## 演示路径

### 路径一：失败演示（默认样例）

```bash
# 1. 初始化带问题的样例数据
npm run cli -- init release-demo "演示发版" --sample

# 2. 执行检查，查看阻断项
npm run cli -- check --operator "发布经理"
```

预期结果：**6 个阻断项**
1. 订单服务前置数据库迁移未执行
2. 库存服务数据库迁移无回滚脚本
3. 库存服务前置迁移未执行
4. 支付服务配置开关未预置
5. 支付服务主要联系人不可用
6. 通知服务缺少回滚联系人

### 路径二：成功演示

```bash
# 1. 初始化成功样例数据
npm run cli -- init release-success "成功发版" --success-sample --data-dir ./success-demo

# 2. 执行检查，全部通过
npm run cli -- check --operator "发布经理" --data-dir ./success-demo

# 3. 生成报告
npm run cli -- report --output success-report.txt --data-dir ./success-demo
```

预期结果：**0 个阻断项，可发布**

### 路径三：逐步修复演示

```bash
# 1. 先使用默认样例
rm -rf .release-data
npm run cli -- init release-001 "逐步修复演示" --sample

# 2. 第一次检查（有阻断项）
npm run cli -- check --operator "张三"

# 3. 查看检查历史
npm run cli -- detail --history

# 4. 修复后再次检查（幂等）
npm run cli -- check --operator "张三"

# 5. 查看特定服务详情
npm run cli -- detail --service "订单服务"

# 6. 生成最终报告
npm run cli -- report --output final-report.txt
```

## 检查规则详解

### 1. 依赖服务窗口检查

**规则**：
- 强依赖：被依赖服务必须在调用方之前完成发布
- 弱依赖：建议被依赖服务提前，但不强制阻断
- 如果依赖服务窗口结束时间晚于调用方窗口开始时间，则判定为问题

**修复建议**：
- 调整发布窗口，确保被依赖服务先发布
- 或者将依赖类型从强依赖改为弱依赖（需要评估风险）

### 2. 数据库迁移检查

**规则**：
- 所有数据库迁移脚本必须有对应的回滚脚本
- 前置迁移（preDeploy）必须在发布前执行
- 后置迁移（postDeploy）如果提前执行会警告

**修复建议**：
- 编写回滚脚本 `U<version>__*.sql`
- 发布前执行前置迁移
- 确认后置迁移的执行时机

### 3. 配置开关检查

**规则**：
- 发布涉及的配置开关必须在配置中心预置

**修复建议**：
- 在配置中心（如 Apollo、Nacos、Spring Cloud Config）预置目标值
- 确认 `preConfigured` 字段设为 `true`

### 4. 回滚联系人检查

**规则**：
- 每个服务必须至少配置一名回滚联系人
- 必须有指定的主要联系人
- 主要联系人必须可用

**修复建议**：
- 为所有服务配置联系人
- 设置 `isPrimary: true` 指定主要联系人
- 确保主要联系人 `available: true`

### 5. 豁免过期检查

**规则**：
- 豁免有有效期，过期的豁免自动失效
- 豁免只对特定检查类型和服务生效

**修复建议**：
- 及时更新豁免审批
- 豁免到期后重新申请

## 数据存储

- 默认数据目录：`./.release-data/`
- 数据文件：`release-data.json`
- 自动备份：每次 import 前会自动创建备份文件
- 检查历史：每次 check 都会记录到 `checkHistory` 数组

## 数据模型

### ServiceReleasePlan（服务发布计划）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 服务唯一标识 |
| name | string | 服务名称 |
| version | string | 发布版本 |
| plannedTime | string | 计划发布时间 |
| windowStart | string | 发布窗口开始 |
| windowEnd | string | 发布窗口结束 |
| status | string | 状态：planned/in-progress/completed/failed |
| environment | string | 环境 |
| notes | string | 备注 |

### Dependency（依赖关系）

| 字段 | 类型 | 说明 |
|------|------|------|
| callerServiceId | string | 调用方服务ID |
| calleeServiceId | string | 被调用方服务ID |
| dependencyType | string | hard/soft |
| windowAlignmentRequired | boolean | 是否需要窗口对齐 |

### DatabaseMigration（数据库迁移）

| 字段 | 类型 | 说明 |
|------|------|------|
| serviceId | string | 所属服务ID |
| scriptName | string | 迁移脚本名称 |
| version | string | 版本 |
| hasRollback | boolean | 是否有回滚脚本 |
| rollbackScript | string | 回滚脚本名称 |
| migrationType | string | schema/data/both |
| preDeploy | boolean | 是否前置迁移 |
| postDeploy | boolean | 是否后置迁移 |
| executed | boolean | 是否已执行 |

### ConfigSwitch（配置开关）

| 字段 | 类型 | 说明 |
|------|------|------|
| serviceId | string | 所属服务ID |
| key | string | 配置键名 |
| targetValue | string | 目标值 |
| currentValue | string | 当前值 |
| preConfigured | boolean | 是否已预置 |
| switchOrder | number | 开关顺序 |

### RollbackContact（回滚联系人）

| 字段 | 类型 | 说明 |
|------|------|------|
| serviceId | string | 所属服务ID |
| name | string | 姓名 |
| role | string | 角色 |
| phone | string | 电话 |
| email | string | 邮箱 |
| isPrimary | boolean | 是否主要联系人 |
| available | boolean | 是否可用 |

## 最佳实践

1. **发布前必查**：每次发布前都执行 `check` 命令
2. **检查历史**：使用 `detail --history` 查看历史检查结果
3. **导出报告**：发布会后留档，使用 `report --output` 导出
4. **多环境隔离**：使用 `--data-dir` 为不同环境创建独立数据目录
5. **幂等检查**：可以多次执行 `check`，每次都会记录新的历史

## 常见问题

### Q: 如何修复阻断项？

A: 根据检查结果中的"建议"字段操作，然后：
- 如果是数据问题，修改 `release-data.json` 文件
- 或者使用 `import` 命令导入修正后的数据
- 重新执行 `check` 验证

### Q: 可以豁免某些检查吗？

A: 可以通过添加 `waivers` 数据来豁免。豁免包含：
- 关联的检查类型
- 服务范围
- 审批人
- 有效期

### Q: 如何处理多个发版计划？

A: 使用 `--data-dir` 参数为每个发版计划创建独立的数据目录：

```bash
# 发版计划 A
npm run cli -- init plan-a "计划A" --data-dir ./plans/plan-a

# 发版计划 B
npm run cli -- init plan-b "计划B" --data-dir ./plans/plan-b
```

## License

MIT
