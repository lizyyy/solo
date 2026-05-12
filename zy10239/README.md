# 企业印章外借审批 API

一个完整的企业印章外借审批管理系统 API，支持申请、审批、出借、归还、驳回、逾期查询和使用记录导出。

## 业务规则

API 层面自动拦截以下不合法操作：

1. **未审批出借** - 只有审批通过的申请才能出借印章
2. **同一印章同时外借** - 防止印章重复出借
3. **归还日期早于借出** - 日期合法性校验
4. **审批人和申请人相同** - 防止自审自批
5. **重复提交申请** - 相同印章、相同目的、相同申请人的待审批/已审批申请不允许重复创建
6. **状态流转校验** - 严格的状态机控制：pending → approved → lent → returned

## 状态说明

- `pending` - 待审批
- `approved` - 审批通过
- `rejected` - 已驳回
- `lent` - 已出借
- `returned` - 已归还

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

开发模式（自动重启）：

```bash
npm run dev
```

服务启动后，访问 `http://localhost:3000/health` 确认服务运行正常。

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/seals` | 获取所有印章列表 |
| GET | `/api/seals/:id` | 获取单个印章详情 |
| POST | `/api/applications` | 创建印章外借申请 |
| GET | `/api/applications` | 获取所有申请（支持筛选） |
| GET | `/api/applications/:id` | 获取单个申请详情 |
| POST | `/api/applications/:id/approve` | 审批通过申请 |
| POST | `/api/applications/:id/reject` | 驳回申请 |
| POST | `/api/applications/:id/lend` | 出借印章 |
| POST | `/api/applications/:id/return` | 归还印章 |
| GET | `/api/overdue` | 获取逾期未还的申请 |
| GET | `/api/export` | 导出使用记录（CSV） |

## API 调用示例

### 1. 首先获取印章列表

```bash
curl -X GET http://localhost:3000/api/seals
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "seal-uuid-1",
      "name": "公司公章",
      "type": "official",
      "status": "available"
    }
  ]
}
```

---

### 2. 创建外借申请（正常流程）

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "替换为实际的印章ID",
    "applicantId": "user001",
    "applicantName": "张三",
    "purpose": "签订销售合同",
    "expectedLendDate": "2024-01-15T09:00:00.000Z",
    "expectedReturnDate": "2024-01-16T18:00:00.000Z",
    "reason": "与重要客户签订年度合同"
  }'
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": "application-uuid",
    "status": "pending",
    ...
  }
}
```

---

### 3. ❌ 错误示例：归还日期早于借出日期

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "替换为实际的印章ID",
    "applicantId": "user001",
    "applicantName": "张三",
    "purpose": "签订合同",
    "expectedLendDate": "2024-01-20T09:00:00.000Z",
    "expectedReturnDate": "2024-01-10T18:00:00.000Z",
    "reason": "测试"
  }'
```

**被拦截响应：**
```json
{
  "success": false,
  "message": "预计归还日期不能早于预计借出日期"
}
```

---

### 4. 审批通过申请

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "admin001",
    "approverName": "李四",
    "remark": "同意，请注意保管"
  }'
```

---

### 5. ❌ 错误示例：审批人与申请人相同

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "user001",
    "approverName": "张三",
    "remark": "自己审批"
  }'
```

**被拦截响应：**
```json
{
  "success": false,
  "message": "审批人不能与申请人相同"
}
```

---

### 6. 出借印章

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/lend \
  -H "Content-Type: application/json" \
  -d '{
    "lenderId": "admin002",
    "lenderName": "王五",
    "actualLendDate": "2024-01-15T10:30:00.000Z"
  }'
```

---

### 7. ❌ 错误示例：未审批直接出借

如果尝试直接对 `pending` 状态的申请执行出借操作：

```bash
curl -X POST http://localhost:3000/api/applications/{待审批申请ID}/lend \
  -H "Content-Type: application/json" \
  -d '{
    "lenderId": "admin002",
    "lenderName": "王五"
  }'
```

**被拦截响应：**
```json
{
  "success": false,
  "message": "只有审批通过的申请才能出借"
}
```

---

### 8. 归还印章

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/return \
  -H "Content-Type: application/json" \
  -d '{
    "returnerId": "admin002",
    "returnerName": "王五",
    "actualReturnDate": "2024-01-16T15:00:00.000Z"
  }'
```

---

### 9. ❌ 错误示例：归还日期早于借出日期

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/return \
  -H "Content-Type: application/json" \
  -d '{
    "returnerId": "admin002",
    "returnerName": "王五",
    "actualReturnDate": "2024-01-10T15:00:00.000Z"
  }'
```

**被拦截响应：**
```json
{
  "success": false,
  "message": "实际归还日期不能早于实际借出日期"
}
```

---

### 10. 驳回申请

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "admin001",
    "approverName": "李四",
    "reason": "合同需法务先审核"
  }'
```

---

### 11. 查询逾期申请

```bash
curl -X GET http://localhost:3000/api/overdue
```

---

### 12. 导出使用记录（CSV）

```bash
curl -X GET "http://localhost:3000/api/export?startDate=2024-01-01&endDate=2024-12-31" \
  -o seal-records.csv
```

---

### 13. ❌ 错误示例：重复提交相同申请

创建第一个申请成功后，立即提交相同内容（相同印章、相同申请人、相同目的）：

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "同一个印章ID",
    "applicantId": "user001",
    "applicantName": "张三",
    "purpose": "签订销售合同",
    "expectedLendDate": "2024-01-15T09:00:00.000Z",
    "expectedReturnDate": "2024-01-16T18:00:00.000Z",
    "reason": "与重要客户签订年度合同"
  }'
```

**被拦截响应：**
```json
{
  "success": false,
  "message": "该印章已有相同目的的待审批或已审批申请，请勿重复提交"
}
```

---

### 14. ❌ 错误示例：同一印章同时外借

当一个印章已被出借（状态为 `lent`）时，尝试审批通过该印章的另一个申请：

```bash
curl -X POST http://localhost:3000/api/applications/{第二个申请ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "admin001",
    "approverName": "李四"
  }'
```

**被拦截响应：**
```json
{
  "success": false,
  "message": "该印章当前已被借出，无法审批通过"
}
```

---

## 完整流程示例脚本

项目根目录下提供了 `test-api.sh` 脚本，可一键运行完整的正常流程和错误场景测试：

```bash
chmod +x test-api.sh
./test-api.sh
```

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── models/
│   │   └── Seal.js           # 数据模型
│   ├── services/
│   │   └── SealService.js    # 业务逻辑层
│   ├── controllers/
│   │   └── sealController.js # 控制器
│   └── routes/
│       └── sealRoutes.js     # 路由配置
├── package.json
├── test-api.sh               # API 测试脚本
└── README.md
```