# 企业审批服务跨部门加签超时 API

基于 Node.js + Express + TypeORM 的企业审批服务后端 API，支持历史记录批量导入、人工备注处理、流程状态管理等功能。

## 功能特性

- ✅ **批量导入历史记录** - 支持从历史系统迁移数据
- ✅ **单条人工备注** - 对异常流程添加处理备注
- ✅ **状态管理** - 审批中/加签中/已超时/已办结/已撤回
- ✅ **加签人离职处理** - 支持转交其他审批人
- ✅ **撤回与重提** - 撤回后重新提交审批
- ✅ **列表查询** - 分页、筛选、排序
- ✅ **详情与历史** - 完整的操作审计日志
- ✅ **CSV导出** - 业务语言字段，与列表查询一致
- ✅ **完整测试覆盖** - 覆盖主要业务场景

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **语言**: TypeScript
- **ORM**: TypeORM
- **数据库**: SQLite (可扩展至 MySQL/PostgreSQL)
- **测试**: Jest + Supertest
- **导出**: json2csv

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式启动

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

### 生产构建

```bash
npm run build
npm start
```

### 运行测试

```bash
npm test
```

## API 接口文档

### 基础信息

- 基础路径: `http://localhost:3000/api/approval`
- Content-Type: `application/json`

### 1. 批量导入记录

**POST** `/import`

请求体:
```json
{
  "records": [
    {
      "orderNo": "APPR-2024-001",
      "title": "跨部门项目预算审批",
      "applicantId": "U001",
      "applicantName": "张三",
      "applicantDept": "财务部",
      "content": "申请项目预算50万元",
      "applyTime": "2024-01-15T09:00:00Z",
      "status": "signing",
      "timeoutTime": "2024-01-18T09:00:00Z",
      "signerId": "U002",
      "signerName": "李四",
      "signerDept": "技术部",
      "isResigned": false,
      "signOrder": 1,
      "signStartTime": "2024-01-15T10:00:00Z",
      "signStatus": "pending",
      "remark": ""
    }
  ],
  "operatorId": "ADMIN001",
  "operatorName": "系统管理员"
}
```

响应:
```json
{
  "success": 1,
  "failed": 0,
  "errors": []
}
```

### 2. 添加人工备注

**POST** `/:orderId/remark`

请求体:
```json
{
  "signId": "uuid-of-sign-record",
  "remark": "原审批人已离职，已转交其他同事处理",
  "operatorId": "ADMIN001",
  "operatorName": "系统管理员"
}
```

### 3. 列表查询

**GET** `/list`

查询参数:
- `page`: 页码 (默认 1)
- `pageSize`: 每页条数 (默认 20)
- `status`: 状态筛选 (pending/signing/timeout/completed/withdrawn)
- `orderNo`: 审批单号模糊搜索
- `applicantName`: 申请人模糊搜索
- `isTimeout`: 是否超时 (true/false)

### 4. 详情查询

**GET** `/:orderId`

返回审批单完整信息，包括加签记录、催办记录、操作历史。

### 5. 操作历史

**GET** `/:orderId/history`

### 6. 转交审批

**POST** `/:orderId/transfer`

请求体:
```json
{
  "signId": "uuid-of-sign-record",
  "transferToId": "U005",
  "transferToName": "替代审批人",
  "operatorId": "ADMIN001",
  "operatorName": "系统管理员"
}
```

### 7. 撤回审批

**POST** `/:orderId/withdraw`

请求体:
```json
{
  "operatorId": "U006",
  "operatorName": "赵六"
}
```

### 8. 重新提交

**POST** `/:orderId/resubmit`

请求体:
```json
{
  "operatorId": "U006",
  "operatorName": "赵六"
}
```

### 9. 导出 CSV

**GET** `/export/csv`

支持与列表查询相同的筛选参数。

### 10. 导出单笔详情

**GET** `/:orderId/export`

## 状态枚举

### 审批状态 (ApprovalStatus)
- `pending` - 审批中
- `signing` - 加签中
- `timeout` - 已超时
- `completed` - 已办结
- `withdrawn` - 已撤回

### 加签状态 (SignStatus)
- `pending` - 待处理
- `approved` - 已同意
- `rejected` - 已拒绝
- `timeout` - 已超时
- `transferred` - 已转交

## 验收指南

### 1. 完整流转验收

使用 `data/acceptance-data.json` 中的 `fullFlowRecords` 进行测试：

1. 导入记录
2. 查询列表确认导入成功
3. 查看详情
4. 添加人工备注
5. 查看操作历史
6. 导出CSV验证

### 2. 冲突记录验收

使用 `conflictRecords` 测试重复导入，系统应返回导入失败，错误信息包含"已存在"。

### 3. 导入坏行验收

使用 `badRecords` 测试数据完整性，系统应正确统计成功/失败数量，并返回具体错误信息。

### 4. 加签人离职验收

使用 `resignedRecords` 测试：
1. 导入离职状态记录
2. 查询确认 `isResigned` 为 true
3. 执行转交操作
4. 验证新加签记录创建

### 5. 撤回再提交验收

使用 `withdrawRecords` 测试：
1. 导入记录
2. 执行撤回操作
3. 验证状态变为 `withdrawn`
4. 执行重新提交
5. 验证状态恢复为 `signing`
6. 查看操作历史确认完整链路

## 项目结构

```
.
├── src/
│   ├── index.ts              # 应用入口
│   ├── database.ts           # 数据库配置
│   ├── entities/             # 数据模型
│   │   ├── ApprovalOrder.ts
│   │   ├── SignRecord.ts
│   │   ├── RemindRecord.ts
│   │   └── OperationHistory.ts
│   ├── services/             # 业务逻辑
│   │   ├── ApprovalService.ts
│   │   └── ExportService.ts
│   ├── routes/               # 路由定义
│   │   └── approval.ts
│   └── types/                # 类型定义
│       └── enums.ts
├── __tests__/                # 测试文件
│   └── approval.test.ts
├── data/                     # 数据目录
│   ├── acceptance-data.json
│   └── approval.db
├── package.json
├── tsconfig.json
└── .env
```

## 测试覆盖

- ✅ 健康检查
- ✅ 批量导入（成功/重复/坏数据）
- ✅ 加签人离职场景（查询/转交/备注）
- ✅ 撤回后再提交流程
- ✅ 列表查询（筛选/分页）
- ✅ 导出功能（CSV业务字段/数据一致性）
- ✅ 完整流程验收

## 环境变量

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/approval.db
CSV_EXPORT_ENCODING=UTF-8
TIMEOUT_HOURS=72
```

## 扩展建议

1. **用户认证**: 集成 JWT/OAuth2 认证
2. **消息通知**: 集成邮件/IM 催办通知
3. **工作流引擎**: 集成更复杂的审批流程引擎
4. **审计增强**: 更细粒度的操作审计
5. **性能优化**: 数据库索引、查询优化、缓存

## License

MIT
