# 安全例行巡检API

一套完整的安全巡检问题跟踪管理系统，涵盖问题登记、整改流转、复查验收、异常处理和报告导出全流程。

## 数据模型

- **巡检批次 (inspection_batches)**: 统一管理多轮安全巡检
- **检查项 (inspection_items)**: 具体巡检问题，关联风险等级和整改人
- **风险等级 (risk_levels)**: 严重/高危/中危/低危四级分类
- **状态流转记录 (status_history)**: 完整追踪每个检查项的状态变更
- **整改记录 (rectification_records)**: 整改内容和证据留存
- **复查记录 (review_records)**: 复查结论和意见记录
- **异常日志 (exception_logs)**: 系统异常和处理依据记录
- **人工修正记录 (manual_corrections)**: 数据修正的审计追踪
- **巡检报告 (inspection_reports)**: 统计报告生成与存储

## 启动说明

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入示例数据（可选）

```bash
npm run seed
```

### 4. 启动服务

```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务默认运行在 `http://localhost:3000`

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api | API版本信息 |
| POST | /api/batches | 创建巡检批次 |
| GET | /api/batches | 查询批次列表 |
| GET | /api/batches/:id | 批次详情（含检查项） |
| PUT | /api/batches/:id/status | 更新批次状态 |
| POST | /api/items | 创建检查项 |
| GET | /api/items | 查询检查项列表 |
| GET | /api/items/:id | 检查项详情 |
| PUT | /api/items/:id/status | 更新检查项状态 |
| POST | /api/rectification | 提交整改申请 |
| POST | /api/review | 提交复查结论 |
| POST | /api/corrections | 人工修正数据 |
| GET | /api/exceptions | 查询异常日志 |
| PUT | /api/exceptions/:id | 处理异常 |
| GET | /api/overdue | 逾期提醒统计 |
| GET | /api/export | 导出CSV报告 |
| GET | /api/statistics | 统计数据汇总 |
| POST | /api/reports | 生成巡检报告 |
| GET | /api/reports | 查询报告列表 |
| GET | /api/risk-levels | 查询风险等级列表 |

## CURL 调用示例

### 1. 创建巡检批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "2026年Q2季度安全巡检",
    "inspection_type": "routine",
    "start_date": "2026-05-01",
    "end_date": "2026-06-30",
    "inspector": "张安全",
    "remarks": "季度例行检查"
  }'
```

### 2. 创建检查项

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "check_content": "生产服务器密码复杂度不符合要求，存在弱口令风险",
    "risk_level_id": 4,
    "rectifier": "李运维",
    "rectify_deadline": "2026-05-20",
    "source_type": "screenshot",
    "source_ref": "screenshot_20260501_001.png",
    "raw_input": "{\"source\":\"screenshot\",\"detected\":\"2026-05-01T10:00:00Z\",\"location\":\"192.168.1.100\"}"
  }'
```

### 3. 查询检查项（带过滤）

```bash
# 按风险等级查询
curl "http://localhost:3000/api/items?risk_level=critical"

# 查询逾期项目
curl "http://localhost:3000/api/items?overdue=true"

# 按整改人查询
curl "http://localhost:3000/api/items?rectifier=李运维"

# 分页查询
curl "http://localhost:3000/api/items?page=1&pageSize=10"
```

### 4. 推进状态 - 开始整改

```bash
curl -X PUT http://localhost:3000/api/items/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_rectification",
    "operator": "李运维",
    "reason": "已收到整改通知，开始处理"
  }'
```

### 5. 提交整改申请

```bash
curl -X POST http://localhost:3000/api/rectification \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "rectify_content": "已修改所有服务器密码策略，强制16位以上复杂密码，包含大小写字母、数字和特殊字符",
    "rectifier": "李运维",
    "rectify_date": "2026-05-15",
    "evidences": "[{\"type\":\"screenshot\",\"url\":\"/evidences/pwd-policy-20260515.png\"}]"
  }'
```

