# 会员管理后端服务 API 文档

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 生成演示数据
npm run seed

# 启动服务
npm start
```

服务启动后访问: `http://localhost:3000`

---

## 核心功能列表

| 功能 | 说明 |
|------|------|
| 批量禁用开关 | 通过系统设置控制批量禁用功能的开启/关闭 |
| 回滚无证据记录 | 演示数据中专门预留了一条回滚无证据的记录便于复核 |
| 边界输入处理 | 每条记录可存储边界输入值和处理结果，便于直接定位复核 |
| 异常样本导出 | 支持 JSON、Markdown、CSV 格式导出，供同事复核 |
| 候选清单机制 | 清理/回滚前先生成候选清单，避免误伤真实数据 |
| 明细结果保留 | 批量操作时保留每条记录的执行结果，部分成功不标记为全部成功 |
| 人工备注入库 | 实验室样本单人工备注可入库，支持按调用方查询 |

---

## API 接口

### 1. 系统设置

#### 获取系统设置
```
GET /api/v1/settings
```

#### 更新系统设置
```
PUT /api/v1/settings
Body: { "key": "batch_disable_switch", "value": "true" }
```

---

### 2. 会员管理

#### 获取会员列表
```
GET /api/v1/members?status=active&page=1&pageSize=20
```

---

### 3. 续费流水管理

#### 获取续费流水
```
GET /api/v1/renewals?status=completed&has_boundary_input=true&review_required=true
```

#### 更新处理结果（边界输入）
```
PUT /api/v1/renewals/:id/result
Body: { 
  "processed_result": { "reviewRequired": true, "action": "manual_review" },
  "boundary_input": { "edgeCase": "expired_just_now" }
}
```

#### 获取回滚复核列表（无证据记录）
```
GET /api/v1/renewals/review-rollback
```
*专门用于复核回滚无证据的记录*

---

### 4. 批量禁用功能

#### 生成批量禁用候选清单
```
GET /api/v1/candidates/batch-disable?status=inactive&days_expired=30
```
*执行禁用前必须先生成候选清单，避免误伤*

#### 执行批量禁用
```
POST /api/v1/operations/batch-disable
Body: {
  "member_ids": ["uuid1", "uuid2"],
  "confirmed": true,
  "operator_id": "OP001",
  "operator_name": "管理员A"
}
```
*保留每条记录的执行明细，部分成功时不标记为全部成功*

---

### 5. 回滚操作

#### 生成回滚候选清单
```
GET /api/v1/candidates/rollback?days_ago=7&status=completed
```

#### 执行批量回滚
```
POST /api/v1/operations/rollback
Body: {
  "transaction_ids": ["uuid1", "uuid2"],
  "confirmed": true,
  "rollback_evidence": "退款凭证号12345",
  "operator_id": "OP001",
  "operator_name": "管理员A"
}
```
*未提供证据时自动标记为需要复核*

---

### 6. 清理操作

#### 生成清理候选清单
```
GET /api/v1/candidates/cleanup?table=all&days_old=180
```
*清理前必须确认候选清单，防止误删*

---

### 7. 实验室样本管理

#### 获取样本列表
```
GET /api/v1/lab-samples?has_manual_remark=true
```

#### 更新人工备注
```
PUT /api/v1/lab-samples/:id/remark
Body: {
  "manual_remark": "人工备注：检测指标异常，需进一步确认",
  "operator_id": "LAB001"
}
```

#### 搜索样本（支持按备注内容搜索）
```
GET /api/v1/lab-samples/search?keyword=异常
```

---

### 8. 导出功能

#### 导出异常样本
```
GET /api/v1/export/exceptions?format=json&type=all
```

支持的格式 (`format`):
- `json` - JSON 格式（默认）
- `markdown` - Markdown 表格格式（可直接下载）
- `csv` - CSV 格式（可直接下载）

支持的类型 (`type`):
- `all` - 全部异常
- `renewal` - 仅续费流水异常
- `sample` - 仅样本异常

#### 导出批量操作明细
```
GET /api/v1/export/batch-operations?batch_id=xxx&format=markdown
```

#### 获取复核统计
```
GET /api/v1/review/statistics
```

---

## 统一响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 批量操作响应
```json
{
  "success": true,
  "message": "部分禁用成功",
  "data": {
    "summary": {
      "total": 10,
      "success": 8,
      "failed": 2,
      "batchId": "xxx"
    },
    "details": [
      { "id": "xxx", "success": true, "name": "张三" },
      { "id": "xxx", "success": false, "error": "会员不存在" }
    ]
  }
}
```

### 候选清单响应
```json
{
  "success": true,
  "message": "候选清单生成成功，请确认后执行操作",
  "data": {
    "candidates": [],
    "metadata": { "requiresConfirmation": true },
    "totalCount": 10,
    "requiresConfirmation": true
  }
}
```

---

## 数据结构说明

### 特殊标记字段

| 字段 | 用途 |
|------|------|
| `boundary_input` | 存储边界输入值，用于定位需要特别处理的记录 |
| `processed_result` | 存储处理结果，包含复核标记和建议操作 |
| `rollback_evidence` | 回滚证据，为 null 时表示无证据需要复核 |
| `manual_remark` | 人工备注，可按关键词搜索 |

### 演示数据说明

运行 `npm run seed` 后会生成：
- 15 条会员记录
- N 条续费流水（包含 **1 条回滚无证据的特殊记录**，标记为 `reviewRequired: true`）
- 多条实验室样本记录（部分包含人工备注）
- 系统设置（批量禁用开关默认开启）

---

## 复核流程示例

1. **获取复核统计** → 查看有多少记录待复核
2. **获取回滚无证据列表** → 查看所有无证据的回滚记录
3. **导出异常样本** → 导出 Markdown/CSV 发给同事
4. **更新处理结果** → 对每条记录标记处理状态

---

## 注意事项

1. **所有批量操作必须先获取候选清单，确认后再执行**
2. **部分成功的批量操作不会标记为全部成功，明细会保留每条记录状态**
3. **无证据的回滚记录会自动标记为需要复核**
4. **导出功能支持多种格式，内容完全一致**
5. **边界输入和处理结果字段专门为复核设计，可直接定位问题记录**