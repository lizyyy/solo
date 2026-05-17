# 客户白名单解释API

一套完整的白名单管理和解释系统，支持白名单创建、状态流转、命中追踪、异常处理、人工修正和数据导出。

## 核心特性

- **数据模型**：客户账号、白名单类型、生效规则、申请来源、命中记录、解释报告
- **API接口**：创建、查询、状态推进、异常处理、人工修正、导出
- **关键规则**：规则命中、来源追踪、到期检查、人工修正、报告导出
- **异常路径**：完整保留原始输入和处理依据，便于审计追踪

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库和样例数据

```bash
npm run init
```

这将创建SQLite数据库并初始化以下样例数据：

**客户账号**：
- CUST001: 张三科技有限公司 (VIP)
- CUST002: 李四贸易有限公司 (Normal)  
- CUST003: 王五集团股份有限公司 (SVIP)

**白名单类型**：
- RISK_EXEMPTION: 风控豁免
- RATE_LIMIT_EXEMPTION: 限流豁免
- FEE_DISCOUNT: 手续费减免

**白名单规则**：
- RULE_RISK_VIP: VIP客户风控豁免规则
- RULE_RATE_SVIP: SVIP客户限流豁免规则
- RULE_FEE_DISCOUNT: 手续费减免通用规则

**申请来源**：
- SALES_APPLY: 销售申请
- CS_COMPLAINT: 客诉处理
- SYSTEM_AUTO: 系统自动
- API_CALL: API调用

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 健康检查

```bash
curl http://localhost:3000/health
```

## API 接口文档

### 白名单管理

#### 1. 创建白名单

```bash
curl -X POST http://localhost:3000/api/whitelists \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "CUST001",
    "whitelistTypeCode": "RISK_EXEMPTION",
    "ruleCode": "RULE_RISK_VIP",
    "sourceCode": "SALES_APPLY",
    "effectiveDate": "2024-01-01",
    "expiryDate": "2024-12-31",
    "remark": "大客户特殊申请",
    "operator": "销售经理A"
  }'
```

#### 2. 查询白名单列表

```bash
# 查询所有白名单
curl http://localhost:3000/api/whitelists

# 按客户账号查询
curl "http://localhost:3000/api/whitelists?accountId=CUST001"

# 按状态查询
curl "http://localhost:3000/api/whitelists?status=pending"

# 分页查询
curl "http://localhost:3000/api/whitelists?page=1&pageSize=10"
```

#### 3. 查询单个白名单详情

```bash
curl http://localhost:3000/api/whitelists/{whitelistId}
```

#### 4. 状态推进

```bash
curl -X PUT http://localhost:3000/api/whitelists/{whitelistId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "operator": "审核员B"
  }'
```

**状态流转规则**：
- pending → active / revoked
- active → expired / revoked / manual_corrected
- manual_corrected → active / revoked

#### 5. 人工修正

```bash
curl -X POST http://localhost:3000/api/whitelists/{whitelistId}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "effectiveDate": "2024-02-01",
    "expiryDate": "2025-06-30",
    "remark": "延期至明年年中",
    "reason": "客户续约年度合同，申请延期",
    "operator": "管理员C"
  }'
```

### 命中记录

#### 6. 记录白名单命中

```bash
curl -X POST http://localhost:3000/api/whitelists/{whitelistId}/hit \
  -H "Content-Type: application/json" \
  -d '{
    "hitScene": "交易风控检查",
    "requestContext": {
      "region": "华东",
      "channel": "web",
      "amount": 100000
    },
    "hitResult": "passed",
    "operator": "风控系统"
  }'
```

### 解释报告

#### 7. 生成解释报告

```bash
# 生成客户汇总报告
curl -X POST http://localhost:3000/api/whitelists/reports/{customerId} \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "customer_summary",
    "operator": "客服人员"
  }'

# 生成单次命中解释报告
curl -X POST http://localhost:3000/api/whitelists/reports/{customerId} \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "single_hit",
    "hitRecordId": "{hitRecordId}",
    "operator": "客服人员"
  }'

# 生成人工修正报告
curl -X POST http://localhost:3000/api/whitelists/reports/{customerId} \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "manual_correction",
    "whitelistId": "{whitelistId}",
    "operator": "客服人员"
  }'
```

#### 8. 查询报告详情

```bash
curl http://localhost:3000/api/whitelists/reports/{reportId}
```

### 异常处理

#### 9. 查询异常日志

