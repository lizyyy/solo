# 高校实验室传感器借还管理系统

一个基于 Node.js + Express + SQLite 的实验室传感器设备借还管理后端服务。

## 功能特性

- 📋 **设备管理**：老师可通过 REST API 登记、查询、修改、删除设备
- 📥 **CSV 导入**：支持批量导入设备清单
- 🔄 **借用/归还**：学生借用/归还设备，自动计算归还日期
- 👥 **项目组管理**：按项目组查看设备占用情况
- ⚠️ **超期检测**：自动标记超期未还设备，计算风险等级
- 📊 **催还清单**：导出当天催还清单（支持 CSV 格式）
- 💾 **持久化存储**：数据存储在 SQLite 数据库中

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式（带热重载）
npm run dev
```

服务默认运行在 `http://localhost:3000`

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3000 | 服务端口 |
| DB_PATH | ./data/sensors.db | SQLite 数据库路径 |
| DEFAULT_BORROW_DAYS | 7 | 默认借用天数 |
| RISK_LEVEL_1_DAYS | 1 | 风险等级1阈值（天） |
| RISK_LEVEL_2_DAYS | 3 | 风险等级2阈值（天） |
| RISK_LEVEL_3_DAYS | 7 | 风险等级3阈值（天） |

## API 文档

### 基础路径

所有 API 路径均以 `/api` 为前缀。

### 健康检查

```bash
GET /api/health
```

**响应示例：**
```json
{
  "status": "ok",
  "timestamp": "2026-05-04T10:00:00.000Z",
  "message": "传感器借还管理系统运行正常"
}
```

---

### 项目组管理

#### 获取所有项目组

```bash
GET /api/groups
```

#### 创建项目组

```bash
POST /api/groups
Content-Type: application/json

{
  "name": "人工智能研究组",
  "description": "专注于机器学习和深度学习研究"
}
```

#### 获取项目组详情（含设备占用情况）

```bash
GET /api/groups/:id
```

**响应包含：**
- 项目组基本信息
- 学生列表
- 设备列表
- 活跃借用记录
- 超期数量统计
- 设备统计（总数/可用/借用中/超期）

#### 获取项目组借用记录

```bash
GET /api/groups/:id/borrowed?status=active
```

**参数：**
- `status`: 筛选状态，可选值：`active`（借用中）、`returned`（已归还）、`all`（全部）

---

### 学生管理

#### 获取学生列表

```bash
GET /api/students?project_group_id=1&name=张三
```

**参数：**
- `project_group_id`: 按项目组筛选
- `name`: 按姓名模糊搜索
- `student_id`: 按学号模糊搜索

#### 登记学生

```bash
POST /api/students
Content-Type: application/json

{
  "student_id": "2024001",
  "name": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800138000",
  "project_group_id": 1
}
```

#### 批量导入学生

```bash
POST /api/students/batch
Content-Type: application/json

{
  "students": [
    {
      "student_id": "2024001",
      "name": "张三",
      "project_group_id": 1
    },
    {
      "student_id": "2024002",
      "name": "李四",
      "email": "lisi@example.com"
    }
  ]
}
```

#### 获取学生详情

```bash
GET /api/students/:id
```

**响应包含：**
- 学生基本信息
- 活跃借用记录（含超期天数和风险等级）
- 借用历史
- 统计信息

---

### 设备管理

#### 获取设备列表

```bash
GET /api/devices?status=available&type=温度传感器
```

**参数：**
- `status`: 设备状态，可选值：`available`（可用）、`borrowed`（借用中）、`maintenance`（维护中）
- `type`: 设备类型
- `project_group_id`: 项目组ID

#### 登记设备

```bash
POST /api/devices
Content-Type: application/json

{
  "device_id": "TEMP-001",
  "name": "高精度温度传感器",
  "type": "温度传感器",
  "model": "DS18B20",
  "serial_number": "SN20240001",
  "project_group_id": 1
}
```

#### 获取设备详情

```bash
GET /api/devices/:id
```

**响应包含：**
- 设备基本信息
- 借用历史记录

#### 更新设备信息

```bash
PUT /api/devices/:id
Content-Type: application/json

{
  "name": "新设备名称",
  "status": "maintenance"
}
```

#### 删除设备

```bash
DELETE /api/devices/:id
```

> ⚠️ 注意：已被借用的设备无法删除

#### 批量导入设备（CSV）