### 6. 提交复查 - 通过

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "reviewer": "张安全",
    "review_date": "2026-05-16",
    "review_conclusion": "passed",
    "review_opinion": "整改到位，抽查5台服务器均符合新密码策略要求，问题已关闭"
  }'
```

### 7. 人工修正数据

```bash
curl -X POST http://localhost:3000/api/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "field_name": "rectify_deadline",
    "new_value": "2026-05-25",
    "corrector": "张安全",
    "correction_reason": "项目优先级调整，延长整改期限"
  }'
```

### 8. 导出CSV报告

```bash
curl -O "http://localhost:3000/api/export?batch_id=1"
```

### 9. 查询统计数据

```bash
curl http://localhost:3000/api/statistics
```

### 10. 生成巡检报告

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "report_type": "summary",
    "generated_by": "张安全"
  }'
```

## 异常路径 - 被拦截的调用示例

### 1. 非法状态流转 - 从"待整改"直接"关闭"

```bash
curl -X PUT http://localhost:3000/api/items/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed",
    "operator": "非法操作",
    "reason": "跳过流程直接关闭"
  }'
```

**拦截结果：**
```json
{
  "success": false,
  "message": "不允许从 pending 转换到 closed"
}
```

### 2. 修改不允许的字段

```bash
curl -X POST http://localhost:3000/api/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "field_name": "current_status",
    "new_value": "closed",
    "corrector": "非法修改",
    "correction_reason": "尝试绕过状态流程"
  }'
```

**拦截结果：**
```json
{
  "success": false,
  "message": "不允许修改此字段"
}
```

### 3. 参数验证失败 - 必填项缺失

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "check_content": "缺少batch_id和risk_level_id"
  }'
```

**拦截结果：**
```json
{
  "success": false,
  "message": "参数验证失败",
  "errors": [
    "\"batch_id\" is required",
    "\"risk_level_id\" is required"
  ]
}
```

### 4. 未经过整改流程直接复查

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "reviewer": "张安全",
    "review_date": "2026-05-16",
    "review_conclusion": "passed"
  }'
```

**拦截结果（当检查项状态为pending时）：**
```json
{
  "success": false,
  "message": "当前状态不允许提交复查"
}
```

## 状态流转图

```
pending (待整改)
    ↓
in_rectification (整改中)
    ↓
rectified (已整改待复查)
    ↓
reviewing (复查中)
    ↓
┌───────────┬───────────┐
│ passed    │ failed    │
│ ↓         │ ↓         │
│ closed    │ reopened  │ (重新整改)
└───────────┴───────────┘
```

## 异常处理机制

1. **自动捕获**: 所有API异常自动捕获并记录到exception_logs表
2. **原始输入留存**: 完整记录请求方法、URL、body、参数等原始输入
3. **处理依据追踪**: 异常处理时需填写处理依据，留痕可追溯
4. **状态管理**: 异常分为pending(待处理)、resolved(已解决)、rejected(已驳回)

## 关键业务规则

1. **检查项登记**: 必须关联批次、指定风险等级、分配整改人、设置截止日期
2. **整改状态约束**: 严格的状态流转校验，不允许跳步操作
3. **复查流转**: 整改完成后必须经过复查才能关闭，复查不通过需重新整改
4. **逾期提醒**: 支持按截止日期提前N天预警，按整改人分组统计
5. **审计追踪**: 所有状态变更、人工修正均有完整操作记录
6. **报告导出**: 支持按批次导出CSV格式的巡检报告

## 目录结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── controllers/
│   │   ├── batchController.js # 批次管理
│   │   ├── itemController.js  # 检查项管理
│   │   └── advancedController.js # 高级功能（异常、修正、导出）
│   ├── middleware/
│   │   ├── validate.js        # 参数校验
│   │   └── errorHandler.js    # 异常处理
│   ├── routes/
│   │   └── index.js           # 路由定义
│   └── scripts/
│       ├── initDB.js          # 数据库初始化
│       └── seedData.js        # 示例数据
├── data/                      # SQLite数据库文件
├── exports/                   # 导出文件目录
└── package.json
```
