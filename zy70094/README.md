# 光伏并网申请服务

专门处理屋顶光伏并网申请流程的服务系统，重点处理勘察、审批、电表安装等核心环节，并考虑了真实业务中可能遇到的各种异常情况。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据（造数）

运行造数脚本创建示例数据：

```bash
node scripts/seedData.js
```

这会创建10条不同状态的申请单，方便测试各种场景。

### 3. 启动服务

```bash
npm start
```

服务启动后访问：
- 健康检查：`http://localhost:3000/health`
- API基础路径：`http://localhost:3000/api`

## 业务流程说明

### 核心流程（三个动作）

```
申请单提交 → 勘察预约 → 审批节点 → 电表任务 → 并网报表
                ↓
           材料补正（边界情况）
```

### 申请单状态流转

| 状态代码 | 状态说明 | 下一步可转状态 |
|---------|---------|--------------|
| SUBMITTED | 已提交 | PENDING_SURVEY, CANCELLED |
| PENDING_SURVEY | 待勘察 | SURVEY_COMPLETED, CANCELLED |
| SURVEY_COMPLETED | 勘察完成 | PENDING_APPROVAL, CANCELLED |
| PENDING_APPROVAL | 待审批 | APPROVAL_IN_PROGRESS, PENDING_SUPPLEMENT, REJECTED, CANCELLED |
| APPROVAL_IN_PROGRESS | 审批中 | APPROVED, PENDING_SUPPLEMENT, REJECTED, CANCELLED |
| APPROVED | 已批准 | PENDING_METER, CANCELLED |
| PENDING_METER | 待装表 | METER_INSTALLED, CANCELLED |
| METER_INSTALLED | 装表完成 | GRID_CONNECTED, CANCELLED |
| GRID_CONNECTED | 已并网 | - |
| PENDING_SUPPLEMENT | 待补材料 | SUPPLEMENT_SUBMITTED, CANCELLED |
| SUPPLEMENT_SUBMITTED | 材料已提交 | PENDING_APPROVAL, REJECTED, CANCELLED |
| REJECTED | 已驳回 | - |
| CANCELLED | 已取消 | - |

### 审批节点类型

1. **INITIAL_REVIEW** - 初审
2. **TECHNICAL_REVIEW** - 技术评审
3. **FINAL_APPROVAL** - 最终批准

## API 接口说明

### 通用请求头

- `x-operator`: 操作人标识（可选，默认 system）

### 申请单管理

#### 创建申请单
```bash
POST /api/applications
Content-Type: application/json

{
  "applicant_name": "张三",
  "contact_phone": "13800138000",
  "address": "北京市朝阳区阳光小区1号楼",
  "pv_capacity": 10.5,
  "remark": "屋顶光伏并网项目"
}
```

#### 查询所有申请单
```bash
GET /api/applications?status=SUBMITTED&limit=10&offset=0
```

#### 查询单个申请单详情
```bash
GET /api/applications/{id}
```

#### 查询申请单概要（含状态说明）
```bash
GET /api/applications/{id}/summary
```

#### 人工修正申请单信息
```bash
PATCH /api/applications/{id}/correct
Content-Type: application/json

{
  "applicant_name": "张三（修正后）",
  "contact_phone": "13900139000",
  "address": "北京市朝阳区阳光小区1号楼2单元",
  "pv_capacity": 12.0,
  "remark": "修正后的备注"
}
```

#### 强制更新状态（用于异常恢复）
```bash
PATCH /api/applications/{id}/status
Content-Type: application/json

{
  "new_status": "PENDING_SURVEY",
  "remark": "人工调整状态",
  "force": true
}
```

### 勘察预约

#### 创建勘察任务
```bash
POST /api/surveys/application/{applicationId}
Content-Type: application/json

{
  "scheduled_time": "2026-05-15T10:00:00Z",
  "surveyor": "李工程师",
  "remark": "上午上门勘察"
}
```

#### 预约勘察时间
```bash
POST /api/surveys/{surveyId}/schedule
Content-Type: application/json

{
  "scheduled_time": "2026-05-15T14:00:00Z",
  "surveyor": "王工程师"
}
```

#### 完成勘察
```bash
POST /api/surveys/{surveyId}/complete
Content-Type: application/json

{
  "roof_condition": "良好",
  "electrical_environment": "符合要求",
  "capacity_suggestion": 12.5,
  "remark": "勘察完成，建议安装12.5kW"
}
```

#### 取消勘察
```bash
POST /api/surveys/{surveyId}/cancel
Content-Type: application/json

{
  "reason": "用户暂不需要"
}
```

#### 标记勘察失败
```bash
POST /api/surveys/{surveyId}/fail
Content-Type: application/json

{
  "reason": "现场无法进入"
}
```

### 审批节点

#### 创建审批流程
```bash
POST /api/approvals/application/{applicationId}/flow
```

