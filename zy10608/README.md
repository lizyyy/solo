# 物流轨迹聚合承运商轨迹补传 API

## 功能概述

解决人工处理重复提交和状态越级的问题，提供：
- 按日期、状态、负责人、业务对象筛选
- 核心数据：运单号、承运商、节点时间、补传来源
- 状态管理：待补传(PENDING) / 已接收(RECEIVED) / 冲突待判(CONFLICT) / 已归档(ARCHIVED)
- 历史记录：完整记录冲突发现到处理的全过程
- CSV导出，口径与列表一致

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成测试数据

```bash
npm run seed
```

造数脚本会自动生成：
- 1条完整流转记录（待补传 -> 已接收 -> 已归档）
- 2条冲突记录（两个承运商对同一运单同一节点报不同时间）
- 批量导入坏行示例（空运单号、重复提交）
- 10条随机测试数据

### 3. 启动服务

```bash
npm run dev
```

服务启动在 `http://localhost:3000`

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

---

## API 接口文档

### 1. 列表查询

**GET** `/api/supplement`

**查询参数：**
| 参数 | 说明 | 示例 |
|------|------|------|
| startDate | 开始日期 | 2024-01-01 |
| endDate | 结束日期 | 2024-01-31 |
| status | 状态 | PENDING |
| handler | 处理人（模糊） | 张三 |
| business_object | 业务对象（模糊） | 华东 |
| waybill_no | 运单号（模糊） | SF123 |
| carrier | 承运商（模糊） | 顺丰 |
| page | 页码 | 1 |
| pageSize | 每页条数 | 20 |

**示例：**
```bash
# 查询所有待补传记录
curl "http://localhost:3000/api/supplement?status=PENDING"

# 按处理人筛选
curl "http://localhost:3000/api/supplement?handler=张三"

# 按日期范围筛选
curl "http://localhost:3000/api/supplement?startDate=2024-01-15&endDate=2024-01-20"

# 分页查询
curl "http://localhost:3000/api/supplement?page=1&pageSize=10"
```

### 2. 详情查询

**GET** `/api/supplement/:id`

**示例：**
```bash
# 查询ID为1的记录详情
curl "http://localhost:3000/api/supplement/1"
```

### 3. 历史记录

**GET** `/api/supplement/:id/history`

**示例：**
```bash
# 查询ID为1的记录的历史操作记录
curl "http://localhost:3000/api/supplement/1/history"
```

### 4. 创建记录

**POST** `/api/supplement`

**请求体：**
```json
{
  "waybill_no": "SF20240001",
  "carrier": "顺丰速运",
  "node_time": "2024-01-20 10:00:00",
  "node_type": "签收",
  "supplement_source": "人工补传",
  "handler": "张三",
  "business_object": "华东大区",
  "remark": "客户反馈未收到",
  "operator": "当前操作人"
}
```

**示例：**
```bash
curl -X POST "http://localhost:3000/api/supplement" \
  -H "Content-Type: application/json" \
  -d '{
    "waybill_no": "SF20240001",
    "carrier": "顺丰速运",
    "node_time": "2024-01-20 10:00:00",
    "node_type": "签收",
    "supplement_source": "人工补传",
    "status": "PENDING",
    "handler": "张三",
    "business_object": "华东大区",
    "operator": "李四"
  }'
```

### 5. 批量创建

**POST** `/api/supplement/batch`

**请求体：**
```json
{
  "records": [...],
  "operator": "批量导入用户"
}
```

**示例：**
```bash
curl -X POST "http://localhost:3000/api/supplement/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "waybill_no": "TEST001",
        "carrier": "中通快递",
        "node_time": "2024-01-20 11:00:00",
        "node_type": "派送",
        "supplement_source": "Excel导入",
        "status": "PENDING",
        "handler": "王五"
      },
      {
        "waybill_no": "TEST002",
        "carrier": "圆通速递",
        "node_time": "2024-01-20 12:00:00",
        "node_type": "中转",
        "supplement_source": "Excel导入",
        "status": "PENDING",
        "handler": "赵六"
      }
    ],
    "operator": "批量导入用户"
  }'
```

### 6. 状态更新

**PUT** `/api/supplement/:id/status`

**状态流转规则：**
- PENDING → RECEIVED / CONFLICT / ARCHIVED
- RECEIVED → CONFLICT / ARCHIVED
- CONFLICT → RECEIVED / ARCHIVED
- ARCHIVED → 无法变更

**请求体：**
```json
{
  "status": "RECEIVED",
  "operator": "张三",
  "remark": "已接收，核实无误"
}
```

**示例：**
```bash
curl -X PUT "http://localhost:3000/api/supplement/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RECEIVED",
    "operator": "张三",
    "remark": "已接收，核实无误"
  }'
```

### 7. 更新记录

**PUT** `/api/supplement/:id`

**请求体：**
```json
{
  "handler": "新处理人",
  "remark": "更新备注",
  "operator": "操作人"
}
```

**示例：**
```bash
curl -X PUT "http://localhost:3000/api/supplement/1" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "李四",
    "remark": "调整处理人",
    "operator": "管理员"
  }'
```

### 8. CSV导出

**GET** `/api/supplement/export/csv`

支持与列表相同的筛选参数

