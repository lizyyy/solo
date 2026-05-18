# 任务编排平台依赖任务临时跳过 API

## 项目概述

本系统为任务编排平台提供依赖任务临时跳过的审批管理功能，确保下游任务在读取到不完整数据时能够被正确识别和处理，并通过补跑机制保障数据完整性。

## 核心功能

- ✅ 跳过申请创建与管理（记录工作流、依赖任务、跳过原因、影响范围、补跑计划）
- ✅ 审批流程（待审批 → 审批通过/拒绝）
- ✅ 下游数据完整性检测
- ✅ 下游异常上报与状态更新
- ✅ 服务关闭拦截（存在未补跑的跳过任务时阻止关闭）
- ✅ 补跑记录管理（创建 → 开始 → 完成）
- ✅ 依赖跳过表导出（CSV格式）

## 状态流转

```
跳过申请创建
    ↓
待审批 (pending)
    ↓────┐
    ↓  审批拒绝 (rejected) → 流程结束
审批通过 (approved)
    ↓
下游数据不完整 → 下游异常 (downstream_exception)
    ↓
创建补跑 → 补跑中 → 补跑完成 (rerun_completed) → 流程闭环
```

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- SQLite3 (数据库)
- csv-writer (CSV导出)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行验收测试

```bash
# 运行完整验收测试（包含所有场景）
npm test

# 运行单独场景测试
npm run test:normal    # 正常流程测试
npm run test:abnormal  # 异常流程测试  
npm run test:repeat    # 重复运行测试
```

### 3. 启动 API 服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务启动后访问: http://localhost:3000

## API 接口文档

### 基础路径

所有 API 接口都以 `/api` 为前缀。

---

### 1. 跳过申请管理

#### 创建跳过申请

**POST** `/api/skip-applications`

**输入参数:**
```json
{
  "workflow_id": "工作流ID",
  "task_id": "被跳过的任务ID",
  "task_name": "被跳过的任务名称",
  "skip_reason": "跳过原因（详细说明）",
  "impact_scope": "影响范围说明",
  "rerun_plan": "补跑计划说明",
  "applicant": "申请人"
}
```

**输出示例:**
```json
{
  "success": true,
  "data": {
    "message": "跳过申请创建成功",
    "application": {...},
    "next_step": "请等待审批"
  }
}
```

#### 查询所有跳过申请

**GET** `/api/skip-applications`

#### 查询单个跳过申请

**GET** `/api/skip-applications/:id`

#### 审批跳过申请

**POST** `/api/skip-applications/approve`

**输入参数:**
```json
{
  "skip_application_id": "跳过申请ID",
  "approver": "审批人",
  "approval_result": "approved | rejected",
  "approval_comment": "审批意见（可选）"
}
```

---

### 2. 工作流管理

#### 执行任务

**POST** `/api/workflow/execute?skip_application_id=xxx`

**输入参数:**
```json
{
  "workflow_id": "工作流ID",
  "task_id": "任务ID",
  "task_name": "任务名称",
  "downstream_tasks": ["下游任务ID1", "下游任务ID2"]
}
```

**输出示例:**
```json
{
  "success": true,
  "data": {
    "message": "任务已跳过，下游数据可能不完整",
    "workflow_record": {...},
    "data_completeness": "incomplete",
    "warning": "警告：数据不完整，下游任务可能异常，请及时补跑"
  }
}
```

#### 上报下游异常

**POST** `/api/workflow/downstream-exception`

**输入参数:**
```json
{
  "workflow_record_id": "工作流记录ID",
  "skip_application_id": "跳过申请ID"
}
```

#### 查询工作流记录

**GET** `/api/workflow/records?workflow_id=xxx`

#### 检查服务是否可关闭

**GET** `/api/workflow/can-close/:workflow_id`

**输出示例:**
```json
{
  "success": true,
  "data": {
    "canClose": false,
    "reason": "存在未完成补跑的跳过任务: 上游数据同步任务，请先完成补跑记录"
  }
}
```

---

### 3. 补跑管理

#### 创建补跑记录

**POST** `/api/rerun`

**输入参数:**
```json
{
  "skip_application_id": "跳过申请ID",
  "task_id": "补跑任务ID",
  "task_name": "补跑任务名称"
}
```

#### 开始补跑

**POST** `/api/rerun/:rerun_id/start`

#### 完成补跑

**POST** `/api/rerun/:rerun_id/complete`

**输入参数:**
```json
{
  "success": true
}
```

#### 查询补跑记录

**GET** `/api/rerun?skip_application_id=xxx`

---

### 4. 导出功能

#### 导出依赖跳过表

**POST** `/api/export/skip-records`

**输出示例:**
```json
{
  "success": true,
  "data": {
    "message": "导出成功",
    "file_path": "/path/to/exports/skip-records-1234567890.csv"
  }
}
```

