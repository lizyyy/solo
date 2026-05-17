# 在线问卷平台问卷配额补样 API

基于 Node.js + TypeScript + Express + SQLite 的问卷配额补样管理系统。

## 核心功能

- **问卷管理**：创建、查询、状态流转（回收中/配额满/补样中/已关闭）
- **配额组管理**：配额控制、状态管理、样本计数
- **样本管理**：样本导入导出、无效标记、补样标记
- **补样管理**：补样申请、审批、完成全流程
- **操作历史**：所有操作均有日志记录，可追溯

## 目录结构

```
.
├── src/
│   ├── app.ts                 # 应用入口
│   ├── models/                # 数据模型
│   │   ├── Survey.ts          # 问卷
│   │   ├── QuotaGroup.ts      # 配额组
│   │   ├── Sample.ts          # 样本
│   │   ├── ResampleReason.ts  # 补样原因
│   │   └── OperationLog.ts    # 操作日志
│   ├── services/              # 业务逻辑层
│   │   ├── stateValidator.ts  # 状态校验
│   │   ├── survey.ts          # 问卷服务
│   │   ├── quota.ts           # 配额服务
│   │   ├── sample.ts          # 样本服务
│   │   ├── resample.ts        # 补样服务
│   │   └── operationLog.ts    # 日志服务
│   ├── routes/                # API路由层
│   ├── scripts/               # 脚本
│   │   └── seed.ts            # 种子数据
│   └── __tests__/             # 测试用例
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务（开发模式）

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 3. 生产模式启动

```bash
npm run build
npm start
```

## 造数（种子数据）

初始化数据库并生成测试数据：

```bash
npm run seed
```

种子数据包含：
- 2 个问卷（回收中、配额满）
- 4 个配额组
- 51 个样本（含 1 个无效冲突样本）
- 2 个补样申请（待审批、已批准）

## 运行测试

```bash
npm test
```

包含三个测试场景：
1. **完整流转测试**：问卷→配额→样本→无效→补样→完成
2. **冲突记录测试**：配额满→冲突样本→无效→人工备注重开→补样
3. **坏行导入测试**：批量导入时的异常行处理、错误记录、导出校验

## API 调用（curl 示例）

所有 API 请求可通过 `X-Operator` 头指定操作人，默认为 `system`。

### 问卷管理

```bash
# 获取问卷列表
curl http://localhost:3000/api/surveys

# 获取问卷详情
curl http://localhost:3000/api/surveys/1

# 获取问卷操作历史
curl http://localhost:3000/api/surveys/1/history

# 创建问卷
curl -X POST http://localhost:3000/api/surveys \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{"title": "新调研", "targetSampleSize": 100}'

# 更新问卷状态
curl -X PUT http://localhost:3000/api/surveys/1/status \
  -H "Content-Type: application/json" \
  -H "X-Operator: manager" \
  -d '{"status": "closed", "remark": "调研结束"}'

# 重新打开问卷（无效样本后）
curl -X PUT http://localhost:3000/api/surveys/1/reopen \
  -H "Content-Type: application/json" \
  -H "X-Operator: manager" \
  -d '{"remark": "因无效样本重新开放"}'
```

### 配额组管理

```bash
# 获取配额组列表
curl "http://localhost:3000/api/quotas?surveyId=1"

# 获取配额组详情
curl http://localhost:3000/api/quotas/1

# 创建配额组
curl -X POST http://localhost:3000/api/quotas \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{"surveyId": 1, "name": "新配额组", "targetCount": 50}'

# 重新开放配额
curl -X PUT http://localhost:3000/api/quotas/1/reopen \
  -H "Content-Type: application/json" \
  -H "X-Operator: manager" \
  -d '{"remark": "人工审批后重新开放"}'
```

### 样本管理

```bash
# 获取样本列表
curl "http://localhost:3000/api/samples?surveyId=1&status=valid"

# 获取样本详情
curl http://localhost:3000/api/samples/1