#### 获取当前审批节点
```bash
GET /api/approvals/application/{applicationId}/current
```

#### 审批节点操作
```bash
POST /api/approvals/{approvalId}/review
Content-Type: application/json

{
  "result": "APPROVED",
  "approver": "张主管",
  "remark": "材料齐全，同意通过"
}
```

审批结果可选值：
- `APPROVED` - 通过
- `REJECTED` - 驳回
- `NEEDS_SUPPLEMENT` - 需要补材料

#### 重置审批流程
```bash
POST /api/approvals/application/{applicationId}/restart
```

### 电表任务

#### 创建电表任务
```bash
POST /api/meters/application/{applicationId}
Content-Type: application/json

{
  "task_type": "INSTALL",
  "install_address": "北京市朝阳区阳光小区1号楼电表间",
  "meter_type": "双向智能电表",
  "installer": "刘师傅"
}
```

#### 安排电表安装
```bash
POST /api/meters/{meterId}/schedule
Content-Type: application/json

{
  "installer": "赵师傅"
}
```

#### 完成电表安装
```bash
POST /api/meters/{meterId}/complete
Content-Type: application/json

{
  "meter_type": "DT862-4型双向智能电表"
}
```

### 材料补正

#### 创建材料补正通知
```bash
POST /api/supplements/application/{applicationId}
Content-Type: application/json

{
  "missing_materials": ["身份证明", "房产证复印件", "用电许可证"],
  "submit_deadline": "2026-05-20T17:00:00Z",
  "remark": "缺少关键材料"
}
```

#### 提交补正材料
```bash
POST /api/supplements/{supplementId}/submit
Content-Type: application/json

{
  "materials": [
    {"name": "身份证明", "uploaded": true},
    {"name": "房产证复印件", "uploaded": true}
  ]
}
```

### 并网报表

#### 创建并网报表
```bash
POST /api/reports/application/{applicationId}
Content-Type: application/json

{
  "report_content": "详细的并网验收报告内容...",
  "remark": "并网验收合格"
}
```

#### 审批并网报表
```bash
POST /api/reports/{reportId}/approve
```

### 操作日志

#### 查询所有日志
```bash
GET /api/logs?limit=50&offset=0
```

#### 查询申请单日志
```bash
GET /api/applications/{id}/logs
```

## 主流程演练

假设你已经启动服务并运行了造数脚本。让我们走一遍完整流程：

### 步骤1：查看已有申请单

```bash
curl http://localhost:3000/api/applications
```

找到一条 `SUBMITTED` 状态的申请单（比如吴九的申请），记录其 ID。

### 步骤2：创建勘察任务

```bash
curl -X POST http://localhost:3000/api/surveys/application/{applicationId} \
  -H "Content-Type: application/json" \
  -H "x-operator: 营业厅职员" \
  -d '{
    "scheduled_time": "2026-05-15T10:00:00Z",
    "surveyor": "李工程师"
  }'
```

查看申请单状态，应该变成 `PENDING_SURVEY`。

### 步骤3：完成勘察

```bash
curl -X POST http://localhost:3000/api/surveys/{surveyId}/complete \
  -H "Content-Type: application/json" \
  -H "x-operator: 李工程师" \
  -d '{
    "roof_condition": "良好",
    "electrical_environment": "符合要求",
    "capacity_suggestion": 12.5
  }'
```

查看申请单状态，应该变成 `SURVEY_COMPLETED`。

### 步骤4：创建审批流程

```bash
curl -X POST http://localhost:3000/api/approvals/application/{applicationId}/flow \
  -H "x-operator: 流程管理员"
```

查看申请单状态，应该变成 `PENDING_APPROVAL`，并创建了3个审批节点。

### 步骤5：依次审批

```bash
# 获取当前审批节点
curl http://localhost:3000/api/approvals/application/{applicationId}/current

# 初审通过
curl -X POST http://localhost:3000/api/approvals/{approvalId}/review \
  -H "Content-Type: application/json" \
  -H "x-operator: 初审员" \
  -d '{
    "result": "APPROVED",
    "approver": "张主管",
    "remark": "材料齐全"
  }'

# 重复获取当前节点并完成技术评审和最终批准
```

全部通过后，申请单状态变为 `APPROVED`。

### 步骤6：创建电表任务

```bash
curl -X POST http://localhost:3000/api/meters/application/{applicationId} \
  -H "Content-Type: application/json" \
  -H "x-operator: 电力公司" \
  -d '{
    "task_type": "INSTALL",
    "install_address": "用户地址",
    "installer": "刘师傅"
  }'
```

### 步骤7：完成电表安装

```bash
curl -X POST http://localhost:3000/api/meters/{meterId}/schedule \
  -H "Content-Type: application/json" \
  -d '{"installer": "刘师傅"}'

curl -X POST http://localhost:3000/api/meters/{meterId}/complete \
  -H "Content-Type: application/json" \
  -H "x-operator: 刘师傅" \
  -d '{"meter_type": "双向智能电表"}'
```

