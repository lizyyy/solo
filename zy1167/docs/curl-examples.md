# 批量发薪服务 API 使用示例

## 基础配置

```bash
BASE_URL="http://localhost:3000/api"
```

## 1. 健康检查

```bash
# 检查服务状态
curl -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json"
```

**预期响应:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-05-05T10:00:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## 2. 员工管理

### 2.1 导入员工

```bash
# 导入单个员工
curl -X POST "$BASE_URL/employees/import" \
  -H "Content-Type: application/json" \
  -d '{
    "employees": [
      {
        "employeeNumber": "EMP00000001",
        "name": "张三",
        "email": "zhangsan@company.com",
        "phone": "13800138001",
        "bankName": "中国工商银行",
        "bankAccountNumber": "6222021234567890123",
        "bankAccountName": "张三",
        "department": "技术研发部",
        "position": "高级工程师"
      },
      {
        "employeeNumber": "EMP00000002",
        "name": "李四",
        "email": "lisi@company.com",
        "phone": "13800138002",
        "bankName": "中国建设银行",
        "bankAccountNumber": "6217001234567890456",
        "bankAccountName": "李四",
        "department": "产品部",
        "position": "产品经理"
      }
    ]
  }'
```

**预期响应:**
```json
{
  "success": true,
  "data": {
    "imported": 2,
    "employees": [
      {
        "id": "uuid-1",
        "employeeNumber": "EMP00000001",
        "name": "张三",
        "email": "zhangsan@company.com",
        "department": "技术研发部"
      },
      {
        "id": "uuid-2",
        "employeeNumber": "EMP00000002",
        "name": "李四",
        "email": "lisi@company.com",
        "department": "产品部"
      }
    ]
  }
}
```

### 2.2 查询员工列表

```bash
# 分页查询员工
curl -X GET "$BASE_URL/employees?page=1&pageSize=10" \
  -H "Content-Type: application/json"
```

### 2.3 查询单个员工

```bash
# 根据 ID 查询员工
EMPLOYEE_ID="your-employee-uuid"
curl -X GET "$BASE_URL/employees/$EMPLOYEE_ID" \
  -H "Content-Type: application/json"
```

### 2.4 更新员工信息

```bash
# 更新员工信息
EMPLOYEE_ID="your-employee-uuid"
curl -X PUT "$BASE_URL/employees/$EMPLOYEE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13900139001",
    "bankAccountNumber": "6222029999999999999"
  }'
```

### 2.5 按部门查询员工

```bash
# 查询技术研发部的所有员工
curl -X GET "$BASE_URL/employees/department/技术研发部" \
  -H "Content-Type: application/json"
```

---

## 3. 工资单管理

### 3.1 导入工资单

```bash
# 导入工资单
curl -X POST "$BASE_URL/payrolls/import" \
  -H "Content-Type: application/json" \
  -d '{
    "payrolls": [
      {
        "employeeNumber": "EMP00000001",
        "baseSalary": 25000,
        "bonus": 5000,
        "allowance": 2000,
        "deduction": 1000,
        "tax": 2500,
        "socialInsurance": 3000,
        "housingFund": 3000,
        "year": 2024,
        "month": 5
      },
      {
        "employeeNumber": "EMP00000002",
        "baseSalary": 20000,
        "bonus": 3000,
        "allowance": 1500,
        "deduction": 800,
        "tax": 1800,
        "socialInsurance": 2500,
        "housingFund": 2500,
        "year": 2024,
        "month": 5
      }
    ]
  }'
```

**响应说明:**
- `netSalary` 会自动计算: 基本工资 + 奖金 + 津贴 - 扣除 - 个税 - 社保 - 公积金

### 3.2 查询工资单列表

```bash
# 按月份查询工资单
curl -X GET "$BASE_URL/payrolls?year=2024&month=5" \
  -H "Content-Type: application/json"
```

### 3.3 确认工资单

