# 指标阈值试算API

基于历史数据的告警阈值试算服务，帮助确定最优报警阈值，平衡误报干扰和漏报风险。

## 功能特性

- **历史回放**: 基于历史指标数据模拟不同阈值的触发效果
- **阈值试算**: 批量计算多个候选阈值的触发次数和触发率
- **误报统计**: 记录和标记误报事件，分析误报率
- **人工确认**: 支持人工修正计算结果，保留操作痕迹
- **报告导出**: 支持 JSON/CSV 格式的试算报告导出
- **异常追踪**: 完整保留异常路径的原始输入和处理依据
- **重复调用防护**: 5秒内相同请求自动拦截

## 快速开始

### 环境要求
- Node.js >= 18.0.0

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```
服务默认运行在 http://localhost:3000

### 初始化样例数据
```bash
npm run init
```
将自动创建2个样比试算任务并完成阈值计算。

## API 接口

### 1. 创建试算任务
```bash
curl -X POST http://localhost:3000/api/trials \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "CPU_Usage_Rate",
    "candidateThresholds": [70, 80, 85, 90, 95],
    "historySamples": [
      {"timestamp": "2024-01-01T00:00:00.000Z", "value": 65.2},
      {"timestamp": "2024-01-01T00:01:00.000Z", "value": 72.5},
      {"timestamp": "2024-01-01T00:02:00.000Z", "value": 88.1, "isRealIncident": true}
    ],
    "createdBy": "admin"
  }'
```

**参数说明**:
- `metricName`: 指标名称 (必填，1-100字符)
- `candidateThresholds`: 候选阈值数组 (必填，1-20个数值)
- `historySamples`: 历史样本数组 (必填，10-10000条)
  - `timestamp`: ISO格式时间戳
  - `value`: 指标数值
  - `isRealIncident`: 是否为真实事故

### 2. 查询所有任务
```bash
# 查询所有
curl http://localhost:3000/api/trials

# 按状态筛选
curl "http://localhost:3000/api/trials?status=calculated"

# 按指标名称筛选
curl "http://localhost:3000/api/trials?metricName=CPU"
```

### 3. 查询单个任务详情
```bash
curl http://localhost:3000/api/trials/{taskId}
```

### 4. 执行阈值试算
```bash
curl -X POST http://localhost:3000/api/trials/{taskId}/calculate
```

### 5. 推进任务状态
```bash
curl -X POST http://localhost:3000/api/trials/{taskId}/advance-status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "confirming",
    "note": "开始误报确认流程"
  }'
```

**状态流转规则**:
- pending → processing
- processing → calculated | failed
- calculated → confirming
- confirming → completed
- failed → pending

### 6. 记录误报
```bash
curl -X POST http://localhost:3000/api/trials/{taskId}/false-positive \
  -H "Content-Type: application/json" \
  -d '{
    "thresholdId": "{thresholdResultId}",
    "pointIndex": 5,
    "description": "业务高峰期间的正常波动，非故障"
  }'
```

### 7. 人工修正
```bash
curl -X POST http://localhost:3000/api/trials/{taskId}/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "field": "triggerCount",
    "thresholdId": "{thresholdResultId}",
    "oldValue": 10,
    "newValue": 8,
    "reason": "排除2次业务变更导致的波动",
    "correctedBy": "sre-operator"
  }'
```

**支持修正字段**:
- `threshold`: 阈值数值
- `triggerCount`: 触发次数
- `falsePositiveCount`: 误报次数

### 8. 导出试算报告
```bash
# JSON格式
curl http://localhost:3000/api/trials/{taskId}/export

# CSV格式
curl "http://localhost:3000/api/trials/{taskId}/export?format=csv" -o report.csv
```

### 9. 查看原始输入
```bash
curl http://localhost:3000/api/trials/{taskId}/original-input
```

## 异常路径示例

以下是几个会被拦截的异常请求示例：

### 1. 参数验证失败 - 历史样本不足
```bash
curl -X POST http://localhost:3000/api/trials \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "CPU_Usage_Rate",
    "candidateThresholds": [80],
    "historySamples": [
      {"timestamp": "2024-01-01T00:00:00.000Z", "value": 65.2}
    ]
  }'
```

**预期响应** (400):
```json
{
  "code": "VALIDATION_ERROR",
  "message": "参数验证失败",
  "errorId": "xxx",
  "details": [
    {"field": "historySamples", "message": "历史样本至少需要10条数据"}
  ]
}
```

### 2. 非法状态流转
```bash
curl -X POST http://localhost:3000/api/trials/{taskId}/advance-status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "completed"
  }'
```

**预期响应** (400):
```json
{
  "code": "INVALID_STATUS_TRANSITION",
  "message": "无法从 pending 转换到 completed",
  "errorId": "xxx"
}
```

### 3. 重复请求拦截
连续快速发送两次相同的创建请求：
```bash
# 第一次请求（正常）
curl -X POST http://localhost:3000/api/trials \
  -H "Content-Type: application/json" \
  -d '{"metricName":"Test","candidateThresholds":[80],"historySamples":[{"timestamp":"2024-01-01T00:00:00.000Z","value":65}]}'

# 5秒内第二次请求（被拦截）
curl -X POST http://localhost:3000/api/trials \
  -H "Content-Type: application/json" \
  -d '{"metricName":"Test","candidateThresholds":[80],"historySamples":[{"timestamp":"2024-01-01T00:00:00.000Z","value":65}]}'
```

**预期响应** (409):
```json
{
  "code": "DUPLICATE_REQUEST",
  "message": "检测到重复请求，请稍后再试",
  "requestId": "xxx",
  "retryAfter": 3
}
```

### 4. 查询错误日志
```bash
# 查看所有错误日志
curl http://localhost:3000/api/errors/logs
```

每条错误日志包含：
- `originalInput`: 原始请求参数
- `processingBasis`: 处理依据和判断逻辑
- 完整的错误栈追踪

## 任务状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理，任务已创建等待计算 |
| processing | 计算中，正在进行阈值试算 |
| calculated | 已计算，阈值试算完成 |
| confirming | 确认中，误报标记和人工修正 |
| completed | 已完成，报告已生成 |
| failed | 失败，计算过程出错 |

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── models/
│   │   └── TrialTask.js       # 试算任务模型
│   ├── services/
│   │   └── trialService.js    # 业务逻辑服务
│   ├── routes/
│   │   ├── trialRoutes.js     # 试算API路由
│   │   └── errorRoutes.js     # 错误查询路由
│   ├── middleware/
│   │   ├── errorHandler.js    # 异常处理中间件
│   │   └── duplicateProtection.js  # 重复调用防护
│   ├── validations/
│   │   └── trialValidation.js # 参数验证规则
│   └── storage/
│       └── memoryStore.js     # 内存存储
├── scripts/
│   └── init-sample.js         # 样例数据初始化
├── package.json
└── README.md
```

## 注意事项

1. 当前版本使用内存存储，重启服务后数据会丢失
2. 重复调用防护基于请求内容哈希，5秒窗口内相同请求会被拦截
3. 所有异常均保留完整上下文，可通过 `/api/errors/logs` 查询
4. 历史样本建议至少包含100条以上数据，试算结果更具参考价值
