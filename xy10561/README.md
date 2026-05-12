# 公益捐赠票据 API 系统

一个完整的公益捐赠票据管理 API 系统，支持个人/企业开票、合并开票、撤销退款、票据作废和资金用途追踪。

## 功能特性

### 核心业务
- **捐赠管理**：创建、确认、退款捐赠订单
- **票据管理**：申请、开具、作废、下载发票
- **合并开票**：支持企业多笔捐赠合并开具一张发票
- **资金追踪**：记录项目资金使用情况
- **报告导出**：生成财务对账报告

### 业务规则
- ✅ 重复开票检测
- ✅ 企业抬头税号必填
- ✅ 跨项目禁止合并开票
- ✅ 作废票据禁止下载
- ✅ 退款前必须先作废发票
- ✅ 重复请求幂等性保证
- ✅ 人工修正记录前后差异和操作者

### 状态追踪
- 捐赠：PENDING → CONFIRMED → REFUNDED
- 票据：DRAFT → ISSUED → USED → CANCELLED
- 合并请求：PENDING → PROCESSING → COMPLETED/FAILED

## 快速开始

### 环境要求
- Node.js 18+
- npm 9+

### 安装依赖
```bash
npm install
```

### 本地启动
```bash
npm start
```

服务启动后访问：http://localhost:3000/api/health

### 初始化样例数据
```bash
npm run seed
```

## 项目结构

```
.
├── src/
│   ├── app.js                    # 应用入口
│   ├── models/
│   │   ├── database.js           # 数据库连接
│   │   └── schema.js             # 表结构定义
│   ├── services/
│   │   ├── donationService.js    # 捐赠服务
│   │   ├── invoiceService.js     # 票据服务
│   │   ├── mergeService.js       # 合并开票服务
│   │   └── reportService.js      # 报告服务
│   ├── controllers/              # API 控制器
│   ├── middleware/               # 中间件
│   ├── utils/                    # 工具函数
│   └── routes/                   # 路由定义
├── examples/
│   ├── demo.js                   # 主演示脚本
│   ├── failure.js                # 失败路径演示
│   └── seed.js                   # 样例数据初始化
├── data/                         # SQLite 数据库文件
└── package.json
```

## 演示流程

### 一、运行完整演示（推荐）
```bash
# 先清理旧数据
rm -rf data

# 运行6个演示场景
npm run demo
```

**演示场景说明：**

1. **场景一：个人捐赠开票流程**
   - 创建个人捐赠（PENDING）
   - 确认捐赠（CONFIRMED）
   - 申请个人发票（DRAFT）
   - 财务审核开票（ISSUED）
   - 下载发票

2. **场景二：企业多笔捐赠合并开票**
   - 创建两笔企业捐赠并确认
   - 申请合并开票（PENDING）
   - 处理合并请求（COMPLETED）
   - 查看合并后的发票

3. **场景三：捐赠撤销与发票作废（退款同步）**
   - 创建捐赠并开票
   - 用户申请退款
   - 系统规则：必须先作废发票
   - 作废发票（CANCELLED）
   - 执行退款（REFUNDED）
   - 验证：作废发票无法下载

4. **场景四：重复开票保护机制**
   - 创建并确认捐赠
   - 第一次申请发票（成功）
   - 第二次申请发票（被拒绝）

5. **场景五：项目资金用途追踪**
   - 查看项目资金汇总
   - 记录两笔资金使用
   - 查看更新后的资金余额

6. **场景六：财务对账报告导出**
   - 生成完整对账报告
   - 查看对账检查结果
   - 导出文本格式报告

### 二、运行失败路径演示
```bash
# 清理旧数据后运行
rm -rf data && npm run failure
```

**8个失败场景（100%覆盖率）：**

| # | 场景 | 预期错误码 |
|---|------|-----------|
| 1 | 企业捐赠缺少税号 | TAX_ID_MISSING |
| 2 | 未确认的捐赠申请开票 | INVALID_STATUS_TRANSITION |
| 3 | 重复开票（已有有效发票） | DUPLICATE_INVOICE |
| 4 | 跨项目合并开票 | CROSS_PROJECT_MERGE |
| 5 | 企业合并开票缺少税号 | TAX_ID_MISSING |
| 6 | 下载已作废的发票 | CANCELLED_INVOICE_DOWNLOAD |
| 7 | 有有效发票的捐赠直接退款 | INVALID_STATUS_TRANSITION |
| 8 | 资金使用超出可用余额 | VALIDATION_ERROR |

## API 接口说明

### 基础 URL
```
http://localhost:3000/api
```

### 健康检查
```
GET /health
```

### 项目管理
```
POST   /projects                    # 创建项目
GET    /projects                    # 获取所有项目
GET    /projects/:projectId         # 获取项目详情
GET    /projects/:projectId/funds   # 获取项目资金情况
POST   /projects/:projectId/funds/usage  # 记录资金使用
```

### 捐赠管理
```
POST   /donations                   # 创建捐赠
GET    /donations                   # 获取捐赠列表（支持筛选）
GET    /donations/:donationId       # 获取捐赠详情
POST   /donations/:donationId/confirm  # 确认捐赠
POST   /donations/:donationId/refund   # 退款捐赠
```

### 票据管理
```
POST   /invoices                    # 申请发票
GET    /invoices                    # 获取票据列表
GET    /invoices/:invoiceId         # 获取票据详情
POST   /invoices/:invoiceId/issue   # 开具发票
POST   /invoices/:invoiceId/cancel  # 作废发票
GET    /invoices/:invoiceId/download # 下载发票
POST   /invoices/:invoiceId/correct # 人工修正
```

