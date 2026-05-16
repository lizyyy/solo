# 匿名化任务仲裁API服务

用于管理匿名化数据集的风险仲裁流程，替代传统的聊天和表格推进方式。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 初始化示例数据（可选）

```bash
node src/scripts/initData.js
```

### 4. 启动服务

```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务启动后访问：http://localhost:3000

## 核心功能

### 数据模型

1. **数据集 (Datasets)** - 管理待匿名化的数据集元数据
2. **匿名规则 (Anonymization Rules)** - 版本化管理匿名化处理规则
3. **风险样本 (Risk Samples)** - 识别出的高风险数据样本
4. **仲裁意见 (Arbitration Opinions)** - 人工仲裁决策记录
5. **重处理任务 (Reprocess Tasks)** - 需重新匿名化的任务管理
6. **仲裁摘要 (Arbitration Summaries)** - 仲裁结果统计摘要

### 关键特性

- ✅ **风险样本保留** - 所有风险样本永久存储可追溯
- ✅ **仲裁状态机** - 规范的状态流转管理
- ✅ **重处理幂等** - 同一数据集仅允许一个活跃重处理任务
- ✅ **规则版本控制** - 规则修改自动递增版本号
- ✅ **摘要导出** - 支持CSV/JSON格式导出仲裁报告
- ✅ **异常处理留痕** - 失败路径保留原始输入、处理依据和最终结论

## API 接口

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 数据集管理

```bash
# 创建数据集
curl -X POST http://localhost:3000/api/datasets \
  -H "Content-Type: application/json" \
  -d '{"name":"测试数据集","description":"测试用途","data_source":"测试系统","record_count":100}'

# 查询所有数据集
curl http://localhost:3000/api/datasets

# 查询单个数据集
curl http://localhost:3000/api/datasets/{datasetId}

# 更新数据集状态
curl -X PATCH http://localhost:3000/api/datasets/{datasetId}/status \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

### 匿名规则管理

```bash
# 创建规则
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{"name":"身份证脱敏规则","rule_type":"masking","config":{"pattern":"****"}}'

# 查询所有活跃规则
curl http://localhost:3000/api/rules

# 按名称查询所有版本
curl http://localhost:3000/api/rules/name/{ruleName}

# 停用规则
curl -X PATCH http://localhost:3000/api/rules/{ruleId}/deactivate
```

### 风险样本管理

```bash
# 创建风险样本
curl -X POST http://localhost:3000/api/risk-samples \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"{datasetId}","sample_data":"样本数据内容","risk_level":"high","identified_fields":["phone","id_card"],"confidence_score":0.95}'

# 查询风险样本（支持过滤）
curl "http://localhost:3000/api/risk-samples?dataset_id={datasetId}&risk_level=high&status=pending"

# 更新样本状态
curl -X PATCH http://localhost:3000/api/risk-samples/{sampleId}/status \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'
```

### 仲裁流程

```bash
# 创建仲裁意见
curl -X POST http://localhost:3000/api/arbitration/opinions \
  -H "Content-Type: application/json" \
  -d '{"risk_sample_id":"{sampleId}","arbitrator":"仲裁员A","decision":"need_reprocess","reason":"存在个人敏感信息","evidence":{"type":"PII"}}'

# 生成仲裁摘要
curl -X POST http://localhost:3000/api/arbitration/summaries/generate/{datasetId}

# 查询仲裁摘要
curl http://localhost:3000/api/arbitration/summaries
```

### 重处理任务

```bash
# 创建重处理任务
curl -X POST http://localhost:3000/api/reprocess-tasks \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"{datasetId}","priority":"high","original_input":{"records":[]},"processing_basis":{"rule_version":"1.0"}}'

# 查询任务列表
curl "http://localhost:3000/api/reprocess-tasks?status=pending"

# 更新任务状态（含结论留痕）
curl -X PATCH http://localhost:3000/api/reprocess-tasks/{taskId}/status \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","final_conclusion":{"result":"success","processed_count":100}}'
```