```bash
# 确认工资单（确认后不可修改）
PAYROLL_ID="your-payroll-uuid"
curl -X POST "$BASE_URL/payrolls/$PAYROLL_ID/confirm" \
  -H "Content-Type: application/json"
```

### 3.4 按员工查询工资单

```bash
# 查询某个员工的所有工资单
EMPLOYEE_ID="your-employee-uuid"
curl -X GET "$BASE_URL/payrolls/employee/$EMPLOYEE_ID" \
  -H "Content-Type: application/json"
```

---

## 4. 批次管理（核心功能）

### 4.1 创建发薪批次

```bash
# 创建发薪批次
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放",
    "description": "本月工资发放，包含绩效奖金",
    "year": 2024,
    "month": 5,
    "concurrency": 10,
    "rateLimit": 100,
    "chunkSize": 100
  }'
```

**参数说明:**
- `concurrency`: 并发数，同时处理的发放数量（默认 10）
- `rateLimit`: 每秒最大请求数（默认 100）
- `chunkSize`: 分片大小，每批处理多少条记录（默认 100）

**预期响应:**
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "batch-uuid",
      "name": "2024年5月工资发放",
      "totalRecords": 10000,
      "totalAmount": 350000000,
      "status": "pending",
      "concurrency": 10,
      "rateLimit": 100,
      "chunkSize": 100
    }
  }
}
```

### 4.2 启动批次

```bash
# 启动发薪批次
BATCH_ID="your-batch-uuid"
curl -X POST "$BASE_URL/batches/$BATCH_ID/start" \
  -H "Content-Type: application/json"
```

### 4.3 查询批次进度

```bash
# 实时查询进度
BATCH_ID="your-batch-uuid"
curl -X GET "$BASE_URL/batches/$BATCH_ID/progress" \
  -H "Content-Type: application/json"
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "batchId": "batch-uuid",
      "status": "running",
      "totalRecords": 10000,
      "processedRecords": 3500,
      "successRecords": 3450,
      "failedRecords": 50,
      "progressPercentage": 35.00,
      "estimatedTimeRemaining": 65000,
      "currentChunk": 35,
      "totalChunks": 100
    }
  }
}
```

### 4.4 暂停批次

```bash
# 暂停正在运行的批次
BATCH_ID="your-batch-uuid"
curl -X POST "$BASE_URL/batches/$BATCH_ID/pause" \
  -H "Content-Type: application/json"
```

### 4.5 恢复批次

```bash
# 恢复暂停的批次
BATCH_ID="your-batch-uuid"
curl -X POST "$BASE_URL/batches/$BATCH_ID/resume" \
  -H "Content-Type: application/json"
```

### 4.6 取消批次

```bash
# 取消批次（不可恢复）
BATCH_ID="your-batch-uuid"
curl -X POST "$BASE_URL/batches/$BATCH_ID/cancel" \
  -H "Content-Type: application/json"
```

### 4.7 重试失败的发放

```bash
# 重试批次中失败的发放记录
BATCH_ID="your-batch-uuid"
curl -X POST "$BASE_URL/batches/$BATCH_ID/retry" \
  -H "Content-Type: application/json"
```

**响应示例:**
```json
{
  "success": true,
  "message": "Retry completed",
  "data": {
    "retried": 45,
    "failed": 5
  }
}
```

### 4.8 账本核对

```bash
# 核对批次的账本数据
BATCH_ID="your-batch-uuid"
curl -X GET "$BASE_URL/batches/$BATCH_ID/reconcile" \
  -H "Content-Type: application/json"
```

**响应示例（平衡）:**
```json
{
  "success": true,
  "data": {
    "reconciliation": {
      "batchId": "batch-uuid",
      "expectedAmount": 350000000,
      "actualAmount": 348000000,
      "expectedCount": 10000,
      "actualCount": 9950,
      "discrepancies": [
        {
          "type": "status",
          "description": "Batch marked as completed but has 50 failed disbursements",
          "affectedRecords": 50
        }
      ],
      "isBalanced": false
    }
  }
}
```

### 4.9 查询批次的发放记录

```bash
# 查询所有发放记录
BATCH_ID="your-batch-uuid"
curl -X GET "$BASE_URL/batches/$BATCH_ID/disbursements" \
  -H "Content-Type: application/json"

