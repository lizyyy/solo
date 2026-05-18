# 乐器培训班乐器借琴押金 API

一个简单但功能完整的乐器借琴押金管理系统，专注于记录状态和保存证据。

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化样例数据

```bash
node init_data.js
```

### 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

---

## 1. 创建押金记录

### 单条创建

**接口**: `POST /api/deposits`

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/deposits \
  -H "Content-Type: application/json" \
  -d '{
    "student_name": "陈小明",
    "student_phone": "13100131009",
    "instrument_type": "长笛",
    "instrument_brand": "雅马哈",
    "instrument_model": "YFL-222",
    "instrument_serial": "F2024001",
    "deposit_amount": 1800.00,
    "rental_start_date": "2024-05-01",
    "expected_return_date": "2024-06-01",
    "store": "朝阳门店",
    "manager": "李老师",
    "string_condition": "全新",
    "body_condition": "完好",
    "notes": "小学管乐队成员"
  }'
```

**示例响应**:
```json
{
  "id": 9,
  "deposit_no": "DP1716000000000"
}
```

### 批量导入

**接口**: `POST /api/deposits/batch`

**说明**: 
- 支持 CSV 格式文件批量导入
- 行级结果处理，单条失败不中断整批导入
- 自动处理琴弦损耗(normal_wear)和人为损坏(human_damage)的界定

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/deposits/batch \
  -F "file=@sample_data.csv"
```

**示例响应**:
```json
{
  "total": 8,
  "success": 8,
  "failed": 0,
  "results": [
    {
      "row": 1,
      "success": true,
      "deposit_no": "DP1716000001",
      "id": 1
    }
  ]
}
```

---

## 2. 修改押金记录

**接口**: `PUT /api/deposits/:id`

**使用场景**:
- 乐器归还时更新状态
- 记录损坏情况和扣款金额
- 上传证据照片
- 处理争议状态

**示例请求（乐器正常归还）**:
```bash
curl -X PUT http://localhost:3000/api/deposits/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "actual_return_date": "2024-02-14",
    "string_condition": "轻微磨损",
    "body_condition": "完好",
    "deduction_amount": 30,
    "refund_amount": 1970,
    "notes": "正常归还，琴弦轻微磨损扣除30元耗材费"
  }'
```

**示例请求（记录人为损坏）**:
```bash
curl -X PUT http://localhost:3000/api/deposits/8 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "dispute",
    "string_condition": "断裂",
    "body_condition": "严重损坏",
    "damage_description": "琴头断裂，漆面大面积刮伤",
    "damage_type": "human_damage",
    "deduction_amount": 1500,
    "evidence_photos": "damage1.jpg,damage2.jpg",
    "notes": "学生与同学打闹时摔坏，正在与家长协商赔偿金额"
  }'
```

**示例响应**:
```json
{
  "message": "Updated successfully"
}
```

---

## 3. 查询押金记录

**接口**: `GET /api/deposits`

### 支持的筛选条件

| 参数 | 说明 | 示例 |
|------|------|------|
| status | 状态 | active / completed / dispute |
| store | 门店 | 朝阳门店 / 海淀门店 |
| manager | 负责人 | 李老师 |
| start_date | 租借起始日期(含) | 2024-01-01 |
| end_date | 租借结束日期(含) | 2024-12-31 |

### 查询示例

**查询所有进行中的记录**:
```bash
curl "http://localhost:3000/api/deposits?status=active"
```

**按门店查询**:
```bash
curl "http://localhost:3000/api/deposits?store=朝阳门店"
```

**按负责人查询**:
```bash
curl "http://localhost:3000/api/deposits?manager=李老师"
```

**按日期范围查询**:
```bash
curl "http://localhost:3000/api/deposits?start_date=2024-01-01&end_date=2024-03-31"
```

**组合条件查询**:
```bash
curl "http://localhost:3000/api/deposits?status=active&store=朝阳门店&start_date=2024-01-01"
```

### 查询单条记录详情

**接口**: `GET /api/deposits/:id`

```bash
curl "http://localhost:3000/api/deposits/7"
```

**响应示例**:
```json
{
  "id": 7,
  "deposit_no": "DP1716000007",
  "student_name": "周宇",
  "student_phone": "13300133007",
  "instrument_type": "小提琴",
  "instrument_brand": "斯特拉迪瓦里",
  "instrument_model": "SV-100",
  "instrument_serial": "V2023089",
  "deposit_amount": 5000,
  "rental_start_date": "2024-03-01",
  "expected_return_date": "2024-04-01",
  "actual_return_date": "2024-03-30",
  "status": "dispute",
  "store": "西城门店",
  "manager": "冯老师",
  "string_condition": "断裂",
  "body_condition": "严重损坏",
  "damage_description": "琴弓断裂，面板开裂",
  "damage_type": "human_damage",
  "deduction_amount": 2000,
  "refund_amount": null,
  "evidence_photos": "photo4.jpg",
  "notes": "学生练琴时 anger 摔坏，正在协商",
  "created_at": "2024-05-18 10:00:00",
  "updated_at": "2024-05-18 10:00:00"
}
```

---

## 4. 导出押金记录

**接口**: `GET /api/deposits/export/csv`

**说明**: 支持与查询相同的筛选条件

### 导出示例

**导出全部记录**:
```bash
curl -O "http://localhost:3000/api/deposits/export/csv"
```

**导出有争议的记录**:
```bash
curl -O "http://localhost:3000/api/deposits/export/csv?status=dispute"
```

**导出某门店指定月份的记录**:
```bash
curl -O "http://localhost:3000/api/deposits/export/csv?store=朝阳门店&start_date=2024-01-01&end_date=2024-01-31"
```

---

## 核心字段说明

| 字段 | 说明 |
|------|------|
| deposit_no | 押金单号(唯一) |
| damage_type | 损坏类型: normal_wear(正常损耗)/human_damage(人为损坏) |
| string_condition | 琴弦状况: 全新/轻微磨损/严重磨损/断裂 |
| status | 状态: active(租借中)/completed(已完成)/dispute(争议中) |
| evidence_photos | 证据照片(逗号分隔) |
| deduction_amount | 扣款金额 |
| refund_amount | 实际退款金额 |

---

## 目录结构

```
.
├── app.js              # 主应用入口
├── database.js         # 数据库配置
├── init_data.js        # 初始化数据脚本
├── sample_data.csv     # 样例数据
├── package.json        # 依赖配置
├── uploads/            # 临时上传目录(自动创建)
└── deposit.db          # SQLite数据库文件(自动创建)
```

**说明**: 目录结构保持极简，方便后续添加前端页面或定时任务。
