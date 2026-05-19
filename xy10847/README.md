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

## 📊 完整演示流程

### 方式一：通过前端界面操作
1. **创建任务**：点击"创建转写任务"按钮生成新任务
2. **查看详情**：点击任务进入详情弹窗
3. **开始转写**：
   - 状态为"等待中"时，点击"开始转写"按钮
   - 状态变为"转写中"
4. **推进转写阶段**：
   - 点击"推进下一阶段: 音频分析"
   - 点击"完成当前阶段: 音频分析"
   - 点击"推进下一阶段: 语音识别"
   - 点击"完成当前阶段: 语音识别"
   - 点击"推进下一阶段: 文本处理"
   - 点击"完成当前阶段: 文本处理"
   - 三个阶段全部完成后，任务状态自动变为"转写完成"
5. **保存转写结果**：
   - 点击"保存演示转写结果"，保存6段对话文本
6. **执行回调（演示模式）**：
   - 点击"执行回调（演示模式：前2次失败）"
   - 第1次：模拟超时失败，状态变为"回调失败"，失败记录新增
   - 第2次：点击"重试回调（演示模式）"，再次模拟失败
   - 第3次：重试次数 ≥ 2，出现"强制执行真实HTTP回调"按钮，发送真实POST请求到回调URL
7. **查看状态变化**：
   - 状态历史完整记录每次操作
   - 失败记录包含责任节点、错误信息、请求快照
   - 重试记录包含每次尝试的结果
8. **导出数据**：点击"导出数据"可下载JSON或CSV格式

### 方式二：curl API 调用示例
```bash
# 1. 创建任务
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"audio_url": "test.mp3", "callback_url": "https://httpbin.org/post"}'

# 2. 更新状态为转写中
curl -X POST http://localhost:3001/api/tasks/{taskId}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "transcribing", "operator": "api"}'

# 3. 推进阶段
curl -X POST http://localhost:3001/api/tasks/{taskId}/advance

# 4. 完成阶段
curl -X POST http://localhost:3001/api/tasks/{taskId}/complete-stage \
  -H "Content-Type: application/json" \
  -d '{"stage_name": "audio_analysis"}'

# 5. 执行回调
curl -X POST http://localhost:3001/api/tasks/{taskId}/callback \
  -H "Content-Type: application/json" \
  -d '{"demo_mode": true}'
```

## 🔒 签名验证机制

- 当设置了`secret_key`时，系统会自动为回调请求生成HMAC-SHA256签名
- 签名放置在`X-Signature`请求头中
- 业务方可用相同密钥验证请求合法性
- 签名计算方式：`HMAC-SHA256(JSON.stringify(payload), secret_key)`

## 💡 设计要点

1. **数据持久化**: 所有操作保存到 SQLite，刷新不丢失
2. **责任节点追踪**: 每次失败都记录责任节点，便于问题定位
3. **幂等性设计**: 支持重复回调，状态变更有历史记录
4. **可观测性**: 完整的日志和导出功能
5. **演示友好**: 内置模拟失败机制，便于展示异常处理流程
