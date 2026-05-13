# 资产设备管理工具

全栈员工设备管理工具 - 处理领用归还、资产编号追踪、离职校验、损坏扣费、盘点差异

## 功能特性

- **复核面板**：展示需要复核的变更记录，保留资产编号、员工离职、归还验收的修改前后值
- **搜索过滤**：全局搜索和多条件筛选（状态、责任人、日期范围）
- **统计卡片**：展示关键指标概览
- **员工离职校验**：校验员工是否可以正常离职
- **损坏扣费推进**：推进损坏扣费流程
- **盘点差异保存**：保存盘点差异记录
- **设备轨迹**：查看设备的完整历史轨迹
- **报告导出**：支持按责任人和处理时间筛选导出 CSV 报告

## 本地启动

### 前置要求

- Node.js 14+

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

或

```bash
node backend/server.js
```

### 访问地址

- 前端页面: http://localhost:3000
- API 服务: http://localhost:3000/api

## 项目结构

```
.
├── backend/
│   ├── server.js          # 后端服务器入口
│   ├── dataStore.js     # 数据存储工具函数
│   └── data/           # JSON 数据文件
│       ├── employees.json            # 员工数据
│       ├── assets.json               # 资产数据
│       ├── returnAcceptances.json  # 归还验收
│       ├── damageFees.json        # 损坏扣费
│       ├── inventoryDifferences.json  # 盘点差异
│       ├── assetTrails.json        # 设备轨迹
│       └── reviewRecords.json     # 复核记录
├── frontend/
│   ├── index.html         # 主页面
│   ├── style.css        # 样式文件
│   └── app.js           # 前端逻辑
├── package.json
└── README.md
```

## 主要 API

### 概览统计

**GET /api/overview**

获取系统概览统计数据

**响应示例:**
```json
{
  "success": true,
  "data": {
    "totalAssets": 5,
    "inUseAssets": 3,
    "pendingReturnAssets": 2,
    "pendingReviews": 2,
    "pendingAcceptances": 1,
    "pendingFees": 1,
    "pendingDifferences": 1,
    "resignedEmployees": 1,
    "pendingResignation": 1
  }
}
```

---

### 员工相关

**GET /api/employees**

获取员工列表

**查询参数:**
- `status`: 按状态筛选（active, pending_resignation, resigned）
- `search`: 搜索关键词

---

**GET /api/employees/:id/validate-resignation**

校验员工离职状态