```bash
POST /api/devices/import/csv
Content-Type: multipart/form-data

file: @devices.csv
```

**CSV 文件格式：**

| 设备编号 | 名称 | 类型 | 型号 | 序列号 | 项目组 |
|----------|------|------|------|--------|--------|
| TEMP-001 | 温度传感器 | 温度传感器 | DS18B20 | SN001 | 人工智能研究组 |
| HUMI-001 | 湿度传感器 | 湿度传感器 | DHT22 | SN002 | 物联网研究组 |

**支持的列名（中英文均可）：**
- 设备编号 / device_id / id
- 名称 / name
- 类型 / type
- 型号 / model
- 序列号 / serial_number
- 项目组 / project_group

#### 获取设备统计

```bash
GET /api/devices/stats/summary
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "available": 35,
    "borrowed": 12,
    "maintenance": 3,
    "byType": [
      { "type": "温度传感器", "count": 20 },
      { "type": "湿度传感器", "count": 15 }
    ]
  }
}
```

---

### 借用/归还管理

#### 借用设备

```bash
POST /api/borrow/borrow
Content-Type: application/json

{
  "device_id": 1,
  "student_id": 1,
  "borrow_days": 7
}
```

**参数：**
- `device_id`: 设备ID（必填）
- `student_id`: 学生ID 或学号（必填）
- `borrow_days`: 借用天数（可选，默认7天）

#### 归还设备

```bash
POST /api/borrow/return/:recordId
```

**响应示例（超期情况）：**
```json
{
  "success": true,
  "message": "设备归还成功，超期 3 天",
  "data": {
    "id": 1,
    "overdue_days": 3,
    "risk_level": 2,
    "risk_level_description": "中度超期"
  }
}
```

#### 获取活跃借用记录

```bash
GET /api/borrow/active?project_group_id=1
```

**参数：**
- `student_id`: 按学生筛选
- `project_group_id`: 按项目组筛选

**每条记录包含：**
- 超期天数
- 当前风险等级
- 风险等级描述

#### 获取借用历史

```bash
GET /api/borrow/history?student_id=1&limit=20&offset=0
```

**参数：**
- `student_id`: 学生ID
- `device_id`: 设备ID
- `project_group_id`: 项目组ID
- `status`: 记录状态（active/returned）
- `limit`: 每页数量（默认50）
- `offset`: 偏移量（默认0）

#### 获取借用记录详情

```bash
GET /api/borrow/:recordId
```

---

### 超期检测与风险等级

#### 执行超期检测

```bash
GET /api/overdue/check
```

**功能：**
- 检查所有活跃借用记录
- 自动计算超期天数和风险等级
- 更新数据库中的风险等级
- 返回详细的检测结果

**响应示例：**
```json
{
  "success": true,
  "message": "超期检测完成，共检查 15 条活跃记录，更新 3 条风险等级",
  "data": {
    "total_active": 15,
    "total_overdue": 5,
    "by_risk_level": {
      "0": 10,
      "1": 2,
      "2": 2,
      "3": 1,
      "4": 0
    },
    "overdue_records": [...]
  }
}
```

#### 获取超期列表

```bash
GET /api/overdue/list?risk_level=2&min_overdue_days=3
```

**参数：**
- `risk_level`: 按风险等级筛选
- `project_group_id`: 按项目组筛选
- `min_overdue_days`: 最小超期天数

#### 获取超期统计

```bash
GET /api/overdue/stats
```

**响应包含：**
- 总活跃数
- 总超期数
- 超期率
- 按风险等级统计
- 按项目组统计
- 风险等级描述

#### 获取高风险记录

```bash
GET /api/overdue/high-risk?min_risk_level=3
```

**参数：**
- `min_risk_level`: 最低风险等级（默认3）

---

### 导出功能

#### 导出当天催还清单

```bash
# JSON 格式
GET /api/export/reminder-today

# CSV 格式（可直接下载）
GET /api/export/reminder-today?format=csv

# 按项目组筛选
GET /api/export/reminder-today?project_group_id=1&format=csv
```

**CSV 导出包含以下列：**
- 设备编号、设备名称、设备类型、设备型号
- 学生姓名、学号、联系邮箱、联系电话
- 项目组
- 借用日期、应还日期
- 超期天数、是否超期、距到期天数
- 风险等级、风险描述、提醒类型
- 导出日期

