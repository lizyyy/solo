# 家政派单点保姆试工评价 API

家政派单点保姆试工评价管理系统，支持评价记录的增删改查、批量导入、筛选和导出功能。

## 项目结构

```
.
├── src/
│   ├── index.js              # 应用入口
│   ├── models/
│   │   └── Evaluation.js     # 评价数据模型
│   ├── stores/
│   │   └── EvaluationStore.js # 数据存储层
│   ├── controllers/
│   │   └── EvaluationController.js # 控制器
│   ├── routes/
│   │   └── evaluations.js    # 路由
├── data/
│   ├── sample-data.js        # 样例数据
│   └── evaluations.json      # 数据存储文件
├── exports/                   # 导出文件目录
├── scripts/
│   └── import-sample.js      # 导入样例数据脚本
├── tests/
│   └── run-tests.js          # 测试脚本
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
npm test
```

### 导入样例数据

```bash
npm run import-sample
```

### 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

## API 接口

### 1. 创建评价记录

**接口:** `POST /api/evaluations`

**请求参数:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| orderNo | string | 是 | 订单号 |
| storeId | string | 是 | 门店ID |
| storeName | string | 是 | 门店名称 |
| managerId | string | 否 | 负责人ID |
| managerName | string | 否 | 负责人姓名 |
| auntId | string | 是 | 阿姨ID |
| auntName | string | 是 | 阿姨姓名 |
| auntPhone | string | 否 | 阿姨电话 |
| customerId | string | 是 | 客户ID |
| customerName | string | 是 | 客户姓名 |
| customerPhone | string | 否 | 客户电话 |
| customerAddress | string | 否 | 客户地址 |
| serviceType | string | 否 | 服务类型 |
| trialDate | string | 是 | 试工日期 (YYYY-MM-DD) |
| trialDuration | number | 否 | 试工时长（小时） |
| status | string | 否 | 状态 |
| overallRating | string | 否 | 总体评价 |
| cleanlinessRating | number | 否 | 清洁度评分 (1-5) |
| attitudeRating | number | 否 | 服务态度评分 (1-5) |
| punctualityRating | number | 否 | 守时评分 (1-5) |
| skillRating | number | 否 | 技能评分 (1-5) |
| comment | string | 否 | 评价内容 |
| negativeTags | array | 否 | 负面标签 |
| positiveTags | array | 否 | 正面标签 |
| wouldRecommend | boolean | 否 | 是否推荐 |
| returnVisitRequired | boolean | 否 | 是否需要回访 |
| returnVisitSummary | string | 否 | 回访摘要 |
| returnVisitDate | string | 否 | 回访日期 |
| returnVisitPerson | string | 否 | 回访人 |

**状态枚举:** `待评价`, `已评价`, `已回访`, `已归档`, `异常`

**服务类型枚举:** `日常保洁`, `深度保洁`, `育儿嫂`, `月嫂`, `老人看护`, `钟点工`

**请求示例:**

```bash
curl -X POST http://localhost:3000/api/evaluations \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "HJ20240120001",
    "storeId": "ST001",
    "storeName": "朝阳区家政服务中心",
    "managerId": "MGR001",
    "managerName": "王经理",
    "auntId": "AUNT001",
    "auntName": "李阿姨",
    "auntPhone": "13800138001",
    "customerId": "CUST001",
    "customerName": "张先生",
    "customerPhone": "13900139001",
    "customerAddress": "北京市朝阳区建国路88号",
    "serviceType": "日常保洁",
    "trialDate": "2024-01-20",
    "trialDuration": 4,
    "status": "已评价",
    "overallRating": "非常满意",
    "cleanlinessRating": 5,
    "attitudeRating": 5,
    "punctualityRating": 5,
    "skillRating": 5,
    "comment": "打扫得非常干净，态度很好！",
    "negativeTags": [],
    "positiveTags": ["干净", "准时", "态度好"],
    "wouldRecommend": true,
    "returnVisitRequired": false
  }'
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-generated",
    "orderNo": "HJ20240120001",
    "status": "已评价",
    "createdAt": "2024-01-20T00:00:00.000Z",
    ...
  }
}
```

### 2. 修改评价记录

**接口:** `PUT /api/evaluations/:id`

**请求参数:** 与创建接口相同，所有字段可选

**请求示例:**

```bash
curl -X PUT http://localhost:3000/api/evaluations/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "已回访",
    "returnVisitSummary": "已致电客户确认满意度",
    "returnVisitDate": "2024-01-21",
    "returnVisitPerson": "王经理"
  }'
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-generated",
    "status": "已回访",
    "returnVisitSummary": "已致电客户确认满意度",
    ...
  }
}
```

### 3. 查询评价记录

#### 3.1 获取单条记录

**接口:** `GET /api/evaluations/:id`

**请求示例:**

```bash
curl http://localhost:3000/api/evaluations/{id}
```

#### 3.2 获取列表（支持筛选）

**接口:** `GET /api/evaluations`

**查询参数:**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| startDate | string | 开始日期 (YYYY-MM-DD) |
| endDate | string | 结束日期 (YYYY-MM-DD) |
| status | string | 状态 |
| managerId | string | 负责人ID |
| storeId | string | 门店ID |
| auntId | string | 阿姨ID |
| customerId | string | 客户ID |
| serviceType | string | 服务类型 |

**请求示例:**

