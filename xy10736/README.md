# 埋点验收台

一个完整的全栈埋点验收管理系统，提供埋点定义管理、调试会话、漏报检测、版本复核和验收报告导出功能。

## 功能特性

### 服务端
- ✅ 埋点定义管理
- ✅ 页面事件上报（支持幂等性、重试限制）
- ✅ 调试会话管理（状态机）
- ✅ 漏报检测（状态机）
- ✅ 版本发布复核（状态机）
- ✅ 页面事件变化后自动重新计算相关记录
- ✅ 验收报告导出（非研发人员友好格式）
- ✅ 漏报修正路径记录与复盘

### 前端
- ✅ 统计卡片展示（活跃埋点、事件总数、会话数、漏报数）
- ✅ 图表看板（漏报趋势、页面分布）
- ✅ 筛选表格（埋点管理、会话管理、漏报检测、版本管理）
- ✅ 验收报告导出（JSON + Excel）
- ✅ 修正路径与复盘日志展示

## 技术栈

- **后端**: Node.js + Express + Prisma + SQLite
- **前端**: Vue 3 + Element Plus + ECharts + Axios

## 快速开始

### 1. 安装依赖

```bash
# 方式一：分别安装
cd backend && npm install
cd ../frontend && npm install

# 方式二：使用根目录脚本（需要先 cd 到对应的目录）
```

### 2. 初始化数据库

```bash
cd backend
npx prisma generate
npx prisma db push
node prisma/seed.js  # 导入测试数据
```

### 3. 启动服务

```bash
# 启动后端服务（端口 3001）
cd backend
npm run dev

# 启动前端服务（端口 3000，另开一个终端）
cd frontend
npm run dev
```

### 4. 访问应用

打开浏览器访问: http://localhost:3000

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── middleware/      # 中间件（幂等性）
│   │   ├── routes/         # 路由
│   │   ├── services/       # 业务逻辑（状态机）
│   │   └── server.js       # 入口文件
│   ├── prisma/              # 数据库
│   │   ├── schema.prisma   # 数据模型
│   │   └── seed.js         # 测试数据
│   └── package.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── api/           # API 封装
│   │   ├── router/        # 路由配置
│   │   ├── App.vue        # 根组件
│   │   └── main.js        # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 核心功能说明

### 1. 状态机

系统实现了四个核心状态机：

- **事件状态**: received → validated → processed / failed
- **检测状态**: pending → confirmed → resolved / dismissed
- **会话状态**: active → completed / cancelled
- **版本状态**: pending → approved / rejected

### 2. 幂等性机制

所有事件上报接口支持：
- `idempotencyKey` 唯一幂等键
- 最大 3 次重试限制
- 重复调用返回相同结果

### 3. 自动重新计算

当以下事件发生时，系统会自动重新计算相关漏报记录：
- 页面事件状态变更
- 调试会话结束

### 4. 验收报告导出

支持导出 JSON 和 Excel 两种格式：
- JSON: 适合程序处理
- Excel: 适合非研发人员查看，包含友好的中文列名和统计概览

### 5. 修正路径与复盘

每个漏报记录支持：
- 记录修正步骤（correctionPath）
- 保存操作人、时间、原因
- 完整的历史变更日志

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stats | 获取统计数据 |
| GET | /api/tracking/points | 查询埋点定义 |
| POST | /api/tracking/points | 创建埋点定义 |
| PUT | /api/tracking/points/:id | 更新埋点定义 |
| POST | /api/tracking/event | 上报页面事件（幂等） |
| GET | /api/session | 查询调试会话 |
| POST | /api/session/start | 开始调试会话 |
| POST | /api/session/:id/complete | 结束调试会话 |
| GET | /api/session/:sessionId/detail | 会话详情 |
| GET | /api/detection | 查询漏报检测 |
| POST | /api/detection/:id/confirm | 确认漏报 |
| POST | /api/detection/:id/resolve | 标记已解决 |
| POST | /api/detection/:id/dismiss | 忽略漏报 |
| GET | /api/detection/stats/trend | 漏报趋势 |
| GET | /api/detection/stats/bypage | 页面分布 |
| GET | /api/report/acceptance/:sessionId | 验收报告 JSON |
| GET | /api/report/acceptance/:sessionId/excel | 验收报告 Excel |
| GET | /api/version | 版本列表 |
| POST | /api/version | 创建版本 |
| POST | /api/version/:id/approve | 批准版本 |
| POST | /api/version/:id/reject | 驳回版本 |

## 使用流程示例

1. **创建版本**: 在"版本复核"页面创建新版本
2. **配置埋点**: 在"埋点管理"页面配置该版本的埋点定义
3. **开始调试**: 在"调试会话"页面创建新会话
4. **触发埋点**: 在业务系统中正常操作，触发埋点上报
5. **结束会话**: 结束调试会话，系统自动检测漏报
6. **处理漏报**: 在"漏报检测"页面确认漏报，记录修正步骤
7. **导出报告**: 导出验收报告，包含所有统计信息
8. **版本复核**: 复核版本，批准或驳回

## 注意事项

- 首次运行需要执行 `npx prisma db push` 初始化数据库
- 测试数据中已预置了一个完整的验收会话（版本 v2.1.0）
- Excel 导出使用 xlsx 库，支持所有主流浏览器
- 幂等键建议使用 UUID 或足够唯一的业务标识

## License

MIT
