# 企业班车队班车临时加站 API

本项目提供企业班车队班车临时加站的完整管理功能，支持创建、修改、查询、批量导入、复核和导出功能。

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

---

## API 接口

### 1. 创建临时加站

**接口地址**: `POST /api/stops`

**请求示例**:

```bash
curl -X POST http://localhost:3000/api/stops \
  -H "Content-Type: application/json" \
  -d '{
    "lineId": "L001",
    "lineName": "张江线",
    "stopName": "龙阳路地铁站",
    "stopAddress": "上海市浦东新区龙阳路地铁站3号口",
    "scheduledDate": "2026-05-25",
    "scheduledTime": "08:30",
    "direction": "上班",
    "applicantName": "周八",
    "applicantPhone": "13500135006",
    "applicantDepartment": "测试部",
    "storeId": "S001",
    "storeName": "上海总部",
    "managerId": "M001",
    "managerName": "陈明",
    "passengerCount": 10,
    "reason": "测试团队新增员工通勤需求"
  }'
```

**响应示例**:

```json
{
  "success": true,
  "message": "创建成功",
  "capacityWarning": {
    "overCapacity": false,
    "currentPassengers": 20,
    "newPassengers": 10,
    "totalPassengers": 30,
    "capacity": 45,
    "lineName": "张江线"
  },
  "data": {
    "id": "TS006",
    "lineId": "L001",
    "stopName": "龙阳路地铁站",
    "status": "待复核",
    "createdAt": "2026-05-18T..."
  }
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lineId | string | 是 | 班线ID |
| lineName | string | 是 | 班线名称 |
| stopName | string | 是 | 站点名称 |
| stopAddress | string | 是 | 站点地址 |
| scheduledDate | string | 是 | 日期 (YYYY-MM-DD) |
| scheduledTime | string | 是 | 时间 (HH:mm) |
| direction | string | 是 | 方向：上班/下班 |
| applicantName | string | 是 | 申请人姓名 |
| applicantPhone | string | 是 | 申请人电话 |
| applicantDepartment | string | 是 | 申请部门 |
| storeId | string | 是 | 门店ID |
| storeName | string | 是 | 门店名称 |
| managerId | string | 是 | 负责人ID |
| managerName | string | 是 | 负责人姓名 |
| passengerCount | number | 是 | 乘客人数 |
| reason | string | 是 | 申请原因 |

---

### 2. 修改临时加站

**接口地址**: `PUT /api/stops/:id`

**请求示例**:

```bash
curl -X PUT http://localhost:3000/api/stops/TS001 \
  -H "Content-Type: application/json" \
  -d '{
    "passengerCount": 15,
    "reason": "人数调整，新项目组加入"
  }'
```

**响应示例**:

```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "id": "TS001",
    "passengerCount": 15,
    "reason": "人数调整，新项目组加入"
  }
}
```

**可修改字段**:

- stopName
- stopAddress
- scheduledDate
- scheduledTime
- direction
- passengerCount
- reason
- remark

---

### 3. 查询临时加站

#### 3.1 查询列表（支持多条件筛选）

**接口地址**: `GET /api/stops`

**查询参数**:

| 参数 | 说明 | 示例 |
|------|------|------|
| date | 按日期筛选 | 2026-05-20 |
| status | 按状态筛选 | 待复核 |
| managerName | 按负责人筛选 | 陈明 |
| storeName | 按门店筛选 | 上海总部 |
| lineId | 按班线ID筛选 | L001 |
| keyword | 关键词搜索（站点/申请人/原因） | 地铁 |

**请求示例**:

```bash
# 查询所有记录
curl http://localhost:3000/api/stops

# 按日期筛选
curl "http://localhost:3000/api/stops?date=2026-05-20"

# 按状态和负责人组合筛选
curl "http://localhost:3000/api/stops?status=待复核&managerName=陈明"

# 关键词搜索
curl "http://localhost:3000/api/stops?keyword=地铁"
```

**响应示例**:

```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "id": "TS001",
      "lineId": "L001",
      "lineName": "张江线",
      "stopName": "金科路地铁站",
      "status": "待复核",
      "managerName": "陈明",
      "storeName": "上海总部"
    }
  ]
}
```

#### 3.2 查询单条详情

**接口地址**: `GET /api/stops/:id`

**请求示例**:

```bash
curl http://localhost:3000/api/stops/TS001
```

---

### 4. 复核临时加站

**接口地址**: `POST /api/stops/:id/review`

**状态值**: 待复核、已通过、已拒绝、已取消

**请求示例**:

```bash
curl -X POST http://localhost:3000/api/stops/TS001/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "已通过",
    "reviewer": "王总",
    "remark": "情况属实，同意加站"
  }'
