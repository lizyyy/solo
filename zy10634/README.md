# 配送算法后台骑手改派补偿API

基于 Node.js + Express 实现的骑手改派补偿管理系统，支持完整的状态流转、冲突检测、历史追踪和CSV导出功能。

## 功能特性

- ✅ **核心数据**: 骑手、订单、改派原因、补偿金额
- ✅ **状态流转**: 待派送 → 改派中 → 补偿待审 → 已结算
- ✅ **改派类型**: 骑手拒单、系统改派
- ✅ **冲突检测**: 同一订单重复提交自动标记冲突
- ✅ **历史记录**: 所有操作完整留痕可追溯
- ✅ **批量导入**: 支持批量导入，坏行自动标记
- ✅ **数据导出**: 完整CSV导出功能

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 生成测试数据（可选）

打开新终端执行：

```bash
node scripts/seed.js
```

将生成包含完整流转、冲突记录、导入坏行的测试数据。

---

## API 接口文档

### 基础信息

- **服务地址**: `http://localhost:3000`
- **API前缀**: `/api/compensations`

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

### 2. 获取元数据（状态、改派类型）

```bash
curl http://localhost:3000/api/compensations/meta
```

### 3. 创建补偿记录

```bash
curl -X POST http://localhost:3000/api/compensations \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "R001",
    "riderName": "张三",
    "orderId": "O1001",
    "orderNo": "ORD-2024-001",
    "reassignmentType": "骑手拒单",
    "reason": "联系不上客户，电话无人接听",
    "compensationAmount": 15.5,
    "operator": "admin"
  }'
```

### 4. 状态流转

```bash
# 待派送 → 改派中
curl -X PUT http://localhost:3000/api/compensations/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "改派中",
    "reason": "骑手确认拒单，启动改派流程",
    "operator": "admin"
  }'

# 改派中 → 补偿待审
curl -X PUT http://localhost:3000/api/compensations/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "补偿待审",
    "reason": "改派完成，新骑手已接单",
    "operator": "system"
  }'

# 补偿待审 → 已结算
curl -X PUT http://localhost:3000/api/compensations/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "已结算",
    "reason": "财务审核通过，补偿已打款",
    "operator": "finance"
  }'
```

### 5. 查询列表

```bash
# 查询全部
curl http://localhost:3000/api/compensations

# 按状态筛选
curl "http://localhost:3000/api/compensations?status=已结算"

# 按改派类型筛选
curl "http://localhost:3000/api/compensations?reassignmentType=骑手拒单"

# 按冲突筛选
curl "http://localhost:3000/api/compensations?conflict=true"

# 按导入错误筛选
curl "http://localhost:3000/api/compensations?importError=true"
```

### 6. 查看详情

```bash
curl http://localhost:3000/api/compensations/{记录ID}
```

### 7. 查看历史记录

```bash
curl http://localhost:3000/api/compensations/{记录ID}/history
```

### 8. 批量导入（含坏行测试）

```bash
curl -X POST http://localhost:3000/api/compensations/batch \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "riderId": "R1003",
        "riderName": "批量骑手1",
        "orderId": "O-BATCH-001",
        "orderNo": "ORD-BATCH-001",
        "reassignmentType": "骑手拒单",
        "reason": "批量导入数据",
        "compensationAmount": 18.0
      },
      {
        "riderId": "",
        "riderName": "坏行骑手",
        "orderId": "",
        "orderNo": "ORD-BATCH-BAD",
        "reassignmentType": "",
        "reason": "这是一条坏行",
        "compensationAmount": 0
      },
      {
        "riderId": "R1004",
        "riderName": "批量骑手2",
        "orderId": "O-BATCH-002",
        "orderNo": "ORD-BATCH-002",
        "reassignmentType": "系统改派",
        "reason": "批量导入数据",
        "compensationAmount": 25.0
      }
    ]
  }'
```

### 9. 导出CSV

```bash
# 导出全部
curl -X POST http://localhost:3000/api/compensations/export \
  -H "Content-Type: application/json" \
  -d '{}'

# 按条件导出（筛选已结算）
curl -X POST http://localhost:3000/api/compensations/export \
  -H "Content-Type: application/json" \
  -d '{"filters": {"status": "已结算"}}'
```

### 10. 查看导出文件列表

```bash
curl http://localhost:3000/api/compensations/export/list
```

### 11. 下载导出文件

```bash
curl -O -J http://localhost:3000/api/compensations/export/{文件名}
```

---

## 验收测试流程

### 一键运行完整测试

```bash
# 先启动服务
npm start

# 打开新终端运行测试
node scripts/test-flow.js
```

### 手动验收步骤

#### 场景1: 完整状态流转