```bash
# 获取所有记录
curl http://localhost:3000/api/evaluations

# 按状态筛选
curl "http://localhost:3000/api/evaluations?status=已评价"

# 按日期范围筛选
curl "http://localhost:3000/api/evaluations?startDate=2024-01-01&endDate=2024-01-31"

# 按门店筛选
curl "http://localhost:3000/api/evaluations?storeId=ST001"

# 组合筛选
curl "http://localhost:3000/api/evaluations?status=已评价&storeId=ST001&startDate=2024-01-01"
```

**响应示例:**

```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "id": "...",
      "orderNo": "HJ202401150001",
      "storeName": "朝阳区家政服务中心",
      "auntName": "李阿姨",
      "status": "已评价",
      ...
    },
    ...
  ]
}
```

### 4. 导出评价记录

**接口:** `GET /api/evaluations/export`

**查询参数:** 与列表接口相同，支持筛选

**请求示例:**

```bash
# 导出所有记录
curl http://localhost:3000/api/evaluations/export

# 导出指定门店的记录
curl "http://localhost:3000/api/evaluations/export?storeId=ST001"
```

**响应示例:**

```json
{
  "success": true,
  "message": "导出成功",
  "fileName": "evaluations_2024-01-20_1705737600000.csv",
  "filePath": "/path/to/exports/evaluations_2024-01-20_1705737600000.csv",
  "count": 5
}
```

### 5. 批量导入

**接口:** `POST /api/evaluations/batch-import`

**请求参数:**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| items | array | 是 | 评价记录数组 |

**说明:**
- 批量导入时，单条记录失败不会中断整体导入
- 返回结果包含每行的导入状态和错误信息
- 重复订单号会被拒绝导入

**请求示例:**

```bash
curl -X POST http://localhost:3000/api/evaluations/batch-import \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "orderNo": "BATCH001",
        "storeId": "ST001",
        "storeName": "朝阳区家政服务中心",
        "auntId": "AUNT001",
        "auntName": "李阿姨",
        "customerId": "CUST001",
        "customerName": "张先生",
        "trialDate": "2024-01-20"
      },
      {
        "orderNo": "",
        "storeId": "ST001",
        "storeName": "朝阳区家政服务中心",
        "auntId": "AUNT001",
        "auntName": "李阿姨",
        "customerId": "CUST001",
        "customerName": "张先生",
        "trialDate": "2024-01-21"
      }
    ]
  }'
```

**响应示例:**

```json
{
  "success": true,
  "total": 2,
  "success": 1,
  "fail": 1,
  "results": [
    {
      "row": 1,
      "success": true,
      "orderNo": "BATCH001",
      "id": "uuid-generated"
    },
    {
      "row": 2,
      "success": false,
      "orderNo": "",
      "errors": ["订单号不能为空"]
    }
  ]
}
```

### 6. 删除评价记录

**接口:** `DELETE /api/evaluations/:id`

**请求示例:**

```bash
curl -X DELETE http://localhost:3000/api/evaluations/{id}
```

### 7. 获取枚举值

**接口:** `GET /api/evaluations/enums`

**请求示例:**

```bash
curl http://localhost:3000/api/evaluations/enums
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "statuses": ["待评价", "已评价", "已回访", "已归档", "异常"],
    "ratings": ["非常满意", "满意", "一般", "不满意", "非常不满意"],
    "serviceTypes": ["日常保洁", "深度保洁", "育儿嫂", "月嫂", "老人看护", "钟点工"]
  }
}
```

## 样例数据说明

项目包含5条真实的家政派单点保姆试工评价样例数据，涵盖：

1. **HJ202401150001** - 非常满意的日常保洁评价
2. **HJ202401160002** - 不满意的育儿嫂评价（已回访处理）
3. **HJ202401170003** - 待评价的深度保洁
4. **HJ202401180004** - 满意的日常保洁评价
5. **HJ202401190005** - 非常满意的月嫂评价（已归档）

每条数据包含完整的字段信息，包括：
- 门店和负责人信息
- 阿姨和客户的详细信息
- 各项评分（清洁度、服务态度、守时、技能）
- 正负标签
- 回访记录等

## 核心特性

1. **多条件筛选** - 支持按日期、状态、负责人、门店、阿姨、客户、服务类型等多种条件组合筛选

2. **批量导入容错** - 单条记录失败不中断整体导入，返回详细的行级结果和错误信息

3. **完整字段支持** - 包含家政派单点保姆试工评价的所有真实业务字段

4. **CSV导出** - 支持按筛选条件导出为CSV格式

5. **自动化测试** - 一条命令运行所有测试，失败时显示具体规则和错误信息

## 运行测试

```bash
npm test
```

测试覆盖以下场景：

1. 数据模型 - 必填字段验证
2. 数据模型 - 状态枚举验证
3. 数据存储 - 创建评价记录
4. 数据存储 - 根据ID查询
5. 数据存储 - 根据订单号查询
6. 数据存储 - 更新评价记录
7. 筛选功能 - 按状态筛选
8. 筛选功能 - 按日期范围筛选
9. 筛选功能 - 按门店筛选
10. 批量导入 - 正常数据导入
11. 批量导入 - 部分失败不中断
12. 批量导入 - 重复订单号处理
13. 批量导入 - 返回行级结果
14. 数据存储 - 删除评价记录
15. 枚举值验证 - 状态枚举
16. 枚举值验证 - 服务类型
