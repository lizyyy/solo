# 供应商资质到期巡检 API 系统

## 系统概述

本系统旨在解决采购过程中供应商证照过期导致项目延期的问题，提供完整的供应商资质巡检、风险拦截和人工复核能力。

## 核心功能

- **供应商档案管理**：创建、查询、冻结、解冻供应商
- **证照管理**：上传证照、版本管理、续期申请、状态自动更新
- **项目准入**：创建准入申请、审批、状态追踪
- **资质巡检**：自动检查供应商资质有效性，拦截过期风险
- **人工复核**：处理已拦截的风险，记录前后差异和操作人
- **风险报告**：按项目、供应商、证照类型汇总风险
- **幂等性支持**：重复请求返回相同结果

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行演示

```bash
npm run demo
```

演示将执行以下 6 个场景：

1. **正常准入** - 资质齐全，证照有效（无风险）
2. **临期提醒** - 证照30天内到期（中风险警告）
3. **过期拦截** - 证照已过期（高风险，自动拦截）
4. **续期恢复** - 临期后提交续期申请（中风险，不立即拦截）
5. **冻结供应商** - 已准入供应商被冻结（高风险，自动拦截）
6. **证照多版本** - 同一证照类型多次上传（使用最新版本）

### 3. 启动 HTTP API 服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## API 接口说明

### 健康检查
```bash
GET http://localhost:3000/health
```

### 供应商管理

**创建供应商**
```bash
POST http://localhost:3000/api/suppliers
Content-Type: application/json
x-operator: ADMIN-001
x-idempotency-key: unique-key-001

{
  "name": "北京科技有限公司",
  "code": "BJ-TECH-001",
  "contact": "张三",
  "phone": "13800000001"
}
```

**获取供应商列表**
```bash
GET http://localhost:3000/api/suppliers
```

**获取单个供应商**
```bash
GET http://localhost:3000/api/suppliers/{supplierId}
```

**冻结供应商**
```bash
POST http://localhost:3000/api/suppliers/{supplierId}/freeze
Content-Type: application/json
x-operator: COMPLIANCE-001

{
  "reason": "供应商涉及重大诉讼"
}
```

**解冻供应商**
```bash
POST http://localhost:3000/api/suppliers/{supplierId}/unfreeze
Content-Type: application/json
x-operator: COMPLIANCE-001

{
  "reason": "诉讼已解决"
}
```

### 证照管理

**上传证照**
```bash
POST http://localhost:3000/api/certificates
Content-Type: application/json
x-operator: OPER-001

{
  "supplierId": "supplier-uuid",
  "type": "BUSINESS_LICENSE",
  "certificateNo": "BL-2024-0001",
  "name": "营业执照",
  "issueDate": "2024-01-01",
  "expiryDate": "2025-01-01"
}
```

**获取证照详情**
```bash
GET http://localhost:3000/api/certificates/{certificateId}
```

**获取供应商所有证照**
```bash
GET http://localhost:3000/api/suppliers/{supplierId}/certificates
```

**提交续期申请**
```bash
POST http://localhost:3000/api/certificates/{certificateId}/renewal
Content-Type: application/json
x-operator: OPER-001

{
  "expectedExpiryDate": "2026-01-01"
}
```

### 项目管理

**创建项目**
```bash
POST http://localhost:3000/api/projects
Content-Type: application/json

{
  "name": "智慧园区建设项目",
  "code": "PROJECT-001",
  "requiredCertificateTypes": ["BUSINESS_LICENSE", "QUALIFICATION_CERT"],
  "status": "ACTIVE"
}
```

**获取项目列表**
```bash
GET http://localhost:3000/api/projects
```

**获取单个项目**
```bash
GET http://localhost:3000/api/projects/{projectId}
```

### 项目准入管理

**创建准入申请**
```bash
POST http://localhost:3000/api/project-accesses
Content-Type: application/json
x-operator: PROCUREMENT-001

{
  "supplierId": "supplier-uuid",
  "projectId": "project-uuid"
}
```