```

---

### 5. 批量导入临时加站

**接口地址**: `POST /api/stops/batch-import`

**特性**:
- 超座时系统仍会通过，并给出警告
- 单条记录错误不会中断整批导入
- 返回行级结果，包含成功/失败详情

**请求示例**:

```bash
curl -X POST http://localhost:3000/api/stops/batch-import \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "lineId": "L001",
        "lineName": "张江线",
        "stopName": "世纪公园站",
        "stopAddress": "上海市浦东新区世纪公园",
        "scheduledDate": "2026-05-26",
        "scheduledTime": "08:00",
        "direction": "上班",
        "applicantName": "吴九",
        "applicantPhone": "13500135007",
        "applicantDepartment": "运维部",
        "storeId": "S001",
        "storeName": "上海总部",
        "managerId": "M001",
        "managerName": "陈明",
        "passengerCount": 50,
        "reason": "运维团队集中通勤"
      },
      {
        "lineId": "L002",
        "lineName": "漕河泾线",
        "stopName": "虹梅路站",
        "stopAddress": "上海市徐汇区虹梅路",
        "scheduledDate": "2026-05-26",
        "scheduledTime": "08:15",
        "direction": "上班",
        "applicantName": "郑十",
        "applicantPhone": "13500135008",
        "applicantDepartment": "客服部",
        "storeId": "S002",
        "storeName": "漕河泾分店",
        "managerId": "M002",
        "managerName": "刘丽",
        "passengerCount": 8,
        "reason": "客服团队新员工"
      }
    ]
  }'
```

**响应示例**:

```json
{
  "success": true,
  "message": "批量导入完成，成功 2 条，失败 0 条",
  "summary": {
    "total": 2,
    "success": 2,
    "fail": 0
  },
  "results": [
    {
      "row": 1,
      "success": true,
      "message": "导入成功，但加站后该班次可能超座",
      "capacityWarning": {
        "overCapacity": true,
        "totalPassengers": 70,
        "capacity": 45
      }
    },
    {
      "row": 2,
      "success": true,
      "message": "导入成功"
    }
  ]
}
```

---

### 6. 导出 CSV

**接口地址**: `GET /api/stops/export/csv`

**支持筛选参数**（与查询列表相同）:
- date
- status
- managerName
- storeName

**请求示例**:

```bash
# 导出全部
curl -O http://localhost:3000/api/stops/export/csv

# 按条件导出
curl -O "http://localhost:3000/api/stops/export/csv?status=已通过&date=2026-05-20"
```

**导出字段**:
- 申请编号
- 班线名称
- 站点名称
- 站点地址
- 日期
- 时间
- 方向
- 申请人
- 申请人电话
- 申请部门
- 所属门店
- 负责人
- 乘客人数
- 申请原因
- 状态
- 备注
- 创建时间
- 复核时间
- 复核人

---

### 7. 删除临时加站

**接口地址**: `DELETE /api/stops/:id`

**请求示例**:

```bash
curl -X DELETE http://localhost:3000/api/stops/TS001
```

---

## 辅助接口

### 获取班线列表

```bash
curl http://localhost:3000/api/lines
```

### 获取状态枚举

```bash
curl http://localhost:3000/api/status
```

---

## 样例数据说明

系统已预置 5 条样例数据，包含真实业务场景：

| 编号 | 班线 | 站点 | 日期 | 状态 | 负责人 | 门店 |
|------|------|------|------|------|--------|------|
| TS001 | 张江线 | 金科路地铁站 | 2026-05-20 | 待复核 | 陈明 | 上海总部 |
| TS002 | 张江线 | 广兰路地铁站 | 2026-05-20 | 已通过 | 陈明 | 上海总部 |
| TS003 | 漕河泾线 | 漕河泾开发区站 | 2026-05-21 | 已拒绝 | 刘丽 | 漕河泾分店 |
| TS004 | 莘庄线 | 莘庄地铁站北广场 | 2026-05-22 | 已通过 | 周伟 | 莘庄分店 |
| TS005 | 嘉定线 | 嘉定新城站 | 2026-05-23 | 待复核 | 周伟 | 嘉定分店 |

---

## 错误响应说明

所有错误响应均包含清晰的中文错误信息，不会仅返回 500 错误：

```json
{
  "success": false,
  "message": "数据验证失败",
  "errors": ["缺少必填字段: stopName", "乘客人数必须为大于0的数字"]
}
```

```json
{
  "success": false,
  "message": "未找到该临时加站记录"
}
```

---

## 项目结构

```
.
├── server.js          # 主服务文件
├── package.json       # 项目配置
├── data/
│   ├── models.js      # 数据模型和常量
│   └── sampleData.js  # 样例数据和数据操作
└── README.md          # 本文档
```
