# 资产标签纠错 API 使用指南

## 服务启动

```bash
# 开发模式（自动重启）
npm run dev

# 编译并生产运行
npm run build && npm start
```

服务默认地址：http://localhost:3000

---

## API 接口列表

### 1. 创建修正申请

**POST** `/api/corrections`

请求体：
```json
{
  "title": "ECS 实例标签批量修正",
  "description": "生产环境 10 台 ECS 实例的 CostCenter 标签错误，需要批量修正",
  "applicant": "张三",
  "applicantDepartment": "云成本优化部",
  "assets": [
    {
      "assetId": "ecs-i-xxx001",
      "targetTags": {
        "Environment": "Production",
        "CostCenter": "CC-001",
        "Project": "电商平台",
        "Owner": "team-a"
      },
      "costProject": "PROJ-001"
    },
    {
      "assetId": "ecs-i-xxx002",
      "targetTags": {
        "Environment": "Production",
        "CostCenter": "CC-001",
        "Project": "电商平台",
        "Owner": "team-a"
      },
      "costProject": "PROJ-001"
    }
  ]
}
```

响应：
```json
{
  "success": true,
  "message": "修正申请创建成功",
  "data": {
    "id": "uuid-xxx",
    "status": "DRAFT",
    "title": "ECS 实例标签批量修正"
  }
}
```

---

### 2. 生成预览（标签差异 + 成本影响）

**POST** `/api/corrections/:id/preview`

响应：
```json
{
  "success": true,
  "message": "预览生成成功，请确认标签差异和成本影响后提交审批",
  "data": {
    "tagDiffs": [
      {
        "assetId": "ecs-i-xxx001",
        "addedTags": {},
        "removedTags": {},
        "modifiedTags": {
          "CostCenter": {
            "from": "WRONG-CC-001",
            "to": "CC-001"
          },
          "Project": {
            "from": "WRONG-PROJECT",
            "to": "电商平台"
          }
        },
        "unchangedTags": {
          "Environment": "Production",
          "Owner": "team-wrong"
        }
      }
    ],
    "costImpacts": [
      {
        "assetId": "ecs-i-xxx001",
        "previousCost": 8500,
        "estimatedNewCost": 8500,
        "costChange": 0,
        "affectedPeriods": ["2026-05", "2026-06"],
        "costProjectChange": {
          "from": "OLD-COST-PROJECT-001",
          "to": "PROJ-001"
        }
      }
    ]
  }
}
```

---

### 3. 提交审批

**POST** `/api/corrections/:id/submit`

请求体：
```json
{
  "approver": "李四"
}
```

---

### 4. 审批通过

**POST** `/api/corrections/:id/approve`

请求体：
```json
{
  "approver": "李四",
  "comment": "标签修正方案合理，同意执行"
}
```

---

### 5. 驳回申请

**POST** `/api/corrections/:id/reject`

请求体：
```json
{
  "approver": "李四",
  "comment": "请补充成本影响分析报告"
}
```

---

### 6. 执行标签修正

**POST** `/api/corrections/:id/execute`

请求体：
```json
{
  "operator": "王五"
}
```

---

### 7. 回滚修正

**POST** `/api/corrections/:id/rollback`

请求体：
```json
{
  "operator": "王五"
}
```

---

### 8. 人工修正单资产

**POST** `/api/corrections/:id/assets/:assetId/manual-fix`

请求体：
```json
{
  "correctedTags": {
    "Environment": "Production",
    "CostCenter": "CC-002",
    "Project": "支付平台"
  },
  "operator": "赵六",
  "reason": "该资产归属支付部门，非电商部门"
}
```

---

### 9. 生成纠错报告

**POST** `/api/corrections/:id/report`

请求体：
```json
{
  "generatedBy": "王五"
}
```

---

### 10. 导出报告

**GET** `/api/corrections/reports/:reportId/export?format=markdown`

参数：
- `format`: `markdown`（默认）或 `csv`

导出的 Markdown 报告包含：
- 执行概览（涉及资产数、成功数、失败数、累计成本变动）
- 成本变动提示
- 每台资产的明细数据（标签变更对比表格、成本项目变化）
- 异常记录（包含处理依据）
- 审批轨迹

---

### 11. 查询申请列表

**GET** `/api/corrections?status=PREVIEWED&applicant=张三`

查询参数：
- `status`: 状态过滤（DRAFT, PREVIEWED, PENDING_APPROVAL, APPROVED, EXECUTING, COMPLETED, REJECTED, ROLLED_BACK, EXCEPTION）
- `applicant`: 申请人过滤
- `department`: 申请部门过滤

---

### 12. 查询单个申请详情

**GET** `/api/corrections/:id`

---

## 状态流转图

```
草稿 (DRAFT)
    ↓ [生成预览]
已预览 (PREVIEWED)
    ↓ [提交审批]
待审批 (PENDING_APPROVAL)
   ↙     ↘
已批准   已拒绝
(APPROVED) (REJECTED)
    ↓ [执行]
执行中 (EXECUTING)
   ↓
完成 (COMPLETED) ──→ 回滚 (ROLLED_BACK)
   ↓
异常 (EXCEPTION) ──→ 人工修正后重新走流程
```

---

## 关键特性

### ✅ 标签差异智能对比
- 新增标签识别
- 删除标签识别
- 修改标签识别（原值 → 目标值）
- 未变更标签识别

### ✅ 成本影响预览
- 原成本 vs 预估新成本
- 成本变化金额
- 受影响期间
- 成本项目变更记录

### ✅ 审批流程管控
- 审批人记录
- 审批意见留存
- 审批时间戳

### ✅ 回滚机制
- 执行前自动创建回滚点
- 快照保存修正前标签状态
- 一键回滚到原始状态

### ✅ 异常处理
- 自动捕获执行异常
- 保存原始输入
- 保存处理依据链
- 标记为已解决 / 待处理
- 支持人工介入修正

### ✅ 友好的报告导出
- **Markdown 格式**：带表格、图标、层级结构，业务同事直接可读
- **CSV 格式**：便于导入 Excel 进一步分析
- 中文状态说明，非技术人员也能理解
