# 客户成功续约 API

SaaS 客户续约流程自动化服务，围绕续约前的数据汇总、风险检查、报价管理和审批流程展开。

## 功能特性

- 📊 **数据聚合** - 自动汇总客户档案、产品使用量、健康分、未结工单
- ⚠️ **风险预警** - 健康分过低自动标记风险，重大工单未结不能标绿
- 💰 **报价管理** - 支持多版本报价，自动计算折扣并触发审批流程
- ✅ **折扣审批** - 按客户级别设置阈值，超阈值自动走审批流程
- 🔄 **幂等机制** - 重复请求或重复回调不会产生副作用
- 📝 **审计追踪** - 每一步都记录状态变化、历史记录和失败原因
- 👤 **人工修正** - 手动干预必须留下前后差异和操作者信息
- 📈 **看板展示** - Web 界面展示续约看板、风险原因、报价历史

## 快速开始

### 环境要求
- Node.js 16+
- npm

### 安装依赖
```bash
npm install
```

### 创建样例数据
```bash
npm run seed
```

### 启动服务
```bash
npm start
```

服务启动后：
- Web 看板: http://localhost:3000
- 健康检查: http://localhost:3000/api/dashboard/health
- API 基础路径: http://localhost:3000/api

## 核心业务规则

### 1. 健康分规则
| 分数范围 | 等级 | 风险级别 | 处理方式 |
|---------|------|---------|---------|
| 85-100 | excellent | 低 | 正常推进 |
| 70-84 | good | 低 | 正常推进 |
| 50-69 | fair | 中 | 建议关注 |
| 30-49 | poor | 高 | 需介入了解 |
| 0-29 | critical | 极高 | 启动风险流程，不可标绿 |

### 2. 工单规则
- **high/critical 优先级** 或 **major/severe 严重度** 的未结工单 → 流程阻塞
- SLA 超时的工单 → 提升风险等级
- 阻塞状态下不可标绿推进

### 3. 折扣审批规则
| 客户级别 | 标准折扣阈值 | 超阈值审批级别 |
|---------|-------------|--------------|
| standard | 10% | team_lead → manager → director → vp |
| premium | 15% | team_lead → manager → director → vp |
| enterprise | 20% | team_lead → manager → director → vp |

## API 接口

### 续约流程接口 `POST /api/renewal`

#### 创建流程
```bash
POST /api/renewal/create
Content-Type: application/json

{
  "customerId": "uuid",
  "requestId": "req-001",
  "operator": "csm_zhang"
}
```

#### 推进步骤
```bash
# 汇总数据
POST /api/renewal/{workflowId}/aggregate

# 健康检查
POST /api/renewal/{workflowId}/check-health

# 工单检查
POST /api/renewal/{workflowId}/check-tickets

# 准备报价
POST /api/renewal/{workflowId}/prepare-quote
{
  "quoteData": {
    "productLines": [...],
    "baseTotal": 150000,
    "discountPercent": 5,
    "finalTotal": 142500
  },
  "operator": "csm_zhang"
}

# 折扣审批
POST /api/renewal/{workflowId}/approve-discount
{
  "quoteId": "uuid",
  "approval": {
    "approved": true,
    "level": "level2",
    "comments": "战略客户，同意折扣"
  },
  "operator": "manager_li"
}

# 就绪等待跟进
POST /api/renewal/{workflowId}/ready-for-csm

# 客户接受
POST /api/renewal/{workflowId}/customer-accept

# 完成流程
POST /api/renewal/{workflowId}/complete
```

#### 异常处理和人工修正
```bash
# 人工修正
POST /api/renewal/{workflowId}/manual-correction
{
  "correction": {
    "status": "at_risk",
    "notes": "已安排紧急客户会议...",
    "reason": "客户成功经理紧急介入"
  },
  "operator": "csm_wang"
}

# 记录异常
POST /api/renewal/{workflowId}/exception
{
  "exception": {
    "message": "外部系统调用失败",
    "details": { "errorCode": 500 }
  },
  "operator": "system"
}
```