### 步骤8：创建并网报表并审批

```bash
curl -X POST http://localhost:3000/api/reports/application/{applicationId} \
  -H "x-operator: 验收员"

curl -X POST http://localhost:3000/api/reports/{reportId}/approve \
  -H "x-operator: 验收主管"
```

申请单最终状态变为 `GRID_CONNECTED`。

## 触发异常场景

### 1. 缺字段

创建申请单时故意不填必填字段：

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_name": "测试用户"
  }'
```

预期结果：返回 400 错误，提示缺少必填字段。

### 2. 重复请求

对同一个申请单连续创建两个勘察任务：

```bash
# 第一次
curl -X POST http://localhost:3000/api/surveys/application/{applicationId} \
  -H "Content-Type: application/json" \
  -d '{}'

# 第二次（应该失败）
curl -X POST http://localhost:3000/api/surveys/application/{applicationId} \
  -H "Content-Type: application/json" \
  -d '{}'
```

预期结果：第二次返回 409 错误，提示已存在进行中的任务。

### 3. 状态转换不合法

尝试跳过流程直接从 SUBMITTED 跳到 APPROVED：

```bash
# 先获取一条 SUBMITTED 状态的申请单 ID
curl http://localhost:3000/api/applications?status=SUBMITTED

# 尝试非法状态转换
curl -X PATCH http://localhost:3000/api/applications/{id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "APPROVED"
  }'
```

预期结果：返回 409 错误，提示无效的状态转换。

### 4. 半路失败（模拟）

在勘察过程中标记失败：

```bash
# 创建勘察任务
curl -X POST http://localhost:3000/api/surveys/application/{applicationId} \
  -H "Content-Type: application/json" \
  -d '{}'

# 标记失败
curl -X POST http://localhost:3000/api/surveys/{surveyId}/fail \
  -H "Content-Type: application/json" \
  -d '{"reason": "用户不在家，无法勘察"}'
```

然后查看操作日志，确认失败原因已记录。

### 5. 人工改错

```bash
# 查看申请单详情
curl http://localhost:3000/api/applications/{id}

# 人工修正
curl -X PATCH http://localhost:3000/api/applications/{id}/correct \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{
    "contact_phone": "13999999999",
    "remark": "人工修正电话号码"
  }'

# 查看日志确认修改记录
curl http://localhost:3000/api/applications/{id}/logs
```

### 6. 强制恢复（异常处理）

如果因为程序bug或手动操作导致状态异常，可以使用强制更新：

```bash
curl -X PATCH http://localhost:3000/api/applications/{id}/status \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{
    "new_status": "PENDING_APPROVAL",
    "remark": "系统异常后人工恢复",
    "force": true
  }'
```

## 查看结果

### 查询单个申请单完整信息

```bash
# 基本信息
curl http://localhost:3000/api/applications/{id}

# 概要（含状态说明）
curl http://localhost:3000/api/applications/{id}/summary

# 勘察记录
curl http://localhost:3000/api/applications/{id}/surveys

# 审批记录
curl http://localhost:3000/api/applications/{id}/approvals

# 电表记录
curl http://localhost:3000/api/applications/{id}/meters

# 材料补正记录
curl http://localhost:3000/api/applications/{id}/supplements

# 并网报表
curl http://localhost:3000/api/applications/{id}/reports

# 操作日志（最关键！）
curl http://localhost:3000/api/applications/{id}/logs
```

### 查询所有申请单

```bash
# 全部
curl http://localhost:3000/api/applications

# 按状态筛选
curl "http://localhost:3000/api/applications?status=SUBMITTED"
curl "http://localhost:3000/api/applications?status=GRID_CONNECTED"

# 分页
curl "http://localhost:3000/api/applications?limit=5&offset=0"
```

### 查询所有操作日志

```bash
curl http://localhost:3000/api/logs
```

## 数据持久化说明

数据存储在 `data/pv_system.db`（SQLite 数据库文件）：

- 重启服务后数据不会丢失
- 删除 `data/` 目录可清空所有数据重新开始
- 造数脚本不会删除已有数据，会追加新记录

## 排查技巧

遇到问题时，按以下顺序排查：

1. **看日志** - 先查操作日志 `GET /api/logs` 或 `GET /api/applications/{id}/logs`，了解之前发生了什么
2. **查状态** - 调用 `GET /api/applications/{id}/summary`，看看当前状态和下一步能做什么
3. **看详情** - 查看各环节记录（surveys、approvals、meters 等）
4. **人工修正** - 如果状态卡死，使用 `force: true` 强制调整

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: SQLite (轻量，无需安装)
- **数据目录**: ./data/
- **端口**: 3000 (可通过 PORT 环境变量修改)
