# 招商运营后端服务

## 项目概述

这是一个完整的招商运营后端管理系统，用于管理摊位申请、证照审核、场地档期、押金流水等业务。系统提供了完整的可追踪记录功能，支持边界情况的可读说明。

## 功能特性

- ✅ **批次管理**: 支持创建导入批次，批量导入CSV数据
- ✅ **摊位申请**: 管理商户摊位申请记录
- ✅ **证照管理**: 证照上传、版本管理、过期提醒
- ✅ **场地日历**: 档期冲突检测、场地占用管理
- ✅ **处理记录**: 完整的状态变更日志，记录原因、处理人、时间
- ✅ **押金管理**: 押金收取、扣减、退还流水记录
- ✅ **历史查询**: 按场地档期、证照版本、押金流水查询历史
- ✅ **数据导出**: 支持导出申请明细、处理日志、押金流水
- ✅ **边界处理**: 证照过期、时间冲突、余额不足等场景提供可读说明

## 技术栈

- Node.js + TypeScript
- Express.js (Web框架)
- Sequelize (ORM)
- SQLite (数据库)
- multer (文件上传)
- csv-parser/csv-writer (CSV处理)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

### 编译生产版本

```bash
npm run build
npm start
```

## API 接口文档

### 健康检查

```
GET /api/health
```

### 批次管理

#### 创建批次

```
POST /api/batches
Body: { name: string, importedBy: string, remark?: string }
```

#### 获取批次列表

```
GET /api/batches?page=1&pageSize=20&status=pending
```

#### 获取单个批次

```
GET /api/batches/:id
```

#### 导入CSV数据

```
POST /api/batches/:id/import
Content-Type: multipart/form-data
Form: { file: <csv-file>, operator: string }
```

CSV格式参考 `sample.csv`：
- merchantName: 商户名称
- contactPerson: 联系人
- contactPhone: 联系电话
- stallType: 摊位类型
- stallLocation: 摊位位置
- startDate: 开始日期 (YYYY-MM-DD)
- endDate: 结束日期 (YYYY-MM-DD)
- depositAmount: 押金金额
- certificateVersion: 证照版本

#### 获取批次下的申请

```
GET /api/batches/:id/applications?page=1&pageSize=20
```

### 摊位申请管理

#### 获取申请列表

```
GET /api/applications?page=1&pageSize=20&status=pending&merchantName=xxx&stallLocation=xxx&certificateVersion=xxx&startDate=2024-01-01&endDate=2024-12-31
```

状态说明:
- pending: 待处理
- processing: 处理中
- approved: 已通过
- rejected: 已拒绝
- returned: 已退回

#### 获取申请详情

```
GET /api/applications/:id
```

#### 通过申请

```
POST /api/applications/:id/approve
Body: { operator: string, reason: string, venueName?: string }
```

⚠️ **自动校验**: 批准时会自动检查证照有效性和场地档期冲突，如有问题会返回可读的错误说明

#### 拒绝申请

```
POST /api/applications/:id/reject
Body: { operator: string, reason: string }
```

#### 退回修改

```
POST /api/applications/:id/return
Body: { operator: string, reason: string }
```

#### 获取处理日志

```
GET /api/applications/:id/logs
```

### 证照管理

#### 添加证照

```
POST /api/certificates
Body: { applicationId: number, certificateNo: string, type: string, version: string, issueDate: string, expiryDate: string, attachmentUrl?: string }
```

#### 获取申请的证照

```
GET /api/certificates/application/:applicationId
```

#### 校验证照

```
POST /api/certificates/application/:applicationId/check
Body: { operator: string }
```

⚠️ **过期提醒**: 证照过期或即将过期会返回可读说明

#### 按版本查询证照

```
GET /api/certificates/version/:version
```

### 场地档期管理

#### 检查档期冲突

```
GET /api/schedules/check?venueName=xxx&location=xxx&startDate=2024-01-01&endDate=2024-01-31
```

#### 查询场地档期

```
GET /api/schedules/venue?venueName=xxx&location=xxx&startDate=2024-01-01&endDate=2024-01-31
```

#### 占用档期

```
POST /api/schedules/occupy
Body: { applicationId: number, venueName: string, location: string, startDate: string, endDate: string }
```

#### 封禁档期

```
POST /api/schedules/block
Body: { venueName: string, location: string, startDate: string, endDate: string, blockedBy: string, blockedReason: string }
```

#### 释放档期

```
POST /api/schedules/release/:applicationId
```

### 押金管理

#### 获取流水列表

```
GET /api/deposits?page=1&pageSize=20&applicationId=1&flowType=deduct&operator=xxx&startDate=2024-01-01&endDate=2024-12-31
```

流水类型:
- collect: 收取
- deduct: 扣减
- refund: 退还

#### 获取申请的押金流水