**示例：**
```bash
# 导出全部数据
curl "http://localhost:3000/api/supplement/export/csv" -o export.csv

# 导出待补传状态的数据
curl "http://localhost:3000/api/supplement/export/csv?status=PENDING" -o pending.csv
```

---

## 验收测试命令

按照以下顺序执行，验证核心场景：

### 1. 完整流转验证

```bash
# 1.1 创建新记录
curl -X POST "http://localhost:3000/api/supplement" \
  -H "Content-Type: application/json" \
  -d '{
    "waybill_no": "SF-TEST-001",
    "carrier": "顺丰速运",
    "node_time": "2024-01-21 09:00:00",
    "node_type": "签收",
    "supplement_source": "人工补传",
    "status": "PENDING",
    "handler": "测试员",
    "business_object": "测试大区",
    "operator": "验收测试"
  }'

# 注意记录返回的ID，假设为15

# 1.2 查看列表（确认状态为PENDING）
curl "http://localhost:3000/api/supplement?waybill_no=SF-TEST-001"

# 1.3 状态变更：PENDING → RECEIVED
curl -X PUT "http://localhost:3000/api/supplement/15/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RECEIVED",
    "operator": "验收测试",
    "remark": "已核实接收"
  }'

# 1.4 状态变更：RECEIVED → ARCHIVED
curl -X PUT "http://localhost:3000/api/supplement/15/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ARCHIVED",
    "operator": "验收测试",
    "remark": "流程完成，归档"
  }'

# 1.5 查看详情（确认最终状态）
curl "http://localhost:3000/api/supplement/15"

# 1.6 查看历史记录（验证完整流程可追溯）
curl "http://localhost:3000/api/supplement/15/history"
```

### 2. 冲突记录验证

```bash
# 2.1 创建承运商A的记录
curl -X POST "http://localhost:3000/api/supplement" \
  -H "Content-Type: application/json" \
  -d '{
    "waybill_no": "CONFLICT-TEST",
    "carrier": "中通快递",
    "node_time": "2024-01-21 14:00:00",
    "node_type": "派送",
    "supplement_source": "API导入",
    "status": "PENDING",
    "handler": "冲突测试员A",
    "operator": "验收测试"
  }'

# 2.2 创建承运商B的记录（同运单同节点不同时间）- 应自动标记为CONFLICT
curl -X POST "http://localhost:3000/api/supplement" \
  -H "Content-Type: application/json" \
  -d '{
    "waybill_no": "CONFLICT-TEST",
    "carrier": "圆通速递",
    "node_time": "2024-01-21 15:30:00",
    "node_type": "派送",
    "supplement_source": "Excel导入",
    "status": "PENDING",
    "handler": "冲突测试员B",
    "operator": "验收测试"
  }'

# 2.3 查看冲突列表
curl "http://localhost:3000/api/supplement?status=CONFLICT"

# 2.4 假设冲突记录ID为17，查看其详情和历史
curl "http://localhost:3000/api/supplement/17"
curl "http://localhost:3000/api/supplement/17/history"
```

### 3. 导入坏行验证

```bash
# 3.1 批量导入（包含空运单号和重复记录的坏数据）
curl -X POST "http://localhost:3000/api/supplement/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "waybill_no": "BAD-ROW-TEST",
        "carrier": "韵达快递",
        "node_time": "2024-01-21 16:00:00",
        "node_type": "揽收",
        "supplement_source": "Excel导入",
        "status": "PENDING",
        "handler": "坏行测试"
      },
      {
        "waybill_no": "",
        "carrier": "京东物流",
        "node_time": "2024-01-21 17:00:00",
        "supplement_source": "Excel导入",
        "status": "PENDING"
      },
      {
        "waybill_no": "BAD-ROW-TEST",
        "carrier": "韵达快递",
        "node_time": "2024-01-21 16:00:00",
        "node_type": "揽收",
        "supplement_source": "Excel导入",
        "status": "PENDING",
        "handler": "坏行测试"
      }
    ],
    "operator": "验收测试"
  }'

# 预期结果：成功1条，失败2条（空运单号、重复提交）
```

### 4. 导出验证

```bash
# 4.1 导出所有数据
curl "http://localhost:3000/api/supplement/export/csv" -o all_records.csv

# 4.2 验证导出内容与列表一致
curl "http://localhost:3000/api/supplement?page=1&pageSize=100"
# 对比CSV文件和JSON返回的数据条目

# 4.3 按状态筛选导出
curl "http://localhost:3000/api/supplement/export/csv?status=ARCHIVED" -o archived.csv
```

---

## 状态说明

| 状态值 | 说明 |
|--------|------|
| PENDING | 待补传 - 初始状态，等待处理 |
| RECEIVED | 已接收 - 已核实接收，数据有效 |
| CONFLICT | 冲突待判 - 同一运单同一节点不同承运商报不同时间 |
| ARCHIVED | 已归档 - 流程完成，不再变更 |

## 项目结构

```
.
├── src/
│   ├── models/
│   │   ├── database.ts      # 数据库初始化和连接
│   │   └── types.ts         # 类型定义
│   ├── services/
│   │   └── supplementService.ts  # 核心业务逻辑
│   ├── routes/
│   │   └── supplementRoutes.ts   # API路由
│   └── index.ts             # 服务入口
├── scripts/
│   └── seed.ts              # 造数脚本
├── data/                    # 数据库文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- SQLite (数据库)
- json2csv (CSV导出)
