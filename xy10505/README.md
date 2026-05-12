# 用章申请风险 API

一个围绕合同用章前风险核对的 API 系统，解决法务发现的"合同被撤回修改后重新走用章，审批人看不到前后差异"的问题。

## 功能特性

- ✅ **合同风险扫描：金额、审批链、印章类型、历史撤回记录全方位核对
- ✅ **风险规则引擎：6 条内置规则，覆盖阈值加签、主体变更、印章匹配等
- ✅ **完整审批流程：创建→提交→审批→撤回→重提→用章确认
- ✅ **历史记录追踪：状态变化、字段变更、审批时间线
- ✅ **幂等性保证：重复提交自动拦截，重复回调保持幂等
- ✅ **报告导出：JSON 和文本格式报告
- ✅ **内置演示：4 个成功场景 + 4 个失败场景

## 风险规则

| 规则名称 | 风险等级 | 说明 |
|---------|---------|------|
| amount_threshold_check | 中风险 | 金额超过 ¥1,000,000 自动加签总经理 |
| seal_type_match_check | 高风险 | 检查印章类型与合同类型是否匹配 |
| withdrawn_history_check | 中风险 | 检测历史撤回记录，提示审批人注意 |
| subject_change_check | 严重风险 | 合同主体变更后，历史审批失效 |
| duplicate_application_check | 高风险 | 检测重复在用申请，防止重复用章 |
| amount_change_check | 高风险 | 检测金额变化超过 10% 提示风险 |

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install
```

### 2. 本地启动

```bash
# 启动服务
npm start
```

服务启动后访问：
- 健康检查：http://localhost:3000/health

### 3. 运行演示

```bash
# 运行成功路径演示
npm run demo

# 运行失败路径演示
npm run demo-failure
```

## 项目结构

```
.
├── src/
│   ├── app.js                    # 应用入口
│   ├── config.js                  # 配置文件
│   ├── database.js                # 数据库初始化
│   ├── utils.js                   # 工具函数
│   ├── middleware/
│   │   └── idempotency.js      # 幂等性中间件
│   ├── routes/
│   │   ├── contracts.js          # 合同路由
│   │   └── sealApplications.js # 用章申请路由
│   └── services/
│       ├── contractService.js       # 合同服务
│       ├── sealApplicationService.js # 用章申请服务
│       ├── riskEngine.js          # 风险规则引擎
│       └── reportService.js       # 报告服务
├── scripts/
│   ├── demo.js                  # 成功路径演示
│   └── demo-failure.js         # 失败路径演示
└── seal_risk.db               # SQLite 数据库 (自动生成)
```

## API 接口

### 合同接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/contracts | 创建合同 |
| GET | /api/contracts/:id | 查询合同 |
| GET | /api/contracts | 查询合同列表 |
| PUT | /api/contracts/:id | 更新合同 |

### 用章申请接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/seal-applications | 创建用章申请 |
| POST | /api/seal-applications/:id/submit | 提交审批 |
| POST | /api/seal-applications/:id/approve | 审批通过 |
| POST | /api/seal-applications/:id/reject | 审批驳回 |
| POST | /api/seal-applications/:id/withdraw | 撤回申请 |
| POST | /api/seal-applications/:id/resubmit | 重提申请 |
| POST | /api/seal-applications/:id/seal | 用章确认 |
| POST | /api/seal-applications/:id/scan | 重新扫描风险 |
| GET | /api/seal-applications/:id | 查询申请详情 |
| GET | /api/seal-applications | 查询申请列表 |
| GET | /api/seal-applications/:id/timeline | 查询时间线 |
| GET | /api/seal-applications/:id/risks | 查询风险记录 |
| GET | /api/seal-applications/:id/report | 导出 JSON 报告 |
| GET | /api/seal-applications/:id/report/text | 导出文本报告 |

## 主要演示路径

### 路径 1：普通合同通过流程

```
创建申请 → 提交 → 部门经理审批 → 财务经理审批 → 用章确认

**结果：合同金额 50 万，低于阈值，审批链 2 人，正常通过。

### 路径 2：高金额加签流程

```
创建申请 (250 万) → 提交 → 部门经理 → 财务经理 → 总经理 (加签) → 用章确认

**结果：金额超过 250 万超过 ¥100 万阈值，自动触发总经理加签，审批链 3 人。

### 路径 3：撤回后主体变更再重提

```
创建申请 → 提交 → 部分审批 → 撤回 → 修改合同主体 → 重提 → 重新完整审批 → 用章确认

**结果：
- 原申请甲方 "甲方-原合作公司"
- 撤回原因 "甲方公司名称有误"
- 重提后甲方 "甲方-更正后的合作公司"
- 系统检测主体变更，历史审批失效，必须重新走完整审批流程
- 报告显示字段变更记录和操作者

### 路径 4：重复提交

```
创建合同 → 创建申请 1 → 创建申请 2 → 提交申请 1 → 风险扫描检测重复申请

**结果：风险扫描检测到同一合同存在 2 个在用申请，标记高风险。

## 失败路径演示

### 失败 1：印章类型不匹配

销售合同使用财务专用章

```
创建申请 (销售合同 + 财务专用章) → 风险扫描 → 标记高风险

**结果：系统检测到印章类型不匹配，风险。

### 失败 2：错误审批人

```
创建申请 → 提交 → 错误的人审批 → 被拒绝 → 正确的人审批 → 通过

**结果：只有当前审批人才能审批，其他人尝试会被拒绝。

### 失败 3：未完成审批就用章

```
创建申请 → 直接用章 → 被拒绝 → 提交 → 部分审批 → 用章 → 被拒绝 → 完成审批 → 用章 → 成功

