# 发票OCR审核系统

一个完整的全栈发票审核管理系统，支持发票上传、OCR识别、税号校验、重复票据检测、人工审核和财务导出。

## 功能特性

### 后端服务
- 📊 **状态机管理** - 15种发票状态流转，严格控制审核流程
- 🔍 **税号校验** - 自动验证税号格式（15/18位）
- 📋 **重复票据检测** - 通过发票号码和代码自动检测重复
- 💾 **数据持久化** - SQLite数据库，重启数据不丢失
- 🔄 **幂等性支持** - 防止重复提交
- 📤 **CSV导出** - 财务导出功能
- 📝 **操作审计** - 完整的操作日志记录

### 前端界面
- 📈 **数据看板** - 统计卡片、趋势图、状态分布图
- 📋 **发票列表** - 分页查询、状态筛选
- 🔍 **详情查看** - 完整信息展示、操作时间线
- ✅ **审核抽屉** - 字段编辑、审核理由、重复票据处理
- 📤 **财务导出** - 一键导出所有待导出发票

## 技术栈

**后端：**
- Node.js + Express
- SQLite (better-sqlite3)
- Multer (文件上传)
- Moment.js

**前端：**
- Vue 3 (Composition API)
- Element Plus
- ECharts + vue-echarts
- Axios
- Vite

## 项目结构

```
invoice-ocr-system/
├── server/                    # 后端服务
│   ├── src/
│   │   ├── index.js          # 入口文件
│   │   ├── database.js       # 数据库初始化
│   │   ├── stateMachine.js   # 状态机
│   │   ├── services.js       # 业务逻辑
│   │   ├── routes.js         # API路由
│   │   └── initData.js       # 初始化数据
│   ├── data/                 # 数据库文件
│   ├── uploads/              # 上传文件
│   ├── exports/              # 导出文件
│   └── package.json
├── client/                   # 前端应用
│   ├── src/
│   │   ├── main.js
│   │   ├── api.js
│   │   ├── App.vue
│   │   ├── views/
│   │   │   └── Dashboard.vue
│   │   └── components/
│   │       ├── InvoiceDetail.vue
│   │       └── ReviewDrawer.vue
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── package.json              # 根目录配置
```

## 快速开始

### 安装依赖

```bash
# 安装根目录依赖（用于concurrently）
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 启动项目

```bash
# 同时启动前后端
npm run dev

# 或者分别启动
# 后端 (端口 3001)
cd server && npm run dev

# 前端 (端口 3000)
cd client && npm run dev
```

### 访问应用

打开浏览器访问: http://localhost:3000

## 发票状态流转

```
pending → uploaded → ocr_processing → ocr_success → tax_validating
                                                          ↓
                                                  duplicate_checking
                                                          ↓
                                            [tax_invalid / duplicate_found]
                                                          ↓
                                                    review_pending
                                                          ↓
                                          [review_approved / review_rejected]
                                                          ↓
                                                    export_ready → exported
```

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/invoices/upload | 上传发票 |
| GET | /api/invoices | 获取发票列表 |
| GET | /api/invoices/:id | 获取发票详情 |
| POST | /api/invoices/:id/retry | 重试OCR识别 |
| POST | /api/invoices/:id/review | 审核发票 |
| POST | /api/invoices/:id/resolve-duplicate | 处理重复票据 |
| POST | /api/invoices/:id/recalculate | 重新校验 |
| GET | /api/statistics | 获取统计数据 |
| POST | /api/export | 导出财务数据 |
| GET | /api/exports | 获取导出历史 |

## 核心功能说明

### 1. 幂等性处理
- 上传接口支持 `X-Idempotency-Key` 请求头
- 相同请求5分钟内只处理一次
- 数据库层面也做了幂等检查

### 2. 重复票据处理
- 检测到重复后进入 `duplicate_found` 状态
- 审核时可选择：保留原票 或 替换原票
- 所有操作记录到审计日志，支持复盘

### 3. 失败重试机制
- OCR识别失败可手动重试
- 限制最大重试次数（默认3次）
- 每次重试都记录在审计日志

### 4. 字段变更追踪
- 审核时编辑的字段会被记录
- 在详情页面可查看字段变更历史
- 支持追溯人工修正内容

## 数据模型

### invoices (发票表)
- id, invoice_number, invoice_code, tax_number, amount
- invoice_date, seller_name, buyer_name
- image_path, status, confidence, ocr_raw
- retry_count, max_retries, idempotency_key
- created_at, updated_at

### audit_logs (审计日志表)
- id, invoice_id, action, status_from, status_to
- operator, reason, fields_changed, created_at

### duplicates (重复记录表)
- id, invoice_id, duplicate_with, reason, resolved, created_at

### exports (导出记录表)
- id, filename, file_path, record_count, total_amount
- status, created_by, created_at

## 注意事项

1. 首次启动会自动创建演示数据（15张发票，包含各种状态）
2. 上传的图片保存在 `server/uploads/`
3. 导出的CSV文件保存在 `server/exports/`
4. 数据库文件位于 `server/data/invoices.db`
