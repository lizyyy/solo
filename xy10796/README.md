# 种子数据管理系统 (Seed Data Manager)

一个完整的多环境种子数据管理全栈项目，支持幂等性保证、状态机管理、失败回滚与复核、清理策略修正路径等企业级特性。

## 功能特性

### 后端 (Backend)
- ✅ **环境管理**：管理多个环境（开发、测试、预发布、生产）
- ✅ **数据集版本管理**：支持版本控制、导入顺序配置
- ✅ **种子任务状态机**：pending → processing → success/failed → rollback → retry
- ✅ **幂等性保证**：基于 requestId 的重复请求检测，防止重复写入
- ✅ **重试限制**：可配置最大重试次数，防止无限重试
- ✅ **回滚与复核**：支持任务回滚，回滚记录可审核
- ✅ **清理策略管理**：支持软删除、硬删除、归档策略，包含修正路径
- ✅ **数据导出**：Excel 格式导出任务报告
- ✅ **统计看板 API**：任务趋势、成功率统计

### 前端 (Frontend)
- ✅ **统计卡片**：总任务数、成功任务、失败任务、成功率、导入记录数等
- ✅ **趋势图表**：任务执行趋势折线图（近7天）
- ✅ **任务管理**：创建任务、查看详情、重试、回滚、导出
- ✅ **筛选表格**：按状态、环境筛选，分页查询
- ✅ **环境管理**：环境增删改查
- ✅ **数据集版本管理**：版本发布、记录数重新计算
- ✅ **清理策略管理**：策略执行、标记失败、修正路径编辑
- ✅ **回滚审核**：审核回滚记录，添加审核意见

## 技术栈

### 后端
- Node.js + Express + TypeScript
- Sequelize ORM (SQLite 数据库，可切换到 PostgreSQL)
- xlsx (Excel 导出)
- winston (日志)

### 前端
- React 18 + TypeScript
- Vite
- Ant Design 5.x
- Recharts (图表库)
- Axios

## 快速开始

### 安装依赖

```bash
# 安装所有依赖（根目录 + 后端 + 前端）
npm run install:all
```

### 启动开发环境

```bash
# 同时启动后端和前端
npm run dev

# 或分别启动
npm run dev:backend  # 后端运行在 http://localhost:3001
npm run dev:frontend # 前端运行在 http://localhost:3000
```

### 访问应用

- 前端应用：http://localhost:3000
- 后端 API：http://localhost:3001/api
- 健康检查：http://localhost:3001/api/health

## 验收测试指南

### 1. 页面操作流程

1. 打开 http://localhost:3000 查看数据看板
2. 点击左侧「任务管理」菜单
3. 点击「创建任务」按钮，选择环境和数据集，填写 requestId
4. 等待任务处理完成，查看任务状态从 pending → processing → success
5. 点击任务的「详情」按钮，查看导入记录和回滚记录
6. 点击「回滚」按钮，执行回滚操作
7. 查看回滚状态，可执行审核操作
8. 点击「导出」按钮，下载 Excel 报告

### 2. API 幂等性测试

```bash
# 确保后端服务已启动
# 然后运行幂等性测试脚本
node test-idempotency.js
```

测试脚本会验证：
- 相同 requestId 的两次请求返回相同任务 ID
- 系统不会创建重复任务
- 不同 requestId 会创建新任务

### 3. 清理策略修正路径测试

1. 进入「清理策略」页面
2. 创建新策略，填写修正路径
3. 执行策略
4. 标记策略为失败
5. 编辑策略的修正路径，记录处理方案
6. 验证修正路径已保存

### 4. 数据集版本变更重计算

1. 进入「数据集版本」页面
2. 编辑数据集，修改记录数或其他属性
3. 保存后系统会自动重新计算相关统计数据
4. 回到数据看板，验证统计数据已更新

## 核心 API 列表

### 任务相关
- `POST /api/tasks` - 创建种子任务（支持幂等）
- `GET /api/tasks` - 查询任务列表（支持筛选、分页）
- `GET /api/tasks/:id` - 查询任务详情
- `POST /api/tasks/:id/retry` - 重试任务
- `POST /api/tasks/:id/rollback` - 回滚任务
- `GET /api/tasks/:id/export` - 导出任务报告

### 回滚审核
- `POST /api/rollbacks/:rollbackId/review` - 审核回滚记录

### 环境管理
- `GET /api/environments` - 获取环境列表
- `POST /api/environments` - 创建环境
- `PUT /api/environments/:id` - 更新环境
- `DELETE /api/environments/:id` - 删除环境

### 数据集管理
- `GET /api/datasets` - 获取数据集列表
- `POST /api/datasets` - 创建数据集
- `PUT /api/datasets/:id` - 更新数据集（自动重计算统计）
- `POST /api/datasets/:id/publish` - 发布数据集版本

### 清理策略
- `GET /api/cleanup` - 获取策略列表
- `POST /api/cleanup` - 创建策略
- `POST /api/cleanup/:id/execute` - 执行策略
- `PUT /api/cleanup/:id/correction` - 更新修正路径
- `POST /api/cleanup/:id/fail` - 标记策略失败

### 统计看板
- `GET /api/dashboard/stats` - 获取看板统计数据
- `GET /api/dashboard/trend?days=7` - 获取任务趋势数据

## 项目结构

```
seed-data-manager/
├── backend/
│   ├── src/
│   │   ├── config/          # 配置文件（数据库、日志）
│   │   ├── models/          # 数据模型
│   │   ├── controllers/     # API 控制器
│   │   ├── services/        # 业务逻辑（状态机、幂等、报表）
│   │   ├── routes.ts        # 路由定义
│   │   └── index.ts         # 应用入口
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── types/           # TypeScript 类型定义
│   │   ├── services/        # API 服务
│   │   ├── pages/           # 页面组件
│   │   ├── App.tsx          # 应用主组件
│   │   └── main.tsx         # 应用入口
│   └── package.json
├── package.json             # 根项目配置
├── test-idempotency.js      # 幂等性测试脚本
└── README.md
```

## 状态机设计

### 种子任务状态流转
```
pending → processing → success
                     → failed → rolling_back → rolled_back → retrying → processing
```

### 回滚记录状态
```
pending → in_progress → completed → reviewed
                           → failed
```

## 关键特性实现说明

### 1. 幂等性保证
- 使用 `idempotencyKey = hash(environmentId + datasetVersionId + requestId)` 作为唯一键
- 每次创建任务前检查是否已存在该 key 的任务
- 若存在则直接返回已有任务，不创建新任务

### 2. 重试限制
- 每个任务可配置 `maxRetries`
- 每次重试时检查 `retryCount < maxRetries`
- 超过限制后禁止重试

### 3. 回滚与复核
- 回滚操作会创建 `RollbackRecord` 记录
- 记录包含原因、执行状态、审核人、审核意见
- 支持审核流程，保证操作可追溯

### 4. 清理策略修正路径
- 每个清理策略有 `correctionPath` 字段
- 当策略执行失败时，可记录修正步骤
- 修正路径可编辑，用于复盘和后续处理

### 5. 数据集版本重计算
- 当数据集版本更新时，自动重新计算相关任务的统计数据
- 保证数据看板的统计信息与实际一致

## 注意事项

1. 本项目使用 SQLite 作为数据库，生产环境建议切换到 PostgreSQL
2. 前端开发环境使用 Vite 的代理功能转发 API 请求到后端
3. 幂等性测试脚本需要 axios 依赖，确保已安装
4. 建议使用 Node.js 18+ 版本运行

## License

MIT
