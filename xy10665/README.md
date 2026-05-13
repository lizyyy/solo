# 内容侵权投诉申诉系统

一个完整的内容侵权投诉申诉管理系统，包含后端API和前端管理界面。

## 功能特性

### 后端功能
- **幂等性保证**：所有POST/PUT/PATCH请求都支持幂等处理
- **修改历史记录**：内容条目、权利人、投诉证据的修改都保留历史记录
- **完整的错误处理**：所有API都有规范的错误返回格式
- **数据模型**：
  - 内容条目管理
  - 权利人验证管理
  - 投诉证据管理
  - 下架状态追踪
  - 创作者申诉处理
  - 合规材料管理

### 前端功能
- **统计概览**：投诉总数、下架数量、待处理申诉、下架率等统计卡片
- **投诉管理**：投诉列表、新建投诉、状态变更、证据上传
- **申诉管理**：申诉列表、审核处理、详情查看
- **报表导出**：支持按处理人、时间范围筛选，导出CSV格式

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- uuid (唯一ID生成)
- json2csv (CSV导出)

### 前端
- React 18
- Ant Design 5
- Axios (HTTP客户端)
- Day.js (日期处理)

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── app.js                    # 主应用入口
│   │   ├── database/
│   │   │   ├── index.js              # 数据库连接
│   │   │   ├── init.js               # 数据库表初始化
│   │   │   └── seedData.js           # 样例数据生成
│   │   ├── middleware/
│   │   │   └── idempotency.js        # 幂等中间件
│   │   ├── utils/
│   │   │   └── history.js            # 历史记录工具
│   │   └── routes/
│   │       ├── contentItems.js       # 内容条目API
│   │       ├── rightsHolders.js      # 权利人API
│   │       ├── complaints.js         # 投诉API
│   │       ├── appeals.js            # 申诉API
│   │       └── reports.js            # 报表API
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   └── components/
    │       ├── Statistics.js         # 统计概览
    │       ├── ComplaintList.js      # 投诉列表
    │       ├── ComplaintDetail.js    # 投诉详情
    │       ├── AppealsList.js        # 申诉管理
    │       └── Reports.js            # 报表导出
    └── package.json
```

## 快速开始

### 1. 初始化后端

```bash
cd backend
npm install

# 初始化数据库表
node src/database/init.js

# 导入样例数据（可选）
node src/database/seedData.js

# 启动后端服务
npm start
# 或使用开发模式
# npm run dev
```

后端服务将在 http://localhost:3001 启动

### 2. 初始化前端

```bash
cd frontend
npm install

# 启动前端开发服务器
npm start
```

前端服务将在 http://localhost:3000 启动

## API 端点

### 内容条目
- `GET /api/content-items` - 获取内容列表
- `GET /api/content-items/:id` - 获取内容详情
- `GET /api/content-items/:id/history` - 获取内容修改历史
- `POST /api/content-items` - 创建内容
- `PUT /api/content-items/:id` - 更新内容

### 权利人
- `GET /api/rights-holders` - 获取权利人列表
- `GET /api/rights-holders/:id` - 获取权利人详情
- `GET /api/rights-holders/:id/history` - 获取修改历史
- `POST /api/rights-holders` - 创建权利人
- `PUT /api/rights-holders/:id` - 更新权利人
- `POST /api/rights-holders/:id/verify` - 验证权利人

### 投诉
- `GET /api/complaints` - 获取投诉列表
- `GET /api/complaints/:id` - 获取投诉详情
- `POST /api/complaints` - 创建投诉（需要权利人已验证）
- `PUT /api/complaints/:id/status` - 更新投诉状态
- `POST /api/complaints/:id/evidences` - 添加上诉证据

### 申诉
- `GET /api/appeals` - 获取申诉列表
- `GET /api/appeals/:id` - 获取申诉详情
- `POST /api/appeals` - 创建申诉
- `PUT /api/appeals/:id/review` - 审核申诉
- `POST /api/appeals/:id/materials` - 添加合规材料

### 报表
- `GET /api/reports/statistics` - 获取统计数据
- `GET /api/reports/export` - 导出报表（支持JSON/CSV格式）

## 验收要点

### 权利人校验
- 创建投诉时会验证权利人是否存在
- 只有已验证的权利人才可以提交投诉
- 验证状态变更会保留历史记录

### 创作者申诉留痕
- 所有申诉操作都有完整的时间戳记录
- 申诉状态变更可追踪
- 审核人、审核时间、审核备注全部记录

### 合规材料查询
- 可通过API查询申诉的合规材料
- 材料上传人、类型、描述完整记录
- 前端界面可查看材料列表

### 修改历史记录
- 内容条目、权利人、投诉证据的修改都会记录前后值
- 可通过API查询各实体的修改历史
- 历史记录包含修改人、修改时间、字段名、新旧值

### 报表导出
- 支持按处理人筛选
- 支持按时间范围筛选
- 导出CSV格式，可直接在Excel中打开