**获取准入列表**
```bash
GET http://localhost:3000/api/project-accesses
```

**审批准入**
```bash
POST http://localhost:3000/api/project-accesses/{accessId}/approve
Content-Type: application/json
x-operator: MANAGER-001

{
  "reason": "资质审核通过"
}
```

**拒绝准入**
```bash
POST http://localhost:3000/api/project-accesses/{accessId}/reject
Content-Type: application/json
x-operator: MANAGER-001

{
  "reason": "资质不全"
}
```

### 巡检管理

**创建巡检**
```bash
POST http://localhost:3000/api/inspections
Content-Type: application/json
x-operator: AUDIT-001

{
  "name": "月度资质巡检",
  "type": "FULL"
}
```

**获取巡检列表**
```bash
GET http://localhost:3000/api/inspections
```

**执行巡检**
```bash
POST http://localhost:3000/api/inspections/{inspectionId}/execute
x-operator: AUDIT-001
```

**获取巡检结果**
```bash
GET http://localhost:3000/api/inspections/{inspectionId}/results
```

### 风险处理

**人工处理风险**
```bash
POST http://localhost:3000/api/risks/{riskId}/resolve
Content-Type: application/json
x-operator: REVIEWER-001

{
  "action": "REQUIRE_RENEWAL",
  "reason": "要求供应商立即更新过期证照"
}
```

### 报告查询

**获取风险报告**
```bash
GET http://localhost:3000/api/reports/risks
GET http://localhost:3000/api/reports/risks?projectId={projectId}
GET http://localhost:3000/api/reports/risks?supplierId={supplierId}
GET http://localhost:3000/api/reports/risks?certificateType=BUSINESS_LICENSE
GET http://localhost:3000/api/reports/risks?severity=HIGH
```

**获取人工复核记录**
```bash
GET http://localhost:3000/api/manual-reviews
```

**获取冻结/解冻日志**
```bash
GET http://localhost:3000/api/freeze-logs
```

## 主要演示路径

### 路径1：正常流程（成功准入）

1. 创建供应商
2. 上传有效证照（有效期 > 30天）
3. 创建项目（设置所需证照类型）
4. 创建准入申请
5. 审批准入（状态：APPROVED）
6. 执行巡检
7. 查看结果：无风险，准入保持 APPROVED

### 路径2：临期提醒

1. 创建供应商
2. 上传证照（有效期 15 天）
3. 创建项目和准入，审批通过
4. 执行巡检
5. 查看结果：中风险警告，准入保持 APPROVED（提醒续期）

### 路径3：过期拦截

1. 创建供应商
2. 上传证照（已过期 35 天）
3. 创建项目和准入，审批通过
4. 执行巡检
5. 查看结果：高风险，准入被拦截（APPROVED -> SUSPENDED）
6. 查看准入历史：自动记录拦截原因

### 路径4：续期恢复

1. 创建供应商
2. 上传证照（有效期 10 天）
3. 提交续期申请
4. 创建项目和准入，审批通过
5. 执行巡检
6. 查看结果：中风险，状态为 PENDING_RENEWAL（不立即拦截）

### 路径5：冻结供应商

1. 创建供应商，上传有效证照
2. 创建项目和准入，审批通过
3. 冻结供应商（状态：FROZEN）
4. 执行巡检
5. 查看结果：高风险，准入被拦截

### 路径6：证照多版本

1. 创建供应商
2. 上传证照 V1（已过期）
3. 上传证照 V2（有效期 315 天）- 自动标记 V1 为非最新
4. 创建项目和准入，审批通过
5. 执行巡检
6. 查看结果：使用 V2（最新版），无风险

## 失败路径演示

### 场景：重复执行已完成的巡检

1. 创建巡检
2. 执行巡检（成功）
3. 再次执行同一巡检
4. 结果：返回错误，因为巡检状态已不是 PENDING