```bash
# 查询所有异常
curl http://localhost:3000/api/whitelists/exceptions/list

# 按类型查询
curl "http://localhost:3000/api/whitelists/exceptions/list?exceptionType=duplicate_call"

# 查询未解决的异常
curl "http://localhost:3000/api/whitelists/exceptions/list?resolved=false"
```

#### 10. 解决异常

```bash
curl -X PUT http://localhost:3000/api/whitelists/exceptions/{exceptionId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolutionNote": "已联系客户确认，重复申请已驳回",
    "resolvedBy": "管理员"
  }'
```

### 数据导出

#### 11. 导出白名单数据

```bash
# JSON格式
curl "http://localhost:3000/api/whitelists/export/whitelists?accountId=CUST001"

# CSV格式
curl -o whitelists.csv "http://localhost:3000/api/whitelists/export/whitelists?format=csv"
```

#### 12. 导出命中记录

```bash
curl -o hit_records.csv "http://localhost:3000/api/whitelists/export/hits?format=csv"
```

#### 13. 导出异常日志

```bash
curl -o exceptions.csv "http://localhost:3000/api/whitelists/export/exceptions?format=csv"
```

## 异常路径示例

### 1. 重复调用拦截

**场景**：同一客户重复申请相同类型的白名单

```bash
# 第一次申请（成功）
curl -X POST http://localhost:3000/api/whitelists \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "CUST001",
    "whitelistTypeCode": "RISK_EXEMPTION",
    "ruleCode": "RULE_RISK_VIP",
    "sourceCode": "SALES_APPLY",
    "operator": "销售A"
  }'

# 激活白名单
curl -X PUT http://localhost:3000/api/whitelists/{first_whitelist_id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "operator": "审核员"}'

# 第二次申请相同类型（被拦截）
curl -X POST http://localhost:3000/api/whitelists \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "CUST001",
    "whitelistTypeCode": "RISK_EXEMPTION",
    "ruleCode": "RULE_RISK_VIP",
    "sourceCode": "SALES_APPLY",
    "operator": "销售B"
  }'
```

**预期结果**：
- 第二次申请返回 `400 Bad Request`，提示"该客户已存在相同类型的白名单申请"
- 系统自动记录一条 `duplicate_call` 类型的异常日志，包含：
  - 原始输入数据（第二次申请的所有参数）
  - 处理依据（已存在的白名单ID）
  - 操作人和时间戳

### 2. 无效状态流转拦截

**场景**：尝试从已撤销状态直接激活

```bash
# 创建并撤销白名单
curl -X POST http://localhost:3000/api/whitelists \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "CUST002",
    "whitelistTypeCode": "FEE_DISCOUNT",
    "ruleCode": "RULE_FEE_DISCOUNT",
    "sourceCode": "CS_COMPLAINT",
    "operator": "客服A"
  }'

curl -X PUT http://localhost:3000/api/whitelists/{whitelist_id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "revoked", "operator": "管理员"}'

# 尝试重新激活（被拦截）
curl -X PUT http://localhost:3000/api/whitelists/{whitelist_id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "operator": "操作人B"}'
```

**预期结果**：
- 状态更新返回 `400 Bad Request`，提示"无法从 revoked 状态流转到 active 状态"
- 系统自动记录一条 `validation_error` 类型的异常日志，包含：
  - 原始输入（目标状态、操作人）
  - 处理依据（当前状态、允许的流转路径）
  - 完整错误上下文

### 3. 已过期规则拦截

**场景**：尝试激活已过期的白名单

```bash
# 创建已过期的白名单（注意：expiryDate设为过去时间）
curl -X POST http://localhost:3000/api/whitelists \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "CUST003",
    "whitelistTypeCode": "FEE_DISCOUNT",
    "ruleCode": "RULE_FEE_DISCOUNT",
    "sourceCode": "SYSTEM_AUTO",
    "effectiveDate": "2024-01-01",
    "expiryDate": "2024-06-30",
    "operator": "system"
  }'

# 假设当前时间是2024-07-01，尝试激活
curl -X PUT http://localhost:3000/api/whitelists/{whitelist_id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "operator": "审核员"}'
```

**预期结果**：
- 激活失败，提示"白名单已过期，无法激活"
- 系统自动记录一条 `expired_rule` 类型的异常日志，包含：
  - 白名单的到期日期
  - 当前系统时间
  - 完整的处理上下文

### 4. 未激活白名单命中拦截

