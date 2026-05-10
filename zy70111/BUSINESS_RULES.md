# 屠宰检疫证流转服务 - 业务规则文档

## 一、业务背景

### 1.1 问题描述
屠宰检疫证在养殖、运输、市场端流转时，证号经常出现重复使用的问题。这导致：
- 市场端验收时无法确认证号的真实性
- 监管部门无法准确追踪动物流转路径
- 统计数据混乱，无法准确反映实际流通情况

### 1.2 系统目标
- 以**检疫证号**作为系统唯一入口
- 通过**批次绑定**和**运输核销**推进业务流转
- 通过**市场验收**、**作废重开**、**监管导出**提供兜底和复查能力
- 状态被人工修正后，确保后续统计和历史查询不互相矛盾

---

## 二、核心业务流程

### 2.1 标准流转路径
```
已开具 (issued) 
    → 批次绑定 (batch_bound)
    → 运输中 (in_transport)
    → 运输已核销 (transport_verified)
    → 市场已验收 (market_accepted)
```

### 2.2 状态机定义

| 当前状态 | 允许转换到的状态 | 说明 |
|---------|-----------------|------|
| `issued` (已开具) | `batch_bound`, `voided`, `duplicate_detected`, `manually_corrected` | 新录入的证，可绑定批次、作废、或标记重复 |
| `batch_bound` (已绑定批次) | `in_transport`, `issued`, `voided`, `manually_corrected` | 可开始运输、解绑、作废 |
| `in_transport` (运输中) | `transport_verified`, `manually_corrected` | 只能核销或人工修正 |
| `transport_verified` (运输已核销) | `market_accepted`, `manually_corrected` | 只能市场验收或人工修正 |
| `market_accepted` (市场已验收) | `manually_corrected` | 终态，只能人工修正 |
| `voided` (已作废) | `manually_corrected` | 终态，只能人工修正 |
| `manually_corrected` (已人工修正) | `manually_corrected` | 可多次人工修正 |
| `duplicate_detected` (检测到重复) | `issued`, `voided`, `manually_corrected` | 待人工判定后可恢复正常流程 |

### 2.3 证号重复处理流程
```
录入检疫证 → 检测证号是否存在
              ↓ 存在
       标记 hasDuplicate=true
       状态变为 duplicate_detected
              ↓
       创建人工复核任务 (高优先级)
              ↓
       返回 needsReview=true
```

---

## 三、处理成功 vs 需要人工复核

### 3.1 处理成功的标准

#### 3.1.1 检疫证录入
**成功条件：**
- 证号在系统中不存在
- 所有必填字段完整

**返回：**
```json
{
  "success": true,
  "needsReview": false,
  "message": "检疫证录入成功"
}
```

#### 3.1.2 批次绑定
**成功条件：**
- 所有检疫证状态为 `issued` 或 `duplicate_detected`
- 检疫证未绑定到其他批次
- 批次存在且状态正常

**返回：**
```json
{
  "success": true,
  "needsReview": false,
  "message": "成功绑定 N 张检疫证"
}
```

#### 3.1.3 运输创建
**成功条件：**
- 批次存在
- 批次中的检疫证状态为 `batch_bound`

**返回：**
```json
{
  "success": true,
  "needsReview": false,
  "message": "运输创建成功，所有检疫证已进入运输状态"
}
```

#### 3.1.4 运输核销
**成功条件：**
- 运输记录状态为 `in_progress`
- 检疫证状态为 `in_transport`

**返回：**
```json
{
  "success": true,
  "needsReview": false,
  "message": "运输核销成功，共 N 张检疫证"
}
```

#### 3.1.5 市场验收
**成功条件：**
- 检疫证状态为 `transport_verified` 或 `in_transport`
- 证号在系统中仅有一条记录
- 验收数量与证载数量一致
- 检疫证在 7 天有效期内

**返回：**
```json
{
  "success": true,
  "needsReview": false,
  "message": "市场验收完成"
}
```

### 3.2 需要人工复核的场景

#### 3.2.1 场景 1：证号重复
**触发条件：**
- 录入检疫证时，系统检测到相同证号已存在

**复核原因代码：** `DUPLICATE_CERTIFICATE_NUMBER`

**优先级：** 高 (HIGH)

