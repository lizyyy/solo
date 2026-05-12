# 财务批量退款异常拦截 CLI

## 简介

这是一个用于财务批量退款前进行异常拦截的命令行工具。它可以帮助财务人员在批量打退款之前，自动识别并拦截以下风险：

- **重复退款**：同一订单被多次申请退款
- **金额异常**：退款金额超过实付金额或部分退款累计超额
- **黑名单账户**：历史有恶意退款记录的账户
- **审批缺失/过期**：缺少有效审批记录或审批已过期

## 系统架构

```
CLI 命令层 (cli.py)
        ↓
业务逻辑层 (service.py)
        ↓
规则引擎层 (rules.py) ── 5 条核心规则
        ↓
数据模型层 (models.py)
        ↓
数据存储层 (storage.py) ── JSON 文件存储
```

## 核心规则说明

| 规则名称 | 检查内容 | 严重程度 |
|---------|---------|---------|
| `duplicate_refund_check` | 检查是否存在重复退款申请（待处理中或已历史退款） | 🔴 禁止打款 |
| `amount_insufficient_check` | 退款金额是否超过实付金额 | 🔴 禁止打款 |
| `blacklist_check` | 退款账户是否在黑名单中 | 🔴 禁止打款 |
| `approval_expired_check` | 是否有有效审批、审批金额是否匹配、审批是否过期 | 🟡 需复核 |
| `partial_refund_exceeded_check` | 历史退款累计 + 当前申请 是否超过实付金额 | 🟡 需复核 |

**状态分类：**
- ✅ **可打款 (approved)**：所有规则检查通过
- 🟡 **需复核 (review_required)**：非关键规则失败，需人工确认
- 🚫 **禁止打款 (blocked)**：关键规则失败，高风险操作
- ⏳ **待检查 (pending)**：尚未执行规则检查

## 快速开始

### 1. 环境准备

```bash
# 进入项目目录
cd /Users/mac/pro/solo/workspaces/xy10586

# 创建虚拟环境（可选）
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 安装 CLI 工具
pip install -e .
```

### 2. 一键演示（推荐）

```bash
# 一键完整演示：初始化 → 导入样例数据 → 执行检查 → 生成报告
refund-interceptor demo
```

演示将自动执行以下步骤：

1. 初始化工作目录
2. 创建 6 条退款申请样例数据
3. 导入所有相关数据（支付、黑名单、审批、历史退款）
4. 执行完整的规则检查
5. 输出最终报告

### 3. 分步操作

#### 步骤 1：初始化工作目录

```bash
# 在当前目录初始化
refund-interceptor init

# 或指定工作目录
refund-interceptor -w /path/to/workspace init

# 初始化并同时创建样例数据
refund-interceptor init --with-samples
```

初始化成功后会在工作目录创建 `.refund_data/` 文件夹。

#### 步骤 2：准备数据文件

数据文件需要是 JSON 格式，可以参考内置样例数据（在 `.refund_data/imports/` 目录下）。

**订单支付数据格式 (payments.json):**
```json
[
  {
    "order_id": "ORD-001",
    "user_id": "USER-001",
    "user_account": "alipay_001@example.com",
    "amount": 1000.00,
    "paid_at": "2024-01-01 12:00:00",
    "currency": "CNY",
    "status": "success"
  }
]
```

**黑名单数据格式 (blacklist.json):**
```json
[
  {
    "account": "blacklisted_user@example.com",
    "reason": "历史多次恶意退款记录",
    "added_at": "2024-01-01 12:00:00",
    "added_by": "风控管理员",
    "is_active": true
  }
]
```

**审批记录格式 (approvals.json):**
```json
[
  {
    "approval_id": "APR-001",
    "order_id": "ORD-001",
    "refund_request_id": "REQ-001",
    "approver": "张经理",
    "amount": 500.00,
    "status": "approved",
    "approved_at": "2024-01-02 10:00:00",
    "expires_at": "2024-01-09 10:00:00",
    "reason": "商品质量问题"
  }
]
```

**历史退款格式 (historical_refunds.json):**
```json
[
  {
    "refund_id": "REF-001",
    "order_id": "ORD-001",
    "amount": 300.00,
    "processed_at": "2024-01-05 14:00:00",
    "status": "success",
    "processor": "财务人员A"
  }
]
```

