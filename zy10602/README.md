# 物联网设备云固件灰度回滚审批 API

基于 Node.js + Express + SQLite 实现的完整审批流程 API。

## 功能特性

- ✅ 审批单完整生命周期管理
- ✅ 历史记录追踪（每次状态变更和字段修改）
- ✅ 冲突检测（同一设备组的升级/回滚冲突）
- ✅ 重复请求检测（同一灰度批次）
- ✅ 撤回与重新提交
- ✅ 数据验证（明确的错误提示）
- ✅ CSV 导出
- ✅ 状态覆盖：待发布、灰度中、暂停、回滚完成、已撤回

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 运行验收测试

```bash
chmod +x test.sh
./test.sh
```

## API 文档

### 基础路径

所有 API 路径前缀：`/api`

### 1. 创建审批单

```bash
POST /api/approvals
Content-Type: application/json

{
    "device_model": "SmartLock-X1",
    "firmware_version": "2.3.0",
    "gray_batch": "GB-2024-001",
    "fault_samples": ["SN001", "SN002"],
    "device_group": "group-a",
    "request_type": "回滚",
    "reason": "连接稳定性问题",
    "applicant": "张三"
}
```

**响应示例 (成功):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "status": "待发布"
    }
}
```

**响应示例 (验证错误):**
```json
{
    "success": false,
    "error": "VALIDATION_ERROR",
    "message": "数据验证失败",
    "details": ["firmware_version 不能为空"],
    "code": 400
}
```

**响应示例 (冲突):**
```json
{
    "success": false,
    "error": "CONFLICT_DETECTED",
    "message": "同一设备组存在相反类型的活跃审批，需要人工介入",
    "conflicts": [...],
    "code": 409
}
```

### 2. 查询审批单列表

```bash
GET /api/approvals
GET /api/approvals?status=待发布
GET /api/approvals?device_group=group-a
```

### 3. 查询审批单详情（含历史）

```bash
GET /api/approvals/:id
```

### 4. 查询审批单历史记录

```bash
GET /api/approvals/:id/history
```

### 5. 更新审批单状态

```bash
PATCH /api/approvals/:id/status
Content-Type: application/json

{
    "status": "灰度中",
    "operator": "李四",
    "comment": "开始灰度发布"
}
```

### 6. 撤回审批单

```bash
POST /api/approvals/:id/recall
Content-Type: application/json

{
    "operator": "张三",
    "comment": "数据需要修正"
}
```

### 7. 重新提交审批单

```bash
POST /api/approvals/:id/resubmit
Content-Type: application/json

{
    "device_model": "SmartLock-X1",
    "firmware_version": "2.3.1",
    "gray_batch": "GB-2024-001-fix",
    "fault_samples": ["SN001", "SN002", "SN003"],
    "device_group": "group-a",
    "request_type": "回滚",
    "reason": "连接稳定性问题 (修正)",
    "applicant": "张三",
    "operator": "张三"
}
```

### 8. 导出 CSV

```bash
GET /api/approvals/export/csv
```

### 9. 健康检查

```bash
GET /api/health
```

## 核心数据字段

| 字段 | 说明 | 示例 |
|------|------|------|
| device_model | 设备型号 | SmartLock-X1 |
| firmware_version | 固件版本 | 2.3.0 |
| gray_batch | 灰度批次 | GB-2024-001 |
| fault_samples | 故障样本 | ["SN001", "SN002"] |
| device_group | 设备组 | group-a |
| request_type | 请求类型 | 升级 / 回滚 |
| status | 状态 | 待发布 / 灰度中 / 暂停 / 回滚完成 / 已撤回 |

## 状态流转图

```
待发布
  ├──→ 灰度中
  │     ├──→ 暂停
  │     │     └──→ 回滚完成
  │     └──→ 回滚完成
  └──→ 已撤回
        └──→ 待发布 (重新提交)
```

## 错误码说明

| HTTP 状态码 | 错误类型 | 说明 |
|------------|---------|------|
| 400 | VALIDATION_ERROR | 数据验证失败，调用方需要补全数据 |
| 404 | NOT_FOUND | 审批单不存在 |
| 409 | DUPLICATE_REQUEST | 灰度批次重复 |
| 409 | CONFLICT_DETECTED | 设备组冲突，需要人工介入 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务器入口
│   ├── database.js        # 数据库操作
│   └── approvalService.js # 业务逻辑
├── data/                  # SQLite 数据目录
├── test-results/          # 测试输出目录
├── test.sh               # 验收测试脚本
├── package.json
└── README.md
```

## 数据库设计

### approvals 表

- id: 审批单唯一标识
- device_model: 设备型号
- firmware_version: 固件版本
- gray_batch: 灰度批次
- fault_samples: 故障样本 (JSON)
- device_group: 设备组
- status: 状态
- request_type: 请求类型
- reason: 原因
- applicant: 申请人
- created_at: 创建时间
- updated_at: 更新时间

### approval_history 表

- id: 历史记录ID
- approval_id: 关联审批单
- status: 变更后状态
- operator: 操作人
- comment: 备注
- changed_fields: 变更字段 (JSON)
- created_at: 操作时间
