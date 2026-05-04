# 错误处理和异常样例

## 常见错误码

### 1. 验证错误 (400)

#### 1.1 参数缺失或格式错误

**请求:**
```bash
# 缺少必需字段
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试批次"
    # 缺少 year 和 month
  }'
```

**响应:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "\"year\" is required",
    "\"month\" is required"
  ]
}
```

#### 1.2 参数值无效

**请求:**
```bash
# 月份超出范围
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试批次",
    "year": 2024,
    "month": 13,  // 无效月份
    "concurrency": 200  // 超过最大限制
  }'
```

**响应:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "\"month\" must be less than or equal to 12",
    "\"concurrency\" must be less than or equal to 100"
  ]
}
```

#### 1.3 请求体过大

**请求:**
```bash
# 导入超过 10MB 的数据
curl -X POST "$BASE_URL/employees/import" \
  -H "Content-Type: application/json" \
  -d @very-large-data.json
```

**响应:**
```json
{
  "success": false,
  "error": "Request body too large",
  "message": "The request body exceeds the maximum allowed size"
}
```

---

### 2. 资源不存在 (404)

#### 2.1 员工不存在

**请求:**
```bash
curl -X GET "$BASE_URL/employees/non-existent-uuid" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Employee not found"
}
```

#### 2.2 批次不存在

**请求:**
```bash
curl -X POST "$BASE_URL/batches/non-existent-uuid/start" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Batch not found"
}
```

#### 2.3 工资单不存在

**请求:**
```bash
curl -X GET "$BASE_URL/payrolls/non-existent-uuid" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Payroll not found"
}
```

---

### 3. 业务逻辑错误 (400)

#### 3.1 批次状态错误

**场景:** 试图启动已完成的批次

**请求:**
```bash
curl -X POST "$BASE_URL/batches/completed-batch-uuid/start" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Cannot start a completed batch"
}
```

**场景:** 试图暂停已暂停的批次

**请求:**
```bash
curl -X POST "$BASE_URL/batches/paused-batch-uuid/pause" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Batch is not running"
}
```

**场景:** 试图恢复未暂停的批次

**请求:**
```bash
curl -X POST "$BASE_URL/batches/running-batch-uuid/resume" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Batch is not paused"
}
```

**场景:** 试图取消已完成的批次

**请求:**
```bash
curl -X POST "$BASE_URL/batches/completed-batch-uuid/cancel" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Batch is already completed or cancelled"
}
```

**场景:** 运行中的批次重试

**请求:**
```bash
curl -X POST "$BASE_URL/batches/running-batch-uuid/retry" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Cannot retry while batch is running"
}
```

#### 3.2 工资单数据缺失

**场景:** 创建批次时没有对应月份的工资单

**请求:**
```bash
curl -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年12月工资",
    "year": 2024,
    "month": 12  // 没有该月份的工资单数据
  }'
```

**响应:**
```json
{
  "success": false,
  "error": "No payrolls found for the specified month",
  "message": "No payrolls found for 2024-12"
}
```

#### 3.3 员工工号重复

**场景:** 导入已存在的员工工号

**请求:**
```bash
curl -X POST "$BASE_URL/employees/import" \
  -H "Content-Type: application/json" \
  -d '{
    "employees": [
      {
        "employeeNumber": "EMP00000001",  // 已存在
        "name": "新员工",
        "email": "new@company.com",
        "phone": "13800138000",
        "bankName": "中国工商银行",
        "bankAccountNumber": "6222021234567890123",
        "bankAccountName": "新员工",
        "department": "技术研发部",
        "position": "工程师"
      }
    ]
  }'
```

**响应:**
```json
{
  "success": true,
  "data": {
    "imported": 0,  // 已存在的员工会被跳过
    "employees": []
  }
}
```

**说明:** 系统不会报错，而是跳过已存在的员工并记录警告日志。

#### 3.4 删除正在运行的批次

**请求:**
```bash
curl -X DELETE "$BASE_URL/batches/running-batch-uuid" \
  -H "Content-Type: application/json"
```

**响应:**
```json
{
  "success": false,
  "error": "Cannot delete a running batch"
}
```

---

### 4. 发放失败错误 (业务错误码)

当发放失败时，系统会记录详细的错误信息。以下是常见的错误码：

#### 4.1 银行账户问题

```json
{
  "errorMessage": "Bank account validation failed",
  "errorCode": "ACCOUNT_VALIDATION_FAILED"
}
```

**可能原因:**
- 银行账号格式错误
- 账号已注销
- 账号与户名不匹配

#### 4.2 资金问题

```json
{
  "errorMessage": "Insufficient funds in source account",
  "errorCode": "INSUFFICIENT_FUNDS"
}
```

**可能原因:**
- 公司账户余额不足
- 需要先充值

#### 4.3 限额问题

```json
{
  "errorMessage": "Daily transfer limit exceeded",
  "errorCode": "LIMIT_EXCEEDED"
}
```

**可能原因:**
- 超过当日转账限额
- 超过单笔转账限额

#### 4.4 账户状态问题

```json
{
  "errorMessage": "Account temporarily frozen",
  "errorCode": "ACCOUNT_FROZEN"
}
```

