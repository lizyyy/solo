# 直播样品借还管理系统

一个全栈 Web 应用，用于统一管理直播样品的借还流程，解决主播排期分散、样品 SKU 人工判断、成本归属不一致等问题。

## 功能特性

### 核心功能
- **统一入口**：整合主播排期、样品管理、借还记录的统一管理平台
- **搜索过滤**：支持按 SKU、样品名称、主播、责任人、时间范围等多维度筛选
- **异常看板**：实时展示待审批记录、库存预警、成本追踪等异常情况
- **流转追踪**：后端接口层保存每次流转的完整记录
- **版本控制**：保留主播排期、样品 SKU、损耗说明的修改前后值

### 业务规则
- **损耗说明变化**：归还和损耗记录支持填写损耗说明，修改时保留历史版本
- **销售转正拦截**：只有已完成的排期才能进行销售转正，且必须有已审批的借出记录
- **归还验收复核**：所有交易记录需要审批通过才能生效
- **重复提交防护**：同一样品在同一排期下不能重复提交相同类型的操作

### 报告导出
- 支持按责任人和处理时间筛选导出
- 导出 Excel 格式报告，包含完整的交易信息和成本计算

## 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript
- **数据库**：SQLite3
- **导出功能**：SheetJS (xlsx)

## 项目结构

```
live-sample-management/
├── package.json
├── README.md
├── server/
│   ├── index.js              # 服务器入口
│   ├── database/
│   │   ├── db.js            # 数据库连接
│   │   └── schema.sql       # 数据库表结构
│   ├── models/
│   │   ├── hostSchedule.js  # 主播和排期模型
│   │   ├── sample.js        # 样品模型
│   │   ├── transaction.js   # 交易记录模型
│   │   └── responsiblePerson.js  # 责任人模型
│   ├── routes/
│   │   ├── hostSchedules.js      # 主播排期路由
│   │   ├── samples.js            # 样品路由
│   │   ├── transactions.js       # 交易路由
│   │   └── responsiblePersons.js # 责任人路由
│   ├── utils/
│   │   └── response.js      # 响应工具函数
│   ├── scripts/
│   │   └── seed.js          # 样例数据脚本
│   └── exports/             # 导出文件目录
├── public/
│   ├── index.html           # 主页面
│   ├── styles.css           # 样式文件
│   └── app.js               # 前端逻辑
└── server/data/             # SQLite 数据库文件
```

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库和样例数据

```bash
npm run seed
```

这将创建数据库表结构并初始化样例数据，包括：
- 3 位主播（张主播、李主播、王主播）
- 3 条主播排期
- 6 个样品（涵盖护肤品、化妆品、女装、男装、食品等）
- 3 位责任人
- 6 条交易记录（借出、归还、销售转正、损耗等）

### 3. 启动服务器

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

### 4. 访问应用

打开浏览器访问：http://localhost:3000

## API 接口演示

### 健康检查

```bash
curl http://localhost:3000/api/health
```

**响应：**
```json
{
  "status": "ok",
  "message": "直播样品借还管理系统 API 服务正常",
  "timestamp": "2026-05-13T08:00:00.000Z"
}
```

### 获取异常看板数据

```bash
curl http://localhost:3000/api/transactions/anomalies
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "type": "pending_approvals",
      "title": "待审批记录",
      "count": 3,
      "description": "需要审批的记录数量",
      "status": "warning"
    },
    {
      "type": "low_stock",
      "title": "库存预警",
      "count": 2,
      "description": "库存低于或等于5的样品数量",
      "status": "warning",
      "details": [
        { "id": "...", "sku": "SKU-004", "name": "短袖T恤", "quantity_in_stock": 3 }
      ]
    }
  ]
}
```

### 获取借还记录列表

```bash
# 获取所有记录
curl http://localhost:3000/api/transactions

# 按类型筛选
curl "http://localhost:3000/api/transactions?transaction_type=borrow"

# 按状态筛选
curl "http://localhost:3000/api/transactions?status=pending"

# 按责任人筛选
curl "http://localhost:3000/api/transactions?responsible_person_id={责任人ID}"

# 按时间范围筛选
curl "http://localhost:3000/api/transactions?start_date=2026-05-01&end_date=2026-05-31"

# 关键词搜索
curl "http://localhost:3000/api/transactions?keyword=保湿"
```

### 创建交易记录

