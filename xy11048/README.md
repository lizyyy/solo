# 高校实验室试剂领用审批 API

高校实验室试剂领用审批系统的后端API服务，支持危化品特殊审批流程、审计一致性检查、状态机控制等核心功能。

## 功能特性

### 🔐 审批流程管控
- **多级审批机制**：草稿 → 提交 → 实验室主任审批 → 安全员审核 → 审计检查 → 批准
- **状态机严格控制**：不允许跳级审批，每一步状态转换都经过验证
- **二审机制**：中高危险等级危化试剂自动触发二次审批

### ⚠️ 危化品特殊处理
- **危险等级分级**：低/中/高/极高危四级管理
- **领用限额控制**：单次限额 + 月度限额双重控制
- **安全培训验证**：领用危化品必须持有有效安全培训证明
- **废液处置方案**：危化品必须提供详细废弃物处理方案

### 🔍 审计一致性检查
- **库存实时比对**：申请数量与实际库存自动核对
- **台账差异检测**：系统记录与实际库存不一致时触发告警
- **数量合计校验**：明细数量与申请总数量自动校验

### 🛡️ 错误处理与解释
- **可解释错误消息**：每个错误都包含拦截原因和解决方案指引
- **ETag并发控制**：防止重复提交和数据冲突
- **统一错误码**：便于前端统一处理

## 快速开始

### 环境要求
- Node.js >= 18.0.0

### 安装与启动

```bash
# 直接启动服务（自动加载种子数据）
node src/server.js

# 运行测试
node test/approval.test.js
```

服务启动后访问: http://localhost:3000

## API 接口文档

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |
| GET | `/api/stats` | 审批统计数据 |

### 试剂管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reagents` | 获取试剂列表 |
| POST | `/api/reagents` | 新增试剂 |

### 审批流程

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/requests` | 获取申请列表（支持?state=xxx筛选） |
| GET | `/api/requests/:id` | 获取单个申请详情 |
| POST | `/api/requests` | 创建申请 |
| POST | `/api/requests/:id/submit` | 提交申请 |
| POST | `/api/requests/:id/lab-manager-approve` | 实验室主任审批 |
| POST | `/api/requests/:id/safety-review` | 安全员审核 |
| POST | `/api/requests/:id/second-review` | 二次审批 |
| POST | `/api/requests/:id/audit-check` | 审计检查 |
| POST | `/api/requests/:id/reject` | 驳回申请 |

## 审批状态说明

```
draft (草稿)
  ↓
submitted (已提交)
  ↓
lab_manager_approved (主任审批通过)
  ↓
safety_reviewed (安全员审核通过) → 触发审计一致性检查
  ↓
pending_second_review (待二审) ──┐
  ↓                               │
audit_inconsistency (审计不一致)  │
  ↓                               │
approved (已批准) ←───────────────┘
  ↓
