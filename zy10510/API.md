# 字段口径仲裁 API

用于解决业务字段在不同报表中含义不一致的问题，支持仲裁流程管理。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

服务器默认运行在 `http://localhost:3000`

## API 接口

### 1. 创建仲裁记录

**POST** `/api/arbitration`

创建新的字段口径仲裁记录。

**请求体：**
```json
{
  "fieldName": "订单金额",
  "sourceReports": [
    {
      "reportName": "销售日报",
      "calculation": "sum(订单表.金额)",
      "description": "按天汇总"
    },
    {
      "reportName": "财务月报",
      "calculation": "sum(财务表.实收金额)",
      "description": "按月汇总"
    }
  ],
  "disputeDescription": "两个报表统计口径不一致，销售日报包含未回款订单，财务月报只统计已回款",
  "createdBy": "张三",
  "rawInput": {
    "screenshotUrl": "https://example.com/screenshot.png",
    "meetingNotes": "产品评审会议记录..."
  }
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fieldName": "订单金额",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z",
    ...
  }
}
```

### 2. 查询单条记录

**GET** `/api/arbitration/:id`

根据 ID 查询仲裁记录详情。

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fieldName": "订单金额",
    "sourceReports": [...],
    "disputeDescription": "...",
    "status": "pending",
    "history": [...],
    "corrections": []
  }
}
```

### 3. 查询列表（支持分页和筛选）

**GET** `/api/arbitration`

查询仲裁记录列表，支持分页和筛选。

**查询参数：**
- `fieldName`: 按字段名模糊搜索
- `status`: 按状态筛选 (pending/in_review/arbitrated/effective/rejected)
- `createdBy`: 按创建人搜索
- `page`: 页码 (默认 1)
- `pageSize`: 每页数量 (默认 10, 最大 100)

**响应：**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 4. 更新状态（状态推进）

**PATCH** `/api/arbitration/:id/status`

推进仲裁流程状态，重复提交相同状态不会重复添加历史记录。

**请求体：**
```json
{
  "status": "arbitrated",
  "updatedBy": "仲裁委员会",
  "remark": "经讨论达成一致",
  "arbitrationOpinion": "统一采用财务口径，只统计已回款金额",
  "effectiveVersion": "v2.1.0",
  "handlingBasis": "财务会计准则第123条"
}
```

**状态流转：**
- `pending` → 待处理
- `in_review` → 审核中
- `arbitrated` → 已仲裁
- `effective` → 已生效
- `rejected` → 已拒绝

### 5. 人工修正

**PATCH** `/api/arbitration/:id/correction`

修正仲裁记录中的字段内容，保留修正历史。

**请求体：**
```json
{
  "field": "disputeDescription",
  "newValue": "修正后的争议描述...",
  "reason": "补充遗漏的业务场景",
  "correctedBy": "数据管理员"
}
```

**支持修正的字段：**
- `fieldName`
- `disputeDescription`
- `arbitrationOpinion`
- `effectiveVersion`

### 6. 导出 CSV

**GET** `/api/arbitration/export`

导出所有仲裁记录为 CSV 文件。

### 7. 统计信息

**GET** `/api/arbitration/stats`

获取仲裁记录统计信息。

**响应：**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "byStatus": {
      "pending": 5,
      "in_review": 3,
      "arbitrated": 5,
      "effective": 2
    }
  }
}
```

## 核心特性

1. **完整的状态流转机制**：支持从待处理到生效的完整流程
2. **历史记录追踪**：所有状态变更和人工修正都保留完整历史
3. **原始输入保留**：异常路径保留原始输入和处理依据
4. **幂等性保证**：重复提交相同状态不会产生重复历史记录
5. **参数校验**：所有接口都有完整的参数验证
6. **CSV 导出**：支持批量导出数据

## 数据模型

```typescript
interface ArbitrationRecord {
  id: string;
  fieldName: string;                    // 字段名
  sourceReports: ReportCaliber[];       // 来源报表口径
  disputeDescription: string;           // 争议说明
  arbitrationOpinion?: string;          // 仲裁意见
  effectiveVersion?: string;            // 生效版本
  status: ArbitrationStatus;            // 状态
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  arbitratedBy?: string;
  history: StatusHistory[];             // 状态历史
  rawInput: any;                        // 原始输入
  handlingBasis?: string;               // 处理依据
  corrections: Correction[];            // 人工修正记录
}
```