**提醒类型：**
- `normal`: 正常（距到期 > 3天）
- `soon`: 即将到期（距到期 2-3天）
- `urgent`: 紧急提醒（距到期 ≤1天）
- `overdue`: 已超期

#### 导出超期设备清单

```bash
GET /api/export/overdue-csv?min_risk_level=2
```

**参数：**
- `project_group_id`: 按项目组筛选
- `min_risk_level`: 最低风险等级（默认0）

#### 导出项目组借用记录

```bash
# JSON 格式
GET /api/export/project-group/:groupId

# CSV 格式
GET /api/export/project-group/:groupId?format=csv
```

---

## 风险等级说明

| 等级 | 超期天数 | 描述 |
|------|----------|------|
| 0 | ≤ 0天 | 正常 |
| 1 | 1天 | 轻微超期 |
| 2 | 2-3天 | 中度超期 |
| 3 | 4-7天 | 严重超期 |
| 4 | > 7天 | 极高风险 |

> 可通过环境变量 `RISK_LEVEL_1_DAYS`、`RISK_LEVEL_2_DAYS`、`RISK_LEVEL_3_DAYS` 调整阈值

---

## 示例请求流程

### 完整流程示例

1. **创建项目组**
```bash
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "人工智能研究组",
    "description": "AI实验室核心研究组"
  }'
```

2. **登记学生**
```bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "name": "张三",
    "email": "zhangsan@example.com",
    "project_group_id": 1
  }'
```

3. **登记设备**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "TEMP-001",
    "name": "高精度温度传感器",
    "type": "温度传感器",
    "model": "DS18B20",
    "project_group_id": 1
  }'
```

4. **借用设备**
```bash
curl -X POST http://localhost:3000/api/borrow/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": 1,
    "student_id": 1,
    "borrow_days": 3
  }'
```

5. **检查超期**
```bash
curl http://localhost:3000/api/overdue/check
```

6. **导出催还清单**
```bash
# JSON 格式
curl http://localhost:3000/api/export/reminder-today

# CSV 格式（下载文件）
curl -O "http://localhost:3000/api/export/reminder-today?format=csv"
```

7. **归还设备**
```bash
curl -X POST http://localhost:3000/api/borrow/return/1
```

---

## 异常场景验证

### 1. 参数验证失败

**场景：** 登记设备时缺少必填字段

**请求：**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "温度传感器"
  }'
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "设备编号、名称和类型为必填项"
}
```

**HTTP 状态码：** `400 Bad Request`

---

### 2. 资源不存在

**场景：** 查询不存在的设备

**请求：**
```bash
curl http://localhost:3000/api/devices/999999
```

**期望响应：**
```json
{
  "error": "资源不存在",
  "message": "设备不存在"
}
```

**HTTP 状态码：** `404 Not Found`

---

### 3. 数据冲突（唯一约束）

**场景：** 使用已存在的设备编号登记设备

**请求：**
```bash
# 第一次（成功）
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DUP-001",
    "name": "重复设备",
    "type": "测试类型"
  }'

# 第二次（失败）
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DUP-001",
    "name": "另一个设备",
    "type": "其他类型"
  }'
```

**期望响应（第二次请求）：**
```json
{
  "error": "数据冲突",
  "message": "唯一约束违反，可能是重复的 ID 或名称"
}
```

**HTTP 状态码：** `409 Conflict`

---

### 4. 业务逻辑约束

**场景 4.1：** 借用已被借用的设备

**请求：**
```bash
# 假设设备1已被借用
curl -X POST http://localhost:3000/api/borrow/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": 1,
    "student_id": 2
  }'
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "设备当前状态为 \"borrowed\"，无法借用"
}
```

**HTTP 状态码：** `400 Bad Request`

---

**场景 4.2：** 删除已被借用的设备

**请求：**
```bash
# 假设设备1正被借用
curl -X DELETE http://localhost:3000/api/devices/1
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "设备当前已被借用，无法删除"
}
```

**HTTP 状态码：** `400 Bad Request`

---

**场景 4.3：** 归还已归还的设备

**请求：**
```bash
# 假设记录1已被归还
curl -X POST http://localhost:3000/api/borrow/return/1
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "该记录已归还或已取消"
}
```

**HTTP 状态码：** `400 Bad Request`

---

**场景 4.4：** 删除有活跃借用记录的学生

