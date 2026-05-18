# 儿童托管班接送授权API

完整的儿童托管班接送授权管理系统，包含状态流转引擎、业务规则验证、黑名单冲突检测、祖辈临时接送识别等核心功能。

## 功能特性

### 状态流转引擎
- **7种授权状态**: 草稿(draft)、待审批(pending_review)、已批准(approved)、已拒绝(rejected)、已过期(expired)、已撤销(revoked)、已暂停(suspended)
- **可测试的状态转移**: 所有状态变更都有明确的前置条件和角色权限控制
- **状态历史记录**: 记录每次状态变更的时间、操作人员和原因

### 业务规则验证
- **黑名单冲突检测**: 自动检测接送人是否在黑名单中，阻止黑名单人员的授权审批
- **祖辈临时接送识别**: 识别祖辈的临时接送授权，给出有效期建议（不超过7天）
- **授权清册一致性检查**: 
  - 必填字段验证
  - 日期有效性（结束日期不早于开始日期）
  - 重叠授权检测
  - 过期自动识别

### 审计追踪
- 提交来源（WEB_PORTAL、MOBILE_APP、DESKTOP、ADMIN_PANEL、API）
- 提交时间
- 操作人员记录
- 审批意见记录

## 技术栈

- **运行时**: Node.js
- **框架**: Express
- **语言**: TypeScript
- **导出格式**: JSON / CSV

## 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 编译构建
npm run build

# 生产模式运行
npm start
```

服务启动后访问: http://localhost:3000

## 验收流程（从创建到导出）

### 步骤1: 查看系统健康状态与样例数据

```bash
# 查看健康检查
curl http://localhost:3000/api/health

# 查看所有授权记录
curl http://localhost:3000/api/authorizations

# 查看所有儿童
curl http://localhost:3000/api/children

# 查看所有接送人
curl http://localhost:3000/api/guardians
```

**预期结果**: 系统自动加载5条样例授权记录，包含多种状态（已批准、待审批、已过期、已暂停）

### 步骤2: 测试黑名单冲突检测

```bash
# 查看黑名单接送人的授权（应显示已暂停状态）
curl http://localhost:3000/api/authorizations/auth-005

# 检查该授权的一致性问题
curl http://localhost:3000/api/authorizations/auth-005/consistency
```

**预期结果**: auth-005的状态为suspended（已暂停），一致性检查显示黑名单冲突

### 步骤3: 创建新的接送授权

```bash
# 创建祖辈临时接送授权（应该触发业务规则提示）
curl -X POST http://localhost:3000/api/authorizations \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child-001",
    "childName": "Zhang Wei",
    "guardianId": "guardian-003",
    "guardianName": "Zhang Guodong",
    "pickupType": "temporary",
    "relationType": "grandfather",
    "effectiveStartDate": "2024-06-01",
    "effectiveEndDate": "2024-06-15",
    "daysOfWeek": [1, 2, 3],
    "startTime": "16:30",
    "endTime": "17:30",
    "notes": "父母出差，爷爷临时接送",
    "idVerificationRequired": true,
    "submittedBy": "parent-001",
    "submissionSource": "mobile_app"
  }'
```

**预期结果**: 
- 创建成功，状态为 draft
- 注意：结束日期超过7天，后续一致性检查会给出警告

### 步骤4: 提交审批并验证状态流转

```bash
# 从草稿提交到待审批
curl -X PUT http://localhost:3000/api/authorizations/<新授权ID>/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "pending_review",
    "changedBy": "parent-001",
    "reason": "提交审批",
    "role": "parent"
  }'

# 管理员审批通过
curl -X PUT http://localhost:3000/api/authorizations/<新授权ID>/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "approved",
    "changedBy": "admin",
    "reason": "信息审核通过，注意临时授权有效期",
    "role": "admin"
  }'
```

**预期结果**: 
- 状态成功流转: draft → pending_review → approved
- 状态历史记录完整

### 步骤5: 测试无效的状态流转（验证状态机）

```bash
# 尝试直接从draft到approved（应该失败，需要先到pending_review）
curl -X PUT http://localhost:3000/api/authorizations/auth-002/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "approved",
    "changedBy": "parent-001",
    "reason": "跳过审批",
    "role": "parent"
  }'
```

**预期结果**: 
- 返回400错误
- 提示不允许的状态转换

### 步骤6: 测试接送人实时验证

```bash
# 验证已批准授权的接送人（应该成功）
curl "http://localhost:3000/api/authorizations/validate/pickup?guardianId=guardian-001&childId=child-001"