#### 查询
```bash
# 查询流程详情
GET /api/renewal/{workflowId}

# 生成续约报告
GET /api/renewal/{workflowId}/report
GET /api/renewal/{workflowId}/report?format=csv
GET /api/renewal/{workflowId}/report?type=communication

# 列出所有流程
GET /api/renewal?status=completed
GET /api/renewal?customerId=uuid
```

### 看板接口 `GET /api/dashboard`

```bash
# 总览
GET /api/dashboard/summary

# 客户列表（带续约信息）
GET /api/dashboard/customers

# 健康检查
GET /api/dashboard/health
```

## 演示场景

### 场景 1: 健康续约流程
```bash
npm run demo:healthy
```

**路径**: 创新科技有限公司（健康分 92 分）
1. 创建续约流程
2. 汇总数据（客户档案、使用量、健康分、工单）
3. 健康检查通过（92 分 excellent）
4. 工单检查通过（无重大未结工单）
5. 准备报价（5% 折扣在阈值内，无需审批）
6. 就绪等待客户成功经理跟进
7. 客户接受报价
8. 完成续约流程

**验证点**:
- 报告显示"可以标绿: true"
- 完整的历史记录时间线
- 报价版本 v1

### 场景 2: 风险客户流程
```bash
npm run demo:risk
```

**路径**: 前途网络科技（健康分 28 分）
1. 创建续约流程
2. 汇总数据，健康分 28 分（critical）
3. 健康检查 → 自动标记 at_risk 状态
4. 触发告警，记录风险因素
5. 报告显示"可以标绿: false"
6. 人工修正，记录操作者和修改内容

**验证点**:
- 流程状态自动变为 `at_risk`
- 告警信息包含风险详情
- 历史记录展示人工修正的前后差异
- 沟通报告提供挽回建议

### 场景 3: 折扣审批流程
```bash
npm run demo:discount
```

**路径**: 星辰教育科技（standard 级别，申请 15% 折扣）
1. 创建续约流程
2. 通过健康检查和工单检查
3. 准备报价，申请 15% 折扣
4. 规则检查：standard 客户标准阈值 10%，15% 超阈值
5. 触发 manager 级别审批
6. 经理审批通过，记录审批意见

**验证点**:
- 15% 折扣自动触发审批流
- 审批记录包含审批人、级别、意见
- 报价版本保留完整历史

### 场景 4: 重复报价 & 幂等机制
```bash
npm run demo:repeat
```

**路径**: 创新科技有限公司（多次修改报价）
1. 使用相同 requestId 连续创建 2 次流程 → 幂等返回，不重复创建
2. 准备报价 v1（¥80,000，0% 折扣）
3. 客户要求降价，准备报价 v2（¥72,000，10% 折扣）
4. 增加产品，准备报价 v3（¥102,000，15% 折扣）
5. 演示工单阻塞场景：阳光制造集团有 2 个重大未结工单

**验证点**:
- 幂等机制：相同 requestId 不会重复创建流程
- 报价版本：v1 → v2 → v3 自动递增
- 历史记录：每次报价变更都有完整追踪
- 工单阻塞：重大未结工单 → blocked 状态

### 失败路径演示

**场景**: 重大工单未结不能标绿

1. 客户：阳光制造集团
2. 状态：2 个重大未结工单（1 个已超 SLA）
3. 工单检查 → 流程状态变为 `blocked`
4. 报告显示 "可以标绿: false"
5. 阻塞工单详情展示

**恢复路径**:
- 关闭或降级工单优先级后重新检查
- 或人工修正（需记录原因）

## 数据模型

### 客户档案 (Customer)
```javascript
{
  id: string,
  name: string,
  email: string,
  industry: string,
  tier: 'standard' | 'premium' | 'enterprise',
  currentContract: {
    startDate: string,
    endDate: string,
    annualValue: number,
    productIds: string[]
  },
  csmId: string
}
```

### 使用量指标 (UsageMetric)
```javascript
{
  id: string,
  customerId: string,
  productId: string,
  usage: object,
  trend: 'growing' | 'stable' | 'declining',
  comparedToLastPeriod: number
}
```

### 健康分 (HealthScore)
```javascript
{
  id: string,
  customerId: string,
  score: number,
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical',
  factors: string[],
  risks: string[],
  evaluatedAt: string
}
```

