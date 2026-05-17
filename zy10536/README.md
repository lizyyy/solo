# 采购验收缺陷管理 API

一套完整的采购设备验收缺陷管理系统，支持缺陷登记、状态流转、复验管理、逾期提醒和报告导出。重点设计了异常路径处理和重复调用拦截机制。

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite (本地数据库)
- 幂等性支持 (Idempotency)
- 异常日志记录

## 项目结构

```
.
├── src/
│   ├── models/           # 数据模型和类型定义
│   ├── database/         # 数据库连接和Schema
│   ├── dao/              # 数据访问对象
│   ├── services/         # 业务服务层
│   ├── middleware/       # 中间件
│   ├── controllers/      # API控制器
│   ├── scripts/          # 脚本
│   └── app.ts            # 应用入口
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（带示例数据）

```bash
npm run init-db
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 4. 生产构建和启动

```bash
npm run build
npm start
```

## 核心数据模型

### 缺陷状态流转

```
已登记 (registered)
    ↓
整改中 (in_rectification)
    ↓
待复验 (pending_reinspection)
    ↓
已通过 (passed)
    ↓
已关闭 (closed)
```

### 缺陷类型

- `appearance` - 外观缺陷
- `functional` - 功能缺陷
- `documentation` - 文档缺陷
- `performance` - 性能缺陷
- `safety` - 安全缺陷
- `other` - 其他

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/defects` | 创建缺陷 |
| GET | `/api/defects` | 查询缺陷列表 |
| GET | `/api/defects/:id` | 查询单个缺陷 |
| GET | `/api/defects/overdue` | 查询逾期缺陷 |
| PATCH | `/api/defects/:id/status` | 更新缺陷状态 |
| PATCH | `/api/defects/:id/correct` | 人工修正缺陷 |
| GET | `/api/defects/export/csv` | 导出CSV报告 |
| GET | `/api/defects/export/pdf` | 导出PDF报告 |
| GET | `/health` | 健康检查 |

## cURL 调用示例

### 重要提示

所有 POST、PUT、PATCH 请求必须携带 `x-idempotency-key` 请求头，用于防止重复调用。该Key值在24小时内有效。

---

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

### 2. 创建缺陷

```bash
curl -X POST http://localhost:3000/api/defects \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: create-defect-001" \
  -d '{
    "procurementOrderNo": "PO-2024-001",
    "equipmentNo": "EQ-003",
    "defectType": "functional",
    "description": "显示屏有亮点，共3处",
    "inspector": "张三"
  }'
```

### 3. 查询缺陷列表

```bash
# 查询所有
curl http://localhost:3000/api/defects

# 按采购单号筛选
curl "http://localhost:3000/api/defects?procurementOrderNo=PO-2024-001"

# 按状态筛选
curl "http://localhost:3000/api/defects?status=registered"
```

### 4. 查询单个缺陷

```bash
curl http://localhost:3000/api/defects/{defect-id}
```

### 5. 更新状态（设置整改要求）

```bash
curl -X PATCH http://localhost:3000/api/defects/{defect-id}/status \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: update-status-001" \
  -d '{
    "status": "in_rectification",
    "operator": "李四",
    "rectification": {
      "content": "请在3天内更换显示屏",
      "deadline": "2024-12-31T23:59:59.999Z",
      "responsiblePerson": "王五"
    }
  }'
```

### 6. 更新状态（提交复验）

```bash
curl -X PATCH http://localhost:3000/api/defects/{defect-id}/status \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: update-status-002" \
  -d '{
    "status": "pending_reinspection",
    "operator": "王五"
  }'
```

### 7. 复验通过

```bash
curl -X PATCH http://localhost:3000/api/defects/{defect-id}/status \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: update-status-003" \
  -d '{
    "status": "passed",
    "operator": "张三",
    "reinspection": {
      "inspector": "张三",
      "inspectionDate": "2024-12-25T10:00:00.000Z",
      "result": "pass",
      "remarks": "复验合格，问题已解决"
    }
  }'