# 验证黑名单接送人（应该失败）
curl "http://localhost:3000/api/authorizations/validate/pickup?guardianId=guardian-005&childId=child-002"
```

**预期结果**:
- 第一个验证成功，valid: true
- 第二个验证失败，valid: false，提示黑名单原因

### 步骤7: 导出授权数据

```bash
# 导出为JSON格式
curl -X POST http://localhost:3000/api/export/json \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'

# 导出为CSV格式（全部数据）
curl -X POST http://localhost:3000/api/export/csv \
  -H "Content-Type: application/json" \
  -d '{}'

# 查看导出文件列表
curl http://localhost:3000/api/export/files
```

**预期结果**:
- 导出成功，返回文件路径和记录数量
- 文件保存到 exports 目录

### 步骤8: 删除授权

```bash
# 删除授权
curl -X DELETE http://localhost:3000/api/authorizations/auth-003
```

## API 端点一览

### 授权管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/authorizations | 获取授权列表 |
| GET | /api/authorizations/:id | 获取单个授权 |
| POST | /api/authorizations | 创建授权 |
| PUT | /api/authorizations/:id/status | 更新授权状态 |
| GET | /api/authorizations/:id/consistency | 一致性检查 |
| GET | /api/authorizations/validate/pickup | 接送验证 |
| DELETE | /api/authorizations/:id | 删除授权 |

### 基础数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/children | 获取儿童列表 |
| GET | /api/children/:id | 获取单个儿童 |
| POST | /api/children | 创建儿童 |
| GET | /api/guardians | 获取接送人列表 |
| GET | /api/guardians/:id | 获取单个接送人 |
| POST | /api/guardians | 创建接送人 |

### 数据导出
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/export/json | 导出JSON |
| POST | /api/export/csv | 导出CSV |
| GET | /api/export/files | 导出文件列表 |
| GET | /api/export/download/:filename | 下载导出文件 |

## 状态转移图

```
                    ┌──────────────┐
                    │    draft     │  草稿
                    └──────┬───────┘
                           │ submit
                           ▼
                    ┌──────────────┐
                    │pending_review│  待审批
                    └──┬──────┬───┘
                       │      │
             approve   │      │  reject
                       ▼      ▼
              ┌──────────┐  ┌──────────┐
              │ approved │  │ rejected │  已批准/拒绝
              └──┬───┬───┘  └──────────┘
                 │   │            │
        revoke   │   │  suspend   │ rework
                 │   │            │
                 ▼   ▼            │
          ┌─────────┐ ┌───────────┐
          │ revoked │ │ suspended │  已撤销/暂停
          └─────────┘ └──┬───┬────┘
                         │   │
              resume     │   │  revoke
                         ▼   ▼
          (back to approved)  (to revoked)
```

*expired（已过期）状态由系统自动设置

## 数据模型字段说明

### 儿童(Child)
- 基本信息：姓名、中文名、出生日期、性别
- 班级信息：班级ID、班级名称
- 医疗信息：医疗备注、过敏源
- 审计字段：创建时间、更新时间

### 接送人(Guardian)
- 基本信息：姓名、中文名、电话、邮箱、身份证号
- 关系信息：亲属关系、是否主要接送人
- 黑名单信息：是否在黑名单、黑名单原因、列入时间、操作人

### 接送授权(PickupAuthorization)
- 关联信息：儿童ID、儿童姓名、接送人ID、接送人姓名
- 授权类型：接送类型（父母/祖辈/临时/指定人员）、亲属关系
- 时间范围：生效开始/结束日期、星期几、具体时间段
- 状态信息：当前状态、状态历史
- 安全信息：是否需要身份验证、照片是否已验证
- 紧急联系：紧急联系人姓名、电话
- 审计信息：提交来源、提交时间、提交人、审批时间、审批人、审批意见

## 样例数据说明

系统启动时自动加载真实场景样例数据：

- **3名儿童**：张伟（向日葵班，花生过敏）、李梅（玫瑰班）、王浩（向日葵班，哮喘）
- **5名接送人**：张强（父）、刘英（母）、张国栋（爷爷）、赵红（奶奶）、陈明（朋友-黑名单）
- **5条授权记录**：
  - auth-001: 父亲常规接送（已批准）
  - auth-002: 爷爷临时接送（待审批）
  - auth-003: 母亲常规接送（已过期）
  - auth-004: 奶奶常规接送（已批准）
  - auth-005: 朋友接送（已暂停-因黑名单）

这些样例数据覆盖了真实业务中的各种边界情况。