```bash
# 借出
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "borrow",
    "sample_id": "{样品ID}",
    "schedule_id": "{排期ID}",
    "host_id": "{主播ID}",
    "quantity": 5,
    "responsible_person_id": "{责任人ID}",
    "created_by": "张三"
  }'

# 归还（带损耗说明）
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "return",
    "sample_id": "{样品ID}",
    "schedule_id": "{排期ID}",
    "host_id": "{主播ID}",
    "quantity": 3,
    "loss_description": "样品拆封展示，包装有轻微磨损",
    "responsible_person_id": "{责任人ID}",
    "created_by": "李四"
  }'

# 销售转正
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "sell",
    "sample_id": "{样品ID}",
    "schedule_id": "{已完成排期ID}",
    "host_id": "{主播ID}",
    "quantity": 2,
    "responsible_person_id": "{责任人ID}",
    "created_by": "王五"
  }'
```

### 审批交易记录

```bash
# 审批通过
curl -X POST http://localhost:3000/api/transactions/{交易ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "管理员",
    "comments": "同意"
  }'

# 审批拒绝
curl -X POST http://localhost:3000/api/transactions/{交易ID}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "管理员",
    "comments": "数量不符，请核实"
  }'
```

### 导出报告

```bash
# 导出所有记录
curl -X POST http://localhost:3000/api/transactions/export \
  -H "Content-Type: application/json" \
  -d '{}'

# 按责任人和时间筛选导出
curl -X POST http://localhost:3000/api/transactions/export \
  -H "Content-Type: application/json" \
  -d '{
    "responsible_person_id": "{责任人ID}",
    "start_date": "2026-05-01",
    "end_date": "2026-05-31",
    "transaction_type": "borrow"
  }'
```

**响应示例：**
```json
{
  "success": true,
  "message": "导出成功",
  "data": {
    "filename": "样品借还报告_2026-05-13T08-00-00-000Z.xlsx",
    "download_url": "/exports/样品借还报告_2026-05-13T08-00-00-000Z.xlsx",
    "count": 10
  }
}
```

### 查看版本历史

```bash
# 交易记录版本
curl http://localhost:3000/api/transactions/{交易ID}/versions

# 样品版本
curl http://localhost:3000/api/samples/{样品ID}/versions

# 排期版本
curl http://localhost:3000/api/hosts/schedules/{排期ID}/versions
```

## 一条失败路径演示

### 场景：重复提交借出记录

**步骤 1：首次借出**

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "borrow",
    "sample_id": "sample-001",
    "schedule_id": "schedule-001",
    "host_id": "host-001",
    "quantity": 5,
    "created_by": "张三"
  }'
```

**响应：**
```json
{
  "success": true,
  "message": "交易记录创建成功",
  "data": { ... }
}
```

**步骤 2：重复提交（失败）**

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "borrow",
    "sample_id": "sample-001",
    "schedule_id": "schedule-001",
    "host_id": "host-001",
    "quantity": 3,
    "created_by": "张三"
  }'
```

**响应（失败）：**
```json
{
  "success": false,
  "message": "该样品在此排期下已存在相同类型的提交，请勿重复操作",
  "code": 400
}
```

### 其他失败场景

1. **库存不足**：借出数量超过库存时返回错误
2. **销售转正拦截**：对未完成排期进行销售转正时返回错误
3. **无借出记录**：销售转正但没有对应的已审批借出记录时返回错误
4. **重复审批**：对已审批记录再次审批时返回错误

## 数据模型说明

### 核心实体

- **Host（主播）**：主播基本信息
- **HostSchedule（主播排期）**：主播直播排期，支持版本追踪
- **Sample（样品）**：样品 SKU、名称、成本、库存，支持版本追踪
- **ResponsiblePerson（责任人）**：责任人员信息
- **SampleTransaction（交易记录）**：借还交易记录，支持审批流程
- **SubmittedTransaction（提交记录）**：用于防止重复提交

### 版本追踪

所有支持修改的实体都有对应的版本表：
- `host_schedule_versions` - 排期修改历史
- `sample_versions` - 样品修改历史
- `sample_transaction_versions` - 交易记录修改历史

### 交易类型

| 类型 | 说明 | 库存影响 |
|------|------|----------|
| borrow | 借出 | 减少库存 |
| return | 归还 | 增加库存 |
| sell | 销售转正 | 不影响库存 |
| loss | 损耗 | 不影响库存 |

### 交易状态

| 状态 | 说明 |
|------|------|
| pending | 待审批 |
| approved | 已通过（影响库存） |
| rejected | 已拒绝 |

## 使用流程

1. **基础数据维护**
   - 维护主播信息
   - 维护样品 SKU 信息
   - 维护责任人信息
   - 创建主播排期

2. **日常操作**
   - 直播前：创建借出记录
   - 直播后：创建归还记录（填写损耗说明）或销售转正记录
   - 管理员审批：通过或拒绝待审批记录

3. **数据查询**
   - 使用搜索和筛选功能查找特定记录
   - 查看异常看板了解待处理事项
   - 导出报告进行数据分析

4. **追踪追溯**
   - 查看任意记录的修改历史
   - 追踪库存变化
   - 按责任人和时间导出报告