**请求：**
```bash
# 假设学生1有活跃的借用记录
curl -X DELETE http://localhost:3000/api/students/1
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "学生当前有 2 个活跃的借用记录，无法删除"
}
```

**HTTP 状态码：** `400 Bad Request`

---

### 5. CSV 导入异常

**场景 5.1：** 未上传文件

**请求：**
```bash
curl -X POST http://localhost:3000/api/devices/import/csv
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "请选择要上传的 CSV 文件"
}
```

**HTTP 状态码：** `400 Bad Request`

---

**场景 5.2：** CSV 中缺少必填字段

**CSV 内容：**
```csv
名称,类型
温度传感器,温度传感器
```

**期望响应：**
```json
{
  "success": true,
  "message": "CSV 导入完成：成功 0 条，失败 1 条",
  "data": {
    "successCount": 0,
    "failCount": 1,
    "errors": [
      {
        "row": { "名称": "温度传感器", "类型": "温度传感器" },
        "reason": "缺少必填字段（设备编号、名称、类型）"
      }
    ]
  }
}
```

**HTTP 状态码：** `200 OK`（注意：导入操作本身成功，但部分行失败）

---

### 6. 项目组删除约束

**场景：** 删除仍有学生/设备的项目组

**请求：**
```bash
# 假设项目组1下仍有学生或设备
curl -X DELETE http://localhost:3000/api/groups/1
```

**期望响应：**
```json
{
  "error": "参数验证失败",
  "message": "项目组下仍有学生、设备或活跃借用记录，无法删除"
}
```

**HTTP 状态码：** `400 Bad Request`

---

## 数据库结构

### 表结构

**project_groups（项目组表）**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| name | TEXT | 项目组名称（唯一） |
| description | TEXT | 描述 |
| created_at | DATETIME | 创建时间 |

**students（学生表）**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| student_id | TEXT | 学号（唯一） |
| name | TEXT | 姓名 |
| email | TEXT | 邮箱 |
| phone | TEXT | 电话 |
| project_group_id | INTEGER | 项目组ID（外键） |
| created_at | DATETIME | 创建时间 |

**devices（设备表）**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| device_id | TEXT | 设备编号（唯一） |
| name | TEXT | 设备名称 |
| type | TEXT | 设备类型 |
| model | TEXT | 型号 |
| serial_number | TEXT | 序列号 |
| status | TEXT | 状态（available/borrowed/maintenance） |
| project_group_id | INTEGER | 项目组ID（外键） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**borrow_records（借用记录表）**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| device_id | INTEGER | 设备ID（外键） |
| student_id | INTEGER | 学生ID（外键） |
| borrow_date | DATETIME | 借用日期 |
| due_date | DATETIME | 应还日期 |
| return_date | DATETIME | 实际归还日期 |
| status | TEXT | 状态（active/returned） |
| risk_level | INTEGER | 风险等级 |
| project_group_id | INTEGER | 项目组ID（外键） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

---

## 目录结构

```
.
├── data/                  # SQLite 数据库目录
│   └── sensors.db         # 数据库文件（自动创建）
├── src/
│   ├── app.js             # 主应用入口
│   ├── database.js        # 数据库连接和初始化
│   ├── utils.js           # 工具函数（超期计算、风险等级等）
│   └── routes/
│       ├── devices.js     # 设备管理路由
│       ├── borrow.js      # 借用/归还路由
│       ├── groups.js      # 项目组管理路由
│       ├── students.js    # 学生管理路由
│       ├── overdue.js     # 超期检测路由
│       └── export.js      # 导出功能路由
├── uploads/               # 临时文件上传目录
├── .env                   # 环境变量配置
├── package.json           # 项目配置
└── README.md              # 本文档
```

---

## 开发说明

### 添加新的设备类型

设备类型没有严格限制，可以在登记设备时自定义类型名称。系统会自动按类型统计。

### 调整风险等级阈值

修改 `.env` 文件中的相关环境变量：

```env
RISK_LEVEL_1_DAYS=2    # 轻微超期阈值（默认1天）
RISK_LEVEL_2_DAYS=5    # 中度超期阈值（默认3天）
RISK_LEVEL_3_DAYS=10   # 严重超期阈值（默认7天）
```

### 修改默认借用期限

```env
DEFAULT_BORROW_DAYS=14  # 默认借用14天（默认7天）
```

---

## 许可证

MIT License