**场景**：尝试记录未激活白名单的命中

```bash
# 创建白名单但不激活
curl -X POST http://localhost:3000/api/whitelists \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "CUST001",
    "whitelistTypeCode": "RATE_LIMIT_EXEMPTION",
    "ruleCode": "RULE_RATE_SVIP",
    "sourceCode": "API_CALL",
    "operator": "system"
  }'

# 尝试记录命中（被拦截）
curl -X POST http://localhost:3000/api/whitelists/{pending_whitelist_id}/hit \
  -H "Content-Type: application/json" \
  -d '{
    "hitScene": "API限流检查",
    "requestContext": {"channel": "api"},
    "hitResult": "passed",
    "operator": "限流系统"
  }'
```

**预期结果**：
- 命中记录失败，提示"白名单未激活，无法命中"
- 系统自动记录一条 `rule_mismatch` 类型的异常日志

## 核心业务规则

### 规则命中逻辑

系统根据白名单规则的 `matchConditions` 和请求上下文进行匹配：
- `customerLevels`: 客户等级匹配
- `regions`: 地区匹配
- `channels`: 渠道匹配

每次命中都会记录详细的匹配结果，包括：
- 匹配成功的条件
- 匹配失败的条件
- 最终是否通过判定

### 来源追踪

每条白名单都关联具体的申请来源，支持：
- 销售申请
- 客诉处理
- 系统自动
- API调用

来源信息包含申请人、申请部门和审批流程等完整审计信息。

### 到期检查

系统自动检查白名单有效期：
- 生效日期前不能激活
- 已过期的白名单不能重新激活
- 支持永不过期（expiryDate设为null）

### 人工修正

支持对已生效的白名单进行人工调整：
- 修改生效日期和到期日期
- 修改备注信息
- 保留完整的修改历史
- 记录修改原因和操作人

### 报告导出

支持生成多种类型的解释报告：
- 客户汇总报告：展示客户所有白名单情况
- 单次命中报告：详细解释某一次命中的原因和依据
- 人工修正报告：展示修正历史和原因
- 异常分析报告：汇总异常情况

## 数据模型

### 核心实体关系

```
客户 (Customer)
  ↓ 1:N
客户白名单 (CustomerWhitelist)
  ├─ 关联 → 白名单类型 (WhitelistType)
  ├─ 关联 → 白名单规则 (WhitelistRule)
  ├─ 关联 → 申请来源 (ApplicationSource)
  └─ 1:N → 命中记录 (HitRecord)
          ↓ 1:N
        解释报告 (ExplanationReport)

异常日志 (ExceptionLog) - 独立记录所有异常
```

### 关键审计字段

每个核心实体都包含：
- `createdBy`: 创建人
- `originalRequest`: 原始请求数据（异常追踪）
- `processingBasis`: 处理依据（审计追踪）
- `manualCorrection`: 人工修正记录
- `createdAt / updatedAt`: 时间戳

## 开发说明

### 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js      # 数据库配置
│   ├── models/
│   │   ├── index.js         # 模型关联
│   │   ├── Customer.js      # 客户模型
│   │   ├── WhitelistType.js # 白名单类型
│   │   ├── WhitelistRule.js # 白名单规则
│   │   ├── ApplicationSource.js # 申请来源
│   │   ├── CustomerWhitelist.js # 客户白名单
│   │   ├── HitRecord.js     # 命中记录
│   │   ├── ExplanationReport.js # 解释报告
│   │   └── ExceptionLog.js  # 异常日志
│   ├── services/
│   │   ├── whitelistService.js # 白名单服务
│   │   └── exportService.js # 导出服务
│   ├── routes/
│   │   └── whitelistRoutes.js # API路由
│   ├── scripts/
│   │   └── initData.js      # 初始化脚本
│   └── app.js               # 应用入口
├── package.json
└── README.md
```

### 技术栈

- **框架**: Express.js
- **ORM**: Sequelize
- **数据库**: SQLite（可替换为MySQL/PostgreSQL）
- **验证**: Joi
- **导出**: JSON2CSV

## 注意事项

1. **幂等性设计**：重复调用相同的创建请求会被拦截并记录异常
2. **审计追踪**：所有操作都保留操作人和时间戳
3. **异常保留**：异常路径完整保留原始输入和处理依据，便于事后审计
4. **状态机**：严格的状态流转校验，防止非法状态变更
5. **软删除**：核心实体支持软删除，保留历史数据

## License

MIT
