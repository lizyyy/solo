# 🎙️ 语音转写回调台

一个偏技术方向的全栈 Web/API 应用，用于管理音频转写任务、监控回调状态、处理异常重试。

## ✨ 核心功能

### 数据模型
- **音频任务 (Audio Task)**: 管理音频文件的基本信息和整体状态
- **转写阶段 (Transcription Stage)**: 音频分析 → 语音识别 → 文本处理
- **回调目标 (Callback Target)**: 存储回调URL、签名密钥、重试策略
- **文本片段 (Text Fragment)**: 保存转写结果，包含说话人、时间戳、置信度
- **失败记录 (Failure Record)**: 记录每次失败的原因、请求/响应、责任节点
- **补发记录 (Retry Record)**: 记录重试历史和结果

### 业务规则
- ✅ **异步转写状态管理**: 从等待中 → 转写中 → 转写完成 → 等待回调 → (回调失败/已完成)
- ✅ **文本片段保存**: 支持多说话人、时间戳、置信度
- ✅ **回调签名验证**: HMAC-SHA256 签名机制
- ✅ **失败自动补发**: 指数退避重试策略，支持最大重试次数配置
- ✅ **完成对账**: 完整的状态变更历史记录

## 🚀 快速开始

### 环境要求
- Node.js >= 16.x
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 启动开发服务
```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:server    # 后端服务端口 3001
npm run dev:client    # 前端服务端口 3000
```

### 初始化演示数据
```bash
# 在另一个终端运行，生成演示数据
npm run seed
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 📡 API 接口

### 任务管理
```
POST   /api/tasks              # 创建转写任务
GET    /api/tasks              # 查询任务列表
GET    /api/tasks/failed       # 查询失败任务
GET    /api/tasks/:id          # 获取任务详情
```

### 状态推进
```
POST   /api/tasks/:id/status   # 更新任务状态
POST   /api/tasks/:id/advance  # 推进转写阶段
POST   /api/tasks/:id/complete-stage  # 完成某个转写阶段
POST   /api/tasks/:id/fragments       # 保存转写结果
```

### 回调处理
```
POST   /api/tasks/:id/callback # 执行回调
POST   /api/tasks/:id/retry    # 重试回调
```

### 导出功能
```
GET    /api/tasks/:id/export       # 导出 JSON
GET    /api/tasks/:id/export/csv   # 导出 CSV
```

## 🎯 界面功能

### 异常队列
- 醒目展示所有回调失败的任务
- 显示重试次数、最后错误信息
- 提供"立即重试"按钮

### 状态按钮
- 任务卡片显示当前状态徽章
- 详情页可手动推进状态
- 状态变更实时生效

### 历史轨迹
- 时间线展示完整状态变更历史
- 记录操作者和备注信息
- 可追溯每个阶段的耗时

### 导出入口
- 支持 JSON 和 CSV 两种格式
- 包含完整的转写结果和回调历史

## 📁 项目结构

```
.
├── server/
│   ├── index.ts              # 服务入口
│   ├── database.ts           # 数据库初始化和工具
│   ├── types.ts              # TypeScript 类型定义
│   ├── services/
│   │   └── taskService.ts    # 业务逻辑层
│   └── routes/
│       └── tasks.ts          # API 路由
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx          # React 入口
│       ├── App.tsx           # 主应用组件
│       ├── api.ts            # API 客户端
│       ├── types.ts          # 前端类型
│       └── index.css         # 样式文件
├── data/                      # SQLite 数据库文件
├── exports/                   # 导出文件目录
└── package.json
```

## 🔧 技术栈

### 后端
- **Node.js + Express**: Web 服务框架
- **SQLite3**: 轻量级关系数据库
- **TypeScript**: 类型安全

### 前端
- **React 18**: UI 框架
- **Vite**: 构建工具
- **Axios**: HTTP 客户端
- **Day.js**: 日期处理

## 📊 演示流程

1. 点击"创建转写任务"生成新任务
2. 点击任务查看详情
3. 在详情页可查看:
   - 转写阶段进度
   - 转写文本结果
   - 失败记录（含责任节点）
   - 重试历史
   - 完整状态时间线
4. 对失败任务点击"重试回调"（前2次会模拟失败用于演示）
5. 点击"导出数据"下载完整记录

## 💡 设计要点

1. **数据持久化**: 所有操作保存到 SQLite，刷新不丢失
2. **责任节点追踪**: 每次失败都记录责任节点，便于问题定位
3. **幂等性设计**: 支持重复回调，状态变更有历史记录
4. **可观测性**: 完整的日志和导出功能
5. **演示友好**: 内置模拟失败机制，便于展示异常处理流程
