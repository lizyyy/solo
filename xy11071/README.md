# 快递驿站错拿申诉API

## 项目简介

本API服务用于管理快递驿站错拿申诉记录，支持追责和复盘分析。

## 功能特点

- 支持按日期、状态、负责人、门店筛选
- 批量导入时给出行级结果
- 支持家人代取后又申诉的场景检测
- 包含完整真实的快递申诉字段

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务运行在 `http://localhost:3000`

## API接口

### 1. 创建申诉记录

**接口:** `POST /api/appeals`

**请求示例:**
```json
{
  "trackingNumber": "SF1234567890123",
  "recipientName": "张三",
  "recipientPhone": "13800138001",
  "storeId": "ST001",
  "storeName": "幸福花园驿站",
  "pickupCode": "A12-3456",
  "pickupTime": "2026-05-15 14:30:00",
  "pickupPerson": "李四",
  "pickupPersonIdCard": "110101199001011234",
  "pickupPersonPhone": "13900139001",
  "pickupPersonRelation": "朋友",
  "applicantName": "张三",
  "applicantPhone": "13800138001",
  "appealTime": "2026-05-15 18:20:00",
  "appealReason": "未收到包裹",
  "appealDescription": "取件码被他人取走，本人未收到取件通知"
}
```

### 2. 修改申诉记录

**接口:** `PUT /api/appeals/:id`

**请求示例:**
```json
{
  "status": "已完成",
  "handler": "陈晓",
  "handleTime": "2026-05-16 10:00:00",
  "handleRemark": "已找到包裹，确认是家人代取"
}
```

### 3. 查询申诉记录

**接口:** `GET /api/appeals`

**支持筛选参数:**
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)
- `status`: 状态 (正常/驳回/补录/已完成)
- `handler`: 处理人
- `storeId`: 门店ID
- `storeName`: 门店名称

**查询示例:**
```bash
# 查询所有记录
GET /api/appeals

# 按状态筛选
GET /api/appeals?status=已完成

# 按日期范围和门店筛选
GET /api/appeals?startDate=2026-05-10&endDate=2026-05-20&storeId=ST001

# 按处理人筛选
GET /api/appeals?handler=林静
```

**查询单条记录:**
```bash
GET /api/appeals/1
```

**获取状态列表:**
```bash
GET /api/appeals/status
```

### 4. 批量导入

**接口:** `POST /api/appeals/batch-import`

**请求示例:**
```json
{
  "data": [
    {
      "trackingNumber": "YT1111111111111",
      "recipientName": "测试1",
      "recipientPhone": "13800000001",
      "storeId": "ST001",
      "storeName": "幸福花园驿站",
      "pickupCode": "A12-3456",
      "pickupPerson": "家人A",
      "pickupPersonRelation": "家人",
      "applicantName": "测试1",
      "applicantPhone": "13800000001",
      "appealReason": "测试申诉"
    },
    {
      "trackingNumber": "YT2222222222222",
      "recipientName": "测试2",
      "recipientPhone": "13800000002",
      "storeId": "ST001",
      "storeName": "幸福花园驿站",
      "pickupCode": "B07-8901",
      "pickupPerson": "朋友B",
      "pickupPersonRelation": "朋友",
      "applicantName": "测试2",
      "applicantPhone": "13800000002",
      "appealReason": "测试申诉"
    }
  ]
}
```

**返回结果说明:**
- 每行独立处理，不中断整批导入
- 检测到同一取件码有家人代取记录时会给出警告
- 返回每行的成功/失败状态和详细信息

### 5. 导出CSV

**接口:** `GET /api/appeals/export`

**支持与查询相同的筛选参数**

**导出示例:**
```bash
# 导出全部
GET /api/appeals/export

# 按条件导出
GET /api/appeals/export?status=正常&storeId=ST001
```

## 状态说明

- **正常**: 新提交待处理
- **驳回**: 核实后驳回申诉
- **补录**: 需要补充信息
- **已完成**: 申诉处理完成

## 样例数据

系统启动时自动初始化6条样例数据，包含4种状态：

1. **正常** - 张三 SF1234567890123 - 幸福花园驿站
2. **驳回** - 王五 YT9876543210987 - 幸福花园驿站（家人代取）
3. **补录** - 赵六 ZT5678901234567 - 阳光小区驿站
4. **已完成** - 孙七 JD2345678901234 - 阳光小区驿站
5. **正常** - 吴九 EMS678901234567 - 和平家园驿站（家人代取申诉）
6. **补录** - 郑十一 SF3456789012345 - 和平家园驿站

## 健康检查

```bash
GET /health
```
