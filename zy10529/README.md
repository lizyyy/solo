# 制品晋级审批API

一个完整的DevOps制品晋级审批管理系统，用于替代手工登记流程。

## 功能特性

### 核心业务流程
- ✅ **晋级申请创建** - 支持多环境晋级（DEV → TEST → STAGING → PRODUCTION）
- ✅ **阶段式推进** - 4步标准流程：草稿 → 测试 → 签名 → 审批 → 完成
- ✅ **测试门禁校验** - 自动校验测试通过率、覆盖率、严重问题检查
- ✅ **数字签名验证** - 支持多种签名算法支持
- ✅ **多级审批流程** - 支持配置化审批流程
- ✅ **晋级完成确认** - 最终发布确认

### 异常与审计
- ✅ **人工修正记录** - 支持数据修正审批留痕
- ✅ **异常处理机制** - 保留原始输入、错误堆栈、处理上下文
- ✅ **完整审计日志** - 所有操作完整记录
- ✅ **操作人、时间、新旧值对比

### 报告导出
- ✅ **JSON格式** - 结构化数据导出
- ✅ **CSV格式** - Excel友好格式
- ✅ **PDF格式** - 正式审批报告
- ✅ **业务友好字段** - 中文说明，无内部技术字段

## 技术栈

- **后端框架**: Node.js + Express + TypeScript
- **数据库**: SQLite + Prisma ORM
- **数据验证**: express-validator
- **报告生成**: json2csv + pdfkit

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 生成Prisma客户端
npm run prisma:generate

# 执行数据库迁移
npm run prisma:migrate

# 初始化示例数据（可选）
npx ts-node scripts/init-db.ts
```

### 3. 启动服务

```bash
# 开发模式（热重载
npm run dev

# 生产模式
npm run build && npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口文档

### 基础信息

- **Base URL**: `http://localhost:3000/api/promotions`
- **操作员标识**: 通过请求头 `x-operator` 传入当前操作人姓名

### 1. 晋级管理

#### 创建晋级申请
```http
POST /api/promotions
Content-Type: application/json
x-operator: 张三

{
  "artifactName": "订单服务",
  "version": "1.0.0",
  "buildNumber": "20240517001",
  "commitHash": "abc123def456",
  "buildBranch": "release/1.0.0",
  "fromEnvironment": "TEST",
  "toEnvironment": "PRODUCTION",
  "title": "订单服务v1.0.0生产环境晋级",
  "description": "包含性能优化、Bug修复",
  "initiator": "张三",
  "artifactUrl": "https://artifacts.example.com/order/1.0.0",
  "checksum": "sha256:abcdef123456",
  "checksumAlgorithm": "SHA256"
}
```

#### 查询晋级列表
```http
GET /api/promotions?page=1&pageSize=20&artifactName=订单服务&status=PENDING_TEST
```

#### 获取晋级详情
```http
GET /api/promotions/{id}
```

#### 启动晋级流程
```http
POST /api/promotions/{id}/start
```

#### 取消晋级
```http
POST /api/promotions/{id}/cancel
Content-Type: application/json

{
  "reason": "发现严重Bug，暂缓发布"
}
```

### 2. 测试结果

#### 提交测试结果
```http
POST /api/promotions/test-result
Content-Type: application/json

{
  "promotionId": "uuid",
  "testSuite": "集成测试套件",
  "totalTests": 150,
  "passedTests": 148,
  "failedTests": 1,
  "skippedTests": 1,
  "testResult": "PASS",
  "testDuration": 180,
  "testReportUrl": "http://test-reports.example.com/12345",
  "coveragePercent": 85.5,
  "criticalIssues": [],
  "gatePassed": true,
  "remarks": "失败用例为已知问题",
  "verifiedBy": "李四"
}
```

#### 检查测试门禁
```http
GET /api/promotions/{id}/test-gate
```

### 3. 签名与审批

#### 提交签名
```http
POST /api/promotions/signature
Content-Type: application/json

{
  "promotionId": "uuid",
  "signatory": "王五",
  "signatureData": "0xabcdef123456789",
  "signatureAlgorithm": "SHA256withRSA",
  "certificateInfo": "CN=王五, OU=技术部",
  "remarks": "代码评审通过"
}
```