**退款申请格式 (refund_requests.json):**
```json
[
  {
    "request_id": "REQ-001",
    "order_id": "ORD-001",
    "user_account": "alipay_001@example.com",
    "amount": 500.00,
    "reason": "商品质量问题，部分退款",
    "requested_at": "2024-01-10 09:00:00",
    "requested_by": "客服小王"
  }
]
```

#### 步骤 3：导入数据

```bash
# 导入订单支付数据
refund-interceptor import payments path/to/payments.json

# 导入黑名单
refund-interceptor import blacklist path/to/blacklist.json

# 导入审批记录
refund-interceptor import approvals path/to/approvals.json

# 导入历史退款记录
refund-interceptor import historical path/to/historical_refunds.json

# 导入退款申请
refund-interceptor import requests path/to/refund_requests.json
```

**注意**：导入操作是幂等的，重复导入相同数据不会产生重复记录。

#### 步骤 4：执行规则检查

```bash
# 检查所有退款申请
refund-interceptor check
```

输出结果示例：
```
┌──────────────────────────────────────────────────────────────────────────┐
│                             检查结果汇总                                 │
├──────────┬──────────┬──────────┬──────────────────┬─────────────────────┤
│ 申请ID    │ 订单ID    │ 金额      │      状态        │ 失败规则            │
├──────────┼──────────┼──────────┼──────────────────┼─────────────────────┤
│ REQ-001  │ ORD-001  │ ¥500.00  │    ✅ 可打款      │ -                   │
│ REQ-002  │ ORD-002  │ ¥500.00  │   🚫 禁止打款    │ duplicate_refund_   │
│          │          │          │                  │ check               │
│ REQ-003  │ ORD-003  │ ¥2,500.00│   🚫 禁止打款    │ amount_insufficient_│
│          │          │          │                  │ check               │
│ REQ-004  │ ORD-004  │ ¥800.00  │   🚫 禁止打款    │ blacklist_check     │
│ REQ-005  │ ORD-005  │ ¥300.00  │   ⚠️  需复核     │ approval_expired_   │
│          │          │          │                  │ check               │
│ REQ-006  │ ORD-006  │ ¥300.00  │   ⚠️  需复核     │ approval_expired_   │
│          │          │          │                  │ check, partial_     │
│          │          │          │                  │ refund_exceeded_    │
│          │          │          │                  │ check               │
└──────────┴──────────┴──────────┴──────────────────┴─────────────────────┘
```

#### 步骤 5：查看详情

```bash
# 查看某个退款申请的完整详情
refund-interceptor detail REQ-001
```

详情包括：
- 退款申请基本信息
- 订单支付信息（含历史退款累计、剩余可退金额）
- 黑名单状态（如有）
- 审批记录
- 历史退款记录
- 规则检查结果（每项规则的通过/失败详情）
- 人工修正记录（如有）

#### 步骤 6：生成报告

```bash
# 表格格式报告（默认）
refund-interceptor report

# JSON 格式报告（便于程序处理）
refund-interceptor report -f json
```

报告将分为三类：
- ✅ **可打款清单**：可以安全打款的申请
- 🟡 **需复核清单**：需要人工确认的申请，附带问题规则
- 🚫 **禁止打款清单**：高风险，应拒绝打款

#### 步骤 7：人工修正（如需要）

如果发现数据有误，可以进行人工修正。所有修正都会被记录，留下审计痕迹。

```bash
# 修正退款金额
refund-interceptor correct REQ-003 \
  --field amount \
  --value 2000 \
  --operator "财务主管" \
  --reason "退款金额填写错误，原实付金额为 2000 元"
```

修正后需要重新运行 `check` 命令进行验证。

## 样例数据场景说明

内置的 6 条退款申请覆盖了以下场景：

| 申请ID | 场景 | 预期结果 | 说明 |
|--------|------|---------|------|
| **REQ-001** | 正常退款 | ✅ 可打款 | 实付 ¥1000，历史已退 ¥300，本次申请 ¥500（剩余可退 ¥700），审批有效 |
| **REQ-002** | 重复退款 | 🚫 禁止打款 | 订单 ORD-002 已在 5 天前全额退款 ¥500，本次再次申请全额退款 |
| **REQ-003** | 金额超限 | 🚫 禁止打款 | 实付 ¥2000，申请退款 ¥2500，超过实付金额 |
| **REQ-004** | 黑名单账户 | 🚫 禁止打款 | 退款账户在黑名单中（历史多次恶意退款） |
| **REQ-005** | 审批缺失 | 🟡 需复核 | 缺少审批记录，无法确认授权 |
| **REQ-006** | 审批过期 + 超额 | 🟡 需复核 | 审批已过期，且历史退款累计 ¥800 + 本次申请 ¥300 = ¥1100 > 实付 ¥1500？不，1100<1500，但审批过期了 |

