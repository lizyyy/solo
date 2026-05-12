# 二方审核整改 API

追踪客户二方审核发现问题后的整改计划、证据提交、客户复审和关闭状态管理系统。

## 本地启动

### 1. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10589
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 造数（插入样例数据）
```bash
npm run seed
```

或者一键执行：
```bash
npm run setup
```

### 4. 启动服务
```bash
npm start
```

服务启动后访问：`http://localhost:3001`

---

## 内置样例数据说明

执行 `npm run seed` 后会创建以下5个完整场景：

| 问题编号 | 状态 | 责任部门 | 风险等级 | 场景说明 |
|---------|------|---------|---------|---------|
| ISSUE-001 | **CLOSED** (已关闭) | 生产部 | 高风险 | 整改通过，客户已认可 |
| ISSUE-002 | **REJECTED** (退回) | 质量部 | 中风险 | 证据不足退回，需重新整改 |
| ISSUE-003 | **PLAN_APPROVED** (计划已批) | 采购部 | 高风险 | 延期审批，已获延期 |
| ISSUE-004 | **ESCALATED** (已升级) | 人力资源部 | 高风险 | 逾期超过3天，已升级 |
| ISSUE-005 | **OPEN** (待处理) | 设备部 | 低风险 | 新建问题，待推进 |

---

## 主要演示路径

### 路径1：完整整改通过流程

**步骤1：查看问题列表**
```bash
curl http://localhost:3001/api/audit/issues
```

**步骤2：查看已关闭问题详情（ISSUE-001已完成闭环）**
```bash
# 先获取所有问题找到CLOSED状态的ID
curl http://localhost:3001/api/audit/issues?status=CLOSED
# 然后用返回的ID查看详情
curl http://localhost:3001/api/audit/issues/{issue-id}
```

**步骤3：查看汇总报告**
```bash
curl http://localhost:3001/api/audit/reports/summary
```

**步骤4：查看状态定义**
```bash
curl http://localhost:3001/api/audit/status-definitions
```

### 路径2：新建问题并完整推进

**步骤1：创建新问题**
```bash
curl -X POST http://localhost:3001/api/audit/issues \
  -H "Content-Type: application/json" \
  -d '{
    "audit_id": "AUDIT-DEMO-001",
    "title": "演练问题：灭火器压力不足",
    "description": "车间东南角2具灭火器压力表显示红色区域，需要更换",
    "risk_level": "中风险",
    "responsible_department": "安全部",
    "created_by": "演示用户"
  }'
```
保存返回的 `id` 字段（记为 ISSUE_ID）

**步骤2：提交整改计划**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${ISSUE_ID}/submit-plan \
  -H "Content-Type: application/json" \
  -d '{
    "plan_content": "1. 24小时内更换压力不足的灭火器；2. 全面排查所有灭火器；3. 建立月度巡检制度",
    "responsible_person": "王安全",
    "target_date": "2026-05-19T00:00:00.000Z",
    "submitted_by": "王安全"
  }'
```

**步骤3：审批整改计划**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${ISSUE_ID}/approve-plan \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "李总监",
    "comments": "同意此方案，请尽快执行"
  }'
```

**步骤4：提交整改证据**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${ISSUE_ID}/submit-evidence \
  -H "Content-Type: application/json" \
  -d '{
    "content": "新灭火器购买发票、更换现场照片5张、全厂灭火器巡检记录表",
    "file_url": "/files/demo-evidence.pdf",
    "submitted_by": "王安全"
  }'
```

**步骤5：客户复审通过**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${ISSUE_ID}/customer-review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "客户审核员-张工",
    "result": "APPROVED",
    "comments": "整改及时，证据充分，同意关闭"
  }'
```

**步骤6：验证闭环状态**
```bash
curl http://localhost:3001/api/audit/issues/${ISSUE_ID}
```
检查返回结果：
- `issue.status` 应为 `"CLOSED"`
- `issue.customer_approved` 应为 `1`
- `isApproved` 应为 `true`
- `history` 数组应包含完整的状态变更记录

---

## 失败路径演示

### 失败场景1：高风险问题无主管确认

**创建高风险问题**
```bash
curl -X POST http://localhost:3001/api/audit/issues \
  -H "Content-Type: application/json" \
  -d '{
    "audit_id": "AUDIT-FAIL-001",
    "title": "失败演练：压力容器超期未检",
    "description": "3号反应釜已超过检验有效期30天",
    "risk_level": "高风险",
    "responsible_department": "生产部",
    "created_by": "演示用户"
  }'
```
保存返回的 `id`（记为 FAIL_ID）

**尝试提交计划（不带主管确认）—— 预期失败**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${FAIL_ID}/submit-plan \
  -H "Content-Type: application/json" \
  -d '{
    "plan_content": "立即联系检验机构",
    "responsible_person": "赵主管",
    "target_date": "2026-05-19T00:00:00.000Z",
    "submitted_by": "赵主管"
  }'
```
**预期返回：** `{"success":false,"error":"高风险问题需要主管确认"}`

**带主管确认后提交——预期成功**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${FAIL_ID}/submit-plan \
  -H "Content-Type: application/json" \
  -d '{
    "plan_content": "立即联系检验机构",
    "responsible_person": "赵主管",
    "target_date": "2026-05-19T00:00:00.000Z",
    "submitted_by": "赵主管",
    "supervisor_approved": true
  }'
```

