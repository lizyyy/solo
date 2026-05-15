# 端点迁移助手

一个用于管理系统拆分后新旧端点并行迁移的全栈Web应用。

## 功能特性

### 核心数据模型
- **旧端点**：记录待迁移的旧系统API端点
- **新端点**：记录新系统API端点及其状态
- **调用系统**：记录调用方系统信息
- **兼容层**：配置新旧端点之间的转换规则
- **切流批次**：按批次管理流量切换
- **请求日志**：记录每次请求的输入、输出和责任节点
- **回滚记录**：记录切流回滚操作

### 业务规则引擎
- **批次验证**：检查切流前置条件（新端点就绪、兼容层激活）
- **调用对账**：对比新旧系统响应一致性
- **兼容路由**：按比例随机路由到新旧端点
- **切流确认**：对账通过率达标后确认完成
- **失败回滚**：支持随时回滚已执行的切流

### 前端界面
- **仪表盘**：迁移进度统计和快捷操作
- **异常队列**：集中查看所有失败请求
- **切流批次**：管理批次生命周期（计划→执行→确认/回滚）
- **端点管理**：统一管理旧端点、新端点、调用系统、兼容层
- **历史轨迹**：完整的请求日志记录

## 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：React 18 + Vite
- **数据持久化**：SQLite（文件存储，无需额外数据库）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务

```bash
npm run server
```
后端服务将在 http://localhost:3001 启动

### 3. 启动前端开发服务

```bash
npm run client
```
前端服务将在 http://localhost:3000 启动

### 4. 同时启动前后端（推荐）

```bash
npm run dev
```

### 5. 运行自检脚本

确保后端服务启动后，运行：

```bash
npm test
```

## API接口文档

### 旧端点管理
- `POST /api/old-endpoints` - 创建旧端点
- `GET /api/old-endpoints` - 查询旧端点列表

### 新端点管理
- `POST /api/new-endpoints` - 创建新端点
- `GET /api/new-endpoints` - 查询新端点列表
- `PUT /api/new-endpoints/:id/status` - 更新新端点状态

### 调用系统管理
- `POST /api/calling-systems` - 创建调用系统
- `GET /api/calling-systems` - 查询调用系统列表

### 兼容层管理
- `POST /api/compatibility-layers` - 创建兼容层
- `GET /api/compatibility-layers` - 查询兼容层列表
- `PUT /api/compatibility-layers/:id/status` - 更新兼容层状态

### 切流批次管理
- `POST /api/traffic-batches` - 创建切流批次
- `GET /api/traffic-batches` - 查询切流批次列表
- `PUT /api/traffic-batches/:id/status` - 更新批次状态
- `POST /api/traffic-batches/:id/validate` - 验证批次前置条件
- `POST /api/traffic-batches/:id/confirm` - 确认切流完成
- `POST /api/traffic-batches/:id/rollback` - 执行回滚

### 对账记录
- `POST /api/reconciliation` - 记录对账结果
- `GET /api/reconciliation/:batchId` - 查询批次对账记录

### 请求日志
- `POST /api/request-logs` - 记录请求日志
- `GET /api/request-logs` - 查询请求日志
- `GET /api/exceptions` - 查询异常队列

### 统计与导出
- `GET /api/stats` - 获取迁移统计
- `GET /api/rollback-records` - 查询回滚记录
- `GET /api/export/migration-report` - 导出迁移报告CSV
- `GET /api/export/exception-report` - 导出异常报告CSV

## 使用流程

1. **登记基础信息**
   - 登记旧端点
   - 登记新端点并标记为就绪
   - 登记调用系统
   - 配置并激活兼容层

2. **创建切流批次**
   - 选择调用系统和目标新端点
   - 设置切流比例（建议从小到大：10%→30%→50%→100%）

3. **执行切流**
   - 验证批次（检查新端点就绪、兼容层激活）
   - 开始执行切流
   - 观察异常队列，如有问题立即回滚

4. **确认或回滚**
   - 对账通过率≥95%时确认完成
   - 出现问题时执行回滚，记录回滚原因

## 数据存储

所有数据存储在 `data/migration.db` SQLite文件中，重启服务后数据不丢失。

## 项目结构

```
├── server/
│   ├── index.js          # Express服务入口和路由
│   ├── database.js       # 数据库初始化和工具函数
│   └── rulesEngine.js    # 业务规则引擎
├── client/
│   ├── index.html        # HTML入口
│   └── src/
│       ├── main.jsx      # React入口
│       ├── App.jsx       # 主应用组件
│       ├── App.css       # 全局样式
│       └── components/   # React组件
├── tests/
│   └── self-check.js     # 自检脚本
├── data/                 # SQLite数据库文件目录
└── package.json          # 项目配置
```