**返回：**
```json
{
  "success": true,
  "needsReview": true,
  "reviewReason": "DUPLICATE_CERTIFICATE_NUMBER",
  "reviewPriority": "high",
  "message": "检疫证录入成功，但检测到证号 [X] 已存在 N 条记录，需要人工复核",
  "warnings": [
    "检测到证号重复，共 N 条记录",
    "已自动创建人工复核任务"
  ]
}
```

**复核工作：**
1. 查看纸质证原件
2. 对比各系统录入时间、来源、开证人
3. 判定哪条记录为有效证
4. 其他记录作废或修正

#### 3.2.2 场景 2：批次包含重复证号
**触发条件：**
- 绑定检疫证到批次时，有检疫证的 `hasDuplicate=true`

**复核原因代码：** `BATCH_CONTAINS_DUPLICATE_CERTS`

**优先级：** 中 (MEDIUM)

**复核建议：**
- 运输前完成复核
- 避免重复证进入市场

#### 3.2.3 场景 3：运输包含重复证号
**触发条件：**
- 创建运输记录时，批次中的检疫证存在重复证号

**复核原因代码：** `TRANSPORT_CONTAINS_DUPLICATE_CERTS`

**优先级：** 高 (HIGH)

**复核建议：**
- 核销前必须完成复核
- 建议暂停运输，直到问题解决

#### 3.2.4 场景 4：市场验收发现重复
**触发条件：**
- 市场验收时，证号有 N 条记录 (N > 1)
- 验收结果为 `needs_review`
- 系统中找不到对应证号

**复核原因代码：**
- `MARKET_INSPECTION_DUPLICATE_CERT`
- `MARKET_INSPECTION_NEEDS_REVIEW`
- `MARKET_INSPECTION_CERT_NOT_FOUND`

**优先级：** 高 (HIGH)

#### 3.2.5 场景 5：市场验收异常警告
**虽然 `needsReview=false`，但仍有警告需要关注：**

| 警告类型 | 说明 | 处理建议 |
|---------|------|---------|
| 超期证 | 检疫证签发超过 7 天 | 确认是否在有效期内使用 |
| 数量不一致 | 验收数量与证载数量不符 | 记录差异原因 |
| 已人工修正 | 该证曾被人工修正 | 查看修正历史和原因 |

---

## 四、人工修正规则

### 4.1 何时需要人工修正
- 证号重复判定后，需要修改状态
- 流程误操作，需要回退
- 数据录入错误，需要更正

### 4.2 人工修正后的一致性保障

#### 4.2.1 历史记录保留
- 每次人工修正都会在 `flow_histories` 表记录
- `isManualCorrection=true` 标记人工操作
- `correctionReason` 记录修正原因
- `snapshot` 保存修正前的数据快照
- `changes` 记录具体变更内容

#### 4.2.2 统计一致性
- 当前统计使用 `certificates` 表的最新状态
- 历史查询使用 `flow_histories` 表的完整时间线
- 两者互不干扰

**统计查询示例：**
```
当前状态统计 → 查询 certificates 表
历史流转查询 → 查询 flow_histories 表
人工修正记录 → 查询 isManualCorrection=true 的记录
```

#### 4.2.3 人工修正后的状态
- 修正后的检疫证状态变为 `manually_corrected`
- `hasManualCorrection=true` 永久标记
- 可通过 `certificates` 表的 `hasManualCorrection` 字段筛选