# 只查询失败的记录
curl -X GET "$BASE_URL/batches/$BATCH_ID/disbursements?status=failed" \
  -H "Content-Type: application/json"

# 只查询成功的记录
curl -X GET "$BASE_URL/batches/$BATCH_ID/disbursements?status=success" \
  -H "Content-Type: application/json"
```

### 4.10 查询所有批次

```bash
# 查询所有批次
curl -X GET "$BASE_URL/batches" \
  -H "Content-Type: application/json"

# 按状态筛选
curl -X GET "$BASE_URL/batches?status=running" \
  -H "Content-Type: application/json"

# 分页查询
curl -X GET "$BASE_URL/batches?page=1&pageSize=20" \
  -H "Content-Type: application/json"
```

---

## 5. 性能统计

### 5.1 获取性能统计

```bash
# 获取系统性能统计
curl -X GET "$BASE_URL/performance/stats" \
  -H "Content-Type: application/json"
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "performance": {
      "totalBatches": 15,
      "totalDisbursements": 150000,
      "successRate": 98.5,
      "averageProcessingTime": 150,
      "throughput": 85
    },
    "batches": {
      "active": 1,
      "pending": 2,
      "running": 1,
      "paused": 0,
      "completed": 11,
      "failed": 1
    },
    "disbursements": {
      "pending": 5000,
      "processing": 10,
      "success": 142500,
      "failed": 2490,
      "cancelled": 0,
      "total": 150000
    }
  }
}
```

### 5.2 健康检查

```bash
# 详细健康检查
curl -X GET "$BASE_URL/performance/health" \
  -H "Content-Type: application/json"
```

---

## 6. 完整工作流示例

### 6.1 使用 Seed 数据快速测试

```bash
# 1. 生成 10000 条测试数据
npm run seed -- --count 10000 --reset

# 2. 启动服务
npm run dev

# 3. 创建发薪批次
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放-测试",
    "description": "使用模拟数据测试",
    "year": 2024,
    "month": 5,
    "concurrency": 20,
    "rateLimit": 200,
    "chunkSize": 200
  }'

# 4. 记下返回的 batchId，启动批次
BATCH_ID="your-batch-uuid"
curl -X POST "$BASE_URL/batches/$BATCH_ID/start"

# 5. 轮询进度
while true; do
  curl -s "$BASE_URL/batches/$BATCH_ID/progress" | python3 -m json.tool
  sleep 5
done

# 6. 核对账本
curl -X GET "$BASE_URL/batches/$BATCH_ID/reconcile"

# 7. 如果有失败，重试
curl -X POST "$BASE_URL/batches/$BATCH_ID/retry"
```

---

## 7. 幂等性验证示例

```bash
# 1. 第一次创建批次
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放",
    "year": 2024,
    "month": 5
  }'

# 2. 启动后，即使因为网络问题再次调用 start，也不会重复处理
# 系统会检测到批次已在运行，返回成功但不重复执行
curl -X POST "$BASE_URL/batches/$BATCH_ID/start"
# 响应: {"success": true, "message": "Batch is already running", ...}

# 3. 发放记录中的 idempotencyKey 确保同一条工资单不会被重复打款
# 每条发放记录都有唯一的 idempotencyKey，基于 employeeId + year + month + batchId 生成
```

---

## 8. 并发和限速配置示例

```bash
# 低并发配置（适合银行接口限制严格）
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放-低并发",
    "year": 2024,
    "month": 5,
    "concurrency": 5,
    "rateLimit": 10,
    "chunkSize": 50
  }'

# 高并发配置（适合内部测试或高速接口）
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放-高并发",
    "year": 2024,
    "month": 5,
    "concurrency": 50,
    "rateLimit": 500,
    "chunkSize": 500
  }'
```