```

### 8. 人工修正

```bash
curl -X PATCH http://localhost:3000/api/defects/{defect-id}/correct \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: correct-001" \
  -d '{
    "field": "description",
    "oldValue": "显示屏有亮点，共3处",
    "newValue": "显示屏有亮点，共5处",
    "reason": "现场重新核验发现更多问题点",
    "operator": "张三"
  }'
```

### 9. 导出CSV

```bash
curl "http://localhost:3000/api/defects/export/csv?procurementOrderNo=PO-2024-001" \
  -o defects.csv
```

### 10. 导出PDF

```bash
curl "http://localhost:3000/api/defects/export/pdf?procurementOrderNo=PO-2024-001" \
  -o defect-report.pdf
```

## 异常路径拦截示例

以下是一些会被系统拦截的异常请求示例：

### 1. 缺少幂等性Key（重复调用防护）

```bash
# 故意不携带 x-idempotency-key 头
curl -X POST http://localhost:3000/api/defects \
  -H "Content-Type: application/json" \
  -d '{
    "procurementOrderNo": "PO-2024-001",
    "equipmentNo": "EQ-003",
    "defectType": "functional",
    "description": "测试",
    "inspector": "张三"
  }'
```

**预期响应：**
```json
{
  "success": false,
  "error": {
    "code": "MISSING_IDEMPOTENCY_KEY",
    "message": "请求必须包含 x-idempotency-key 头以防止重复调用"
  }
}
```

### 2. 无效的状态转换

```bash
# 尝试将已关闭的缺陷重新打开
curl -X PATCH http://localhost:3000/api/defects/{closed-defect-id}/status \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: invalid-transition" \
  -d '{
    "status": "in_rectification",
    "operator": "张三"
  }'
```

**预期响应：**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "无效的状态转换: closed -> in_rectification",
    "requestId": "..."
  }
}
```

### 3. 必填参数缺失

```bash
curl -X POST http://localhost:3000/api/defects \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: missing-param-test" \
  -d '{
    "procurementOrderNo": "",
    "equipmentNo": "EQ-003",
    "defectType": "functional",
    "description": "测试",
    "inspector": "张三"
  }'
```

**预期响应：**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "采购单号不能为空",
    "requestId": "..."
  }
}
```

### 4. 查询不存在的缺陷

```bash
curl http://localhost:3000/api/defects/non-existent-id
```

**预期响应：**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "缺陷不存在: non-existent-id",
    "requestId": "..."
  }
}
```

## 异常处理机制

### 1. 原始输入保留

所有异常请求都会被记录到 `exception_logs` 表中，包含：
- 原始请求体（rawInput.body）
- 原始查询参数（rawInput.query）
- 原始路径参数（rawInput.params）

### 2. 处理依据记录

每条异常日志都会记录处理依据（handlingBasis）：
- 资源不存在
- 请求参数验证失败
- 状态转换验证失败
- 系统内部错误

### 3. Request ID 追踪

每个异常响应都会返回 `requestId`，可用于追踪和审计。

## 重复调用拦截机制

### 工作原理

1. 客户端在第一次请求时生成唯一的 `x-idempotency-key`
2. 服务器检查该Key是否已存在
3. 如果存在，直接返回之前的响应结果
4. 如果不存在，正常处理请求并缓存响应结果

### Key 有效期

- 默认：24小时
- 作用域：按接口路径隔离

### 最佳实践

- 使用 UUID 或 时间戳+随机数 生成 Key
- 同一业务操作使用相同的 Key
- 不同的业务操作使用不同的 Key

## 数据库表说明

| 表名 | 说明 |
|------|------|
| defects | 缺陷主表 |
| defect_photos | 缺陷照片 |
| rectification_requirements | 整改要求 |
| reinspection_records | 复验记录 |
| manual_corrections | 人工修正记录 |
| exception_logs | 异常日志 |
| idempotency_keys | 幂等性Key缓存 |

## 安全特性

1. **Helmet 安全头** - 基础安全防护
2. **CORS 跨域保护** - 可配置的跨域策略
3. **Rate Limiting 限流** - 15分钟内最多100次请求
4. **请求体大小限制** - 最大10MB
5. **幂等性保证** - 防止重复提交

## 开发说明

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 初始化数据库
npm run init-db
```

## 许可证

MIT
