# 快递驿站滞留 API

本地后端 API 服务，提供快递驿站的包裹管理、滞留分级、催取提醒、拒收处理、退回跟踪和报告导出功能。

## 技术栈

- Node.js + Express
- SQLite (better-sqlite3)
- CSV 导出支持

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init-data
```

### 3. 启动服务

```bash
npm start
# 开发模式（自动重启）
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 4. 运行自检测试

```bash
npm test
```

## 核心功能

### 数据模型

- **包裹 (Package)**: 运单号、收件人、快递公司、重量、状态、存放位置、入库时间、滞留等级、催取次数
- **收件人 (Recipient)**: 姓名、手机号、地址
- **催取记录 (Reminder)**: 包裹ID、催取类型、时间、渠道、内容
- **拒收记录 (Rejection)**: 包裹ID、拒收原因、描述、拒收时间、处理人、状态
- **退回报告 (ReturnReport)**: 包裹ID、拒收记录ID、退回运单号、快递公司、退回时间、确认状态
- **异常日志 (ExceptionLog)**: API路径、请求方法、原始输入、错误类型、错误信息、处理结论

### 滞留分级规则

| 滞留时间 | 等级 | 催取间隔 |
|---------|------|---------|
| < 24小时 | normal | 首次 |
| 24-48小时 | warning | 12小时 |
| 48-72小时 | urgent | 6小时 |
| ≥ 72小时 | critical | 3小时 |

### 包裹状态流转

```
in_stock (入库) → pending_pickup (待取件) → picked_up (已取件)
                        ↓
                      rejected (拒收) → pending_return (待退回) → returned (已退回)
```

## API 接口文档

### 健康检查

```
GET /api/health
```

### 包裹管理

```
POST   /api/packages              # 创建包裹
GET    /api/packages              # 查询包裹列表
GET    /api/packages/:id          # 查询包裹详情
PUT    /api/packages/:id/status   # 更新包裹状态
PATCH  /api/packages/:id/correct  # 人工修正包裹信息
```

查询参数支持: `status`, `retention_level`, `tracking_number`, `page`, `limit`

### 催取管理

```
POST  /api/reminders       # 创建催取记录
GET   /api/reminders       # 查询催取记录
```

### 拒收管理

```
POST  /api/rejections      # 创建拒收记录
GET   /api/rejections      # 查询拒收记录
```

### 退回管理

```
POST  /api/returns         # 创建退回报告
GET   /api/returns         # 查询退回报告
PUT   /api/returns/:id/confirm  # 确认退回完成
```

### 导出功能

```
GET   /api/export/retention?format=json|csv  # 导出滞留报告
GET   /api/export/exceptions?format=json|csv  # 导出异常日志
GET   /api/export/files                       # 查看导出文件列表
```

### 异常日志

```
GET   /api/exceptions       # 查询异常日志
PUT   /api/exceptions/:id/resolve  # 处理异常日志
```

## 项目结构

```
.
├── src/
│   ├── app.js             # 应用入口
│   ├── config/
│   │   └── database.js    # 数据库配置
│   ├── models/
│   │   └── init.js        # 数据库初始化
│   ├── controllers/
│   │   ├── packageController.js  # 包裹控制器
│   │   ├── flowController.js     # 流程控制器（催取/拒收/退回）
│   │   └── exportController.js   # 导出控制器
│   ├── routes/
│   │   └── index.js       # 路由定义
│   └── utils/
│       ├── business.js    # 业务逻辑工具
│       └── exceptionLogger.js  # 异常日志工具
├── tests/
│   └── self-check.js      # 自检测试脚本
├── scripts/
│   └── init-data.js       # 样例数据初始化
├── data/                  # 数据库文件目录
├── exports/               # 导出文件目录
└── package.json
```

## 测试覆盖范围

自检测试脚本覆盖:
1. ✓ 健康检查
2. ✓ 创建包裹 - 正常流程
3. ✓ 查询包裹列表
4. ✓ 催取包裹 - 正常
5. ✓ 催取去重 - 重复请求拦截
6. ✓ 创建包裹 - 脏数据处理
7. ✓ 状态推进 - 拒收包裹
8. ✓ 查询拒收记录
9. ✓ 人工修正包裹信息
10. ✓ 导出滞留报告 (JSON)
11. ✓ 导出滞留报告 (CSV)
12. ✓ 异常日志记录检查
13. ✓ 导出内容一致性验证

## 使用示例

### 创建包裹

```bash
curl -X POST http://localhost:3000/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "SF1234567890",
    "recipient": {
      "name": "张三",
      "phone": "13800138000",
      "address": "北京市朝阳区"
    },
    "courier_company": "顺丰速运",
    "weight": 1.5,
    "storage_location": "A-01-01"
  }'
```

### 催取包裹

```bash
curl -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": 1,
    "type": "urgent",
    "channel": "sms",
    "content": "您的包裹已滞留3天，请尽快取件"
  }'
```

### 导出滞留报告

```bash
# JSON格式
curl http://localhost:3000/api/export/retention?format=json

# CSV格式
curl http://localhost:3000/api/export/retention?format=csv

# 按滞留等级筛选
curl http://localhost:3000/api/export/retention?retention_level=critical
```
