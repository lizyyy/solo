# 药店处方留存API服务

本地RESTful API服务，用于药店处方的留存、复核和管理。

## 功能特性

- 处方创建与幂等上传
- 药师复核流程
- 订单药品管理
- 退回原因记录
- 换药申请与审批
- 处方有效期校验
- 状态机流转控制
- 异常处理与记录
- 人工修正功能
- 留存报告导出

## 技术栈

- Node.js + Express
- SQLite 本地持久化
- moment.js 日期处理
- uuid 唯一标识

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据

```bash
npm run seed-data
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 健康检查

```bash
curl http://localhost:3000/health
```

## 处方状态说明

```
PENDING → APPROVED → DISPENSED → COMPLETED
        ↓
      REJECTED → RESUBMITTED → APPROVED
        ↓
      RETURNED → RESUBMITTED → CANCELLED
      
APPROVED/DISPENSED → EXCHANGE_REQUESTED → EXCHANGE_APPROVED → DISPENSED → COMPLETED
                                          ↓
                                        EXCHANGE_REJECTED
```

## API接口文档

### 1. 创建处方

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_no": "RX20240515001",
    "order_id": "ORD20240515001",
    "patient_name": "测试患者",
    "patient_id_card": "110101199001011234",
    "doctor_name": "张医生",
    "hospital_name": "市立医院",
    "issue_date": "2024-05-15T00:00:00.000Z",
    "operator_id": "OP001",
    "operator_name": "测试操作员",
    "medicines": [
      {
        "medicine_name": "阿莫西林胶囊",
        "specification": "0.25g*24粒",
        "dosage": "每日3次，每次2粒",
        "quantity": 2,
        "unit": "盒",
        "price": 15.5
      }
    ]
  }'
```

### 2. 幂等重试（同一处方号再次提交）

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_no": "RX20240515001",
    "order_id": "ORD20240515001",
    "patient_name": "测试患者",
    "doctor_name": "张医生",
    "hospital_name": "市立医院",
    "issue_date": "2024-05-15T00:00:00.000Z"
  }'
```

### 3. 查询处方列表

```bash
# 查所有
curl http://localhost:3000/api/prescriptions

# 按状态筛选
curl "http://localhost:3000/api/prescriptions?status=APPROVED"

# 按患者名模糊查询
curl "http://localhost:3000/api/prescriptions?patient_name=张"

# 分页
curl "http://localhost:3000/api/prescriptions?limit=10&offset=0"
```

### 4. 查询单个处方详情

```bash
# 通过ID查询
curl http://localhost:3000/api/prescriptions/{prescription_id}

# 通过处方号查询
curl http://localhost:3000/api/prescriptions/no/RX20240101001
```

### 5. 更新处方状态

```bash
curl -X PUT http://localhost:3000/api/prescriptions/{prescription_id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "REVIEWING",
    "operator_id": "PH001",
    "operator_name": "药师A",
    "comment": "开始复核"
  }'
```

### 6. 药师复核

```bash
# 复核通过
curl -X POST http://localhost:3000/api/prescriptions/{prescription_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacist_id": "PH001",
    "pharmacist_name": "赵药师",
    "review_result": "PASS",
    "review_comment": "处方审核通过，用药合理"
  }'

# 复核不通过
curl -X POST http://localhost:3000/api/prescriptions/{prescription_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacist_id": "PH002",
    "pharmacist_name": "钱药师",
    "review_result": "REJECT",
    "review_comment": "药品配伍禁忌，请重新开方"
  }'
```

### 7. 退回记录

```bash
curl -X POST http://localhost:3000/api/prescriptions/{prescription_id}/return \
  -H "Content-Type: application/json" \
  -d '{
    "return_reason": "药品缺货",
    "return_detail": "该规格药品暂时无货，预计3天后到货",
    "operator_id": "OP001",
    "operator_name": "店员小张"
  }'
```

### 8. 申请换药

```bash
curl -X POST http://localhost:3000/api/prescriptions/{prescription_id}/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "original_medicine_id": "xxx",
    "original_medicine_name": "阿莫西林胶囊",
    "new_medicine_name": "头孢克洛胶囊",
    "new_specification": "0.25g*12粒",
    "new_dosage": "每日3次，每次1粒",
    "new_quantity": 2,
    "exchange_reason": "患者对青霉素过敏",
    "operator_id": "OP001",
    "operator_name": "店员小张"
  }'
```

### 9. 审批换药

```bash
curl -X POST http://localhost:3000/api/exchanges/{exchange_id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacist_id": "PH001",
    "pharmacist_name": "赵药师"
  }'
```

### 10. 人工修正

```bash
curl -X PUT http://localhost:3000/api/prescriptions/{prescription_id}/correction \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "修正后的姓名",
    "status": "APPROVED",
    "operator_id": "ADMIN001",
    "operator_name": "管理员",
    "comment": "客户信息有误，人工修正"
  }'
```

### 11. 生成留存报告

```bash
curl "http://localhost:3000/api/reports/retention?start_date=2024-01-01T00:00:00.000Z&end_date=2024-12-31T23:59:59.999Z"
```

### 12. 导出报告文件

```bash
curl -O "http://localhost:3000/api/reports/retention/export?start_date=2024-01-01T00:00:00.000Z&end_date=2024-12-31T23:59:59.999Z"
```

### 13. 查看异常记录

```bash
# 所有异常
curl http://localhost:3000/api/exceptions

# 未处理异常
curl "http://localhost:3000/api/exceptions?handled=false"

# 已处理异常
curl "http://localhost:3000/api/exceptions?handled=true"
```

## 异常路径测试

### 1. 提交过期处方

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_no": "RX_EXPIRED_TEST",
    "patient_name": "测试患者",
    "doctor_name": "张医生",
    "hospital_name": "市立医院",
    "issue_date": "2024-01-01T00:00:00.000Z",
    "expire_date": "2024-01-04T00:00:00.000Z"
  }'
```

预期结果：返回400错误，异常记录被保存。

### 2. 非法状态转换

```bash
# 从COMPLETED直接变PENDING（不允许）
curl -X PUT http://localhost:3000/api/prescriptions/{prescription_id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PENDING",
    "operator_id": "OP001",
    "operator_name": "测试"
  }'
```

预期结果：返回400错误，异常记录被保存。

### 3. 在未审核状态下换药（不允许）

```bash
curl -X POST http://localhost:3000/api/prescriptions/{pending_prescription_id}/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "original_medicine_name": "阿莫西林胶囊",
    "new_medicine_name": "头孢克洛胶囊",
    "exchange_reason": "过敏测试",
    "operator_id": "OP001",
    "operator_name": "测试"
  }'
```

预期结果：返回400错误，异常记录被保存。

## 项目结构

```
.
├── package.json
├── README.md
├── data/                  # SQLite数据库目录
├── scripts/
│   ├── initDB.js         # 数据库初始化脚本
│   └── seedData.js       # 样例数据脚本
└── src/
    ├── app.js            # 应用入口
    ├── controllers/
    │   └── prescriptionController.js
    ├── services/
    │   └── prescriptionService.js
    ├── utils/
    │   └── database.js
    └── middleware/
```

## 样例数据说明

执行 `npm run seed-data` 后会导入以下样例处方：

| 处方号 | 患者 | 状态 | 说明 |
|--------|------|------|------|
| RX20240101001 | 张三 | PENDING | 待审核处方 |
| RX20240101002 | 李四 | APPROVED | 已审核通过，含2种药品 |
| RX20240101003 | 王五 | RETURNED | 已退回，有退回原因 |
| RX20240101004 | 赵六 | COMPLETED | 已完成 |
