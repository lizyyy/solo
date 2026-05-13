# 商户入驻资质保证金复核系统

前后端一体的商户入驻复核工具，统一管理营业执照、类目资质、保证金订单，确保数据一致性。

## 功能特性

- ✅ **复核面板**：商户详情查看，包含营业执照、类目资质、保证金订单等信息
- 🔍 **搜索过滤**：按商户名称/编号搜索，按入驻状态筛选
- 📊 **统计卡片**：实时展示商户总数、各状态数量、保证金总额
- ✔️ **类目资质校验**：审核通过/拒绝类目资质申请
- 📝 **驳回补充**：要求商户补充材料并记录原因
- 💾 **审核意见保存**：记录完整审核流程和意见
- 📜 **修改历史追踪**：保留营业执照、类目资质、保证金订单的修改前后值
- 📤 **导出报告**：按责任人和处理时间筛选导出 CSV 报告

## 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：React + Vite + Axios

## 本地启动

### 前置要求

- Node.js >= 16.0.0

### 步骤一：启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 `http://localhost:3001` 启动

### 步骤二：启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

访问 `http://localhost:3000` 即可使用系统

## 主要 API 接口

### 1. 获取商户列表

```http
GET /api/merchants
```

**查询参数：**
- `keyword`：商户名称或编号关键词
- `status`：入驻状态（pending/approved/rejected/supplement）

**响应示例：**
```json
[
  {
    "id": 1,
    "merchant_name": "北京科技有限公司",
    "merchant_code": "BJ001",
    "status": "pending",
    "license_number": "LIC10001",
    "qualification_status": "pending",
    "deposit_status": "unpaid"
  }
]
```

### 2. 获取商户详情

```http
GET /api/merchants/:id
```

**响应包含：**
- 商户基本信息
- 营业执照信息
- 类目资质列表
- 保证金订单列表
- 驳回补充记录
- 审核意见历史
- 修改历史记录

### 3. 获取统计数据

```http
GET /api/statistics
```

**响应示例：**
```json
{
  "total": 5,
  "pending": 2,
  "approved": 1,
  "rejected": 1,
  "totalDeposit": 40000
}
```

### 4. 校验类目资质

```http
POST /api/merchants/:id/validate-qualification
```

**请求体：**
```json
{
  "qualificationId": 1,
  "status": "approved",
  "reviewerId": 1,
  "reviewerName": "审核员A",
  "reviewComment": "资质齐全，符合要求"
}
```

### 5. 驳回并要求补充材料

```http
POST /api/merchants/:id/reject-supplement
```

**请求体：**
```json
{
  "reviewerId": 1,
  "reviewerName": "审核员A",
  "rejectionReason": "营业执照已过期",
  "supplementItems": "更新后的营业执照、法人身份证复印件"
}
```

### 6. 提交审核意见

```http
POST /api/merchants/:id/review-comment
```

**请求体：**
```json
{
  "reviewerId": 1,
  "reviewerName": "审核员A",
  "comment": "所有材料齐全，符合入驻条件",
  "reviewResult": "approved"
}
```

### 7. 导出报告

```http
GET /api/export-report
```

**查询参数：**
- `reviewerName`：责任人姓名筛选
- `startDate`：开始日期（YYYY-MM-DD）
- `endDate`：结束日期（YYYY-MM-DD）

**响应：** CSV 文件下载

## 样例数据

系统启动时会自动初始化 5 个测试商户：

| 商户名称 | 商户编号 | 入驻状态 | 资质状态 | 保证金状态 |
|---------|---------|---------|---------|-----------|
| 北京科技有限公司 | BJ001 | 待审核 | 待审核 | 未缴纳 |
| 上海贸易有限公司 | SH002 | 已通过 | 待审核 | 未缴纳 |
| 广州电商有限公司 | GZ003 | 已拒绝 | 待审核 | 已缴纳 |
| 深圳数码有限公司 | SZ004 | 待补充 | 已通过 | 未缴纳 |
| 杭州食品有限公司 | HZ005 | 待审核 | 待审核 | 已缴纳 |

## 会失败的操作示例

以下操作由于缺少必要参数或状态不正确会导致失败：

### 1. 提交审核意见时缺少审核意见

```javascript
// ❌ 失败 - comment 为空
axios.post('/api/merchants/1/review-comment', {
  reviewerId: 1,
  reviewerName: '审核员A',
  comment: '',  // 不能为空
  reviewResult: 'approved'
});

// 响应：400 Bad Request
// { "error": "审核意见和结果不能为空" }
```

### 2. 驳回补充时缺少驳回原因

```javascript
// ❌ 失败 - rejectionReason 为空
axios.post('/api/merchants/1/reject-supplement', {
  reviewerId: 1,
  reviewerName: '审核员A',
  rejectionReason: '',  // 不能为空
  supplementItems: '营业执照复印件'
});

// 响应：400 Bad Request
// { "error": "驳回原因和补充项不能为空" }
```

### 3. 类目资质审核时使用无效状态

```javascript
// ❌ 失败 - status 不是有效枚举值
axios.post('/api/merchants/1/validate-qualification', {
  qualificationId: 1,
  status: 'processing',  // 只能是 approved 或 rejected
  reviewerId: 1,
  reviewerName: '审核员A'
});

// 响应：400 Bad Request
// { "error": "无效的状态值" }
```

### 4. 访问不存在的商户

```javascript
// ❌ 失败 - 商户 ID 不存在
axios.get('/api/merchants/99999');

// 响应：404 Not Found
// { "error": "商户不存在" }
```

### 5. 审核不存在的类目资质

```javascript
// ❌ 失败 - 资质 ID 不存在或不属于该商户
axios.post('/api/merchants/1/validate-qualification', {
  qualificationId: 99999,
  status: 'approved',
  reviewerId: 1,
  reviewerName: '审核员A'
});

// 响应：404 Not Found
// { "error": "类目资质不存在" }
```

## 数据一致性保证

1. **事务性更新**：状态变更时同时更新相关联的数据表
2. **修改历史记录**：所有关键字段变更都记录旧值和新值
3. **时间戳记录**：记录每个操作的精确时间
4. **责任人追踪**：记录每个操作的审核员信息

## 项目结构

```
.
├── backend/
│   ├── server.js          # Express 服务器主文件
│   ├── database.js        # SQLite 数据库初始化和模型
│   ├── package.json
│   └── merchant_review.db # SQLite 数据库文件（自动生成）
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 主应用组件
│   │   ├── main.jsx       # 应用入口
│   │   └── index.css      # 样式文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```