### 场景：幂等性测试

1. 使用相同的 x-idempotency-key 创建供应商两次
2. 结果：第二次返回第一次的结果，不创建新供应商

## 业务规则

### 证照状态判定

| 条件 | 状态 | 处理 |
|------|------|------|
| 有效期 > 30 天 | VALID | 正常 |
| 0 < 有效期 <= 30 天 | EXPIRING_SOON | 临期提醒 |
| 有效期 <= 0 天 | EXPIRED | 拦截准入 |
| 临期且已提交续期 | PENDING_RENEWAL | 暂缓拦截，等待审核 |

### 风险分级

- **HIGH（高风险）**：证照过期、供应商冻结 → 自动拦截准入
- **MEDIUM（中风险）**：证照临期、续期审核中 → 警告提醒，不立即拦截

### 拦截规则

巡检发现高风险时：
1. 如果准入状态为 APPROVED，自动改为 SUSPENDED
2. 记录拦截原因到准入历史
3. 生成风险记录，等待人工复核

### 幂等性

- 支持 `x-idempotency-key` 请求头
- 相同 key 的请求返回第一次的结果
- 适用于创建、更新类操作

### 审计留痕

所有变更操作都记录：
- 操作人（operator）
- 操作时间（timestamp）
- 变更前状态（before）
- 变更后状态（after）
- 变更原因（reason，可选）

## 数据模型

### 供应商 (Supplier)
- id, name, code, contact, phone
- status: ACTIVE | FROZEN
- history: 操作历史记录

### 证照 (Certificate)
- id, supplierId, type, certificateNo, name
- issueDate, expiryDate
- status: VALID | EXPIRING_SOON | EXPIRED | PENDING_RENEWAL | INVALID
- version, isLatest
- renewalApplication: 续期申请
- history: 操作历史记录

### 项目 (Project)
- id, name, code
- requiredCertificateTypes: 所需证照类型列表
- status

### 项目准入 (ProjectAccess)
- id, supplierId, projectId
- status: PENDING | APPROVED | REJECTED | SUSPENDED | TERMINATED
- approver, approvedAt
- history: 操作历史记录

### 巡检 (Inspection)
- id, name, type
- status: PENDING | IN_PROGRESS | PASSED | FAILED | MANUAL_REVIEW | COMPLETED
- resultSummary: 结果摘要
- history: 操作历史记录

### 巡检结果 (InspectionResult)
- id, inspectionId
- supplierId, supplierName
- projectId, projectName
- certificateType, certificateNo
- riskType: MISSING | EXPIRED | EXPIRING_SOON | PENDING_RENEWAL | SUPPLIER_FROZEN
- severity: HIGH | MEDIUM
- message: 风险描述
- intercepted: 是否已拦截
- resolved, resolution, resolvedBy, resolvedAt

### 人工复核 (ManualReview)
- id, inspectionResultId
- action: 处理动作
- reason: 处理原因
- operator: 操作人
- before, after: 前后差异

## 项目结构

```
xy10501/
├── package.json           # 项目配置
├── README.md              # 本文档
└── src/
    ├── models.js          # 数据模型和常量定义
    ├── services.js        # 业务逻辑和规则引擎
    ├── server.js          # Express API 服务
    └── demo.js            # 演示脚本
```

## 技术栈

- Node.js
- Express.js
- UUID
- 内存存储（可扩展到数据库）

## 扩展建议

1. **持久化存储**：将内存存储替换为数据库（MongoDB, PostgreSQL 等）
2. **定时任务**：添加 cron 任务自动执行巡检
3. **通知系统**：高风险时自动发送邮件/短信通知
4. **报表导出**：支持 Excel/PDF 格式的风险报告
5. **权限管理**：基于角色的访问控制（RBAC）
6. **证照类型配置**：动态配置各项目所需的证照类型
7. **续期审核流程**：完整的续期申请审批流程
8. **数据校验**：添加更多输入校验和业务规则验证
