# 物流干线异常扣罚 API 服务

## 项目概述

物流干线异常扣罚 API 服务，用于物流调度提交异常扣罚材料，系统自动处理并记录完整的处理轨迹。

## 技术栈

- **运行时**: Node.js + TypeScript
- **Web框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT (jsonwebtoken)
- **密码加密**: bcryptjs
- **文件上传**: multer
- **数据导出**: csv-writer

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run seed
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

服务默认运行在 `http://localhost:3000`

### 4. 默认账号

| 用户名 | 密码 | 角色 | 姓名 |
|--------|------|------|------|
| admin | 123456 | admin | 系统管理员 |
| operator1 | 123456 | operator | 调度员张三 |
| operator2 | 123456 | operator | 调度员李四 |
| auditor1 | 123456 | auditor | 审计员王五 |

## API 接口

### 认证接口

#### 登录
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```

#### 获取当前用户信息
```
GET /api/auth/me
Authorization: Bearer {token}
```

#### 修改密码
```
POST /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "old_password": "123456",
  "new_password": "654321"
}
```

### 批次管理

#### 创建批次（自动去重）
```
POST /api/batches
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "2024年5月异常扣罚批次",
  "description": "华东区域干线异常扣罚",
  "materials": [
    {
      "material_type": "exception_report",
      "waybill_no": "WD202405270001",
      "content": "运单晚点2小时"
    },
    {
      "material_type": "photo_evidence",
      "waybill_no": "WD202405270001",
      "content": "破损照片"
    }
  ]
}
```

**重要说明**: 系统会根据 materials 内容计算哈希值，如果相同材料重复提交，会自动识别并返回原有处理结果，不会重复创建。

#### 查询批次列表
```
GET /api/batches?page=1&page_size=20&status=pending&keyword=2024
Authorization: Bearer {token}
```

#### 查询批次详情
```
GET /api/batches/{id}
Authorization: Bearer {token}
```

#### 更新批次
```
PUT /api/batches/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "更新后的批次名称",
  "status": "processing"
}
```

### 材料管理

#### 文件上传
```
POST /api/materials/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

batch_id: 1
material_type: photo_evidence
waybill_no: WD202405270001
file: [选择文件]
```

#### 登记材料内容
```
POST /api/materials/register
Authorization: Bearer {token}
Content-Type: application/json

{
  "batch_id": 1,
  "material_type": "exception_report",
  "waybill_no": "WD202405270002",
  "content": "货物破损，包装损坏"
}
```

#### 查询材料列表
```
GET /api/materials?batch_id=1
Authorization: Bearer {token}
```

#### 删除材料
```
DELETE /api/materials/{id}
Authorization: Bearer {token}
```

### 扣罚明细管理

#### 创建扣罚明细
```
POST /api/deduction-details
Authorization: Bearer {token}
Content-Type: application/json