### 数据导出

```bash
# 导出仲裁摘要（默认CSV格式）
curl -O http://localhost:3000/api/export/summary/{summaryId}

# 导出仲裁摘要（JSON格式）
curl -O http://localhost:3000/api/export/summary/{summaryId}?format=json

# 导出风险样本CSV
curl -O http://localhost:3000/api/export/risk-samples/{datasetId}

# 导出重处理任务CSV
curl -O http://localhost:3000/api/export/reprocess-tasks/{datasetId}
```

## 被规则拦截的场景示例

### 场景1：创建重复的重处理任务（幂等校验）

```bash
# 第一次创建会成功
curl -X POST http://localhost:3000/api/reprocess-tasks \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"{datasetId}","original_input":{}}'

# 同一数据集重复创建会被拦截（返回409）
curl -X POST http://localhost:3000/api/reprocess-tasks \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"{datasetId}","original_input":{}}'
```

**返回结果：**
```json
{
  "error": "该数据集已有进行中的重处理任务",
  "code": "TASK_ALREADY_EXISTS",
  "message": "Dataset {datasetId} already has an active reprocess task"
}
```

### 场景2：无效的状态值

```bash
# 使用非法状态值会被拦截
curl -X PATCH http://localhost:3000/api/risk-samples/{sampleId}/status \
  -H "Content-Type: application/json" \
  -d '{"status":"invalid_status"}'
```

**返回结果：**
```json
{
  "error": "更新风险样本状态失败",
  "code": "SAMPLE_STATUS_ERROR",
  "message": "Invalid status: invalid_status"
}
```

## 错误响应格式

所有接口错误响应采用统一格式，便于理解和处理：

```json
{
  "error": "人类可读的错误描述",
  "code": "错误码（如 VALIDATION_ERROR, NOT_FOUND）",
  "message": "详细错误信息",
  "details": []  // 验证错误时返回详细字段信息
}
```

常见错误码：
- `VALIDATION_ERROR` - 请求参数验证失败
- `NOT_FOUND` - 资源不存在
- `TASK_ALREADY_EXISTS` - 重处理任务已存在
- `INTERNAL_SERVER_ERROR` - 服务器内部错误

## 状态定义

### 风险样本状态
- `pending` - 待处理
- `reviewing` - 审核中
- `approved` - 已通过
- `rejected` - 已拒绝
- `need_reprocess` - 需重处理

### 风险等级
- `high` - 高风险
- `medium` - 中风险
- `low` - 低风险

### 仲裁决策类型
- `approve` - 通过
- `reject` - 拒绝
- `need_reprocess` - 需重处理
- `escalate` - 升级处理

### 重处理任务状态
- `pending` - 待处理
- `processing` - 处理中
- `completed` - 已完成
- `failed` - 失败
- `cancelled` - 已取消

## 项目结构

```
.
├── package.json
├── README.md
├── data/                    # SQLite数据库文件目录
└── src/
    ├── server.js            # 服务入口
    ├── database/
    │   └── db.js            # 数据库连接
    ├── models/              # 数据模型层
    │   ├── Dataset.js
    │   ├── AnonymizationRule.js
    │   ├── RiskSample.js
    │   ├── ArbitrationOpinion.js
    │   ├── ReprocessTask.js
    │   └── ArbitrationSummary.js
    ├── routes/              # API路由层
    │   ├── datasets.js
    │   ├── rules.js
    │   ├── riskSamples.js
    │   ├── arbitration.js
    │   ├── reprocessTasks.js
    │   └── export.js
    ├── middleware/          # 中间件
    │   └── validation.js    # 参数验证
    └── scripts/             # 脚本工具
        ├── initDB.js        # 数据库表初始化
        └── initData.js      # 示例数据初始化
```

## 技术栈

- **Node.js 18+** - 运行时环境
- **Express 4.x** - Web框架
- **SQLite3** - 关系型数据库
- **Joi** - 参数验证
- **json2csv** - CSV导出
- **uuid** - 唯一标识符生成