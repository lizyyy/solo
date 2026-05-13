# 后端 - 云资源发布审批系统

## 技术栈
- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- ExcelJS（Excel导出）

## 启动命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 初始化数据
npm run init:data
```

## 项目结构
```
src/
├── models/          # 数据模型
│   ├── ReleaseRequest.ts
│   ├── AffectedService.ts
│   ├── ApprovalOpinion.ts
│   ├── GrayBatch.ts
│   ├── RollbackAction.ts
│   └── ReleaseReport.ts
├── routes/          # 路由控制器
│   ├── releaseRequest.ts
│   ├── affectedService.ts
│   ├── approvalOpinion.ts
│   ├── grayBatch.ts
│   ├── rollbackAction.ts
│   ├── releaseReport.ts
│   └── statistics.ts
├── scripts/         # 脚本
│   └── initData.ts  # 数据初始化
└── index.ts         # 入口文件
```

## API接口文档

### 1. 发布申请接口

#### 获取发布申请列表
```
GET /api/release-requests
参数:
  - status: 状态筛选
  - priority: 优先级筛选
  - type: 类型筛选
  - applicant: 申请人
  - search: 搜索关键词
  - page: 页码
  - limit: 每页数量
响应: { success: true, data: [], pagination: {} }
```

#### 获取单个发布申请
```
GET /api/release-requests/:id
响应: { success: true, data: {} }
```

#### 创建发布申请
```
POST /api/release-requests
Body: { title, description, applicant, department, type, priority, status }
响应: { success: true, data: {} }
```

#### 更新发布申请
```
PUT /api/release-requests/:id
Body: { ...更新字段, modifiedBy: 修改人 }
响应: { success: true, data: {} }
```

#### 删除发布申请
```
DELETE /api/release-requests/:id
响应: { success: true, message: '删除成功' }
```

### 2. 影响服务接口

#### 获取影响服务列表
```
GET /api/affected-services
参数: requestId, environment, impactLevel, status
响应: { success: true, data: [] }
```

#### CRUD操作同发布申请

### 3. 审批意见接口

#### 获取审批意见列表
```
GET /api/approval-opinions
参数: requestId, approver, opinion
响应: { success: true, data: [] }
```

#### CRUD操作同发布申请

### 4. 灰度批次接口

#### 获取灰度批次列表
```
GET /api/gray-batches
参数: requestId, status
响应: { success: true, data: [] }
```

#### CRUD操作同发布申请

### 5. 回滚动作接口

#### 获取回滚动作列表
```
GET /api/rollback-actions
参数: requestId, status, reasonCategory
响应: { success: true, data: [] }
```

#### CRUD操作同发布申请

### 6. 发布报告接口

#### 获取发布报告列表
```
GET /api/release-reports
参数: requestId, overallStatus, responsiblePerson, startDate, endDate
响应: { success: true, data: [] }
```

#### 生成发布报告
```
POST /api/release-reports/generate/:requestId
Body: { generatedBy: 生成人 }
响应: { success: true, data: {} }
```

#### 导出发布报告
```
GET /api/release-reports/export/:requestId
响应: Excel文件流
```

### 7. 统计接口

#### 获取控制台统计数据
```
GET /api/statistics/dashboard
响应: { success: true, data: {} }
```

## 数据模型

### ReleaseRequest（发布申请）
- requestId: 申请ID
- title: 标题
- description: 描述
- applicant: 申请人
- department: 部门
- status: 状态 (pending, approved, processing, completed, rolled_back, rejected)
- priority: 优先级 (low, medium, high, critical)
- type: 类型 (config, resource, code, database)
- changeHistory: 修改历史记录

### AffectedService（影响服务）
- requestId: 关联申请ID
- serviceName: 服务名称
- serviceId: 服务ID
- environment: 环境 (dev, test, staging, prod)
- impactLevel: 影响级别
- expectedDowntime: 预期停机时间
- actualDowntime: 实际停机时间
- status: 状态
- changeHistory: 修改历史

### ApprovalOpinion（审批意见）
- requestId: 关联申请ID
- approver: 审批人
- approverRole: 审批人角色
- opinion: 意见 (approved, rejected, need_modification)
- comments: 评论
- approvalTime: 审批时间
- changeHistory: 修改历史

### GrayBatch（灰度批次）
- requestId: 关联申请ID
- batchNumber: 批次号
- batchName: 批次名称
- targetPercentage: 目标百分比
- actualPercentage: 实际百分比
- startTime: 开始时间
- endTime: 结束时间
- status: 状态
- instanceCount: 实例数
- successCount: 成功数
- failedCount: 失败数

### RollbackAction（回滚动作）
- requestId: 关联申请ID
- triggeredBy: 触发人
- triggerTime: 触发时间
- reason: 原因
- reasonCategory: 原因分类
- affectedBatches: 影响批次
- rollbackScope: 回滚范围 (partial, full)
- status: 状态
- rollbackDetails: 回滚详情

### ReleaseReport（发布报告）
- requestId: 关联申请ID
- reportId: 报告ID
- generatedBy: 生成人
- generatedAt: 生成时间
- overallStatus: 总体状态
- totalServices: 服务总数
- successfulServices: 成功服务数
- failedServices: 失败服务数
- totalDowntime: 总停机时间
- maxDowntime: 最大停机时间
- approvalSummary: 审批摘要
- grayBatchSummary: 灰度批次摘要
- rollbackSummary: 回滚摘要
- exceptions: 异常列表
- responsiblePerson: 责任人
- startTime: 开始时间
- endTime: 结束时间
- duration: 持续时间