**路径参数:**
- `id`: 员工 ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "employeeId": "emp-003",
    "employeeName": "王五",
    "currentStatus": "pending_resignation",
    "isResigned": false,
    "isPendingResignation": true,
    "canProceed": false,
    "issues": {
      "pendingAssets": [...],
      "pendingAcceptances": [...],
      "pendingFees": [...]
    },
    "oldStatus": "pending_resignation",
    "newStatus": "resigned"
  }
}
```

---

### 资产相关

**GET /api/assets**

获取资产列表

**查询参数:**
- `status`: 按状态筛选
- `category`: 按类别筛选
- `search`: 搜索关键词

---

### 归还验收

**GET /api/return-acceptances**

获取归还验收列表

**查询参数:**
- `status`: 按状态筛选
- `search`: 搜索关键词

---

### 损坏扣费

**GET /api/damage-fees**

获取损坏扣费列表

**查询参数:**
- `status`: 按状态筛选
- `search`: 搜索关键词

---

**POST /api/damage-fees/:id/advance**

推进损坏扣费流程（幂等接口）

**路径参数:**
- `id`: 扣费记录 ID

**请求体:**
```json
{
  "approver": "admin-01",
  "approverName": "系统管理员"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "fee-001",
    "oldStatus": "pending_approval",
    "newStatus": "pending_payment",
    "canAdvance": true,
    "isFinal": false,
    "changes": {
      "status": {
        "oldValue": "pending_approval",
        "newValue": "pending_payment"
      }
    }
  }
}
```

**状态流转:**
- `pending_approval` → `pending_payment` → `completed`

---

### 盘点差异

**GET /api/inventory-differences**

获取盘点差异列表

**查询参数:**
- `status`: 按状态筛选
- `responsiblePerson`: 按责任人筛选
- `startDate`: 开始日期
- `endDate`: 结束日期
- `search`: 搜索关键词

---

**POST /api/inventory-differences**

保存盘点差异（幂等接口）

**请求体:**
```json
{
  "assetNumber": "AST-2024-001",
  "previousAssetNumber": "AST-2023-045",
  "inventoryPeriod": "2026-Q2",
  "oldLocation": "研发部办公区",
  "newLocation": "仓库",
  "oldStatus": "in_use",
  "newStatus": "missing",
  "discrepancyType": "位置差异",
  "description": "设备不在原位置",
  "responsiblePersonName": "张三",
  "notes": "需要调查"
}
```

**幂等性说明:**
- 相同 `assetNumber` + `inventoryPeriod` 组合会更新现有记录，不会重复创建

---

### 设备轨迹

**GET /api/asset-trails**

获取设备轨迹

**查询参数:**
- `assetId`: 按资产 ID 筛选
- `assetNumber`: 按资产编号筛选（支持新旧编号）
- `action`: 按操作类型筛选

---

### 复核记录

**GET /api/review-records**

获取复核记录

**查询参数:**
- `type`: 按类型筛选（asset_number_change, employee_resignation, return_acceptance）
- `status`: 按状态筛选
- `search`: 搜索关键词

---

### 搜索

**GET /api/search**

全局搜索

**查询参数:**
- `q`: 搜索关键词
- `type`: 搜索类型（all, assets, employees, acceptances, fees, differences）

---

### 报告导出

**GET /api/export/report**

导出报告

**查询参数:**
- `responsiblePerson`: 按责任人筛选
- `startDate`: 开始日期
- `endDate`: 结束日期
- `format`: 导出格式（json, csv），默认 json

**CSV 导出示例:**
```
GET /api/export/report?format=csv
GET /api/export/report?responsiblePerson=张三&startDate=2026-05-01&endDate=2026-05-31&format=csv
```

---

## 测试数据

### 员工

| ID | 姓名 | 部门 | 状态 |
|----|------|------|------|
| emp-001 | 张三 | 研发部 | 在职 |
| emp-002 | 李四 | 产品部 | 在职 |
| emp-003 | 王五 | 市场部 | 待离职 |
| emp-004 | 赵六 | 财务部 | 已离职 |
| emp-005 | 孙七 | 人力资源部 | 在职 |

### 资产

| 资产编号 | 旧编号 | 名称 | 状态 | 持有人 |
|----------|--------|------|------|--------|
| AST-2024-001 | AST-2023-045 | MacBook Pro 16寸 | 使用中 | 张三 |
| AST-2024-002 | AST-2023-078 | Dell 显示器 | 使用中 | 李四 |
| AST-2024-003 | AST-2022-156 | iPhone 15 Pro | 待归还 | 王五 |
| AST-2024-004 | AST-2021-034 | ThinkPad X1 | 待归还 | 赵六 |
| AST-2024-005 | AST-2024-005 | 机械键盘 | 使用中 | 孙七 |

### 复核记录

1. **资产编号变更** (review-001)
   - 资产: AST-2024-001 (旧: AST-2023-045)
   - 状态: 已通过

2. **员工离职** (review-002)
   - 员工: 赵六
   - 状态变更: active → resigned
   - 状态: 已通过

3. **归还验收** (review-003)
   - 员工: 赵六
   - 设备状态: 良好 → 有轻微划痕
   - 状态: 已通过

4. **员工离职** (review-004)
   - 员工: 王五
   - 状态变更: active → pending_resignation
   - 状态: 待处理

5. **归还验收** (review-005)
   - 员工: 王五
   - 设备状态: 全新 → 屏幕破损
   - 状态: 待处理

### 会失败的操作

#### 场景：校验待离职员工（王五）

**操作：**
1. 在前端页面选择员工 "王五 - 市场部 (待离职)"
2. 点击 "校验离职状态" 按钮

**预期结果：**
校验会显示警告，显示以下问题：
- 待归还资产: 1 项 (iPhone 15 Pro)
- 待验收: 1 项
- 待处理扣费: 1 项 (¥4500)

**原因：**
王五仍有待归还的设备（iPhone 15 Pro）、待处理的归还验收记录、以及待审批的损坏扣费记录，因此无法完成离职流程。

#### API 调用示例：
```bash
# 校验王五的离职状态（会发现问题）
curl http://localhost:4000/api/employees/emp-003/validate-resignation
```

**响应中 `canProceed` 字段为 `false`，表示无法正常离职。

---

## 幂等性保证

### 后端幂等性

1. **请求缓存机制**
   - 相同请求（URL + Method + Body）在 10 秒内重复发送会返回缓存结果
   - 响应中包含 `_cached: true` 标识

2. **数据更新机制**
   - 盘点差异保存：相同 `assetNumber` + `inventoryPeriod` 组合会更新现有记录
   - 损坏扣费推进：已完成的记录不会重复推进

### 前端幂等性

1. **GET 请求缓存**
   - 相同 GET 请求在 10 秒内从缓存返回
   - 数据变更后自动清除缓存

2. **操作反馈**
   - 重复点击 "推进" 按钮会提示 "请求已处理（重复请求已忽略）"
   - 重复提交表单会提示 "数据已保存（重复请求已忽略）"

## 报告导出说明

### 导出的报告包含：

1. **汇总统计**
   - 盘点差异总数、待处理、已解决
   - 损坏扣费总数、待处理、总金额
   - 归还验收总数
   - 复核记录总数

2. **详细数据**
   - 盘点差异记录
   - 损坏扣费记录
   - 归还验收记录
   - 复核记录

3. **筛选条件**
   - 按责任人筛选（支持部分匹配）
   - 按日期范围筛选（开始日期、结束日期）

### CSV 格式说明

CSV 文件包含以下列：
- 类型
- 资产编号
- 员工
- 责任人
- 日期
- 状态
- 变更前
- 变更后

## 开发说明

### 数据持久化

所有数据存储在 `backend/data/` 目录下的 JSON 文件中。修改会实时保存。

### 新增测试数据

可以直接编辑 JSON 文件添加测试数据，或者通过 API 接口创建新记录。

### 重置数据

如果需要重置数据，可以删除 `backend/data/` 目录下的 JSON 文件，然后重新启动服务（需要重新创建数据文件）。

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML + CSS + JavaScript
- **数据存储**: JSON 文件
- **依赖**:
  - express: Web 框架
  - cors: 跨域支持
  - uuid: ID 生成