# 创建样本
curl -X POST http://localhost:3000/api/samples \
  -H "Content-Type: application/json" \
  -H "X-Operator: system" \
  -d '{"surveyId": 1, "respondentId": "NEW001", "status": "valid"}'

# 标记样本无效
curl -X PUT http://localhost:3000/api/samples/1/invalid \
  -H "Content-Type: application/json" \
  -H "X-Operator: auditor" \
  -d '{"reason": "回答逻辑冲突", "remark": "经过复核确认无效"}'

# 批量导入样本
curl -X POST http://localhost:3000/api/samples/import \
  -H "Content-Type: application/json" \
  -H "X-Operator: import_user" \
  -d '{
    "surveyId": 1,
    "samples": [
      {"respondentId": "IMP001", "name": "用户1"},
      {"respondentId": "IMP002", "name": "用户2"},
      {"name": "坏行缺少ID"}
    ]
  }'

# 导出样本CSV
curl -O http://localhost:3000/api/samples/export?surveyId=1
```

### 补样管理

```bash
# 获取补样申请列表
curl "http://localhost:3000/api/resamples?surveyId=1"

# 创建补样申请
curl -X POST http://localhost:3000/api/resamples \
  -H "Content-Type: application/json" \
  -H "X-Operator: project_manager" \
  -d '{
    "surveyId": 1,
    "quotaGroupId": 2,
    "reason": "因无效样本需要补充",
    "requestedCount": 5
  }'

# 审批补样申请
curl -X PUT http://localhost:3000/api/resamples/1/approve \
  -H "Content-Type: application/json" \
  -H "X-Operator: director" \
  -d '{"approvedCount": 3, "remark": "批准补充3个样本"}'

# 拒绝补样申请
curl -X PUT http://localhost:3000/api/resamples/1/reject \
  -H "Content-Type: application/json" \
  -H "X-Operator: director" \
  -d '{"remark": "当前样本已足够"}'

# 完成补样
curl -X PUT http://localhost:3000/api/resamples/1/complete \
  -H "Content-Type: application/json" \
  -H "X-Operator: project_manager" \
  -d '{"remark": "补样完成"}'
```

## 状态说明

### 问卷状态 (SurveyStatus)
- `collecting` - 回收中
- `quota_full` - 配额满
- `resampling` - 补样中
- `closed` - 已关闭

### 配额状态 (QuotaStatus)
- `collecting` - 回收中
- `quota_full` - 配额满
- `resampling` - 补样中
- `closed` - 已关闭

### 样本状态 (SampleStatus)
- `pending` - 待审核
- `valid` - 有效
- `invalid` - 无效

### 补样状态 (ResampleStatus)
- `pending` - 待审批
- `approved` - 已批准
- `rejected` - 已拒绝
- `completed` - 已完成

## 验收要点

### 1. 完整流转验证
1. 创建问卷 → 状态：`collecting`
2. 创建配额组 → 状态：`collecting`
3. 添加有效样本填满配额 → 状态：`quota_full`
4. 标记一个样本无效 → 配额计数-1，无效计数+1
5. 人工备注重新打开配额 → 状态：`collecting`
6. 创建补样申请 → 状态：`pending`
7. 审批补样申请 → 状态：`approved`，配额→`resampling`
8. 添加补样样本 → `isResample = true`
9. 完成补样 → 状态：`completed`
10. 查看各自操作历史 → 所有操作有记录

### 2. 冲突记录验证
1. 配额填满后标记一个样本为"逻辑冲突"
2. 人工填写详细备注重新开放配额
3. 添加补样样本
4. 验证列表、详情、历史三者数据一致

### 3. 坏行导入验证
1. 导入包含坏行的样本数据（缺少 respondentId）
2. 验证成功导入数量和错误记录数量
3. 验证错误信息包含行号和具体原因
4. 导出CSV验证数据格式正确
5. 验证导入样本的历史记录