### 工单 (Ticket)
```javascript
{
  id: string,
  customerId: string,
  title: string,
  priority: 'low' | 'medium' | 'high' | 'critical',
  severity: 'minor' | 'moderate' | 'major' | 'severe',
  status: 'open' | 'in_progress' | 'closed',
  slaBreached: boolean,
  createdAt: string
}
```

### 报价 (Quote)
```javascript
{
  id: string,
  customerId: string,
  workflowId: string,
  version: number,
  productLines: Array,
  baseTotal: number,
  discountPercent: number,
  discountAmount: number,
  finalTotal: number,
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'accepted',
  approvalRequired: boolean,
  createdBy: string,
  createdAt: string
}
```

### 续约流程 (RenewalWorkflow)
```javascript
{
  id: string,
  customerId: string,
  requestId: string,
  status: WorkflowStatus,
  data: {
    customerProfile: Customer,
    usageMetrics: UsageMetric[],
    healthScore: HealthScore,
    openTickets: Ticket[],
    quotes: Quote[],
    discountApproval: object
  },
  riskFlags: Array,
  alerts: Array,
  notes: Array,
  assignee: string,
  createdAt: string,
  updatedAt: string,
  completedAt: string
}
```

### 状态机 (WorkflowStatus)
```
created → data_aggregated → health_checked → tickets_checked → quote_prepared
                                                                        ↓
                                                     discount_approved (如需审批)
                                                                        ↓
                                                     ready_for_csm → customer_accepted → completed

异常状态: at_risk (风险中), blocked (阻塞中), failed (已失败)
```

## 项目结构

```
customer-success-renewal-api/
├── src/
│   ├── server.js              # Express 服务器入口
│   ├── models/
│   │   ├── store.js           # 内存数据存储
│   │   └── factory.js         # 数据模型工厂
│   ├── services/
│   │   ├── renewalWorkflow.js # 续约流程服务（状态机）
│   │   ├── rules.js           # 业务规则引擎
│   │   └── reports.js         # 报告生成服务
│   └── routes/
│       ├── renewal.js         # 续约 API 路由
│       └── dashboard.js       # 看板 API 路由
├── public/
│   └── index.html             # Web 看板界面
├── scripts/
│   ├── seed.js                # 造数脚本
│   ├── demo-healthy-renewal.js
│   ├── demo-risk-customer.js
│   ├── demo-discount-approval.js
│   └── demo-repeat-quote.js
├── package.json
└── README.md
```

## 审计追踪

每次操作都会记录历史记录：

```javascript
{
  id: string,
  entityType: 'renewal' | 'quote',
  entityId: string,
  action: string,
  previousState: any,
  newState: any,
  changes: object,
  operator: string,
  reason: string,
  timestamp: string
}
```

**可追溯问题**:
- 谁在什么时间做了什么操作
- 操作前后的状态变化
- 为什么要做这个操作（原因）
- 具体修改了哪些内容（差异）

## 报告导出

### JSON 格式
```bash
GET /api/renewal/{workflowId}/report
GET /api/renewal/{workflowId}/report?type=communication
```

### CSV 格式
```bash
GET /api/renewal/{workflowId}/report?format=csv
GET /api/dashboard/export?format=csv
```

### 报告内容
1. **续约摘要报告**: 客户信息、健康分、工单、报价、风险分析、时间线
2. **客户沟通报告**: 沟通要点、异议应对、建议行动、总结建议

## 幂等机制

使用 `requestId` 实现幂等：

```javascript
// 第一次调用
POST /api/renewal/create
{ "requestId": "req-001", ... }
// → 创建新流程

// 第二次调用（网络重试）
POST /api/renewal/create
{ "requestId": "req-001", ... }
// → 返回已存在的流程，isIdempotent: true
```

## 扩展建议

1. **持久化存储**: 当前使用内存存储，可替换为 PostgreSQL/MongoDB
2. **消息队列**: 集成 RabbitMQ/Kafka 处理异步事件
3. **权限系统**: 基于角色的审批权限控制
4. **通知服务**: 邮件/企业微信通知客户成功经理
5. **数据同步**: 定时从 CRM/工单系统同步数据

## 许可证

MIT