### 4.3 人工修正记录结构
```json
{
  "certificateNumber": "QZ2024010100001",
  "action": "manual_correction",
  "description": "人工修正: 证号重复，人工确认此证为原始证",
  "previousStatus": "duplicate_detected",
  "newStatus": "issued",
  "isManualCorrection": true,
  "correctionReason": "证号重复，人工确认此证为原始证",
  "changes": {
    "status": { "from": "duplicate_detected", "to": "issued" }
  },
  "snapshot": {
    "status": "duplicate_detected",
    "hasDuplicate": true,
    "farmName": "阳光养殖场"
  },
  "operatorName": "张三",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 五、作废重开规则

### 5.1 作废场景
- 证号重复，判定为无效证
- 录入信息严重错误
- 业务取消

### 5.2 重开规则
- 重开证与原证使用相同证号
- 重开证通过 `originalCertificateId` 关联原证
- 原证通过 `reissuedCertificateId` 关联新证
- 重开证的 `hasDuplicate=true`（因为与原证证号相同）

### 5.3 作废重开后的历史查询
- 查询证号时，返回所有相关记录（包括作废和重开）
- 可通过 `originalCertificateId` 和 `reissuedCertificateId` 追溯重开链

---

## 六、监管导出功能

### 6.1 导出类型
| 类型 | 用途 | 内容 |
|-----|------|------|
| `DAILY_REPORT` | 日常运营 | 检疫证概览、批次统计、市场验收 |
| `DUPLICATE_ANALYSIS` | 重复分析 | 所有重复证号详情、冲突对比、处理状态 |
| `FLOW_HISTORY` | 历史追溯 | 每张证的状态变更时间线、操作人 |
| `REVIEW_SUMMARY` | 复核汇总 | 待处理/已处理任务、按原因分类 |
| `COMPLIANCE_CHECK` | 合规检查 | 超期证、异常流转、人工修正 |

### 6.2 导出文件特点
- **业务导向**：字段为中文，业务人员可直接理解
- **包含说明**：每个 Excel 文件包含"导出说明"页
- **支持筛选**：表头支持自动筛选
- **完整追溯**：包含操作人、操作时间、变更详情

### 6.3 证号重复分析报告字段
```
序号 | 证号 | 本记录ID | 冲突记录ID | 处理状态 | 优先级 | 冲突原因
本证来源 | 本证养殖场 | 本证屠宰场 | 本证动物种类 | 本证数量
本证状态 | 是否人工修正 | 开证人 | 录入时间
检测时间 | 处理人 | 处理时间 | 处理方案 | 冲突详情(JSON)
```

### 6.4 流转历史报告字段
```
序号 | 证号 | 操作类型 | 操作描述
操作前状态 | 操作后状态 | 操作人 | 来源系统
是否人工修正 | 人工修正说明 | 关联业务ID | 关联业务类型
变更详情 | 原始快照 | 操作时间
```

---

## 七、API 统一返回格式

### 7.1 ProcessingResult 结构
```typescript
interface ProcessingResult<T = any> {
  success: boolean;           // 是否成功
  data?: T;                   // 返回数据
  needsReview: boolean;       // 是否需要人工复核
  reviewReason?: string;      // 复核原因代码
  reviewPriority?: string;    // 复核优先级 (high/medium/low)
  message: string;            // 处理消息
  warnings?: string[];        // 警告信息列表
}
```

### 7.2 处理成功返回
```json
{
  "success": true,
  "needsReview": false,
  "message": "操作成功"
}
```

### 7.3 需要复核返回
```json
{
  "success": true,
  "needsReview": true,
  "reviewReason": "DUPLICATE_CERTIFICATE_NUMBER",
  "reviewPriority": "high",
  "message": "检疫证录入成功，但检测到证号重复",
  "warnings": [
    "检测到证号重复",
    "已自动创建复核任务"
  ]
}
```

---

## 八、复核原因代码汇总

| 原因代码 | 含义 | 优先级 | 触发接口 |
|---------|------|--------|---------|
| `DUPLICATE_CERTIFICATE_NUMBER` | 证号重复 | 高 | POST /certificates |
| `BATCH_CONTAINS_DUPLICATE_CERTS` | 批次包含重复证 | 中 | POST /batches/bind |
| `TRANSPORT_CONTAINS_DUPLICATE_CERTS` | 运输包含重复证 | 高 | POST /transports |
| `VERIFIED_WITH_DUPLICATE_CERTS` | 核销包含重复证 | 高 | POST /transports/verify |
| `MARKET_INSPECTION_DUPLICATE_CERT` | 市场验收发现重复 | 高 | POST /market-inspections |
| `MARKET_INSPECTION_NEEDS_REVIEW` | 验收结果需复核 | 高 | POST /market-inspections |
| `MARKET_INSPECTION_CERT_NOT_FOUND` | 系统中找不到证号 | 高 | POST /market-inspections |

---

## 九、日志和历史记录

### 9.1 记录类型

#### 9.1.1 FlowHistory（流转历史）
**用途：** 追踪单张检疫证的状态变更时间线

**记录时机：**
- 检疫证开具
- 批次绑定/解绑
- 运输开始/核销
- 市场验收
- 作废/重开
- 人工修正

**关键字段：**
- `certificateNumber` - 检疫证号（查询入口）
- `action` - 操作类型
- `previousStatus` / `newStatus` - 状态变更
- `isManualCorrection` - 是否人工修正
- `snapshot` - 数据快照

#### 9.1.2 AuditLog（审计日志）
**用途：** 系统级操作审计，追踪所有数据变更

**记录时机：**
- 所有 CRUD 操作
- 状态变更
- 人工修正
- 导出请求

**关键字段：**
- `entityType` - 实体类型
- `entityId` - 实体 ID
- `beforeData` - 变更前数据
- `afterData` - 变更后数据
- `operatorName` - 操作人

### 9.2 查询方式

#### 查询检疫证完整时间线
```
GET /certificates/detail/{certificateNumber}
```

返回内容：
- 当前检疫证信息
- 所有重复证记录
- 完整流转历史（时间线）
- 是否需要复核

#### 查询人工修正历史
```
GET /history/manual-corrections/{certificateId}
```

---

## 十、状态标记说明

### 10.1 Certificate 表关键标记字段
| 字段 | 类型 | 说明 |
|-----|------|------|
| `status` | enum | 当前状态 |
| `hasDuplicate` | boolean | 是否存在证号重复 |
| `hasManualCorrection` | boolean | 是否被人工修正过 |
| `originalCertificateId` | uuid | 原始证 ID（重开证用） |
| `reissuedCertificateId` | uuid | 新证 ID（原证用） |

### 10.2 使用这些标记查询
```typescript
// 查询所有有重复的证
where: { hasDuplicate: true }

