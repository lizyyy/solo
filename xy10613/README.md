# 知识库文章发布同步系统

一个全栈Web应用，用于管理知识库文章的发布流程，包括版本控制、评审记录、回滚历史和异常监控。

## 功能特性

### 1. 异常看板
- 文章总数、已发布、审核中、异常数量统计
- 异常列表展示索引异常和发布失败记录
- 实时刷新功能

### 2. 文章管理
- 文章列表展示，支持按分类、状态、关键词筛选
- 新建文章功能
- 文章发布校验（需先通过审核）
- 支持分页查询

### 3. 文章详情
- 基本信息展示
- 版本历史管理，支持回滚到历史版本
- 评审记录管理，支持添加评审意见
- 发布记录追踪（变更前后值）
- 回滚记录查看
- 人工调整记录

### 4. 批量导入
- CSV文件上传导入，支持下载模板
- 实时显示导入进度
- 导入历史记录展示，包含成功/失败数量
- 错误详情查看功能
- 自动创建初始版本记录

### 5. 报表导出
- 按操作人筛选
- 按发布类型筛选（首次发布、更新、回滚）
- 按时间范围筛选
- 导出Excel报表

### 6. 业务规则
- **线上发布校验**: 文章必须通过审核才能发布
- **搜索索引异常处理**: 发布时模拟索引异常，记录失败原因
- **阅读反馈汇总**: 记录阅读量和评分数据
- **人工调整留痕**: 所有人工操作都有历史记录

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- ExcelJS 导出Excel
- Multer 文件上传
- csv-parser CSV解析

### 前端
- Vue 3
- Element Plus UI组件库
- Vue Router 路由
- Axios HTTP客户端

## 项目结构

```
knowledge-base-sync/
├── server/
│   ├── index.js              # 服务器入口
│   ├── routes/
│   │   ├── articles.js       # 文章相关API
│   │   └── reports.js        # 报表相关API
│   ├── utils/
│   │   └── db.js             # 数据库工具
│   └── scripts/
│       ├── initDB.js         # 数据库初始化
│       └── seedData.js       # 演示数据生成
├── client/
│   ├── package.json
│   ├── vue.config.js
│   └── src/
│       ├── main.js
│       ├── router/
│       │   └── index.js
│       ├── App.vue
│       └── views/
│           ├── Dashboard.vue      # 异常看板
│           ├── Articles.vue       # 文章列表
│           ├── ArticleDetail.vue  # 文章详情
│           └── Reports.vue        # 报表导出
├── data/                          # 数据库文件目录
└── package.json
```

## 快速开始

### ⚡ 一键启动（推荐）

```bash
# 自动完成环境检查、依赖安装、数据库初始化
npm run setup

# 启动应用
npm run dev
```

---

### 分步启动

#### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..
```

#### 2. 初始化数据库

```bash
# 创建数据库表（自动创建data目录）
npm run init-db

# 生成演示数据（可选，包含20篇文章及完整历史）
npm run seed-data
```

#### 3. 启动应用

```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：分别启动
# 启动后端（端口3000）
npm run server
# 启动前端（端口8080）
cd client && npm run serve
```

#### 4. 访问应用
- 前端地址: http://localhost:8080
- 后端API: http://localhost:3000

---

### ✅ 功能验证清单

1. **异常看板**: 访问首页，查看统计数据和异常列表
2. **文章管理**: 进入「文章列表」，可新建、筛选、发布
3. **批量导入**: 进入「批量导入」，可下载模板、上传CSV、查看历史
4. **报表导出**: 进入「报表导出」，可筛选、导出Excel
5. **文章详情**: 点击文章，可查看版本历史、评审记录、发布记录、回滚版本

## API接口说明

### 文章相关
- `GET /api/articles` - 获取文章列表
- `GET /api/articles/stats` - 获取统计数据
- `GET /api/articles/anomalies` - 获取异常列表
- `GET /api/articles/:id` - 获取文章详情
- `POST /api/articles` - 创建文章
- `PUT /api/articles/:id` - 更新文章
- `POST /api/articles/:id/review` - 添加评审
- `POST /api/articles/:id/publish` - 发布文章
- `POST /api/articles/:id/rollback` - 回滚文章版本

### 报表相关
- `GET /api/reports/publishes` - 获取发布记录列表
- `GET /api/reports/operators` - 获取操作人列表
- `GET /api/reports/export` - 导出Excel报表

### 导入相关
- `POST /api/imports/articles` - 批量导入文章（CSV文件上传）
- `GET /api/imports/history` - 获取导入历史记录
- `GET /api/imports/history/:id` - 获取单条导入详情
- `GET /api/imports/template` - 下载导入模板

## 数据模型

### articles (文章表)
- id: 主键
- title: 标题
- content: 内容
- category: 分类
- status: 状态 (draft/reviewing/approved/published/archived)
- author: 作者
- current_version: 当前版本
- created_at: 创建时间
- updated_at: 更新时间
- published_at: 发布时间
- search_index_status: 搜索索引状态 (success/failed/pending)
- read_feedback_score: 阅读反馈评分
- read_count: 阅读量

### article_versions (版本表)
- id: 主键
- article_id: 文章ID
- version_number: 版本号
- title: 标题快照
- content: 内容快照
- author: 作者
- change_log: 变更说明

### reviews (评审表)
- id: 主键
- article_id: 文章ID
- version_id: 版本ID
- reviewer: 评审人
- comment: 评审意见
- status: 评审状态
- created_at: 创建时间

### publish_records (发布记录表)
- id: 主键
- article_id: 文章ID
- version_id: 版本ID
- publish_type: 发布类型 (first_publish/update/rollback)
- operator: 操作人
- before_value: 变更前值（JSON）
- after_value: 变更后值（JSON）
- status: 发布状态 (success/failed)
- error_message: 错误信息
- created_at: 创建时间

### rollback_records (回滚记录表)
- id: 主键
- article_id: 文章ID
- from_version_id: 原版本ID
- to_version_id: 目标版本ID
- operator: 操作人
- reason: 回滚原因
- created_at: 创建时间

### read_feedbacks (阅读反馈表)
- id: 主键
- article_id: 文章ID
- reader: 读者
- score: 评分
- comment: 评论
- created_at: 创建时间

### manual_adjustments (人工调整表)
- id: 主键
- article_id: 文章ID
- operator: 操作人
- adjust_type: 调整类型
- field_name: 字段名
- before_value: 调整前值
- after_value: 调整后值
- reason: 调整原因
- created_at: 创建时间

### import_history (导入历史表)
- id: 主键
- file_name: 文件名
- operator: 操作人
- total_count: 总记录数
- success_count: 成功数量
- fail_count: 失败数量
- error_details: 错误详情（JSON）
- status: 状态 (processing/success/partial)
- created_at: 创建时间
- completed_at: 完成时间

## 注意事项

1. 数据库文件存放在 `data/` 目录下，重启服务数据不会丢失
2. 演示数据包含20篇文章，每条都有版本、评审、发布等完整历史记录
3. 发布操作有10%概率模拟索引异常，用于测试异常看板功能
4. 所有操作都会记录操作人和时间戳，便于审计追踪
