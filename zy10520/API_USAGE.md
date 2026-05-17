# AB实验样本污染API使用说明

## 项目结构
```
├── src/
│   ├── types.ts          # 类型定义
│   ├── store.ts         # 数据存储
│   ├── service.ts       # 业务逻辑
│   ├── routes.ts        # Express路由
│   ├── index.ts         # 入口文件
│   └── service.test.ts  # 测试文件
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 启动服务

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 编译
npm run build

# 生产模式
npm start

# 运行测试
npm test
```

服务启动后访问: http://localhost:3000

## API 接口列表

### 1. 健康检查
```
GET /health
```

### 2. 创建污染记录
```
POST /api/pollution
Content-Type: application/json

{
  "experimentId": "EXP-001",
  "experimentName": "按钮颜色AB实验",
  "createdBy": "user-123",
  "pollutionRules": [
    {
      "type": "INTERNAL_ACCOUNT",
      "name": "内部员工账号",
      "description": "排除公司内部员工账号",
      "conditions": { "emailDomain": "company.com" },
      "createdBy": "user-123"
    }
  ],
  "sampleUsers": [
    {
      "userId": "user-001",
      "userType": "INTERNAL",
      "originalGroup": "A",
      "attributes": { "email": "user1@company.com" }
    }
  ],
  "remarks": "发现内部员工混入样本"
}
```

### 3. 查询记录详情
```
GET /api/pollution/{id}
```

### 4. 查询记录列表
```
GET /api/pollution?experimentId=EXP-001&status=CREATED&page=1&pageSize=20
```

查询参数:
- experimentId: 实验ID
- status: 状态
- createdBy: 创建人
- startTime: 开始时间
- endTime: 结束时间
- page: 页码
- pageSize: 每页数量

### 5. 更新状态（状态推进）
```
PUT /api/pollution/status
Content-Type: application/json

{
  "recordId": "uuid",
  "targetStatus": "IDENTIFIED",
  "operator": "user-456",
  "processingBasis": "系统检测到内部员工账号",
  "payload": {
    "pollutedUserIds": ["user-001", "user-003"]
  }
}
```

状态流转顺序:
1. CREATED → IDENTIFIED → SAMPLES_MARKED → IMPACT_RECALCULATED → REVIEW_REQUESTED → REVIEW_APPROVED → COMPLETED

状态枚举:
- CREATED: 已创建
- IDENTIFIED: 污染已识别
- SAMPLES_MARKED: 样本已标记
- IMPACT_RECALCULATED: 指标影响已重算
- REVIEW_REQUESTED: 已提交复核
- REVIEW_APPROVED: 复核通过
- REVIEW_REJECTED: 复核驳回
- COMPLETED: 已完成
- CANCELLED: 已取消

幂等性: 重复提交相同状态不会重复推进，只会记录 `STATUS_UPDATE_IDEMPOTENT 日志

### 6. 人工修正
```
PUT /api/pollution/correction
Content-Type: application/json

{
  "recordId": "uuid",
  "operator": "admin-001",
  "correctionType": "SAMPLE_USER",
  "originalValue": { "userId": "user-001" },
  "newValue": { "isPolluted": false },
  "reason": "用户已离职，不再属于内部员工"
}
```

修正类型:
- SAMPLE_USER: 修正样本用户
- POLLUTION_RULE: 修正污染规则
- METRIC_IMPACT: 修正指标影响
- REMARKS: 修正备注

### 7. 导出数据
```
POST /api/pollution/export
Content-Type: application/json

{
  "recordId": "uuid",
  "format": "JSON",
  "includeSections": ["BASIC", "SAMPLES", "IMPACT", "REVIEW", "LOGS"]
}
```

格式: JSON 或 CSV

包含章节:
- BASIC: 基本信息
- SAMPLES: 样本用户和污染规则
- IMPACT: 指标影响和剔除申请
- REVIEW: 复核报告
- LOGS: 操作日志

## 数据模型说明

### 核心数据模型:

核心字段说明：

1. **ExperimentPollution** - 实验污染主记录
- id: 唯一标识
- experimentId: 实验编号
- experimentName: 实验名称
- status: 状态
- pollutionRules: 污染规则列表
- sampleUsers: 样本用户列表
- exclusionApplication: 剔除申请
- metricImpacts: 指标影响列表
- reviewReports: 复核报告列表
- operationLogs: 操作日志列表
- createdBy: 创建人
- createdAt: 创建时间
- updatedAt: 更新时间
- remarks: 备注

2. **PollutionRule** - 污染规则
- type: 规则类型 (INTERNAL_ACCOUNT, TEST_ACCOUNT, IP_RANGE, ABNORMAL_BEHAVIOR, CUSTOM)
- name: 规则名称
- description: 描述
- conditions: 条件
- createdBy: 创建人
- createdAt: 创建时间

3. **SampleUser** - 样本用户
- userId: 用户ID
- userType: 用户类型
- originalGroup: 原实验组
- isPolluted: 是否污染
- markedAt: 标记时间
- markedBy: 标记人
- attributes: 扩展属性

4. **MetricImpact** - 指标影响
- metricName: 指标名称
- originalValue: 原值
- cleanedValue: 清理后值
- changeRate: 变化率
- confidenceLevel: 置信度
- statisticalSignificance: 统计显著性

5. **ExclusionApplication** - 剔除申请
- applicant: 申请人
- reason: 申请原因
- appliedAt: 申请时间
- expectedImpact: 预期影响

6. **ReviewReport** - 复核报告
- reviewer: 复核人
- reviewComment: 复核意见
- reviewResult: 复核结果
- reviewedAt: 复核时间
- attachments: 附件

7. **OperationLog** - 操作日志
- operation: 操作类型
- operator: 操作人
- operatedAt: 操作时间
- originalInput: 原始输入
- processingBasis: 处理依据
- statusBefore: 前状态
- statusAfter: 后状态
- errorMessage: 错误信息

关键设计特点：

1. 完整状态机控制，防止非法状态流转
2. 幂等性保证，重复提交状态不会重复推进
3. 完整操作审计日志，所有操作都留痕
4. 异常路径保留原始输入和处理依据
5. 支持人工修正，记录修正原因
6. 灵活导出功能，支持JSON和CSV格式
