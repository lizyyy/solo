# 通知中心偏好管理系统

## 项目概述

这是一个全栈管理系统，用于管理通知中心的用户偏好、发送回执、重试记录和导出功能。

### 核心功能

1. **用户偏好管理**
   - 用户渠道配置
   - 订阅主题管理
   - 免打扰时段设置
   - 版本历史和回滚功能

2. **发送回执管理**
   - 消息发送状态跟踪
   - 异常回执检测
   - 错误信息记录

3. **重试记录管理**
   - 失败消息人工确认
   - 重试执行记录
   - 重试状态跟踪

4. **数据导出**
   - 用户偏好导出
   - 发送回执导出
   - 重试记录导出
   - 统计报表导出

### 技术特性

- **幂等性保证**：通过 request_id 防止重复请求
- **数据持久化**：SQLite 数据库存储所有历史记录
- **版本管理**：所有偏好变更都有版本记录，支持回滚
- **异常处理**：专门的异常回执检测和处理流程

## 技术栈

### 后端
- Python 3.9+
- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- Pydantic 2.5.0
- Pandas 2.1.3 (用于 Excel 导出)

### 前端
- Vue 3
- Element Plus
- Axios
- Vue Router

## 项目结构

```
.
├── backend/                 # 后端代码
│   ├── main.py             # FastAPI 应用入口
│   ├── database.py         # 数据库模型和连接
│   ├── schemas.py          # Pydantic 数据模型
│   ├── services.py         # 业务逻辑服务
│   ├── requirements.txt    # Python 依赖
│   └── exports/            # 导出文件目录（自动创建）
└── frontend/               # 前端代码
    ├── src/
    │   ├── main.js         # 应用入口
    │   ├── App.vue         # 根组件
    │   ├── router/         # 路由配置
    │   ├── views/          # 页面组件
    │   └── api/            # API 封装
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 快速开始

### 后端启动

1. 进入后端目录
```bash
cd backend
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 启动服务
```bash
python main.py
```

后端服务将在 http://localhost:8000 启动

API 文档地址：http://localhost:8000/docs

### 前端启动

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务
```bash
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 数据库模型

### UserPreference (用户偏好)
- id: 主键
- user_id: 用户ID
- request_id: 请求ID（用于幂等）
- channel: 通知渠道
- topics: 订阅主题列表
- dnd_start_time: 免打扰开始时间
- dnd_end_time: 免打扰结束时间
- dnd_enabled: 免打扰是否开启
- status: 状态
- version: 版本号
- created_at/updated_at: 时间戳
- created_by/updated_by: 操作人

### SendReceipt (发送回执)
- id: 主键
- preference_id: 关联偏好ID
- message_id: 消息ID（幂等）
- request_id: 请求ID
- user_id: 用户ID
- channel: 渠道
- topic: 主题
- status: 发送状态
- sent_at/delivered_at/read_at/failed_at: 各状态时间
- error_code/error_message: 错误信息
- retry_count: 重试次数

### RetryRecord (重试记录)
- id: 主键
- preference_id: 关联偏好ID
- receipt_id: 关联回执ID
- retry_number: 重试次数
- status: 重试状态
- manual_confirmed: 是否人工确认
- confirmed_by/confirmed_at: 确认信息
- executed_at: 执行时间
- result/error_message: 结果和错误信息

### VersionHistory (版本历史)
- id: 主键
- preference_id: 关联偏好ID
- user_id: 用户ID
- version: 版本号
- channel/topics/dnd_*/status: 快照数据
- change_reason: 变更原因
- changed_by: 变更人
- snapshot: 完整快照JSON

### IdempotentRequest (幂等请求)
- id: 主键
- request_id: 请求ID（唯一）
- request_type: 请求类型
- status: 处理状态
- result/error_message: 结果和错误信息

### ExportRecord (导出记录)
- id: 主键
- export_id: 导出ID（唯一）
- export_type: 导出类型
- filters: 过滤条件
- file_path/file_name: 文件路径和名称
- status: 导出状态
- total_records: 记录数
- created_by: 创建人
- created_at/completed_at: 时间戳

## API 接口

### 偏好管理
- `POST /api/preferences` - 创建偏好
- `PUT /api/preferences/{id}` - 更新偏好
- `POST /api/preferences/{id}/rollback/{version}` - 回滚到指定版本
- `GET /api/preferences` - 获取偏好列表
- `GET /api/preferences/{id}` - 获取偏好详情
- `GET /api/preferences/{id}/versions` - 获取版本历史

### 回执管理
- `POST /api/receipts` - 创建回执
- `PUT /api/receipts/{id}` - 更新回执状态
- `GET /api/receipts` - 获取回执列表
- `GET /api/receipts/abnormal` - 获取异常回执

### 重试管理
- `POST /api/retry-records` - 创建重试记录
- `POST /api/retry-records/{id}/confirm` - 人工确认重试
- `POST /api/retry-records/{id}/execute` - 执行重试
- `GET /api/retry-records` - 获取重试记录列表

### 导出管理
- `POST /api/exports` - 创建导出任务
- `GET /api/exports` - 获取导出列表
- `GET /api/exports/{export_id}/download` - 下载导出文件

### 幂等检查
- `GET /api/idempotent/{request_id}` - 检查请求幂等状态

## 前端页面

1. **偏好管理** (`/preferences`)
   - 列表展示
   - 筛选查询
   - 新增/编辑偏好
   - 复核抽屉
   - 版本历史查看和回滚

2. **发送回执** (`/receipts`)
   - 回执列表
   - 异常检测
   - 状态更新
   - 创建重试记录

3. **重试记录** (`/retry-records`)
   - 重试列表
   - 人工确认
   - 执行重试

4. **导出管理** (`/exports`)
   - 导出任务列表
   - 新建导出
   - 下载文件

## 使用说明

### 创建用户偏好

1. 进入"偏好管理"页面
2. 点击"新增偏好"按钮
3. 填写用户ID、选择渠道和订阅主题
4. 配置免打扰时段（可选）
5. 填写请求ID（用于幂等）和操作人
6. 提交保存

### 处理发送失败

1. 进入"发送回执"页面
2. 点击"查看异常"或筛选失败状态
3. 对失败的回执点击"创建重试"
4. 在"重试记录"页面对重试进行人工确认
5. 确认后执行重试

### 导出数据

1. 进入"导出管理"页面
2. 点击"新建导出"
3. 选择导出类型
4. 提交后等待生成完成
5. 状态变为"已完成"后点击下载

## 注意事项

1. **幂等性**：所有创建和更新操作都需要提供 request_id，系统会根据 request_id 保证操作的幂等性
2. **数据持久化**：所有历史记录都会保留，重启服务不影响数据
3. **版本管理**：每次偏好更新都会生成新版本，支持随时回滚
4. **导出文件**：导出的 Excel 文件保存在 backend/exports 目录下

## 开发建议

1. 生产环境建议使用 MySQL 或 PostgreSQL 替代 SQLite
2. 可以添加用户认证和权限管理
3. 支持配置定时任务自动执行重试
4. 可以添加 WebSocket 实现实时状态更新
5. 建议添加日志记录和监控告警