```
GET /api/deposits/application/:applicationId
```

#### 扣减押金

```
POST /api/deposits/deduct
Body: { applicationId: number, amount: number, reason: string, operator: string }
```

⚠️ **余额校验**: 押金不足时返回可读的错误说明

#### 收取押金

```
POST /api/deposits/collect
Body: { applicationId: number, amount: number, reason: string, operator: string }
```

#### 退还押金

```
POST /api/deposits/refund
Body: { applicationId: number, reason: string, operator: string }
```

#### 查询押金余额

```
GET /api/deposits/balance/:applicationId
```

### 数据导出

#### 导出申请明细

```
POST /api/exports/applications
Body: { status?: string, merchantName?: string, stallLocation?: string, certificateVersion?: string, startDate?: string, endDate?: string, includeDetails?: boolean }
```

✅ **导出数量与查询结果一致**: 使用相同的过滤条件

#### 导出处理日志

```
POST /api/exports/logs
Body: { applicationId?: number, startDate?: string, endDate?: string }
```

#### 导出押金流水

```
POST /api/exports/deposit-flows
Body: { applicationId?: number, startDate?: string, endDate?: string }
```

#### 下载导出文件

```
GET /api/exports/download/:filename
```

## 边界情况处理

### 1. 证照过期

- **场景**: 证照过期或30天内即将过期
- **处理**: 批准申请时自动检测，记录日志，返回可读说明
- **示例说明**: "证照【营业执照】已过期，过期日期：2024-01-01，请立即更新"

### 2. 档期冲突

- **场景**: 申请的场地档期已被占用或封禁
- **处理**: 自动检测冲突，记录详细的冲突信息
- **示例说明**: "档期冲突，冲突申请：【APP001】- 张三美食，占用时间：2024-06-01 至 2024-06-30"

### 3. 押金扣减

- **场景**: 扣减押金时余额不足
- **处理**: 校验余额，返回可读的错误信息
- **示例说明**: "操作员【管理员】扣减押金 1000 元，原因：违规经营，操作前余额：500 元，操作后余额：-500 元"

### 4. 状态变更追踪

- **所有状态变更都会记录**: 原因、处理人、时间、旧状态、新状态
- **可读说明**: 自动生成人类可读的变更记录

## 可追踪性设计

### 处理日志 (ProcessingLog)

每条操作都记录以下信息:
- `applicationId`: 关联的申请ID
- `logType`: 日志类型（状态变更、证照问题、档期冲突、押金扣减等）
- `reason`: 原始原因
- `readableReason`: 可读的人类友好说明
- `operator`: 操作人
- `operatedAt`: 操作时间
- `oldStatus`: 旧状态
- `newStatus`: 新状态
- `metadata`: 附加JSON数据

### 押金流水 (DepositFlow)

每笔押金变动都记录:
- `flowNo`: 流水号
- `flowType`: 流水类型
- `amount`: 金额
- `balanceBefore`: 操作前余额
- `balanceAfter`: 操作后余额
- `readableReason`: 可读说明
- `operator`: 操作人
- `operatedAt`: 操作时间

## 重启后数据恢复

系统使用SQLite持久化存储，重启服务后:
- ✅ 所有申请记录保持不变
- ✅ 所有处理日志完整保留
- ✅ 押金流水完整可查
- ✅ 场地档期状态不变
- ✅ 证照版本和状态可以查询

## 项目结构

```
.
├── src/
│   ├── database/
│   │   └── index.ts          # 数据库连接
│   ├── models/
│   │   ├── Batch.ts          # 批次模型
│   │   ├── Application.ts    # 申请模型
│   │   ├── Certificate.ts    # 证照模型
│   │   ├── VenueSchedule.ts  # 场地档期模型
│   │   ├── ProcessingLog.ts  # 处理日志模型
│   │   ├── DepositFlow.ts    # 押金流水模型
│   │   └── index.ts          # 模型关联
│   ├── services/
│   │   ├── BatchService.ts       # 批次服务
│   │   ├── CsvImportService.ts   # CSV导入服务
│   │   ├── ApplicationService.ts # 申请处理服务
│   │   ├── CertificateService.ts # 证照服务
│   │   ├── ScheduleService.ts    # 场地档期服务
│   │   ├── DepositService.ts     # 押金服务
│   │   └── ExportService.ts      # 导出服务
│   ├── routes/
│   │   ├── batches.ts        # 批次路由
│   │   ├── applications.ts   # 申请路由
│   │   ├── certificates.ts   # 证照路由
│   │   ├── schedules.ts      # 场地路由
│   │   ├── deposits.ts       # 押金路由
│   │   └── exports.ts        # 导出路由
│   └── server.ts             # 入口文件
├── sample.csv                # CSV导入样例
├── package.json
├── tsconfig.json
└── README.md
```