**结果：只有审批通过状态的申请才能用章。

### 失败 4：审批完成后撤回

```
创建申请 → 提交 → 完成审批 → 撤回 → 被拒绝

**结果：已审批通过的申请不能撤回。

## 接口示例

### 创建用章申请

```bash
curl -X POST http://localhost:3000/api/seal-applications \
  -H "Content-Type: application/json" \
  -d '{
    "contract": {
      "name": "测试合同",
      "category": "SERVICE",
      "amount": 500000,
      "partyA": "甲方公司",
      "partyB": "乙方公司"
    },
    "sealType": "CONTRACT_SEAL",
    "applicant": "申请人-小王",
    "department": "研发部",
    "reason": "项目合作"
  }'
```

### 提交审批

```bash
curl -X POST http://localhost:3000/api/seal-applications/{申请ID}/submit \
  -H "Content-Type: application/json" \
  -d '{"operator": "申请人-小王"}'
```

### 审批通过

```bash
curl -X POST http://localhost:3000/api/seal-applications/{申请ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "部门经理-张三",
    "comment": "同意"
  }'
```

### 撤回申请

```bash
curl -X POST http://localhost:3000/api/seal-applications/{申请ID}/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "申请人-小王",
    "reason": "合同需要修改"
  }'
```

### 用章确认

```bash
curl -X POST http://localhost:3000/api/seal-applications/{申请ID}/seal \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "印章管理员-赵六",
    "sealCount": 2,
    "remark": "正式盖章"
  }'
```

### 导出报告

```bash
# JSON 格式
curl http://localhost:3000/api/seal-applications/{申请ID}/report

# 文本格式
curl http://localhost:3000/api/seal-applications/{申请ID}/report/text
```

## 报告内容示例

报告包含以下信息：

- **基本信息**：申请人、部门、印章类型、申请原因、状态
- **合同信息**：合同编号、名称、类型、金额、甲乙双方
- **审批链信息**：审批人列表、当前审批人、审批状态
- **风险信息**：风险扫描结果、未解决风险
- **审批时间线**：所有状态变更记录
- **字段变更**：撤回重提后的字段变更历史
- **最终状态**：最终状态判断、是否可以用章

## 配置说明

### 风险阈值配置（src/config.js）：

```javascript
riskThreshold: {
  amount: 1000000, // 金额阈值 ¥1,000,000
}
```

### 印章类型：

- COMPANY_SEAL: 公司公章
- CONTRACT_SEAL: 合同专用章
- FINANCIAL_SEAL: 财务专用章
- LEGAL_SEAL: 法人章

### 合同类型：

- SALES: 销售合同
- PURCHASE: 采购合同
- SERVICE: 服务合同
- COOPERATION: 合作协议

## 数据库表结构

### contracts（合同表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 |
| contract_no | TEXT | 合同编号 |
| name | TEXT | 合同名称 |
| category | TEXT | 合同类型 |
| amount | REAL | 合同金额 |
| amount_currency | TEXT | 币种 |
| party_a | TEXT | 甲方 |
| party_b | TEXT | 乙方 |

### seal_applications（用章申请表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 |
| idempotency_key | TEXT | 幂等键 |
| contract_id | TEXT | 合同ID |
| seal_type | TEXT | 印章类型 |
| applicant | TEXT | 申请人 |
| department | TEXT | 部门 |
| status | TEXT | 状态 |
| is_withdrawn | INTEGER | 是否撤回 |
| original_application_id | TEXT | 原申请ID |
| resubmit_count | INTEGER | 重提次数 |

### approval_chains（审批链表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 |
| application_id | TEXT | 申请ID |
| approver_order | INTEGER | 审批顺序 |
| approver | TEXT | 审批人 |
| status | TEXT | 审批状态 |

### status_history（状态历史表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 |
| application_id | TEXT | 申请ID |
| from_status | TEXT | 原状态 |
| to_status | TEXT | 新状态 |
| operator | TEXT | 操作人 |
| action | TEXT | 操作类型 |
| comment | TEXT | 备注 |

### field_change_history（字段变更历史表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 |
| application_id | TEXT | 申请ID |
| field_name | TEXT | 字段名 |
| old_value | TEXT | 旧值 |
| new_value | TEXT | 新值 |
| operator | TEXT | 操作人 |

### risk_scan_results（风险扫描结果表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 |
| application_id | TEXT | 申请ID |
| rule_name | TEXT | 规则名称 |
| risk_level | TEXT | 风险等级 |
| is_pass | INTEGER | 是否通过 |
| risk_reason | TEXT | 风险原因 |

### idempotency_records（幂等记录表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| idempotency_key | TEXT | 幂等键 (主键) |
| request_type | TEXT | 请求类型 |
| response_data | TEXT | 响应数据 |

## 常见问题

### Q: 如何查看撤回前后的差异？

A: 通过以下接口查看：
- GET /api/seal-applications/:id/timeline - 查看时间线
- GET /api/seal-applications/:id/report - 查看字段变更

### Q: 如何判断业务是否闭环？

A: 查看报告的 sealStatus.finalStatus 字段：
- "已闭环"：已完成用章
- "待用章"：审批通过，可用章
- "审批中"：正在审批流程
- "已驳回"：已被拒绝
- "已撤回"：已撤回，可重提

### Q: 主体变更后为什么要重新审批？

A: 合同主体变更是重大变更，原有审批针对原主体，变更主体后原有审批失效，必须重新走完整审批流程。

### Q: 如何保证幂等性？

A: 在请求头中添加 X-Idempotency-Key 或在请求体中添加 idempotencyKey 字段。

## License

MIT
