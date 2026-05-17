# 队列优先级调整API使用示例

## 安装依赖
```bash
npm install
```

## 启动服务
```bash
npm run dev
```

## API使用示例

### 1. 创建优先级调整（大促场景）
```bash
curl -X POST http://localhost:3000/api/adjustments \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "promo-618-2024-001",
    "queueName": "order-processing",
    "targetPriority": 10,
    "reason": "618大促期间临时提升订单处理队列优先级，保障下单流畅",
    "recoveryCondition": "大促结束时间：2024-06-19 00:00，或订单峰值下降至每秒100单以下",
    "createdBy": "ops-manager"
  }'
```

### 2. 查询所有调整记录
```bash
curl http://localhost:3000/api/adjustments
```

### 3. 按状态筛选查询
```bash
curl "http://localhost:3000/api/adjustments?status=active"
```

### 4. 查询单个调整详情
```bash
curl http://localhost:3000/api/adjustments/{adjustmentId}
```

### 5. 查询受影响的任务
```bash
curl http://localhost:3000/api/adjustments/{adjustmentId}/tasks
```

### 6. 查询异常记录
```bash
curl http://localhost:3000/api/adjustments/{adjustmentId}/failures
```

### 7. 执行恢复操作（大促结束后）
```bash
curl -X POST http://localhost:3000/api/adjustments/{adjustmentId}/recover
```

### 8. 人工修正调整
```bash
curl -X PATCH http://localhost:3000/api/adjustments/{adjustmentId}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "newPriority": 8,
    "newRecoveryCondition": "流量比预期小，调整优先级至HIGH级别",
    "reason": "根据实际流量情况调整",
    "correctedBy": "sre-engineer"
  }'
```

### 9. 导出CSV报告
```bash
curl http://localhost:3000/api/adjustments/{adjustmentId}/export/csv \
  -o adjustment-report.csv
```

### 10. 查看文本报告
```bash
curl http://localhost:3000/api/adjustments/{adjustmentId}/export/report
```

### 11. 查询队列当前优先级
```bash
curl http://localhost:3000/api/adjustments/queues/order-processing/priority
```

## 核心特性说明

### 幂等性保证
每个调整请求必须携带 `idempotencyKey`，重复请求不会产生副作用。

### 状态流转
```
PENDING → ACTIVE → RESTORING → COMPLETED
           ↓
         FAILED
           ↓
         (人工处理后可标记已解决)
```

### 异常追踪
- 所有失败操作自动记录原始输入、处理依据和错误堆栈
- 可通过 `GET /api/adjustments/:id/failures` 追溯全部异常历史
- 重启服务后数据不丢失（SQLite持久化）

### 报告导出
- CSV格式：适合导入Excel进行数据分析
- 文本格式：适合快速查看和邮件发送
- 包含：基本信息、优先级变更、状态追踪、影响统计、异常记录、恢复条件
