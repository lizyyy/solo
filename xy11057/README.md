# 艺术品寄存库艺术品出入库 API

一个轻量级的艺术品出入库管理系统，支持单条操作和批量导入，具有完整的业务校验和筛选功能。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库和样例数据

```bash
npm run init
```

初始化后将包含：
- 2个门店（北京798、上海M50）
- 4件艺术品（梵高星月夜、向日葵、齐白石山水图、徐悲鸿奔马图）
- 2条初始出入库记录

### 3. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

---

## 核心功能

### 一、创建出入库记录

**接口**: `POST /api/records`

**请求示例（正常入库）**:

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "record_code": "REC003",
    "record_type": "inbound",
    "artwork_code": "AW004",
    "store_code": "ST001",
    "handler": "张明",
    "record_date": "2024-02-01",
    "remarks": "徐悲鸿奔马图入库",
    "register_code": "REG202402001"
  }'
```

**请求示例（冲突场景 - 高估值无授权出库）**:

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "record_code": "REC004",
    "record_type": "outbound",
    "artwork_code": "AW001",
    "store_code": "ST001",
    "handler": "张明",
    "record_date": "2024-02-02",
    "remarks": "梵高星月夜出库 - 高估值作品",
    "register_code": "REG202402001"
  }'
```

> **业务规则说明**:
> - 估值≥1000万的艺术品标记为"高估值"，出库必须二次授权
> - 如未提供授权，记录将被标记为"pending"状态，同时返回警告信息
> - 不中断操作，给出明确的行级结果

**请求示例（高估值带授权出库）**:

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "record_code": "REC005",
    "record_type": "outbound",
    "artwork_code": "AW001",
    "store_code": "ST001",
    "handler": "张明",
    "record_date": "2024-02-03",
    "has_dual_auth": true,
    "auth_by": "李总",
    "auth_date": "2024-02-03"
  }'
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| record_code | string | 是 | 记录编号，唯一 |
| record_type | string | 是 | 类型：inbound(入库)/outbound(出库) |
| artwork_code | string | 是 | 艺术品编号 |
| store_code | string | 是 | 门店编号 |
| handler | string | 是 | 负责人 |
| record_date | string | 是 | 出入库日期 (YYYY-MM-DD) |
| remarks | string | 否 | 备注 |
| register_code | string | 否 | 出入库册编号（用于一致性校验） |
| has_dual_auth | boolean | 否 | 是否二次授权（高估值出库必填） |
| auth_by | string | 否 | 授权人 |
| auth_date | string | 否 | 授权日期 |

**成功响应示例**:

```json
{
  "success": true,
  "data": {
    "id": 3,
    "record_code": "REC003",
    "record_type": "inbound",
    "artwork_code": "AW004",
    "artwork_name": "奔马图",
    "artist": "徐悲鸿",
    "estimated_value": 12000000,
    "store_code": "ST001",
    "store_name": "北京798艺术区门店",
    "handler": "张明",
    "record_date": "2024-02-01",
    "status": "completed",
    "remarks": "徐悲鸿奔马图入库"
  },
  "warnings": [
    {
      "type": "register_inconsistency",
      "message": "出入库册 REG202402001 包含不同类型的出入库记录"
    }
  ]
}
```

---

### 二、修改出入库记录

**接口**: `PUT /api/records/:id`

**请求示例**:

```bash
curl -X PUT http://localhost:3000/api/records/3 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "remarks": "已完成二次授权",
    "has_dual_auth": true,
    "auth_by": "王总监",
    "auth_date": "2024-02-04"
  }'
```

**可修改字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| handler | string | 负责人 |
| record_date | string | 出入库日期 |
| status | string | 状态：pending/completed/cancelled |
| remarks | string | 备注 |
| has_dual_auth | boolean | 是否二次授权 |
| auth_by | string | 授权人 |
| auth_date | string | 授权日期 |

---

### 三、查询出入库记录

**接口**: `GET /api/records`

**基础查询**:

```bash
# 查询所有记录
curl http://localhost:3000/api/records

# 分页查询
curl "http://localhost:3000/api/records?page=1&page_size=10"
```

**按条件筛选**:

```bash
# 按类型筛选（入库/出库）
curl "http://localhost:3000/api/records?record_type=outbound"

# 按状态筛选
curl "http://localhost:3000/api/records?status=pending"

# 按负责人筛选（模糊匹配）
curl "http://localhost:3000/api/records?handler=张明"

# 按门店筛选
curl "http://localhost:3000/api/records?store_code=ST001"

# 按日期范围筛选
curl "http://localhost:3000/api/records?start_date=2024-01-01&end_date=2024-12-31"

# 组合筛选
curl "http://localhost:3000/api/records?record_type=outbound&status=pending&handler=张明&start_date=2024-01-01"
```

