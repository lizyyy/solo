# Reactor/Proactor 网络模型实验台

一个用于演示和对比 Reactor 和 Proactor 两种 I/O 多路复用网络模型的实验平台，适用于教学演示和新人培训。

## 功能特性

- **可配置实验参数**：连接数、读写事件数、回调耗时、超时时间、失败率、线程池大小
- **自定义 Handler 注册**：支持为不同事件类型注册自定义处理器
- **两种模型模拟**：
  - **Reactor**：同步 I/O + 事件就绪通知 + 单线程事件循环
  - **Proactor**：异步 I/O + 完成事件通知 + 线程池回调处理
- **对比分析**：执行时间、吞吐量、成功率、平均延迟、线程占用
- **事件时间线**：可视化展示两种模型的事件处理顺序和时序
- **报告导出**：支持 JSON 和 Markdown 格式导出
- **预设配置**：提供多个种子实验配置，快速开始对比测试
- **参数验证**：完善的参数校验和错误提示

## 项目结构

```
zy1197/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── core/              # 核心模拟模块
│   │   │   ├── eventSystem.js    # 事件系统（事件、队列、时间线）
│   │   │   ├── reactor.js        # Reactor 模型实现
│   │   │   ├── proactor.js       # Proactor 模型实现
│   │   │   └── experimentManager.js  # 实验管理器
│   │   ├── data/              # 数据持久化
│   │   │   └── database.js       # SQLite 数据库封装
│   │   ├── utils/             # 工具模块
│   │   │   ├── validator.js      # 参数验证器
│   │   │   └── seedData.js       # 种子数据
│   │   ├── routes/            # API 路由
│   │   │   └── experiments.js    # 实验相关路由
│   │   └── index.js           # 服务入口
│   ├── data/                   # 数据库文件目录
│   └── package.json
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── views/             # 页面组件
│   │   │   ├── HomeView.vue         # 首页/实验列表
│   │   │   ├── ExperimentCreateView.vue  # 创建实验
│   │   │   ├── ExperimentDetailView.vue  # 实验详情/对比
│   │   │   └── LearningView.vue       # 学习资源
│   │   ├── stores/            # 状态管理
│   │   │   └── experimentStore.js
│   │   ├── api/               # API 封装
│   │   │   └── index.js
│   │   ├── router/            # 路由配置
│   │   │   └── index.js
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css          # 全局样式
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 开发模式

```bash
# 启动后端服务（端口 3000）
cd backend
npm run dev

# 启动前端开发服务器（端口 5173）
cd frontend
npm run dev
```

访问 http://localhost:5173 即可使用实验台。

### 生产构建

```bash
# 构建前端
cd frontend
npm run build

# 启动后端服务（会自动服务前端静态文件）
cd backend
npm start
```

## API 文档

### 健康检查

```bash
GET /api/health
```

### 获取系统信息

```bash
GET /api/info
```

### 实验管理

```bash
# 获取实验列表
GET /api/experiments

# 创建实验
POST /api/experiments
Content-Type: application/json

{
  "name": "实验名称",
  "description": "实验描述",
  "connections": 10,
  "readEvents": 100,
  "writeEvents": 50,
  "callbackDelay": 10,
  "readTimeout": 5000,
  "writeTimeout": 5000,
  "failureRate": 0,
  "threadPoolSize": 4,
  "handlers": []
}

# 获取实验详情
GET /api/experiments/:id

# 运行实验
POST /api/experiments/:id/run

# 验证实验配置
POST /api/experiments/validate

# 获取事件时间线
GET /api/experiments/:id/timeline?model=Reactor

# 导出 JSON
GET /api/experiments/:id/export/json

# 导出 Markdown
GET /api/experiments/:id/export/markdown

# 删除实验
DELETE /api/experiments/:id
```

### 获取种子数据

```bash
GET /api/experiments/seeds
```

## 两种模型对比

### Reactor 模型

- **I/O 类型**：同步 I/O
- **通知时机**：I/O 就绪时通知
- **执行主体**：应用程序主动执行读写
- **线程模型**：单线程事件循环
- **特点**：模型简单，跨平台兼容性好
- **适用场景**：短连接、高并发、CPU 密集型

### Proactor 模型

- **I/O 类型**：异步 I/O
- **通知时机**：I/O 完成时通知
- **执行主体**：操作系统执行实际读写
- **线程模型**：线程池处理回调
- **特点**：真正的非阻塞，高吞吐
- **适用场景**：长连接、高吞吐、I/O 密集型

## 使用示例

1. **创建实验**：配置连接数、事件数、失败率等参数
2. **运行对比**：系统依次运行 Reactor 和 Proactor 模型
3. **分析结果**：
   - 查看执行时间、吞吐量对比
   - 分析事件时间线和回调顺序
   - 对比线程占用和队列堆积情况
4. **导出报告**：下载 JSON 或 Markdown 格式的报告

## 预设实验配置

系统提供 5 个预设实验配置：

1. **基础对比实验 - 小负载**：轻负载下的基本行为差异
2. **中等负载对比实验**：测试中等负载下的性能表现
3. **高失败率压力测试**：测试异常处理能力
4. **线程池大小对比测试**：不同线程池大小的影响
5. **超时场景测试**：超时场景下的行为差异

## 开发说明

### 后端技术栈

- **框架**：Express.js
- **数据库**：SQL.js（SQLite 内存数据库，持久化到文件）
- **验证**：Joi
- **其他**：uuid、helmet、cors、compression

### 前端技术栈

- **框架**：Vue 3
- **状态管理**：Pinia
- **路由**：Vue Router
- **样式**：Tailwind CSS
- **构建工具**：Vite
- **图表**：Chart.js + vue-chartjs（预留）

## 注意事项

1. **回调耗时**：设置过长的回调耗时会阻塞事件循环，影响实验结果
2. **失败率**：失败率是 0-1 之间的小数，表示事件处理失败的概率
3. **事件数量**：总事件数 = 连接数 × (读事件数 + 写事件数)，建议不超过 100 万
4. **线程池**：仅 Proactor 模型使用线程池，Reactor 是单线程

## License

MIT License