---

### 5. 健康检查

**GET** `/health`

---

## 导出文件格式

导出的 CSV 文件包含以下字段：

| 字段 | 说明 |
|------|------|
| 申请ID | 跳过申请的唯一标识 |
| 工作流ID | 所属工作流ID |
| 任务ID | 被跳过的任务ID |
| 任务名称 | 被跳过的任务名称 |
| 跳过原因 | 申请跳过的原因 |
| 影响范围 | 影响范围说明 |
| 补跑计划 | 补跑计划说明 |
| 申请人 | 申请人姓名 |
| 当前状态 | 当前状态（中文） |
| 申请时间 | 申请创建时间 |
| 审批人 | 审批人姓名 |
| 审批结果 | 审批结果（通过/拒绝） |
| 审批时间 | 审批时间 |
| 补跑状态 | 补跑状态（中文） |
| 补跑完成时间 | 补跑完成时间 |

## 验收测试说明

### 测试场景

#### 1. 正常流程测试 (npm run test:normal)

验证完整的生命周期：
- 创建跳过申请（阶段1）
- 审批通过（阶段2）
- 下游任务执行，检测数据不完整（阶段3）
- 上报下游异常（阶段4）
- 检查服务关闭权限（被阻止）（阶段5）
- 创建并完成补跑（阶段6）
- 再次检查服务关闭权限（允许）（阶段7）
- 导出依赖跳过表（阶段8）

#### 2. 异常流程测试 (npm run test:abnormal)

验证边界情况：
- 审批拒绝场景
- 补跑失败场景
- 重复审批拦截
- 查询不存在的申请

#### 3. 重复运行测试 (npm run test:repeat)

验证批量操作：
- 批量创建5个跳过申请
- 批量审批
- 部分申请完成补跑
- 查询所有记录
- 批量导出
- 多工作流关闭权限检查

### 测试结果人工复核

测试完成后，请进行以下人工复核：

1. **检查 exports 目录**：确认生成的 CSV 文件存在且内容正确
2. **检查数据库文件**：`database.sqlite` 中的各表数据是否符合预期
3. **验证状态流转**：确认各申请的状态是否正确流转
4. **验证服务关闭拦截**：存在未补跑任务时确认服务无法关闭

## 项目结构

```
.
├── src/
│   ├── controllers/      # 控制器层
│   │   └── index.ts
│   ├── models/           # 数据模型
│   │   ├── database.ts   # 数据库初始化
│   │   └── types.ts      # 类型定义
│   ├── routes/           # 路由配置
│   │   └── index.ts
│   ├── services/         # 业务逻辑层
│   │   ├── skipApplication.service.ts
│   │   ├── workflow.service.ts
│   │   └── export.service.ts
│   └── index.ts          # 应用入口
├── test/                 # 测试用例
│   └── acceptance.test.ts
├── exports/              # 导出文件目录（自动生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 数据库表结构

### skip_applications（跳过申请表）
- id: 主键
- workflow_id: 工作流ID
- task_id: 任务ID
- task_name: 任务名称
- skip_reason: 跳过原因
- impact_scope: 影响范围
- rerun_plan: 补跑计划
- applicant: 申请人
- status: 状态
- created_at, updated_at: 时间戳

### approval_records（审批记录表）
- id: 主键
- skip_application_id: 外键（跳过申请ID）
- approver: 审批人
- approval_result: 审批结果
- approval_comment: 审批意见
- approved_at: 审批时间

### workflow_records（工作流记录表）
- id: 主键
- workflow_id: 工作流ID
- task_id: 任务ID
- task_name: 任务名称
- status: 任务状态
- is_skipped: 是否跳过
- skip_application_id: 外键（跳过申请ID）
- downstream_tasks: 下游任务JSON
- data_completeness: 数据完整性
- started_at, completed_at: 执行时间

### rerun_records（补跑记录表）
- id: 主键
- skip_application_id: 外键（跳过申请ID）
- workflow_record_id: 外键（工作流记录ID）
- rerun_task_id: 补跑任务ID
- rerun_task_name: 补跑任务名称
- status: 补跑状态
- started_at, completed_at: 补跑时间

## 注意事项

1. **服务关闭拦截**：只要工作流存在状态为 `approved` 或 `downstream_exception` 的跳过申请，服务就会被阻止关闭，直到补跑完成。
2. **数据完整性标记**：跳过的任务会自动标记为数据不完整（`incomplete`），下游任务应检查此标记。
3. **补跑闭环**：只有补跑成功后，跳过申请的状态才会更新为 `rerun_completed`，流程才算闭环。
4. **人工复核**：所有测试结果都应进行人工复核，特别是导出的 CSV 文件和数据库记录。

## 许可证

MIT