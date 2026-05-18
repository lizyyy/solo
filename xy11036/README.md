# 心理咨询室咨询改约回访 API

## 项目简介
本服务提供心理咨询室咨询改约回访的完整管理功能，支持回访记录的创建、修改、查询、导出及批量导入。

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 启动服务
```bash
npm start
```

服务将在 http://localhost:3000 启动（如端口被占用，可使用 PORT=3002 npm start）

---

## API 接口

### 1. 创建回访记录

**接口**: `POST /api/followup`

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/followup \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "测试来访者",
    "client_phone": "13800000000",
    "original_appointment_date": "2024-05-20",
    "original_appointment_time": "14:00",
    "counselor_name": "李医生",
    "store_name": "北京朝阳店",
    "reschedule_count": 1,
    "reschedule_reason": "临时有工作安排",
    "assignee": "张助理"
  }'
```

**响应**: 返回创建的回访记录

---

### 2. 修改回访记录

**接口**: `PUT /api/followup/:id`

**请求示例**:
```bash
curl -X PUT http://localhost:3000/api/followup/1 \
  -H "Content-Type: application/json" \
  -d '{
    "followup_status": "completed",
    "followup_result": "已确认新的预约时间",
    "followup_date": "2024-05-18",
    "followup_note": "来访者同意改约至5月22日上午10点",
    "next_appointment_date": "2024-05-22",
    "next_appointment_time": "10:00"
  }'
```

**响应**: 返回更新后的回访记录

---

### 3. 查询回访记录列表

**接口**: `GET /api/followup`

**支持的筛选参数**:
- `start_date`: 原预约开始日期
- `end_date`: 原预约结束日期
- `followup_status`: 回访状态 (pending/completed/cancelled)
- `assignee`: 负责人（模糊匹配）
- `store_name`: 门店名称（模糊匹配）
- `page`: 页码，默认1
- `page_size`: 每页条数，默认20

**请求示例**:

查询所有待回访记录
```bash
curl "http://localhost:3000/api/followup"
```

按日期范围筛选
```bash
curl "http://localhost:3000/api/followup?start_date=2024-05-01&end_date=2024-05-31"
```

按状态和负责人筛选
```bash
curl "http://localhost:3000/api/followup?followup_status=pending&assignee=张助理"
```

按门店筛选
```bash
curl "http://localhost:3000/api/followup?store_name=北京朝阳店"
```

**响应示例**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 3,
    "total_pages": 1
  }
}
```

---

### 4. 导出 CSV

**接口**: `GET /api/followup/export/csv`

**支持与列表相同的筛选参数**

**请求示例**:
```bash
curl "http://localhost:3000/api/followup/export/csv" -o followup_records.csv
```

导出指定日期范围的数据
```bash
curl "http://localhost:3000/api/followup/export/csv?start_date=2024-05-01&end_date=2024-05-31" -o followup_may.csv
```

---

### 5. 批量导入

**接口**: `POST /api/followup/batch-import`

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/followup/batch-import \
  -H "Content-Type: application/json" \
  -d '[
    {
      "client_name": "来访者A",
      "client_phone": "13900000001",
      "original_appointment_date": "2024-05-20",
      "original_appointment_time": "09:00",
      "counselor_name": "李医生",
      "store_name": "北京朝阳店",
      "reschedule_count": 1,
      "reschedule_reason": "个人原因",
      "assignee": "张助理"
    },
    {
      "client_name": "来访者B",
      "client_phone": "13900000002",
      "original_appointment_date": "2024-05-21",
      "original_appointment_time": "10:00",
      "counselor_name": "王医生",
      "store_name": "北京朝阳店",
      "reschedule_count": 3,
      "reschedule_reason": "多次改约",
      "assignee": "李助理"
    },
    {
      "client_name": "来访者C",
      "client_phone": "13900000003",
      "original_appointment_date": "2024-05-22",
      "original_appointment_time": "14:00",
      "counselor_name": "张医生",
      "store_name": "上海静安店",
      "reschedule_count": 0,
      "assignee": "王助理"
    }
  ]'
```

**响应示例**:
```json
{
  "total": 3,
  "success": 2,
  "failed": 1,
  "results": [
    { "index": 0, "success": true, "id": 4, "followup_no": "FU-20240518-001" },
    { "index": 1, "success": false, "error": "改约次数超过限制（最多3次）", "data": {...} },
    { "index": 2, "success": true, "id": 5, "followup_no": "FU-20240518-002" }
  ]
}
```

注意：批量导入采用行级处理，单条记录失败不会影响其他记录的导入。

---

## 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| followup_no | 回访编号 | FU-20240501-001 |
| client_name | 来访者姓名 | 张明 |
| client_phone | 来访者电话 | 13600136001 |
| original_appointment_date | 原预约日期 | 2024-05-10 |
| original_appointment_time | 原预约时间 | 14:00 |
| counselor_name | 咨询师姓名 | 李医生 |
| store_name | 门店名称 | 北京朝阳店 |
| reschedule_count | 改约次数 | 1 |
| reschedule_reason | 改约原因 | 临时有工作安排 |
| followup_status | 回访状态 | pending/completed/cancelled |
| followup_result | 回访结果 | 已确认新的预约时间 |
| followup_date | 回访日期 | 2024-05-18 |
| followup_note | 回访备注 | 来访者同意改约 |
| next_appointment_date | 下次预约日期 | 2024-05-22 |
| next_appointment_time | 下次预约时间 | 10:00 |
| assignee | 负责人 | 张助理 |

---

## 运行测试

```bash
npm test
```

## 配置说明

在 `src/config.js` 中可以配置:
- `PORT`: 服务端口
- `MAX_RESCHEDULE_TIMES`: 最大改约次数
- `RESCHEDULE_HOURS_BEFORE`: 改约需提前的小时数