{
  "batch_id": 1,
  "waybill_no": "WD202405270001",
  "exception_type": "delay",
  "exception_time": 1716768000,
  "from_city": "上海",
  "to_city": "北京",
  "carrier": "顺丰速运",
  "vehicle_no": "京A12345",
  "driver": "张师傅",
  "original_amount": 5000,
  "deduction_amount": 500,
  "responsible_party": "承运商"
}
```

**异常类型**:
- `delay`: 干线晚点
- `damage`: 破损
- `transit_responsibility`: 中转责任

#### 查询扣罚明细列表
```
GET /api/deduction-details?page=1&page_size=20&batch_id=1&status=pending&exception_type=delay
Authorization: Bearer {token}
```

#### 查询扣罚明细详情
```
GET /api/deduction-details/{id}
Authorization: Bearer {token}
```

#### 处理扣罚明细（多单核对）
```
PUT /api/deduction-details/{id}/process
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "confirmed",
  "conclusion": "经核实，确实晚点2小时，扣罚500元",
  "deduction_amount": 500,
  "responsible_party": "承运商",
  "change_reason": "核对调度单和GPS轨迹后确认",
  "matched_items": [
    {
      "source_type": "dispatch_note",
      "source_waybill_no": "DD20240527001",
      "source_data": {"scheduled_arrival": "2024-05-27 10:00", "actual_arrival": "2024-05-27 12:00"},
      "matched_amount": 500
    },
    {
      "source_type": "gps_track",
      "source_waybill_no": "GPS20240527001",
      "source_data": {"delay_minutes": 120},
      "matched_amount": 0
    }
  ]
}
```

**状态**:
- `pending`: 待处理
- `processing`: 处理中
- `confirmed`: 已确认
- `rejected`: 已驳回
- `appealed`: 已申诉
- `archived`: 已归档

#### 删除扣罚明细
```
DELETE /api/deduction-details/{id}
Authorization: Bearer {token}
```

### 归档流程

#### 归档整个批次
```
POST /api/archive/batch/{batchId}
Authorization: Bearer {token}
```

**注意**: 批次下所有扣罚明细必须是已确认或已驳回状态才能归档。

#### 归档单条明细
```
POST /api/archive/detail/{detailId}
Authorization: Bearer {token}
```

### 审计日志（处理轨迹）

#### 查询单条明细的处理轨迹
```
GET /api/audit/detail/{detailId}?page=1&page_size=50
Authorization: Bearer {token}
```

#### 查询批次的所有操作日志
```
GET /api/audit/batch/{batchId}?page=1&page_size=50
Authorization: Bearer {token}
```

#### 查询所有审计日志
```
GET /api/audit?page=1&page_size=50&action=update&operator_name=张三
Authorization: Bearer {token}
```

**操作类型**:
- `create`: 创建
- `update`: 更新
- `reconcile`: 核对
- `archive`: 归档

### 数据导出

#### 导出CSV
```
GET /api/export/csv?batch_id=1&status=confirmed&exception_type=delay
Authorization: Bearer {token}
```

导出字段包含：
- 批次号、批次名称
- 明细编号、运单号
- 异常类型（干线晚点/破损/中转责任）
- 异常时间、出发/到达城市
- 承运商、车牌号、司机
- 原始金额、扣罚金额、责任方
- 状态、处理结论
- 核对运单（从多张单里核对）
- 创建人、最后处理人
- 创建时间、处理时间

#### 查询统计数据
```
GET /api/export/statistics?batch_id=1
Authorization: Bearer {token}
```

## 核心特性

### 1. 材料去重机制
系统通过对提交的材料内容计算 SHA256 哈希值实现自动去重。如果相同材料重复提交，系统会：
- 返回 `duplicate: true` 标识
- 返回原有批次信息和处理结果
- 不会创建新的记录

### 2. 多单核对
每条扣罚明细可以关联多张来源单据（调度单、GPS轨迹、照片等），系统会记录：
- 来源类型
- 来源单号
- 来源数据（JSON格式）
- 匹配金额

### 3. 完整审计轨迹
系统记录所有操作的完整审计日志，包括：
- 操作人
- 操作时间
- 操作类型
- 修改的字段
- 修改前的值
- 修改后的值
- 修改原因

复盘时可以追溯谁改过结论、为什么改、改动前是什么。

### 4. 数据一致性
导出的CSV数据与查询接口的统计数据完全一致，确保：
- 干线晚点、破损、中转责任分类准确
- 多单核对信息完整
- 最后处理人信息准确

## 数据库表结构

### users (用户表)
- id, username, password_hash, real_name, role, created_at, updated_at

### batches (批次表)
- id, batch_no, material_hash (唯一索引), name, description, status, created_by, created_at, updated_at, archived_at, archived_by

### materials (材料表)
- id, batch_id, material_type, waybill_no, file_name, file_path, file_size, content, uploaded_by, created_at

### deduction_details (扣罚明细表)
- id, batch_id, detail_no, waybill_no, exception_type, exception_time, from_city, to_city, carrier, vehicle_no, driver, original_amount, deduction_amount, responsible_party, status, conclusion, handled_by, handled_at, final_handler_id, final_handler_name, created_by, created_at, updated_at

### reconciliation_items (核对关联表)
- id, deduction_detail_id, source_type, source_waybill_no, source_data, matched_amount, created_at

### audit_logs (审计日志表)
- id, deduction_detail_id, batch_id, operator_id, operator_name, action, field_name, old_value, new_value, change_reason, created_at
