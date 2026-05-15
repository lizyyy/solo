# 发票回调复核台

一个面向技术的全栈Web应用，用于解决电子发票平台异步回调缓慢导致财务无法判断哪些单据需要人工复核的问题。

## 技术架构

- **后端**: Node.js + Express
- **前端**: React + Ant Design
- **数据存储**: 内存存储（演示用，可扩展为数据库）

## 核心功能

### 后端核心规则
1. **异步回调处理**: 接收第三方发票平台回调，最多重试5次
2. **状态补偿机制**: 超时30分钟未回调的单据自动标记为待复核
3. **人工复核流程**: 支持财务人员对异常单据进行复核通过/驳回
4. **红冲关联记录**: 记录发票红冲操作并关联原发票
5. **发票下载验证**: 仅成功/已复核状态允许下载

### 前端功能
1. **列表筛选**: 按平台、状态、业务单号、购方名称、日期范围筛选
2. **详情时间线**: 完整展示单据状态变更历史和操作人
3. **批量导入**: 支持CSV批量导入开票请求
4. **报告导出**: 导出CSV格式的发票报表

## 本地运行说明

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 `http://localhost:3001` 启动

### 2. 启动前端服务

```bash
cd frontend
npm install
npm start
```

前端服务将在 `http://localhost:3000` 启动

### 3. 访问应用
打开浏览器访问 `http://localhost:3000`

---

## API 接口示例

所有接口基础路径: `http://localhost:3001/api/invoices`

### 1. 创建开票请求
**POST /**

```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "baiwang",
    "businessNo": "BW20241201001",
    "buyerName": "某某科技有限公司",
    "amount": 8848.00
  }'
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "requestId": "uuid-xxx",
    "platform": "baiwang",
    "businessNo": "BW20241201001",
    "callbackStatus": "pending",
    "timeline": [...]
  }
}
```

### 2. 查询开票列表
**GET /**

```bash
# 查询所有
curl http://localhost:3001/api/invoices

# 按条件筛选
curl "http://localhost:3001/api/invoices?platform=baiwang&callbackStatus=need_review"
```

### 3. 处理回调（模拟发票平台）
**POST /callback/:requestId**

```bash
# 成功回调
curl -X POST http://localhost:3001/api/invoices/callback/{requestId} \
  -H "Content-Type: application/json" \
  -d '{
    "success": true,
    "downloadUrl": "https://example.com/invoice.pdf",
    "invoiceCode": "1234567890",
    "invoiceNo": "00001234"
  }'

# 失败回调
curl -X POST http://localhost:3001/api/invoices/callback/{requestId} \
  -H "Content-Type: application/json" \
  -d '{
    "success": false,
    "error": "发票代码格式错误"
  }'
```

### 4. 检查超时单据（触发状态补偿）
**POST /check-timeout**

```bash
curl -X POST http://localhost:3001/api/invoices/check-timeout
```

超过30分钟未回调的单据将自动标记为 `need_review` 状态。

### 5. 状态补偿（手动更新状态）
**POST /:id/compensate**

```bash
curl -X POST http://localhost:3001/api/invoices/{id}/compensate \
  -H "Content-Type: application/json" \
  -d '{
    "callbackStatus": "success",
    "downloadUrl": "https://example.com/compensated.pdf",
    "invoiceCode": "9876543210",
    "invoiceNo": "00005678"
  }'
```

### 6. 人工复核
**POST /:id/review**

```bash
# 复核通过
curl -X POST http://localhost:3001/api/invoices/{id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "张三",
    "comment": "核实为系统超时，实际发票已开具",
    "approve": true
  }'

# 复核驳回（重新处理）
curl -X POST http://localhost:3001/api/invoices/{id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "张三",
    "comment": "数据有误，请重新提交",
    "approve": false
  }'
```

### 7. 发票红冲
**POST /red-flush**

```bash
curl -X POST http://localhost:3001/api/invoices/red-flush \
  -H "Content-Type: application/json" \
  -d '{
    "originalInvoiceId": "{原发票ID}",
    "reason": "开票信息有误",
    "operator": "李四"
  }'
```

### 8. 获取发票下载链接
**GET /:id/download**

```bash
curl http://localhost:3001/api/invoices/{id}/download
```

### 9. 导出CSV报表
**GET /export/csv**

```bash
curl -O -J "http://localhost:3001/api/invoices/export/csv?platform=baiwang"
```

### 10. 批量导入
**POST /batch/import**

```bash
curl -X POST http://localhost:3001/api/invoices/batch/import \
  -H "Content-Type: application/json" \
  -d '{
    "invoices": [
      {"platform": "baiwang", "businessNo": "BW001", "buyerName": "公司A", "amount": 1000},
      {"platform": "jinsui", "businessNo": "JS001", "buyerName": "公司B", "amount": 2000}
    ]
  }'
```

---

## 故意失败的路径示例

### 场景1: 复核非待复核状态的单据
```bash
# 先创建一个成功状态的单据
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{"platform": "baiwang", "businessNo": "TEST001", "buyerName": "测试公司", "amount": 100}'

# 获取返回的id，然后尝试复核（会失败）
curl -X POST http://localhost:3001/api/invoices/{id}/review \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "测试员", "comment": "测试复核", "approve": true}'
```

**错误响应**:
```json
{
  "success": false,
  "error": "当前状态不允许复核"
}
```

### 场景2: 下载未成功状态的发票
```bash
# 创建一个pending状态的单据后立即尝试下载
curl http://localhost:3001/api/invoices/{id}/download
```

**错误响应**:
```json
{
  "success": false,
  "error": "发票下载链接未生成"
}
```

### 场景3: 红冲不存在的原发票
```bash
curl -X POST http://localhost:3001/api/invoices/red-flush \
  -H "Content-Type: application/json" \
  -d '{
    "originalInvoiceId": "non-existent-id",
    "reason": "测试红冲",
    "operator": "测试员"
  }'
```

**错误响应**:
```json
{
  "success": false,
  "error": "原发票记录不存在"
}
```

---

## 数据模型说明

### 开票请求 (Invoice)
| 字段 | 说明 | 枚举值 |
|------|------|--------|
| platform | 发票平台 | baiwang(百望), jinsui(金税), ukong(UKey) |
| callbackStatus | 回调状态 | pending(待处理), processing(处理中), success(成功), failed(失败), need_review(待复核), reviewed(已复核), red_flushed(已红冲) |
| reviewReason | 复核原因 | callback_timeout(超时), invalid_data(数据无效), duplicate_request(重复请求), platform_error(平台错误), manual_adjust(人工调整) |

### 红冲记录 (RedFlushRecord)
- 关联原发票ID和请求ID
- 记录红冲原因和操作人
- 支持记录红冲后的新发票信息
