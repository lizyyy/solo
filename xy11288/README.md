# 会展展位物资管理系统

解决会展现场多个展位同时借用桁架、灯具、屏幕时的总账核对问题，支持导入、占用、调拨、归还、损耗报告等操作。

## 核心特性

### 1. 幂等性保证
- 所有操作支持 `x-request-id` 请求ID
- 重复提交返回相同结果
- 不会多扣、多派、多算物资

### 2. 角色权限校验
- **admin**: 所有权限（导入、借用、调拨、归还、报损、回滚）
- **manager**: 借用、调拨、归还、报损
- **operator**: 借用、归还

### 3. 业务规则引擎
- **重复扫码检测**: 5分钟内同一物资同一展位不会重复借用
- **库存校验**: 借用时检查库存是否充足
- **跨展位调拨**: 支持展位间物资调拨
- **损坏扣减**: 报损时从总库存中扣减，并记录扣款金额
- **回滚机制**: 支持1小时内的操作回滚
- **归还校验**: 归还数量不能超过借用数量

### 4. 审计与安全
- 所有操作都有审计日志
- 敏感字段（联系方式等）自动脱敏
- 日志、API返回、导出文件均脱敏处理

## 项目结构

```
src/
├── models/
│   ├── types.ts          # 类型定义
│   └── database.ts       # SQLite 数据库连接
├── services/
│   ├── MaterialService.ts   # 核心业务逻辑
│   ├── IdempotentService.ts # 幂等性服务
│   ├── AuditService.ts      # 审计日志服务
│   └── RuleEngine.ts        # 业务规则引擎
├── routes/
│   └── api.ts            # REST API 路由
├── cli.ts                # 命令行工具
└── index.ts              # 服务入口
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行测试
```bash
npm test
```

### 启动API服务
```bash
npm run dev      # 开发模式
npm start        # 生产模式（需先 build）
```

服务默认运行在 `http://localhost:3000`

### 使用CLI命令行

```bash
# 导入物资
npx ts-node src/cli.ts import example-materials.csv

# 创建展位
npx ts-node src/cli.ts create-booth B001 "A区展位1" "参展商A" --contact "13800138000"

# 借用物资
npx ts-node src/cli.ts occupy TRUSS001 <booth-id> 5 --reason "搭建展台"

# 归还物资
npx ts-node src/cli.ts return <record-id> 5

# 物资报损
npx ts-node src/cli.ts damage <record-id> 1 broken 500 --description "桁架断裂"

# 回滚操作
npx ts-node src/cli.ts rollback <record-id> --reason "操作错误"

# 列出所有物资
npx ts-node src/cli.ts list-materials

# 导出报表
npx ts-node src/cli.ts export json --output report.json
```

## API接口文档

### 导入物资
```http
POST /api/materials/import
x-request-id: <唯一请求ID>
Content-Type: application/json

{
  "csvContent": "code,type,name,specs,totalQuantity\nTRUSS001,truss,桁架,4米,50",
  "operator": { "id": "admin-001", "name": "管理员", "role": "admin" }
}
```

### 借用物资
```http
POST /api/materials/occupy
x-request-id: <唯一请求ID>
Content-Type: application/json

{
  "materialCode": "TRUSS001",
  "boothId": "<展位ID>",
  "quantity": 5,
  "operator": { "id": "op-001", "name": "操作员", "role": "operator" },
  "reason": "展台搭建"
}
```

### 调拨物资
```http
POST /api/materials/transfer
x-request-id: <唯一请求ID>
Content-Type: application/json

{
  "materialCode": "TRUSS001",
  "fromBoothId": "<源展位ID>",
  "toBoothId": "<目标展位ID>",
  "quantity": 2,
  "operator": { "id": "mgr-001", "name": "经理", "role": "manager" }
}
```

### 归还物资
```http
POST /api/materials/return
x-request-id: <唯一请求ID>
Content-Type: application/json

{
  "recordId": "<借用记录ID>",
  "quantity": 5,
  "operator": { "id": "op-001", "name": "操作员", "role": "operator" }
}
```

### 报损物资
```http
POST /api/materials/damage
x-request-id: <唯一请求ID>
Content-Type: application/json

{
  "recordId": "<借用记录ID>",
  "quantity": 1,
  "damageType": "broken",  // broken | lost | worn
  "description": "桁架断裂",
  "deductionAmount": 500,
  "operator": { "id": "mgr-001", "name": "经理", "role": "manager" }
}
```

### 回滚操作
```http
POST /api/materials/rollback
x-request-id: <唯一请求ID>
Content-Type: application/json

{
  "recordId": "<记录ID>",
  "operator": { "id": "admin-001", "name": "管理员", "role": "admin" },
  "reason": "操作错误"
}
```

### 查询接口
```http
GET /api/materials          # 物资列表
GET /api/booths             # 展位列表
GET /api/records            # 借用记录
GET /api/audit-logs         # 审计日志
GET /api/export?format=csv  # 导出报表
```

## 数据模型

### 物资 (materials)
- `code`: 物资编码（唯一）
- `type`: 类型 (truss | light | screen)
- `name`: 名称
- `specs`: 规格
- `totalQuantity`: 总数量
- `availableQuantity`: 可用数量
- `status`: 状态 (normal | damaged | maintenance)

### 借用记录 (borrow_records)
- `materialId`: 物资ID
- `fromBoothId`: 源展位ID（调拨时）
- `toBoothId`: 目标展位ID
- `quantity`: 数量
- `status`: 状态 (pending | approved | returned | damaged | rolled_back)
- `operationType`: 操作类型 (import | occupy | transfer | return | damage | rollback)
- `operatorId/Name/Role`: 操作人信息
- `reason`: 原因/备注

### 审计日志 (audit_logs)
- `requestId`: 请求ID
- `operationType`: 操作类型
- `operator`: 操作人信息
- `result`: 结果 (approved | rejected | duplicate)
- `reason`: 原因
- `requestData/responseData`: 请求/响应数据（脱敏后）
- `timestamp`: 时间戳

## 测试覆盖

所有测试均已通过：
1. 幂等性测试 - 重复导入/借用不重复处理
2. 角色权限测试 - 不同角色权限隔离
3. 库存校验测试 - 库存不足时拒绝借用
4. 归还校验测试 - 归还数量不能超过借用数量
5. 损坏扣减测试 - 报损正确扣减总库存
6. 回滚机制测试 - 回滚恢复库存
7. 审计日志测试 - 所有操作均有记录

## 使用说明

1. **导入物资**: 使用管理员账号导入桁架、灯具、屏幕等物资
2. **创建展位**: 为每个参展商创建展位
3. **借用/归还**: 现场操作员为展位办理物资借用和归还
4. **调拨**: 展位间物资调配由经理操作
5. **报损**: 物资损坏时报损并扣款
6. **回滚**: 操作错误时管理员可回滚1小时内的操作
7. **导出报表**: 定期导出核对总账

所有操作均支持幂等性，重复提交不会产生重复数据，确保现场账务准确。
