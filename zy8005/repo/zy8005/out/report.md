# CRM 数据迁移预检报告

> 生成时间: 2026-05-01 19:14:49

## 摘要

**整体状态**: ❌ ERROR

| 指标 | 数值 |
|------|------|
| 处理的表数 | 3 |
| 总记录数 | 15 |
| 错误总数 | 4 |
| 警告总数 | 1 |

### ⚠️ 重要提示

> 预检发现 **阻断性错误**，默认情况下将不会生成迁移 SQL。
> 如需强制生成草稿 SQL，请使用 `--force` 参数。

## 各表情况

### accounts

| 项目 | 数值 |
|------|------|
| 记录数 | 5 |
| 错误数 | 1 |
| 警告数 | 0 |

#### 问题详情

**❌ 错误 (阻断迁移):**

- 字段 'industry' 的值 'unknown' 不在允许的枚举值列表中: ['technology', 'energy', 'retail', 'finance', 'healthcare', 'education'] (值: `unknown`)  
  位置: 文件: `accounts.csv` | 行号: 6 | 字段: `industry`

### contacts

| 项目 | 数值 |
|------|------|
| 记录数 | 5 |
| 错误数 | 1 |
| 警告数 | 1 |

#### 问题详情

**❌ 错误 (阻断迁移):**

- 外键引用不存在: 'contacts.account_id' = 'ACC999' 引用 'accounts.id' (值: `ACC999`)  
  位置: 文件: `contacts.csv` | 行号: 5 | 字段: `account_id`

**⚠️ 警告 (需人工确认):**

- 字段 'email' 的邮箱格式可能无效: 'wangqiang.greenenergy.cn' (值: `wangqiang.greenenergy.cn`)  
  位置: 文件: `contacts.csv` | 行号: 4 | 字段: `email`

### activities

| 项目 | 数值 |
|------|------|
| 记录数 | 5 |
| 错误数 | 2 |
| 警告数 | 0 |

#### 问题详情

**❌ 错误 (阻断迁移):**

- 字段 'status' 的值 'scheduled' 不在允许的枚举值列表中: ['planned', 'in_progress', 'completed', 'cancelled'] (值: `scheduled`)  
  位置: 文件: `activities.csv` | 行号: 5 | 字段: `status`
- 外键引用不存在: 'activities.account_id' = 'ACC999' 引用 'accounts.id' (值: `ACC999`)  
  位置: 文件: `activities.csv` | 行号: 5 | 字段: `account_id`

## 规则说明

| 规则 | 严重程度 | 说明 |
|------|----------|------|
| missing_mapping | ERROR/WARNING | 目标表字段缺少映射配置 |
| required_field | ERROR | 必填字段缺失 |
| type_check | ERROR | 字段类型不匹配 |
| length_check | ERROR | 字段长度超限 |
| enum_check | ERROR | 枚举值不在允许列表中 |
| email_format | WARNING | 邮箱格式可能无效 |
| phone_format | WARNING | 手机号格式可能无效 |
| duplicate_natural_key | ERROR | 自然键重复 |
| foreign_key | ERROR | 外键引用不存在 |

---

*此报告由 crm-migrate-check 工具自动生成*