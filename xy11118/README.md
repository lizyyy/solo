# 园区食堂餐补流水拆账 CLI

专为园区食堂餐补业务打造的命令行拆账工具，支持跨人交接、审计追踪、特殊情况分离处理。

## ✨ 核心特性

- 🔍 **完整审计追踪**：保留每一步操作变化，支持溯源和复核
- 🚦 **清晰退出码**：便于接入CI/CD和定时任务
- 📂 **特殊情况分离**：跨月退款、离职员工、复跑输出分别输出，不混入正常结果
- 🎯 **业务样例驱动**：内置真实园区食堂业务场景样例
- ⚙️ **可配置规则**：默认口径清晰，新人接手可直接跑通

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行样例（推荐新人第一步）

```bash
npm run demo
# 或
node src/cli.js --sample
```

### 3. 正常使用

```bash
# 使用默认配置
node src/cli.js --input data/your-data.csv

# 自定义配置和输出目录
node src/cli.js -c config/my-rules.json -i data/raw.csv -o result/ -a audit-log/
```

## 📋 退出码说明

| 退出码 | 含义 | 说明 |
|--------|------|------|
| 0 | 成功 | 处理完成，无特殊情况 |
| 1 | 参数错误 | 命令行参数缺失或无效 |
| 2 | 配置文件不存在 | 找不到指定的规则配置文件 |
| 3 | 输入文件不存在 | 找不到指定的CSV输入文件 |
| 4 | CSV格式错误 | 输入文件格式不正确 |
| 5 | 处理失败 | 业务处理过程中发生异常 |
| 6 | 输出失败 | 写入输出文件时出错 |
| 10 | 成功但有特殊情况 | 处理完成，但检测到需要人工复核的特殊情况 |

## 📁 目录结构

```
canteen-meal-subsidy-splitter/
├── src/                    # 源代码
│   ├── cli.js             # CLI入口
│   ├── splitter.js        # 核心拆账逻辑
│   ├── auditLogger.js     # 审计日志模块
│   └── constants.js       # 常量定义（退出码等）
├── config/                 # 规则配置
│   └── default.json       # 默认业务口径配置
├── data/                   # 输入数据
│   └── sample-input.csv   # 样例数据（包含各种业务场景）
├── output/                 # 输出目录
│   ├── normal-result.csv  # 正常结果
│   ├── cross-month-refund.csv    # 跨月退款（需复核）
│   ├── resigned-employee.csv     # 离职员工（需复核）
│   ├── rerun-output.csv          # 复跑输出（需复核）
│   └── summary.json       # 处理汇总
├── audit/                  # 审计日志（按时间戳命名）
└── package.json
```

## ⚙️ 配置说明

默认配置位于 `config/default.json`，包含：

```json
{
  "subsidyRules": {
    "dailyLimit": { "lunch": 25, "dinner": 30, "breakfast": 15 },
    "dinnerSubsidyRate": 0.8,      // 晚餐补贴80%
    "maxMonthlySubsidy": 800        // 月最高补贴
  },
  "classificationRules": {
    "crossMonthRefund": true,      // 跨月退款检测
    "resignedEmployee": true,      // 离职员工检测
    "rerunOutput": true            // 复跑输出检测
  },
  "businessNotes": [
    // 业务口径说明，方便交接
  ]
}
```

## 📝 审计日志

每次运行都会在 `audit/` 目录生成审计日志文件，包含：
- 处理开始/结束时间
- 每条记录的分类情况
- 应用的规则
- 检测到的特殊情况
- 输出文件信息

审计日志文件名格式：`audit-YYYY-MM-DDTHH-MM-SS.sssZ.json`

## 🔍 特殊情况检测

### 1. 跨月退款
- 条件：amount < 0 且 transactionDate 月份 ≠ originalMonth 月份
- 输出：`cross-month-refund.csv`
- 处理：**必须人工复核**后才能入账

### 2. 离职员工
- 条件：employeeStatus = '已离职' 或 transactionDate ≥ resignationDate
- 输出：`resigned-employee.csv`
- 处理：需HR确认后发放

### 3. 复跑输出
- 条件：processTag = 'RE-RUN' 或 rerunFlag = 'Y'
- 输出：`rerun-output.csv`
- 处理：需确认是否重复入账

## 💡 交接指南

### 新人接手步骤

1. **跑样例验证环境**：`npm run demo`
2. **查看样例数据**：`data/sample-input.csv` 了解业务字段
3. **学习默认配置**：`config/default.json` 熟悉业务口径
4. **查看审计日志**：`audit/` 目录下的最新日志
5. **查看输出结果**：`output/` 目录确认分类逻辑

### 修改规则

1. 复制 `config/default.json` 为新配置文件
2. 修改对应的补贴规则或业务口径
3. 使用 `-c` 参数指定新配置运行

## 🔧 CI/CD 集成示例

```bash
# 定时任务脚本示例
node src/cli.js --input data/daily.csv --output output/$(date +%Y%m%d)/

EXIT_CODE=$?

# 根据退出码处理
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 处理完成，无特殊情况"
elif [ $EXIT_CODE -eq 10 ]; then
  echo "⚠️  处理完成，但有特殊情况需要复核"
  # 发送邮件通知复核
else
  echo "❌ 处理失败，退出码: $EXIT_CODE"
  exit $EXIT_CODE
fi
```

## 📄 输入CSV字段说明

样例数据包含以下字段（可根据实际业务扩展）：

| 字段 | 说明 | 示例 |
|------|------|------|
| transactionId | 交易ID | TXN001 |
| employeeId | 员工工号 | E001 |
| employeeName | 员工姓名 | 张三 |
| department | 部门 | 研发部 |
| mealType | 餐别 | 午餐/晚餐/早餐 |
| transactionDate | 交易日期 | 2024-03-01 |
| amount | 金额 | 25.00 |
| originalMonth | 原消费月份 | 2024-03 |
| employeeStatus | 员工状态 | 在职/已离职 |
| resignationDate | 离职日期 | 2024-02-28 |
| processTag | 处理标记 | RE-RUN |
| rerunFlag | 复跑标记 | Y |
| location | 食堂位置 | 科技园A座食堂 |

## 📄 输出字段说明

输出文件在原字段基础上增加分类元数据：

| 新增字段 | 说明 |
|----------|------|
| _recordId | 记录标识 |
| _classifiedAt | 分类时间 |
| _classificationReason | 分类原因 |
| _finalAmount | 计算后最终补贴金额（仅正常结果） |
| _appliedRules | 应用的规则（仅正常结果） |

---

**注意**：所有样例和配置均已包含在项目内，不依赖外网服务，可离线运行。