completed (已完成) / rejected (已驳回) / cancelled (已取消)
```

## 错误代码说明

| 错误码 | 说明 | 解决方案指引 |
|--------|------|-------------|
| `VALIDATION_ERROR` | 数据验证失败 | 检查必填字段是否完整，格式是否正确 |
| `INVALID_STATE_TRANSITION` | 无效状态转换 | 检查当前审批状态，按正确流程操作 |
| `STATE_TRANSITION_SKIPPED` | 状态越级 | 必须按顺序通过所有审批节点 |
| `DUPLICATE_SUBMISSION` | 重复提交 | 该申请已在处理中，无需重复提交 |
| `HAZARDOUS_OVER_QUOTA` | 危化品超限额 | 减少领用量或联系管理员申请特殊配额 |
| `SECOND_REVIEW_REQUIRED` | 需要二审 | 联系高级安全管理员完成二次审批 |
| `AUDIT_INCONSISTENCY` | 审计不一致 | 核对领用记录与实际库存差异 |
| `INVENTORY_INSUFFICIENT` | 库存不足 | 先申请采购或减少领用数量 |
| `ETAG_MISMATCH` | 数据版本冲突 | 数据已被他人修改，请刷新后重新操作 |
| `NOT_FOUND` | 记录不存在 | 检查ID是否正确 |
| `PERMISSION_DENIED` | 无权限 | 联系相应审批人员 |

## 种子数据

系统启动时自动加载以下测试数据：

### 试剂库 (6种)
- **普通试剂**：无水乙醇、超纯水
- **危化试剂**：浓硫酸(高)、浓盐酸(高)、甲醛溶液(中)、乙酸乙酯(极高)

### 用户 (5人)
- 张三（研究员，申请人）
- 李四（实验室主任）
- 王五（安全员）
- 赵六（审计员）
- 钱七（高级管理员/二审）

### 实验室 (3个)
- 有机化学实验室、分析化学实验室、物理化学实验室

## 测试覆盖

运行 `node test/approval.test.js` 执行完整测试套件：

✅ **正常流程测试**：普通试剂完整审批流程  
✅ **危化品二审测试**：危险试剂自动触发二次审批  
✅ **状态越级拦截**：不允许跳过审批节点  
✅ **无效状态转换**：已完成的申请不能重复操作  
✅ **审计一致性检查**：库存差异检测与告警  
✅ **数据验证**：必填字段缺失拦截  
✅ **ETag并发控制**：防止重复提交  
✅ **驳回功能**：各审批节点均可驳回申请  
✅ **完整二审流程**：中高危险试剂完整审批链路  

## 项目结构

```
├── src/
│   ├── config/
│   │   └── constants.js          # 常量配置
│   ├── models/
│   │   ├── Reagent.js            # 试剂模型
│   │   └── ApprovalRequest.js    # 审批申请模型
│   ├── services/
│   │   └── ApprovalService.js    # 审批核心服务
│   ├── data/
│   │   ├── store.js              # 内存数据存储
│   │   └── seed.js               # 种子数据
│   ├── utils/
│   │   └── errors.js             # 错误处理
│   └── server.js                 # HTTP服务器
├── test/
│   └── approval.test.js          # 测试套件
├── package.json
└── README.md
```

## 使用示例

### 创建并提交危化品申请

```bash
# 创建申请
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "applicantId": "user_001",
    "applicantName": "张三",
    "labId": "lab_001",
    "labName": "有机化学实验室",
    "researchPurpose": "用于有机合成实验，需要严格操作规范",
    "items": [{
      "reagentId": "reag_002",
      "reagentName": "浓硫酸",
      "category": "hazardous",
      "hazardLevel": "high",
      "quantity": 100,
      "unit": "ml"
    }],
    "emergencyContact": "李四",
    "emergencyPhone": "13800138000",
    "safetyTrainingCertified": true,
    "wasteDisposalPlan": "酸液中和后倒入专用废酸桶，由学校危废处理公司统一清运"
  }'

# 使用返回的 request.id 和 etag 提交
curl -X POST http://localhost:3000/api/requests/{id}/submit \
  -H "Content-Type: application/json" \
  -d '{"etag": "{etag}"}'
```

### 查看错误响应示例

```json
{
  "error": {
    "message": "审计一致性检查未通过",
    "code": "AUDIT_INCONSISTENCY",
    "details": {
      "issues": ["试剂 无水乙醇 实际库存 500ml，申请数量 10000ml 超出库存"],
      "requestId": "req_xxx"
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "resolution": "请核对领用记录与实际库存差异后重新提交"
  }
}
```

## 注意事项

1. **无外部依赖**：本服务使用内存存储，无需数据库，重启后数据重置
2. **种子数据**：服务启动时自动加载种子数据，便于本地测试
3. **测试优先**：所有异常场景都有对应的测试用例，确保系统健壮性
4. **可扩展性**：状态机设计易于新增审批节点和状态转换规则