### 合并开票
```
POST   /merge-requests              # 创建合并请求
GET    /merge-requests              # 获取合并请求列表
GET    /merge-requests/:requestId   # 获取合并请求详情
POST   /merge-requests/:requestId/process  # 处理合并请求
```

### 报告与历史
```
GET    /reports/financial           # 财务报告
GET    /reports/projects/:projectId # 项目报告
GET    /reports/reconciliation      # 完整对账报告
GET    /reports/export?format=json|text  # 导出报告
GET    /reports/summary             # 状态汇总
GET    /history                     # 操作历史记录
```

## 状态流转图

### 捐赠状态
```
PENDING ──confirm──→ CONFIRMED ──refund──→ REFUNDED
   │
   └── (创建时的初始状态)
```

### 票据状态
```
DRAFT ──issue──→ ISSUED ──cancel──→ CANCELLED
  │                │
  └──cancel──→ CANCELLED
```

### 合并请求状态
```
PENDING ──process──→ COMPLETED
   │
   └──fail──→ FAILED
```

## 关键业务规则

### 1. 重复开票检测
- 每个捐赠只能有一张**有效**（非 CANCELLED）发票
- 已作废的发票可以重新申请

### 2. 企业税号规则
- 企业类型捐赠必须提供税号
- 企业合并开票必须提供税号
- 个人捐赠不需要税号

### 3. 跨项目合并限制
- 只能合并**同一项目**下的多笔捐赠
- 不同项目的捐赠禁止合并

### 4. 作废票据规则
- CANCELLED 状态的票据无法下载
- 作废后 download_url 被清空
- 历史记录保存作废原因

### 5. 退款同步规则
- 退款前必须先作废所有关联的有效票据
- 系统自动检查并阻止违规操作

### 6. 幂等性保证
- 支持 `X-Idempotency-Key` 请求头
- 相同 key 的重复请求返回缓存结果
- 不同请求数据使用相同 key 会返回冲突错误

### 7. 人工修正审计
- 修正操作记录 before/after 数据
- 记录差异（diff）和操作者
- 历史可追溯

## 报告说明

### 对账报告包含
1. **数据概览**：项目数、捐赠数、票据数、资金使用数
2. **财务汇总**：总确认捐赠、总退款、净捐赠、已开票、已使用、可用余额
3. **对账检查**：
   - Confirmed vs Invoiced Balance（确认金额 vs 开票金额）
   - Net vs Available Balance（净金额 vs 可用余额）
4. **项目明细**：每个项目的独立报告
5. **历史记录**：所有状态变更和操作日志

### 报告导出格式
- **JSON**：适合程序处理
- **Text**：适合人工阅读和打印

## 幂等性使用示例

```bash
# 第一次请求（创建捐赠）
curl -X POST http://localhost:3000/api/donations \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: key-001" \
  -d '{"projectId":"xxx","amount":100,"donorType":"PERSONAL","donorName":"test"}'

# 第二次请求（相同 key，返回缓存结果）
curl -X POST http://localhost:3000/api/donations \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: key-001" \
  -d '{"projectId":"xxx","amount":100,"donorType":"PERSONAL","donorName":"test"}'
# 返回: { ..., "fromCache": true }
```

## 数据库

系统使用 SQLite 轻量级数据库，数据文件存储在 `data/charity.db`。

### 主要数据表
- **projects**：项目信息
- **donations**：捐赠记录
- **invoices**：票据记录
- **merge_requests**：合并开票请求
- **merge_request_items**：合并请求明细
- **fund_usages**：资金使用记录
- **history**：操作历史（审计日志）
- **idempotency_keys**：幂等键记录

## 验证业务闭环

运行演示后，通过以下方式验证业务是否真的闭环：

### 1. 查看状态汇总
```bash
curl http://localhost:3000/api/reports/summary
```

检查字段：
- `financial.totalConfirmed`：总确认金额
- `financial.totalRefunded`：总退款金额
- `financial.totalInvoiced`：已开票金额
- `financial.totalUsed`：已使用金额
- `financial.availableBalance`：可用余额

### 2. 查看对账检查
```bash
curl http://localhost:3000/api/reports/reconciliation
```

关注 `reconciliationChecks` 数组：
- `status: "PASS"`：检查通过
- `status: "WARN"`：存在差异

### 3. 查看完整历史
```bash
curl http://localhost:3000/api/history
```

验证每笔操作都有记录：
- 状态变更（from_status → to_status）
- 前后数据对比（before_data, after_data）
- 差异记录（diff）
- 操作者（operator）
- 原因（reason）
- 错误信息（error_code, error_message）

### 4. 导出报告
```bash
# JSON 格式
curl http://localhost:3000/api/reports/export

# 文本格式
curl http://localhost:3000/api/reports/export?format=text
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| DUPLICATE_INVOICE | 重复开票 |
| TAX_ID_MISSING | 企业税号缺失 |
| CROSS_PROJECT_MERGE | 跨项目合并 |
| CANCELLED_INVOICE_DOWNLOAD | 作废票据下载 |
| INVALID_STATUS_TRANSITION | 无效状态转换 |
| IDEMPOTENCY_CONFLICT | 幂等键冲突 |
| NOT_FOUND | 资源不存在 |
| VALIDATION_ERROR | 参数验证错误 |

## 技术栈

- **框架**: Express.js 4
- **数据库**: SQLite (sql.js)
- **工具库**: uuid, moment, cors
- **无外部依赖**：无需安装数据库服务

## 许可证

MIT
