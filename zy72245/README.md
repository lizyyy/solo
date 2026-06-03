# 绿色债券投向占比核验系统

## 概述

本系统用于基金会计在日常工作中对绿色债券投向占比进行核验，覆盖从柜台流水尾号导入到余额变化表更新的完整流程。系统特别处理了"审批人只留了拼音"这一常见情况，将其纳入正常流程而非边缘情况。

## 边界规则：审批人只留了拼音

### 判定规则

审批人字段满足以下任一条件即判定为"拼音审批人"：

| 条件 | 示例 |
|------|------|
| 全部由英文字母组成（2个及以上字母） | `zhangsan`、`LS` |
| 英文字母+空格分隔的多段拼音 | `zhang san`、`lin jie` |
| 在常见拼音名单中 | `zhangsan`、`lisi` |
| 审批人字段为空 | （空字符串） |

**不判定为拼音的情况**：审批人字段包含任何中文字符，如`张三`、`林姐（linjie）`。

### 处理流程

```
审批人只留了拼音
    ↓
标记为 pinyin_only，核验状态保持 pending
    ↓
不能直接跳到"余额变化表更新"步骤
    ↓
必须先进入"补看客户经理补充邮件"步骤
    ↓
客户经理复核确认后，修改审批人为正确中文名
    ↓
修改后仍需客户经理复核确认（requires_review = true）
    ↓
复核通过后方可继续后续步骤
```

### 修改规则

- 通过 `POST /api/transactions/{id}/fix-approver` 修改审批人
- 修改后系统自动重新判定状态（拼音/正常）
- **即使改为中文名，仍标记为需复核**，防止随便填个名字就过
- 修改记录写入 `transaction_history` 表，保留改前改后

### 回滚规则

- 通过 `POST /api/verifications/{id}/rollback` 回滚
- 回滚到上一步骤，删除当前步骤的核验记录
- 若回滚"余额变化表更新"，同时删除对应的余额变化记录
- 初始步骤（柜台流水尾号导入）不可回滚

## 三步核验流程

```
步骤1：柜台流水尾号导入
  ├─ 支持批量导入
  ├─ 重复导入同一批尾号不会翻倍核验数量
  └─ 自动检测拼音审批人

步骤2：基金会计补看客户经理补充邮件
  ├─ 录入补充邮件（发件人+内容）
  ├─ 拼音审批人必须经过此步骤
  └─ 提供审批人修正入口

步骤3：余额变化表更新
  ├─ 必须提供新余额
  ├─ 拼音审批人未解决时不可进入此步骤
  └─ 更新后核验状态变为 approved
```

**步骤顺序强制校验**：不可跳步，必须按 1→2→3 顺序推进。

## 重复导入处理

- 以 `tail_number + approver` 组合作为去重键
- 重复导入时跳过已存在的记录，返回跳过原因
- 核验数量不会因重复导入而翻倍

## 历史变更追踪

- 所有字段修改（备注、审批人）均记录到 `transaction_history` 表
- 每条记录包含：字段名、旧值、新值、修改人、修改时间
- 即使只改一条备注，历史中也能看到改前改后的完整差别
- 字段名显示为中文（如"审批人"而非"approver"）

## 3D/图表展示

- `/api/verifications/chart-data` 提供汇总数据和拼音审批人明细
- 点击拼音审批人条目可追溯到：
  - 柜台流水尾号详情（`trace_links.transaction_detail`）
  - 客户经理补充邮件（`trace_links.supplementary_emails`）
  - 复核页面（`trace_links.approver_review`）
- 不会只剩"漂亮画面"，所有数据都有溯源链接

## 错误提示

所有错误信息使用中文人话，不暴露内部字段名：

| 内部代码 | 用户看到的提示 |
|---------|-------------|
| `DUPLICATE_IMPORT` | 这批柜台流水尾号已经导入过了，不会重复计算核验数量 |
| `MISSING_TAIL_NUMBER` | 柜台流水尾号不能为空 |
| `PINYIN_APPROVER_DETECTED` | 审批人只有拼音（如"zhangsan"），已标记为待客户经理复核，不会自动归为正常 |
| `STEP_ORDER_VIOLATION` | 流程步骤顺序不对，请按 导入→补看邮件→余额更新 的顺序操作 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/transactions/import` | 批量导入柜台流水 |
| GET | `/api/transactions/{id}` | 查询流水详情 |
| PATCH | `/api/transactions/{id}/update` | 修改备注/审批人 |
| POST | `/api/transactions/{id}/fix-approver` | 修正审批人 |
| GET | `/api/transactions/{id}/history` | 查看变更历史 |
| GET | `/api/transactions/{id}/emails` | 查看补充邮件 |
| POST | `/api/transactions/{id}/emails` | 添加补充邮件 |
| GET | `/api/transactions/{id}/review` | 复核页面（含溯源链接） |
| GET | `/api/verifications` | 列出核验记录 |
| GET | `/api/verifications/{id}/trace` | 核验溯源（3D/图表用） |
| POST | `/api/verifications/{id}/advance` | 推进核验步骤 |
| POST | `/api/verifications/{id}/rollback` | 回滚核验步骤 |
| GET | `/api/verifications/chart-data` | 图表数据（含拼音审批人明细） |

## 启动

```bash
pip install flask
python -m src.app
```

## 测试

```bash
python -m pytest tests/ -v
```
