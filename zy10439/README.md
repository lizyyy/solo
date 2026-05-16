# 密钥到期催办系统

## 系统概述

这是一个用于管理系统账号密钥到期提醒的REST API服务，解决了"只发一封邮件、负责人休假没人接手"的问题。

## 核心特性

- **到期分级提醒**: 30天、15天、7天、3天、已过期五个等级
- **负责人转交**: 支持休假时的责任交接
- **催办去重**: 同一密钥同一级别不会重复生成催办
- **状态机管理**: 严格的状态流转控制
- **完整审计**: 所有状态变更都有记录，可追溯
- **异常保留**: 错误路径保留原始输入和错误信息
- **数据导出**: 支持CSV格式导出催办记录和流转历史

## 数据模型

### 1. SystemAccount (系统账号)
- account_name: 账号名称
- system_name: 所属系统
- environment: 环境（生产/UAT/开发等）

### 2. KeyInfo (密钥信息)
- key_name: 密钥名称
- key_purpose: 密钥用途
- expiry_date: 到期时间
- owner: 负责人
- backup_owner: 备份负责人

### 3. ReminderRecord (催办记录)
- expiry_level: 到期分级
- status: 当前状态
- current_owner: 当前负责人
- reminder_count: 催办次数
- last_reminder_at: 上次催办时间
- escalated_to: 已升级到
- raw_input: 原始输入（异常追踪用）
- error_message: 错误信息

### 4. ProcessingConclusion (处理结论)
- conclusion_type: 结论类型
- conclusion: 具体结论
- processed_by: 处理人
- follow_up_action: 后续行动
- next_review_date: 下次复核时间

### 5. StatusTransition (状态流转)
- from_status: 源状态
- to_status: 目标状态
- transition_reason: 流转原因
- operator: 操作人
- transition_at: 操作时间

## 状态机设计

```
pending (待处理)
    ↓
reminder_sent (已催办)
    ↓
escalated (已升级)
    ↓
transferred (已转交)
    ↓
processed (已处理) ←→ error (异常)
    ↑
expired (已过期)
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 运行测试

```bash
# 确保requests库已安装
pip install requests

# 运行完整工作流测试
python test_reminder.py

# 运行去重逻辑测试
python test_reminder.py duplicate
```

## API接口文档

### 系统账号管理

#### POST /api/accounts
创建系统账号

**请求体:**
```json
{
  "account_name": "prod-payment-service",
  "system_name": "支付系统",
  "environment": "生产"
}
```

#### GET /api/accounts
查询所有系统账号

---

### 密钥信息管理

#### POST /api/keys
创建密钥信息

**请求体:**
```json
{
  "account_id": 1,
  "key_name": "支付网关API密钥",
  "key_purpose": "用于对接第三方支付渠道的API调用认证",
  "expiry_date": "2024-06-15T00:00:00Z",
  "owner": "zhangsan",
  "backup_owner": "lisi"
}
```

#### GET /api/keys
查询所有密钥信息（含剩余天数）

---

### 催办记录管理

#### POST /api/reminders/generate
自动生成催办记录（根据到期时间自动分级）

**请求体:**
```json
{
  "operator": "system-admin"
}
```

#### GET /api/reminders
查询催办记录，支持按状态筛选

**参数:**
- status: 状态筛选（可选）

#### POST /api/reminders/{id}/send
发送催办通知

#### POST /api/reminders/{id}/escalate
升级催办（转交给上级）

**请求体:**
```json
{
  "escalated_to": "tech-lead",
  "operator": "system-admin"
}
```

#### POST /api/reminders/{id}/transfer
负责人转交

**请求体:**
```json
{
  "new_owner": "backup-owner",
  "reason": "原负责人休假一周",
  "operator": "system-admin"
}
```

#### POST /api/reminders/{id}/process
处理催办并记录结论

**请求体:**
```json
{
  "conclusion_type": "密钥已更新",
  "conclusion": "已生成新的密钥并更新到所有配置文件",
  "processed_by": "backup-owner",
  "follow_up_action": "监控旧密钥使用情况",
  "next_review_date": "2024-06-22T00:00:00Z"
}
```

#### POST /api/reminders/{id}/correct
人工修正（管理员权限）

**请求体:**
```json
{
  "new_status": "pending",
  "new_owner": "new-owner",
  "error_message": "修正之前的处理错误",
  "reason": "需要重新处理",
  "operator": "admin-user"
}
```

#### GET /api/reminders/{id}/transitions
查询状态流转历史

#### GET /api/reminders/{id}/conclusions
查询处理结论

---

### 数据导出

#### GET /api/export/reminders
导出催办记录CSV

#### GET /api/export/status-transitions
导出状态流转历史CSV

## 到期分级规则

| 剩余天数 | 分级 |
|---------|------|
| < 0 | 已过期 (level_expired) |
| 0-3 | 3天内 (level_3_days) |
| 4-7 | 7天内 (level_7_days) |
| 8-15 | 15天内 (level_15_days) |
| 16-30 | 30天内 (level_30_days) |
| > 30 | 不触发 |

## 典型工作流

1. **创建账号和密钥**: 录入系统账号和密钥信息
2. **生成催办**: 系统自动检测到期密钥，生成对应分级的催办记录
3. **发送催办**: 向负责人发送提醒邮件/消息
4. **升级/转交**: 负责人无响应时升级，或休假时转交给备份人
5. **处理结项**: 负责人更新密钥后记录处理结论
6. **审计追溯**: 随时查看状态流转历史和处理记录
7. **导出报表**: 定期导出数据用于审计汇报

## 异常处理

所有API接口在发生错误时都会返回:
- error: 错误信息
- raw_input: 原始请求数据（用于问题排查）

这确保了问题可以从主记录一路追踪到具体的处理结论。