### 失败场景2：状态错误（跳过步骤）

**使用上面的 FAIL_ID（当前状态应为 PLAN_SUBMITTED）**

**尝试直接提交证据（跳过审批）—— 预期失败**
```bash
curl -X POST http://localhost:3001/api/audit/issues/${FAIL_ID}/submit-evidence \
  -H "Content-Type: application/json" \
  -d '{
    "content": "检验报告",
    "submitted_by": "赵主管"
  }'
```
**预期返回：** `{"success":false,"error":"当前状态 [PLAN_SUBMITTED] 不允许提交证据","currentStatus":"PLAN_SUBMITTED"}`

### 失败场景3：重复提交（幂等性验证）

**使用相同的 idempotency_key 提交两次**

**第一次提交——正常执行**
```bash
curl -X POST http://localhost:3001/api/audit/issues \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "IDEMPOTENT-TEST-001",
    "audit_id": "AUDIT-IDEM-001",
    "title": "幂等测试问题",
    "description": "测试重复提交",
    "risk_level": "低风险",
    "responsible_department": "测试部",
    "created_by": "演示用户"
  }'
```

**第二次使用相同 key——返回幂等结果，不重复创建**
```bash
curl -X POST http://localhost:3001/api/audit/issues \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "IDEMPOTENT-TEST-001",
    "audit_id": "AUDIT-IDEM-001",
    "title": "幂等测试问题",
    "description": "测试重复提交",
    "risk_level": "低风险",
    "responsible_department": "测试部",
    "created_by": "演示用户"
  }'
```
**预期返回：** `{"success":true,"idempotent":true,"data":{...}}`
注意 `idempotent` 字段为 `true`，说明是幂等返回，没有重复创建。

### 失败场景4：人工修正（留下审计轨迹）

**找到一个 OPEN 状态的问题（如 ISSUE-005），获取其 ID**
```bash
curl http://localhost:3001/api/audit/issues?status=OPEN
```

**进行人工修正——会留下前后差异记录**
```bash
curl -X POST http://localhost:3001/api/audit/issues/{OPEN_ISSUE_ID}/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "field": "responsible_department",
    "new_value": "安全环保部",
    "corrected_by": "系统管理员",
    "reason": "原部门归属错误，应属于安全环保部"
  }'
```

**查看修正记录**
```bash
curl http://localhost:3001/api/audit/issues/{OPEN_ISSUE_ID}
```
检查返回结果中的 `corrections` 数组，应包含：
- `field_name`: "responsible_department"
- `old_value`: "设备部"
- `new_value`: "安全环保部"
- `corrected_by`: "系统管理员"
- `reason`: "原部门归属错误..."

同时 `history` 数组中也应有人工修正的动作记录。

---

## 如何判断业务闭环

查看问题详情接口返回时，关注以下关键字段：

| 字段 | 含义 | 闭环判定 |
|-----|------|---------|
| `issue.status` | 当前状态 | 必须为 `"CLOSED"` |
| `issue.customer_approved` | 客户是否认可 | 必须为 `1` |
| `isApproved` | 派生字段 | 必须为 `true` |
| `history` 最后一条 | 状态历史 | `action` 应为 `"客户审核通过"` |
| `reviews` 中 CUSTOMER_REVIEW | 客户复审记录 | `result` 应为 `"APPROVED"` |

**报告汇总判断：**
- `customerApproved` 统计客户已认可的问题数
- `closed` 统计已关闭的问题数
- `byStatus.CLOSED` 直接查看已关闭数量
- `overdue` 查看逾期数量，逾期越少越好

---

## API 接口清单

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/` | 服务信息和接口清单 |
| POST | `/api/audit/issues` | 创建审核问题 |
| GET | `/api/audit/issues` | 查询问题列表（支持 status/department/risk_level 筛选） |
| GET | `/api/audit/issues/:id` | 查询问题详情（含历史、证据、审核记录） |
| POST | `/api/audit/issues/:id/submit-plan` | 提交整改计划 |
| POST | `/api/audit/issues/:id/approve-plan` | 审批整改计划 |
| POST | `/api/audit/issues/:id/submit-evidence` | 提交整改证据（带版本号） |
| POST | `/api/audit/issues/:id/customer-review` | 客户复审（APPROVED/REJECTED） |
| POST | `/api/audit/issues/:id/request-extension` | 申请延期 |
| POST | `/api/audit/issues/:id/manual-correction` | 人工修正（留痕） |
| POST | `/api/audit/check-overdue` | 检查逾期并自动升级 |
| GET | `/api/audit/reports/summary` | 汇总报告导出 |
| GET | `/api/audit/status-definitions` | 状态定义说明 |

---

## 核心业务规则

1. **高风险问题主管确认**：`risk_level="高风险"` 的问题提交计划时必须带 `supervisor_approved=true`
2. **证据缺失不能复审**：客户复审前必须至少有一份有效证据
3. **退回后重新计时**：客户退回（REJECTED）后自动重新计算3天期限
4. **逾期升级**：超过期限标为 OVERDUE，逾期超过3天自动升级为 ESCALATED
5. **幂等性**：所有变更操作支持 `idempotency_key`，重复调用不重复执行
6. **人工修正留痕**：任何手工修改都会记录 `correction_records`，包含前后值和操作者
7. **版本追踪**：证据提交自动递增版本号，可追溯历史版本
