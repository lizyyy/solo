# 校园社团经费票据 CLI 工具

## 项目概述

本工具用于解决校园社团报销时，活动预算、票据和审批意见跨表错位的问题。通过统一的数据校验机制，确保：
- 活动预算已生效
- 票据导入可靠
- 审批状态与原始数据一致

## 安装

```bash
# 进入项目目录
cd /path/to/project

# 安装依赖
npm install

# 全局链接（可选，方便直接使用 club-reimburse 命令）
npm link
```

## 命令说明

### 1. init - 初始化

初始化工作目录并加载样例数据。

```bash
node index.js init
# 或
club-reimburse init
```

**输出说明：**
- 显示初始化进度
- 展示工作目录位置
- 列出样例活动信息

### 2. import - 导入数据

导入数据文件，支持 JSON 和 CSV 格式。

```bash
# 导入预算数据
node index.js import budgets.json -t budget

# 导入票据数据
node index.js import invoices.csv -t invoice

# 导入审批数据
node index.js import approvals.json -t approval
```

**参数说明：**
- `<file>`: 数据文件路径
- `-t, --type <type>`: 数据类型（必填）
  - `budget`: 预算数据
  - `invoice`: 票据数据
  - `approval`: 审批数据

**输出说明：**
- 成功导入的记录数量
- 新增记录数
- 更新记录数

### 3. check - 执行校验

执行数据校验，检查预算、票据和审批的一致性。

```bash
node index.js check
```

**校验规则：**

#### 预算检查
- **MISSING_BUDGET**: 活动没有对应的预算记录（FAIL）
- **BUDGET_NOT_APPROVED**: 预算状态不是 "approved"（WARN）
- **INVALID_BUDGET_AMOUNT**: 预算金额无效（WARN）

#### 票据检查
- **NO_INVOICES**: 活动没有对应的票据记录（FAIL）
- **MISSING_INVOICE_NUMBER**: 票据缺少编号（FAIL）
- **DUPLICATE_INVOICE_NUMBER**: 票据编号重复（FAIL）
- **INVALID_INVOICE_AMOUNT**: 票据金额无效（FAIL）
- **MISSING_INVOICE_DATE**: 票据缺少日期（WARN）
- **INVOICE_EXCEEDS_BUDGET**: 票据总金额超过预算（WARN）

#### 审批检查
- **MISSING_APPROVAL**: 活动没有对应的审批记录（FAIL）
- **MISSING_APPROVAL_STATUS**: 审批记录缺少状态（FAIL）
- **APPROVAL_AMOUNT_MISMATCH**: 审批金额与票据总金额不一致（WARN）
- **MISSING_APPROVER**: 审批记录缺少审批人（WARN）
- **MISSING_APPROVAL_DATE**: 审批记录缺少审批日期（WARN）

### 4. history - 查看历史

查看最近的校验历史记录。

```bash
# 查看最近 5 条记录（默认）
node index.js history

# 查看最近 10 条记录
node index.js history -l 10
```

**输出说明：**
- 校验时间
- 校验 ID
- 各状态活动数量统计

### 5. export - 导出结果

导出最近一次的校验结果。

```bash
# 导出为 JSON 格式（默认）
node index.js export result.json

# 导出为 CSV 格式
node index.js export result.csv -f csv
```

**参数说明：**
- `<output>`: 输出文件路径
- `-f, --format <format>`: 导出格式（可选）
  - `json`: JSON 格式（默认）
  - `csv`: CSV 格式

## 状态说明

### PASS（通过）
**输出表现：**
- 绿色 ✓ 符号
- 状态显示 "PASS"
- 没有任何问题列表

**含义：**
- 预算已审批通过
- 票据完整且无重复
- 审批记录完整且金额一致
- 所有数据匹配无误

**处理方式：**
- 可以正常进行报销流程
- 无需人工干预

### WARN（警告）
**输出表现：**
- 黄色 ⚠ 符号
- 状态显示 "WARN"
- 有黄色的警告信息

**含义：**
- 存在一些需要关注的问题
- 但不影响整体报销流程
- 可能是信息不完整或存在小的偏差

**处理方式：**
- 建议检查相关问题
- 可以继续报销流程，但建议后续补全信息
- 需要人工确认是否需要调整

