# 报销系统后端 - 预算科目调拨

## 项目概述

报销系统预算科目调拨模块，支持正常流程、驳回流程、人工复核流程，核心数据包括员工、报销单、原科目、新科目，状态覆盖待报销/调拨中/已入账/被退回。

## 技术栈

- Node.js + Express
- SQLite 数据库
- Jest + Supertest 测试

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 造数（初始化测试数据）

```bash
npm run seed
```

执行后会输出测试数据的ID，包括：
- 员工ID（张三、李四、王五）
- 预算科目ID（差旅费、办公费、招待费、培训费）
- 报销单ID

### 3. 启动服务

```bash
npm start
```

服务将运行在 `http://localhost:3000`

### 4. 运行测试

```bash
npm test
```

测试覆盖以下场景：
- 正常流程：创建调拨 → 处理调拨 → 确认入账
- 测试1：预算占用和付款金额不一致
- 测试2：重复请求（冲突检测）
- 测试3：撤回后再提交（驳回流程）
- 列表、详情、历史查询
- 导入坏行处理
- 人工复核流程

## API 接口

### 健康检查

```bash
curl http://localhost:3000/health
```

### 调拨API

#### 1. 创建调拨申请

```bash
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "员工ID",
    "reimbursementOrderId": "报销单ID",
    "originalSubjectId": "原科目ID",
    "targetSubjectId": "新科目ID",
    "transferAmount": 5000,
    "flowType": "normal"
  }'
```

flowType 可选值：
- `normal` - 正常流程
- `reject` - 驳回重提（系统自动设置）
- `manual_review` - 人工复核流程

#### 2. 处理调拨

```bash
curl -X POST http://localhost:3000/api/transfers/process \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "调拨ID",
    "reviewerId": "审核人ID"
  }'
```

#### 3. 确认入账

```bash
curl -X POST http://localhost:3000/api/transfers/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "调拨ID",
    "reviewerId": "审核人ID",
    "paymentAmount": 5000
  }'
```

#### 4. 驳回调拨

```bash
curl -X POST http://localhost:3000/api/transfers/reject \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "调拨ID",
    "reviewerId": "审核人ID",
    "reason": "科目选择错误"
  }'
```

#### 5. 重新提交（驳回后）

```bash
curl -X POST http://localhost:3000/api/transfers/resubmit \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "调拨ID",
    "employeeId": "员工ID",
    "targetSubjectId": "新科目ID",
    "transferAmount": 5000
  }'
```

#### 6. 人工复核

```bash
curl -X POST http://localhost:3000/api/transfers/manual-review \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "调拨ID",
    "reviewerId": "审核人ID",
    "approved": true,
    "comment": "审核通过"
  }'
```

#### 7. 查询调拨列表

```bash
# 全部
curl http://localhost:3000/api/transfers

# 按状态筛选
curl "http://localhost:3000/api/transfers?status=pending"

# 按流程类型筛选
curl "http://localhost:3000/api/transfers?flowType=normal"
```

#### 8. 查询调拨详情

```bash
curl http://localhost:3000/api/transfers/{调拨ID}
```

#### 9. 查询调拨历史

```bash
curl http://localhost:3000/api/transfers/{调拨ID}/history
```

#### 10. 导出调拨数据

```bash
curl -O -J http://localhost:3000/api/transfers/export
```

#### 11. 导入调拨数据

```bash
curl -X POST http://localhost:3000/api/transfers/import \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [
      {
        "employeeId": "员工ID",
        "reimbursementOrderId": "报销单ID",
        "originalSubjectId": "原科目ID",
        "targetSubjectId": "新科目ID",
        "transferAmount": 5000
      }
    ],
    "fileName": "import.csv"
  }'
```

## 状态流转

```
pending (待处理)
    ↓
transferring (调拨中)
    ↓
booked (已入账)

pending (待处理)
    ↓
returned (被退回)
    ↓
pending (重新提交 → 驳回流程)
```

## 核心业务规则

1. **冲突检测**：同一报销单只能有一个进行中的调拨记录
2. **金额校验**：调拨金额必须与报销单金额一致；付款金额必须与调拨金额一致
3. **预算检查**：目标科目必须有足够的预算余额
4. **状态限制**：只有特定状态可以进行下一步操作
5. **历史记录**：所有状态变更都记录操作人和操作时间

## 验收说明

运行 `npm test` 后，将验证以下验收标准：

1. ✅ 完整流转：创建 → 处理 → 入账 全流程
2. ✅ 冲突记录：同一报销单重复提交时正确拒绝
3. ✅ 导入坏行：导入中有错误数据时正确处理，不影响正常数据
4. ✅ 列表查询：正确返回调拨列表
5. ✅ 详情查询：正确返回单条调拨详情
6. ✅ 历史查询：正确返回调拨的状态变更历史
7. ✅ 数据一致性：列表、详情、历史数据互相对应