// 查询所有被人工修正过的证
where: { hasManualCorrection: true }

// 查询重开证
where: { originalCertificateId: Not(IsNull()) }

// 查询已作废的证
where: { status: 'voided' }
```

---

## 十一、常见问题

### 11.1 证号重复了怎么处理？
1. 系统自动标记 `hasDuplicate=true`
2. 返回 `needsReview=true`，创建复核任务
3. 人工核验纸质证和系统记录
4. 对有效证执行人工修正，恢复正常状态
5. 对无效证执行作废或继续保留标记

### 11.2 人工修正后统计数据会怎样？
- 当前统计：使用修正后的最新状态
- 历史查询：包含完整时间线和修正记录
- 两者通过不同表存储，互不矛盾

### 11.3 导出的数据能直接给业务部门看吗？
可以。导出文件特点：
- 中文字段名
- 业务导向的内容
- 包含使用说明
- 不需要理解代码结构

### 11.4 如何追溯一张证的完整历史？
1. 通过证号查询详情：`GET /certificates/detail/{certificateNumber}`
2. 查看返回的 `flowHistory` 字段
3. 如有 `isManualCorrection=true`，查看 `correctionReason`

---

## 十二、接口总览

### 检疫证管理
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/certificates` | POST | 录入检疫证 |
| `/certificates/detail/{number}` | GET | 查询证号详情（含重复和历史） |
| `/certificates/number/{number}` | GET | 按证号查询所有记录 |
| `/certificates/query` | GET | 分页查询 |
| `/certificates/{id}/manual-correction` | PATCH | 人工修正 |

### 批次管理
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/batches` | POST | 创建批次 |
| `/batches/bind` | POST | 绑定检疫证 |
| `/batches/unbind` | POST | 解绑检疫证 |
| `/batches/{id}` | GET | 查询批次详情 |

### 运输管理
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/transports` | POST | 创建运输记录 |
| `/transports/verify` | POST | 运输核销 |
| `/transports/{id}` | GET | 查询运输详情 |

### 市场验收
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/market-inspections` | POST | 市场验收 |
| `/market-inspections/query` | GET | 查询验收记录 |

### 作废重开
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/void-certificates` | POST | 作废检疫证 |
| `/void-certificates/reissue` | POST | 重开检疫证 |

### 历史查询
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/history/certificate/{number}` | GET | 按证号查流转历史 |
| `/history/manual-corrections/{id}` | GET | 查询人工修正历史 |

### 监管导出
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/exports` | POST | 创建导出任务 |
| `/exports/{id}` | GET | 查询导出任务 |
| `/exports/query` | GET | 分页查询导出任务 |

### 人工复核
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/review-tasks` | POST | 创建复核任务 |
| `/review-tasks/{id}/resolve` | POST | 处理复核任务 |
| `/review-tasks/query` | GET | 查询复核任务列表 |

### 健康检查
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/health` | GET | 系统健康检查和统计 |