### FAIL（失败）
**输出表现：**
- 红色 ✗ 符号
- 状态显示 "FAIL"
- 有红色的错误信息

**含义：**
- 存在严重问题
- 无法进行报销流程
- 必须修复后才能继续

**处理方式：**
- 必须人工处理
- 根据错误信息修复数据
- 修复后重新运行 `check` 命令
- 直到状态变为 PASS 或至少没有 FAIL 级别的问题

## 数据格式说明

### 预算数据（budget）

```json
{
  "activityId": "ACT-2026-001",
  "activityName": "春季校园文化节",
  "clubName": "学生会",
  "totalAmount": "15000.00",
  "status": "approved",
  "submittedBy": "张三",
  "submittedDate": "2026-03-01",
  "approvedDate": "2026-03-05"
}
```

**关键字段：**
- `activityId`: 活动编号（用于关联其他数据）
- `status`: 预算状态（approved / pending / rejected）
- `totalAmount`: 预算总金额

### 票据数据（invoice）

```json
{
  "activityId": "ACT-2026-001",
  "invoiceNumber": "INV-2026-0001",
  "description": "场地租赁",
  "amount": "5000.00",
  "date": "2026-03-15",
  "vendor": "校园活动中心"
}
```

**关键字段：**
- `activityId`: 活动编号（用于关联其他数据）
- `invoiceNumber`: 票据编号（必须唯一）
- `amount`: 票据金额

### 审批数据（approval）

```json
{
  "activityId": "ACT-2026-001",
  "activityName": "春季校园文化节",
  "status": "approved",
  "approver": "李主任",
  "approvalDate": "2026-03-20",
  "approvedAmount": "12500.00",
  "comments": "同意报销"
}
```

**关键字段：**
- `activityId`: 活动编号（用于关联其他数据）
- `status`: 审批状态
- `approvedAmount`: 审批通过的金额

## 验收场景

### 场景 1：正常处理（PASS）

**样例活动：** ACT-2026-003（志愿者招募活动）

**预期结果：**
- 状态：PASS
- 没有问题列表
- 所有数据完整匹配

**操作步骤：**
1. `init` 初始化
2. `check` 执行校验
3. 查看结果，确认状态为 PASS

### 场景 2：失败原因（FAIL）

**样例活动：** ACT-2026-002（编程大赛）

**预期结果：**
- 状态：FAIL
- 问题列表：
  - 预算状态为 "pending"（WARN）
  - 没有审批记录（FAIL）

**操作步骤：**
1. `init` 初始化
2. `check` 执行校验
3. 查看 FAIL 级别的问题
4. 分析失败原因

### 场景 3：修正后重跑

**操作步骤：**
1. 第一次 `check`，记录 FAIL 问题
2. 创建修复后的数据文件（例如：修复 ACT-2026-002 的预算状态为 approved，添加审批记录）
3. 使用 `import` 导入修复后的数据
4. 再次运行 `check`
5. 确认状态变为 PASS 或 WARN

## 项目结构

```
.
├── index.js              # 主入口文件
├── package.json          # 项目配置
├── examples/             # 样例数据目录
│   ├── budgets-sample.json
│   ├── invoices-sample.json
│   └── approvals-sample.json
├── lib/                  # 核心模块
│   ├── utils.js          # 工具函数
│   ├── dataStore.js      # 数据存储
│   ├── validator.js      # 校验逻辑
│   └── commands.js       # 命令处理器
└── .club-reimbursement/  # 工作目录（运行时生成）
    ├── data/             # 数据存储
    │   ├── budgets.json
    │   ├── invoices.json
    │   └── approvals.json
    └── history/          # 校验历史
```

## 常见问题

### Q: 为什么提示工作目录未初始化？
A: 请先运行 `init` 命令初始化工作目录。

### Q: 导入的数据会覆盖原有数据吗？
A: 不会，导入时会根据 activityId 进行匹配，已存在的会更新，不存在的会新增。

### Q: 校验历史保存在哪里？
A: 保存在 `.club-reimbursement/history/` 目录下。

### Q: 如何修复 FAIL 级别的问题？
A: 
1. 根据错误提示找出缺失或错误的数据
2. 创建正确的数据文件
3. 使用 `import` 命令导入
4. 重新运行 `check` 验证修复

## 许可

MIT License