#### 提交审批
```http
POST /api/promotions/approval
Content-Type: application/json

{
  "promotionId": "uuid",
  "approver": "赵六",
  "approverRole": "技术总监",
  "decision": "APPROVE",
  "comments": "符合上线要求",
  "sequenceOrder": 1
}
```

#### 完成晋级
```http
POST /api/promotions/{id}/complete
```

### 4. 人工修正

#### 创建修正记录
```http
POST /api/promotions/correction
Content-Type: application/json

{
  "promotionId": "uuid",
  "correctionType": "数据修正",
  "fieldName": "testResult",
  "oldValue": "FAIL",
  "newValue": "PASS",
  "reason": "测试环境异常，重新测试通过",
  "correctedBy": "张三",
  "approvalRequired": true
}
```

#### 审批修正
```http
POST /api/promotions/correction/{id}/approve
Content-Type: application/json

{
  "approvedBy": "李四"
}
```

### 5. 异常处理

#### 解决异常记录
```http
POST /api/promotions/exception/{id}/resolve
Content-Type: application/json

{
  "resolvedBy": "张三",
  "resolutionNotes": "已修复数据库连接问题"
}
```

### 6. 审计与导出

#### 获取审计日志
```http
GET /api/promotions/{id}/audit-logs
```

#### 获取异常记录
```http
GET /api/promotions/{id}/exceptions
```

#### 导出JSON报告
```http
GET /api/promotions/{id}/export/json
```

#### 导出CSV报告
```http
GET /api/promotions/{id}/export/csv
```

#### 导出PDF报告
```http
GET /api/promotions/{id}/export/pdf
```

#### 获取导出历史
```http
GET /api/promotions/{id}/export/history
```

## 数据模型

### 环境阶段 (EnvironmentStage)
- `DEV` - 开发环境
- `TEST` - 测试环境
- `STAGING` - 预发布环境
- `PRODUCTION` - 生产环境

### 晋级状态 (PromotionStatus)
- `DRAFT` - 草稿
- `PENDING_TEST` - 待测试
- `TEST_COMPLETED` - 测试完成
- `PENDING_SIGNATURE` - 待签名
- `SIGNED` - 已签名
- `PENDING_APPROVAL` - 待审批
- `APPROVED` - 已审批
- `PROMOTED` - 已晋级
- `REJECTED` - 已驳回
- `FAILED` - 失败
- `CANCELLED` - 已取消

### 审批决策 (ApprovalDecision)
- `APPROVE` - 同意
- `REJECT` - 驳回
- `DEFER` - 暂缓

### 测试结果 (TestResult)
- `PASS` - 通过
- `FAIL` - 失败
- `PARTIAL` - 部分通过
- `NOT_RUN` - 未运行

## 业务规则

### 测试门禁规则
1. 测试通过率 ≥ 90%
2. 代码覆盖率 ≥ 80%（如果配置）
3. 无严重级别问题
4. 测试人员确认通过

### 晋级推进规则
1. 必须按顺序完成：测试 → 签名 → 审批
2. 每一步必须确认通过才能进入下一步
3. 任何一步失败或驳回，流程终止
4. 支持人工修正，但必须记录原因和审批

### 异常处理规则
1. 所有异常自动记录：
   - 异常类型
   - 错误代码
   - 错误信息
   - 堆栈跟踪
   - 原始输入数据
   - 处理上下文
   - 处理状态
   - 解决人、时间、备注

## 运行示例

```bash
# 确保服务已启动
npm run dev

# 新开终端运行示例脚本
npx ts-node scripts/example.ts
```

## 项目结构

```
.
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── migrations/             # 数据库迁移文件
│   └── dev.db              # SQLite数据库文件
├── src/
│   ├── index.ts             # 服务入口
│   ├── lib/
│   │   └── prisma.ts         # Prisma客户端
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── services/
│   │   ├── promotion.service.ts   # 晋级服务
│   │   ├── test.service.ts      # 测试服务
│   │   ├── signature.service.ts # 签名服务
│   │   ├── approval.service.ts  # 审批服务
│   │   ├── correction.service.ts# 修正服务
│   │   ├── export.service.ts    # 导出服务
│   │   └── audit.service.ts     # 审计服务
│   └── routes/
│       └── promotion.routes.ts # API路由
├── scripts/
│   ├── init-db.ts          # 数据库初始化
│   └── example.ts            # API示例脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 健康检查

```http
GET /health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2024-05-17T12:00:00.000Z"
}
```