**可能原因:**
- 员工银行账户被冻结
- 账户处于挂失状态

#### 4.5 网络问题

```json
{
  "errorMessage": "Network timeout during transfer",
  "errorCode": "NETWORK_TIMEOUT"
}
```

**可能原因:**
- 银行接口超时
- 网络连接中断

**处理建议:** 
- 这类错误可以安全重试

#### 4.6 处理异常

```json
{
  "errorMessage": "Unexpected error occurred",
  "errorCode": "PROCESSING_EXCEPTION"
}
```

**可能原因:**
- 代码运行时异常
- 数据库连接问题

---

### 5. 数据库错误

#### 5.1 连接失败

**响应:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

**健康检查会显示:**
```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "timestamp": "2024-05-05T10:00:00.000Z",
    "services": {
      "database": "disconnected"
    }
  }
}
```

---

## 错误处理最佳实践

### 1. 客户端重试策略

```javascript
// 建议的重试逻辑
async function executeWithRetry(operation, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // 只有特定错误码才重试
      const retryableCodes = [
        'NETWORK_TIMEOUT',
        'INSUFFICIENT_FUNDS',  // 需要先充值
        'LIMIT_EXCEEDED'        // 需要等待
      ];
      
      if (!retryableCodes.includes(error.code)) {
        throw error;  // 非重试错误直接抛出
      }
      
      // 指数退避
      const delay = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError;
}
```

### 2. 幂等性保障

**每次发放请求都应该包含幂等键：**

```javascript
// 幂等键生成规则
function generateIdempotencyKey(employeeId, year, month, batchId) {
  return crypto.createHash('sha256')
    .update(`${employeeId}:${year}:${month}:${batchId}`)
    .digest('hex');
}

// 即使网络中断重试，也不会重复打款
// 因为系统会检查 idempotencyKey 是否已存在
```

### 3. 错误监控建议

**需要监控的关键指标：**

```javascript
// 建议的监控指标
const metrics = {
  // 错误率
  errorRate: 'failed_count / total_count',
  
  // 特定错误码分布
  errorCodeDistribution: {
    'NETWORK_TIMEOUT': 0,
    'INSUFFICIENT_FUNDS': 0,
    'ACCOUNT_VALIDATION_FAILED': 0,
    'LIMIT_EXCEEDED': 0,
    'ACCOUNT_FROZEN': 0
  },
  
  // 重试成功率
  retrySuccessRate: 'retry_success_count / retry_total_count'
};
```

### 4. 告警规则

```yaml
# 建议的 Prometheus 告警规则
groups:
  - name: payroll-alerts
    rules:
      - alert: HighFailureRate
        expr: rate(failed_disbursements[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "发放失败率超过 10%"
          description: "过去 5 分钟内发放失败率超过 10%"
      
      - alert: InsufficientFunds
        expr: count by (error_code) (disbursements{error_code="INSUFFICIENT_FUNDS"}) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "账户余额不足"
          description: "检测到余额不足错误，请及时充值"
      
      - alert: NetworkTimeouts
        expr: rate(disbursements{error_code="NETWORK_TIMEOUT"}[5m]) > 0.05
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "网络超时增加"
          description: "网络超时率超过 5%"
```

---

## 常见问题排查

### Q1: 批次卡住不前进

**排查步骤:**
1. 检查服务状态: `GET /api/performance/health`
2. 检查批次状态: `GET /api/batches/{id}`
3. 检查是否有活跃的批次: `GET /api/performance/stats`
4. 查看日志中的错误信息

**可能原因:**
- 数据库连接问题
- 并发池耗尽
- 所有任务都在失败重试

### Q2: 发放失败率很高

**排查步骤:**
1. 查看失败记录: `GET /api/batches/{id}/disbursements?status=failed`
2. 分析错误码分布
3. 检查银行接口状态

**常见模式:**
- 如果都是 `NETWORK_TIMEOUT`: 检查网络连接
- 如果都是 `INSUFFICIENT_FUNDS`: 需要充值
- 如果都是 `ACCOUNT_VALIDATION_FAILED`: 检查员工银行信息

### Q3: 重试后仍然失败

**排查步骤:**
1. 检查 `retry_count` 是否已达到 `max_retries`
2. 查看具体的错误信息
3. 确认问题是否已解决

**处理建议:**
- 对于 `ACCOUNT_VALIDATION_FAILED`: 需要员工更新银行信息
- 对于 `ACCOUNT_FROZEN`: 需要员工联系银行解冻
- 对于 `LIMIT_EXCEEDED`: 可能需要分批次处理

### Q4: 账本核对显示不平衡

**排查步骤:**
1. 查看 `GET /api/batches/{id}/reconcile` 返回的差异
2. 检查 `discrepancies` 字段
3. 对比预期值和实际值

**常见差异:**
- `amount`: 金额不匹配（可能是部分失败）
- `count`: 数量不匹配（可能有遗漏）
- `status`: 批次状态与实际处理状态不一致

**处理建议:**
1. 重试失败的发放: `POST /api/batches/{id}/retry`
2. 手动调整数据库（谨慎操作）
3. 生成差异报告供财务审核
