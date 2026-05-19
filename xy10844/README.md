# 向量索引重建控制台

一个偏技术方向的全栈Web/API应用，用于管理向量索引重建任务，提供暂停、恢复、验证、灰度切换和回滚等功能。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Ant Design + Vite

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务逻辑
│   │   ├── constants/      # 常量定义
│   │   └── scripts/        # 初始化脚本
│   ├── data/               # SQLite数据库文件
│   └── package.json
└── frontend/               # 前端应用
    ├── src/
    │   ├── pages/          # 页面组件
    │   └── api/            # API封装
    ├── index.html
    └── package.json
```

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 生成示例数据（可选）

```bash
npm run seed-data
```

### 4. 启动后端服务

```bash
npm start
# 服务将在 http://localhost:3001 启动
```

### 5. 安装前端依赖（新开终端）

```bash
cd frontend
npm install
```

### 6. 启动前端开发服务器

```bash
npm run dev
# 服务将在 http://localhost:3000 启动
```

## 核心功能

### 1. 阶段状态机

- 初始化 → 数据准备 → 索引构建 → 验证查询 → 灰度发布 → 全量切换 → 完成
- 每个阶段支持暂停/恢复
- 严格的状态转换规则，由后端校验

### 2. 暂停/恢复

- 在任意执行阶段可以暂停任务
- 记录暂停点和暂停原因
- 支持从暂停点恢复执行

### 3. 验证查询

- 支持提交验证结果
- 验证不通过时自动拦截任务
- 记录详细的验证信息

### 4. 灰度切换

- 支持0-100%的灰度流量调整
- 记录每次灰度调整历史
- 支持回滚到之前版本

### 5. 回滚记录

- 完整记录所有切换操作
- 支持从任意阶段回滚
- 记录回滚原因和操作人

### 6. 手动补偿入口

- 提供手动推进阶段的能力
- 记录所有手动操作日志
- 支持异常情况下的人工干预

## API 接口

### 任务管理

- `POST /api/tasks` - 创建新任务
- `GET /api/tasks` - 获取任务列表（支持筛选）
- `GET /api/tasks/:id` - 获取任务详情
- `GET /api/tasks/stats` - 获取任务统计
- `GET /api/tasks/export/csv` - 导出任务CSV

### 状态操作

- `PUT /api/tasks/:id/stage` - 更新任务阶段
- `PUT /api/tasks/:id/pause` - 暂停任务
- `PUT /api/tasks/:id/resume` - 恢复任务
- `PUT /api/tasks/:id/verify` - 提交验证结果
- `PUT /api/tasks/:id/gray-traffic` - 调整灰度流量
- `PUT /api/tasks/:id/rollback` - 回滚任务

### 日志和记录

- `GET /api/tasks/:id/logs` - 获取任务操作日志
- `GET /api/tasks/:id/switch-records` - 获取切换记录

## 数据模型

### 任务表 (index_rebuild_tasks)

- id: 任务ID
- index_name: 索引名称
- data_source: 数据源
- stage: 当前阶段
- status: 当前状态
- pause_point: 暂停点
- current_version: 当前版本
- target_version: 目标版本
- verify_query: 验证查询
- verify_result: 验证结果
- gray_traffic_percentage: 灰度流量百分比
- error_message: 错误信息
- state_reason: 状态原因
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间
- completed_at: 完成时间

### 操作日志表 (task_logs)

记录所有任务操作的详细日志。

### 切换记录表 (switch_records)

记录所有灰度切换和回滚操作。

## 示例数据

运行 `npm run seed-data` 将生成以下示例任务：

1. **正常流程** - 完整走完所有阶段的成功任务
2. **拦截流程** - 验证不通过被拦截的任务
3. **失败流程** - 数据准备阶段失败的任务
4. **回滚流程** - 灰度阶段触发回滚的任务
5. **进行中流程** - 正在构建索引的任务

## 前端功能

### 总览页面

- 任务统计卡片
- 任务列表表格
- 按阶段/状态筛选
- 搜索索引名称
- 导出CSV
- 创建新任务

### 详情页面

- 任务进度步骤条
- 基本信息展示
- 验证信息展示
- 操作日志
- 切换记录
- 暂停/恢复按钮
- 验证结果提交
- 灰度流量调整
- 回滚功能
- 手动补偿入口

## 开发说明

### 后端开发

```bash
cd backend
npm run dev  # 使用nodemon自动重启
```

### 前端开发

```bash
cd frontend
npm run dev  # 使用Vite开发服务器
```

### 数据库

使用SQLite，数据库文件位于 `backend/data/index_rebuild.db`。

可以使用SQLite客户端查看数据库内容：

```bash
sqlite3 backend/data/index_rebuild.db
```