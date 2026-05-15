# 灰度配置对账命令行工具

## 项目概述

这是一个用于灰度发布配置对账的命令行工具，支持对账全流程管理，包括：任务创建、回执匹配、校验执行、人工修正、状态追踪和复盘审计。

## 启动方式

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 命令行使用
```bash
# 查看帮助
node src/index.js --help

# 查看命令帮助
node src/index.js list --help
```

## 样例来源

本工具包含真实业务样例数据，场景为**过期版本冻结通知对账**。

### 样例数据文件
| 文件 | 说明 |
|------|------|
| `tests/sample-source.json` | 对账源数据 - 版本冻结通知5条 |
| `tests/sample-receipts.json` | 回执数据 - 4条回执（含2条晚到、1条缺失） |
| `tests/sample-validation.json` | 校验结果 - 3条成功，1条失败（部分成功） |

### 运行样例
```bash
node tests/run-samples.js
```

样例将自动完成：创建对账 → 回执匹配 → 执行校验，然后提示后续操作命令。

## 命令参考

| 命令 | 说明 |
|------|------|
| `list` | 列出所有对账任务 |
| `list -s pending` | 按状态筛选 |
| `detail <id>` | 查看对账任务详情 |
| `review <id>` | 复盘对账任务（状态变化+催办列表） |
| `correct <reconId> <itemId>` | 人工修正明细状态 |

### 人工修正示例
```bash
node src/index.js correct <对账ID> <明细ID> \
  -s success \
  -o "张经理" \
  -r "线下已补签审批单，附件留存"
```

## 主流程说明

```
1. 创建对账任务
   ↓
2. 回执匹配
   ├─ 正常匹配 → matched
   ├─ 回执晚到 → receipt_late（生成催办记录）
   └─ 回执缺失 → 等待/逾期
   ↓
3. 校验执行
   ├─ 全部成功 → success
   ├─ 部分成功 → partial_success
   └─ 全部失败 → failed
   ↓
4. 人工修正（可选）→ manual_corrected
   ↓
5. 复盘审计
```

## 失败路径处理

### 1. 回执晚到处理
- **触发条件**：回执时间 > 截止时间
- **系统行为**：
  - 明细状态标记为 `overdue（回执逾期）`
  - 生成催办记录（类型：回执晚到）
  - 对账状态标记为 `receipt_late（回执晚到）`
- **人工处理**：联系相关部门确认原因

### 2. 校验失败处理
- **触发条件**：校验不通过（格式错误、字段缺失等）
- **系统行为**：
  - 明细状态标记为 `failed（执行失败）`
  - 生成催办记录（类型：校验失败）
  - 对账状态根据成功条数：
    - 部分成功 → `partial_success`
    - 全部失败 → `failed`
- **人工处理**：退回重提或人工修正

### 3. 回执缺失处理
- **触发条件**：截止时间已过但未收到回执
- **系统行为**：
  - 明细状态标记为 `waiting_receipt（等待回执）` 或 `overdue`
- **人工处理**：发送催办通知，线下沟通

## 核心特性

### ✅ 部分成功保留明细
- 不会因部分失败整批标记失败
- 每条明细独立记录状态
- 汇总统计成功/失败/等待数量

### ✅ 本地持久化存储
- 使用 lowdb 本地 JSON 文件存储
- 重启程序后历史数据不丢失
- 存储位置：`data/reconciliation.json`

### ✅ 人工修正留痕
- 记录操作人、时间、备注
- 状态变化轨迹可追溯
- 不直接覆盖原系统判断，保留历史记录

### ✅ 复盘审计支持
- 完整状态变化时间线
- 审批催办列表可定位
- 人工修正记录完整可查

## 状态定义

### 对账状态
| 状态码 | 显示名称 | 说明 |
|--------|----------|------|
| pending | 待处理 | 刚创建 |
| matched | 已匹配 | 回执匹配完成 |
| partial_success | 部分成功 | 部分明细校验通过 |
| success | 全部成功 | 所有明细校验通过 |
| failed | 对账失败 | 所有明细校验失败 |
| manual_corrected | 人工修正 | 已进行人工干预 |
| receipt_late | 回执晚到 | 有回执晚到情况 |

### 明细状态
| 状态码 | 显示名称 | 说明 |
|--------|----------|------|
| pending | 待核对 | 初始状态 |
| matched | 已匹配 | 回执匹配成功 |
| success | 执行成功 | 校验通过 |
| failed | 执行失败 | 校验不通过 |
| waiting_receipt | 等待回执 | 未收到回执 |
| overdue | 回执逾期 | 超期未收到回执 |
| manual_corrected | 人工修正 | 人工修改状态 |

## 文件结构
```
.
├── src/
│   ├── index.js          # 命令行入口
│   ├── reconciliation.js # 对账核心逻辑
│   ├── db.js             # 数据持久化
│   ├── constants.js      # 常量定义
│   └── cli-utils.js      # CLI显示工具
├── tests/
│   ├── run-samples.js    # 样例运行脚本
│   ├── sample-source.json    # 源数据
│   ├── sample-receipts.json  # 回执数据
│   └── sample-validation.json # 校验结果
├── data/
│   └── reconciliation.json   # 数据库文件（自动生成）
└── docs/
    └── README.md         # 本文档
```

## 验证数据持久化

1. 运行样例创建数据
```bash
node tests/run-samples.js
```

2. 查看对账列表，记录ID
```bash
node src/index.js list
```

3. 关闭终端，重新打开

4. 再次查看对账列表，数据应保持不变
```bash
node src/index.js list
```