```bash
# 1. 创建补偿记录（记录返回的ID）
curl -X POST http://localhost:3000/api/compensations \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "R001",
    "riderName": "张三",
    "orderId": "O-TEST-001",
    "orderNo": "ORD-TEST-001",
    "reassignmentType": "骑手拒单",
    "reason": "客户联系不上",
    "compensationAmount": 15.5,
    "operator": "test-admin"
  }'

# 2. 状态流转1: 待派送 → 改派中
curl -X PUT http://localhost:3000/api/compensations/{ID}/status \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "改派中", "reason": "骑手确认拒单", "operator": "admin"}'

# 3. 状态流转2: 改派中 → 补偿待审
curl -X PUT http://localhost:3000/api/compensations/{ID}/status \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "补偿待审", "reason": "改派完成", "operator": "system"}'

# 4. 状态流转3: 补偿待审 → 已结算
curl -X PUT http://localhost:3000/api/compensations/{ID}/status \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "已结算", "reason": "审核通过已打款", "operator": "finance"}'

# 5. 查看详情（验证最终状态）
curl http://localhost:3000/api/compensations/{ID}

# 6. 查看历史记录（验证操作留痕）
curl http://localhost:3000/api/compensations/{ID}/history
```

#### 场景2: 冲突检测（重复订单）

```bash
# 1. 创建第一条记录
curl -X POST http://localhost:3000/api/compensations \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "R002",
    "riderName": "李四",
    "orderId": "O-CONFLICT-TEST",
    "orderNo": "ORD-CONFLICT-TEST",
    "reassignmentType": "骑手拒单",
    "reason": "冲突测试1",
    "compensationAmount": 20.0
  }'

# 2. 创建第二条记录（同一订单ID，预期标记冲突）
curl -X POST http://localhost:3000/api/compensations \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "R003",
    "riderName": "王五",
    "orderId": "O-CONFLICT-TEST",
    "orderNo": "ORD-CONFLICT-TEST",
    "reassignmentType": "系统改派",
    "reason": "冲突测试2",
    "compensationAmount": 30.0
  }'

# 3. 查看冲突列表
curl "http://localhost:3000/api/compensations?conflict=true"
```

#### 场景3: 导入坏行

```bash
# 批量导入（包含一条坏行）
curl -X POST http://localhost:3000/api/compensations/batch \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "riderId": "R1001",
        "riderName": "正常骑手",
        "orderId": "O-NORMAL",
        "orderNo": "ORD-NORMAL",
        "reassignmentType": "骑手拒单",
        "reason": "正常数据",
        "compensationAmount": 15.0
      },
      {
        "riderId": "",
        "riderName": "坏行骑手",
        "orderId": "",
        "orderNo": "ORD-BAD",
        "reassignmentType": "",
        "reason": "坏行数据",
        "compensationAmount": 0
      }
    ]
  }'

# 查看导入错误记录
curl "http://localhost:3000/api/compensations?importError=true"
```

#### 场景4: 数据导出验证

```bash
# 1. 导出全部
curl -X POST http://localhost:3000/api/compensations/export -H "Content-Type: application/json" -d '{}'

# 2. 查看导出文件列表
curl http://localhost:3000/api/compensations/export/list

# 3. 下载文件（替换为实际文件名）
curl -O -J http://localhost:3000/api/compensations/export/compensation-export-xxx.csv
```

---

## 验证清单

验收时请确认以下各项：

| 验证项 | 验证内容 |
|--------|----------|
| ✅ 完整流转 | 待派送 → 改派中 → 补偿待审 → 已结算 完整流转 |
| ✅ 历史记录 | 每条记录的操作历史完整可查 |
| ✅ 冲突检测 | 同一订单重复提交自动标记 `conflict: true` |
| ✅ 坏行标记 | 导入数据不完整自动标记 `importError: true` |
| ✅ 状态拦截 | 非法状态流转（如已结算 → 待派送）被拦截 |
| ✅ 列表筛选 | 支持按状态、冲突、导入错误等筛选 |
| ✅ 导出功能 | CSV导出包含所有关键字段 |
| ✅ 数据一致性 | 列表、详情、历史、导出数据互相对应 |

---

## 项目结构

```
.
├── package.json
├── README.md
├── src/
│   ├── index.js              # 服务入口
│   ├── store.js              # 数据存储
│   ├── models/
│   │   └── Compensation.js   # 数据模型
│   ├── routes/
│   │   └── compensations.js  # API路由
│   └── services/
│       └── exportService.js  # 导出服务
├── scripts/
│   ├── seed.js               # 造数脚本
│   └── test-flow.js          # 测试脚本
└── exports/                  # CSV导出目录
```
