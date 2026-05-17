# FeatureFlag 命中解释 API

客服排查客户功能开关时只看到最终开或关，看不到用户分组、环境规则和覆盖链。本系统提供完整的 FeatureFlag 命中解释追踪能力。

## 功能特性

- ✅ **规则匹配** - 追踪环境规则匹配过程
- ✅ **覆盖链追踪** - 完整记录每一次值覆盖的来源和原因
- ✅ **命中解释** - 提供详细的命中过程解释报告
- ✅ **人工修正** - 支持人工干预修正评估结果
- ✅ **报告导出** - 支持 CSV 和 JSON 格式导出
- ✅ **异常处理** - 异常路径保留原始输入和处理依据
- ✅ **状态机管理** - 规范的状态流转控制

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动服务

#### 开发模式

```bash
npm run dev
```

#### 生产模式

```bash
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`

## 初始化样例

系统启动时会自动初始化以下样例数据：

### 功能开关 1: `new_checkout_flow`

- 默认值: `false`
- 描述: 新结账流程功能开关
- **环境规则**:
  - 生产环境 (`production`): 默认关闭
  - 测试环境 (`staging`): 默认开启
- **用户分组规则**:
  - 内部测试用户组（优先级 100）:
    - 用户ID: `test-user-1`, `test-user-2`
  - VIP客户组（优先级 90）:
    - VIP等级: `gold`, `platinum`
- **灰度发布**: 10% 用户

### 功能开关 2: `ai_support_chat`

- 默认值: `true`
- 描述: AI客服聊天功能
- **环境规则**: 所有环境默认开启

## API 接口

### 1. 健康检查

```bash
curl http://localhost:3000/api/health
```

### 2. 创建命中解释报告

```bash
curl -X POST http://localhost:3000/api/explanations \
  -H "Content-Type: application/json" \
  -d '{
    "flagName": "new_checkout_flow",
    "tenantId": "tenant-001",
    "userId": "user-123",
    "email": "user@example.com",
    "environment": "production",
    "attributes": {
      "vipLevel": "gold"
    }
  }'
```

### 3. 获取报告详情

```bash
curl http://localhost:3000/api/explanations/{reportId}
```

### 4. 查询报告列表

```bash
# 查询所有报告
curl http://localhost:3000/api/explanations

# 按开关名称查询
curl "http://localhost:3000/api/explanations?flagName=new_checkout_flow"

# 按租户查询
curl "http://localhost:3000/api/explanations?tenantId=tenant-001"

# 按状态查询
curl "http://localhost:3000/api/explanations?status=evaluated"

# 分页查询
curl "http://localhost:3000/api/explanations?page=1&pageSize=10"
```

### 5. 状态推进

```bash
curl -X POST http://localhost:3000/api/explanations/{reportId}/advance-status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "evaluated"
  }'
```

### 6. 人工修正

```bash
curl -X POST http://localhost:3000/api/explanations/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "{reportId}",
    "correctedValue": true,
    "correctedBy": "admin@company.com",
    "correctionReason": "客户投诉，临时开启功能"
  }'
```

### 7. 导出报告

```bash
# 导出所有报告为 JSON
curl http://localhost:3000/api/explanations/export?format=json -o report.json

# 导出所有报告为 CSV
curl http://localhost:3000/api/explanations/export?format=csv -o report.csv

# 导出单个报告
curl "http://localhost:3000/api/explanations/{reportId}/export?format=json" -o single.json
```

### 8. 获取功能开关配置

```bash
# 获取所有开关
curl http://localhost:3000/api/flags

# 获取指定开关
curl http://localhost:3000/api/flags/new_checkout_flow
```

## 异常路径示例

### 示例 1: 不存在的功能开关

```bash
curl -X POST http://localhost:3000/api/explanations \
  -H "Content-Type: application/json" \
  -d '{
    "flagName": "non_existent_flag",
    "tenantId": "tenant-001",
    "environment": "production"
  }'
```

**预期结果**: 报告状态变为 `error`，错误信息记录在报告中，原始输入完整保留在 `rawInput` 字段。

### 示例 2: 无效的状态转换

```bash
# 报告已处于 evaluated 状态，尝试转回 pending
curl -X POST http://localhost:3000/api/explanations/{reportId}/advance-status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "pending"
  }'
```

**预期结果**: 返回 400 错误，提示"无效的状态转换"。

### 示例 3: 缺少必填参数

```bash
curl -X POST http://localhost:3000/api/explanations \
  -H "Content-Type: application/json" \
  -d '{
    "flagName": "new_checkout_flow"
  }'
```

**预期结果**: 返回 400 错误，提示缺少必填参数 `tenantId` 或 `environment`。

### 示例 4: 查询不存在的报告

```bash
curl http://localhost:3000/api/explanations/non-existent-id
```

**预期结果**: 返回 404 错误，提示"报告不存在"。

## 状态流转

```
pending → matching → evaluated → manually_corrected
                        ↓
                      error
```

### 状态说明

- **pending**: 报告已创建，等待处理
- **matching**: 正在进行规则匹配
- **evaluated**: 评估完成，结果已确定
- **error**: 评估过程中发生错误
- **manually_corrected**: 已人工修正结果

## 数据模型

### 覆盖链 (OverrideChain)

每次值覆盖都会记录:
- `source`: 覆盖来源（DEFAULT / ENVIRONMENT / USER_GROUP / MANUAL / ROLLOUT）
- `sourceName`: 来源名称
- `previousValue`: 覆盖前的值
- `newValue`: 覆盖后的值
- `reason`: 覆盖原因
- `timestamp`: 覆盖时间

### 处理日志 (ProcessingLog)

完整记录每个步骤的处理过程，异常发生时可以追溯到具体出错位置。

### 错误信息

- `message`: 错误消息
- `stack`: 错误堆栈（开发环境）
- `step`: 出错步骤

## 项目结构

```
.
├── src/
│   ├── controllers/      # 控制器层
│   ├── middleware/       # 中间件
│   ├── models/           # 数据模型
│   ├── services/         # 业务逻辑层
│   ├── data/             # 数据存储
│   ├── routes.ts         # 路由配置
│   └── index.ts          # 服务入口
├── package.json
├── tsconfig.json
└── README.md
```

## 注意事项

1. 本系统使用内存存储，重启后数据会丢失，生产环境请接入数据库
2. 异常路径会完整保留原始输入和处理日志，便于问题排查
3. 重复调用创建报告接口会生成多条独立的报告记录
4. 人工修正操作会在覆盖链中明确标记来源为 MANUAL