**筛选参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| record_type | string | inbound/outbound |
| status | string | pending/completed/cancelled |
| handler | string | 负责人（模糊匹配） |
| store_code | string | 门店编号 |
| start_date | string | 开始日期 (YYYY-MM-DD) |
| end_date | string | 结束日期 (YYYY-MM-DD) |
| page | number | 页码，默认1 |
| page_size | number | 每页条数，默认20 |

---

### 四、导出出入库记录

**接口**: `GET /api/records/export`

**导出CSV**:

```bash
# 导出所有记录（CSV格式，自动下载）
curl "http://localhost:3000/api/records/export" -o records.csv

# 按筛选条件导出
curl "http://localhost:3000/api/records/export?record_type=outbound&start_date=2024-01-01" -o outbound-2024.csv
```

**导出JSON**:

```bash
curl "http://localhost:3000/api/records/export?format=json"
```

---

### 五、批量导入出入库记录

**接口**: `POST /api/records/import`

**准备CSV文件** (sample-import.csv):

```csv
记录编号,记录类型,艺术品编号,门店编号,负责人,出入库日期,备注,出入库册编号,是否二次授权,授权人,授权日期
REC010,inbound,AW003,ST001,王丽,2024-03-01,齐白石作品入库,REG202403001,,,
REC011,outbound,AW001,ST001,王丽,2024-03-02,星月夜出库-无授权,REG202403001,,,
REC012,outbound,AW002,ST001,王丽,2024-03-03,向日葵出库-有授权,REG202403001,是,王总,2024-03-03
REC013,inbound,AW999,ST001,王丽,2024-03-04,不存在的艺术品,,,,
```

**执行导入**:

```bash
curl -X POST http://localhost:3000/api/records/import \
  -F "file=@sample-import.csv"
```

**导入响应示例**:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 4,
      "success": 3,
      "warnings": 2,
      "errors": 1
    },
    "results": [
      {
        "row": 1,
        "record_code": "REC010",
        "artwork_code": "AW003",
        "artwork_name": "山水图",
        "success": true,
        "status": "completed"
      },
      {
        "row": 2,
        "record_code": "REC011",
        "artwork_code": "AW001",
        "artwork_name": "星月夜",
        "success": true,
        "status": "pending",
        "warnings": [
          {
            "type": "high_value_without_auth",
            "message": "高估值艺术品出库需要二次授权"
          }
        ]
      },
      {
        "row": 3,
        "record_code": "REC012",
        "artwork_code": "AW002",
        "artwork_name": "向日葵",
        "success": true,
        "status": "completed",
        "warnings": [
          {
            "type": "register_inconsistency",
            "message": "出入库册包含不同类型的出入库记录"
          }
        ]
      },
      {
        "row": 4,
        "success": false,
        "errors": ["艺术品不存在: AW999"]
      }
    ]
  }
}
```

> **关键特性**:
> - 行级处理：单行错误不影响其他记录
> - 高估值无授权：不中断，标记为pending并返回警告
> - 出入库册不一致：不中断，记录校验结果并返回警告
> - 详细的汇总统计和每行处理结果

---

## 辅助接口

### 查询所有艺术品

```bash
curl http://localhost:3000/api/artworks
```

### 查询所有门店

```bash
curl http://localhost:3000/api/stores
```

---

## 验收测试

执行完整的验收测试流程：

```bash
npm test
```

测试流程包括：
1. 重新初始化数据库
2. 创建正常入库单
3. 创建冲突单（高估值无授权出库）
4. 验证筛选功能
5. 验证导出功能
6. 输出测试结果

---

## 项目结构

```
.
├── src/
│   ├── app.js              # 主应用入口
│   ├── db.js               # 数据库操作
│   └── importExport.js     # 导入导出逻辑
├── scripts/
│   ├── init-db.js          # 数据库初始化脚本
│   └── test-flow.js        # 验收测试脚本
├── uploads/                # 上传文件临时目录
├── exports/                # 导出文件临时目录
├── package.json
└── README.md
```

---

## 业务规则总结

1. **高估值艺术品二次授权**:
   - 艺术品估值≥1000万标记为需要二次授权
   - 出库时如未提供授权，记录进入pending状态
   - 返回明确警告信息，不中断操作

2. **出入库册一致性校验**:
   - 同一出入库册编号下的记录类型应一致
   - 如发现混合类型，返回一致性警告
   - 记录保留校验结果供后续追溯

3. **批量导入容错**:
   - 每行独立处理，失败不影响其他行
   - 返回详细的行级处理结果
   - 包含汇总统计（成功/警告/错误数量）

4. **状态流转**:
   - 入库：直接进入completed状态
   - 出库：普通艺术品completed，高估值无授权pending，有授权completed
   - 支持后续通过修改接口补充授权