## 主要演示路径

### 路径 1：正常流程（可打款）

```bash
refund-interceptor demo
refund-interceptor detail REQ-001
```

查看 REQ-001 的详情，可以看到：
- 所有 5 条规则检查通过
- 实付 ¥1000，历史已退 ¥300，剩余可退 ¥700
- 本次申请 ¥500，在可退范围内
- 审批有效且未过期

### 路径 2：失败路径（禁止打款）

```bash
refund-interceptor detail REQ-002
```

查看 REQ-002 的详情，可以看到失败原因：
- `duplicate_refund_check` 规则失败
- 原因：检测到 1 个重复退款记录
- 详情显示：历史退款 REF-002 于 5 天前已处理，金额 ¥500

## 幂等性保证

工具在多处实现了幂等性：

1. **数据导入**：重复导入相同数据不会产生重复记录（以主键去重）
2. **规则检查**：重复执行检查不会累积状态，每次都是基于当前数据重新计算
3. **历史记录**：每次检查结果都会保存到 `historical_checks` 字段，便于追溯
4. **人工修正**：每次修正都生成独立的 `correction_id`，记录完整的变更历史

## 审计追踪

所有操作都留下可追溯的记录：

- **修正记录**：`corrections.json` 记录所有人工修正的前后差异
- **检查历史**：每个退款申请都保存每次检查的历史结果
- **状态变更**：工作空间状态文件记录初始化时间、最后导入时间、最后检查时间

## 目录结构

```
工作目录/
├── .refund_data/                # 数据存储目录
│   ├── workspace_state.json     # 工作空间状态
│   ├── payments.json            # 订单支付数据
│   ├── blacklist.json           # 黑名单
│   ├── approvals.json           # 审批记录
│   ├── historical_refunds.json  # 历史退款
│   ├── refund_requests.json     # 退款申请（含检查结果）
│   ├── corrections.json         # 人工修正记录
│   ├── imports/                 # 导入文件目录
│   └── exports/                 # 导出目录
└── 你的数据文件.json             # 用户准备的数据文件
```

## 注意事项

1. **数据格式**：确保 JSON 文件格式正确，日期格式支持 `YYYY-MM-DD HH:MM:SS` 或 `YYYY-MM-DDTHH:MM:SS`
2. **金额精度**：金额使用 float 类型，实际生产环境建议使用 Decimal
3. **审批关联**：审批记录通过 `refund_request_id` 与退款申请关联
4. **状态重置**：人工修正后，退款申请状态会重置为 `pending`，需要重新检查

## 命令参考

| 命令 | 说明 |
|------|------|
| `init` | 初始化工作目录 |
| `init --with-samples` | 初始化并创建样例数据 |
| `import payments <file>` | 导入订单支付数据 |
| `import blacklist <file>` | 导入黑名单 |
| `import approvals <file>` | 导入审批记录 |
| `import historical <file>` | 导入历史退款 |
| `import requests <file>` | 导入退款申请 |
| `check` | 执行规则检查 |
| `detail <request_id>` | 查看申请详情 |
| `report` | 生成检查报告 |
| `report -f json` | 生成 JSON 格式报告 |
| `correct` | 人工修正退款申请 |
| `demo` | 一键完整演示 |

## 问题排查

### Q: 提示"工作目录未初始化"
A: 请先执行 `refund-interceptor init` 命令初始化工作目录。

### Q: 导入数据后检查结果不对
A: 请确认数据关联关系正确：
- 审批记录的 `refund_request_id` 必须与退款申请的 `request_id` 匹配
- 历史退款的 `order_id` 必须与订单支付的 `order_id` 匹配
- 黑名单的 `account` 必须与退款申请的 `user_account` 匹配

### Q: 如何查看完整的错误原因？
A: 使用 `refund-interceptor detail <request_id>` 可以查看每条规则检查的详细信息和失败原因。
